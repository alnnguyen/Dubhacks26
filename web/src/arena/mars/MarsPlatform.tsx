import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MARS_PLATFORM } from './terrain/heightmap'

/**
 * Fictional combat platform sunk into the Jezero regolith. The central floor
 * (r < 5.6) is level with the fighters' ground; three outer rings step up a
 * few centimetres each, and the rim slopes down under a drift of regolith.
 * Everything is local to y = 0 = the floor; the caller places it at floorY.
 */
const R = MARS_PLATFORM.radius
const CENTER = 5.6
/** Stepped top surface, revolved: (radius, height). */
const PROFILE: [number, number][] = [
  [0, 0], [CENTER, 0], [CENTER, 0.06], [7.4, 0.06], [7.4, 0.12], [9.6, 0.12], [9.6, 0.2], [R, 0.2],
  [R + 0.25, 0.12], [R + 0.9, -0.9], [R + 1.1, -1.6],
]

const BRONZE = '#8d5c34'
const STEEL = '#33393f'

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** Polar panel layout painted once: albedo, roughness (G) + metalness (B), and the cyan centre lines. */
function makeDeckTextures() {
  const size = 2048, c = size / 2, m = c / (R + 1.1)
  const canvas = () => { const el = document.createElement('canvas'); el.width = el.height = size; return [el, el.getContext('2d')!] as const }
  const [albedo, a] = canvas()
  const [orm, o] = canvas()
  const [glow, g] = canvas()
  const rand = seeded(19)
  a.fillStyle = '#5c6268'; a.fillRect(0, 0, size, size)
  o.fillStyle = 'rgb(0,150,200)'; o.fillRect(0, 0, size, size)
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size)
  const sector = (ctx: CanvasRenderingContext2D, r0: number, r1: number, s: number, e: number) => {
    ctx.beginPath(); ctx.arc(c, c, r1 * m, s, e); ctx.arc(c, c, r0 * m, e, s, true); ctx.closePath(); ctx.fill()
  }
  // Ring bands alternate weathered bronze and dark steel; every band is cut into panels.
  const bands: [number, number, 'bronze' | 'steel'][] = [
    [0, 1.2, 'bronze'], [1.2, 3.2, 'steel'], [3.2, 4.0, 'bronze'], [4.0, CENTER, 'steel'],
    [CENTER, 7.4, 'bronze'], [7.4, 9.6, 'steel'], [9.6, R, 'bronze'], [R, R + 1.1, 'steel'],
  ]
  for (const [r0, r1, kind] of bands) {
    const count = r0 === 0 ? 1 : Math.max(6, Math.round((Math.PI * (r0 + r1)) / 1.6))
    for (let k = 0; k < count; k++) {
      const s = (k / count) * Math.PI * 2, e = ((k + 1) / count) * Math.PI * 2
      const v = 0.82 + rand() * 0.3
      a.fillStyle = kind === 'bronze'
        ? `rgb(${158 * v | 0},${108 * v | 0},${66 * v | 0})`
        : `rgb(${92 * v | 0},${98 * v | 0},${104 * v | 0})`
      sector(a, r0, r1, s, e)
      o.fillStyle = `rgb(0,${(kind === 'bronze' ? 125 : 150) + rand() * 45 | 0},${kind === 'bronze' ? 150 : 140})`
      sector(o, r0, r1, s, e)
      if (r0 > 0) {
        a.strokeStyle = '#120d0a'; a.lineWidth = 3
        a.beginPath(); a.moveTo(c + Math.cos(s) * r0 * m, c + Math.sin(s) * r0 * m); a.lineTo(c + Math.cos(s) * r1 * m, c + Math.sin(s) * r1 * m); a.stroke()
        a.fillStyle = kind === 'bronze' ? '#c08a55' : '#7d8790'
        for (const t of [0.18, 0.82]) for (const off of [0.025, -0.025]) {
          const rr = (r0 + (r1 - r0) * t) * m
          a.fillRect(c + Math.cos(s + off) * rr - 2, c + Math.sin(s + off) * rr - 2, 4, 4)
        }
      }
    }
    a.strokeStyle = '#0d0907'; a.lineWidth = 6
    a.beginPath(); a.arc(c, c, r1 * m, 0, Math.PI * 2); a.stroke()
  }
  // Wear: scratches and scuffs, heaviest where fighters stand.
  for (let i = 0; i < 2500; i++) {
    const rr = Math.sqrt(rand()) * R * m, t = rand() * Math.PI * 2
    a.strokeStyle = `rgba(${rand() > 0.5 ? '210,170,130' : '10,6,4'},${0.04 + rand() * 0.06})`
    a.lineWidth = 1
    const x = c + Math.cos(t) * rr, y = c + Math.sin(t) * rr, l = 2 + rand() * 7, d = rand() * Math.PI
    a.beginPath(); a.moveTo(x, y); a.lineTo(x + Math.cos(d) * l, y + Math.sin(d) * l); a.stroke()
  }
  // Dust accumulation: red regolith drifted into seams and piled toward the rim, matte and non-metallic.
  for (let i = 0; i < 900; i++) {
    const rr = (0.35 + 0.65 * Math.pow(rand(), 0.6)) * (R + 1.1) * m, t = rand() * Math.PI * 2
    const x = c + Math.cos(t) * rr, y = c + Math.sin(t) * rr, rad = (6 + rand() * 40) * (rr / (R * m))
    const alpha = 0.12 + 0.4 * (rr / (R * m)) ** 3
    const grad = a.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, `rgba(164,82,44,${Math.min(0.75, alpha)})`); grad.addColorStop(1, 'rgba(164,82,44,0)')
    a.fillStyle = grad; a.beginPath(); a.arc(x, y, rad, 0, Math.PI * 2); a.fill()
    const og = o.createRadialGradient(x, y, 0, x, y, rad)
    og.addColorStop(0, `rgba(0,240,20,${Math.min(0.75, alpha)})`); og.addColorStop(1, 'rgba(0,240,20,0)')
    o.fillStyle = og; o.beginPath(); o.arc(x, y, rad, 0, Math.PI * 2); o.fill()
  }
  // Subtle cyan in the central structure only.
  const line = (radius: number, width: number, alpha: number) => {
    g.strokeStyle = `rgba(90,230,255,${alpha})`; g.lineWidth = width * m
    g.beginPath(); g.arc(c, c, radius * m, 0, Math.PI * 2); g.stroke()
  }
  line(1.2, 0.035, 0.7); line(3.2, 0.025, 0.4); line(4.0, 0.025, 0.4); line(CENTER - 0.08, 0.04, 0.55)
  g.strokeStyle = 'rgba(90,230,255,0.35)'; g.lineWidth = 0.025 * m
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * Math.PI * 2
    g.beginPath(); g.moveTo(c + Math.cos(t) * 1.3 * m, c + Math.sin(t) * 1.3 * m); g.lineTo(c + Math.cos(t) * 3.1 * m, c + Math.sin(t) * 3.1 * m); g.stroke()
  }
  const tex = (el: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(el)
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { map: tex(albedo, true), orm: tex(orm, false), glow: tex(glow, true) }
}

