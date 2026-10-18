import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { MarsEnvironment } from './mars/MarsEnvironment'
import { ArenaCamera } from './mars/ArenaCamera'
import { useDeviceAim } from './mars/useDeviceAim'
import { DEFAULT_LAYOUT } from './mars/obstacles'
import { formatMeasured, gameplay, MARS_FACT_SHEET_URL, science, site } from './mars/marsConfig'
import type { GraphicsQuality } from '../ui/state/lobbyTypes'
import './arena.css'

/** Standalone Mars arena preview: /?arena=mars. No camera, vision or networking. */
export function MarsPreview() {
  const tilt = useDeviceAim()
  const [quality, setQuality] = useState<GraphicsQuality>(() => (new URLSearchParams(location.search).get('q') === 'low' ? 'low' : 'high'))
  return (
    <div className="arena-root">
      <Canvas
        key={quality}
        shadows="soft"
        dpr={quality === 'high' ? [1, 1.75] : [1, 1.2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <Suspense fallback={null}>
          <MarsEnvironment quality={quality} obstacles={DEFAULT_LAYOUT} />
          <ArenaCamera deviceQuat={tilt.quat} initialYawDeg={Number(new URLSearchParams(location.search).get('yaw') ?? 0)} />
        </Suspense>
      </Canvas>
      {tilt.status === 'needs-permission' && (
        <button className="arena-tilt" onClick={tilt.request}>
          Enable tilt to look around
        </button>
      )}
      {tilt.status === 'active' && (
        <button className="arena-recenter" onClick={tilt.recenter} aria-label="Recenter view">
          Recenter
        </button>
      )}
      {tilt.status === 'denied' && <p className="arena-tilt-note">Motion access denied — swipe to look around.</p>}
      <aside className="arena-facts" aria-label="Mars data">
        <p className="arena-eyebrow">Arena · {site.name}</p>
        <h1>Mars</h1>
        <dl>
          {[science.surfaceGravity, science.surfacePressure, science.meanTemperature, science.co2Fraction, science.solarIrradiance, science.solarDay].map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{formatMeasured(m)}</dd>
            </div>
          ))}
          <div>
            <dt>Game gravity</dt>
            <dd>
              {gameplay.gravity} m/s² <span>(rounded)</span>
            </dd>
          </div>
        </dl>
        <p className="arena-source">
          Data: <a href={MARS_FACT_SHEET_URL}>NASA Mars Fact Sheet</a> · Terrain: NASA MGS MOLA
        </p>
        <div className="arena-quality">
          {(['high', 'low'] as const).map((q) => (
            <button key={q} aria-pressed={quality === q} onClick={() => setQuality(q)}>
              {q}
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
