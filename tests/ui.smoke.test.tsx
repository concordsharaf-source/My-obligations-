import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import 'fake-indexeddb/auto'
import { wipeDatabase } from '@/database/db'
import { seedCategories } from '@/database/defaults'
import { useSettingsStore } from '@/store/settings.store'
import DashboardPage from '@/pages/DashboardPage'
import ObligationsPage from '@/pages/ObligationsPage'
import { obligationsService } from '@/services/obligations.service'
import { todayISO } from '@/utils/date'

function wrap(ui: React.ReactElement): React.ReactElement {
  return <HashRouter>{ui}</HashRouter>
}

beforeEach(async () => {
  await wipeDatabase()
  await useSettingsStore.getState().load()
})

describe('app smoke', () => {
  it('dashboard greets and shows empty state when no data', async () => {
    render(wrap(<DashboardPage />))
    await waitFor(() => expect(screen.getByText(/لا التزامات اليوم/)).toBeInTheDocument())
    expect(screen.getByText(/أضف أول التزام/)).toBeInTheDocument()
  })

  it('obligations page lists a created obligation', async () => {
    const cs = seedCategories()
    const { db } = await import('@/database/db')
    await db.categories.bulkPut(cs)
    await obligationsService.create({
      title: 'إيجار المنزل',
      notes: '',
      categoryId: null,
      personId: null,
      direction: 'owe',
      financial: true,
      amount: 80_000,
      currency: 'YER',
      dueDate: todayISO(),
      dueTime: null,
      recurrence: { type: 'monthly', interval: 1, endDate: null },
      priority: 'high',
      status: 'active',
      reminders: [],
    })
    render(wrap(<ObligationsPage />))
    await waitFor(() => expect(screen.getByText('إيجار المنزل')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('shows overdue badge content for late items', async () => {
    await obligationsService.create({
      title: 'متأخر قديم',
      notes: '',
      categoryId: null,
      personId: null,
      direction: 'none',
      financial: false,
      amount: 0,
      currency: 'YER',
      dueDate: '2020-01-01',
      dueTime: null,
      recurrence: { type: 'none', interval: 1, endDate: null },
      priority: 'normal',
      status: 'active',
      reminders: [],
    })
    render(wrap(<ObligationsPage />))
    await waitFor(() => expect(screen.getByText('متأخر قديم')).toBeInTheDocument(), { timeout: 5000 })
  })
})
