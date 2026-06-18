import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyText } from './clipboard'

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('copyText', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    const ok = await copyText('hello')
    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when the Clipboard API is unavailable', async () => {
    setClipboard(undefined)
    const exec = vi.spyOn(document, 'execCommand').mockReturnValue(true)
    const ok = await copyText('hi')
    expect(ok).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('falls back when the Clipboard API rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('blocked')) })
    const exec = vi.spyOn(document, 'execCommand').mockReturnValue(true)
    const ok = await copyText('hi')
    expect(ok).toBe(true)
    expect(exec).toHaveBeenCalled()
  })

  it('returns false when both paths fail', async () => {
    setClipboard(undefined)
    vi.spyOn(document, 'execCommand').mockReturnValue(false)
    expect(await copyText('hi')).toBe(false)
  })
})
