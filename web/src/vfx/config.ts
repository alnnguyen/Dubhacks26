export type Quality = 'low' | 'medium' | 'high';
/** Single control surface. These switches never affect game rules or inputs. */
export const VFX = {
  enabled: true, quality: 'high' as Quality, autoQuality: true,
  dust: true, haze: true, foregroundGrit: true, shafts: true, fog: true,
  impactFlash: true, sparks: true, shockwave: true, scorch: true, shieldRipple: true,
  impactLights: true, cameraShake: true, hitStop: true, hitReaction: true, bladeGlow: true, clashGlow: true,
  killingBlow: true, audio: true, postFX: true, bloom: true, vignette: true, noise: true, chromatic: true,
  duelingLights: true, wreck: true, entrances: true, reactiveLight: true, victory: true, pilotDetails: true,
  telemetry: false, // Enable to log measured renderer calls/triangles and rolling render FPS.
  windDirection: [0.9, 0.08, -0.25] as [number, number, number], hazeColor: '#B45A43',
};
export const TIERS = { low: { dust: 400, grit: 10, sparks: 20 }, medium: { dust: 1000, grit: 14, sparks: 28 }, high: { dust: 3500, grit: 20, sparks: 40 } };
export const POOL_SIZE = 30;
export const nextQuality = (quality: Quality): Quality => quality === 'high' ? 'medium' : 'low';
