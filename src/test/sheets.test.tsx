import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TablePickerSheet } from '../components/TablePickerSheet';
import { AddGuestsSheet } from '../components/AddGuestsSheet';
import type { Guest, Table } from '../types';

const tables: Table[] = [
  { id: 'head', name: 'Head Table', capacity: 2, x: 0, y: 0, type: 'head' },
  { id: 't2', name: 'Table 2', capacity: 10, x: 0, y: 0, type: 'round' },
];

const guest: Guest = {
  id: 'g1',
  name: 'Alexandria Moonflower-Longname',
  side: 'bride',
  sheetBlock: 'Family block',
  isChild: false,
  rsvp: 'confirmed',
  tableId: 'head',
  familyGroup: 'Moonflower',
};

describe('table picker', () => {
  it('moves a guest with one tap and can unseat them', async () => {
    const user = userEvent.setup();
    const onSeat = vi.fn();
    const onUnseat = vi.fn();
    render(
      <TablePickerSheet
        guest={guest}
        tables={tables}
        tableName={id => tables.find(table => table.id === id)?.name ?? null}
        getCapacity={id => id === 'head'
          ? { seated: 2, capacity: 2, isFull: true }
          : { seated: 1, capacity: 10, isFull: false }}
        familySize={2}
        familyFitsTable={() => false}
        onSeat={onSeat}
        onSeatFamily={vi.fn()}
        onUnseat={onUnseat}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: guest.name })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Table 2, 1 of 10 seated, 9 open/ }));
    expect(onSeat).toHaveBeenCalledWith('t2');
    await user.click(screen.getByRole('button', { name: `Unseat ${guest.name}` }));
    expect(onUnseat).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Head Table/ })).toHaveProperty('disabled', true);
  });
});

describe('add guests sheet', () => {
  it('selects several guests up to the open seats and seats them together', async () => {
    const user = userEvent.setup();
    const onSeat = vi.fn();
    const guests: Guest[] = [1, 2, 3].map(index => ({
      id: `guest_${index}`,
      name: `Fictional Guest With A Very Long Name ${index}`,
      side: 'groom',
      sheetBlock: 'Friends',
      isChild: false,
      rsvp: 'unknown' as const,
      tableId: null,
    }));

    render(
      <AddGuestsSheet
        table={tables[1]}
        openSeats={2}
        guests={guests}
        onSeat={onSeat}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByRole('searchbox'), 'Long Name 1');
    await user.click(screen.getByRole('option', { name: /Fictional Guest With A Very Long Name 1/ }));
    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('option', { name: /Long Name 2/ }));
    expect(screen.getByRole('option', { name: /Long Name 3/ })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Seat 2 guests' }));
    expect(onSeat).toHaveBeenCalledWith(['guest_1', 'guest_2']);
  });
});
