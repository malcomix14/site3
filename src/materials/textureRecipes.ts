/**
 * Procedural material recipes, baked on the GPU at load time.
 * Colours are authored in sRGB via S(...) and converted to linear.
 * Every tiling recipe uses periodic noise so maps repeat seamlessly.
 */

// ------------------------------------------------------------------ stone
export const MARBLE_WHITE = /* glsl */ `
vec3 marbleWhite(vec2 uv) {
  float w1 = pfbm(uv * 3.0, vec2(3.0), 5);
  float w2 = pfbm(uv * 6.0 + 7.3, vec2(6.0), 4);
  float v1 = abs(sin(TAU * (1.0 * uv.x + 2.0 * uv.y) + w1 * 5.5 + w2 * 1.6));
  float vein1 = pow(1.0 - smoothstep(0.0, 0.12, v1), 2.2);
  float v2 = abs(sin(TAU * (3.0 * uv.x - 1.0 * uv.y) + w2 * 6.0 + w1 * 2.0));
  float mask2 = smoothstep(0.05, 0.45, pnoise(uv * 2.0 + 3.0, vec2(2.0)) * 0.5 + 0.5);
  float vein2 = (1.0 - smoothstep(0.0, 0.035, v2)) * mask2;
  float fine = pturb(uv * 12.0 + w1, vec2(12.0), 3);
  float veinFine = (1.0 - smoothstep(0.0, 0.035, fine)) * 0.35;
  float cloud = pfbm(uv * 8.0, vec2(8.0), 5);
  vec3 base = S(0.93, 0.915, 0.89) * (1.0 + cloud * 0.05);
  vec3 veinGrey = S(0.55, 0.54, 0.53);
  vec3 veinGold = S(0.72, 0.62, 0.47);
  vec3 veinCol = mix(veinGrey, veinGold, smoothstep(-0.2, 0.35, w2));
  vec3 c = mix(base, veinCol, vein1 * 0.7);
  c = mix(c, veinCol * 0.9, vein2 * 0.5);
  c = mix(c, veinGrey, veinFine);
  return c;
}
`;

export const marbleWhite = {
  color: `${MARBLE_WHITE}
vec3 albedo(vec2 uv) { return marbleWhite(uv); }`,
  orm: `float rough(vec2 uv) { return 0.1 + 0.05 * (pnoise(uv * 5.0, vec2(5.0)) * 0.5 + 0.5); }`,
};

/** large format floor tiles: 2 × 2 per texture with thin joints and rotated book-match */
export const marbleTiles = {
  color: `${MARBLE_WHITE}
vec3 albedo(vec2 uv) {
  vec2 cell = floor(uv * 2.0);
  vec2 f = fract(uv * 2.0);
  float id = hash12(cell + 3.1);
  vec2 q = f;
  if (id > 0.5) q = vec2(1.0 - q.x, q.y);
  if (hash12(cell + 9.7) > 0.5) q = q.yx;
  vec3 c = marbleWhite(fract(q * 0.5 + cell * 0.37));
  float joint = smoothstep(0.0, 0.0022, f.x) * smoothstep(0.0, 0.0022, f.y) * smoothstep(0.0, 0.0022, 1.0 - f.x) * smoothstep(0.0, 0.0022, 1.0 - f.y);
  return mix(S(0.55, 0.53, 0.5), c, joint);
}`,
  normal: `float height(vec2 uv) {
  vec2 f = fract(uv * 2.0);
  float j = smoothstep(0.0, 0.003, f.x) * smoothstep(0.0, 0.003, f.y) * smoothstep(0.0, 0.003, 1.0 - f.x) * smoothstep(0.0, 0.003, 1.0 - f.y);
  return j;
}`,
  orm: `float rough(vec2 uv) {
  vec2 f = fract(uv * 2.0);
  float j = smoothstep(0.0, 0.003, f.x) * smoothstep(0.0, 0.003, f.y);
  return mix(0.6, 0.07 + 0.05 * (pnoise(uv * 7.0, vec2(7.0)) * 0.5 + 0.5), j);
}`,
};

