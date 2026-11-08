import { useReducer, useEffect, useCallback, useMemo } from 'react';
import type { WeddingData, AppState, ActionType, Guest } from '../types';
import { saveToStorage, loadFromStorage } from '../utils/storage';
import { createSampleWedding } from '../data/sampleData';

const MAX_UNDO_STACK = 50;

function cloneData(data: WeddingData): WeddingData {
  return JSON.parse(JSON.stringify(data));
}

function reducer(state: AppState, action: ActionType): AppState {
  switch (action.type) {
    case 'ASSIGN_GUEST': {
      const { guestId, tableId } = action;
      const table = state.data.tables.find(t => t.id === tableId);
      if (!table) return state;
      
      const currentAssignments = state.data.assignments.filter(a => a.tableId === tableId);
      if (currentAssignments.length >= table.capacity) {
        return state;
      }
      
      const newData = cloneData(state.data);
      newData.assignments = newData.assignments.filter(a => a.guestId !== guestId);
      newData.assignments.push({ guestId, tableId });
      
      const guest = newData.guests.find(g => g.id === guestId);
      if (guest) guest.tableId = tableId;
      
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
        selectedGuestId: null,
      };
    }
    
    case 'UNASSIGN_GUEST': {
      const { guestId } = action;
      const newData = cloneData(state.data);
      newData.assignments = newData.assignments.filter(a => a.guestId !== guestId);
      
      const guest = newData.guests.find(g => g.id === guestId);
      if (guest) guest.tableId = null;
      
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
      };
    }
    
    case 'ASSIGN_GROUP': {
      const { groupId, tableId } = action;
      const table = state.data.tables.find(t => t.id === tableId);
      if (!table) return state;
      
      const groupMembers = state.data.guests.filter(g => g.familyGroup === groupId);
      if (groupMembers.length === 0) return state;
      
      const currentAssignments = state.data.assignments.filter(a => a.tableId === tableId);
      const nonGroupAtTable = currentAssignments.filter(a => 
        !groupMembers.some(m => m.id === a.guestId)
      );
      
      if (nonGroupAtTable.length + groupMembers.length > table.capacity) {
        return state;
      }
      
      const newData = cloneData(state.data);
      
      for (const member of groupMembers) {
        newData.assignments = newData.assignments.filter(a => a.guestId !== member.id);
        newData.assignments.push({ guestId: member.id, tableId });
        const guest = newData.guests.find(g => g.id === member.id);
        if (guest) guest.tableId = tableId;
      }
      
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
        selectedGuestId: null,
      };
    }
    
    case 'ADD_TABLE': {
      const newData = cloneData(state.data);
      newData.tables.push(action.table);
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
      };
    }
    
    case 'REMOVE_TABLE': {
      const newData = cloneData(state.data);
      newData.tables = newData.tables.filter(t => t.id !== action.tableId);
      
      const affectedGuests = newData.guests.filter(g => g.tableId === action.tableId);
      for (const guest of affectedGuests) {
        guest.tableId = null;
      }
      newData.assignments = newData.assignments.filter(a => a.tableId !== action.tableId);
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
        selectedTableId: null,
      };
    }
    
    case 'UPDATE_TABLE': {
      const newData = cloneData(state.data);
      const table = newData.tables.find(t => t.id === action.tableId);
      if (table) {
        Object.assign(table, action.updates);
      }
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
      };
    }
    
    case 'ADD_GUEST': {
      const newData = cloneData(state.data);
      newData.guests.push(action.guest);
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
      };
    }
    
    case 'REMOVE_GUEST': {
      const newData = cloneData(state.data);
      newData.guests = newData.guests.filter(g => g.id !== action.guestId);
      newData.assignments = newData.assignments.filter(a => a.guestId !== action.guestId);
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
        selectedGuestId: null,
      };
    }
    
    case 'UPDATE_GUEST': {
      const newData = cloneData(state.data);
      const guest = newData.guests.find(g => g.id === action.guestId);
      if (guest) {
        Object.assign(guest, action.updates);
      }
      newData.lastModified = Date.now();
      
      return {
        ...state,
        data: newData,
        undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), state.data],
        redoStack: [],
      };
    }
    
    case 'IMPORT_DATA': {
      return {
        ...state,
        data: action.data,
        undoStack: [],
        redoStack: [],
        selectedGuestId: null,
        selectedTableId: null,
      };
    }
    
    case 'RESET_TO_DEMO': {
      return {
        ...state,
        data: createSampleWedding(),
        undoStack: [],
        redoStack: [],
        selectedGuestId: null,
        selectedTableId: null,
      };
    }
    
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const previous = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        data: previous,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.data],
      };
    }
    
    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        data: next,
        undoStack: [...state.undoStack, state.data],
        redoStack: state.redoStack.slice(0, -1),
      };
    }
    
    case 'SET_SELECTED_GUEST':
      return { ...state, selectedGuestId: action.guestId };
    
    case 'SET_SELECTED_TABLE':
      return { ...state, selectedTableId: action.tableId };
    
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
    
    case 'SET_FILTER_RSVP':
      return { ...state, filterRsvp: action.filter };
    
    case 'SET_FILTER_SIDE':
      return { ...state, filterSide: action.filter };
    
    case 'SET_SHOW_CHILDREN_ONLY':
      return { ...state, showChildrenOnly: action.show };

    case 'DISMISS_TABLE_SUGGESTION': {
      if (!state.data.suggestedTables) return state;
      return {
        ...state,
        data: { ...state.data, suggestedTables: false, lastModified: Date.now() },
      };
    }
    
    default:
      return state;
  }
}

