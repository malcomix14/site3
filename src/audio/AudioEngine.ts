/**
 * Procedural sound design — no audio files. Every layer is synthesised with
 * the Web Audio API and cross-faded by the journey:
 * cabin hum → wind → sea → interior ambience → the escapement of the watch.
 * Audio is strictly optional: if the API is missing, the site simply stays silent.
 */
export type LayerName = 'cabin' | 'wind' | 'sea' | 'room' | 'pad' | 'mech';

type Ctx = AudioContext;

function noiseBuffer(ctx: Ctx, seconds = 4, color: 'white' | 'pink' | 'brown' = 'white') {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0,
      last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') d[i] = w;
      else if (color === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  return buf;
}

export class AudioEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private layers = new Map<LayerName, GainNode>();
  private white: AudioBuffer | null = null;
  enabled = false;

  get available() {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  private build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    this.master = master;

    const white = noiseBuffer(ctx, 4, 'white');
    const pink = noiseBuffer(ctx, 5, 'pink');
    const brown = noiseBuffer(ctx, 5, 'brown');
    this.white = white;

    const layer = (name: LayerName) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      this.layers.set(name, g);
      return g;
    };
    const loop = (buf: AudioBuffer) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, Math.random() * buf.duration);
      return s;
    };
    const lfo = (freq: number, depth: number, target: AudioParam, offset?: number) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g).connect(target);
      if (offset !== undefined) target.value = offset;
      o.start();
    };

    // cabin: low airflow rumble + engine hum
    {
      const out = layer('cabin');
      const src = loop(brown);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const g = ctx.createGain();
      g.gain.value = 0.55;
      src.connect(lp).connect(g).connect(out);
      const hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 118;
      const hg = ctx.createGain();
      hg.gain.value = 0.018;
      hum.connect(hg).connect(out);
      hum.start();
    }
    // wind
    {
      const out = layer('wind');
      const src = loop(white);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      lfo(0.13, 260, bp.frequency, 620);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1900;
      const g = ctx.createGain();
      g.gain.value = 0.32;
      lfo(0.21, 0.12, g.gain, 0.3);
      src.connect(bp).connect(lp).connect(g).connect(out);
    }
    // sea: swell + wash
    {
      const out = layer('sea');
      const src = loop(pink);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 820;
      const g = ctx.createGain();
      g.gain.value = 0.55;
      lfo(0.085, 0.3, g.gain, 0.5);
      src.connect(lp).connect(g).connect(out);
      const src2 = loop(white);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2600;
      const g2 = ctx.createGain();
      g2.gain.value = 0.03;
      lfo(0.11, 0.025, g2.gain, 0.03);
      src2.connect(hp).connect(g2).connect(out);
    }
    // room tone
    {
      const out = layer('room');
      const src = loop(brown);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 160;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      src.connect(lp).connect(g).connect(out);
    }
    // ambient pad: a slow, open chord
    {
      const out = layer('pad');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1300;
      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.38;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      lp.connect(out);
      lp.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(wet).connect(out);
      const notes = [73.42, 146.83, 220.0, 329.63, 369.99, 554.37];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = (Math.random() - 0.5) * 8;
        const g = ctx.createGain();
        g.gain.value = 0;
        lfo(0.03 + i * 0.011, 0.018, g.gain, i === 0 ? 0.05 : 0.028);
        o.connect(g).connect(lp);
        o.start();
      });
    }
    layer('mech');
  }

  async enable() {
    if (!this.available) return false;
    try {
      if (!this.ctx) this.build();
      await this.ctx!.resume();
      const t = this.ctx!.currentTime;
      this.master!.gain.cancelScheduledValues(t);
      this.master!.gain.setTargetAtTime(0.9, t, 0.6);
      this.enabled = true;
      return true;
    } catch {
      return false;
    }
  }

  disable() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.25);
    this.enabled = false;
    const ctx = this.ctx;
    window.setTimeout(() => {
      if (!this.enabled) void ctx.suspend();
    }, 1400);
  }

  setLayer(name: LayerName, value: number) {
    if (!this.ctx || !this.enabled) return;
    const g = this.layers.get(name);
    if (!g) return;
    g.gain.setTargetAtTime(Math.max(0, value), this.ctx.currentTime, 0.35);
  }

  /** one beat of the escapement: a metallic tick, alternating with a softer tock */
  tick(strength: number, tock: boolean) {
    if (!this.ctx || !this.enabled || strength < 0.01 || !this.white) return;
    const ctx = this.ctx;
    const out = this.layers.get('mech')!;
    const t = ctx.currentTime + 0.005;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = tock ? 2900 : 4200;
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9 * strength, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random() * 3, 0.05);
    const o = ctx.createOscillator();
    o.frequency.value = tock ? 5100 : 6300;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.05 * strength, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.03);
  }

  /** elevator arrival */
  chime() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    [
      [1318.5, 0],
      [1046.5, 0.32],
    ].forEach(([f, dt]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(0.08, t + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.6);
      o.connect(g).connect(this.master!);
      o.start(t + dt);
      o.stop(t + dt + 1.8);
    });
  }

  /** passing through glass / into open air */
  whoosh(strength = 1) {
    if (!this.ctx || !this.enabled || !this.white) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.7);
    bp.frequency.exponentialRampToValueAtTime(500, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35 * strength, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t, Math.random(), 1.6);
  }
}

export const audio = new AudioEngine();
