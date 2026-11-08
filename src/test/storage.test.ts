import { describe, it, expect, beforeEach } from 'vitest';
import { 
  saveToStorage, 
  loadFromStorage, 
  clearStorage,
  hasStoredData,
  exportToJSON,
  exportSeatingToCSV,
} from '../utils/storage';
import { createPublicWedding } from '../data/sampleData';
import type { WeddingData } from '../types';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  describe('saveToStorage / loadFromStorage', () => {
    it('saves and loads wedding data', () => {
      const data = createPublicWedding();
      data.name = 'Test Wedding';
      
      saveToStorage(data);
      const loaded = loadFromStorage();
      
      expect(loaded.name).toBe('Test Wedding');
      expect(loaded.guests.length).toBe(data.guests.length);
    });
    
    it('returns the public wedding list when nothing is stored', () => {
      const loaded = loadFromStorage();
      
      expect(loaded.isDemo).toBe(false);
      expect(loaded.name).toBe('Wedding group planner');
      expect(loaded.guests).toHaveLength(135);
      expect(loaded.guests[0]).toMatchObject({ id: 'g001', name: 'Jean Huang', tableId: null });
    });
    
    it('returns the public wedding list for invalid stored data', () => {
      localStorage.setItem('wedding_table_planner_data', 'invalid json');
      
      const loaded = loadFromStorage();
      
      expect(loaded.isDemo).toBe(false);
      expect(loaded.guests).toHaveLength(135);
      expect(loaded.guests[0].name).toBe('Jean Huang');
    });
  });
  
  describe('clearStorage / hasStoredData', () => {
    it('detects stored data', () => {
      expect(hasStoredData()).toBe(false);
      
      saveToStorage(createPublicWedding());
      
      expect(hasStoredData()).toBe(true);
    });
    
    it('clears stored data', () => {
      saveToStorage(createPublicWedding());
      clearStorage();
      
      expect(hasStoredData()).toBe(false);
    });
  });
  
  describe('exportToJSON', () => {
    it('exports valid JSON with metadata', () => {
      const data = createPublicWedding();
      const json = exportToJSON(data);
      const parsed = JSON.parse(json);
      
      expect(parsed.id).toBe(data.id);
      expect(parsed.guests).toHaveLength(data.guests.length);
      expect(parsed.exportedAt).toBeDefined();
    });
  });
  
  describe('exportSeatingToCSV', () => {
    it('exports CSV with headers', () => {
      const data = createPublicWedding();
      const csv = exportSeatingToCSV(data);
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('Group,Guest Name,Side,RSVP,Is Child,Family Group');
      expect(lines.length).toBeGreaterThan(1);
    });
    
    it('sorts by table then name', () => {
      const data: WeddingData = {
        id: 'test',
        name: 'Test',
        guests: [
          { id: 'g1', name: 'Zoe', side: 'bride', sheetBlock: 'A', isChild: false, rsvp: 'confirmed', tableId: 't1' },
          { id: 'g2', name: 'Alice', side: 'bride', sheetBlock: 'A', isChild: false, rsvp: 'confirmed', tableId: 't1' },
        ],
        tables: [
          { id: 't1', name: 'Table 1', capacity: 10, x: 0, y: 0, type: 'round' },
        ],
        assignments: [
          { guestId: 'g1', tableId: 't1' },
          { guestId: 'g2', tableId: 't1' },
        ],
        isDemo: false,
        lastModified: Date.now(),
      };
      
      const csv = exportSeatingToCSV(data);
      const lines = csv.split('\n');
      
      expect(lines[1]).toContain('Alice');
      expect(lines[2]).toContain('Zoe');
    });
    
    it('shows unassigned guests as "Unassigned"', () => {
      const data: WeddingData = {
        id: 'test',
        name: 'Test',
        guests: [
          { id: 'g1', name: 'Bob', side: 'groom', sheetBlock: 'A', isChild: false, rsvp: 'unknown', tableId: null },
        ],
        tables: [],
        assignments: [],
        isDemo: false,
        lastModified: Date.now(),
      };
      
      const csv = exportSeatingToCSV(data);
      
      expect(csv).toContain('Unassigned,Bob');
    });
  });
});
