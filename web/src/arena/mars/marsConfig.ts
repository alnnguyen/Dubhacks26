/**
 * Mars reference data.
 *
 * `science` holds measured planetary values from the NASA Mars Fact Sheet
 * (verified 2026-10-17). `gameplay` holds the team's agreed game mapping,
 * which the authoritative server also uses. `render` holds artistic choices.
 * Never feed `science` values straight into rendering parameters.
 */

export const MARS_FACT_SHEET_URL = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'

export interface Measured {
  value: number
  unit: string
  label: string
}

export const science = {
  surfaceGravity: { value: 3.73, unit: 'm/s²', label: 'Surface gravity' },
  gravityRelativeToEarth: { value: 0.38, unit: '× Earth', label: 'Gravity vs Earth' },
  surfacePressure: { value: 6.36, unit: 'mbar', label: 'Mean surface pressure' },
  meanTemperature: { value: 214, unit: 'K', label: 'Mean temperature (≈ −59 °C)' },
  co2Fraction: { value: 95.1, unit: '% CO₂', label: 'Atmospheric CO₂' },
  solarIrradiance: { value: 586.2, unit: 'W/m²', label: 'Solar irradiance' },
  solarDay: { value: 24.6597, unit: 'h', label: 'Solar day (sol)' },
  meanRadius: { value: 3389.5, unit: 'km', label: 'Mean radius' },
} as const satisfies Record<string, Measured>

/** Earth's solar irradiance from the same NASA fact-sheet series, for comparison. */
export const EARTH_SOLAR_IRRADIANCE = 1361.0

/** Must match server/src/game/rules.ts (the server is authoritative in matches). */
const GAMEPLAY_GRAVITY = 3.7

export const gameplay = {
  /** Rounded NASA gravity used by the game server for Mars. */
  gravity: GAMEPLAY_GRAVITY,
} as const

export const site = {
  name: 'Jezero Crater',
  centerLatDeg: 18.38,
  centerLonDegE: 77.58,
  note: 'Perseverance landing region; ancient lake basin with a sedimentary delta.',
} as const

/**
 * Artistic rendering parameters. Sunlight is ~43% of Earth's (586.2 / 1361),
 * which informs a slightly dimmer, warmer key light — it is not a direct
 * Three.js intensity. Fog density is purely visual, not derived from pressure.
 */
export const render = {
  sunlightVsEarth: science.solarIrradiance.value / EARTH_SOLAR_IRRADIANCE,
  sunElevationDeg: 14,
  sunAzimuthDeg: 235,
  /** Linear haze: the MOLA crater rim (~400–900 m away) stays visible but muted. */
  fog: { color: '#a8795a', near: 18, far: 1500 },
  sky: { zenith: '#4e3428', horizon: '#c28d66', sunHalo: '#a9bccd', ground: '#8c6148' },
  sun: { color: '#ffe2c4', intensity: 2.6 },
  ambient: { sky: '#c89a78', ground: '#3d2418', intensity: 0.55 },
} as const

export function formatMeasured(m: Measured): string {
  return `${m.value} ${m.unit}`
}
