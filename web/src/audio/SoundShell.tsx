import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { gameAudio, type AudioBus } from './gameAudio';
import './sound.css';
import { installButtonFeedback } from './buttonFeedback';

/** A single mixer across route changes. Phone controllers keep their own saber audio. */
export function SoundShell({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  return enabled ? <SoundSession>{children}</SoundSession> : children;
}
function SoundSession({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(gameAudio.subscribe, gameAudio.getSnapshot);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  useEffect(() => {
    gameAudio.restoreSettings();
    gameAudio.setHidden(document.hidden);
    const gesture = (event: Event) => {
      // Mixer buttons unlock explicitly; avoid changing Enable into Mute mid-click.
      if (event.target instanceof Element && event.target.closest('[data-audio-control]')) return;
      if (event instanceof KeyboardEvent && (event.repeat || event.metaKey || event.ctrlKey || event.altKey)) return;
      if (!gameAudio.getSnapshot().unlocked) void gameAudio.unlock();
    };
    const removeButtonFeedback = installButtonFeedback();
    const visibility = () => gameAudio.setHidden(document.hidden);
    document.addEventListener('pointerdown', gesture, true);
    document.addEventListener('keydown', gesture, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', gesture, true);
      document.removeEventListener('keydown', gesture, true);
      removeButtonFeedback();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const { settings, unlocked, unavailable } = snapshot;
  async function enable() { gameAudio.setMuted(false); await gameAudio.unlock(); }
  return <>{children}<aside className="sb-sound" aria-label="Game audio" data-audio-control>
    <div className="sb-sound__dock">
      {!unlocked ? <button type="button" onClick={() => void enable()}>{unavailable ? 'Retry sound' : 'Enable sound'}</button> :
        <button type="button" aria-label="Mute game audio" aria-pressed={settings.muted} onClick={() => gameAudio.setMuted(!settings.muted)}>{settings.muted ? 'SOUND OFF' : 'SOUND ON'}</button>}
      <button type="button" aria-label="Audio settings" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>MIX</button>
    </div>
    {open && <section className="sb-sound__panel" id={panelId} aria-label="Audio mixer">
      <div className="sb-sound__heading"><strong>SHIP AUDIO</strong><button type="button" aria-label="Close audio settings" onClick={() => setOpen(false)}>×</button></div>
      {(['master', 'music', 'ambience', 'effects'] as AudioBus[]).map(bus => <label key={bus}>
        <span>{bus}<output>{Math.round(settings[bus] * 100)}%</output></span>
        <input type="range" min="0" max="100" step="1" aria-label={`${bus} volume`} value={Math.round(settings[bus] * 100)} onChange={event => gameAudio.setVolume(bus, Number(event.target.value) / 100)} />
      </label>)}
      <p>Music softens while LYRA listens or speaks. Your mix is saved on this browser.</p>
      <button type="button" onClick={() => { void enable().then(() => gameAudio.play('click')); }}>TEST SOUND</button>
    </section>}
  </aside></>;
}
