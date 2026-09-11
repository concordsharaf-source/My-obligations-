/** Thin data-access for obligations. No business rules here. */
import { db } from '@/database/db'
import type { Obligation } from '@/types'

export const obligationsRepo = {
  async all(): Promise<Obligation[]> {
    return db.obligations.toArray()
  },

  /** Everything not soft-deleted. */
  async active(): Promise<Obligation[]> {
    return db.obligations.filter((o) => o.deletedAt === null).toArray()
  },

  async byId(id: string): Promise<Obligation | undefined> {
    return db.obligations.get(id)
  },

  async byIds(ids: string[]): Promise<Obligation[]> {
    return db.obligations.bulkGet(ids) as Promise<Obligation[]>
  },

  async put(item: Obligation): Promise<void> {
    await db.obligations.put(item)
  },

  async bulkPut(items: Obligation[]): Promise<void> {
    await db.obligations.bulkPut(items)
  },

  async remove(id: string): Promise<void> {
    await db.obligations.delete(id)
  },

  async bulkRemove(ids: string[]): Promise<void> {
    await db.obligations.bulkDelete(ids)
  },

  async countActive(): Promise<number> {
    return db.obligations.filter((o) => o.deletedAt === null).count()
  },
}
