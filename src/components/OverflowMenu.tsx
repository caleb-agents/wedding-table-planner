import { useEffect } from 'react';

interface OverflowMenuProps {
  onClose: () => void;
  onImport: () => void;
  onBackup: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
  onAddTable: () => void;
  onReset: () => void;
}

export function OverflowMenu({ onClose, onImport, onBackup, onExportCsv, onPrint, onAddTable, onReset }: OverflowMenuProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = [
    ['Import guest list', onImport],
    ['Download backup', onBackup],
    ['Export seating CSV', onExportCsv],
    ['Print seating plan', onPrint],
    ['Add a table', onAddTable],
  ] as const;

  return (
    <div className="sheet-layer" onClick={onClose}>
      <div className="sheet sheet-compact" role="dialog" aria-modal="true" aria-labelledby="more-title" onClick={event => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <h2 id="more-title" className="sheet-title">More</h2>
          <button type="button" className="sheet-close" onClick={onClose}>Close</button>
        </div>
        <div className="sheet-scroll">
          {items.map(([label, action]) => (
            <button key={label} type="button" className="touch-row menu-row" onClick={() => { action(); onClose(); }}>
              {label}
            </button>
          ))}
          <button type="button" className="touch-row menu-row danger-text" onClick={() => { onReset(); onClose(); }}>
            Reset to sample wedding
          </button>
        </div>
      </div>
    </div>
  );
}
