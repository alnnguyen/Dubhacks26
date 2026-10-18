import type { AccentColorId, SaberColorId, SuitColorId } from '../types/avatar';

/** Suit shades for the source model's material slots (sRGB hex). */
export interface SuitPalette {
  label: string;
  /** Large padded panels (model slot SciFi_Main). */
  main: string;
  /** Joints, soft fabric and recessed panels (SciFi_MainDark). */
  dark: string;
  /** Hard trim: boots, gloves, collar, chest plate (SciFi_Light). */
  trim: string;
}

export const SUIT_PALETTES: Record<SuitColorId, SuitPalette> = {
  white: { label: 'White', main: '#eef1f4', dark: '#9aa3ad', trim: '#c9d0d8' },
  orange: { label: 'Orange', main: '#ff7a2e', dark: '#7a3418', trim: '#e9e3dc' },
  blue: { label: 'Blue', main: '#2f7fe0', dark: '#173a6b', trim: '#e3e9ef' },
  red: { label: 'Red', main: '#d93a3a', dark: '#5e1a1e', trim: '#e7e1df' },
  purple: { label: 'Purple', main: '#8b55e0', dark: '#3a2466', trim: '#e6e1ee' },
  black: { label: 'Black', main: '#2a2e35', dark: '#121418', trim: '#5d6670' },
};

export interface AccentPalette {
  label: string;
  color: string;
}

export const ACCENT_PALETTES: Record<AccentColorId, AccentPalette> = {
  cyan: { label: 'Cyan', color: '#4fe3ff' },
  orange: { label: 'Orange', color: '#ff9a3c' },
  green: { label: 'Green', color: '#5dff9b' },
  magenta: { label: 'Magenta', color: '#ff5fd2' },
  gold: { label: 'Gold', color: '#ffd166' },
  white: { label: 'White', color: '#f2f7ff' },
};

export interface SaberPalette {
  label: string;
  /** Blade glow color. The core is always near-white. */
  glow: string;
}

export const SABER_PALETTES: Record<SaberColorId, SaberPalette> = {
  blue: { label: 'Blue', glow: '#2f8bff' },
  red: { label: 'Red', glow: '#ff2a2a' },
  green: { label: 'Green', glow: '#33ff5c' },
  purple: { label: 'Purple', glow: '#a63dff' },
  yellow: { label: 'Yellow', glow: '#ffd51f' },
};
