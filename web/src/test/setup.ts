import '@testing-library/jest-dom/vitest'

// Node ships a non-functional global `localStorage` that shadows jsdom's and
// throws unless a backing file is provided. Replace it with a simple in-memory
// implementation so tests that exercise persistence (useLocalStorage,
// useReviewedFiles, ...) behave like a browser.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
})

// jsdom does not implement document.execCommand; provide a no-op so the
// clipboard fallback path is exercisable (and spy-able) in tests.
// eslint-disable-next-line @typescript-eslint/no-deprecated
if (typeof document !== 'undefined' && typeof document.execCommand !== 'function') {
  Object.defineProperty(document, 'execCommand', {
    value: () => false,
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement matchMedia; provide a minimal stub so components
// that read the system color-scheme preference can render in tests.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  const stubMatchMedia = (query: string): MediaQueryList => {
    const mql = {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }
    return mql
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: stubMatchMedia,
  })
}
