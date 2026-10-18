/**
 * Neptune reference data, split the same way as marsConfig.ts.
 *
 * `science` holds measured values from the NASA Neptune Fact Sheet and NASA
 * Science (verified 2026-10-18; sources in docs/neptune-sources.md).
 * `gameplay` holds the game mapping the authoritative server uses.
 * `render` holds artistic choices. Neptune has no solid surface: the combat
 * platform is fictional and the cloudscape is procedural, informed by Voyager 2
 * observations but not reconstructed from them.
 */

export const NEPTUNE_FACT_SHEET_URL = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html'

export interface Measured {
  value: number
  unit: string
  label: string
}

export const science = {
  gravity1Bar: { value: 11.27, unit: 'm/s²', label: 'Mean gravity at the 1 bar level' },
  equatorialRadius: { value: 24764, unit: 'km', label: 'Equatorial radius (1 bar)' },
  solarIrradiance: { value: 1.508, unit: 'W/m²', label: 'Solar irradiance' },
  meanDistance: { value: 30.07, unit: 'AU', label: 'Mean distance from the Sun' },
  temperature1Bar: { value: 72, unit: 'K', label: 'Temperature at 1 bar (≈ −201 °C)' },
  hydrogen: { value: 80.0, unit: '% H₂', label: 'Atmospheric hydrogen (by volume)' },
  helium: { value: 19.0, unit: '% He', label: 'Atmospheric helium (by volume)' },
  methane: { value: 1.5, unit: '% CH₄', label: 'Atmospheric methane (by volume)' },
  maxWind: { value: 580, unit: 'm/s', label: 'Fastest measured winds (fact sheet range 0–580)' },
  rotation: { value: 16.11, unit: 'h', label: 'Sidereal rotation period' },
  geometricAlbedo: { value: 0.442, unit: '', label: 'Geometric albedo' },
} as const satisfies Record<string, Measured>

/** Observations (not measurements) that steer the procedural sky. */
export const observations = [
  'Methane absorbs red light and reflects blue (NASA Science, Neptune facts).',
  'Bright high-altitude clouds are frozen methane cirrus above a darker, deeper cloud deck (Voyager 2, PIA00047, PIA02222).',
  'The 1989 Great Dark Spot was about Earth-sized, with bright companion clouds at its edge; it has since disappeared (Voyager 2, PIA00047; NASA Science).',
  'Winds are the fastest measured in the solar system and blow clouds in zonal bands (NASA fact sheet; NASA Science).',
  'Noon sunlight is roughly 1/900 of Earth’s and would look like dim twilight (NASA Science).',
] as const

/** Earth's solar irradiance from the same NASA fact-sheet series, for comparison. */
export const EARTH_SOLAR_IRRADIANCE = 1361.0

/** Must match server/src/game/rules.ts (the server is authoritative in matches). */
export const gameplay = {
  /** Rounded NASA value used by the game server for Neptune. */
  gravity: 11.2,
} as const

/**
 * Artistic rendering parameters. Real noon light is ~0.11% of Earth's, far too
 * dark to play in, so exposure is compensated; the sun is kept small and cool
 * and most light comes from blue scattered sky. Palette colors are sampled
 * from the final frame of the arrival cinematic so the video-to-3D handoff
 * matches; Voyager-era images were contrast-enhanced, and NASA notes Neptune's
 * true color is a paler blue.
 */
export const render = {
  sunlightVsEarth: science.solarIrradiance.value / EARTH_SOLAR_IRRADIANCE,
  sunDirection: [-0.55, 0.42, -0.72] as const,
  /** Sampled from the last frame of neptune-arrival.mp4 (center, top, lower windshield). */
  arrivalFog: { mid: '#0055a8', top: '#0276cf', low: '#00377d' },
  fog: { color: '#2f6fae', near: 60, far: 900 },
  sky: { zenith: '#06307a', horizon: '#4f97d8', sun: '#d6ecff' },
  deck: { deep: '#0f3a7a', mid: '#2a66ad', cirrus: '#d9f2ff' },
  ambient: { sky: '#8cc4f0', ground: '#0d2c58', intensity: 1.6 },
  sun: { color: '#dceeff', intensity: 2.4 },
  /** Cloud drift is scaled down from up to 580 m/s so bands read as slow motion at arena scale. */
  windDrift: [0.9, 0.55, 0.3] as const,
} as const

/** Platform size. Players orbit at up to 6 × 0.65 m apart (server/src/game/grid.ts). */
export const PLATFORM = {
  radius: 11,
  combatRadius: 5.2,
  thickness: 1.4,
} as const
