import type { Weapon } from "../contracts.js";

// Placeholder design numbers to tune with C after play-testing.
export const RULES = {
  startingHealth: 100,
  startingWeapon: "gun" as Weapon,
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

export interface WeaponRules {
  damage: number;
  // Shooter is busy (can't block or fire) for this long after firing.
  windupMs: number;
  cooldownMs: number;
  flightMs: number;
}

export const WEAPONS: Record<Weapon, WeaponRules> = {
  rock: { damage: 20, windupMs: 300, cooldownMs: 3000, flightMs: rockFlightMs(MARS_GRAVITY) },
  // A slow bolt, so the defender can see it coming and block.
  gun: { damage: 20, windupMs: 0, cooldownMs: 1000, flightMs: 800 },
};
