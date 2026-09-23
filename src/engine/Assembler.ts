import {
  BufferAttribute,
  BufferGeometry,
  Group,
  type Material,
  Matrix4,
  Mesh,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface AddOptions {
  /** project UVs from assembly-space positions using the material's tile size */
  worldUV?: boolean;
  /** multiply existing UVs by 1/tile (keeps the geometry's own parameterisation) */
  scaleUV?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

const _n = new Vector3();
const _p = new Vector3();

/** Tri-planar UV projection baked into the geometry (dominant-axis). */
export function applyWorldUV(g: BufferGeometry, tile: number, offset = 0) {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  const s = 1 / tile;
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    const ax = Math.abs(_n.x);
    const ay = Math.abs(_n.y);
    const az = Math.abs(_n.z);
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = _p.x;
      v = _p.z;
    } else if (ax >= az) {
      u = _p.z;
      v = _p.y;
    } else {
      u = _p.x;
      v = _p.y;
    }
    uv[i * 2] = u * s + offset;
    uv[i * 2 + 1] = v * s + offset;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
}

export function scaleUV(g: BufferGeometry, su: number, sv = su) {
  const uv = g.getAttribute('uv');
  if (!uv) return g;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return g;
}

/** Normalise attributes so geometries can be merged together. */
export function normalizeGeometry(src: BufferGeometry, keepColor = false): BufferGeometry {
  const g = src;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    g.setAttribute('uv', new BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  }
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv' && !(keepColor && name === 'color')) {
      g.deleteAttribute(name);
    }
  }
  if (keepColor && !g.getAttribute('color')) {
    const c = new Float32Array(g.getAttribute('position').count * 3).fill(1);
    g.setAttribute('color', new BufferAttribute(c, 3));
  }
  if (!g.index) {
    const count = g.getAttribute('position').count;
    const idx = new (count > 65535 ? Uint32Array : Uint16Array)(count);
    for (let i = 0; i < count; i++) idx[i] = i;
    g.setIndex(new BufferAttribute(idx, 1));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

/**
 * Collects many small procedural pieces and merges them into one draw call
 * per material — the key to rendering whole buildings at a reasonable cost.
 */
export class Assembler {
  private buckets = new Map<string, { material: Material; geos: BufferGeometry[]; cast: boolean; receive: boolean }>();

  add(geometry: BufferGeometry, material: Material, matrix?: Matrix4, opts: AddOptions = {}) {
    const g = geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    const tile = (material.userData.tile as number | undefined) ?? 1;
    const keepColor = (material as Material & { vertexColors?: boolean }).vertexColors === true;
    normalizeGeometry(g, keepColor);
    if (opts.worldUV) applyWorldUV(g, tile);
    else if (opts.scaleUV) scaleUV(g, 1 / tile);
    const cast = opts.castShadow ?? true;
    const receive = opts.receiveShadow ?? true;
    const key = `${material.uuid}|${cast ? 1 : 0}${receive ? 1 : 0}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { material, geos: [], cast, receive };
      this.buckets.set(key, b);
    }
    b.geos.push(g);
    return this;
  }

  /** Convenience: add at position / rotation (Y·X·Z) / scale. */
  put(
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    opts: AddOptions & { ry?: number; rx?: number; rz?: number; sx?: number; sy?: number; sz?: number } = {},
  ) {
    const m = composeTRS(x, y, z, opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0, opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1);
    return this.add(geometry, material, m, opts);
  }

  build(name = 'assembly'): Group {
    const group = new Group();
    group.name = name;
    for (const b of this.buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new Mesh(merged, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.name = `${name}:${b.material.name || b.material.type}`;
      group.add(mesh);
      b.geos.forEach((g) => g.dispose());
    }
    this.buckets.clear();
    return group;
  }
}

const _r = new Matrix4();

export function composeTRS(
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): Matrix4 {
  const m = new Matrix4().makeRotationY(ry);
  if (rx) m.multiply(_r.makeRotationX(rx));
  if (rz) m.multiply(_r.makeRotationZ(rz));
  m.scale(new Vector3(sx, sy, sz));
  m.setPosition(x, y, z);
  return m;
}
