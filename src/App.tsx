import { useState, useCallback } from 'react';
import { useWeddingState } from './hooks/useWeddingState';
import { Venue } from './components/Venue';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { ImportModal } from './components/ImportModal';
import { OnboardingPanel } from './components/OnboardingPanel';
import { PrintView } from './components/PrintView';
import { TableEditor } from './components/TableEditor';
import type { WeddingData } from './types';
import { formatWeddingDate } from './utils/dates';
import './styles/pixel-art.css';

function App() {
  const {
    state,
    dispatch,
    statistics,
    filteredUnseatedGuests,
    getGuestsAtTable,
    getTableCapacityInfo,
    canAssignGuest,
    canAssignGroup,
    getFamilyGroups,
  } = useWeddingState();
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  
  const handleImport = useCallback((data: WeddingData) => {
    dispatch({ type: 'IMPORT_DATA', data });
  }, [dispatch]);
  
  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET_TO_DEMO' });
    setShowResetConfirm(false);
    setEditingTableId(null);
  }, [dispatch]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);
  
  const selectedTable = editingTableId 
    ? state.data.tables.find(t => t.id === editingTableId) 
    : null;
  
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          💒 {state.data.name}
          {state.data.isDemo && <span className="demo-badge">Demo Data</span>}
        </h1>
        {state.data.weddingDate && (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {formatWeddingDate(state.data.weddingDate)}
          </span>
        )}
      </header>
      
      <Toolbar
        state={state}
        dispatch={dispatch}
        onImportClick={() => setShowImportModal(true)}
        onResetClick={() => setShowResetConfirm(true)}
        onEditTable={() => {
          if (state.selectedTableId) setEditingTableId(state.selectedTableId);
        }}
      />

      {state.data.suggestedTables && !state.data.isDemo && (
        <div className="suggestion-banner" role="status">
          <div>
            <strong>Suggested starting layout.</strong> These 14 tables of 10 and the head table of 12 are an editable guess, not a record of the venue. Nobody was seated automatically.
          </div>
          <button className="toolbar-btn" onClick={() => dispatch({ type: 'DISMISS_TABLE_SUGGESTION' })}>
            Got it
          </button>
        </div>
      )}
      
      {state.data.isDemo && (
        <div style={{ padding: '0 20px 20px' }}>
          <OnboardingPanel 
            onImportClick={() => setShowImportModal(true)}
            isDemo={state.data.isDemo}
          />
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
          
          <div style={{ 
            marginTop: '12px', 
            fontSize: '12px', 
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
          }}>
            Select a guest, then a table. On a larger screen you can also drag a guest or a family group onto a table.
            Drag a table to move it, or double-click it to rename and change capacity.
          </div>
        </div>
        
        <Sidebar
          state={state}
          dispatch={dispatch}
          statistics={statistics}
          filteredUnseatedGuests={filteredUnseatedGuests}
          getFamilyGroups={getFamilyGroups}
        />
      </main>
      
      <PrintView data={state.data} />
      
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
      
      {toast && (
        <div className="toast" role="status" aria-live="polite">{toast}</div>
      )}

      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Reset to Demo Data?</h2>
            <p className="modal-text">
              This will clear your current seating arrangements and guest data, 
              replacing it with the sample demo wedding.
              {!state.data.isDemo && (
                <strong style={{ display: 'block', marginTop: '12px', color: '#e74c3c' }}>
                  Your imported guest list will be removed. Consider exporting a backup first.
                </strong>
              )}
            </p>
            <div className="modal-actions">
              <button 
                className="toolbar-btn" 
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="toolbar-btn danger" 
                onClick={handleReset}
                style={{ 
                  background: '#e74c3c', 
                  borderColor: '#e74c3c', 
                  color: 'white' 
                }}
              >
                Reset to Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
