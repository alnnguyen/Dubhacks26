import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { LAYOUT } from './cockpitLayout';
import { makeRadialTexture } from './textures';
import type { AnchorRegistry } from './anchors';
import type { NearbyPilot } from '../../state/lobbyTypes';

const CYAN = new THREE.Color(0.35, 0.86, 1.0);
const ORANGE = new THREE.Color(1.0, 0.55, 0.2);
const TAU = Math.PI * 2;

const GLOBE_VERT = /* glsl */ `
varying vec3 vO;
varying vec3 vN;
varying vec3 vP;
void main(){
  vO = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const GLOBE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vO;
varying vec3 vN;
varying vec3 vP;
float line(float x, float w){ float d = abs(fract(x + 0.5) - 0.5); float fw = fwidth(x) * w; return 1.0 - smoothstep(0.0, fw, d); }
void main(){
  vec3 p = normalize(vO);
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x) + uTime * 0.18;
  float grid = max(line(lat * 6.0 / 3.14159, 1.2), line(lon * 12.0 / 6.28318, 1.2)) * 0.5;
  // Rotating 'continents' rendered as halftone dots.
  vec3 r = vec3(cos(uTime * 0.18) * p.x - sin(uTime * 0.18) * p.z, p.y, sin(uTime * 0.18) * p.x + cos(uTime * 0.18) * p.z);
  float land = sin(r.x * 4.0 + 1.3) * sin(r.y * 3.5) * sin(r.z * 5.0 + 0.7) + 0.45 * sin(r.x * 9.0 + r.z * 7.0);
  land = smoothstep(0.08, 0.3, land);
  vec2 g = vec2(lon * 40.0 / 6.28318, lat * 20.0 / 3.14159);
  float dots = smoothstep(0.36, 0.16, length(fract(g) - 0.5)) * land;
  float fres = pow(1.0 - abs(dot(N, V)), 2.2);
  float band = smoothstep(0.08, 0.0, abs(p.y - sin(uTime * 0.7) * 0.92));
  float flicker = 0.93 + 0.07 * sin(uTime * 37.0) * sin(uTime * 13.0);
  float face = gl_FrontFacing ? 1.0 : 0.4;
  vec3 col = uColor * (0.03 + fres * 1.1 + grid * 0.8 + dots * 0.7 + band * 0.4) * flicker * face * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

const DISC_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const DISC_FRAG = /* glsl */ `
uniform float uSweep;
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
float line(float x, float w){ float d = abs(fract(x + 0.5) - 0.5); float fw = fwidth(x) * w; return 1.0 - smoothstep(0.0, fw, d); }
void main(){
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float bearing = 1.5707963 - atan(c.y, c.x);
  float diff = mod(uSweep - bearing, 6.2831853);
  float trail = exp(-diff * 2.6) * smoothstep(1.0, 0.2, r) * 0.9;
  float rings = line(r * 4.0, 1.4) * 0.55;
  float edge = smoothstep(0.95, 1.0, r) * 0.9;
  float cross = (1.0 - smoothstep(0.0, 0.006, abs(c.x))) + (1.0 - smoothstep(0.0, 0.006, abs(c.y)));
  float a = (trail + rings + edge + cross * 0.25 + 0.05) * smoothstep(0.0, 0.12, r);
  gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
}
`;

const BEAM_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main(){
  float streak = 0.55 + 0.45 * sin(vUv.x * 80.0 + uTime * 2.0) * sin(vUv.x * 23.0 - uTime * 1.3);
  float fade = pow(1.0 - vUv.y, 1.4) * smoothstep(1.0, 0.85, vUv.y);
  gl_FragColor = vec4(uColor * fade * streak * 0.55 * uIntensity, 1.0);
}
`;

export interface HolographicConsoleProps {
  pilots: NearbyPilot[];
  selectedId: string | null;
  interactive: 'globe' | 'blips' | 'none';
  alert: boolean;
  boost: boolean;
  reducedMotion: boolean;
  quality: 'high' | 'low';
  anchors: AnchorRegistry;
  onActivate: () => void;
  onSelect: (id: string) => void;
}

