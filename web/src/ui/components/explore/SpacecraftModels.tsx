import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Schematic spacecraft built from each vehicle's published configuration, at true relative
 * proportions (1 unit = 100 m) before display scaling. Recognizable silhouettes, not CAD models.
 * Array pivots are named `array` so the scene can turn them toward the Sun.
 */

function cellTexture(base: string, line: string, cols: number, rows: number) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = line; g.lineWidth = 2;
  for (let i = 0; i <= cols; i++) { const x = (i / cols) * 256; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let j = 0; j <= rows; j++) { const y = (j / rows) * 128; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let shared: ReturnType<typeof makeMaterials> | null = null;
function makeMaterials() {
  return {
    // ISS arrays read amber/gold in most imagery; Starlink and Hubble arrays are deep blue.
    issArray: new THREE.MeshStandardMaterial({ map: cellTexture('#7a4a12', '#e3a74a', 16, 4), emissive: '#3a2108', emissiveIntensity: .6, metalness: .35, roughness: .45, side: THREE.DoubleSide }),
    blueArray: new THREE.MeshStandardMaterial({ map: cellTexture('#0f2a6b', '#4d7fd6', 12, 4), emissive: '#0b1d4d', emissiveIntensity: .7, metalness: .4, roughness: .35, side: THREE.DoubleSide }),
    truss: new THREE.MeshStandardMaterial({ color: '#c9cfd6', metalness: .7, roughness: .35 }),
    module: new THREE.MeshStandardMaterial({ color: '#eef2f5', metalness: .25, roughness: .55 }),
    radiator: new THREE.MeshStandardMaterial({ color: '#f4f6f8', metalness: .1, roughness: .7, side: THREE.DoubleSide }),
    silver: new THREE.MeshStandardMaterial({ color: '#d7dde3', metalness: .9, roughness: .22 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1d2430', metalness: .5, roughness: .5 }),
    starlinkBus: new THREE.MeshStandardMaterial({ color: '#3a4049', metalness: .6, roughness: .4 }),
    antenna: new THREE.MeshStandardMaterial({ color: '#e9edf2', metalness: .2, roughness: .6 }),
    glow: new THREE.MeshBasicMaterial({ color: '#87dcff', toneMapped: false }),
  };
}
export function spacecraftMaterials() { return (shared ??= makeMaterials()); }

type Props = { scale?: number; selected?: boolean };

/** ISS: 109 m integrated truss, eight 35 × 12 m solar wings, radiators, pressurized module stack. */
export const IssModel = forwardRef<THREE.Group, Props & { dragons?: number }>(function IssModel({ scale = 1, dragons = 0 }, ref) {
  const m = spacecraftMaterials();
  const wings = useMemo(() => [-0.5, -0.33, 0.33, 0.5], []);
  return (
    <group ref={ref} scale={scale} name="iss">
      <mesh material={m.truss}><boxGeometry args={[1.09, .035, .035]} /></mesh>
      {wings.map((x) => (
        <group key={x} position={[x, 0, 0]} name="array">
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, 0, side * .2]} material={m.issArray}><boxGeometry args={[.12, .004, .35]} /></mesh>
          ))}
          <mesh material={m.truss}><cylinderGeometry args={[.006, .006, .76, 6]} /></mesh>
        </group>
      ))}
      {[-.17, .17].map((x) => (
        <mesh key={x} position={[x, -.06, 0]} rotation={[0, 0, Math.PI / 2]} material={m.radiator}><boxGeometry args={[.12, .004, .14]} /></mesh>
      ))}
      {/* US segment (Destiny/Unity/Harmony) and Russian segment (Zarya/Zvezda) along the flight axis */}
      <mesh position={[0, -.03, .02]} rotation={[Math.PI / 2, 0, 0]} material={m.module}><cylinderGeometry args={[.022, .022, .5, 14]} /></mesh>
      <mesh position={[0, -.03, -.3]} rotation={[Math.PI / 2, 0, 0]} material={m.module}><cylinderGeometry args={[.02, .02, .2, 14]} /></mesh>
      <mesh position={[.08, -.03, .2]} rotation={[0, 0, Math.PI / 2]} material={m.module}><cylinderGeometry args={[.022, .022, .12, 14]} /></mesh>
      <mesh position={[-.07, -.03, .2]} rotation={[0, 0, Math.PI / 2]} material={m.module}><cylinderGeometry args={[.022, .022, .1, 14]} /></mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * .1, -.03, -.36]} material={m.blueArray}><boxGeometry args={[.13, .003, .03]} /></mesh>
      ))}
      {/* Docked Dragons at Harmony's forward and zenith ports, as the snapshot reports them. */}
      {/* Enlarged 1.6× so docked capsules read at station scale (schematic). */}
      {dragons > 0 && <group position={[0, -.03, .32]} rotation={[Math.PI / 2, 0, 0]} scale={1.6}><DragonModel /></group>}
      {dragons > 1 && <group position={[0, .02, .24]} scale={1.6}><DragonModel /></group>}
    </group>
  );
});

