import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const search = new URLSearchParams(window.location.search);
// Alex rehearsal: /?pvp=1 → LiveDuel. Alan harness: /?debug=camera or legacy /?camera=1.
const cameraDebug = search.has('camera') || search.get('debug') === 'camera';
const live = search.has('pvp');
// Mars arena preview (no camera/networking): /?arena=mars
const marsPreview = search.get('arena') === 'mars';

const Screen = marsPreview
  ? lazy(async () => {
      const m = await import('./arena/MarsPreview');
      return { default: m.MarsPreview };
    })
  : live
  ? lazy(async () => {
      const m = await import('./app/LiveDuel');
      return { default: m.LiveDuel };
    })
  : cameraDebug
    ? lazy(async () => {
        await import('./styles.css');
        const m = await import('./camera/CameraDebugPage');
        return { default: m.CameraDebugPage };
      })
    : lazy(async () => {
        const m = await import('./ui/screens/SpaceshipHome');
        return { default: m.SpaceshipHome };
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
