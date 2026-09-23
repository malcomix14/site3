/**
 * Device tiering. Everything that costs GPU time reads from here:
 * resolution, shadow maps, texture sizes, post-processing and population counts.
 */
export type Tier = 'high' | 'medium' | 'low';

export interface Quality {
  tier: Tier;
  isMobile: boolean;
  maxDpr: number;
  minDpr: number;
  textureSize: number;
  detailTextureSize: number;
  shadowMapSize: number;
  msaa: number;
  bloom: boolean;
  dof: boolean;
  clouds: number;
  trees: number;
  oceanRings: number;
  oceanSegments: number;
}

function detectTier(): { tier: Tier; isMobile: boolean } {
  const ua = navigator.userAgent;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const isMobile = coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('quality');
  if (forced === 'high' || forced === 'medium' || forced === 'low') return { tier: forced, isMobile };
  if (isMobile) return { tier: cores >= 8 && mem >= 6 ? 'medium' : 'low', isMobile };
  if (cores <= 4 || mem <= 4) return { tier: 'medium', isMobile };
  return { tier: 'high', isMobile };
}

export function resolveQuality(): Quality {
  const { tier, isMobile } = detectTier();
  const dpr = window.devicePixelRatio || 1;
  switch (tier) {
    case 'high':
      return {
        tier,
        isMobile,
        maxDpr: Math.min(dpr, 1.75),
        minDpr: 0.8,
        textureSize: 1024,
        detailTextureSize: 512,
        shadowMapSize: 2048,
        msaa: 4,
        bloom: true,
        dof: true,
        clouds: 520,
        trees: 1,
        oceanRings: 150,
        oceanSegments: 128,
      };
    case 'medium':
      return {
        tier,
        isMobile,
        maxDpr: Math.min(dpr, isMobile ? 1.5 : 1.35),
        minDpr: 0.7,
        textureSize: 1024,
        detailTextureSize: 512,
        shadowMapSize: 2048,
        msaa: isMobile ? 0 : 2,
        bloom: true,
        dof: !isMobile,
        clouds: 380,
        trees: 0.75,
        oceanRings: 120,
        oceanSegments: 96,
      };
    default:
      return {
        tier,
        isMobile,
        maxDpr: Math.min(dpr, 1.25),
        minDpr: 0.6,
        textureSize: 512,
        detailTextureSize: 256,
        shadowMapSize: 1024,
        msaa: 0,
        bloom: true,
        dof: false,
        clouds: 260,
        trees: 0.5,
        oceanRings: 96,
        oceanSegments: 72,
      };
  }
}

export const QUALITY = resolveQuality();
