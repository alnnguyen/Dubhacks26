import type { BattleCommand } from '../vision/types';
import type { Command } from '../../../server/src/contracts';

// C owns local palm/lift visuals; only deliberate release and shield activation reach B.
// B's commandId validator excludes C's colons. Preserve stable retry IDs via a map.
export function commandBridge(makeId: () => string = () => crypto.randomUUID()) {
  const mapped = new Map<string, Command>();
  return (input: BattleCommand): Command | null => {
    if (input.name !== 'releaseRock' && input.name !== 'block') return null;
    if (!mapped.has(input.commandId)) mapped.set(input.commandId, {
      commandId: makeId(), type: input.name === 'releaseRock' ? 'throwRock' : 'startBlock',
    });
    return mapped.get(input.commandId)!;
  };
}
