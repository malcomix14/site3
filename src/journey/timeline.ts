import { Vector3 } from 'three';
import { MonotoneTrack, cue } from './interpolation';
import { WINDOW_CENTER as WC, watchToWorld, yachtToWorld } from './layout';

/**
 * THE JOURNEY TIMELINE
 * --------------------
 * Positions along the journey are expressed in "scroll units" (1 unit = one
 * viewport height of scrolling). Every camera shot and every cue lives on this
 * single global timeline, which the JourneyController evaluates each frame.
 */

type V3 = [number, number, number];

interface Shot {
  at: number;
  pos: V3 | Vector3;
  look?: V3 | Vector3;
  /** explicit yaw in degrees (overrides look for yaw) */
  yaw?: number;
  roll?: number;
  fov?: number;
  near?: number;
  /** 0 = world space, 1 = camera rides with the yacht's swell */
  attach?: number;
  /** handheld amplitude (degrees) */
  shake?: number;
  /** pointer parallax translation in metres */
  parallax?: number;
}

const W = (x: number, y: number, z: number): V3 => [WC.x + x, WC.y + y, WC.z + z];
const Y = (x: number, y: number, z: number) => yachtToWorld(x, y, z);
const M = (x: number, y: number, z: number) => watchToWorld(x, y, z);

