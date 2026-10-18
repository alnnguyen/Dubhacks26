import * as THREE from 'three';
import { HitStop } from './HitStop';
import { POOL_SIZE, VFX } from './config';
export type VisualImpact = { kind: 'blocked' | 'hit'; at: [number,number,number]; startedMs: number; damage?: number; targetSlot?: number; isKill?: boolean; normal?: [number,number,number] };
export class VfxRuntime {
  clock = new HitStop();
  cursor = 0; serial = 0; last = -Infinity; trauma = 0; big = 0;
  positions = Array.from({length:POOL_SIZE},()=>new THREE.Vector4(0,0,0,-100));
  normals = Array.from({length:POOL_SIZE},()=>new THREE.Vector3(0,1,0));
  projected = Array.from({length:4},()=>new THREE.Vector4(0,0,-100,0));
  colors = Array.from({length:POOL_SIZE},()=>new THREE.Color());
  blocked = new Uint8Array(POOL_SIZE); targets = new Uint8Array(POOL_SIZE); kills = new Uint8Array(POOL_SIZE);
  realStarted = new Float64Array(POOL_SIZE).fill(-10000);
  ground = 0;
  accept(hit: VisualImpact) {
    if (hit.startedMs === this.last) return false;
    this.last = hit.startedMs;
    const i = this.cursor++ % POOL_SIZE;
    this.positions[i].set(hit.at[0],hit.at[1]+this.ground,-hit.at[2],this.clock.time);
    this.normals[i].set(hit.normal?.[0]??0,hit.normal?.[1]??0.8,-(hit.normal?.[2]??0.3)).normalize();
    this.blocked[i]=Number(hit.kind==='blocked');this.targets[i]=hit.targetSlot??0;this.kills[i]=Number(VFX.killingBlow&&hit.isKill);
    this.colors[i].set(hit.kind==='blocked'?'#b4faff':'#ffae66');this.realStarted[i]=performance.now();
    this.trauma=Math.min(1,this.trauma+(hit.kind==='blocked'?.22:Math.min(.6,.2+(hit.damage??15)/100)));
    this.big=Math.max(this.big,(VFX.killingBlow&&hit.isKill)?1:(hit.damage??0)>=25?.5:0);
    this.clock.hit((hit.damage??0)>=25,VFX.killingBlow&&hit.isKill);this.serial++;
    return true;
  }
}
