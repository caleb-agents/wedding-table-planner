import type { Guest, WeddingData } from '../types';
import publicGuests from './public-guests.json';
import { createDefaultGroups } from '../utils/groups';

export const PUBLIC_LIST_NAME = 'Wedding group planner';

type PublicGuestFile = {
  guests: Array<{ id: string; name: string }>;
};

const names = publicGuests as PublicGuestFile;

export function createPublicWedding(): WeddingData {
  const guests: Guest[] = names.guests.map(guest => ({
    id: guest.id,
    name: guest.name,
    side: '',
    sheetBlock: '',
    isChild: false,
    rsvp: 'unknown',
    tableId: null,
  }));

  return {
    id: 'wedding-list',
    name: PUBLIC_LIST_NAME,
    guests,
    tables: createDefaultGroups(),
    assignments: [],
    isDemo: false,
    lastModified: Date.now(),
  };
}
