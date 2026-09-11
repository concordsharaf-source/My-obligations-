/** Aggregate statistics — all computed locally from stored data. */
import type { BudgetContext } from './budget.service'
import { computeBudgetHistory } from './budget.service'
import { expandInstances } from './obligations.service'
import { paymentAttribution } from './instances'
import type { ObligationInstance } from '@/types'
import { round2 } from '@/utils/money'
import { shiftMonth, todayISO } from '@/utils/date'

export interface DebtTotals {
  total: number
  paid: number
  remaining: number
  overdue: number
  overdueCount: number
  upcoming: { date: string; amount: number; title: string } | null
  count: number
}

function totalsFor(
  obligations: BudgetContext['obligations'],
  payments: BudgetContext['payments'],
  direction: 'owe' | 'owed',
): DebtTotals {
  const list = obligations.filter(
    (o) => o.financial && o.direction === direction && o.deletedAt === null && o.status !== 'cancelled',
  )
  const today = todayISO()
  let total = 0
  let paid = 0
  let overdue = 0
  let overdueCount = 0
  let upcoming: DebtTotals['upcoming'] = null
  for (const ob of list) {
    total = round2(total + ob.amount)
    const map = paymentAttribution(ob, payments)
    const p = round2([...map.values()].reduce((s, v) => s + v, 0))
    paid = round2(paid + Math.min(p, ob.amount))
    const isOpen = ob.status === 'active' && p + 0.004 < ob.amount
    if (isOpen && ob.dueDate < today) {
      overdue = round2(overdue + Math.max(0, ob.amount - p))
      overdueCount++
    }
    if (isOpen && ob.dueDate >= today && (!upcoming || ob.dueDate < upcoming.date)) {
      upcoming = { date: ob.dueDate, amount: round2(ob.amount - p), title: ob.title }
    }
  }
  return {
    total,
    paid,
    remaining: round2(total - paid),
    overdue,
    overdueCount,
    upcoming,
    count: list.length,
  }
}

export interface StatsSnapshot {
  owe: DebtTotals
  owed: DebtTotals
  completedCount: number
  openCount: number
  overdueCount: number
  byCategory: { name: string; color: string; count: number; amount: number }[]
  trend: { month: string; income: number; commitments: number; remaining: number }[]
  instances: ObligationInstance[]
}

export function computeStats(ctx: BudgetContext): StatsSnapshot {
  const today = todayISO()
  const month = today.slice(0, 7)
  const instances = expandInstances(ctx.obligations, ctx.payments, `${month}-01`, `${month}-31`)
  const open = instances.filter((i) => i.status === 'pending')

  const completedCount = instances.filter((i) => i.status === 'completed').length
  const overdueCount = open.filter((i) => i.isOverdue).length

  const catMap = new Map<string, { name: string; color: string; count: number; amount: number }>()
  for (const i of open) {
    const cat = ctx.categories.find((c) => c.id === i.obligation.categoryId)
    const key = cat?.id ?? 'none'
    const entry = catMap.get(key) ?? { name: cat?.name ?? 'بدون تصنيف', color: cat?.color ?? '#94a3b8', count: 0, amount: 0 }
    entry.count++
    if (i.obligation.financial) entry.amount = round2(entry.amount + i.obligation.amount)
    catMap.set(key, entry)
  }

  const history = computeBudgetHistory(month, 5, 0, ctx)
  void shiftMonth

  return {
    owe: totalsFor(ctx.obligations, ctx.payments, 'owe'),
    owed: totalsFor(ctx.obligations, ctx.payments, 'owed'),
    completedCount,
    openCount: open.length,
    overdueCount,
    byCategory: [...catMap.values()].sort((a, b) => b.count - a.count),
    trend: history.map((b) => ({ month: b.month, income: b.income, commitments: b.commitments, remaining: b.remaining })),
    instances,
  }
}
