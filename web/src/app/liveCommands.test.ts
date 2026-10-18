import { it, expect } from 'vitest';
import { commandBridge } from './liveCommands';
import type { BattleCommand } from '../vision/types';

const c = (name: BattleCommand['name'], id: string = name): BattleCommand => ({
  name,
  commandId: id,
  matchId: 'debug',
  sessionId: 'pilot:uuid',
  sentAtMs: 1,
});

it('maps only release and block; keeps lift/cancel local', () => {
  const bridge = commandBridge();
  expect(bridge(c('startLift'))).toBeNull();
  expect(bridge(c('cancelLift'))).toBeNull();
  expect(bridge(c('releaseRock'))).toBe('throwRock');
  expect(bridge(c('block', 'block-1'))).toBe('startBlock');
});

it('dedupes the same camera commandId; distinct inputs still fire', () => {
  const bridge = commandBridge();
  const a = c('releaseRock', 'pilot-match-1');
  expect(bridge(a)).toBe('throwRock');
  expect(bridge(a)).toBeNull();
  expect(bridge(c('releaseRock', 'pilot-match-2'))).toBe('throwRock');
});
