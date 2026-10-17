// Local rehearsal state only. B's server remains authoritative for real matches.
export const worlds = {
  earth: { name: 'Earth', gravity: 9.8 },
  mars: { name: 'Mars', gravity: 3.7 },
  moon: { name: 'Moon', gravity: 1.6 },
} as const
export type World = keyof typeof worlds
export const flightSeconds = (world: World) => Number((0.8 * Math.sqrt(9.8 / worlds[world].gravity)).toFixed(2))
export type DemoState = {
  phase: 'cockpit' | 'invitation' | 'briefing' | 'duel' | 'result'
  world: World; health: number; rivalHealth: number; held: boolean
  incomingAt: number | null; blockUntil: number; nextAttackAt: number
  result: string; note: string; seen: string[]
}
export function initialState(): DemoState {
  return { phase: 'cockpit', world: 'mars', health: 100, rivalHealth: 100, held: false,
    incomingAt: null, blockUntil: 0, nextAttackAt: 0, result: '', note: 'Choose the training ship.', seen: [] }
}
export type Action =
  | { type: 'challenge' | 'accept' | 'decline' | 'launch' | 'reset' }
  | { type: 'world'; world: World }
  | { type: 'rival' | 'tick'; now: number }
  | { type: 'command'; name: 'startLift' | 'releaseRock' | 'cancelLift' | 'block'; id: string; now: number }
export function reduceDemo(state: DemoState, a: Action): DemoState {
  if (a.type === 'reset') return initialState()
  if (a.type === 'challenge' && state.phase === 'cockpit') return { ...state, phase: 'invitation', note: 'Training invitation pending. Use the simulated reply below.' }
  if (a.type === 'accept' && state.phase === 'invitation') return { ...state, phase: 'briefing', note: 'Simulated rival accepted. Select a world.' }
  if (a.type === 'decline' && state.phase === 'invitation') return { ...initialState(), note: 'Simulated rival declined. Try again.' }
  if (a.type === 'world' && state.phase === 'briefing') return { ...state, world: a.world }
  if (a.type === 'launch' && state.phase === 'briefing') return { ...state, phase: 'duel', note: 'Lift then throw. Use Incoming attack to rehearse Block.' }
  if (state.phase !== 'duel') return state
  if (a.type === 'rival' && state.incomingAt === null) return { ...state, incomingAt: a.now + flightSeconds(state.world) * 1000, note: 'Incoming simulated rock! Block before impact.' }
  if (a.type === 'tick' && state.incomingAt !== null && a.now >= state.incomingAt) {
    const blocked = state.blockUntil >= state.incomingAt
    const health = Math.max(0, state.health - (blocked ? 0 : 25))
    return { ...state, health, incomingAt: null, ...(health === 0 ? { phase: 'result', result: 'Training rival wins', held: false } : {}), note: blocked ? 'Blocked the simulated rock.' : 'Hit: −25 health.' }
  }
  if (a.type !== 'command' || state.seen.includes(a.id)) return state
  const next = { ...state, seen: [...state.seen, a.id] }
  if (a.name === 'block') return { ...next, blockUntil: Math.max(a.now + 500, state.incomingAt ?? 0), note: 'Block raised. Demo blocks the pending attack.' }
  if (a.name === 'cancelLift') return { ...next, held: false, note: 'Lift cancelled safely.' }
  if (a.name === 'startLift' && a.now >= state.nextAttackAt) return { ...next, held: true, note: 'Rock held. Close your fist or press Throw.' }
  if (a.name === 'releaseRock' && state.held && a.now >= state.nextAttackAt) {
    const rivalHealth = Math.max(0, state.rivalHealth - 25)
    return { ...next, held: false, rivalHealth, nextAttackAt: a.now + 3000,
      ...(rivalHealth === 0 ? { phase: 'result', result: 'You win the training duel' } : {}), note: 'Simulated hit: −25 rival health. Damage is immediate in this local rehearsal.' }
  }
  return next
}
