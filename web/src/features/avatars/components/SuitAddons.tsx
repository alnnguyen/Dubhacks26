import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Small procedural additions to the source suit: the life-support backpack (the
 * source character has none), the jetpack variant, cape and shoulder patch.
 * Each lives on an anchor that follows a bone, so it moves with the animation.
 */

interface AddonColors {
  shell: string;
  trim: string;
  accent: string;
}

function useAddonMaterials({ shell, trim, accent }: AddonColors) {
  const materials = useMemo(
    () => ({
      shell: new THREE.MeshPhysicalMaterial({ roughness: 0.38, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      trim: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 }),
      metal: new THREE.MeshStandardMaterial({ color: '#3a4049', roughness: 0.35, metalness: 0.75 }),
      glow: new THREE.MeshStandardMaterial({ color: '#000', emissiveIntensity: 2.2, toneMapped: false }),
    }),
    [],
  );
  useEffect(() => {
    materials.shell.color.set(shell);
    materials.trim.color.set(trim);
    materials.glow.emissive.set(accent);
  }, [accent, materials, shell, trim]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  return materials;
}

export function Backpack(colors: AddonColors) {
  const m = useAddonMaterials(colors);
  const geometry = useMemo(
    () => ({
      body: new RoundedBoxGeometry(0.4, 0.44, 0.16, 5, 0.05),
      panel: new RoundedBoxGeometry(0.28, 0.2, 0.03, 3, 0.012),
      tank: new THREE.CapsuleGeometry(0.045, 0.24, 8, 24),
      vent: new RoundedBoxGeometry(0.2, 0.018, 0.02, 2, 0.008),
    }),
    [],
  );
  useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);
  return (
    <group>
      <mesh geometry={geometry.body} material={m.shell} castShadow receiveShadow />
      <mesh geometry={geometry.panel} material={m.trim} position={[0, 0.06, -0.085]} castShadow />
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={geometry.vent} material={m.metal} position={[0, -0.09 - i * 0.04, -0.082]} />
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh geometry={geometry.tank} material={m.metal} position={[side * 0.215, -0.02, -0.01]} castShadow />
          <mesh material={m.glow} position={[side * 0.1, 0.06, -0.102]}>
            <circleGeometry args={[0.014, 20]} />
          </mesh>
        </group>
      ))}
      <mesh material={m.glow} position={[0, 0.17, -0.083]}>
        <boxGeometry args={[0.22, 0.012, 0.004]} />
      </mesh>
    </group>
  );
}

export function Jetpack(colors: AddonColors) {
  const m = useAddonMaterials(colors);
  const flame = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  const geometry = useMemo(
    () => ({
      core: new RoundedBoxGeometry(0.24, 0.36, 0.14, 4, 0.04),
      thruster: new THREE.CylinderGeometry(0.075, 0.075, 0.38, 32),
      cap: new THREE.SphereGeometry(0.075, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      nozzle: new THREE.CylinderGeometry(0.05, 0.075, 0.07, 32, 1, true),
      flame: new THREE.ConeGeometry(0.045, 0.18, 24, 1, true),
    }),
    [],
  );
  useEffect(() => {
    flame.color.set(colors.accent);
  }, [colors.accent, flame]);
  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      flame.dispose();
    },
    [flame, geometry],
  );
  useFrame((state) => {
    flame.opacity = 0.65 + Math.sin(state.clock.elapsedTime * 31) * 0.12 + Math.sin(state.clock.elapsedTime * 17) * 0.08;
  });
  return (
    <group>
      <mesh geometry={geometry.core} material={m.trim} castShadow />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.13, -0.02, -0.04]}>
          <mesh geometry={geometry.thruster} material={m.shell} castShadow />
          <mesh geometry={geometry.cap} material={m.shell} position={[0, 0.19, 0]} />
          <mesh geometry={geometry.nozzle} material={m.metal} position={[0, -0.225, 0]} />
          <mesh geometry={geometry.flame} material={flame} position={[0, -0.35, 0]} rotation={[Math.PI, 0, 0]} />
          <mesh material={m.glow} position={[0, 0.06, -0.076]}>
            <boxGeometry args={[0.05, 0.012, 0.004]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const CAPE_VERTEX_PATCH = /* glsl */ `
#include <begin_vertex>
float hang = clamp(-position.y / 0.62, 0.0, 1.0);
transformed.z -= hang * hang * 0.1 + sin(uTime * 2.1 + position.x * 5.0) * 0.025 * hang;
transformed.x += sin(uTime * 1.3 + position.y * 4.0) * 0.012 * hang;
`;

export function Cape({ color }: { color: string }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const geometry = useMemo(() => {
    // Hangs from y = 0 down, wider at the hem, curved around the back.
    const g = new THREE.PlaneGeometry(1, 0.62, 16, 20).translate(0, -0.31, 0);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const x = p.getX(i) * THREE.MathUtils.lerp(0.36, 0.56, -y / 0.62);
      p.setXYZ(i, x, y, -Math.cos(x * 2.4) * 0.06);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.78, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', CAPE_VERTEX_PATCH);
    };
    mat.customProgramCacheKey = () => 'astronaut-cape';
    return mat;
  }, [uniforms]);
  useEffect(() => {
    material.color.set(color);
  }, [color, material]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });
  return <mesh geometry={geometry} material={material} castShadow />;
}

function patchTexture(accent: string) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  g.fillStyle = '#0d1b2a';
  g.beginPath();
  g.arc(c, c, c - 4, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = accent;
  g.stroke();
  // Planet with a ring and a saber streak: the Jedi Space Duels mission patch.
  g.fillStyle = '#ff7a3d';
  g.beginPath();
  g.arc(c, c + 6, 46, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffd7b0';
  g.lineWidth = 7;
  g.beginPath();
  g.ellipse(c, c + 6, 78, 20, -0.35, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = accent;
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(c - 70, c + 70);
  g.lineTo(c + 64, c - 74);
  g.stroke();
  g.fillStyle = '#e8f8ff';
  g.font = '700 30px Rajdhani, Arial Narrow, sans-serif';
  g.textAlign = 'center';
  g.fillText('JSD', c, size - 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function ShoulderPatch({ accent }: { accent: string }) {
  const texture = useMemo(() => patchTexture(accent), [accent]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[0, Math.PI / 2, 0]}>
      <circleGeometry args={[0.075, 40]} />
      <meshStandardMaterial map={texture} roughness={0.7} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}
