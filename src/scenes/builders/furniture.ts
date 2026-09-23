import { type BufferGeometry, type Material, Matrix4, TorusKnotGeometry, Vector3 } from 'three';
import type { Assembler } from '../../engine/Assembler';
import { composeTRS } from '../../engine/Assembler';
import { cushion, cyl, lathe, polyTube, rbox } from './shapes';

/**
 * Parametric furniture. Every piece is composed of soft rounded primitives
 * and merged into the scene's assembler (one draw call per material).
 */
export interface Place {
  x: number;
  y: number;
  z: number;
  ry?: number;
}

export class Piece {
  private base: Matrix4;
  private a: Assembler;
  constructor(a: Assembler, p: Place) {
    this.a = a;
    this.base = composeTRS(p.x, p.y, p.z, 0, p.ry ?? 0, 0);
  }
  add(g: BufferGeometry, m: Material, x: number, y: number, z: number, o: { rx?: number; ry?: number; rz?: number; world?: boolean; cast?: boolean } = {}) {
    const mat = this.base.clone().multiply(composeTRS(x, y, z, o.rx ?? 0, o.ry ?? 0, o.rz ?? 0));
    this.a.add(g, m, mat, { worldUV: o.world ?? true, castShadow: o.cast ?? true });
    return this;
  }
  point(x: number, y: number, z: number) {
    return new Vector3(x, y, z).applyMatrix4(this.base);
  }
}

export function sofa(
  a: Assembler,
  p: Place,
  o: { w: number; d?: number; fabric: Material; base?: Material; legs?: Material; back?: boolean; arms?: boolean; seats?: number },
) {
  const f = new Piece(a, p);
  const d = o.d ?? 1.0;
  const seatH = 0.42;
  const w = o.w;
  if (o.base) f.add(rbox(w - 0.04, 0.12, d - 0.06, 0.03), o.base, 0, 0.08, 0);
  // plinth / frame
  f.add(rbox(w, 0.22, d, 0.06), o.fabric, 0, 0.22, 0);
  // seat cushions
  const n = o.seats ?? Math.max(1, Math.round(w / 0.95));
  const cw = (w - (o.arms === false ? 0.04 : 0.36)) / n;
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * cw) / 2 + i * cw;
    f.add(cushion(cw - 0.02, 0.16, d - 0.28, 0.07, 0.02), o.fabric, x, seatH - 0.01, 0.1);
  }
  if (o.back !== false) {
    f.add(rbox(w, 0.42, 0.2, 0.08), o.fabric, 0, 0.53, -d / 2 + 0.1);
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) * cw) / 2 + i * cw;
      f.add(cushion(cw - 0.03, 0.38, 0.18, 0.08, 0.03), o.fabric, x, 0.64, -d / 2 + 0.26, { rx: -0.14 });
    }
  }
  if (o.arms !== false) {
    for (const s of [-1, 1]) f.add(rbox(0.18, 0.5, d, 0.07), o.fabric, s * (w / 2 - 0.09), 0.4, 0);
  }
  if (o.legs) for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.add(cyl(0.02, 0.018, 0.08, 10), o.legs, sx * (w / 2 - 0.1), 0.04, sz * (d / 2 - 0.1));
  // throw pillows
  f.add(cushion(0.42, 0.14, 0.42, 0.06, 0.03), o.fabric, -w / 2 + 0.5, 0.62, -d / 2 + 0.42, { rx: -1.2, rz: 0.1 });
}

export function armchair(a: Assembler, p: Place, o: { fabric: Material; frame: Material }) {
  const f = new Piece(a, p);
  // sculpted wooden frame
  for (const s of [-1, 1]) {
    f.add(rbox(0.06, 0.55, 0.78, 0.025), o.frame, s * 0.38, 0.33, 0, { rx: 0.05 });
    f.add(rbox(0.07, 0.04, 0.7, 0.02), o.frame, s * 0.38, 0.6, 0.02);
  }
  f.add(rbox(0.72, 0.05, 0.05, 0.02), o.frame, 0, 0.18, 0.34);
  f.add(cushion(0.7, 0.14, 0.7, 0.06, 0.02), o.fabric, 0, 0.36, 0.02);
  f.add(cushion(0.68, 0.46, 0.14, 0.06, 0.03), o.fabric, 0, 0.66, -0.33, { rx: -0.22 });
}

