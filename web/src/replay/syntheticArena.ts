import type { ArenaFrame, PlayerSlot, ReplayMoment, Vec3 } from '../../../server/src/contracts';
import type { ArenaRecording } from './arenaRecording';

/** Explicit developer fixture, never used as a real match or model result. */
export function syntheticFrame(t: number): ArenaFrame {
  // Show an actual cell-wide sidestep in the preview, then return for the finale.
  const step = t < 4.4 ? 0 : t < 5.1 ? (t - 4.4) / .7 : t < 7.2 ? 1 : t < 8 ? 1 - (t - 7.2) / .8 : 0;
  const world = (p: Vec3, slot: PlayerSlot): Vec3 => slot === 1 ? [p[0] + step * .65, p[1] + 1, p[2] - .65] : [-p[0], p[1] + 1, .65 - p[2]];
  const body = (slot: PlayerSlot): Vec3[] => {
    const j: Vec3[] = Array.from({ length: 33 }, () => [0, 0, 0]);
    j[0] = [0, .76, .03]; j[11] = [-.23, .51, 0]; j[12] = [.23, .51, 0];
    j[13] = [-.38, .24, .15]; j[14] = [.37, .30, .19];
    j[15] = [-.32, .12, .27]; j[16] = [.32 + Math.sin(t * 3) * .12, .25, .35];
    j[23] = [-.13, 0, 0]; j[24] = [.13, 0, 0];
    j[25] = [-.15, -.43, .06]; j[26] = [.15, -.43, -.03];
    j[27] = [-.15, -.90, .08]; j[28] = [.15, -.90, -.03];
    return j.map(p => world(p, slot));
  };
  return { serverMs: t * 1000, engaged: true, players: ([1, 2] as const).map(slot => {
    const joints = body(slot), hilt = joints[slot === 1 ? 16 : 15];
    const angle = Math.sin(t * 3.4 + (slot === 1 ? 0 : .8)) * 1.1;
    const direction: Vec3 = slot === 1 ? [Math.sin(angle), .15, Math.cos(angle)] : [.12, .9, -.1];
    const norm = Math.hypot(...direction);
    return { slot, cell: { q: slot === 1 && step > .5 ? 1 : 0, r: slot === 1 ? -1 : 1 }, facing: [0, slot === 1 ? 1 : -1], joints,
      blade: { hilt, tip: hilt.map((v, i) => v + direction[i] / norm * .9) as Vec3 }, swinging: slot === 1, stamina: 100, winded: false, stunned: false };
  }) };
}
export function syntheticRecording(): ArenaRecording {
  return { frames: Array.from({ length: 320 }, (_, i) => ({ at: i / 30, frame: syntheticFrame(i / 30) })),
    impacts: [
      { at: 3.3, event: { attackerSlot: 1, outcome: 'blocked', damage: 0 } },
      { at: 6.7, event: { attackerSlot: 2, outcome: 'hit', damage: 20 } },
      { at: 10.5, event: { attackerSlot: 1, outcome: 'hit', damage: 20 } },
    ], duration: 319 / 30, finishedAt: 10.52, result: { winner: 1, reason: 'knockout' }, defeatedSlot: 2 };
}
export const syntheticMoments: ReplayMoment[] = [
  { start: 2.2, end: 4.5, caption: 'Guard meets a sweeping strike' },
  { start: 5.2, end: 7.8, caption: 'A quick counterattack' },
];
