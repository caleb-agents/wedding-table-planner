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
    expect(loaded.tables[0].name).toBe('Group 1');
    expect(loaded.tables[0].capacity).toBe(10);
    expect(loaded.suggestedTables).toBeUndefined();
  });

  it('keeps every person when a saved table has more than 10 and blocks only by leaving capacity at 10', () => {
    const guests = Array.from({ length: 11 }, (_, index) => ({
      id: `legacy_${index}`,
      name: `Fictional Overflow ${index + 1}`,
      side: 'bride',
      sheetBlock: 'Block',
      isChild: false,
      rsvp: 'confirmed' as const,
      tableId: 'packed',
    }));
    const legacy: WeddingData = {
      id: 'wedding_packed',
      name: 'Packed',
      guests,
      tables: [{ id: 'packed', name: 'Head Table', capacity: 12, x: 0, y: 0, type: 'head' }],
      assignments: guests.map(guest => ({ guestId: guest.id, tableId: 'packed' })),
      isDemo: false,
      lastModified: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: legacy }));

    const loaded = loadFromStorage();

    expect(loaded.guests).toHaveLength(11);
    expect(loaded.guests.every(guest => guest.tableId === 'packed')).toBe(true);
    expect(loaded.tables).toHaveLength(1);
    expect(loaded.tables[0].capacity).toBe(10);
    expect(loaded.tables[0].name).toBe('Head table');
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

  it('drops an empty head table and renames Table 1-14 without touching guest names', () => {
    const legacy: WeddingData = {
      id: 'imported',
      name: 'Fictional Garden Wedding',
      weddingDate: '2027-01-23',
      guests: [
        {
          id: 'imported_guest',
          name: 'Imported Fictional Guest',
          side: 'neighbours',
          sheetBlock: 'Block 3',
          isChild: false,
          rsvp: 'unknown',
          tableId: null,
          familyGroup: 'Explicit Family A',
        },
      ],
      tables: [
        { id: 'head', name: 'Head Table', capacity: 12, x: 0, y: 0, type: 'head' },
        ...Array.from({ length: 14 }, (_, index) => ({
          id: `t${index + 1}`,
          name: `Table ${index + 1}`,
          capacity: 10,
          x: 0,
          y: 0,
          type: 'round' as const,
        })),
      ],
      assignments: [],
      isDemo: false,
      suggestedTables: true,
      lastModified: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: legacy }));

    const loaded = loadFromStorage();

    expect(loaded.guests[0].name).toBe('Imported Fictional Guest');
    expect(loaded.guests[0].tableId).toBeNull();
    expect(loaded.guests[0].familyGroup).toBe('Explicit Family A');
    expect(loaded.tables.map(table => table.name)).toEqual(Array.from({ length: 14 }, (_, index) => `Group ${index + 1}`));
    expect(loaded.tables.some(table => table.type === 'head')).toBe(false);
    expect(loaded.suggestedTables).toBe(false);
  });
});
