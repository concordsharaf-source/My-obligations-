/**
 * Instance expansion: turns an obligation + its payments into concrete due
 * instances (with per-occurrence overrides and FIFO payment attribution).
 */
import type { Obligation, ObligationInstance, Payment } from '@/types'
import { dueDateTime, todayISO } from '@/utils/date'
import { round2 } from '@/utils/money'
import { occurrencesBetween, stepDate } from './recurrence'

const SERIES_LOOKBACK_CAP = 1500

/**
 * FIFO: payments settle the earliest instances first.
 * Returns a map of original occurrence date -> paid amount.
 */
export function paymentAttribution(ob: Obligation, payments: Payment[]): Map<string, number> {
  const map = new Map<string, number>()
  if (!ob.financial || ob.amount <= 0) return map
  const mine = payments
    .filter((p) => p.obligationId === ob.id)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : 1))
  let pool = round2(mine.reduce((s, p) => s + p.amount, 0))
  if (pool <= 0) return map

  // walk the series from its start (bounded) so FIFO is deterministic
  const start = ob.dueDate
  let cur = start
  let guard = 0
  while (pool > 0.004 && guard < SERIES_LOOKBACK_CAP) {
    if (ob.recurrence.endDate && cur > ob.recurrence.endDate) break
    const st = ob.overrides[cur]?.status
    if (st !== 'cancelled' && st !== 'skipped') {
      const take = Math.min(pool, ob.amount)
      map.set(cur, round2(take))
      pool = round2(pool - take)
    }
    if (ob.recurrence.type === 'none') break
    cur = stepDate(cur, ob.recurrence)
    guard++
  }
  return map
}

export interface InstanceQuery {
  from: string
  to: string
  now?: Date
}

/**
 * Instances whose *effective* due date falls inside [from, to].
 * Includes completed/skipped/cancelled ones (filter upstream as needed).
 */
export function instancesIn(ob: Obligation, q: InstanceQuery, paidMap?: Map<string, number>): ObligationInstance[] {
  const now = q.now ?? new Date()
  const today = todayISO()
  void today
  const attribution = paidMap ?? paymentAttribution(ob, [])
  const out: ObligationInstance[] = []

  // Walk the series from its start so "this time only" reschedules that moved
  // an occurrence into the window are honoured; bounded by the window start.
  const scanFrom = ob.dueDate
  const bases = occurrencesBetween(ob.recurrence, scanFrom, scanFrom, q.to, 4000).filter(
    (base) => base >= scanFrom,
  )

  for (const base of bases) {
    const ov = ob.overrides[base]
    const effDate = ov?.dueDate ?? base
    const effTime = ov?.dueTime !== undefined ? ov.dueTime : ob.dueTime
    if (effDate < q.from || effDate > q.to) continue

    let status: ObligationInstance['status'] = ov?.status ?? 'pending'
    if (ob.recurrence.type === 'none' && ob.status === 'completed') status = 'completed'
    if (ob.status === 'cancelled') status = 'cancelled'

    const paid = round2(attribution.get(base) ?? 0)
    const remaining = round2(Math.max(0, ob.amount - paid))
    const end = dueDateTime(effDate, effTime ?? '23:59')
    const isOverdue = status === 'pending' && end.getTime() < now.getTime()

    out.push({
      obligation: ob,
      dueDate: effDate,
      dueTime: effTime,
      baseDate: base,
      status,
      completedAt: ov?.completedAt ?? (ob.recurrence.type === 'none' ? ob.completedAt : null),
      snoozedUntil: ov?.snoozedUntil ?? null,
      paid,
      remaining,
      isOverdue,
    })
  }
  return out
}

/** Single-instance view for a non-recurring obligation, or the series head. */
export function allInstancesUpTo(ob: Obligation, toISO: string, payments: Payment[]): ObligationInstance[] {
  const map = paymentAttribution(ob, payments)
  return instancesIn(ob, { from: ob.dueDate, to: toISO }, map)
}

export function isInstanceSettled(inst: ObligationInstance): boolean {
  if (inst.status === 'completed' || inst.status === 'cancelled' || inst.status === 'skipped') return true
  if (inst.obligation.financial && inst.remaining <= 0.004) return true
  return false
}
