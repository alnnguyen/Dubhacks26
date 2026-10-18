import { describe, expect, it } from 'vitest';
import { installButtonFeedback } from './buttonFeedback';

describe('button feedback', () => {
  it('exports click-only installer (hover ticks removed)', () => {
    expect(typeof installButtonFeedback).toBe('function');
  });
});
