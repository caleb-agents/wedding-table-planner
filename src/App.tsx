import { useCallback, useEffect, useState } from 'react';
import { useWeddingState } from './hooks/useWeddingState';
import { useMediaQuery } from './hooks/useMediaQuery';
import { Venue } from './components/Venue';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { ImportModal } from './components/ImportModal';
import { OnboardingPanel } from './components/OnboardingPanel';
import { PrintView } from './components/PrintView';
import { TableEditor } from './components/TableEditor';
import { TablePickerSheet } from './components/TablePickerSheet';
import { TableDetailSheet } from './components/TableDetailSheet';
import { AddGuestsSheet } from './components/AddGuestsSheet';
import { GuestPanel, MobileTabBar, TablePanel } from './components/MobilePanels';
import { OverflowMenu } from './components/OverflowMenu';
import type { WeddingData } from './types';
import { formatWeddingDate } from './utils/dates';
import { generateId } from './utils/ids';
import { downloadFile, exportSeatingToCSV, exportToJSON } from './utils/storage';
import './styles/pixel-art.css';

type MobileTab = 'guests' | 'tables' | 'venue';

function App() {
  const {
    state,
    dispatch,
    statistics,
    filteredGuests,
    filteredUnseatedGuests,
    getGuestsAtTable,
    getTableCapacityInfo,
    canAssignGuest,
    canAssignGroup,
    getFamilyGroups,
  } = useWeddingState();

  const isMobile = useMediaQuery('(max-width: 899px)');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: boolean } | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('guests');
  const [showMore, setShowMore] = useState(false);
  const [pickerGuestId, setPickerGuestId] = useState<string | null>(null);
  const [detailTableId, setDetailTableId] = useState<string | null>(null);
  const [addGuestsTableId, setAddGuestsTableId] = useState<string | null>(null);

  const showToast = useCallback((message: string, undo = false) => {
    setToast({ text: message, undo });
    window.setTimeout(() => setToast(current => (current?.text === message ? null : current)), 5000);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      document.documentElement.style.setProperty('--vvh', `${viewport.height}px`);
    };
    sync();
    viewport.addEventListener('resize', sync);
    return () => viewport.removeEventListener('resize', sync);
  }, []);

  const sheetOpen = Boolean(pickerGuestId || detailTableId || addGuestsTableId || showMore || showImportModal || showResetConfirm);
  useEffect(() => {
    document.body.classList.toggle('sheet-open', sheetOpen);
    return () => document.body.classList.remove('sheet-open');
  }, [sheetOpen]);

  const handleImport = useCallback((data: WeddingData) => {
    dispatch({ type: 'IMPORT_DATA', data });
    setMobileTab('guests');
    setPickerGuestId(null);
    setDetailTableId(null);
  }, [dispatch]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET_TO_DEMO' });
    setShowResetConfirm(false);
    setEditingTableId(null);
    setPickerGuestId(null);
    setDetailTableId(null);
    setMobileTab('guests');
  }, [dispatch]);

  const tableById = useCallback((tableId: string | null) => (
    tableId ? state.data.tables.find(table => table.id === tableId) ?? null : null
  ), [state.data.tables]);

  const seatGuest = useCallback((guestId: string, tableId: string) => {
    const guest = state.data.guests.find(item => item.id === guestId);
    const table = tableById(tableId);
    if (!guest || !table) return;
    if (!canAssignGuest(guestId, tableId)) {
      showToast(`${table.name} is full. Pick another table or raise its capacity.`);
      return;
    }
    const previous = tableById(guest.tableId)?.name;
    dispatch({ type: 'ASSIGN_GUEST', guestId, tableId });
    setPickerGuestId(null);
    showToast(previous && previous !== table.name
      ? `Moved ${guest.name} from ${previous} to ${table.name}`
      : `Seated ${guest.name} at ${table.name}`, true);
  }, [canAssignGuest, dispatch, showToast, state.data.guests, tableById]);

  const unseatGuest = useCallback((guestId: string) => {
    const guest = state.data.guests.find(item => item.id === guestId);
    if (!guest) return;
    dispatch({ type: 'UNASSIGN_GUEST', guestId });
    setPickerGuestId(null);
    showToast(`Unseated ${guest.name}`, true);
  }, [dispatch, showToast, state.data.guests]);

  const seatFamily = useCallback((guestId: string, tableId: string) => {
    const guest = state.data.guests.find(item => item.id === guestId);
    const table = tableById(tableId);
    if (!guest?.familyGroup || !table) return;
    if (!canAssignGroup(guest.familyGroup, tableId)) {
      showToast(`${table.name} does not have room for ${guest.familyGroup}.`);
      return;
    }
    dispatch({ type: 'ASSIGN_GROUP', groupId: guest.familyGroup, tableId });
    setPickerGuestId(null);
    showToast(`Seated ${guest.familyGroup} at ${table.name}`, true);
  }, [canAssignGroup, dispatch, showToast, state.data.guests, tableById]);

  const seatMany = useCallback((guestIds: string[], tableId: string) => {
    const table = tableById(tableId);
    if (!table || guestIds.length === 0) return;
    const open = table.capacity - getGuestsAtTable(table.id).length;
    const moving = guestIds.filter(guestId => state.data.guests.find(guest => guest.id === guestId)?.tableId !== tableId);
    if (moving.length > open) {
      showToast(`${table.name} only has ${open} open ${open === 1 ? 'seat' : 'seats'}.`);
      return;
    }
    dispatch({ type: 'ASSIGN_GUESTS', guestIds, tableId });
    setAddGuestsTableId(null);
    showToast(`Seated ${moving.length} ${moving.length === 1 ? 'guest' : 'guests'} at ${table.name}`, true);
  }, [dispatch, getGuestsAtTable, showToast, state.data.guests, tableById]);

  const addTable = useCallback(() => {
    const table = {
      id: generateId('table'),
      name: `Table ${state.data.tables.length + 1}`,
      capacity: 10,
      x: 200 + (state.data.tables.length % 4) * 140,
      y: 240 + Math.floor(state.data.tables.length / 4) * 150,
      type: 'round' as const,
    };
    dispatch({ type: 'ADD_TABLE', table });
    setDetailTableId(table.id);
    setMobileTab('tables');
    showToast(`Added ${table.name}`);
  }, [dispatch, showToast, state.data.tables.length]);

  const backup = () => {
    downloadFile(exportToJSON(state.data), `wedding-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };
  const exportCsv = () => {
    downloadFile(exportSeatingToCSV(state.data), `seating-plan-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const pickerGuest = state.data.guests.find(guest => guest.id === pickerGuestId) ?? null;
  const detailTable = tableById(detailTableId);
  const addTableTarget = tableById(addGuestsTableId);
  const selectedTable = editingTableId ? tableById(editingTableId) : null;
  const familyMembers = pickerGuest?.familyGroup
    ? state.data.guests.filter(guest => guest.familyGroup === pickerGuest.familyGroup)
    : [];

  const notice = toast ? (
    <div className="toast confirm-toast" role="status" aria-live="polite">
      <span>{toast.text}</span>
      {toast.undo && (
        <button type="button" className="toast-undo" onClick={() => { dispatch({ type: 'UNDO' }); setToast(null); }}>
          Undo
        </button>
      )}
    </div>
  ) : null;

  const sheets = (
    <>
      {pickerGuest && (
        <TablePickerSheet
          guest={pickerGuest}
          tables={state.data.tables}
          tableName={tableId => tableById(tableId)?.name ?? null}
          getCapacity={getTableCapacityInfo}
          familySize={familyMembers.length}
          familyFitsTable={tableId => pickerGuest.familyGroup ? canAssignGroup(pickerGuest.familyGroup, tableId) : false}
          onSeat={tableId => seatGuest(pickerGuest.id, tableId)}
          onSeatFamily={tableId => seatFamily(pickerGuest.id, tableId)}
          onUnseat={() => unseatGuest(pickerGuest.id)}
          onClose={() => setPickerGuestId(null)}
        />
      )}
      {detailTable && !addTableTarget && (
        <TableDetailSheet
          table={detailTable}
          guests={getGuestsAtTable(detailTable.id).sort((a, b) => a.name.localeCompare(b.name))}
          onUnseat={unseatGuest}
          onAddGuests={() => setAddGuestsTableId(detailTable.id)}
          onSave={updates => {
            dispatch({ type: 'UPDATE_TABLE', tableId: detailTable.id, updates });
            showToast(`Updated ${updates.name}`);
          }}
          onRemove={() => {
            dispatch({ type: 'REMOVE_TABLE', tableId: detailTable.id });
            setDetailTableId(null);
            showToast(`Removed ${detailTable.name}`);
          }}
          onClose={() => setDetailTableId(null)}
        />
      )}
      {addTableTarget && (
        <AddGuestsSheet
          table={addTableTarget}
          openSeats={Math.max(0, addTableTarget.capacity - getGuestsAtTable(addTableTarget.id).length)}
          guests={state.data.guests}
          onSeat={guestIds => seatMany(guestIds, addTableTarget.id)}
          onClose={() => setAddGuestsTableId(null)}
        />
      )}
      {showMore && (
        <OverflowMenu
          onClose={() => setShowMore(false)}
          onImport={() => setShowImportModal(true)}
          onBackup={backup}
          onExportCsv={exportCsv}
          onPrint={() => window.print()}
          onAddTable={addTable}
          onReset={() => setShowResetConfirm(true)}
        />
      )}
    </>
  );

  return (
    <div className={`app ${isMobile ? 'is-mobile' : 'is-desktop'}`}>
      <header className="app-header">
        <h1 className="app-title">
          💒 {state.data.name}
          {state.data.isDemo && <span className="demo-badge">Demo Data</span>}
        </h1>
        {state.data.weddingDate && (
          <span className="wedding-date">{formatWeddingDate(state.data.weddingDate)}</span>
        )}
      </header>

      {isMobile ? (
        <div className="mobile-toolbar" role="toolbar" aria-label="Actions">
          <button type="button" className="toolbar-btn" disabled={state.undoStack.length === 0} onClick={() => dispatch({ type: 'UNDO' })}>Undo</button>
          <button type="button" className="toolbar-btn" disabled={state.redoStack.length === 0} onClick={() => dispatch({ type: 'REDO' })}>Redo</button>
          <button type="button" className="toolbar-btn" onClick={() => setShowMore(true)} aria-haspopup="dialog">More</button>
        </div>
      ) : (
        <Toolbar
          state={state}
          dispatch={dispatch}
          onImportClick={() => setShowImportModal(true)}
          onResetClick={() => setShowResetConfirm(true)}
          onEditTable={() => {
            if (state.selectedTableId) setEditingTableId(state.selectedTableId);
          }}
        />
      )}

      {state.data.suggestedTables && !state.data.isDemo && (
        <div className="suggestion-banner" role="status">
          <div>
            <strong>Suggested starting layout.</strong> These table sizes are an editable guess, not a record of the venue. Nobody was seated automatically.
          </div>
          <button className="toolbar-btn" type="button" onClick={() => dispatch({ type: 'DISMISS_TABLE_SUGGESTION' })}>
            Got it
          </button>
        </div>
      )}

      {isMobile ? (
        <main className="mobile-stage">
          {mobileTab === 'guests' && (
            <GuestPanel
              state={state}
              dispatch={dispatch}
              guests={filteredGuests}
              statistics={statistics}
              onGuest={guestId => { setDetailTableId(null); setAddGuestsTableId(null); setPickerGuestId(guestId); }}
              onImport={() => setShowImportModal(true)}
            />
          )}
          {mobileTab === 'tables' && (
            <TablePanel
              tables={state.data.tables}
              getCapacity={getTableCapacityInfo}
              onTable={tableId => { setPickerGuestId(null); setAddGuestsTableId(null); setDetailTableId(tableId); }}
              onAddTable={addTable}
            />
          )}
          {mobileTab === 'venue' && (
            <div className="mobile-venue-wrap">
              <p className="venue-note">Overview only. Tap a table to see who is seated and add guests.</p>
              <Venue
                state={state}
                dispatch={dispatch}
                getGuestsAtTable={getGuestsAtTable}
                getTableCapacityInfo={getTableCapacityInfo}
                canAssignGuest={canAssignGuest}
                canAssignGroup={canAssignGroup}
                onEditTable={setDetailTableId}
                onCapacityWarning={showToast}
                onInspectTable={tableId => { setPickerGuestId(null); setAddGuestsTableId(null); setDetailTableId(tableId); }}
              />
            </div>
          )}
        </main>
      ) : (
        <>
          {state.data.isDemo && (
            <div style={{ padding: '0 20px 20px' }}>
              <OnboardingPanel onImportClick={() => setShowImportModal(true)} isDemo={state.data.isDemo} />
            </div>
          )}
          <main className="app-layout">
            <div className="venue-column">
              <Venue
                state={state}
                dispatch={dispatch}
                getGuestsAtTable={getGuestsAtTable}
                getTableCapacityInfo={getTableCapacityInfo}
                canAssignGuest={canAssignGuest}
                canAssignGroup={canAssignGroup}
                onEditTable={setEditingTableId}
                onCapacityWarning={showToast}
              />
              {selectedTable && (
                <TableEditor
                  table={selectedTable}
                  dispatch={dispatch}
                  guestsAtTable={getGuestsAtTable(selectedTable.id).length}
                  onClose={() => setEditingTableId(null)}
                />
              )}
              <p className="desktop-hint">
                Select a guest, then a table. You can also drag a guest or a family group onto a table.
              </p>
            </div>
            <Sidebar
              state={state}
              dispatch={dispatch}
              statistics={statistics}
              filteredUnseatedGuests={filteredUnseatedGuests}
              getFamilyGroups={getFamilyGroups}
            />
          </main>
        </>
      )}

      {isMobile && <MobileTabBar tab={mobileTab} onChange={setMobileTab} />}

      <PrintView data={state.data} />
      <ImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={handleImport} />
      {notice}
      {sheets}

      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <h2 id="reset-title" className="modal-title">Reset to sample data?</h2>
            <p className="modal-text">
              This replaces the seating plan in this browser with the fictional sample wedding.
              {!state.data.isDemo && (
                <strong style={{ display: 'block', marginTop: '12px', color: '#e74c3c' }}>
                  Your imported guest list will be removed. Download a backup first if you want to keep it.
                </strong>
              )}
            </p>
            <div className="modal-actions">
              <button className="toolbar-btn" type="button" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="toolbar-btn danger" type="button" onClick={handleReset} style={{ background: '#e74c3c', borderColor: '#e74c3c', color: 'white' }}>
                Reset to sample
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
