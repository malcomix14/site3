import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { type PerspectiveCamera, Vector3 } from 'three';
import { applyRig, evaluateRig } from '../camera/CameraRig';
import { updateYachtSwell } from '../scenes/yachtMotion';
import { clamp, damp } from './interpolation';
import { journey, uiStore } from './journeyState';
import { CHAPTERS, CUES, JOURNEY_LENGTH } from './timeline';

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * JourneyController — the single conductor.
 * Each frame: scroll → damped progress → cues → camera pose → shared state.
 * Scenes, lights, post-processing, audio and UI all read from `journey`.
 */
export function JourneyController() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const lastPos = useRef(new Vector3());
  const first = useRef(true);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      journey.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      journey.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onLeave = () => {
      journey.pointer.x = 0;
      journey.pointer.y = 0;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    journey.time += dt;

    // ---- progress with inertia (the scroll itself is already smoothed by Lenis)
    const prev = journey.progress;
    journey.progress = damp(journey.progress, journey.target, 4.2, dt);
    if (Math.abs(journey.progress - journey.target) < 1e-4) journey.progress = journey.target;
    journey.progress = clamp(journey.progress, 0, JOURNEY_LENGTH);
    journey.velocity = dt > 0 ? (journey.progress - prev) / dt : 0;
    journey.normalized = journey.progress / JOURNEY_LENGTH;

    // ---- cues
    for (const k in CUES) {
      const key = k as keyof typeof CUES;
      journey.cues[key] = CUES[key].evaluate(journey.progress);
    }

    // ---- pointer smoothing
    const p = journey.pointer;
    p.sx = damp(p.sx, p.x, 2.2, dt);
    p.sy = damp(p.sy, p.y, 2.2, dt);

    // ---- yacht swell + camera
    updateYachtSwell(journey.time);
    const r = evaluateRig(journey.progress, journey.time, p.sx, p.sy, reducedMotion);
    journey.attach = r.attach;
    applyRig(camera, r);

    if (first.current) {
      lastPos.current.copy(camera.position);
      first.current = false;
    }
    journey.cameraSpeed = dt > 0 ? camera.position.distanceTo(lastPos.current) / dt : 0;
    lastPos.current.copy(camera.position);

    // ---- chapter (cold UI state)
    let ch = 0;
    for (let i = 0; i < CHAPTERS.length; i++) if (journey.progress >= CHAPTERS[i].start - 0.001) ch = i;
    if (uiStore.get().chapter !== ch) uiStore.set({ chapter: ch });
    if (!uiStore.get().entered && journey.progress > 0.35) uiStore.set({ entered: true });
  }, -10);

  return null;
}
