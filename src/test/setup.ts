import '@testing-library/react';
import { vi, afterEach } from 'vitest';
import { resetFragmentStartupForTests } from '../utils/fragment';

const hasWindow = typeof window !== 'undefined';

if (hasWindow && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

interface LocalStorageMock {
  store: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const localStorageMock: LocalStorageMock = {
  store: {},
  getItem: vi.fn(function(this: LocalStorageMock, key: string) {
    return this.store[key] ?? null;
  }),
  setItem: vi.fn(function(this: LocalStorageMock, key: string, value: string) {
    this.store[key] = value;
  }),
  removeItem: vi.fn(function(this: LocalStorageMock, key: string) {
    delete this.store[key];
  }),
  clear: vi.fn(function(this: LocalStorageMock) {
    this.store = {};
  }),
};

if (hasWindow) {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });
  window.scrollTo = () => undefined;
}

afterEach(() => {
  if (hasWindow) {
    localStorageMock.store = {};
    resetFragmentStartupForTests();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  vi.clearAllMocks();
});
