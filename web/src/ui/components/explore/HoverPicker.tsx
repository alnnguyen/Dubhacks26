import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import { CATALOG_STARS, PC_TO_LY } from './catalog';
import { DOCKED_AT_ISS, LIVE_POSITIONS, LOCAL_OBJECT_INDEX, MODEL_SATELLITES, PROBES } from './localObjects';
import { LOCAL_RADIUS_PC, localStarOpacity, localStarPosition, type LocalNavigation } from './localNavigation';
import { LOCAL_GALAXIES, galaxyLayerOpacity, nearbyStarFade } from './cosmicScale';
import { SOLAR_BODIES, bodyWorldPosition } from './bodies';

const EARTH = bodyWorldPosition(SOLAR_BODIES.find((b) => b.id === 'earth')!);

type Candidate = { id: string; name: string; detail: string; position: [number, number, number]; kind: 'craft' | 'star' | 'galaxy'; named?: boolean };
const STARS: Candidate[] = [
  { id: 'sun', name: 'Sun / Sol', detail: 'Our star · G2V', position: [0, 0, 0], kind: 'star', named: true },
  ...CATALOG_STARS.filter((s) => s.distancePc <= LOCAL_RADIUS_PC).map((s) => ({
    id: s.id, name: s.name, kind: 'star' as const, position: localStarPosition(s.id)!, named: s.named,
    detail: `${(s.distancePc * PC_TO_LY).toFixed(2)} ly${s.spectralType ? ` · ${s.spectralType}` : ''}`,
  })),
];
const GALAXIES: Candidate[] = LOCAL_GALAXIES.map((g) => ({ id: g.id, name: g.name, kind: 'galaxy', position: g.position, detail: `${(g.distanceMpc * PC_TO_LY).toFixed(g.distanceMpc < 3 ? 2 : 0)} million ly` }));
function craft(id: string): Candidate {
  const o = LOCAL_OBJECT_INDEX.get(id)!;
  const altitude = Math.round(o.elements.a * (1 - o.elements.e) - 6371);
  const docked = id === 'sat-25544' && DOCKED_AT_ISS.length ? ` · ${DOCKED_AT_ISS.length} Dragon${DOCKED_AT_ISS.length > 1 ? 's' : ''} docked` : '';
  return { id, name: o.name, kind: 'craft', position: o.position, detail: `${o.name.startsWith('STARLINK') ? 'SpaceX Starlink' : 'Spacecraft'} · ${altitude.toLocaleString('en-US')} km${docked}` };
}

/**
 * Screen-space hover for things too small to hit-test: spacecraft, nearby stars and galaxies.
 * Shows a cyan reticle + name tag; a click (not a drag) opens the learn card.
 */
export function HoverPicker({ navigation, onLearn }: { navigation: LocalNavigation; onLearn: (id: string) => void }) {
  const { gl, camera, size } = useThree();
  const group = useRef<Group>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const hovered = useRef<Candidate | null>(null);
  const learn = useRef(onLearn); learn.current = onLearn;
  const p = useMemo(() => new Vector3(), []);
  const crafts = useMemo(() => MODEL_SATELLITES.map((o) => craft(o.id)), []);
  const probes = useMemo<Candidate[]>(() => PROBES.map((o) => ({ id: o.id, name: o.name, kind: 'craft', position: o.position, detail: `Launched on SpaceX ${o.launch?.vehicle} · ${o.launch?.operator}` })), []);
  const dom = useMemo(() => {
    const root = document.createElement('div'); root.className = 'ex-hover'; root.hidden = true;
    const ring = document.createElement('span'); ring.className = 'ex-hover__ring';
    const tag = document.createElement('span'); tag.className = 'ex-hover__tag';
    const name = document.createElement('strong'); const detail = document.createElement('small');
    tag.append(name, detail); root.append(ring, tag);
    return { root, name, detail };
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    el.parentElement?.append(dom.root);
    const rect = () => el.getBoundingClientRect();
    const move = (e: PointerEvent) => { const r = rect(); pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const leave = () => { pointer.current = null; };
    const pressed = (e: PointerEvent) => { down.current = { x: e.clientX, y: e.clientY }; };
    // Capture-phase click: when the reticle is on something, it wins over whatever 3D mesh is behind it
    // (e.g. a Starlink in front of Earth), so the 3D scene never sees this click.
    const clicked = (e: MouseEvent) => {
      const d = down.current; down.current = null;
      if (!hovered.current || !(e.target instanceof Node) || !el.parentElement?.contains(e.target)) return;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      e.stopPropagation();
      learn.current(hovered.current.id);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerdown', pressed); window.addEventListener('click', clicked, true);
    return () => {
      dom.root.remove(); document.body.style.removeProperty('cursor');
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointerdown', pressed); window.removeEventListener('click', clicked, true);
    };
  }, [gl, dom]);

  useFrame(() => {
    const g = group.current, at = pointer.current;
    let best: Candidate | null = null, bestX = 0, bestY = 0, bestD = Infinity;
    if (g && at) {
      g.updateWorldMatrix(true, false);
      const range = navigation.range;
      const layers: { items: Candidate[]; radius: number }[] = [];
      // Spacecraft are only modeled near Earth.
      if (navigation.motion.position.distanceTo(p.set(...EARTH)) < 420) {
        for (const c of crafts) c.position = LIVE_POSITIONS.get(c.id) ?? c.position;
        layers.push({ items: crafts, radius: 26 });
      }
      if (range < 7000) layers.push({ items: probes, radius: 20 });
      if (localStarOpacity(Math.max(range, navigation.motion.position.length())) * nearbyStarFade(range) > .15) layers.push({ items: STARS, radius: 12 });
      if (galaxyLayerOpacity(range) > .15) layers.push({ items: GALAXIES, radius: 12 });
      for (const layer of layers) {
        for (const c of layer.items) {
          p.set(...c.position).applyMatrix4(g.matrixWorld).project(camera);
          if (p.z < -1 || p.z > 1) continue;
          const x = (p.x + 1) * size.width / 2, y = (1 - p.y) * size.height / 2;
          // Named stars are easier to catch than anonymous catalog entries.
          const d = Math.hypot(x - at.x, y - at.y) * (c.kind === 'star' && !c.named ? 1.8 : 1);
          if (d < layer.radius && d < bestD) { best = c; bestD = d; bestX = x; bestY = y; }
        }
      }
    }
    if (best !== hovered.current) {
      hovered.current = best;
      dom.root.hidden = !best;
      if (best) { dom.name.textContent = best.name; dom.detail.textContent = `${best.detail} · click to learn`; dom.root.dataset.kind = best.kind; }
      if (best) document.body.style.cursor = 'pointer'; else document.body.style.removeProperty('cursor');
    }
    if (best) dom.root.style.transform = `translate(${bestX}px, ${bestY}px)`;
  });
  return <group ref={group} name="hover-picker" />;
}
