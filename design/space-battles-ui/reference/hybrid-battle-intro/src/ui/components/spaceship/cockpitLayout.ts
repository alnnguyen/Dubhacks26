import type { LobbyView } from '../../state/lobbyTypes';

/**
 * Single source of truth for cockpit dimensions and interaction anchors (meters).
 * -Z is forward (out the window), +Y is up. Floor at y = 0.
 *
 * A future GLB cockpit should be authored/scaled to match these anchors so the
 * camera poses, hologram and HUD anchors keep working without code changes.
 */
export const LAYOUT = {
  ceilingY: 2.7,
  sideWallX: 2.35,
  frontZ: -2.95,
  /** Front window opening (in the front wall plane). */
  frontWindow: { x0: -1.62, x1: 1.62, y0: 1.08, y1: 2.42, radius: 0.2 },
  /** Corner where the front wall meets the angled side-window walls. */
  frontCornerX: 1.86,
  /** Where the angled side-window walls meet the straight side walls. */
  sideCorner: { x: 2.35, z: -1.15 },
  dashboard: { topY: 1.02, frontZ: -2.92, backZ: -2.05 },
  hologram: { center: [0, 1.74, -2.3] as const, radius: 0.4 },
  centerConsole: { width: 0.82, nearZ: -0.25, farZ: -2.05 },
  mainScreen: { center: [0, 1.13, -1.62] as const, size: [0.78, 0.44] as const, tilt: -0.42 },
  overhead: { center: [0, 2.36, -1.75] as const },
  sideMonitors: { x: 1.2, y: 1.28, z: -2.42 },
  seats: { x: 0.86, z: -0.42 },
} as const;

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  /** Multiplier on the aspect-derived FOV. <1 zooms in. */
  fovScale: number;
}

export const CAMERA_POSES: Record<LobbyView | 'launch', CameraPose> = {
  lobby: { position: [0, 1.64, 1.15], target: [0, 1.42, -3], fovScale: 1 },
  console: { position: [0, 1.42, -0.2], target: [0, 1.1, -1.65], fovScale: 0.92 },
  radar: { position: [0, 1.48, -0.05], target: [0, 1.66, -2.3], fovScale: 0.9 },
  profile: { position: [0, 1.62, 0.5], target: [0, 2.28, -1.8], fovScale: 0.9 },
  settings: { position: [-0.42, 1.68, -0.85], target: [-1.25, 1.12, -2.4], fovScale: 0.9 },
  launch: { position: [0, 1.66, -1.2], target: [0, 1.7, -6], fovScale: 1.18 },
};

/** Named world positions the DOM HUD attaches to. */
export const HUD_ANCHORS = {
  alert: [0, 2.0, -2.5] as [number, number, number],
};
