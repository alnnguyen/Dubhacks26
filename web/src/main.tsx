import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

// Keep camera-debug styling separate from the cockpit's global stylesheet.
const cameraDebug = new URLSearchParams(window.location.search).has('camera');
const Screen = cameraDebug
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
  <StrictMode><Suspense fallback={<p>Loading flight systems…</p>}><Screen /></Suspense></StrictMode>,
);
