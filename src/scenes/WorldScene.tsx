import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { useAssets } from '../engine/assets';
import { applyWorldUV } from '../engine/Assembler';
import { journey } from '../journey/journeyState';
import { YACHT_POSITION, YACHT_YAW } from '../journey/layout';
import { std } from '../materials/MaterialLibrary';
import { createOceanGeometry, createOceanMaterial } from '../materials/OceanMaterial';
import { createSky } from '../engine/environments';
import { fbm, mulberry32, smooth } from '../utils/noise';
import { coastZ, resortMask, terrainHeight } from './builders/terrain';
import { cypressGeometry, shrubGeometry, stonePineGeometry } from './builders/vegetation';
import { visibilityOverride } from './useVisibleRange';

// ---------------------------------------------------------------- terrain
/** Row positions: coarse offshore, very fine along the coastline and cliffs, stretching inland. */
function terrainRows(): number[] {
  const rows: number[] = [];
  for (let z = -160; z < -34; z += 6) rows.push(z);
  for (let z = -34; z < 70; z += 0.9) rows.push(z);
  let z = 70;
  let step = 1.2;
  while (z < 3600) {
    rows.push(z);
    z += step;
    step *= 1.045;
  }
  rows.push(3600);
  return rows;
}

function buildTerrain(): BufferGeometry {
  const NX = 340;
  const rows = terrainRows();
  const NZ = rows.length;
  const pos = new Float32Array(NX * NZ * 3);
  const col = new Float32Array(NX * NZ * 3);
  for (let j = 0; j < NZ; j++) {
    const z = rows[j];
    for (let i = 0; i < NX; i++) {
      const u = (i / (NX - 1)) * 2 - 1;
      const x = 15 + Math.sign(u) * Math.pow(Math.abs(u), 1.75) * 3400;
      const k = (j * NX + i) * 3;
      pos[k] = x;
      pos[k + 1] = terrainHeight(x, z);
      pos[k + 2] = z;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i;
      const b = a + 1;
      const c = a + NX;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nor = g.getAttribute('normal');
  const rock = new Color('#c2b8a6');
  const rockDark = new Color('#857a6b');
  const scrub = new Color('#3c4829');
  const dry = new Color('#77744c');
  const lawn = new Color('#5f7440');
  const sand = new Color('#cdbd9c');
  const wet = new Color('#4a4238');
  const c = new Color();
  for (let i = 0; i < NX * NZ; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const ny = nor.getY(i);
    const slope = 1 - ny;
    const n = fbm(x * 0.012, z * 0.012, 4) * 0.5 + 0.5;
    const n2 = fbm(x * 0.05 + 3, z * 0.05, 3) * 0.5 + 0.5;
    c.copy(scrub).lerp(dry, smooth(0.35, 0.75, n) * 0.8);
    const rockK = smooth(0.18, 0.42, slope + (n2 - 0.5) * 0.2);
    // layered limestone strata and vertical erosion streaks on the cliffs
    const strata = 0.5 + 0.5 * Math.sin(y * 0.9 + fbm(x * 0.03, z * 0.03, 2) * 3);
    const streak = fbm(x * 0.35, y * 0.02, 2) * 0.5 + 0.5;
    c.lerp(rock, rockK);
    c.lerp(rockDark, rockK * (0.25 + 0.35 * strata) * (0.6 + streak * 0.6));
    c.lerp(rockDark, smooth(0.5, 0.9, slope) * 0.35);
    const d = z - coastZ(x);
    if (y < 1.8 && d > -30 && slope < 0.5) c.lerp(sand, 0.55);
    if (y < 2.2 && slope > 0.3) c.lerp(wet, 0.7);
    if (y < 0) c.multiplyScalar(0.6);
    const rm = resortMask(x, z);
    if (rm > 0.5 && y > 25) c.lerp(lawn, smooth(0.5, 1, rm) * (0.6 + n2 * 0.4));
    c.multiplyScalar(0.85 + n2 * 0.3);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  applyWorldUV(g, 16);
  g.computeBoundingSphere();
  return g;
}

function scatterVegetation(counts: { pines: number; cypress: number; shrubs: number }) {
  const rnd = mulberry32(42);
  const out = { pines: [] as Matrix4[], cypress: [] as Matrix4[], shrubs: [] as Matrix4[] };
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const place = (list: Matrix4[], target: number, scaleMin: number, scaleMax: number, rule: (x: number, z: number, y: number) => boolean, spread: number) => {
    let tries = 0;
    while (list.length < target && tries < target * 30) {
      tries++;
      const x = 15 + (rnd() * 2 - 1) * spread;
      const z = -40 + Math.pow(rnd(), 2.3) * 2400;
      const y = terrainHeight(x, z);
      if (y < 3) continue;
      const e = 1.5;
      const sx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
      const sz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
      const slope = Math.sqrt(sx * sx + sz * sz) / (2 * e);
      if (slope > 0.55) continue;
      if (resortMask(x, z) > 0.2 && y > 20) continue;
      if (!rule(x, z, y)) continue;
      const s = scaleMin + rnd() * (scaleMax - scaleMin);
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      list.push(new Matrix4().compose(new Vector3(x, y - 0.3, z), q, new Vector3(s, s * (0.85 + rnd() * 0.3), s)));
    }
  };
  const density = (x: number, z: number) => fbm(x * 0.006 + 5, z * 0.006, 3) * 0.5 + 0.5;
  place(out.pines, counts.pines, 0.8, 1.35, (x, z) => density(x, z) > 0.45 && z - coastZ(x) > 14, 1600);
  place(out.cypress, counts.cypress, 0.8, 1.3, (x, z) => density(x, z) > 0.52 && z - coastZ(x) > 30, 1400);
  place(out.shrubs, counts.shrubs, 0.6, 1.4, (x, z) => density(x + 100, z) > 0.35, 1700);
  return out;
}

function instanced(geo: BufferGeometry, mat: import('three').Material, list: Matrix4[], cast: boolean) {
  const mesh = new InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * The world that is always there: sky, sea, coastline and hinterland.
 */
export function WorldScene() {
  const { mats, env, textures, quality } = useAssets();

  const world = useMemo(() => {
    const group = new Group();
    group.name = 'world';

    // sky dome (with sun disc) — follows the camera
    const sky = createSky(true);
    sky.scale.setScalar(20000);
    sky.renderOrder = -10;
    group.add(sky);

    // ocean
    const oceanMat = createOceanMaterial(textures.waterNormal);
    oceanMat.uniforms.uSky.value = env.skyCube.texture;
    const ax = new Vector3(-1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), YACHT_YAW);
    oceanMat.uniforms.uYachtPos.value.copy(YACHT_POSITION);
    oceanMat.uniforms.uYachtAxis.value.set(ax.x, ax.z).normalize();
    const ocean = new Mesh(createOceanGeometry(quality.oceanRings, quality.oceanSegments), oceanMat);
    ocean.frustumCulled = false;
    ocean.renderOrder = -5;
    ocean.receiveShadow = false;
    group.add(ocean);

    // terrain
    const terrainMat = std({
      env: env.sky,
      envI: 0.35,
      vertexColors: true,
      roughness: 0.94,
      maps: { normalMap: textures.concrete.normalMap },
      ns: 1.4,
      tile: 5,
      far: true,
    });
    const terrain = new Mesh(buildTerrain(), terrainMat);
    terrain.receiveShadow = true;
    terrain.castShadow = false;
    terrain.name = 'terrain';
    group.add(terrain);

    // vegetation
    const k = quality.trees;
    const veg = scatterVegetation({ pines: Math.round(1400 * k), cypress: Math.round(480 * k), shrubs: Math.round(3600 * k) });
    const pineGeo = stonePineGeometry(3);
    const cypGeo = cypressGeometry(5);
    const shrubGeo = shrubGeometry(9);
    group.add(instanced(pineGeo, mats.ext.foliage, veg.pines, false));
    group.add(instanced(cypGeo, mats.ext.foliage, veg.cypress, false));
    group.add(instanced(shrubGeo, mats.ext.foliage, veg.shrubs, false));

    return { group, sky, ocean, oceanMat };
  }, [mats, env, textures, quality]);

  useFrame(({ camera }) => {
    world.sky.position.copy(camera.position);
    world.oceanMat.uniforms.uTime.value = journey.time;
    world.oceanMat.uniforms.uOffset.value.set(camera.position.x, camera.position.z);
    // once the studio void has fully closed around the watch, the world rests
    const hidden = journey.cues.studio >= 0.999 && !visibilityOverride.all;
    world.group.visible = !hidden;
  });

  return <primitive object={world.group} />;
}
