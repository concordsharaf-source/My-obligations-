/** Global search + filters across obligations, people, notes, phones, amounts. */
import type { Category, Obligation, Payment, Person } from '@/types'
import { normalizeDigits, round2 } from '@/utils/money'

export interface SearchFilters {
  categoryId: string | null
  personId: string | null
  direction: 'owe' | 'owed' | 'none' | null
  status: 'open' | 'completed' | 'overdue' | 'all'
  dateFrom: string | null
  dateTo: string | null
  amountMin: number | null
  amountMax: number | null
}

export const emptyFilters: SearchFilters = {
  categoryId: null,
  personId: null,
  direction: null,
  status: 'all',
  dateFrom: null,
  dateTo: null,
  amountMin: null,
  amountMax: null,
}

/** Arabic-friendly normalization: strip diacritics, unify alef/ya/ta forms. */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\u200c|\u200d|\u200e|\u200f/g, '')
    .toLowerCase()
    .trim()
}

export interface SearchHit {
  obligation: Obligation
  score: number
  matchedOn: string[]
}

export function searchObligations(
  query: string,
  filters: SearchFilters,
  data: { obligations: Obligation[]; payments: Payment[]; persons: Person[]; categories: Category[] },
  paidOf: (ob: Obligation) => number,
): SearchHit[] {
  const q = normalizeArabic(normalizeDigits(query))
  const today = new Date().toISOString().slice(0, 10)
  const hits: SearchHit[] = []

  for (const ob of data.obligations) {
    if (ob.deletedAt) continue
    const person = ob.personId ? data.persons.find((p) => p.id === ob.personId) : undefined
    const category = ob.categoryId ? data.categories.find((c) => c.id === ob.categoryId) : undefined

    // ---- filters ----
    if (filters.categoryId && ob.categoryId !== filters.categoryId) continue
    if (filters.personId && ob.personId !== filters.personId) continue
    if (filters.direction && ob.direction !== filters.direction) continue
    if (filters.dateFrom && ob.dueDate < filters.dateFrom) continue
    if (filters.dateTo && ob.dueDate > filters.dateTo) continue
    if (filters.amountMin !== null && ob.amount < filters.amountMin) continue
    if (filters.amountMax !== null && ob.amount > filters.amountMax) continue
    if (filters.status !== 'all') {
      const paid = paidOf(ob)
      const completed = ob.status === 'completed' || paid + 0.004 >= ob.amount
      if (filters.status === 'completed' && !completed) continue
      if (filters.status === 'open' && completed) continue
      if (filters.status === 'overdue' && !(ob.status === 'active' && !completed && ob.dueDate < today)) continue
    }

    // ---- query matching ----
    let score = 0
    const matchedOn: string[] = []
    if (q) {
      const fields: [string, string][] = [
        ['الاسم', normalizeArabic(ob.title)],
        ['الشخص', person ? normalizeArabic(person.name) : ''],
        ['الملاحظات', normalizeArabic(ob.notes)],
        ['الهاتف', (person?.phone ?? '').replace(/\s/g, '')],
        ['التصنيف', category ? normalizeArabic(category.name) : ''],
        ['المبلغ', String(round2(ob.amount))],
      ]
      const qDigits = normalizeDigits(q).replace(/\s/g, '')
      for (const [label, value] of fields) {
        if (!value) continue
        if (value.includes(q) || (qDigits && value.includes(qDigits))) {
          score += label === 'الاسم' ? 3 : 2
          matchedOn.push(label)
        }
      }
      if (score === 0) continue
    } else if (filters.status === 'all' && !filters.categoryId && !filters.personId && !filters.direction && !filters.dateFrom && !filters.dateTo && filters.amountMin === null && filters.amountMax === null) {
      continue // empty query + no filters = no results
    }

    hits.push({ obligation: ob, score, matchedOn })
  }

  return hits.sort((a, b) => b.score - a.score || (a.obligation.dueDate < b.obligation.dueDate ? -1 : 1))
}
