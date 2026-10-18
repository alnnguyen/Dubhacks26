import { useMemo } from 'react';
import { CinematicReplay } from './CinematicReplay';
import { syntheticMoments, syntheticRecording } from './syntheticArena';
import '../app/flight.css';

export function ReplayPreview() {
  const recording = useMemo(syntheticRecording, []);
  return <main className="flight-flow"><section className="flight-panel">
    <p className="flight-eyebrow">DEVELOPER PREVIEW / SYNTHETIC</p>
    <h1>Cinematic arena replay</h1>
    <p>Synthetic fighters, simulated outcomes and fixture highlight captions. No camera, multiplayer match or Perceptron inference is running.</p>
    <CinematicReplay recording={recording} moments={syntheticMoments} board={{cellSize:.65,rows:3}} mySlot={1} fixture />
  </section></main>;
}
