import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  Color,
  CustomBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useAssets } from '../engine/assets';
import { journey } from '../journey/journeyState';
import { SUN_DIRECTION } from '../journey/layout';
import { ATMOS, ATMOS_PARS } from '../materials/atmosphere';
import { mulberry32 } from '../utils/noise';
import { visibilityOverride } from './useVisibleRange';

/**
 * Cumulus field: a few hundred soft, sun-lit billboards arranged in clusters.
 * Dense above the sea (the view from the hublot), with a corridor of puffs
 * the camera dives through, and distant banks on the horizon.
 */

const vertexShader = /* glsl */ `
attribute vec4 iCenter;   // xyz, drift factor
attribute vec4 iParams;   // size, rotation, atlas cell, opacity
uniform float uTime;
uniform float uWind;
varying vec2 vUv;
varying vec2 vLocal;
varying float vAlpha;
varying vec3 vWorld;
varying vec3 vCenter;
varying float vCell;
varying float vSize;
void main() {
  vec3 c = iCenter.xyz;
  c.x += uWind * iCenter.w;
  float s = iParams.x;
  float r = iParams.y;
  vec2 p = position.xy;
  vec2 pr = vec2(p.x * cos(r) - p.y * sin(r), p.x * sin(r) + p.y * cos(r));
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = c + (right * pr.x + up * pr.y) * s;
  float d = distance(cameraPosition, c);
  vAlpha = iParams.w * smoothstep(s * 0.18, s * 0.75, d);
  vUv = uv;
  vLocal = pr;
  vWorld = world;
  vCenter = c;
  vCell = iParams.z;
  vSize = s;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999995);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uShadowColor;
uniform float uFade;
varying vec2 vUv;
varying vec2 vLocal;
varying float vAlpha;
varying vec3 vWorld;
varying vec3 vCenter;
varying float vCell;
varying float vSize;
${ATMOS_PARS}
void main() {
  vec2 cell = vec2(mod(vCell, 2.0), floor(vCell / 2.0));
  vec2 auv = (cell + 0.03 + vUv * 0.94) * 0.5;
  vec4 t = texture2D(uAtlas, auv);
  float dens = t.r;
  float a = dens * vAlpha * uFade;
  if (a < 0.003) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  // pseudo sphere normal for each puff
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 n = normalize(right * vLocal.x + up * vLocal.y + V * 0.55);
  float ndl = dot(n, uSunDir) * 0.5 + 0.5;
  float light = mix(0.35, 1.0, t.g);
  float lit = clamp(ndl * light, 0.0, 1.0);
  float heightShade = smoothstep(vCenter.y - vSize * 0.45, vCenter.y + vSize * 0.2, vWorld.y);
  vec3 col = mix(uShadowColor, uSunColor, lit * (0.45 + 0.55 * heightShade));
  // forward scattering: silver lining when looking toward the sun
  float fwd = pow(max(dot(-V, uSunDir), 0.0), 6.0);
  col += uSunColor * fwd * t.b * 1.6;
  col = applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col * a, a);
}
`;

interface CloudSpec {
  x: number;
  y: number;
  z: number;
  size: number;
  drift: number;
  opacity: number;
}

function layoutClouds(total: number): CloudSpec[] {
  const rnd = mulberry32(7);
  const out: CloudSpec[] = [];
  const cluster = (cx: number, cy: number, cz: number, radius: number, n: number, sMin: number, sMax: number, drift: number, flat = 0.45) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * radius;
      const h = rnd();
      out.push({
        x: cx + Math.cos(a) * r,
        y: cy + h * radius * flat - (r / radius) * radius * 0.15,
        z: cz + Math.sin(a) * r * 0.8,
        size: sMin + rnd() * (sMax - sMin),
        drift,
        opacity: 0.75 + rnd() * 0.25,
      });
    }
  };
  // 1. corridor of the dive (guaranteed passage through cloud)
  const path: Array<[number, number, number]> = [
    [-10, 300, -1170],
    [8, 268, -1080],
    [-24, 240, -990],
    [10, 214, -900],
    [-14, 190, -820],
  ];
  path.forEach(([x, y, z]) => cluster(x, y, z, 70, 9, 55, 110, 0.15, 0.4));
  // 2. the cumulus deck below the aircraft
  const deckClusters = Math.round((total * 0.62) / 10);
  for (let i = 0; i < deckClusters; i++) {
    const x = (rnd() * 2 - 1) * 1700;
    const z = -2900 + rnd() * 2400;
    if (Math.abs(x) < 70 && z > -1250 && z < -800) continue;
    const y = 250 + rnd() * 40;
    cluster(x, y, z, 70 + rnd() * 90, 8 + Math.floor(rnd() * 6), 55, 150, 1, 0.5);
  }
  // 3. far horizon banks
  while (out.length < total) {
    const a = rnd() * Math.PI * 2;
    const d = 3500 + rnd() * 6500;
    out.push({
      x: Math.cos(a) * d,
      y: 180 + rnd() * 260,
      z: Math.sin(a) * d - 1200,
      size: 380 + rnd() * 520,
      drift: 0.3,
      opacity: 0.55 + rnd() * 0.35,
    });
  }
  return out.slice(0, total);
}

