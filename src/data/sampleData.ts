import type { WeddingData, Guest, Table } from '../types';
import { generateId } from '../utils/ids';

const SAMPLE_GUESTS: Omit<Guest, 'tableId'>[] = [
  // Bride's side - confirmed
  { id: 'demo_b1', name: 'Luna Starweaver', side: 'bride', sheetBlock: 'Family', isChild: false, rsvp: 'confirmed', familyGroup: 'Starweaver' },
  { id: 'demo_b2', name: 'Orion Starweaver', side: 'bride', sheetBlock: 'Family', isChild: false, rsvp: 'confirmed', familyGroup: 'Starweaver' },
  { id: 'demo_b3', name: 'Nova Starweaver', side: 'bride', sheetBlock: 'Family', isChild: true, rsvp: 'confirmed', familyGroup: 'Starweaver' },
  { id: 'demo_b4', name: 'Celeste Moonglow', side: 'bride', sheetBlock: 'Family', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_b5', name: 'Aurora Frostwhisper', side: 'bride', sheetBlock: 'Friends', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_b6', name: 'Iris Sunflower', side: 'bride', sheetBlock: 'Friends', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_b7', name: 'Jasmine Thornberry', side: 'bride', sheetBlock: 'Friends', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_b8', name: 'Maple Windchime', side: 'bride', sheetBlock: 'Colleagues', isChild: false, rsvp: 'confirmed' },
  
  // Bride's side - unconfirmed
  { id: 'demo_b9', name: 'Sage Willowbrook', side: 'bride', sheetBlock: 'Friends', isChild: false, rsvp: 'unconfirmed' },
  { id: 'demo_b10', name: 'Violet Duskwood', side: 'bride', sheetBlock: 'Extended', isChild: false, rsvp: 'unconfirmed' },
  { id: 'demo_b11', name: 'Fern Meadowlark', side: 'bride', sheetBlock: 'Extended', isChild: false, rsvp: 'unconfirmed' },
  
  // Bride's side - unknown
  { id: 'demo_b12', name: 'Willow Raindrop', side: 'bride', sheetBlock: 'Extended', isChild: false, rsvp: 'unknown' },
  { id: 'demo_b13', name: 'Clover Honeydew', side: 'bride', sheetBlock: 'Extended', isChild: false, rsvp: 'unknown' },
  { id: 'demo_b14', name: 'Dahlia Petalwing', side: 'bride', sheetBlock: 'Colleagues', isChild: false, rsvp: 'unknown' },
  { id: 'demo_b15', name: 'Hazel Cloudwhisper', side: 'bride', sheetBlock: 'Neighbours', isChild: false, rsvp: 'unknown' },
  
  // Groom's side - confirmed
  { id: 'demo_g1', name: 'Atlas Ironforge', side: 'groom', sheetBlock: 'Family', isChild: false, rsvp: 'confirmed', familyGroup: 'Ironforge' },
  { id: 'demo_g2', name: 'Helena Ironforge', side: 'groom', sheetBlock: 'Family', isChild: false, rsvp: 'confirmed', familyGroup: 'Ironforge' },
  { id: 'demo_g3', name: 'Felix Ironforge', side: 'groom', sheetBlock: 'Family', isChild: true, rsvp: 'confirmed', familyGroup: 'Ironforge' },
  { id: 'demo_g4', name: 'Magnus Stormrider', side: 'groom', sheetBlock: 'Family', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_g5', name: 'Theo Brightwater', side: 'groom', sheetBlock: 'Friends', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_g6', name: 'Sebastian Oakwood', side: 'groom', sheetBlock: 'Friends', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_g7', name: 'Oliver Tanglefoot', side: 'groom', sheetBlock: 'Friends', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_g8', name: 'Hugo Silverbell', side: 'groom', sheetBlock: 'Colleagues', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_g9', name: 'Arthur Goldleaf', side: 'groom', sheetBlock: 'Colleagues', isChild: false, rsvp: 'confirmed' },
  
  // Groom's side - unconfirmed
  { id: 'demo_g10', name: 'Leo Mistwalker', side: 'groom', sheetBlock: 'Friends', isChild: false, rsvp: 'unconfirmed' },
  { id: 'demo_g11', name: 'Max Thornwood', side: 'groom', sheetBlock: 'Extended', isChild: false, rsvp: 'unconfirmed' },
  { id: 'demo_g12', name: 'Finn Riverbend', side: 'groom', sheetBlock: 'Extended', isChild: false, rsvp: 'unconfirmed' },
  
  // Groom's side - unknown
  { id: 'demo_g13', name: 'Jasper Nightshade', side: 'groom', sheetBlock: 'Extended', isChild: false, rsvp: 'unknown' },
  { id: 'demo_g14', name: 'Owen Flamekeeper', side: 'groom', sheetBlock: 'Extended', isChild: false, rsvp: 'unknown' },
  { id: 'demo_g15', name: 'Rowan Dewdrop', side: 'groom', sheetBlock: 'Neighbours', isChild: false, rsvp: 'unknown' },
  
  // Mutual friends - mixed RSVP
  { id: 'demo_m1', name: 'River Cloudstone', side: 'mutual', sheetBlock: 'Friends', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_m2', name: 'Phoenix Ashwood', side: 'mutual', sheetBlock: 'Friends', isChild: false, rsvp: 'confirmed' },
  { id: 'demo_m3', name: 'Skylar Emberheart', side: 'mutual', sheetBlock: 'Friends', isChild: false, rsvp: 'unconfirmed' },
  { id: 'demo_m4', name: 'Quinn Starling', side: 'mutual', sheetBlock: 'Colleagues', isChild: false, rsvp: 'unknown' },
  { id: 'demo_m5', name: 'Avery Moonstone', side: 'mutual', sheetBlock: 'Neighbours', isChild: false, rsvp: 'unknown' },
  
  // Plus ones / partners - linked via familyGroup
  { id: 'demo_p1', name: 'Ivy Frostwhisper', side: 'bride', sheetBlock: 'Partners', isChild: false, rsvp: 'confirmed', familyGroup: 'Frostwhisper' },
  { id: 'demo_p2', name: 'Jasmine Sunflower', side: 'bride', sheetBlock: 'Partners', isChild: false, rsvp: 'confirmed', familyGroup: 'Sunflower' },
  { id: 'demo_p3', name: 'Elena Brightwater', side: 'groom', sheetBlock: 'Partners', isChild: false, rsvp: 'confirmed', familyGroup: 'Brightwater' },
];

const SAMPLE_TABLES: Table[] = [
  { id: 'demo_head', name: 'Head Table', capacity: 8, x: 400, y: 80, type: 'head' },
  { id: 'demo_t1', name: 'Table 1', capacity: 10, x: 120, y: 220, type: 'round' },
  { id: 'demo_t2', name: 'Table 2', capacity: 10, x: 300, y: 220, type: 'round' },
  { id: 'demo_t3', name: 'Table 3', capacity: 10, x: 480, y: 220, type: 'round' },
  { id: 'demo_t4', name: 'Table 4', capacity: 10, x: 660, y: 220, type: 'round' },
  { id: 'demo_t5', name: 'Table 5', capacity: 10, x: 120, y: 380, type: 'round' },
  { id: 'demo_t6', name: 'Table 6', capacity: 10, x: 300, y: 380, type: 'round' },
  { id: 'demo_t7', name: 'Table 7', capacity: 10, x: 480, y: 380, type: 'round' },
  { id: 'demo_t8', name: 'Table 8', capacity: 10, x: 660, y: 380, type: 'round' },
];

export function createSampleWedding(): WeddingData {
  const guests: Guest[] = SAMPLE_GUESTS.map(g => ({ ...g, tableId: null }));
  
  return {
    id: generateId('demo'),
    name: '✨ Sample Wedding (Demo Data)',
    weddingDate: '2027-06-15',
    guests,
    tables: SAMPLE_TABLES,
    assignments: [],
    isDemo: true,
    lastModified: Date.now(),
  };
}

export function getSampleDataForTesting(): WeddingData {
  return createSampleWedding();
}
