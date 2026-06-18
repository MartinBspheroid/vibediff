import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import PrismThemeManager from './PrismThemeManager'

function themeHref(): string | undefined {
  return document.getElementById('prism-theme')?.getAttribute('href') ?? undefined
}

afterEach(() => {
  document.documentElement.classList.remove('dark')
  document.getElementById('prism-theme')?.remove()
})

describe('PrismThemeManager', () => {
  it('injects the light theme stylesheet by default', () => {
    render(<PrismThemeManager />)
    expect(themeHref()).toBe('/themes/prism.css')
  })

  it('swaps to the dark theme when the dark class is added', async () => {
    render(<PrismThemeManager />)
    document.documentElement.classList.add('dark')
    // The MutationObserver fires asynchronously.
    await new Promise((r) => setTimeout(r, 0))
    expect(themeHref()).toBe('/themes/prism-tomorrow.css')
  })

  it('removes the theme link on unmount', () => {
    const { unmount } = render(<PrismThemeManager />)
    expect(document.getElementById('prism-theme')).not.toBeNull()
    unmount()
    expect(document.getElementById('prism-theme')).toBeNull()
  })
})
