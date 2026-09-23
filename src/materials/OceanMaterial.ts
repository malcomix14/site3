import { BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Texture, Vector2, Vector3 } from 'three';
import { SUN_DIRECTION } from '../journey/layout';
import { COAST_GLSL } from '../scenes/builders/terrain';
import { ATMOS, ATMOS_PARS } from './atmosphere';
import { NOISE_GLSL } from './glsl/noise';

/**
 * A radial grid that follows the camera: dense under the lens, sparse toward
 * the horizon. Waves are evaluated in world space so the grid can slide freely.
 */
export function createOceanGeometry(rings: number, segments: number, inner = 0.4, outer = 22000) {
  const verts: number[] = [0, 0, 0];
  const idx: number[] = [];
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    const radius = inner + (outer - inner) * Math.pow(t, 3.2);
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      verts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
  }
  // center fan
  for (let s = 0; s < segments; s++) {
    const a = 1 + s;
    const b = 1 + ((s + 1) % segments);
    idx.push(0, b, a);
  }
  for (let r = 1; r < rings; r++) {
    const base = 1 + (r - 1) * segments;
    const next = base + segments;
    for (let s = 0; s < segments; s++) {
      const a = base + s;
      const b = base + ((s + 1) % segments);
      const c = next + s;
      const d = next + ((s + 1) % segments);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  g.setIndex(idx);
  return g;
}

export const WAVES_GLSL = /* glsl */ `
// direction.xy, wavelength, amplitude
const int WAVE_COUNT = 6;
vec4 waveDefs[6] = vec4[6](
  vec4( 0.96,  0.28, 61.0, 0.34),
  vec4( 0.71, -0.70, 33.0, 0.19),
  vec4(-0.37,  0.93, 18.0, 0.10),
  vec4( 0.29,  0.96,  9.5, 0.055),
  vec4(-0.95,  0.30,  5.4, 0.03),
  vec4( 0.62,  0.78,  2.9, 0.016)
);
vec3 gerstner(vec2 p, float t, float fade, out vec3 normal) {
  vec3 disp = vec3(0.0);
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    vec4 w = waveDefs[i];
    vec2 d = normalize(w.xy);
    float k = 6.2831853 / w.z;
    float c = sqrt(9.81 / k);
    float a = w.w * fade;
    float q = 0.55;
    float f = k * (dot(d, p) - c * t);
    float sf = sin(f);
    float cf = cos(f);
    disp.x += q * a * d.x * cf;
    disp.z += q * a * d.y * cf;
    disp.y += a * sf;
    tangent += vec3(-q * d.x * d.x * a * k * sf, d.x * a * k * cf, -q * d.x * d.y * a * k * sf);
    binormal += vec3(-q * d.x * d.y * a * k * sf, d.y * a * k * cf, -q * d.y * d.y * a * k * sf);
  }
  normal = normalize(cross(binormal, tangent));
  return disp;
}
`;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform vec2 uOffset;
varying vec3 vWorld;
varying vec3 vWaveNormal;
varying float vCrest;
${WAVES_GLSL}
void main() {
  vec3 p = position;
  p.xz += uOffset;
  float dist = length(p.xz - cameraPosition.xz);
  float fade = 1.0 - smoothstep(400.0, 2600.0, dist);
  vec3 n;
  vec3 d = gerstner(p.xz, uTime, fade, n);
  p += d;
  vWorld = p;
  vWaveNormal = n;
  vCrest = d.y;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999995);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform samplerCube uSky;
uniform sampler2D uNormalMap;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uYachtPos;
uniform vec2 uYachtAxis;
uniform float uSunStrength;
varying vec3 vWorld;
varying vec3 vWaveNormal;
varying float vCrest;
${ATMOS_PARS}
${NOISE_GLSL}
${COAST_GLSL}

vec3 sampleDetail(vec2 uv) {
  return texture2D(uNormalMap, uv).xyz * 2.0 - 1.0;
}

void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  vec2 w = vWorld.xz;
  vec3 d1 = sampleDetail(w / 27.0 + uTime * vec2(0.011, 0.006));
  vec3 d2 = sampleDetail(w / 11.0 + uTime * vec2(-0.012, 0.019));
  vec3 d3 = sampleDetail(w / 4.1 + uTime * vec2(0.024, -0.016));
  vec3 d4 = sampleDetail(w / 1.6 + uTime * vec2(-0.03, -0.035));
  float nearDetail = 1.0 - smoothstep(30.0, 260.0, dist);
  vec2 dxy = d1.xy * 0.9 + d2.xy * 0.7 + d3.xy * 0.45 * (0.4 + 0.6 * nearDetail) + d4.xy * 0.35 * nearDetail;
  float detailStrength = mix(0.34, 0.12, smoothstep(200.0, 4000.0, dist));
  vec3 N = normalize(vWaveNormal + vec3(dxy.x, 0.0, dxy.y) * detailStrength);

  float NdV = max(dot(N, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
  fres = mix(fres, 1.0, smoothstep(2500.0, 16000.0, dist) * 0.6);

  vec3 R = reflect(-V, N);
  R.y = abs(R.y) + 0.02;
  vec3 refl = textureCube(uSky, normalize(R)).rgb;

  // sun: sharp highlight + broad glitter path
  vec3 H = normalize(V + uSunDir);
  float NdH = max(dot(N, H), 0.0);
  float spec = pow(NdH, 1400.0) * 90.0 + pow(NdH, 220.0) * 5.0 + pow(NdH, 40.0) * 0.18;
  // glitter: sparkling micro-facets
  float sparkle = step(0.9965, hash12(floor(vWorld.xz * 3.0) + floor(uTime * 6.0))) * pow(NdH, 60.0) * 14.0 * nearDetail;
  vec3 sun = uSunColor * (spec + sparkle) * uSunStrength;

  // water body: deep blue, scattering through crests toward the sun
  vec3 deep = vec3(0.0035, 0.022, 0.042);
  vec3 scatter = vec3(0.012, 0.085, 0.095);
  float sss = pow(max(dot(V, -uSunDir * vec3(1.0, 0.0, 1.0)), 0.0), 3.0) * max(vCrest + 0.25, 0.0) * 1.4;
  vec3 body = deep + scatter * (0.25 + sss) + scatter * max(dot(N, uSunDir), 0.0) * 0.25;

  // shallows & foam along the coast
  float cz = coastZ(vWorld.x);
  float shore = vWorld.z - cz;
  float shallow = smoothstep(-90.0, -4.0, shore);
  body = mix(body, vec3(0.02, 0.16, 0.15), shallow * 0.65);
  float foamNoise = fbm2(vWorld.xz * 0.35 + vec2(uTime * 0.2, 0.0), 4) * 0.5 + 0.5;
  float surf = sin(shore * 0.9 + uTime * 1.3 + foamNoise * 3.0) * 0.5 + 0.5;
  float foam = smoothstep(-12.0, -1.0, shore) * smoothstep(0.35, 0.8, foamNoise + surf * 0.3);
  foam = max(foam, smoothstep(-3.0, 0.0, shore) * 0.9);

  // yacht: soft foam line around the hull
  vec2 rel = vWorld.xz - uYachtPos.xz;
  vec2 ax = uYachtAxis;
  vec2 loc = vec2(dot(rel, ax), dot(rel, vec2(-ax.y, ax.x)));
  float e = length(loc / vec2(25.5, 5.1));
  float hullFoam = (1.0 - smoothstep(0.96, 1.22, e)) * smoothstep(0.35, 0.8, foamNoise) * step(0.9, e);
  foam = max(foam, hullFoam * 0.6);
  float shadowUnder = 1.0 - smoothstep(0.7, 1.15, e);

  vec3 col = mix(body, refl, fres) + sun * (1.0 - shadowUnder);
  col *= 1.0 - shadowUnder * 0.55;
  col = mix(col, vec3(0.85, 0.87, 0.86) * (0.5 + 0.5 * max(dot(N, uSunDir), 0.0)) , foam * (1.0 - smoothstep(300.0, 1200.0, dist)));

  col = applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createOceanMaterial(normalMap: Texture) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...ATMOS,
      uTime: { value: 0 },
      uOffset: { value: new Vector2() },
      uSky: { value: null },
      uNormalMap: { value: normalMap },
      uSunDir: { value: SUN_DIRECTION.clone() },
      uSunColor: { value: new Color(1.0, 0.78, 0.55) },
      uSunStrength: { value: 1 },
      uYachtPos: { value: new Vector3() },
      uYachtAxis: { value: new Vector2(1, 0) },
    },
  });
}
