import { describe, expect, it } from 'vitest';
import { buildPlanetarySequence } from './sequence';

describe('planetary travel sequence', () => {
  it('decelerates through destinations and always locks Mars', () => {
    const sequence = buildPlanetarySequence(false);
    const rouletteStops = sequence.filter((step) => step.state.phase === 'roulette');
    const totalMs = sequence.reduce((total, step) => total + step.durationMs, 0);

    expect(rouletteStops).toHaveLength(8);
    expect(rouletteStops.at(-1)?.state.selectedPlanet).toBe('mars');
    expect(rouletteStops.slice(1).every((step, index) => step.durationMs > rouletteStops[index].durationMs)).toBe(true);
    expect(rouletteStops.reduce((total, step) => total + step.durationMs, 0)).toBe(1600);
    expect(sequence.find((step) => step.state.phase === 'activating')?.durationMs).toBe(700);
    expect(sequence.find((step) => step.state.phase === 'locked')?.state.selectedPlanet).toBe('mars');
    expect(sequence.find((step) => step.state.phase === 'locked')?.durationMs).toBe(800);
    expect(sequence.find((step) => step.state.phase === 'zooming')?.durationMs).toBe(380);
    expect(sequence.find((step) => step.state.phase === 'flash')?.durationMs).toBe(120);
    expect(sequence.at(-1)?.state).toEqual({ phase: 'video', selectedPlanet: 'mars' });
    expect(totalMs).toBe(3600);
  });

  it('shortens the sequence when reduced motion is enabled', () => {
    const full = buildPlanetarySequence(false);
    const reduced = buildPlanetarySequence(true);
    const duration = (steps: typeof full) => steps.reduce((total, step) => total + step.durationMs, 0);

    expect(duration(reduced)).toBeLessThan(duration(full));
    expect(duration(reduced)).toBeLessThan(900);
    expect(reduced.filter((step) => step.state.phase === 'roulette').at(-1)?.state.selectedPlanet).toBe('mars');
  });
});
