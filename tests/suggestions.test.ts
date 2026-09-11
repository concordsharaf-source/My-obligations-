import { describe, expect, it } from 'vitest'
import { buildSuggestions } from '@/services/suggestions.service'
import { buildDefaultSettings } from '@/database/defaults'
import type { BudgetContext } from '@/services/budget.service'
import { addDays, todayISO } from '@/utils/date'
import type { IncomeSource, Obligation } from '@/types'

const now = new Date().toISOString()
const today = todayISO()

const ob = (p: Partial<Obligation> & Pick<Obligation, 'id' | 'title' | 'dueDate'>): Obligation => ({
  notes: '',
  categoryId: null,
  personId: null,
  direction: 'owe',
  financial: true,
  amount: 10_000,
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
  ...p,
})

const ctx = (obligations: Obligation[], income = 300_000): BudgetContext => ({
  obligations,
  payments: [],
  incomeSources: income > 0 ? ([{ id: 's', name: 'راتب', kind: 'salary', amount: income, active: true, createdAt: now, updatedAt: now }] as IncomeSource[]) : [],
  incomeEntries: [],
  categories: [],
  settings: buildDefaultSettings(),
})

describe('suggestions rules engine', () => {
  it('flags overdue obligations', () => {
    const s = buildSuggestions(ctx([ob({ id: 'a', title: 'متأخر', dueDate: addDays(today, -3) })]))
    expect(s.some((x) => x.id === 'overdue')).toBe(true)
  })

  it('warns about a debt due tomorrow', () => {
    const s = buildSuggestions(ctx([ob({ id: 'a', title: 'غدًا', dueDate: addDays(today, 1) })]))
    expect(s.some((x) => x.id === 'debt-tomorrow')).toBe(true)
  })

  it('detects budget pressure and over-budget', () => {
    const pressured = buildSuggestions(ctx([ob({ id: 'a', title: 'كبير', amount: 250_000, dueDate: today })]))
    expect(pressured.some((x) => x.id === 'budget-pressure')).toBe(true)
    const over = buildSuggestions(ctx([ob({ id: 'a', title: 'ضخم', amount: 400_000, dueDate: today })]))
    expect(over.some((x) => x.id === 'budget-over')).toBe(true)
  })

  it('asks for income when commitments exist without income', () => {
    const s = buildSuggestions(ctx([ob({ id: 'a', title: 'التزام', dueDate: today })], 0))
    expect(s.some((x) => x.id === 'no-income')).toBe(true)
  })

  it('quiet data produces few or no suggestions', () => {
    const s = buildSuggestions(ctx([ob({ id: 'a', title: 'هادئ', dueDate: addDays(today, 20), amount: 5_000 })]))
    expect(s.length).toBeLessThanOrEqual(1)
  })
})
