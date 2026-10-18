import type { ReplayBox, ReplayMoment } from '../../contracts.js';

// Deliberately accepts the documented clip/box subset, never arbitrary HTML.
function attrs(text: string): Record<string, string> {
  return Object.fromEntries([...text.matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/g)]
    .map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
}
function times(text = ''): number[] {
  const n = '(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*(?:seconds?|s)?';
  const match = text.match(new RegExp(`^\\s*${n}(?:\\s+${n})?\\s*$`, 'i'));
  return match ? match.slice(1).filter(v => v !== undefined).map(Number) : [];
}
function label(text = ''): string {
  return text.replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/<[^>]*>/g, '').slice(0, 180).trim() || 'Visible action';
}
export function parseMoments(text: string, duration: number): ReplayMoment[] {
  const result: ReplayMoment[] = [];
  for (const m of text.matchAll(/<clip\b((?:"[^"]*"|'[^']*'|[^<>"'])*)>/gi)) {
    const a = attrs(m[1]);
    if (a.asset_idx !== undefined && a.asset_idx !== '0') continue;
    const [start, until] = times(a.t);
    if (!Number.isFinite(start) || start < 0 || start >= duration) continue;
    const end = Math.min(duration, until ?? start + 2);
    if (end <= start) continue;
    // Keep at most three short, nonoverlapping moments, in model priority order.
    const moment = { start, end: Math.min(end, start + 5), caption: label(a.mention) };
    if (result.some(p => moment.start < p.end && moment.end > p.start)) continue;
    result.push(moment);
    if (result.length === 3) break;
  }
  return result;
}
export function parseBoxes(text: string, duration: number): ReplayBox[] {
  const result: ReplayBox[] = [];
  // Reject foreign-asset tracks before looking at their child boxes.
  const own = text.replace(/<track\b([^>]*)>[\s\S]*?<\/track>/gi, (whole, a: string) => {
    const asset = attrs(a).asset_idx;
    return asset !== undefined && asset !== '0' ? '' : whole;
  });
  for (const m of own.matchAll(/<point_box\b([^>]*)>([^<]*)<\/point_box>/gi)) {
    const a = attrs(m[1]);
    if (a.asset_idx !== undefined && a.asset_idx !== '0') continue;
    const [at] = times(a.t);
    const values = [...m[2].matchAll(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)].flatMap(m => [Number(m[1]), Number(m[2])]);
    if (values.length !== 4 || values.some(v => v < 0 || v > 1000) || !Number.isFinite(at) || at < 0 || at > duration) continue;
    const [x1, y1, x2, y2] = values.map(v => v / 1000);
    if (x2 <= x1 || y2 <= y1) continue;
    result.push({ at, x1, y1, x2, y2 });
    if (result.length === 120) break;
  }
  return result.sort((a, b) => a.at - b.at);
}