// ------------------------------------------------------------------ shots
const SHOTS: Shot[] = [
  // 01 — the hublot. Almost black cabin, a circle of light.
  { at: 0.0, pos: W(0.06, -0.015, -2.1), look: W(0, -0.02, 0), fov: 34, near: 0.04, shake: 0.05, parallax: 0.02 },
  { at: 1.6, pos: W(0.04, -0.012, -1.3), look: W(0, -0.03, 1), fov: 36, near: 0.03, shake: 0.05, parallax: 0.015 },
  { at: 3.0, pos: W(0.012, -0.004, -0.62), look: W(0, -0.06, 4), fov: 40, near: 0.01, shake: 0.04, parallax: 0.006 },
  // through the reveal and both panes
  { at: 3.8, pos: W(0.0, -0.01, -0.12), look: W(0, -0.25, 8), fov: 46, near: 0.005, shake: 0.03, parallax: 0.0 },
  { at: 4.3, pos: W(-0.02, -0.08, 0.7), look: W(-0.3, -1.6, 12), fov: 52, near: 0.02, shake: 0.12, parallax: 0.0 },
  // out over the wing, into the open sky
  { at: 5.4, pos: W(-1.5, -6, 26), look: W(-4, -30, 120), fov: 54, roll: -4, near: 0.1, shake: 0.25 },
  { at: 6.8, pos: [-6, 318, -1215], look: [-2, 200, -900], fov: 56, roll: -9, near: 0.5, shake: 0.35 },
  // diving through the cloud deck
  { at: 8.1, pos: [-12, 228, -960], look: [-2, 80, -520], fov: 55, roll: 4, near: 0.5, shake: 0.35 },
  { at: 9.4, pos: [-8, 142, -660], look: [0, 42, -10], fov: 48, roll: 2, near: 0.5, shake: 0.25 },
  // the coast, the cliff, the resort
  { at: 10.9, pos: [-2, 76, -310], look: [0, 38, 8], fov: 42, roll: 0, near: 0.4, shake: 0.18 },
  { at: 12.4, pos: [0, 41, -92], look: [0, 35.5, 10], fov: 44, near: 0.2, shake: 0.12 },
  { at: 13.5, pos: [0, 34.6, -24], look: [0, 33.6, 12], fov: 46, near: 0.1, shake: 0.08, parallax: 0.05 },
  { at: 14.4, pos: [0, 33.5, -4.5], look: [0, 33.0, 20], fov: 50, near: 0.05, shake: 0.06, parallax: 0.04 },
  // through the glass facade: the lobby
  { at: 15.1, pos: [0, 33.1, 1.4], look: [-2.5, 32.4, 20], fov: 54, near: 0.05, shake: 0.06, parallax: 0.04 },
  { at: 16.1, pos: [-0.6, 32.4, 8], look: [-5.5, 31.6, 16], fov: 54, near: 0.05, shake: 0.06, parallax: 0.04 },
  { at: 17.1, pos: [0.2, 31.9, 14.6], look: [1.2, 31.7, 24], fov: 52, near: 0.05, shake: 0.05, parallax: 0.03 },
  { at: 18.0, pos: [0, 31.66, 19.4], look: [0, 31.6, 26], fov: 52, near: 0.05, shake: 0.04, parallax: 0.02 },
  // into the car and turn to face the doors
  { at: 18.7, pos: [0, 31.62, 22.55], yaw: 180, look: [0, 31.6, 30], fov: 56, near: 0.03, shake: 0.03, parallax: 0.01 },
  { at: 19.4, pos: [0, 31.62, 23.05], yaw: 360, look: [0, 31.62, 10], fov: 58, near: 0.03, shake: 0.03, parallax: 0.01 },
  { at: 20.0, pos: [0, 31.62, 23.05], yaw: 360, look: [0, 31.62, 10], fov: 58, near: 0.03, shake: 0.02, parallax: 0.01 },
  // the ride up
  { at: 21.5, pos: [0, 52.22, 23.05], yaw: 360, look: [0, 52.22, 10], fov: 58, near: 0.03, shake: 0.02, parallax: 0.01 },
  { at: 22.2, pos: [0, 52.22, 22.95], yaw: 360, look: [0, 52.1, 10], fov: 56, near: 0.03, shake: 0.03, parallax: 0.01 },
  // 02 — the penthouse: salon → corridor → kitchen → bedroom → bath
  { at: 23.2, pos: [-0.4, 52.15, 18.4], look: [-3.5, 51.5, 7], fov: 56, near: 0.04, shake: 0.06, parallax: 0.04 },
  { at: 24.3, pos: [-2.2, 52.0, 14.2], look: [-10, 51.5, 12.4], fov: 54, near: 0.04, shake: 0.06, parallax: 0.04 },
  { at: 25.4, pos: [3.2, 52.0, 16.6], look: [12, 51.7, 19], fov: 56, near: 0.04, shake: 0.06, parallax: 0.04 },
  { at: 26.4, pos: [12.4, 52.0, 19.0], look: [22, 51.8, 19], fov: 56, near: 0.04, shake: 0.06, parallax: 0.04 },
  { at: 27.4, pos: [20.6, 51.95, 18.8], look: [26, 51.2, 13.2], fov: 56, near: 0.04, shake: 0.06, parallax: 0.04 },
  { at: 28.4, pos: [27.2, 51.8, 19.6], look: [34, 51.5, 17], fov: 56, near: 0.04, shake: 0.06, parallax: 0.04 },
  { at: 29.4, pos: [33.6, 51.9, 17.2], look: [38.2, 51.0, 21], fov: 54, near: 0.04, shake: 0.06, parallax: 0.04 },
  { at: 30.4, pos: [40.2, 51.9, 15.4], look: [47.5, 51.2, 12], fov: 56, near: 0.04, shake: 0.06, parallax: 0.04 },
  { at: 31.4, pos: [45.2, 51.9, 15.4], look: [48, 51.0, 9.2], fov: 54, near: 0.04, shake: 0.06, parallax: 0.04 },
  // the bay window — the sea
  { at: 32.4, pos: [46.6, 52.0, 13.2], look: [46.6, 51.7, 0], fov: 52, near: 0.05, shake: 0.05, parallax: 0.03 },
  { at: 33.2, pos: [46.6, 51.95, 9.6], look: [46.4, 51.2, -10], fov: 52, near: 0.05, shake: 0.05, parallax: 0.03 },
  { at: 34.2, pos: [46.6, 51.6, 1.8], look: [46, 46, -40], fov: 54, near: 0.05, shake: 0.08, parallax: 0.02 },
  // 03 — over the edge, down to the water
  { at: 35.3, pos: [46.2, 46.5, -16], look: [44.5, 18, -90], fov: 56, roll: -3, near: 0.1, shake: 0.18 },
  { at: 36.6, pos: [44.4, 11, -86], look: [42, 3.4, -320], fov: 54, roll: 2, near: 0.1, shake: 0.2 },
  { at: 37.9, pos: [43.2, 3.4, -226], look: [40, 3.4, -470], fov: 46, roll: 0, near: 0.1, shake: 0.15 },
  // 04 — the yacht
  { at: 39.2, pos: Y(-4, 5.2, 58), look: Y(0, 3.2, 0), fov: 42, near: 0.1, shake: 0.12 },
  { at: 40.4, pos: Y(30, 6.0, 38), look: Y(6, 3.4, 0), fov: 44, near: 0.1, shake: 0.12, attach: 0 },
  { at: 41.5, pos: Y(42, 4.6, 7), look: Y(16, 3.7, 0), fov: 46, near: 0.1, shake: 0.1, attach: 0.2 },
  { at: 42.4, pos: Y(26.5, 3.75, 0.6), look: Y(10, 3.65, 0), fov: 50, near: 0.05, shake: 0.08, attach: 0.8, parallax: 0.03 },
  { at: 43.2, pos: Y(18.6, 3.72, 0.2), look: Y(9, 3.3, 0.4), fov: 54, near: 0.03, shake: 0.06, attach: 1, parallax: 0.03 },
  { at: 44.1, pos: Y(14.2, 3.55, 0.9), look: Y(8.6, 2.9, 0.05), fov: 50, near: 0.02, shake: 0.05, attach: 1, parallax: 0.02 },
  { at: 45.1, pos: Y(10.9, 3.2, 0.55), look: Y(8.6, 2.86, 0), fov: 44, near: 0.01, shake: 0.04, attach: 1, parallax: 0.01 },
  // 05 — the watch (watch-local millimetres)
  { at: 46.4, pos: M(12, 190, 300), look: M(0, 0, 0), fov: 34, near: 0.005, shake: 0.03, attach: 1, parallax: 0.004 },
  { at: 47.6, pos: M(10, 78, 104), look: M(0, 0, 1), fov: 30, near: 0.004, shake: 0.02, attach: 1, parallax: 0.002 },
  { at: 48.8, pos: M(6, 34, 36), look: M(0, 0.5, 0), fov: 30, near: 0.002, shake: 0.015, attach: 1, parallax: 0.001 },
  { at: 50.0, pos: M(-7, 15, 13), look: M(1.5, 1.0, -2), fov: 32, near: 0.001, shake: 0.012, attach: 1, parallax: 0.0006 },
  // deconstruction — camera pulls back and orbits the exploded assembly
  { at: 51.6, pos: M(-26, 44, 88), look: M(0, 4, 0), fov: 32, near: 0.002, shake: 0.012, attach: 1, parallax: 0.001 },
  { at: 53.4, pos: M(56, 34, 142), look: M(0, -4, 0), fov: 32, near: 0.003, shake: 0.012, attach: 1, parallax: 0.002 },
  { at: 55.2, pos: M(150, 10, 58), look: M(0, -5, 0), fov: 32, near: 0.003, shake: 0.012, attach: 1, parallax: 0.002 },
  { at: 57.0, pos: M(108, -30, -110), look: M(0, -10, 0), fov: 32, near: 0.003, shake: 0.012, attach: 1, parallax: 0.002 },
  { at: 58.6, pos: M(-30, -2, -120), look: M(0, -12, 0), fov: 34, near: 0.002, shake: 0.01, attach: 1, parallax: 0.001 },
  // into the heart of the movement
  { at: 60.2, pos: M(-30, -12.5, -34), look: M(0, -14, 0), fov: 38, near: 0.0006, shake: 0.008, attach: 1, parallax: 0.0004 },
  { at: 61.8, pos: M(-14.5, -13.2, -12.5), look: M(5, -14.8, 4.5), fov: 42, near: 0.0004, shake: 0.006, attach: 1, parallax: 0.0003 },
  { at: 64.0, pos: M(-11, -13.4, -8.5), look: M(6, -15, 5.5), fov: 44, near: 0.0004, shake: 0.006, attach: 1, parallax: 0.0003 },
];

