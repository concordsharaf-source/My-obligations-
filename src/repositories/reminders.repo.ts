import { db } from '@/database/db'
import type { FiredReminder } from '@/types'
import { nowISO } from '@/utils/date'

/** Tracks which reminders already fired so we never spam duplicates. */
export const remindersRepo = {
  async has(key: string): Promise<boolean> {
    return (await db.firedReminders.get(key)) !== undefined
  },

  async mark(key: string): Promise<void> {
    await db.firedReminders.put({ id: key, at: nowISO() })
  },

  async markMany(keys: string[]): Promise<void> {
    if (!keys.length) return
    const at = nowISO()
    await db.firedReminders.bulkPut(keys.map((id) => ({ id, at } satisfies FiredReminder)))
  },

  async clearFor(obligationId: string): Promise<void> {
    const keys = await db.firedReminders
      .filter((r) => r.id.startsWith(`${obligationId}|`))
      .primaryKeys()
    if (keys.length) await db.firedReminders.bulkDelete(keys)
  },

  async pruneOlderThan(days: number): Promise<void> {
    const cutoff = Date.now() - days * 86_400_000
    const old = await db.firedReminders
      .filter((r) => new Date(r.at).getTime() < cutoff)
      .primaryKeys()
    if (old.length) await db.firedReminders.bulkDelete(old)
  },
}
