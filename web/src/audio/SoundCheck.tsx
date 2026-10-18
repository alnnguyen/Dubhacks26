import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { gameAudio, type AudioScene, type SoundId } from './gameAudio';
import { useAudioScene } from './useAudioScene';
import './sound.css';

/** Local listening room: no game connection, camera, microphone, or API call. */
export function SoundCheck() {
  const [scene, setScene] = useState<AudioScene | null>(null);
  const [status, setStatus] = useState('Choose a scene to start listening.');
  useAudioScene(scene);
  const cueStop = useRef<(() => void) | null>(null);
  useEffect(() => () => cueStop.current?.(), []);
  const audioState = useSyncExternalStore(gameAudio.subscribe, gameAudio.getSnapshot);
  async function choose(next: AudioScene) {
    cueStop.current?.();
    gameAudio.setMuted(false);
    const ok = await gameAudio.unlock();
    setScene(next); setStatus(ok ? `${next.toUpperCase()} — music and ambience active` : 'Tap Enable sound to retry.');
  }
  async function cue(id: SoundId, label: string) {
    if (await gameAudio.unlock()) { cueStop.current?.(); cueStop.current = gameAudio.play(id); setStatus(`${label} — cue requested`); }
  }
  const cues: Array<[SoundId, string]> = [['lyraHello','LYRA hello'],['click','UI click'],['commit','Radar / hyperspace'],['back','Back buttons'],['saberClash','Saber clash'],['saberHit','Saber hit'],['saberBlock','Saber block'],['saberKo','Saber KO'],['introJump','Onboarding hyperspace'],['clash','Matchup clash'],['flyby','Ship flyby'],['charge','Rocket charge'],['jump','Short jump'],['arrive','Mars arrival']];
  return <main className="sound-check">
    <p>KO.rbit / AUDIO LISTENING ROOM</p><h1>HEAR THE <span>GALAXY</span></h1>
    <p>Audition the supplied Grok asset pack at the game’s default mix. Switch scenes to hear the music change; try a travel cue over the cockpit bed.</p>
    <p className="sound-check__status" role="status">{status}<br />Playing loops: {audioState.loops.join(", ") || "none"}{audioState.lastCue && <><br />Last decoded cue: {audioState.lastCue}</>}{audioState.error && <><br />{audioState.error}</>}</p>
    <section><h2>SCENE BEDS</h2><div className="sound-check__buttons">{(['onboarding','cockpit','briefing','battle'] as const).map(next => <button key={next} type="button" aria-pressed={scene===next} onClick={() => void choose(next)}>{next.toUpperCase()}</button>)}<button type="button" onClick={() => { setScene(null); setStatus('Music and ambience stopped.'); }}>STOP BEDS</button></div></section>
    <section><h2>TRANSITION & UI EFFECTS</h2><div className="sound-check__buttons">{cues.map(([id,label]) => <button key={id} type="button" onClick={() => void cue(id,label)}>{label}</button>)}</div></section>
    <section><h2>VOICE MIX</h2><p>Toggle to hear the background soften, as it does while LYRA listens or speaks.</p><DuckButton /></section>
    <p>Music starts after a user action. Use SOUND / MIX at the bottom right for mute and separate music, ambience, and effects levels. This listening room makes no multiplayer or provider connection.</p>
  </main>;
}
function DuckButton() {
  const [release, setRelease] = useState<(() => void) | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  releaseRef.current = release;
  useEffect(() => () => releaseRef.current?.(), []);
  return <button type="button" aria-pressed={!!release} onClick={() => {
    if (release) { release(); setRelease(null); }
    else { const stop = gameAudio.duck(); setRelease(() => stop); }
  }}>{release ? 'RESTORE MUSIC' : 'SIMULATE LYRA DUCKING'}</button>;
}
