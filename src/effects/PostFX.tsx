import { useFrame, useThree } from '@react-three/fiber';
import { BloomEffect, DepthOfFieldEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { useEffect, useState } from 'react';
import { HalfFloatType, type PerspectiveCamera, Vector3 } from 'three';
import { rig } from '../camera/CameraRig';
import { QUALITY } from '../config/quality';
import { clamp } from '../journey/interpolation';
import { journey, uiStore } from '../journey/journeyState';
import { GradeEffect, LensEffect } from './CinematicEffects';

const DIRECT = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofx');
const _fwd = new Vector3();
const _vel = new Vector3();
const _prev = new Vector3();
const _foe = new Vector3();

/**
 * Post-processing chain:
 *   scene (HDR, MSAA) → [depth of field, only when a cue asks for it]
 *   → lens (simulated motion blur + aberration) → bloom → cinematic grade.
 */
export function PostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const [fx, setFx] = useState<ReturnType<typeof createChain> | null>(null);

  useEffect(() => {
    const chain = createChain();
    setFx(chain);
    return () => chain.composer.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  function createChain() {
    const composer = new EffectComposer(gl, {
      frameBufferType: HalfFloatType,
      multisampling: QUALITY.msaa,
    });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, {
      focusDistance: 1,
      focusRange: 0.5,
      bokehScale: 0,
      resolutionScale: QUALITY.tier === 'high' ? 0.6 : 0.5,
    });
    const dofPass = new EffectPass(camera, dof);
    dofPass.enabled = false;
    if (QUALITY.dof) composer.addPass(dofPass);
    const lens = new LensEffect();
    const bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 0.92,
      luminanceSmoothing: 0.3,
      intensity: 0.55,
      radius: 0.72,
    });
    const grade = new GradeEffect();
    const main = new EffectPass(camera, lens, bloom, grade);
    composer.addPass(main);
    const out = { composer, dof, dofPass, lens, bloom, grade, main };
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__fx = out;
    return out;
  }

  useEffect(() => {
    fx?.composer.setSize(size.width, size.height);
  }, [fx, size.width, size.height, dpr]);

  useFrame((_, rawDt) => {
    if (!fx) return;
    const dt = Math.min(rawDt, 1 / 20);
    const c = journey.cues;
    const ui = uiStore.get();

    // reveal after loading: light slowly enters the cabin
    if (ui.ready) journey.reveal = Math.min(1, journey.reveal + dt / 3.2);
    const reveal = journey.reveal * journey.reveal * (3 - 2 * journey.reveal);

    fx.grade.u('uExposure').value = c.exposure;
    fx.bloom.intensity = c.bloom;
    fx.grade.u('uFade').value = reveal;
    fx.grade.u('uTime').value = journey.time;

    // motion blur only for forward motion, scaled by scroll speed
    camera.getWorldDirection(_fwd);
    _vel.subVectors(camera.position, _prev);
    _prev.copy(camera.position);
    const speed = clamp(Math.abs(journey.velocity) / 1.6, 0, 1);
    let forward = 0;
    if (_vel.lengthSq() > 1e-12) {
      _vel.normalize();
      forward = Math.max(0, _vel.dot(_fwd));
      _foe.copy(camera.position).addScaledVector(_vel, 10).project(camera);
      if (Math.abs(_foe.x) < 1.2 && Math.abs(_foe.y) < 1.2 && _foe.z < 1) {
        const u = fx.lens.uniforms.get('uCenter')!.value;
        u.x += ((_foe.x * 0.5 + 0.5) - u.x) * 0.2;
        u.y += ((_foe.y * 0.5 + 0.5) - u.y) * 0.2;
      }
    }
    const blur = c.motionBlur * speed * forward;
    fx.lens.blur = blur;
    fx.lens.aberration = 0.012 + blur * 0.05;

    // depth of field
    const bokeh = QUALITY.dof ? c.bokeh : 0;
    fx.dofPass.enabled = bokeh > 0.03;
    if (fx.dofPass.enabled) {
      fx.dof.bokehScale = bokeh;
      fx.dof.cocMaterial.adoptCameraSettings(camera);
      fx.dof.cocMaterial.focusDistance = rig.focus;
      fx.dof.cocMaterial.focusRange = rig.focus * 0.32;
    }

    if (DIRECT) {
      gl.render(scene, camera);
      return;
    }
    fx.composer.render(dt);
  }, 1);

  return null;
}
