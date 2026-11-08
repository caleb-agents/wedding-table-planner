export interface Guest {
  id: string;
  name: string;
  side: string;
  sheetBlock: string;
  isChild: boolean;
  rsvp: 'confirmed' | 'unconfirmed' | 'unknown';
  tableId: string | null;
  familyGroup?: string;
  cardSent?: string;
  events?: Record<string, unknown>;
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  x: number;
  y: number;
  type: 'round' | 'rectangular' | 'head';
}

export interface Assignment {
  guestId: string;
  tableId: string;
}

export interface WeddingData {
  id: string;
  name: string;
  weddingDate?: string;
  guests: Guest[];
  tables: Table[];
  assignments: Assignment[];
  isDemo: boolean;
  /** True when tables were created as an editable suggestion because the import had none. */
  suggestedTables?: boolean;
  lastModified: number;
}

export interface AppState {
  data: WeddingData;
  selectedGuestId: string | null;
  selectedTableId: string | null;
  searchQuery: string;
  filterRsvp: 'all' | 'confirmed' | 'unconfirmed' | 'unknown';
  filterSide: 'all' | string;
  showChildrenOnly: boolean;
  undoStack: WeddingData[];
  redoStack: WeddingData[];
}

export interface ImportedSource {
  fileId: string;
  name: string;
  tab: string;
}

export interface ImportedGuest {
  id: string;
  name: string;
  side: string;
  sheetBlock: string;
  isChild: boolean;
  rsvp: 'confirmed' | 'unconfirmed' | 'unknown';
  tableId: string | null;
  familyGroup?: string;
  cardSent?: string;
  events?: Record<string, unknown>;
}

export interface ImportedData {
  source: ImportedSource;
  weddingDate: string;
  tables: Table[];
  guests: ImportedGuest[];
}

export type ActionType =
  | { type: 'ASSIGN_GUEST'; guestId: string; tableId: string }
  | { type: 'ASSIGN_GUESTS'; guestIds: string[]; tableId: string }
  | { type: 'UNASSIGN_GUEST'; guestId: string }
  | { type: 'ASSIGN_GROUP'; groupId: string; tableId: string }
  | { type: 'ADD_TABLE'; table: Table }
  | { type: 'REMOVE_TABLE'; tableId: string }
  | { type: 'UPDATE_TABLE'; tableId: string; updates: Partial<Omit<Table, 'id'>> }
  | { type: 'ADD_GUEST'; guest: Guest }
  | { type: 'REMOVE_GUEST'; guestId: string }
  | { type: 'UPDATE_GUEST'; guestId: string; updates: Partial<Omit<Guest, 'id'>> }
  | { type: 'IMPORT_DATA'; data: WeddingData }
  | { type: 'APPLY_REMOTE'; data: WeddingData }
  | { type: 'RESET_TO_DEMO' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_SELECTED_GUEST'; guestId: string | null }
  | { type: 'SET_SELECTED_TABLE'; tableId: string | null }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_FILTER_RSVP'; filter: 'all' | 'confirmed' | 'unconfirmed' | 'unknown' }
  | { type: 'SET_FILTER_SIDE'; filter: 'all' | string }
  | { type: 'SET_SHOW_CHILDREN_ONLY'; show: boolean }
  | { type: 'DISMISS_TABLE_SUGGESTION' };
