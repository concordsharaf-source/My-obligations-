import { db } from '@/database/db'
import type { IncomeEntry, IncomeSource } from '@/types'

export const incomeRepo = {
  async sources(): Promise<IncomeSource[]> {
    return db.incomeSources.orderBy('createdAt').toArray()
  },

  async activeSources(): Promise<IncomeSource[]> {
    return db.incomeSources.filter((s) => s.active).toArray()
  },

  async putSource(item: IncomeSource): Promise<void> {
    await db.incomeSources.put(item)
  },

  async removeSource(id: string): Promise<void> {
    await db.incomeSources.delete(id)
  },

  async entries(): Promise<IncomeEntry[]> {
    return db.incomeEntries.toArray()
  },

  async entriesForMonth(month: string): Promise<IncomeEntry[]> {
    return db.incomeEntries.where('month').equals(month).toArray()
  },

  async putEntry(item: IncomeEntry): Promise<void> {
    await db.incomeEntries.put(item)
  },

  async removeEntry(id: string): Promise<void> {
    await db.incomeEntries.delete(id)
  },

  async bulkPutSources(items: IncomeSource[]): Promise<void> {
    if (items.length) await db.incomeSources.bulkPut(items)
  },

  async bulkPutEntries(items: IncomeEntry[]): Promise<void> {
    if (items.length) await db.incomeEntries.bulkPut(items)
  },
}
