import { AdditiveBlending, Color, DoubleSide, MeshStandardMaterial, ShaderMaterial, type Texture } from 'three';
import { withAtmosphere } from './atmosphere';

/** Shared clock for animated materials. */
export const SOFT_UNIFORMS = {
  uTime: { value: 0 },
  uPointer: { value: new Color(0, 0, 0) },
};

/**
 * Sheer linen curtains: vertical folds and a slow billow in the vertex
 * shader, back-lit translucency by the sun in the fragment shader.
 */
export function createCurtainMaterial(env: Texture, linen: { map?: Texture; normalMap?: Texture }, color = '#efe8dc') {
  const m = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.62,
    side: DoubleSide,
    depthWrite: false,
    envMap: env,
    envMapIntensity: 0.6,
    map: linen.map,
    normalMap: linen.normalMap,
    emissive: new Color('#ffcf9a'),
    emissiveIntensity: 0.55,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SOFT_UNIFORMS.uTime;
    shader.uniforms.uPointer = SOFT_UNIFORMS.uPointer;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uPointer;')
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
         float fy = clamp(uv.y, 0.0, 1.0);
         float folds = sin(position.x * 7.5) * 0.07 + sin(position.x * 17.0 + 1.3) * 0.02;
         float billow = sin(uTime * 0.55 + position.x * 0.6) * 0.09 + sin(uTime * 0.9 + position.x * 1.7) * 0.04;
         transformed.z += folds + billow * (1.0 - fy) * (1.0 - fy) + uPointer.x * 0.05 * (1.0 - fy);`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance *= 0.8 + 0.2 * sin(vMapUv.x * 60.0);`,
    );
  };
  m.customProgramCacheKey = () => 'curtain';
  m.userData.tile = 1;
  return withAtmosphere(m);
}

/** Linear fire: rising noise flames, additive. */
export function createFireMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: SOFT_UNIFORMS.uTime },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.1; a *= 0.5; } return s; }
      void main() {
        vec2 p = vec2(vUv.x * 14.0, vUv.y * 2.0 - uTime * 1.6);
        float f = fbm(p) * 1.2 + fbm(p * 2.3 + 4.0) * 0.4;
        float shape = (1.0 - vUv.y) * (0.75 + 0.5 * fbm(vec2(vUv.x * 6.0, uTime * 0.6)));
        float flame = smoothstep(0.35, 0.9, f * shape * 1.6 - vUv.y * 0.35);
        vec3 col = mix(vec3(1.0, 0.25, 0.03), vec3(1.0, 0.75, 0.35), flame) * flame * 3.2;
        col += vec3(1.0, 0.5, 0.15) * smoothstep(0.25, 0.0, vUv.y) * 0.8;
        float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(0.0, 0.04, 1.0 - vUv.x);
        gl_FragColor = vec4(col * edge, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}
