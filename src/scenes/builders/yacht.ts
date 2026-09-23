import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type ShaderMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { Assembler } from '../../engine/Assembler';
import type { Environments } from '../../engine/environments';
import { WATCH_TABLE, YACHT_DECK_Y } from '../../journey/layout';
import { withAtmosphere } from '../../materials/atmosphere';
import type { Materials } from '../../materials/MaterialLibrary';
import { createPoolMaterial } from '../../materials/PoolMaterial';
import type { Textures } from '../../materials/textures';
import { smooth } from '../../utils/noise';
import { armchair, bookStack, lounger, pendant, sofa, vase } from './furniture';
import { bx } from './hotel';
import { cushion, cyl, extrude, lathe, polyTube, rbox } from './shapes';

/**
 * ÉLAN 52 — a 52 m motor yacht, modelled procedurally.
 * Local frame: bow toward −X, stern toward +X, port +Z, waterline y = 0.
 */
const X_STERN = 25.2;
const X_BOW = -26.2;
const D = YACHT_DECK_Y;

export const sheer = (x: number) => D + 0.05 + 1.5 * Math.pow(smooth(8, X_BOW, x), 1.35);
const keel = (x: number) => -2.2 + 1.9 * Math.pow(smooth(-8, X_BOW, x), 1.7) + 0.6 * smooth(10, X_STERN, x);
export function beam(x: number) {
  const t = (x - X_BOW) / (X_STERN - X_BOW); // 0 bow → 1 stern
  return 4.8 * Math.pow(Math.sin(Math.min(1, t * 1.3) * (Math.PI / 2)), 0.95) * (1 - 0.05 * smooth(0.85, 1, t));
}

function hullGeometry() {
  const NX = 110;
  const NV = 28;
  const pos: number[] = [];
  const idx: number[] = [];
  const row = NV * 2 + 1;
  const rim: Array<{ x: number; y: number; w: number }> = [];
  for (let i = 0; i <= NX; i++) {
    const u = Math.pow(i / NX, 1.15);
    const x = X_STERN + (X_BOW - X_STERN) * u;
    const S = sheer(x);
    const K = keel(x);
    const B = beam(x);
    const bowness = smooth(0.35, 0.9, u);
    const expo = 0.26 + 0.7 * bowness;
    for (let j = -NV; j <= NV; j++) {
      const s = j / NV;
      const v = Math.abs(s);
      const side = Math.sign(s) || 1;
      const y = K + (S - K) * (1 - Math.pow(1 - v, 1.35));
      const flare = 1 + 0.07 * Math.pow(v, 4) * bowness;
      const w = B * Math.pow(v, expo) * flare;
      pos.push(x, y, side * w);
    }
    rim.push({ x, y: S, w: B * (1 + 0.07 * bowness) });
  }
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < row - 1; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make normals face outward (z-sign on the port side must be +)
  const n = g.getAttribute('normal');
  const probe = (Math.floor(NX / 2)) * row + row - 3;
  if (n.getZ(probe) < 0) {
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    const ix = g.getIndex()!;
    for (let i = 0; i < ix.count; i += 3) {
      const t = ix.getX(i + 1);
      ix.setX(i + 1, ix.getX(i + 2));
      ix.setX(i + 2, t);
    }
  }

  // transom (flat cap at the stern)
  const tp: number[] = [];
  const cy = (keel(X_STERN) + sheer(X_STERN)) / 2;
  for (let j = 0; j < row - 1; j++) {
    const a = j * 3;
    const b = (j + 1) * 3;
    tp.push(X_STERN, cy, 0, pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2]);
  }
  const transom = new BufferGeometry();
  transom.setAttribute('position', new Float32BufferAttribute(tp, 3));
  transom.computeVertexNormals();
  if (transom.getAttribute('normal').getX(0) < 0) {
    const p = transom.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) {
      const x1 = p.getX(i + 1), y1 = p.getY(i + 1), z1 = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x1, y1, z1);
    }
    transom.computeVertexNormals();
  }

  // deck surface (slight camber)
  const dp: number[] = [];
  const di: number[] = [];
  rim.forEach((r) => {
    dp.push(r.x, r.y - 0.02, -r.w * 0.995, r.x, r.y + 0.06, 0, r.x, r.y - 0.02, r.w * 0.995);
  });
  for (let i = 0; i < rim.length - 1; i++) {
    const a = i * 3;
    const b = a + 3;
    di.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const deck = new BufferGeometry();
  deck.setAttribute('position', new Float32BufferAttribute(dp, 3));
  deck.setIndex(di);
  deck.computeVertexNormals();
  if (deck.getAttribute('normal').getY(1) < 0) {
    const ix = deck.getIndex()!;
    for (let i = 0; i < ix.count; i += 3) {
      const t = ix.getX(i + 1);
      ix.setX(i + 1, ix.getX(i + 2));
      ix.setX(i + 2, t);
    }
    deck.computeVertexNormals();
  }
  return { hull: g, transom, deck, rim };
}

