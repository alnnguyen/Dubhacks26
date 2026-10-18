import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { CameraPose } from './cockpitLayout';
import { LAYOUT } from './cockpitLayout';
import type { CinematicPhase } from '../../cinematics/sequence';

export interface CameraControllerProps {
  pose: CameraPose;
  reducedMotion: boolean;
  parallax: boolean;
  /** A HUD panel is open: reframe so the focused console isn't hidden behind it. */
  panelOpen: boolean;
  /** Main cockpit view: let turning the phone look around widely. */
  lookAround: boolean;
  cinematicPhase?: CinematicPhase;
  marsTarget?: React.RefObject<THREE.Group | null>;
}

/** Vertical FOV that keeps ~64° horizontally on portrait phones, capped for landscape. */
function fovForAspect(aspect: number) {
  const hfov = THREE.MathUtils.degToRad(64);
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
  return THREE.MathUtils.clamp(vfov, 50, 96);
}

/** Free look range (degrees) from turning the phone: wide on the main cockpit, a nudge elsewhere. */
const LOOK_RANGE = { open: { yaw: 40, pitch: 22 }, focused: { yaw: 5, pitch: 3 } } as const;

/**
 * Pilot camera: eases between console poses, adds a slow idle drift, a
 * limited pointer/touch parallax, and turn-to-look from the phone's gyroscope
 * (wide on the main cockpit view only).
 */
