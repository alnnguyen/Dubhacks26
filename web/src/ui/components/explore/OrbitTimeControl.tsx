import { useEffect, useState } from 'react';
import { ORBIT_RATES, orbitClock, useOrbitClock } from './orbitClock';

function clockText(seconds: number) {
  const s = Math.floor(seconds), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Satellite time-lapse: pause, real time, 60× or 600×. Simulated time since the snapshot epoch. */
export function OrbitTimeControl({ compact = false }: { compact?: boolean }) {
  const state = useOrbitClock();
  const [seconds, setSeconds] = useState(orbitClock.seconds);
  useEffect(() => {
    const id = setInterval(() => setSeconds(orbitClock.seconds), 250);
    return () => clearInterval(id);
  }, []);
  const status = !state.playing ? 'Paused' : state.held ? 'Held at spacecraft' : `${state.rate}× time-lapse`;
  return (
    <div className="gx-orbit-time" data-compact={compact} role="group" aria-label="Satellite orbit time-lapse">
      <p className="gx-orbit-time__head">
        <span>Orbit time</span>
        <b data-live={state.playing && !state.held}>{clockText(seconds)}</b>
      </p>
      <div className="gx-orbit-time__buttons">
        <button type="button" aria-pressed={!state.playing} onClick={() => orbitClock.toggle()} aria-label={state.playing ? 'Pause orbits' : 'Play orbits'}>
          {state.playing ? '❚❚' : '▶'}
        </button>
        {ORBIT_RATES.map((rate) => (
          <button key={rate} type="button" aria-pressed={state.playing && state.rate === rate} onClick={() => orbitClock.setRate(rate)}>{rate}×</button>
        ))}
        <button type="button" onClick={() => orbitClock.reset()} aria-label="Back to snapshot epoch" title="Back to snapshot epoch">⟲</button>
      </div>
      {!compact && <p className="gx-orbit-time__note">{status} · two-body propagation from a dated snapshot, not live tracking</p>}
    </div>
  );
}
