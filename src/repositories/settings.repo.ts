import { db } from '@/database/db'
import { buildDefaultSettings } from '@/database/defaults'
import type { AppSettings } from '@/types'

export const settingsRepo = {
  async get(): Promise<AppSettings> {
    const existing = await db.settings.get(1)
    if (existing) return existing
    const fresh = buildDefaultSettings()
    await db.settings.put(fresh)
    return fresh
  },

  async put(item: AppSettings): Promise<void> {
    await db.settings.put(item)
  },
}
