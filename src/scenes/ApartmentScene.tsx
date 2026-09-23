import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Group, Mesh, PlaneGeometry, Vector3 } from 'three';
import { useAssets } from '../engine/assets';
import { Assembler } from '../engine/Assembler';
import { createDust, createLightBeams } from '../effects/LightBeams';
import { journey } from '../journey/journeyState';
import { PENTHOUSE as P } from '../journey/layout';
import { createCurtainMaterial, createFireMaterial, SOFT_UNIFORMS } from '../materials/SoftMaterials';
import { bx } from './builders/hotel';
import {
  armchair,
  bookStack,
  coffeeTableBlock,
  floorLamp,
  pendant,
  planter,
  sideTable,
  sofa,
  stool,
  tableLamp,
  vase,
} from './builders/furniture';
import { cushion, cyl, gridPlane, lathe, polyTube } from './builders/shapes';
import { indoorTreeGeometry } from './builders/vegetation';
import { useVisibleRange } from './useVisibleRange';

/**
 * 02 — THE PENTHOUSE
 * Salon (linear fireplace, sheer curtains) → gallery corridor → kitchen →
 * bedroom → bathroom → the bay window that slides open onto the sea.
 */
const F = P.floor;
const C = P.ceiling;
const ZG = P.zGlass;
const ZB = P.zBack;

