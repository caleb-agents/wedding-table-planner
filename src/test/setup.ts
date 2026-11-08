import '@testing-library/react';
import { vi, afterEach } from 'vitest';

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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

afterEach(() => {
  localStorageMock.store = {};
  vi.clearAllMocks();
});
