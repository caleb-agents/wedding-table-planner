import { beforeEach, describe, expect, it } from 'vitest';
import { loadFromStorage, saveToStorage, STORAGE_KEY, STORAGE_VERSION } from '../utils/storage';
import type { WeddingData } from '../types';

const legacyGuestName = 'Alexandria Moonflower-Longname the Fictional';

function legacyWedding(): WeddingData {
  return {
    id: 'wedding_legacy',
    name: 'Kept Wedding',
    weddingDate: '2027-01-23',
    guests: [
      {
        id: 'legacy_guest',
        name: legacyGuestName,
        side: 'bride',
        sheetBlock: 'Family block',
        isChild: false,
        rsvp: 'confirmed',
        tableId: 'legacy_table',
        familyGroup: 'Moonflower',
        cardSent: '2026-11-01',
        events: { reception: true },
      },
    ],
    tables: [
      { id: 'legacy_table', name: 'Table 1', capacity: 10, x: 120, y: 220, type: 'round' },
    ],
    assignments: [{ guestId: 'legacy_guest', tableId: 'legacy_table' }],
    isDemo: false,
    lastModified: 1700000000000,
  };
}

describe('saved seating migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps a versioned plan from the previous app in the same storage key', () => {
    const legacy = legacyWedding();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: legacy }));

    const loaded = loadFromStorage();

    expect(loaded.name).toBe('Kept Wedding');
    expect(loaded.isDemo).toBe(false);
    expect(loaded.guests).toHaveLength(1);
    expect(loaded.guests[0].name).toBe(legacyGuestName);
    expect(loaded.guests[0].tableId).toBe('legacy_table');
    expect(loaded.guests[0].side).toBe('bride');
    expect(loaded.guests[0].sheetBlock).toBe('Family block');
    expect(loaded.guests[0].familyGroup).toBe('Moonflower');
    expect(loaded.guests[0].cardSent).toBe('2026-11-01');
    expect(loaded.assignments).toEqual(legacy.assignments);
    expect(loaded.suggestedTables).toBeUndefined();
  });

  it('still reads an unwrapped wedding document and writes it back without moving guests', () => {
    const legacy = legacyWedding();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadFromStorage();
    expect(saveToStorage(loaded)).toBe(true);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw as string) as { version: number; data: WeddingData };

    expect(stored.version).toBe(1);
    expect(stored.data.guests[0].id).toBe('legacy_guest');
    expect(stored.data.guests[0].tableId).toBe('legacy_table');
    expect(stored.data.assignments).toEqual(legacy.assignments);
    expect(loadFromStorage().guests[0].name).toBe(legacyGuestName);
  });
});
