import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/AudioEngine';
import { journey, scrollToUnits, uiStore, useUI } from '../journey/journeyState';
import { CHAPTERS, JOURNEY_LENGTH } from '../journey/timeline';

function SoundToggle() {
  const on = useUI((s) => s.soundOn);
  const [supported] = useState(() => audio.available);
  if (!supported) return null;
  const toggle = async () => {
    if (on) {
      audio.disable();
      uiStore.set({ soundOn: false });
    } else {
      const ok = await audio.enable();
      uiStore.set({ soundOn: ok });
    }
  };
  return (
    <button
      type="button"
      className={`sound${on ? ' is-on' : ''}`}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
    >
      <span>Sound {on ? 'on' : 'off'}</span>
      <span className="sound__bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}

function ChapterRail() {
  const chapter = useUI((s) => s.chapter);
  const fill = useRef<HTMLDivElement>(null);
  const pct = useRef<HTMLDivElement>(null);
  const ticks = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const n = journey.progress / JOURNEY_LENGTH;
      if (fill.current) fill.current.style.transform = `scaleX(${n.toFixed(4)})`;
      if (pct.current) pct.current.textContent = String(Math.round(n * 100)).padStart(3, '0');
      ticks.current.forEach((t, i) => t?.classList.toggle('is-past', journey.progress >= CHAPTERS[i].start - 0.01));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const current = CHAPTERS[chapter];
  return (
    <nav className="rail" aria-label="Journey chapters">
      <div className="rail__current" aria-live="polite">
        <span className="rail__num">{current.index}</span>
        <span className="rail__dash" />
        <span className="rail__label" key={current.id}>
          {current.label}
        </span>
      </div>
      <div className="rail__track">
        <div className="rail__line" />
        <div className="rail__fill" ref={fill} />
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => {
              ticks.current[i] = el;
            }}
            type="button"
            className="rail__tick"
            style={{ left: `${(c.start / JOURNEY_LENGTH) * 100}%` }}
            onClick={() => {
              uiStore.set({ entered: true });
              scrollToUnits(c.anchor);
            }}
            aria-label={`Go to chapter ${c.index}, ${c.label}`}
          >
            <span className="rail__tip">
              {c.index} — {c.label}
            </span>
          </button>
        ))}
      </div>
      <div className="rail__pct" ref={pct}>
        000
      </div>
    </nav>
  );
}

export function Chrome() {
  const ready = useUI((s) => s.ready);
  return (
    <div className={`chrome${ready ? ' is-on' : ''}`}>
      <header className="header">
        <a
          className="wordmark"
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToUnits(0);
          }}
          aria-label="ÉLAN — back to the beginning"
        >
          ÉLAN <small>Maison · Genève</small>
        </a>
        <SoundToggle />
      </header>
      <ChapterRail />
    </div>
  );
}
