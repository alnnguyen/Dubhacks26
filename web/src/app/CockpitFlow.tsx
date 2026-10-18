import { lazy, Suspense, useState } from 'react';
import { SpaceshipHome } from '../ui/screens/SpaceshipHome';
import type { NearbyPilot } from '../ui/state/lobbyTypes';

const LiveDuel = lazy(async () => ({ default: (await import('./LiveDuel')).LiveDuel }));

/**
 * Default app flow: cockpit lobby → accepted challenge (launch animation) →
 * live two-player duel on Justin's authoritative server → back to cockpit.
 * The duel auto-joins; once both pilots are in, the camera screen appears.
 */
export function CockpitFlow() {
  const [opponent, setOpponent] = useState<NearbyPilot | null>(null);
  if (!opponent) return <SpaceshipHome onEnterBattle={setOpponent} />;
  return (
    <Suspense fallback={<p style={{ color: '#f6e7da', padding: 24 }}>Entering the arena…</p>}>
      <LiveDuel autoJoin rivalLabel={opponent.callsign} onExit={() => setOpponent(null)} />
    </Suspense>
  );
}
