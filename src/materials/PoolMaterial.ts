import { Color, ShaderMaterial, type Texture } from 'three';
import { SUN_DIRECTION } from '../journey/layout';
import { ATMOS, ATMOS_PARS } from './atmosphere';
import { NOISE_GLSL } from './glsl/noise';

/**
 * Still water for pools and the jacuzzi: sky reflection with fresnel,
 * turquoise depth, animated caustics on the tiled floor, sun glints.
 */
const vertexShader = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragmentShader = /* glsl */ `
uniform samplerCube uSky;
uniform sampler2D uNormalMap;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uDepth;
varying vec3 vWorld;
varying vec2 vUv;
${ATMOS_PARS}
${NOISE_GLSL}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec2 w = vWorld.xz;
  vec3 n1 = texture2D(uNormalMap, w / 3.2 + uTime * vec2(0.012, 0.008)).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uNormalMap, w / 1.3 - uTime * vec2(0.01, 0.017)).xyz * 2.0 - 1.0;
  vec3 N = normalize(vec3((n1.x + n2.x) * 0.06, 1.0, (n1.y + n2.y) * 0.06));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 refl = textureCube(uSky, R).rgb;
  // floor seen through the water (refraction offset) with caustics
  vec2 fp = w + V.xz * uDepth * 0.5 + N.xz * 0.3;
  float c1 = pvoronoi(fp * 1.7 + uTime * 0.25, vec2(1000.0)).x;
  float c2 = pvoronoi(fp * 2.3 - uTime * 0.21 + 4.0, vec2(1000.0)).x;
  float caustic = pow(1.0 - min(c1, c2), 6.0) * 1.4;
  float tiles = step(0.06, fract(fp.x * 4.0)) * step(0.06, fract(fp.y * 4.0));
  vec3 floorCol = mix(uDeep, uShallow, 0.6) * (0.85 + 0.15 * tiles) + vec3(0.9, 1.0, 0.95) * caustic * max(uSunDir.y, 0.1) * 2.2;
  vec3 body = mix(floorCol, uDeep, 0.35);
  vec3 H = normalize(V + uSunDir);
  float spec = pow(max(dot(N, H), 0.0), 900.0) * 40.0;
  vec3 col = mix(body, refl, fres) + vec3(1.0, 0.8, 0.6) * spec;
  col = applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createPoolMaterial(sky: Texture, normalMap: Texture, opts: { deep?: string; shallow?: string; depth?: number } = {}) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...ATMOS,
      uSky: { value: sky },
      uNormalMap: { value: normalMap },
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIRECTION.clone() },
      uDeep: { value: new Color(opts.deep ?? '#0b6e7a') },
      uShallow: { value: new Color(opts.shallow ?? '#7fd7d6') },
      uDepth: { value: opts.depth ?? 1.4 },
    },
  });
}
