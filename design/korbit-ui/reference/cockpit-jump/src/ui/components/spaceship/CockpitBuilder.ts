import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type SolidKey = 'hull' | 'hullLight' | 'hullDark' | 'panel' | 'seat' | 'seatRed' | 'grille';
export type GlowKey = 'cyan' | 'white' | 'orange' | 'red' | 'green';

export type Vec3 = readonly [number, number, number];

export const GLOW_COLORS: Record<GlowKey, THREE.Color> = {
  cyan: new THREE.Color(0.32, 0.86, 1.0),
  white: new THREE.Color(0.88, 0.94, 1.0),
  orange: new THREE.Color(1.0, 0.5, 0.16),
  red: new THREE.Color(1.0, 0.16, 0.1),
  green: new THREE.Color(0.3, 1.0, 0.55),
};

export interface LightDot {
  matrix: THREE.Matrix4;
  color: THREE.Color;
  /** 0 = steady, otherwise blink frequency in Hz. */
  blink: number;
  phase: number;
}

const ONE = new THREE.Vector3(1, 1, 1);

function compose(pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale: THREE.Vector3 = ONE) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')),
    scale,
  );
}

/**
 * Accumulates static cockpit geometry, then merges it into one geometry per
 * material so the whole procedural cockpit renders in a handful of draw calls.
 * Rotations use Euler order 'YXZ' (yaw, then pitch) everywhere.
 */
export class CockpitBuilder {
  private solids = new Map<SolidKey, THREE.BufferGeometry[]>();
  private glows = new Map<GlowKey, THREE.BufferGeometry[]>();
  readonly dots: LightDot[] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  private rnd: () => number;

  constructor(seed = 1) {
    let s = seed >>> 0;
    this.rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  random() {
    return this.rnd();
  }

  private get top() {
    return this.stack[this.stack.length - 1];
  }

  group(pos: Vec3, rot: Vec3, fn: () => void) {
    this.stack.push(this.top.clone().multiply(compose(pos, rot)));
    fn();
    this.stack.pop();
  }

  private push<K>(map: Map<K, THREE.BufferGeometry[]>, key: K, geo: THREE.BufferGeometry, pos?: Vec3, rot?: Vec3) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.applyMatrix4(this.top.clone().multiply(compose(pos, rot)));
    g.clearGroups();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count * 2) | 0), 2));
    }
    let list = map.get(key);
    if (!list) map.set(key, (list = []));
    list.push(g);
  }

  /** Box with a small edge bevel so highlights catch the edges (thin parts stay sharp). */
  box(key: SolidKey, pos: Vec3, size: Vec3, rot?: Vec3) {
    const min = Math.min(...size);
    const geo = min >= 0.03 ? new RoundedBoxGeometry(size[0], size[1], size[2], 1, Math.min(0.012, min / 2 - 0.002)) : new THREE.BoxGeometry(...size);
    this.push(this.solids, key, geo, pos, rot);
  }

  rbox(key: SolidKey, pos: Vec3, size: Vec3, radius = 0.025, rot?: Vec3) {
    const r = Math.min(radius, Math.min(...size) / 2 - 0.001);
    this.push(this.solids, key, new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.max(r, 0.001)), pos, rot);
  }

  geo(key: SolidKey, geometry: THREE.BufferGeometry, pos?: Vec3, rot?: Vec3) {
    this.push(this.solids, key, geometry, pos, rot);
  }

  glow(key: GlowKey, pos: Vec3, size: Vec3, rot?: Vec3) {
    this.push(this.glows, key, new THREE.BoxGeometry(...size), pos, rot);
  }

  /** Small emissive indicator (instanced). */
  dot(pos: Vec3, size: Vec3, color: GlowKey | THREE.Color, intensity = 2.2, blink = 0, rot?: Vec3) {
    const c = (typeof color === 'string' ? GLOW_COLORS[color] : color).clone().multiplyScalar(intensity);
    this.dots.push({
      matrix: this.top.clone().multiply(compose(pos, rot, new THREE.Vector3(...size))),
      color: c,
      blink,
      phase: this.rnd() * Math.PI * 2,
    });
  }

  /** A grid of buttons on the local XZ plane (y = surface height). */
  keypad(
    origin: Vec3,
    cols: number,
    rows: number,
    pitch: [number, number],
    size: Vec3,
    pick: (c: number, r: number, rnd: number) => { color: GlowKey; intensity: number; blink?: number } | null,
  ) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = pick(c, r, this.rnd());
        if (!p) continue;
        this.dot([origin[0] + c * pitch[0], origin[1], origin[2] + r * pitch[1]], size, p.color, p.intensity, p.blink ?? 0);
      }
    }
  }

  build() {
    const merge = <K>(map: Map<K, THREE.BufferGeometry[]>) =>
      [...map.entries()].map(([key, list]) => {
        const merged = mergeGeometries(list, false)!;
        list.forEach((g) => g.dispose());
        merged.computeBoundingSphere();
        return { key, geometry: merged };
      });
    return { solids: merge(this.solids), glows: merge(this.glows), dots: this.dots };
  }
}

/** Rounded-rectangle path, used for window openings and bezels. */
export function roundedRectPath(path: THREE.Path, x0: number, y0: number, x1: number, y1: number, r: number) {
  path.moveTo(x0 + r, y0);
  path.lineTo(x1 - r, y0);
  path.quadraticCurveTo(x1, y0, x1, y0 + r);
  path.lineTo(x1, y1 - r);
  path.quadraticCurveTo(x1, y1, x1 - r, y1);
  path.lineTo(x0 + r, y1);
  path.quadraticCurveTo(x0, y1, x0, y1 - r);
  path.lineTo(x0, y0 + r);
  path.quadraticCurveTo(x0, y0, x0 + r, y0);
  return path;
}

/** Flat wall with a rounded window hole, extruded and centered on z. */
export function windowWall(
  outer: { x0: number; x1: number; y0: number; y1: number; r?: number },
  hole: { x0: number; x1: number; y0: number; y1: number; r: number },
  depth: number,
  bevel = 0.018,
) {
  const shape = new THREE.Shape();
  if (outer.r) roundedRectPath(shape, outer.x0, outer.y0, outer.x1, outer.y1, outer.r);
  else {
    shape.moveTo(outer.x0, outer.y0);
    shape.lineTo(outer.x1, outer.y0);
    shape.lineTo(outer.x1, outer.y1);
    shape.lineTo(outer.x0, outer.y1);
    shape.lineTo(outer.x0, outer.y0);
  }
  shape.holes.push(roundedRectPath(new THREE.Path(), hole.x0, hole.y0, hole.x1, hole.y1, hole.r));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.translate(0, 0, -depth / 2);
  // ExtrudeGeometry UVs are in world units; scale down so tiling textures behave.
  return geo;
}
