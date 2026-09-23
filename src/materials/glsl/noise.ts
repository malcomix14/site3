/** Shared GLSL noise toolkit (hashes, periodic gradient noise, fbm, voronoi). */
export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// ---- gradient noise, periodic (tileable) ------------------------------
vec2 gradDir(vec2 i) {
  float a = hash12(i) * 6.2831853;
  return vec2(cos(a), sin(a));
}
float pnoise(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 i00 = mod(i, period);
  vec2 i10 = mod(i + vec2(1.0, 0.0), period);
  vec2 i01 = mod(i + vec2(0.0, 1.0), period);
  vec2 i11 = mod(i + vec2(1.0, 1.0), period);
  float a = dot(gradDir(i00), f);
  float b = dot(gradDir(i10), f - vec2(1.0, 0.0));
  float c = dot(gradDir(i01), f - vec2(0.0, 1.0));
  float d = dot(gradDir(i11), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4142;
}
float pfbm(vec2 p, vec2 period, int octaves) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * pnoise(p, period);
    p *= 2.0;
    period *= 2.0;
    a *= 0.5;
  }
  return s;
}
float pturb(vec2 p, vec2 period, int octaves) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * abs(pnoise(p, period));
    p *= 2.0;
    period *= 2.0;
    a *= 0.5;
  }
  return s;
}
// F1, F2, cell id
vec3 pvoronoi(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float F1 = 8.0;
  float F2 = 8.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 c = mod(i + g, period);
      vec2 o = hash22(c);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < F1) { F2 = F1; F1 = d; id = hash12(c + 17.31); }
      else if (d < F2) { F2 = d; }
    }
  }
  return vec3(sqrt(F1), sqrt(F2), id);
}

// ---- non periodic -------------------------------------------------------
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradDir(i), f);
  float b = dot(gradDir(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(gradDir(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(gradDir(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4142;
}
float fbm2(vec2 p, int octaves) {
  float s = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * gnoise(p);
    p = r * p * 2.03;
    a *= 0.5;
  }
  return s;
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1, 0, 0));
  float n010 = hash13(i + vec3(0, 1, 0));
  float n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1));
  float n101 = hash13(i + vec3(1, 0, 1));
  float n011 = hash13(i + vec3(0, 1, 1));
  float n111 = hash13(i + vec3(1, 1, 1));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}
float fbm3(vec3 p, int octaves) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    s += a * vnoise3(p);
    p = p * 2.02 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`;
