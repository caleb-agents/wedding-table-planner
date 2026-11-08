import type { WeddingData } from '../types';
import { formatWeddingDate } from '../utils/dates';

interface PrintViewProps {
  data: WeddingData;
}

export function PrintView({ data }: PrintViewProps) {
  const seatingByTable = data.tables.map(table => ({
    table,
    guests: data.guests.filter(g => g.tableId === table.id).sort((a, b) => a.name.localeCompare(b.name)),
  }));
  
  const unseated = data.guests.filter(g => g.tableId === null).sort((a, b) => a.name.localeCompare(b.name));
  
  return (
    <div className="print-seating-list">
      <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>
        {data.name} - Seating Plan
      </h1>
      
      {data.weddingDate && (
        <p style={{ textAlign: 'center', marginBottom: '24px', color: '#666' }}>
          {formatWeddingDate(data.weddingDate)}
        </p>
      )}
      
      <div style={{ columns: '2', columnGap: '40px' }}>
        {seatingByTable.map(({ table, guests }) => (
          <div key={table.id} style={{ breakInside: 'avoid', marginBottom: '24px' }}>
            <h3 style={{ 
              borderBottom: '2px solid #333', 
              paddingBottom: '8px',
              marginBottom: '12px',
            }}>
              {table.name} ({guests.length}/{table.capacity})
            </h3>
            {guests.length === 0 ? (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No guests assigned</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {guests.map(guest => (
                  <li key={guest.id} style={{ 
                    padding: '4px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>
                      {guest.name}
                      {guest.isChild && ' (Child)'}
                    </span>
                    <span style={{ color: '#666', fontSize: '12px' }}>
                      {guest.familyGroup}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      
      {unseated.length > 0 && (
        <div style={{ marginTop: '40px', borderTop: '2px solid #333', paddingTop: '20px' }}>
          <h3>Unseated Guests ({unseated.length})</h3>
          <div style={{ columns: '3', columnGap: '20px', marginTop: '12px' }}>
            {unseated.map(guest => (
              <div key={guest.id} style={{ padding: '2px 0' }}>
                {guest.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
