import { useRef, useState } from 'react';
import type { Guest, WeddingData } from './types';
import { useWeddingState } from './hooks/useWeddingState';
import { acceptGuestPayload } from './utils/fragment';
import { parseCSV } from './utils/validation';
import { downloadFile, exportSeatingToCSV, exportToJSON } from './utils/storage';
import { formatWeddingDate } from './utils/dates';
import {
  GROUP_CAPACITY,
  guestsInGroup,
  groupCount,
  isGroupFull,
  isGroupOverCapacity,
  nextGroupName,
  shouldConfirmReplace,
  sortedGroups,
} from './utils/groups';
import { generateId } from './utils/ids';
import { createPublicWedding } from './data/sampleData';
import './styles/app.css';

type Chooser = { guestId: string; mode: 'assign' | 'move' };

export default function App() {
  const { state, dispatch, fragmentStartup } = useWeddingState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [pending, setPending] = useState<WeddingData | null>(
    fragmentStartup.status === 'confirm' ? fragmentStartup.next : null,
  );
  const [notice, setNotice] = useState<string | null>(
    fragmentStartup.status === 'invalid'
      ? 'That link could not be read. Your saved list was not changed.'
      : fragmentStartup.status === 'applied'
        ? 'Guest list loaded on this device.'
        : null,
  );
  const [status, setStatus] = useState('');

  const { data } = state;
  const query = state.searchQuery.trim().toLowerCase();
  const unassigned = data.guests
    .filter(guest => guest.tableId === null)
    .filter(guest => matchesQuery(guest, query))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const groups = sortedGroups(data.tables);
  const chooserGuest = chooser ? data.guests.find(guest => guest.id === chooser.guestId) ?? null : null;

  function offerImport(next: WeddingData) {
    if (shouldConfirmReplace(data)) {
      setPending(next);
      return;
    }
    dispatch({ type: 'IMPORT_DATA', data: next });
    setNotice('Guest list loaded on this device.');
    setStatus('');
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text || text.length > 2_000_000) {
        setNotice('That file could not be read. Your saved list was not changed.');
        return;
      }
      const wedding = weddingFromText(text);
      if (!wedding) {
        setNotice('That file could not be read. Your saved list was not changed.');
        return;
      }
      offerImport(wedding);
    };
    reader.onerror = () => {
      setNotice('That file could not be read. Your saved list was not changed.');
    };
    reader.readAsText(file);
  }

  function assignTo(guest: Guest, groupId: string) {
    const group = data.tables.find(table => table.id === groupId);
    if (!group) return;
    const count = groupCount(data.guests, groupId);
    if (isGroupFull(count) || isGroupOverCapacity(count)) return;
    dispatch({ type: 'ASSIGN_GUEST', guestId: guest.id, tableId: groupId });
    setChooser(null);
    setStatus(`Moved ${guest.name} to ${group.name}.`);
  }

  function returnGuest(guest: Guest) {
    dispatch({ type: 'UNASSIGN_GUEST', guestId: guest.id });
    setChooser(null);
    setStatus(`Returned ${guest.name} to unassigned.`);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Wedding group planner</h1>
          <p className="subhead">
            {[
              data.name !== 'Wedding group planner' ? data.name : '',
              data.weddingDate ? formatWeddingDate(data.weddingDate) : '',
              `${data.guests.length - unassignedCount(data)} grouped`,
              `${unassignedCount(data)} unassigned`,
            ].filter(Boolean).join(' · ')}
          </p>
          <p className="hint">These guest names are public. Assignments stay in this browser.</p>
          <p className="status" role="status">{status || 'Saved on this device.'}</p>
        </div>
        <div className="toolbar">
          <button type="button" onClick={() => dispatch({ type: 'UNDO' })} disabled={state.undoStack.length === 0}>
            Undo
          </button>
          <button type="button" onClick={() => dispatch({ type: 'REDO' })} disabled={state.redoStack.length === 0}>
            Redo
          </button>
        </div>
      </header>

      {notice && (
        <div className="notice" role="status">
          <p>{notice}</p>
          <button type="button" className="quiet" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      <div className="layout">
        <section className="panel unassigned" aria-labelledby="unassigned-heading">
          <div className="panel-head">
            <h2 id="unassigned-heading">Unassigned</h2>
            <span className="count">{unassignedCount(data)}</span>
          </div>
          <input
            className="search"
            type="search"
            value={state.searchQuery}
            placeholder="Search names"
            aria-label="Search unassigned names"
            onChange={event => dispatch({ type: 'SET_SEARCH_QUERY', query: event.target.value })}
          />
          {unassigned.length === 0 ? (
            <p className="empty">{query ? 'No names match that search.' : 'Everyone is in a group.'}</p>
          ) : (
            <ul className="name-list">
              {unassigned.map(guest => (
                <li key={guest.id}>
                  <button type="button" className="name-button" onClick={() => setChooser({ guestId: guest.id, mode: 'assign' })}>
                    <span className="person-name">{guest.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="groups-heading">
          <div className="panel-head">
            <h2 id="groups-heading">Groups</h2>
            <span className="count">{groups.length}</span>
          </div>
          <div className="group-list">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                groupId={group.id}
                name={group.name}
                guests={data.guests}
                query={query}
                onMove={guestId => setChooser({ guestId, mode: 'move' })}
                onRemove={guestId => {
                  const guest = data.guests.find(item => item.id === guestId);
                  if (guest) returnGuest(guest);
                }}
                onRename={nextName => dispatch({ type: 'UPDATE_TABLE', tableId: group.id, updates: { name: nextName } })}
                onRemoveGroup={() => dispatch({ type: 'REMOVE_TABLE', tableId: group.id })}
              />
            ))}
          </div>
          <button
            type="button"
            className="add-group"
            onClick={() => dispatch({
              type: 'ADD_TABLE',
              table: {
                id: generateId('group'),
                name: nextGroupName(data.tables),
                capacity: GROUP_CAPACITY,
                x: 0,
                y: 0,
                type: 'round',
              },
            })}
          >
            Add group
          </button>
        </section>
      </div>

      <details className="backup">
        <summary>Backup and import</summary>
        <div className="backup-actions">
          <button type="button" className="quiet" onClick={() => offerImport(createPublicWedding())}>Load wedding list</button>
          <button type="button" className="quiet" onClick={() => fileRef.current?.click()}>Import file</button>
          <button type="button" className="quiet" onClick={() => downloadFile(exportToJSON(data), 'group-planner-backup.json', 'application/json')}>
            Download backup
          </button>
          <button type="button" className="quiet" onClick={() => downloadFile(exportSeatingToCSV(data), 'groups.csv', 'text/csv')}>
            Download CSV
          </button>
        </div>
        <p className="hint">Guest names on this page are published with the site. Assignments stay on this device. Import file and a private link still work if you need another list.</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,text/csv,.json,.csv"
          hidden
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onFile(file);
          }}
        />
      </details>

      {chooser && chooserGuest && (
        <div className="overlay" onClick={() => setChooser(null)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chooser-title"
            onClick={event => event.stopPropagation()}
          >
            <h2 id="chooser-title">Choose a group</h2>
            <p className="person-name">{chooserGuest.name}</p>
            <ul className="chooser-list">
              {chooser.mode === 'move' && (
                <li>
                  <button type="button" className="chooser-option" onClick={() => returnGuest(chooserGuest)}>
                    <span>Unassigned</span>
                  </button>
                </li>
              )}
              {groups.map(group => {
                const count = groupCount(data.guests, group.id);
                const here = chooserGuest.tableId === group.id;
                const blocked = !here && (isGroupFull(count) || isGroupOverCapacity(count));
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      className="chooser-option"
                      disabled={blocked || here}
                      onClick={() => assignTo(chooserGuest, group.id)}
                    >
                      <span>{group.name}</span>
                      <span>{count}/{GROUP_CAPACITY}{blocked ? ' · Full' : ''}{here ? ' · Here' : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="quiet" onClick={() => setChooser(null)}>Cancel</button>
          </div>
        </div>
      )}

      {pending && (
        <div className="overlay">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="replace-title">
            <h2 id="replace-title">Replace the saved list?</h2>
            <p>
              People are already assigned in {data.name}. Replacing overwrites those groups with {pending.guests.length} names from the new list.
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPending(null)}>Keep saved list</button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  dispatch({ type: 'IMPORT_DATA', data: pending });
                  setPending(null);
                  setNotice('Guest list loaded on this device.');
                  setStatus('');
                }}
              >
                Replace list
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function GroupCard({
  groupId,
  name,
  guests,
  query,
  onMove,
  onRemove,
  onRename,
  onRemoveGroup,
}: {
  groupId: string;
  name: string;
  guests: Guest[];
  query: string;
  onMove: (guestId: string) => void;
  onRemove: (guestId: string) => void;
  onRename: (name: string) => void;
  onRemoveGroup: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const members = guestsInGroup(guests, groupId);
  const visible = query ? members.filter(guest => matchesQuery(guest, query)) : members;
  const count = members.length;
  const over = isGroupOverCapacity(count);

  return (
    <article className={`group-card${over ? ' is-over' : ''}`}>
      <div className="panel-head">
        <h3>{name}</h3>
        <span className={`count${over ? ' is-over' : ''}`}>{count}/{GROUP_CAPACITY}</span>
      </div>
      {over && (
        <p className="over" role="alert">
          {count} people in a group of {GROUP_CAPACITY}. Move or remove {count - GROUP_CAPACITY} before adding anyone else.
        </p>
      )}
      {renaming ? (
        <form
          className="rename-row"
          onSubmit={event => {
            event.preventDefault();
            const next = draft.trim();
            if (next) onRename(next);
            setRenaming(false);
          }}
        >
          <input aria-label={`Rename ${name}`} value={draft} onChange={event => setDraft(event.target.value)} />
          <button type="submit">Save</button>
          <button type="button" onClick={() => { setDraft(name); setRenaming(false); }}>Cancel</button>
        </form>
      ) : (
        <div className="group-tools">
          <button type="button" className="quiet" onClick={() => { setDraft(name); setRenaming(true); }}>Rename</button>
          {members.length === 0 && (
            <button type="button" className="quiet" onClick={onRemoveGroup}>Remove group</button>
          )}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="empty">{members.length === 0 ? 'No one yet.' : 'No names match that search.'}</p>
      ) : (
        <ul className="member-list">
          {visible.map(guest => (
            <li key={guest.id} className="person">
              <span className="person-name">{guest.name}</span>
              <button type="button" onClick={() => onMove(guest.id)} aria-label={`Move ${guest.name}`}>Move</button>
              <button type="button" onClick={() => onRemove(guest.id)} aria-label={`Remove ${guest.name}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function matchesQuery(guest: Guest, query: string): boolean {
  if (!query) return true;
  return guest.name.toLowerCase().includes(query) || (guest.familyGroup ?? '').toLowerCase().includes(query);
}

function unassignedCount(data: WeddingData): number {
  return data.guests.filter(guest => guest.tableId === null).length;
}

function weddingFromText(text: string): WeddingData | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const accepted = acceptGuestPayload(parsed);
    if (accepted.ok) return accepted.wedding;
  } catch {
    // Fall through to CSV.
  }
  const csv = parseCSV(text);
  if (!csv) return null;
  const accepted = acceptGuestPayload(csv);
  return accepted.ok ? accepted.wedding : null;
}
