import { gameAudio } from '../audio/gameAudio';
/** Bounded prebuilt voices. No AudioContext, node or buffer allocation on a hit. */
export class ImpactAudio {
 private context:AudioContext|null=null;
 private voices:{osc:OscillatorNode;gain:GainNode;noise:GainNode}[]=[];
 private cursor=0;
 prepare=()=>{
  const state=gameAudio.getSnapshot();if(!state.unlocked||state.settings.muted||this.context)return;
  try{
   const c=new AudioContext();this.context=c;const b=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
   for(let i=0;i<4;i++){
    const osc=c.createOscillator(),gain=c.createGain(),noise=c.createGain(),filter=c.createBiquadFilter(),source=c.createBufferSource();
    gain.gain.value=0;noise.gain.value=0;osc.connect(gain).connect(c.destination);osc.start();source.buffer=b;source.loop=true;filter.type='highpass';filter.frequency.value=1800;source.connect(filter).connect(noise).connect(c.destination);source.start();this.voices.push({osc,gain,noise});
   }
  }catch{/* Audio never gates rendering or combat. */}
 };
 hit(){const state=gameAudio.getSnapshot();if(!this.context||this.context.state!=='running'||state.settings.muted||!state.unlocked)return;const voice=this.voices[this.cursor++%4],c=this.context,t=c.currentTime,volume=state.settings.master*state.settings.effects*.075;if(volume<=0)return;voice.gain.gain.cancelScheduledValues(t);voice.noise.gain.cancelScheduledValues(t);voice.osc.frequency.setValueAtTime(95+Math.random()*15,t);voice.osc.frequency.exponentialRampToValueAtTime(38,t+.16);voice.gain.gain.setValueAtTime(volume,t);voice.gain.gain.exponentialRampToValueAtTime(.00001,t+.2);voice.noise.gain.setValueAtTime(volume*.4,t);voice.noise.gain.exponentialRampToValueAtTime(.00001,t+.28);}
 dispose(){if(this.context)void this.context.close();this.context=null;this.voices=[];}
}
