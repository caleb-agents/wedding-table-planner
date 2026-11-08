import type { Guest, Table, WeddingData } from '../types';
import { generateId } from './ids';

export const GROUP_CAPACITY = 10;
export const DEFAULT_GROUP_COUNT = 14;

const GENERIC_TABLE_NAME = /^table\s+(\d+)$/i;
const HEAD_TABLE_NAME = /^head table$/i;

export function createDefaultGroups(): Table[] {
  return Array.from({ length: DEFAULT_GROUP_COUNT }, (_, index) => ({
    id: generateId('group'),
    name: `Group ${index + 1}`,
    capacity: GROUP_CAPACITY,
    x: 0,
    y: 0,
    type: 'round' as const,
  }));
}

export function nextGroupName(tables: Table[]): string {
  let max = 0;
  for (const table of tables) {
    const match = /^group\s+(\d+)$/i.exec(table.name.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `Group ${Math.max(max, tables.length) + 1}`;
}

export function sortedGroups(tables: Table[]): Table[] {
  return [...tables].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

export function guestsInGroup(guests: Guest[], groupId: string): Guest[] {
  return guests
    .filter(guest => guest.tableId === groupId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function groupCount(guests: Guest[], groupId: string): number {
  return guests.reduce((count, guest) => count + (guest.tableId === groupId ? 1 : 0), 0);
}

export function isGroupFull(count: number): boolean {
  return count >= GROUP_CAPACITY;
}

export function isGroupOverCapacity(count: number): boolean {
  return count > GROUP_CAPACITY;
}

export function shouldConfirmReplace(data: WeddingData): boolean {
  if (data.isDemo) return false;
  return data.assignments.length > 0 || data.guests.some(guest => guest.tableId !== null);
}

function isEmptyHead(table: Table, occupied: number): boolean {
  return occupied === 0 && (table.type === 'head' || HEAD_TABLE_NAME.test(table.name.trim()));
}

function groupName(table: Table): string {
  const generic = GENERIC_TABLE_NAME.exec(table.name.trim());
  if (generic) return `Group ${generic[1]}`;
  if (HEAD_TABLE_NAME.test(table.name.trim())) return 'Head table';
  return table.name.trim() || 'Group';
}

/**
 * Keep every saved guest and assignment. Old tables become groups of 10.
 * An empty head table is dropped. A table with more than 10 people keeps them.
 */
export function adaptLegacyPlan(data: WeddingData): WeddingData {
  const occupied = new Map<string, number>();
  for (const guest of data.guests) {
    if (!guest.tableId) continue;
    occupied.set(guest.tableId, (occupied.get(guest.tableId) ?? 0) + 1);
  }

  const tables = data.tables
    .filter(table => !isEmptyHead(table, occupied.get(table.id) ?? 0))
    .map(table => ({
      ...table,
      name: groupName(table),
      capacity: GROUP_CAPACITY,
      type: 'round' as const,
    }));

  const tableIds = new Set(tables.map(table => table.id));
  const guests = data.guests.map(guest => {
    if (guest.tableId && !tableIds.has(guest.tableId)) {
      return { ...guest, tableId: null };
    }
    return guest;
  });
  const assignments = guests
    .filter(guest => guest.tableId !== null)
    .map(guest => ({ guestId: guest.id, tableId: guest.tableId as string }));

  return {
    ...data,
    guests,
    tables: tables.length > 0 ? tables : createDefaultGroups(),
    assignments,
    suggestedTables: data.suggestedTables ? false : data.suggestedTables,
  };
}
