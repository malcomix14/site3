import {
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  RingGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  BackSide,
  ShaderMaterial,
  type BufferGeometry,
} from 'three';
import { withAtmosphere } from '../../materials/atmosphere';
import type { Materials } from '../../materials/MaterialLibrary';
import { lathe, polyTube, rbox } from './shapes';
import {
  crownGeometry,
  dateTexture,
  dauphineHand,
  dialPrintTexture,
  flatPart,
  flutedBezel,
  gearShape,
  hullShape,
  indexPrism,
  pitchRadius,
  rotorEngravingTexture,
  spiralRibbon,
  strapGeometry,
  type WheelSpec,
} from './watchParts';

/**
 * CALIBRE É-01 — the watch, modelled in millimetres.
 * Dial plane at y = 0 facing +Y, 12 o'clock toward −Z, crown at +X.
 * Every part is its own object so it can leave the case on its own path.
 */

export interface ExplodePart {
  obj: Object3D;
  base: Vector3;
  baseRot: number;
  off: Vector3;
  t0: number;
  t1: number;
  spin: number;
  tilt: number;
}

export interface Arbor {
  group: Group;
  /** rotation (radians) as a function of the seconds-hand angle */
  ratio: number;
}

// going train (module-consistent meshing)
const BARREL: WheelSpec = { teeth: 90, module: 0.115 };
const CENTER_PINION: WheelSpec = { teeth: 12, module: 0.115 };
const CENTER: WheelSpec = { teeth: 80, module: 0.1 };
const THIRD_PINION: WheelSpec = { teeth: 10, module: 0.1 };
const THIRD: WheelSpec = { teeth: 75, module: 0.09 };
const FOURTH_PINION: WheelSpec = { teeth: 10, module: 0.09 };
const FOURTH: WheelSpec = { teeth: 80, module: 0.075 };
const ESCAPE_PINION: WheelSpec = { teeth: 5, module: 0.075 };

const clock = (a: number, r: number): [number, number] => [Math.sin(a) * r, -Math.cos(a) * r];

// plan positions (x, z)
export const POS = (() => {
  const C: [number, number] = [0, 0];
  const dBC = pitchRadius(BARREL) + pitchRadius(CENTER_PINION);
  const b = clock((300 / 180) * Math.PI, dBC);
  const dCT = pitchRadius(CENTER) + pitchRadius(THIRD_PINION);
  const t = clock((120 / 180) * Math.PI, dCT);
  const dTF = pitchRadius(THIRD) + pitchRadius(FOURTH_PINION);
  const f: [number, number] = [t[0] + dTF, t[1]];
  const dFE = pitchRadius(FOURTH) + pitchRadius(ESCAPE_PINION);
  const e: [number, number] = [f[0] + dFE * 0.5, f[1] + dFE * 0.866];
  const bal: [number, number] = [3.8, 9.4];
  const p: [number, number] = [e[0] + (bal[0] - e[0]) * 0.42, e[1] + (bal[1] - e[1]) * 0.42];
  return { C, B: b, T: t, F: f, E: e, BAL: bal, P: p };
})();

const ang = (from: [number, number], to: [number, number]) => Math.atan2(to[1] - from[1], to[0] - from[0]);
/** rotation.y that puts a tooth (driver) or a gap (driven) on the line of centres */
function toothPhase(dir: number, n: number) {
  return -dir - 0.4 * ((Math.PI * 2) / n);
}
function gapPhase(dir: number, n: number) {
  return -dir - 0.4 * ((Math.PI * 2) / n) + Math.PI / n;
}

function scaleUVs(g: BufferGeometry, k: number) {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  return g;
}

function mesh(g: BufferGeometry, m: Material | Material[], name?: string) {
  const o = new Mesh(g, m);
  o.castShadow = false;
  o.receiveShadow = false;
  if (name) o.name = name;
  return o;
}

