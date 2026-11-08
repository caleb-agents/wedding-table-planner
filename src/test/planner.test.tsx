import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { resetFragmentStartupForTests } from '../utils/fragment';
import { STORAGE_KEY, STORAGE_VERSION } from '../utils/storage';
import type { Guest, ImportedData, WeddingData } from '../types';

function encodeFragment(data: ImportedData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function plan(extraGuests = 0): WeddingData {
  const guests = [
    { id: 'ada', name: 'Ada Fictional', side: 'bride', sheetBlock: 'Family', isChild: false, rsvp: 'confirmed' as const, tableId: null, familyGroup: 'Fictional' },
    { id: 'ben', name: 'Ben Fictional', side: 'groom', sheetBlock: 'Friends', isChild: false, rsvp: 'unconfirmed' as const, tableId: null },
    ...Array.from({ length: extraGuests }, (_, index) => ({
      id: `extra_${index}`,
      name: `Extra Fictional ${index + 1}`,
      side: 'mutual',
      sheetBlock: 'Block',
      isChild: false,
      rsvp: 'unknown' as const,
      tableId: null,
    })),
  ];
  return {
    id: 'plan',
    name: 'Fictional Plan',
    weddingDate: '2027-01-23',
    guests,
    tables: [
      { id: 'g1', name: 'Group 1', capacity: 10, x: 0, y: 0, type: 'round' },
      { id: 'g2', name: 'Group 2', capacity: 10, x: 0, y: 0, type: 'round' },
    ],
    assignments: [],
    isDemo: false,
    lastModified: 1,
  };
}

function seed(data: WeddingData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data }));
}

describe('group planner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('assigns, moves, and returns a guest without showing metadata as the main control', async () => {
    const user = userEvent.setup();
    seed(plan());
    render(<App />);

    expect(screen.getByRole('button', { name: 'Ada Fictional' })).toBeTruthy();
    expect(screen.queryByText('confirmed')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ada Fictional' }));
    const chooser = screen.getByRole('dialog', { name: 'Choose a group' });
    await user.click(within(chooser).getByRole('button', { name: /Group 1/ }));

    const group = screen.getByRole('heading', { name: 'Group 1' }).closest('article');
    expect(group).toBeTruthy();
    expect(within(group as HTMLElement).getByText('Ada Fictional')).toBeTruthy();
    expect(within(group as HTMLElement).getByText('1/10')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ada Fictional' })).toBeNull();

    await user.click(within(group as HTMLElement).getByRole('button', { name: 'Move Ada Fictional' }));
    const moveChooser = screen.getByRole('dialog', { name: 'Choose a group' });
    await user.click(within(moveChooser).getByRole('button', { name: 'Unassigned' }));
    expect(screen.getByRole('button', { name: 'Ada Fictional' })).toBeTruthy();
  });

  it('disables a full group and still allows remove', async () => {
    const user = userEvent.setup();
    const data = plan(9);
    data.guests.slice(1, 11).forEach(guest => {
      guest.tableId = 'g1';
    });
    data.assignments = data.guests.filter(guest => guest.tableId).map(guest => ({ guestId: guest.id, tableId: guest.tableId as string }));
    seed(data);
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Ada Fictional' }));
    const chooser = screen.getByRole('dialog', { name: 'Choose a group' });
    expect(within(chooser).getByRole('button', { name: /Group 1/ })).toHaveProperty('disabled', true);
    await user.click(within(chooser).getByRole('button', { name: /Group 2/ }));

    const group = screen.getByRole('heading', { name: 'Group 2' }).closest('article');
    expect(within(group as HTMLElement).getByText('1/10')).toBeTruthy();
    await user.click(within(group as HTMLElement).getByRole('button', { name: 'Remove Ada Fictional' }));
    expect(screen.getByRole('button', { name: 'Ada Fictional' })).toBeTruthy();
  });

  it('shows an over-capacity warning and refuses another assignment there', async () => {
    const user = userEvent.setup();
    const guests: Guest[] = Array.from({ length: 11 }, (_, index) => ({
      id: `over_${index}`,
      name: index === 0 ? '<img src=x onerror=alert(1)>' : `Overflow Fictional ${index}`,
      side: 'bride',
      sheetBlock: 'Block',
      isChild: false,
      rsvp: 'confirmed' as const,
      tableId: 'packed',
    }));
    guests.push({
      id: 'waiting',
      name: 'Waiting Fictional',
      side: 'groom',
      sheetBlock: 'Block',
      isChild: false,
      rsvp: 'unknown',
      tableId: null,
    });
    seed({
      id: 'over',
      name: 'Over',
      guests,
      tables: [{ id: 'packed', name: 'Table 3', capacity: 12, x: 1, y: 1, type: 'round' }],
      assignments: guests.filter(guest => guest.tableId).map(guest => ({ guestId: guest.id, tableId: 'packed' })),
      isDemo: false,
      lastModified: 1,
    });
    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: 'Group 3' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/11 people in a group of 10/);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Waiting Fictional' }));
    expect(screen.getByRole('button', { name: /Group 3/ })).toHaveProperty('disabled', true);
  });

  it('renames a group and adds another', async () => {
    const user = userEvent.setup();
    seed(plan());
    render(<App />);
    const group = screen.getByRole('heading', { name: 'Group 1' }).closest('article') as HTMLElement;
    await user.click(within(group).getByRole('button', { name: 'Rename' }));
    const input = within(group).getByLabelText('Rename Group 1');
    await user.clear(input);
    await user.type(input, 'Family');
    await user.click(within(group).getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('heading', { name: 'Family' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add group' }));
    expect(screen.getByRole('heading', { name: 'Group 3' })).toBeTruthy();
  });

  it('asks before a private link replaces assigned guests, and a bad link changes nothing', async () => {
    const user = userEvent.setup();
    const saved = plan();
    saved.guests[0].tableId = 'g1';
    saved.assignments = [{ guestId: 'ada', tableId: 'g1' }];
    seed(saved);
    const incoming: ImportedData = {
      source: { fileId: 'link', name: 'Incoming', tab: 'Guests' },
      weddingDate: '2027-01-23',
      tables: [],
      guests: [
        { id: 'new_1', name: 'Replacement Fictional', side: 'bride', sheetBlock: 'Block', isChild: false, rsvp: 'unknown', tableId: null },
      ],
    };
    window.location.hash = `guests=${encodeFragment(incoming)}`;
    const view = render(<App />);

    expect(screen.getByRole('dialog', { name: 'Replace the saved list?' })).toBeTruthy();
    expect(screen.getByText('Ada Fictional')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keep saved list' }));
    expect(screen.queryByText('Replacement Fictional')).toBeNull();
    expect(window.location.hash).toBe('');

    view.unmount();
    resetFragmentStartupForTests();
    window.location.hash = 'guests=%%%';
    render(<App />);
    expect(screen.getByText('That link could not be read. Your saved list was not changed.')).toBeTruthy();
    expect(screen.getByText('Ada Fictional')).toBeTruthy();
  });
});
