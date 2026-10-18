import { it, expect } from 'vitest';
import { commandBridge } from './liveCommands';
import type { BattleCommand } from '../vision/types';
const c = (name: BattleCommand['name'], id: string = name): BattleCommand => ({ name, commandId: id, matchId: 'debug', sessionId: 'pilot:uuid', sentAtMs: 1 });
it('maps only release and block; keeps lift/cancel local', () => {
  const bridge = commandBridge(() => 'safe_uuid');
  expect(bridge(c('startLift'))).toBeNull(); expect(bridge(c('cancelLift'))).toBeNull();
  expect(bridge(c('releaseRock'))).toEqual({ commandId: 'safe_uuid', type: 'throwRock' });
  expect(bridge(c('block'))?.type).toBe('startBlock');
});
it('retries preserve command identity, distinct inputs remain distinct', () => {
  let id = 0; const bridge = commandBridge(() => `command_${++id}`);
  const a = c('releaseRock', 'pilot:match:1');
  expect(bridge(a)).toEqual(bridge(a)); expect(id).toBe(1);
  expect(bridge(c('releaseRock', 'pilot:match:2'))?.commandId).toBe('command_2');
  expect(bridge(a)?.commandId).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
});
