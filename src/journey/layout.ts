import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

/**
 * World layout — one continuous space (1 unit = 1 metre).
 *
 *   sea level y = 0, open sea toward −Z, coastline near z = 0.
 *   A business jet cruises high above the sea (window facing +Z, toward the coast),
 *   the resort sits on a limestone cliff at z ≈ 0, the yacht lies at anchor offshore.
 */

/** Direction TOWARD the sun: low golden-hour sun over the sea (−Z), slightly west. */
export const SUN_DIRECTION = new Vector3(-0.42, 0.165, -0.892).normalize();

// ---------------------------------------------------------------- aircraft
/** Centre of the cabin window (hublot). The window looks toward +Z. */
export const WINDOW_CENTER = new Vector3(0, 380, -1400);
export const WINDOW_RADIUS = 0.2;

// ---------------------------------------------------------------- resort
export const PLATEAU_Y = 30;
export const CLIFF_EDGE_Z = -9;

export const LOBBY = {
  floor: 30,
  ceiling: 38.6,
  x0: -20,
  x1: 20,
  z0: 0, // glass facade (sea side)
  z1: 22, // back wall with the elevator
};

export const ELEVATOR = {
  x: 0,
  zDoor: 22.05, // plane of the car doors
  depth: 2.2,
  width: 2.3,
  height: 2.9,
  eye: 1.62,
};

export const PENTHOUSE = {
  floor: 50.6,
  ceiling: 54.8,
  zGlass: 6, // sea-side glazing
  zBack: 22,
  x0: -10,
  x1: 52,
  /** partition walls (x) : salon | corridor | kitchen | bedroom | bath */
  walls: [12, 20, 32, 44] as const,
  terraceFront: -3,
};

export const UPPER_FLOORS = [38.6, 42.6, 46.6] as const; // guest levels (floor heights)

// ---------------------------------------------------------------- yacht
export const YACHT_POSITION = new Vector3(40, 0, -470);
/** Yaw of the yacht group (stern toward the sun). Local bow = −X, local port = +Z. */
export const YACHT_YAW = 2.0;
export const YACHT_DECK_Y = 2.1; // main deck floor, local
export const YACHT_REST = new Matrix4().compose(
  YACHT_POSITION,
  new Quaternion().setFromEuler(new Euler(0, YACHT_YAW, 0)),
  new Vector3(1, 1, 1),
);

/** Presentation table in the main salon (yacht local). */
export const WATCH_TABLE = { x: 8.6, z: 0.0, top: YACHT_DECK_Y + 0.74 };
/** Watch origin (dial plane centre) in yacht-local space. The watch is modelled in mm. */
export const WATCH_ORIGIN_LOCAL = new Vector3(WATCH_TABLE.x, WATCH_TABLE.top + 0.018 + 0.0062, WATCH_TABLE.z);
export const WATCH_SCALE = 0.001;
/** Watch 12 o'clock (−Z watch) points to the bow (−X yacht). */
export const WATCH_YAW_LOCAL = Math.PI / 2;

const _v = new Vector3();

/** Yacht-local (rest pose) → world. */
export function yachtToWorld(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  return out.set(x, y, z).applyMatrix4(YACHT_REST);
}

/** Watch-local millimetres → yacht-local metres. */
export function watchToYacht(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  // rotation about Y by +90°: (x, y, z) → (z, y, −x)
  _v.set(z, y, -x).multiplyScalar(WATCH_SCALE);
  return out.copy(WATCH_ORIGIN_LOCAL).add(_v);
}

/** Watch-local millimetres → world (yacht at rest). */
export function watchToWorld(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  watchToYacht(x, y, z, out);
  return out.applyMatrix4(YACHT_REST);
}
