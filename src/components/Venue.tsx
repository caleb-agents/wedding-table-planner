import { useCallback } from 'react';
import type { WeddingStateReturn } from '../hooks/useWeddingState';
import { TableComponent } from './Table';

interface VenueProps {
  state: WeddingStateReturn['state'];
  dispatch: WeddingStateReturn['dispatch'];
  getGuestsAtTable: WeddingStateReturn['getGuestsAtTable'];
  getTableCapacityInfo: WeddingStateReturn['getTableCapacityInfo'];
  canAssignGuest: WeddingStateReturn['canAssignGuest'];
  canAssignGroup: WeddingStateReturn['canAssignGroup'];
  onEditTable: (tableId: string) => void;
  onCapacityWarning: (message: string) => void;
  onInspectTable?: (tableId: string) => void;
}

export function Venue({
  state,
  dispatch,
  getGuestsAtTable,
  getTableCapacityInfo,
  canAssignGuest,
  canAssignGroup,
  onEditTable,
  onCapacityWarning,
  onInspectTable,
}: VenueProps) {
  const handleTableClick = useCallback((tableId: string) => {
    if (onInspectTable) {
      onInspectTable(tableId);
      return;
    }
    if (state.selectedGuestId) {
      if (canAssignGuest(state.selectedGuestId, tableId)) {
        dispatch({ type: 'ASSIGN_GUEST', guestId: state.selectedGuestId, tableId });
      } else {
        const table = state.data.tables.find(item => item.id === tableId);
        onCapacityWarning(`${table?.name ?? 'That table'} is full. Raise its capacity or choose another table.`);
      }
    } else {
      dispatch({ 
        type: 'SET_SELECTED_TABLE', 
        tableId: state.selectedTableId === tableId ? null : tableId 
      });
    }
  }, [onInspectTable, state.selectedGuestId, state.selectedTableId, state.data.tables, canAssignGuest, dispatch, onCapacityWarning]);
  
  const handleGuestRemove = useCallback((guestId: string) => {
    dispatch({ type: 'UNASSIGN_GUEST', guestId });
  }, [dispatch]);
  
  const handleDrop = useCallback((e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    const guestId = e.dataTransfer.getData('text/plain');
    const groupId = e.dataTransfer.getData('application/x-family-group');
    
    if (groupId) {
      if (canAssignGroup(groupId, tableId)) {
        dispatch({ type: 'ASSIGN_GROUP', groupId, tableId });
      } else {
        const table = state.data.tables.find(item => item.id === tableId);
        onCapacityWarning(`${table?.name ?? 'That table'} does not have enough open seats for this family group.`);
      }
    } else if (guestId && canAssignGuest(guestId, tableId)) {
      dispatch({ type: 'ASSIGN_GUEST', guestId, tableId });
    } else if (guestId) {
      const table = state.data.tables.find(item => item.id === tableId);
      onCapacityWarning(`${table?.name ?? 'That table'} is full. Raise its capacity or choose another table.`);
    }
  }, [canAssignGuest, canAssignGroup, dispatch, onCapacityWarning, state.data.tables]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  
  const stringLights = Array.from({ length: 15 }, (_, i) => (
    <div
      key={i}
      className="string-light-bulb"
      style={{ left: `${(i + 1) * 6}%` }}
    />
  ));
  
  const flowers = [
    { x: 5, y: 5, color: 'var(--color-flower-pink)' },
    { x: 95, y: 5, color: 'var(--color-flower-yellow)' },
    { x: 3, y: 95, color: 'var(--color-flower-purple)' },
    { x: 97, y: 95, color: 'var(--color-flower-pink)' },
    { x: 2, y: 50, color: 'var(--color-flower-yellow)' },
    { x: 98, y: 50, color: 'var(--color-flower-purple)' },
  ];
  
  return (
    <div className="venue-scroll">
    <div className="venue-container" role="application" aria-label="Wedding venue with tables">
      <div className="venue-grass-border top" aria-hidden="true" />
      <div className="venue-grass-border bottom" aria-hidden="true" />
      
      <div className="string-lights" aria-hidden="true">
        <div className="string-light-wire" />
        {stringLights}
      </div>
      
      {flowers.map((flower, i) => (
        <div
          key={i}
          className="flower-decoration"
          aria-hidden="true"
          style={{
            left: `${flower.x}%`,
            top: `${flower.y}%`,
            background: flower.color,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
      
      <div className="bar-area" aria-hidden="true">BAR</div>
      <div className="dance-floor" aria-hidden="true" />
      <div className="entrance-marker" aria-hidden="true">ENTRANCE</div>
      
      {state.data.tables.map(table => (
        <TableComponent
          key={table.id}
          table={table}
          guests={getGuestsAtTable(table.id)}
          capacityInfo={getTableCapacityInfo(table.id)}
          isSelected={state.selectedTableId === table.id}
          hasSelectedGuest={state.selectedGuestId !== null}
          canAcceptGuest={state.selectedGuestId ? canAssignGuest(state.selectedGuestId, table.id) : false}
          onClick={() => handleTableClick(table.id)}
          onEdit={() => onEditTable(table.id)}
          onMove={(x, y) => dispatch({ type: 'UPDATE_TABLE', tableId: table.id, updates: { x, y } })}
          dragEnabled={!onInspectTable}
          guestsInteractive={!onInspectTable}
          onGuestRemove={handleGuestRemove}
          onDrop={(e) => handleDrop(e, table.id)}
          onDragOver={handleDragOver}
        />
      ))}
    </div>
    </div>
  );
}
