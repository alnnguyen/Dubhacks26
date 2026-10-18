import { useEffect, useState } from 'react'
import { CameraDebugPage } from '../camera/CameraDebugPage'
import { flightSeconds, worlds } from '../app/state'
import { arenaDev } from './devFlags'
import '../styles.css'
import './arena.css'

/**
 * Dev view: /?dev=mars. Camera + computer vision + immersive Mars, with no
 * match, server or health. Shows whether a person is detected and lets you
 * view the raw mask / camera. Gestures and rocks still run locally.
 */
export function DevMars() {
  const [, force] = useState(0)
  const [showMask, setShowMask] = useState(arenaDev.showMask)
  const [showCamera, setShowCamera] = useState(arenaDev.showCamera)
  const [lastCommand, setLastCommand] = useState('—')

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 400)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    arenaDev.showMask = showMask
    arenaDev.showCamera = showCamera
  }, [showMask, showCamera])

  const s = arenaDev.stats
  const detected = s.presence > 0.5
  return (
    <>
      <CameraDebugPage
        mode="duel"
        flightSeconds={flightSeconds('mars')}
        duel={{ worldName: `${worlds.mars.name} · DEV`, gravity: worlds.mars.gravity, rivalName: 'Detected person', health: 100, rivalHealth: 100, immersive: true }}
        onCommands={(cmds) => cmds.length && setLastCommand(cmds.map((c) => c.name).join(', '))}
      />
      <aside className="mars-dev" aria-label="Detection diagnostics">
        <p className={`mars-dev__state ${detected ? 'on' : ''}`}>{detected ? '● Person detected' : '○ No person'}</p>
        <dl>
          <div>
            <dt>Segmentation</dt>
            <dd>{s.segmentation}</dd>
          </div>
          <div>
            <dt>Mask updates</dt>
            <dd>{s.maskFps}/s</dd>
          </div>
          <div>
            <dt>Render</dt>
            <dd>{s.renderFps} fps</dd>
          </div>
          <div>
            <dt>Last gesture cmd</dt>
            <dd>{lastCommand}</dd>
          </div>
        </dl>
        <label>
          <input type="checkbox" checked={showMask} onChange={(e) => setShowMask(e.target.checked)} /> Show mask
        </label>
        <label>
          <input type="checkbox" checked={showCamera} onChange={(e) => setShowCamera(e.target.checked)} /> Show camera
        </label>
      </aside>
    </>
  )
}
