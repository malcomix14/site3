import {
  AdditiveBlending,
  Color,
  DoubleSide,
  FrontSide,
  type Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  type MeshPhysicalMaterialParameters,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  type Texture,
  Vector2,
} from 'three';
import type { Environments } from '../engine/environments';
import { withAtmosphere } from './atmosphere';
import type { MapSet, Textures } from './textures';

type Std = MeshStandardMaterialParameters & {
  env: Texture;
  envI?: number;
  maps?: MapSet;
  /** texture tile size in world units (metres, or mm for the watch) */
  tile?: number;
  ns?: number;
  metalMap?: boolean;
  far?: boolean;
};
type Phys = MeshPhysicalMaterialParameters & Omit<Std, keyof MeshStandardMaterialParameters>;

function applyMaps(m: MeshStandardMaterial, p: Std | Phys) {
  const maps = p.maps;
  if (maps?.map) m.map = maps.map;
  if (maps?.normalMap) {
    m.normalMap = maps.normalMap;
    m.normalScale = new Vector2(p.ns ?? 1, p.ns ?? 1);
  }
  if (maps?.orm) {
    m.roughnessMap = maps.orm;
    if (p.metalMap) m.metalnessMap = maps.orm;
  }
  m.envMap = p.env;
  m.envMapIntensity = p.envI ?? 1;
  m.userData.tile = p.tile ?? 1;
}

export function std(p: Std): MeshStandardMaterial {
  const { env: _e, envI: _i, maps: _m, tile: _t, ns: _n, metalMap: _mm, far, ...rest } = p;
  const m = new MeshStandardMaterial(rest);
  applyMaps(m, p);
  return withAtmosphere(m, { clampFar: far });
}

export function phys(p: Phys): MeshPhysicalMaterial {
  const { env: _e, envI: _i, maps: _m, tile: _t, ns: _n, metalMap: _mm, far, ...rest } = p;
  const m = new MeshPhysicalMaterial(rest);
  applyMaps(m, p as Std);
  return withAtmosphere(m, { clampFar: far });
}

/**
 * Architectural glass: premultiplied output so reflections stay at full
 * strength while the pane itself remains almost invisible.
 */
export function glass(p: {
  env: Texture;
  envI?: number;
  tint?: string;
  opacity?: number;
  roughness?: number;
  side?: typeof FrontSide | typeof DoubleSide;
  specularColor?: string;
}) {
  const m = new MeshPhysicalMaterial({
    color: new Color(p.tint ?? '#dfe8e6'),
    metalness: 0,
    roughness: p.roughness ?? 0.03,
    transparent: true,
    opacity: p.opacity ?? 0.12,
    depthWrite: false,
    side: p.side ?? DoubleSide,
    premultipliedAlpha: true,
    ior: 1.5,
    specularIntensity: 1,
    specularColor: new Color(p.specularColor ?? '#ffffff'),
  });
  m.envMap = p.env;
  m.envMapIntensity = p.envI ?? 1;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <opaque_fragment>',
        `float gA = diffuseColor.a;
         gl_FragColor = vec4(totalDiffuse * gA + totalSpecular + totalEmissiveRadiance, gA);`,
      )
      .replace('#include <premultiplied_alpha_fragment>', '');
  };
  m.customProgramCacheKey = () => 'archglass';
  return withAtmosphere(m, { premultiplied: true });
}

export function emissive(color: string, intensity: number, opts: { additive?: boolean; opacity?: number } = {}) {
  const c = new Color(color).multiplyScalar(intensity);
  const m = new MeshBasicMaterial({
    color: c,
    transparent: opts.additive || opts.opacity !== undefined,
    opacity: opts.opacity ?? 1,
    blending: opts.additive ? AdditiveBlending : undefined,
    depthWrite: !opts.additive,
    toneMapped: false,
  });
  return withAtmosphere(m);
}

