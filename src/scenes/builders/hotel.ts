import { Group, Mesh, PlaneGeometry, type ShaderMaterial, Vector3 } from 'three';
import { Assembler } from '../../engine/Assembler';
import type { Environments } from '../../engine/environments';
import { LOBBY } from '../../journey/layout';
import { createInteriorMaterial } from '../../materials/InteriorMaterial';
import type { Materials } from '../../materials/MaterialLibrary';
import { createPoolMaterial } from '../../materials/PoolMaterial';
import type { Textures } from '../../materials/textures';
import { mulberry32 } from '../../utils/noise';
import {
  armchair,
  bookStack,
  coffeeTableRound,
  floorLamp,
  lounger,
  planter,
  sculpture,
  sofa,
  umbrella,
  vase,
} from './furniture';
import { box, cyl, polyTube } from './shapes';
import { indoorTreeGeometry, palmGeometry, shrubGeometry } from './vegetation';

/** Box from min/max corners. */
export function bx(a: Assembler, m: import('three').Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cast = true) {
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  const d = Math.abs(z1 - z0);
  a.put(box(w, h, d), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, { worldUV: true, castShadow: cast });
}

export const GUEST_LEVELS = [39.2, 43.0, 46.8];
export const LEVEL_H = 3.8;
const WING_X0 = -30;
const WING_X1 = 56;

