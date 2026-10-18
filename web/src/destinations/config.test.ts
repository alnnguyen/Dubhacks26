import { describe,it,expect } from 'vitest';
import { DESTINATIONS,isDestination } from './config';
describe('destination routes',()=>{
 it('keeps independent cinematic and arena paths for Mars and Neptune',()=>{
 expect(DESTINATIONS.mars.cinematicPath).toContain('spacetomars.mp4');
 expect(DESTINATIONS.neptune.cinematicPath).toBe('/assets/neptune/neptune-arrival.mp4');
 expect(DESTINATIONS.neptune.texturePath).toBe('/textures/planets/2k_neptune.jpg');
 expect(DESTINATIONS.mars.arenaType).toBe('mars');expect(DESTINATIONS.neptune.arenaType).toBe('neptune');
 expect(isDestination('saturn')).toBe(false);
 });
});
