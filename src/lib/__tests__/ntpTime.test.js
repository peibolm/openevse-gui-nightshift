// src/lib/__tests__/ntpTime.test.js
import { describe, it, expect } from 'vitest'
import { remainingMs, fmtAgo, fmtCountdown } from '../ntpTime.js'

describe('remainingMs', () => {
  it('subtracts elapsed time', () => {
    expect(remainingMs(10_000, 3_000)).toBe(7_000)
  })
  it('clamps to 0 once elapsed exceeds the interval', () => {
    expect(remainingMs(10_000, 15_000)).toBe(0)
  })
  it('returns null when the next event is unknown', () => {
    expect(remainingMs(null, 1_000)).toBeNull()
    expect(remainingMs(undefined, 1_000)).toBeNull()
  })
})

describe('fmtAgo', () => {
  const now = 1_000_000 * 1000 // a fixed nowMs (unix-seconds * 1000)
  it('returns null for falsy timestamps', () => {
    expect(fmtAgo(0, now)).toBeNull()
    expect(fmtAgo(null, now)).toBeNull()
    expect(fmtAgo(undefined, now)).toBeNull()
  })
  it('formats just-now as 0s ago', () => {
    expect(fmtAgo(1_000_000, now)).toBe('0s ago')
  })
  it('formats seconds', () => {
    expect(fmtAgo(1_000_000 - 5, now)).toBe('5s ago')
  })
  it('formats minutes and seconds', () => {
    expect(fmtAgo(1_000_000 - 200, now)).toBe('3m 20s ago')
  })
  it('formats hours and minutes past 1h', () => {
    expect(fmtAgo(1_000_000 - 3840, now)).toBe('1h 4m ago')
  })
  it('clamps future timestamps to 0s ago', () => {
    expect(fmtAgo(1_000_000 + 50, now)).toBe('0s ago')
  })
})

describe('fmtCountdown', () => {
  it('returns the em dash for null', () => {
    expect(fmtCountdown(null)).toBe('—')
    expect(fmtCountdown(undefined)).toBe('—')
  })
  it('returns the em dash for elapsed durations', () => {
    expect(fmtCountdown(0)).toBe('—')
    expect(fmtCountdown(-500)).toBe('—')
  })
  it('rounds up sub-second remainders', () => {
    expect(fmtCountdown(1)).toBe('1s')
    expect(fmtCountdown(1_500)).toBe('2s')
  })
  it('formats seconds', () => {
    expect(fmtCountdown(5_000)).toBe('5s')
  })
  it('formats minutes and seconds', () => {
    expect(fmtCountdown(200_000)).toBe('3m 20s')
  })
  it('formats hours and minutes past 1h', () => {
    expect(fmtCountdown(3_840_000)).toBe('1h 4m')
  })
})
