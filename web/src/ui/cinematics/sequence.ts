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

export function buildPlanetarySequence(reducedMotion: boolean): CinematicStep[] {
  const stops = reducedMotion
    ? [
        { planet: 'earth' as const, durationMs: 120 },
        { planet: 'mars' as const, durationMs: 180 },
      ]
    : ROULETTE_STOPS;

  return [
    {
      state: { phase: 'activating', selectedPlanet: 'earth' },
      durationMs: reducedMotion ? 180 : 700,
    },
    ...stops.map(({ planet, durationMs }) => ({
      state: { phase: 'roulette' as const, selectedPlanet: planet },
      durationMs,
    })),
    { state: { phase: 'locked', selectedPlanet: 'mars' }, durationMs: reducedMotion ? 180 : 800 },
    { state: { phase: 'zooming', selectedPlanet: 'mars' }, durationMs: reducedMotion ? 120 : 380 },
    { state: { phase: 'flash', selectedPlanet: 'mars' }, durationMs: reducedMotion ? 80 : 120 },
    { state: { phase: 'video', selectedPlanet: 'mars' }, durationMs: 0 },
  ];
}
