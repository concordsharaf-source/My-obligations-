import { db } from '@/database/db'
import type { TrashItem } from '@/types'

const RETENTION_DAYS = 30

export const trashRepo = {
  async all(): Promise<TrashItem[]> {
    return db.trash.orderBy('deletedAt').reverse().toArray()
  },

  async put(item: TrashItem): Promise<void> {
    await db.trash.put(item)
  },

  async get(id: string): Promise<TrashItem | undefined> {
    return db.trash.get(id)
  },

  async remove(id: string): Promise<void> {
    await db.trash.delete(id)
  },

  /** Drop items older than the retention window. Called on app boot. */
  async purgeExpired(): Promise<number> {
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000
    const expired = await db.trash
      .filter((t) => new Date(t.deletedAt).getTime() < cutoff)
      .primaryKeys()
    if (expired.length) await db.trash.bulkDelete(expired)
    return expired.length
  },
}
