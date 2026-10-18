/** A separate visual clock. Network ticks, tracked joints, controls and blade positions never use it. */
export class HitStop {
  time = 0;
  private frames = 0;
  private slow = 0;
  hit(big: boolean, kill = false) { this.frames = big ? 4 : 2; this.slow = kill ? 0.5 : 0; }
  advance(dt: number, enabled = true) {
    const delta = Math.min(dt, 0.1);
    if (!enabled) { this.frames = 0; this.slow = 0; this.time += delta; return; }
    if (this.frames > 0) { this.frames--; return; }
    this.time += delta * (this.slow > 0 ? 0.2 : 1);
    this.slow = Math.max(0, this.slow - delta);
  }
}
