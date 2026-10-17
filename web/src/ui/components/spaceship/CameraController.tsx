import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { CameraPose } from './cockpitLayout';

export interface CameraControllerProps {
  pose: CameraPose;
  reducedMotion: boolean;
  parallax: boolean;
  /** A HUD panel is open: reframe so the focused console isn't hidden behind it. */
  panelOpen: boolean;
}

/** Vertical FOV that keeps ~64° horizontally on portrait phones, capped for landscape. */
function fovForAspect(aspect: number) {
  const hfov = THREE.MathUtils.degToRad(64);
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
  return THREE.MathUtils.clamp(vfov, 50, 96);
}

/**
 * Pilot camera: eases between console poses, adds a slow idle drift and a
 * limited pointer/touch parallax. Never lets the user free-look.
 */
export function CameraController({ pose, reducedMotion, parallax, panelOpen }: CameraControllerProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const pos = useRef(new THREE.Vector3(...pose.position));
  const tgt = useRef(new THREE.Vector3(...pose.target));
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredTgt = useMemo(() => new THREE.Vector3(), []);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const fov = useRef(camera.fov);
  const look = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

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
        pointer.current.tx = tilt.x;
        pointer.current.ty = tilt.y;
      }
    };

    // Phone tilt: lean relative to how the phone is being held. The baseline
    // slowly follows the current pose, so holding still recenters the view.
    const tilt = { x: 0, y: 0 };
    let base: { a: number; b: number } | null = null;
    const TILT_RANGE = 18; // degrees of tilt for a full lean
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const angle = screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0;
      // Map device axes to screen axes for the current orientation.
      let a = e.gamma; // left/right
      let b = e.beta; // toward/away
      if (angle === 90) [a, b] = [e.beta, -e.gamma];
      else if (angle === -90 || angle === 270) [a, b] = [-e.beta, e.gamma];
      if (!base) base = { a, b };
      base.a += (a - base.a) * 0.01;
      base.b += (b - base.b) * 0.01;
      tilt.x = THREE.MathUtils.clamp((a - base.a) / TILT_RANGE, -1, 1);
      tilt.y = THREE.MathUtils.clamp((b - base.b) / TILT_RANGE, -1, 1);
      if (!touchStart) {
        pointer.current.tx = tilt.x;
        pointer.current.ty = tilt.y;
      }
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
    if (panelOpen) {
      const aspect = size.width / size.height;
      if (aspect < 1) desiredTgt.y -= 0.3; // bottom sheet: lift the subject
      else {
        // side panel on the right: push the subject left
        right.subVectors(desiredTgt, desiredPos).cross(up).normalize();
        desiredTgt.addScaledVector(right, aspect > 1.5 ? 0.5 : 0.36);
      }
    }
    const ease = reducedMotion ? 7 : 2.6;
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

    const idle = reducedMotion ? 0 : 1;
    const sx = (Math.sin(t * 0.31) * 0.012 + Math.sin(t * 0.73) * 0.004) * idle;
    const sy = (Math.sin(t * 0.23 + 1.3) * 0.009 + Math.sin(t * 0.91) * 0.003) * idle;

    look.subVectors(tgt.current, pos.current).normalize();
    right.crossVectors(look, up).normalize();

    camera.position.copy(pos.current).addScaledVector(right, sx + p.x * 0.07).addScaledVector(up, sy + p.y * 0.04);
    look.copy(tgt.current).addScaledVector(right, p.x * 0.38 + sx * 2).addScaledVector(up, p.y * 0.24 + sy * 2);
    camera.lookAt(look);
    if (idle) camera.rotateZ(Math.sin(t * 0.17) * 0.0035);

    const desiredFov = fovForAspect(size.width / size.height) * pose.fovScale;
    fov.current = THREE.MathUtils.damp(fov.current, desiredFov, ease, dt);
    if (Math.abs(camera.fov - fov.current) > 0.01) {
      camera.fov = fov.current;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