function createInitialState(): AppState {
  return {
    data: loadFromStorage(),
    selectedGuestId: null,
    selectedTableId: null,
    searchQuery: '',
    filterRsvp: 'all',
    filterSide: 'all',
    showChildrenOnly: false,
    undoStack: [],
    redoStack: [],
  };
}

export function useWeddingState() {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);
  
  useEffect(() => {
    saveToStorage(state.data);
  }, [state.data]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const statistics = useMemo(() => {
    const { guests, tables, assignments } = state.data;
    const totalGuests = guests.length;
    const seatedGuests = assignments.length;
    const unseatedGuests = totalGuests - seatedGuests;
    const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
    const availableSeats = totalCapacity - seatedGuests;
    
    const confirmedGuests = guests.filter(g => g.rsvp === 'confirmed').length;
    const unconfirmedGuests = guests.filter(g => g.rsvp === 'unconfirmed').length;
    const unknownGuests = guests.filter(g => g.rsvp === 'unknown').length;
    const childGuests = guests.filter(g => g.isChild).length;
    
    const sides = [...new Set(guests.map(g => g.side).filter(Boolean))];
    
    return {
      totalGuests,
      seatedGuests,
      unseatedGuests,
      totalCapacity,
      availableSeats,
      confirmedGuests,
      unconfirmedGuests,
      unknownGuests,
      childGuests,
      sides,
    };
  }, [state.data]);
  
  const filteredUnseatedGuests = useMemo(() => {
    return state.data.guests.filter(guest => {
      if (guest.tableId !== null) return false;
      
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        if (!guest.name.toLowerCase().includes(query) &&
            !guest.familyGroup?.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      if (state.filterRsvp !== 'all' && guest.rsvp !== state.filterRsvp) {
        return false;
      }
      
      if (state.filterSide !== 'all' && guest.side !== state.filterSide) {
        return false;
      }
      
      if (state.showChildrenOnly && !guest.isChild) {
        return false;
      }
      
      return true;
    });
  }, [state.data.guests, state.searchQuery, state.filterRsvp, state.filterSide, state.showChildrenOnly]);
  
  const getGuestsAtTable = useCallback((tableId: string): Guest[] => {
    return state.data.guests.filter(g => g.tableId === tableId);
  }, [state.data.guests]);
  
  const getTableCapacityInfo = useCallback((tableId: string): { seated: number; capacity: number; isFull: boolean } => {
    const table = state.data.tables.find(t => t.id === tableId);
    if (!table) return { seated: 0, capacity: 0, isFull: true };
    const seated = state.data.guests.filter(g => g.tableId === tableId).length;
    return {
      seated,
      capacity: table.capacity,
      isFull: seated >= table.capacity,
    };
  }, [state.data.tables, state.data.guests]);
  
  const canAssignGuest = useCallback((guestId: string, tableId: string): boolean => {
    const info = getTableCapacityInfo(tableId);
    const guest = state.data.guests.find(g => g.id === guestId);
    if (!guest) return false;
    if (guest.tableId === tableId) return true;
    return !info.isFull;
  }, [state.data.guests, getTableCapacityInfo]);

  const canAssignGroup = useCallback((groupId: string, tableId: string): boolean => {
    const table = state.data.tables.find(t => t.id === tableId);
    if (!table || !groupId) return false;
    const members = state.data.guests.filter(g => g.familyGroup === groupId);
    if (members.length === 0) return false;
    const memberIds = new Set(members.map(member => member.id));
    const othersAtTable = state.data.guests.filter(g => g.tableId === tableId && !memberIds.has(g.id)).length;
    return othersAtTable + members.length <= table.capacity;
  }, [state.data.guests, state.data.tables]);
  
  const getFamilyGroups = useCallback((): Map<string, Guest[]> => {
    const groups = new Map<string, Guest[]>();
    for (const guest of state.data.guests) {
      if (guest.familyGroup) {
        const existing = groups.get(guest.familyGroup) || [];
        existing.push(guest);
        groups.set(guest.familyGroup, existing);
      }
    }
    return groups;
  }, [state.data.guests]);
  
  return {
    state,
    dispatch,
    statistics,
    filteredUnseatedGuests,
    getGuestsAtTable,
    getTableCapacityInfo,
    canAssignGuest,
    canAssignGroup,
    getFamilyGroups,
  };
}

export type WeddingStateReturn = ReturnType<typeof useWeddingState>;
