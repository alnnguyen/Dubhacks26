import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CockpitBuilder, GLOW_COLORS, windowWall, type GlowKey, type SolidKey, type Vec3 } from './CockpitBuilder';
import { LAYOUT } from './cockpitLayout';
import { makeFloorTexture, makeGrilleTexture, makeSurfaceMaps } from './textures';
import { Screen } from './Screen';
import type { GraphicsQuality } from '../../state/lobbyTypes';

/** Transforms shared between the merged geometry and the live screen meshes. */
export const DASH_TRANSFORM = { position: [0, 0.94, -2.5] as Vec3, rotation: [0.222, 0, 0] as Vec3 };
export const DECK_TRANSFORM = { position: [0, 0.94, -0.9] as Vec3, rotation: [0.1, 0, 0] as Vec3 };
export const SIDE_MONITOR = (s: number) => ({
  position: [s * LAYOUT.sideMonitors.x, LAYOUT.sideMonitors.y, LAYOUT.sideMonitors.z] as Vec3,
  rotation: [-0.28, -s * 0.32, 0] as Vec3,
});
export const OVERHEAD_TRANSFORM = { position: LAYOUT.overhead.center as unknown as Vec3, rotation: [0.45, 0, 0] as Vec3 };

const SIDES = [-1, 1] as const;

