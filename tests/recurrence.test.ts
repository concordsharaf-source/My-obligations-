import { describe, expect, it } from 'vitest'
import { occurrencesBetween, nextOccurrence, stepDate, occursOn, describeRecurrence, occurrencesPerYear } from '@/services/recurrence'
import type { RecurrenceRule } from '@/types'

const r = (type: RecurrenceRule['type'], interval = 1, endDate: string | null = null): RecurrenceRule => ({
  type,
  interval,
  endDate,
})

describe('recurrence engine', () => {
  it('steps monthly with end-of-month clamping', () => {
    expect(stepDate('2026-01-31', r('monthly'))).toBe('2026-02-28')
    expect(stepDate('2026-02-28', r('monthly'))).toBe('2026-03-28')
    expect(stepDate('2026-01-31', r('monthly'))).not.toBe('2026-03-03')
  })

  it('lists monthly occurrences inside a window', () => {
    const list = occurrencesBetween(r('monthly'), '2026-01-15', '2026-03-01', '2026-05-31')
    expect(list).toEqual(['2026-03-15', '2026-04-15', '2026-05-15'])
  })

  it('honours endDate', () => {
    const list = occurrencesBetween(r('weekly', 1, '2026-09-20'), '2026-09-01', '2026-09-01', '2026-10-31')
    expect(list).toEqual(['2026-09-01', '2026-09-08', '2026-09-15'])
  })

  it('supports every_n_days and biweekly', () => {
    expect(occurrencesBetween(r('every_n_days', 3), '2026-09-01', '2026-09-01', '2026-09-10')).toEqual([
      '2026-09-01',
      '2026-09-04',
      '2026-09-07',
      '2026-09-10',
    ])
    expect(occurrencesBetween(r('biweekly'), '2026-09-01', '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-01',
      '2026-09-15',
      '2026-09-29',
    ])
  })

  it('quarterly / semiannual / annual', () => {
    expect(occurrencesBetween(r('quarterly'), '2026-01-10', '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-10',
      '2026-04-10',
      '2026-07-10',
      '2026-10-10',
    ])
    expect(occurrencesBetween(r('annual'), '2026-03-05', '2026-01-01', '2028-12-31')).toEqual([
      '2026-03-05',
      '2027-03-05',
      '2028-03-05',
    ])
  })

  it('nextOccurrence skips past dates', () => {
    expect(nextOccurrence(r('monthly'), '2026-01-20', '2026-09-11')).toBe('2026-09-20')
    expect(nextOccurrence(r('none'), '2026-01-20', '2026-09-11')).toBeNull()
  })

  it('occursOn detects series membership', () => {
    expect(occursOn(r('weekly'), '2026-09-05', '2026-09-19')).toBe(true)
    expect(occursOn(r('weekly'), '2026-09-05', '2026-09-18')).toBe(false)
  })

  it('labels and per-year counts', () => {
    expect(describeRecurrence(r('monthly'))).toContain('شهري')
    expect(describeRecurrence(r('every_n_days', 5))).toContain('كل 5 يوم')
    expect(occurrencesPerYear(r('biweekly'))).toBe(26)
    expect(occurrencesPerYear(r('annual'))).toBe(1)
  })
})
