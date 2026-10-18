/**
 * Lightsaber helper for /models/saber.glb (procedural kit, see public/models/saber.ATTRIBUTION.md).
 * Model: meters, +Y up, origin = grip. Hilt ~28 cm, blade ~90 cm along +Y.
 * Nodes: blade (pivot at emitter) > blade_core, blade_glow, blade_tip.
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

export const SABER_COLORS = {
  blue: 0x2a7bff,
  cyan: 0x22e5ff,
  green: 0x39ff6a,
  purple: 0xa04dff,
  orange: 0xff8a1f,
  white: 0xf2f6ff,
} as const
export type SaberColorName = keyof typeof SABER_COLORS

export interface LightsaberOptions {
  color?: THREE.ColorRepresentation | SaberColorName
  ignited?: boolean
  light?: boolean
  flicker?: number
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

export class Lightsaber {
  readonly object: THREE.Group
  readonly blade: THREE.Object3D
  readonly tip: THREE.Object3D
  private coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  private glowMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  private haloMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  private lensMats: THREE.MeshStandardMaterial[] = []
  private light: THREE.PointLight | null = null
  private color = new THREE.Color()
  private target = 0
  private level = 0
  private from = 0
  private t = 1
  private duration = 0.25
  private time = 0
  private flicker: number

  static async load(url = "/models/saber.glb", opts: LightsaberOptions = {}): Promise<Lightsaber> {
    const gltf = await new GLTFLoader().loadAsync(url)
    return new Lightsaber(gltf.scene, opts)
  }

  constructor(scene: THREE.Object3D, opts: LightsaberOptions = {}) {
    this.object = new THREE.Group()
    this.object.name = "LightsaberRoot"
    this.object.add(scene)
    const blade = scene.getObjectByName("blade")
    if (!blade) throw new Error('saber.glb: missing "blade" node')
    this.blade = blade
    this.tip = scene.getObjectByName("blade_tip") ?? blade
    this.flicker = opts.flicker ?? 0.35

    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const name = (m.material as THREE.Material).name
      if (name === "blade_core") {
        m.material = this.coreMat
        m.renderOrder = 10
      } else if (name === "blade_glow") {
        m.material = this.glowMat
        m.renderOrder = 11
        const halo = new THREE.Mesh(m.geometry, this.haloMat)
        halo.name = "blade_halo"
        halo.scale.set(2.1, 1.02, 2.1)
        halo.renderOrder = 12
        m.add(halo)
      } else if (name === "saber_emitter_lens") {
        this.lensMats.push(m.material as THREE.MeshStandardMaterial)
      }
      m.frustumCulled = false
    })
    if (opts.light) {
      this.light = new THREE.PointLight(0xffffff, 0, 0.6, 2)
      this.light.position.set(0, 0.25, 0)
      this.blade.add(this.light)
    }
    this.setColor(opts.color ?? "cyan")
    this.level = this.target = opts.ignited ? 1 : 0
    this.apply()
  }

  get isOn(): boolean {
    return this.target === 1
  }

  setColor(c: THREE.ColorRepresentation | SaberColorName): void {
    const v =
      typeof c === "string" && c in SABER_COLORS
        ? SABER_COLORS[c as SaberColorName]
        : (c as THREE.ColorRepresentation)
    this.color.set(v)
    this.coreMat.color.copy(this.color).lerp(new THREE.Color(0xffffff), 0.55)
    this.glowMat.color.copy(this.color)
    this.haloMat.color.copy(this.color)
    for (const l of this.lensMats) {
      l.color.copy(this.color)
      l.emissive.copy(this.color)
    }
    this.light?.color.copy(this.color)
  }

  ignite(duration = 0.28): void {
    this.animateTo(1, duration)
  }
  retract(duration = 0.22): void {
    this.animateTo(0, duration)
  }
  toggle(): void {
    if (this.isOn) this.retract()
    else this.ignite()
  }

  setBladeLength(f: number): void {
    this.level = this.target = THREE.MathUtils.clamp(f, 0, 1)
    this.t = 1
    this.apply()
  }

  /** Point +Y from `from` → `to` and place the grip at `from`. */
  alignToSegment(from: THREE.Vector3, to: THREE.Vector3): void {
    const dir = new THREE.Vector3().subVectors(to, from)
    if (dir.lengthSq() < 1e-10) return
    this.object.position.copy(from)
    this.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  }

  getTipWorld(out = new THREE.Vector3()): THREE.Vector3 {
    return this.tip.getWorldPosition(out)
  }

  update(dt: number): void {
    this.time += dt
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration)
      this.level = this.from + (this.target - this.from) * ease(this.t)
    }
    this.apply()
  }

  private animateTo(v: 0 | 1, duration: number): void {
    if (this.target === v && this.t >= 1) return
    this.from = this.level
    this.target = v
    this.t = 0
    this.duration = Math.max(0.01, duration)
  }

  private apply(): void {
    const s = Math.max(this.level, 0.0001)
    this.blade.scale.set(1, s, 1)
    this.blade.visible = this.level > 0.002
    const n = Math.sin(this.time * 47) * 0.5 + Math.sin(this.time * 23.7) * 0.5
    const f = 1 + n * 0.08 * this.flicker
    this.glowMat.opacity = 0.6 * f
    this.haloMat.opacity = 0.18 * f
    if (this.light) this.light.intensity = 0.8 * this.level * f
  }

  dispose(): void {
    this.object.removeFromParent()
    this.object.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry.dispose()
      ;(Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose())
    })
    this.coreMat.dispose()
    this.glowMat.dispose()
    this.haloMat.dispose()
  }
}
