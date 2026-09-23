import { type Texture } from 'three';
import type { TextureBaker } from '../engine/TextureBaker';
import * as R from './textureRecipes';

export interface MapSet {
  map?: Texture;
  normalMap?: Texture;
  orm?: Texture;
}

export interface Textures {
  marbleWhite: MapSet;
  marbleTiles: MapSet;
  marbleDark: MapSet;
  travertine: MapSet;
  limestone: MapSet;
  concrete: MapSet;
  stoneGrey: MapSet;
  oak: MapSet;
  teak: MapSet;
  walnut: MapSet;
  bark: MapSet;
  leather: MapSet;
  alligator: MapSet;
  linen: MapSet;
  boucle: MapSet;
  wool: MapSet;
  plaster: MapSet;
  brushed: MapSet;
  perlage: MapSet;
  geneva: MapSet;
  sunburst: MapSet;
  poolTiles: MapSet;
  panelLines: MapSet;
  rock: MapSet;
  condensation: { data: Texture; normalMap: Texture };
  waterNormal: Texture;
  cloudAtlas: Texture;
  artColorField: Texture;
  artEnso: Texture;
  artHorizon: Texture;
}

type Recipe = { color?: string; normal?: string; orm?: string; data?: string };

export interface BakeStep {
  label: string;
  run: () => void;
}

/**
 * Returns the list of bake steps (so the loader can spread them across frames
 * and report real progress) and the texture set they fill.
 */
export function planTextureBakes(baker: TextureBaker, size: number, detail: number) {
  const out = {} as Textures;
  const steps: BakeStep[] = [];

  const set = (
    name: keyof Textures,
    r: Recipe,
    sizes: { color?: number; normal?: number; orm?: number },
    strength = 1,
  ) => {
    steps.push({
      label: name,
      run: () => {
        const ms: MapSet = {};
        if (r.color) ms.map = baker.bake({ glsl: r.color, output: 'color', size: sizes.color ?? size });
        if (r.normal)
          ms.normalMap = baker.bake({ glsl: r.normal, output: 'normal', size: sizes.normal ?? detail, normalStrength: strength });
        if (r.orm) ms.orm = baker.bake({ glsl: r.orm, output: 'orm', size: sizes.orm ?? Math.max(128, detail / 2) });
        (out as unknown as Record<string, MapSet>)[name] = ms;
      },
    });
  };

  set('marbleWhite', R.marbleWhite, {});
  set('marbleTiles', R.marbleTiles, { normal: size }, 0.6);
  set('marbleDark', R.marbleDark, {});
  set('travertine', R.travertine, {}, 1.2);
  set('limestone', R.limestone, {}, 1.4);
  set('concrete', R.concrete, { color: detail }, 0.9);
  set('stoneGrey', R.stoneGrey, {}, 0.6);
  set('oak', R.oakFloor, {}, 0.8);
  set('teak', R.teakDeck, { color: detail, normal: detail }, 1.0);
  set('walnut', R.walnut, {}, 0.6);
  set('bark', R.bark, { color: detail / 2, normal: detail / 2 }, 2.0);
  set('leather', R.leather, { color: detail / 2 }, 0.8);
  set('alligator', R.alligator, { color: detail / 2 }, 1.5);
  set('linen', R.linen, { color: detail / 2 }, 0.9);
  set('boucle', R.boucle, { color: detail / 2 }, 1.2);
  set('wool', R.wool, { color: detail }, 0.8);
  set('plaster', R.plaster, { color: detail }, 0.35);
  set('brushed', R.brushed, {}, 0.35);
  set('perlage', R.perlage, {}, 1.4);
  set('geneva', R.geneva, {}, 0.7);
  set('sunburst', R.sunburst, { color: detail, normal: size }, 0.9);
  set('poolTiles', R.poolTiles, { color: detail }, 0.8);
  set('panelLines', R.panelLines, { color: detail }, 1.4);
  set('rock', R.rock, { color: detail }, 1.6);

  steps.push({
    label: 'condensation',
    run: () => {
      out.condensation = {
        data: baker.bake({ glsl: R.condensation.data, output: 'data', size: detail }),
        normalMap: baker.bake({ glsl: R.condensation.normal, output: 'normal', size: detail, normalStrength: 3.0 }),
      };
    },
  });
  steps.push({
    label: 'water',
    run: () => {
      out.waterNormal = baker.bake({ glsl: R.waterNormal.normal, output: 'normal', size: detail, normalStrength: 1.0 });
    },
  });
  steps.push({
    label: 'clouds',
    run: () => {
      out.cloudAtlas = baker.bake({ glsl: R.cloudAtlas.data, output: 'data', size: Math.max(512, detail), clamp: true, noMips: true });
    },
  });
  steps.push({
    label: 'art',
    run: () => {
      out.artColorField = baker.bake({ glsl: R.artColorField.color, output: 'color', size: detail, clamp: true });
      out.artEnso = baker.bake({ glsl: R.artEnso.color, output: 'color', size: detail, clamp: true });
      out.artHorizon = baker.bake({ glsl: R.artHorizon.color, output: 'color', size: detail, clamp: true });
    },
  });

  return { steps, textures: out };
}
