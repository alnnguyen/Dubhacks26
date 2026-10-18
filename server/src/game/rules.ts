import type { World, WorldId } from "../contracts.js";

// Placeholder design numbers to tune with C after play-testing.
export const RULES = {
  startingHealth: 100,
  reconnectGraceMs: 15000,
  challengeExpiryMs: 30000,
  // Every round (the first and each rematch) counts down this long once both players are set up.
  countdownMs: 3000,
};

// Saber duel in the shared 3D arena, meters and seconds. Placeholders to tune
// with real players; speeds use server time between ticks.
export const SABER = {
  damage: 15,
  knockbackMeters: 0.65,
  bladeLength: 0.9,
  bladeRadius: 0.03,
  torsoRadius: 0.17,
  headRadius: 0.12,
  // Hips stand this high over the center of their hex (hex spacing is in hex.ts).
  hipHeight: 1.0,
  // A step glides to the next cell over stepMs; the next step can start stepCooldownMs after it lands.
  stepMs: 110,
  stepCooldownMs: 60,
  // Every voluntary step spends stamina, so nobody can run or dodge nonstop.
  // A sidestep (orbit) is the dodge and costs more than closing in or backing off:
  // a full bar is 7 steps in/out or 4 dodges. Knockback is free.
  staminaMax: 100,
  stepStamina: { forward: 14, back: 14, left: 24, right: 24 },
  // Refills from staminaRegenDelayMs after the last step: about one in/out step
  // per 1.2 s, or one dodge per 1.6 s, can be kept up indefinitely.
  staminaRegenPerSec: 28,
  staminaRegenDelayMs: 700,
  // A step that leaves too little for another leaves you winded: no steps
  // until stamina is back to this (about 2 s standing still).
  windedRecoverAt: 40,
  // Tip speed that starts a swing, and the lower speed that ends it.
  swingStartSpeed: 2.5,
  swingEndSpeed: 1.2,
  // A swing only counts (hits, blocks or guard breaks) once the tip has got this far
  // from where it started, in the swinger's own frame: a blade held out, or
  // shaking, never hurts someone who steps onto it.
  minSwingTravel: 0.3,
  // Guard break: any guard that's in the way blocks, but an attack swung along
  // the line of a guard held still (a vertical chop onto an upright guard, a
  // sideways slash onto a flat one, or the same diagonal), within this many
  // degrees as both players see it, breaks it and stuns the defender.
  guardMatchDeg: 30,
  // Stunned: no swings, no steps and no guard (the blade blocks nothing), long
  // enough for the attacker to follow up with a free hit.
  stunMs: 700,
  // A swing that hits or is blocked can't start again for this long.
  swingCooldownMs: 600,
  // A clash also briefly stops the defender from swinging back.
  recoilMs: 250,
  tickMs: 33,
  // Small enough that a fast swing can't pass through a guarding blade between checks.
  substeps: 10,
  // Inputs older than this mean no blade (tracking lost or the phone gone).
  staleMs: 300,
  // Faster than ~60 inputs/s per stream is dropped.
  minInputIntervalMs: 15,
};

// Rounded surface gravity, m/s², from NASA's Planetary Fact Sheet
// (https://nssdc.gsfc.nasa.gov/planetary/factsheet/), retrieved 2026-10-17.
const GRAVITY: Record<WorldId, { name: string; gravityMps2: number }> = {
  earth: { name: "Earth", gravityMps2: 9.8 },
  mars: { name: "Mars", gravityMps2: 3.7 },
  moon: { name: "Moon", gravityMps2: 1.6 },
  neptune: { name: "Neptune", gravityMps2: 11.2 },
};

export const WORLD_IDS = Object.keys(GRAVITY) as WorldId[];

export function world(id: WorldId): World {
  const { name, gravityMps2 } = GRAVITY[id];
  return { id, name, gravityMps2 };
}
