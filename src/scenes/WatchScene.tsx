import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Group, Vector3 } from 'three';
import { useAssets } from '../engine/assets';
import { easeInOutCubic, smoothstep } from '../journey/interpolation';
import { journey } from '../journey/journeyState';
import { WATCH_ORIGIN_LOCAL, WATCH_SCALE, WATCH_YAW_LOCAL } from '../journey/layout';
import { WATCH_LABELS } from '../ui/WatchLabelsProjector';
import { buildWatch } from './builders/watch';
import { visibilityOverride } from './useVisibleRange';
import { yachtSwell } from './yachtMotion';

/**
 * 05 — TIME
 * The watch rests on its tray in the salon. The world falls away into a
 * studio void, the watch comes apart piece by piece along its axis, and the
 * movement keeps running: escapement, going train and balance in slow motion.
 */
const now = new Date();
const START_SECONDS = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;

const _v = new Vector3();

export function WatchScene() {
  const { mats } = useAssets();

  const built = useMemo(() => {
    const w = buildWatch(mats);
    const carrier = new Group(); // follows the yacht
    carrier.matrixAutoUpdate = false;
    const holder = new Group();
    holder.position.copy(WATCH_ORIGIN_LOCAL);
    holder.rotation.y = WATCH_YAW_LOCAL;
    holder.scale.setScalar(WATCH_SCALE);
    holder.add(w.root);
    carrier.add(holder);
    journey.mechTime = START_SECONDS;
    return { ...w, carrier, holder };
  }, [mats]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const p = journey.progress;
    const c = journey.cues;
    const b = built;
    b.carrier.matrix.copy(yachtSwell.matrix);
    b.carrier.matrixWorldNeedsUpdate = true;
    b.carrier.visible = visibilityOverride.all || p > 40.5;
    if (!b.carrier.visible) {
      journey.mechTime += dt;
      return;
    }

    // ---- the movement's own clock (slows down in the finale)
    journey.mechTime += dt * c.mechTime;
    const tau = journey.mechTime;
    const beat = Math.floor(tau * 8);
    journey.beat = beat;
    const phase = tau * 8 - beat;
    const stepped = (beat + smoothstep(0, 0.16, phase)) / 8; // seconds, 8 beats per second
    const secAngle = ((stepped % 60) / 60) * Math.PI * 2;
    const fourth = -secAngle;
    for (const a of b.arbors) a.group.rotation.y = a.ratio * fourth;

    // balance: 4 Hz, large amplitude; hairspring breathes with it
    const bal = Math.sin(tau * Math.PI * 2 * 4) * 3.6;
    b.balance.rotation.y = bal;
    b.hsGroup.rotation.y = -bal * 0.55;
    const s = b.hsGroup.children[0];
    const breathe = 1 + Math.sin(tau * Math.PI * 2 * 4 + Math.PI / 2) * 0.035;
    s.scale.set(breathe, 1, breathe);
    // pallet fork snaps between its banking pins on each beat
    const side = beat % 2 === 0 ? 1 : -1;
    b.fork.rotation.y = side * 0.16 * (2 * smoothstep(0, 0.12, phase) - 1);
    // hands
    b.hourHand.rotation.y = -((tau / 43200) % 1) * Math.PI * 2;
    b.minuteHand.rotation.y = -((tau / 3600) % 1) * Math.PI * 2;
    b.secondHand.rotation.y = -secAngle;

    // ---- deconstruction
    const e = c.explode;
    for (const part of b.parts) {
      const k = easeInOutCubic(smoothstep(part.t0, part.t1, e));
      part.obj.position.copy(part.base).addScaledVector(part.off, k);
      if (part.spin !== 0 && part.obj !== b.rotor) part.obj.rotation.y = part.baseRot + part.spin * k;
      if (part.tilt !== 0) part.obj.rotation.x = Math.sin(k * Math.PI) * part.tilt;
    }
    // rotor: gentle swing of the wrist, plus its exit spin
    b.rotor.rotation.y = Math.sin(journey.time * 0.45) * 0.7 + Math.sin(journey.time * 1.1) * 0.15 + 1.4 * easeInOutCubic(smoothstep(0.15, 0.62, e));

    // ---- studio void and presentation tray
    b.voidMat.uniforms.uOpacity.value = c.studio;
    b.studio.visible = c.studio > 0.001 || visibilityOverride.all;
    b.tray.visible = visibilityOverride.all || (c.studio < 0.985 && e < 0.02);

    // ---- label anchors (world space) for the technical call-outs
    for (const l of WATCH_LABELS) {
      const o = b.anchors[l.id];
      if (!o) continue;
      _v.set(0, 0, 0);
      if (l.id === 'crystal') _v.set(15.5, 2.2, 0);
      if (l.id === 'dial') _v.set(-15.2, 0, 0);
      if (l.id === 'hands') _v.set(0, 0.9, -12);
      if (l.id === 'train') _v.set(0, -2.7, 0);
      if (l.id === 'balance') _v.set(4.1, -3.05, 0);
      if (l.id === 'rotor') _v.set(-13.5, -4.5, 0);
      o.localToWorld(l.world.copy(_v));
    }
  });

  return <primitive object={built.carrier} />;
}
