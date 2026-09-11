import { db } from '@/database/db'
import type { Category } from '@/types'

export const categoriesRepo = {
  async all(): Promise<Category[]> {
    return db.categories.toArray()
  },

  async active(): Promise<Category[]> {
    return db.categories.filter((c) => c.deletedAt === null).toArray()
  },

  async byId(id: string): Promise<Category | undefined> {
    return db.categories.get(id)
  },

  async put(item: Category): Promise<void> {
    await db.categories.put(item)
  },

  async bulkPut(items: Category[]): Promise<void> {
    if (items.length) await db.categories.bulkPut(items)
  },

  async remove(id: string): Promise<void> {
    await db.categories.delete(id)
  },
}
