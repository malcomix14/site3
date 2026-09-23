/** Deterministic JS noise for procedural geometry (terrain, scattering). */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** 2D gradient noise, roughly in [-1, 1]. */
export function noise2(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const g = (ix: number, iy: number, dx: number, dy: number) => {
    const a = hash2(ix, iy) * Math.PI * 2;
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };
  const u = fade(xf);
  const v = fade(yf);
  const n00 = g(xi, yi, xf, yf);
  const n10 = g(xi + 1, yi, xf - 1, yf);
  const n01 = g(xi, yi + 1, xf, yf - 1);
  const n11 = g(xi + 1, yi + 1, xf - 1, yf - 1);
  const x1 = n00 + (n10 - n00) * u;
  const x2 = n01 + (n11 - n01) * u;
  return (x1 + (x2 - x1) * v) * 1.4142;
}

export function fbm(x: number, y: number, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let s = 0;
  let a = 0.5;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    s += a * noise2(fx, fy);
    const nx = fx * 0.8 - fy * 0.6;
    const ny = fx * 0.6 + fy * 0.8;
    fx = nx * lacunarity + 17.3;
    fy = ny * lacunarity + 4.1;
    a *= gain;
  }
  return s;
}

export function ridged(x: number, y: number, octaves = 5) {
  let s = 0;
  let a = 0.5;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2(fx, fy));
    s += a * n * n;
    fx = fx * 2.07 + 3.7;
    fy = fy * 2.07 + 9.1;
    a *= 0.5;
  }
  return s;
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
