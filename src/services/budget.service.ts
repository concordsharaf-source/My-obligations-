/**
 * «ميزانيتي» — the budget engine.
 * Income comes from income sources + variable entries; commitments are derived
 * automatically from financial obligations due inside the month (never typed twice).
 */
import type {
  AppSettings,
  BudgetMonth,
  BudgetStage,
  Category,
  IncomeEntry,
  IncomeSource,
  Obligation,
  Payment,
} from '@/types'
import { daysInMonth, monthKeyOf, shiftMonth, todayISO } from '@/utils/date'
import { round2 } from '@/utils/money'
import { expandInstances } from './obligations.service'
import { occurrencesPerYear } from './recurrence'

export interface BudgetContext {
  obligations: Obligation[]
  payments: Payment[]
  incomeSources: IncomeSource[]
  incomeEntries: IncomeEntry[]
  categories: Category[]
  settings: AppSettings
}

export function stageForRatio(ratio: number, s: AppSettings['budgetThresholds']): BudgetStage {
  // مريح ≤ comfortable < انتباه ≤ attention < مضغوطة ≤ 100 < تجاوز
  if (ratio > 100) return 'over'
  if (ratio > s.attention) return 'tight'
  if (ratio > s.comfortable) return 'attention'
  return 'comfortable'
}

/** true when the ratio passed the user's "very close to income" marker */
export function isCritical(ratio: number, s: AppSettings['budgetThresholds']): boolean {
  return ratio > s.tight && ratio <= 100
}

export const STAGE_META: Record<BudgetStage, { label: string; color: string; hint: string }> = {
  comfortable: { label: 'وضع مريح', color: '#16a34a', hint: 'التزاماتك ضمن مستوى جيد من دخلك.' },
  attention: { label: 'يحتاج انتباه', color: '#ca8a04', hint: 'الالتزامات ترتفع مقارنة بدخلك.' },
  tight: { label: 'ميزانية مضغوطة', color: '#ea580c', hint: 'الالتزامات قريبة جدًا من دخلك.' },
  over: { label: 'تجاوز الميزانية', color: '#dc2626', hint: 'الالتزامات أكبر من دخلك هذا الشهر.' },
}

export function computeBudgetMonth(month: string, ctx: BudgetContext): BudgetMonth {
  const { obligations, payments, incomeSources, incomeEntries, categories, settings } = ctx
  const from = `${month}-01`
  const to = `${month}-31`

  // ---- income ----
  const activeSources = incomeSources.filter((s) => s.active)
  const baseIncome = round2(activeSources.reduce((s, x) => s + x.amount, 0))
  const extra = incomeEntries.filter((e) => e.month === month)
  const extraTotal = round2(extra.reduce((s, e) => s + e.amount, 0))
  const income = round2(baseIncome + extraTotal)
  const incomeBreakdown = [
    ...activeSources.map((s) => ({ label: s.name, amount: s.amount })),
    ...extra.map((e) => ({ label: e.label, amount: e.amount })),
  ]

  // ---- commitments (financial "owe" obligations due in the month) ----
  const financial = obligations.filter(
    (o) => o.financial && o.direction === 'owe' && o.deletedAt === null && o.status !== 'cancelled',
  )
  const instances = expandInstances(financial, payments, from, to, { includeArchived: false })
  const relevant = instances.filter((i) => i.status !== 'cancelled' && i.status !== 'skipped')

  const commitments = round2(relevant.reduce((s, i) => s + i.obligation.amount, 0))
  const paid = round2(relevant.reduce((s, i) => s + i.paid, 0))
  const overdueInstances = relevant.filter((i) => i.isOverdue)
  const overdue = round2(overdueInstances.reduce((s, i) => s + i.remaining, 0))

  const catMap = new Map<string | null, number>()
  for (const i of relevant) {
    const key = i.obligation.categoryId
    catMap.set(key, round2((catMap.get(key) ?? 0) + i.obligation.amount))
  }
  const byCategory = [...catMap.entries()]
    .map(([categoryId, amount]) => {
      const cat = categories.find((c) => c.id === categoryId)
      return {
        categoryId,
        name: cat?.name ?? 'بدون تصنيف',
        color: cat?.color ?? '#94a3b8',
        amount,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  // ---- annual commitments touching this month's year ----
  const year = month.slice(0, 4)
  const annual = obligations
    .filter(
      (o) =>
        o.financial &&
        o.direction === 'owe' &&
        o.deletedAt === null &&
        o.status !== 'cancelled' &&
        o.recurrence.type === 'annual' &&
        o.dueDate.slice(0, 4) <= year &&
        (!o.recurrence.endDate || o.recurrence.endDate.slice(0, 4) >= year),
    )
    .map((o) => ({
      name: o.title,
      annualCost: round2(o.amount * occurrencesPerYear(o.recurrence)),
      monthlyAverage: round2((o.amount * occurrencesPerYear(o.recurrence)) / 12),
    }))

  const ratio = income > 0 ? round2((commitments / income) * 100) : commitments > 0 ? 999 : 0
  const dim = daysInMonth(month)

  return {
    month,
    income,
    incomeBreakdown,
    commitments,
    paid,
    remaining: round2(income - commitments),
    overdue,
    lateCount: overdueInstances.length,
    ratio,
    stage: stageForRatio(ratio, settings.budgetThresholds),
    daysInMonth: dim,
    dailyAllowance: income - commitments > 0 ? round2((income - commitments) / dim) : 0,
    byCategory,
    annual,
  }
}

/** Rolling history: previous months + upcoming ones (computed, always accurate). */
export function computeBudgetHistory(
  anchorMonth: string,
  back: number,
  forward: number,
  ctx: BudgetContext,
): BudgetMonth[] {
  const out: BudgetMonth[] = []
  for (let i = back; i >= -forward; i--) {
    out.push(computeBudgetMonth(shiftMonth(anchorMonth, -i), ctx))
  }
  return out
}

/** Months that actually have recorded activity (for the history list). */
export function activeMonths(ctx: BudgetContext, limit = 24): string[] {
  const set = new Set<string>()
  const today = todayISO()
  set.add(monthKeyOf(today))
  for (const o of ctx.obligations) {
    if (o.deletedAt) continue
    if (o.financial && o.direction === 'owe') set.add(monthKeyOf(o.dueDate))
  }
  for (const e of ctx.incomeEntries) set.add(e.month)
  for (const p of ctx.payments) set.add(monthKeyOf(p.date))
  return [...set].sort((a, b) => (a < b ? 1 : -1)).slice(0, limit)
}

/** Month selector bounds used by the UI navigator. */
export function monthNavBounds(): { min: string; max: string } {
  const now = todayISO().slice(0, 7)
  return { min: shiftMonth(now, -60), max: shiftMonth(now, 60) }
}
