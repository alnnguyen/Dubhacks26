import { useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Pins DOM HUD elements to points in the 3D cockpit. The projector runs inside
 * the R3F frame loop and writes transforms directly to the elements, so
 * anchored UI follows camera motion without React re-renders.
 */

export interface AnchorOptions {
  /** Keep the element at least this many px from the viewport edge. */
  clampPad?: number;
  /** Screen-space offset in px applied after projection. */
  offset?: [number, number];
  /** Translate origin, as fractions of the element size. Default centers it. */
  origin?: [number, number];
}

interface Entry {
  position: THREE.Vector3;
  el: HTMLElement | null;
  opts: AnchorOptions;
}

export class AnchorRegistry {
  readonly entries = new Map<string, Entry>();

  private entry(id: string) {
    let e = this.entries.get(id);
    if (!e) this.entries.set(id, (e = { position: new THREE.Vector3(), el: null, opts: {} }));
    return e;
  }
  setPosition(id: string, p: THREE.Vector3 | readonly [number, number, number]) {
    const e = this.entry(id);
    if (p instanceof THREE.Vector3) e.position.copy(p);
    else e.position.set(p[0], p[1], p[2]);
  }
  bind(id: string, el: HTMLElement | null, opts: AnchorOptions = {}) {
    const e = this.entry(id);
    e.el = el;
    e.opts = opts;
  }
}

/** Ref-callback hook for a DOM element anchored to `id`. */
export function useAnchor(registry: AnchorRegistry, id: string, position?: readonly [number, number, number], opts?: AnchorOptions) {
  // Depend on the values, not the array identity.
  const key = position?.join(',');
  useEffect(() => {
    if (key) registry.setPosition(id, key.split(',').map(Number) as [number, number, number]);
  }, [registry, id, key]);
  const optsKey = JSON.stringify(opts ?? {});
  return useCallback(
    (el: HTMLElement | null) => registry.bind(id, el, JSON.parse(optsKey) as AnchorOptions),
    [registry, id, optsKey],
  );
}

const v = new THREE.Vector3();

export function AnchorProjector({ registry }: { registry: AnchorRegistry }) {
  useFrame(({ camera, size }) => {
    for (const { position, el, opts } of registry.entries.values()) {
      if (!el) continue;
      v.copy(position).project(camera);
      const behind = v.z > 1 || v.z < -1;
      const pad = opts.clampPad ?? 12;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const [ox, oy] = opts.origin ?? [0.5, 0.5];
      let x = (v.x * 0.5 + 0.5) * size.width + (opts.offset?.[0] ?? 0) - w * ox;
      let y = (-v.y * 0.5 + 0.5) * size.height + (opts.offset?.[1] ?? 0) - h * oy;
      x = Math.min(Math.max(x, pad), Math.max(pad, size.width - w - pad));
      y = Math.min(Math.max(y, pad), Math.max(pad, size.height - h - pad));
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.visibility = behind ? 'hidden' : '';
    }
  });
  return null;
}
