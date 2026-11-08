export const MAX_GUEST_NAME = 80;
export const MAX_PLAN_GUESTS = 400;

const CUSTOM_ID = /^c_[a-z0-9]{12,40}$/;

export function isCustomGuestId(id: string): boolean {
  return CUSTOM_ID.test(id);
}

export function assertCustomGuestId(guestId: string): void {
  if (!isCustomGuestId(guestId)) throw new Error("That guest id is not valid.");
}

export function normalizeGuestName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function guestNameError(raw: string): string | null {
  const name = normalizeGuestName(raw);
  if (!name) return "Enter a name.";
  if (name.length > MAX_GUEST_NAME) return `Use ${MAX_GUEST_NAME} characters or fewer.`;
  return null;
}

export function cleanGuestName(raw: string): string {
  const error = guestNameError(raw);
  if (error) throw new Error(error);
  return normalizeGuestName(raw);
}

export function sameNameLabel(guest: { id: string; name: string }, guests: ReadonlyArray<{ id: string; name: string }>): string {
  const key = normalizeGuestName(guest.name).toLocaleLowerCase();
  const same = guests
    .filter(item => normalizeGuestName(item.name).toLocaleLowerCase() === key)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (same.length < 2) return guest.name;
  const index = same.findIndex(item => item.id === guest.id) + 1;
  return `${guest.name}, ${index} of ${same.length}`;
}

export function createCustomGuestId(): string {
  const time = Date.now().toString(36).padStart(8, "0");
  let random = "";
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    random = [...bytes].map(byte => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
  } else {
    random = Math.random().toString(36).slice(2, 14).padEnd(12, "0");
  }
  return `c_${time}${random}`.toLowerCase();
}
