import * as THREE from 'three';

/**
 * Procedural canvas textures. Everything here is generated at runtime so the
 * prototype ships with zero binary assets. Swap for authored textures later.
 */

/** Theme tokens from ui/styles/theme.css, read once (canvas can't use CSS variables). */
let palette: { cyan: string; cyanDim: string; cyanFaint: string; orange: string; text: string; go: string; danger: string; ui: string; display: string } | null = null;
function theme() {
  if (palette) return palette;
  const css = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback;
  palette = {
    cyan: v('--ko-cyan', '#22e5ff'),
    cyanDim: v('--ko-cyan-line', 'rgba(34,229,255,0.45)'),
    cyanFaint: v('--ko-cyan-faint', 'rgba(34,229,255,0.16)'),
    orange: v('--ko-orange', '#ff7a1a'),
    text: v('--ko-text', '#eef9ff'),
    go: v('--ko-go', '#5dffa8'),
    danger: v('--ko-danger', '#ff6b6b'),
    ui: v('--ko-font-ui', 'Rajdhani, sans-serif'),
    display: v('--ko-font-display', 'Orbitron, sans-serif'),
  };
  return palette;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function canvasTexture(canvas: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return tex;
}

/** Deck plating: large panels, seams, bolts, vent strips. */
export function makeFloorTexture() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d')!;
  const rnd = seeded(7);
  g.fillStyle = '#3a4048';
  g.fillRect(0, 0, S, S);
  // Brushed noise
  for (let i = 0; i < 9000; i++) {
    const v = 50 + rnd() * 24;
    g.fillStyle = `rgba(${v},${v + 4},${v + 10},0.18)`;
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 30, 1);
  }
  const panel = (x: number, y: number, w: number, h: number) => {
    g.strokeStyle = '#15181c';
    g.lineWidth = 6;
    g.strokeRect(x, y, w, h);
    g.strokeStyle = 'rgba(160,175,190,0.18)';
    g.lineWidth = 2;
    g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    g.fillStyle = '#1b1f24';
    for (const [bx, by] of [[x + 16, y + 16], [x + w - 16, y + 16], [x + 16, y + h - 16], [x + w - 16, y + h - 16]]) {
      g.beginPath();
      g.arc(bx, by, 5, 0, Math.PI * 2);
      g.fill();
    }
  };
  panel(0, 0, 512, 512);
  panel(512, 0, 512, 256);
  panel(512, 256, 512, 256);
  panel(0, 512, 256, 512);
  panel(256, 512, 768, 512);
  // Vent grille
  g.fillStyle = '#121519';
  g.fillRect(560, 40, 420, 170);
  g.fillStyle = '#4a525c';
  for (let i = 0; i < 14; i++) g.fillRect(570, 52 + i * 11.5, 400, 4);
  g.fillStyle = '#121519';
  g.fillRect(300, 600, 680, 120);
  g.fillStyle = '#434a54';
  for (let i = 0; i < 40; i++) g.fillRect(310 + i * 17, 610, 6, 100);
  return canvasTexture(c, { repeat: [3.6, 4.6] });
}

/** Horizontal slat grille for vents and recessed panels. */
export function makeGrilleTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d0f12';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 16; i++) {
    g.fillStyle = '#3d444d';
    g.fillRect(0, i * 8 + 1, 128, 3);
    g.fillStyle = '#5a636e';
    g.fillRect(0, i * 8 + 1, 128, 1);
  }
  return canvasTexture(c);
}

/**
 * Procedural PBR detail maps for painted/brushed hull metal: a tangent-space
 * normal map (brushing, dents, panel seams) and a matching roughness map (wear).
 */
export function makeSurfaceMaps(size = 256) {
  const rnd = seeded(99);
  const height = new Float32Array(size * size);
  // Horizontal brushing streaks
  for (let y = 0; y < size; y++) {
    let v = rnd();
    for (let x = 0; x < size; x++) {
      v = v * 0.92 + rnd() * 0.08;
      height[y * size + x] = v * 0.35;
    }
  }
  // Soft dents
  for (let i = 0; i < 26; i++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const r = 6 + rnd() * 22;
    for (let y = Math.max(0, cy - r) | 0; y < Math.min(size, cy + r); y++) {
      for (let x = Math.max(0, cx - r) | 0; x < Math.min(size, cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d < 1) height[y * size + x] -= (1 - d * d) * 0.25;
      }
    }
  }
  // Panel seam grid
  const seam = size; // seams on tile edges = face edges of each panel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x % seam, seam - (x % seam));
      const dy = Math.min(y % seam, seam - (y % seam));
      if (Math.min(dx, dy) < 1.5) height[y * size + x] -= 0.9;
    }
  }

  const nc = makeCanvas(size, size);
  const rc = makeCanvas(size, size);
  const n = nc.getContext('2d')!;
  const r = rc.getContext('2d')!;
  const nImg = n.createImageData(size, size);
  const rImg = r.createImageData(size, size);
  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 2.2;
      const dy = (h(x, y + 1) - h(x, y - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      nImg.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      nImg.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      nImg.data[i + 2] = (1 / len) * 255;
      nImg.data[i + 3] = 255;
      const wear = 0.78 + height[y * size + x] * 0.35 + (rnd() - 0.5) * 0.08;
      const v = Math.max(0, Math.min(255, wear * 255));
      rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = v;
      rImg.data[i + 3] = 255;
    }
  }
  n.putImageData(nImg, 0, 0);
  r.putImageData(rImg, 0, 0);
  const normalMap = canvasTexture(nc, { srgb: false, repeat: [1, 1] });
  const roughnessMap = canvasTexture(rc, { srgb: false, repeat: [1, 1] });
  return { normalMap, roughnessMap };
}

