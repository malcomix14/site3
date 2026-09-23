import { Canvas } from '@react-three/fiber';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { NoToneMapping, PCFShadowMap, SRGBColorSpace } from 'three';
import { QUALITY } from './config/quality';
import { Experience } from './engine/Experience';
import { uiStore, useUI } from './journey/journeyState';
import { createScrollDriver } from './journey/ScrollDriver';
import { JOURNEY_LENGTH } from './journey/timeline';
import { AdaptiveResolution } from './engine/AdaptiveResolution';
import { Chrome } from './ui/Chrome';
import { Loader } from './ui/Loader';
import { Captions, Finale, Intro, WatchLabels } from './ui/Overlays';

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

export function App() {
  const track = useRef<HTMLDivElement>(null);
  const [supported] = useState(hasWebGL2);
  const error = useUI((s) => s.webglError);

  useEffect(() => {
    if (!track.current || !supported) return;
    return createScrollDriver(track.current);
  }, [supported]);

  if (!supported) {
    return <div className="fallback">This journey needs a browser with WebGL 2 enabled.</div>;
  }

  return (
    <>
      <div className="stage">
        <Canvas
          flat
          dpr={QUALITY.maxDpr}
          shadows={{ type: PCFShadowMap, enabled: true }}
          gl={{
            antialias: false,
            alpha: false,
            stencil: false,
            depth: true,
            powerPreference: 'high-performance',
            outputColorSpace: SRGBColorSpace,
            toneMapping: NoToneMapping,
          }}
          camera={{ fov: 34, near: 0.02, far: 3000, position: [0, 380, -1402] }}
          onCreated={({ gl }) => {
            gl.setClearColor('#000000');
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              uiStore.set({ webglError: 'The graphics context was lost. Please reload the page.' });
            });
          }}
        >
          <Experience />
          <AdaptiveResolution />
        </Canvas>
      </div>
      <div
        ref={track}
        className="scroll-track"
        style={{ '--units': JOURNEY_LENGTH + 1 } as CSSProperties}
        aria-hidden="true"
      />
      <Intro />
      <Captions />
      <WatchLabels />
      <Finale />
      <Chrome />
      <Loader />
      {error && <div className="fallback">{error}</div>}
    </>
  );
}
