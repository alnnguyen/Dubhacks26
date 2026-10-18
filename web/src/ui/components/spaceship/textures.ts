import * as THREE from 'three';

/**
 * Procedural canvas textures. Everything here is generated at runtime so the
 * prototype ships with zero binary assets. Swap for authored textures later.
 */

const CYAN = '#5fe1ff';
const CYAN_DIM = 'rgba(95,225,255,0.35)';
const ORANGE = '#ff9a4a';
const WHITE = '#e8f8ff';

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

function frame(g: CanvasRenderingContext2D, w: number, h: number, title: string, alert?: boolean) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#04131f');
  bg.addColorStop(1, '#020a12');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = alert ? 'rgba(255,154,74,0.6)' : CYAN_DIM;
  g.lineWidth = 2;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = alert ? ORANGE : CYAN;
  g.font = '600 18px monospace';
  g.fillText(title, 18, 30);
  g.fillStyle = CYAN_DIM;
  g.fillRect(18, 38, w - 36, 1);
}

function scanlines(g: CanvasRenderingContext2D, w: number, h: number, t: number) {
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  const sy = ((t * 60) % (h + 60)) - 30;
  const grd = g.createLinearGradient(0, sy - 30, 0, sy + 30);
  grd.addColorStop(0, 'rgba(95,225,255,0)');
  grd.addColorStop(0.5, 'rgba(95,225,255,0.07)');
  grd.addColorStop(1, 'rgba(95,225,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, sy - 30, w, 60);
}

const draws: Record<ScreenKind, (g: CanvasRenderingContext2D, w: number, h: number, t: number, d: ScreenData) => void> = {
  tactical(g, w, h, t, d) {
    frame(g, w, h, 'TACTICAL // COMMAND', d.alert);
    const cx = w * 0.5;
    const cy = h * 0.58;
    g.strokeStyle = 'rgba(95,225,255,0.18)';
    g.lineWidth = 1;
    for (let x = 18; x < w - 18; x += 32) {
      g.beginPath();
      g.moveTo(x, 46);
      g.lineTo(x, h - 14);
      g.stroke();
    }
    for (let y = 50; y < h - 14; y += 32) {
      g.beginPath();
      g.moveTo(18, y);
      g.lineTo(w - 18, y);
      g.stroke();
    }
    g.strokeStyle = CYAN;
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(cx, cy, w * 0.3, h * 0.2, -0.25, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = CYAN_DIM;
    g.beginPath();
    g.ellipse(cx, cy, w * 0.18, h * 0.11, -0.25, 0, Math.PI * 2);
    g.stroke();
    const a = t * 0.6;
    const px = cx + Math.cos(a) * w * 0.3 * Math.cos(-0.25) - Math.sin(a) * h * 0.2 * Math.sin(-0.25);
    const py = cy + Math.cos(a) * w * 0.3 * Math.sin(-0.25) + Math.sin(a) * h * 0.2 * Math.cos(-0.25);
    g.fillStyle = ORANGE;
    g.beginPath();
    g.arc(px, py, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = WHITE;
    g.font = '14px monospace';
    g.fillText(`CONTACTS ${String(d.contacts ?? 0).padStart(2, '0')}`, 18, h - 22);
    g.fillText(`T+${t.toFixed(1)}`, w - 110, h - 22);
    scanlines(g, w, h, t);
  },
  graph(g, w, h, t) {
    frame(g, w, h, 'SUBSPACE SIGNAL');
    g.strokeStyle = CYAN;
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 18; x < w - 18; x += 3) {
      const u = x / w;
      const y = h * 0.62 - (Math.sin(u * 13 + t * 2) * 0.5 + Math.sin(u * 31 - t * 3.1) * 0.3 + Math.exp(-((u - 0.45) ** 2) * 60) * 2.2) * h * 0.12;
      if (x === 18) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    for (let i = 0; i < 16; i++) {
      const v = (Math.sin(i * 1.7 + t * 2.3) * 0.5 + 0.5) * 0.8 + 0.1;
      g.fillStyle = i % 5 === 0 ? ORANGE : CYAN_DIM;
      g.fillRect(18 + i * ((w - 36) / 16), h - 20 - v * 50, (w - 36) / 16 - 4, v * 50);
    }
    scanlines(g, w, h, t);
  },
  grid(g, w, h, t) {
    frame(g, w, h, 'CREW // SYS');
    const cols = 8;
    const rows = 4;
    const cw = (w - 36) / cols;
    const ch = (h - 60) / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const on = Math.sin(r * 3.1 + col * 1.7 + Math.floor(t * 2) * 0.9) > -0.3;
        g.strokeStyle = on ? CYAN : CYAN_DIM;
        g.lineWidth = 1.5;
        const x = 18 + col * cw + 4;
        const y = 48 + r * ch + 4;
        g.strokeRect(x, y, cw - 8, ch - 8);
        if (on) {
          g.fillStyle = 'rgba(95,225,255,0.25)';
          g.fillRect(x + 4, y + (ch - 8) * 0.5, cw - 16, (ch - 8) * 0.4);
        }
      }
    }
    scanlines(g, w, h, t);
  },
  systems(g, w, h, t) {
    frame(g, w, h, 'SYSTEMS');
    const labels = ['SHIELD', 'REACTOR', 'COMMS', 'SENSORS', 'HULL'];
    labels.forEach((l, i) => {
      const y = 62 + i * ((h - 80) / labels.length);
      const v = 0.55 + Math.sin(t * 0.8 + i * 1.3) * 0.15 + i * 0.05;
      g.fillStyle = WHITE;
      g.font = '14px monospace';
      g.fillText(l, 18, y + 10);
      g.fillStyle = 'rgba(95,225,255,0.15)';
      g.fillRect(120, y, w - 140, 12);
      g.fillStyle = i === 1 ? ORANGE : CYAN;
      g.fillRect(120, y, (w - 140) * Math.min(v, 1), 12);
    });
    scanlines(g, w, h, t);
  },
  nav(g, w, h, t) {
    frame(g, w, h, 'NAV // ORBIT');
    const cx = w * 0.5;
    const cy = h * 0.58;
    const r = Math.min(w, h) * 0.32;
    g.strokeStyle = CYAN_DIM;
    g.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      g.beginPath();
      g.arc(cx, cy, (r * i) / 3, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = CYAN;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, t * 0.5, t * 0.5 + 1.2);
    g.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.lineTo(cx + Math.cos(a) * (r + (i % 6 === 0 ? 12 : 5)), cy + Math.sin(a) * (r + (i % 6 === 0 ? 12 : 5)));
      g.stroke();
    }
    g.fillStyle = WHITE;
    g.font = '13px monospace';
    g.fillText('ALT 412.6 KM', 18, h - 20);
    g.fillText(`HDG ${(((t * 7) % 360) | 0).toString().padStart(3, '0')}`, w - 96, h - 20);
    scanlines(g, w, h, t);
  },
  bars(g, w, h, t) {
    frame(g, w, h, 'PWR');
    for (let i = 0; i < 10; i++) {
      const v = Math.sin(t * 1.6 + i) * 0.3 + 0.6;
      g.fillStyle = i === 7 ? ORANGE : CYAN;
      g.fillRect(16 + i * ((w - 32) / 10), h - 14 - v * (h - 60), (w - 32) / 10 - 5, v * (h - 60));
    }
  },
  pilot(g, w, h, t, d) {
    frame(g, w, h, 'PILOT ID', d.alert);
    g.fillStyle = d.alert ? ORANGE : WHITE;
    g.font = '700 46px monospace';
    g.fillText(d.callsign ?? '—', 18, h * 0.5);
    g.font = '16px monospace';
    g.fillStyle = d.status === 'online' ? '#5dffa8' : d.status === 'offline' ? '#ff5a5a' : ORANGE;
    g.fillText(`● ${String(d.status ?? '').toUpperCase()}`, 18, h * 0.5 + 34);
    g.fillStyle = CYAN_DIM;
    for (let i = 0; i < 24; i++) {
      const v = Math.abs(Math.sin(i * 0.7 + t * 3));
      g.fillRect(18 + i * 18, h - 22 - v * 26, 10, v * 26);
    }
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
