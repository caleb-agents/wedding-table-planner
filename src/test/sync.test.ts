import { describe, expect, it } from 'vitest';
import type { WeddingData } from '../types';
import { applyRemotePlan, assignmentsDiffer, decideSync, localImportPayload, shouldPushLocalSnapshot, type RemotePlan } from '../shared/sync';

function localPlan(): WeddingData {
  return {
    id: 'local',
    name: 'Wedding group planner',
    guests: [
      { id: 'g001', name: 'Jean Huang', side: '', sheetBlock: '', isChild: false, rsvp: 'unknown', tableId: 'old-group' },
      { id: 'g002', name: 'Charlie Sheen', side: '', sheetBlock: '', isChild: false, rsvp: 'unknown', tableId: null },
    ],
    tables: [{ id: 'old-group', name: 'Family', capacity: 10, x: 0, y: 0, type: 'round' }],
    assignments: [{ guestId: 'g001', tableId: 'old-group' }],
    isDemo: false,
    lastModified: 1,
  };
}

const remoteWithSeats: RemotePlan = {
  guests: [{ guestId: 'g001', name: 'Jean Huang' }],
  groups: [{ groupId: 'group-1', name: 'Group 1', sort: 1 }],
  assignments: [{ guestId: 'g001', groupId: 'group-1' }],
};

describe('shared sync policy', () => {
  it('never pushes a local snapshot and keeps remote seats when they differ', () => {
    expect(shouldPushLocalSnapshot()).toBe(false);
    const decision = decideSync({
      remoteReady: true,
      remoteAssignmentCount: remoteWithSeats.assignments.length,
      localAssignmentCount: localPlan().assignments.length,
    });
    expect(decision).toEqual({ showRemote: true, offerImport: false });
    expect(assignmentsDiffer(localPlan(), remoteWithSeats)).toBe(true);
    const shown = applyRemotePlan(remoteWithSeats);
    expect(shown.guests.find(guest => guest.id === 'g001')?.tableId).toBe('group-1');
    expect(shown.tables.map(table => table.id)).toEqual(['group-1']);
    expect(shown.assignments).toEqual([{ guestId: 'g001', tableId: 'group-1' }]);
  });

  it('offers an explicit import only when the shared plan has no assignments', () => {
    expect(decideSync({ remoteReady: true, remoteAssignmentCount: 0, localAssignmentCount: 2 })).toEqual({
      showRemote: true,
      offerImport: true,
    });
    expect(decideSync({ remoteReady: false, remoteAssignmentCount: 0, localAssignmentCount: 2 })).toEqual({
      showRemote: false,
      offerImport: false,
    });
    expect(decideSync({ remoteReady: true, remoteAssignmentCount: 0, localAssignmentCount: 0 }).offerImport).toBe(false);
  });

  it('builds an import from the saved browser plan without adding private fields', () => {
    const payload = localImportPayload(localPlan(), new Set(['g001', 'g002']));
    expect(payload.groups).toEqual([{ groupId: 'old-group', name: 'Family', sort: 1 }]);
    expect(payload.assignments).toEqual([{ guestId: 'g001', groupId: 'old-group' }]);
    expect(Object.keys(payload.groups[0]).sort()).toEqual(['groupId', 'name', 'sort']);
    expect(Object.keys(payload.assignments[0]).sort()).toEqual(['groupId', 'guestId']);
  });
});
