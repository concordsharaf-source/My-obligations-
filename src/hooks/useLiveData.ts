/**
 * Reactive data hooks: Dexie live queries keep every screen in sync
 * automatically after any mutation — no manual refresh anywhere.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/database/db'
import type { BudgetContext } from '@/services/budget.service'
import { useSettings } from '@/store/settings.store'

export function useObligations() {
  return useLiveQuery(() => db.obligations.filter((o) => o.deletedAt === null).toArray(), [], [])
}

export function useAllObligations() {
  return useLiveQuery(() => db.obligations.toArray(), [], [])
}

export function usePayments() {
  return useLiveQuery(() => db.payments.toArray(), [], [])
}

export function usePersons() {
  return useLiveQuery(() => db.persons.filter((p) => p.deletedAt === null).toArray(), [], [])
}

export function useCategories() {
  return useLiveQuery(() => db.categories.filter((c) => c.deletedAt === null).toArray(), [], [])
}

export function useIncomeSources() {
  return useLiveQuery(() => db.incomeSources.toArray(), [], [])
}

export function useIncomeEntries() {
  return useLiveQuery(() => db.incomeEntries.toArray(), [], [])
}

export function useTrash() {
  return useLiveQuery(() => db.trash.orderBy('deletedAt').reverse().toArray(), [], [])
}

export interface DataBundle {
  obligations: NonNullable<ReturnType<typeof useObligations>>
  payments: NonNullable<ReturnType<typeof usePayments>>
  persons: NonNullable<ReturnType<typeof usePersons>>
  categories: NonNullable<ReturnType<typeof useCategories>>
  incomeSources: NonNullable<ReturnType<typeof useIncomeSources>>
  incomeEntries: NonNullable<ReturnType<typeof useIncomeEntries>>
  ready: boolean
}

export function useDataBundle(): DataBundle {
  const obligations = useObligations()
  const payments = usePayments()
  const persons = usePersons()
  const categories = useCategories()
  const incomeSources = useIncomeSources()
  const incomeEntries = useIncomeEntries()
  const ready =
    obligations !== undefined &&
    payments !== undefined &&
    persons !== undefined &&
    categories !== undefined &&
    incomeSources !== undefined &&
    incomeEntries !== undefined
  return {
    obligations: obligations ?? [],
    payments: payments ?? [],
    persons: persons ?? [],
    categories: categories ?? [],
    incomeSources: incomeSources ?? [],
    incomeEntries: incomeEntries ?? [],
    ready,
  }
}

export function useBudgetContext(): { ctx: BudgetContext | null } {
  const bundle = useDataBundle()
  const settings = useSettings()
  if (!bundle.ready) return { ctx: null }
  return {
    ctx: {
      obligations: bundle.obligations,
      payments: bundle.payments,
      incomeSources: bundle.incomeSources,
      incomeEntries: bundle.incomeEntries,
      categories: bundle.categories,
      settings,
    },
  }
}
