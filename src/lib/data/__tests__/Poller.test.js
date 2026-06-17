// src/lib/data/__tests__/Poller.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import { status_store } from '../../stores/status.js'
import { uistates_store } from '../../stores/uistates.js'
import Poller from '../Poller.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  status_store.set(undefined)
  uistates_store.update((u) => ({ ...u, ws_connected: true }))
})

describe('Poller', () => {
  it('merges a successful poll into status_store and marks connected', async () => {
    httpAPI.mockResolvedValue({ amp: 24, state: 3 })
    render(Poller)
    await vi.waitFor(() => expect(get(status_store)?.amp).toBe(24))
    expect(get(uistates_store).ws_connected).toBe(true)
  })

  it('marks disconnected when a poll fails', async () => {
    httpAPI.mockResolvedValue('error')
    render(Poller)
    await vi.waitFor(() => expect(get(uistates_store).ws_connected).toBe(false))
  })

  it('does not poll when active is false', async () => {
    httpAPI.mockResolvedValue({ amp: 1 })
    render(Poller, { props: { active: false } })
    await Promise.resolve()
    expect(httpAPI).not.toHaveBeenCalled()
  })
})