export const marbleDark = {
  color: `
vec3 albedo(vec2 uv) {
  float w = pfbm(uv * 3.0, vec2(3.0), 5);
  vec3 vo = pvoronoi(uv * 4.0 + w * 0.8, vec2(4.0));
  float edge = vo.y - vo.x;
  float net = (1.0 - smoothstep(0.0, 0.035, edge)) * smoothstep(0.2, 0.7, pnoise(uv * 3.0 + 5.0, vec2(3.0)) * 0.5 + 0.5);
  float v1 = abs(sin(TAU * (2.0 * uv.x + 1.0 * uv.y) + w * 6.0));
  float vein = pow(1.0 - smoothstep(0.0, 0.06, v1), 1.5);
  float cloud = pfbm(uv * 10.0, vec2(10.0), 4);
  vec3 base = S(0.055, 0.054, 0.058) * (1.0 + cloud * 0.35);
  vec3 veinC = S(0.86, 0.85, 0.82);
  vec3 c = mix(base, veinC, vein * 0.8);
  c = mix(c, veinC * 0.8, net * 0.7);
  return c;
}`,
  orm: `float rough(vec2 uv) { return 0.08 + 0.04 * (pnoise(uv * 6.0, vec2(6.0)) * 0.5 + 0.5); }`,
};

export const travertine = {
  color: `
vec3 albedo(vec2 uv) {
  float band = pfbm(vec2(uv.x * 2.0, uv.y * 18.0), vec2(2.0, 18.0), 5);
  float band2 = pfbm(vec2(uv.x * 1.0, uv.y * 40.0) + 3.0, vec2(1.0, 40.0), 3);
  vec3 base = mix(S(0.86, 0.79, 0.68), S(0.80, 0.71, 0.58), smoothstep(-0.35, 0.35, band));
  base = mix(base, S(0.9, 0.85, 0.76), smoothstep(0.1, 0.5, band2) * 0.5);
  vec3 vo = pvoronoi(vec2(uv.x * 30.0, uv.y * 90.0), vec2(30.0, 90.0));
  float poreMask = smoothstep(0.1, 0.55, pnoise(uv * 6.0, vec2(6.0)) * 0.5 + 0.5);
  float pore = (1.0 - smoothstep(0.08, 0.22, vo.x)) * poreMask;
  base = mix(base, S(0.55, 0.45, 0.33), pore * 0.7);
  return base * (0.95 + 0.1 * pnoise(uv * 24.0, vec2(24.0)));
}`,
  normal: `float height(vec2 uv) {
  vec3 vo = pvoronoi(vec2(uv.x * 30.0, uv.y * 90.0), vec2(30.0, 90.0));
  float poreMask = smoothstep(0.1, 0.55, pnoise(uv * 6.0, vec2(6.0)) * 0.5 + 0.5);
  float pore = (1.0 - smoothstep(0.08, 0.22, vo.x)) * poreMask;
  return -pore * 0.25 + pfbm(uv * 16.0, vec2(16.0), 3) * 0.05;
}`,
  orm: `float rough(vec2 uv) { return 0.62 + 0.12 * pnoise(uv * 8.0, vec2(8.0)); }`,
};

export const limestone = {
  color: `
vec3 albedo(vec2 uv) {
  float n = pfbm(uv * 4.0, vec2(4.0), 5);
  float fine = pnoise(uv * 64.0, vec2(64.0));
  vec3 c = mix(S(0.9, 0.87, 0.8), S(0.84, 0.8, 0.72), smoothstep(-0.3, 0.4, n));
  // cladding joints every quarter
  vec2 f = fract(uv * vec2(2.0, 4.0));
  float j = smoothstep(0.0, 0.004, f.x) * smoothstep(0.0, 0.008, f.y);
  c *= 0.97 + fine * 0.03;
  return mix(S(0.62, 0.58, 0.52), c, j);
}`,
  normal: `float height(vec2 uv) {
  vec2 f = fract(uv * vec2(2.0, 4.0));
  float j = smoothstep(0.0, 0.004, f.x) * smoothstep(0.0, 0.008, f.y);
  return j * 0.6 + pfbm(uv * 20.0, vec2(20.0), 4) * 0.08;
}`,
  orm: `float rough(vec2 uv) { return 0.78 + 0.1 * pnoise(uv * 9.0, vec2(9.0)); }`,
};

export const concrete = {
  color: `
vec3 albedo(vec2 uv) {
  float n = pfbm(uv * 3.0, vec2(3.0), 6);
  float m = pfbm(uv * 11.0 + 4.0, vec2(11.0), 4);
  vec3 c = mix(S(0.9, 0.885, 0.86), S(0.82, 0.8, 0.77), smoothstep(-0.4, 0.4, n));
  c *= 0.96 + m * 0.06;
  vec3 vo = pvoronoi(uv * 70.0, vec2(70.0));
  c *= 1.0 - (1.0 - smoothstep(0.03, 0.09, vo.x)) * 0.25 * step(0.8, vo.z);
  return c;
}`,
  normal: `float height(vec2 uv) {
  vec3 vo = pvoronoi(uv * 70.0, vec2(70.0));
  return pfbm(uv * 24.0, vec2(24.0), 4) * 0.12 - (1.0 - smoothstep(0.03, 0.09, vo.x)) * step(0.8, vo.z) * 0.3;
}`,
  orm: `float rough(vec2 uv) { return 0.86 + 0.08 * pnoise(uv * 6.0, vec2(6.0)); }`,
};

