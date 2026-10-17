import { useEffect, useId, useState } from 'react';
import { HoloButton, HoloPanel } from './primitives';
import type { ConnectionStatus, SceneSettings } from '../../state/lobbyTypes';

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="sd-row">
      <label htmlFor={id} className="sd-row__label">
        {label}
        {hint && <span className="sd-row__hint">{hint}</span>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} className="sd-switch" onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

export interface SettingsPanelProps {
  open: boolean;
  settings: SceneSettings;
  callsign: string;
  connection: ConnectionStatus;
  autoDowngraded: boolean;
  onChange: (s: SceneSettings) => void;
  onCallsign: (c: string) => void;
  onClose: () => void;
  /** Mock-only controls; omit when wired to real multiplayer. */
  dev?: { simulateIncoming: () => void; setOffline: (offline: boolean) => void };
}

export function SettingsPanel({ open, settings, callsign, connection, autoDowngraded, onChange, onCallsign, onClose, dev }: SettingsPanelProps) {
  const [draft, setDraft] = useState(callsign);
  useEffect(() => setDraft(callsign), [callsign, open]);
  const inputId = useId();
  return (
    <HoloPanel open={open} title="Systems" eyebrow="Ship settings // Port console" side="right" onClose={onClose}>
      <form
        className="sd-row sd-row--stack"
        onSubmit={(e) => {
          e.preventDefault();
          onCallsign(draft.trim());
        }}
      >
        <label htmlFor={inputId} className="sd-row__label">
          Callsign
        </label>
        <div className="sd-inline">
          <input
            id={inputId}
            className="sd-input"
            value={draft}
            maxLength={14}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
          />
          <HoloButton variant="primary" type="submit" disabled={!draft.trim() || draft.trim() === callsign}>
            Save
          </HoloButton>
        </div>
      </form>

      <div className="sd-row">
        <span className="sd-row__label">
          Graphics
          <span className="sd-row__hint">{autoDowngraded ? 'Lowered automatically for smooth frame rate' : 'Low disables bloom and lowers resolution'}</span>
        </span>
        <div className="sd-seg" role="radiogroup" aria-label="Graphics quality">
          {(['high', 'low'] as const).map((q) => (
            <button key={q} type="button" role="radio" aria-checked={settings.quality === q} onClick={() => onChange({ ...settings, quality: q })}>
              {q}
            </button>
          ))}
        </div>
      </div>
      <Toggle label="Reduce motion" hint="Stops camera drift and slows holograms" checked={settings.reducedMotion} onChange={(v) => onChange({ ...settings, reducedMotion: v })} />
      <Toggle label="Camera parallax" hint="Lean the view with mouse or drag" checked={settings.parallax} onChange={(v) => onChange({ ...settings, parallax: v })} />

      {dev && (
        <div className="sd-dev">
          <p className="sd-eyebrow">Mock lobby controls</p>
          <div className="sd-inline">
            <HoloButton size="sm" onClick={dev.simulateIncoming}>
              Simulate incoming
            </HoloButton>
            <HoloButton size="sm" onClick={() => dev.setOffline(connection !== 'offline')}>
              {connection === 'offline' ? 'Reconnect' : 'Go offline'}
            </HoloButton>
          </div>
        </div>
      )}
    </HoloPanel>
  );
}
