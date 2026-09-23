import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Matrix4,
  PointLight,
  SpotLight,
  Vector3,
} from 'three';
import { QUALITY } from '../config/quality';
import { journey } from '../journey/journeyState';
import { SUN_DIRECTION, WINDOW_CENTER, watchToYacht } from '../journey/layout';
import { smoothstep } from '../journey/interpolation';
import { yachtSwell } from './yachtMotion';

/**
 * A fixed set of lights (constant count = no shader recompiles) that the
 * journey repositions: the sun with a shadow frustum that follows the action,
 * a sky fill, two warm practicals and two spots.
 */

interface Practical {
  from: number;
  to: number;
  pos: (out: Vector3) => Vector3;
  color: string;
  intensity: number;
  distance: number;
  flicker?: boolean;
}

const _v = new Vector3();
const ORIGIN = new Vector3(0, 0, 0);
const _w = new Vector3();
const UP = new Vector3(0, 1, 0);
const yachtPoint = (x: number, y: number, z: number) => (out: Vector3) =>
  out.set(x, y, z).applyMatrix4(yachtSwell.matrix);

const PRACTICALS_A: Practical[] = [
  { from: -2, to: 4.0, pos: (o) => o.copy(WINDOW_CENTER).add(_w.set(0.0, 0.02, -0.07)), color: '#e4ecff', intensity: 0.05, distance: 2.4 },
  { from: 13.2, to: 18.9, pos: (o) => o.set(0, 35.4, 10.5), color: '#ffc98e', intensity: 38, distance: 30 },
  { from: 22.3, to: 26.2, pos: (o) => o.set(-9.0, 51.3, 13.2), color: '#ff9b52', intensity: 9, distance: 12, flicker: true },
  { from: 28.4, to: 31.6, pos: (o) => o.set(35.4, 51.6, 22.2), color: '#ffc68a', intensity: 3.5, distance: 8 },
  { from: 41.6, to: 64, pos: yachtPoint(8.8, 4.12, 0), color: '#ffcf97', intensity: 5.5, distance: 9 },
];
const PRACTICALS_B: Practical[] = [
  { from: 18.3, to: 22.9, pos: (o) => o.set(0, elevatorCeiling(), 22.9), color: '#ffe2bf', intensity: 2.4, distance: 5 },
  { from: 25.9, to: 29.0, pos: (o) => o.set(26, 53.2, 14.2), color: '#ffcb8f', intensity: 7, distance: 11 },
  { from: 30.4, to: 33.8, pos: (o) => o.set(47.2, 53.9, 14.5), color: '#ffe6c9', intensity: 6, distance: 10 },
  { from: 42.2, to: 64, pos: yachtPoint(13.5, 4.12, 0), color: '#ffcf97', intensity: 4.5, distance: 9 },
];

/** elevator car ceiling height, shared with the elevator scene */
export const elevatorState = { carFloor: 30 };
function elevatorCeiling() {
  return elevatorState.carFloor + 2.75;
}

function applyPractical(light: PointLight, list: Practical[], p: number, t: number) {
  let best: Practical | null = null;
  let w = 0;
  for (const pr of list) {
    const k = Math.min(smoothstep(pr.from, pr.from + 0.35, p), 1 - smoothstep(pr.to - 0.35, pr.to, p));
    if (k > w) {
      w = k;
      best = pr;
    }
  }
  if (!best || w <= 0.001) {
    light.intensity = 0;
    return;
  }
  best.pos(light.position);
  light.color.set(best.color);
  light.distance = best.distance;
  let f = 1;
  if (best.flicker) f = 0.82 + Math.sin(t * 9.1) * 0.06 + Math.sin(t * 23.7) * 0.05 + Math.sin(t * 5.3) * 0.07;
  light.intensity = best.intensity * w * f;
}

