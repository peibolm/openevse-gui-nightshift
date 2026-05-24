import { describe, it, expect } from 'vitest'
import { computePull, PULL_THRESHOLD_PX, PULL_MAX_PX } from '../pullRefresh.js'

describe('computePull', () => {
  it('returns no displacement for an upward swipe', () => {
    expect(computePull(100, 80)).toEqual({ displacement: 0, armed: false })
  })

  it('returns no displacement for no movement', () => {
    expect(computePull(100, 100)).toEqual({ displacement: 0, armed: false })
  })

  it('applies the 0.5 resist factor for small pulls', () => {
    expect(computePull(0, 40)).toEqual({ displacement: 20, armed: false })
  })

  it('arms once displacement crosses the threshold', () => {
    expect(computePull(0, PULL_THRESHOLD_PX * 2).armed).toBe(true)
    expect(computePull(0, PULL_THRESHOLD_PX * 2 - 2).armed).toBe(false)
  })

  it('caps displacement at PULL_MAX_PX no matter how far you drag', () => {
    expect(computePull(0, 10000).displacement).toBe(PULL_MAX_PX)
  })
})
