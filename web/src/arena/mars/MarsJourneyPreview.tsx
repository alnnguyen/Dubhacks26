import { useState } from 'react'
import { MarsArrival } from './MarsArrival'
import '../neptune/neptune.css'

/** /?journey=mars (add &skip for the reveal only): the Mars video → live arena handoff, no matchmaking. */
export function MarsJourneyPreview() {
  const [done, setDone] = useState(false)
  const [skip, setSkip] = useState(() => new URLSearchParams(location.search).has('skip'))
  return (
    <main className="neptune-preview" style={{ background: '#8a1c04' }}>
      <MarsArrival active skip={skip} onComplete={() => setDone(true)} />
      <div className="neptune-preview__hud">
        <p>MARS / JEZERO COMBAT PLATFORM</p>
        <p>{done ? 'Arrival complete · gameplay camera ready' : 'Cinematic → dust → live arena reveal'}</p>
        <a href="?journey=mars">Replay arrival</a><a href="?dev=arena">Synthetic fighter preview</a>
        {!done && <button onClick={() => setSkip(true)}>Skip video</button>}
      </div>
    </main>
  )
}
