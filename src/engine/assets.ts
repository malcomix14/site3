import { createContext, useContext } from 'react';
import type { Quality } from '../config/quality';
import type { Materials } from '../materials/MaterialLibrary';
import type { Textures } from '../materials/textures';
import type { Environments } from './environments';

export interface Assets {
  textures: Textures;
  env: Environments;
  mats: Materials;
  quality: Quality;
}

export const AssetsContext = createContext<Assets | null>(null);

export function useAssets(): Assets {
  const a = useContext(AssetsContext);
  if (!a) throw new Error('useAssets outside AssetsContext');
  return a;
}