/** Soft radial blob, used for glows. */
export function makeRadialTexture(inner = 'rgba(0,0,0,0.85)', outer = 'rgba(0,0,0,0)') {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return canvasTexture(c);
}

// ---------------------------------------------------------------------------
// Animated screen content
// ---------------------------------------------------------------------------

export interface ScreenData {
  callsign?: string;
  status?: string;
  alert?: boolean;
  contacts?: number;
}

export type ScreenKind = 'tactical' | 'graph' | 'grid' | 'systems' | 'nav' | 'bars' | 'pilot';

/*
 * The cockpit screens render at roughly a third of their canvas size at 1280x800,
 * so text is drawn ~3x larger than it should appear (34–40px ≈ 12–14px on screen).
 * Each screen keeps one title and a few large elements; no small labels.
 */
function frame(g: CanvasRenderingContext2D, w: number, h: number, title: string, titlePx: number, alert?: boolean) {
  const t = theme();
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#04131f');
  bg.addColorStop(1, '#020a12');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = alert ? t.orange : t.cyanDim;
  g.lineWidth = 3;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = alert ? t.orange : t.cyan;
  g.font = `700 ${titlePx}px ${t.ui}`;
  g.textBaseline = 'alphabetic';
  g.fillText(title, 22, 18 + titlePx);
  return 30 + titlePx;
}

