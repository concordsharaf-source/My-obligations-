/**
 * «اقتراحات التزاماتي» — a local rules engine (no external AI).
 * Pure function over the current dataset; fast and deterministic.
 * Designed so an AI provider can be plugged in later behind the same interface.
 */
import type { BudgetContext, } from './budget.service'
import { computeBudgetMonth } from './budget.service'
import { expandInstances } from './obligations.service'
import type { Suggestion } from '@/types'
import { addDays, daysInMonth, formatDateShort, todayISO, weekdayName } from '@/utils/date'
import { formatAmount } from '@/utils/money'

export interface SuggestionProvider {
  id: string
  run(ctx: BudgetContext): Suggestion[]
}

const rules: SuggestionProvider = {
  id: 'local-rules',
  run(ctx): Suggestion[] {
    const out: Suggestion[] = []
    const today = todayISO()
    const month = today.slice(0, 7)
    const currency = ctx.settings.currency

    const open = expandInstances(ctx.obligations, ctx.payments, addDays(today, -365), addDays(today, 365)).filter(
      (i) => i.status === 'pending',
    )
    const todayItems = open.filter((i) => i.dueDate === today)
    const overdueItems = open.filter((i) => i.isOverdue)

    // 1 — busy today
    if (todayItems.length >= 3) {
      out.push({
        id: 'busy-today',
        severity: 'info',
        title: `لديك ${todayItems.length} التزامات اليوم`,
        detail: 'راجع جدول اليوم ورتّب الأولويات مبكرًا.',
        to: '/calendar',
      })
    }

    // 2 — debt due tomorrow
    const tomorrowDebt = open.find(
      (i) => i.obligation.financial && i.obligation.direction === 'owe' && i.dueDate === addDays(today, 1) && i.remaining > 0,
    )
    if (tomorrowDebt) {
      out.push({
        id: 'debt-tomorrow',
        severity: 'warning',
        title: 'دين يستحق السداد غدًا',
        detail: `«${tomorrowDebt.obligation.title}» بمبلغ ${formatAmount(tomorrowDebt.remaining, currency)}.`,
        to: `/obligation/${tomorrowDebt.obligation.id}`,
      })
    }

    // 3 — overdue
    if (overdueItems.length > 0) {
      out.push({
        id: 'overdue',
        severity: 'danger',
        title: `لديك ${overdueItems.length} التزام متأخر`,
        detail: `أقدمها «${overdueItems[0].obligation.title}» منذ ${formatDateShort(overdueItems[0].dueDate)}.`,
        to: '/obligations?filter=overdue',
      })
    }

    // 4 — cluster of payments at month end
    const dim = daysInMonth(month)
    const monthEnd = open.filter(
      (i) =>
        i.obligation.financial &&
        i.dueDate >= `${month}-${String(dim - 4).padStart(2, '0')}` &&
        i.dueDate <= `${month}-${String(dim).padStart(2, '0')}`,
    )
    if (monthEnd.length >= 3) {
      out.push({
        id: 'month-end',
        severity: 'info',
        title: `لديك ${monthEnd.length} دفعات مالية في نهاية الشهر`,
        detail: 'جهّز السيولة المطلوبة قبل موعد الاستحقاق.',
        to: '/budget',
      })
    }

    // 5 — budget pressure
    const budget = computeBudgetMonth(month, ctx)
    if (budget.income > 0 && budget.ratio > ctx.settings.budgetThresholds.attention) {
      out.push({
        id: 'budget-pressure',
        severity: budget.ratio > 100 ? 'danger' : 'warning',
        title: 'التزاماتك المالية هذا الشهر مرتفعة مقارنة بدخلك',
        detail: `النسبة ${Math.round(budget.ratio)}% من دخلك. راجع ميزانيتي للتفاصيل.`,
        to: '/budget',
      })
    }

    // 6 — recurring bill due soon
    const recurringSoon = open.find(
      (i) =>
        i.obligation.recurrence.type !== 'none' &&
        i.obligation.financial &&
        i.dueDate > today &&
        i.dueDate <= addDays(today, 7),
    )
    if (recurringSoon) {
      out.push({
        id: 'recurring-soon',
        severity: 'info',
        title: 'فاتورة متكررة ستستحق قريبًا',
        detail: `«${recurringSoon.obligation.title}» تستحق ${formatDateShort(recurringSoon.dueDate)}.`,
        to: `/obligation/${recurringSoon.obligation.id}`,
      })
    }

    // 7 — busiest day this week
    const weekMap = new Map<string, number>()
    for (const i of open) {
      if (i.dueDate >= today && i.dueDate <= addDays(today, 6)) {
        weekMap.set(i.dueDate, (weekMap.get(i.dueDate) ?? 0) + 1)
      }
    }
    const busiest = [...weekMap.entries()].sort((a, b) => b[1] - a[1])[0]
    if (busiest && busiest[1] >= 4 && busiest[0] !== today) {
      out.push({
        id: 'busy-day',
        severity: 'warning',
        title: `لديك ${busiest[1]} التزامات يوم ${weekdayName(busiest[0])}`,
        detail: `${formatDateShort(busiest[0])} — يوم مزدحم، وزّع ما يمكن تأجيله.`,
        to: '/calendar',
      })
    }

    // 8 — money owed to me that is late
    const lateOwed = open.find(
      (i) => i.obligation.direction === 'owed' && i.isOverdue && i.remaining > 0,
    )
    if (lateOwed) {
      out.push({
        id: 'owed-late',
        severity: 'info',
        title: 'لك مبلغ متأخر التحصيل',
        detail: `«${lateOwed.obligation.title}» بمبلغ ${formatAmount(lateOwed.remaining, lateOwed.obligation.currency)} — تذكير لطيف قد يفيد.`,
        to: '/debts',
      })
    }

    // 9 — no income configured but commitments exist
    if (budget.income === 0 && budget.commitments > 0) {
      out.push({
        id: 'no-income',
        severity: 'info',
        title: 'أضف دخلك الشهري لرؤية الميزانية كاملة',
        detail: 'بدون دخل لا يمكن حساب النسبة والمتبقي اليومي.',
        to: '/budget',
      })
    }

    // 10 — budget over
    if (budget.income > 0 && budget.remaining < 0) {
      out.push({
        id: 'budget-over',
        severity: 'danger',
        title: 'تنبيه الميزانية',
        detail: `التزاماتك المالية لهذا الشهر تتجاوز دخلك بمقدار ${formatAmount(Math.abs(budget.remaining), currency)}.`,
        to: '/budget',
      })
    }

    const order = { danger: 0, warning: 1, info: 2, success: 3 } as const
    return out.sort((a, b) => order[a.severity] - order[b.severity])
  },
}

export function buildSuggestions(ctx: BudgetContext): Suggestion[] {
  return rules.run(ctx)
}
