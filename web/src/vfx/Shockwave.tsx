import { Effect, BlendFunction } from 'postprocessing';
import { Uniform } from 'three';
import type { VfxRuntime } from './runtime';
import { PooledSurface } from './PooledSurface';
export class ShockwaveEffect extends Effect {
 constructor(runtime:VfxRuntime) {
  super('ArenaShockwave',`uniform vec4 hits[4];uniform float time;uniform float strength;
void mainUv(inout vec2 uv){for(int i=0;i<4;i++){float age=time-hits[i].z;if(age>0.0&&age<.5&&hits[i].w>0.0){vec2 d=uv-hits[i].xy;float r=length(d);float ring=exp(-pow((r-age*.55)*50.0,2.0))*exp(-age*7.0);uv+=normalize(d+vec2(.00001))*ring*.004*strength;}}}
void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){vec2 d=uv-.5;vec3 blur=texture2D(inputBuffer,uv-d*.006*strength).rgb;outputColor=vec4(mix(inputColor.rgb,blur,clamp(strength-.5,0.0,.5)),inputColor.a);}`,{blendFunction:BlendFunction.NORMAL,uniforms:new Map<string,Uniform>([['hits',new Uniform(runtime.projected)],['time',new Uniform(0)],['strength',new Uniform(0)]])});
 }
}
export function Shockwave({runtime}:{runtime:VfxRuntime}) {return <PooledSurface runtime={runtime} kind="ring"/>;}
