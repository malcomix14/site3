import { CLIFF_EDGE_Z, PLATEAU_Y } from '../../journey/layout';
import { fbm, ridged, smooth } from '../../utils/noise';

/**
 * The coast: a limestone plateau ending in a cliff over the sea.
 * The resort sits on a levelled terrace; everything else is sculpted noise.
 * The same coastline formula is mirrored in the ocean shader (foam, shallows).
 */
export const RESORT_X0 = -70;
export const RESORT_X1 = 95;
export const RESORT_Z1 = 90;

export function coastZ(x: number) {
  const wild = -26 + 34 * Math.sin(x * 0.0043 + 1.3) + 15 * Math.sin(x * 0.0127 + 0.4) + 5 * Math.sin(x * 0.041 + 2.0);
  const m = smooth(RESORT_X0 - 90, RESORT_X0, x) * (1 - smooth(RESORT_X1, RESORT_X1 + 110, x));
  return wild + (CLIFF_EDGE_Z - wild) * m;
}

export const COAST_GLSL = /* glsl */ `
float coastZ(float x) {
  float wild = -26.0 + 34.0 * sin(x * 0.0043 + 1.3) + 15.0 * sin(x * 0.0127 + 0.4) + 5.0 * sin(x * 0.041 + 2.0);
  float m = smoothstep(${(RESORT_X0 - 90).toFixed(1)}, ${RESORT_X0.toFixed(1)}, x) * (1.0 - smoothstep(${RESORT_X1.toFixed(1)}, ${(RESORT_X1 + 110).toFixed(1)}, x));
  return mix(wild, ${CLIFF_EDGE_Z.toFixed(1)}, m);
}
`;

/** resort footprint mask (1 = levelled terrace) */
export function resortMask(x: number, z: number) {
  const mx = smooth(RESORT_X0 - 30, RESORT_X0, x) * (1 - smooth(RESORT_X1, RESORT_X1 + 30, x));
  const mz = 1 - smooth(RESORT_Z1, RESORT_Z1 + 50, z);
  return mx * mz;
}

export function terrainHeight(x: number, z: number) {
  const cz = coastZ(x);
  const d = z - cz; // inland distance
  const cliffTop = 22 + 16 * (fbm(x * 0.004, 3.1, 3) * 0.5 + 0.5);
  let h: number;
  if (d < 0) {
    h = -2.5 + d * 0.35 + fbm(x * 0.02, z * 0.02, 3) * 2;
  } else {
    const rise = Math.pow(smooth(0, 9 + 6 * (fbm(x * 0.01, 7.7, 2) * 0.5 + 0.5), d), 0.55);
    const rock = ridged(x * 0.03, z * 0.03, 4) * 4 * (1 - smooth(10, 40, d));
    h = -2.5 + (cliffTop + 2.5) * rise + rock;
    // rolling hinterland
    const hills = (fbm(x * 0.0021 + 11, z * 0.0021 + 3, 5) * 0.5 + 0.5) * 230 * smooth(80, 900, d);
    const ridges = ridged(x * 0.0016, z * 0.0016, 5) * 150 * smooth(300, 1500, d);
    h += hills + ridges + fbm(x * 0.02, z * 0.02, 3) * 3 * smooth(20, 60, d);
  }
  const rm = resortMask(x, z);
  if (rm > 0) {
    // keep the cliff face but level the terrace
    const edge = smooth(-2, 6, d);
    const level = PLATEAU_Y - 0.3 + Math.max(0, (z - 60) * 0.05) * smooth(60, 140, z);
    h = h + (level - h) * rm * edge;
  }
  return h;
}
