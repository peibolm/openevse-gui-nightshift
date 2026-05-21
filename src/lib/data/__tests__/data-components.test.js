import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import WebSocket from '../WebSocket.svelte'
import DataManager from '../DataManager.svelte'

describe('data components', () => {
  it('WebSocket mounts without throwing', () => {
    expect(() => render(WebSocket)).not.toThrow()
  })
  it('DataManager mounts without throwing', () => {
    expect(() => render(DataManager)).not.toThrow()
  })
})
