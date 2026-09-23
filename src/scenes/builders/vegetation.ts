import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, mulberry32 } from '../../utils/noise';

/** paint a geometry with a colour (+ per-vertex jitter) */
export function paint(g: BufferGeometry, color: Color, jitter = 0, seed = 1) {
  const rnd = mulberry32(seed);
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = 1 + (rnd() - 0.5) * jitter;
    c[i * 3] = color.r * k;
    c[i * 3 + 1] = color.g * k;
    c[i * 3 + 2] = color.b * k;
  }
  g.setAttribute('color', new Float32BufferAttribute(c, 3));
  return g;
}

/** lumpy blob for canopies */
export function blob(radius: number, detail: number, sx: number, sy: number, sz: number, seed: number, lump = 0.28) {
  const g = new IcosahedronGeometry(radius, detail);
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * 1.7 + seed, v.y * 1.7 + v.z * 1.3, 3);
    v.multiplyScalar(1 + n * lump);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function strip(g: BufferGeometry) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') out.deleteAttribute(k);
  return out;
}

/** Stone pine (Pinus pinea): tall leaning trunk, flat umbrella crown. */
export function stonePineGeometry(seed = 3) {
  const rnd = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const trunkH = 7;
  const lean = 0.35;
  const trunk = new CylinderGeometry(0.16, 0.3, trunkH, 7, 4);
  trunk.translate(0, trunkH / 2, 0);
  const tp = trunk.getAttribute('position');
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + Math.pow(y / trunkH, 1.6) * lean * trunkH * 0.25);
  }
  trunk.computeVertexNormals();
  parts.push(paint(trunk, new Color('#5a4535'), 0.2, seed));
  const crownY = trunkH + 0.6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd();
    const r = i === 0 ? 0 : 1.8 + rnd() * 1.2;
    const b = blob(1.9 + rnd() * 0.9, 1, 1.35, 0.42, 1.35, seed + i * 7);
    b.translate(Math.cos(a) * r + lean * 1.6, crownY + rnd() * 0.5 + (i === 0 ? 0.6 : 0), Math.sin(a) * r);
    parts.push(paint(b, new Color('#2f4424').offsetHSL((rnd() - 0.5) * 0.02, 0, (rnd() - 0.5) * 0.05), 0.35, seed + i));
  }
  return mergeGeometries(parts.map(strip), false)!;
}

/** Italian cypress: dark spindle. */
export function cypressGeometry(seed = 5) {
  const pts: Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const r = Math.sin(Math.pow(t, 0.75) * Math.PI) * 0.85 * (1 - t * 0.35) + 0.02;
    pts.push(new Vector2(r, t * 10));
  }
  const g = new LatheGeometry(pts, 9);
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * 2 + seed, v.y * 0.8 + v.z * 2, 3);
    const s = 1 + n * 0.3;
    pos.setXYZ(i, v.x * s, v.y, v.z * s);
  }
  g.computeVertexNormals();
  const trunk = new CylinderGeometry(0.08, 0.12, 0.8, 5);
  trunk.translate(0, 0.2, 0);
  return mergeGeometries(
    [strip(paint(g, new Color('#223320'), 0.3, seed)), strip(paint(trunk, new Color('#4a3a2c'), 0.1, seed))],
    false,
  )!;
}

/** Olive / maquis shrub: silvery clumps. */
export function shrubGeometry(seed = 9, color = '#5b6645') {
  const rnd = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const b = blob(0.9 + rnd() * 0.5, 1, 1.1, 0.8, 1.1, seed + i * 3, 0.35);
    b.translate((rnd() - 0.5) * 1.4, 0.6 + rnd() * 0.4, (rnd() - 0.5) * 1.4);
    parts.push(strip(paint(b, new Color(color).offsetHSL(0, 0, (rnd() - 0.5) * 0.06), 0.3, seed + i)));
  }
  return mergeGeometries(parts, false)!;
}

