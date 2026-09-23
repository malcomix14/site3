import { useSyncExternalStore } from 'react';
import { CUES, JOURNEY_LENGTH } from './timeline';

type CueName = keyof typeof CUES;

/**
 * Hot, per-frame state. Mutated in place by the scroll driver and the
 * JourneyController; read by scenes, post-processing, audio and UI loops.
 * Never triggers React renders.
 */
export const journey = {
  /** raw scroll position in journey units (from the scroll driver) */
  target: 0,
  /** damped progress in journey units — drives everything */
  progress: 0,
  /** progress velocity in units / second */
  velocity: 0,
  /** normalised 0..1 */
  normalized: 0,
  /** seconds since start */
  time: 0,
  /** evaluated cue values for the current progress */
  cues: Object.fromEntries(Object.keys(CUES).map((k) => [k, 0])) as Record<CueName, number>,
  /** pointer in NDC (-1..1), raw and smoothed */
  pointer: { x: 0, y: 0, sx: 0, sy: 0 },
  /** camera linear speed in m/s (world) */
  cameraSpeed: 0,
  /** yacht swell delta applied to the camera (0..1) */
  attach: 0,
  /** mechanism clock of the watch (seconds, scaled) */
  mechTime: 0,
  /** beats of the escapement since start */
  beat: 0,
  /** intro reveal 0..1 after loading */
  reveal: 0,
  length: JOURNEY_LENGTH,
};

// ---------------------------------------------------------------- UI store (cold state)
export interface UIState {
  loadProgress: number;
  loadLabel: string;
  ready: boolean;
  entered: boolean;
  soundOn: boolean;
  chapter: number;
  quality: 'high' | 'medium' | 'low';
  webglError: string | null;
}

let uiState: UIState = {
  loadProgress: 0,
  loadLabel: 'Preparing your journey',
  ready: false,
  entered: false,
  soundOn: false,
  chapter: 0,
  quality: 'high',
  webglError: null,
};

const listeners = new Set<() => void>();

export const uiStore = {
  get: () => uiState,
  set(patch: Partial<UIState>) {
    let changed = false;
    for (const k in patch) {
      const key = k as keyof UIState;
      if (uiState[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    uiState = { ...uiState, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useUI<T>(selector: (s: UIState) => T): T {
  return useSyncExternalStore(uiStore.subscribe, () => selector(uiStore.get()));
}

// ---------------------------------------------------------------- scroll commands
type ScrollToFn = (units: number, opts?: { duration?: number; immediate?: boolean }) => void;
let scrollToImpl: ScrollToFn = () => {};
export const registerScrollTo = (fn: ScrollToFn) => {
  scrollToImpl = fn;
};
/** Smoothly scroll the page to a journey position (in units). */
export const scrollToUnits: ScrollToFn = (units, opts) => scrollToImpl(units, opts);
