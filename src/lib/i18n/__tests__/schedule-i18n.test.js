import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('schedule i18n keys', () => {
  it('has a days block with all seven days', () => {
    for (const d of ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) {
      expect(en.days[d]).toBeTypeOf('string')
    }
  })
  it('has the schedule block', () => {
    expect(en.schedule.empty).toBeTypeOf('string')
    expect(en.schedule.new).toBeTypeOf('string')
    expect(en.schedule.edit_title).toBeTypeOf('string')
    expect(en.schedule.new_title).toBeTypeOf('string')
    expect(en.schedule.time).toBeTypeOf('string')
    expect(en.schedule.state).toBeTypeOf('string')
    expect(en.schedule.active).toBeTypeOf('string')
    expect(en.schedule.disabled).toBeTypeOf('string')
    expect(en.schedule.select_all).toBeTypeOf('string')
    expect(en.schedule.clear_all).toBeTypeOf('string')
    expect(en.schedule.save).toBeTypeOf('string')
    expect(en.schedule.cancel).toBeTypeOf('string')
    expect(en.schedule.error_no_day).toBeTypeOf('string')
    expect(en.schedule.error_title).toBeTypeOf('string')
    expect(en.schedule.error_body).toBeTypeOf('string')
  })
})
