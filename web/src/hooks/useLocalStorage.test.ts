import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLocalStorage } from './useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists a plain string verbatim', () => {
    renderHook(() => { useLocalStorage('k-str', 'hello') })
    expect(localStorage.getItem('k-str')).toBe('hello')
  })

  it('serializes a Set as a JSON array', () => {
    renderHook(() => { useLocalStorage('k-set', new Set(['a', 'b'])) })
    expect(JSON.parse(localStorage.getItem('k-set') ?? '[]')).toEqual(['a', 'b'])
  })

  it('JSON-serializes objects', () => {
    renderHook(() => { useLocalStorage('k-obj', { x: 1 }) })
    expect(JSON.parse(localStorage.getItem('k-obj') ?? '{}')).toEqual({ x: 1 })
  })

  it('does not write null/undefined values', () => {
    renderHook(() => { useLocalStorage('k-null', null) })
    expect(localStorage.getItem('k-null')).toBeNull()
  })
})
