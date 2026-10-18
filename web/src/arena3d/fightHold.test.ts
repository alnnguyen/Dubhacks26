import { describe, it, expect } from "vitest";
import { IDLE_HOLD, TRACKING_GRACE_MS, holdsFight, tickFightHold, trackingLossNote } from "./fightHold";

const live = { unlocked: true, active: true };

describe("fight hold through tracking gaps", () => {
  it("does nothing before both blades have been live", () => {
    const hold = tickFightHold(IDLE_HOLD, { ...live, fighting: false, nowMs: 100 });
    expect(hold).toBe(IDLE_HOLD);
    expect(holdsFight(hold, false, 100)).toBe(false);
  });

  it("keeps the arena up for the grace window after a mid-fight gap, then lets go", () => {
    let hold = tickFightHold(IDLE_HOLD, { ...live, fighting: true, nowMs: 1000 });
    expect(hold.started).toBe(true);
    hold = tickFightHold(hold, { ...live, fighting: false, nowMs: 5000 });
    expect(hold.lostAtMs).toBe(5000);
    expect(holdsFight(hold, false, 5000 + TRACKING_GRACE_MS - 1)).toBe(true);
    expect(holdsFight(hold, false, 5000 + TRACKING_GRACE_MS)).toBe(false);
  });

  it("covers the render between the gate dropping and the tick landing", () => {
    const hold = tickFightHold(IDLE_HOLD, { ...live, fighting: true, nowMs: 1000 });
    expect(holdsFight(hold, false, 1001)).toBe(true);
  });

  it("clears the gap once tracking returns, and keeps the earliest loss time while it lasts", () => {
    let hold = tickFightHold(IDLE_HOLD, { ...live, fighting: true, nowMs: 1000 });
    hold = tickFightHold(hold, { ...live, fighting: false, nowMs: 2000 });
    hold = tickFightHold(hold, { ...live, fighting: false, nowMs: 2500 });
    expect(hold.lostAtMs).toBe(2000);
    hold = tickFightHold(hold, { ...live, fighting: true, nowMs: 2600 });
    expect(hold).toEqual({ started: true, lostAtMs: null });
  });

  it("resets when the round's gate closes (rematch) or the match leaves active", () => {
    const started = tickFightHold(IDLE_HOLD, { ...live, fighting: true, nowMs: 1000 });
    expect(tickFightHold(started, { fighting: false, unlocked: false, active: true, nowMs: 1100 })).toBe(IDLE_HOLD);
    expect(tickFightHold(started, { fighting: false, unlocked: true, active: false, nowMs: 1100 })).toBe(IDLE_HOLD);
    // A fresh round must earn the hold again: no grace from the previous round.
    expect(holdsFight(IDLE_HOLD, false, 1200)).toBe(false);
  });
});

describe("tracking loss notice", () => {
  const ok = { youBody: true, youSaber: true, rivalArmed: true, serverFresh: true, rivalName: "Nova" };
  it("names the most actionable problem first", () => {
    expect(trackingLossNote({ ...ok, serverFresh: false, youBody: false })).toMatch(/Reconnecting/);
    expect(trackingLossNote({ ...ok, youBody: false, youSaber: false })).toMatch(/step back into view/);
    expect(trackingLossNote({ ...ok, youSaber: false })).toMatch(/Saber signal lost/);
    expect(trackingLossNote({ ...ok, rivalArmed: false })).toMatch(/Nova's tracking dropped/);
    expect(trackingLossNote(ok)).toMatch(/Restoring/);
  });
});
