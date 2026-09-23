import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { useAssets } from '../engine/assets';
import { journey } from '../journey/journeyState';
import { buildYacht } from './builders/yacht';
import { visibilityOverride } from './useVisibleRange';
import { yachtSwell } from './yachtMotion';

/**
 * 04 — THE YACHT
 * At anchor on a gentle swell. Seen as a silhouette on the glittering sea,
 * circled from the stern, entered through the sliding aft doors.
 */
export function YachtScene() {
  const { mats, env, textures } = useAssets();
  const built = useMemo(() => buildYacht(mats, env, textures), [mats, env, textures]);

  useFrame(() => {
    const p = journey.progress;
    built.root.matrix.copy(yachtSwell.matrix);
    built.root.matrixWorldNeedsUpdate = true;
    const studioClosed = journey.cues.studio >= 0.999 && !visibilityOverride.all;
    built.root.visible = !studioClosed;
    built.interior.visible = visibilityOverride.all || p > 36;
    const k = journey.cues.yachtDoors;
    built.doorL.position.z = -0.93 - k * 1.75;
    built.doorR.position.z = 0.93 + k * 1.75;
    for (const m of built.pools) m.uniforms.uTime.value = journey.time;
  });

  return <primitive object={built.root} />;
}
