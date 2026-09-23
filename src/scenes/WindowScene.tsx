import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Shape,
  ShapeGeometry,
  type Texture,
  Vector3,
} from 'three';
import { useAssets } from '../engine/assets';
import { Assembler } from '../engine/Assembler';
import { journey } from '../journey/journeyState';
import { WINDOW_CENTER, WINDOW_RADIUS } from '../journey/layout';
import { withAtmosphere } from '../materials/atmosphere';
import { circlePath, lathe, polyTube, rbox } from './builders/shapes';
import { useVisibleRange } from './useVisibleRange';

/**
 * 01 — THE HUBLOT
 * A private-jet cabin wall in near darkness, a deep window reveal with a
 * brushed champagne bezel, an inner scratch pane (with its breather hole) and
 * an outer pane touched by frost and condensation. Beyond: the wing, the sky.
 * Local frame: window centre at origin, looking out along +Z.
 */

const R_FUSE = 1.28; // fuselage outer radius
const WALL = 0.16; // wall thickness (skin → interior panel)
const R_OPEN = WINDOW_RADIUS; // clear opening at the skin
const R_REVEAL = 0.25; // reveal opening at the interior panel

/** Curved interior panel (cylindrical) with a perfectly round hole. */
function curvedPanelWithHole(radius: number, halfW: number, halfH: number, holeR: number, axisZ: number) {
  const angSeg = 96;
  const radSeg = 26;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let a = 0; a <= angSeg; a++) {
    const phi = (a / angSeg) * Math.PI * 2;
    const dx = Math.cos(phi);
    const dy = Math.sin(phi);
    // distance from centre to rectangle boundary along (dx, dy)
    const tx = Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity;
    const ty = Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity;
    const rb = Math.min(tx, ty);
    for (let r = 0; r <= radSeg; r++) {
      const t = Math.pow(r / radSeg, 1.8);
      const d = holeR + (rb - holeR) * t;
      const x = dx * d;
      const s = dy * d; // arc length along the curved wall
      const th = s / radius;
      const y = Math.sin(th) * radius;
      const z = axisZ + Math.cos(th) * radius;
      verts.push(x, y, z);
      uvs.push(x, s);
    }
  }
  for (let a = 0; a < angSeg; a++) {
    for (let r = 0; r < radSeg; r++) {
      const i0 = a * (radSeg + 1) + r;
      const i1 = i0 + 1;
      const j0 = i0 + radSeg + 1;
      const j1 = j0 + 1;
      idx.push(i0, i1, j0, i1, j1, j0);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // normals must face the cabin (−Z)
  const nor = g.getAttribute('normal');
  let flip = false;
  if (nor.getZ(0) > 0) flip = true;
  if (flip) {
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
    const ix = g.getIndex()!;
    for (let i = 0; i < ix.count; i += 3) {
      const b = ix.getX(i + 1);
      ix.setX(i + 1, ix.getX(i + 2));
      ix.setX(i + 2, b);
    }
  }
  return g;
}

/** Window pane with frost, droplets and fine scratches (premultiplied glass). */
function paneMaterial(env: Texture, data: Texture, normal: Texture, frostAmount: number) {
  const m = new MeshPhysicalMaterial({
    color: new Color('#e9f0f4'),
    metalness: 0,
    roughness: 0.04,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    side: DoubleSide,
    premultipliedAlpha: true,
    normalMap: normal,
    envMap: env,
    envMapIntensity: 1.2,
  });
  m.normalScale.set(0.45, 0.45);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCond = { value: data };
    shader.uniforms.uFrost = { value: frostAmount };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uCond;\nuniform float uFrost;')
      .replace(
        '#include <opaque_fragment>',
        `vec4 cond = texture2D(uCond, vNormalMapUv);
         float frost = cond.r * uFrost;
         float drops = cond.g;
         float gA = clamp(diffuseColor.a + frost * 0.3 + drops * 0.03 + cond.b * 0.08, 0.0, 1.0);
         vec3 frostCol = totalDiffuse * 0.12 + vec3(0.78, 0.84, 0.92) * frost * 0.75;
         gl_FragColor = vec4(frostCol * gA + reflectedLight.indirectSpecular * (0.3 + drops * 0.12), gA);`,
      )
      .replace('#include <premultiplied_alpha_fragment>', '');
  };
  m.customProgramCacheKey = () => `pane${frostAmount}`;
  return withAtmosphere(m, { premultiplied: true });
}

