import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeControls from '../ChargeControls.svelte'

const base = {
  segment: 'auto', divertEnabled: true, shaperEnabled: true,
  shaperOn: false, locked: false, lockLabel: '', disabled: false, boostEndsAt: null,
}

describe('ChargeControls', () => {
  it('renders four segments when divert is enabled', () => {
    const { getByText } = render(ChargeControls, { props: { ...base } })
    for (const label of ['dashboard.mode.off', 'dashboard.mode.auto', 'dashboard.eco', 'dashboard.mode.on'])
      expect(getByText(label)).toBeInTheDocument()
  })

  it('omits the eco segment when divert is disabled', () => {
    const { queryByText } = render(ChargeControls, { props: { ...base, divertEnabled: false } })
    expect(queryByText('dashboard.eco')).not.toBeInTheDocument()
  })

  it('marks the selected segment with aria-checked', () => {
    const { getByText } = render(ChargeControls, { props: { ...base, segment: 'eco' } })
    expect(getByText('dashboard.eco').getAttribute('aria-checked')).toBe('true')
    expect(getByText('dashboard.mode.auto').getAttribute('aria-checked')).toBe('false')
  })

  it('emits onsegment with the clicked segment key', async () => {
    const onsegment = vi.fn()
    const { getByText } = render(ChargeControls, { props: { ...base, onsegment } })
    await fireEvent.click(getByText('dashboard.mode.on'))
    expect(onsegment).toHaveBeenCalledWith('on')
  })

  it('shows the locked box and hides the segments when locked', () => {
    const { getByText, queryByText } = render(ChargeControls, {
      props: { ...base, locked: true, lockLabel: 'OCPP' },
    })
    expect(getByText('dashboard.controls.locked_by:{"owner":"OCPP"}')).toBeInTheDocument()
    expect(queryByText('dashboard.mode.auto')).not.toBeInTheDocument()
  })

  it('renders the shaper toggle only when shaper is enabled', () => {
    const on = render(ChargeControls, { props: { ...base } })
    expect(on.getByLabelText('dashboard.shaper')).toBeInTheDocument()
    cleanup()
    const off = render(ChargeControls, { props: { ...base, shaperEnabled: false } })
    expect(off.queryByLabelText('dashboard.shaper')).not.toBeInTheDocument()
  })

  it('emits onshaper with the toggled value', async () => {
    const onshaper = vi.fn()
    const { getByLabelText } = render(ChargeControls, { props: { ...base, shaperOn: false, onshaper } })
    await fireEvent.click(getByLabelText('dashboard.shaper'))
    expect(onshaper).toHaveBeenCalledWith(true)
  })

  it('disables the segment buttons when disabled', () => {
    const { getByText } = render(ChargeControls, { props: { ...base, disabled: true } })
    expect(getByText('dashboard.mode.auto')).toBeDisabled()
  })

  it('takes the active-boost layout (shaper outside the grid) when a boost is running', () => {
    const { getByLabelText, container } = render(ChargeControls, {
      props: { ...base, boostEndsAt: 9_999_999_999_999 },
    })
    const shaper = getByLabelText('dashboard.shaper')
    // In the active-boost branch the shaper toggle is rendered full-width,
    // not inside the two-up `grid-cols-2` modifier grid.
    expect(shaper).toBeInTheDocument()
    expect(shaper.closest('.grid-cols-2')).toBeNull()
  })
})
