import {
  ACCENT_COLORS,
  ACCESSORIES,
  DEFAULT_AVATAR,
  NAME_MAX_LENGTH,
  SABER_COLORS,
  SUIT_COLORS,
  type AvatarConfig,
} from '../types/avatar';

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_AVATAR.name;
  // Strip control characters, collapse whitespace, cap length.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH);
  return cleaned || DEFAULT_AVATAR.name;
}

/** Accepts anything (stored JSON, network payloads) and returns a valid config. */
export function normalizeAvatarConfig(raw: unknown): AvatarConfig {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const accessories = Array.isArray(value.accessories)
    ? [...new Set(value.accessories.filter((a): a is AvatarConfig['accessories'][number] => (ACCESSORIES as readonly unknown[]).includes(a)))]
    : [];
  return {
    version: 1,
    name: sanitizeName(value.name),
    suit: pick(value.suit, SUIT_COLORS, DEFAULT_AVATAR.suit),
    accent: pick(value.accent, ACCENT_COLORS, DEFAULT_AVATAR.accent),
    saber: pick(value.saber, SABER_COLORS, DEFAULT_AVATAR.saber),
    accessories,
    faceId: typeof value.faceId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value.faceId) ? value.faceId : null,
  };
}