export function coffeeTableRound(a: Assembler, p: Place, o: { top: Material; base: Material; r?: number }) {
  const f = new Piece(a, p);
  const r = o.r ?? 0.6;
  f.add(cyl(r, r, 0.06, 64), o.top, 0, 0.36, 0);
  f.add(cyl(r * 0.45, r * 0.55, 0.33, 48), o.base, 0, 0.165, 0);
}

export function coffeeTableBlock(a: Assembler, p: Place, o: { mat: Material; w: number; d: number; h?: number }) {
  const f = new Piece(a, p);
  f.add(rbox(o.w, o.h ?? 0.34, o.d, 0.015), o.mat, 0, (o.h ?? 0.34) / 2, 0);
}

export function sideTable(a: Assembler, p: Place, o: { top: Material; leg: Material }) {
  const f = new Piece(a, p);
  f.add(cyl(0.24, 0.24, 0.025, 40), o.top, 0, 0.52, 0);
  f.add(cyl(0.02, 0.02, 0.5, 12), o.leg, 0, 0.26, 0);
  f.add(cyl(0.18, 0.2, 0.02, 40), o.leg, 0, 0.01, 0);
}

export function floorLamp(a: Assembler, p: Place, o: { metal: Material; shade: Material; h?: number }) {
  const f = new Piece(a, p);
  const h = o.h ?? 1.6;
  f.add(cyl(0.16, 0.18, 0.025, 32), o.metal, 0, 0.012, 0);
  f.add(cyl(0.012, 0.012, h, 10), o.metal, 0, h / 2, 0);
  f.add(cyl(0.2, 0.24, 0.3, 40, true), o.shade, 0, h - 0.05, 0, { cast: false });
}

export function tableLamp(a: Assembler, p: Place, o: { base: Material; shade: Material }) {
  const f = new Piece(a, p);
  f.add(lathe([[0, 0], [0.07, 0], [0.09, 0.08], [0.075, 0.22], [0.02, 0.3], [0.012, 0.36]], 32), o.base, 0, 0, 0);
  f.add(cyl(0.13, 0.17, 0.22, 40, true), o.shade, 0, 0.44, 0, { cast: false });
}

export function pendant(a: Assembler, p: Place, o: { metal: Material; glow: Material; drop: number; r?: number }) {
  const f = new Piece(a, p);
  const r = o.r ?? 0.12;
  f.add(cyl(0.004, 0.004, o.drop, 6), o.metal, 0, -o.drop / 2, 0, { cast: false });
  f.add(lathe([[0.01, 0], [r * 0.4, -0.02], [r, -0.22], [r * 0.98, -0.24]], 32), o.metal, 0, -o.drop, 0, { cast: false });
  f.add(cyl(r * 0.9, r * 0.9, 0.01, 24), o.glow, 0, -o.drop - 0.235, 0, { cast: false });
}

export function stool(a: Assembler, p: Place, o: { seat: Material; frame: Material }) {
  const f = new Piece(a, p);
  f.add(cushion(0.4, 0.07, 0.38, 0.03, 0.01), o.seat, 0, 0.72, 0);
  for (const sx of [-1, 1]) {
    f.add(rbox(0.03, 0.72, 0.03, 0.01), o.frame, sx * 0.16, 0.36, -0.15, { rz: sx * 0.05 });
    f.add(rbox(0.03, 0.72, 0.03, 0.01), o.frame, sx * 0.16, 0.36, 0.15, { rz: sx * 0.05 });
  }
  f.add(rbox(0.34, 0.02, 0.02, 0.008), o.frame, 0, 0.28, 0.15);
  f.add(rbox(0.28, 0.25, 0.04, 0.02), o.seat, 0, 0.88, -0.17, { rx: -0.1 });
}

