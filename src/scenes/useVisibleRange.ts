import { useFrame } from '@react-three/fiber';
import type { Object3D } from 'three';
import { journey } from '../journey/journeyState';

/** When true (during shader warm-up) every scene is forced visible. */
export const visibilityOverride = { all: false };

/**
 * Keeps an object visible only while the journey is inside [from, to].
 * Distant chapters cost nothing: they are simply not drawn.
 */
export function useVisibleRange(obj: Object3D | null | undefined, from: number, to: number) {
  useFrame(() => {
    if (!obj) return;
    const p = journey.progress;
    obj.visible = visibilityOverride.all || (p >= from && p <= to);
  }, -5);
}

export function inRange(from: number, to: number) {
  const p = journey.progress;
  return visibilityOverride.all || (p >= from && p <= to);
}
