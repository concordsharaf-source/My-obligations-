import { db } from '@/database/db'
import type { ActivityEntry, ActivityType } from '@/types'
import { nowISO } from '@/utils/date'
import { newId } from '@/utils/ids'

export const activityRepo = {
  async recent(limit = 200): Promise<ActivityEntry[]> {
    const all = await db.activity.orderBy('at').reverse().limit(limit).toArray()
    return all
  },

  async log(
    type: ActivityType,
    entity: ActivityEntry['entity'],
    message: string,
    entityId: string | null = null,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    const entry: ActivityEntry = {
      id: newId(),
      type,
      entity,
      entityId,
      message,
      meta,
      at: nowISO(),
    }
    await db.activity.put(entry)
    // keep the log bounded (ring buffer of ~2000 entries)
    const count = await db.activity.count()
    if (count > 2200) {
      const excess = count - 2000
      const oldest = await db.activity.orderBy('at').limit(excess).primaryKeys()
      await db.activity.bulkDelete(oldest)
    }
  },

  async bulkPut(items: ActivityEntry[]): Promise<void> {
    if (items.length) await db.activity.bulkPut(items)
  },

  async all(): Promise<ActivityEntry[]> {
    return db.activity.toArray()
  },
}
