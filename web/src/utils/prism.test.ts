import { describe, it, expect } from 'vitest'
import { getLanguageFromFilename, highlightCode } from './prism'

describe('getLanguageFromFilename', () => {
  it('maps known extensions to Prism languages', () => {
    expect(getLanguageFromFilename('main.go')).toBe('go')
    expect(getLanguageFromFilename('App.tsx')).toBe('tsx')
    expect(getLanguageFromFilename('hook.ts')).toBe('typescript')
    expect(getLanguageFromFilename('script.py')).toBe('python')
    expect(getLanguageFromFilename('styles.scss')).toBe('scss')
  })

  it('is case-insensitive on the extension', () => {
    expect(getLanguageFromFilename('FILE.GO')).toBe('go')
  })

  it('falls back to plaintext for unknown or missing extensions', () => {
    expect(getLanguageFromFilename('LICENSE')).toBe('plaintext')
    expect(getLanguageFromFilename('weird.zzz')).toBe('plaintext')
  })
})

describe('highlightCode', () => {
  it('returns highlighted markup for a known language', () => {
    const out = highlightCode('const x = 1', 'typescript')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })

  it('HTML-escapes content for an unknown language (no raw tags)', () => {
    const out = highlightCode('<script>alert(1)</script>', 'plaintext')
    // Prism.util.encode escapes "<" (and "&"), neutralizing tag injection.
    expect(out).not.toContain('<script')
    expect(out).toContain('&lt;script')
  })
})