/** Bearing (deg, clockwise from ahead) + distance → local disc position. */
export function blipPosition(p: NearbyPilot, radius: number, index: number): [number, number, number] {
  const b = THREE.MathUtils.degToRad(p.bearingDeg);
  const rr = (0.28 + 0.72 * Math.min(p.distanceM / 25, 1)) * radius;
  return [Math.sin(b) * rr, 0.03 + (index % 3) * 0.035, -Math.cos(b) * rr];
}

const STATUS_COLOR: Record<NearbyPilot['status'], THREE.Color> = {
  available: new THREE.Color(0.45, 1.0, 0.75).multiplyScalar(2.2),
  'in-duel': new THREE.Color(1.0, 0.5, 0.18).multiplyScalar(2.2),
  away: new THREE.Color(0.5, 0.6, 0.7).multiplyScalar(1.2),
};

function Blip({
  pilot,
  index,
  radius,
  selected,
  interactive,
  sweep,
  anchors,
  onSelect,
}: {
  pilot: NearbyPilot;
  index: number;
  radius: number;
  selected: boolean;
  interactive: boolean;
  sweep: RefObject<number>;
  anchors: AnchorRegistry;
  onSelect: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => blipPosition(pilot, radius, index), [pilot, radius, index]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: STATUS_COLOR[pilot.status].clone(), toneMapped: false }), [pilot.status]);
  const base = STATUS_COLOR[pilot.status];
  const world = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ clock }) => {
    const b = THREE.MathUtils.degToRad(pilot.bearingDeg);
    const diff = (((sweep.current ?? 0) - b) % TAU + TAU) % TAU;
    const ping = Math.exp(-diff * 2.2);
    mat.color.copy(base).multiplyScalar(0.7 + ping * 1.2 + (selected ? 0.6 : 0));
    if (core.current) core.current.scale.setScalar(1 + ping * 0.6 + (selected ? 0.35 : 0));
    if (ring.current) {
      const t = clock.elapsedTime;
      ring.current.visible = selected;
      ring.current.scale.setScalar(1 + ((t * 0.9) % 1) * 0.8);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 1 - ((t * 0.9) % 1);
    }
    if (group.current) {
      group.current.getWorldPosition(world);
      anchors.setPosition(`blip-${pilot.id}`, world);
    }
  });

  const handle = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    onSelect(pilot.id);
  };

  return (
    <group ref={group} position={pos}>
      <mesh ref={core} material={mat}>
        <octahedronGeometry args={[0.022, 0]} />
      </mesh>
      {/* Stem down to the radar plane */}
      <mesh position={[0, -pos[1] / 2, 0]} material={mat}>
        <boxGeometry args={[0.003, pos[1], 0.003]} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.035, 0.042, 32]} />
        <meshBasicMaterial color={[2.4, 2.6, 2.8]} transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Generous invisible hit target for touch */}
      <mesh
        onClick={handle}
        onPointerOver={() => interactive && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[0.075, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  );
}

