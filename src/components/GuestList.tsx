import { useMemo } from 'react';
import type { Guest } from '../types';
import type { WeddingStateReturn } from '../hooks/useWeddingState';
import { GuestChip } from './GuestChip';

interface GuestListProps {
  state: WeddingStateReturn['state'];
  dispatch: WeddingStateReturn['dispatch'];
  filteredGuests: Guest[];
  getFamilyGroups: WeddingStateReturn['getFamilyGroups'];
}

export function GuestList({ state, dispatch, filteredGuests, getFamilyGroups }: GuestListProps) {
  const familyGroups = getFamilyGroups();
  
  const groupedGuests = useMemo(() => {
    const groups: Record<string, Guest[]> = {};
    const ungrouped: Guest[] = [];
    
    for (const guest of filteredGuests) {
      if (guest.familyGroup && familyGroups.has(guest.familyGroup)) {
        const groupGuests = familyGroups.get(guest.familyGroup)!;
        if (groupGuests.length > 1) {
          if (!groups[guest.familyGroup]) {
            groups[guest.familyGroup] = [];
          }
          if (!groups[guest.familyGroup].some(g => g.id === guest.id)) {
            groups[guest.familyGroup].push(guest);
          }
          continue;
        }
      }
      ungrouped.push(guest);
    }
    
    return { groups, ungrouped };
  }, [filteredGuests, familyGroups]);
  
  const handleGuestSelect = (guestId: string) => {
    dispatch({
      type: 'SET_SELECTED_GUEST',
      guestId: state.selectedGuestId === guestId ? null : guestId,
    });
  };
  
  const handleDragStart = (e: React.DragEvent, guest: Guest) => {
    e.dataTransfer.setData('text/plain', guest.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    e.dataTransfer.setData('application/x-family-group', groupId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  if (filteredGuests.length === 0 && state.data.guests.filter(g => g.tableId === null).length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🎉</div>
        <div className="empty-state-title">All Guests Seated!</div>
        <div className="empty-state-text">
          Every guest has been assigned to a table. Great job!
        </div>
      </div>
    );
  }
  
  if (filteredGuests.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">No Matches</div>
        <div className="empty-state-text">
          No unseated guests match your current filters. Try adjusting your search or filters.
        </div>
      </div>
    );
  }
  
  return (
    <div className="guest-list" role="list" aria-label="Unseated guests">
      {Object.entries(groupedGuests.groups).map(([groupId, guests]) => (
        <div key={groupId} className="family-group-container">
          <div
            className="group-header"
            draggable
            onDragStart={(e) => handleGroupDragStart(e, groupId)}
            style={{ cursor: 'grab' }}
            title="Drag to seat entire family group"
          >
            👨‍👩‍👧 {groupId} ({guests.length})
          </div>
          {guests.map(guest => (
            <GuestChip
              key={guest.id}
              guest={guest}
              isSelected={state.selectedGuestId === guest.id}
              onClick={() => handleGuestSelect(guest.id)}
              onDragStart={(e) => handleDragStart(e, guest)}
            />
          ))}
        </div>
      ))}
      
      {groupedGuests.ungrouped.length > 0 && Object.keys(groupedGuests.groups).length > 0 && (
        <div className="group-header">Individual Guests</div>
      )}
      
      {groupedGuests.ungrouped.map(guest => (
        <GuestChip
          key={guest.id}
          guest={guest}
          isSelected={state.selectedGuestId === guest.id}
          onClick={() => handleGuestSelect(guest.id)}
          onDragStart={(e) => handleDragStart(e, guest)}
        />
      ))}
    </div>
  );
}