export function lounger(a: Assembler, p: Place, o: { frame: Material; cushion: Material }) {
  const f = new Piece(a, p);
  f.add(rbox(0.72, 0.08, 1.9, 0.03), o.frame, 0, 0.3, 0);
  for (const sz of [-0.85, 0.85]) for (const sx of [-0.32, 0.32]) f.add(rbox(0.05, 0.28, 0.05, 0.01), o.frame, sx, 0.14, sz);
  f.add(cushion(0.66, 0.08, 1.3, 0.035, 0.015), o.cushion, 0, 0.38, 0.28);
  f.add(cushion(0.66, 0.08, 0.62, 0.035, 0.015), o.cushion, 0, 0.55, -0.68, { rx: 0.62 });
  f.add(cushion(0.4, 0.1, 0.22, 0.05, 0.02), o.cushion, 0, 0.78, -0.85, { rx: 0.62 });
}

export function umbrella(a: Assembler, p: Place, o: { pole: Material; canopy: Material; base: Material }) {
  const f = new Piece(a, p);
  f.add(rbox(0.5, 0.12, 0.5, 0.03), o.base, 0, 0.06, 0);
  f.add(cyl(0.025, 0.025, 2.5, 10), o.pole, 0, 1.25, 0);
  // square canopy: 4 sloping panels
  const c = lathe([[0.02, 2.55], [1.6, 2.25], [1.62, 2.18]], 4, Math.PI / 4);
  f.add(c, o.canopy, 0, 0, 0, { world: false, cast: true });
}

export function planter(a: Assembler, p: Place, o: { mat: Material; soil: Material; w: number; d: number; h: number; round?: boolean }) {
  const f = new Piece(a, p);
  if (o.round) {
    f.add(lathe([[0, 0], [o.w * 0.42, 0], [o.w * 0.5, o.h * 0.6], [o.w * 0.5, o.h], [o.w * 0.46, o.h], [o.w * 0.44, o.h * 0.94]], 48), o.mat, 0, 0, 0);
    f.add(cyl(o.w * 0.45, o.w * 0.45, 0.02, 32), o.soil, 0, o.h * 0.92, 0);
  } else {
    f.add(rbox(o.w, o.h, o.d, 0.02), o.mat, 0, o.h / 2, 0);
    f.add(rbox(o.w - 0.1, 0.02, o.d - 0.1, 0.005), o.soil, 0, o.h - 0.04, 0);
  }
}

export function bookStack(a: Assembler, p: Place, o: { mat: Material; n?: number }) {
  const f = new Piece(a, p);
  let y = 0;
  const n = o.n ?? 3;
  for (let i = 0; i < n; i++) {
    const h = 0.025 + (i % 2) * 0.012;
    f.add(rbox(0.3 - i * 0.03, h, 0.22 - i * 0.015, 0.004), o.mat, (i % 2) * 0.01, y + h / 2, 0, { ry: (i - 1) * 0.08 });
    y += h;
  }
}

export function vase(a: Assembler, p: Place, o: { mat: Material; h?: number; r?: number }) {
  const f = new Piece(a, p);
  const h = o.h ?? 0.45;
  const r = o.r ?? 0.12;
  f.add(
    lathe([[0, 0], [r * 0.6, 0], [r, h * 0.35], [r * 0.9, h * 0.7], [r * 0.45, h * 0.92], [r * 0.5, h], [r * 0.44, h]], 40),
    o.mat,
    0,
    0,
    0,
  );
}

/** Polished bronze sculpture on a stone plinth. */
export function sculpture(a: Assembler, p: Place, o: { plinth: Material; metal: Material; scale?: number }) {
  const f = new Piece(a, p);
  const s = o.scale ?? 1;
  f.add(rbox(1.0 * s, 1.0 * s, 1.0 * s, 0.01), o.plinth, 0, 0.5 * s, 0);
  const k = new TorusKnotGeometry(0.42 * s, 0.07 * s, 220, 24, 2, 3);
  f.add(k, o.metal, 0, 1.0 * s + 0.62 * s, 0, { rx: 0.4, world: false });
}

/** Handrail / thin tube helper. */
export function rail(a: Assembler, pts: Vector3[], r: number, m: Material) {
  a.add(polyTube(pts, r, 8), m);
}
