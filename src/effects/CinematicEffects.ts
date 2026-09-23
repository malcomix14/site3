import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Uniform, Vector2, Vector3 } from 'three';

/**
 * Lens: simulated motion blur (radial, driven by camera speed) and a subtle
 * radial chromatic aberration. It samples the input buffer, so it is a
 * convolution effect and must come first in its pass.
 */
export class LensEffect extends Effect {
  constructor() {
    super(
      'LensEffect',
      /* glsl */ `
      uniform float uBlur;
      uniform float uAberration;
      uniform vec2 uCenter;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 dir = uv - uCenter;
        vec3 acc = inputColor.rgb;
        if (uBlur > 0.002) {
          acc = vec3(0.0);
          float wsum = 0.0;
          for (int i = 0; i < 12; i++) {
            float t = float(i) / 11.0;
            float w = 1.0 - t * 0.6;
            acc += texture2D(inputBuffer, uv - dir * t * uBlur * 0.075).rgb * w;
            wsum += w;
          }
          acc /= wsum;
        }
        if (uAberration > 0.0005) {
          float d = dot(dir, dir);
          vec2 off = dir * d * uAberration;
          acc.r = mix(acc.r, texture2D(inputBuffer, uv - off).r, 0.85);
          acc.b = mix(acc.b, texture2D(inputBuffer, uv + off).b, 0.85);
        }
        outputColor = vec4(acc, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        attributes: EffectAttribute.CONVOLUTION,
        uniforms: new Map<string, Uniform>([
          ['uBlur', new Uniform(0)],
          ['uAberration', new Uniform(0.012)],
          ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
        ]),
      },
    );
  }
  set blur(v: number) {
    this.uniforms.get('uBlur')!.value = v;
  }
  set aberration(v: number) {
    this.uniforms.get('uAberration')!.value = v;
  }
}

/**
 * Grade: exposure → ACES filmic → split-tone grade → vignette → film grain.
 */
export class GradeEffect extends Effect {
  constructor() {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform float uExposure;
      uniform float uFade;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uTime;
      uniform float uSaturation;
      uniform float uContrast;
      uniform vec3 uShadowTint;
      uniform vec3 uHighlightTint;

      vec3 RRTAndODTFit(vec3 v) {
        vec3 a = v * (v + 0.0245786) - 0.000090537;
        vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return a / b;
      }
      vec3 acesFilmic(vec3 color) {
        const mat3 ACESInputMat = mat3(
          vec3(0.59719, 0.07600, 0.02840),
          vec3(0.35458, 0.90834, 0.13383),
          vec3(0.04823, 0.01566, 0.83777)
        );
        const mat3 ACESOutputMat = mat3(
          vec3( 1.60475, -0.10208, -0.00327),
          vec3(-0.53108,  1.10813, -0.07276),
          vec3(-0.07367, -0.00605,  1.07602)
        );
        color = ACESInputMat * color;
        color = RRTAndODTFit(color);
        color = ACESOutputMat * color;
        return clamp(color, 0.0, 1.0);
      }
      float hashG(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * uExposure / 0.6;
        c = acesFilmic(c);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // split tone: cool shadows, warm highlights
        c *= mix(uShadowTint, uHighlightTint, smoothstep(0.05, 0.7, l));
        // saturation & gentle S-curve
        c = mix(vec3(l), c, uSaturation);
        c = clamp(c, 0.0, 1.0);
        c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
        // vignette
        vec2 q = uv - 0.5;
        float v = 1.0 - dot(q, q) * uVignette * 2.2;
        c *= clamp(v, 0.0, 1.0);
        // grain (luma weighted)
        float g = hashG(uv * vec2(1931.0, 1777.0) + fract(uTime * 7.13) * 97.0) - 0.5;
        c += g * uGrain * (0.12 + 3.2 * l * (1.0 - l));
        outputColor = vec4(max(c, 0.0) * uFade, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map<string, Uniform>([
          ['uExposure', new Uniform(1)],
          ['uFade', new Uniform(0)],
          ['uVignette', new Uniform(0.38)],
          ['uGrain', new Uniform(0.022)],
          ['uTime', new Uniform(0)],
          ['uSaturation', new Uniform(1.04)],
          ['uContrast', new Uniform(0.12)],
          ['uShadowTint', new Uniform(new Vector3(0.975, 1.0, 1.035))],
          ['uHighlightTint', new Uniform(new Vector3(1.03, 1.0, 0.955))],
        ]),
      },
    );
  }
  u(name: string) {
    return this.uniforms.get(name)!;
  }
}