export const stoneGrey = {
  color: `
vec3 albedo(vec2 uv) {
  float w = pfbm(uv * 2.0, vec2(2.0), 5);
  float v = abs(sin(TAU * (1.0 * uv.x + 1.0 * uv.y) + w * 7.0));
  float vein = (1.0 - smoothstep(0.0, 0.02, v)) * 0.5;
  float grain = pfbm(uv * 30.0, vec2(30.0), 3);
  vec3 c = mix(S(0.25, 0.245, 0.24), S(0.33, 0.325, 0.31), smoothstep(-0.4, 0.4, w));
  c *= 0.93 + grain * 0.12;
  return mix(c, S(0.62, 0.6, 0.58), vein);
}`,
  orm: `float rough(vec2 uv) { return 0.42 + 0.025 * pnoise(uv * 6.0, vec2(6.0)); }`,
  normal: `float height(vec2 uv) { return pfbm(uv * 40.0, vec2(40.0), 3) * 0.03; }`,
};

// ------------------------------------------------------------------ wood
export const oakFloor = {
  color: `
vec3 albedo(vec2 uv) {
  float planks = 12.0;
  float px = uv.x * planks;
  float pi = floor(px);
  float fx = fract(px);
  float off = hash12(vec2(pi, 1.7));
  float py = uv.y * 2.0 + off;
  float pj = mod(floor(py), 2.0);
  float fy = fract(py);
  float id = hash12(vec2(pi, pj + 4.0));
  float g = pfbm(vec2(fx * 1.5 + id * 11.0, uv.y * 36.0), vec2(64.0, 36.0), 5);
  float rings = sin((fx * 2.2 + g * 2.6 + id * 7.0) * 9.0) * 0.5 + 0.5;
  float fine = pnoise(vec2(fx * 60.0 + id * 30.0, uv.y * 420.0), vec2(512.0, 420.0));
  vec3 light = S(0.82, 0.68, 0.52);
  vec3 dark = S(0.64, 0.49, 0.34);
  vec3 c = mix(light, dark, rings * 0.55 + fine * 0.12);
  c *= 0.88 + id * 0.2;
  float seamX = smoothstep(0.0, 0.012, fx) * smoothstep(0.0, 0.012, 1.0 - fx);
  float seamY = smoothstep(0.0, 0.004, fy) * smoothstep(0.0, 0.004, 1.0 - fy);
  return mix(S(0.3, 0.22, 0.15), c, seamX * seamY);
}`,
  normal: `float height(vec2 uv) {
  float px = uv.x * 12.0;
  float fx = fract(px);
  float off = hash12(vec2(floor(px), 1.7));
  float fy = fract(uv.y * 2.0 + off);
  float seam = smoothstep(0.0, 0.012, fx) * smoothstep(0.0, 0.012, 1.0 - fx) * smoothstep(0.0, 0.004, fy) * smoothstep(0.0, 0.004, 1.0 - fy);
  float fine = pnoise(vec2(fx * 60.0, uv.y * 420.0), vec2(512.0, 420.0));
  return seam * 0.5 + fine * 0.04;
}`,
  orm: `float rough(vec2 uv) {
  float fine = pnoise(vec2(uv.x * 700.0, uv.y * 420.0), vec2(700.0, 420.0));
  return 0.42 + fine * 0.08;
}`,
};