export function buildHotelExterior(M: Materials, env: Environments, tx: Textures) {
  const E = M.ext;
  const a = new Assembler();
  const root = new Group();
  root.name = 'hotel-exterior';
  const animated: { pools: ShaderMaterial[] } = { pools: [] };

  // ---------------------------------------------------------------- pool deck over the cliff
  const deckTop = 30;
  bx(a, E.limestone, -27, deckTop - 1.4, -14.6, 27, deckTop - 0.1, 0);
  // paving around the pool (pool: x ±16, z −12.6..−3.4)
  bx(a, E.paving, -27, deckTop - 0.1, -3.4, 27, deckTop, 0);
  bx(a, E.paving, -27, deckTop - 0.1, -12.6, -16, deckTop, -3.4);
  bx(a, E.paving, 16, deckTop - 0.1, -12.6, 27, deckTop, -3.4);
  // spill gutter below the vanishing edge
  bx(a, E.paving, -27, deckTop - 0.55, -14.6, 27, deckTop - 0.45, -12.6);
  bx(a, E.limestone, -27, deckTop - 0.55, -14.6, 27, deckTop - 0.05, -14.45);
  // pool basin
  bx(a, E.poolTile, -16, deckTop - 1.5, -12.6, 16, deckTop - 1.4, -3.4, false);
  bx(a, E.poolTile, -16, deckTop - 1.4, -3.5, 16, deckTop - 0.02, -3.4, false);
  bx(a, E.poolTile, -16.1, deckTop - 1.4, -12.6, -16, deckTop - 0.02, -3.4, false);
  bx(a, E.poolTile, 16, deckTop - 1.4, -12.6, 16.1, deckTop - 0.02, -3.4, false);
  bx(a, E.poolTile, -16, deckTop - 1.4, -12.62, 16, deckTop - 0.06, -12.52, false);
  const poolMat = createPoolMaterial(env.skyCube.texture, tx.waterNormal);
  animated.pools.push(poolMat);
  const water = new Mesh(new PlaneGeometry(32, 9.2), poolMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, deckTop - 0.05, -8);
  root.add(water);
  // sheet of water spilling over the edge
  const spill = new Mesh(new PlaneGeometry(32, 0.5), poolMat);
  spill.position.set(0, deckTop - 0.3, -12.64);
  spill.rotation.y = Math.PI;
  root.add(spill);

  // ---------------------------------------------------------------- lobby pavilion
  const L = LOBBY;
  bx(a, E.limestone, L.x0 - 0.6, L.floor - 0.3, L.z0, L.x0, L.ceiling, L.z1 + 0.6); // west wall
  bx(a, E.limestone, L.x1, L.floor - 0.3, L.z0, L.x1 + 0.6, L.ceiling, L.z1 + 0.6); // east wall
  // back wall with the elevator portal opening
  bx(a, E.limestone, L.x0, L.floor, L.z1 + 0.05, -1.5, L.ceiling, L.z1 + 0.6);
  bx(a, E.limestone, 1.5, L.floor, L.z1 + 0.05, L.x1, L.ceiling, L.z1 + 0.6);
  bx(a, E.limestone, -1.5, 33.6, L.z1 + 0.05, 1.5, L.ceiling, L.z1 + 0.6);
  // facade: glass + bronze fins + transom
  const glassPlane = new Mesh(new PlaneGeometry(L.x1 - L.x0, L.ceiling - L.floor), E.facadeGlass);
  glassPlane.position.set(0, (L.floor + L.ceiling) / 2, L.z0 + 0.02);
  glassPlane.renderOrder = 4;
  root.add(glassPlane);
  for (let x = L.x0 + 1.25; x < L.x1; x += 2.5) {
    bx(a, E.bronze, x - 0.035, L.floor, L.z0 - 0.42, x + 0.035, L.ceiling, L.z0 + 0.02);
  }
  bx(a, E.bronze, L.x0, 36.35, L.z0 - 0.12, L.x1, 36.42, L.z0 + 0.02);
  bx(a, E.bronze, L.x0, L.floor, L.z0 - 0.1, L.x1, L.floor + 0.08, L.z0 + 0.04);

  // ---------------------------------------------------------------- guest wing (3 levels)
  const rnd = mulberry32(5);
  GUEST_LEVELS.forEach((yf, li) => {
    // slab + balcony floor (the L1 slab doubles as the lobby roof)
    const zBack = li === 0 ? 21.6 : 4.2;
    bx(a, E.concrete, WING_X0, yf - 0.6, -0.9, WING_X1, yf, zBack);
    // soffit edge detail
    bx(a, E.concrete, WING_X0, yf - 0.66, -0.95, WING_X1, yf - 0.6, -0.75);
    // interior mapped glazing
    const w = WING_X1 - WING_X0;
    const room = new Vector3(4.3, LEVEL_H - 0.6, 6.5);
    const g = new Mesh(
      new PlaneGeometry(w, LEVEL_H - 0.6),
      createInteriorMaterial(env.skyCube.texture, new Vector3(WING_X0, yf, 2.2), room, li * 13.1 + 1),
    );
    g.position.set((WING_X0 + WING_X1) / 2, yf + (LEVEL_H - 0.6) / 2, 2.2);
    g.rotation.y = Math.PI;
    root.add(g);
    // balcony balustrade: glass + bronze rail
    const bal = new Mesh(new PlaneGeometry(w, 1.05), E.facadeGlass);
    bal.position.set((WING_X0 + WING_X1) / 2, yf + 0.52, -0.8);
    bal.renderOrder = 4;
    root.add(bal);
    a.add(polyTube([new Vector3(WING_X0, yf + 1.06, -0.8), new Vector3(WING_X1, yf + 1.06, -0.8)], 0.028, 8), E.bronze);
    // privacy fins every two rooms
    for (let x = WING_X0; x <= WING_X1 + 0.01; x += 8.6) {
      bx(a, E.limestone, x - 0.16, yf, -0.9, x + 0.16, yf + LEVEL_H - 0.6, 2.3);
    }
    // planters with cascading greenery
    for (let x = WING_X0 + 2.2; x < WING_X1 - 1; x += 4.3) {
      if (rnd() < 0.62) continue;
      bx(a, E.concrete, x - 1.4, yf, -0.7, x + 1.4, yf + 0.45, -0.1);
      const sh = shrubGeometry(Math.floor(rnd() * 100), '#4f5f3a');
      a.put(sh, E.foliageNear, x, yf + 0.25, -0.4, { sx: 1.1, sy: 0.55, sz: 0.35, ry: rnd() * 6 });
    }
  });
  // wing ends and rear
  const top = GUEST_LEVELS[2] + LEVEL_H;
  bx(a, E.limestone, WING_X0 - 0.5, GUEST_LEVELS[0] - 0.6, -0.9, WING_X0, top, 24.5);
  bx(a, E.limestone, WING_X1, GUEST_LEVELS[0] - 0.6, -0.9, WING_X1 + 0.5, top, 24.5);
  bx(a, E.limestone, WING_X0, GUEST_LEVELS[0] - 0.6, 24, WING_X1, top, 24.5);
  // penthouse terrace slab (roof of level 3) — the apartment sits on it
  bx(a, E.concrete, WING_X0, top - 0.6, -0.9, WING_X1, top - 0.1, 6.2);
  bx(a, E.paving, WING_X0, top - 0.1, -0.9, WING_X1, top, 6.2);
  // terrace balustrade
  const tb = new Mesh(new PlaneGeometry(WING_X1 - WING_X0, 1.1), E.facadeGlass);
  tb.position.set((WING_X0 + WING_X1) / 2, top + 0.55, -0.85);
  tb.renderOrder = 4;
  root.add(tb);
  a.add(polyTube([new Vector3(WING_X0, top + 1.1, -0.85), new Vector3(WING_X1, top + 1.1, -0.85)], 0.03, 8), E.bronze);
  // terrace plunge pool in front of the bedroom suite
  bx(a, E.poolTile, 30, top - 1.2, 0.2, 44, top - 1.1, 3.4, false);
  const ppMat = createPoolMaterial(env.skyCube.texture, tx.waterNormal, { depth: 1.0 });
  animated.pools.push(ppMat);
  const pp = new Mesh(new PlaneGeometry(14, 3.2), ppMat);
  pp.rotation.x = -Math.PI / 2;
  pp.position.set(37, top + 0.01, 1.8);
  root.add(pp);
  // cut the paving around the plunge pool (raised coping)
  bx(a, E.limestone, 29.8, top, 0.0, 44.2, top + 0.06, 0.2);
  bx(a, E.limestone, 29.8, top, 3.4, 44.2, top + 0.06, 3.6);
  // loungers on the terrace
  for (let i = 0; i < 3; i++) lounger(a, { x: 22.5 + i * 2.1, y: top, z: 2.4, ry: Math.PI }, { frame: E.teakExt, cushion: E.cushion });

  // ---------------------------------------------------------------- ground floor wings (spa / restaurant)
  bx(a, E.concrete, L.x1 + 0.6, 29.7, 3.5, WING_X1, 30.0, 22);
  const rest = new Mesh(
    new PlaneGeometry(WING_X1 - L.x1 - 0.6, 8.3),
    createInteriorMaterial(env.skyCube.texture, new Vector3(L.x1 + 0.6, 30, 4), new Vector3(5.2, 8.3, 9), 77),
  );
  rest.position.set((L.x1 + 0.6 + WING_X1) / 2, 30 + 4.15, 4);
  rest.rotation.y = Math.PI;
  root.add(rest);
  bx(a, E.limestone, WING_X0, 29.7, 3, L.x0 - 0.6, 38.6, 24);

  // ---------------------------------------------------------------- landscape on the deck
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = side * (20.5 + (i % 2) * 2.8);
      const z = -11 + Math.floor(i / 2) * 3.2;
      lounger(a, { x, y: deckTop, z, ry: side > 0 ? Math.PI / 2 : -Math.PI / 2 }, { frame: E.teakExt, cushion: E.cushion });
    }
    umbrella(a, { x: side * 21.9, y: deckTop, z: -9.4 }, { pole: E.bronze, canopy: E.umbrella, base: E.limestone });
  }
  // palms and olive trees
  const palmPos: Array<[number, number, number]> = [
    [-24.5, -1.8, 9.5],
    [-18.6, -1.2, 8.3],
    [24.2, -1.6, 10],
    [18.4, -1.0, 8.6],
    [-26, 4, 9],
    [26.5, 3.4, 10.5],
  ];
  palmPos.forEach(([x, z, h], i) => {
    const pg = palmGeometry(20 + i, h);
    a.put(pg, E.foliageNear, x, deckTop, z, { ry: i * 1.7 });
  });
  for (const [x, z] of [
    [-23.5, -6],
    [23.5, -6.5],
  ]) {
    planter(a, { x, y: deckTop, z }, { mat: E.limestone, soil: M.int.soil, w: 1.6, d: 1.6, h: 0.7 });
    a.put(indoorTreeGeometry(x * 3, 2.8, '#6c7a58'), E.foliageNear, x, deckTop + 0.65, z, { sx: 1.4, sy: 1.2, sz: 1.4 });
  }

  root.add(a.build('hotel'));
  return { root, animated };
}

