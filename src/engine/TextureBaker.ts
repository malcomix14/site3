import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Texture,
  UnsignedByteType,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { NOISE_GLSL } from '../materials/glsl/noise';

export type BakeOutput = 'color' | 'normal' | 'orm' | 'data';

export interface BakeRequest {
  /** GLSL defining any of: vec3 albedo(vec2), float height(vec2), float rough(vec2), float metal(vec2), float ao(vec2), vec4 data(vec2) */
  glsl: string;
  output: BakeOutput;
  size: number;
  /** tangent-space normal strength (height delta scale) */
  normalStrength?: number;
  /** clamp instead of repeat (for non tiling images like paintings) */
  clamp?: boolean;
  /** disable mip-mapping (atlases) */
  noMips?: boolean;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const HELPERS = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
vec3 S(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 S(float r, float g, float b) { return S(vec3(r, g, b)); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

function fragFor(req: BakeRequest): string {
  const body = (() => {
    switch (req.output) {
      case 'color':
        return 'gl_FragColor = vec4(albedo(vUv), 1.0);';
      case 'data':
        return 'gl_FragColor = data(vUv);';
      case 'orm':
        return `
          #ifdef HAS_AO
            float o = ao(vUv);
          #else
            float o = 1.0;
          #endif
          #ifdef HAS_ROUGH
            float r = rough(vUv);
          #else
            float r = 0.5;
          #endif
          #ifdef HAS_METAL
            float m = metal(vUv);
          #else
            float m = 0.0;
          #endif
          gl_FragColor = vec4(o, r, m, 1.0);`;
      case 'normal':
        return `
          vec2 e = vec2(1.0 / uSize, 0.0);
          float hL = height(fract(vUv - e.xy));
          float hR = height(fract(vUv + e.xy));
          float hD = height(fract(vUv - e.yx));
          float hU = height(fract(vUv + e.yx));
          float k = uStrength * uSize / 512.0;
          vec3 n = normalize(vec3((hL - hR) * k, (hD - hU) * k, 1.0));
          gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);`;
    }
  })();
  const defines = [
    /\bfloat\s+ao\s*\(/.test(req.glsl) ? '#define HAS_AO' : '',
    /\bfloat\s+rough\s*\(/.test(req.glsl) ? '#define HAS_ROUGH' : '',
    /\bfloat\s+metal\s*\(/.test(req.glsl) ? '#define HAS_METAL' : '',
  ].join('\n');
  return `
precision highp float;
varying vec2 vUv;
uniform float uSize;
uniform float uStrength;
${defines}
${HELPERS}
${NOISE_GLSL}
${req.glsl}
void main() {
  ${body}
}`;
}

/**
 * Bakes procedural material maps on the GPU into mip-mapped render targets.
 * Colour maps are stored as sRGB8 (hardware-encoded), data maps as linear RGBA8.
 */
export class TextureBaker {
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;
  private targets: WebGLRenderTarget[] = [];
  private renderer: WebGLRenderer;
  private anisotropy: number;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.quad = new Mesh(new PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  bake(req: BakeRequest): Texture {
    const srgb = req.output === 'color';
    const rt = new WebGLRenderTarget(req.size, req.size, {
      type: UnsignedByteType,
      colorSpace: srgb ? SRGBColorSpace : LinearSRGBColorSpace,
      generateMipmaps: !req.noMips,
      minFilter: req.noMips ? LinearFilter : LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      wrapS: req.clamp ? ClampToEdgeWrapping : RepeatWrapping,
      wrapT: req.clamp ? ClampToEdgeWrapping : RepeatWrapping,
      anisotropy: this.anisotropy,
    });
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: fragFor(req),
      uniforms: {
        uSize: { value: req.size },
        uStrength: { value: req.normalStrength ?? 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad.material = material;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prev);
    material.dispose();
    this.targets.push(rt);
    return rt.texture;
  }

  dispose() {
    this.targets.forEach((t) => t.dispose());
    this.quad.geometry.dispose();
  }
}