function buildCockpit(b: CockpitBuilder) {
  const { frontZ, frontWindow: fw, frontCornerX: cx, sideCorner, sideWallX, ceilingY } = LAYOUT;

  // ---------------------------------------------------------------- Front window wall
  b.geo('hull', windowWall({ x0: -cx, x1: cx, y0: 0, y1: ceilingY + 0.05 }, { ...fw, r: fw.radius }, 0.14), [0, 0, frontZ]);
  const bz = 0.07;
  b.geo(
    'hullLight',
    windowWall(
      { x0: fw.x0 - bz, x1: fw.x1 + bz, y0: fw.y0 - bz, y1: fw.y1 + bz, r: fw.radius + bz },
      { ...fw, r: fw.radius },
      0.04,
      0.012,
    ),
    [0, 0, frontZ + 0.1],
  );

  // ---------------------------------------------------------------- Angled side windows + pillars
  for (const s of SIDES) {
    const ax = s * cx;
    const dx = s * sideCorner.x - ax;
    const dz = sideCorner.z - frontZ;
    const L = Math.hypot(dx, dz);
    const theta = Math.atan2(-dz, dx);
    b.group([ax, 0, frontZ], [0, theta, 0], () => {
      const hole = { x0: 0.24, x1: L - 0.12, y0: 1.14, y1: 2.3, r: 0.14 };
      b.geo('hull', windowWall({ x0: 0, x1: L, y0: 0, y1: ceilingY }, hole, 0.12), [0, 0, 0]);
      b.geo(
        'hullLight',
        windowWall({ x0: hole.x0 - 0.05, x1: hole.x1 + 0.05, y0: hole.y0 - 0.05, y1: hole.y1 + 0.05, r: 0.19 }, hole, 0.04, 0.01),
        [0, 0, s * -0.08],
      );
    });
    // A-pillar
    b.rbox('hullLight', [s * (cx + 0.02), 1.4, frontZ + 0.1], [0.22, 2.8, 0.2], 0.04, [0, s * -0.65, 0]);
    b.glow('cyan', [s * (cx - 0.06), 1.72, frontZ + 0.2], [0.012, 1.15, 0.012], [0, s * -0.65, 0]);
  }

  // ---------------------------------------------------------------- Side walls
  for (const s of SIDES) {
    const z0 = sideCorner.z;
    const z1 = 2.8;
    const zm = (z0 + z1) / 2;
    const len = z1 - z0;
    b.box('hull', [s * (sideWallX + 0.05), 1.35, zm], [0.1, 2.7, len]);
    for (let z = z0 + 0.25; z < z1; z += 0.8) b.rbox('hullLight', [s * (sideWallX - 0.04), 1.35, z], [0.08, 2.7, 0.12], 0.02);
    for (let z = z0 + 0.65; z < z1 - 0.2; z += 0.8) {
      b.box('panel', [s * (sideWallX - 0.02), 1.62, z], [0.03, 1.0, 0.64]);
      b.box('hullDark', [s * (sideWallX - 0.02), 0.52, z], [0.03, 0.8, 0.64]);
      b.box('grille', [s * (sideWallX - 0.035), 0.32, z], [0.01, 0.22, 0.5]);
    }
    b.rbox('hullLight', [s * (sideWallX - 0.07), 1.02, zm], [0.12, 0.06, len], 0.02);
    b.glow('cyan', [s * (sideWallX - 0.135), 1.0, zm], [0.008, 0.01, len]);
    // Wall-side console near the pilot seats.
    b.group([s * (sideWallX - 0.25), 0.92, -0.55], [0, 0, s * 0.25], () => {
      b.rbox('panel', [0, 0, 0], [0.4, 0.08, 0.9], 0.02);
      b.keypad([-0.12, 0.045, -0.36], 4, 9, [0.08, 0.09], [0.045, 0.012, 0.05], (c, r, rnd) =>
        rnd > 0.35 ? { color: rnd > 0.9 ? 'orange' : c === 0 && r % 3 === 0 ? 'red' : 'white', intensity: rnd > 0.9 ? 2.4 : 1.1 } : null,
      );
    });
  }

  // ---------------------------------------------------------------- Ceiling
  b.box('hullDark', [0, ceilingY + 0.05, -0.08], [3.3, 0.1, 5.9]);
  for (const s of SIDES) {
    b.box('hull', [s * 1.975, 2.45, -0.08], [0.92, 0.06, 5.9], [0, 0, -s * 0.588]);
    // Light strips on the chamfers (they converge toward the window in perspective).
    for (const [zc, len] of [[-1.45, 1.7], [0.75, 1.5]] as const) {
      b.group([s * 1.86, 2.49, zc], [0, 0, -s * 0.588], () => {
        b.rbox('hullLight', [0, -0.02, 0], [0.18, 0.05, len + 0.1], 0.02);
        b.glow('white', [0, -0.05, 0], [0.1, 0.02, len]);
      });
    }
  }
  for (const x of [-1.15, -0.38, 0.38, 1.15]) {
    for (let z = -2.3; z < 2.6; z += 0.9) b.rbox('hull', [x, ceilingY - 0.02, z], [0.72, 0.03, 0.84], 0.01);
  }
  b.rbox('hull', [0, ceilingY - 0.05, 0.6], [0.36, 0.05, 3.6], 0.02);
  for (let z = -1.0; z < 2.4; z += 0.3) b.dot([0, ceilingY - 0.08, z], [0.05, 0.01, 0.02], 'cyan', 1.4);

  // Window brow
  b.box('hull', [0, 2.62, frontZ + 0.18], [3.7, 0.26, 0.38]);
  b.rbox('hullLight', [0, 2.48, frontZ + 0.26], [3.3, 0.06, 0.24], 0.02);
  b.rbox('panel', [0, 2.5, frontZ + 0.13], [1.0, 0.07, 0.08], 0.015);
  for (let i = 0; i < 10; i++) b.dot([-0.4 + i * 0.09, 2.5, frontZ + 0.175], [0.05, 0.028, 0.006], i % 3 === 0 ? 'white' : 'red', 2.4, i === 4 ? 1.3 : 0);

  // Top-corner vent units with status LEDs
  for (const s of SIDES) {
    b.group([s * 1.72, 2.36, -2.15], [0, s * -0.3, -s * 0.45], () => {
      b.rbox('hull', [0, 0, 0], [0.62, 0.24, 0.58], 0.03);
      b.box('grille', [0, 0, 0.292], [0.48, 0.15, 0.01]);
      for (let i = 0; i < 3; i++) b.dot([-0.18 + i * 0.05, 0.095, 0.296], [0.018, 0.018, 0.006], 'green', 2.6, i === 1 ? 0.7 : 0);
    });
  }

  // ---------------------------------------------------------------- Overhead commander console body
  b.rbox('hull', [0, 2.62, -1.85], [0.7, 0.2, 0.5], 0.03);
  b.group(OVERHEAD_TRANSFORM.position, OVERHEAD_TRANSFORM.rotation, () => {
    b.rbox('hull', [0, 0, 0], [1.5, 0.42, 0.5], 0.04);
    b.box('hullDark', [0, 0.02, 0.252], [1.4, 0.36, 0.01]);
    for (const s of SIDES) b.rbox('hullLight', [s * 0.8, 0, 0], [0.12, 0.38, 0.46], 0.03);
    for (let i = 0; i < 12; i++) {
      b.dot([-0.5 + i * 0.09, -0.175, 0.258], [0.045, 0.018, 0.006], i % 4 === 1 ? 'red' : i % 5 === 0 ? 'orange' : 'white', 2.2, i === 6 ? 1.1 : 0);
    }
  });
  b.group([0, 2.12, -2.02], [0.6, 0, 0], () => {
    b.rbox('panel', [0, 0, 0], [0.95, 0.1, 0.22], 0.02);
    for (let i = 0; i < 8; i++) b.dot([-0.36 + i * 0.1, 0.052, 0.02], [0.05, 0.006, 0.05], i % 2 ? 'red' : 'white', 2.4);
    b.glow('white', [0, -0.03, 0.112], [0.3, 0.025, 0.004]);
  });

  // ---------------------------------------------------------------- Dashboard
  b.box('hullDark', [0, 0.43, -2.6], [3.72, 0.86, 0.72]);
  b.rbox('hullLight', [0, 0.86, -2.1], [3.72, 0.07, 0.09], 0.02);
  b.glow('cyan', [0, 0.825, -2.055], [3.5, 0.01, 0.006]);
  for (let x = 0.55; x < 1.8; x += 0.24) for (const s of SIDES) b.dot([s * x, 0.86, -2.053], [0.035, 0.014, 0.006], 'orange', 2.4);
  b.box('hullLight', [0, 1.04, frontZ + 0.04], [3.7, 0.05, 0.12]);
  b.group(DASH_TRANSFORM.position, DASH_TRANSFORM.rotation, () => {
    b.rbox('panel', [0, 0, 0], [3.68, 0.06, 0.84], 0.02);
    for (const s of SIDES) {
      b.box('hullDark', [s * 0.82, 0.032, 0.12], [0.62, 0.01, 0.46]);
      b.keypad([s * 0.82 - 0.26, 0.04, 0.24], 8, 3, [0.075, 0.07], [0.05, 0.014, 0.045], (_c, _r, rnd) =>
        rnd > 0.2 ? { color: rnd > 0.88 ? 'orange' : rnd > 0.8 ? 'red' : rnd > 0.5 ? 'cyan' : 'white', intensity: rnd > 0.8 ? 2.4 : 1.2, blink: rnd > 0.97 ? 1.5 : 0 } : null,
      );
      // Throttle levers
      for (let i = 0; i < 3; i++) {
        const x = s * (0.4 + i * 0.06);
        b.box('hullLight', [x, 0.1, 0.18 - i * 0.03], [0.018, 0.16, 0.018], [-0.35, 0, 0]);
        b.dot([x, 0.18, 0.15 - i * 0.03], [0.04, 0.03, 0.03], i === 1 ? 'red' : 'orange', 1.6);
      }
      // Joystick
      b.box('hullDark', [s * 1.42, 0.06, 0.2], [0.07, 0.04, 0.07]);
      b.box('hullLight', [s * 1.42, 0.13, 0.2], [0.022, 0.13, 0.022]);
      b.rbox('panel', [s * 1.42, 0.21, 0.2], [0.06, 0.07, 0.06], 0.025);
      b.dot([s * 1.42, 0.25, 0.19], [0.015, 0.008, 0.015], 'red', 2.6);
    }
    // Hologram emitter
    b.geo('hullLight', new THREE.CylinderGeometry(0.17, 0.19, 0.07, 32), [0, 0.065, 0.2]);
    b.geo('hullDark', new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32), [0, 0.1, 0.2]);
    b.glow('cyan', [0, 0.112, 0.2], [0.1, 0.008, 0.1]);
  });

  // Raised side monitors
  for (const s of SIDES) {
    const t = SIDE_MONITOR(s);
    b.group(t.position, t.rotation, () => {
      b.rbox('hull', [0, 0, 0], [0.68, 0.44, 0.05], 0.02);
      b.box('hullDark', [0, 0, 0.026], [0.62, 0.38, 0.005]);
      b.box('hullDark', [0, -0.27, -0.04], [0.09, 0.16, 0.05]);
      b.dot([0.28, -0.205, 0.028], [0.02, 0.012, 0.004], 'green', 2.4);
    });
  }

  // ---------------------------------------------------------------- Central command console
  const cc = LAYOUT.centerConsole;
  const ccLen = cc.nearZ - cc.farZ;
  b.box('hull', [0, 0.44, (cc.nearZ + cc.farZ) / 2], [cc.width, 0.88, ccLen]);
  for (const s of SIDES) {
    b.box('grille', [s * 0.19, 0.44, cc.nearZ + 0.006], [0.3, 0.56, 0.01]);
    b.box('hullDark', [s * 0.19, 0.44, cc.nearZ + 0.016], [0.035, 0.66, 0.012], [0, 0, 0.5]);
    b.box('hullDark', [s * 0.19, 0.44, cc.nearZ + 0.016], [0.035, 0.66, 0.012], [0, 0, -0.5]);
    b.rbox('hullLight', [s * 0.19, 0.44, cc.nearZ + 0.01], [0.34, 0.6, 0.012], 0.006);
    // side panelling
    b.box('panel', [s * (cc.width / 2 + 0.006), 0.5, -1.1], [0.012, 0.6, 1.4]);
    b.box('grille', [s * (cc.width / 2 + 0.014), 0.2, -1.1], [0.006, 0.18, 1.2]);
  }
  b.box('hullLight', [0, 0.04, cc.nearZ - 0.02], [cc.width + 0.04, 0.08, 0.06]);
  for (let i = 0; i < 6; i++) b.dot([-0.2 + i * 0.08, 0.8, cc.nearZ + 0.004], [0.04, 0.016, 0.006], i < 4 ? 'red' : 'orange', 2.4, i === 2 ? 2 : 0);
  // Slanted control deck
  b.group(DECK_TRANSFORM.position, DECK_TRANSFORM.rotation, () => {
    b.rbox('panel', [0, 0, 0], [0.88, 0.06, 1.28], 0.02);
    b.box('hullDark', [0, 0.032, 0.32], [0.76, 0.006, 0.5]);
    b.keypad([-0.33, 0.04, 0.12], 10, 5, [0.073, 0.085], [0.05, 0.014, 0.055], (c, r, rnd) => {
      if (c >= 3 && c <= 6 && r <= 1) return null;
      return { color: rnd > 0.85 ? 'orange' : rnd > 0.75 ? 'red' : rnd > 0.45 ? 'white' : 'cyan', intensity: rnd > 0.75 ? 2.2 : 1.0, blink: rnd > 0.96 ? 2 : 0 };
    });
    // Slider bank
    for (let i = 0; i < 4; i++) {
      b.box('hullDark', [-0.06 + i * 0.04, 0.036, 0.15], [0.012, 0.004, 0.14]);
      b.dot([-0.06 + i * 0.04, 0.045, 0.12 + ((i * 37) % 7) * 0.012], [0.03, 0.02, 0.018], i === 2 ? 'orange' : 'white', 1.5);
    }
    // Red guarded toggles
    for (const s of SIDES) b.dot([s * 0.36, 0.05, 0.56], [0.06, 0.03, 0.05], 'red', 2.2);
  });
  b.box('hull', [0, 0.97, -1.8], [0.8, 0.26, 0.55]);
  b.group(LAYOUT.mainScreen.center as unknown as Vec3, [LAYOUT.mainScreen.tilt, 0, 0], () => {
    b.rbox('hull', [0, 0, 0], [0.88, 0.52, 0.06], 0.025);
    b.box('hullDark', [0, 0, 0.031], [0.82, 0.47, 0.004]);
    b.glow('white', [0, -0.285, 0.0], [0.34, 0.025, 0.04]);
    for (const s of SIDES) b.rbox('hullLight', [s * 0.46, 0, 0], [0.05, 0.5, 0.08], 0.015);
  });

  // ---------------------------------------------------------------- Pilot flight stick
  {
    const { x, z, gripY } = LAYOUT.pilotStick;
    b.group([x, 0, z], [0, 0, 0], () => {
      b.rbox('hullDark', [0, 0.05, 0], [0.26, 0.1, 0.26], 0.03);
      b.rbox('hull', [0, 0.36, 0], [0.12, 0.52, 0.12], 0.025);
      b.rbox('hullDark', [0, 0.64, 0], [0.18, 0.06, 0.18], 0.02);
      b.box('hullLight', [0, gripY - 0.17, 0.02], [0.03, 0.2, 0.03], [-0.18, 0, 0]);
      b.rbox('panel', [0, gripY - 0.04, 0.035], [0.075, 0.13, 0.08], 0.03);
      b.dot([0, gripY + 0.03, 0.02], [0.022, 0.012, 0.022], 'red', 2.6);
      b.dot([0.028, gripY - 0.01, 0.0], [0.012, 0.012, 0.012], 'cyan', 2);
    });
  }

  // ---------------------------------------------------------------- Pilot seats
  for (const s of SIDES) {
    b.group([s * LAYOUT.seats.x, 0, LAYOUT.seats.z], [0, -s * 0.06, 0], () => {
      b.box('hull', [0, 0.02, 0], [0.62, 0.04, 0.62]);
      b.rbox('hullDark', [0, 0.22, 0], [0.24, 0.36, 0.3], 0.03);
      b.rbox('hullDark', [0, 0.44, -0.02], [0.66, 0.12, 0.64], 0.04);
      b.rbox('seatRed', [0, 0.52, -0.05], [0.56, 0.08, 0.54], 0.035);
      b.group([0, 1.0, 0.28], [0.1, 0, 0], () => {
        b.rbox('seat', [0, 0, 0], [0.7, 0.98, 0.17], 0.05);
        b.rbox('seatRed', [0, -0.02, -0.09], [0.5, 0.8, 0.05], 0.025);
        b.rbox('hull', [0, 0.04, 0.09], [0.48, 0.62, 0.03], 0.012);
        for (let i = 0; i < 4; i++) b.box('hullDark', [0, -0.16 + i * 0.12, 0.108], [0.4, 0.02, 0.01]);
        for (const w of SIDES) b.rbox('seat', [w * 0.34, 0.02, -0.06], [0.1, 0.84, 0.26], 0.04);
        b.rbox('seat', [0, 0.62, 0.02], [0.46, 0.26, 0.2], 0.06);
        b.rbox('hullLight', [0, 0.62, 0.124], [0.3, 0.12, 0.012], 0.006);
      });
      for (const w of SIDES) {
        b.rbox('hull', [w * 0.4, 0.72, -0.08], [0.12, 0.08, 0.56], 0.025);
        b.box('hullDark', [w * 0.4, 0.6, 0.08], [0.06, 0.24, 0.06]);
      }
      // Inner armrest control pod (faces the aisle)
      const inner = -s;
      b.group([inner * 0.43, 0.8, -0.12], [0, 0, inner * -0.3], () => {
        b.rbox('panel', [0, 0, 0], [0.14, 0.07, 0.34], 0.02);
        b.keypad([-0.035, 0.038, -0.13], 2, 5, [0.07, 0.06], [0.04, 0.01, 0.035], (_c, _r, rnd) => ({
          color: rnd > 0.7 ? 'orange' : rnd > 0.4 ? 'cyan' : 'white',
          intensity: 1.6,
        }));
      });
    });
  }

  // ---------------------------------------------------------------- Floor details
  b.box('hullDark', [0, 0.015, 1.3], [0.8, 0.03, 3.1]);
  for (let z = 0.3; z < 2.8; z += 0.7) b.box('grille', [0, 0.032, z], [0.62, 0.006, 0.5]);
  for (const s of SIDES) {
    b.glow('cyan', [s * 0.41, 0.033, 1.3], [0.014, 0.006, 3.1]);
    b.box('hullDark', [s * 1.62, 0.02, 0.6], [0.95, 0.04, 4.4]);
    b.rbox('hull', [s * (sideWallX - 0.1), 0.07, 0.8], [0.14, 0.14, 3.95], 0.02);
    for (let z = -0.8; z < 2.6; z += 0.55) b.dot([s * (sideWallX - 0.175), 0.1, z], [0.006, 0.02, 0.06], 'orange', 1.8);
  }
  b.box('hullDark', [0, 1.35, 2.85], [4.8, 2.7, 0.1]);

  // ---------------------------------------------------------------- Layered structural detail
  // Dashboard front: recessed panels between ribs
  for (const s of SIDES) {
    for (let i = 0; i < 3; i++) {
      const x = s * (0.72 + i * 0.42);
      b.box('panel', [x, 0.46, -2.232], [0.36, 0.58, 0.02]);
      b.box('grille', [x, 0.2, -2.228], [0.28, 0.1, 0.01]);
      b.rbox('hullLight', [x + s * 0.21, 0.44, -2.226], [0.035, 0.78, 0.035], 0.012);
    }
  }
  b.rbox('hullLight', [0, 1.075, frontZ + 0.12], [3.3, 0.03, 0.08], 0.01);
  // Center console side ribs
  for (const s of SIDES) {
    for (let z = cc.farZ + 0.2; z < cc.nearZ - 0.1; z += 0.3) b.rbox('hullLight', [s * (cc.width / 2 + 0.012), 0.5, z], [0.022, 0.7, 0.035], 0.008);
  }
  // Ceiling cross-beams
  for (const z of [-2.05, -0.65, 0.75, 2.15]) {
    b.rbox('hull', [0, ceilingY - 0.07, z], [3.2, 0.08, 0.12], 0.02);
    b.box('hullDark', [0, ceilingY - 0.112, z], [3.0, 0.006, 0.05]);
  }
  // Side wall conduits
  for (const s of SIDES) {
    for (const y of [1.9, 2.0]) b.geo('hullLight', new THREE.CylinderGeometry(0.018, 0.018, 3.9, 10), [s * (sideWallX - 0.06), y, 0.82], [Math.PI / 2, 0, 0]);
  }
}

