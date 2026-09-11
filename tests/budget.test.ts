import { describe, expect, it } from 'vitest'
import { computeBudgetMonth, stageForRatio } from '@/services/budget.service'
import type { BudgetContext } from '@/services/budget.service'
import { buildDefaultSettings } from '@/database/defaults'
import type { IncomeSource, Obligation } from '@/types'

const now = new Date().toISOString()

function ob(partial: Partial<Obligation> & Pick<Obligation, 'id' | 'title' | 'dueDate'>): Obligation {
  return {
    notes: '',
    categoryId: null,
    personId: null,
    direction: 'owe',
    financial: true,
    amount: 0,
    currency: 'YER',
    dueTime: null,
    recurrence: { type: 'none', interval: 1, endDate: null },
    overrides: {},
    priority: 'normal',
    status: 'active',
    reminders: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
    ...partial,
  }
}

const MONTH = '2026-09'

function ctxWith(obligations: Obligation[], sources: IncomeSource[]): BudgetContext {
  return {
    obligations,
    payments: [],
    incomeSources: sources,
    incomeEntries: [],
    categories: [],
    settings: buildDefaultSettings(),
  }
}

const salary: IncomeSource = { id: 's1', name: 'راتب', kind: 'salary', amount: 250_000, active: true, createdAt: now, updatedAt: now }
const extra: IncomeSource = { id: 's2', name: 'عمل إضافي', kind: 'freelance', amount: 50_000, active: true, createdAt: now, updatedAt: now }

describe('budget engine', () => {
  it('income = sum of active sources', () => {
    const b = computeBudgetMonth(MONTH, ctxWith([], [salary, extra]))
    expect(b.income).toBe(300_000)
  })

  it('commitments are pulled automatically from financial obligations (no double entry)', () => {
    const obligations = [
      ob({ id: 'o1', title: 'إيجار', amount: 80_000, dueDate: '2026-09-01', recurrence: { type: 'monthly', interval: 1, endDate: null } }),
      ob({ id: 'o2', title: 'قسط', amount: 30_000, dueDate: '2026-09-05', recurrence: { type: 'monthly', interval: 1, endDate: null } }),
      ob({ id: 'o3', title: 'كهرباء', amount: 15_000, dueDate: '2026-09-10' }),
      ob({ id: 'o4', title: 'اشتراك', amount: 5_000, dueDate: '2026-09-12', recurrence: { type: 'monthly', interval: 1, endDate: null } }),
    ]
    const b = computeBudgetMonth(MONTH, ctxWith(obligations, [salary, extra]))
    expect(b.commitments).toBe(130_000)
    expect(b.remaining).toBe(170_000)
    expect(b.ratio).toBeCloseTo(43.33, 1)
    expect(b.stage).toBe('comfortable')
  })

  it('only counts obligations due inside the month', () => {
    const obligations = [ob({ id: 'o1', title: 'إيجار', amount: 80_000, dueDate: '2026-09-01' }), ob({ id: 'o2', title: 'آخر', amount: 10_000, dueDate: '2026-10-02' })]
    const b = computeBudgetMonth(MONTH, ctxWith(obligations, [salary]))
    expect(b.commitments).toBe(80_000)
  })

  it('over budget → stage over + negative remaining', () => {
    const obligations = [ob({ id: 'o1', title: 'كبير', amount: 350_000, dueDate: '2026-09-01' })]
    const b = computeBudgetMonth(MONTH, ctxWith(obligations, [salary, extra]))
    expect(b.remaining).toBe(-50_000)
    expect(b.stage).toBe('over')
    expect(b.ratio).toBeCloseTo(116.67, 1)
  })

  it('annual commitment appears only in its due month, with annual cost + monthly average', () => {
    const obligations = [ob({ id: 'o1', title: 'تأمين', amount: 120_000, dueDate: '2026-12-01', recurrence: { type: 'annual', interval: 1, endDate: null } })]
    const sep = computeBudgetMonth(MONTH, ctxWith(obligations, [salary]))
    const dec = computeBudgetMonth('2026-12', ctxWith(obligations, [salary]))
    expect(sep.commitments).toBe(0)
    expect(dec.commitments).toBe(120_000)
    expect(dec.annual[0]).toMatchObject({ annualCost: 120_000, monthlyAverage: 10_000 })
  })

  it('daily allowance divides remaining by days in month', () => {
    const b = computeBudgetMonth(MONTH, ctxWith([], [salary, extra]))
    expect(b.daysInMonth).toBe(30)
    expect(b.dailyAllowance).toBe(10_000)
  })

  it('thresholds are configurable', () => {
    const s = buildDefaultSettings()
    expect(stageForRatio(40, s.budgetThresholds)).toBe('comfortable')
    expect(stageForRatio(60, s.budgetThresholds)).toBe('attention')
    expect(stageForRatio(80, s.budgetThresholds)).toBe('tight')
    expect(stageForRatio(120, s.budgetThresholds)).toBe('over')
    const custom = { comfortable: 30, attention: 45, tight: 60 }
    expect(stageForRatio(50, custom)).toBe('tight')
  })

  it('owed-to-me obligations never count as commitments', () => {
    const obligations = [ob({ id: 'o1', title: 'لي', amount: 90_000, dueDate: '2026-09-01', direction: 'owed' })]
    const b = computeBudgetMonth(MONTH, ctxWith(obligations, [salary]))
    expect(b.commitments).toBe(0)
  })
})
