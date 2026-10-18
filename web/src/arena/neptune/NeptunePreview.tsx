import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NeptuneEnvironment } from './NeptuneEnvironment';
import { NeptuneArrival } from './NeptuneArrival';
import './neptune.css';
/** Read-only environment/journey review; no fake matchmaking or combat commands. */
export function NeptunePreview(){
 const journey=new URLSearchParams(location.search).get('journey')==='neptune';const [done,setDone]=useState(false),[skip,setSkip]=useState(false),[error,setError]=useState(false);
 return <main className="neptune-preview">
 {journey?<NeptuneArrival active skip={skip} onComplete={()=>setDone(true)} onError={()=>setError(true)}/>:<Canvas shadows dpr={[1,1.5]} camera={{position:[0,14,28],fov:42,near:.05,far:2400}}><NeptuneEnvironment/><OrbitControls target={[0,-2,-1]} minDistance={3} maxDistance={80} maxPolarAngle={Math.PI*.85}/></Canvas>}
 <div className="neptune-preview__hud"><p>NEPTUNE / FLOATING COMBAT STATION</p><p>{journey?(done?'Arrival complete · gameplay camera ready':error?'Playback unavailable · continue to the station':'Cinematic → live platform → camera reveal'):'Environment review · drag to orbit / scroll to inspect'}</p><a href="?arena=neptune">Inspect platform</a><a href="?journey=neptune">Replay arrival</a><a href="?dev=arena&destination=neptune">Synthetic fighter preview</a>{journey&&!done&&<button onClick={()=>setSkip(true)}>{error?'Continue to station':'Skip video'}</button>}</div>
 </main>;
}
