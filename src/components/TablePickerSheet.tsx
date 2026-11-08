import { useEffect, useRef } from 'react';
import type { Guest, Table } from '../types';
import { sortedTables } from '../utils/tables';

interface CapacityInfo {
  seated: number;
  capacity: number;
  isFull: boolean;
}

interface TablePickerSheetProps {
  guest: Guest;
  tables: Table[];
  tableName: (tableId: string | null) => string | null;
  getCapacity: (tableId: string) => CapacityInfo;
  familySize: number;
  familyFitsTable: (tableId: string) => boolean;
  onSeat: (tableId: string) => void;
  onSeatFamily: (tableId: string) => void;
  onUnseat: () => void;
  onClose: () => void;
}

export function TablePickerSheet({
  guest,
  tables,
  tableName,
  getCapacity,
  familySize,
  familyFitsTable,
  onSeat,
  onSeatFamily,
  onUnseat,
  onClose,
}: TablePickerSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const currentName = tableName(guest.tableId);

  useEffect(() => {
    closeRef.current?.focus();
  }, [guest.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-layer" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-picker-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <div>
            <p className="sheet-kicker">Choose a table</p>
            <h2 id="table-picker-title" className="sheet-title">{guest.name}</h2>
            <p className="sheet-subtitle">
              {currentName ? `Seated at ${currentName}` : 'Not seated yet'}
              {guest.familyGroup ? ` · ${guest.familyGroup}` : ''}
            </p>
          </div>
          <button ref={closeRef} className="sheet-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {guest.tableId && (
          <button className="sheet-wide danger" type="button" onClick={onUnseat}>
            Unseat {guest.name}
          </button>
        )}

        <div className="sheet-scroll">
          {sortedTables(tables).map(table => {
            const info = getCapacity(table.id);
            const available = Math.max(0, info.capacity - info.seated);
            const isCurrent = guest.tableId === table.id;
            const blocked = info.isFull && !isCurrent;
            const showFamily = Boolean(guest.familyGroup) && familySize > 1 && !isCurrent && familyFitsTable(table.id);
            return (
              <div key={table.id} className={`picker-table ${blocked ? 'is-full' : ''} ${isCurrent ? 'is-current' : ''}`}>
                <button
                  type="button"
                  className="picker-table-main"
                  disabled={blocked || isCurrent}
                  onClick={() => onSeat(table.id)}
                  aria-label={`${table.name}, ${info.seated} of ${info.capacity} seated, ${available} open${isCurrent ? ', current table' : ''}${blocked ? ', full' : ''}`}
                >
                  <span className="picker-table-name">{table.name}</span>
                  <span className="picker-table-meta">
                    {info.seated}/{info.capacity} seated · {available} open
                    {isCurrent ? ' · Here now' : ''}
                    {blocked ? ' · Full' : ''}
                  </span>
                </button>
                {showFamily && (
                  <button type="button" className="picker-family" onClick={() => onSeatFamily(table.id)}>
                    Seat {guest.familyGroup} ({familySize})
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
