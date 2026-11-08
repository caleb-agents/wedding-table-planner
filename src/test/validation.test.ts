import { describe, it, expect } from 'vitest';
import fixtureJson from './fixtures/sample-import.json';
import { 
  validateImportedData, 
  validateWeddingData, 
  convertImportedData,
  createDefaultTables,
  parseCSV,
} from '../utils/validation';
import type { ImportedData, ImportedGuest, WeddingData } from '../types';

describe('validateImportedData', () => {
  it('accepts valid imported data with exact schema', () => {
    const validData: ImportedData = {
      source: { fileId: 'abc123', name: 'Wedding List', tab: 'Sheet1' },
      weddingDate: '2027-01-23',
      tables: [],
      guests: [
        {
          id: 'guest_1',
          name: 'Luna Starweaver',
          side: 'bride',
          sheetBlock: 'Family',
          isChild: false,
          rsvp: 'confirmed',
          tableId: null,
          familyGroup: 'Starweaver',
        },
      ],
    };
    
    expect(validateImportedData(validData)).toBe(true);
  });
  
  it('accepts guests with all RSVP states', () => {
    const data: ImportedData = {
      source: { fileId: 'test', name: 'Test', tab: 'Sheet1' },
      weddingDate: '2027-01-23',
      tables: [],
      guests: [
        { id: 'g1', name: 'Guest 1', side: 'bride', sheetBlock: 'A', isChild: false, rsvp: 'confirmed', tableId: null },
        { id: 'g2', name: 'Guest 2', side: 'groom', sheetBlock: 'B', isChild: true, rsvp: 'unconfirmed', tableId: null },
        { id: 'g3', name: 'Guest 3', side: 'mutual', sheetBlock: 'C', isChild: false, rsvp: 'unknown', tableId: null },
      ],
    };
    
    expect(validateImportedData(data)).toBe(true);
  });
  
  it('rejects data without source', () => {
    const invalidData = {
      weddingDate: '2027-01-23',
      tables: [],
      guests: [],
    };
    
    expect(validateImportedData(invalidData)).toBe(false);
  });
  
  it('rejects duplicate guest IDs', () => {
    const data: ImportedData = {
      source: { fileId: 'test', name: 'Test', tab: 'Sheet1' },
      weddingDate: '2027-01-23',
      tables: [],
      guests: [
        { id: 'same_id', name: 'Guest 1', side: 'bride', sheetBlock: 'A', isChild: false, rsvp: 'confirmed', tableId: null },
        { id: 'same_id', name: 'Guest 2', side: 'groom', sheetBlock: 'B', isChild: false, rsvp: 'confirmed', tableId: null },
      ],
    };
    
    expect(validateImportedData(data)).toBe(false);
  });
  
  it('rejects invalid RSVP status', () => {
    const data = {
      source: { fileId: 'test', name: 'Test', tab: 'Sheet1' },
      weddingDate: '2027-01-23',
      tables: [],
      guests: [
        { id: 'g1', name: 'Guest 1', side: 'bride', sheetBlock: 'A', isChild: false, rsvp: 'maybe', tableId: null },
      ],
    };
    
    expect(validateImportedData(data)).toBe(false);
  });
});

describe('convertImportedData', () => {
  it('creates default tables when tables array is empty', () => {
    const imported: ImportedData = {
      source: { fileId: 'test', name: 'My Wedding', tab: 'Sheet1' },
      weddingDate: '2027-01-23',
      tables: [],
      guests: [
        { id: 'g1', name: 'Test Guest', side: 'bride', sheetBlock: 'Family', isChild: false, rsvp: 'confirmed', tableId: null },
      ],
    };
    
    const result = convertImportedData(imported);
    
    expect(result.tables.length).toBe(15); // 1 head + 14 round
    expect(result.tables[0].type).toBe('head');
    expect(result.tables[0].name).toBe('Head Table');
    expect(result.tables[1].capacity).toBe(10);
    expect(result.isDemo).toBe(false);
  });
  
  it('preserves guest metadata', () => {
    const imported: ImportedData = {
      source: { fileId: 'test', name: 'Wedding', tab: 'Sheet1' },
      weddingDate: '2027-01-23',
      tables: [],
      guests: [
        { 
          id: 'g1', 
          name: 'Luna Starweaver', 
          side: 'bride', 
          sheetBlock: 'Family', 
          isChild: false, 
          rsvp: 'confirmed', 
          tableId: null,
          familyGroup: 'Starweaver',
        },
        { 
          id: 'g2', 
          name: 'Nova Starweaver', 
          side: 'bride', 
          sheetBlock: 'Family', 
          isChild: true, 
          rsvp: 'confirmed', 
          tableId: null,
          familyGroup: 'Starweaver',
        },
      ],
    };
    
    const result = convertImportedData(imported);
    
    expect(result.guests[0].side).toBe('bride');
    expect(result.guests[0].sheetBlock).toBe('Family');
    expect(result.guests[0].familyGroup).toBe('Starweaver');
    expect(result.guests[1].isChild).toBe(true);
    expect(result.weddingDate).toBe('2027-01-23');
  });
});

