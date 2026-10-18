import type { ArenaFrame, MatchResult, PlayerSlot, PlayerView, SaberResolved } from '../../../server/src/contracts';
import { blendFrames } from '../arena3d/arenaBuffer';

type RecordedWeapon = "saber" | "rock" | "gun"; // legacy replay labels only

export interface RecordedFrame { at: number; frame: ArenaFrame }
export interface RecordedImpact { at: number; event: SaberResolved; weapon?: RecordedWeapon }
export interface ArenaRecording {
  frames: RecordedFrame[];
  impacts: RecordedImpact[];
  duration: number;
  finishedAt: number | null;
  result: MatchResult | null;
  defeatedSlot: PlayerSlot | null;
}
const INITIAL_SECONDS = 45;
const TAIL_SECONDS = 12;
const MAX_FRAMES = 1900;
const MAX_IMPACTS = 240;

/** Local receipt times share the webcam's performance.now epoch; not synchronized server clocks. */
export function createArenaRecording() {
  let epoch: number | null = null;
  let active = false;
  let latest: RecordedFrame | null = null;
  let lastServerMs = -Infinity;
  let data: ArenaRecording = { frames: [], impacts: [], duration: 0, finishedAt: null, result: null, defeatedSlot: null };
  const retained = (at: number, now: number) => at <= INITIAL_SECONDS || at >= now - TAIL_SECONDS;
  function add(frame: ArenaFrame, at: number) {
    const last = data.frames.at(-1);
    if (last && at - last.at < 1 / 32) return;
    const copy = structuredClone(frame);
    data.frames = [...data.frames.filter(f => retained(f.at, at)), { at, frame: copy }].slice(-MAX_FRAMES);
    data.impacts = data.impacts.filter(e => retained(e.at, at));
    data.duration = Math.max(data.duration, at);
  }
  return {
    begin(atMs: number) {
      if (epoch !== null) return;
      epoch = atMs; active = true;
      if (latest && atMs - latest.at <= 250) add(latest.frame, 0);
    },
    frame(frame: ArenaFrame, receivedMs: number) {
      if (frame.serverMs <= lastServerMs) return;
      lastServerMs = frame.serverMs;
      latest = { at: receivedMs, frame };
      if (!active || epoch === null) return false;
      const at = Math.max(0, (receivedMs - epoch) / 1000);
      // One final tick may follow the finished view. Retain it for the terminal hit.
      if (data.finishedAt !== null && at > data.finishedAt + 0.2) return false;
      add(frame, at);
      return data.finishedAt !== null;
    },
    impact(event: SaberResolved, receivedMs: number, weapon: RecordedWeapon = 'saber') {
      if (!active || epoch === null || data.finishedAt !== null) return;
      const at = Math.max(0, (receivedMs - epoch) / 1000);
      const last = data.impacts.at(-1);
      if (last && at - last.at < 0.08 && last.weapon === weapon && last.event.attackerSlot === event.attackerSlot && last.event.outcome === event.outcome && last.event.damage === event.damage) return;
      data.impacts = [...data.impacts.filter(e => retained(e.at, at)), { at, event: { ...event }, weapon }].slice(-MAX_IMPACTS);
      data.duration = Math.max(data.duration, at);
    },
    finish(view: PlayerView, receivedMs: number) {
      if (!active || epoch === null || view.phase !== 'finished' || data.finishedAt !== null) return;
      data.finishedAt = Math.max(0, (receivedMs - epoch) / 1000);
      data.duration = Math.max(data.duration, data.finishedAt);
      data.result = view.result ? { ...view.result } : null;
      data.defeatedSlot = view.you.health === 0 ? view.you.slot : view.rival.health === 0 ? view.rival.slot : null;
    },
    pause() { active = false; },
    discard() { active = false; latest = null; data = { frames: [], impacts: [], duration: 0, finishedAt: null, result: null, defeatedSlot: null }; },
    snapshot(): ArenaRecording | null {
      return data.frames.length < 2 ? null : { ...data, frames: [...data.frames], impacts: [...data.impacts] };
    },
  };
}

/** Never interpolates across dropped tracking/recording gaps. */
export function recordedFrameAt(recording: ArenaRecording, seconds: number): ArenaFrame | null {
  const frames = recording.frames;
  if (!frames.length) return null;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (frames[mid].at <= seconds) lo = mid; else hi = mid - 1; }
  const a = frames[lo], b = frames[lo + 1];
  if (seconds < a.at - 0.15 || seconds - a.at > 0.5) return null;
  if (!b || b.at - a.at > 0.5 || seconds <= a.at) return a.frame;
  return blendFrames(a.frame, b.frame, Math.min(1, (seconds - a.at) / (b.at - a.at)));
}

export function coversInterval(recording: ArenaRecording, start: number, end: number): boolean {
  if (!recordedFrameAt(recording, start) || !recordedFrameAt(recording, end)) return false;
  const frames = recording.frames.filter(f => f.at >= start && f.at <= end);
  return frames.every((f, i) => !i || f.at - frames[i - 1].at <= 0.5);
}

export function finishingImpact(recording: ArenaRecording): RecordedImpact | null {
  const { result, finishedAt, defeatedSlot } = recording;
  if (result?.reason !== 'knockout' || result.winner === null || finishedAt === null || defeatedSlot === null || defeatedSlot === result.winner) return null;
  const last = recording.impacts.at(-1);
  // The actual terminal hit arrives immediately before the server's finished view.
  return last && last.event.outcome === 'hit' && last.event.damage > 0 && last.event.attackerSlot === result.winner && finishedAt - last.at >= 0 && finishedAt - last.at <= 0.2 ? last : null;
}
