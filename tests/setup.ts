import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// minimal browser shims for jsdom
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

class LocalStorageMock {
  private map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  clear(): void {
    this.map.clear()
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null
  }
  get length(): number {
    return this.map.size
  }
}
if (!window.localStorage) {
  Object.defineProperty(window, 'localStorage', { value: new LocalStorageMock(), configurable: true })
}
if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', { value: window.localStorage, configurable: true })
}
