import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const search = new URLSearchParams(window.location.search);
// Alan's camera harness: /?camera=1 or /?debug=camera.
const cameraDebug = search.has('camera') || search.get('debug') === 'camera';
// Mars arena scene only (no camera/networking): /?arena=mars
const marsPreview = search.get('arena') === 'mars';
// Camera + CV + immersive Mars + detection diagnostics, no match: /?dev=mars
const devMars = search.get('dev') === 'mars';
// Standalone astronaut character creator: /avatar-creator (or /?avatar=1).
const avatarCreator = window.location.pathname.replace(/\/+$/, '') === '/avatar-creator' || search.has('avatar');
// Phone lightsaber controller, opened from the laptop's pair code: /?saber=CODE
const saberCode = search.get('saber');
// The saber arena with synthetic fighters, no camera/phone/server: /?dev=arena
const devArena = search.get('dev') === 'arena';

const Screen = avatarCreator
  ? lazy(async () => {
      const m = await import('./features/avatars/components/AvatarCreator');
      return { default: m.AvatarCreator };
    })
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
      : lazy(async () => {
          // Real flow: cockpit lobby → challenge → server-picked world → camera duel → result.
          const m = await import('./app/FlightApp');
          return { default: m.FlightApp };
        });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p>Loading flight systems…</p>}>
      <Screen />
    </Suspense>
  </StrictMode>,
);
