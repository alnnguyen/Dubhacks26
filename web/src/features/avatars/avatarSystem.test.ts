import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, NAME_MAX_LENGTH } from './types/avatar';
import { normalizeAvatarConfig, sanitizeName } from './utils/avatarConfig';
import { clampCrop, cropFromDetection, defaultCrop, panCrop } from './utils/faceCrop';

describe('avatar config', () => {
  it('falls back to defaults for missing or corrupt data', () => {
    expect(normalizeAvatarConfig(null)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatarConfig('nope')).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatarConfig({ suit: 'gold', saber: 'pink', accent: 42 })).toEqual(DEFAULT_AVATAR);
  });

  it('keeps valid choices and drops unknown or duplicate accessories', () => {
    const config = normalizeAvatarConfig({ suit: 'purple', saber: 'red', accent: 'gold', accessories: ['cape', 'cape', 'laser-eyes', 'antenna'] });
    expect(config).toMatchObject({ suit: 'purple', saber: 'red', accent: 'gold', accessories: ['cape', 'antenna'] });
  });

  it('only accepts safe face ids', () => {
    expect(normalizeAvatarConfig({ faceId: 'face-abc_1' }).faceId).toBe('face-abc_1');
    expect(normalizeAvatarConfig({ faceId: 'data:image/png;base64,AAAA' }).faceId).toBeNull();
  });

  it('cleans names', () => {
    expect(sanitizeName('  Luke \n  Skywalker  ')).toBe('Luke Skywalker');
    expect(sanitizeName('   ')).toBe(DEFAULT_AVATAR.name);
    expect(sanitizeName('x'.repeat(40))).toHaveLength(NAME_MAX_LENGTH);
  });
});

describe('face crop', () => {
  it('widens and lifts a detector box to include hairline and cheeks', () => {
    const crop = cropFromDetection({ x: 100, y: 200, width: 200, height: 220 }, 800, 1000);
    expect(crop.cx).toBe(200);
    expect(crop.cy).toBeLessThan(310);
    expect(crop.width).toBeGreaterThan(220);
  });

  it('clamps the center onto the image and normalizes rotation', () => {
    const crop = clampCrop({ cx: -50, cy: 5000, width: 1, rotation: 370 }, 400, 600);
    expect(crop).toMatchObject({ cx: 0, cy: 600, rotation: 10 });
    expect(crop.width).toBeGreaterThan(1);
  });

  it('pans opposite to the drag, accounting for zoom and rotation', () => {
    const base = defaultCrop(400, 600);
    const moved = panCrop(base, 20, 0, 2);
    expect(moved.cx).toBeCloseTo(base.cx - 10);
    expect(moved.cy).toBeCloseTo(base.cy);
    const rotated = panCrop({ ...base, rotation: 90 }, 20, 0, 2);
    expect(rotated.cx).toBeCloseTo(base.cx);
    expect(rotated.cy).toBeCloseTo(base.cy - 10);
  });
});
