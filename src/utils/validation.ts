import type { Guest, Table, WeddingData, ImportedData, ImportedGuest } from '../types';
import { generateId, isValidId } from './ids';
import { adaptLegacyPlan, createDefaultGroups } from './groups';

export function validateGuest(guest: unknown): guest is Guest {
  if (!guest || typeof guest !== 'object') return false;
  const g = guest as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    g.id.length > 0 &&
    typeof g.name === 'string' &&
    g.name.trim().length > 0 &&
    typeof g.side === 'string' &&
    typeof g.sheetBlock === 'string' &&
    typeof g.isChild === 'boolean' &&
    ['confirmed', 'unconfirmed', 'unknown'].includes(g.rsvp as string)
  );
}

export function validateTable(table: unknown): table is Table {
  if (!table || typeof table !== 'object') return false;
  const t = table as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    isValidId(t.id) &&
    typeof t.name === 'string' &&
    typeof t.capacity === 'number' &&
    t.capacity > 0 &&
    t.capacity <= 30 &&
    typeof t.x === 'number' &&
    typeof t.y === 'number' &&
    ['round', 'rectangular', 'head'].includes(t.type as string)
  );
}

export function validateWeddingData(data: unknown): data is WeddingData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  
  if (typeof d.id !== 'string' || typeof d.name !== 'string') return false;
  if (!Array.isArray(d.guests) || !Array.isArray(d.tables) || !Array.isArray(d.assignments)) return false;
  
  const guestIds = new Set<string>();
  for (const guest of d.guests) {
    if (!validateGuest(guest)) return false;
    if (guestIds.has(guest.id)) return false;
    guestIds.add(guest.id);
  }
  
  const tableIds = new Set<string>();
  for (const table of d.tables) {
    if (!validateTable(table)) return false;
    if (tableIds.has(table.id)) return false;
    tableIds.add(table.id);
  }
  
  for (const assignment of d.assignments as Array<{ guestId: string; tableId: string }>) {
    if (!guestIds.has(assignment.guestId) || !tableIds.has(assignment.tableId)) {
      return false;
    }
  }
  
  return true;
}

export function validateImportedData(data: unknown): data is ImportedData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  
  if (!d.source || typeof d.source !== 'object') return false;
  const source = d.source as Record<string, unknown>;
  if (typeof source.fileId !== 'string' || typeof source.name !== 'string' || typeof source.tab !== 'string') {
    return false;
  }
  
  if (typeof d.weddingDate !== 'string') return false;
  if (!Array.isArray(d.tables)) return false;
  if (!Array.isArray(d.guests)) return false;
  
  const guestIds = new Set<string>();
  for (const guest of d.guests as unknown[]) {
    if (!validateImportedGuest(guest)) return false;
    const g = guest as ImportedGuest;
    if (guestIds.has(g.id)) return false;
    guestIds.add(g.id);
  }
  
  return true;
}

function validateImportedGuest(guest: unknown): guest is ImportedGuest {
  if (!guest || typeof guest !== 'object') return false;
  const g = guest as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    g.id.length > 0 &&
    typeof g.name === 'string' &&
    g.name.trim().length > 0 &&
    typeof g.side === 'string' &&
    typeof g.sheetBlock === 'string' &&
    typeof g.isChild === 'boolean' &&
    ['confirmed', 'unconfirmed', 'unknown'].includes(g.rsvp as string) &&
    (g.tableId === null || typeof g.tableId === 'string')
  );
}

export function createDefaultTables(): Table[] {
  return createDefaultGroups();
}

function normalizeImportedGuest(raw: ImportedGuest, tableIds: Set<string>): Guest {
  const tableId = raw.tableId && tableIds.has(raw.tableId) ? raw.tableId : null;
  const guest: Guest = {
    id: raw.id,
    name: raw.name.trim(),
    side: raw.side,
    sheetBlock: raw.sheetBlock,
    isChild: raw.isChild,
    rsvp: raw.rsvp,
    tableId,
  };

  if (typeof raw.familyGroup === 'string' && raw.familyGroup.trim()) {
    guest.familyGroup = raw.familyGroup.trim();
  }
  if (typeof raw.cardSent === 'string' && raw.cardSent.trim()) {
    guest.cardSent = raw.cardSent.trim();
  }
  if (raw.events && typeof raw.events === 'object' && !Array.isArray(raw.events)) {
    guest.events = raw.events;
  }

  return guest;
}

export function convertImportedData(imported: ImportedData): WeddingData {
  const providedTables = imported.tables.filter(validateTable);
  const tables = providedTables.length === 0 ? createDefaultGroups() : providedTables;
  const tableIds = new Set(tables.map(table => table.id));
  const guests = imported.guests.map(guest => normalizeImportedGuest(guest, tableIds));
  const assignments = guests
    .filter(guest => guest.tableId !== null)
    .map(guest => ({ guestId: guest.id, tableId: guest.tableId as string }));

  return adaptLegacyPlan({
    id: generateId('wedding'),
    name: imported.source.name.trim() || 'My Wedding',
    weddingDate: imported.weddingDate,
    guests,
    tables,
    assignments,
    isDemo: false,
    lastModified: Date.now(),
  });
}

export function parseCSV(csvText: string): ImportedData | null {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIndex = headers.findIndex(h => h === 'name' || h === 'guest' || h === 'guest name');
  if (nameIndex === -1) return null;
  
  const idIndex = headers.findIndex(h => h === 'id');
  const sideIndex = headers.findIndex(h => h === 'side');
  const sheetBlockIndex = headers.findIndex(h => h === 'sheetblock' || h === 'sheet_block' || h === 'block');
  const isChildIndex = headers.findIndex(h => h === 'ischild' || h === 'is_child' || h === 'child');
  const rsvpIndex = headers.findIndex(h => h === 'rsvp' || h === 'status');
  const familyGroupIndex = headers.findIndex(h => h === 'familygroup' || h === 'family_group' || h === 'family');
  
  const guests: ImportedGuest[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const name = values[nameIndex]?.trim();
    if (!name) continue;
    
    const id = idIndex >= 0 && values[idIndex] ? values[idIndex] : generateId('guest');
    const side = sideIndex >= 0 ? values[sideIndex] || '' : '';
    const sheetBlock = sheetBlockIndex >= 0 ? values[sheetBlockIndex] || '' : '';
    const isChildVal = isChildIndex >= 0 ? values[isChildIndex]?.toLowerCase() : '';
    const isChild = isChildVal === 'true' || isChildVal === 'yes' || isChildVal === '1';
    const rsvpVal = rsvpIndex >= 0 ? values[rsvpIndex]?.toLowerCase() : '';
    const rsvp = rsvpVal === 'confirmed' ? 'confirmed' : rsvpVal === 'unconfirmed' ? 'unconfirmed' : 'unknown';
    const familyGroup = familyGroupIndex >= 0 ? values[familyGroupIndex] : undefined;
    
    guests.push({
      id,
      name,
      side,
      sheetBlock,
      isChild,
      rsvp,
      tableId: null,
      familyGroup: familyGroup || undefined,
    });
  }
  
  return {
    source: { fileId: 'csv-import', name: 'CSV Import', tab: 'Sheet1' },
    weddingDate: '',
    tables: [],
    guests,
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}
