import { describe, it, expect } from 'vitest'
import { isPlugged, plugState } from '../vehicle.js'

describe('isPlugged', () => {
  it('reads booleans directly', () => {
    expect(isPlugged(true)).toBe(true)
    expect(isPlugged(false)).toBe(false)
  })
  it('treats non-zero numbers as plugged', () => {
    expect(isPlugged(1)).toBe(true)
    expect(isPlugged(0)).toBe(false)
  })
  it('parses common truthy strings (case/space-insensitive)', () => {
    expect(isPlugged('on')).toBe(true)
    expect(isPlugged(' True ')).toBe(true)
    expect(isPlugged('YES')).toBe(true)
    expect(isPlugged('1')).toBe(true)
    expect(isPlugged('off')).toBe(false)
    expect(isPlugged('false')).toBe(false)
  })
  it('is false for unknown types', () => {
    expect(isPlugged(undefined)).toBe(false)
    expect(isPlugged(null)).toBe(false)
    expect(isPlugged({})).toBe(false)
  })
})

describe('plugState', () => {
  it('returns null when vehicle_plugged is unknown (not configured)', () => {
    expect(plugState(undefined)).toBe(null)
    expect(plugState({})).toBe(null)
    expect(plugState({ vehicle_plugged: null })).toBe(null)
  })
  it('returns the boolean plug state when reported', () => {
    expect(plugState({ vehicle_plugged: true })).toBe(true)
    expect(plugState({ vehicle_plugged: 'off' })).toBe(false)
    expect(plugState({ vehicle_plugged: 0 })).toBe(false)
  })
})