export const teakDeck = {
  color: `
vec3 albedo(vec2 uv) {
  float planks = 12.0;
  float px = uv.x * planks;
  float pi = floor(px);
  float fx = fract(px);
  float id = hash12(vec2(pi, 3.3));
  float g = pfbm(vec2(fx * 2.0 + id * 9.0, uv.y * 28.0), vec2(64.0, 28.0), 5);
  float streak = pnoise(vec2(fx * 40.0 + id * 12.0, uv.y * 300.0), vec2(512.0, 300.0));
  vec3 c = mix(S(0.72, 0.52, 0.33), S(0.56, 0.37, 0.21), smoothstep(-0.4, 0.4, g) * 0.8 + streak * 0.15);
  c *= 0.9 + id * 0.18;
  float caulk = smoothstep(0.035, 0.05, fx) * smoothstep(0.035, 0.05, 1.0 - fx);
  return mix(S(0.03, 0.03, 0.03), c, caulk);
}`,
  normal: `float height(vec2 uv) {
  float fx = fract(uv.x * 12.0);
  float caulk = smoothstep(0.035, 0.06, fx) * smoothstep(0.035, 0.06, 1.0 - fx);
  return caulk * 0.4 + pnoise(vec2(uv.x * 480.0, uv.y * 300.0), vec2(480.0, 300.0)) * 0.03;
}`,
  orm: `float rough(vec2 uv) {
  float fx = fract(uv.x * 12.0);
  float caulk = smoothstep(0.035, 0.05, fx) * smoothstep(0.035, 0.05, 1.0 - fx);
  return mix(0.35, 0.72 + 0.08 * pnoise(uv * vec2(40.0, 200.0), vec2(40.0, 200.0)), caulk);
}`,
};

export const walnut = {
  color: `
vec3 albedo(vec2 uv) {
  // book-matched figured veneer, vertical grain
  float x = abs(fract(uv.x * 2.0) - 0.5) * 2.0;
  float g = pfbm(vec2(x * 3.0, uv.y * 5.0), vec2(64.0, 5.0), 5);
  float fig = sin((x * 5.0 + g * 3.2) * 8.0) * 0.5 + 0.5;
  float fine = pnoise(vec2(x * 90.0, uv.y * 700.0), vec2(512.0, 700.0));
  vec3 c = mix(S(0.36, 0.23, 0.15), S(0.2, 0.12, 0.075), fig * 0.8 + fine * 0.15);
  float streak = smoothstep(0.55, 0.9, pnoise(vec2(x * 7.0, uv.y * 2.0) + 11.0, vec2(64.0, 2.0)) * 0.5 + 0.5);
  c = mix(c, S(0.44, 0.3, 0.2), streak * 0.35);
  return c;
}`,
  orm: `float rough(vec2 uv) { return 0.32 + 0.1 * pnoise(vec2(uv.x * 200.0, uv.y * 700.0), vec2(200.0, 700.0)); }`,
  normal: `float height(vec2 uv) { return pnoise(vec2(uv.x * 200.0, uv.y * 700.0), vec2(200.0, 700.0)) * 0.05; }`,
};

export const bark = {
  color: `
vec3 albedo(vec2 uv) {
  vec3 vo = pvoronoi(vec2(uv.x * 8.0, uv.y * 3.0), vec2(8.0, 3.0));
  float plate = smoothstep(0.0, 0.25, vo.y - vo.x);
  vec3 c = mix(S(0.16, 0.12, 0.09), S(0.46, 0.38, 0.3), plate);
  return c * (0.85 + 0.3 * vo.z);
}`,
  normal: `float height(vec2 uv) {
  vec3 vo = pvoronoi(vec2(uv.x * 8.0, uv.y * 3.0), vec2(8.0, 3.0));
  return smoothstep(0.0, 0.25, vo.y - vo.x) + pnoise(uv * vec2(20.0, 60.0), vec2(20.0, 60.0)) * 0.1;
}`,
};

// ------------------------------------------------------------------ soft
export const leather = {
  color: `vec3 albedo(vec2 uv) {
  vec3 vo = pvoronoi(uv * 90.0, vec2(90.0));
  float n = pfbm(uv * 6.0, vec2(6.0), 4);
  return vec3(0.9 + n * 0.12 - (1.0 - smoothstep(0.0, 0.18, vo.y - vo.x)) * 0.12);
}`,
  normal: `float height(vec2 uv) {
  vec3 vo = pvoronoi(uv * 90.0, vec2(90.0));
  vec3 vo2 = pvoronoi(uv * 23.0 + 1.3, vec2(23.0));
  return smoothstep(0.0, 0.25, vo.y - vo.x) * 0.5 + smoothstep(0.0, 0.2, vo2.y - vo2.x) * 0.2;
}`,
  orm: `float rough(vec2 uv) {
  vec3 vo = pvoronoi(uv * 90.0, vec2(90.0));
  return 0.48 - smoothstep(0.0, 0.25, vo.y - vo.x) * 0.14;
}`,
};

