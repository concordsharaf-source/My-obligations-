/**
 * Recurrence engine — pure functions, no I/O.
 * An obligation anchors its series at `dueDate`; occurrences step forward
 * according to the rule until `endDate` (if any).
 */
import type { RecurrenceRule, RecurrenceType } from '@/types'
import { addDays, addMonthsClamped } from '@/utils/date'

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: 'بدون تكرار',
  daily: 'يومي',
  every_n_days: 'كل عدة أيام',
  weekly: 'أسبوعي',
  biweekly: 'كل أسبوعين',
  monthly: 'شهري',
  every_n_months: 'كل عدة أشهر',
  quarterly: 'ربع سنوي',
  semiannual: 'نصف سنوي',
  annual: 'سنوي',
  custom: 'مخصص',
}

export function isRecurring(rule: RecurrenceRule): boolean {
  return rule.type !== 'none'
}

/** Advance one step of the series. */
export function stepDate(dateISO: string, rule: RecurrenceRule): string {
  const interval = Math.max(1, Math.round(rule.interval || 1))
  switch (rule.type) {
    case 'none':
      return dateISO
    case 'daily':
      return addDays(dateISO, 1)
    case 'every_n_days':
    case 'custom':
      return addDays(dateISO, interval)
    case 'weekly':
      return addDays(dateISO, 7)
    case 'biweekly':
      return addDays(dateISO, 14)
    case 'monthly':
      return addMonthsClamped(dateISO, 1)
    case 'every_n_months':
      return addMonthsClamped(dateISO, interval)
    case 'quarterly':
      return addMonthsClamped(dateISO, 3)
    case 'semiannual':
      return addMonthsClamped(dateISO, 6)
    case 'annual':
      return addMonthsClamped(dateISO, 12)
  }
}

/** All original occurrence dates in [fromISO, toISO] (inclusive), capped for safety. */
export function occurrencesBetween(
  rule: RecurrenceRule,
  startISO: string,
  fromISO: string,
  toISO: string,
  cap = 2000,
): string[] {
  const out: string[] = []
  if (rule.type === 'none') {
    return startISO >= fromISO && startISO <= toISO ? [startISO] : []
  }
  const last = rule.endDate && rule.endDate < toISO ? rule.endDate : toISO
  let cur = startISO
  let guard = 0
  while (cur <= last && guard < cap) {
    if (cur >= fromISO) out.push(cur)
    cur = stepDate(cur, rule)
    guard++
  }
  return out
}

/** First occurrence strictly after `afterISO`, or null beyond the horizon. */
export function nextOccurrence(
  rule: RecurrenceRule,
  startISO: string,
  afterISO: string,
  horizonDays = 3660,
): string | null {
  if (rule.type === 'none') return startISO > afterISO ? startISO : null
  const horizon = addDays(afterISO, horizonDays)
  let cur = startISO
  let guard = 0
  while (cur <= horizon && guard < 5000) {
    if (cur > afterISO) {
      if (rule.endDate && cur > rule.endDate) return null
      return cur
    }
    cur = stepDate(cur, rule)
    guard++
  }
  return null
}

/** Does the series produce an occurrence on this exact date? */
export function occursOn(rule: RecurrenceRule, startISO: string, dateISO: string): boolean {
  if (rule.type === 'none') return startISO === dateISO
  if (dateISO < startISO) return false
  if (rule.endDate && dateISO > rule.endDate) return false
  let cur = startISO
  let guard = 0
  while (cur <= dateISO && guard < 5000) {
    if (cur === dateISO) return true
    cur = stepDate(cur, rule)
    guard++
  }
  return false
}

export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.type === 'none') return ''
  const base = RECURRENCE_LABELS[rule.type]
  const interval = Math.max(1, Math.round(rule.interval || 1))
  let text = base
  if (rule.type === 'every_n_days' || rule.type === 'custom') text = `كل ${interval} يوم`
  if (rule.type === 'every_n_months') text = `كل ${interval} شهر`
  if (rule.endDate) text += ` حتى ${rule.endDate}`
  return text
}

/** Occurrences per year (approximate, for the annual-cost view). */
export function occurrencesPerYear(rule: RecurrenceRule): number {
  switch (rule.type) {
    case 'none':
      return 1
    case 'daily':
      return 365
    case 'every_n_days':
    case 'custom':
      return Math.round(365 / Math.max(1, rule.interval))
    case 'weekly':
      return 52
    case 'biweekly':
      return 26
    case 'monthly':
      return 12
    case 'every_n_months':
      return Math.round(12 / Math.max(1, rule.interval))
    case 'quarterly':
      return 4
    case 'semiannual':
      return 2
    case 'annual':
      return 1
  }
}