/** Plan-view deck house: rounded, tapering forward, extruded upward, optionally raked. */
function houseGeometry(xAft: number, xFwd: number, halfAft: number, halfFwd: number, height: number, rake = 0, noseR = 1.5) {
  // build a custom outline in (x, z)
  const pts: Array<[number, number]> = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = xAft + (xFwd + noseR - xAft) * t;
    const hw = halfAft + (halfFwd - halfAft) * Math.pow(t, 1.4);
    pts.push([x, hw]);
  }
  // rounded nose
  for (let i = 1; i < 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI;
    pts.push([xFwd + noseR - Math.cos(a) * noseR, Math.sin(-a) * halfFwd]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const x = xAft + (xFwd + noseR - xAft) * t;
    const hw = halfAft + (halfFwd - halfAft) * Math.pow(t, 1.4);
    pts.push([x, -hw]);
  }
  const shape = new Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const g = extrude(shape, height, 0.08, 2, 12);
  // shape XY → world XZ (z mirrored, symmetric anyway), extrusion → +Y
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (rake > 0) {
      const fwd = smooth(xFwd + 6, xFwd, p.getX(i));
      p.setX(i, p.getX(i) + (y / height) * rake * fwd);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** A dark window band hugging a tapered house side. */
function sideBand(a: Assembler, m: import('three').Material, xAft: number, xFwd: number, halfAft: number, halfFwd: number, noseR: number, xa: number, xb: number, y: number, h: number) {
  const hwAt = (x: number) => {
    const t = Math.min(1, Math.max(0, (x - xAft) / (xFwd + noseR - xAft)));
    return halfAft + (halfFwd - halfAft) * Math.pow(t, 1.4) + 0.085;
  };
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const x0 = xa + ((xb - xa) * i) / segs;
    const x1 = xa + ((xb - xa) * (i + 1)) / segs;
    const z0 = hwAt(x0);
    const z1 = hwAt(x1);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    for (const side of [-1, 1]) {
      a.put(rbox(len + 0.02, h, 0.04, 0.015, 2), m, (x0 + x1) / 2, y, side * ((z0 + z1) / 2), { ry: -side * ang });
    }
  }
}

function nameplate(text: string) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 1024, 256);
  g.fillStyle = '#d9dcdf';
  g.font = '300 150px "Cormorant Garamond", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const spaced = text.split('').join(String.fromCharCode(8202));
  g.fillText(spaced, 512, 118);
  g.font = '400 30px "Manrope", sans-serif';
  g.fillText('M  O  N  A  C  O', 512, 214);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildYacht(M: Materials, env: Environments, tx: Textures) {
  const Y = M.yacht;
  const ext = new Assembler();
  const root = new Group();
  root.name = 'yacht';
  root.matrixAutoUpdate = false;
  const exterior = new Group();
  const interior = new Group();
  root.add(exterior, interior);
  const pools: ShaderMaterial[] = [];

  // ---------------------------------------------------------------- hull
  const H = hullGeometry();
  ext.add(H.hull, Y.hull);
  ext.add(H.transom, Y.hull);
  ext.add(H.deck, Y.teak, undefined, { worldUV: true });
  // stainless cove line & rub rail following the sheer
  const line = H.rim.filter((_, i) => i % 3 === 0);
  for (const side of [-1, 1]) {
    ext.add(polyTube(line.map((r) => new Vector3(r.x, r.y - 0.35, side * (r.w * 1.0 + 0.012))), 0.035, 6), Y.stainless);
    ext.add(polyTube(line.map((r) => new Vector3(r.x, r.y + 0.02, side * (r.w * 1.0 + 0.01))), 0.05, 6), Y.white);
  }
  // hull windows (guest cabins)
  for (const side of [-1, 1]) {
    for (const [x0, x1] of [
      [-12, -7],
      [-5.5, -1.5],
      [0.5, 4.5],
      [6.5, 10.5],
    ]) {
      const xm = (x0 + x1) / 2;
      const w = beam(xm) * 1.0 + 0.02;
      ext.put(rbox(x1 - x0, 0.42, 0.06, 0.12, 3), Y.glass, xm, 0.95, side * w);
    }
  }
  // swim platform & steps
  bx(ext, Y.teak, X_STERN, 0.45, -4.2, X_STERN + 2.2, 0.62, 4.2);
  bx(ext, Y.hull, X_STERN, 0.1, -4.2, X_STERN + 2.2, 0.45, 4.2);
  for (let i = 0; i < 4; i++) bx(ext, Y.teak, X_STERN - 0.5 + i * 0.0, 0.62 + i * 0.37, -1.4 + 0, X_STERN + 0.05 - i * 0.55, 0.99 + i * 0.37, 1.4);
  // garage door on the transom
  bx(ext, Y.carbon, X_STERN + 0.005, 0.7, -2.2, X_STERN + 0.03, 1.6, 2.2, false);

  // ---------------------------------------------------------------- superstructure
  // main deck house, forward (solid) part
  ext.add(houseGeometry(3.6, -13.5, 3.85, 2.9, 2.45, 0, 1.4).translate(0, D, 0), Y.white);
  // window band on the forward house
  sideBand(ext, Y.glass, 3.6, -13.5, 3.85, 2.9, 1.4, -7.5, 2.6, D + 1.35, 0.95);
  // upper deck (overhangs the aft deck)
  const ud = D + 2.45;
  ext.add(houseGeometry(19.8, -10.8, 3.75, 2.7, 0.35, 0, 1.2).translate(0, ud, 0), Y.white);
  ext.add(houseGeometry(14.6, -9.6, 3.35, 2.4, 2.1, 1.6, 1.1).translate(0, ud + 0.35, 0), Y.white);
  sideBand(ext, Y.glass, 14.6, -9.6, 3.35, 2.4, 1.1, -6.5, 13.8, ud + 1.35, 1.05);
  // aft pillars supporting the overhang
  for (const side of [-1, 1]) ext.put(cyl(0.09, 0.09, 2.45, 16), Y.stainless, 19.4, D + 1.22, side * 3.3);
  // bridge deck
  const bd = ud + 2.45;
  ext.add(houseGeometry(14.8, -7.2, 3.45, 2.2, 0.3, 0, 1.0).translate(0, bd - 0.3 + 0.3, 0), Y.white);
  ext.add(houseGeometry(9.5, -5.6, 3.0, 2.0, 1.9, 2.2, 1.0).translate(0, bd + 0.3, 0), Y.white);
  ext.put(rbox(3.2, 1.0, 5.2, 0.2), Y.glass, -5.0, bd + 1.35, 0, { rz: 0.52 });
  sideBand(ext, Y.glass, 9.5, -5.6, 3.0, 2.0, 1.0, -3.5, 8.6, bd + 1.3, 0.9);
  // hardtop with a swept radar arch
  const ht = bd + 2.2;
  ext.add(houseGeometry(9.8, -2.8, 3.1, 2.6, 0.22, 0, 1.4).translate(0, ht + 0.25, 0), Y.white);
  for (const side of [-1, 1]) {
    ext.add(
      polyTube(
        [
          new Vector3(8.8, bd + 0.3, side * 2.9),
          new Vector3(7.6, bd + 1.4, side * 2.8),
          new Vector3(6.2, ht + 0.25, side * 2.6),
        ],
        0.14,
        10,
      ),
      Y.white,
    );
  }
  // mast & radomes
  ext.put(rbox(0.5, 1.4, 0.35, 0.12), Y.white, 3.5, ht + 1.1, 0);
  ext.put(new SphereGeometry(0.42, 24, 16), Y.white, 3.5, ht + 2.1, -0.9);
  ext.put(new SphereGeometry(0.32, 24, 16), Y.white, 3.5, ht + 2.0, 0.9);
  ext.put(cyl(0.02, 0.02, 1.6, 6), Y.stainless, 3.2, ht + 2.6, 0);
  ext.put(rbox(1.8, 0.06, 0.12, 0.03), Y.stainless, 3.7, ht + 1.85, 0);

  // ---------------------------------------------------------------- decks & furniture
  // aft main deck: U-sofa and table under the overhang
  sofa(ext, { x: 22.4, y: D, z: 0, ry: -Math.PI / 2 }, { w: 4.6, d: 0.95, fabric: Y.cushion, base: Y.teak });
  bx(ext, Y.teak, 19.8, D + 0.62, -1.2, 21.2, D + 0.68, 1.2);
  bx(ext, Y.stainless, 20.4, D, -0.1, 20.6, D + 0.62, 0.1);
  // foredeck sun pad
  ext.put(cushion(4.2, 0.28, 5.0, 0.12, 0.04), Y.cushion, -18.5, sheer(-18.5) + 0.2, 0);
  ext.put(cushion(0.9, 0.35, 5.0, 0.15, 0.05), Y.cushionNavy, -16.1, sheer(-16.1) + 0.4, 0, { rz: -0.4 });
  // upper deck aft lounge
  for (let i = 0; i < 2; i++) lounger(ext, { x: 17.6, y: ud + 0.35, z: -1.6 + i * 3.2, ry: Math.PI / 2 }, { frame: Y.teak, cushion: Y.cushion });
  // sun deck jacuzzi
  const jx = 12.2;
  const jy = bd + 0.3;
  ext.put(lathe([[0, 0], [1.4, 0], [1.55, 0.35], [1.6, 0.62], [1.45, 0.64], [1.35, 0.55]], 48), Y.white, jx, jy, 0);
  const jMat = createPoolMaterial(env.skyCube.texture, tx.waterNormal, { deep: '#0f7f8c', shallow: '#8fe3e0', depth: 0.6 });
  pools.push(jMat);
  const jw = new Mesh(new PlaneGeometry(2.7, 2.7), jMat);
  jw.rotation.x = -Math.PI / 2;
  jw.position.set(jx, jy + 0.5, 0);
  exterior.add(jw);
  // railings
  for (const side of [-1, 1]) {
    const pts = H.rim.filter((r) => r.x < 16.8 && r.x > -24).filter((_, i) => i % 2 === 0);
    ext.add(polyTube(pts.map((r) => new Vector3(r.x, r.y + 0.95, side * (r.w - 0.08))), 0.025, 6), Y.stainless);
    pts.forEach((r, i) => {
      if (i % 3 !== 0) return;
      ext.put(cyl(0.015, 0.015, 0.95, 6), Y.stainless, r.x, r.y + 0.48, side * (r.w - 0.08));
    });
    // upper & bridge deck glass balustrades
    ext.put(rbox(5.2, 0.9, 0.04, 0.02), Y.glass, 17.2, ud + 0.8, side * 3.6);
    ext.add(polyTube([new Vector3(14.6, ud + 1.28, side * 3.62), new Vector3(19.8, ud + 1.28, side * 3.62)], 0.025, 6), Y.stainless);
  }
  // nameplate on the transom
  const plate = new Mesh(
    new PlaneGeometry(3.4, 0.85),
    withAtmosphere(new MeshStandardMaterial({ map: nameplate('ÉLAN'), transparent: true, metalness: 1, roughness: 0.3, envMap: env.sky, color: '#e8e8e8' })),
  );
  plate.position.set(X_STERN + 0.035, 1.5, 0);
  plate.rotation.y = Math.PI / 2;
  exterior.add(plate);

  exterior.add(ext.build('yacht-ext'));

  // ---------------------------------------------------------------- SALON interior (x 4 … 16.5)
  const it = new Assembler();
  const X0 = 3.8;
  const X1 = 16.5;
  const ZW = 3.45; // inner half width
  const CEIL = D + 2.25;
  bx(it, Y.walnutDark, X0, D - 0.05, -ZW, X1, D, ZW); // floor
  const carpet = new Mesh(new PlaneGeometry(8.6, 5.2), Y.carpet);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(10.3, D + 0.006, 0);
  carpet.receiveShadow = true;
  interior.add(carpet);
  bx(it, Y.ceiling, X0, CEIL, -ZW, X1, CEIL + 0.06, ZW, false); // ceiling
  // ceiling coves
  for (const s of [-1, 1]) {
    bx(it, Y.walnut, X0, CEIL - 0.22, s * ZW, X1, CEIL, s * (ZW - 0.55), false);
    bx(it, Y.led, X0 + 0.1, CEIL - 0.23, s * (ZW - 0.6) - 0.02, X1 - 0.1, CEIL - 0.22, s * (ZW - 0.6) + 0.02, false);
  }
  // side walls: walnut dado, window band, valance
  for (const s of [-1, 1]) {
    const zi = s * ZW;
    const zo = s * (ZW + 0.25);
    bx(it, Y.walnut, X0, D, Math.min(zi, zo), X1, D + 0.8, Math.max(zi, zo));
    bx(it, Y.walnut, X0, CEIL - 0.3, Math.min(zi, zo), X1, CEIL, Math.max(zi, zo));
    bx(it, Y.white, X0, D - 0.1, s * (ZW + 0.25), X1, D + 0.8, s * (ZW + 0.36));
    bx(it, Y.white, X0, CEIL - 0.3, s * (ZW + 0.25), X1, ud, s * (ZW + 0.36));
    // mullions
    for (let x = X0 + 2.5; x < X1; x += 2.5) bx(it, Y.brass, x - 0.03, D + 0.8, s * ZW - 0.03, x + 0.03, CEIL - 0.3, s * ZW + 0.03);
    const win = new Mesh(new PlaneGeometry(X1 - X0, CEIL - 0.3 - (D + 0.8)), Y.windowGlass);
    win.position.set((X0 + X1) / 2, (D + 0.8 + CEIL - 0.3) / 2, s * (ZW + 0.12));
    win.rotation.y = s > 0 ? Math.PI : 0;
    win.renderOrder = 4;
    interior.add(win);
  }
  // exterior skin above the side windows (white) — the salon roof is the upper deck floor
  bx(it, Y.white, X0, CEIL + 0.06, -ZW - 0.4, X1, ud + 0.35, ZW + 0.4);
  // forward bulkhead: walnut with a dark marble bar
  bx(it, Y.walnut, X0 - 0.2, D, -ZW, X0, CEIL, ZW);
  bx(it, Y.marble, X0 + 0.1, D, -2.4, X0 + 0.7, D + 1.05, -0.6);
  bx(it, Y.brass, X0 + 0.08, D + 1.05, -2.45, X0 + 0.75, D + 1.08, -0.55);
  for (let i = 0; i < 5; i++) it.put(cyl(0.035, 0.03, 0.22, 16), Y.interiorGlass, X0 + 0.35, D + 1.19, -2.2 + i * 0.3);
  // art on the bulkhead
  const art = new Mesh(new PlaneGeometry(1.8, 1.1), M.int.artEnso);
  art.position.set(X0 + 0.01, D + 1.55, 1.3);
  art.rotation.y = Math.PI / 2;
  interior.add(art);
  // seating: L-sofa to port, armchairs to starboard, coffee table
  sofa(it, { x: 12.6, y: D, z: 2.75, ry: Math.PI }, { w: 4.2, d: 0.95, fabric: Y.leatherCream, base: Y.walnutDark });
  sofa(it, { x: 15.25, y: D, z: 2.4, ry: -Math.PI / 2 }, { w: 1.9, d: 0.95, fabric: Y.leatherCream, arms: false, base: Y.walnutDark });
  armchair(it, { x: 11.6, y: D, z: -2.5, ry: 0.15 }, { fabric: Y.leatherTobacco, frame: Y.walnutDark });
  armchair(it, { x: 13.6, y: D, z: -2.5, ry: -0.15 }, { fabric: Y.leatherTobacco, frame: Y.walnutDark });
  bx(it, Y.walnut, 11.6, D, 0.4, 14.0, D + 0.36, 1.5);
  bookStack(it, { x: 12.3, y: D + 0.36, z: 0.9, ry: 0.4 }, { mat: M.int.books, n: 3 });
  vase(it, { x: 13.3, y: D + 0.36, z: 1.0 }, { mat: M.int.ceramic, h: 0.34, r: 0.1 });

  // the presentation table (watch)
  const T = WATCH_TABLE;
  it.put(cyl(0.58, 0.58, 0.035, 72), Y.marble, T.x, T.top - 0.0175, T.z);
  it.put(lathe([[0.3, 0], [0.34, 0.02], [0.1, 0.12], [0.07, 0.6], [0.16, 0.7], [0.2, 0.705]], 48), Y.brass, T.x, D, T.z);
  pendant(it, { x: T.x, y: CEIL, z: T.z }, { metal: Y.brass, glow: M.int.bulb, drop: 0.85, r: 0.2 });
  // aft glass doors frame
  bx(it, Y.brass, X1 - 0.05, D, -1.95, X1 + 0.05, CEIL, -1.85);
  bx(it, Y.brass, X1 - 0.05, D, 1.85, X1 + 0.05, CEIL, 1.95);
  bx(it, Y.white, X1, D, -ZW - 0.4, X1 + 0.1, CEIL + 0.3, -1.95);
  bx(it, Y.white, X1, D, 1.95, X1 + 0.1, CEIL + 0.3, ZW + 0.4);
  bx(it, Y.white, X1, CEIL, -1.95, X1 + 0.1, CEIL + 0.3, 1.95);

  interior.add(it.build('yacht-int'));

  // sliding aft doors
  const door = (z: number) => {
    const g = new Group();
    const pane = new Mesh(new PlaneGeometry(1.86, CEIL - D - 0.04), Y.windowGlass);
    pane.rotation.y = Math.PI / 2;
    pane.renderOrder = 4;
    g.add(pane);
    const f = new Assembler();
    bx(f, Y.brass, -0.03, -(CEIL - D) / 2, -0.93, 0.03, (CEIL - D) / 2, -0.9);
    bx(f, Y.brass, -0.03, -(CEIL - D) / 2, 0.9, 0.03, (CEIL - D) / 2, 0.93);
    g.add(f.build('door'));
    g.position.set(X1 - 0.08, (D + CEIL) / 2, z);
    interior.add(g);
    return g;
  };
  const doorL = door(-0.93);
  const doorR = door(0.93);

  return { root, exterior, interior, doorL, doorR, pools };
}

export type YachtBuild = ReturnType<typeof buildYacht>;
