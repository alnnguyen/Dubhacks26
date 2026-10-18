import { describe, expect, it } from 'vitest';
import { HitStop } from './HitStop';
import { VfxRuntime } from './runtime';
import { POOL_SIZE } from './config';
describe('visual clock isolation',()=>{
 it('freezes exactly two visual frames then resumes without accumulating lost time',()=>{const clock=new HitStop();clock.hit(false);clock.advance(1/60);clock.advance(1/60);expect(clock.time).toBe(0);clock.advance(1/60);expect(clock.time).toBeCloseTo(1/60);});
 it('disabling hit-stop immediately restores normal visual time',()=>{const clock=new HitStop();clock.hit(true,true);clock.advance(.02,false);expect(clock.time).toBe(.02);clock.advance(.02);expect(clock.time).toBe(.04);});
});
describe('bounded impact pool',()=>{
 it('deduplicates notifications and copies data without mutating the event',()=>{const r=new VfxRuntime();r.ground=2;const hit={kind:'hit' as const,at:[1,2,3] as [number,number,number],startedMs:100,damage:20,targetSlot:2};expect(r.accept(hit)).toBe(true);expect(r.accept(hit)).toBe(false);expect(r.serial).toBe(1);expect(r.positions[0].toArray()).toEqual([1,4,-3,0]);expect(hit.at).toEqual([1,2,3]);});
 it('reuses every pool object after more than thirty impacts',()=>{const r=new VfxRuntime();const first=r.positions[0];for(let i=0;i<65;i++){r.accept({kind:i%2?'blocked':'hit',at:[i,1,0],startedMs:i});r.clock.advance(.1,false);}expect(r.positions).toHaveLength(POOL_SIZE);expect(r.positions[0]).toBe(first);expect(r.positions[0].x).toBe(60);expect(r.cursor).toBe(65);});
});
