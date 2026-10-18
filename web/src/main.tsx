import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const search = new URLSearchParams(window.location.search);
// Alan's camera harness: /?camera=1 or /?debug=camera.
const cameraDebug = search.has('camera') || search.get('debug') === 'camera';
// Mars arena scene only (no camera/networking): /?arena=mars
const marsPreview = search.get('arena') === 'mars';
// Camera + CV + immersive Mars + detection diagnostics, no match: /?dev=mars
const devMars = search.get('dev') === 'mars';
// Older same-link duel rehearsal (Alex): /?pvp=1
const live = search.has('pvp');
// Free-flight solar system + hyperspace: /?explore=1
const explore = search.has('explore');

const Screen = explore
  ? lazy(async () => {
      const m = await import('./ui/screens/ExploreApp');
      return { default: m.ExploreApp };
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
        : live
          ? lazy(async () => {
              const m = await import('./app/LiveDuel');
              return { default: m.LiveDuel };
            })
          : lazy(async () => {
              // Onboarding → cockpit; FlightApp (real lobby + Mars duel) is next wiring step.
              const m = await import('./ui/screens/BridgeApp');
              return { default: m.BridgeApp };
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