export const alligator = {
  color: `vec3 albedo(vec2 uv) {
  float rows = 10.0;
  float r = floor(uv.y * rows);
  float cols = 3.0 + floor(hash12(vec2(r, 2.0)) * 2.0);
  vec2 g = vec2(uv.x * cols * 2.0 + hash12(vec2(r, 5.0)), uv.y * rows);
  vec2 f = fract(g);
  float e = smoothstep(0.0, 0.08, f.x) * smoothstep(0.0, 0.08, 1.0 - f.x) * smoothstep(0.0, 0.1, f.y) * smoothstep(0.0, 0.1, 1.0 - f.y);
  return vec3(0.75 + 0.25 * e);
}`,
  normal: `float height(vec2 uv) {
  float rows = 10.0;
  float r = floor(uv.y * rows);
  float cols = 3.0 + floor(hash12(vec2(r, 2.0)) * 2.0);
  vec2 g = vec2(uv.x * cols * 2.0 + hash12(vec2(r, 5.0)), uv.y * rows);
  vec2 f = fract(g) - 0.5;
  float d = max(abs(f.x) * 1.0, abs(f.y) * 1.1);
  float scale = 1.0 - smoothstep(0.32, 0.5, d);
  return scale * (1.0 - dot(f, f)) * 0.8;
}`,
  orm: `float rough(vec2 uv) { return 0.32; }`,
};

export const linen = {
  color: `vec3 albedo(vec2 uv) {
  float slub = pnoise(vec2(uv.x * 4.0, uv.y * 180.0), vec2(4.0, 180.0)) * 0.5 + pnoise(vec2(uv.x * 160.0, uv.y * 3.0), vec2(160.0, 3.0)) * 0.5;
  float w = sin(uv.x * TAU * 220.0) * sin(uv.y * TAU * 220.0);
  return vec3(0.92 + slub * 0.06 + w * 0.03);
}`,
  normal: `float height(vec2 uv) {
  float wx = sin(uv.x * TAU * 220.0);
  float wy = sin(uv.y * TAU * 220.0);
  float warp = step(0.0, sin(uv.y * TAU * 110.0)) * 2.0 - 1.0;
  return wx * wy * warp * 0.5 + pnoise(vec2(uv.x * 4.0, uv.y * 180.0), vec2(4.0, 180.0)) * 0.2;
}`,
  orm: `float rough(vec2 uv) { return 0.9; }`,
};

export const boucle = {
  color: `vec3 albedo(vec2 uv) {
  vec3 vo = pvoronoi(uv * 120.0, vec2(120.0));
  return vec3(0.84 + vo.z * 0.1 + (smoothstep(0.0, 0.5, vo.x)) * -0.1 + 0.08);
}`,
  normal: `float height(vec2 uv) {
  vec3 vo = pvoronoi(uv * 120.0, vec2(120.0));
  vec3 vo2 = pvoronoi(uv * 60.0 + 3.1, vec2(60.0));
  return (1.0 - vo.x) * 0.6 + (1.0 - vo2.x) * 0.4;
}`,
  orm: `float rough(vec2 uv) { return 0.95; }`,
};

export const wool = {
  color: `vec3 albedo(vec2 uv) {
  float n = pfbm(uv * 12.0, vec2(12.0), 5);
  vec2 c = abs(uv - 0.5);
  float border = step(0.43, max(c.x, c.y)) * (1.0 - step(0.455, max(c.x, c.y)));
  float inner = step(0.47, max(c.x, c.y));
  vec3 base = S(0.83, 0.79, 0.72) * (0.94 + n * 0.1);
  base = mix(base, S(0.6, 0.55, 0.47), border * 0.8);
  base = mix(base, S(0.74, 0.69, 0.61), inner * 0.7);
  float tuft = pnoise(uv * 300.0, vec2(300.0));
  return base * (0.95 + tuft * 0.06);
}`,
  normal: `float height(vec2 uv) { return pnoise(uv * 300.0, vec2(300.0)) * 0.5 + pnoise(uv * 90.0, vec2(90.0)) * 0.3; }`,
};

export const plaster = {
  color: `vec3 albedo(vec2 uv) {
  float n = pfbm(uv * 3.0, vec2(3.0), 6);
  return S(0.93, 0.91, 0.87) * (0.97 + n * 0.05);
}`,
  normal: `float height(vec2 uv) { return pfbm(uv * 6.0, vec2(6.0), 6) * 0.3; }`,
  orm: `float rough(vec2 uv) { return 0.88 + 0.06 * pnoise(uv * 5.0, vec2(5.0)); }`,
};

