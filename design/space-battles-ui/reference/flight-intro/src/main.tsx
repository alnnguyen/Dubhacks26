import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import type { PilotIdentity } from './app/pilotIdentity';
function Preview() {
 const [identity,setIdentity]=useState<PilotIdentity|null>(null);
 return identity ? <main className="preview-finish"><small>INTRO PREVIEW COMPLETE</small><h1>BRIDGE REACHED.</h1><p>{identity.callsign} / {identity.shipName}</p><button onClick={()=>setIdentity(null)}>REPLAY THE SEQUENCE ↗</button></main> : <OnboardingFlow onComplete={setIdentity}/>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