export function CameraController({ pose, reducedMotion, parallax, panelOpen, lookAround, cinematicPhase = 'idle', marsTarget }: CameraControllerProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const pos = useRef(new THREE.Vector3(...pose.position));
  const tgt = useRef(new THREE.Vector3(...pose.target));
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredTgt = useMemo(() => new THREE.Vector3(), []);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  /** Raw phone-turn angles (deg) and their smoothed values (rad). */
  const gyro = useRef({ yaw: 0, pitch: 0, sy: 0, sp: 0 });
  const fov = useRef(camera.fov);
  const look = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const zoomOffset = useMemo(() => new THREE.Vector3(0, 0, 1.38), []);

  useEffect(() => {
    const el = gl.domElement;
    let touchStart: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        pointer.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.current.ty = -((e.clientY / window.innerHeight) * 2 - 1);
      } else if (touchStart) {
        // Touch: drag on the scene to lean, springs back on release.
        pointer.current.tx = THREE.MathUtils.clamp(((e.clientX - touchStart.x) / window.innerWidth) * -2.5, -1, 1);
        pointer.current.ty = THREE.MathUtils.clamp(((e.clientY - touchStart.y) / window.innerHeight) * 2.5, -1, 1);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') touchStart = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        touchStart = null;
        pointer.current.tx = 0;
        pointer.current.ty = 0;
      }
    };

    // Phone turn: yaw from compass heading (alpha), pitch from front/back tilt
    // (beta, or gamma in landscape). Angles are relative to where the phone was
    // first held; the baseline drifts slowly so a changed posture re-settles.
    let base: { alpha: number; pitch: number } | null = null;
    const RECENTER = 0.0008;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const angle = screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0;
      let pitch = e.beta;
      if (angle === 90) pitch = -e.gamma;
      else if (angle === -90 || angle === 270) pitch = e.gamma;
      const alpha = e.alpha ?? 0;
      if (!base) base = { alpha, pitch };
      const dAlpha = ((alpha - base.alpha + 540) % 360) - 180;
      base.alpha += dAlpha * RECENTER;
      base.pitch += (pitch - base.pitch) * RECENTER;
      gyro.current.yaw = dAlpha;
      gyro.current.pitch = pitch - base.pitch;
    };
    const resetBase = () => (base = null);
    const startTilt = () => window.addEventListener('deviceorientation', onOrient);
    // iOS Safari needs permission from a user gesture (and HTTPS); ask on the first tap.
    const DOE = typeof DeviceOrientationEvent !== 'undefined' ? (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }) : undefined;
    const askPermission = () => {
      DOE?.requestPermission?.()
        .then((r) => r === 'granted' && startTilt())
        .catch(() => {});
    };
    if (DOE?.requestPermission) window.addEventListener('pointerup', askPermission, { once: true });
    else startTilt();
    window.addEventListener('orientationchange', resetBase);
    const onLeave = () => {
      pointer.current.tx = 0;
      pointer.current.ty = 0;
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('pointerup', askPermission);
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('orientationchange', resetBase);
    };
  }, [gl]);

  useFrame(({ clock, size }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    desiredPos.set(...pose.position);
    desiredTgt.set(...pose.target);
    if (cinematicPhase !== 'idle') {
      desiredPos.set(0, 1.66, -1.2);
      desiredTgt.set(...LAYOUT.hologram.center);
      if (cinematicPhase === 'locked' || cinematicPhase === 'zooming' || cinematicPhase === 'flash' || cinematicPhase === 'video') {
        marsTarget?.current?.getWorldPosition(desiredTgt);
      }
      if (cinematicPhase === 'zooming' || cinematicPhase === 'flash' || cinematicPhase === 'video') {
        desiredPos.copy(desiredTgt).add(zoomOffset);
      }
    }
    if (panelOpen) {
      const aspect = size.width / size.height;
      if (aspect < 1) desiredTgt.y -= 0.3; // bottom sheet: lift the subject
      else {
        // side panel on the right: push the subject left
        right.subVectors(desiredTgt, desiredPos).cross(up).normalize();
        desiredTgt.addScaledVector(right, aspect > 1.5 ? 0.5 : 0.36);
      }
    }
    const ease = reducedMotion
      ? 7
      : cinematicPhase === 'zooming'
        ? 10
        : cinematicPhase === 'flash' || cinematicPhase === 'video'
          ? 8
          : cinematicPhase === 'activating'
            ? 7
            : cinematicPhase === 'locked'
              ? 5
              : 2.6;
    pos.current.x = THREE.MathUtils.damp(pos.current.x, desiredPos.x, ease, dt);
    pos.current.y = THREE.MathUtils.damp(pos.current.y, desiredPos.y, ease, dt);
    pos.current.z = THREE.MathUtils.damp(pos.current.z, desiredPos.z, ease, dt);
    tgt.current.x = THREE.MathUtils.damp(tgt.current.x, desiredTgt.x, ease * 1.15, dt);
    tgt.current.y = THREE.MathUtils.damp(tgt.current.y, desiredTgt.y, ease * 1.15, dt);
    tgt.current.z = THREE.MathUtils.damp(tgt.current.z, desiredTgt.z, ease * 1.15, dt);

    const p = pointer.current;
    const allowParallax = parallax && !reducedMotion;
    p.x = THREE.MathUtils.damp(p.x, allowParallax ? p.tx : 0, 3, dt);
    p.y = THREE.MathUtils.damp(p.y, allowParallax ? p.ty : 0, 3, dt);

    const idle = reducedMotion || cinematicPhase !== 'idle' ? 0 : 1;
    const sx = (Math.sin(t * 0.31) * 0.012 + Math.sin(t * 0.73) * 0.004) * idle;
    const sy = (Math.sin(t * 0.23 + 1.3) * 0.009 + Math.sin(t * 0.91) * 0.003) * idle;
    const shake = reducedMotion ? 0 : cinematicPhase === 'locked' ? 0.006 : cinematicPhase === 'zooming' ? 0.014 : cinematicPhase === 'flash' ? 0.005 : 0;
    const shakeX = Math.sin(t * 51) * shake + Math.sin(t * 73) * shake * 0.35;
    const shakeY = Math.cos(t * 57) * shake * 0.7;

    look.subVectors(tgt.current, pos.current).normalize();
    right.crossVectors(look, up).normalize();

    camera.position.copy(pos.current).addScaledVector(right, sx + p.x * 0.07 + shakeX).addScaledVector(up, sy + p.y * 0.04 + shakeY);
    look.copy(tgt.current).addScaledVector(right, p.x * 0.38 + sx * 2).addScaledVector(up, p.y * 0.24 + sy * 2);
    camera.lookAt(look);

    // Turn-to-look: yaw about world up, then pitch about the camera's own X axis.
    const g = gyro.current;
    const range = lookAround ? LOOK_RANGE.open : LOOK_RANGE.focused;
    const yaw = parallax ? THREE.MathUtils.clamp(g.yaw, -range.yaw, range.yaw) : 0;
    const pitch = parallax ? THREE.MathUtils.clamp(g.pitch, -range.pitch, range.pitch) : 0;
    g.sy = THREE.MathUtils.damp(g.sy, THREE.MathUtils.degToRad(yaw), 7, dt);
    g.sp = THREE.MathUtils.damp(g.sp, THREE.MathUtils.degToRad(pitch), 7, dt);
    camera.rotateOnWorldAxis(up, g.sy);
    camera.rotateX(g.sp);
    if (idle) camera.rotateZ(Math.sin(t * 0.17) * 0.0035);

    const fovScale = cinematicPhase === 'zooming' || cinematicPhase === 'flash' ? 0.84 : cinematicPhase === 'idle' ? pose.fovScale : 0.94;
    const desiredFov = fovForAspect(size.width / size.height) * fovScale;
    fov.current = THREE.MathUtils.damp(fov.current, desiredFov, ease, dt);
    if (Math.abs(camera.fov - fov.current) > 0.01) {
      camera.fov = fov.current;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
