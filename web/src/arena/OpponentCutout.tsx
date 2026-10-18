import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { PersonMask } from './segmentation'
import type { PoseOverlay } from '../camera/mediapipeVision'
import { bindUniforms } from '../three/bindUniforms'
import { arenaDev } from './devFlags'

/**
 * Screen-space pass that draws the real opponent (camera pixels where the
 * person mask is set) over the 3D Mars scene. Uses the same object-fit:cover
 * mapping as the duel's 2D rock overlay so rocks still land on the person.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
uniform sampler2D tVideo;
uniform sampler2D tMask;
uniform vec4 uCover;      // xy = scale, zw = offset (screen uv -> video uv)
uniform float uPresence;
uniform vec3 uWrap;       // ambient sky color for edge light-wrap
uniform vec3 uShadow;     // xy = feet position (video uv), z = width (0 = none)
uniform float uMirror;
uniform float uDebug;
uniform float uGhost;    // 0..1 raw camera shown under/around the cutout
varying vec2 vUv;

void main() {
  vec2 uv = vUv * uCover.xy + uCover.zw;            // bottom-up, like the video texture (flipY)
  if (uMirror > 0.5) uv.x = 1.0 - uv.x;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  vec2 uvT = vec2(uv.x, 1.0 - uv.y);                 // top-down: mask rows and MediaPipe landmarks

  float m = texture2D(tMask, uvT).r;
  // Dev aid: ?cutoutDebug=1 shows the raw mask over the camera image.
  if (uDebug > 0.5) { gl_FragColor = vec4(mix(texture2D(tVideo, uv).rgb * 0.5, vec3(1.0, 0.0, 0.0), m * 0.7), 1.0); return; }
  float alpha = smoothstep(0.38, 0.66, m) * uPresence;

  vec3 col = texture2D(tVideo, uv).rgb;
  // Match Mars light: warm, slightly desaturated, lifted shadows.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 0.82) * vec3(1.08, 0.93, 0.8);
  col = col * 0.92 + vec3(0.035, 0.02, 0.01);
  // Light wrap: the dusty sky bleeds onto the silhouette edge.
  float edge = clamp(alpha * (1.0 - smoothstep(0.55, 0.9, m)) * 2.2, 0.0, 1.0);
  col = mix(col, uWrap, edge * 0.35);

  // Contact shadow under the feet (drawn where the person is not).
  float shadow = 0.0;
  if (uShadow.z > 0.0) {
    vec2 d = (uvT - uShadow.xy) / vec2(uShadow.z, uShadow.z * 0.22);
    shadow = (1.0 - smoothstep(0.2, 1.0, length(d))) * 0.55 * uPresence;
  }
  float s = shadow * (1.0 - alpha);
  vec3 c = col * alpha + vec3(0.06, 0.03, 0.02) * s;
  float a = alpha + s;
  // Ghost camera: lets players find each other when nobody is tracked yet,
  // and is the full fallback when segmentation is unavailable.
  vec3 ghost = texture2D(tVideo, uv).rgb;
  float outA = a + uGhost * (1.0 - a);
  vec3 outC = (c + ghost * uGhost * (1.0 - a)) / max(outA, 1e-4);
  gl_FragColor = vec4(outC, outA);
  #include <colorspace_fragment>
}
`

const ANKLES = [27, 28, 29, 30, 31, 32]

export function OpponentCutout({
  video,
  mask,
  pose,
  mirror = false,
  wrapColor = '#c28d66',
}: {
  video: HTMLVideoElement
  mask: PersonMask
  pose: React.RefObject<PoseOverlay | null>
  mirror?: boolean
  wrapColor?: string
}) {
  const size = useThree((s) => s.size)
  // Copy each new camera frame into a small canvas and upload that. Direct video
  // uploads can come back black (hidden/headless video, some mobile GPUs) and a
  // ≤480 px copy is cheaper to upload than full-resolution camera frames.
  const frameCanvas = useMemo(() => document.createElement('canvas'), [])
  const videoTex = useMemo(() => {
    const t = new THREE.CanvasTexture(frameCanvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    t.generateMipmaps = false
    return t
  }, [frameCanvas])
  useEffect(() => () => videoTex.dispose(), [videoTex])

  const uniforms = useMemo(
    () => ({
      tVideo: { value: videoTex },
      tMask: { value: mask.texture },
      uCover: { value: new THREE.Vector4(1, 1, 0, 0) },
      uPresence: { value: 0 },
      uWrap: { value: new THREE.Color(wrapColor) },
      uShadow: { value: new THREE.Vector3(0, 0, 0) },
      uMirror: { value: mirror ? 1 : 0 },
      uGhost: { value: 0 },
      uDebug: { value: import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('cutoutDebug') ?? 0) : 0 },
    }),
    [videoTex, mask, wrapColor, mirror],
  )

  const lastVideoTime = useRef(-1)
  const mountedAt = useRef(performance.now())
  const urlDebug = useMemo(() => uniforms.uDebug.value, [uniforms])
  const fpsWindow = useRef({ start: performance.now(), frames: 0, masks: mask.updates })
  useFrame((_, dt) => {
    if (video.readyState >= 2 && video.videoWidth && video.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = video.currentTime
      const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight))
      const w = Math.round(video.videoWidth * scale)
      const h = Math.round(video.videoHeight * scale)
      if (frameCanvas.width !== w || frameCanvas.height !== h) {
        frameCanvas.width = w
        frameCanvas.height = h
        videoTex.dispose() // re-allocate at the new size
      }
      frameCanvas.getContext('2d')?.drawImage(video, 0, 0, w, h)
      videoTex.needsUpdate = true
    }
    mask.tick(performance.now(), Boolean(pose.current))
    uniforms.tMask.value = mask.texture
    uniforms.uPresence.value = mask.presence
    const searching = performance.now() - mountedAt.current > 1200 && mask.presence < 0.05
    const ghostTarget = mask.failed || arenaDev.showCamera ? 1 : searching ? 0.42 : 0
    uniforms.uDebug.value = arenaDev.showMask ? 1 : urlDebug
    // Diagnostics for the dev view (cheap: once per second).
    const fw = fpsWindow.current
    fw.frames++
    const elapsed = performance.now() - fw.start
    if (elapsed > 1000) {
      arenaDev.stats.renderFps = Math.round((fw.frames * 1000) / elapsed)
      arenaDev.stats.maskFps = Math.round(((mask.updates - fw.masks) * 1000) / elapsed)
      fw.start = performance.now()
      fw.frames = 0
      fw.masks = mask.updates
    }
    arenaDev.stats.presence = mask.presence
    arenaDev.stats.segmentation = mask.failed ? 'failed' : mask.updates > 0 ? 'ok' : 'waiting'
    uniforms.uGhost.value += (ghostTarget - uniforms.uGhost.value) * Math.min(1, dt * 3)
    // object-fit: cover — identical to the <video>/<canvas> CSS in the duel.
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    const sa = size.width / size.height
    const va = vw / vh
    const cover = uniforms.uCover.value
    if (va > sa) cover.set(sa / va, 1, (1 - sa / va) / 2, 0)
    else cover.set(1, va / sa, 0, (1 - va / sa) / 2)
    // Feet shadow from ankle/heel landmarks (normalized video coords).
    const lm = pose.current?.landmarks
    const feet = lm ? ANKLES.map((i) => lm[i]).filter((p): p is NonNullable<typeof p> => Boolean(p) && p.y < 1.02) : []
    if (feet.length >= 2) {
      const x = feet.reduce((s, p) => s + p.x, 0) / feet.length
      const y = Math.max(...feet.map((p) => p.y))
      const xs = feet.map((p) => p.x)
      const w = Math.max(0.06, (Math.max(...xs) - Math.min(...xs)) * 1.6)
      uniforms.uShadow.value.set(mirror ? 1 - x : x, y + 0.005, w)
    } else uniforms.uShadow.value.set(0, 0, 0)
  })

  return (
    <mesh frustumCulled={false} renderOrder={1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} ref={bindUniforms(uniforms)} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
