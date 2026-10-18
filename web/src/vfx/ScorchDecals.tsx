import { PooledSurface } from './PooledSurface';
import type { VfxRuntime } from './runtime';
export function ScorchDecals({runtime}:{runtime:VfxRuntime}) { return <PooledSurface runtime={runtime} kind="scorch"/>; }
