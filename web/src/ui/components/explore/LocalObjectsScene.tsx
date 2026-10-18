import { forwardRef, useEffect, useMemo, useRef, type ComponentType, type RefAttributes } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { DOCKED_AT_ISS, LIVE_POSITIONS, LOCAL_OBJECTS, LOCAL_OBJECT_INDEX, MODEL_SATELLITES, PROBES, SATELLITES, objectOrbit, satellitePositionAt, type LocalObject } from './localObjects';
import { CatalogPoints } from './CatalogScene';
import { HubbleModel, IssModel, ProbeModel, RoadsterModel, StarlinkModel } from './SpacecraftModels';
import { orbitClock } from './orbitClock';
import { SOLAR_BODIES, bodyWorldPosition } from './bodies';
import type { LocalNavigation } from './localNavigation';

const EARTH = new THREE.Vector3(...bodyWorldPosition(SOLAR_BODIES.find((b) => b.id === 'earth')!));
/** Models stay hidden beyond this camera distance (system / star scales). */
const MODEL_RANGE = 420;

type ModelComponent = ComponentType<{ scale?: number } & RefAttributes<THREE.Group>>;
function craftFor(o: LocalObject): { Model: ModelComponent; span: number; base: number } {
  if (o.id === 'sat-25544') return { Model: IssModel, span: 1.09, base: 2.6 };
  if (o.id === 'sat-20580') return { Model: HubbleModel, span: .26, base: 6 };
  if (o.id === 'sat-43435') return { Model: TessModel, span: .11, base: 7 };
  return { Model: StarlinkModel, span: .13, base: 10 };
}

function OrbitPath({ id, opacity, color }: { id: string; opacity: number; color: string }) {
  const line = useMemo(() => {
    const object = LOCAL_OBJECT_INDEX.get(id)!;
    const geometry = new THREE.BufferGeometry().setFromPoints(objectOrbit(object).map((p) => new THREE.Vector3(...p)));
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  }, [id, opacity, color]);
  useEffect(() => () => { line.geometry.dispose(); (line.material as THREE.Material).dispose(); }, [line]);
  return <primitive object={line} />;
}

/** One spacecraft: flies along its orbit on the shared clock, faces its direction of travel, arrays track the Sun. */
function Craft({ o, navigation }: { o: LocalObject; navigation: LocalNavigation }) {
  const holder = useRef<THREE.Group>(null);
  const model = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const { Model, span, base } = craftFor(o);
  const tmp = useMemo(() => ({ ahead: new THREE.Vector3(), down: new THREE.Vector3(), sun: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), local: new THREE.Vector3() }), []);
  useFrame(() => {
    const g = holder.current;
    if (!g) return;
    const p = LIVE_POSITIONS.get(o.id) ?? o.position;
    g.position.set(...p);
    const distance = g.position.distanceTo(navigation.motion.position);
    g.visible = distance < MODEL_RANGE;
    if (!g.visible) return;
    // Readable at any zoom, but never more than 4× its display size.
    // Beacons only help from afar; up close the model itself reads clearly.
    if (beacon.current) beacon.current.visible = distance > 30;
    const focus = navigation.focusId === o.id ? 1.3 : 1;
    g.scale.setScalar(focus * Math.min(base * 3, Math.max(base, (distance * .07) / span)));
    tmp.ahead.set(...satellitePositionAt(o, orbitClock.seconds + 20)).sub(g.position);
    tmp.down.copy(EARTH).sub(g.position).normalize();
    if (tmp.ahead.lengthSq() > 1e-8) {
      tmp.m.lookAt(new THREE.Vector3(), tmp.ahead.normalize().negate(), tmp.down.negate());
      g.quaternion.setFromRotationMatrix(tmp.m);
    }
    // Sun is at the local origin: rotate each array about the model's X axis toward it.
    tmp.sun.copy(g.position).negate().normalize();
    tmp.local.copy(tmp.sun).applyQuaternion(tmp.q.copy(g.quaternion).invert());
    const angle = Math.atan2(tmp.local.z, tmp.local.y);
    model.current?.traverse((child) => { if (child.name === 'array') child.rotation.x = angle; });
  });
  return (
    <group ref={holder}>
      {o.id === 'sat-25544' ? <IssModel ref={model} dragons={DOCKED_AT_ISS.length} /> : <Model ref={model} />}
      {/* UI beacon so craft read against Earth's night side; not a physical light. */}
      <mesh ref={beacon} scale={span * .09}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#a1e5ff" toneMapped={false} transparent opacity={.9} /></mesh>
    </group>
  );
}

