import type { Table } from '../types';

export function compareTables(a: Table, b: Table): number {
  if (a.type === 'head' && b.type !== 'head') return -1;
  if (b.type === 'head' && a.type !== 'head') return 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortedTables(tables: Table[]): Table[] {
  return [...tables].sort(compareTables);
}