// ====================================================================== LOBBY
export function buildLobby(M: Materials) {
  const I = M.int;
  const a = new Assembler();
  const root = new Group();
  root.name = 'lobby';
  const L = LOBBY;

  // floor & ceiling
  bx(a, I.marbleFloor, L.x0, L.floor - 0.3, L.z0, L.x1, L.floor, L.z1);
  bx(a, I.plaster, L.x0, L.ceiling - 0.06, L.z0 + 0.05, L.x1, L.ceiling, L.z1, false);
  // walnut slat ceiling feature
  for (let x = -8.5; x <= 8.5; x += 0.26) bx(a, I.walnut, x - 0.03, L.ceiling - 0.34, 3, x + 0.03, L.ceiling - 0.06, 18, false);
  // back wall cladding (travertine) around the bronze elevator portal
  bx(a, I.travertine, L.x0, L.floor, L.z1 - 0.12, -1.5, L.ceiling, L.z1);
  bx(a, I.travertine, 1.5, L.floor, L.z1 - 0.12, L.x1, L.ceiling, L.z1);
  bx(a, I.travertine, -1.5, 33.6, L.z1 - 0.12, 1.5, L.ceiling, L.z1);
  // portal: bronze frame with the opening (x ±0.7, h 2.5)
  bx(a, I.elevatorBronze, -1.5, L.floor, L.z1 - 0.1, -0.7, 33.6, L.z1 + 0.05);
  bx(a, I.elevatorBronze, 0.7, L.floor, L.z1 - 0.1, 1.5, 33.6, L.z1 + 0.05);
  bx(a, I.elevatorBronze, -0.7, L.floor + 2.5, L.z1 - 0.1, 0.7, 33.6, L.z1 + 0.05);
  // light slots flanking the portal
  for (const s of [-1, 1]) bx(a, I.ledWarm, s * 1.62 - 0.02, L.floor + 0.2, L.z1 - 0.125, s * 1.62 + 0.02, 37.8, L.z1 - 0.11, false);
  // floor indicator plaque above the portal
  bx(a, I.brass, -0.35, 33.75, L.z1 - 0.14, 0.35, 33.85, L.z1 - 0.1);

  // side walls: oak slat screens over limestone
  for (const s of [-1, 1]) {
    const xw = s > 0 ? L.x1 : L.x0;
    bx(a, I.plasterWarm, Math.min(xw, xw - s * 0.05), L.floor, L.z0 + 0.5, Math.max(xw, xw - s * 0.05), L.ceiling, L.z1 - 0.1, false);
    for (let z = L.z0 + 1.0; z < L.z1 - 0.5; z += 0.22) {
      const x = xw - s * 0.35;
      bx(a, I.oak, x - 0.03, L.floor, z - 0.05, x + 0.03, L.ceiling - 0.4, z + 0.05);
    }
    bx(a, I.ledSoft, xw - s * 0.2 - 0.02, L.ceiling - 0.42, L.z0 + 1, xw - s * 0.2 + 0.02, L.ceiling - 0.4, L.z1 - 0.5, false);
  }

  // columns
  for (const x of [-5.5, 5.5]) for (const z of [5.5, 15.5]) a.put(cyl(0.34, 0.34, L.ceiling - L.floor, 40), I.plaster, x, (L.floor + L.ceiling) / 2, z, { worldUV: true });

  // reception: monolithic dark marble with a brass line, feature wall of fluted walnut
  bx(a, I.marbleDark, -12.2, L.floor, 12.2, -6.8, L.floor + 1.08, 13.3);
  bx(a, I.brass, -12.2, L.floor + 0.08, 12.18, -6.8, L.floor + 0.1, 12.21);
  bx(a, I.walnut, -12.25, L.floor + 1.08, 12.15, -6.75, L.floor + 1.13, 13.4);
  for (let x = -13.5; x <= -5.5; x += 0.14) {
    a.put(cyl(0.06, 0.06, 5.2, 12), I.walnut, x, L.floor + 2.6, 18.95, { worldUV: true });
  }
  bx(a, I.walnut, -13.7, L.floor, 18.9, -5.3, L.floor + 0.1, 19.2);
  bx(a, I.brass, -10.4, L.floor + 3.1, 18.8, -8.6, L.floor + 3.14, 18.86); // logo bar
  vase(a, { x: -11.4, y: L.floor + 1.13, z: 12.7 }, { mat: I.ceramic, h: 0.5 });
  bookStack(a, { x: -7.6, y: L.floor + 1.13, z: 12.8, ry: 0.3 }, { mat: I.books });
  // linear pendant over the desk
  bx(a, I.bronzeDark, -12, L.floor + 3.2, 12.66, -7, L.floor + 3.26, 12.84, false);
  bx(a, I.ledWarm, -11.9, L.floor + 3.19, 12.7, -7.1, L.floor + 3.2, 12.8, false);
  for (const x of [-11.5, -7.5]) a.put(cyl(0.004, 0.004, L.ceiling - L.floor - 3.26, 6), I.bronzeDark, x, (L.floor + 3.26 + L.ceiling) / 2, 12.75, { castShadow: false });

  // sculpture in the light
  sculpture(a, { x: 7.2, y: L.floor, z: 9.2, ry: 0.6 }, { plinth: I.travertine, metal: I.chrome, scale: 1.1 });

  // lounge
  const rugY = L.floor + 0.012;
  const rug = new Mesh(new PlaneGeometry(6.2, 4.6), I.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(12.4, rugY, 16);
  rug.receiveShadow = true;
  root.add(rug);
  sofa(a, { x: 12.4, y: L.floor, z: 14.3, ry: 0 }, { w: 3.0, fabric: I.boucle, legs: I.bronzeDark });
  sofa(a, { x: 12.4, y: L.floor, z: 17.8, ry: Math.PI }, { w: 3.0, fabric: I.boucle, legs: I.bronzeDark });
  coffeeTableRound(a, { x: 12.4, y: L.floor, z: 16.05 }, { top: I.travertine, base: I.travertine, r: 0.62 });
  armchair(a, { x: 15.3, y: L.floor, z: 16.0, ry: -Math.PI / 2 }, { fabric: I.leatherCognac, frame: I.walnut });
  floorLamp(a, { x: 15.6, y: L.floor, z: 18.6 }, { metal: I.brass, shade: I.lampShade });
  bookStack(a, { x: 12.3, y: L.floor + 0.39, z: 16.1, ry: 0.4 }, { mat: I.books, n: 4 });
  vase(a, { x: 12.7, y: L.floor + 0.39, z: 15.9 }, { mat: I.darkCeramic, h: 0.32, r: 0.1 });

  // trees in stone planters
  for (const [x, z, s] of [
    [-15.5, 5, 1.2],
    [15.8, 4.6, 1.1],
    [-17.6, 19.5, 1.3],
  ] as Array<[number, number, number]>) {
    planter(a, { x, y: L.floor, z }, { mat: I.travertine, soil: I.soil, w: 1.5, d: 1.5, h: 0.7, round: true });
    a.put(indoorTreeGeometry(Math.floor(x * 7), 3.4, '#51603f'), I.leaf, x, L.floor + 0.6, z, { sx: s, sy: s, sz: s });
  }

  // chandelier: a cloud of luminous rods
  const rnd = mulberry32(9);
  for (let i = 0; i < 90; i++) {
    const r = Math.sqrt(rnd()) * 2.6;
    const t = rnd() * Math.PI * 2;
    const x = Math.cos(t) * r;
    const z = 10 + Math.sin(t) * r * 0.8;
    const len = 0.5 + (1 - r / 2.6) * 1.6 + rnd() * 0.4;
    const yTop = L.ceiling - 0.35 - (1 - r / 2.6) * 1.8;
    a.put(cyl(0.004, 0.004, L.ceiling - yTop, 5), I.brass, x, (yTop + L.ceiling) / 2, z, { castShadow: false });
    a.put(cyl(0.022, 0.022, len, 10), I.interiorGlass, x, yTop - len / 2, z, { castShadow: false });
    a.put(cyl(0.012, 0.012, len * 0.96, 6), I.ledWarm, x, yTop - len / 2, z, { castShadow: false });
  }

  root.add(a.build('lobby'));
  return { root };
}

