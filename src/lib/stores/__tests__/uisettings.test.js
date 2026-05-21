import { describe, it, expect } from 'vitest'
import { get } from 'svelte/store'
import { uisettings_store } from '../uisettings.js'

describe('uisettings_store', () => {
  it('is a writable store with an object value', () => {
    expect(typeof uisettings_store.subscribe).toBe('function')
    expect(typeof get(uisettings_store)).toBe('object')
  })
})