/** PBR parameters. `detail` applies the procedural normal/roughness maps. */
const SOLID_PARAMS: Record<SolidKey, THREE.MeshStandardMaterialParameters & { detail?: number }> = {
  hull: { color: '#3d454f', metalness: 0.85, roughness: 0.42, detail: 0.6 },
  hullLight: { color: '#8d97a3', metalness: 0.95, roughness: 0.26, detail: 0.35 },
  hullDark: { color: '#22272e', metalness: 0.6, roughness: 0.58, detail: 0.5 },
  panel: { color: '#252a31', metalness: 0.5, roughness: 0.55, detail: 0.4 },
  seat: { color: '#1c1e23', metalness: 0.05, roughness: 0.82 },
  seatRed: { color: '#5e1d1b', metalness: 0.0, roughness: 0.72 },
  grille: { color: '#9aa4b0', metalness: 0.75, roughness: 0.45 },
};

const GLOW_INTENSITY: Record<GlowKey, number> = { cyan: 2.2, white: 2.6, orange: 2.4, red: 2.4, green: 2.4 };

function ProceduralCockpit({ alert, reducedMotion, quality }: { alert: boolean; reducedMotion: boolean; quality: GraphicsQuality }) {
  const built = useMemo(() => {
    const b = new CockpitBuilder(42);
    buildCockpit(b);
    return b.build();
  }, []);

  const textures = useMemo(() => {
    const surface = makeSurfaceMaps(quality === 'high' ? 512 : 256);
    return { floor: makeFloorTexture(), grille: makeGrilleTexture(), normal: surface.normalMap, roughness: surface.roughnessMap };
  }, [quality]);

  const solidMats = useMemo(() => {
    const m = {} as Record<SolidKey, THREE.MeshStandardMaterial>;
    for (const key of Object.keys(SOLID_PARAMS) as SolidKey[]) {
      const { detail, ...params } = SOLID_PARAMS[key];
      m[key] = new THREE.MeshStandardMaterial({
        ...params,
        map: key === 'grille' ? textures.grille : null,
        normalMap: detail ? textures.normal : null,
        normalScale: new THREE.Vector2(detail ?? 0, detail ?? 0),
        roughnessMap: detail ? textures.roughness : null,
      });
    }
    return m;
  }, [textures]);

  const glowMats = useMemo(() => {
    const m = {} as Record<GlowKey, THREE.MeshBasicMaterial>;
    for (const key of Object.keys(GLOW_COLORS) as GlowKey[]) {
      m[key] = new THREE.MeshBasicMaterial({ color: GLOW_COLORS[key].clone().multiplyScalar(GLOW_INTENSITY[key]), toneMapped: false });
    }
    return m;
  }, []);

  const floorMat = useMemo(
    () => {
      const normal = textures.normal.clone();
      const rough = textures.roughness.clone();
      normal.repeat.set(4, 5);
      rough.repeat.set(4, 5);
      return new THREE.MeshStandardMaterial({ map: textures.floor, color: '#b4bcc8', metalness: 0.55, roughness: 0.48, normalMap: normal, normalScale: new THREE.Vector2(0.4, 0.4), roughnessMap: rough });
    },
    [textures],
  );

  // Instanced indicator lights
  const dotsRef = useRef<THREE.InstancedMesh>(null);
  const dotGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const dotMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const blinkers = useMemo(() => built.dots.map((d, i) => ({ ...d, i })).filter((d) => d.blink > 0), [built]);

  useEffect(() => {
    const mesh = dotsRef.current;
    if (!mesh) return;
    built.dots.forEach((d, i) => {
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, d.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [built]);

  useEffect(
    () => () => {
      built.solids.forEach((s) => s.geometry.dispose());
      built.glows.forEach((s) => s.geometry.dispose());
      Object.values(solidMats).forEach((m) => m.dispose());
      Object.values(glowMats).forEach((m) => m.dispose());
      Object.values(textures).forEach((t) => t.dispose());
      floorMat.normalMap?.dispose();
      floorMat.roughnessMap?.dispose();
      floorMat.dispose();
      dotGeo.dispose();
      dotMat.dispose();
    },
    [built, solidMats, glowMats, textures, floorMat, dotGeo, dotMat],
  );

  const tmp = useMemo(() => new THREE.Color(), []);
  const lastBlink = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Light strips breathe; the alert state shifts the ceiling to a warm pulse.
    const breathe = reducedMotion ? 1 : 0.88 + Math.sin(t * 1.3) * 0.12;
    glowMats.cyan.color.copy(GLOW_COLORS.cyan).multiplyScalar(GLOW_INTENSITY.cyan * breathe);
    if (alert) {
      const p = 0.5 + 0.5 * Math.sin(t * 5);
      glowMats.white.color.copy(GLOW_COLORS.white).lerp(GLOW_COLORS.orange, 0.6 + p * 0.3).multiplyScalar(1.6 + p * 1.6);
    } else {
      glowMats.white.color.copy(GLOW_COLORS.white).multiplyScalar(GLOW_INTENSITY.white);
    }
    // Blinking indicators: throttle uploads to ~10 Hz.
    const mesh = dotsRef.current;
    if (!mesh || !mesh.instanceColor || t - lastBlink.current < 0.1) return;
    lastBlink.current = t;
    for (const d of blinkers) {
      const on = reducedMotion || Math.sin(t * d.blink * Math.PI * 2 + d.phase) > -0.2;
      mesh.setColorAt(d.i, on ? d.color : tmp.copy(d.color).multiplyScalar(0.08));
    }
    mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group name="procedural-cockpit">
      {built.solids.map(({ key, geometry }) => (
        <mesh key={key} geometry={geometry} material={solidMats[key]} castShadow receiveShadow />
      ))}
      {built.glows.map(({ key, geometry }) => (
        <mesh key={`g-${key}`} geometry={geometry} material={glowMats[key]} />
      ))}
      <instancedMesh ref={dotsRef} args={[dotGeo, dotMat, built.dots.length]} frustumCulled={false} />
      <mesh material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.08]} receiveShadow>
        <planeGeometry args={[LAYOUT.sideWallX * 2, 5.9]} />
      </mesh>
      {/* Soft contact shading under seats and consoles. frames={1}: rendered once, the cockpit is static. */}
      <ContactShadows
        position={[0, 0.036, -0.4]}
        scale={[4.6, 6]}
        resolution={quality === 'high' ? 512 : 256}
        blur={2.4}
        far={1.4}
        opacity={0.75}
        color="#000000"
        frames={1}
      />
    </group>
  );
}

