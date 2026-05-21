import { describe, it, expect } from 'vitest'
import { routes } from '../routes.js'

describe('route table', () => {
  it('maps the four primary paths', () => {
    expect(routes['/']).toBeDefined()
    expect(routes['/schedule']).toBeDefined()
    expect(routes['/monitoring']).toBeDefined()
    expect(routes['/history']).toBeDefined()
  })
})
