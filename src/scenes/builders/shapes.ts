import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
export const rbox = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
export const cyl = (rt: number, rb: number, h: number, seg = 32, open = false) =>
  new CylinderGeometry(rt, rb, h, seg, 1, open);

export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): Shape {
  const s = new Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function circlePath(r: number, cx = 0, cy = 0, seg = 48, asPath = true): Path | Shape {
  const p = asPath ? new Path() : new Shape();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  return p;
}

/** Extrude a shape along +Z (depth), with an optional rounded bevel. */
export function extrude(shape: Shape | Shape[], depth: number, bevel = 0, bevelSegments = 3, curveSegments = 24) {
  return new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  });
}

/** A lathe from [radius, height] pairs, revolved around +Y. */
export function lathe(profile: Array<[number, number]>, seg = 64, phiStart = 0, phiLength = Math.PI * 2) {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(0, r), y)),
    seg,
    phiStart,
    phiLength,
  );
}

/** Flat ring (annulus) lying in XZ plane, facing +Y. */
export function ring(inner: number, outer: number, seg = 64) {
  const s = circlePath(outer, 0, 0, seg, false) as Shape;
  s.holes.push(circlePath(inner, 0, 0, seg, true) as Path);
  const g = new ShapeGeometry(s, seg);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Tube along a polyline of points (simple, no Frenet twist issues for gentle curves). */
export function polyTube(points: Vector3[], radius: number, radial = 8) {
  const verts: number[] = [];
  const idx: number[] = [];
  const n = points.length;
  const up = new Vector3(0, 1, 0);
  const t = new Vector3();
  const b = new Vector3();
  const nn = new Vector3();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    t.subVectors(next, prev).normalize();
    const ref = Math.abs(t.dot(up)) > 0.95 ? new Vector3(1, 0, 0) : up;
    b.crossVectors(t, ref).normalize();
    nn.crossVectors(b, t).normalize();
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      verts.push(p.x + (b.x * dx + nn.x * dy) * radius, p.y + (b.y * dx + nn.y * dy) * radius, p.z + (b.z * dx + nn.z * dy) * radius);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const c = a + radial + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Soft cushion: rounded box whose faces bulge slightly. */
export function cushion(w: number, h: number, d: number, r: number, bulge = 0.02) {
  const g = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, h / 2 - 1e-3, w / 2 - 1e-3, d / 2 - 1e-3));
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const fx = 1 - Math.pow(Math.abs(v.x) / (w / 2), 2);
    const fz = 1 - Math.pow(Math.abs(v.z) / (d / 2), 2);
    const k = Math.max(0, fx) * Math.max(0, fz);
    v.y += Math.sign(v.y) * k * bulge;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Plane made of a grid (for cloth that animates in a shader). */
export function gridPlane(w: number, h: number, sx: number, sy: number) {
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= sy; j++) {
    for (let i = 0; i <= sx; i++) {
      const u = i / sx;
      const v = j / sy;
      verts.push((u - 0.5) * w, v * h, 0);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < sy; j++) {
    for (let i = 0; i < sx; i++) {
      const a = j * (sx + 1) + i;
      const b = a + 1;
      const c = a + sx + 1;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function setUV(g: BufferGeometry, fn: (p: Vector3) => [number, number]) {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const [a, b] = fn(v);
    uv[i * 2] = a;
    uv[i * 2 + 1] = b;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}
