import publicGuests from "../src/data/public-guests.json";

type PublicFile = { guests: Array<{ id: string; name: string }> };

const file = publicGuests as PublicFile;

export const PUBLISHED_GUESTS = file.guests;
export const GROUP_CAP = 10;
export const DEFAULT_GROUP_COUNT = 14;
const MAX_GROUPS = 40;
const MAX_NAME = 40;

const publishedIds = new Set(PUBLISHED_GUESTS.map(guest => guest.id));

export function defaultGroups(): Array<{ groupId: string; name: string; sort: number }> {
  return Array.from({ length: DEFAULT_GROUP_COUNT }, (_, index) => ({
    groupId: `group-${index + 1}`,
    name: `Group ${index + 1}`,
    sort: index + 1,
  }));
}

export function isPublishedGuest(guestId: string): boolean {
  return publishedIds.has(guestId);
}

export function assertPublishedGuest(guestId: string): void {
  if (!publishedIds.has(guestId)) {
    throw new Error("That guest is not on the public list.");
  }
}

export function assertGroupId(groupId: string): void {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(groupId)) {
    throw new Error("That table id is not valid.");
  }
}

export function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) throw new Error("A table needs a name.");
  return trimmed;
}

export function assertGroupCount(count: number): void {
  if (count > MAX_GROUPS) throw new Error("Too many tables.");
}
