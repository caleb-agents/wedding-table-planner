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

const MOTION_MS = 170;

function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  if (open && !mounted) {
    setMounted(true);
    setShown(true);
  }
  if (!open && shown) setShown(false);
  useEffect(() => {
    if (open || !mounted) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const timer = window.setTimeout(() => setMounted(false), reduce ? 0 : MOTION_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);
  return { mounted, shown };
}

function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href]')]
    .filter(node => !node.hasAttribute('disabled') && !node.hidden);
}

function trapTab(event: { key: string; shiftKey: boolean; preventDefault: () => void; currentTarget: HTMLElement }) {
  if (event.key !== 'Tab') return;
  const items = focusables(event.currentTarget);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || active === event.currentTarget)) {
    event.preventDefault();
    first.focus();
  }
}

function useDialogScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const y = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';
    const root = document.documentElement;
    const apply = () => {
      const viewport = window.visualViewport;
      root.style.setProperty('--vv-offset', `${viewport?.offsetTop ?? 0}px`);
      root.style.setProperty('--vv-height', `${viewport?.height ?? window.innerHeight}px`);
    };
    apply();
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);
    return () => {
      window.visualViewport?.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('scroll', apply);
      root.style.removeProperty('--vv-offset');
      root.style.removeProperty('--vv-height');
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo(0, y);
    };
  }, [open]);
}

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
  const groupLayer = usePresence(Boolean(openGroupId));
  const chooserLayer = usePresence(Boolean(chooser));
  const pendingLayer = usePresence(Boolean(pending));
  const groupOpener = useRef<HTMLElement | null>(null);
  const chooserOpener = useRef<HTMLElement | null>(null);
  const [heldGroup, setHeldGroup] = useState<{ id: string; name: string } | null>(null);
  const [heldChooser, setHeldChooser] = useState<Chooser | null>(null);
  useDialogScroll(groupLayer.mounted || chooserLayer.mounted || pendingLayer.mounted);

  useEffect(() => {
    if (groupLayer.mounted) return;
    groupOpener.current?.focus({ preventScroll: true });
    groupOpener.current = null;
  }, [groupLayer.mounted]);

  useEffect(() => {
    if (chooserLayer.mounted) return;
    chooserOpener.current?.focus({ preventScroll: true });
    chooserOpener.current = null;
  }, [chooserLayer.mounted]);

  useEffect(() => {
    if (!openGroupId && !chooser) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (chooser) setChooser(null);
      else setOpenGroupId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openGroupId, chooser]);

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
  const openGroup = openGroupId ? groups.find(group => group.id === openGroupId) ?? null : null;
  const panelGroup = openGroup ?? (groupLayer.mounted ? heldGroup : null);
  const panelChooser = chooser ?? (chooserLayer.mounted ? heldChooser : null);
  const panelChooserGuest = panelChooser ? data.guests.find(guest => guest.id === panelChooser.guestId) ?? null : null;

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
      <header className="context">
        <div className="context-top">
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
          </div>
          <div className="toolbar">
            <button type="button" onClick={() => { if (sync) void sync.undo(); else dispatch({ type: 'UNDO' }); }} disabled={sync ? !sync.canUndo : state.undoStack.length === 0}>
              Undo
            </button>
            <button type="button" onClick={() => { if (sync) void sync.redo(); else dispatch({ type: 'REDO' }); }} disabled={sync ? !sync.canRedo : state.redoStack.length === 0}>
              Redo
            </button>
          </div>
        </div>
          <p className="status" role="status">{connectionStatus()}</p>
          {keptLocalNote && <p className="status">Showing the shared plan. Assignments saved in this browser were not uploaded.</p>}
      </header>
      <div className="workspace">

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
                selected={openGroupId === group.id}
                onOpen={() => {
                  groupOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                  setHeldGroup({ id: group.id, name: group.name });
                  setOpenGroupId(group.id);
                }}
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
                    <button type="button" className="name-button" onClick={() => {
                      chooserOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                      const next = { guestId: guest.id, mode: 'assign' as const };
                      setHeldChooser(next);
                      setChooser(next);
                    }}>
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
          ? 'These guest names are public. Assignments are on a shared public plan anyone with this page can change. A file or private link stays on this device and is not uploaded automatically.'
          : 'These guest names are public. Assignments stay in this browser. Import file and a private link still work if you need another list.'}</p>
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
      </div>

      {groupLayer.mounted && panelGroup && (
        <GroupPanel
          shown={groupLayer.shown}
          group={panelGroup}
          guests={data.guests}
          groupName={groupId => data.tables.find(table => table.id === groupId)?.name ?? 'another group'}
          onClose={() => setOpenGroupId(null)}
          onAdd={guest => assignTo(guest, panelGroup.id)}
          onRemove={returnGuest}
          onMove={guestId => {
            chooserOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const next = { guestId, mode: 'move' as const };
            setHeldChooser(next);
            setChooser(next);
          }}
        />
      )}

      {chooserLayer.mounted && panelChooser && panelChooserGuest && (
        <div className={`overlay${chooserLayer.shown ? '' : ' is-closing'}`} onMouseDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }} onClick={() => setChooser(null)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chooser-title"
            tabIndex={-1}
            onClick={event => event.stopPropagation()}
            onKeyDown={trapTab}
          >
            <h2 id="chooser-title">Choose a group</h2>
            <p className="person-name">{panelChooserGuest.name}</p>
            <ul className="chooser-list">
              {panelChooser.mode === 'move' && (
                <li>
                  <button type="button" className="chooser-option" onClick={() => returnGuest(panelChooserGuest)}>
                    <span>Unassigned</span>
                  </button>
                </li>
              )}
              {groups.map(group => {
                const count = groupCount(data.guests, group.id);
                const here = panelChooserGuest.tableId === group.id;
                const blocked = !here && (isGroupFull(count) || isGroupOverCapacity(count));
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      className="chooser-option"
                      disabled={blocked || here}
                      onClick={() => assignTo(panelChooserGuest, group.id)}
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

      {pendingLayer.mounted && pending && (
        <div className={`overlay${pendingLayer.shown ? '' : ' is-closing'}`}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="replace-title" tabIndex={-1} onKeyDown={trapTab}>
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
  selected,
  onOpen,
  onRename,
  onRemoveGroup,
}: {
  groupId: string;
  name: string;
  guests: Guest[];
  selected: boolean;
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
    <article className={`group-card${over ? ' is-over' : ''}${selected ? ' is-selected' : ''}`}>
      <button type="button" className="table-open" aria-label={`Open ${name}`} aria-expanded={selected} onClick={onOpen}>
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
  shown,
  group,
  guests,
  groupName,
  onClose,
  onAdd,
  onRemove,
  onMove,
}: {
  shown: boolean;
  group: { id: string; name: string };
  guests: Guest[];
  groupName: (groupId: string) => string;
  onClose: () => void;
  onAdd: (guest: Guest) => void;
  onRemove: (guest: Guest) => void;
  onMove: (guestId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [freshId, setFreshId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [raised, setRaised] = useState(false);
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!freshId) return;
    const timer = window.setTimeout(() => setFreshId(null), MOTION_MS);
    return () => window.clearTimeout(timer);
  }, [freshId]);

  function onSearch(value: string) {
    setQuery(value);
    requestAnimationFrame(() => {
      const list = listRef.current;
      const results = resultsRef.current;
      if (!list || !results) return;
      if (!value.trim()) {
        if (list.scrollTop !== 0) list.scrollTop = 0;
        return;
      }
      const top = results.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
      const next = Math.max(0, top - 8);
      if (Math.abs(list.scrollTop - next) > 1) list.scrollTop = next;
    });
  }

  function keepSearch(action: () => void) {
    const search = searchRef.current;
    const restore = document.activeElement === search;
    action();
    if (!restore || !search) return;
    search.focus({ preventScroll: true });
    requestAnimationFrame(() => search.focus({ preventScroll: true }));
  }

  function addGuest(guest: Guest) {
    keepSearch(() => onAdd(guest));
    setFreshId(guest.id);
  }

  function onSearchKey(event: { key: string; preventDefault: () => void }) {
    if (event.key !== 'Enter') return;
    const button = resultsRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    if (!button || !query.trim()) return;
    event.preventDefault();
    button.click();
    searchRef.current?.focus({ preventScroll: true });
  }
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
    <div
      className={`overlay${shown ? '' : ' is-closing'}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="sheet group-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-panel-title"
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className={`sheet-bar${raised ? ' is-raised' : ''}`}>
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
          <input
            ref={searchRef}
            className="search"
            type="search"
            value={query}
            placeholder="Search names to add"
            aria-label={`Search names to add to ${group.name}`}
            onChange={event => onSearch(event.target.value)}
            onKeyDown={onSearchKey}
          />
        </div>
        <div
          className="sheet-scroll"
          ref={listRef}
          onScroll={event => setRaised(event.currentTarget.scrollTop > 0)}
        >
        <h3 className="panel-label">In this group</h3>
        {members.length === 0 ? (
          <p className="empty">No one yet.</p>
        ) : (
          <ul className="member-well">
            {members.map(guest => (
              <li key={guest.id} className={`person${freshId === guest.id ? ' is-fresh' : ''}`}>
                <span className="person-name">{guest.name}</span>
                <button type="button" onClick={() => onMove(guest.id)} aria-label={`Move ${guest.name}`}>Move</button>
                <button type="button" onClick={() => onRemove(guest)} aria-label={`Remove ${guest.name}`}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="panel-results" ref={resultsRef}>
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
                    onClick={() => addGuest(guest)}
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
                        onClick={() => addGuest(guest)}
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
