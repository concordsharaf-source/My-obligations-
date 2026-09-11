/** Settings store (zustand) — mirrors the IndexedDB settings row. */
import { create } from 'zustand'
import { settingsRepo } from '@/repositories/settings.repo'
import { activityRepo } from '@/repositories/activity.repo'
import type { AppSettings } from '@/types'
import { buildDefaultSettings } from '@/database/defaults'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>, logMessage?: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: buildDefaultSettings(),
  loaded: false,
  load: async () => {
    const settings = await settingsRepo.get()
    set({ settings, loaded: true })
  },
  update: async (patch, logMessage) => {
    const current = get().settings
    const next: AppSettings = { ...current, ...patch, updatedAt: new Date().toISOString() }
    set({ settings: next })
    await settingsRepo.put(next)
    await activityRepo.log('settings_change', 'settings', logMessage ?? 'عدّل الإعدادات', null, {})
  },
}))

export function useSettings(): AppSettings {
  return useSettingsStore((s) => s.settings)
}
