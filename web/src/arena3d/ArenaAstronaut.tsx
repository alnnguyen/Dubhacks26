import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { createJointSuit, BATTLE_ASTRONAUT_URL, segmentQuaternion, type SuitPiece } from './astronautPieces';
import { atlasOf, recoloredAtlas } from '../features/avatars/utils/astronautModel';
import { useFrame } from '@react-three/fiber';
import type { ArenaFrame, PlayerSlot } from '../../../server/src/contracts';
import type { AvatarLook } from '../features/avatars/components/AstronautAvatar';
import { Helmet } from '../features/avatars/components/Helmet';
import { Backpack, Cape, Jetpack, ShoulderPatch } from '../features/avatars/components/SuitAddons';
import { ACCENT_PALETTES, SUIT_PALETTES } from '../features/avatars/utils/palette';
import { bodyBasis, placeSuitSegment } from './jointSuit';
import type { ImpactFlash } from './ArenaScene';

// All pieces terminate at the original stick figure's streamed joints.
const LIMBS: [number, number, number][] = [
  [11, 13, 0.072], [13, 15, 0.062], [12, 14, 0.072], [14, 16, 0.062],
  [23, 25, 0.08], [25, 27, 0.066], [24, 26, 0.08], [26, 28, 0.066],
];
const LIMB_PIECES: SuitPiece[] = ['upperL', 'lowerL', 'upperR', 'lowerR', 'thighL', 'shinL', 'thighR', 'shinR'];
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

