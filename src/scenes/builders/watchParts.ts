import {
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Horological geometry, in millimetres.
 * Wheels are built from their tooth count and module so that meshing pairs
 * share the same pitch and really roll against each other.
 */

export interface WheelSpec {
  teeth: number;
  module: number;
}
export const pitchRadius = (w: WheelSpec) => (w.module * w.teeth) / 2;

function circle(p: Path | Shape, cx: number, cy: number, r: number, seg = 48, reverse = false) {
  for (let i = 0; i <= seg; i++) {
    const a = ((reverse ? -1 : 1) * i * Math.PI * 2) / seg;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  return p;
}

/** Toothed outline + hub hole + curved spoke windows. */
export function gearShape(
  teeth: number,
  module: number,
  opts: { spokes?: number; rim?: number; hub?: number; hole?: number; club?: boolean; sweep?: number; pinion?: boolean } = {},
) {
  const R = (module * teeth) / 2;
  const add = module * (opts.pinion ? 0.9 : 1.0);
  const ded = module * (opts.pinion ? 1.0 : 1.25);
  const rTip = R + add;
  const rRoot = R - ded;
  const s = new Shape();
  const pts: Vector2[] = [];
  const profile: Array<[number, number]> = opts.club
    ? [
        [0.0, rRoot],
        [0.06, rRoot],
        [0.1, rTip],
        [0.3, rTip],
        [0.36, rTip - module * 0.4],
        [0.62, rRoot + module * 0.2],
        [0.72, rRoot],
      ]
    : opts.pinion
      ? [
          [0.0, rRoot],
          [0.12, rRoot],
          [0.2, R],
          [0.3, rTip * 0.98],
          [0.4, rTip],
          [0.5, rTip * 0.98],
          [0.6, R],
          [0.68, rRoot],
        ]
      : [
          [0.0, rRoot],
          [0.18, rRoot],
          [0.26, R],
          [0.32, rTip * 0.985],
          [0.4, rTip],
          [0.48, rTip * 0.985],
          [0.54, R],
          [0.62, rRoot],
        ];
  for (let i = 0; i < teeth; i++) {
    for (const [f, r] of profile) {
      const a = ((i + f) / teeth) * Math.PI * 2;
      pts.push(new Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
  }
  s.setFromPoints(pts);
  if (opts.hole) s.holes.push(circle(new Path(), 0, 0, opts.hole, 24, true) as Path);
  const spokes = opts.spokes ?? 0;
  if (spokes > 0) {
    const ri = rRoot - (opts.rim ?? module * 3);
    const rh = opts.hub ?? R * 0.28;
    const span = (Math.PI * 2) / spokes;
    const spokeW = Math.max(0.18, R * 0.07) / ((ri + rh) / 2);
    const sweep = opts.sweep ?? 0.25;
    for (let k = 0; k < spokes; k++) {
      const a0 = k * span + spokeW / 2;
      const a1 = (k + 1) * span - spokeW / 2;
      const hole = new Path();
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        const x = Math.cos(a) * ri;
        const y = Math.sin(a) * ri;
        if (i === 0) hole.moveTo(x, y);
        else hole.lineTo(x, y);
      }
      for (let i = n; i >= 0; i--) {
        const a = a0 + ((a1 - a0) * i) / n + sweep;
        hole.lineTo(Math.cos(a) * rh, Math.sin(a) * rh);
      }
      hole.closePath();
      s.holes.push(hole);
    }
  }
  return s;
}

/** Extrude a flat outline into a part lying in XZ with thickness along +Y. */
export function flatPart(shape: Shape, thickness: number, bevel = 0.04, tile = 0) {
  const g = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 32,
  });
  g.rotateX(-Math.PI / 2); // z(extrusion) → +y, shape y → −z
  if (tile > 0) {
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  }
  return g;
}

/** Convex hull of sampled circles → organic bridge outline. */
export function hullShape(circles: Array<[number, number, number]>, holes: Array<[number, number, number]> = []) {
  const pts: Array<[number, number]> = [];
  for (const [x, y, r] of circles) {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
  }
  pts.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  const s = new Shape(hull.map(([x, y]) => new Vector2(x, y)));
  for (const [x, y, r] of holes) s.holes.push(circle(new Path(), x, y, r, 24, true) as Path);
  return s;
}

/** Faceted dauphine hand pointing to −Z, lying in XZ. */
export function dauphineHand(length: number, width: number, tail: number, ridge: number, thick = 0.12) {
  const b = length * 0.18; // widest point from the centre
  const T = new Vector3(0, 0, -length);
  const Lw = new Vector3(-width / 2, 0, -b);
  const Rw = new Vector3(width / 2, 0, -b);
  const Bk = new Vector3(0, 0, tail);
  const TR = new Vector3(0, ridge * 0.15, -length * 0.97);
  const MR = new Vector3(0, ridge, -b);
  const BR = new Vector3(0, ridge * 0.6, tail * 0.9);
  const tri: Vector3[] = [];
  const face = (a: Vector3, b2: Vector3, c: Vector3) => tri.push(a, b2, c);
  // four upper facets
  face(T, Lw, TR);
  face(TR, Lw, MR);
  face(T, TR, Rw);
  face(TR, MR, Rw);
  face(MR, Lw, Bk);
  face(MR, Bk, BR);
  face(MR, Rw, BR);
  face(BR, Rw, Bk);
  // underside
  const d = new Vector3(0, -thick, 0);
  const T2 = T.clone().add(d);
  const L2 = Lw.clone().add(d);
  const R2 = Rw.clone().add(d);
  const B2 = Bk.clone().add(d);
  face(T2, R2, L2);
  face(L2, R2, B2);
  // thin sides
  const side = (a: Vector3, b2: Vector3, a2: Vector3, b3: Vector3) => {
    face(a, a2, b2);
    face(b2, a2, b3);
  };
  side(T, Lw, T2, L2);
  side(Lw, Bk, L2, B2);
  side(Bk, Rw, B2, R2);
  side(Rw, T, R2, T2);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(tri.flatMap((v) => [v.x, v.y, v.z]), 3));
  g.computeVertexNormals();
  return g;
}

