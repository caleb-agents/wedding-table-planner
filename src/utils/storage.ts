import type { WeddingData } from '../types';
import { validateWeddingData } from './validation';
import { createSampleWedding } from '../data/sampleData';
import { adaptLegacyPlan } from './groups';

export const STORAGE_KEY = 'wedding_table_planner_data';
export const STORAGE_VERSION = 1;

interface StorageWrapper {
  version: number;
  data: WeddingData;
}

export function saveToStorage(data: WeddingData): boolean {
  try {
    const wrapper: StorageWrapper = {
      version: STORAGE_VERSION,
      data: {
        ...data,
        lastModified: Date.now(),
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapper));
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    return false;
  }
}

export function loadFromStorage(): WeddingData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createSampleWedding();
    }
    
    const parsed = JSON.parse(raw);
    
    if (parsed && typeof parsed === 'object' && 'version' in parsed && 'data' in parsed) {
      if (validateWeddingData(parsed.data)) {
        return adaptLegacyPlan(parsed.data);
      }
    }
    
    if (validateWeddingData(parsed)) {
      return adaptLegacyPlan(parsed);
    }
    
    console.warn('Invalid data in localStorage, returning sample');
    return createSampleWedding();
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return createSampleWedding();
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear localStorage:', e);
  }
}

export function hasStoredData(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function exportToJSON(data: WeddingData): string {
  const exportData = {
    ...data,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(exportData, null, 2);
}

export function exportSeatingToCSV(data: WeddingData): string {
  const lines: string[] = ['Group,Guest Name,Side,RSVP,Is Child,Family Group'];
  
  const tableMap = new Map(data.tables.map(t => [t.id, t.name]));
  
  const sortedGuests = [...data.guests].sort((a, b) => {
    const tableA = a.tableId ? tableMap.get(a.tableId) || 'ZZZ' : 'ZZZ';
    const tableB = b.tableId ? tableMap.get(b.tableId) || 'ZZZ' : 'ZZZ';
    if (tableA !== tableB) return tableA.localeCompare(tableB);
    return a.name.localeCompare(b.name);
  });
  
  for (const guest of sortedGuests) {
    const tableName = guest.tableId ? tableMap.get(guest.tableId) || 'Unknown' : 'Unassigned';
    const row = [
      escapeCSV(tableName),
      escapeCSV(guest.name),
      escapeCSV(guest.side),
      escapeCSV(guest.rsvp),
      guest.isChild ? 'Yes' : 'No',
      escapeCSV(guest.familyGroup || ''),
    ];
    lines.push(row.join(','));
  }
  
  return lines.join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