/** Live screens embedded in the cockpit (not counting the commander display). */
function CockpitScreens({ fps, alert, contacts }: { fps: number; alert: boolean; contacts: number }) {
  const data = useMemo(() => ({ alert, contacts }), [alert, contacts]);
  return (
    <group>
      {SIDES.map((s) => {
        const t = SIDE_MONITOR(s);
        return (
          <group key={s} position={t.position as unknown as THREE.Vector3Tuple} rotation={[...t.rotation, 'YXZ']}>
            <Screen kind={s < 0 ? 'systems' : 'nav'} size={[0.58, 0.34]} position={[0, 0, 0.03]} fps={fps} data={data} />
          </group>
        );
      })}
      <group position={DASH_TRANSFORM.position as unknown as THREE.Vector3Tuple} rotation={[...DASH_TRANSFORM.rotation, 'YXZ']}>
        {SIDES.map((s) => (
          <Screen key={s} kind={s < 0 ? 'bars' : 'graph'} size={[0.3, 0.16]} position={[s * 1.12, 0.034, -0.1]} rotation={[-Math.PI / 2, 0, 0]} fps={fps * 0.5} data={data} res={[256, 140]} />
        ))}
      </group>
      <group position={DECK_TRANSFORM.position as unknown as THREE.Vector3Tuple} rotation={[...DECK_TRANSFORM.rotation, 'YXZ']}>
        {SIDES.map((s) => (
          <Screen key={s} kind={s < 0 ? 'grid' : 'bars'} size={[0.26, 0.15]} position={[s * 0.24, 0.034, -0.3]} rotation={[-Math.PI / 2, 0, 0]} fps={fps * 0.5} data={data} res={[256, 150]} />
        ))}
      </group>
      <group position={LAYOUT.mainScreen.center as unknown as THREE.Vector3Tuple} rotation={[LAYOUT.mainScreen.tilt, 0, 0, 'YXZ']}>
        <Screen kind="tactical" size={LAYOUT.mainScreen.size as unknown as [number, number]} position={[0, 0, 0.036]} fps={fps} data={data} res={[640, 360]} />
      </group>
    </group>
  );
}

/** Drop-in slot for an authored cockpit. Must be modelled to match `LAYOUT`. */
function GltfCockpit({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} />;
}

export interface CockpitProps {
  /** Optional GLB/GLTF cockpit. Falls back to the procedural prototype. */
  modelUrl?: string;
  quality: GraphicsQuality;
  alert: boolean;
  reducedMotion: boolean;
  contacts: number;
}

export function Cockpit({ modelUrl, quality, alert, reducedMotion, contacts }: CockpitProps) {
  const fps = quality === 'high' ? 6 : 2;
  return (
    <group>
      {modelUrl ? (
        <Suspense fallback={<ProceduralCockpit alert={alert} reducedMotion={reducedMotion} quality={quality} />}>
          <GltfCockpit url={modelUrl} />
        </Suspense>
      ) : (
        <ProceduralCockpit alert={alert} reducedMotion={reducedMotion} quality={quality} />
      )}
      <CockpitScreens fps={reducedMotion ? 1 : fps} alert={alert} contacts={contacts} />
    </group>
  );
}