describe('exact supplied guest schema', () => {
  const fixture = fixtureJson as ImportedData;

  it('accepts the fixture with no version wrapper and an empty tables array', () => {
    expect(fixture).not.toHaveProperty('version');
    expect(fixture.tables).toEqual([]);
    expect(validateImportedData(fixture)).toBe(true);
  });

  it('keeps every guest, preserves metadata, and seats nobody', () => {
    const wedding = convertImportedData(fixture);

    expect(wedding.isDemo).toBe(false);
    expect(wedding.suggestedTables).toBe(true);
    expect(wedding.name).toBe('Fictional Garden Wedding');
    expect(wedding.weddingDate).toBe('2027-01-23');
    expect(wedding.guests).toHaveLength(fixture.guests.length);
    expect(wedding.assignments).toEqual([]);
    expect(wedding.guests.every(guest => guest.tableId === null)).toBe(true);

    const pixel = wedding.guests.find(guest => guest.id === 'fix_b1');
    expect(pixel?.familyGroup).toBe('Starlight');
    expect(pixel?.sheetBlock).toBe('Family block');
    expect(pixel?.cardSent).toBe('2026-11-02');
    expect(pixel?.events).toEqual({ ceremony: true, reception: true });
    expect(pixel?.side).toBe('bride');

    const child = wedding.guests.find(guest => guest.id === 'fix_b2');
    expect(child?.isChild).toBe(true);

    const sameSheetBlock = wedding.guests.filter(guest => guest.sheetBlock === 'Family block');
    const explicitFamilies = sameSheetBlock.filter(guest => guest.familyGroup);
    expect(sameSheetBlock.length).toBeGreaterThan(explicitFamilies.length);
  });

  it('offers 14 editable tables of 10 plus a head table when tables is empty', () => {
    const wedding = convertImportedData(fixture);
    const rounds = wedding.tables.filter(table => table.type === 'round');
    const head = wedding.tables.find(table => table.type === 'head');

    expect(rounds).toHaveLength(14);
    expect(rounds.every(table => table.capacity === 10)).toBe(true);
    expect(head?.name).toBe('Head Table');
    expect(head?.capacity).toBe(12);
    expect(new Set(wedding.tables.map(table => table.id)).size).toBe(15);
  });

  it('keeps a 135-guest list with five sides and the known RSVP split, without inferring groups', () => {
    const sides = ['bride', 'groom', 'mutual', 'colleagues', 'neighbours'];
    const guests: ImportedGuest[] = [];

    for (let index = 0; index < 135; index += 1) {
      const rsvp = index < 37 ? 'confirmed' : index < 65 ? 'unconfirmed' : 'unknown';
      const guest: ImportedGuest = {
        id: `shape_${index}`,
        name: `Fictional Guest ${index + 1}`,
        side: sides[index % sides.length],
        sheetBlock: `Block ${index % 9}`,
        isChild: index % 17 === 0,
        rsvp,
        tableId: null,
      };
      if (index < 6) guest.familyGroup = index < 3 ? 'Explicit Family A' : 'Explicit Family B';
      if (index % 11 === 0) guest.cardSent = '2026-10-01';
      if (index % 13 === 0) guest.events = { reception: true };
      guests.push(guest);
    }

    const imported: ImportedData = {
      source: { fileId: 'private-local-file', name: 'Shape Check', tab: 'Guests' },
      weddingDate: '2027-01-23',
      tables: [],
      guests,
    };

    expect(validateImportedData(imported)).toBe(true);
    const wedding = convertImportedData(imported);
    const grouped = wedding.guests.filter(guest => guest.familyGroup);

    expect(wedding.guests).toHaveLength(135);
    expect(wedding.assignments).toHaveLength(0);
    expect(wedding.guests.filter(guest => guest.rsvp === 'confirmed')).toHaveLength(37);
    expect(wedding.guests.filter(guest => guest.rsvp === 'unconfirmed')).toHaveLength(28);
    expect(wedding.guests.filter(guest => guest.rsvp === 'unknown')).toHaveLength(70);
    expect(new Set(wedding.guests.map(guest => guest.side)).size).toBe(5);
    expect(grouped).toHaveLength(6);
    expect(wedding.guests.filter(guest => guest.sheetBlock === 'Block 0' && guest.familyGroup)).toHaveLength(
      guests.filter(guest => guest.sheetBlock === 'Block 0' && guest.familyGroup).length,
    );
    expect(validateWeddingData(wedding)).toBe(true);
  });

  it('drops a table id that does not exist instead of inventing a seat', () => {
    const imported: ImportedData = {
      source: { fileId: 'x', name: 'Orphan Seat', tab: 'Guests' },
      weddingDate: '2027-01-23',
      tables: [],
      guests: [
        {
          id: 'orphan',
          name: 'Orphan Guest',
          side: 'bride',
          sheetBlock: 'Block',
          isChild: false,
          rsvp: 'confirmed',
          tableId: 'missing-table',
        },
      ],
    };

    const wedding = convertImportedData(imported);
    expect(wedding.guests[0].tableId).toBeNull();
    expect(wedding.assignments).toEqual([]);
    expect(validateWeddingData(wedding)).toBe(true);
  });
});

