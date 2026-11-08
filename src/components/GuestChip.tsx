import type { Guest } from '../types';

interface GuestChipProps {
  guest: Guest;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function GuestChip({ guest, isSelected, onClick, onDragStart }: GuestChipProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  
  return (
    <div
      className={`guest-chip ${isSelected ? 'selected' : ''} ${guest.isChild ? 'child' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      draggable
      onDragStart={onDragStart}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${guest.name}, ${guest.side}, ${guest.rsvp}${guest.isChild ? ', child' : ''}${guest.familyGroup ? `, family: ${guest.familyGroup}` : ''}, block ${guest.sheetBlock}`}
      title={`${guest.name}\nSide: ${guest.side}\nSheet block: ${guest.sheetBlock}\nRSVP: ${guest.rsvp}${guest.familyGroup ? `\nFamily: ${guest.familyGroup}` : ''}`}
    >
      <span className={`rsvp-dot ${guest.rsvp}`} aria-hidden="true" />
      <div className="guest-sprite" aria-hidden="true">
        {guest.isChild && <div className="guest-sprite child" />}
      </div>
      <span className="guest-name">{guest.name}</span>
      {guest.isChild && <span className="child-badge">Child</span>}
    </div>
  );
}
