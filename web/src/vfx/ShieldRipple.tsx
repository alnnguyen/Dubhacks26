import { PooledSurface } from './PooledSurface';
import type { VfxRuntime } from './runtime';
/** A cosmetic clash guard ripple; blocked does not claim the game has persistent shields. */
export function ShieldRipple({runtime}:{runtime:VfxRuntime}) { return <PooledSurface runtime={runtime} kind="shield"/>; }
