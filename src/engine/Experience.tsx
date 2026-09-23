import { useThree } from '@react-three/fiber';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { type Object3D } from 'three';
import { QUALITY } from '../config/quality';
import { PostFX } from '../effects/PostFX';
import { JourneyController } from '../journey/JourneyController';
import { journey, uiStore } from '../journey/journeyState';
import { ATMOS } from '../materials/atmosphere';
import { createMaterials } from '../materials/MaterialLibrary';
import { planTextureBakes } from '../materials/textures';
import { SCENES } from '../scenes/registry';
import { visibilityOverride } from '../scenes/useVisibleRange';
import { AudioDirector } from '../audio/AudioDirector';
import { WatchLabelsProjector } from '../ui/WatchLabelsProjector';
import { type Assets, AssetsContext } from './assets';
import { createEnvironments } from './environments';
import { TextureBaker } from './TextureBaker';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

const WARMUP_MARKS = [0, 4.2, 7.5, 12.5, 15.6, 19.6, 21, 23.5, 27.5, 30.5, 33.6, 36.5, 39.5, 43, 46.5, 49.5, 53.5, 57, 61, 63.5];

/**
 * Everything inside the canvas. Loading is real work spread across frames so
 * the loader shows honest progress: procedural textures are baked on the GPU,
 * environments are pre-filtered, scenes are built one by one, then every
 * shader is compiled and each chapter is rendered once off-screen.
 */
export function Experience() {
  const gl = useThree((s) => s.gl);
  const [assets, setAssets] = useState<Assets | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      uiStore.set({ loadProgress: 0.02, loadLabel: 'Composing materials', quality: QUALITY.tier });
      await nextFrame();
      const baker = new TextureBaker(gl);
      const { steps, textures } = planTextureBakes(baker, QUALITY.textureSize, QUALITY.detailTextureSize);
      for (let i = 0; i < steps.length; i++) {
        steps[i].run();
        uiStore.set({ loadProgress: 0.02 + ((i + 1) / steps.length) * 0.42 });
        if (i % 2 === 1) await nextFrame();
      }
      uiStore.set({ loadLabel: 'Lighting the sky', loadProgress: 0.46 });
      await nextFrame();
      const env = createEnvironments(gl, QUALITY.tier === 'low' ? 128 : 256);
      ATMOS.uAtmosSky.value = env.skyCube.texture;
      uiStore.set({ loadProgress: 0.52 });
      await nextFrame();
      const mats = createMaterials(textures, env);
      uiStore.set({ loadProgress: 0.55, loadLabel: 'Building the world' });
      setAssets({ textures, env, mats, quality: QUALITY });
    })().catch((err: unknown) => {
      console.error(err);
      uiStore.set({ webglError: 'The experience could not start on this device.' });
    });
  }, [gl]);

  if (!assets) return null;
  return (
    <AssetsContext.Provider value={assets}>
      <StagedScenes />
    </AssetsContext.Provider>
  );
}

const LABELS = ['Sky & sea', 'Aircraft', 'Clouds', 'Residence', 'Elevator', 'Penthouse', 'Yacht', 'Calibre'];

function StagedScenes() {
  const [count, setCount] = useState(0);
  const total = SCENES.length;

  useEffect(() => {
    if (count >= total) return;
    uiStore.set({
      loadProgress: 0.55 + (count / total) * 0.3,
      loadLabel: `Building — ${LABELS[count] ?? 'scene'}`,
    });
    let cancelled = false;
    nextFrame().then(() => {
      if (!cancelled) setCount((c) => c + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [count, total]);

  return (
    <>
      <JourneyController />
      {SCENES.slice(0, count).map((S: ComponentType, i) => (
        <S key={i} />
      ))}
      {count >= total && <Warmup />}
      <AudioDirector />
      <WatchLabelsProjector />
      <PostFX />
    </>
  );
}

function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      uiStore.set({ loadLabel: 'Compiling shaders', loadProgress: 0.86 });
      await nextFrame();
      // force everything visible, compile every program in parallel
      visibilityOverride.all = true;
      const hidden: Object3D[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        gl.compile(scene, camera);
      }
      hidden.forEach((o) => (o.visible = false));
      visibilityOverride.all = false;

      // render each chapter once, off-screen behind the loader
      uiStore.set({ loadLabel: 'Rehearsing the journey' });
      for (let i = 0; i < WARMUP_MARKS.length; i++) {
        journey.target = journey.progress = WARMUP_MARKS[i];
        await nextFrame();
        await nextFrame();
        uiStore.set({ loadProgress: 0.88 + ((i + 1) / WARMUP_MARKS.length) * 0.12 });
      }
      journey.target = journey.progress = 0;
      await nextFrame();
      await nextFrame();
      uiStore.set({ ready: true, loadProgress: 1, loadLabel: 'Ready' });
    })();
  }, [gl, scene, camera]);

  return null;
}