export function ApartmentScene() {
  const { mats, env, textures, quality } = useAssets();

  const built = useMemo(() => {
    const I = mats.int;
    const E = mats.ext;
    const a = new Assembler();
    const root = new Group();
    root.name = 'penthouse';

    // ---------------------------------------------------------------- shell
    bx(a, I.oak, P.x0, F - 0.2, ZG, 44, F, ZB);
    bx(a, I.stoneGrey, 44, F - 0.2, ZG, P.x1, F, ZB);
    bx(a, I.plaster, P.x0, C, ZG - 0.1, P.x1, C + 0.1, ZB, false);
    // roof with a deep overhang over the terrace + bronze fascia
    bx(a, E.concrete, P.x0 - 0.5, C + 0.1, 2.8, P.x1 + 0.5, C + 0.75, ZB + 0.6);
    bx(a, E.bronze, P.x0 - 0.5, C + 0.1, 2.72, P.x1 + 0.5, C + 0.75, 2.8);
    // end walls
    bx(a, E.limestone, P.x0 - 0.4, F - 0.2, ZG - 0.2, P.x0, C + 0.1, ZB + 0.6);
    bx(a, E.limestone, P.x1, F - 0.2, ZG - 0.2, P.x1 + 0.4, C + 0.1, ZB + 0.6);
    // back wall with the elevator portal
    bx(a, I.plaster, P.x0, F, ZB, -1.5, C, ZB + 0.6);
    bx(a, I.plaster, 1.5, F, ZB, P.x1, C, ZB + 0.6);
    bx(a, I.plaster, -1.5, F + 3.0, ZB, 1.5, C, ZB + 0.6);
    bx(a, I.elevatorBronze, -1.5, F, ZB - 0.1, -0.7, F + 3.0, ZB + 0.05);
    bx(a, I.elevatorBronze, 0.7, F, ZB - 0.1, 1.5, F + 3.0, ZB + 0.05);
    bx(a, I.elevatorBronze, -0.7, F + 2.5, ZB - 0.1, 0.7, F + 3.0, ZB + 0.05);
    // cove lights along the glazing and the back wall
    bx(a, I.ledWarm, P.x0 + 0.2, C - 0.03, ZG + 0.5, P.x1 - 0.2, C - 0.01, ZG + 0.56, false);
    bx(a, I.ledSoft, P.x0 + 0.2, C - 0.03, ZB - 0.4, P.x1 - 0.2, C - 0.01, ZB - 0.34, false);
    // skirting shadow gap
    bx(a, I.black, P.x0, F, ZB - 0.02, P.x1, F + 0.06, ZB, false);

    // glazing: floor-to-ceiling with slim bronze mullions
    // the bay window section is separate (it slides)
    const bayX0 = 44.6;
    const bayX1 = 48.6;
    const glassA = new Mesh(new PlaneGeometry(bayX0 - P.x0, C - F), I.interiorGlass);
    glassA.position.set((P.x0 + bayX0) / 2, (F + C) / 2, ZG);
    const glassB = new Mesh(new PlaneGeometry(P.x1 - bayX1, C - F), I.interiorGlass);
    glassB.position.set((bayX1 + P.x1) / 2, (F + C) / 2, ZG);
    glassA.renderOrder = glassB.renderOrder = 4;
    root.add(glassA, glassB);
    for (let x = P.x0 + 3; x < P.x1; x += 3) {
      if (x > bayX0 - 0.2 && x < bayX1 + 0.2) continue;
      bx(a, E.bronze, x - 0.025, F, ZG - 0.06, x + 0.025, C, ZG + 0.06);
    }
    bx(a, E.bronze, P.x0, F, ZG - 0.06, P.x1, F + 0.05, ZG + 0.06);
    // sliding leaves of the bay window, each with a bronze frame
    const leaf = (w: number) => {
      const g = new Group();
      const pane = new Mesh(new PlaneGeometry(w - 0.08, C - F - 0.1), I.interiorGlass);
      pane.renderOrder = 4;
      g.add(pane);
      const fa = new Assembler();
      bx(fa, E.bronze, -w / 2, -(C - F) / 2, -0.03, -w / 2 + 0.05, (C - F) / 2, 0.03);
      bx(fa, E.bronze, w / 2 - 0.05, -(C - F) / 2, -0.03, w / 2, (C - F) / 2, 0.03);
      bx(fa, E.bronze, -w / 2, -(C - F) / 2, -0.03, w / 2, -(C - F) / 2 + 0.05, 0.03);
      bx(fa, E.bronze, -w / 2, (C - F) / 2 - 0.05, -0.03, w / 2, (C - F) / 2, 0.03);
      g.add(fa.build('leaf'));
      return g;
    };
    const bayL = leaf(2.0);
    const bayR = leaf(2.0);
    bayL.position.set(45.6, (F + C) / 2, ZG + 0.05);
    bayR.position.set(47.6, (F + C) / 2, ZG - 0.05);
    root.add(bayL, bayR);

    // partitions with openings (z ranges are the openings)
    const part = (x: number, open0: number, open1: number, mat = I.plaster) => {
      bx(a, mat, x - 0.1, F, ZG + 0.3, x + 0.1, C, open0);
      bx(a, mat, x - 0.1, F, open1, x + 0.1, C, ZB);
      bx(a, mat, x - 0.1, F + 3.1, open0, x + 0.1, C, open1);
    };
    part(12, 15.6, 21.6);
    part(20, 15.6, 21.6);
    part(32, 15.0, 21.2);
    part(44, 13.4, 19.8, I.stoneGrey);
    // study behind the gallery wall (closed)
    bx(a, I.plaster, 12.1, F, 15.4, 19.9, C, 15.6);
    // corridor: lower walnut slat ceiling
    for (let x = 12.2; x < 19.9; x += 0.16) bx(a, I.walnut, x - 0.03, F + 3.1, 15.6, x + 0.03, F + 3.22, 21.8, false);
    bx(a, I.walnut, 12.1, F + 3.22, 15.6, 19.9, F + 3.26, 21.8, false);

    // ---------------------------------------------------------------- SALON (x −10 … 12)
    // fireplace wall: dark stone with a linear firebox
    bx(a, I.marbleDark, P.x0, F, 8.6, P.x0 + 0.35, C, 19.4);
    bx(a, I.black, P.x0 + 0.3, F + 0.45, 11.0, P.x0 + 0.36, F + 0.95, 17.0, false);
    bx(a, I.bronzeDark, P.x0 + 0.33, F + 0.42, 10.95, P.x0 + 0.4, F + 0.45, 17.05);
    const fire = new Mesh(new PlaneGeometry(5.9, 0.5), createFireMaterial());
    fire.position.set(P.x0 + 0.37, F + 0.71, 14);
    fire.rotation.y = Math.PI / 2;
    fire.renderOrder = 7;
    root.add(fire);
    // pebble bed in the firebox
    for (let i = 0; i < 40; i++) {
      a.put(cushion(0.08, 0.04, 0.07, 0.02, 0.005), I.pebbles, P.x0 + 0.34, F + 0.47, 11.1 + i * 0.147, { ry: i * 1.7, castShadow: false });
    }
    // art above the fireplace
    bx(a, I.canvasEdge, P.x0 + 0.35, F + 1.6, 12.6, P.x0 + 0.4, F + 3.35, 15.4);
    const art1 = new Mesh(new PlaneGeometry(2.8, 1.75), I.artColorField);
    art1.position.set(P.x0 + 0.405, F + 2.475, 14);
    art1.rotation.y = Math.PI / 2;
    root.add(art1);

    // seating group facing the fire
    const rug = new Mesh(new PlaneGeometry(5.2, 4.2), I.rug);
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = Math.PI / 2;
    rug.position.set(-6.0, F + 0.01, 14);
    rug.receiveShadow = true;
    root.add(rug);
    sofa(a, { x: -3.9, y: F, z: 14, ry: -Math.PI / 2 }, { w: 3.4, d: 1.05, fabric: I.boucle, legs: I.bronzeDark });
    coffeeTableBlock(a, { x: -6.2, y: F, z: 14 }, { mat: I.travertine, w: 1.2, d: 1.6, h: 0.32 });
    armchair(a, { x: -6.3, y: F, z: 11.2, ry: 0 }, { fabric: I.leatherCognac, frame: I.walnut });
    armchair(a, { x: -6.3, y: F, z: 16.8, ry: Math.PI }, { fabric: I.leatherCognac, frame: I.walnut });
    bookStack(a, { x: -6.0, y: F + 0.32, z: 13.6, ry: 0.3 }, { mat: I.books, n: 3 });
    vase(a, { x: -6.3, y: F + 0.32, z: 14.5 }, { mat: I.darkCeramic, h: 0.36, r: 0.11 });
    floorLamp(a, { x: -2.6, y: F, z: 16.4 }, { metal: I.brass, shade: I.lampShade, h: 1.7 });
    sideTable(a, { x: -2.7, y: F, z: 11.8 }, { top: I.marbleDark, leg: I.brass });
    // sideboard & art on the back wall
    bx(a, I.walnut, 3.2, F + 0.12, ZB - 0.55, 9.8, F + 0.78, ZB - 0.05);
    bx(a, I.bronzeDark, 3.3, F, ZB - 0.5, 9.7, F + 0.12, ZB - 0.1);
    vase(a, { x: 4.4, y: F + 0.78, z: ZB - 0.3 }, { mat: I.ceramic, h: 0.62, r: 0.14 });
    vase(a, { x: 5.0, y: F + 0.78, z: ZB - 0.28 }, { mat: I.darkCeramic, h: 0.38, r: 0.1 });
    bookStack(a, { x: 8.4, y: F + 0.78, z: ZB - 0.3, ry: -0.2 }, { mat: I.books, n: 4 });
    bx(a, I.canvasEdge, 4.6, F + 1.35, ZB - 0.06, 8.4, F + 3.15, ZB - 0.01);
    const art2 = new Mesh(new PlaneGeometry(3.7, 1.75), I.artHorizon);
    art2.position.set(6.5, F + 2.25, ZB - 0.065);
    art2.rotation.y = Math.PI;
    root.add(art2);
    // a big potted olive tree by the glass
    planter(a, { x: 9.8, y: F, z: 8.0 }, { mat: I.travertine, soil: I.soil, w: 1.1, d: 1.1, h: 0.62, round: true });
    a.put(indoorTreeGeometry(77, 2.9, '#5a6a45'), I.leaf, 9.8, F + 0.55, 8.0);

    // ---------------------------------------------------------------- GALLERY
    bx(a, I.canvasEdge, 14.2, F + 1.0, 15.62, 17.8, F + 2.6, 15.67);
    const art3 = new Mesh(new PlaneGeometry(1.5, 1.5), I.artEnso);
    art3.position.set(16, F + 1.8, 15.675);
    root.add(art3);
    bx(a, I.brass, 15.2, F + 2.72, 15.62, 16.8, F + 2.76, 15.78); // picture light
    bx(a, I.ledWarm, 15.25, F + 2.715, 15.7, 16.75, F + 2.72, 15.76, false);
    // console with a sculpture on the back wall
    bx(a, I.marbleDark, 14.6, F + 0.84, ZB - 0.42, 17.4, F + 0.9, ZB - 0.02);
    bx(a, I.bronzeDark, 14.7, F, ZB - 0.35, 14.76, F + 0.84, ZB - 0.1);
    bx(a, I.bronzeDark, 17.24, F, ZB - 0.35, 17.3, F + 0.84, ZB - 0.1);
    vase(a, { x: 15.4, y: F + 0.9, z: ZB - 0.22 }, { mat: I.terracotta, h: 0.55, r: 0.16 });
    a.put(lathe([[0, 0], [0.18, 0], [0.2, 0.06], [0.06, 0.22], [0.1, 0.5], [0.02, 0.62]], 40), I.chrome, 16.7, F + 0.9, ZB - 0.22);

    // ---------------------------------------------------------------- KITCHEN (x 20 … 32)
    // island: white marble with waterfall ends
    bx(a, I.marbleWall, 23.9, F, 12.9, 28.1, F + 0.93, 14.1);
    bx(a, I.blackGlass, 25.2, F + 0.931, 13.2, 26.6, F + 0.935, 13.8, false);
    bx(a, I.steel, 26.95, F + 0.9, 13.3, 27.6, F + 0.932, 13.75, false);
    a.put(lathe([[0.012, 0], [0.012, 0.28], [0.03, 0.34], [0.2, 0.36], [0.2, 0.34]], 16), I.chrome, 27.3, F + 0.93, 13.95, { ry: Math.PI / 2 });
    for (let i = 0; i < 4; i++) stool(a, { x: 24.6 + i * 1.0, y: F, z: 12.25, ry: Math.PI }, { seat: I.leatherCognac, frame: I.brass });
    for (let i = 0; i < 3; i++) pendant(a, { x: 24.8 + i * 1.2, y: C, z: 13.5 }, { metal: I.brass, glow: I.bulb, drop: 2.0, r: 0.14 });
    // tall cabinetry along the back wall
    bx(a, I.lacquer, 20.4, F, ZB - 0.65, 23.2, F + 3.2, ZB);
    bx(a, I.blackGlass, 20.7, F + 1.0, ZB - 0.66, 22.9, F + 1.62, ZB - 0.64); // oven
    bx(a, I.blackGlass, 20.7, F + 1.7, ZB - 0.66, 22.9, F + 2.12, ZB - 0.64); // steam oven
    bx(a, I.lacquer, 23.2, F, ZB - 0.65, 29.4, F + 0.88, ZB);
    bx(a, I.marbleWall, 23.2, F + 0.88, ZB - 0.67, 29.4, F + 0.92, ZB);
    bx(a, I.marbleWall, 23.2, F + 0.92, ZB - 0.05, 29.4, F + 1.9, ZB);
    bx(a, I.walnut, 23.4, F + 1.55, ZB - 0.35, 29.2, F + 1.6, ZB - 0.05);
    vase(a, { x: 24.2, y: F + 1.6, z: ZB - 0.2 }, { mat: I.ceramic, h: 0.26, r: 0.09 });
    vase(a, { x: 25.0, y: F + 1.6, z: ZB - 0.2 }, { mat: I.darkCeramic, h: 0.2, r: 0.07 });
    bookStack(a, { x: 28.2, y: F + 1.6, z: ZB - 0.2 }, { mat: I.books, n: 3 });
    bx(a, I.lacquer, 29.4, F, ZB - 0.65, 31.8, F + 3.2, ZB); // fridge column
    for (const x of [21.9, 30.6]) bx(a, I.brass, x - 0.01, F + 0.4, ZB - 0.68, x + 0.01, F + 2.8, ZB - 0.65);
    bx(a, I.ledWarm, 23.3, F + 1.53, ZB - 0.3, 29.3, F + 1.545, ZB - 0.06, false);
    // dining table by the glass
    bx(a, I.walnut, 23.2, F + 0.72, 8.4, 28.8, F + 0.77, 9.8);
    for (const x of [23.8, 28.2]) bx(a, I.bronzeDark, x - 0.05, F, 8.9, x + 0.05, F + 0.72, 9.3);
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) armchair(a, { x: 24.3 + i * 1.7, y: F, z: 9.1 + s * 1.15, ry: s > 0 ? Math.PI : 0 }, { fabric: I.linenSand, frame: I.walnut });
    }
    vase(a, { x: 26, y: F + 0.77, z: 9.1 }, { mat: I.ceramic, h: 0.3, r: 0.12 });

    // ---------------------------------------------------------------- BEDROOM (x 32 … 44)
    const bx0 = 38;
    const bzHead = ZB - 0.12;
    bx(a, I.linenSand, 34.9, F + 0.3, bzHead - 0.12, 41.1, F + 1.7, bzHead); // upholstered headboard wall
    for (let x = 35.25; x < 41; x += 0.7) bx(a, I.black, x - 0.004, F + 0.3, bzHead - 0.125, x + 0.004, F + 1.7, bzHead - 0.12, false);
    bx(a, I.walnut, bx0 - 1.2, F, bzHead - 2.35, bx0 + 1.2, F + 0.3, bzHead - 0.12); // bed base
    a.put(cushion(2.3, 0.26, 2.15, 0.1, 0.02), I.linenIvory, bx0, F + 0.43, bzHead - 1.2); // mattress
    a.put(cushion(2.36, 0.08, 1.5, 0.04, 0.025), I.linenIvory, bx0, F + 0.6, bzHead - 1.52); // duvet
    a.put(cushion(2.4, 0.06, 0.55, 0.03, 0.01), I.linenSand, bx0, F + 0.65, bzHead - 1.95); // throw
    for (const s of [-1, 1]) {
      a.put(cushion(0.8, 0.2, 0.45, 0.09, 0.05), I.linenIvory, bx0 + s * 0.55, F + 0.7, bzHead - 0.4, { rx: -0.35 });
      a.put(cushion(0.62, 0.16, 0.36, 0.08, 0.04), I.linenCharcoal, bx0 + s * 0.45, F + 0.68, bzHead - 0.7, { rx: -0.25 });
      bx(a, I.walnut, bx0 + s * 1.95 - 0.35, F + 0.12, bzHead - 0.62, bx0 + s * 1.95 + 0.35, F + 0.55, bzHead - 0.14);
      tableLamp(a, { x: bx0 + s * 1.95, y: F + 0.55, z: bzHead - 0.38 }, { base: I.darkCeramic, shade: I.lampShade });
    }
    // bench at the foot of the bed
    bx(a, I.walnut, bx0 - 0.9, F + 0.35, bzHead - 2.95, bx0 + 0.9, F + 0.4, bzHead - 2.55);
    a.put(cushion(1.76, 0.1, 0.38, 0.04, 0.01), I.leatherCognac, bx0, F + 0.46, bzHead - 2.75);
    for (const s of [-1, 1]) bx(a, I.bronzeDark, bx0 + s * 0.8 - 0.02, F, bzHead - 2.9, bx0 + s * 0.8 + 0.02, F + 0.35, bzHead - 2.6);
    const rug2 = new Mesh(new PlaneGeometry(4.2, 4.8), I.rug);
    rug2.rotation.x = -Math.PI / 2;
    rug2.position.set(bx0, F + 0.01, bzHead - 1.9);
    rug2.receiveShadow = true;
    root.add(rug2);
    armchair(a, { x: 34.3, y: F, z: 8.4, ry: Math.PI * 0.8 }, { fabric: I.boucle, frame: I.walnut });
    sideTable(a, { x: 35.3, y: F, z: 8.0 }, { top: I.travertine, leg: I.bronzeDark });

    // ---------------------------------------------------------------- BATHROOM (x 44 … 52)
    bx(a, I.stoneGrey, 51.7, F, ZG + 0.3, P.x1, C, ZB);
    bx(a, I.stoneGrey, 44.1, F, ZB - 0.2, P.x1, C, ZB);
    // freestanding oval bath (lathe, scaled)
    const tub = lathe(
      [
        [0.0, 0.02],
        [0.62, 0.02],
        [0.7, 0.1],
        [0.78, 0.38],
        [0.82, 0.58],
        [0.8, 0.6],
        [0.72, 0.58],
        [0.66, 0.42],
        [0.5, 0.2],
        [0.0, 0.18],
      ],
      64,
    );
    a.put(tub, I.ceramic, 48.6, F, 9.4, { sx: 1.1, sz: 0.62, ry: Math.PI / 2 });
    const bathWater = new Mesh(new PlaneGeometry(1.5, 0.8), I.interiorGlass);
    bathWater.rotation.x = -Math.PI / 2;
    bathWater.position.set(48.6, F + 0.5, 9.4);
    root.add(bathWater);
    a.add(polyTube([new Vector3(49.9, F, 9.4), new Vector3(49.9, F + 0.95, 9.4), new Vector3(49.62, F + 1.05, 9.4)], 0.018, 10), I.chrome);
    // vanity: floating stone with two basins, backlit mirror
    bx(a, I.marbleDark, 45.2, F + 0.72, ZB - 0.75, 50.8, F + 0.86, ZB - 0.2);
    for (const x of [46.6, 49.4]) {
      a.put(lathe([[0.0, 0.0], [0.18, 0.0], [0.24, 0.1], [0.26, 0.16], [0.24, 0.16], [0.2, 0.08], [0.0, 0.05]], 40), I.ceramic, x, F + 0.86, ZB - 0.47);
      a.add(polyTube([new Vector3(x, F + 0.86, ZB - 0.25), new Vector3(x, F + 1.12, ZB - 0.25), new Vector3(x, F + 1.14, ZB - 0.38)], 0.012, 8), I.chrome);
    }
    bx(a, I.mirror, 45.4, F + 1.2, ZB - 0.22, 50.6, F + 2.5, ZB - 0.2);
    bx(a, I.ledSoft, 45.35, F + 1.18, ZB - 0.235, 50.65, F + 1.2, ZB - 0.215, false);
    bx(a, I.ledSoft, 45.35, F + 2.5, ZB - 0.235, 50.65, F + 2.52, ZB - 0.215, false);
    // towels
    a.put(cushion(0.5, 0.08, 0.3, 0.03, 0.01), I.linenIvory, 50.2, F + 0.9, ZB - 0.45);
    a.put(cushion(0.45, 0.07, 0.28, 0.03, 0.01), I.linenIvory, 50.2, F + 0.97, ZB - 0.45, { ry: 0.1 });
    // glass shower with a rain head
    const sh = new Mesh(new PlaneGeometry(2.4, C - F - 0.3), I.showerGlass);
    sh.position.set(50.4, F + (C - F - 0.3) / 2, 15.2);
    sh.renderOrder = 4;
    root.add(sh);
    a.put(cyl(0.2, 0.2, 0.02, 32), I.chrome, 51.0, C - 0.5, 17.2);
    a.put(cyl(0.01, 0.01, 0.48, 8), I.chrome, 51.0, C - 0.25, 17.2);
    // candles & plant by the bath
    for (let i = 0; i < 3; i++) a.put(cyl(0.035, 0.035, 0.1 + i * 0.04, 20), I.white, 50.2 + i * 0.1, F + 0.05 + i * 0.02, 8.1);
    planter(a, { x: 51.1, y: F, z: 7.2 }, { mat: I.darkCeramic, soil: I.soil, w: 0.6, d: 0.6, h: 0.5, round: true });
    a.put(indoorTreeGeometry(31, 1.7, '#566b44'), I.leaf, 51.1, F + 0.45, 7.2, { sx: 0.8, sz: 0.8 });

    root.add(a.build('penthouse'));

    // ---------------------------------------------------------------- curtains
    const curtainMat = createCurtainMaterial(env.interior, textures.linen);
    const addCurtain = (x0: number, x1: number) => {
      const w = x1 - x0;
      const g = gridPlane(w, C - F - 0.12, Math.max(8, Math.round(w * 10)), 12);
      const m = new Mesh(g, curtainMat);
      m.position.set((x0 + x1) / 2, F + 0.02, ZG + 0.45);
      m.renderOrder = 6;
      root.add(m);
    };
    addCurtain(-9.6, -4.4);
    addCurtain(-3.8, 2.6);
    addCurtain(3.4, 7.4);
    addCurtain(32.4, 34.8);
    addCurtain(41.4, 43.8);

    // ---------------------------------------------------------------- light shafts & dust
    const beams = createLightBeams(
      [-7, -1.5, 4, 26, 37].map((x, i) => ({
        at: new Vector3(x, F + 2.2 + (i % 2) * 0.6, ZG - 0.2),
        width: 2.6,
        height: 2.2,
        length: 18,
      })),
      undefined,
      0.045,
    );
    root.add(beams.group);
    const dust = createDust(new Vector3(-9, F + 0.3, ZG + 0.5), new Vector3(44, F + 3.2, ZG + 8), quality.tier === 'low' ? 400 : 1100, 17);
    root.add(dust.points);

    return { root, bayL, bayR, beams, dust };
  }, [mats, env, textures, quality]);

  // seen from outside during the approach, then from the moment the lift arrives
  useVisibleRange(built.root, 10.5, 15.2, [21.3, 38]);

  useFrame(() => {
    const k = journey.cues.bayWindow;
    built.bayL.position.x = 45.6 - k * 1.95;
    built.bayR.position.x = 47.6 + k * 1.95;
    SOFT_UNIFORMS.uTime.value = journey.time;
    SOFT_UNIFORMS.uPointer.value.setRGB(journey.pointer.sx, journey.pointer.sy, 0);
    built.beams.material.uniforms.uTime.value = journey.time;
    built.dust.material.uniforms.uTime.value = journey.time;
    built.dust.material.uniforms.uPointer.value.set(journey.pointer.sx, journey.pointer.sy, 0);
  });

  return <primitive object={built.root} />;
}

