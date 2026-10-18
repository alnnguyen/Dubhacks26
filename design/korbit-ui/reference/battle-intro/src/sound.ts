/** Optional original synthesized cues. Nothing plays until a user starts the preview. */
export function playIntroSound(durationMs:number,elapsedMs:number){
 const ctx=new AudioContext();void ctx.resume().catch(()=>{});const start=ctx.currentTime;
 const nodes:AudioScheduledSourceNode[]=[];
 function whoosh(at:number,length:number){
  if(at<0)return;const size=Math.ceil(ctx.sampleRate*length),buffer=ctx.createBuffer(1,size,ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<size;i++)data[i]=(Math.random()*2-1);
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(400,start+at);filter.frequency.exponentialRampToValueAtTime(4200,start+at+length);filter.Q.value=.7;
  gain.gain.setValueAtTime(0,start+at);gain.gain.linearRampToValueAtTime(.12,start+at+length*.7);gain.gain.linearRampToValueAtTime(0,start+at+length);
  source.connect(filter).connect(gain).connect(ctx.destination);source.start(start+at);source.stop(start+at+length);nodes.push(source);
 }
 function hit(at:number,pitch:number){if(at<0)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.setValueAtTime(pitch,start+at);osc.frequency.exponentialRampToValueAtTime(34,start+at+.28);gain.gain.setValueAtTime(.18,start+at);gain.gain.exponentialRampToValueAtTime(.001,start+at+.4);osc.connect(gain).connect(ctx.destination);osc.start(start+at);osc.stop(start+at+.42);nodes.push(osc)}
 const time=(fraction:number)=>durationMs*fraction/1000-elapsedMs/1000;
 whoosh(time(.08),.6);hit(time(.4),105);hit(time(.57),150);whoosh(time(.79),.45);
 let stopped=false;
 return ()=>{if(stopped)return;stopped=true;for(const n of nodes)try{n.stop()}catch{}void ctx.close().catch(()=>{})};
}