/** Faceted applied index (baton with a roof ridge), radial along −Z. */
export function indexPrism(len: number, w: number, h: number) {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h * 0.55);
  s.lineTo(0, h);
  s.lineTo(-w / 2, h * 0.55);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

/** Archimedean spiral ribbon (mainspring / hairspring). */
export function spiralRibbon(r0: number, r1: number, turns: number, height: number, thickness: number, seg = 900) {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    const ri = r - thickness / 2;
    const ro = r + thickness / 2;
    verts.push(cx * ri, 0, cz * ri, cx * ro, 0, cz * ro, cx * ro, height, cz * ro, cx * ri, height, cz * ri);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 4;
    const b = a + 4;
    // inner, outer, top, bottom faces
    idx.push(a, a + 3, b, b, a + 3, b + 3);
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    idx.push(a + 3, a + 2, b + 3, b + 3, a + 2, b + 2);
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Knurled crown along +X. */
export function crownGeometry(r: number, len: number, ridges = 36) {
  const g = new CylinderGeometry(r, r, len, ridges * 4, 3, false);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const a = Math.atan2(z, x);
    const rr = Math.hypot(x, z);
    if (rr > r * 0.98 && Math.abs(y) < len / 2 - 0.25) {
      const k = 1 - 0.045 * Math.pow(Math.abs(Math.sin(a * ridges * 0.5)), 0.6);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** Fluted bezel ring around +Y. */
export function flutedBezel(rIn: number, rOut: number, yBase: number, yTop: number, flutes = 60) {
  const seg = flutes * 8;
  const prof: Array<[number, number]> = [
    [rIn, yBase],
    [rIn, yTop - 0.3],
    [rIn + 0.4, yTop],
    [rIn + (rOut - rIn) * 0.45, yTop - 0.05],
    [rOut - 0.35, yTop - 0.9],
    [rOut, yTop - 1.3],
    [rOut, yBase],
  ];
  const verts: number[] = [];
  const idx: number[] = [];
  const P = prof.length;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const flute = Math.pow(Math.abs(Math.cos(a * flutes * 0.5)), 0.5);
    for (let j = 0; j < P; j++) {
      let [r, y] = prof[j];
      if (j >= 2 && j <= 4) {
        const k = j === 3 ? 1 : 0.6;
        y -= (1 - flute) * 0.32 * k;
        r += (j === 4 ? -(1 - flute) * 0.12 : 0);
      }
      verts.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < P - 1; j++) {
      const a = i * P + j;
      const b = a + P;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Strap half: rounded-rectangle section swept along a path in the Y/Z plane (toward +Z). */
export function strapGeometry(path: Vector3[], width: (t: number) => number, thick: (t: number) => number, tip = true) {
  const K = 20;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const n = path.length;
  let len = 0;
  const acc: number[] = [0];
  for (let i = 1; i < n; i++) {
    len += path[i].distanceTo(path[i - 1]);
    acc.push(len);
  }
  for (let i = 0; i < n; i++) {
    const t = acc[i] / len;
    const p = path[i];
    const q = path[Math.min(n - 1, i + 1)];
    const o = path[Math.max(0, i - 1)];
    const tz = q.z - o.z;
    const ty = q.y - o.y;
    const tl = Math.hypot(tz, ty) || 1;
    const ny = tz / tl;
    const nz = -ty / tl;
    let w = width(t);
    if (tip) w *= Math.sqrt(Math.max(0, Math.min(1, (1 - t) * 14)));
    const th = thick(t);
    for (let k = 0; k <= K; k++) {
      const a = (k / K) * Math.PI * 2;
      const cx = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.35);
      const cy = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.35);
      const x = (cx * w) / 2;
      const off = (cy * th) / 2;
      verts.push(x, p.y + ny * off, p.z + nz * off);
      uvs.push(x / 40 + 0.5, acc[i] / 40);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < K; k++) {
      const a = i * (K + 1) + k;
      const b = a + K + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Dial printing: minute track, logo, legends. White on transparent. */
export function dialPrintTexture(size = 2048) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const cx = size / 2;
  const R = size / 2;
  g.clearRect(0, 0, size, size);
  g.translate(cx, cx);
  g.strokeStyle = 'rgba(240,236,228,0.95)';
  g.fillStyle = 'rgba(240,236,228,0.95)';
  // railway minute track
  g.lineWidth = size * 0.0012;
  g.beginPath();
  g.arc(0, 0, R * 0.955, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, R * 0.905, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    const major = i % 20 === 0;
    const mid = i % 4 === 0;
    const r0 = major ? R * 0.885 : mid ? R * 0.905 : R * 0.93;
    const r1 = R * 0.955;
    g.lineWidth = size * (major ? 0.004 : mid ? 0.0016 : 0.0008);
    g.beginPath();
    g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
    g.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
    g.stroke();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // logo under 12
  g.font = `400 ${Math.round(size * 0.052)}px "Cormorant Garamond", serif`;
  const logo = 'É L A N';
  g.fillText(logo, 0, -R * 0.42);
  g.font = `500 ${Math.round(size * 0.017)}px "Manrope", sans-serif`;
  g.fillText('G E N È V E', 0, -R * 0.33);
  // legends above 6
  g.font = `italic 300 ${Math.round(size * 0.03)}px "Cormorant Garamond", serif`;
  g.fillText('Automatique', 0, R * 0.34);
  g.font = `500 ${Math.round(size * 0.0145)}px "Manrope", sans-serif`;
  g.fillText('C A L I B R E   É - 0 1', 0, R * 0.42);
  g.font = `500 ${Math.round(size * 0.012)}px "Manrope", sans-serif`;
  g.fillText('S W I S S   M A D E', 0, R * 0.86);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Engraving along the rotor arc. */
export function rotorEngravingTexture(size = 1024) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  g.translate(size / 2, size / 2);
  g.fillStyle = 'rgba(70,46,18,0.85)';
  g.font = `500 ${Math.round(size * 0.034)}px "Manrope", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const text = 'ÉLAN  ·  CALIBRE É-01  ·  22K  ·  GENÈVE';
  const r = size * 0.36;
  const span = Math.PI * 0.8;
  const chars = text.split('');
  chars.forEach((ch, i) => {
    const a = -Math.PI / 2 - span / 2 + (span * (i + 0.5)) / chars.length + Math.PI;
    g.save();
    g.rotate(a + Math.PI / 2);
    g.translate(0, -r);
    g.fillText(ch, 0, 0);
    g.restore();
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function dateTexture(day: number) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#111';
  g.font = '500 78px "Manrope", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(day), 64, 68);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function mergeParts(list: BufferGeometry[]) {
  return mergeGeometries(list, false)!;
}
