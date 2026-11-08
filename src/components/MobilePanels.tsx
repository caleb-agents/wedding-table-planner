import type { Guest, Table } from '../types';
import type { WeddingStateReturn } from '../hooks/useWeddingState';
import { sortedTables } from '../utils/tables';

interface GuestPanelProps {
  state: WeddingStateReturn['state'];
  dispatch: WeddingStateReturn['dispatch'];
  guests: Guest[];
  statistics: WeddingStateReturn['statistics'];
  onGuest: (guestId: string) => void;
  onImport: () => void;
}

export function GuestPanel({ state, dispatch, guests, statistics, onGuest, onImport }: GuestPanelProps) {
  const tableName = (tableId: string | null) => state.data.tables.find(table => table.id === tableId)?.name ?? null;
  const ordered = [...guests].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="mobile-panel" aria-label="Guests">
      <div className="panel-sticky">
        <div className="stats-bar" aria-label="Statistics">
          <div className="stat-item"><span className="stat-value">{statistics.seatedGuests}</span><span className="stat-label">Seated</span></div>
          <div className="stat-item"><span className="stat-value">{statistics.unseatedGuests}</span><span className="stat-label">Unseated</span></div>
          <div className="stat-item"><span className="stat-value">{statistics.availableSeats}</span><span className="stat-label">Open</span></div>
        </div>
        {state.data.isDemo && (
          <div className="mobile-import-card">
            <p>This is sample data with fictional guests. Your real list stays in this browser.</p>
            <button type="button" className="sheet-wide primary" onClick={onImport}>Import guest list</button>
          </div>
        )}
        <input
          type="search"
          className="search-input"
          placeholder="Search guests"
          value={state.searchQuery}
          onChange={event => dispatch({ type: 'SET_SEARCH_QUERY', query: event.target.value })}
          aria-label="Search guests"
          enterKeyHint="search"
        />
        <div className="filter-row" role="group" aria-label="Filter by RSVP status">
          {(['all', 'confirmed', 'unconfirmed', 'unknown'] as const).map(filter => (
            <button
              key={filter}
              type="button"
              className={`filter-btn ${state.filterRsvp === filter ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_FILTER_RSVP', filter })}
            >
              {filter === 'all' ? 'All' : filter}
            </button>
          ))}
        </div>
      </div>
      <div className="mobile-scroll">
        {ordered.length === 0 && <p className="sheet-empty">No guests match those filters.</p>}
        <ul className="touch-list">
          {ordered.map(guest => {
            const seatedAt = tableName(guest.tableId);
            return (
              <li key={guest.id}>
                <button type="button" className="touch-row" onClick={() => onGuest(guest.id)}>
                  <span className={`rsvp-dot ${guest.rsvp}`} aria-hidden="true" />
                  <span className="touch-copy">
                    <span className="touch-title">{guest.name}</span>
                    <span className="touch-meta">
                      {seatedAt ? seatedAt : 'Tap to choose a table'}
                      {guest.isChild ? ' · Child' : ''}
                      {guest.familyGroup ? ` · ${guest.familyGroup}` : ''}
                    </span>
                  </span>
                  <span className="touch-chevron" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

interface TablePanelProps {
  tables: Table[];
  getCapacity: (tableId: string) => { seated: number; capacity: number; isFull: boolean };
  onTable: (tableId: string) => void;
  onAddTable: () => void;
}

export function TablePanel({ tables, getCapacity, onTable, onAddTable }: TablePanelProps) {
  return (
    <section className="mobile-panel" aria-label="Tables">
      <div className="panel-sticky">
        <button type="button" className="sheet-wide primary" onClick={onAddTable}>Add a table</button>
      </div>
      <div className="mobile-scroll">
        <ul className="touch-list">
          {sortedTables(tables).map(table => {
            const info = getCapacity(table.id);
            const open = Math.max(0, info.capacity - info.seated);
            return (
              <li key={table.id}>
                <button type="button" className="touch-row" onClick={() => onTable(table.id)}>
                  <span className="touch-copy">
                    <span className="touch-title">{table.name}</span>
                    <span className="touch-meta">{info.seated}/{info.capacity} seated · {open} open{info.isFull ? ' · Full' : ''}</span>
                  </span>
                  <span className="touch-chevron" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

interface MobileTabBarProps {
  tab: 'guests' | 'tables' | 'venue';
  onChange: (tab: 'guests' | 'tables' | 'venue') => void;
}

export function MobileTabBar({ tab, onChange }: MobileTabBarProps) {
  const tabs = [
    ['guests', 'Guests'],
    ['tables', 'Tables'],
    ['venue', 'Venue'],
  ] as const;
  return (
    <nav className="mobile-tabbar" aria-label="Planner sections">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={`mobile-tab ${tab === id ? 'is-active' : ''}`}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
