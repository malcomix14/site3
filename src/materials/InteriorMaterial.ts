import { ShaderMaterial, type Texture, Vector3 } from 'three';
import { ATMOS, ATMOS_PARS } from './atmosphere';
import { NOISE_GLSL } from './glsl/noise';

/**
 * Interior mapping for the guest floors: every glass bay reveals a lit room
 * (walls, ceiling glow, floor, a bed, sheer curtains) ray-traced in the
 * fragment shader — real parallax without a single extra polygon.
 * The facade plane faces −Z; rooms extend toward +Z.
 */
const vertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragmentShader = /* glsl */ `
uniform samplerCube uSky;
uniform vec3 uOrigin;     // x0, floor y, facade z
uniform vec3 uRoom;       // width, height, depth
uniform float uSeed;
uniform vec3 uSunDir;
varying vec3 vWorld;
${ATMOS_PARS}
${NOISE_GLSL}

float boxHit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  return (tn < tf && tn > 0.0) ? tn : 1e9;
}

void main() {
  vec3 rd = normalize(vWorld - cameraPosition);
  vec2 local = vec2(vWorld.x - uOrigin.x, vWorld.y - uOrigin.y);
  vec2 cellId = floor(local / uRoom.xy);
  vec2 f = fract(local / uRoom.xy) * uRoom.xy;
  float r1 = hash12(cellId + uSeed);
  float r2 = hash12(cellId * 1.7 + uSeed + 3.1);
  float r3 = hash12(cellId * 2.3 + uSeed + 7.7);
  vec3 ro = vec3(f, 0.0);
  vec3 d = vec3(rd.x, rd.y, max(rd.z, 1e-3));
  float W = uRoom.x, H = uRoom.y, D = uRoom.z;
  float tx = d.x > 0.0 ? (W - ro.x) / d.x : -ro.x / d.x;
  float ty = d.y > 0.0 ? (H - ro.y) / d.y : -ro.y / d.y;
  float tz = D / d.z;
  float t = min(min(tx, ty), tz);
  vec3 hit = ro + d * t;

  bool lightsOn = r1 > 0.28;
  vec3 lamp = mix(vec3(1.0, 0.72, 0.45), vec3(1.0, 0.82, 0.62), r2) * (lightsOn ? 1.0 : 0.12);
  vec3 wallCol = mix(vec3(0.62, 0.55, 0.47), vec3(0.72, 0.66, 0.58), r3);
  vec3 col;
  vec2 lampPos = vec2(W * 0.5, D * 0.55);
  if (t == tz) {
    // back wall: headboard + art
    col = wallCol * 0.8;
    float head = step(abs(hit.x - W * 0.5), W * 0.28) * step(hit.y, 1.3);
    col = mix(col, vec3(0.3, 0.24, 0.19), head);
    float art = step(abs(hit.x - W * 0.5), 0.5) * step(abs(hit.y - 1.9), 0.35) * step(0.5, r2);
    col = mix(col, vec3(0.5, 0.2, 0.12), art);
    col *= 0.55 + 0.45 * smoothstep(0.0, H, hit.y);
  } else if (t == ty && d.y < 0.0) {
    // floor: warm oak
    float plank = fract(hit.x * 4.5);
    col = vec3(0.34, 0.22, 0.13) * (0.85 + 0.15 * step(0.03, plank));
    col *= 0.45 + 0.55 * exp(-length(hit.xz - lampPos) * 0.35);
  } else if (t == ty) {
    // ceiling with a warm pool of light
    col = wallCol * 1.1 * (0.35 + 1.4 * exp(-length(hit.xz - lampPos) * 0.8));
  } else {
    col = wallCol * (0.5 + 0.5 * smoothstep(0.0, H, hit.y));
    col *= 0.6 + 0.4 * exp(-abs(hit.z - lampPos.y) * 0.3);
  }
  col *= lamp;

  // bed
  float tb = boxHit(ro, d, vec3(W * 0.22, 0.0, D - 2.2), vec3(W * 0.78, 0.55, D));
  if (tb < t) {
    vec3 hb = ro + d * tb;
    col = vec3(0.86, 0.83, 0.78) * lamp * (0.55 + 0.45 * smoothstep(0.3, 0.55, hb.y));
    t = tb;
  }
  // lamp glow on the nightstand
  float glow = exp(-length(vec2(hit.x - W * 0.12, hit.y - 0.95)) * 5.0) * step(D - 0.4, hit.z) * (lightsOn ? 1.0 : 0.0);
  col += vec3(1.0, 0.7, 0.4) * glow * 1.2;

  // sheer curtains a few centimetres behind the glass
  float tc = 0.35 / d.z;
  vec3 hc = ro + d * tc;
  float open = mix(0.25, 0.85, r3);
  float curtain = smoothstep(open * W - 0.1, open * W + 0.1, hc.x) + (1.0 - smoothstep(0.05 * W, 0.2 * W, hc.x)) * step(0.5, r2);
  curtain = clamp(curtain, 0.0, 1.0);
  float folds = 0.85 + 0.15 * sin(hc.x * 26.0 + r1 * 10.0);
  vec3 curtainCol = vec3(0.88, 0.84, 0.77) * (lightsOn ? 0.75 : 0.25) * folds * lamp.r;
  col = mix(col, curtainCol, curtain * 0.82);

  // mullions & spandrel
  float mull = step(f.x, 0.05) + step(W - 0.05, f.x) + step(f.y, 0.12) + step(H - 0.08, f.y);
  col = mix(col, vec3(0.05, 0.045, 0.04), clamp(mull, 0.0, 1.0));

  // glass: reflection of the sky with fresnel
  vec3 R = reflect(rd, vec3(0.0, 0.0, -1.0));
  R.y = abs(R.y);
  vec3 refl = textureCube(uSky, R).rgb;
  float fres = 0.06 + 0.94 * pow(1.0 - max(dot(-rd, vec3(0.0, 0.0, -1.0)), 0.0), 5.0);
  col = col * 0.9 * (1.0 - fres) + refl * (fres + 0.04);
  col = applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createInteriorMaterial(sky: Texture, origin: Vector3, room: Vector3, seed: number) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...ATMOS,
      uSky: { value: sky },
      uOrigin: { value: origin.clone() },
      uRoom: { value: room.clone() },
      uSeed: { value: seed },
      uSunDir: { value: new Vector3() },
    },
  });
}
