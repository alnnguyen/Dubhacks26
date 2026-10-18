import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createFaceMaterial, createPlaceholderFace } from '../utils/faceMaterial';

/** Visor opening: centered slightly below the helmet's equator, wide enough to frame the face. */
const OPENING_AXIS = new THREE.Vector3(0, -0.08, 1).normalize();
const OPENING_HALF_ANGLE = THREE.MathUtils.degToRad(60);
const AXIS_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), OPENING_AXIS);

/** Unit sphere with the visor opening cut out (the rim torus hides the cut edge). */
function shellGeometry() {
  const sphere = new THREE.SphereGeometry(1, 96, 64);
  const position = sphere.getAttribute('position');
  const index = sphere.index!;
  const keep: number[] = [];
  const centroid = new THREE.Vector3();
  const v = new THREE.Vector3();
  const cosLimit = Math.cos(OPENING_HALF_ANGLE);
  for (let t = 0; t < index.count; t += 3) {
    centroid.set(0, 0, 0);
    for (let k = 0; k < 3; k++) centroid.add(v.fromBufferAttribute(position, index.getX(t + k)));
    if (centroid.normalize().dot(OPENING_AXIS) > cosLimit) continue;
    keep.push(index.getX(t), index.getX(t + 1), index.getX(t + 2));
  }
  sphere.setIndex(keep);
  return sphere;
}

export interface HelmetProps {
  radius: number;
  shellColor: string;
  accentColor: string;
  faceTexture: THREE.Texture | null;
  antenna?: boolean;
}

export function Helmet({ radius: R, shellColor, accentColor, faceTexture, antenna }: HelmetProps) {
  const geometry = useMemo(
    () => ({
      shell: shellGeometry(),
      visor: new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, OPENING_HALF_ANGLE + 0.02).rotateX(Math.PI / 2),
      rim: new THREE.TorusGeometry(1, 0.075, 20, 96),
      glowRing: new THREE.TorusGeometry(1, 0.018, 8, 96),
      head: new THREE.SphereGeometry(1, 64, 48),
      collar: new THREE.TorusGeometry(1, 0.2, 24, 72),
      pod: new THREE.CylinderGeometry(1, 1, 1, 40),
      podLight: new THREE.CircleGeometry(1, 40),
    }),
    [],
  );
  const face = useMemo(() => createFaceMaterial('#ebe7e0'), []);
  const placeholder = useMemo(() => createPlaceholderFace(), []);
  const materials = useMemo(
    () => ({
      shell: new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 }),
      metal: new THREE.MeshStandardMaterial({ color: '#3a4049', roughness: 0.35, metalness: 0.75 }),
      lining: new THREE.MeshStandardMaterial({ color: '#2a3038', roughness: 0.9, side: THREE.BackSide }),
      glow: new THREE.MeshStandardMaterial({ color: '#000000', emissiveIntensity: 2.2, toneMapped: false }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#bfe6ff',
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        envMapIntensity: 1.6,
      }),
    }),
    [],
  );

  useEffect(() => {
    materials.shell.color.set(shellColor);
  }, [materials, shellColor]);
  useEffect(() => {
    materials.glow.emissive.set(accentColor);
  }, [materials, accentColor]);
  useEffect(() => {
    face.uniforms.faceMap.value = faceTexture ?? placeholder;
    face.uniforms.hasFace.value = 1;
  }, [face, faceTexture, placeholder]);

  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      face.material.dispose();
      placeholder.dispose();
    },
    [face, geometry, materials, placeholder],
  );

  const rimDistance = Math.cos(OPENING_HALF_ANGLE) * R;
  const rimRadius = Math.sin(OPENING_HALF_ANGLE) * R;
  const collarY = -R * 0.86;
  const collarRadius = Math.sqrt(1 - 0.86 * 0.86) * R * 1.12;

  return (
    <group>
      <mesh geometry={geometry.shell} material={materials.shell} scale={R} castShadow receiveShadow />
      {/* Padded interior, seen around the head through the visor */}
      <mesh geometry={geometry.shell} material={materials.lining} scale={R * 0.97} />
      {/* Visor rim + accent light strip framing the face */}
      <group quaternion={AXIS_QUAT}>
        <mesh geometry={geometry.rim} material={materials.metal} position={[0, 0, rimDistance]} scale={rimRadius} castShadow />
        <mesh geometry={geometry.glowRing} material={materials.glow} position={[0, 0, rimDistance + R * 0.06]} scale={rimRadius * 0.955} />
      </group>
      {/* Head in a comm cap, with the photo face projected onto its front */}
      <mesh geometry={geometry.head} material={face.material} position={[0, -R * 0.08, R * 0.1]} scale={[R * 0.56, R * 0.66, R * 0.58]} castShadow />
      {/* Single transparent layer: the visor glass */}
      <mesh geometry={geometry.visor} material={materials.glass} scale={R * 0.995} renderOrder={2} />
      {/* Neck collar where the helmet seats on the suit */}
      <group position={[0, collarY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={geometry.collar} material={materials.metal} scale={[collarRadius, collarRadius, collarRadius * 0.9]} castShadow />
        <mesh geometry={geometry.glowRing} material={materials.glow} position={[0, 0, -R * 0.02]} scale={collarRadius * 1.2} />
      </group>
      {/* Side comm pods */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * R * 0.97, -R * 0.05, 0]} rotation={[0, 0, (side * Math.PI) / 2]}>
          <mesh geometry={geometry.pod} material={materials.metal} scale={[R * 0.24, R * 0.16, R * 0.24]} castShadow />
          <mesh geometry={geometry.pod} material={materials.shell} position={[0, -side * R * 0.07, 0]} scale={[R * 0.2, R * 0.06, R * 0.2]} />
          <mesh
            geometry={geometry.podLight}
            material={materials.glow}
            position={[0, -side * R * 0.105, 0]}
            rotation={[(side * Math.PI) / 2, 0, 0]}
            scale={R * 0.07}
          />
        </group>
      ))}
      {antenna && (
        <group position={[R * 0.42, R * 0.86, -R * 0.15]} rotation={[-0.25, 0, -0.35]}>
          <mesh material={materials.metal} position={[0, R * 0.3, 0]} castShadow>
            <cylinderGeometry args={[R * 0.025, R * 0.04, R * 0.6, 12]} />
          </mesh>
          <mesh material={materials.glow} position={[0, R * 0.64, 0]}>
            <sphereGeometry args={[R * 0.085, 24, 16]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
