import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

/**
 * Technical call-outs of the exploded calibre. The watch scene publishes the
 * world position of each part; this projector converts them to screen space
 * for the DOM labels (crisp text, no texture blur).
 */
export interface WatchLabel {
  id: string;
  title: string;
  detail: string;
  /** which side of the anchor the text sits on */
  side: 1 | -1;
  world: Vector3;
  /** screen position (px) and visibility, written each frame */
  x: number;
  y: number;
  visible: boolean;
}

export const WATCH_LABELS: WatchLabel[] = [
  { id: 'crystal', title: 'Sapphire crystal', detail: 'Domed, anti-reflective', side: 1 },
  { id: 'hands', title: 'Dauphine hands', detail: '18k gold, hand-polished', side: -1 },
  { id: 'dial', title: 'Sunburst dial', detail: 'Midnight blue, applied indices', side: 1 },
  { id: 'train', title: 'Going train', detail: 'Barrel · centre · third · fourth', side: -1 },
  { id: 'balance', title: 'Balance & hairspring', detail: '4 Hz · 28,800 vph', side: 1 },
  { id: 'rotor', title: 'Oscillating weight', detail: '22k gold, Côtes circulaires', side: -1 },
].map((l) => ({ ...l, side: l.side as 1 | -1, world: new Vector3(), x: 0, y: 0, visible: false }));

const _v = new Vector3();

export function WatchLabelsProjector() {
  useFrame(({ camera, size }) => {
    for (const l of WATCH_LABELS) {
      _v.copy(l.world).project(camera);
      l.visible = _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      l.x = (_v.x * 0.5 + 0.5) * size.width;
      l.y = (-_v.y * 0.5 + 0.5) * size.height;
    }
  }, 2);
  return null;
}