describe('createDefaultTables', () => {
  it('creates 15 tables with correct layout', () => {
    const tables = createDefaultTables();
    
    expect(tables.length).toBe(15);
    expect(tables[0].type).toBe('head');
    expect(tables[0].capacity).toBe(12);
    expect(tables.filter(t => t.type === 'round').length).toBe(14);
  });
  
  it('creates tables with unique IDs', () => {
    const tables = createDefaultTables();
    const ids = new Set(tables.map(t => t.id));
    
    expect(ids.size).toBe(tables.length);
  });
});

describe('parseCSV', () => {
  it('parses basic CSV with name column', () => {
    const csv = `name,side,rsvp
Luna Starweaver,bride,confirmed
Atlas Ironforge,groom,unconfirmed`;
    
    const result = parseCSV(csv);
    
    expect(result).not.toBeNull();
    expect(result!.guests.length).toBe(2);
    expect(result!.guests[0].name).toBe('Luna Starweaver');
    expect(result!.guests[0].rsvp).toBe('confirmed');
    expect(result!.guests[1].rsvp).toBe('unconfirmed');
  });
  
  it('handles quoted fields with commas', () => {
    const csv = `name,notes
"Smith, John",Has dietary needs`;
    
    const result = parseCSV(csv);
    
    expect(result).not.toBeNull();
    expect(result!.guests[0].name).toBe('Smith, John');
  });
  
  it('returns null for CSV without name column', () => {
    const csv = `id,side
1,bride`;
    
    expect(parseCSV(csv)).toBeNull();
  });
});

describe('validateWeddingData', () => {
  it('validates complete wedding data structure', () => {
    const data: WeddingData = {
      id: 'wedding_123',
      name: 'Test Wedding',
      weddingDate: '2027-01-23',
      guests: [
        { id: 'g1', name: 'Guest 1', side: 'bride', sheetBlock: 'A', isChild: false, rsvp: 'confirmed', tableId: 't1' },
      ],
      tables: [
        { id: 't1', name: 'Table 1', capacity: 10, x: 100, y: 100, type: 'round' },
      ],
      assignments: [
        { guestId: 'g1', tableId: 't1' },
      ],
      isDemo: false,
      lastModified: Date.now(),
    };
    
    expect(validateWeddingData(data)).toBe(true);
  });
  
  it('rejects assignments to non-existent tables', () => {
    const data: WeddingData = {
      id: 'wedding_123',
      name: 'Test Wedding',
      guests: [
        { id: 'g1', name: 'Guest 1', side: 'bride', sheetBlock: 'A', isChild: false, rsvp: 'confirmed', tableId: null },
      ],
      tables: [],
      assignments: [
        { guestId: 'g1', tableId: 'nonexistent' },
      ],
      isDemo: false,
      lastModified: Date.now(),
    };
    
    expect(validateWeddingData(data)).toBe(false);
  });
});