/** Date palm: ringed curved trunk and arching fronds with leaflets. */
export function palmGeometry(seed = 11, height = 9) {
  const rnd = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const bend = 0.8 + rnd() * 1.2;
  const trunk = new CylinderGeometry(0.22, 0.32, height, 9, 18);
  trunk.translate(0, height / 2, 0);
  const tp = trunk.getAttribute('position');
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const t = y / height;
    const ring = 1 + 0.06 * Math.sin(y * 9);
    tp.setXYZ(i, tp.getX(i) * ring + Math.pow(t, 2) * bend, y, tp.getZ(i) * ring);
  }
  trunk.computeVertexNormals();
  parts.push(strip(paint(trunk, new Color('#7a6a58'), 0.15, seed)));
  const top = new Vector3(bend, height, 0);
  const fronds = 16;
  const leaflet = new Float32Array(0);
  void leaflet;
  for (let f = 0; f < fronds; f++) {
    const az = (f / fronds) * Math.PI * 2 + rnd() * 0.3;
    const lift = 0.3 + rnd() * 0.5 - (f % 3) * 0.25;
    const len = 3.6 + rnd() * 1.2;
    const verts: number[] = [];
    const seg = 14;
    const dir = new Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new Vector3(-dir.z, 0, dir.x);
    const spine: Vector3[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const p = top.clone().addScaledVector(dir, t * len);
      p.y += Math.sin(t * Math.PI * 0.7) * lift * 1.6 - t * t * 1.8;
      spine.push(p);
    }
    for (let i = 0; i < seg; i++) {
      const t = i / seg;
      const a = spine[i];
      const b = spine[i + 1];
      const w = Math.sin(Math.min(1, t * 1.3 + 0.1) * Math.PI) * 0.75;
      for (const s of [-1, 1]) {
        const tip = a.clone().addScaledVector(side, s * w).add(new Vector3(0, -0.25 * w, 0)).addScaledVector(dir, 0.35);
        verts.push(a.x, a.y, a.z, b.x, b.y, b.z, tip.x, tip.y, tip.z);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    parts.push(paint(g, new Color('#3d5a2c').offsetHSL(0, 0, (rnd() - 0.5) * 0.06), 0.3, seed + f));
  }
  return mergeGeometries(parts.map(strip), false)!;
}

/** A leafy potted plant (olive tree / ficus) for interiors. */
export function indoorTreeGeometry(seed = 21, height = 2.6, leafColor = '#4d5d3a') {
  const rnd = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const m = new Matrix4();
  // branching trunk
  const trunk = new CylinderGeometry(0.035, 0.07, height * 0.62, 6, 6);
  trunk.translate(0, height * 0.31, 0);
  const tp = trunk.getAttribute('position');
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + Math.sin(y * 3 + seed) * 0.06);
  }
  parts.push(strip(paint(trunk, new Color('#5d4b3b'), 0.1, seed)));
  // leaves: small quads
  const leafVerts: number[] = [];
  const count = 900;
  const q = new Vector3();
  for (let i = 0; i < count; i++) {
    const c = new Vector3(
      (rnd() - 0.5) * 1.1,
      height * 0.55 + rnd() * height * 0.45,
      (rnd() - 0.5) * 1.1,
    );
    const cl = Math.floor(rnd() * 5);
    c.x += Math.cos(cl * 1.3) * 0.25;
    c.z += Math.sin(cl * 1.3) * 0.25;
    const a = rnd() * Math.PI * 2;
    const tilt = rnd() * 0.8;
    const L = 0.09 + rnd() * 0.05;
    const W = 0.022;
    m.makeRotationY(a).multiply(new Matrix4().makeRotationX(tilt - 0.4));
    const p0 = new Vector3(0, 0, 0);
    const p1 = new Vector3(W, 0.01, L * 0.5);
    const p2 = new Vector3(0, 0, L);
    const p3 = new Vector3(-W, 0.01, L * 0.5);
    for (const p of [p0, p1, p2, p0, p2, p3]) {
      q.copy(p).applyMatrix4(m).add(c);
      leafVerts.push(q.x, q.y, q.z);
    }
  }
  const lg = new BufferGeometry();
  lg.setAttribute('position', new Float32BufferAttribute(leafVerts, 3));
  lg.computeVertexNormals();
  parts.push(paint(lg, new Color(leafColor), 0.5, seed));
  return mergeGeometries(parts.map(strip), false)!;
}