/** Tapered, swept wing with a blended winglet (local: root at origin, span along +Z). */
function wingGeometry() {
  const span = 11.5;
  const segs = 28;
  const foil = 26;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const airfoil = (t: number) => {
    // NACA 00xx-like half thickness distribution, t in [0,1]
    return 0.6 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1036 * t * t * t * t);
  };
  for (let s = 0; s <= segs; s++) {
    const u = s / segs;
    const z = u * span;
    const chord = 4.0 - 2.7 * u;
    const le = u * span * Math.tan(0.52);
    let y = u * span * 0.07;
    // winglet: last 12% curves up
    const w = Math.max(0, (u - 0.86) / 0.14);
    y += w * w * 1.7;
    const zz = z - w * w * 0.6;
    for (let f = 0; f <= foil * 2; f++) {
      const upper = f <= foil;
      const t = upper ? 1 - f / foil : (f - foil) / foil;
      const x = le + t * chord;
      const hy = airfoil(t) * chord * (upper ? 1 : -1) * (1 - w * 0.5);
      verts.push(x, y + hy, zz + (upper ? 0 : 0) + w * hy * 0.2);
      uvs.push(x / 2.5, zz / 2.5);
    }
  }
  const row = foil * 2 + 1;
  for (let s = 0; s < segs; s++) {
    for (let f = 0; f < row - 1; f++) {
      const a = s * row + f;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function WindowScene() {
  const { mats, env, textures } = useAssets();

  const built = useMemo(() => {
    const root = new Group();
    root.name = 'window';
    root.position.copy(WINDOW_CENTER);
    const C = mats.cabin;
    const axisZ = -R_FUSE; // fuselage axis (along X)
    const rIn = R_FUSE - WALL;
    const a = new Assembler();

    // interior sidewall panel with the reveal opening
    const panel = curvedPanelWithHole(rIn, 2.4, 1.35, R_REVEAL + 0.06, axisZ);
    a.add(panel, C.panel, undefined, { scaleUV: true });

    // the reveal tunnel: inner panel → skin
    const zPanel = axisZ + rIn;
    const reveal = lathe(
      (
        [
          [R_REVEAL + 0.06, 0],
          [R_REVEAL + 0.035, 0.012],
          [R_REVEAL + 0.012, 0.03],
          [R_REVEAL, 0.05],
          [R_OPEN + 0.02, WALL - 0.02],
          [R_OPEN, WALL],
        ] as Array<[number, number]>
      ).reverse(),
      96,
    );
    reveal.rotateX(Math.PI / 2); // lathe axis Y → +Z
    reveal.translate(0, 0, zPanel - 0.005);
    a.add(reveal, C.reveal);

    // brushed champagne bezel on the panel face
    const bezel = lathe(
      [
        [R_REVEAL + 0.045, -0.002],
        [R_REVEAL + 0.05, -0.012],
        [R_REVEAL + 0.07, -0.02],
        [R_REVEAL + 0.1, -0.018],
        [R_REVEAL + 0.112, -0.008],
        [R_REVEAL + 0.115, 0.004],
      ],
      128,
    );
    bezel.rotateX(Math.PI / 2);
    bezel.translate(0, 0, zPanel);
    a.add(bezel, C.bezel, undefined, { castShadow: false });

    // walnut ledge with a warm LED line beneath
    const ledge = rbox(3.6, 0.05, 0.2, 0.02);
    a.put(ledge, C.wood, 0, -0.52, zPanel - 0.12);
    const led = new Mesh(rbox(3.5, 0.008, 0.01, 0.003), mats.cabin.ledLine);
    led.position.set(0, -0.552, zPanel - 0.06);
    root.add(led);
    // cove light at the top
    const cove = new Mesh(rbox(3.6, 0.01, 0.012, 0.004), mats.int.ledSoft);
    cove.position.set(0, 0.98, zPanel - 0.2);
    root.add(cove);
    // lower dado trim
    a.put(rbox(3.6, 0.03, 0.03, 0.01), C.trim, 0, -0.7, zPanel - 0.05);

    // club seat in the dark foreground (leather, catches the window light)
    const seatBack = rbox(0.62, 0.7, 0.22, 0.09, 4);
    a.put(seatBack, mats.int.leatherBlack, -0.95, -0.72, zPanel - 1.05, { ry: 0.5, rx: -0.1, worldUV: true });
    const headrest = rbox(0.5, 0.2, 0.16, 0.07, 4);
    a.put(headrest, mats.int.leatherBlack, -0.93, -0.3, zPanel - 1.07, { ry: 0.5, worldUV: true });

    // window shade, pulled down by a few centimetres
    const shadeShape = circlePath(R_REVEAL - 0.006, 0, 0, 96, false) as Shape;
    const shade = new ShapeGeometry(shadeShape, 96);
    const sp = shade.getAttribute('position');
    const cut = R_REVEAL - 0.055;
    for (let i = 0; i < sp.count; i++) sp.setY(i, Math.max(sp.getY(i), cut));
    shade.computeVertexNormals();
    shade.translate(0, 0, zPanel + 0.045);
    a.add(shade, C.shade, undefined, { castShadow: false });
    const handle = polyTube(
      [new Vector3(-0.05, cut - 0.004, zPanel + 0.04), new Vector3(0.05, cut - 0.004, zPanel + 0.04)],
      0.004,
      8,
    );
    a.add(handle, C.bezel);

    // fuselage skin flange around the opening (seen when passing through)
    const flange = lathe(
      [
        [R_OPEN, 0],
        [R_OPEN + 0.03, 0.004],
        [R_OPEN + 0.09, 0.003],
      ],
      96,
    );
    flange.rotateX(Math.PI / 2);
    flange.translate(0, 0, 0.001);
    a.add(flange, C.wing);

    const cabin = a.build('cabin');
    root.add(cabin);

    // panes
    const innerPane = new Mesh(
      new ShapeGeometry(circlePath(R_REVEAL - 0.004, 0, 0, 96, false) as Shape, 96),
      paneMaterial(env.cabin, textures.condensation.data, textures.condensation.normalMap, 0.35),
    );
    const ip = innerPane.geometry;
    const uvA = ip.getAttribute('uv');
    const posA = ip.getAttribute('position');
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, posA.getX(i) / (R_REVEAL * 2) + 0.5, posA.getY(i) / (R_REVEAL * 2) + 0.5);
    innerPane.position.z = zPanel + 0.06;
    innerPane.renderOrder = 3;
    root.add(innerPane);
    // breather hole
    const hole = new Mesh(new CylinderGeometry(0.0025, 0.0025, 0.004, 16), new MeshBasicMaterial({ color: '#0b0b0b' }));
    hole.rotation.x = Math.PI / 2;
    hole.position.set(0, -R_REVEAL * 0.62, zPanel + 0.06);
    root.add(hole);

    const outerPane = new Mesh(
      new ShapeGeometry(circlePath(R_OPEN + 0.012, 0, 0, 96, false) as Shape, 96),
      paneMaterial(env.cabin, textures.condensation.data, textures.condensation.normalMap, 1.0),
    );
    const op = outerPane.geometry;
    const uvB = op.getAttribute('uv');
    const posB = op.getAttribute('position');
    for (let i = 0; i < uvB.count; i++) uvB.setXY(i, posB.getX(i) / (R_OPEN * 2.1) + 0.5, posB.getY(i) / (R_OPEN * 2.1) + 0.5);
    outerPane.position.z = -0.035;
    outerPane.renderOrder = 2;
    root.add(outerPane);

    // wing (low wing, below and aft of the window)
    const wing = new Mesh(wingGeometry(), C.wing);
    wing.position.set(-3.4, -1.05, -0.35);
    wing.rotation.y = 0;
    wing.castShadow = true;
    wing.receiveShadow = true;
    root.add(wing);
    // navigation light at the winglet tip
    const nav = new Mesh(new CylinderGeometry(0.03, 0.03, 0.08, 10), C.navLight);
    nav.position.set(-3.4 + 11.5 * Math.tan(0.52) + 1.0, -1.05 + 11.5 * 0.07 + 1.7, -0.35 + 11.5 - 0.6);
    root.add(nav);

    // lower fuselage visible from outside (wing root fairing)
    const belly = new Mesh(new CylinderGeometry(R_FUSE, R_FUSE, 16, 48, 1, true, -Math.PI / 2 - 0.4, 1.1), C.wing);
    belly.rotation.z = Math.PI / 2;
    belly.position.set(0, 0, axisZ);
    belly.receiveShadow = true;
    root.add(belly);

    // invisible fuselage occluder: keeps the low sun out of the cabin
    const occluderMat = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const occluder = new Mesh(new CylinderGeometry(R_FUSE + 0.05, R_FUSE + 0.05, 14, 32, 1, false), occluderMat);
    occluder.rotation.z = Math.PI / 2;
    occluder.position.set(0, 0, axisZ);
    occluder.castShadow = true;
    occluder.frustumCulled = false;
    root.add(occluder);

    return { root, nav };
  }, [mats, env, textures]);

  useVisibleRange(built.root, -1, 7.2);

  useFrame(() => {
    // anti-collision light blinks
    const t = journey.time % 1.4;
    built.nav.visible = t < 0.9;
  });

  return <primitive object={built.root} />;
}
