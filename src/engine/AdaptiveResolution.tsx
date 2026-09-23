import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { QUALITY } from '../config/quality';
import { uiStore } from '../journey/journeyState';

/**
 * Keeps the frame rate smooth: measures frame times over short windows and
 * nudges the render resolution between the tier's min and max pixel ratio.
 */
export function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr);
  const state = useRef({ acc: 0, frames: 0, dpr: QUALITY.maxDpr, cooldown: 0 });

  useFrame((_, dt) => {
    if (!uiStore.get().ready) return;
    const s = state.current;
    s.acc += dt;
    s.frames++;
    s.cooldown -= dt;
    if (s.acc < 1.5) return;
    const avg = s.acc / s.frames;
    s.acc = 0;
    s.frames = 0;
    if (s.cooldown > 0) return;
    let next = s.dpr;
    if (avg > 1 / 45) next = Math.max(QUALITY.minDpr, s.dpr * 0.85);
    else if (avg < 1 / 58 && s.dpr < QUALITY.maxDpr) next = Math.min(QUALITY.maxDpr, s.dpr * 1.08);
    if (Math.abs(next - s.dpr) > 0.01) {
      s.dpr = next;
      s.cooldown = 2.5;
      setDpr(next);
    }
  });
  return null;
}
