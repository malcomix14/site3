import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { SUN_DIRECTION } from '../journey/layout';
import { mulberry32 } from '../utils/noise';

/**
 * Volumetric-looking sun shafts: soft additive prisms aligned with the sun,
 * occluded by the depth buffer, with slow drifting density.
 */
const beamVert = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const beamFrag = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;
varying vec3 vLocal;
varying vec3 vWorld;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float ex = 1.0 - smoothstep(0.18, 0.5, abs(vLocal.x));
  float ey = 1.0 - smoothstep(0.2, 0.5, abs(vLocal.y));
  float along = vLocal.z;
  float fade = smoothstep(0.0, 0.06, along) * pow(1.0 - along, 1.4);
  float dust = 0.65 + 0.35 * n2(vec2(vWorld.x * 0.6 + uTime * 0.05, vWorld.y * 0.6 - uTime * 0.03) + vLocal.z * 3.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float a = ex * ey * fade * dust * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

export interface BeamSpec {
  /** entry point (centre of the beam at the window plane) */
  at: Vector3;
  width: number;
  height: number;
  length: number;
}

export function createLightBeams(specs: BeamSpec[], color = new Color(1.0, 0.78, 0.52), intensity = 0.08) {
  const group = new Group();
  const mat = new ShaderMaterial({
    vertexShader: beamVert,
    fragmentShader: beamFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: intensity }, uColor: { value: color } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const dir = SUN_DIRECTION.clone().negate();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir);
  for (const s of specs) {
    const g = new BoxGeometry(1, 1, 1);
    g.translate(0, 0, 0.5);
    const m = new Mesh(g, mat);
    m.scale.set(s.width, s.height, s.length);
    m.quaternion.copy(q);
    m.position.copy(s.at);
    m.renderOrder = 8;
    m.frustumCulled = true;
    group.add(m);
  }
  return { group, material: mat };
}

/** Dust motes floating in the light, gently pushed around by the pointer. */
const dustVert = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform vec3 uBoxMin;
uniform vec3 uBoxSize;
uniform vec2 uPointer;
uniform float uSize;
varying float vAlpha;
void main() {
  vec3 p = position;
  float t = uTime * 0.05 + aSeed * 10.0;
  p += vec3(sin(t * 1.3 + aSeed * 7.0), sin(t * 0.7 + aSeed * 3.0) * 0.6 - uTime * 0.004, cos(t * 1.1 + aSeed * 5.0)) * 0.35;
  p.x += uPointer.x * 0.4 * (0.5 + aSeed);
  p.y += uPointer.y * 0.2 * (0.5 + aSeed);
  p = uBoxMin + mod(p - uBoxMin, uBoxSize);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.5 + aSeed) / max(-mv.z, 0.1);
  vAlpha = (0.35 + 0.65 * fract(aSeed * 13.7)) * smoothstep(0.3, 1.5, -mv.z);
}
`;
const dustFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = 1.0 - smoothstep(0.1, 0.5, length(c));
  gl_FragColor = vec4(uColor * d * vAlpha * uIntensity, 1.0);
}
`;

export function createDust(min: Vector3, max: Vector3, count: number, seed = 3, size = 9) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = min.x + rnd() * (max.x - min.x);
    pos[i * 3 + 1] = min.y + rnd() * (max.y - min.y);
    pos[i * 3 + 2] = min.z + rnd() * (max.z - min.z);
    seeds[i] = rnd();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  const mat = new ShaderMaterial({
    vertexShader: dustVert,
    fragmentShader: dustFrag,
    uniforms: {
      uTime: { value: 0 },
      uBoxMin: { value: min.clone() },
      uBoxSize: { value: max.clone().sub(min) },
      uPointer: { value: new Vector3() },
      uSize: { value: size },
      uColor: { value: new Color(1.0, 0.85, 0.66) },
      uIntensity: { value: 0.45 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 9;
  return { points, material: mat };
}
