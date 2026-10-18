import { useState } from 'react';
import { loadPilotIdentity, type PilotIdentity } from '../../app/pilotIdentity';
import '../../app/flight.css';
import { OnboardingScreen } from './OnboardingScreen';
import { SpaceshipHome } from './SpaceshipHome';

/** Default app shell: one-time onboarding, then Ally cockpit. */
export function BridgeApp() {
  const [identity, setIdentity] = useState<PilotIdentity | null>(() => loadPilotIdentity());

  if (!identity) {
    return <OnboardingScreen onComplete={setIdentity} />;
  }

  return (
    <>
      <SpaceshipHome />
      <div className="flight-demo-label" style={{ pointerEvents: 'auto' }}>
        {identity.callsign} · {identity.shipName} ·{' '}
        <a href="/?pvp=1" style={{ color: '#91e3ff' }}>
          Open real two-player duel →
        </a>
        {' · '}
        <button
          type="button"
          style={{
            background: 'transparent',
            border: 0,
            color: '#9db4cc',
            textDecoration: 'underline',
            cursor: 'pointer',
            font: 'inherit',
            padding: 0,
          }}
          onClick={() => {
            try {
              localStorage.removeItem('sd.pilot.identity.v1');
            } catch {
              /* ignore */
            }
            setIdentity(null);
          }}
        >
          Reset pilot
        </button>
      </div>
    </>
  );
}
