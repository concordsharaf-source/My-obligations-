/**
 * Local-time date helpers. All stored dates are plain `YYYY-MM-DD` strings
 * (local calendar days) — never UTC-shifted — so "today" is always the user's today.
 */

const pad = (n: number): string => String(n).padStart(2, '0')

export const AR_LOCALE = 'ar-u-ca-gregory-nu-latn'

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** Parse `YYYY-MM-DD` as *local* midnight (avoiding Date's UTC parsing trap). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function parseTime(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { h: h ?? 0, m: m ?? 0 }
}

export function dueDateTime(dateISO: string, time: string | null): Date {
  const d = parseISODate(dateISO)
  if (time) {
    const { h, m } = parseTime(time)
    d.setHours(h, m, 0, 0)
  }
  return d
}

export function monthKeyOf(dateISO: string): string {
  return dateISO.slice(0, 7)
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7)
}

export function monthKeyFromParts(year: number, month1: number): string {
  return `${year}-${pad(month1)}`
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y ?? 2000, (m ?? 1) - 1 + delta, 1)
  return monthKeyFromParts(d.getFullYear(), d.getMonth() + 1)
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y ?? 2000, m ?? 1, 0).getDate()
}

export function monthLabel(month: string, opts: { long?: boolean } = {}): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y ?? 2000, (m ?? 1) - 1, 1)
  return new Intl.DateTimeFormat(AR_LOCALE, {
    month: opts.long ? 'long' : 'long',
    year: 'numeric',
  }).format(d)
}

export function monthShort(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y ?? 2000, (m ?? 1) - 1, 1)
  return new Intl.DateTimeFormat(AR_LOCALE, { month: 'short' }).format(d)
}

export function addDays(dateISO: string, days: number): string {
  const d = parseISODate(dateISO)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function addMonthsClamped(dateISO: string, months: number): string {
  const d = parseISODate(dateISO)
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, last))
  return toISODate(target)
}

export function diffDays(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO).getTime()
  const b = parseISODate(toISO).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** Inclusive list of ISO dates between two dates. */
export function rangeDates(fromISO: string, toISO: string): string[] {
  const out: string[] = []
  let cur = fromISO
  let guard = 0
  while (cur <= toISO && guard < 4000) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

export function startOfWeekISO(dateISO: string, weekStartsOn: number): string {
  const d = parseISODate(dateISO)
  const diff = (d.getDay() - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return toISODate(d)
}

export function weekDatesISO(dateISO: string, weekStartsOn: number): string[] {
  const start = startOfWeekISO(dateISO, weekStartsOn)
  return rangeDates(start, addDays(start, 6))
}

export const WEEKDAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function weekdayName(dateISO: string): string {
  return WEEKDAY_NAMES[parseISODate(dateISO).getDay()] ?? ''
}

export function formatDate(dateISO: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(AR_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opts,
  }).format(parseISODate(dateISO))
}

export function formatDateShort(dateISO: string): string {
  return new Intl.DateTimeFormat(AR_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseISODate(dateISO))
}

export function formatTime(hhmm: string): string {
  const { h, m } = parseTime(hhmm)
  const d = new Date(2000, 0, 1, h, m)
  return new Intl.DateTimeFormat(AR_LOCALE, { hour: 'numeric', minute: '2-digit' }).format(d)
}

export function formatDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime)
  if (Number.isNaN(d.getTime())) return isoDateTime
  return new Intl.DateTimeFormat(AR_LOCALE, {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

/** Human relative label: اليوم / غدًا / أمس / بعد ٣ أيام … */
export function relativeDay(dateISO: string, fromISO = todayISO()): string {
  const diff = diffDays(fromISO, dateISO)
  if (diff === 0) return 'اليوم'
  if (diff === 1) return 'غدًا'
  if (diff === 2) return 'بعد يومين'
  if (diff === -1) return 'أمس'
  if (diff === -2) return 'قبل يومين'
  if (diff > 2 && diff <= 10) return `بعد ${diff} أيام`
  if (diff < -2 && diff >= -10) return `قبل ${Math.abs(diff)} أيام`
  return formatDateShort(dateISO)
}

/** Minutes until the given datetime (negative when past). */
export function minutesUntil(target: Date, now = new Date()): number {
  return Math.round((target.getTime() - now.getTime()) / 60_000)
}

export function isSameMonth(dateISO: string, month: string): boolean {
  return dateISO.startsWith(month)
}

/** Greeting based on local hour. */
export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h >= 5 && h < 12) return 'صباح الخير'
  if (h >= 12 && h < 17) return 'مساء الخير'
  if (h >= 17 && h < 21) return 'مساء النور'
  return 'مساء الخير'
}
