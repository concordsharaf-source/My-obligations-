import { describe, expect, it } from 'vitest'
import { emptyFilters, normalizeArabic, searchObligations } from '@/services/search.service'
import type { Category, Obligation, Person } from '@/types'

const now = new Date().toISOString()
const ob = (p: Partial<Obligation> & Pick<Obligation, 'id' | 'title'>): Obligation => ({
  notes: '',
  categoryId: null,
  personId: null,
  direction: 'owe',
  financial: true,
  amount: 0,
  currency: 'YER',
  dueDate: '2026-09-15',
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

const persons: Person[] = [
  { id: 'p1', name: 'أحمد الشرعي', phone: '+967 777 123 456', notes: '', createdAt: now, updatedAt: now, deletedAt: null },
]
const categories: Category[] = [{ id: 'c1', name: 'فواتير', icon: 'receipt', color: '#dc2626', isSystem: true, createdAt: now, deletedAt: null }]

const data = {
  obligations: [
    ob({ id: 'o1', title: 'فاتورة كهرباء المنزل', personId: 'p1', categoryId: 'c1', amount: 15_000, notes: 'عداد الحارة' }),
    ob({ id: 'o2', title: 'قسط سيارة', amount: 30_000 }),
  ],
  payments: [],
  persons,
  categories,
}

const paidOf = (): number => 0

describe('search', () => {
  it('normalizes arabic variants', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد')
    expect(normalizeArabic('فاتورةٌ')).toBe('فاتوره')
  })

  it('matches by title, person, phone, notes and amount', () => {
    expect(searchObligations('كهرباء', emptyFilters, data, paidOf)).toHaveLength(1)
    expect(searchObligations('احمد', emptyFilters, data, paidOf)).toHaveLength(1)
    expect(searchObligations('777123456', emptyFilters, data, paidOf)).toHaveLength(1)
    expect(searchObligations('عداد', emptyFilters, data, paidOf)).toHaveLength(1)
    expect(searchObligations('30000', emptyFilters, data, paidOf)[0]?.obligation.id).toBe('o2')
    expect(searchObligations('فواتير', emptyFilters, data, paidOf)).toHaveLength(1)
  })

  it('filters combine with the query', () => {
    expect(searchObligations('', { ...emptyFilters, categoryId: 'c1' }, data, paidOf)).toHaveLength(1)
    expect(searchObligations('', { ...emptyFilters, direction: 'owed' }, data, paidOf)).toHaveLength(0)
    expect(searchObligations('قسط', { ...emptyFilters, amountMin: 50_000 }, data, paidOf)).toHaveLength(0)
  })

  it('empty query with no filters returns nothing', () => {
    expect(searchObligations('', emptyFilters, data, paidOf)).toHaveLength(0)
  })
})
