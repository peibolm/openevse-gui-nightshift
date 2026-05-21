import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'

function mockMatchMedia(prefersDark) {
  window.matchMedia = vi.fn(() => ({
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('theme store', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('resolves to the OS preference when no override is set', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    expect(get(theme).resolved).toBe('dark')
  })

  it('applies the resolved theme to the document element', async () => {
    mockMatchMedia(false)
    const { theme } = await import('../theme.js')
    theme.init()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setTheme overrides the OS preference and persists it', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    theme.setTheme('light')
    expect(get(theme).resolved).toBe('light')
    expect(JSON.parse(localStorage.getItem('oevse-theme'))).toBe('light')
  })

  it('setTheme("system") clears the override', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    theme.setTheme('light')
    theme.setTheme('system')
    expect(get(theme).override).toBe(null)
    expect(get(theme).resolved).toBe('dark')
  })
})
