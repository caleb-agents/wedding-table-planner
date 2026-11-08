import type { WeddingData } from '../types';
import { convertImportedData, validateImportedData } from './validation';
import { loadFromStorage, saveToStorage } from './storage';
import { shouldConfirmReplace } from './groups';

const MAX_ENCODED_LENGTH = 1_500_000;
const MAX_GUESTS = 2000;
const MAX_TABLES = 200;
const MAX_TEXT = 200;

export type FragmentStartup =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'applied' }
  | { status: 'confirm'; next: WeddingData };

let startup: FragmentStartup | null = null;

export function resetFragmentStartupForTests(): void {
  startup = null;
}

export function consumeFragmentAtStartup(): FragmentStartup {
  if (startup) return startup;
  if (typeof window === 'undefined') {
    startup = { status: 'none' };
    return startup;
  }

  const hash = window.location.hash;
  if (!hash.includes('guests=')) {
    startup = { status: 'none' };
    return startup;
  }

  const url = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, '', url);

  const decoded = decodeGuestFragment(hash);
  if (!decoded.ok) {
    startup = { status: 'invalid' };
    return startup;
  }

  const current = loadFromStorage();
  if (shouldConfirmReplace(current)) {
    startup = { status: 'confirm', next: decoded.wedding };
    return startup;
  }

  saveToStorage(decoded.wedding);
  startup = { status: 'applied' };
  return startup;
}

export function decodeGuestFragment(hash: string): { ok: true; wedding: WeddingData } | { ok: false } {
  try {
    const body = hash.startsWith('#') ? hash.slice(1) : hash;
    const encoded = new URLSearchParams(body).get('guests');
    if (!encoded || encoded.length > MAX_ENCODED_LENGTH) return { ok: false };
    if (!/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)) return { ok: false };
    const json = decodeBase64Url(encoded);
    if (json.length > MAX_ENCODED_LENGTH) return { ok: false };
    return acceptGuestPayload(JSON.parse(json));
  } catch {
    return { ok: false };
  }
}

export function acceptGuestPayload(raw: unknown): { ok: true; wedding: WeddingData } | { ok: false } {
  if (!validateImportedData(raw)) return { ok: false };
  if (raw.guests.length < 1 || raw.guests.length > MAX_GUESTS) return { ok: false };
  if (raw.tables.length > MAX_TABLES) return { ok: false };
  for (const guest of raw.guests) {
    if (guest.name.length > MAX_TEXT || guest.id.length > MAX_TEXT) return { ok: false };
    if (guest.side.length > MAX_TEXT || guest.sheetBlock.length > MAX_TEXT) return { ok: false };
    if (guest.familyGroup && guest.familyGroup.length > MAX_TEXT) return { ok: false };
  }
  return { ok: true, wedding: convertImportedData(raw) };
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
