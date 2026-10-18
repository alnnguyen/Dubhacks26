import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { ExploreDestination, ExploreEnvironment } from './destinations';
import { scaleBandForDistance, scaleLabel, showMilkyWayArt, type ScaleBand } from './scaleLevels';
import { FlightMotion, flightBodies, nearestFlightBody } from './flightMotion';
import { useInspectFly } from './useInspectFly';

export interface FlightTelemetry {
  speed: number;
  nearestName: string;
  nearestId: string;
  nearestDistance: number;
  position: [number, number, number];
  absoluteDistance: number;
  scaleBand: ScaleBand;
  scaleLabel: string;
  showMilkyWay: boolean;
  boosting: boolean;
  pointerLocked: boolean;
  localNavigation?: { range: number; focus: string; inTransit: boolean; zooming: boolean };
}
export interface FlightInput { thrust: number; yaw: number; pitch: number; strafe: number; brake: boolean; cruise?: boolean }
export type FlightChrome = 'drive' | 'cabin';
export interface ShipFlightControllerProps {
  enabled: boolean;
  destination?: ExploreDestination;
  spawn: readonly [number, number, number];
  yaw: number;
  pitch?: number;
  environment: ExploreEnvironment;
  reducedMotion: boolean;
  parallax: boolean;
  input: FlightInput;
  worldRef: RefObject<THREE.Group | null>;
  contentRef: RefObject<THREE.Group | null>;
  onTelemetry: (t: FlightTelemetry) => void;
  resetToken: number;
  chrome?: FlightChrome;
  onWarpRequest?: () => void;
  /** Solar body id under inspect — triggers flyTo / flyBack. */
  inspectId?: string | null;
}
const FLIGHT_KEYS = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyN']);
const editable = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]');

export function ShipFlightController({ enabled, destination, spawn, yaw, pitch = 0, environment, input, worldRef, contentRef, onTelemetry, resetToken, onWarpRequest, inspectId }: ShipFlightControllerProps) {
  const { camera, gl, scene } = useThree();
  const motion = useRef(new FlightMotion());
  const keys = useRef(new Set<string>());
  const dragging = useRef<{ id: number; x: number; y: number } | null>(null);
  const timer = useRef(0);
  const onTelem = useRef(onTelemetry);
  const onNav = useRef(onWarpRequest);
  onTelem.current = onTelemetry;
  onNav.current = onWarpRequest;
  const bodies = useMemo(() => flightBodies(environment, destination), [environment, destination]);
  const inverse = useMemo(() => new THREE.Quaternion(), []);
  const [sx, sy, sz] = spawn;
  useEffect(() => { motion.current.setSpawn([sx, sy, sz], yaw, pitch, resetToken); }, [sx, sy, sz, yaw, pitch, resetToken]);
  useInspectFly(motion, inspectId);

  useEffect(() => {
    const reset = () => { keys.current.clear(); dragging.current = null; motion.current.stop(); };
    reset();
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!enabled || editable(e.target) || !FLIGHT_KEYS.has(e.code)) return;
      e.preventDefault();
      if (e.code === 'KeyN') { if (!e.repeat) onNav.current?.(); return; }
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code); };
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    const el = gl.domElement;
    const pointerDown = (e: PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      dragging.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.focus();
    };
    const pointerMove = (e: PointerEvent) => {
      const drag = dragging.current;
      if (!drag || drag.id !== e.pointerId || !enabled) return;
      motion.current.look(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX; drag.y = e.clientY;
    };
    const pointerEnd = () => { dragging.current = null; };
    el.tabIndex = 0;
    el.setAttribute('aria-label', 'Universe flight view. W and S move, arrow keys steer.');
    el.addEventListener('pointerdown', pointerDown);
    el.addEventListener('pointermove', pointerMove);
    el.addEventListener('pointerup', pointerEnd);
    el.addEventListener('pointercancel', pointerEnd);
    el.addEventListener('lostpointercapture', pointerEnd);
    return () => {
      reset();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
      el.removeEventListener('pointerdown', pointerDown);
      el.removeEventListener('pointermove', pointerMove);
      el.removeEventListener('pointerup', pointerEnd);
      el.removeEventListener('pointercancel', pointerEnd);
      el.removeEventListener('lostpointercapture', pointerEnd);
    };
  }, [enabled, gl]);

  useFrame((_, dt) => {
    const k = keys.current;
    const axis = (positive: string, negative: string) => Number(k.has(positive)) - Number(k.has(negative));
    const boosting = k.has('ShiftLeft') || k.has('ShiftRight');
    const ship = motion.current;
    ship.step(document.hidden?0:dt, {
      thrust: Math.max(-1, Math.min(1, input.thrust + axis('KeyW', 'KeyS') + (input.cruise ? 0.6 : 0))),
      strafe: input.strafe + axis('KeyD', 'KeyA'),
      lift: axis('KeyQ', 'KeyE'),
      yaw: input.yaw + axis('ArrowLeft', 'ArrowRight'),
      pitch: input.pitch + axis('ArrowUp', 'ArrowDown'),
      brake: input.brake || k.has('Space'), boost: boosting,
    }, bodies, (enabled || ship.flying) && !document.hidden, environment === 'mars-surface' ? 4 : undefined);
    inverse.copy(ship.orientation).invert();
    // One composed camera-relative transform avoids accumulating world/child offsets.
    if (worldRef.current) {
      worldRef.current.quaternion.copy(inverse);
      worldRef.current.position.copy(ship.position).negate().applyQuaternion(inverse);
    }
    contentRef.current?.position.set(0, 0, 0);
    scene.backgroundRotation.setFromQuaternion(inverse);
    camera.position.set(0, 0, 0);
    camera.quaternion.identity();
    timer.current += dt;
    if (timer.current < 0.1) return;
    timer.current = 0;
    const target = ['stars','galaxies','exoplanets'].includes(environment) ? bodies.find(b => b.id === destination?.bodyId) : null;
    const nearest = target ? { body: target, distance: Math.max(0, ship.position.distanceTo(new THREE.Vector3(...target.position)) - target.radius) } : nearestFlightBody(ship.position, bodies);
    const band = scaleBandForDistance(ship.position.length(), environment);
    onTelem.current({
      speed: ship.velocity.length(), position: ship.position.toArray() as [number, number, number],
      nearestId: nearest?.body.id ?? (environment === 'galaxy' ? 'milky-way' : 'mars-surface'),
      nearestName: nearest?.body.name ?? (environment === 'galaxy' ? 'Milky Way' : 'Mars surface'),
      nearestDistance: nearest?.distance ?? (environment === 'galaxy' ? ship.position.length() : Math.max(0, ship.position.y - 4)),
      absoluteDistance: ship.position.length(), scaleBand: band, scaleLabel: scaleLabel(band),
      showMilkyWay: showMilkyWayArt(band), boosting, pointerLocked: dragging.current !== null,
    });
  });
  return null;
}
