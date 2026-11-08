import { useRef, useState } from 'react';
import type { Table as TableType, Guest } from '../types';

interface TableProps {
  table: TableType;
  guests: Guest[];
  capacityInfo: { seated: number; capacity: number; isFull: boolean };
  isSelected: boolean;
  hasSelectedGuest: boolean;
  canAcceptGuest: boolean;
  onClick: () => void;
  onEdit: () => void;
  onMove: (x: number, y: number) => void;
  dragEnabled?: boolean;
  guestsInteractive?: boolean;
  onGuestRemove: (guestId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}

export function TableComponent({
  table,
  guests,
  capacityInfo,
  isSelected,
  hasSelectedGuest,
  canAcceptGuest,
  onClick,
  onEdit,
  onMove,
  dragEnabled = true,
  guestsInteractive = true,
  onGuestRemove,
  onDrop,
  onDragOver,
}: TableProps) {
  const { seated, capacity, isFull } = capacityInfo;
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ px: number; py: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  
  const capacityClass = isFull ? 'full' : seated > capacity * 0.8 ? 'warning' : '';

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 20;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onMove(clamp(table.x - step, 80, 720), table.y);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onMove(clamp(table.x + step, 80, 720), table.y);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(table.x, clamp(table.y - step, 70, 760));
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(table.x, clamp(table.y + step, 70, 760));
      return;
    }
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onEdit();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!dragEnabled || e.button !== 0 || hasSelectedGuest) return;
    if ((e.target as HTMLElement).closest('.mini-guest')) return;
    dragStart.current = { px: e.clientX, py: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragStart.current.moved = true;
    if (dragStart.current.moved) setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = () => {
    if (!dragStart.current) return;
    if (dragStart.current.moved) {
      suppressClick.current = true;
      onMove(
        clamp(table.x + dragOffset.x, 80, 720),
        clamp(table.y + dragOffset.y, 70, 760),
      );
      setDragOffset({ x: 0, y: 0 });
    }
    dragStart.current = null;
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onClick();
  };
  
  const handleGuestClick = (e: React.MouseEvent, guestId: string) => {
    e.stopPropagation();
    onGuestRemove(guestId);
  };
  
  return (
    <div
      className={`pixel-table ${isSelected ? 'selected' : ''} ${isFull ? 'full' : ''}`}
      style={{
        left: table.x - (table.type === 'head' ? 100 : 45) + dragOffset.x,
        top: table.y + dragOffset.y,
        cursor: hasSelectedGuest ? (canAcceptGuest ? 'copy' : 'not-allowed') : 'grab',
      }}
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        onEdit();
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDrop={onDrop}
      onDragOver={onDragOver}
      role="button"
      tabIndex={0}
      aria-label={`${table.name}, ${seated} of ${capacity} seats filled${isFull ? ', full' : ''}. Arrow keys move this table. Shift+Enter edits it.`}
      aria-pressed={isSelected}
    >
      <div className={`table-surface ${table.type}`}>
        <span className="table-label">{table.name}</span>
      </div>
      
      <div className={`table-capacity ${capacityClass}`}>
        {seated}/{capacity}
      </div>
      
      {guests.length > 0 && (
        <div className="table-guests-preview" aria-label="Seated guests">
          {guests.slice(0, 10).map(guest => (
            <div
              key={guest.id}
              className={`mini-guest ${guest.rsvp} ${guestsInteractive ? '' : 'is-static'}`}
              title={guest.name}
              onClick={guestsInteractive ? (e) => handleGuestClick(e, guest.id) : undefined}
              role={guestsInteractive ? 'button' : undefined}
              tabIndex={guestsInteractive ? 0 : undefined}
              onKeyDown={guestsInteractive ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onGuestRemove(guest.id);
                }
              } : undefined}
              aria-label={guestsInteractive ? `Remove ${guest.name} from table` : undefined}
            />
          ))}
          {guests.length > 10 && (
            <span style={{ fontSize: '9px', color: 'var(--color-text-secondary)' }}>
              +{guests.length - 10}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
