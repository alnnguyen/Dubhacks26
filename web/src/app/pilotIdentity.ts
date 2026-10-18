/** Hardcoded local pilot cosmetics. Display-only — not server inventory. */

export const PILOT_STORAGE_KEY = 'sd.pilot.identity.v1';

export const ACCENTS = [
  { id: 'cyan', label: 'Ion cyan', css: '#3de0ff' },
  { id: 'amber', label: 'Solar amber', css: '#f0b429' },
  { id: 'violet', label: 'Nebula violet', css: '#b388ff' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];

export type PilotIdentity = {
  callsign: string;
  shipName: string;
  accent: AccentId;
};

export function sanitizeCallsign(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 14);
}

export function sanitizeShipName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 22);
}

export function isAccentId(value: unknown): value is AccentId {
  return ACCENTS.some((a) => a.id === value);
}

export function loadPilotIdentity(): PilotIdentity | null {
  try {
    const raw = localStorage.getItem(PILOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PilotIdentity>;
    const callsign = sanitizeCallsign(String(parsed.callsign ?? ''));
    const shipName = sanitizeShipName(String(parsed.shipName ?? ''));
    if (!callsign || !shipName) return null;
    const accent = isAccentId(parsed.accent) ? parsed.accent : 'cyan';
    return { callsign, shipName, accent };
  } catch {
    return null;
  }
}

export function savePilotIdentity(identity: PilotIdentity): PilotIdentity {
  const next: PilotIdentity = {
    callsign: sanitizeCallsign(identity.callsign) || 'PILOT',
    shipName: sanitizeShipName(identity.shipName) || 'UNNAMED HULL',
    accent: isAccentId(identity.accent) ? identity.accent : 'cyan',
  };
  try {
    localStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function clearPilotIdentity(): void {
  try {
    localStorage.removeItem(PILOT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function accentCss(id: AccentId): string {
  return ACCENTS.find((a) => a.id === id)?.css ?? ACCENTS[0].css;
}
