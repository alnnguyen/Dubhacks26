import type { BattleCommand } from '../vision/types';

/** Camera gestures that map onto Justin's createGameClient methods. */
export type LiveCombatAction = 'throwRock' | 'startBlock';

/**
 * C owns local palm/lift visuals; only deliberate release and shield reach B.
 * createGameClient owns server command IDs — this bridge only dedupes camera
 * commandIds so a repeated frame does not fire a second throw/block.
 */
export function commandBridge() {
  const fired = new Set<string>();
  return (input: BattleCommand): LiveCombatAction | null => {
    if (input.name !== 'releaseRock' && input.name !== 'block') return null;
    if (fired.has(input.commandId)) return null;
    fired.add(input.commandId);
    return input.name === 'releaseRock' ? 'throwRock' : 'startBlock';
  };
}
