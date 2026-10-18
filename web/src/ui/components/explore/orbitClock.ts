import { useSyncExternalStore } from 'react';

/**
 * Shared simulated time for the satellite time-lapse. Seconds since each record's element epoch.
 * Presentation only: positions are a two-body illustration, not live tracking.
 */
export const ORBIT_RATES = [1, 60, 600] as const;
export type OrbitRate = (typeof ORBIT_RATES)[number];

interface ClockState { playing: boolean; rate: OrbitRate; held: boolean }
let inspectHold = false;
let state: ClockState = { playing: true, rate: 60, held: false };
let seconds = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const orbitClock = {
  get seconds() { return seconds; },
  /** Advance by a frame's real delta. Paused, held (parked at a satellite) or hidden tabs do not advance. */
  tick(dt: number) {
    if (state.playing && !state.held && !inspectHold && dt > 0) seconds += Math.min(dt, 0.1) * state.rate;
  },
  /** Hold while a spacecraft's side panel is open. */
  setInspectHold(hold: boolean) { inspectHold = hold; },
  setHeld(held: boolean) { if (state.held !== held) { state = { ...state, held }; emit(); } },
  toggle() { state = { ...state, playing: !state.playing }; emit(); },
  setRate(rate: OrbitRate) { state = { ...state, rate, playing: true }; emit(); },
  reset() { seconds = 0; emit(); },
  state: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

export function useOrbitClock() {
  return useSyncExternalStore(orbitClock.subscribe, orbitClock.state);
}