export function CloudScene() {
  const { textures, quality } = useAssets();

  const built = useMemo(() => {
    const specs = layoutClouds(quality.clouds);
    const n = specs.length;
    const base = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    const center = new Float32Array(n * 4);
    const params = new Float32Array(n * 4);
    const rnd = mulberry32(11);
    specs.forEach((c, i) => {
      center.set([c.x, c.y, c.z, c.drift], i * 4);
      params.set([c.size, rnd() * Math.PI * 2 * 0.15 - 0.15, Math.floor(rnd() * 4), c.opacity], i * 4);
    });
    const iCenter = new InstancedBufferAttribute(center, 4);
    const iParams = new InstancedBufferAttribute(params, 4);
    geo.setAttribute('iCenter', iCenter);
    geo.setAttribute('iParams', iParams);
    geo.instanceCount = n;
    const mat = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        ...ATMOS,
        uAtlas: { value: textures.cloudAtlas },
        uTime: { value: 0 },
        uWind: { value: 0 },
        uSunDir: { value: SUN_DIRECTION.clone() },
        uSunColor: { value: new Color(1.9, 1.62, 1.34) },
        uShadowColor: { value: new Color(0.42, 0.5, 0.62) },
        uFade: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
    });
    const mesh = new Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    mesh.name = 'clouds';
    return { mesh, mat, center, params, iCenter, iParams, specs, order: new Uint32Array(n).map((_, i) => i), dist: new Float32Array(n), frame: 0 };
  }, [textures, quality]);

  const tmp = useMemo(() => new Vector3(), []);

  useFrame(({ camera }) => {
    const b = built;
    const p = journey.progress;
    const visible = visibilityOverride.all || p < 44;
    b.mesh.visible = visible;
    if (!visible) return;
    b.mat.uniforms.uTime.value = journey.time;
    // gentle wind; almost still once we are low
    b.mat.uniforms.uWind.value = journey.time * 2.2;
    b.mat.uniforms.uFade.value = 1;

    // back-to-front sort every other frame (premultiplied blending needs it)
    b.frame++;
    if (b.frame % 2 !== 0) return;
    const n = b.specs.length;
    const wind = b.mat.uniforms.uWind.value as number;
    for (let i = 0; i < n; i++) {
      tmp.set(b.specs[i].x + wind * b.specs[i].drift, b.specs[i].y, b.specs[i].z);
      b.dist[i] = tmp.distanceToSquared(camera.position);
    }
    const order = Array.from(b.order).sort((x, y) => b.dist[y] - b.dist[x]);
    const src = b.specs;
    for (let k = 0; k < n; k++) {
      const i = order[k];
      const c = src[i];
      b.center[k * 4] = c.x;
      b.center[k * 4 + 1] = c.y;
      b.center[k * 4 + 2] = c.z;
      b.center[k * 4 + 3] = c.drift;
    }
    // params follow the same permutation
    if (!b.mesh.userData.params) b.mesh.userData.params = Float32Array.from(b.params);
    const orig = b.mesh.userData.params as Float32Array;
    for (let k = 0; k < n; k++) {
      const i = order[k];
      b.params[k * 4] = orig[i * 4];
      b.params[k * 4 + 1] = orig[i * 4 + 1];
      b.params[k * 4 + 2] = orig[i * 4 + 2];
      b.params[k * 4 + 3] = orig[i * 4 + 3];
    }
    b.iCenter.needsUpdate = true;
    b.iParams.needsUpdate = true;
  });

  return <primitive object={built.mesh} />;
}
