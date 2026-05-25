import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import { EvseClients } from '../../../vars.js'

const { claims } = vi.hoisted(() => {
  const { writable } = require('svelte/store')
  const claims = writable({
    properties: { state: null, charge_current: null, max_current: null, auto_release: null },
    claims:     { state: null, charge_current: null, max_current: null, auto_release: null },
  })
  return { claims }
})

vi.mock('../../../stores/claims_target.js', () => ({ claims_target_store: claims }))

vi.mock('svelte-i18n', () => {
  // Return a string that appends serialised values so assertions can find them.
  const t = (k, opts) => {
    if (opts?.values) {
      const suffix = Object.values(opts.values).join(' ')
      return `${k} ${suffix}`
    }
    return k
  }
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ThrottleBadge from '../ThrottleBadge.svelte'

describe('ThrottleBadge', () => {
  it('renders nothing when temp-throttle claim is absent', () => {
    claims.set({ properties: {}, claims: { charge_current: EvseClients.manual.id } })
    const { container } = render(ThrottleBadge)
    expect(container.textContent.trim()).toBe('')
  })

  it('renders the throttled current when the temp-throttle claim is active', () => {
    claims.set({
      properties: { charge_current: 18 },
      claims:     { charge_current: EvseClients.tempThrottle.id },
    })
    render(ThrottleBadge)
    expect(screen.getByText(/18/)).toBeInTheDocument()
  })
})
