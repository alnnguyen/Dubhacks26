import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPilotIdentity,
  loadPilotIdentity,
  sanitizeCallsign,
  sanitizeShipName,
  savePilotIdentity,
} from './pilotIdentity';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
});

afterEach(() => clearPilotIdentity());

describe('pilotIdentity', () => {
  it('sanitizes callsign and ship name', () => {
    expect(sanitizeCallsign('  star hawk!! ')).toBe('STARHAWK');
    expect(sanitizeShipName('  Red   Comet  ')).toBe('Red Comet');
  });

  it('round-trips local storage', () => {
    const saved = savePilotIdentity({
      callsign: 'nova-7',
      shipName: '  Quiet Lance ',
      accent: 'violet',
    });
    expect(saved).toEqual({ callsign: 'NOVA-7', shipName: 'Quiet Lance', accent: 'violet' });
    expect(loadPilotIdentity()).toEqual(saved);
  });

  it('returns null when empty', () => {
    expect(loadPilotIdentity()).toBeNull();
  });
});
