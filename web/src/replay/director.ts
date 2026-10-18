import type { ArenaFrame, PlayerSlot, ReplayMoment, Vec3 } from '../../../server/src/contracts';
import { coversInterval, finishingImpact, recordedFrameAt, type ArenaRecording, type RecordedImpact } from './arenaRecording';

export type CameraAngle = 'orbit' | 'low' | 'overhead';
export interface DirectedShot extends ReplayMoment {
  source: 'perceptron' | 'server' | 'manual';
  angle: CameraAngle;
  impact: RecordedImpact | null;
  finisher: boolean;
}
export interface ReplayCursor { index: number; seconds: number; progress: number; cut: number; done: boolean; rate: number; hold: boolean }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function strongestImpact(recording: ArenaRecording, start: number, end: number) {
  return recording.impacts.filter(e => e.at >= start && e.at <= end)
    .sort((a, b) => b.event.damage - a.event.damage || a.at - b.at)[0] ?? null;
}
function shot(recording: ArenaRecording, m: ReplayMoment, source: DirectedShot['source'], index: number): DirectedShot {
  const angle = /duck|dodge|crouch/i.test(m.caption) ? 'low' : (['orbit', 'overhead', 'low'] as const)[index % 3];
  return { ...m, source, angle, impact: strongestImpact(recording, m.start, m.end), finisher: false };
}

/** Model observations choose ordinary scenes; the real knockout is always reserved for last. */
export function buildReel(recording: ArenaRecording, moments: ReplayMoment[]): DirectedShot[] {
  const finish = finishingImpact(recording);
  let finale: DirectedShot | null = null;
  if (finish) {
    const start = Math.max(0, finish.at - 2.5);
    const end = Math.min(recording.duration, finish.at + 0.12);
    if (end > start && coversInterval(recording, start, end)) finale = {
      start, end, caption: finish.weapon === 'gun' ? 'The finishing shot' : finish.weapon === 'rock' ? 'The finishing throw' : 'The finishing blow', source: 'server', angle: 'low', impact: finish, finisher: true,
    };
  }
  const selected: DirectedShot[] = [];
  const add = (m: ReplayMoment, source: DirectedShot['source']) => {
    const start = Math.max(0, m.start);
    const end = Math.min(m.end, start + 5, recording.duration, finale?.start ?? Infinity);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.6 || !coversInterval(recording, start, end)) return;
    if (selected.some(s => start < s.end && end > s.start)) return;
    selected.push(shot(recording, { start, end, caption: m.caption }, source, selected.length));
  };
  for (const m of moments) { if (selected.length >= (finale ? 2 : 3)) break; add(m, 'perceptron'); }
  // Never relabel a server fallback as AI output. No unselected fallback clips in an AI reel.
  if (!moments.length) {
    for (const impact of [...recording.impacts].sort((a, b) => b.event.damage - a.event.damage)) {
      if (selected.length >= (finale ? 2 : 3)) break;
      add({ start: Math.max(0, impact.at - 1.6), end: Math.min(recording.duration, impact.at + 0.5),
        caption: impact.event.outcome === 'blocked' ? 'Blade clash' : 'Confirmed hit' }, 'server');
    }
    if (!selected.length && !finale) {
      const first = recording.frames[0]?.at ?? 0;
      add({ start: first, end: Math.min(first + 5, recording.duration), caption: 'Arena recording' }, 'manual');
    }
  }
  return finale ? [...selected, finale] : selected;
}

interface Beat { sourceStart: number; sourceEnd: number; duration: number }
export function shotBeats(s: DirectedShot, reduced = false): Beat[] {
  if (reduced) return [{ sourceStart: s.start, sourceEnd: s.end, duration: s.end - s.start }];
  if (!s.impact) return [{ sourceStart: s.start, sourceEnd: s.end, duration: (s.end - s.start) / 0.7 }];
  const at = clamp(s.impact.at, s.start, s.end), slowAt = Math.max(s.start, at - 0.65);
  return [
    { sourceStart: s.start, sourceEnd: slowAt, duration: slowAt - s.start },
    { sourceStart: slowAt, sourceEnd: at, duration: (at - slowAt) / 0.24 },
    { sourceStart: at, sourceEnd: at, duration: 0.18 },
    { sourceStart: at, sourceEnd: s.end, duration: (s.end - at) / 0.55 },
    ...(s.finisher ? [{ sourceStart: s.end, sourceEnd: s.end, duration: 1.1 }] : []),
  ].filter(b => b.duration > 0.0001);
}
export const shotDuration = (s: DirectedShot, reduced = false) => shotBeats(s, reduced).reduce((n, b) => n + b.duration, 0);
export const reelDuration = (shots: DirectedShot[], reduced = false) => shots.reduce((n, s) => n + shotDuration(s, reduced), 0);
export const shotOffset = (shots: DirectedShot[], index: number, reduced = false) => shots.slice(0, index).reduce((n, s) => n + shotDuration(s, reduced), 0);

