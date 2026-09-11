import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { useSettingsStore } from '@/store/settings.store'
import { useUIStore } from '@/store/ui.store'
import { trashRepo } from '@/repositories/trash.repo'
import { remindersRepo } from '@/repositories/reminders.repo'
import { db } from '@/database/db'
import { seedCategories } from '@/database/defaults'
import { startScheduler } from '@/notifications/scheduler'
import { setupPWA } from '@/pwa/register'
import type { BudgetContext, } from '@/services/budget.service'
import type { SchedulerData } from '@/notifications/scheduler'

async function bootstrap(): Promise<void> {
  // first-run seed (categories) — idempotent
  const existingCats = await db.categories.count()
  if (existingCats === 0) {
    await db.categories.bulkPut(seedCategories())
  }
  await useSettingsStore.getState().load()

  // lock on launch when enabled
  const lockMode = useSettingsStore.getState().settings.lock.mode
  if (lockMode !== 'none') useUIStore.getState().setLocked(true)

  // housekeeping
  void trashRepo.purgeExpired()
  void remindersRepo.pruneOlderThan(45)

  // reminder scheduler (local, offline-first)
  startScheduler(
    async (): Promise<SchedulerData | null> => {
      const [obligations, payments, settings] = await Promise.all([
        db.obligations.filter((o) => o.deletedAt === null).toArray(),
        db.payments.toArray(),
        db.settings.get(1),
      ])
      if (!settings) return null
      return { obligations, payments, settings }
    },
    async (): Promise<BudgetContext | null> => {
      const [obligations, payments, incomeSources, incomeEntries, categories, settings] = await Promise.all([
        db.obligations.filter((o) => o.deletedAt === null).toArray(),
        db.payments.toArray(),
        db.incomeSources.toArray(),
        db.incomeEntries.toArray(),
        db.categories.filter((c) => c.deletedAt === null).toArray(),
        db.settings.get(1),
      ])
      if (!settings) return null
      return { obligations, payments, incomeSources, incomeEntries, categories, settings }
    },
  )

  setupPWA()
}

const container = document.getElementById('root')
if (!container) throw new Error('root element missing')

void bootstrap().finally(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
