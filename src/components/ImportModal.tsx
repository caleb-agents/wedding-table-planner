import { useState, useRef, useCallback } from 'react';
import type { WeddingData } from '../types';
import { validateImportedData, validateWeddingData, convertImportedData, parseCSV } from '../utils/validation';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: WeddingData) => void;
}

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const processFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    
    try {
      const text = await file.text();
      let data: WeddingData;
      
      if (file.name.endsWith('.csv')) {
        const parsed = parseCSV(text);
        if (!parsed || parsed.guests.length === 0) {
          setError('Could not parse CSV file. Ensure it has a "name" column.');
          return;
        }
        data = convertImportedData(parsed);
      } else {
        const parsed = JSON.parse(text);
        
        if (validateImportedData(parsed)) {
          data = convertImportedData(parsed);
        } else if (validateWeddingData(parsed)) {
          data = parsed;
        } else {
          setError('Invalid file format. Expected wedding guest data with source, weddingDate, tables, and guests fields.');
          return;
        }
      }
      
      onImport(data);
      onClose();
    } catch (e) {
      setError(`Failed to read file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [onImport, onClose]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.json') || file.name.endsWith('.csv'))) {
      processFile(file);
    } else {
      setError('Please drop a .json or .csv file');
    }
  }, [processFile]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);
  
  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 id="import-modal-title" className="modal-title">Import Guest List</h2>
        
        <p className="modal-text">
          Import your private guest list from a JSON or CSV file. Your data is processed
          entirely in your browser and never uploaded anywhere. An empty tables list
          becomes an editable suggested layout. Guests stay unseated until you place them.
        </p>
        
        <div
          className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={handleZoneClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleZoneClick();
            }
          }}
          aria-label="Click or drop file to import"
        >
          <div className="file-drop-zone-icon">📁</div>
          <div><strong>Click to select</strong> or drag & drop</div>
          <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--color-text-secondary)' }}>
            Accepts .json or .csv files
          </div>
          {fileName && (
            <div style={{ marginTop: '12px', color: 'var(--color-selected)' }}>
              Selected: {fileName}
            </div>
          )}
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
        
        {error && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            background: '#fef2f2', 
            border: '2px solid #ef4444',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}
        
        <div className="privacy-notice">
          <strong>🔒 Your data stays private</strong>
          <p style={{ marginTop: '8px' }}>
            This app runs entirely in your browser. Guest data is stored only in your 
            browser's local storage and is never sent to any server, saved in git, 
            or included in any analytics.
          </p>
        </div>
        
        <details style={{ marginTop: '16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Expected JSON format</summary>
          <pre style={{ 
            marginTop: '8px', 
            padding: '12px', 
            background: '#f5f5f5', 
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '11px',
          }}>
{`{
  "source": { "fileId": "...", "name": "...", "tab": "..." },
  "weddingDate": "2027-01-23",
  "tables": [],
  "guests": [
    {
      "id": "unique-id",
      "name": "Guest Name",
      "side": "bride|groom|mutual|...",
      "sheetBlock": "Family|Friends|...",
      "isChild": false,
      "rsvp": "confirmed|unconfirmed|unknown",
      "tableId": null,
      "familyGroup": "Optional Family Name"
    }
  ]
}`}
          </pre>
        </details>
        
        <div className="modal-actions">
          <button className="toolbar-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
