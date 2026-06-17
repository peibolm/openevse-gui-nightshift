// src/routes/settings/__tests__/Security.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { certificate_store } from '../../../lib/stores/certificates.js'
import { config_store } from '../../../lib/stores/config.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Security from '../Security.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  certificate_store.set([])
  config_store.set({})
  uistates_store.resetAlertBox()
})

describe('Security page — TLS certificates', () => {
  it('shows the empty state when there are no certificates', () => {
    const { getByText } = render(Security)
    expect(getByText('config.certificates.empty')).toBeInTheDocument()
  })

  it('lists certificates from the store', () => {
    certificate_store.set([{ id: '1', type: 'root', name: 'Root CA' }])
    const { getByText } = render(Security)
    expect(getByText('Root CA')).toBeInTheDocument()
  })

  it('opens the add-modal', async () => {
    const { getByText, getByRole } = render(Security)
    expect(() => getByRole('dialog')).toThrow()
    await fireEvent.click(getByText('config.certificates.add'))
    expect(getByRole('dialog')).toBeInTheDocument()
  })

  it('deletes a certificate via the store', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    certificate_store.set([{ id: '7', type: 'client', name: 'Client A' }])
    const { getByLabelText } = render(Security)
    await fireEvent.click(getByLabelText('config.certificates.delete'))
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/certificates/7')
  })

  it('shows an alert when certificate delete returns an error', async () => {
    httpAPI.mockResolvedValue('error')
    certificate_store.set([{ id: '9', type: 'root', name: 'Bad CA' }])
    const { getByLabelText } = render(Security)
    await fireEvent.click(getByLabelText('config.certificates.delete'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})

describe('Security page — firmware security', () => {
  it('hides the heartbeat controls when the device does not report them', () => {
    config_store.set({})
    const { queryByText } = render(Security)
    expect(queryByText('config.security.heartbeat')).not.toBeInTheDocument()
  })

  it('shows interval + fail-current controls when heartbeat is enabled', () => {
    config_store.set({ heartbeat_interval: 5, heartbeat_current: 6 })
    const { getByText } = render(Security)
    expect(getByText('config.security.heartbeat_interval')).toBeInTheDocument()
    expect(getByText('config.security.heartbeat_current')).toBeInTheDocument()
  })

  it('disabling heartbeat zeroes both interval and fail-current ($SY off)', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    config_store.set({ heartbeat_interval: 5, heartbeat_current: 6 })
    const { getAllByLabelText } = render(Security)
    // The heartbeat enable toggle is the one labelled config.security.heartbeat.
    await fireEvent.click(getAllByLabelText('config.security.heartbeat')[0])
    await vi.waitFor(() => {
      const post = httpAPI.mock.calls.find(([m, u]) => m === 'POST' && u === '/config')
      expect(post).toBeTruthy()
      const body = JSON.parse(post[2])
      expect(body.heartbeat_interval).toBe(0)
      expect(body.heartbeat_current).toBe(0)
    })
  })
})
