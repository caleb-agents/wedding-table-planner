import type { WeddingData } from "../types";
import { GROUP_CAPACITY } from "../utils/groups";
import { PUBLIC_LIST_NAME, createPublicWedding } from "../data/sampleData";

export type RemotePlan = {
  guests: Array<{ guestId: string; name: string }>;
  groups: Array<{ groupId: string; name: string; sort: number }>;
  assignments: Array<{ guestId: string; groupId: string }>;
};

export type ImportPayload = {
  groups: Array<{ groupId: string; name: string; sort: number }>;
  assignments: Array<{ guestId: string; groupId: string }>;
};

export function decideSync(input: {
  remoteReady: boolean;
  remoteAssignmentCount: number;
  localAssignmentCount: number;
}): { showRemote: boolean; offerImport: boolean } {
  if (!input.remoteReady) return { showRemote: false, offerImport: false };
  return {
    showRemote: true,
    offerImport: input.remoteAssignmentCount === 0 && input.localAssignmentCount > 0,
  };
}

export function shouldPushLocalSnapshot(): false {
  return false;
}

export function assignmentsDiffer(local: WeddingData, remote: RemotePlan): boolean {
  const localPairs = local.assignments.map(item => `${item.guestId}:${item.tableId}`).sort();
  const remotePairs = remote.assignments.map(item => `${item.guestId}:${item.groupId}`).sort();
  return localPairs.join("|") !== remotePairs.join("|");
}

export function applyRemotePlan(remote: RemotePlan): WeddingData {
  const base = createPublicWedding();
  const names = new Map(remote.guests.map(guest => [guest.guestId, guest.name]));
  const seats = new Map(remote.assignments.map(seat => [seat.guestId, seat.groupId]));
  const guests = base.guests.map(guest => ({
    ...guest,
    name: names.get(guest.id) ?? guest.name,
    tableId: seats.get(guest.id) ?? null,
  }));
  const tables = [...remote.groups]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map(group => ({
      id: group.groupId,
      name: group.name,
      capacity: GROUP_CAPACITY,
      x: 0,
      y: 0,
      type: "round" as const,
    }));
  return {
    ...base,
    name: PUBLIC_LIST_NAME,
    guests,
    tables,
    assignments: guests
      .filter(guest => guest.tableId !== null)
      .map(guest => ({ guestId: guest.id, tableId: guest.tableId as string })),
    isDemo: false,
  };
}

export function localImportPayload(data: WeddingData, allowedIds: ReadonlySet<string>): ImportPayload {
  const assignments = data.assignments.filter(item => allowedIds.has(item.guestId) && item.tableId);
  const groups = data.tables.slice(0, 40).map((table, index) => ({
    groupId: table.id,
    name: table.name,
    sort: index + 1,
  }));
  return {
    groups,
    assignments: assignments.map(item => ({ guestId: item.guestId, groupId: item.tableId })),
  };
}