/** Hubble: 13.2 m tube, 4.2 m diameter, aperture door, two solar wings. */
export const HubbleModel = forwardRef<THREE.Group, Props>(function HubbleModel({ scale = 1 }, ref) {
  const m = spacecraftMaterials();
  return (
    <group ref={ref} scale={scale} name="hubble">
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.silver}><cylinderGeometry args={[.021, .021, .132, 18]} /></mesh>
      <mesh position={[0, .022, .07]} rotation={[-.6, 0, 0]} material={m.silver}><boxGeometry args={[.04, .002, .04]} /></mesh>
      <group name="array">
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * .085, 0, 0]} material={m.blueArray}><boxGeometry args={[.12, .002, .026]} /></mesh>
        ))}
      </group>
    </group>
  );
});

/** Starlink v1.0 (2019–2020 launches): flat-panel bus, phased-array antennas, one ~8 × 2.8 m solar array on a boom. */
export const StarlinkModel = forwardRef<THREE.Group, Props>(function StarlinkModel({ scale = 1 }, ref) {
  const m = spacecraftMaterials();
  return (
    <group ref={ref} scale={scale} name="starlink">
      <mesh material={m.starlinkBus}><boxGeometry args={[.032, .004, .016]} /></mesh>
      {[-.01, 0, .01].map((x) => (
        <mesh key={x} position={[x, -.0028, 0]} material={m.antenna}><boxGeometry args={[.008, .0008, .012]} /></mesh>
      ))}
      <mesh position={[.022, .002, 0]} material={m.truss}><boxGeometry args={[.014, .0015, .0015]} /></mesh>
      <group name="array" position={[.07, .002, 0]}>
        <mesh material={m.blueArray}><boxGeometry args={[.081, .0012, .028]} /></mesh>
      </group>
    </group>
  );
});

/** Dragon 2: 4 m capsule with nose cone over a 2.8 m trunk carrying body-mounted solar cells (~8 m tall). */
export const DragonModel = forwardRef<THREE.Group, Props>(function DragonModel({ scale = 1 }, ref) {
  const m = spacecraftMaterials();
  return (
    <group ref={ref} scale={scale} name="dragon">
      <mesh position={[0, .022, 0]} material={m.module}><cylinderGeometry args={[.012, .02, .03, 18]} /></mesh>
      <mesh position={[0, .041, 0]} material={m.module}><coneGeometry args={[.012, .012, 18]} /></mesh>
      <mesh position={[0, -.012, 0]} material={m.blueArray}><cylinderGeometry args={[.0185, .0185, .038, 18, 1, true]} /></mesh>
      <mesh position={[0, -.012, 0]} material={m.starlinkBus}><cylinderGeometry args={[.017, .017, .038, 18]} /></mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.cos(k * Math.PI / 2) * .02, -.031, Math.sin(k * Math.PI / 2) * .02]} material={m.truss}><boxGeometry args={[.004, .006, .004]} /></mesh>
      ))}
    </group>
  );
});

/** Tesla Roadster with Starman: a schematic 3.9 m car (it left Earth on the first Falcon Heavy, 2018). */
export const RoadsterModel = forwardRef<THREE.Group, Props>(function RoadsterModel({ scale = 1 }, ref) {
  const m = spacecraftMaterials();
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8102e', metalness: .6, roughness: .25 }), []);
  const suit = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: .6 }), []);
  return (
    <group ref={ref} scale={scale} name="roadster">
      <mesh position={[0, .005, 0]} material={red}><boxGeometry args={[.018, .006, .039]} /></mesh>
      <mesh position={[0, .009, .006]} rotation={[-.5, 0, 0]} material={m.dark}><boxGeometry args={[.016, .004, .002]} /></mesh>
      {[[-.009, .013], [.009, .013], [-.009, -.013], [.009, -.013]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, .002, z]} rotation={[0, 0, Math.PI / 2]} material={m.dark}><cylinderGeometry args={[.0035, .0035, .003, 12]} /></mesh>
      ))}
      <mesh position={[-.004, .012, -.002]} material={suit}><boxGeometry args={[.004, .007, .004]} /></mesh>
      <mesh position={[-.004, .0175, -.002]} material={suit}><sphereGeometry args={[.0028, 12, 10]} /></mesh>
    </group>
  );
});

/** Schematic deep-space probes launched on Falcon rockets. Europa Clipper: ~30 m solar span and a 3 m dish. */
export const ProbeModel = forwardRef<THREE.Group, Props & { variant: 'europa-clipper' | 'psyche' | 'hera' }>(function ProbeModel({ scale = 1, variant }, ref) {
  const m = spacecraftMaterials();
  const span = variant === 'europa-clipper' ? .3 : variant === 'psyche' ? .25 : .11;
  return (
    <group ref={ref} scale={scale} name={variant}>
      <mesh material={m.silver}><boxGeometry args={[.03, .03, variant === 'europa-clipper' ? .05 : .03]} /></mesh>
      <mesh position={[0, .025, 0]} rotation={[0, 0, 0]} material={m.antenna}><cylinderGeometry args={[variant === 'europa-clipper' ? .015 : .008, .002, .006, 20]} /></mesh>
      <group name="array">
        {(variant === 'psyche' ? [0, Math.PI / 2] : [0]).map((rot) => (
          <group key={rot} rotation={[0, rot, 0]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * (span / 4 + .015), 0, 0]} material={m.blueArray}><boxGeometry args={[span / 2, .0015, variant === 'europa-clipper' ? .04 : .022]} /></mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
});
