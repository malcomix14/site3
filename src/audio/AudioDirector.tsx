import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { band, smoothstep } from '../journey/interpolation';
import { journey } from '../journey/journeyState';
import { MARKS } from '../journey/timeline';
import { audio } from './AudioEngine';

/** Mixes the sound layers from the journey progress and fires one-shot cues. */
export function AudioDirector() {
  const last = useRef({ progress: 0, beat: 0 });

  useFrame(() => {
    if (!audio.enabled) {
      last.current.progress = journey.progress;
      last.current.beat = journey.beat;
      return;
    }
    const p = journey.progress;
    const studio = journey.cues.studio;
    audio.setLayer('cabin', (1 - smoothstep(3.7, 4.7, p)) * 0.9);
    audio.setLayer('wind', band(p, 3.7, 5.2, 10.5, 13.6) * 0.9 + band(p, 34, 35.2, 37.5, 39) * 0.35);
    audio.setLayer(
      'sea',
      band(p, 9, 12.5, 14.5, 15.3) * 0.5 + band(p, 32.8, 34.4, 42.4, 43.4) * 1.0 + band(p, 42.8, 43.6, 64.1, 65) * 0.22 * (1 - studio),
    );
    audio.setLayer('room', band(p, 14.8, 15.6, 33, 34.2) * 0.6 + band(p, 42.6, 43.6, 64.1, 65) * 0.35);
    audio.setLayer('pad', band(p, 14.8, 16.6, 32.8, 34.6) * 0.8 + band(p, 42.4, 44.4, 64.1, 65) * 0.9);
    audio.setLayer('mech', smoothstep(45.2, 47.5, p) * (0.35 + studio * 0.65));

    // one-shot cues, only when travelling forward
    const prev = last.current.progress;
    if (p > prev) {
      const crossed = (m: number) => prev < m && p >= m;
      if (crossed(MARKS.windowPass)) audio.whoosh(1);
      if (crossed(MARKS.facadePass)) audio.whoosh(0.5);
      if (crossed(MARKS.liftEnd + 0.15)) audio.chime();
      if (crossed(MARKS.bayOpen)) audio.whoosh(0.7);
      if (crossed(MARKS.yachtEntry)) audio.whoosh(0.35);
    }
    last.current.progress = p;

    // escapement ticks
    if (journey.beat !== last.current.beat) {
      const strength = smoothstep(45.2, 47.5, p);
      if (journey.beat - last.current.beat < 4) audio.tick(strength, journey.beat % 2 === 1);
      last.current.beat = journey.beat;
    }
  });
  return null;
}