function scanlines(g: CanvasRenderingContext2D, w: number, h: number, t: number) {
  g.fillStyle = 'rgba(0,0,0,0.14)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  const sy = ((t * 60) % (h + 60)) - 30;
  const grd = g.createLinearGradient(0, sy - 30, 0, sy + 30);
  grd.addColorStop(0, 'rgba(34,229,255,0)');
  grd.addColorStop(0.5, 'rgba(34,229,255,0.06)');
  grd.addColorStop(1, 'rgba(34,229,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, sy - 30, w, 60);
}

const STATUS_COPY: Record<string, [string, string]> = {
  online: ['READY', 'FOR DEPLOYMENT'],
  connecting: ['LINKING', 'ESTABLISHING UPLINK'],
  offline: ['STANDBY', 'NO SERVER LINK'],
};

const draws: Record<ScreenKind, (g: CanvasRenderingContext2D, w: number, h: number, t: number, d: ScreenData) => void> = {
  tactical(g, w, h, t, d) {
    // The console in front hides the lower third of this screen; keep content up top.
    const th = theme();
    const top = frame(g, w, h, 'TACTICAL', 36, d.alert);
    const visible = h * 0.64;
    const cx = w * 0.66;
    const cy = (top + visible) * 0.5;
    const rx = w * 0.24;
    const ry = (visible - top) * 0.36;
    g.strokeStyle = th.cyan;
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, -0.25, 0, Math.PI * 2);
    g.stroke();
    const a = t * 0.6;
    const px = cx + Math.cos(a) * rx * Math.cos(-0.25) - Math.sin(a) * ry * Math.sin(-0.25);
    const py = cy + Math.cos(a) * rx * Math.sin(-0.25) + Math.sin(a) * ry * Math.cos(-0.25);
    g.fillStyle = th.orange;
    g.beginPath();
    g.arc(px, py, 10, 0, Math.PI * 2);
    g.fill();
    // One large readout: contacts in range.
    g.fillStyle = th.text;
    g.font = `700 80px ${th.display}`;
    g.fillText(String(d.contacts ?? 0).padStart(2, '0'), 22, top + 82);
    g.fillStyle = th.cyan;
    g.font = `700 34px ${th.ui}`;
    g.fillText('CONTACTS', 22, top + 124);
    scanlines(g, w, h, t);
  },
  graph(g, w, h, t, d) {
    const th = theme();
    const top = frame(g, w, h, 'SIGNAL', 34, d.alert);
    g.strokeStyle = th.cyan;
    g.lineWidth = 5;
    g.beginPath();
    for (let x = 22; x < w - 22; x += 4) {
      const u = x / w;
      const y = top + (h - top) * 0.38 - (Math.sin(u * 9 + t * 2) * 0.5 + Math.exp(-((u - 0.45) ** 2) * 40) * 1.6) * (h - top) * 0.16;
      if (x === 22) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    const n = 8;
    const bw = (w - 44) / n;
    for (let i = 0; i < n; i++) {
      const v = (Math.sin(i * 1.7 + t * 2.3) * 0.5 + 0.5) * 0.75 + 0.25;
      g.fillStyle = i === 5 ? th.orange : th.cyanDim;
      g.fillRect(22 + i * bw, h - 22 - v * 70, bw - 10, v * 70);
    }
    scanlines(g, w, h, t);
  },
  grid(g, w, h, t) {
    // Desk-mounted and seen edge-on: pattern only, no labels.
    const th = theme();
    frame(g, w, h, '', 0);
    const cols = 4;
    const rows = 2;
    const cw = (w - 36) / cols;
    const ch = (h - 36) / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const on = Math.sin(r * 3.1 + col * 1.7 + Math.floor(t * 2) * 0.9) > -0.3;
        g.fillStyle = on ? th.cyanDim : th.cyanFaint;
        g.fillRect(18 + col * cw + 6, 18 + r * ch + 6, cw - 12, ch - 12);
      }
    }
  },
  systems(g, w, h, t) {
    const th = theme();
    const top = frame(g, w, h, 'SYSTEMS', 40);
    // The seat in front hides the bottom of this screen: two large rows.
    const labels = ['SHIELD', 'REACTOR'];
    const row = (h * 0.78 - top) / labels.length;
    labels.forEach((l, i) => {
      const y = top + i * row + row * 0.5;
      const v = 0.62 + Math.sin(t * 0.8 + i * 1.3) * 0.14 + i * 0.06;
      g.fillStyle = th.text;
      g.font = `700 44px ${th.ui}`;
      g.textBaseline = 'middle';
      g.fillText(l, 22, y);
      g.fillStyle = th.cyanFaint;
      g.fillRect(230, y - 18, w - 252, 36);
      g.fillStyle = i === 1 ? th.orange : th.cyan;
      g.fillRect(230, y - 18, (w - 252) * Math.min(v, 1), 36);
      g.textBaseline = 'alphabetic';
    });
    scanlines(g, w, h, t);
  },
  nav(g, w, h, t) {
    const th = theme();
    const top = frame(g, w, h, 'NAV', 40);
    const r = (h - top) * 0.4;
    const cx = w - 22 - r - 8;
    const cy = (top + h) * 0.5;
    g.strokeStyle = th.cyanDim;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = th.cyan;
    g.lineWidth = 8;
    g.beginPath();
    g.arc(cx, cy, r, t * 0.5, t * 0.5 + 1.2);
    g.stroke();
    // One large readout: heading.
    g.fillStyle = th.text;
    g.font = `700 80px ${th.display}`;
    g.fillText(String(((t * 7) % 360) | 0).padStart(3, '0'), 22, h - 70);
    g.fillStyle = th.cyan;
    g.font = `700 36px ${th.ui}`;
    g.fillText('HEADING', 22, h - 26);
    scanlines(g, w, h, t);
  },
  bars(g, w, h, t) {
    // Desk-mounted and seen edge-on: pattern only, no labels.
    const th = theme();
    frame(g, w, h, '', 0);
    for (let i = 0; i < 6; i++) {
      const v = Math.sin(t * 1.6 + i) * 0.3 + 0.6;
      g.fillStyle = i === 4 ? th.orange : th.cyan;
      g.fillRect(18 + i * ((w - 36) / 6), h - 18 - v * (h - 44), (w - 36) / 6 - 8, v * (h - 44));
    }
  },
  pilot(g, w, h, t, d) {
    // Deployment status. The pilot's name lives on the HUD badge, not here.
    const th = theme();
    const top = frame(g, w, h, 'STATUS', 34, d.alert);
    const [big, small] = d.alert ? ['CHALLENGE', 'INCOMING'] : STATUS_COPY[String(d.status)] ?? STATUS_COPY.connecting;
    const color = d.alert ? th.orange : d.status === 'online' ? th.go : d.status === 'offline' ? th.danger : th.orange;
    const mid = top + (h - top) * 0.42;
    g.fillStyle = color;
    g.beginPath();
    g.arc(40, mid - 22, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = th.text;
    g.font = `800 ${big.length > 7 ? 52 : 64}px ${th.display}`;
    g.fillText(big, 70, mid);
    g.fillStyle = color;
    g.font = `700 38px ${th.ui}`;
    g.fillText(small, 22, mid + 60);
    scanlines(g, w, h, t);
  },
};

/** A self-redrawing screen texture. Call `update(t, data)` from useFrame. */
export class ScreenTexture {
  readonly texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private last = -Infinity;
  constructor(
    readonly kind: ScreenKind,
    width = 512,
    height = 320,
  ) {
    this.canvas = makeCanvas(width, height);
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = canvasTexture(this.canvas);
    draws[kind](this.ctx, width, height, 0, {});
    this.texture.needsUpdate = true;
  }
  /** Redraws at most `fps` times per second (canvas uploads are the main cost). */
  update(t: number, data: ScreenData, fps: number, force = false) {
    if (!force && t - this.last < 1 / fps) return;
    this.last = t;
    draws[this.kind](this.ctx, this.canvas.width, this.canvas.height, t, data);
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.texture.dispose();
  }
}
