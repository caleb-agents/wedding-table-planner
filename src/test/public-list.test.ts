import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import publicGuests from '../data/public-guests.json';
import { createPublicWedding } from '../data/sampleData';
import { loadFromStorage, saveToStorage, STORAGE_KEY, STORAGE_VERSION } from '../utils/storage';
import { useWeddingState } from '../hooks/useWeddingState';
import type { WeddingData } from '../types';

const published = publicGuests.guests.map(guest => ({ id: guest.id, name: guest.name }));

describe('public wedding list', () => {
  it('matches the attached names exactly and publishes no other guest fields', () => {
    expect(Object.keys(publicGuests)).toEqual(['guests']);
    expect(publicGuests.guests).toHaveLength(135);
    expect(publicGuests.guests.every(guest => Object.keys(guest).sort().join() === 'id,name')).toBe(true);

    const wedding = createPublicWedding();
    expect(wedding.guests.map(guest => ({ id: guest.id, name: guest.name }))).toEqual(published);
    expect(wedding.guests[0]).toEqual({
      id: 'g001',
      name: 'Jean Huang',
      side: '',
      sheetBlock: '',
      isChild: false,
      rsvp: 'unknown',
      tableId: null,
    });
    expect(wedding.guests.find(guest => guest.id === 'g125')?.name).toBe('Wife Esumndo');
    expect(wedding.guests.find(guest => guest.id === 'g117')?.name).toBe('Cynan Tomseon');
    expect(wedding.guests.every(guest => !guest.familyGroup && !guest.cardSent && !guest.events)).toBe(true);
    expect(wedding.name).toBe('Wedding group planner');
    expect(wedding.isDemo).toBe(false);
    expect(wedding.assignments).toEqual([]);
    expect(wedding.tables).toHaveLength(14);
    expect(wedding.tables.map(table => table.name)).toEqual(Array.from({ length: 14 }, (_, index) => `Group ${index + 1}`));
    expect(wedding.tables.every(table => table.capacity === 10)).toBe(true);
  });

  it('replaces a saved sample plan and keeps a real plan with old ids', () => {
    const sample: WeddingData = {
      id: 'demo-old',
      name: 'Sample list',
      guests: [
        {
          id: 'demo_b1',
          name: 'Luna Starweaver',
          side: 'bride',
          sheetBlock: 'Family',
          isChild: false,
          rsvp: 'confirmed',
          tableId: 'demo_g1',
        },
      ],
      tables: [{ id: 'demo_g1', name: 'Group 1', capacity: 10, x: 0, y: 0, type: 'round' }],
      assignments: [{ guestId: 'demo_b1', tableId: 'demo_g1' }],
      isDemo: true,
      lastModified: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: sample }));

    const replaced = loadFromStorage();
    expect(replaced.isDemo).toBe(false);
    expect(replaced.guests.map(guest => guest.name)).toEqual(published.map(guest => guest.name));
    expect(replaced.guests.some(guest => guest.name === 'Luna Starweaver')).toBe(false);

    const { result } = renderHook(() => useWeddingState());
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as { data: WeddingData };
    expect(result.current.state.data.guests[0].name).toBe('Jean Huang');
    expect(stored.data.isDemo).toBe(false);
    expect(stored.data.guests).toHaveLength(135);

    const seated: WeddingData = {
      id: 'imported-real',
      name: 'Kept Wedding',
      guests: [
        {
          id: 'g001',
          name: 'Jean Huang',
          side: 'bride',
          sheetBlock: 'Family',
          isChild: false,
          rsvp: 'confirmed',
          tableId: 'table_a',
          familyGroup: 'Huang',
        },
        {
          id: 'g002',
          name: 'Charlie Sheen',
          side: '',
          sheetBlock: '',
          isChild: false,
          rsvp: 'unknown',
          tableId: null,
        },
      ],
      tables: [{ id: 'table_a', name: 'Table 4', capacity: 12, x: 0, y: 0, type: 'round' }],
      assignments: [{ guestId: 'g001', tableId: 'table_a' }],
      isDemo: false,
      lastModified: 2,
    };
    saveToStorage(seated);
    const kept = loadFromStorage();
    expect(kept.guests).toHaveLength(2);
    expect(kept.guests[0]).toMatchObject({ id: 'g001', name: 'Jean Huang', tableId: 'table_a', familyGroup: 'Huang' });
    expect(kept.assignments).toEqual([{ guestId: 'g001', tableId: 'table_a' }]);
    expect(kept.tables[0]).toMatchObject({ id: 'table_a', name: 'Group 4', capacity: 10 });
  });

  it('resets to the public list rather than a fictional one', () => {
    const { result } = renderHook(() => useWeddingState());
    act(() => {
      result.current.dispatch({
        type: 'ASSIGN_GUEST',
        guestId: 'g001',
        tableId: result.current.state.data.tables[0].id,
      });
      result.current.dispatch({ type: 'RESET_TO_DEMO' });
    });
    expect(result.current.state.data.guests).toHaveLength(135);
    expect(result.current.state.data.guests[0]).toMatchObject({ id: 'g001', name: 'Jean Huang', tableId: null });
    expect(result.current.state.data.isDemo).toBe(false);
    expect(result.current.state.data.assignments).toEqual([]);
  });
});
