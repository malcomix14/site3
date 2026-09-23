import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { useAssets } from '../engine/assets';
import { createDust, createLightBeams } from '../effects/LightBeams';
import { journey } from '../journey/journeyState';
import { LOBBY } from '../journey/layout';
import { buildHotelExterior, buildLobby } from './builders/hotel';
import { useVisibleRange } from './useVisibleRange';

/**
 * 01→02 — THE RESIDENCE
 * Cliff-top resort: cantilevered infinity pool, stepped guest wings with
 * ray-traced interiors, and the lobby pavilion the camera enters through
 * its glass facade, where low sun shafts cross the marble.
 */
export function HotelScene() {
  const { mats, env, textures, quality } = useAssets();

  const built = useMemo(() => {
    const exterior = buildHotelExterior(mats, env, textures);
    const lobby = buildLobby(mats);
    // low sun shafts through the facade bays
    const beams = createLightBeams(
      [-8.75, -6.25, -3.75, 3.75, 6.25, 8.75, 11.25, -11.25].map((x, i) => ({
        at: new Vector3(x + 0.3, LOBBY.floor + 3.4 + (i % 3) * 1.1, LOBBY.z0 - 0.3),
        width: 2.2,
        height: 2.6,
        length: 28,
      })),
      undefined,
      0.055,
    );
    lobby.root.add(beams.group);
    const dust = createDust(
      new Vector3(LOBBY.x0 + 2, LOBBY.floor + 0.3, LOBBY.z0 + 0.5),
      new Vector3(LOBBY.x1 - 2, LOBBY.floor + 5.5, LOBBY.z0 + 14),
      quality.tier === 'low' ? 350 : 900,
      3,
    );
    lobby.root.add(dust.points);
    return { exterior, lobby, beams, dust };
  }, [mats, env, textures, quality]);

  useVisibleRange(built.exterior.root, -1, 41.5);
  useVisibleRange(built.lobby.root, 10.5, 20.3);

  useFrame(() => {
    const t = journey.time;
    for (const p of built.exterior.animated.pools) p.uniforms.uTime.value = t;
    built.beams.material.uniforms.uTime.value = t;
    built.dust.material.uniforms.uTime.value = t;
    built.dust.material.uniforms.uPointer.value.set(journey.pointer.sx, journey.pointer.sy, 0);
  });

  return (
    <>
      <primitive object={built.exterior.root} />
      <primitive object={built.lobby.root} />
    </>
  );
}
