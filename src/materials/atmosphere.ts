import { Color, type CubeTexture, type Material, type Texture, Vector3 } from 'three';
import { SUN_DIRECTION } from '../journey/layout';

/**
 * Aerial perspective shared by every material in the world: exponential
 * height fog whose colour is sampled from the sky itself in the view
 * direction, so distant cliffs melt into the exact tint of the horizon
 * behind them — warm toward the sun, cool away from it.
 */
export const ATMOS = {
  uAtmosSky: { value: null as CubeTexture | Texture | null },
  uAtmosDensity: { value: 0.95e-4 },
  uAtmosFalloff: { value: 1 / 300 },
  uAtmosStrength: { value: 1 },
  uAtmosTint: { value: new Color(1, 1, 1) },
  uAtmosSunDir: { value: SUN_DIRECTION.clone() as Vector3 },
};

export const ATMOS_PARS = /* glsl */ `
uniform samplerCube uAtmosSky;
uniform float uAtmosDensity;
uniform float uAtmosFalloff;
uniform float uAtmosStrength;
uniform vec3 uAtmosTint;
uniform vec3 uAtmosSunDir;

float atmosAmount(vec3 wp) {
  vec3 rd = wp - cameraPosition;
  float dist = length(rd);
  rd /= max(dist, 1e-4);
  float b = uAtmosFalloff;
  float k = rd.y * b * dist;
  float integ = abs(k) > 1e-4 ? (1.0 - exp(-k)) / k : 1.0;
  float fog = uAtmosDensity * exp(-max(cameraPosition.y, 0.0) * b) * dist * integ;
  return (1.0 - exp(-fog)) * uAtmosStrength;
}
vec3 atmosColor(vec3 wp) {
  vec3 rd = normalize(wp - cameraPosition);
  vec3 dir = normalize(vec3(rd.x, max(rd.y, 0.0) * 0.3 + 0.012, rd.z));
  vec3 c = textureCube(uAtmosSky, dir).rgb;
  float sun = pow(max(dot(rd, uAtmosSunDir), 0.0), 12.0);
  return (c + vec3(1.0, 0.62, 0.32) * sun * 0.22) * uAtmosTint;
}
vec3 applyAtmosphere(vec3 col, vec3 wp) {
  float f = atmosAmount(wp);
  return mix(col, atmosColor(wp), f);
}
`;

interface AtmosOptions {
  /** clamp depth just inside the far plane so geometry never clips at the horizon */
  clampFar?: boolean;
  /** premultiplied-alpha output (glass) */
  premultiplied?: boolean;
}

/**
 * Patches a built-in three.js material with the shared atmosphere.
 * Chains any previous onBeforeCompile.
 */
export function withAtmosphere<T extends Material>(material: T, opts: AtmosOptions = {}): T {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, ATMOS);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAtmosWorld;')
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
        {
          vec4 aw = vec4(transformed, 1.0);
          #ifdef USE_BATCHING
            aw = batchingMatrix * aw;
          #endif
          #ifdef USE_INSTANCING
            aw = instanceMatrix * aw;
          #endif
          vAtmosWorld = (modelMatrix * aw).xyz;
          ${opts.clampFar ? 'gl_Position.z = min(gl_Position.z, gl_Position.w * 0.99999);' : ''}
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAtmosWorld;\n${ATMOS_PARS}`)
      .replace(
        '#include <fog_fragment>',
        opts.premultiplied
          ? `{ float af = atmosAmount(vAtmosWorld); gl_FragColor.rgb = mix(gl_FragColor.rgb, atmosColor(vAtmosWorld) * gl_FragColor.a, af); }`
          : `gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld);`,
      );
  };
  const key = `atmos${opts.clampFar ? 'F' : ''}${opts.premultiplied ? 'P' : ''}`;
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|${key}`;
  material.needsUpdate = true;
  return material;
}
