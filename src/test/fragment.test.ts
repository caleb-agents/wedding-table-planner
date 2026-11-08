import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportedData, WeddingData } from '../types';
import { acceptGuestPayload, consumeFragmentAtStartup, decodeGuestFragment, resetFragmentStartupForTests } from '../utils/fragment';
import { loadFromStorage, STORAGE_KEY } from '../utils/storage';
import { shouldConfirmReplace } from '../utils/groups';

function fictionalImport(count = 3): ImportedData {
  return {
    source: { fileId: 'fictional', name: 'Fictional Link List', tab: 'Guests' },
    weddingDate: '2027-01-23',
    tables: [],
    guests: Array.from({ length: count }, (_, index) => ({
      id: `frag_${index + 1}`,
      name: index === 0 ? 'José Ñuñez <not html>' : `Fictional Link Guest ${index + 1}`,
      side: 'bride',
      sheetBlock: 'Block',
      isChild: false,
      rsvp: 'unknown' as const,
      tableId: null,
    })),
  };
}

function encodeFragment(data: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

describe('guest fragment', () => {
  afterEach(() => {
    resetFragmentStartupForTests();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  });

  it('decodes a base64url UTF-8 list into 14 empty groups', () => {
    const wedding = decodeGuestFragment(`#guests=${encodeFragment(fictionalImport(135))}`);
    expect(wedding.ok).toBe(true);
    if (!wedding.ok) return;
    expect(wedding.wedding.guests).toHaveLength(135);
    expect(wedding.wedding.guests[0].name).toBe('José Ñuñez <not html>');
    expect(wedding.wedding.tables).toHaveLength(14);
    expect(wedding.wedding.assignments).toEqual([]);
    expect(wedding.wedding.guests.every(guest => guest.tableId === null)).toBe(true);
  });

  it('rejects a malformed payload without throwing', () => {
    expect(decodeGuestFragment('#guests=@@@')).toEqual({ ok: false });
    expect(decodeGuestFragment('#guests=bm90LWpzb24')).toEqual({ ok: false });
    expect(acceptGuestPayload({ guests: [] })).toEqual({ ok: false });
  });

  it('does not log the fragment', () => {
    const encoded = encodeFragment(fictionalImport(1));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    decodeGuestFragment(`#guests=${encoded}`);
    const printed = [...log.mock.calls, ...warn.mock.calls, ...error.mock.calls].flat().join(' ');
    expect(printed.includes(encoded)).toBe(false);
    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  it('loads a fragment on a fresh browser and strips the hash', () => {
    localStorage.clear();
    const encoded = encodeFragment(fictionalImport(4));
    window.location.hash = `guests=${encoded}`;
    const startup = consumeFragmentAtStartup();
    expect(startup.status).toBe('applied');
    expect(window.location.hash).toBe('');
    const loaded = loadFromStorage();
    expect(loaded.isDemo).toBe(false);
    expect(loaded.guests).toHaveLength(4);
    expect(loaded.guests[0].name).toBe('José Ñuñez <not html>');
    expect(loaded.tables).toHaveLength(14);
  });

  it('asks before replacing a saved plan that already has assignments', () => {
    const saved: WeddingData = {
      id: 'saved',
      name: 'Already grouped',
      guests: [
        { id: 'keep_me', name: 'Keep Me Fictional', side: 'groom', sheetBlock: 'Block', isChild: false, rsvp: 'confirmed', tableId: 'g1' },
      ],
      tables: [{ id: 'g1', name: 'Group 1', capacity: 10, x: 0, y: 0, type: 'round' }],
      assignments: [{ guestId: 'keep_me', tableId: 'g1' }],
      isDemo: false,
      lastModified: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data: saved }));
    expect(shouldConfirmReplace(loadFromStorage())).toBe(true);
    window.location.hash = `guests=${encodeFragment(fictionalImport(2))}`;
    const startup = consumeFragmentAtStartup();
    expect(startup.status).toBe('confirm');
    if (startup.status !== 'confirm') return;
    expect(startup.next.guests).toHaveLength(2);
    expect(loadFromStorage().guests[0].name).toBe('Keep Me Fictional');
    expect(loadFromStorage().guests[0].tableId).toBe('g1');
  });

  it('leaves saved data in place when the fragment is malformed', () => {
    const saved: WeddingData = {
      id: 'saved',
      name: 'Stay',
      guests: [
        { id: 'stay', name: 'Stay Fictional', side: 'bride', sheetBlock: 'Block', isChild: false, rsvp: 'unknown', tableId: null },
      ],
      tables: [{ id: 'g1', name: 'Group 1', capacity: 10, x: 0, y: 0, type: 'round' }],
      assignments: [],
      isDemo: false,
      lastModified: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data: saved }));
    window.location.hash = 'guests=%%%';
    expect(consumeFragmentAtStartup().status).toBe('invalid');
    expect(loadFromStorage().guests[0].name).toBe('Stay Fictional');
  });
});
