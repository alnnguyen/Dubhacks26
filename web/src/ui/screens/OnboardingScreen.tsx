import { FormEvent, useMemo, useState } from 'react';
import {
  ACCENTS,
  type AccentId,
  type PilotIdentity,
  sanitizeCallsign,
  sanitizeShipName,
  savePilotIdentity,
} from '../../app/pilotIdentity';
import '../styles/spaceship.css';
import './onboarding.css';

export function OnboardingScreen({ onComplete }: { onComplete: (identity: PilotIdentity) => void }) {
  const [callsign, setCallsign] = useState('STARHAWK');
  const [shipName, setShipName] = useState('Quiet Lance');
  const [accent, setAccent] = useState<AccentId>('cyan');

  const preview = useMemo(
    () => ({
      callsign: sanitizeCallsign(callsign) || 'PILOT',
      shipName: sanitizeShipName(shipName) || 'UNNAMED HULL',
      accent,
    }),
    [callsign, shipName, accent],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onComplete(savePilotIdentity(preview));
  }

  const accentMeta = ACCENTS.find((a) => a.id === accent)!;

  return (
    <main className="ob-root" style={{ ['--ob-accent' as string]: accentMeta.css }}>
      <div className="ob-panel">
        <p className="ob-eyebrow">Flight registration</p>
        <h1 className="ob-title">Name your pilot</h1>
        <p className="ob-lede">
          Hardcoded cosmetics for the demo — callsign, ship name, and hull glow. Nothing is purchased or
          unlocked.
        </p>

        <form className="ob-form" onSubmit={submit}>
          <label className="ob-field">
            <span>Callsign</span>
            <input
              value={callsign}
              maxLength={14}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="STARHAWK"
            />
          </label>

          <label className="ob-field">
            <span>Ship name</span>
            <input
              value={shipName}
              maxLength={22}
              autoComplete="off"
              onChange={(e) => setShipName(e.target.value)}
              placeholder="Quiet Lance"
            />
          </label>

          <fieldset className="ob-accents">
            <legend>Hull accent</legend>
            <div className="ob-accent-row">
              {ACCENTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="ob-accent"
                  data-active={accent === option.id}
                  style={{ ['--swatch' as string]: option.css }}
                  onClick={() => setAccent(option.id)}
                >
                  <span className="ob-swatch" />
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="ob-preview" aria-live="polite">
            <div className="ob-preview-emblem">{preview.callsign.slice(0, 2)}</div>
            <div>
              <strong>{preview.callsign}</strong>
              <p>
                Ship <em>{preview.shipName}</em> · {accentMeta.label}
              </p>
            </div>
          </div>

          <button type="submit" className="ob-submit" disabled={!preview.callsign || !preview.shipName}>
            Enter bridge
          </button>
        </form>
      </div>
    </main>
  );
}
