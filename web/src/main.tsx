import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { SoundShell } from './audio/SoundShell';
import './ui/styles/button-feedback.css';

const search = new URLSearchParams(window.location.search);
// Alan's camera harness: /?camera=1 or /?debug=camera.
const cameraDebug = search.has('camera') || search.get('debug') === 'camera';
// Mars arena scene only (no camera/networking): /?arena=mars
const marsPreview = search.get('arena') === 'mars';
// Camera + CV + immersive Mars + detection diagnostics, no match: /?dev=mars
const devMars = search.get('dev') === 'mars';
// Older same-link duel rehearsal (Alex): /?pvp=1
const live = search.has('pvp');
// Phone lightsaber controller, opened from the laptop's pair code: /?saber=CODE
const saberCode = search.get('saber');
// The saber arena with synthetic fighters, no camera/phone/server: /?dev=arena
const devArena = search.get('dev') === 'arena';

const explore = search.has('explore');
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
  : explore
  ? lazy(async () => { const m = await import('./ui/screens/ExploreApp'); return { default: m.ExploreApp }; })
  : devMars
  ? lazy(async () => {
      const m = await import('./arena/DevMars');
      return { default: m.DevMars };
    })
  : marsPreview
    ? lazy(async () => {
        const m = await import('./arena/MarsPreview');
        return { default: m.MarsPreview };
      })
    : cameraDebug
      ? lazy(async () => {
          // Keep camera-debug styling separate from the cockpit's global stylesheet.
          await import('./styles.css');
          const m = await import('./camera/CameraDebugPage');
          return { default: m.CameraDebugPage };
        })
      : live
        ? lazy(async () => {
            const m = await import('./app/LiveDuel');
            return { default: m.LiveDuel };
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
