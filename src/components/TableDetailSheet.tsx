import { useEffect, useState } from 'react';
import type { Guest, Table } from '../types';

interface TableDetailSheetProps {
  table: Table;
  guests: Guest[];
  onUnseat: (guestId: string) => void;
  onAddGuests: () => void;
  onSave: (updates: { name: string; capacity: number }) => void;
  onRemove: () => void;
  onClose: () => void;
}

function TableFields({
  table,
  guestCount,
  onSave,
  onRemove,
}: {
  table: Table;
  guestCount: number;
  onSave: (updates: { name: string; capacity: number }) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(table.name);
  const [capacity, setCapacity] = useState(table.capacity);

  return (
    <form
      className="sheet-form"
      onSubmit={event => {
        event.preventDefault();
        const nextCapacity = Math.max(guestCount, Math.min(30, capacity || guestCount));
        onSave({ name: name.trim() || table.name, capacity: nextCapacity });
      }}
    >
      <label>
        Name
        <input value={name} onChange={event => setName(event.target.value)} aria-label="Table name" />
      </label>
      <label>
        Capacity
        <input
          aria-label="Table capacity"
          type="number"
          min={guestCount}
          max={30}
          value={capacity}
          onChange={event => setCapacity(Number(event.target.value))}
        />
      </label>
      <button className="sheet-wide primary" type="submit">Save table</button>
      <button className="sheet-wide danger" type="button" onClick={onRemove}>
        Remove table
      </button>
    </form>
  );
}

export function TableDetailSheet({
  table,
  guests,
  onUnseat,
  onAddGuests,
  onSave,
  onRemove,
  onClose,
}: TableDetailSheetProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId === table.id;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (editing) setEditingId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);

  const available = Math.max(0, table.capacity - guests.length);

  return (
    <div className="sheet-layer" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-detail-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <div>
            <p className="sheet-kicker">Table</p>
            <h2 id="table-detail-title" className="sheet-title">{table.name}</h2>
            <p className="sheet-subtitle">{guests.length}/{table.capacity} seated · {available} open</p>
          </div>
          <button className="sheet-close" type="button" onClick={onClose}>Close</button>
        </div>

        <div className="sheet-actions">
          <button className="sheet-wide primary" type="button" onClick={onAddGuests} disabled={available === 0}>
            {available === 0 ? 'Table is full' : `Add guests · ${available} open`}
          </button>
          <button className="sheet-wide" type="button" onClick={() => setEditingId(editing ? null : table.id)}>
            {editing ? 'Cancel edit' : 'Edit name or capacity'}
          </button>
        </div>

        {editing && (
          <TableFields
            key={`${table.id}:${table.name}:${table.capacity}`}
            table={table}
            guestCount={guests.length}
            onSave={updates => {
              onSave(updates);
              setEditingId(null);
            }}
            onRemove={() => {
              if (window.confirm(`Remove ${table.name}? ${guests.length ? `${guests.length} guests will be unseated.` : ''}`)) {
                onRemove();
              }
            }}
          />
        )}

        <div className="sheet-scroll">
          {guests.length === 0 && <p className="sheet-empty">Nobody is seated here yet.</p>}
          {guests.map(guest => (
            <div key={guest.id} className="seated-row">
              <div>
                <div className="seated-name">{guest.name}</div>
                <div className="seated-meta">{guest.rsvp}{guest.isChild ? ' · Child' : ''}{guest.familyGroup ? ` · ${guest.familyGroup}` : ''}</div>
              </div>
              <button type="button" className="row-action" onClick={() => onUnseat(guest.id)}>
                Unseat
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