export function reelCursor(shots: DirectedShot[], elapsed: number, reduced = false): ReplayCursor | null {
  if (!shots.length) return null;
  let rest = Math.max(0, elapsed);
  for (let i = 0; i < shots.length; i++) {
    const duration = shotDuration(shots[i], reduced);
    if (rest < duration || i === shots.length - 1) {
      let beatTime = Math.min(rest, duration);
      for (const b of shotBeats(shots[i], reduced)) {
        if (beatTime <= b.duration) return { index: i,
          seconds: b.sourceStart + (b.sourceEnd - b.sourceStart) * clamp(beatTime / b.duration, 0, 1),
          progress: clamp(rest / duration, 0, 1), cut: rest, done: elapsed >= reelDuration(shots, reduced),
          rate: (b.sourceEnd - b.sourceStart) / b.duration, hold: b.sourceEnd === b.sourceStart };
        beatTime -= b.duration;
      }
      return { index: i, seconds: shots[i].end, progress: 1, cut: rest, done: true, rate: 0, hold: true };
    }
    rest -= duration;
  }
  return null;
}

export function impactPosition(frame: ArenaFrame, impact: RecordedImpact): Vec3 | null {
  const attacker = frame.players.find(p => p.slot === impact.event.attackerSlot);
  const defender = frame.players.find(p => p.slot !== impact.event.attackerSlot);
  const mid = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => (v + b[i]) / 2) as Vec3;
  if (impact.event.outcome === 'blocked' && (!impact.weapon || impact.weapon === 'saber') && attacker?.blade && defender?.blade) return mid(mid(attacker.blade.hilt, attacker.blade.tip), mid(defender.blade.hilt, defender.blade.tip));
  return defender?.joints?.[11] && defender.joints[12] ? mid(defender.joints[11], defender.joints[12]) : null;
}

export interface CameraPose { position: Vec3; target: Vec3; fov: number }
export function cinematicCamera(frame: ArenaFrame, s: DirectedShot, cursor: ReplayCursor, mySlot: PlayerSlot, reduced = false, override?: CameraAngle): CameraPose {
  const center = (slot: PlayerSlot): Vec3 => {
    const p = frame.players.find(p => p.slot === slot);
    return p?.joints?.[11] && p.joints[12] ? p.joints[11].map((v, i) => (v + p.joints![12][i]) / 2) as Vec3 : [0, 1.3, slot === 1 ? -0.65 : 0.65];
  };
  const a = center(mySlot), b = center(mySlot === 1 ? 2 : 1);
  const target: Vec3 = a.map((v, i) => (v + b[i]) / 2) as Vec3;
  const span = Math.hypot(a[0] - b[0], a[2] - b[2]);
  const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
  const right: [number, number] = [dz / len, -dx / len];
  const forward: [number, number] = [dx / len, dz / len];
  const angle = override ?? s.angle;
  let lateral = 3.4 + span * .55, longitudinal = -1.8, height = 1.5, fov = 48;
  if (angle === 'orbit') {
    const theta = reduced ? 0.35 : -0.45 + cursor.progress * 1.1;
    const radius = 3.5 + span * .65;
    lateral = Math.cos(theta) * radius; longitudinal = Math.sin(theta) * radius; height = 1.7;
  } else if (angle === 'overhead') { lateral = .9; longitudinal = -1.4; height = 4 + span * .8; fov = 52; }
  else { lateral = 2.8 + span * .6; longitudinal = -.5; height = .15; fov = 52; }
  const age = s.impact ? cursor.seconds - s.impact.at : Infinity;
  const punch = s.impact && age >= 0 && age < .35 && !reduced ? 1 - age / .35 : 0;
  if (s.finisher && s.impact && cursor.seconds >= s.impact.at - .65) fov -= reduced ? 0 : 5 * clamp((cursor.seconds - s.impact.at + .65) / .65, 0, 1);
  const shake = Math.sin(cursor.seconds * 125) * .045 * punch;
  return { target, fov, position: [
    target[0] + right[0] * lateral + forward[0] * longitudinal + shake,
    Math.max(.8, target[1] + height + shake * .4),
    target[2] + right[1] * lateral + forward[1] * longitudinal,
  ] };
}

export function impactAt(recording: ArenaRecording, seconds: number): RecordedImpact | null {
  return [...recording.impacts].reverse().find(e => seconds >= e.at && seconds - e.at < .35) ?? null;
}

export function sampledImpactPosition(recording: ArenaRecording, impact: RecordedImpact): Vec3 | null {
  const frame = recordedFrameAt(recording, impact.at);
  return frame ? impactPosition(frame, impact) : null;
}
