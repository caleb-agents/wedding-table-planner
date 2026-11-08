import type { WeddingStateReturn } from '../hooks/useWeddingState';
import { generateId } from '../utils/ids';
import { exportToJSON, exportSeatingToCSV, downloadFile } from '../utils/storage';

interface ToolbarProps {
  state: WeddingStateReturn['state'];
  dispatch: WeddingStateReturn['dispatch'];
  onImportClick: () => void;
  onResetClick: () => void;
  onEditTable: () => void;
}

export function Toolbar({ state, dispatch, onImportClick, onResetClick, onEditTable }: ToolbarProps) {
  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;
  
  const handleAddTable = () => {
    const newTable = {
      id: generateId('table'),
      name: `Table ${state.data.tables.length + 1}`,
      capacity: 10,
      x: 400,
      y: 400,
      type: 'round' as const,
    };
    dispatch({ type: 'ADD_TABLE', table: newTable });
  };
  
  const handleRemoveTable = () => {
    if (state.selectedTableId) {
      const table = state.data.tables.find(t => t.id === state.selectedTableId);
      const guestsAtTable = state.data.guests.filter(g => g.tableId === state.selectedTableId);
      
      if (guestsAtTable.length > 0) {
        if (!confirm(`Remove ${table?.name}? ${guestsAtTable.length} guests will be unseated.`)) {
          return;
        }
      }
      
      dispatch({ type: 'REMOVE_TABLE', tableId: state.selectedTableId });
    }
  };
  
  const handleExportJSON = () => {
    const json = exportToJSON(state.data);
    const filename = `wedding-backup-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(json, filename, 'application/json');
  };
  
  const handleExportCSV = () => {
    const csv = exportSeatingToCSV(state.data);
    const filename = `seating-plan-${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(csv, filename, 'text/csv');
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  return (
    <div className="toolbar" role="toolbar" aria-label="Actions">
      <button
        className="toolbar-btn"
        onClick={() => dispatch({ type: 'UNDO' })}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        ↩️ Undo
      </button>
      
      <button
        className="toolbar-btn"
        onClick={() => dispatch({ type: 'REDO' })}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪️ Redo
      </button>
      
      <div style={{ width: '1px', height: '24px', background: 'var(--color-border-soft)' }} />
      
      <button
        className="toolbar-btn"
        onClick={handleAddTable}
        aria-label="Add table"
      >
        ➕ Add Table
      </button>
      
      <button
        className="toolbar-btn"
        onClick={onEditTable}
        disabled={!state.selectedTableId}
        aria-label="Edit selected table"
      >
        ✏️ Edit Table
      </button>

      <button
        className="toolbar-btn"
        onClick={handleRemoveTable}
        disabled={!state.selectedTableId}
        aria-label="Remove selected table"
      >
        ➖ Remove Table
      </button>
      
      <div style={{ width: '1px', height: '24px', background: 'var(--color-border-soft)' }} />
      
      <button
        className="toolbar-btn primary"
        onClick={onImportClick}
        aria-label="Import guest list"
      >
        📥 Import
      </button>
      
      <button
        className="toolbar-btn"
        onClick={handleExportJSON}
        aria-label="Export backup as JSON"
      >
        💾 Backup
      </button>
      
      <button
        className="toolbar-btn"
        onClick={handleExportCSV}
        aria-label="Export seating plan as CSV"
      >
        📊 Export CSV
      </button>
      
      <button
        className="toolbar-btn"
        onClick={handlePrint}
        aria-label="Print seating plan"
      >
        🖨️ Print
      </button>
      
      <div style={{ flex: 1 }} />
      
      <button
        className="toolbar-btn danger"
        onClick={onResetClick}
        aria-label="Reset to demo data"
      >
        🔄 Reset
      </button>
    </div>
  );
}
