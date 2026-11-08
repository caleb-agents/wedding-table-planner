import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Guest, WeddingData } from './types';
import { useWeddingState } from './hooks/useWeddingState';
import { useSharedSync, type SharedSync } from './shared/useSharedSync';
import { applyRemotePlan, assignmentsDiffer, decideSync, localImportPayload } from './shared/sync';
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
  if (import.meta.env.VITE_CONVEX_URL) {
    return (
      <SharedBoundary>
        <ConnectedPlanner />
      </SharedBoundary>
    );
  }
  return <Planner sync={null} />;
}

function ConnectedPlanner() {
  const sync = useSharedSync();
  return <Planner sync={sync} />;
}

class SharedBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <Planner sync={null} offlineNote="The shared plan is unavailable. Showing this browser’s plan. Nothing was uploaded." />;
    }
    return this.props.children;
  }
}

function Planner({ sync, offlineNote }: { sync: SharedSync | null; offlineNote?: string }) {
  const { state, dispatch, fragmentStartup } = useWeddingState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
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
  const localAtStart = useRef(state.data);
  const appliedRemote = useRef('');
  const notedDifference = useRef(false);
  const [offerImport, setOfferImport] = useState(false);
  const [importDismissed, setImportDismissed] = useState(false);
  const [keptLocalNote, setKeptLocalNote] = useState(false);

  useEffect(() => {
    if (!sync?.remote || sync.remote.groups.length === 0) return;
    const decision = decideSync({
      remoteReady: true,
      remoteAssignmentCount: sync.remote.assignments.length,
      localAssignmentCount: localAtStart.current.assignments.length,
    });
    if (decision.offerImport && !importDismissed) setOfferImport(true);
    if (!decision.offerImport) setOfferImport(false);
    const signature = JSON.stringify(sync.remote);
    if (appliedRemote.current === signature) return;
    appliedRemote.current = signature;
    dispatch({ type: 'APPLY_REMOTE', data: applyRemotePlan(sync.remote) });
    if (!notedDifference.current && !decision.offerImport && localAtStart.current.assignments.length > 0 && assignmentsDiffer(localAtStart.current, sync.remote)) {
      notedDifference.current = true;
      setKeptLocalNote(true);
    }
  }, [sync?.remote, importDismissed, dispatch]);

  const { data } = state;
  const query = state.searchQuery.trim().toLowerCase();
  const unassigned = data.guests
    .filter(guest => guest.tableId === null)
    .filter(guest => matchesQuery(guest, query))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const groups = sortedGroups(data.tables);
  const chooserGuest = chooser ? data.guests.find(guest => guest.id === chooser.guestId) ?? null : null;
  const openGroup = openGroupId ? groups.find(group => group.id === openGroupId) ?? null : null;

  function offerListImport(next: WeddingData) {
    if (sync) {
      setNotice('The shared plan was not replaced. A file or link stays on this device, and it is not uploaded automatically.');
      return;
    }
    if (shouldConfirmReplace(data)) {
      setPending(next);
      return;
    }
    dispatch({ type: 'IMPORT_DATA', data: next });
    setNotice('Guest list loaded on this device.');
    setStatus('');
  }

  async function sendLocalAssignments() {
    if (!sync) return;
    const allowed = new Set(createPublicWedding().guests.map(guest => guest.id));
    try {
      await sync.importLocal(localImportPayload(localAtStart.current, allowed));
      setOfferImport(false);
      setStatus('Imported this browser’s assignments into the shared plan.');
    } catch {
      setStatus('');
    }
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
      offerListImport(wedding);
    };
    reader.onerror = () => {
      setNotice('That file could not be read. Your saved list was not changed.');
    };
    reader.readAsText(file);
  }

  async function assignTo(guest: Guest, groupId: string) {
    const group = data.tables.find(table => table.id === groupId);
    if (!group || guest.tableId === groupId) return;
    const count = groupCount(data.guests, groupId);
    if (isGroupFull(count) || isGroupOverCapacity(count)) return;
    if (sync) {
      try {
        await sync.assign(guest.id, groupId, guest.tableId);
        setChooser(null);
        setStatus(`Moved ${guest.name} to ${group.name}.`);
      } catch {
        setStatus('');
      }
      return;
    }
    dispatch({ type: 'ASSIGN_GUEST', guestId: guest.id, tableId: groupId });
    setChooser(null);
    setStatus(`Moved ${guest.name} to ${group.name}.`);
  }

  async function returnGuest(guest: Guest) {
    if (sync) {
      if (!guest.tableId) return;
      try {
        await sync.unseat(guest.id, guest.tableId);
        setChooser(null);
        setStatus(`Returned ${guest.name} to unassigned.`);
      } catch {
        setStatus('');
      }
      return;
    }
    dispatch({ type: 'UNASSIGN_GUEST', guestId: guest.id });
    setChooser(null);
    setStatus(`Returned ${guest.name} to unassigned.`);
  }

  function connectionStatus(): string {
    if (offlineNote) return offlineNote;
    if (!sync) return status || 'Saved on this device.';
    if (sync.offline) return 'Offline. Showing the last shared plan on this browser. New changes are not being uploaded.';
    if (sync.phase === 'syncing' || sync.remote === undefined) return 'Syncing the shared plan…';
    if (sync.phase === 'saving') return 'Saving…';
    if (sync.phase === 'error') return sync.detail || 'Not saved. The shared plan did not accept that change.';
    return status || 'Saved to the shared plan.';
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
          <p className="hint">{sync
            ? 'These guest names are public. Assignments are on a shared public plan anyone with this page can change.'
            : 'These guest names are public. Assignments stay in this browser.'}</p>
          <p className="status" role="status">{connectionStatus()}</p>
          {keptLocalNote && <p className="hint">Showing the shared plan. Assignments saved in this browser were not uploaded.</p>}
        </div>
        <div className="toolbar">
          <button type="button" onClick={() => { if (sync) void sync.undo(); else dispatch({ type: 'UNDO' }); }} disabled={sync ? !sync.canUndo : state.undoStack.length === 0}>
            Undo
          </button>
          <button type="button" onClick={() => { if (sync) void sync.redo(); else dispatch({ type: 'REDO' }); }} disabled={sync ? !sync.canRedo : state.redoStack.length === 0}>
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

      {offerImport && (
        <div className="notice">
          <p>This browser has assignments that are not on the shared plan. Import them only if the shared plan should use this browser’s groups.</p>
          <div className="backup-actions">
            <button type="button" onClick={() => void sendLocalAssignments()}>Import assignments from this browser</button>
            <button type="button" className="quiet" onClick={() => { setOfferImport(false); setImportDismissed(true); }}>Keep the shared plan</button>
          </div>
        </div>
      )}

      <div className="layout">
        <section className="panel" aria-labelledby="groups-heading">
          <div className="panel-head">
            <h2 id="groups-heading">Tables</h2>
            <span className="count">{groups.length}</span>
          </div>
          <div className="group-list">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                groupId={group.id}
                name={group.name}
                guests={data.guests}
                onOpen={() => setOpenGroupId(group.id)}
                onRename={nextName => {
                  if (!sync) {
                    dispatch({ type: 'UPDATE_TABLE', tableId: group.id, updates: { name: nextName } });
                    return;
                  }
                  void sync.rename(group.id, nextName, group.name).then(
                    () => setStatus(`Renamed ${group.name}.`),
                    () => setStatus(''),
                  );
                }}
                onRemoveGroup={() => {
                  if (openGroupId === group.id) setOpenGroupId(null);
                  if (!sync) {
                    dispatch({ type: 'REMOVE_TABLE', tableId: group.id });
                    return;
                  }
                  const sort = data.tables.findIndex(table => table.id === group.id) + 1;
                  void sync.removeGroup(group.id, group.name, sort).catch(() => setStatus(''));
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="texty add-group"
            onClick={() => {
              const table = {
                id: generateId('group'),
                name: nextGroupName(data.tables),
                capacity: GROUP_CAPACITY,
                x: 0,
                y: 0,
                type: 'round' as const,
              };
              if (!sync) {
                dispatch({ type: 'ADD_TABLE', table });
                return;
              }
              void sync.addGroup(table.id, table.name, data.tables.length + 1).catch(() => setStatus(''));
            }}
          >
            Add group
          </button>
        </section>

        <details className="guest-fold">
          <summary>
            <span className="fold-title">Guest list</span>
            <span className="count">{data.guests.length} names · {unassignedCount(data)} unassigned</span>
          </summary>
          <section className="guest-fold-body" aria-labelledby="unassigned-heading">
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
        </details>
      </div>

      <details className="backup">
        <summary>Backup and import</summary>
        <div className="backup-actions">
          <button type="button" className="quiet" onClick={() => offerListImport(createPublicWedding())}>Load wedding list</button>
          <button type="button" className="quiet" onClick={() => fileRef.current?.click()}>Import file</button>
          <button type="button" className="quiet" onClick={() => downloadFile(exportToJSON(data), 'group-planner-backup.json', 'application/json')}>
            Download backup
          </button>
          <button type="button" className="quiet" onClick={() => downloadFile(exportSeatingToCSV(data), 'groups.csv', 'text/csv')}>
            Download CSV
          </button>
        </div>
        <p className="hint">{sync
          ? 'Guest names on this page are published. The shared plan is public. A file or private link stays on this device and is not uploaded automatically.'
          : 'Guest names on this page are published with the site. Assignments stay on this device. Import file and a private link still work if you need another list.'}</p>
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

      {openGroup && (
        <GroupPanel
          group={openGroup}
          guests={data.guests}
          groupName={groupId => data.tables.find(table => table.id === groupId)?.name ?? 'another group'}
          onClose={() => setOpenGroupId(null)}
          onAdd={guest => assignTo(guest, openGroup.id)}
          onRemove={returnGuest}
          onMove={guestId => setChooser({ guestId, mode: 'move' })}
        />
      )}

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
                  if (sync) {
                    setPending(null);
                    setNotice('The shared plan was not replaced.');
                    return;
                  }
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
  onOpen,
  onRename,
  onRemoveGroup,
}: {
  groupId: string;
  name: string;
  guests: Guest[];
  onOpen: () => void;
  onRename: (name: string) => void;
  onRemoveGroup: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(name);
  const members = guestsInGroup(guests, groupId);
  const count = members.length;
  const over = isGroupOverCapacity(count);
  const full = isGroupFull(count);

  return (
    <article className={`group-card${over ? ' is-over' : ''}`}>
      <button type="button" className="table-open" aria-label={`Open ${name}`} onClick={onOpen}>
        <span className="panel-head">
          <span className="table-name" role="heading" aria-level={3}>{name}</span>
          <span className={`count${over ? ' is-over' : ''}`}>{count}/{GROUP_CAPACITY}{full && !over ? ' · Full' : ''}</span>
        </span>
        <span className="seated-names">
          {members.length === 0 ? 'No one yet' : members.map(guest => (
            <span key={guest.id} className="seated-name">{guest.name}</span>
          ))}
        </span>
        <span className="open-hint">Open</span>
      </button>
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
          <button type="submit" className="texty">Save</button>
          <button type="button" className="texty" onClick={() => { setDraft(name); setRenaming(false); }}>Cancel</button>
        </form>
      ) : (
        <div className="group-tools">
          <button type="button" className="texty" onClick={() => { setDraft(name); setRenaming(true); }}>Rename</button>
          {members.length === 0 && !confirming && (
            <button type="button" className="texty" onClick={() => setConfirming(true)}>Remove</button>
          )}
          {confirming && (
            <>
              <span className="confirm-copy">Remove this empty table?</span>
              <button type="button" className="texty danger" onClick={onRemoveGroup}>Remove table</button>
              <button type="button" className="texty" onClick={() => setConfirming(false)}>Cancel</button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function GroupPanel({
  group,
  guests,
  groupName,
  onClose,
  onAdd,
  onRemove,
  onMove,
}: {
  group: { id: string; name: string };
  guests: Guest[];
  groupName: (groupId: string) => string;
  onClose: () => void;
  onAdd: (guest: Guest) => void;
  onRemove: (guest: Guest) => void;
  onMove: (guestId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  const members = guestsInGroup(guests, group.id);
  const count = members.length;
  const full = isGroupFull(count);
  const over = isGroupOverCapacity(count);
  const needle = query.trim().toLowerCase();
  const others = guests
    .filter(guest => guest.tableId !== group.id)
    .filter(guest => !needle || matchesQuery(guest, needle))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const unassigned = others.filter(guest => guest.tableId === null);
  const seatedElsewhere = needle ? others.filter(guest => guest.tableId !== null) : [];

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet group-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-panel-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="group-panel-title">{group.name}</h2>
          <span className={`count${over ? ' is-over' : ''}`}>{count}/{GROUP_CAPACITY}{full && !over ? ' · Full' : ''}</span>
          <button type="button" className="quiet" onClick={onClose}>Close</button>
        </div>
        {full && !over && <p className="full-note">This group is full.</p>}
        {over && (
          <p className="over" role="alert">
            {count} people in a group of {GROUP_CAPACITY}. Remove {count - GROUP_CAPACITY} before adding anyone else.
          </p>
        )}
        <h3 className="panel-label">In this group</h3>
        {members.length === 0 ? (
          <p className="empty">No one yet.</p>
        ) : (
          <ul className="member-well">
            {members.map(guest => (
              <li key={guest.id} className="person">
                <span className="person-name">{guest.name}</span>
                <button type="button" onClick={() => onMove(guest.id)} aria-label={`Move ${guest.name}`}>Move</button>
                <button type="button" onClick={() => onRemove(guest)} aria-label={`Remove ${guest.name}`}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={searchRef}
          className="search"
          type="search"
          value={query}
          placeholder="Search names to add"
          aria-label={`Search names to add to ${group.name}`}
          onChange={event => setQuery(event.target.value)}
        />
        <div className="panel-results">
          {unassigned.length === 0 && seatedElsewhere.length === 0 ? (
            <p className="empty">{needle ? 'No names match that search.' : 'Everyone else is already in a group.'}</p>
          ) : (
            <ul className="name-list">
              {unassigned.map(guest => (
                <li key={guest.id} className="person one-action">
                  <span>
                    <span className="person-name">{guest.name}</span>
                    <span className="meta">Unassigned</span>
                  </span>
                  <button
                    type="button"
                    className="add-name"
                    disabled={full}
                    aria-label={`Add ${guest.name} to ${group.name}`}
                    onClick={() => onAdd(guest)}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
          {seatedElsewhere.length > 0 && (
            <>
              <h3 className="panel-label">Already in a group</h3>
              <ul className="name-list">
                {seatedElsewhere.map(guest => {
                  const current = groupName(guest.tableId as string);
                  return (
                    <li key={guest.id} className="person one-action">
                      <span>
                        <span className="person-name">{guest.name}</span>
                        <span className="meta">In {current}</span>
                      </span>
                      <button
                        type="button"
                        className="quiet"
                        disabled={full}
                        aria-label={`Move ${guest.name} from ${current} to ${group.name}`}
                        onClick={() => onAdd(guest)}
                      >
                        Move here
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
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