export function HolographicConsole({ pilots, selectedId, interactive, alert, boost, reducedMotion, quality, anchors, onActivate, onSelect }: HolographicConsoleProps) {
  const { center, radius: R } = LAYOUT.hologram;
  const globe = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Points>(null);
  const sweep = useRef(0);
  const [hover, setHover] = useState(false);
  const color = useMemo(() => CYAN.clone(), []);
  const intensity = useRef(1);

  const globeU = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: color }, uIntensity: { value: 1 } }), [color]);
  const discU = useMemo(() => ({ uSweep: { value: 0 }, uColor: { value: color }, uIntensity: { value: 1 } }), [color]);
  const beamU = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: color }, uIntensity: { value: 1 } }), [color]);
  const glowTex = useMemo(() => makeRadialTexture('rgba(150,235,255,1)', 'rgba(40,140,255,0)'), []);
  useEffect(() => () => glowTex.dispose(), [glowTex]);

  const particleGeo = useMemo(() => {
    const n = 90;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU * 3.7;
      const rr = R * (1.15 + ((i * 7919) % 100) / 100 * 0.35);
      pos.set([Math.cos(a) * rr, (((i * 104729) % 100) / 100 - 0.5) * R * 0.5, Math.sin(a) * rr], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [R]);
  useEffect(() => () => particleGeo.dispose(), [particleGeo]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const speed = reducedMotion ? 0.25 : 1;
    sweep.current = (sweep.current + dt * 1.6 * speed) % TAU;
    color.lerp(alert ? ORANGE : CYAN, 1 - Math.exp(-dt * 4));
    const target = (boost ? 1.45 : 1) * (hover && interactive === 'globe' ? 1.25 : 1) * (alert ? 1.1 + Math.sin(t * 6) * 0.15 : 1);
    intensity.current = THREE.MathUtils.damp(intensity.current, target, 5, dt);
    globeU.uTime.value = t * speed;
    globeU.uIntensity.value = intensity.current;
    discU.uSweep.value = sweep.current;
    discU.uIntensity.value = intensity.current;
    beamU.uTime.value = t * speed;
    beamU.uIntensity.value = intensity.current;
    if (globe.current && !reducedMotion) globe.current.position.y = Math.sin(t * 0.8) * 0.012;
    if (rings.current) {
      rings.current.children[0].rotation.z = t * 0.3 * speed;
      rings.current.children[1].rotation.z = -t * 0.22 * speed;
      rings.current.children[2].rotation.z = t * 0.12 * speed;
    }
    if (particles.current) particles.current.rotation.y = t * 0.08 * speed;
  });

  const seg = quality === 'high' ? 48 : 32;
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;

  return (
    <group position={center as unknown as THREE.Vector3Tuple} name="hologram-radar">
      {/* Projection beam from the dashboard emitter */}
      <mesh position={[0, -0.535, 0]}>
        <cylinderGeometry args={[R * 0.72, 0.09, 0.39, 40, 1, true]} />
        <shaderMaterial vertexShader={DISC_VERT} fragmentShader={BEAM_FRAG} uniforms={beamU} side={THREE.DoubleSide} {...additive} />
      </mesh>

      <group ref={globe}>
        <mesh
          onClick={(e) => {
            if (interactive !== 'globe') return;
            e.stopPropagation();
            onActivate();
          }}
          onPointerOver={() => {
            if (interactive !== 'globe') return;
            setHover(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = '';
          }}
        >
          <sphereGeometry args={[R, seg, seg / 2]} />
          <shaderMaterial vertexShader={GLOBE_VERT} fragmentShader={GLOBE_FRAG} uniforms={globeU} side={THREE.DoubleSide} {...additive} />
        </mesh>
        <sprite scale={[R * 1.6, R * 1.6, 1]}>
          <spriteMaterial map={glowTex} color={[0.5, 0.9, 1.2]} {...additive} opacity={0.32} toneMapped={false} />
        </sprite>
        <group ref={rings}>
          <mesh rotation={[Math.PI / 2 + 0.35, 0.2, 0]}>
            <torusGeometry args={[R * 1.12, 0.0025, 4, 128]} />
            <meshBasicMaterial color={[0.6, 1.6, 2.2]} toneMapped={false} {...additive} />
          </mesh>
          <mesh rotation={[Math.PI / 2 - 0.5, -0.4, 0]} scale={[1.35, 1, 1]}>
            <torusGeometry args={[R * 1.05, 0.002, 4, 128]} />
            <meshBasicMaterial color={[0.5, 1.3, 1.9]} toneMapped={false} {...additive} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[R * 1.32, 0.0018, 4, 128]} />
            <meshBasicMaterial color={[0.4, 1.0, 1.5]} toneMapped={false} {...additive} />
          </mesh>
        </group>
        <points ref={particles} geometry={particleGeo}>
          <pointsMaterial size={0.012} color={[0.7, 1.6, 2.2]} sizeAttenuation toneMapped={false} {...additive} />
        </points>
      </group>

      {/* Radar plane with sweep, and nearby pilot blips */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R * 1.2, 64]} />
        <shaderMaterial vertexShader={DISC_VERT} fragmentShader={DISC_FRAG} uniforms={discU} side={THREE.DoubleSide} {...additive} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <octahedronGeometry args={[0.018, 0]} />
        <meshBasicMaterial color={[2.5, 2.6, 2.8]} toneMapped={false} />
      </mesh>
      {pilots.map((p, i) => (
        <Blip
          key={p.id}
          pilot={p}
          index={i}
          radius={R * 1.15}
          selected={p.id === selectedId}
          interactive={interactive === 'blips'}
          sweep={sweep}
          anchors={anchors}
          onSelect={onSelect}
        />
      ))}
      <pointLight color={alert ? '#ff9a4a' : '#5fd8ff'} intensity={boost ? 2.6 : 1.8} distance={2.6} decay={2} />
    </group>
  );
}
