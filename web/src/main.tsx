import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { SoundShell } from './audio/SoundShell';

const search = new URLSearchParams(window.location.search);
// Mars arena scene only (no camera/networking): /?arena=mars
const marsPreview = search.get('arena') === 'mars';
// Phone lightsaber controller, opened from the laptop's pair code: /?saber=CODE
const saberCode = search.get('saber');
// The saber arena with synthetic fighters, no camera/phone/server: /?dev=arena
const devArena = search.get('dev') === 'arena';

const soundCheck = search.get('audio') === 'check';
const Screen = soundCheck
  ? lazy(async () => { const m = await import('./audio/SoundCheck'); return { default: m.SoundCheck }; })
  : devArena
  ? lazy(async () => {
      const m = await import('./arena3d/ArenaPreview');
      return { default: m.ArenaPreview };
    })
  : saberCode
  ? lazy(async () => {
      const m = await import('./saber/SaberPhone');
      return { default: () => <m.SaberPhone code={saberCode} /> };
    })
  : marsPreview
    ? lazy(async () => {
        const m = await import('./arena/MarsPreview');
        return { default: m.MarsPreview };
      })
    : lazy(async () => {
        // Onboarding → cockpit; FlightApp (real lobby + duel) is next wiring step.
        const m = await import('./ui/screens/BridgeApp');
        return { default: m.BridgeApp };
      });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p>Loading flight systems…</p>}>
      <SoundShell enabled={!saberCode}><Screen /></SoundShell>
    </Suspense>
  </StrictMode>,
);
