import type { DestinationId } from '../../destinations/config';
export type PlanetId =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

export type CinematicPhase =
  | 'idle'
  | 'activating'
  | 'roulette'
  | 'locked'
  | 'zooming'
  | 'flash'
  | 'video';

export interface PlanetaryCinematicState {
  phase: CinematicPhase;
  selectedPlanet: PlanetId;
}

export interface CinematicStep {
  state: PlanetaryCinematicState;
  durationMs: number;
}

const ROULETTE_STOPS: Array<{ planet: PlanetId; durationMs: number }> = [
  { planet: 'earth', durationMs: 65 },
  { planet: 'jupiter', durationMs: 75 },
  { planet: 'mercury', durationMs: 90 },
  { planet: 'venus', durationMs: 120 },
  { planet: 'saturn', durationMs: 175 },
  { planet: 'uranus', durationMs: 250 },
  { planet: 'neptune', durationMs: 350 },
  { planet: 'mars', durationMs: 475 },
];

export function buildPlanetarySequence(reducedMotion: boolean, destination: DestinationId = 'mars'): CinematicStep[] {
  // Reduced motion changes movement, not which destinations the user can read.
  const order = [...ROULETTE_STOPS.filter(s=>s.planet!==destination), ROULETTE_STOPS.find(s=>s.planet===destination)!];
  const stops = order.map((s,i)=>({...s,durationMs:ROULETTE_STOPS[i].durationMs}));

  return [
    {
      state: { phase: 'activating', selectedPlanet: 'earth' },
      durationMs: reducedMotion ? 180 : 700,
    },
    ...stops.map(({ planet, durationMs }) => ({
      state: { phase: 'roulette' as const, selectedPlanet: planet },
      durationMs,
    })),
    { state: { phase: 'locked', selectedPlanet: destination }, durationMs: reducedMotion ? 180 : 800 },
    { state: { phase: 'zooming', selectedPlanet: destination }, durationMs: reducedMotion ? 120 : 380 },
    { state: { phase: 'flash', selectedPlanet: destination }, durationMs: reducedMotion ? 80 : 120 },
    { state: { phase: 'video', selectedPlanet: destination }, durationMs: 0 },
  ];
}

/** Match the 3D animation's time cap; never skip a phase after a stalled frame. */
export function advanceCinematicFrame(
  steps: CinematicStep[], index: number, elapsedMs: number, deltaSeconds: number,
): { index: number; elapsedMs: number } {
  const duration = steps[index]?.durationMs ?? 0;
  if (duration <= 0) return { index, elapsedMs };
  const elapsed = elapsedMs + Math.min(Math.max(deltaSeconds, 0), 0.05) * 1000;
  if (elapsed >= duration) return { index: Math.min(index + 1, steps.length - 1), elapsedMs: 0 };
  return { index, elapsedMs: elapsed };
}
