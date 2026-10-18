import { describe, expect, it } from 'vitest';
import { advanceCinematicFrame, buildPlanetarySequence } from './sequence';

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

  it('preserves every selection with reduced motion while shortening transitions', () => {
    const full = buildPlanetarySequence(false);
    const reduced = buildPlanetarySequence(true);
    const duration = (steps: typeof full) => steps.reduce((total, step) => total + step.durationMs, 0);

    expect(duration(reduced)).toBeLessThan(duration(full));
    const stops = (steps: typeof full) => steps.filter((step) => step.state.phase === 'roulette');
    expect(stops(reduced)).toEqual(stops(full));
    expect(reduced.filter((step) => step.state.phase === 'roulette').at(-1)?.state.selectedPlanet).toBe('mars');
  });
});


describe('rendered cinematic clock', () => {
  it('does not fast-forward through a phase after a long render stall', () => {
    const steps = buildPlanetarySequence(false);
    expect(advanceCinematicFrame(steps, 0, 100, 5)).toEqual({ index: 0, elapsedMs: 150 });
  });

  it('shows every stop even when a stall crosses a short stop boundary', () => {
    const steps = buildPlanetarySequence(false);
    expect(advanceCinematicFrame(steps, 1, 60, 10)).toEqual({ index: 2, elapsedMs: 0 });
  });

  it('preserves normal playback duration at 60 fps and holds at the video', () => {
    const steps = buildPlanetarySequence(false);
    let cursor = { index: 0, elapsedMs: 0 };
    let frames = 0;
    while (cursor.index < steps.length - 1 && frames < 300) {
      cursor = advanceCinematicFrame(steps, cursor.index, cursor.elapsedMs, 1 / 60);
      frames++;
    }
    expect(frames / 60).toBeGreaterThanOrEqual(3.6);
    expect(frames / 60).toBeLessThan(3.9);
    expect(advanceCinematicFrame(steps, cursor.index, 0, 10)).toEqual(cursor);
  });
});

it('locks and zooms the chosen destination while retaining all eight roulette stops',()=>{
 for(const destination of ['mars','neptune'] as const){
  const steps=buildPlanetarySequence(false,destination);
  const stops=steps.filter(s=>s.state.phase==='roulette');
  expect(new Set(stops.map(s=>s.state.selectedPlanet)).size).toBe(8);
  expect(stops.at(-1)?.state.selectedPlanet).toBe(destination);
  expect(steps.filter(s=>['locked','zooming','flash','video'].includes(s.state.phase)).every(s=>s.state.selectedPlanet===destination)).toBe(true);
 }
});
