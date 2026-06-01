// src/lib/config/__tests__/homeassistant.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isHaConnected, startHaAuth } from '../homeassistant.js'

describe('isHaConnected', () => {
  it('is true only when status reports connected', () => {
    expect(isHaConnected({ enabled: true, connected: true })).toBe(true)
    expect(isHaConnected({ enabled: true, connected: false })).toBe(false)
    expect(isHaConnected({})).toBe(false)
    expect(isHaConnected(undefined)).toBe(false)
  })
})

describe('startHaAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { href: '' })
  })
  it('navigates the browser to the firmware start endpoint', () => {
    startHaAuth()
    expect(window.location.href).toContain('/ha/auth/start')
  })
})
