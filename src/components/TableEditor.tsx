import { useState, useEffect, useRef } from 'react';
import type { Table } from '../types';
import type { WeddingStateReturn } from '../hooks/useWeddingState';

interface TableEditorProps {
  table: Table;
  dispatch: WeddingStateReturn['dispatch'];
  guestsAtTable: number;
  onClose: () => void;
}

export function TableEditor({ table, dispatch, guestsAtTable, onClose }: TableEditorProps) {
  const [name, setName] = useState(table.name);
  const [capacity, setCapacity] = useState(table.capacity);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  
  const handleSave = () => {
    if (capacity < guestsAtTable) {
      alert(`Cannot reduce capacity below ${guestsAtTable} (current guests seated)`);
      return;
    }
    
    dispatch({
      type: 'UPDATE_TABLE',
      tableId: table.id,
      updates: { name: name.trim() || table.name, capacity },
    });
    onClose();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  
  return (
    <div 
      className="table-editor-inline"
      style={{
        left: table.x + 50,
        top: table.y,
      }}
      onClick={e => e.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      <div className="form-group">
        <label className="form-label" htmlFor="table-name">Name</label>
        <input
          ref={inputRef}
          id="table-name"
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>
      
      <div className="form-group">
        <label className="form-label" htmlFor="table-capacity">
          Capacity (min: {guestsAtTable})
        </label>
        <input
          id="table-capacity"
          type="number"
          className="form-input"
          value={capacity}
          onChange={e => setCapacity(Math.max(guestsAtTable, parseInt(e.target.value) || 1))}
          min={guestsAtTable}
          max={30}
        />
      </div>
      
      <div className="form-group">
        <span className="form-label">Move</span>
        <div className="nudge-grid" role="group" aria-label="Move table">
          <button type="button" className="toolbar-btn" onClick={() => dispatch({ type: 'UPDATE_TABLE', tableId: table.id, updates: { y: Math.max(70, table.y - 20) } })} aria-label="Move table up">↑</button>
          <button type="button" className="toolbar-btn" onClick={() => dispatch({ type: 'UPDATE_TABLE', tableId: table.id, updates: { x: Math.max(80, table.x - 20) } })} aria-label="Move table left">←</button>
          <button type="button" className="toolbar-btn" onClick={() => dispatch({ type: 'UPDATE_TABLE', tableId: table.id, updates: { x: Math.min(720, table.x + 20) } })} aria-label="Move table right">→</button>
          <button type="button" className="toolbar-btn" onClick={() => dispatch({ type: 'UPDATE_TABLE', tableId: table.id, updates: { y: Math.min(760, table.y + 20) } })} aria-label="Move table down">↓</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="toolbar-btn primary" onClick={handleSave}>
          Save
        </button>
        <button className="toolbar-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
