import { describe, it, expect } from 'vitest'
import { initialState, reduceDemo, flightSeconds, type DemoState } from './state'
const duel = (): DemoState => ({ ...initialState(), phase: 'duel' })
const command = (state: DemoState, name: 'startLift' | 'releaseRock' | 'cancelLift' | 'block', now: number, id = String(now)) => reduceDemo(state, { type: 'command', name, now, id })
describe('explicit local rehearsal', () => {
  it('requires a pending invitation and briefing before entering duel', () => {
    expect(reduceDemo(initialState(), { type: 'accept' }).phase).toBe('cockpit')
    let s = reduceDemo(initialState(), { type: 'challenge' })
    s = reduceDemo(s, { type: 'accept' }); expect(s.phase).toBe('briefing')
    expect(reduceDemo(s, { type: 'launch' }).phase).toBe('duel')
  })
  it('does no damage from an unheld release or repeated command', () => {
    expect(command(duel(), 'releaseRock', 0).rivalHealth).toBe(100)
    let s = command(duel(), 'startLift', 1)
    s = command(s, 'releaseRock', 2)
    expect(s.rivalHealth).toBe(75)
    expect(command(s, 'releaseRock', 2).rivalHealth).toBe(75)
  })
  it('cancel prevents release and cooldown rejects early lift', () => {
    let s = command(duel(), 'startLift', 1)
    s = command(s, 'cancelLift', 2)
    expect(command(s, 'releaseRock', 3).rivalHealth).toBe(100)
    s = command(s, 'startLift', 4); s = command(s, 'releaseRock', 5)
    expect(command(s, 'startLift', 6).held).toBe(false)
  })
  it('pending attack resolves once and blocking protects health', () => {
    let s = reduceDemo(duel(), { type: 'rival', now: 0 })
    s = command(s, 'block', 10)
    expect(reduceDemo(s, { type: 'tick', now: 5000 }).health).toBe(100)
    s = reduceDemo(duel(), { type: 'rival', now: 0 })
    s = reduceDemo(s, { type: 'tick', now: 5000 })
    expect(reduceDemo(s, { type: 'tick', now: 6000 }).health).toBe(75)
  })
  it('ends at zero and ignores later combat commands', () => {
    let s = { ...duel(), rivalHealth: 25 }
    s = command(s, 'startLift', 1); s = command(s, 'releaseRock', 2)
    expect(s.phase).toBe('result'); expect(s.rivalHealth).toBe(0)
    expect(command(s, 'startLift', 5000)).toEqual(s)
    expect(reduceDemo(s, { type: 'reset' })).toEqual(initialState())
  })
  it('uses the designed gravity mapping', () => {
    expect(flightSeconds('earth')).toBe(.8)
    expect(flightSeconds('mars')).toBe(1.3)
    expect(flightSeconds('moon')).toBe(1.98)
  })
})
