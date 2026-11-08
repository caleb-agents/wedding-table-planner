import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWeddingState } from '../hooks/useWeddingState';
import { generateId } from '../utils/ids';

describe('useWeddingState', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('initializes with sample wedding data', () => {
    const { result } = renderHook(() => useWeddingState());
    
    expect(result.current.state.data.isDemo).toBe(true);
    expect(result.current.state.data.guests.length).toBeGreaterThan(0);
    expect(result.current.state.data.tables.length).toBeGreaterThan(0);
  });
  
  describe('ASSIGN_GUEST', () => {
    it('assigns a guest to a table', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const guestId = result.current.state.data.guests[0].id;
      const tableId = result.current.state.data.tables[0].id;
      
      act(() => {
        result.current.dispatch({ type: 'ASSIGN_GUEST', guestId, tableId });
      });
      
      const guest = result.current.state.data.guests.find(g => g.id === guestId);
      expect(guest?.tableId).toBe(tableId);
      expect(result.current.state.data.assignments).toContainEqual({ guestId, tableId });
    });
    
    it('prevents assignment to full table', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const table = result.current.state.data.tables.find(t => t.type === 'head')!;
      const availableGuests = result.current.state.data.guests.filter(g => g.tableId === null);
      
      act(() => {
        for (let i = 0; i < table.capacity; i++) {
          result.current.dispatch({ 
            type: 'ASSIGN_GUEST', 
            guestId: availableGuests[i].id, 
            tableId: table.id 
          });
        }
      });
      
      const extraGuest = availableGuests[table.capacity];
      const beforeAssignment = result.current.state.data.assignments.length;
      
      act(() => {
        result.current.dispatch({ 
          type: 'ASSIGN_GUEST', 
          guestId: extraGuest.id, 
          tableId: table.id 
        });
      });
      
      expect(result.current.state.data.assignments.length).toBe(beforeAssignment);
      expect(extraGuest.tableId).toBeNull();
    });
    
    it('moves guest from one table to another', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const guestId = result.current.state.data.guests[0].id;
      const table1 = result.current.state.data.tables[0].id;
      const table2 = result.current.state.data.tables[1].id;
      
      act(() => {
        result.current.dispatch({ type: 'ASSIGN_GUEST', guestId, tableId: table1 });
      });
      
      act(() => {
        result.current.dispatch({ type: 'ASSIGN_GUEST', guestId, tableId: table2 });
      });
      
      const guest = result.current.state.data.guests.find(g => g.id === guestId);
      expect(guest?.tableId).toBe(table2);
      
      const assignmentsForGuest = result.current.state.data.assignments.filter(a => a.guestId === guestId);
      expect(assignmentsForGuest.length).toBe(1);
      expect(assignmentsForGuest[0].tableId).toBe(table2);
    });
  });
  
  describe('UNASSIGN_GUEST', () => {
    it('removes guest from table', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const guestId = result.current.state.data.guests[0].id;
      const tableId = result.current.state.data.tables[0].id;
      
      act(() => {
        result.current.dispatch({ type: 'ASSIGN_GUEST', guestId, tableId });
      });
      
      act(() => {
        result.current.dispatch({ type: 'UNASSIGN_GUEST', guestId });
      });
      
      const guest = result.current.state.data.guests.find(g => g.id === guestId);
      expect(guest?.tableId).toBeNull();
      expect(result.current.state.data.assignments.find(a => a.guestId === guestId)).toBeUndefined();
    });
  });
  
  describe('ASSIGN_GROUP', () => {
    it('assigns entire family group to table', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const familyGroups = result.current.getFamilyGroups();
      const [groupId, members] = [...familyGroups.entries()][0];
      const tableId = result.current.state.data.tables[0].id;
      
      act(() => {
        result.current.dispatch({ type: 'ASSIGN_GROUP', groupId, tableId });
      });
      
      for (const member of members) {
        const guest = result.current.state.data.guests.find(g => g.id === member.id);
        expect(guest?.tableId).toBe(tableId);
      }
    });
  });
  
  describe('UNDO/REDO', () => {
    it('undoes guest assignment', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const guestId = result.current.state.data.guests[0].id;
      const tableId = result.current.state.data.tables[0].id;
      
      act(() => {
        result.current.dispatch({ type: 'ASSIGN_GUEST', guestId, tableId });
      });
      
      expect(result.current.state.undoStack.length).toBe(1);
      
      act(() => {
        result.current.dispatch({ type: 'UNDO' });
      });
      
      const guest = result.current.state.data.guests.find(g => g.id === guestId);
      expect(guest?.tableId).toBeNull();
      expect(result.current.state.redoStack.length).toBe(1);
    });
    
    it('redoes undone action', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const guestId = result.current.state.data.guests[0].id;
      const tableId = result.current.state.data.tables[0].id;
      
      act(() => {
        result.current.dispatch({ type: 'ASSIGN_GUEST', guestId, tableId });
      });
      
      act(() => {
        result.current.dispatch({ type: 'UNDO' });
      });
      
      act(() => {
        result.current.dispatch({ type: 'REDO' });
      });
      
      const guest = result.current.state.data.guests.find(g => g.id === guestId);
      expect(guest?.tableId).toBe(tableId);
    });
  });
  
  describe('table management', () => {
    it('adds a new table', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const initialCount = result.current.state.data.tables.length;
      const newTable = {
        id: generateId('table'),
        name: 'New Table',
        capacity: 8,
        x: 200,
        y: 200,
        type: 'round' as const,
      };
      
      act(() => {
        result.current.dispatch({ type: 'ADD_TABLE', table: newTable });
      });
      
      expect(result.current.state.data.tables.length).toBe(initialCount + 1);
      expect(result.current.state.data.tables.find(t => t.id === newTable.id)).toBeDefined();
    });
    
    it('removes table and unseats its guests', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const guestId = result.current.state.data.guests[0].id;
      const tableId = result.current.state.data.tables[0].id;
      
      act(() => {
        result.current.dispatch({ type: 'ASSIGN_GUEST', guestId, tableId });
      });
      
      act(() => {
        result.current.dispatch({ type: 'REMOVE_TABLE', tableId });
      });
      
      const guest = result.current.state.data.guests.find(g => g.id === guestId);
      expect(guest?.tableId).toBeNull();
      expect(result.current.state.data.tables.find(t => t.id === tableId)).toBeUndefined();
    });
    
    it('updates table properties', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const tableId = result.current.state.data.tables[0].id;
      
      act(() => {
        result.current.dispatch({
          type: 'UPDATE_TABLE',
          tableId,
          updates: { name: 'VIP Table', capacity: 12 },
        });
      });
      
      const table = result.current.state.data.tables.find(t => t.id === tableId);
      expect(table?.name).toBe('VIP Table');
      expect(table?.capacity).toBe(12);
    });
  });
  
  describe('statistics', () => {
    it('calculates correct statistics', () => {
      const { result } = renderHook(() => useWeddingState());
      
      const { statistics } = result.current;
      
      expect(statistics.totalGuests).toBe(result.current.state.data.guests.length);
      expect(statistics.unseatedGuests).toBe(statistics.totalGuests - statistics.seatedGuests);
      expect(statistics.confirmedGuests + statistics.unconfirmedGuests + statistics.unknownGuests)
        .toBe(statistics.totalGuests);
    });
  });
  
  describe('filtering', () => {
    it('filters guests by RSVP status', () => {
      const { result } = renderHook(() => useWeddingState());
      
      act(() => {
        result.current.dispatch({ type: 'SET_FILTER_RSVP', filter: 'confirmed' });
      });
      
      const filtered = result.current.filteredUnseatedGuests;
      expect(filtered.every(g => g.rsvp === 'confirmed')).toBe(true);
    });
    
    it('filters guests by search query', () => {
      const { result } = renderHook(() => useWeddingState());
      
      act(() => {
        result.current.dispatch({ type: 'SET_SEARCH_QUERY', query: 'Star' });
      });
      
      const filtered = result.current.filteredUnseatedGuests;
      expect(filtered.every(g => 
        g.name.toLowerCase().includes('star') || 
        g.familyGroup?.toLowerCase().includes('star')
      )).toBe(true);
    });
  });
});