// ------------------------------------------------------------------ metal finishes
export const brushed = {
  normal: `float height(vec2 uv) {
  return pnoise(vec2(uv.x * 3.0, uv.y * 900.0), vec2(3.0, 900.0)) * 0.35 + pnoise(vec2(uv.x * 12.0, uv.y * 2400.0), vec2(12.0, 2400.0)) * 0.25;
}`,
  orm: `float rough(vec2 uv) {
  return 0.26 + 0.1 * pnoise(vec2(uv.x * 6.0, uv.y * 1200.0), vec2(6.0, 1200.0));
}
float metal(vec2 uv) { return 1.0; }`,
};

/** circular graining (perlage) for the main plate */
export const perlage = {
  normal: `float height(vec2 uv) {
  float cells = 22.0;
  vec2 p = uv * cells;
  float best = -1.0;
  float h = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = floor(p) + vec2(float(x), float(y));
      vec2 ctr = c + 0.5;
      float order = mod(c.y, 22.0) * 22.0 + mod(c.x, 22.0) + (mod(c.y, 2.0) * 0.5);
      float r = length(p - ctr);
      if (r < 0.78 && order > best) {
        best = order;
        h = sin(r * 70.0 + hash12(mod(c, 22.0)) * 6.0) * 0.5 * (1.0 - smoothstep(0.66, 0.78, r)) + (1.0 - r) * 0.3;
      }
    }
  }
  return h;
}`,
  orm: `float rough(vec2 uv) { return 0.3; } float metal(vec2 uv) { return 1.0; }`,
};

/** Côtes de Genève stripes (bridges & rotor) */
export const geneva = {
  normal: `float height(vec2 uv) {
  float stripes = 9.0;
  float s = fract(uv.y * stripes);
  float profile = 1.0 - pow(abs(s * 2.0 - 1.0), 2.0);
  float arc = sin((uv.x * 3.0 + s * 0.4) * TAU) * 0.08;
  float fine = pnoise(vec2(uv.x * 800.0, uv.y * 20.0), vec2(800.0, 20.0)) * 0.05;
  return profile * 0.8 + arc + fine;
}`,
  orm: `float rough(vec2 uv) {
  float s = fract(uv.y * 9.0);
  return 0.18 + 0.12 * abs(s * 2.0 - 1.0);
}
float metal(vec2 uv) { return 1.0; }`,
};

/** radial sunburst: micro grooves radiating from the dial centre */
export const sunburst = {
  normal: `float height(vec2 uv) {
  vec2 d = uv - 0.5;
  float a = atan(d.y, d.x);
  float r = length(d);
  float lines = pnoise(vec2(a / TAU * 900.0, r * 3.0), vec2(900.0, 64.0));
  float lines2 = pnoise(vec2(a / TAU * 2400.0, r * 9.0), vec2(2400.0, 64.0));
  return (lines * 0.6 + lines2 * 0.4) * smoothstep(0.004, 0.03, r);
}`,
  color: `vec3 albedo(vec2 uv) {
  float r = length(uv - 0.5) * 2.0;
  vec3 center = S(0.09, 0.16, 0.27);
  vec3 edge = S(0.015, 0.03, 0.06);
  return mix(center, edge, smoothstep(0.1, 1.0, r));
}`,
};

// ------------------------------------------------------------------ misc surfaces
export const poolTiles = {
  color: `vec3 albedo(vec2 uv) {
  vec2 g = uv * 40.0;
  vec2 f = fract(g);
  float id = hash12(floor(g));
  vec3 c = mix(S(0.72, 0.86, 0.86), S(0.58, 0.78, 0.8), id);
  float grout = smoothstep(0.0, 0.06, f.x) * smoothstep(0.0, 0.06, f.y);
  return mix(S(0.85, 0.88, 0.86), c, grout);
}`,
  normal: `float height(vec2 uv) {
  vec2 f = fract(uv * 40.0);
  return smoothstep(0.0, 0.08, f.x) * smoothstep(0.0, 0.08, f.y) * smoothstep(0.0, 0.08, 1.0 - f.x) * smoothstep(0.0, 0.08, 1.0 - f.y);
}`,
};

export const panelLines = {
  normal: `float height(vec2 uv) {
  vec2 f = fract(uv * vec2(2.0, 5.0));
  float lines = smoothstep(0.0, 0.004, f.x) * smoothstep(0.0, 0.006, f.y);
  vec2 rv = fract(uv * vec2(2.0, 60.0));
  float rivet = (1.0 - smoothstep(0.1, 0.18, length((rv - vec2(0.012, 0.5)) * vec2(8.0, 1.0)))) * 0.4;
  return lines + rivet;
}`,
  color: `vec3 albedo(vec2 uv) {
  float n = pfbm(uv * 5.0, vec2(5.0), 4);
  vec2 f = fract(uv * vec2(2.0, 5.0));
  float lines = smoothstep(0.0, 0.004, f.x) * smoothstep(0.0, 0.006, f.y);
  vec3 c = S(0.86, 0.87, 0.88) * (0.96 + n * 0.05);
  return c * mix(0.7, 1.0, lines);
}`,
};

