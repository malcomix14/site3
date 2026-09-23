import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { YACHT_REST } from '../journey/layout';

/**
 * The yacht lies at anchor on a gentle swell. The same motion is applied to
 * the hull and — once inside — to the camera, so the sea is seen rolling
 * past the salon windows while the interior feels perfectly steady.
 */
const _e = new Euler();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const _local = new Matrix4();
const _restInv = new Matrix4().copy(YACHT_REST).invert();

export const yachtSwell = {
  /** world matrix of the yacht this frame */
  matrix: new Matrix4().copy(YACHT_REST),
  /** delta = matrix · rest⁻¹ (applied to things riding with the yacht) */
  delta: new Matrix4(),
  deltaPosition: new Vector3(),
  deltaQuaternion: new Quaternion(),
};

export function updateYachtSwell(time: number) {
  const heave = 0.07 * Math.sin(time * 0.71) + 0.03 * Math.sin(time * 1.37 + 1.2);
  const roll = (0.85 * Math.sin(time * 0.53) + 0.25 * Math.sin(time * 1.21 + 0.4)) * (Math.PI / 180);
  const pitch = (0.35 * Math.sin(time * 0.41 + 0.7) + 0.12 * Math.sin(time * 0.93)) * (Math.PI / 180);
  _e.set(roll, 0, pitch, 'XYZ');
  _q.setFromEuler(_e);
  _p.set(0, heave, 0);
  _local.compose(_p, _q, _s);
  yachtSwell.matrix.multiplyMatrices(YACHT_REST, _local);
  yachtSwell.delta.multiplyMatrices(yachtSwell.matrix, _restInv);
  yachtSwell.delta.decompose(yachtSwell.deltaPosition, yachtSwell.deltaQuaternion, _p.set(1, 1, 1));
}
