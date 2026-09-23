import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { journey, registerScrollTo, uiStore } from './journeyState';
import { JOURNEY_LENGTH } from './timeline';

gsap.registerPlugin(ScrollTrigger);

/**
 * Binds native scrolling (smoothed by Lenis) to the journey through a GSAP
 * ScrollTrigger spanning the whole scroll track. Touch uses native momentum,
 * wheel/trackpad are smoothed — both drive the exact same progress value.
 */
export function createScrollDriver(track: HTMLElement) {
  const lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    wheelMultiplier: 0.85,
    touchMultiplier: 1.35,
    syncTouch: false,
  });

  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const trigger = ScrollTrigger.create({
    trigger: track,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      journey.target = self.progress * JOURNEY_LENGTH;
    },
  });

  // Lock scrolling until the journey has loaded and the visitor entered.
  lenis.stop();
  document.documentElement.classList.add('is-locked');

  registerScrollTo((units, opts) => {
    const max = Math.max(1, trigger.end - trigger.start);
    const y = trigger.start + (Math.min(Math.max(units, 0), JOURNEY_LENGTH) / JOURNEY_LENGTH) * max;
    if (opts?.immediate) {
      lenis.scrollTo(y, { immediate: true, force: true });
      return;
    }
    const distance = Math.abs(units - journey.progress);
    lenis.scrollTo(y, {
      duration: opts?.duration ?? Math.min(9, 1.6 + distance * 0.28),
      easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      force: true,
    });
  });

  const unsub = uiStore.subscribe(() => {
    const s = uiStore.get();
    if (s.ready && s.entered) {
      document.documentElement.classList.remove('is-locked');
      lenis.start();
    }
  });

  // start at the top on reload
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  return () => {
    unsub();
    trigger.kill();
    gsap.ticker.remove(tick);
    lenis.destroy();
  };
}