export const JOURNEY_LENGTH = 64; // scroll units (viewport heights)

// ------------------------------------------------------------------ build camera channels
function toV3(p: V3 | Vector3): Vector3 {
  return Array.isArray(p) ? new Vector3(p[0], p[1], p[2]) : p.clone();
}

function buildCameraTracks() {
  const times: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const yaws: number[] = [];
  const pitches: number[] = [];
  const rolls: number[] = [];
  const fovs: number[] = [];
  const nears: number[] = [];
  const attaches: number[] = [];
  const shakes: number[] = [];
  const parallaxes: number[] = [];
  const focuses: number[] = [];

  let prevYaw = 0;
  let prev: Required<Pick<Shot, 'fov' | 'near' | 'attach' | 'shake' | 'parallax' | 'roll'>> = {
    fov: 40,
    near: 0.05,
    attach: 0,
    shake: 0.05,
    parallax: 0,
    roll: 0,
  };
  const d = new Vector3();
  SHOTS.forEach((s, i) => {
    const p = toV3(s.pos);
    const l = s.look ? toV3(s.look) : p.clone().add(new Vector3(0, 0, -1));
    d.subVectors(l, p).normalize();
    let yaw = Math.atan2(-d.x, -d.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
    if (s.yaw !== undefined) {
      yaw = (s.yaw * Math.PI) / 180;
    } else if (i > 0) {
      // unwrap to the closest equivalent angle
      while (yaw - prevYaw > Math.PI) yaw -= Math.PI * 2;
      while (yaw - prevYaw < -Math.PI) yaw += Math.PI * 2;
    }
    prevYaw = yaw;
    const cur = {
      fov: s.fov ?? prev.fov,
      near: s.near ?? prev.near,
      attach: s.attach ?? prev.attach,
      shake: s.shake ?? prev.shake,
      parallax: s.parallax ?? 0,
      roll: s.roll ?? 0,
    };
    prev = cur;
    times.push(s.at);
    xs.push(p.x);
    ys.push(p.y);
    zs.push(p.z);
    yaws.push(yaw);
    pitches.push(pitch);
    rolls.push((cur.roll * Math.PI) / 180);
    fovs.push(cur.fov);
    nears.push(Math.log(cur.near));
    attaches.push(cur.attach);
    shakes.push(cur.shake);
    parallaxes.push(cur.parallax);
    focuses.push(Math.log(Math.max(1e-4, l.distanceTo(p))));
  });

  return {
    x: new MonotoneTrack(times, xs),
    y: new MonotoneTrack(times, ys),
    z: new MonotoneTrack(times, zs),
    yaw: new MonotoneTrack(times, yaws),
    pitch: new MonotoneTrack(times, pitches),
    roll: new MonotoneTrack(times, rolls),
    fov: new MonotoneTrack(times, fovs),
    logNear: new MonotoneTrack(times, nears),
    attach: new MonotoneTrack(times, attaches),
    shake: new MonotoneTrack(times, shakes),
    parallax: new MonotoneTrack(times, parallaxes),
    logFocus: new MonotoneTrack(times, focuses),
  };
}

export const CAMERA_TRACKS = buildCameraTracks();

// ------------------------------------------------------------------ cues
export const CUES = {
  /** overall exposure (eye adaptation) */
  exposure: cue([
    [0, 1.0],
    [3.0, 1.0],
    [3.9, 0.92],
    [5, 0.92],
    [9, 0.95],
    [14.4, 0.86],
    [15.4, 0.86],
    [17.5, 0.95],
    [18.3, 1.05],
    [19.5, 1.1],
    [22.2, 1.05],
    [23.4, 0.82],
    [25.5, 0.95],
    [30.5, 0.95],
    [31.8, 0.85],
    [33.4, 0.74],
    [36, 0.74],
    [37.9, 0.7],
    [39.4, 0.84],
    [40.6, 0.86],
    [41.6, 0.9],
    [42.6, 0.95],
    [43.6, 1.08],
    [46.5, 1.12],
    [49.5, 1.08],
    [64, 1.1],
  ]),
  /** lobby-level elevator doors (1 = open) */
  lobbyDoors: cue([
    [0, 1],
    [19.35, 1],
    [19.95, 0],
  ]),
  /** penthouse-level elevator doors */
  phDoors: cue([
    [0, 0],
    [21.75, 0],
    [22.45, 1],
  ]),
  /** sliding bay window of the penthouse */
  bayWindow: cue([
    [0, 0],
    [32.3, 0],
    [33.3, 1],
  ]),
  /** aft salon doors of the yacht */
  yachtDoors: cue([
    [0, 0],
    [41.2, 0],
    [42.5, 1],
  ]),
  /** studio void around the watch (hides the yacht) */
  studio: cue([
    [0, 0],
    [48.2, 0],
    [49.7, 1],
  ]),
  /** deconstruction of the watch */
  explode: cue([
    [0, 0],
    [50.1, 0],
    [55.6, 1],
  ]),
  /** time scale of the movement (slow motion in the macro finale) */
  mechTime: cue([
    [0, 1],
    [57.5, 1],
    [61.5, 0.32],
  ]),
  /** technical labels */
  labels: cue([
    [0, 0],
    [52.6, 0],
    [53.6, 1],
    [57.4, 1],
    [58.3, 0],
  ]),
  /** bokeh strength */
  bokeh: cue([
    [0, 0],
    [45.2, 0],
    [46.6, 1.2],
    [48.8, 2.4],
    [50.0, 3.0],
    [51.8, 1.4],
    [55.2, 1.1],
    [58.6, 1.6],
    [60.4, 3.2],
    [64, 3.6],
  ]),
  /** radial motion blur (simulated) */
  motionBlur: cue([
    [0, 0],
    [3.3, 0],
    [3.85, 1],
    [4.6, 0.25],
    [6.5, 0.45],
    [8.2, 0.55],
    [9.6, 0.1],
    [14.6, 0],
    [15.05, 0.6],
    [15.6, 0],
    [33.4, 0],
    [34.6, 0.5],
    [36.8, 0.55],
    [38.2, 0],
    [64, 0],
  ]),
  /** bloom strength */
  bloom: cue([
    [0, 0.6],
    [4, 0.5],
    [14, 0.45],
    [34, 0.45],
    [44, 0.4],
    [46.5, 0.22],
    [50, 0.16],
    [58, 0.2],
    [64, 0.26],
  ]),
  /** cloud drift / wind */
  wind: cue([
    [0, 1],
    [10, 1],
    [12, 0.3],
  ]),
};

// ------------------------------------------------------------------ chapters & captions
export interface Chapter {
  id: string;
  index: string;
  label: string;
  start: number;
  /** where the chapter navigation jumps to */
  anchor: number;
}

export const CHAPTERS: Chapter[] = [
  { id: 'journey', index: '01', label: 'Journey', start: 0, anchor: 0 },
  { id: 'residence', index: '02', label: 'Residence', start: 15.1, anchor: 14.2 },
  { id: 'sea', index: '03', label: 'Sea', start: 33.4, anchor: 32.2 },
  { id: 'yacht', index: '04', label: 'Yacht', start: 38.8, anchor: 37.9 },
  { id: 'time', index: '05', label: 'Time', start: 45.6, anchor: 45.2 },
];

export interface Caption {
  from: number;
  to: number;
  kicker: string;
  line: string;
  align?: 'left' | 'right' | 'center';
}

export const CAPTIONS: Caption[] = [
  { from: 9.1, to: 11.9, kicker: 'Élan Residences', line: 'Arrive somewhere rare.', align: 'left' },
  { from: 23.0, to: 25.6, kicker: 'The Penthouse', line: 'Space, composed in light.', align: 'right' },
  { from: 34.6, to: 37.4, kicker: 'Open Water', line: 'Where the horizon opens.', align: 'left' },
  { from: 42.3, to: 44.6, kicker: 'Élan 52', line: 'Freedom, finely crafted.', align: 'right' },
  { from: 46.4, to: 48.8, kicker: 'Calibre É-01', line: 'The measure of every moment.', align: 'left' },
];

export const FINALE = { from: 61.6, full: 62.8 };
export const INTRO = { fadeOutFrom: 0.15, fadeOutTo: 0.9 };

/** Named markers used by audio and UI. */
export const MARKS = {
  windowPass: 3.85,
  facadePass: 15.0,
  liftStart: 20.0,
  liftEnd: 21.5,
  bayOpen: 32.6,
  yachtEntry: 42.9,
  heart: 60.2,
};