export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials(tx: Textures, env: Environments) {
  const E = env;

  // ------------------------------------------------------------ exterior
  const ext = {
    concrete: std({ env: E.sky, envI: 0.5, maps: tx.concrete, tile: 4, color: '#d6d1c8', roughness: 1, ns: 0.6 }),
    concreteWarm: std({ env: E.sky, envI: 0.5, maps: tx.concrete, tile: 5, color: '#e9dfd0', roughness: 1 }),
    limestone: std({ env: E.sky, envI: 0.45, maps: tx.limestone, tile: 2.4, color: '#ded5c7', roughness: 1 }),
    paving: std({ env: E.sky, envI: 0.5, maps: tx.travertine, tile: 1.6, color: '#e3d9ca', roughness: 1 }),
    bronze: std({ env: E.sky, envI: 1.0, color: '#b89a74', metalness: 1, roughness: 0.32, maps: { orm: tx.brushed.orm, normalMap: tx.brushed.normalMap }, tile: 1 }),
    darkMetal: std({ env: E.sky, envI: 0.9, color: '#2a2a2b', metalness: 0.9, roughness: 0.38 }),
    facadeGlass: glass({ env: E.sky, envI: 1.0, tint: '#cfdcd9', opacity: 0.1 }),
    teakExt: std({ env: E.sky, envI: 0.45, maps: tx.teak, tile: 1.08, color: '#d9c2a6', roughness: 1 }),
    poolTile: std({ env: E.sky, envI: 0.5, maps: tx.poolTiles, tile: 1, roughness: 0.25 }),
    cushion: std({ env: E.sky, envI: 0.5, maps: tx.linen, tile: 0.6, color: '#f1ece2', roughness: 1 }),
    umbrella: std({ env: E.sky, envI: 0.4, maps: tx.linen, tile: 0.8, color: '#e8e0d0', roughness: 1, side: DoubleSide }),
    foliage: std({ env: E.sky, envI: 0.35, vertexColors: true, roughness: 0.82, side: DoubleSide, far: true }),
    foliageNear: std({ env: E.sky, envI: 0.45, vertexColors: true, roughness: 0.7, side: DoubleSide }),
    bark: std({ env: E.sky, envI: 0.3, maps: tx.bark, tile: 1.2, color: '#b7a894', roughness: 0.95 }),
    rockFar: std({ env: E.sky, envI: 0.3, vertexColors: true, roughness: 0.95, far: true }),
    cliffStone: std({ env: E.sky, envI: 0.35, maps: tx.rock, tile: 7, color: '#b3a893', roughness: 1, ns: 1.2 }),
  };

  // ------------------------------------------------------------ interiors (hotel & penthouse)
  const int = {
    marbleFloor: std({ env: E.interior, envI: 0.85, maps: tx.marbleTiles, tile: 2.4, color: '#dcd6cc', roughness: 1, ns: 0.5 }),
    marbleWall: std({ env: E.interior, envI: 0.8, maps: tx.marbleWhite, tile: 2.2, roughness: 1 }),
    marbleDark: phys({ env: E.interior, envI: 1.0, maps: tx.marbleDark, tile: 2.0, roughness: 1, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
    travertine: std({ env: E.interior, envI: 0.65, maps: tx.travertine, tile: 1.6, roughness: 1, ns: 0.8 }),
    stoneGrey: std({ env: E.interior, envI: 0.75, maps: tx.stoneGrey, tile: 2.0, roughness: 1 }),
    oak: std({ env: E.interior, envI: 0.75, maps: tx.oak, tile: 2.4, roughness: 1, ns: 0.6 }),
    oakLight: std({ env: E.interior, envI: 0.6, maps: tx.oak, tile: 3.6, color: '#f1e6d6', roughness: 1 }),
    walnut: phys({ env: E.interior, envI: 0.8, maps: tx.walnut, tile: 1.4, roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.2 }),
    plaster: std({ env: E.interior, envI: 0.95, maps: tx.plaster, tile: 3, color: '#ece6dc', roughness: 1, ns: 0.5 }),
    plasterWarm: std({ env: E.interior, envI: 0.55, maps: tx.plaster, tile: 3, color: '#e8dccb', roughness: 1 }),
    linenIvory: std({ env: E.interior, envI: 0.5, maps: tx.linen, tile: 0.5, color: '#ece5d8', roughness: 1 }),
    linenSand: std({ env: E.interior, envI: 0.5, maps: tx.linen, tile: 0.5, color: '#cdbca3', roughness: 1 }),
    linenCharcoal: std({ env: E.interior, envI: 0.45, maps: tx.linen, tile: 0.5, color: '#4a4744', roughness: 1 }),
    linenSage: std({ env: E.interior, envI: 0.45, maps: tx.linen, tile: 0.5, color: '#8f8f7f', roughness: 1 }),
    boucle: std({ env: E.interior, envI: 0.45, maps: tx.boucle, tile: 0.35, color: '#efe8dc', roughness: 1, ns: 0.9 }),
    leatherCognac: std({ env: E.interior, envI: 0.8, maps: tx.leather, tile: 0.45, color: '#8a5230', roughness: 1 }),
    leatherBlack: std({ env: E.interior, envI: 0.8, maps: tx.leather, tile: 0.45, color: '#1d1b1a', roughness: 1 }),
    rug: std({ env: E.interior, envI: 0.4, maps: tx.wool, tile: 1, roughness: 0.98 }),
    brass: std({ env: E.interior, envI: 1.1, color: '#c9a66b', metalness: 1, roughness: 0.28, maps: { orm: tx.brushed.orm, normalMap: tx.brushed.normalMap }, tile: 0.6, ns: 0.4 }),
    bronzeDark: std({ env: E.interior, envI: 1.0, color: '#6d5238', metalness: 1, roughness: 0.34 }),
    steel: std({ env: E.interior, envI: 1.0, color: '#c8c8c6', metalness: 1, roughness: 0.3, maps: { orm: tx.brushed.orm, normalMap: tx.brushed.normalMap }, tile: 0.6, ns: 0.4 }),
    chrome: std({ env: E.interior, envI: 1.2, color: '#e2e2e2', metalness: 1, roughness: 0.06 }),
    blackGlass: phys({ env: E.interior, envI: 1.1, color: '#050506', roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02 }),
    mirror: std({ env: E.interior, envI: 1.3, color: '#dcdcd8', metalness: 1, roughness: 0.02 }),
    carMirror: std({ env: E.elevator, envI: 1.2, color: '#b8a58c', metalness: 1, roughness: 0.04 }),
    carBronze: std({ env: E.elevator, envI: 1.3, color: '#9c7b55', metalness: 1, roughness: 0.24, maps: { orm: tx.brushed.orm, normalMap: tx.brushed.normalMap }, tile: 0.8, ns: 0.35 }),
    lacquer: phys({ env: E.interior, envI: 0.9, color: '#2b2a29', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    lacquerSand: phys({ env: E.interior, envI: 0.8, color: '#b9ab96', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
    ceramic: phys({ env: E.interior, envI: 1.0, color: '#f4f2ee', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
    darkCeramic: phys({ env: E.interior, envI: 0.9, color: '#1a1918', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    terracotta: std({ env: E.interior, envI: 0.4, color: '#a66a4c', roughness: 0.9, maps: { normalMap: tx.concrete.normalMap }, tile: 0.8 }),
    interiorGlass: glass({ env: E.interior, envI: 0.9, tint: '#e8efec', opacity: 0.06 }),
    showerGlass: glass({ env: E.interior, envI: 0.9, tint: '#dfe9e6', opacity: 0.1 }),
    ledWarm: emissive('#ffd9a8', 2.6),
    ledSoft: emissive('#ffe3c2', 1.4),
    lampShade: phys({ env: E.interior, envI: 0.3, color: '#f3e7d3', roughness: 0.9, emissive: new Color('#ffcf91'), emissiveIntensity: 1.6, side: DoubleSide }),
    bulb: emissive('#ffe0b0', 9),
    fireGlow: emissive('#ff9a4a', 4),
    books: std({ env: E.interior, envI: 0.4, vertexColors: true, roughness: 0.8 }),
    leaf: std({ env: E.interior, envI: 0.5, vertexColors: true, roughness: 0.6, side: DoubleSide }),
    bark: std({ env: E.interior, envI: 0.3, maps: tx.bark, tile: 0.8, color: '#9d8f7e', roughness: 1 }),
    soil: std({ env: E.interior, envI: 0.2, color: '#2d231b', roughness: 1 }),
    pebbles: std({ env: E.interior, envI: 0.4, color: '#8d877e', roughness: 0.7 }),
    artColorField: std({ env: E.interior, envI: 0.3, map: tx.artColorField, roughness: 0.85 }),
    artEnso: std({ env: E.interior, envI: 0.3, map: tx.artEnso, roughness: 0.9 }),
    artHorizon: std({ env: E.interior, envI: 0.3, map: tx.artHorizon, roughness: 0.9 }),
    canvasEdge: std({ env: E.interior, envI: 0.3, color: '#d8d0c3', roughness: 0.9 }),
    elevatorBronze: std({ env: E.interior, envI: 1.25, color: '#9c7b55', metalness: 1, roughness: 0.22, maps: { orm: tx.brushed.orm, normalMap: tx.brushed.normalMap }, tile: 0.8, ns: 0.5 }),
    black: std({ env: E.interior, envI: 0.4, color: '#0b0b0b', roughness: 0.6 }),
    white: std({ env: E.interior, envI: 0.6, color: '#f2efe9', roughness: 0.5 }),
  };

  // ------------------------------------------------------------ yacht
  const yacht = {
    hull: phys({ env: E.sky, envI: 1.15, color: '#1c2430', metalness: 0.4, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.04 }),
    white: phys({ env: E.sky, envI: 0.75, color: '#e2e0da', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
    silver: std({ env: E.sky, envI: 1.1, color: '#c9ccd0', metalness: 1, roughness: 0.18 }),
    stainless: std({ env: E.sky, envI: 1.2, color: '#e3e4e6', metalness: 1, roughness: 0.12 }),
    glass: phys({ env: E.sky, envI: 1.25, color: '#06090d', roughness: 0.05, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.02 }),
    windowGlass: glass({ env: E.sky, envI: 1.1, tint: '#44505a', opacity: 0.4 }),
    teak: std({ env: E.sky, envI: 0.5, maps: tx.teak, tile: 1.08, roughness: 1 }),
    cushion: std({ env: E.sky, envI: 0.45, maps: tx.linen, tile: 0.5, color: '#f2eee6', roughness: 1 }),
    cushionNavy: std({ env: E.sky, envI: 0.45, maps: tx.linen, tile: 0.5, color: '#2a3342', roughness: 1 }),
    rubber: std({ env: E.sky, envI: 0.4, color: '#111214', roughness: 0.7 }),
    carbon: phys({ env: E.sky, envI: 1.0, color: '#141518', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    // salon
    walnut: phys({ env: E.yacht, envI: 1.0, maps: tx.walnut, tile: 1.3, color: '#b39884', roughness: 1, clearcoat: 0.9, clearcoatRoughness: 0.06 }),
    walnutDark: phys({ env: E.yacht, envI: 1.0, maps: tx.walnut, tile: 1.1, color: '#6e5646', roughness: 1, clearcoat: 1, clearcoatRoughness: 0.05 }),
    leatherCream: std({ env: E.yacht, envI: 0.7, maps: tx.leather, tile: 0.4, color: '#d9ccb7', roughness: 1 }),
    leatherTobacco: std({ env: E.yacht, envI: 0.8, maps: tx.leather, tile: 0.4, color: '#5a3a24', roughness: 1 }),
    carpet: std({ env: E.yacht, envI: 0.35, maps: tx.wool, tile: 1.4, color: '#e6dccb', roughness: 1 }),
    ceiling: std({ env: E.yacht, envI: 0.5, maps: tx.linen, tile: 0.9, color: '#efe7da', roughness: 1 }),
    brass: std({ env: E.yacht, envI: 1.2, color: '#caa56a', metalness: 1, roughness: 0.22 }),
    marble: phys({ env: E.yacht, envI: 1.0, maps: tx.marbleDark, tile: 1.6, color: '#6f6c68', roughness: 1, clearcoat: 0.7, clearcoatRoughness: 0.06 }),
    interiorGlass: glass({ env: E.yacht, envI: 0.8, tint: '#d8e2e2', opacity: 0.05 }),
    led: emissive('#ffd2a0', 2.4),
    shade: phys({ env: E.yacht, envI: 0.3, color: '#efe2cc', roughness: 0.9, emissive: new Color('#ffc987'), emissiveIntensity: 1.8, side: DoubleSide }),
  };

  // ------------------------------------------------------------ cabin
  const cabin = {
    panel: std({ env: E.cabin, envI: 0.45, maps: tx.leather, tile: 0.35, color: '#1d1b19', roughness: 1, ns: 0.5 }),
    trim: phys({ env: E.cabin, envI: 1.0, color: '#161514', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    reveal: std({ env: E.cabin, envI: 0.5, color: '#9d978e', roughness: 0.6, side: DoubleSide }),
    bezel: std({ env: E.cabin, envI: 1.5, color: '#d8c7a3', metalness: 1, roughness: 0.16, side: DoubleSide, maps: { orm: tx.brushed.orm, normalMap: tx.brushed.normalMap }, tile: 0.2, ns: 0.3 }),
    shade: std({ env: E.cabin, envI: 0.6, maps: tx.linen, tile: 0.2, color: '#d6cfc3', roughness: 1 }),
    wood: phys({ env: E.cabin, envI: 1.0, maps: tx.walnut, tile: 0.8, color: '#8f7462', roughness: 1, clearcoat: 1, clearcoatRoughness: 0.05 }),
    wing: std({ env: E.sky, envI: 0.9, maps: tx.panelLines, tile: 2.5, color: '#b9bec4', roughness: 0.34, metalness: 0.25, ns: 0.6, side: DoubleSide }),
    wingDark: std({ env: E.sky, envI: 0.9, color: '#9ea3a8', roughness: 0.3, metalness: 0.6 }),
    navLight: emissive('#ff2a1a', 12),
    strobe: emissive('#ffffff', 20),
  };

  // ------------------------------------------------------------ watch (studio light)
  const watch = {
    steel: std({ env: E.studio, envI: 1.6, color: '#e9e9ea', metalness: 1, roughness: 0.07 }),
    steelBrushed: std({ env: E.studio, envI: 1.5, color: '#dedfe1', metalness: 1, roughness: 1, maps: { orm: tx.brushed.orm, normalMap: tx.brushed.normalMap }, tile: 8, ns: 0.5 }),
    gold: std({ env: E.studio, envI: 1.6, color: '#f1c27e', metalness: 1, roughness: 0.1 }),
    goldBrushed: std({ env: E.studio, envI: 1.5, color: '#eab874', metalness: 1, roughness: 1, maps: { orm: tx.geneva.orm, normalMap: tx.geneva.normalMap }, tile: 22, ns: 0.6 }),
    rhodium: std({ env: E.studio, envI: 1.5, color: '#d7d9dc', metalness: 1, roughness: 1, maps: { orm: tx.geneva.orm, normalMap: tx.geneva.normalMap }, tile: 22, ns: 0.7 }),
    rhodiumPolished: std({ env: E.studio, envI: 1.6, color: '#e4e5e7', metalness: 1, roughness: 0.08 }),
    plate: std({ env: E.studio, envI: 1.35, color: '#cfd1d4', metalness: 1, roughness: 1, maps: { orm: tx.perlage.orm, normalMap: tx.perlage.normalMap }, tile: 20, ns: 0.8 }),
    wheelGold: std({ env: E.studio, envI: 1.6, color: '#e7b877', metalness: 1, roughness: 0.16, maps: { normalMap: tx.brushed.normalMap }, tile: 6, ns: 0.25 }),
    pinion: std({ env: E.studio, envI: 1.6, color: '#d8d8d8', metalness: 1, roughness: 0.1 }),
    blued: std({ env: E.studio, envI: 1.5, color: '#1b3a9a', metalness: 1, roughness: 0.2 }),
    ruby: phys({ env: E.studio, envI: 1.4, color: '#a0071a', roughness: 0.05, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.0, emissive: new Color('#5a0008'), emissiveIntensity: 0.6, sheen: 0.4, sheenColor: new Color('#ff3040') }),
    dial: phys({ env: E.studio, envI: 1.4, maps: tx.sunburst, tile: 1, metalness: 0.75, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.05, ns: 0.45 }),
    lume: std({ env: E.studio, envI: 0.6, color: '#efeadb', roughness: 0.6, emissive: new Color('#bfe6c9'), emissiveIntensity: 0.12 }),
    sapphire: glass({ env: E.studio, envI: 1.6, tint: '#e8eef8', opacity: 0.04, specularColor: '#c8d4ff' }),
    strap: phys({ env: E.studio, envI: 0.9, maps: tx.alligator, tile: 40, color: '#1b1512', roughness: 1, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
    stitch: std({ env: E.studio, envI: 0.3, color: '#8c8272', roughness: 0.85 }),
    black: std({ env: E.studio, envI: 0.6, color: '#050505', roughness: 0.4 }),
    tray: std({ env: E.yacht, envI: 0.7, maps: tx.leather, tile: 0.25, color: '#15110f', roughness: 1, ns: 0.4 }),
    traySuede: std({ env: E.yacht, envI: 0.3, maps: tx.boucle, tile: 0.1, color: '#2a211b', roughness: 1 }),
  };

  const all: Material[] = [
    ...Object.values(ext),
    ...Object.values(int),
    ...Object.values(yacht),
    ...Object.values(cabin),
    ...Object.values(watch),
  ];

  return { ext, int, yacht, cabin, watch, all };
}