/** Lathe of the stepped profile with planar UVs, so the polar panel textures line up from above. */
function makeDeckGeometry() {
  const geo = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 160)
  const pos = geo.attributes.position, uv = geo.attributes.uv
  const span = 2 * (R + 1.1)
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / span + 0.5, 1 - (pos.getZ(i) / span + 0.5))
  uv.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

type Place = { angle: number; radius: number; y: number; scale: [number, number, number]; pitch?: number }

function useInstances(places: Place[]) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const d = new THREE.Object3D()
    places.forEach((p, i) => {
      d.position.set(Math.sin(p.angle) * p.radius, p.y, Math.cos(p.angle) * p.radius)
      d.rotation.set(p.pitch ?? 0, p.angle, 0, 'YXZ')
      d.scale.set(...p.scale)
      d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [places])
  return ref
}

const ring = (n: number, radius: number, y: number, scale: [number, number, number], offset = 0, pitch?: number): Place[] =>
  Array.from({ length: n }, (_, i) => ({ angle: (i / n) * Math.PI * 2 + offset, radius, y, scale, pitch }))

export function MarsPlatform({ y }: { y: number }) {
  const textures = useMemo(makeDeckTextures, [])
  const deck = useMemo(makeDeckGeometry, [])
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: BRONZE, metalness: 0.6, roughness: 0.5 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a5056', metalness: 0.6, roughness: 0.55 }), [])
  const cyan = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.4, 1.8), toneMapped: false }), [])
  useEffect(() => () => {
    Object.values(textures).forEach((t) => t.dispose())
    deck.dispose()
    ;[bronze, steel, cyan].forEach((m) => m.dispose())
  }, [textures, deck, bronze, steel, cyan])

  const places = useMemo(() => ({
    ribs: ring(36, 10.8, 0.24, [0.16, 0.08, 2.1]),
    pylons: ring(8, 11.55, 0.35, [0.75, 0.9, 0.75], Math.PI / 8),
    vents: ring(12, 8.5, 0.125, [1.1, 0.02, 0.55], Math.PI / 12),
    // Armour plates angling down into the regolith drift: the "buried" outer edge.
    plates: ring(20, R + 0.6, -0.35, [1.9, 0.12, 1.4], 0, 0.62),
  }), [])
  const ribs = useInstances(places.ribs)
  const pylons = useInstances(places.pylons)
  const vents = useInstances(places.vents)
  const plates = useInstances(places.plates)

  const trim = (radius: number, height: number, tube: number, material: THREE.Material) => (
    <mesh key={`${radius}-${height}`} position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} castShadow receiveShadow>
      <torusGeometry args={[radius, tube, 8, 160]} />
    </mesh>
  )

  return (
    <group position={[0, y, 0]}>
      <mesh name="mars-platform-floor" geometry={deck} castShadow receiveShadow>
        <meshStandardMaterial
          map={textures.map}
          roughnessMap={textures.orm}
          metalnessMap={textures.orm}
          emissiveMap={textures.glow}
          emissive="#5fe6ff"
          emissiveIntensity={0.45}
          roughness={1}
          metalness={1}
          envMapIntensity={1.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Bronze trim on every step edge, and a soft cyan line around the recessed centre. */}
      {trim(CENTER, 0.035, 0.035, bronze)}
      {trim(7.4, 0.095, 0.04, bronze)}
      {trim(9.6, 0.165, 0.045, bronze)}
      {trim(R, 0.2, 0.07, steel)}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={cyan}>
        <torusGeometry args={[CENTER - 0.12, 0.012, 6, 160]} />
      </mesh>
      <instancedMesh ref={ribs} args={[undefined, undefined, places.ribs.length]} material={bronze} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={pylons} args={[undefined, undefined, places.pylons.length]} material={steel} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={vents} args={[undefined, undefined, places.vents.length]} receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#120d0b" roughness={0.8} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={plates} args={[undefined, undefined, places.plates.length]} material={steel} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
    </group>
  )
}
