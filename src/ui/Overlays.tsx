import { useEffect, useRef } from 'react';
import { band, clamp, smoothstep } from '../journey/interpolation';
import { journey, scrollToUnits, uiStore, useUI } from '../journey/journeyState';
import { CAPTIONS, FINALE, INTRO, JOURNEY_LENGTH } from '../journey/timeline';
import { WATCH_LABELS } from './WatchLabelsProjector';

/** a rAF loop that runs only while mounted */
function useLoop(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      ref.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export function Intro() {
  const ready = useUI((s) => s.ready);
  const el = useRef<HTMLDivElement>(null);
  useLoop(() => {
    if (!el.current) return;
    const reveal = smoothstep(0.35, 1, journey.reveal);
    const out = 1 - smoothstep(INTRO.fadeOutFrom, INTRO.fadeOutTo, journey.progress);
    const o = reveal * out;
    el.current.style.opacity = o.toFixed(3);
    el.current.style.transform = `translateY(${((1 - reveal) * 14 - (1 - out) * 30).toFixed(1)}px)`;
    el.current.style.visibility = o < 0.01 ? 'hidden' : 'visible';
  });
  if (!ready) return null;
  return (
    <div className="intro" ref={el} style={{ opacity: 0 }}>
      <div className="intro__top">
        <p className="intro__kicker">Élan — Maison de Haute Horlogerie</p>
        <h1 className="intro__title">Your journey begins</h1>
      </div>
      <button
        type="button"
        className="intro__enter"
        onClick={() => {
          uiStore.set({ entered: true });
          scrollToUnits(5.6, { duration: 6.5 });
        }}
      >
        <span className="ring" aria-hidden="true" />
        Enter
      </button>
      <p className="intro__hint">or scroll</p>
    </div>
  );
}

export function Captions() {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  useLoop(() => {
    const p = journey.progress;
    CAPTIONS.forEach((c, i) => {
      const el = refs.current[i];
      if (!el) return;
      const len = c.to - c.from;
      const o = band(p, c.from, c.from + len * 0.28, c.to - len * 0.25, c.to);
      const t = clamp((p - c.from) / len);
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
      el.style.transform = `translateY(${((1 - t) * 26 - 13).toFixed(1)}px)`;
      const rule = el.querySelector<HTMLElement>('.caption__rule');
      if (rule) rule.style.transform = `scaleX(${smoothstep(c.from, c.from + len * 0.5, p).toFixed(3)})`;
    });
  });
  return (
    <>
      {CAPTIONS.map((c, i) => (
        <div
          key={c.line}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`caption caption--${c.align ?? 'left'}`}
          aria-hidden="true"
        >
          <span className="caption__kicker">{c.kicker}</span>
          <span className="caption__line">{c.line}</span>
          <span className="caption__rule" />
        </div>
      ))}
    </>
  );
}

export function WatchLabels() {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  useLoop(() => {
    const k = journey.cues.labels;
    const narrow = window.innerWidth < 700;
    WATCH_LABELS.forEach((l, i) => {
      const el = refs.current[i];
      if (!el) return;
      const stagger = clamp(k * 1.6 - i * 0.12);
      const o = l.visible ? stagger : 0;
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      if (o < 0.01) return;
      el.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`;
      const len = (narrow ? 42 : 90) * stagger;
      const line = el.querySelector<HTMLElement>('.label__line');
      const text = el.querySelector<HTMLElement>('.label__text');
      if (line) {
        line.style.width = `${len}px`;
        line.style.transform = l.side > 0 ? 'rotate(0deg)' : 'rotate(180deg)';
      }
      if (text) {
        text.style.transform =
          l.side > 0 ? `translate(${len + 12}px, -50%)` : `translate(calc(-100% - ${len + 12}px), -50%)`;
        text.style.textAlign = l.side > 0 ? 'left' : 'right';
      }
    });
  });
  return (
    <div className="labels" aria-hidden="true">
      {WATCH_LABELS.map((l, i) => (
        <div
          key={l.id}
          className="label"
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <span className="label__dot" />
          <span className="label__line" />
          <span className="label__text">
            {l.title}
            <em>{l.detail}</em>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Finale() {
  const el = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const sub = useRef<HTMLParagraphElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  useLoop(() => {
    const p = journey.progress;
    const o = smoothstep(FINALE.from, FINALE.full, p);
    if (el.current) {
      el.current.style.opacity = o.toFixed(3);
      el.current.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      el.current.style.pointerEvents = o > 0.9 ? 'auto' : 'none';
    }
    if (title.current) {
      // very slow tracking-in while the movement keeps running
      const t = smoothstep(FINALE.from, JOURNEY_LENGTH, p);
      const narrow = window.innerWidth < 700;
      const from = narrow ? 0.34 : 0.62;
      const range = narrow ? 0.16 : 0.4;
      title.current.style.letterSpacing = `${(from - t * range + Math.sin(journey.time * 0.2) * 0.004).toFixed(3)}em`;
      title.current.style.paddingLeft = title.current.style.letterSpacing;
    }
    const s = smoothstep(FINALE.full - 0.4, FINALE.full + 0.6, p);
    if (sub.current) {
      sub.current.style.opacity = s.toFixed(3);
      sub.current.style.transform = `translateY(${((1 - s) * 10).toFixed(1)}px)`;
    }
    if (actions.current) actions.current.style.opacity = smoothstep(FINALE.full + 0.2, FINALE.full + 1.0, p).toFixed(3);
  });
  return (
    <div className="finale" ref={el}>
      <h2 className="finale__title" ref={title}>
        Precision, revealed.
      </h2>
      <p className="finale__sub" ref={sub}>
        Every detail matters.
      </p>
      <div ref={actions}>
        <button
          type="button"
          className="finale__replay"
          onClick={() => {
            uiStore.set({ entered: true });
            scrollToUnits(0, { duration: 7 });
          }}
        >
          Replay the journey
        </button>
      </div>
      <p className="finale__legal">Élan is a fictional maison · A WebGL journey</p>
    </div>
  );
}