export function buildWatch(M: Materials) {
  const W = M.watch;
  const root = new Group();
  root.name = 'watch';
  const parts: ExplodePart[] = [];
  const addPart = (obj: Object3D, off: [number, number, number], t0: number, t1: number, spin = 0, tilt = 0) => {
    parts.push({ obj, base: obj.position.clone(), baseRot: obj.rotation.y, off: new Vector3(...off), t0, t1, spin, tilt });
    root.add(obj);
  };
  const anchors: Record<string, Object3D> = {};

  // ================================================================== CASE
  const caseGroup = new Group();
  const caseProfile: Array<[number, number]> = [
    [15.9, -4.8],
    [19.4, -4.8],
    [20.3, -4.2],
    [20.6, -2.6],
    [20.6, -0.2],
    [20.35, 0.9],
    [19.8, 1.25],
    [16.6, 1.25],
    [16.4, 0.0],
    [15.9, -0.4],
    [15.9, -4.8],
  ];
  caseGroup.add(mesh(lathe(caseProfile, 160), W.steel));
  // brushed flank band
  caseGroup.add(mesh(lathe([[20.62, -2.5], [20.62, -0.3]], 160), W.steelBrushed));
  // lugs
  const lugShape = (sgn: number) => {
    const pts: Array<[number, number]> = [
      [16.6, 0.9],
      [20.5, 0.55],
      [23.6, -0.4],
      [24.8, -1.8],
      [24.6, -3.3],
      [23.2, -4.2],
      [20.0, -4.5],
      [16.8, -4.7],
    ];
    const s = new Shape();
    pts.forEach(([z, y], i) => (i === 0 ? s.moveTo(sgn * z, y) : s.lineTo(sgn * z, y)));
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3, curveSegments: 12 });
    g.rotateY(-Math.PI / 2);
    return g;
  };
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const l = mesh(lugShape(sz), W.steel);
      l.position.x = sx * 10.2 + 1.25;
      caseGroup.add(l);
    }
    // spring bar
    const bar = mesh(new CylinderGeometry(0.45, 0.45, 20.4, 16), W.steelBrushed);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, -2.2, sz * 23.4);
    caseGroup.add(bar);
  }
  addPart(caseGroup, [0, 0, 0], 0, 1);

  // ================================================================== BEZEL & CRYSTAL
  const bezel = mesh(flutedBezel(16.45, 20.1, 1.1, 2.7, 60), W.steel);
  addPart(bezel, [0, 26, 0], 0.1, 0.5, 0.7);
  const crystal = mesh(
    lathe(
      [
        [0, 3.15],
        [6, 3.08],
        [11, 2.86],
        [15, 2.5],
        [16.7, 2.15],
        [16.7, 1.7],
        [16.3, 1.7],
        [16.2, 2.0],
        [11, 2.7],
        [0, 2.95],
      ],
      128,
    ),
    W.sapphire,
  );
  crystal.renderOrder = 10;
  addPart(crystal, [0, 32, 0], 0.05, 0.45, 0, -0.18);
  anchors.crystal = crystal;

  // ================================================================== DIAL
  const dialGroup = new Group();
  const dialDisc = new CylinderGeometry(15.6, 15.6, 0.4, 160, 1);
  dialDisc.translate(0, -0.2, 0);
  dialGroup.add(mesh(dialDisc, W.dial));
  const printMat = new MeshStandardMaterial({
    map: dialPrintTexture(),
    transparent: true,
    depthWrite: false,
    color: new Color('#f3efe6'),
    roughness: 0.45,
    metalness: 0.2,
    envMap: W.steel.envMap,
    envMapIntensity: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const print = mesh(new CircleGeometry(15.6, 128), withAtmosphere(printMat));
  print.rotation.x = -Math.PI / 2;
  print.position.y = 0.012;
  print.renderOrder = 2;
  dialGroup.add(print);
  // flange (rehaut)
  dialGroup.add(mesh(lathe([[15.2, 0.0], [16.45, 1.05], [16.45, 1.2]], 160), W.black));
  // date window at 3 o'clock
  const frame = mesh(rbox(3.4, 0.28, 2.6, 0.2, 2), W.gold);
  frame.position.set(12.6, 0.12, 0);
  dialGroup.add(frame);
  const date = mesh(new CircleGeometry(1.15, 32), new MeshBasicMaterial({ map: dateTexture(new Date().getDate()) }));
  date.rotation.x = -Math.PI / 2;
  date.rotation.z = -Math.PI / 2;
  date.position.set(12.6, 0.27, 0);
  dialGroup.add(date);
  addPart(dialGroup, [0, 4.5, 0], 0.3, 0.66);
  anchors.dial = dialGroup;

  // applied indices, each leaves on its own beat
  const idxGeo = indexPrism(3.4, 1.05, 0.5);
  for (let i = 0; i < 12; i++) {
    if (i === 3) continue; // date window
    const a = (i / 12) * Math.PI * 2;
    const g = new Group();
    const r = 12.6;
    const [x, z] = clock(a, r);
    g.position.set(x, 0.0, z);
    g.rotation.y = -a;
    if (i === 0) {
      for (const dx of [-0.8, 0.8]) {
        const m = mesh(idxGeo, W.gold);
        m.position.x = dx;
        g.add(m);
      }
    } else {
      g.add(mesh(idxGeo, W.gold));
    }
    const lume = mesh(rbox(0.36, 0.1, 2.4, 0.05, 1), W.lume);
    lume.position.y = i === 0 ? 0 : 0.47;
    if (i !== 0) g.add(lume);
    addPart(g, [0, 9 + (i % 3) * 0.6, 0], 0.26 + i * 0.018, 0.56 + i * 0.018);
  }

  // ================================================================== HANDS
  const handGroup = (geo: BufferGeometry, mat: Material, y: number, hub: number) => {
    const g = new Group();
    const h = mesh(geo, mat);
    g.add(h);
    g.add(mesh(new CylinderGeometry(hub, hub, 0.18, 32), mat));
    g.position.y = y;
    return g;
  };
  const hourHand = handGroup(dauphineHand(9.2, 1.9, 2.0, 0.28), W.gold, 0.62, 1.1);
  const minuteHand = handGroup(dauphineHand(14.3, 1.5, 2.6, 0.26), W.gold, 0.86, 0.85);
  const secGeo = new Group();
  {
    const needle = mesh(rbox(0.16, 0.08, 18.6, 0.04, 1), W.gold);
    needle.position.z = -4.3 - 0.1;
    secGeo.add(needle);
    const tail = mesh(new TorusGeometry(0.9, 0.18, 10, 32), W.gold);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = 4.2;
    secGeo.add(tail);
    secGeo.add(mesh(new CylinderGeometry(0.62, 0.62, 0.25, 32), W.gold));
    secGeo.add(mesh(new SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), W.gold).translateY(0.1));
  }
  secGeo.position.y = 1.08;
  addPart(hourHand, [0, 14, 0], 0.19, 0.6);
  addPart(minuteHand, [0, 17, 0], 0.17, 0.57);
  addPart(secGeo, [0, 20, 0], 0.15, 0.55);
  anchors.hands = minuteHand;

  // ================================================================== CROWN
  const crown = new Group();
  const cr = mesh(crownGeometry(2.8, 3.4, 30), W.steel);
  cr.position.x = 23.1;
  crown.add(cr);
  const cap = mesh(new CylinderGeometry(2.1, 2.1, 0.2, 48), W.gold);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = 24.85;
  crown.add(cap);
  const tube = mesh(new CylinderGeometry(1.2, 1.2, 1.2, 32), W.steelBrushed);
  tube.rotation.z = Math.PI / 2;
  tube.position.x = 21.0;
  crown.add(tube);
  const stem = mesh(new CylinderGeometry(0.42, 0.42, 9.5, 16), W.pinion);
  stem.rotation.z = Math.PI / 2;
  stem.position.x = 16.5;
  crown.add(stem);
  crown.position.y = -1.9;
  addPart(crown, [18, 0, 0], 0.12, 0.5);

  // ================================================================== CASEBACK
  const back = new Group();
  back.add(
    mesh(
      lathe(
        [
          [12.8, -4.9],
          [19.4, -4.9],
          [19.6, -5.3],
          [19.0, -6.0],
          [17.0, -6.3],
          [12.8, -6.3],
          [12.4, -5.6],
          [12.8, -4.9],
        ],
        160,
      ),
      W.steel,
    ),
  );
  const backGlass = mesh(new CylinderGeometry(12.8, 12.8, 0.6, 96), W.sapphire);
  backGlass.position.y = -5.7;
  backGlass.renderOrder = 10;
  back.add(backGlass);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const s = mesh(new CylinderGeometry(0.55, 0.55, 0.3, 20), W.steelBrushed);
    const [x, z] = clock(a, 17.6);
    s.position.set(x, -6.3, z);
    back.add(s);
  }
  addPart(back, [0, -40, 0], 0.1, 0.55, -0.5);

  // ================================================================== STRAP (on the tray)
  const flatY = -4.9;
  const strapPath = (sgn: number, length: number) => {
    const pts: Vector3[] = [];
    const ctrl: Array<[number, number]> = [
      [22.6, -2.2],
      [26, -2.45],
      [30, -3.3],
      [34, -4.35],
      [38, -4.85],
      [42, flatY],
    ];
    ctrl.forEach(([z, y]) => pts.push(new Vector3(0, y, sgn * z)));
    for (let z = 46; z <= length; z += 4) pts.push(new Vector3(0, flatY, sgn * z));
    return pts;
  };
  const strapA = new Group();
  strapA.add(mesh(strapGeometry(strapPath(1, 124), (t) => 20 - t * 4, (t) => 3.8 - t * 1.0, true), W.strap));
  const strapB = new Group();
  const pathB = strapPath(-1, 84);
  strapB.add(mesh(strapGeometry(pathB, (t) => 20 - t * 3, (t) => 3.8 - t * 1.0, false), W.strap));
  // buckle
  const bz = -86;
  const bk: Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    bk.push(new Vector3(Math.cos(a) * 10.2, flatY + 0.2, bz + Math.sin(a) * 4.2 * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.3)));
  }
  strapB.add(mesh(polyTube(bk, 0.9, 10), W.steel));
  const tongue = mesh(rbox(1.2, 0.8, 8.5, 0.4, 2), W.steel);
  tongue.position.set(0, flatY + 1.3, bz + 1.5);
  strapB.add(tongue);
  // keepers
  for (const kz of [-66, -73]) {
    const k = mesh(rbox(22, 4.6, 3.0, 1.2, 2), W.strap);
    k.position.set(0, flatY, kz);
    strapB.add(k);
  }
  // stitching
  for (const side of [-1, 1]) {
    const pa = strapPath(1, 118).map((p, i, arr) => new Vector3(side * ((20 - (i / arr.length) * 4) / 2 - 1.3), p.y + 1.55 - (i / arr.length) * 0.5, p.z));
    strapA.add(mesh(polyTube(pa, 0.11, 5), W.stitch));
    const pb = strapPath(-1, 80).map((p, i, arr) => new Vector3(side * ((20 - (i / arr.length) * 3) / 2 - 1.3), p.y + 1.55 - (i / arr.length) * 0.5, p.z));
    strapB.add(mesh(polyTube(pb, 0.11, 5), W.stitch));
  }
  addPart(strapA, [0, -60, 150], 0.0, 0.3);
  addPart(strapB, [0, -60, -150], 0.0, 0.3);

  // ================================================================== MOVEMENT
  const P = POS;
  // --- main plate with perlage, polished chamfers (multi-material)
  const plateShape = new Shape();
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const x = Math.cos(a) * 15.2;
    const y = Math.sin(a) * 15.2;
    if (i === 0) plateShape.moveTo(x, y);
    else plateShape.lineTo(x, y);
  }
  const hole = (x: number, z: number, r: number) => {
    const h = new Shape();
    for (let i = 0; i <= 40; i++) {
      const a = (-i / 40) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = -z + Math.sin(a) * r;
      if (i === 0) h.moveTo(px, py);
      else h.lineTo(px, py);
    }
    return h;
  };
  plateShape.holes.push(hole(P.BAL[0], P.BAL[1], 4.9), hole(P.B[0], P.B[1], 0.9), hole(0, 0, 0.9));
  const plateGeo = flatPart(plateShape, 1.4, 0.12, 20);
  plateGeo.translate(0, -2.0, 0);
  const plate = mesh(plateGeo, [W.plate, W.rhodiumPolished]);
  addPart(plate, [0, -7, 0], 0.35, 0.8);

  // --- arbors (wheel + pinion on one staff)
  const arbors: Array<{ group: Group; ratio: number; stepped?: boolean }> = [];
  const makeArbor = (
    at: [number, number],
    wheel: { spec: WheelSpec; y: number; t: number; mat: Material; spokes: number; phase: number; club?: boolean },
    pinion: { spec: WheelSpec; y: number; h: number; phase: number } | null,
    staff: [number, number],
    ratio: number,
    off: number,
    t0: number,
  ) => {
    const g = new Group();
    g.position.set(at[0], 0, at[1]);
    const R = pitchRadius(wheel.spec);
    const shape = gearShape(wheel.spec.teeth, wheel.spec.module, {
      spokes: wheel.spokes,
      rim: Math.max(0.35, R * 0.12),
      hub: Math.max(0.55, R * 0.22),
      hole: 0.18,
      club: wheel.club,
      sweep: 0.35,
    });
    const wg = flatPart(shape, wheel.t, 0.025, 6);
    wg.translate(0, wheel.y, 0);
    const wm = mesh(wg, wheel.mat);
    wm.rotation.y = wheel.phase;
    g.add(wm);
    if (pinion) {
      const ps = gearShape(pinion.spec.teeth, pinion.spec.module, { pinion: true });
      const pg = flatPart(ps, pinion.h, 0.01);
      pg.translate(0, pinion.y, 0);
      const pm = mesh(pg, W.pinion);
      pm.rotation.y = pinion.phase;
      g.add(pm);
    }
    const st = mesh(new CylinderGeometry(0.16, 0.16, Math.abs(staff[1] - staff[0]), 12), W.pinion);
    st.position.y = (staff[0] + staff[1]) / 2;
    g.add(st);
    arbors.push({ group: g, ratio });
    addPart(g, [0, off, 0], t0, t0 + 0.45);
    return g;
  };

  // phases so that teeth really interleave on each line of centres
  const aBC = ang(P.B, P.C);
  const aCT = ang(P.C, P.T);
  const aTF = ang(P.T, P.F);
  const aFE = ang(P.F, P.E);
  const r = (s: WheelSpec) => s.teeth;
  // ratios relative to the seconds (fourth) wheel rotation
  const rF = 1;
  const rE = -r(FOURTH) / r(ESCAPE_PINION);
  const rT = -r(FOURTH_PINION) / r(THIRD);
  const rC = -rT * (r(THIRD_PINION) / r(CENTER));
  const rB = -rC * (r(CENTER_PINION) / r(BARREL));

  const barrel = makeArbor(
    P.B,
    { spec: BARREL, y: -2.3, t: 0.28, mat: W.wheelGold, spokes: 0, phase: toothPhase(aBC, BARREL.teeth) },
    null,
    [-1.9, -3.5],
    rB,
    -12.5,
    0.36,
  );
  // barrel drum walls + cover + the mainspring inside (revealed when exploded)
  const drum = mesh(lathe([[4.7, -2.28], [4.95, -2.28], [4.95, -3.45], [4.7, -3.45]], 96), W.wheelGold);
  barrel.add(drum);
  const spring = mesh(spiralRibbon(1.1, 4.5, 9, 0.9, 0.09, 1400), W.blued);
  spring.position.y = -3.3;
  spring.name = 'mainspring';
  barrel.add(spring);
  const cover = new Group();
  const coverGeo = flatPart(gearShape(40, 0.22, { hole: 0.9 }), 0.35, 0.03, 10);
  cover.add(mesh(coverGeo, W.rhodium)); // ratchet wheel
  cover.position.set(P.B[0], -4.1, P.B[1]);
  addPart(cover, [0, -18.5, 0], 0.4, 0.82, 0.8);

  makeArbor(
    P.C,
    { spec: CENTER, y: -2.42, t: 0.22, mat: W.wheelGold, spokes: 4, phase: toothPhase(aCT, CENTER.teeth) },
    { spec: CENTER_PINION, y: -2.55, h: 0.5, phase: gapPhase(aBC + Math.PI, CENTER_PINION.teeth) },
    [-0.6, -3.4],
    rC,
    -11,
    0.4,
  );
  const third = makeArbor(
    P.T,
    { spec: THIRD, y: -2.74, t: 0.2, mat: W.wheelGold, spokes: 4, phase: toothPhase(aTF, THIRD.teeth) },
    { spec: THIRD_PINION, y: -2.52, h: 0.4, phase: gapPhase(aCT + Math.PI, THIRD_PINION.teeth) },
    [-1.9, -3.4],
    rT,
    -12,
    0.41,
  );
  anchors.train = third;
  makeArbor(
    P.F,
    { spec: FOURTH, y: -3.02, t: 0.18, mat: W.wheelGold, spokes: 5, phase: toothPhase(aFE, FOURTH.teeth) },
    { spec: FOURTH_PINION, y: -2.82, h: 0.4, phase: gapPhase(aTF + Math.PI, FOURTH_PINION.teeth) },
    [-1.9, -3.4],
    rF,
    -12.6,
    0.42,
  );
  // escape wheel (club teeth) — stepped, pallet-driven
  makeArbor(
    P.E,
    { spec: { teeth: 15, module: (2.05 * 2) / 15 }, y: -2.58, t: 0.16, mat: W.rhodiumPolished, spokes: 5, phase: 0, club: true },
    { spec: ESCAPE_PINION, y: -3.1, h: 0.4, phase: gapPhase(aFE + Math.PI, ESCAPE_PINION.teeth) },
    [-1.9, -3.4],
    rE,
    -13,
    0.43,
  );

  // pallet fork
  const fork = new Group();
  fork.position.set(P.P[0], 0, P.P[1]);
  const toE = ang(P.P, P.E);
  const toB = ang(P.P, P.BAL);
  const forkArm = (a: number, len: number, w: number) => {
    const m = mesh(rbox(len, 0.14, w, 0.05, 1), W.rhodiumPolished);
    m.position.set((Math.cos(a) * len) / 2, -2.58, (Math.sin(a) * len) / 2);
    m.rotation.y = -a;
    return m;
  };
  fork.add(forkArm(toB, 4.0, 0.34));
  fork.add(forkArm(toE + 0.75, 2.1, 0.3));
  fork.add(forkArm(toE - 0.75, 2.1, 0.3));
  for (const s of [0.75, -0.75]) {
    const jewel = mesh(rbox(0.3, 0.22, 0.5, 0.05, 1), W.ruby);
    jewel.position.set(Math.cos(toE + s) * 2.15, -2.58, Math.sin(toE + s) * 2.15);
    jewel.rotation.y = -(toE + s);
    fork.add(jewel);
  }
  fork.add(mesh(new CylinderGeometry(0.14, 0.14, 1.6, 10), W.pinion).translateY(-2.9));
  addPart(fork, [0, -13.5, 0], 0.44, 0.86);

  // balance wheel + hairspring
  const balance = new Group();
  balance.position.set(P.BAL[0], 0, P.BAL[1]);
  const rim = mesh(lathe([[3.7, -3.25], [4.15, -3.25], [4.15, -2.85], [3.7, -2.85], [3.7, -3.25]], 128), W.wheelGold);
  balance.add(rim);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = mesh(rbox(3.8, 0.2, 0.36, 0.05, 1), W.wheelGold);
    arm.position.set((Math.cos(a) * 3.8) / 2, -3.05, (Math.sin(a) * 3.8) / 2);
    arm.rotation.y = -a;
    balance.add(arm);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    const s = mesh(new CylinderGeometry(0.22, 0.22, 0.5, 12), W.gold);
    s.rotation.z = Math.PI / 2;
    s.rotation.y = -a;
    s.position.set(Math.cos(a) * 4.3, -3.05, Math.sin(a) * 4.3);
    balance.add(s);
  }
  balance.add(mesh(new CylinderGeometry(0.2, 0.2, 2.2, 12), W.pinion).translateY(-3.0));
  balance.add(mesh(new CylinderGeometry(0.75, 0.75, 0.2, 24), W.rhodiumPolished).translateY(-2.62));
  const hairspring = mesh(spiralRibbon(0.55, 2.9, 13, 0.14, 0.035, 1600), W.blued);
  hairspring.position.y = -3.62;
  const hsGroup = new Group();
  hsGroup.add(hairspring);
  balance.add(hsGroup);
  addPart(balance, [0, -15, 0], 0.46, 0.88);
  anchors.balance = balance;

  // --- bridges: Côtes de Genève faces, polished anglage (multi-material)
  const bridgeMats: Material[] = [W.rhodium, W.rhodiumPolished];
  const bridge = (circles: Array<[number, number, number]>, holes: Array<[number, number, number]>, off: number, t0: number, jewelsAt: Array<[number, number]>, screwsAt: Array<[number, number]>) => {
    const s = hullShape(
      circles.map(([x, z, rr]) => [x, -z, rr] as [number, number, number]),
      holes.map(([x, z, rr]) => [x, -z, rr] as [number, number, number]),
    );
    const g = new Group();
    const geo = flatPart(s, 0.6, 0.14, 22);
    geo.translate(0, -3.95, 0);
    g.add(mesh(geo, bridgeMats));
    for (const [x, z] of jewelsAt) {
      const chaton = mesh(new CylinderGeometry(0.95, 0.95, 0.12, 32), W.gold);
      chaton.position.set(x, -4.12, z);
      g.add(chaton);
      const jewel = mesh(new CylinderGeometry(0.6, 0.6, 0.16, 32), W.ruby);
      jewel.position.set(x, -4.18, z);
      g.add(jewel);
    }
    for (const [x, z] of screwsAt) {
      const head = mesh(new CylinderGeometry(0.7, 0.7, 0.3, 24), W.blued);
      head.position.set(x, -4.18, z);
      g.add(head);
      const slot = mesh(rbox(1.2, 0.12, 0.18, 0.02, 1), W.black);
      slot.position.set(x, -4.3, z);
      slot.rotation.y = x * 1.7;
      g.add(slot);
    }
    addPart(g, [0, off, 0], t0, t0 + 0.42);
    return g;
  };
  const barrelAnchor: [number, number] = [-11.2, -7.2];
  bridge([[P.B[0], P.B[1], 5.9], [0, 0, 2.2], [barrelAnchor[0], barrelAnchor[1], 1.8]], [[P.B[0], P.B[1], 0.95]], -21, 0.3, [[0, 0]], [barrelAnchor, [P.B[0] + 3.2, P.B[1] + 3.8], [-1.6, -2.4]]);
  const trainAnchor: [number, number] = [12.8, -2.8];
  bridge([[P.T[0], P.T[1], 1.6], [P.F[0], P.F[1], 1.6], [P.E[0], P.E[1], 1.4], [trainAnchor[0], trainAnchor[1], 1.6]], [], -20, 0.32, [P.T, P.F, P.E], [trainAnchor, [P.T[0] - 0.4, P.T[1] - 2.3]]);
  const out = new Vector3(P.BAL[0], 0, P.BAL[1]).normalize();
  const cockEnd: [number, number] = [P.BAL[0] + out.x * 4.6, P.BAL[1] + out.z * 4.6];
  const cock = bridge([[P.BAL[0], P.BAL[1], 1.8], [cockEnd[0], cockEnd[1], 2.3]], [], -22.5, 0.34, [P.BAL], [cockEnd]);
  // regulator index on the balance cock
  const reg = mesh(rbox(3.6, 0.14, 0.35, 0.05, 1), W.blued);
  reg.position.set(P.BAL[0] - 1.4, -4.3, P.BAL[1] - 0.6);
  reg.rotation.y = 0.5;
  cock.add(reg);
  bridge([[P.P[0], P.P[1], 1.0], [P.P[0] + 2.2, P.P[1] - 1.6, 1.1]], [], -19.5, 0.35, [P.P], [[P.P[0] + 2.2, P.P[1] - 1.6]]);

  // --- rotor (22k gold, Côtes circulaires, engraved) with its bearing
  const rotor = new Group();
  const rs = new Shape();
  const R0 = 5.5;
  const R1 = 14.0;
  const a0 = Math.PI * 0.02;
  const a1 = Math.PI * 0.98;
  for (let i = 0; i <= 64; i++) {
    const a = a0 + ((a1 - a0) * i) / 64;
    const x = Math.cos(a) * R1;
    const y = Math.sin(a) * R1;
    if (i === 0) rs.moveTo(x, y);
    else rs.lineTo(x, y);
  }
  for (let i = 64; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / 64;
    rs.lineTo(Math.cos(a) * R0, Math.sin(a) * R0);
  }
  rs.closePath();
  const rg = flatPart(rs, 0.4, 0.1, 22);
  rg.translate(0, -4.65, 0);
  rotor.add(mesh(rg, [W.goldBrushed, W.gold]));
  // web to the hub
  const web = hullShape([[0, 0, 2.4], [0, 6.2, 2.6]]);
  const wg2 = flatPart(web, 0.4, 0.08, 22);
  wg2.translate(0, -4.65, 0);
  rotor.add(mesh(wg2, [W.goldBrushed, W.gold]));
  // heavy tungsten rim segment
  const heavy = new Shape();
  for (let i = 0; i <= 48; i++) {
    const a = a0 + ((a1 - a0) * i) / 48;
    if (i === 0) heavy.moveTo(Math.cos(a) * R1, Math.sin(a) * R1);
    else heavy.lineTo(Math.cos(a) * R1, Math.sin(a) * R1);
  }
  for (let i = 48; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / 48;
    heavy.lineTo(Math.cos(a) * (R1 - 1.6), Math.sin(a) * (R1 - 1.6));
  }
  heavy.closePath();
  const hg = flatPart(heavy, 0.7, 0.06);
  hg.translate(0, -4.95, 0);
  rotor.add(mesh(hg, W.steelBrushed));
  const engr = mesh(
    new RingGeometry(R0 + 0.4, R1 - 1.7, 96, 1, a0, a1 - a0),
    new MeshStandardMaterial({ map: rotorEngravingTexture(), transparent: true, depthWrite: false, color: '#ffffff', metalness: 0.6, roughness: 0.5, envMap: W.gold.envMap, side: DoubleSide }),
  );
  const ruv = engr.geometry.getAttribute('uv');
  const rpos = engr.geometry.getAttribute('position');
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rpos.getX(i) / (2 * R1 * 1.19) + 0.5, rpos.getY(i) / (2 * R1 * 1.19) + 0.5);
  engr.rotation.x = Math.PI / 2;
  engr.position.y = -4.72;
  rotor.add(engr);
  // bearing
  rotor.add(mesh(new CylinderGeometry(2.3, 2.3, 0.6, 48), W.gold).translateY(-4.45));
  rotor.add(mesh(new CylinderGeometry(1.1, 1.1, 0.75, 32), W.blued).translateY(-4.5));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    rotor.add(mesh(new SphereGeometry(0.28, 12, 8), W.steel).translateX(Math.cos(a) * 1.65).translateZ(Math.sin(a) * 1.65).translateY(-4.4));
  }
  addPart(rotor, [0, -30, 0], 0.15, 0.62, 1.4);
  anchors.rotor = rotor;

  // ================================================================== presentation tray
  const tray = new Group();
  const t1 = mesh(scaleUVs(rbox(96, 14, 230, 6, 4), 4), W.tray);
  t1.position.y = -6.2 - 7 + 2;
  tray.add(t1);
  const t2 = mesh(scaleUVs(rbox(84, 2, 218, 3, 3), 10), W.traySuede);
  t2.position.y = -6.2 - 1;
  tray.add(t2);
  // soft contact shadow
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const sh = mesh(
    new CircleGeometry(1, 48),
    new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false, color: '#000000', opacity: 0.8 }),
  );
  sh.rotation.x = -Math.PI / 2;
  sh.scale.set(30, 150, 1);
  sh.position.y = -6.17;
  tray.add(sh);
  root.add(tray);

  // ================================================================== studio void
  const voidMat = new ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vDir;
      void main() {
        float floorGlow = smoothstep(0.2, -0.9, vDir.y) * 0.035;
        float halo = pow(max(0.0, 1.0 - abs(vDir.y)), 6.0) * 0.012;
        vec3 c = vec3(0.004, 0.0038, 0.0035) + vec3(0.55, 0.45, 0.35) * floorGlow + vec3(0.3, 0.32, 0.36) * halo;
        gl_FragColor = vec4(c, uOpacity);
      }`,
    side: BackSide,
    transparent: true,
    depthWrite: false,
  });
  const studio = new Mesh(new SphereGeometry(1300, 48, 24), voidMat);
  studio.renderOrder = 1;
  studio.frustumCulled = false;
  root.add(studio);

  return { root, parts, arbors, hourHand, minuteHand, secondHand: secGeo, balance, hsGroup, fork, rotor, tray, studio, voidMat, anchors, spring };
}

export type WatchBuild = ReturnType<typeof buildWatch>;
