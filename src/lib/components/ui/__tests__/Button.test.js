import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Button from '../Button.svelte'

describe('Button', () => {
  it('renders its label', () => {
    const { getByRole } = render(Button, { props: { label: 'Stop' } })
    expect(getByRole('button')).toHaveTextContent('Stop')
  })

  it('calls onclick when clicked', async () => {
    const onclick = vi.fn()
    const { getByRole } = render(Button, { props: { label: 'Go', onclick } })
    await fireEvent.click(getByRole('button'))
    expect(onclick).toHaveBeenCalledOnce()
  })

  it('is disabled when the disabled prop is set', () => {
    const { getByRole } = render(Button, { props: { label: 'X', disabled: true } })
    expect(getByRole('button')).toBeDisabled()
  })
})
