import { useUI } from '../journey/journeyState';

export function Loader() {
  const progress = useUI((s) => s.loadProgress);
  const label = useUI((s) => s.loadLabel);
  const ready = useUI((s) => s.ready);
  const pct = Math.round(progress * 100);
  return (
    <div className={`loader${ready ? ' is-done' : ''}`} aria-live="polite" aria-busy={!ready}>
      <p className="loader__label">Preparing your journey</p>
      <div className="loader__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className="loader__pct">{String(pct).padStart(2, '0')}</div>
      <div className="loader__step">{label}</div>
      <div className="loader__mark">ÉLAN</div>
    </div>
  );
}
