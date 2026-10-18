/**
 * Gameplay-scale labels — feel AstroGrid jumps, not scientific precision.
 * Distances are scene units from the (floating) solar origin.
 */
export type ScaleBand = 'surface' | 'planet' | 'system' | 'localStars' | 'milkyWay' | 'catalogStars' | 'catalogGalaxies' | 'exoSystem';

export function scaleBandForDistance(distFromOrigin: number, environment: string): ScaleBand {
  if (environment === 'stars') return 'catalogStars';
  if (environment === 'galaxies') return 'catalogGalaxies';
  if (environment === 'exoplanets') return 'exoSystem';
  if (environment === 'galaxy') return 'milkyWay';
  if (environment === 'mars-surface') return 'surface';
  if (environment === 'moon-orbit') {
    if (distFromOrigin < 25) return 'planet';
    return 'system';
  }
  if (environment === 'deep-field') {
    if (distFromOrigin < 120) return 'localStars';
    return 'milkyWay';
  }
  // solar
  if (distFromOrigin < 35) return 'planet';
  if (distFromOrigin < 280) return 'system';
  if (distFromOrigin < 900) return 'localStars';
  return 'milkyWay';
}

export function scaleLabel(band: ScaleBand): string {
  switch (band) {
    case 'catalogStars': return 'Star atlas · 10 u / pc';
    case 'catalogGalaxies': return 'Galaxy atlas · 50 u / Mpc';
    case 'exoSystem': return 'Exoplanet system';
    case 'surface':
      return 'Surface flight';
    case 'planet':
      return 'Planet neighborhood';
    case 'system':
      return 'Solar system';
    case 'localStars':
      return 'Open space';
    case 'milkyWay':
      return 'Galaxy overview';
  }
}

export function showMilkyWayArt(band: ScaleBand): boolean {
  return band === 'localStars' || band === 'milkyWay';
}
