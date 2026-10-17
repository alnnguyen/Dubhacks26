// Placeholder design numbers to tune with C after play-testing.
export const RULES = {
  startingHealth: 100,
  rockDamage: 20,
  throwWindupMs: 300,
  throwCooldownMs: 3000,
  blockLimitMs: 1500,
  blockCooldownMs: 2000,
  reconnectGraceMs: 15000,
};

// NASA Planetary Fact Sheet value. Fixed until the world wheel selects one.
export const MARS_GRAVITY = 3.7;

// Gameplay mapping from real gravity to flight time, not projectile physics.
export function rockFlightMs(gravity: number): number {
  return Math.round(800 * Math.sqrt(9.8 / gravity));
}
