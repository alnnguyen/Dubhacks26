import { PooledSurface } from './PooledSurface';
import type { VfxRuntime } from './runtime';
export function ImpactFlash({runtime}:{runtime:VfxRuntime}) { return <PooledSurface runtime={runtime} kind="flash"/>; }
