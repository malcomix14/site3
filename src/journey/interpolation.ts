/**
 * Monotone cubic interpolation (Steffen, 1990).
 *
 * Every animated channel of the journey (camera x/y/z, yaw, pitch, fov, cues…)
 * is a list of (time, value) keys. Steffen's method gives a C1-continuous curve
 * that never overshoots its keys: the camera accelerates and settles naturally,
 * never wobbles past a mark, and comes to a gentle rest whenever a channel
 * reaches a local extremum or holds a value.
 */
export class MonotoneTrack {
  readonly t: Float64Array;
  readonly v: Float64Array;
  private readonly m: Float64Array;

  constructor(times: number[], values: number[]) {
    if (times.length !== values.length || times.length === 0) {
      throw new Error('MonotoneTrack: times/values mismatch');
    }
    const n = times.length;
    this.t = Float64Array.from(times);
    this.v = Float64Array.from(values);
    this.m = new Float64Array(n);
    if (n < 2) return;

    const h = new Float64Array(n - 1);
    const s = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      h[i] = Math.max(1e-9, times[i + 1] - times[i]);
      s[i] = (values[i + 1] - values[i]) / h[i];
    }
    // Ends start and finish at rest: the journey never jerks into motion.
    this.m[0] = 0;
    this.m[n - 1] = 0;
    for (let i = 1; i < n - 1; i++) {
      const s0 = s[i - 1];
      const s1 = s[i];
      const p = (s0 * h[i] + s1 * h[i - 1]) / (h[i - 1] + h[i]);
      this.m[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
    }
  }

  evaluate(x: number): number {
    const t = this.t;
    const n = t.length;
    if (n === 1 || x <= t[0]) return this.v[0];
    if (x >= t[n - 1]) return this.v[n - 1];
    // binary search for segment
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t[mid] <= x) lo = mid;
      else hi = mid;
    }
    const h = t[hi] - t[lo];
    const u = (x - t[lo]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return h00 * this.v[lo] + h10 * h * this.m[lo] + h01 * this.v[hi] + h11 * h * this.m[hi];
  }
}

/** A cue: a scalar that ramps between values at given scroll marks. */
export function cue(keys: Array<[number, number]>): MonotoneTrack {
  return new MonotoneTrack(
    keys.map((k) => k[0]),
    keys.map((k) => k[1]),
  );
}

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential damping. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
/** Window: 0 before a, ramps to 1 on [a,b], holds, ramps back to 0 on [c,d]. */
export const band = (x: number, a: number, b: number, c: number, d: number) =>
  Math.min(smoothstep(a, b, x), 1 - smoothstep(c, d, x));
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
