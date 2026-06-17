// src/lib/data/__tests__/TransportManager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import { httpAPI } from '../../api/httpAPI.js'
import { uistates_store } from '../../stores/uistates.js'
import TransportManager from '../TransportManager.svelte'

// A fake WebSocket we drive by hand. Captures the latest instance.
let lastWs
class FakeWS {
  constructor() { this.listeners = {}; lastWs = this; this.readyState = 0; this.OPEN = 1 }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn) }
  removeEventListener() {}
  send() {}
  close() { this.emit('close') }
  emit(t, data) { (this.listeners[t] || []).forEach((fn) => fn({ data })) }
}

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue('error')
  lastWs = undefined
  globalThis.WebSocket = FakeWS
  uistates_store.update((u) => ({ ...u, ws_connected: true }))
})

describe('TransportManager', () => {
  it('polls at startup before any WebSocket is live', async () => {
    httpAPI.mockResolvedValue({ amp: 5 })
    render(TransportManager)
    await vi.waitFor(() => expect(httpAPI).toHaveBeenCalledWith('GET', '/status'))
  })

  it('stops polling once the WebSocket goes live', async () => {
    httpAPI.mockResolvedValue({ amp: 5 })
    render(TransportManager)
    await vi.waitFor(() => expect(lastWs).toBeTruthy())
    lastWs.readyState = 1
    lastWs.emit('open')
    lastWs.emit('message', '{"amp":6}')
    const callsAfterLive = httpAPI.mock.calls.length
    await new Promise((r) => setTimeout(r, 60))
    // No *new* polls fire while the socket is live (allow the in-flight one).
    expect(httpAPI.mock.calls.length).toBeLessThanOrEqual(callsAfterLive + 1)
  })
})