export const rock = {
  color: `vec3 albedo(vec2 uv) {
  float n = pfbm(uv * 4.0, vec2(4.0), 6);
  vec3 vo = pvoronoi(uv * 9.0, vec2(9.0));
  vec3 c = mix(S(0.72, 0.66, 0.56), S(0.55, 0.5, 0.43), smoothstep(-0.3, 0.3, n));
  c *= 0.85 + smoothstep(0.0, 0.3, vo.y - vo.x) * 0.2;
  return c;
}`,
  normal: `float height(vec2 uv) {
  vec3 vo = pvoronoi(uv * 9.0, vec2(9.0));
  return smoothstep(0.0, 0.3, vo.y - vo.x) * 0.8 + pfbm(uv * 24.0, vec2(24.0), 4) * 0.4;
}`,
};

/** condensation for the cabin window: R = frost, G = droplets */
export const condensation = {
  data: `vec4 data(vec2 uv) {
  vec2 d = uv - 0.5;
  float r = length(d) * 2.0;
  float n = pfbm(uv * 6.0, vec2(6.0), 5) * 0.5 + 0.5;
  float frost = smoothstep(0.62, 1.0, r + (n - 0.5) * 0.35);
  vec3 vo = pvoronoi(uv * 38.0, vec2(38.0));
  float drop = (1.0 - smoothstep(0.08, 0.2, vo.x)) * step(0.45, vo.z) * smoothstep(0.3, 0.8, r + n * 0.2);
  vec3 vo2 = pvoronoi(uv * 90.0 + 2.3, vec2(90.0));
  float mist = (1.0 - smoothstep(0.05, 0.14, vo2.x)) * step(0.3, vo2.z) * smoothstep(0.45, 0.95, r);
  float scratch = (1.0 - smoothstep(0.0, 0.004, abs(sin((uv.x * 0.8 + uv.y * 0.3) * 40.0 + pnoise(uv * 3.0, vec2(3.0)) * 3.0)))) * step(0.82, hash12(floor(uv * 6.0))) * 0.4;
  return vec4(frost, max(drop, mist * 0.6), scratch, 1.0);
}`,
  normal: `float height(vec2 uv) {
  vec2 d = uv - 0.5;
  float r = length(d) * 2.0;
  float n = pfbm(uv * 6.0, vec2(6.0), 5) * 0.5 + 0.5;
  vec3 vo = pvoronoi(uv * 38.0, vec2(38.0));
  float drop = sqrt(max(0.0, 1.0 - pow(vo.x / 0.2, 2.0))) * step(0.45, vo.z) * smoothstep(0.3, 0.8, r + n * 0.2);
  vec3 vo2 = pvoronoi(uv * 90.0 + 2.3, vec2(90.0));
  float mist = sqrt(max(0.0, 1.0 - pow(vo2.x / 0.14, 2.0))) * step(0.3, vo2.z) * smoothstep(0.45, 0.95, r);
  return drop * 0.8 + mist * 0.3;
}`,
};

export const waterNormal = {
  normal: `float height(vec2 uv) {
  float h = 0.0;
  h += pnoise(uv * vec2(4.0, 6.0), vec2(4.0, 6.0)) * 0.5;
  h += pnoise(uv * vec2(9.0, 7.0) + 2.0, vec2(9.0, 7.0)) * 0.3;
  h += pnoise(uv * vec2(17.0, 21.0) + 5.0, vec2(17.0, 21.0)) * 0.16;
  h += pnoise(uv * vec2(38.0, 33.0) + 7.0, vec2(38.0, 33.0)) * 0.08;
  h += pnoise(uv * vec2(80.0, 70.0) + 1.0, vec2(80.0, 70.0)) * 0.035;
  return h;
}`,
};

