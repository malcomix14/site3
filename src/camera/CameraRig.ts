import { Euler, MathUtils, type PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { CAMERA_TRACKS as T } from '../journey/timeline';
import { yachtSwell } from '../scenes/yachtMotion';

/**
 * The virtual cinema camera.
 * Pose comes from the monotone camera tracks; on top of that we layer a
 * subtle hand-held drift, pointer parallax and — inside the yacht — the swell.
 */
const _e = new Euler(0, 0, 0, 'YXZ');
const _q = new Quaternion();
const _qi = new Quaternion();
const _pos = new Vector3();
const _right = new Vector3();
const _up = new Vector3();
const _attPos = new Vector3();
const _attQ = new Quaternion();

export interface RigState {
  position: Vector3;
  quaternion: Quaternion;
  fov: number;
  near: number;
  far: number;
  /** distance to the framed subject (auto-focus) */
  focus: number;
  shake: number;
  attach: number;
}

export const rig: RigState = {
  position: new Vector3(),
  quaternion: new Quaternion(),
  fov: 40,
  near: 0.05,
  far: 3000,
  focus: 2,
  shake: 0,
  attach: 0,
};

/** smooth 1D pseudo noise from incommensurate sines */
function drift(t: number, seed: number) {
  return (
    Math.sin(t * 0.63 + seed) * 0.5 +
    Math.sin(t * 1.37 + seed * 2.1) * 0.3 +
    Math.sin(t * 2.71 + seed * 3.7) * 0.2
  );
}

export function evaluateRig(progress: number, time: number, pointerX: number, pointerY: number, reducedMotion: boolean) {
  const x = T.x.evaluate(progress);
  const y = T.y.evaluate(progress);
  const z = T.z.evaluate(progress);
  let yaw = T.yaw.evaluate(progress);
  let pitch = T.pitch.evaluate(progress);
  let roll = T.roll.evaluate(progress);
  const fov = T.fov.evaluate(progress);
  const near = Math.exp(T.logNear.evaluate(progress));
  const shake = reducedMotion ? 0 : T.shake.evaluate(progress);
  const parallax = reducedMotion ? 0 : T.parallax.evaluate(progress);
  const attach = MathUtils.clamp(T.attach.evaluate(progress), 0, 1);

  // hand-held breathing
  const d2r = Math.PI / 180;
  yaw += drift(time, 1.3) * shake * d2r;
  pitch += drift(time * 0.9, 4.1) * shake * 0.8 * d2r;
  roll += drift(time * 0.7, 7.7) * shake * 0.6 * d2r;
  // pointer: gentle look-around
  const look = reducedMotion ? 0 : 1;
  yaw -= pointerX * 1.1 * d2r * look;
  pitch += pointerY * 0.7 * d2r * look;

  _e.set(pitch, yaw, roll, 'YXZ');
  _q.setFromEuler(_e);
  _pos.set(x, y, z);

  // pointer parallax translation in camera plane
  if (parallax > 0) {
    _right.set(1, 0, 0).applyQuaternion(_q);
    _up.set(0, 1, 0).applyQuaternion(_q);
    _pos.addScaledVector(_right, pointerX * parallax).addScaledVector(_up, pointerY * parallax * 0.6);
  }

  // ride with the yacht
  if (attach > 0) {
    _attPos.copy(_pos).applyMatrix4(yachtSwell.delta);
    _attQ.copy(yachtSwell.deltaQuaternion).multiply(_q);
    _pos.lerp(_attPos, attach);
    _qi.copy(_q).slerp(_attQ, attach);
    _q.copy(_qi);
  }

  rig.position.copy(_pos);
  rig.quaternion.copy(_q);
  rig.fov = fov;
  rig.near = near;
  rig.far = Math.min(40000, near * 90000);
  rig.focus = Math.exp(T.logFocus.evaluate(progress));
  rig.shake = shake;
  rig.attach = attach;
  return rig;
}

/** Keep the framing on narrow (portrait) screens: widen the vertical FOV. */
export function fitFov(fov: number, aspect: number) {
  const ref = 1.45;
  if (aspect >= ref) return fov;
  const t = Math.tan((fov * Math.PI) / 360);
  const k = Math.pow(ref / aspect, 0.72);
  return Math.min(100, (Math.atan(t * k) * 360) / Math.PI);
}

export function applyRig(camera: PerspectiveCamera, r: RigState) {
  camera.position.copy(r.position);
  camera.quaternion.copy(r.quaternion);
  const fov = fitFov(r.fov, camera.aspect);
  if (camera.fov !== fov || camera.near !== r.near || camera.far !== r.far) {
    camera.fov = fov;
    camera.near = r.near;
    camera.far = r.far;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}
