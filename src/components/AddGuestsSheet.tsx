import { useEffect, useMemo, useRef, useState } from 'react';
import type { Guest, Table } from '../types';

interface AddGuestsSheetProps {
  table: Table;
  openSeats: number;
  guests: Guest[];
  onSeat: (guestIds: string[]) => void;
  onClose: () => void;
}

export function AddGuestsSheet({ table, openSeats, guests, onSeat, onClose }: AddGuestsSheetProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    searchRef.current?.focus();
  }, [table.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guests
      .filter(guest => guest.tableId === null)
      .filter(guest => {
        if (!needle) return true;
        return guest.name.toLowerCase().includes(needle) || guest.familyGroup?.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [guests, query]);

  const toggle = (guestId: string) => {
    setSelected(current => {
      if (current.includes(guestId)) return current.filter(id => id !== guestId);
      if (current.length >= openSeats) return current;
      return [...current, guestId];
    });
  };

  const seatsLeft = openSeats - selected.length;

  return (
    <div className="sheet-layer" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-guests-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <div>
            <p className="sheet-kicker">Add to {table.name}</p>
            <h2 id="add-guests-title" className="sheet-title">Choose guests</h2>
            <p className="sheet-subtitle">{openSeats} open {openSeats === 1 ? 'seat' : 'seats'}</p>
          </div>
          <button className="sheet-close" type="button" onClick={onClose}>Close</button>
        </div>
        <label className="sheet-search">
          <span className="sr-only">Search guests to add</span>
          <input
            ref={searchRef}
            type="search"
            enterKeyHint="search"
            placeholder="Search by name or family"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <div className="sheet-scroll" role="listbox" aria-label="Unseated guests" aria-multiselectable="true">
          {visible.length === 0 && (
            <p className="sheet-empty">No unseated guests match that search.</p>
          )}
          {visible.map(guest => {
            const checked = selected.includes(guest.id);
            const disabled = !checked && seatsLeft <= 0;
            return (
              <button
                key={guest.id}
                type="button"
                role="option"
                aria-selected={checked}
                className={`guest-select-row ${checked ? 'is-selected' : ''}`}
                disabled={disabled}
                onClick={() => toggle(guest.id)}
              >
                <span className="check-box" aria-hidden="true">{checked ? '✓' : ''}</span>
                <span className="guest-select-copy">
                  <span className="guest-select-name">{guest.name}</span>
                  <span className="guest-select-meta">
                    {guest.rsvp}{guest.familyGroup ? ` · ${guest.familyGroup}` : ''}{guest.isChild ? ' · Child' : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="sheet-footer">
          <p>{selected.length} selected · {Math.max(0, seatsLeft)} still open</p>
          <button
            type="button"
            className="sheet-wide primary"
            disabled={selected.length === 0}
            onClick={() => onSeat(selected)}
          >
            Seat {selected.length === 1 ? '1 guest' : `${selected.length} guests`}
          </button>
        </div>
      </div>
    </div>
  );
}
