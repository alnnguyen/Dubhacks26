/**
 * Serializable astronaut avatar description. Rendering lives in AstronautAvatar;
 * nothing here depends on combat rules, networking, or input devices.
 */

export const AVATAR_ACTIONS = ['idle', 'attack', 'block', 'hit', 'victory', 'defeat'] as const;
export type AvatarAction = (typeof AVATAR_ACTIONS)[number];

export const SUIT_COLORS = ['white', 'orange', 'blue', 'red', 'purple', 'black'] as const;
export type SuitColorId = (typeof SUIT_COLORS)[number];

export const ACCENT_COLORS = ['cyan', 'orange', 'green', 'magenta', 'gold', 'white'] as const;
export type AccentColorId = (typeof ACCENT_COLORS)[number];

export const SABER_COLORS = ['blue', 'red', 'green', 'purple', 'yellow'] as const;
export type SaberColorId = (typeof SABER_COLORS)[number];

export const ACCESSORIES = ['antenna', 'cape', 'patch', 'jetpack'] as const;
export type AccessoryId = (typeof ACCESSORIES)[number];

export const NAME_MAX_LENGTH = 16;

export interface AvatarConfig {
  version: 1;
  name: string;
  suit: SuitColorId;
  accent: AccentColorId;
  saber: SaberColorId;
  accessories: AccessoryId[];
  /** Key of the processed face image in local IndexedDB, or null for the default face. */
  faceId: string | null;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  version: 1,
  name: 'Space Cadet',
  suit: 'white',
  accent: 'cyan',
  saber: 'blue',
  accessories: [],
  faceId: null,
};

/** Manual crop of the source photo, in source-image pixels. */
export interface FaceCrop {
  /** Center of the face oval. */
  cx: number;
  cy: number;
  /** Width of the oval; height is width × FACE_ASPECT. */
  width: number;
  /** Degrees, clockwise. */
  rotation: number;
}

/** Height / width of the face oval (faces are taller than wide). */
export const FACE_ASPECT = 1.25;
