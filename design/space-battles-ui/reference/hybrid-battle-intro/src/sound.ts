export function jumpSound(durationMs:number){
 const ctx=new AudioContext();void ctx.resume().catch(()=>{});const now=ctx.currentTime,length=durationMs/1000;
 const count=Math.ceil(ctx.sampleRate*length),buffer=ctx.createBuffer(1,count,ctx.sampleRate),data=buffer.getChannelData(0);
 let previous=0;for(let i=0;i<count;i++){previous=(previous+(Math.random()*2-1)*.04)/1.04;data[i]=previous*3.5}
 const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(150,now);filter.frequency.exponentialRampToValueAtTime(7000,now+length*.65);filter.frequency.exponentialRampToValueAtTime(200,now+length);
 gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.2,now+length*.35);gain.gain.linearRampToValueAtTime(.3,now+length*.7);gain.gain.linearRampToValueAtTime(0,now+length);
 source.connect(filter).connect(gain).connect(ctx.destination);source.start(now);source.stop(now+length);
 let stopped=false;return()=>{if(stopped)return;stopped=true;try{source.stop()}catch{}void ctx.close().catch(()=>{})};
}
