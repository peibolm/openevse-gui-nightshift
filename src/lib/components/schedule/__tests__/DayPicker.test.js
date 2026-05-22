import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import DayPicker from '../DayPicker.svelte'

describe('DayPicker', () => {
  it('renders seven day chips', () => {
    const { getAllByRole } = render(DayPicker, {
      props: { flags: [false, false, false, false, false, false, false] },
    })
    // 7 day chips + 1 select-all/clear-all button = 8 buttons
    expect(getAllByRole('button')).toHaveLength(8)
  })
  it('toggles a day and fires onchange with the updated flags', async () => {
    const onchange = vi.fn()
    const { getAllByRole } = render(DayPicker, {
      props: { flags: [false, false, false, false, false, false, false], onchange },
    })
    await fireEvent.click(getAllByRole('button')[0]) // Monday
    expect(onchange).toHaveBeenCalledWith([true, false, false, false, false, false, false])
  })
  it('select-all fires onchange with every flag true', async () => {
    const onchange = vi.fn()
    const { getByText } = render(DayPicker, {
      props: { flags: [false, false, false, false, false, false, false], onchange },
    })
    await fireEvent.click(getByText('schedule.select_all'))
    expect(onchange).toHaveBeenCalledWith([true, true, true, true, true, true, true])
  })
  it('shows clear-all when every day is selected', () => {
    const { getByText } = render(DayPicker, {
      props: { flags: [true, true, true, true, true, true, true] },
    })
    expect(getByText('schedule.clear_all')).toBeInTheDocument()
  })
})
