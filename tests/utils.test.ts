import { describe, expect, it } from 'vitest'
import { addMonthsClamped, diffDays, daysInMonth, monthLabel, shiftMonth, startOfWeekISO, weekDatesISO, relativeDay, todayISO } from '@/utils/date'
import { formatMoney, parseAmount, round2, normalizeDigits, formatAmount } from '@/utils/money'

describe('date utils', () => {
  it('clamps month additions', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-08-31', 1)).toBe('2026-09-30')
  })
  it('month math', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
  })
  it('labels months in arabic (gregorian)', () => {
    expect(monthLabel('2026-09')).toContain('سبتمبر')
    expect(monthLabel('2026-09')).toContain('2026')
  })
  it('week boundaries honour weekStartsOn', () => {
    // 2026-09-11 is a Friday
    expect(startOfWeekISO('2026-09-11', 6)).toBe('2026-09-05') // Saturday start
    expect(weekDatesISO('2026-09-11', 6)).toHaveLength(7)
  })
  it('relative labels', () => {
    const t = todayISO()
    expect(relativeDay(t, t)).toBe('اليوم')
    expect(relativeDay(addMonthsClamped(t, 0).slice(0, 8) + String(Number(t.slice(8)) + 1).padStart(2, '0'), t)).toBe('غدًا')
    expect(diffDays('2026-09-01', '2026-09-10')).toBe(9)
  })
})

describe('money utils', () => {
  it('rounds safely', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(100_000.005)).toBe(100_000.01)
  })
  it('parses user input incl. arabic digits and separators', () => {
    expect(parseAmount('1,500.5')).toBe(1500.5)
    expect(parseAmount('٢٥٠'.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))).toBe(250)
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(normalizeDigits('٣٠٠,٠٠٠')).toBe('300,000')
  })
  it('formats with latin digits and symbol', () => {
    expect(formatMoney(300000)).toBe('300,000')
    expect(formatAmount(1500, 'YER')).toContain('ر.ي')
  })
})