export function JourneyLights() {
  const rig = useMemo(() => {
    const group = new Group();
    const sun = new DirectionalLight(new Color(1.0, 0.84, 0.66), 3.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize);
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 2.5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 900;
    group.add(sun, sun.target);

    const hemi = new HemisphereLight(new Color('#a9c1dc'), new Color('#6b5a45'), 0.28);
    group.add(hemi);

    const pA = new PointLight('#ffc98e', 0, 20, 2);
    const pB = new PointLight('#ffc98e', 0, 20, 2);
    group.add(pA, pB);

    const sA = new SpotLight('#fff3e2', 0, 10, 0.38, 0.65, 2);
    const sB = new SpotLight('#dfe8ff', 0, 10, 0.5, 0.8, 2);
    group.add(sA, sA.target, sB, sB.target);
    return { group, sun, hemi, pA, pB, sA, sB };
  }, []);

  const center = useMemo(() => new Vector3(), []);
  const lightView = useMemo(() => new Matrix4(), []);
  const lightViewInv = useMemo(() => new Matrix4(), []);
  const fwd = useMemo(() => new Vector3(), []);

  useFrame(({ camera }) => {
    const p = journey.progress;
    const t = journey.time;
    const { sun, hemi, pA, pB, sA, sB } = rig;

    // ---------------------------------------------------------------- sun & shadow frustum
    let size: number;
    camera.getWorldDirection(fwd);
    if (p < 5.2) {
      center.copy(WINDOW_CENTER).add(_v.set(-3, -3, 8));
      size = 36;
    } else if (p < 13.2) {
      center.set(12, 36, 8);
      size = 170;
    } else if (p < 34.6) {
      center.copy(camera.position).addScaledVector(fwd, 7);
      size = 40;
    } else if (p < 38.5) {
      center.set(44, 30, -40);
      size = 140;
    } else if (p < 42.4) {
      center.setFromMatrixPosition(yachtSwell.matrix);
      center.y += 4;
      size = 64;
    } else {
      center.copy(camera.position).addScaledVector(fwd, 2.5);
      size = 22;
    }
    // snap to shadow texels to avoid shimmering
    const texel = size / QUALITY.shadowMapSize;
    lightView.lookAt(SUN_DIRECTION, ORIGIN, UP);
    lightViewInv.copy(lightView).invert();
    _v.copy(center).applyMatrix4(lightViewInv);
    _v.x = Math.round(_v.x / texel) * texel;
    _v.y = Math.round(_v.y / texel) * texel;
    center.copy(_v.applyMatrix4(lightView));

    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(SUN_DIRECTION, 420);
    const cam = sun.shadow.camera;
    if (cam.right !== size / 2) {
      cam.left = -size / 2;
      cam.right = size / 2;
      cam.top = size / 2;
      cam.bottom = -size / 2;
      cam.updateProjectionMatrix();
    }
    const studio = journey.cues.studio;
    sun.intensity = 3.1 * (1 - studio);
    hemi.intensity = (p > 14.6 && p < 34.4 ? 0.12 : p > 42.6 ? 0.1 : 0.28) * (1 - studio);

    // ---------------------------------------------------------------- practicals
    applyPractical(pA, PRACTICALS_A, p, t);
    applyPractical(pB, PRACTICALS_B, p, t);
    pA.intensity *= 1 - studio * 0.85;
    pB.intensity *= 1 - studio * 0.85;

    // ---------------------------------------------------------------- spots
    const lobby = Math.min(smoothstep(14.0, 14.6, p), 1 - smoothstep(18.2, 18.8, p));
    const watchK = smoothstep(44.6, 46.4, p);
    if (lobby > 0.001) {
      sA.position.set(7.2, 38.2, 8.2);
      sA.target.position.set(7.2, 31, 9.2);
      sA.angle = 0.3;
      sA.distance = 14;
      sA.color.set('#ffe9cf');
      sA.intensity = 90 * lobby;
      sB.intensity = 0;
    } else if (watchK > 0.001) {
      // key light orbits gently with the pointer: move the cursor, the reflections follow
      const px = journey.pointer.sx;
      const py = journey.pointer.sy;
      const keyLocal = watchToYacht(-150 + px * 120, 380 + py * 60, 160 - py * 60, _v);
      sA.position.copy(keyLocal).applyMatrix4(yachtSwell.matrix);
      watchToYacht(0, -6, 0, sA.target.position).applyMatrix4(yachtSwell.matrix);
      sA.angle = 0.42;
      sA.distance = 3;
      sA.color.set('#fff4e6');
      sA.intensity = (0.22 + studio * 0.3) * watchK;
      const rimLocal = watchToYacht(140, 120, -260, _v);
      sB.position.copy(rimLocal).applyMatrix4(yachtSwell.matrix);
      watchToYacht(0, -8, 0, sB.target.position).applyMatrix4(yachtSwell.matrix);
      sB.angle = 0.5;
      sB.distance = 3;
      sB.intensity = (0.06 + studio * 0.22) * watchK;
    } else {
      sA.intensity = 0;
      sB.intensity = 0;
    }
  }, -4);

  return <primitive object={rig.group} />;
}
