import type { WeddingStateReturn } from '../hooks/useWeddingState';
import { GuestList } from './GuestList';

interface SidebarProps {
  state: WeddingStateReturn['state'];
  dispatch: WeddingStateReturn['dispatch'];
  statistics: WeddingStateReturn['statistics'];
  filteredUnseatedGuests: WeddingStateReturn['filteredUnseatedGuests'];
  getFamilyGroups: WeddingStateReturn['getFamilyGroups'];
}

export function Sidebar({ state, dispatch, statistics, filteredUnseatedGuests, getFamilyGroups }: SidebarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value });
  };
  
  const handleRsvpFilter = (filter: 'all' | 'confirmed' | 'unconfirmed' | 'unknown') => {
    dispatch({ type: 'SET_FILTER_RSVP', filter });
  };
  
  const handleSideFilter = (filter: 'all' | string) => {
    dispatch({ type: 'SET_FILTER_SIDE', filter });
  };
  
  const handleChildrenToggle = () => {
    dispatch({ type: 'SET_SHOW_CHILDREN_ONLY', show: !state.showChildrenOnly });
  };
  
  return (
    <aside className="sidebar" aria-label="Guest management">
      <div className="stats-bar" aria-label="Statistics">
        <div className="stat-item">
          <span className="stat-value">{statistics.seatedGuests}</span>
          <span className="stat-label">Seated</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{statistics.unseatedGuests}</span>
          <span className="stat-label">Unseated</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{statistics.availableSeats}</span>
          <span className="stat-label">Available</span>
        </div>
        <div className="stat-item">
          <span className="stat-value" style={{ color: 'var(--color-confirmed)' }}>
            {statistics.confirmedGuests}
          </span>
          <span className="stat-label">Confirmed</span>
        </div>
      </div>
      
      <div className="sidebar-header">
        <h2 className="sidebar-title">Unseated Guests ({statistics.unseatedGuests})</h2>
      </div>
      
      <input
        type="search"
        className="search-input"
        placeholder="Search guests..."
        value={state.searchQuery}
        onChange={handleSearchChange}
        aria-label="Search guests by name or family"
      />
      
      <div className="filter-row" role="group" aria-label="Filter by RSVP status">
        <button
          className={`filter-btn ${state.filterRsvp === 'all' ? 'active' : ''}`}
          onClick={() => handleRsvpFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${state.filterRsvp === 'confirmed' ? 'active' : ''}`}
          onClick={() => handleRsvpFilter('confirmed')}
          style={{ borderColor: state.filterRsvp === 'confirmed' ? 'var(--color-confirmed)' : undefined }}
        >
          ✓ Confirmed
        </button>
        <button
          className={`filter-btn ${state.filterRsvp === 'unconfirmed' ? 'active' : ''}`}
          onClick={() => handleRsvpFilter('unconfirmed')}
        >
          ? Unconfirmed
        </button>
        <button
          className={`filter-btn ${state.filterRsvp === 'unknown' ? 'active' : ''}`}
          onClick={() => handleRsvpFilter('unknown')}
        >
          ○ Unknown
        </button>
      </div>
      
      {statistics.sides.length > 1 && (
        <div className="filter-row" role="group" aria-label="Filter by side">
          <button
            className={`filter-btn ${state.filterSide === 'all' ? 'active' : ''}`}
            onClick={() => handleSideFilter('all')}
          >
            All Sides
          </button>
          {statistics.sides.map(side => (
            <button
              key={side}
              className={`filter-btn ${state.filterSide === side ? 'active' : ''}`}
              onClick={() => handleSideFilter(side)}
            >
              {side.charAt(0).toUpperCase() + side.slice(1)}
            </button>
          ))}
        </div>
      )}
      
      {statistics.childGuests > 0 && (
        <div className="filter-row">
          <button
            className={`filter-btn ${state.showChildrenOnly ? 'active' : ''}`}
            onClick={handleChildrenToggle}
            style={{ borderColor: state.showChildrenOnly ? 'var(--color-child)' : undefined }}
          >
            👶 Children Only ({statistics.childGuests})
          </button>
        </div>
      )}
      
      <GuestList
        state={state}
        dispatch={dispatch}
        filteredGuests={filteredUnseatedGuests}
        getFamilyGroups={getFamilyGroups}
      />
      
      {state.selectedGuestId && (
        <div style={{ 
          marginTop: '12px', 
          padding: '12px', 
          background: '#e8f4fc', 
          borderRadius: '8px',
          fontSize: '13px',
        }}>
          <strong>Tip:</strong> Click a table to seat the selected guest, 
          or click another guest to change selection.
        </div>
      )}
    </aside>
  );
}