export function LocalObjectsScene({ navigation, onLearn }: { navigation: LocalNavigation; onLearn: (id: string) => void }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.visible = navigation.motion.position.length() < 5000;
    // Parked at a spacecraft: hold the time-lapse so it doesn't drift away from the camera.
    orbitClock.setHeld(navigation.focusId.startsWith('sat-'));
    orbitClock.tick(document.hidden ? 0 : dt);
    for (const o of SATELLITES) LIVE_POSITIONS.set(o.id, satellitePositionAt(o, orbitClock.seconds));
  });
  // Spacecraft are drawn as models; the point cloud keeps asteroids and comets.
  const rows = useMemo(() => LOCAL_OBJECTS.filter((o) => o.kind !== 'satellite').map((o) => ({ id: o.id, position: o.position, color: o.kind === 'probe' ? '#87dcff' : o.kind === 'comet' ? '#97e8f2' : '#dcc3a2' })), []);
  const selected = LOCAL_OBJECT_INDEX.get(navigation.focusId);
  const look = useMemo(() => new THREE.Quaternion(), []);
  if (selected?.kind === 'comet') look.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...selected.position).normalize());
  return (
    <group ref={group} name="cataloged-local-objects">
      <CatalogPoints rows={rows} size={3} onLearn={onLearn} />
      <group name="starlink-shell">
        {MODEL_SATELLITES.map((o) => o.id !== selected?.id && (
          <OrbitPath key={o.id} id={o.id} opacity={o.name.startsWith('STARLINK') ? .1 : .22} color={o.name.startsWith('STARLINK') ? '#87dcff' : '#a1e5ff'} />
        ))}
      </group>
      {/* A subset is modeled to keep Earth readable; the selected craft is always drawn. Hover/click via HoverPicker. */}
      {MODEL_SATELLITES.map((o) => <Craft key={o.id} o={o} navigation={navigation} />)}
      {selected?.kind === 'satellite' && !MODEL_SATELLITES.includes(selected) && <Craft o={selected} navigation={navigation} />}
      {PROBES.map((o) => <ProbeCraft key={o.id} o={o} navigation={navigation} />)}
      {selected && <>
        <OrbitPath id={selected.id} opacity={.55} color={selected.kind === 'satellite' ? '#87dcff' : '#a9c0dc'} />
        {(selected.kind === 'asteroid' || selected.kind === 'comet') && <group position={selected.position}>
          <mesh onClick={(e) => { if (e.delta > 5) return; e.stopPropagation(); onLearn(selected.id); }}><icosahedronGeometry args={[selected.radius, 1]} /><meshStandardMaterial color={selected.kind === 'comet' ? '#99bbc5' : '#9a8672'} roughness={1} flatShading /></mesh>
          {selected.kind === 'comet' && <group quaternion={look}><mesh position={[0, 2.8, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.9, 5, 16]} /><meshBasicMaterial color="#81d9ed" transparent opacity={.18} depthWrite={false} /></mesh></group>}
        </group>}
      </>}
    </group>
  );
}

const TessModel = forwardRef<THREE.Group, { scale?: number }>(function TessModel(props, ref) { return <ProbeModel ref={ref} {...props} variant="hera" />; });

const PROBE_LOOK: Record<string, { span: number; base: number; variant?: 'europa-clipper' | 'psyche' | 'hera' }> = {
  'sx-roadster': { span: .039, base: 60 },
  'sx-europa-clipper': { span: .3, base: 4, variant: 'europa-clipper' },
  'sx-psyche': { span: .25, base: 4.5, variant: 'psyche' },
  'sx-hera': { span: .11, base: 9, variant: 'hera' },
};
/** Heliocentric spacecraft at their snapshot positions; modeled up close, a cyan catalog point from afar. */
function ProbeCraft({ o, navigation }: { o: LocalObject; navigation: LocalNavigation }) {
  const holder = useRef<THREE.Group>(null);
  const look = PROBE_LOOK[o.id] ?? { span: .1, base: 8, variant: 'hera' as const };
  const sun = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const g = holder.current;
    if (!g) return;
    const distance = g.position.distanceTo(navigation.motion.position);
    g.visible = distance < 160;
    if (!g.visible) return;
    g.scale.setScalar(Math.min(look.base * 3, Math.max(look.base, (distance * .07) / look.span)));
    // Arrays face the Sun (at the local origin); the Roadster tumbles slowly, as it has since 2018.
    g.lookAt(sun);
    if (o.id === 'sx-roadster') g.rotateZ(clock.elapsedTime * .15);
  });
  return (
    <group ref={holder} position={o.position}>
      {o.id === 'sx-roadster' ? <RoadsterModel /> : <ProbeModel variant={look.variant ?? 'hera'} />}
    </group>
  );
}
