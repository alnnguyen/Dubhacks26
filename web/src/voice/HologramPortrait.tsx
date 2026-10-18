import { useEffect, useRef } from 'react';
import type { CopilotPhase } from './CopilotVoice';
import portraitUrl from './assets/lyra-hologram.png';
import './portrait.css';

type Point = {x: number; y: number};
const WIDTH = 640, HEIGHT = 720;

// Affine texture triangles articulate the supplied artwork without replacing its face.
function triangle(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, a: Point, b: Point, c: Point, A: Point, B: Point, C: Point) {
  const denominator = a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y);
  if (!denominator) return;
  const coefficients = (u: number, v: number, w: number) => [
    (u * (b.y - c.y) + v * (c.y - a.y) + w * (a.y - b.y)) / denominator,
    (u * (c.x - b.x) + v * (a.x - c.x) + w * (b.x - a.x)) / denominator,
    (u * (b.x * c.y - c.x * b.y) + v * (c.x * a.y - a.x * c.y) + w * (a.x * b.y - b.x * a.y)) / denominator,
  ];
  const [xx, xy, xt] = coefficients(A.x, B.x, C.x);
  const [yx, yy, yt] = coefficients(A.y, B.y, C.y);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath(); ctx.clip();
  ctx.transform(xx, yx, xy, yy, xt, yt); ctx.drawImage(image, 0, 0); ctx.restore();
}

function drawPortrait(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, opening: number) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.drawImage(image, 0, 0);
  if (opening < .15) return;
  // The original closed smile is at (320, 444) in the center-cropped source.
  ctx.beginPath();
  ctx.moveTo(272, 437); ctx.quadraticCurveTo(320, 450, 368, 437);
  ctx.quadraticCurveTo(320, 450 + opening * 1.8, 272, 437);
  ctx.fillStyle = '#04172f'; ctx.fill();
  const rows = 12, cols = 14;
  const source = (col: number, row: number): Point => {
    const x = 222 + col / cols * 196;
    const top = 444 - 7 * Math.min(1, Math.pow((x - 320) / 48, 2));
    return {x, y: top + row / rows * (542 - top)};
  };
  const deform = (p: Point): Point => {
    const horizontal = Math.pow(Math.max(0, 1 - Math.pow((p.x - 320) / 98, 2)), 3);
    const vertical = Math.pow(Math.max(0, (542 - p.y) / 98), 2);
    return {x: p.x, y: p.y + opening * horizontal * vertical};
  };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = source(x, y), b = source(x + 1, y), c = source(x, y + 1), d = source(x + 1, y + 1);
    triangle(ctx, image, a, b, c, deform(a), deform(b), deform(c));
    triangle(ctx, image, b, d, c, deform(b), deform(d), deform(c));
  }
}

/** User-selected artwork. Audio amplitude drives stylized jaw motion, not phoneme lip-sync. */
export function HologramPortrait({phase = 'idle', sampleLevel, active = true}: {
  phase?: CopilotPhase; sampleLevel?: () => number; active?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sample = useRef(sampleLevel); sample.current = sampleLevel;
  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    let disposed = false, raf = 0, level = 0, last = 0;
    const image = new Image();
    const crop = document.createElement('canvas'); crop.width = WIDTH; crop.height = HEIGHT;
    const cropped = crop.getContext('2d');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = () => preference.matches || !!node.closest('[data-reduced-motion="true"]');
    const render = (opening = 0) => {
      const scale = node.width / WIDTH;
      ctx.setTransform(scale, 0, 0, scale, 0, 0); drawPortrait(ctx, crop, opening);
    };
    const resize = () => {
      const size = Math.min(WIDTH, Math.max(160, Math.round(node.clientWidth * Math.min(devicePixelRatio || 1, 2)))) || 320;
      node.width = size; node.height = Math.round(size * HEIGHT / WIDTH);
      if (image.complete && image.naturalWidth) render();
    };
    const frame = (time: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (time - last < 33) return;
      last = time;
      const target = document.hidden || reduced() ? 0 : Math.min(1, Math.max(0, sample.current?.() ?? 0));
      level += (target - level) * (target > level ? .65 : .28);
      render(level < .015 ? 0 : 15 * level);
    };
    const start = () => {
      cancelAnimationFrame(raf); raf = 0;
      if (disposed || !image.complete || !image.naturalWidth) return;
      render();
      if (active && !document.hidden && !reduced() && (phase === 'speaking' || phase === 'thinking')) raf = requestAnimationFrame(frame);
    };
    image.onload = () => {
      if (disposed || !cropped) return;
      // Keep the original PNG unchanged; crop only at render time.
      cropped.drawImage(image, (image.naturalWidth - WIDTH) / 2, 0, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
      resize(); start();
    };
    image.src = portraitUrl;
    const observer = new ResizeObserver(resize); observer.observe(node);
    document.addEventListener('visibilitychange', start); preference.addEventListener('change', start);
    return () => { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); document.removeEventListener('visibilitychange', start); preference.removeEventListener('change', start); };
  }, [active, phase]);
  return <span className="lyra-portrait" data-portrait-phase={phase} aria-hidden="true">
    <span className="lyra-projection">
      <img className="lyra-portrait-fallback" src={portraitUrl} alt="" />
      <canvas ref={canvas} className="lyra-portrait-canvas" width="320" height="360" />
      <span className="lyra-projection-scan" /><span className="lyra-projection-ring" />
      <span className="lyra-voice-bars">{Array.from({length: 9}, (_, index) => <i key={index} style={{animationDelay: `${index * -.11}s`}} />)}</span>
    </span>
  </span>;
}