/** A cosmetic suit on main's skeleton; no model rig or animation can move its joints. */
export function ArenaAstronaut({ frameRef, flashRef, slot, look, faceTexture = null, opacity = 1 }: {
  frameRef: RefObject<ArenaFrame | null>;
  flashRef: RefObject<ImpactFlash | null>;
  slot: PlayerSlot;
  look: AvatarLook;
  faceTexture?: THREE.Texture | null;
  opacity?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const limbs = useRef<(THREE.Group | null)[]>([]);
  const joints = useRef<(THREE.Mesh | null)[]>([]);
  const torso = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const helmet = useRef<THREE.Group>(null);
  const boots = useRef<(THREE.Group | null)[]>([]);
  const patch = useRef<THREE.Group>(null);
  const suit = SUIT_PALETTES[look.suit];
  const accent = ACCENT_PALETTES[look.accent].color;
  const gltf = useGLTF(BATTLE_ASTRONAUT_URL);
  const materials = useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.12 }),
    dark: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
  }), []);
  useEffect(() => {
    materials.shell.color.set('#ffffff');
    materials.shell.map = recoloredAtlas(atlasOf(gltf), { main: suit.main, shade: suit.dark, accent });
    materials.shell.needsUpdate = true;
    materials.dark.color.set(suit.dark);
  }, [materials, suit, accent, gltf]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  const jointSuit = useMemo(() => createJointSuit(gltf, materials.shell), [gltf, materials]);
  useEffect(() => () => jointSuit.dispose(), [jointSuit]);
  // Helmet and accessory materials mount in their own effects; apply ghosting after those.
  useFrame(() => {
    const player = frameRef.current?.players.find((p) => p.slot === slot);
    const raw = player?.joints;
    if (!root.current) return;
    root.current.visible = Boolean(raw && raw.length >= 29);
    if (!raw || raw.length < 29) return;
    const j = raw.map((p) => new THREE.Vector3(p[0], p[1], -p[2]));
    JOINTS.forEach((index, i) => joints.current[i]?.position.copy(j[index]));
    const shoulders = j[11].clone().add(j[12]).multiplyScalar(0.5);
    const hips = j[23].clone().add(j[24]).multiplyScalar(0.5);
    // Seat the same helmet at the padded collar, without a long exposed neck.
    // This is a cosmetic offset only: tracked joints and hit geometry stay untouched.
    const up = shoulders.clone().sub(hips).normalize();
    const head = j[0].clone();
    const headHeight = head.clone().sub(shoulders).dot(up);
    head.addScaledVector(up, -Math.max(0, headHeight - 0.155));
    if (neck.current) placeSuitSegment(neck.current, shoulders, head);
    const basis = bodyBasis(j[11], j[12], hips, shoulders);
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(basis ?? new THREE.Quaternion());
    LIMBS.forEach(([a, b], i) => {
      const limb = limbs.current[i];
      if (!limb) return;
      placeSuitSegment(limb, j[a], j[b]);
      if (limb.visible) limb.quaternion.copy(segmentQuaternion(j[a], j[b], front));
    });
    const width = THREE.MathUtils.clamp(j[11].distanceTo(j[12]), 0.2, 0.65);
    const height = shoulders.distanceTo(hips);
    if (torso.current) {
      torso.current.position.copy(hips).lerp(shoulders, 0.5);
      if (basis) torso.current.quaternion.copy(basis);
      torso.current.scale.set(width * 0.82, Math.max(height, 0.1), width * 0.44);
    }
    if (helmet.current) {
      helmet.current.position.copy(head);
      if (basis) helmet.current.quaternion.copy(basis);
    }
    boots.current.forEach((boot, i) => {
      if (!boot) return;
      boot.position.copy(j[i === 0 ? 27 : 28]);
      if (basis) boot.quaternion.copy(basis);
    });
    if (patch.current) {
      patch.current.position.copy(j[11]);
      if (basis) patch.current.quaternion.copy(basis);
    }
    // Deform the original connected suit with the same endpoint transforms as the stickmen.
    LIMBS.forEach(([, , radius], i) => {
      const limb = limbs.current[i];
      if (!limb) return;
      limb.updateMatrix();
      jointSuit.setPiece(LIMB_PIECES[i], limb.matrix.clone().multiply(new THREE.Matrix4().makeScale(radius, 1, radius)));
    });
    if (torso.current) { torso.current.updateMatrix(); jointSuit.setPiece('torso', torso.current.matrix); }
    boots.current.forEach((boot, i) => {
      if (!boot) return;
      boot.updateMatrix();
      jointSuit.setPiece(i === 0 ? 'bootL' : 'bootR', boot.matrix.clone().multiply(new THREE.Matrix4().makeScale(0.105, 0.13, 0.18)));
    });
    const flash = flashRef.current;
    const hit = flash?.kind === 'hit' && performance.now() - flash.startedMs < 300 &&
      Math.hypot(flash.at[0] - raw[11][0], flash.at[1] - raw[11][1], flash.at[2] - raw[11][2]) < 0.8;
    materials.shell.emissive.set(hit ? '#ffffff' : '#000000');
    materials.shell.emissiveIntensity = hit ? 1.5 : 0;
    root.current.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        m.userData.baseOpacity ??= m.opacity;
        m.userData.baseTransparent ??= m.transparent;
        m.userData.baseDepthWrite ??= m.depthWrite;
        const transparent = opacity < 1 || m.userData.baseTransparent;
        if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
        m.opacity = m.userData.baseOpacity * opacity;
        m.depthWrite = opacity < 1 ? false : m.userData.baseDepthWrite;
      }
    });
  });
  const has = (id: AvatarLook['accessories'][number]) => look.accessories.includes(id);
  return <group ref={root} visible={false}>
    <primitive object={jointSuit.mesh} dispose={null} />
    {LIMBS.map(([a, b], i) => <group key={`${a}-${b}`} ref={(g) => { limbs.current[i] = g; }} />)}
    {JOINTS.map((index, i) => <mesh key={index} ref={(m) => { joints.current[i] = m; }} material={materials.dark} castShadow>
      <sphereGeometry args={[index >= 23 ? 0.04 : 0.033, 12, 10]} />
    </mesh>)}
    <group ref={torso}>
      {/* Addons retain their own proportions; the torso anchor follows shoulder/hip orientation. */}
      <group position={[0, 0.12, -0.7]} scale={[2.0, 1.8, 3.6]}>
        {has('jetpack') ? <Jetpack shell={suit.main} trim={suit.trim} accent={accent} /> : <Backpack shell={suit.main} trim={suit.trim} accent={accent} />}
        {has('cape') && <group position={[0, 0.2, -0.1]}><Cape color={suit.dark} /></group>}
      </group>
    </group>
    <group ref={neck}><mesh material={materials.dark}><cylinderGeometry args={[0.043, 0.055, 1, 12]} /></mesh></group>
    <group ref={helmet}><Helmet radius={0.145} shellColor={suit.main} accentColor={accent} faceTexture={faceTexture} antenna={has('antenna')} /></group>
    {[0, 1].map((i) => <group key={i} ref={(g) => { boots.current[i] = g; }} />)}
    {has('patch') && <group ref={patch}><group position={[-0.045, -0.035, 0]} rotation={[0, Math.PI, 0]} scale={0.65}><ShoulderPatch accent={accent} /></group></group>}
  </group>;
}