/** billboard cloud puffs, 2 × 2 atlas. R = density, G = self-shadowed light, B = edge */
export const cloudAtlas = {
  data: `vec4 data(vec2 uv) {
  vec2 cell = floor(uv * 2.0);
  vec2 p = fract(uv * 2.0) * 2.0 - 1.0;
  float seed = cell.x + cell.y * 2.0;
  vec2 q = p * vec2(1.0, 1.35) + vec2(0.0, 0.18);
  float r = length(q);
  float lobes = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(fi * 2.4 + seed * 1.3), cos(fi * 1.7 + seed * 0.7) * 0.45 + 0.1) * 0.45;
    float rr = 0.36 + 0.14 * hash12(vec2(fi, seed));
    lobes = max(lobes, 1.0 - smoothstep(rr * 0.4, rr, length(q - c)));
  }
  float base = 1.0 - smoothstep(0.35, 0.95, r);
  float n = fbm2(p * 3.2 + seed * 7.0, 5) * 0.5 + 0.5;
  float d = clamp(max(base, lobes) * (0.55 + n * 0.75) - 0.25, 0.0, 1.0);
  d *= smoothstep(1.0, 0.72, max(abs(p.x), abs(p.y)));
  d *= smoothstep(-0.95, -0.55, p.y);
  float dUp = clamp(max(1.0 - smoothstep(0.35, 0.95, length(q + vec2(0.0, -0.22))), lobes) * (0.55 + n * 0.75) - 0.25, 0.0, 1.0);
  float light = clamp(1.0 - (dUp - d) * 1.6 + p.y * 0.35, 0.0, 1.0);
  float edge = d * (1.0 - d) * 4.0;
  return vec4(d, light, edge, 1.0);
}`,
};

// ------------------------------------------------------------------ art
export const artColorField = {
  color: `vec3 albedo(vec2 uv) {
  float fib = pfbm(uv * vec2(3.0, 40.0), vec2(3.0, 40.0), 5);
  float edgeN = pfbm(uv * 8.0, vec2(8.0), 5) * 0.03;
  vec3 ground = S(0.36, 0.12, 0.08);
  vec3 top = S(0.62, 0.22, 0.12);
  vec3 bottom = S(0.12, 0.06, 0.05);
  vec3 c = ground;
  float rt = smoothstep(0.04, 0.0, abs(uv.x - 0.5) - 0.40 + edgeN) * smoothstep(0.03, 0.0, abs(uv.y - 0.7) - 0.2 + edgeN);
  float rb = smoothstep(0.04, 0.0, abs(uv.x - 0.5) - 0.40 + edgeN) * smoothstep(0.03, 0.0, abs(uv.y - 0.26) - 0.18 + edgeN);
  c = mix(c, top * (0.9 + fib * 0.2), rt);
  c = mix(c, bottom * (0.9 + fib * 0.3), rb);
  float weave = sin(uv.x * 900.0) * sin(uv.y * 900.0) * 0.03;
  return c * (1.0 + weave + fib * 0.06);
}`,
};

export const artEnso = {
  color: `vec3 albedo(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(1.0, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = fract((a + 2.2) / TAU);
  float width = mix(0.07, 0.012, pow(t, 1.4)) * (0.8 + 0.4 * gnoise(vec2(a * 3.0, 1.0)));
  float ring = 1.0 - smoothstep(width * 0.7, width, abs(r - 0.31 - 0.015 * sin(a * 3.0)));
  ring *= step(0.04, t);
  float dry = smoothstep(0.2, 0.7, gnoise(vec2(a * 60.0, r * 400.0)) * 0.5 + 0.5 + (1.0 - t) * 0.5);
  float ink = ring * mix(0.55, 1.0, dry);
  float paper = pfbm(uv * 20.0, vec2(20.0), 5);
  vec3 bg = S(0.93, 0.9, 0.84) * (0.97 + paper * 0.05);
  vec3 c = mix(bg, S(0.05, 0.045, 0.045), ink);
  float seal = step(abs(uv.x - 0.78), 0.018) * step(abs(uv.y - 0.2), 0.024);
  return mix(c, S(0.62, 0.12, 0.08), seal * 0.9);
}`,
};

export const artHorizon = {
  color: `vec3 albedo(vec2 uv) {
  float n = pfbm(uv * vec2(2.0, 30.0), vec2(2.0, 30.0), 5);
  vec3 c = mix(S(0.82, 0.74, 0.62), S(0.93, 0.89, 0.8), smoothstep(0.35, 0.75, uv.y + n * 0.05));
  c = mix(c, S(0.66, 0.52, 0.38), smoothstep(0.02, 0.0, abs(uv.y - 0.38 - n * 0.02) - 0.03));
  c = mix(c, S(0.35, 0.3, 0.27), smoothstep(0.005, 0.0, abs(uv.y - 0.33) - 0.006));
  float grain = pnoise(uv * 400.0, vec2(400.0));
  return c * (0.97 + grain * 0.04);
}`,
};
