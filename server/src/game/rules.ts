import type { Weapon, World, WorldId } from "../contracts.js";

// Placeholder design numbers to tune with C after play-testing.
export const RULES = {
  startingHealth: 100,
  startingWeapon: "gun" as Weapon,
  blockLimitMs: 1500,
  blockCooldownMs: 2000,
  reconnectGraceMs: 15000,
  challengeExpiryMs: 30000,
};

// Rounded surface gravity, m/s², from NASA's Planetary Fact Sheet
// (https://nssdc.gsfc.nasa.gov/planetary/factsheet/), retrieved 2026-10-17.
const GRAVITY: Record<WorldId, { name: string; gravityMps2: number }> = {
  earth: { name: "Earth", gravityMps2: 9.8 },
  mars: { name: "Mars", gravityMps2: 3.7 },
  moon: { name: "Moon", gravityMps2: 1.6 },
};

export const WORLD_IDS = Object.keys(GRAVITY) as WorldId[];

// Gameplay mapping from real gravity to flight time, not projectile physics.
export function rockFlightMs(gravity: number): number {
  return Math.round(800 * Math.sqrt(9.8 / gravity));
}

export function world(id: WorldId): World {
  const { name, gravityMps2 } = GRAVITY[id];
  return { id, name, gravityMps2, rockFlightMs: rockFlightMs(gravityMps2) };
}

export interface WeaponRules {
  damage: number;
  // Shooter is busy (can't block or fire) for this long after firing.
  windupMs: number;
  cooldownMs: number;
  flightMs: number;
}

// Only the rock depends on the world's gravity.
export function weaponsFor(id: WorldId): Record<Weapon, WeaponRules> {
  return {
    rock: { damage: 20, windupMs: 300, cooldownMs: 3000, flightMs: world(id).rockFlightMs },
    // A slow bolt, so the defender can see it coming and block.
    gun: { damage: 20, windupMs: 0, cooldownMs: 1000, flightMs: 800 },
  };
}
