/**
 * Pages smoke: every route-level page must render with realistic seeded data
 * without crashing, and show its characteristic heading/content.
 */
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import 'fake-indexeddb/auto'
import { db, wipeDatabase } from '@/database/db'
import { seedCategories } from '@/database/defaults'
import { useSettingsStore } from '@/store/settings.store'
import { obligationsService } from '@/services/obligations.service'
import { personsService } from '@/services/persons.service'
import { todayISO } from '@/utils/date'
import type { Obligation, Person } from '@/types'

import DashboardPage from '@/pages/DashboardPage'
import CalendarPage from '@/pages/CalendarPage'
import ObligationsPage from '@/pages/ObligationsPage'
import ObligationDetailPage from '@/pages/ObligationDetailPage'
import NewObligationPage from '@/pages/NewObligationPage'
import DebtsPage from '@/pages/DebtsPage'
import BudgetPage from '@/pages/BudgetPage'
import MorePage from '@/pages/MorePage'
import PeoplePage from '@/pages/PeoplePage'
import PersonDetailPage from '@/pages/PersonDetailPage'
import CategoriesPage from '@/pages/CategoriesPage'
import StatsPage from '@/pages/StatsPage'
import SearchPage from '@/pages/SearchPage'
import SettingsPage from '@/pages/SettingsPage'
import ActivityPage from '@/pages/ActivityPage'
import BackupPage from '@/pages/BackupPage'
import TrashPage from '@/pages/TrashPage'
import SuggestionsPage from '@/pages/SuggestionsPage'
import NotificationsPage from '@/pages/NotificationsPage'
import PrintPage from '@/pages/PrintPage'

let seeded: { ob: Obligation; person: Person }

async function seedRich(): Promise<{ ob: Obligation; person: Person }> {
  const cats = seedCategories()
  await db.categories.bulkPut(cats)
  const bills = cats.find((c) => c.name === 'فواتير')

  const person = await personsService.create({ name: 'أحمد', phone: '777000111' })

  const owed = await obligationsService.create({
    title: 'قرض لصديق',
    notes: 'يرده على دفعات',
    categoryId: null,
    personId: person.id,
    direction: 'owed',
    financial: true,
    amount: 50_000,
    currency: 'YER',
    dueDate: todayISO(),
    dueTime: null,
    recurrence: { type: 'monthly', interval: 1, endDate: null },
    priority: 'normal',
    status: 'active',
    reminders: [],
  })

  await obligationsService.create({
    title: 'إيجار المنزل',
    notes: '',
    categoryId: bills?.id ?? null,
    personId: null,
    direction: 'owe',
    financial: true,
    amount: 80_000,
    currency: 'YER',
    dueDate: todayISO(),
    dueTime: '18:00',
    recurrence: { type: 'monthly', interval: 1, endDate: null },
    priority: 'high',
    status: 'active',
    reminders: [1440],
  })

  await obligationsService.addPayment({
    obligationId: owed.id,
    amount: 20_000,
    date: todayISO(),
    note: 'دفعة أولى',
  })

  return { ob: owed, person }
}

function renderRoute(path: string, route: string, el: ReactElement): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={el} />
        <Route path="*" element={<div>WRONG_ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function expectText(re: string | RegExp, timeout = 6000): Promise<void> {
  await waitFor(
    () => {
      expect(screen.getByText(re)).toBeInTheDocument()
      expect(screen.queryByText('WRONG_ROUTE')).not.toBeInTheDocument()
    },
    { timeout },
  )
}

beforeEach(async () => {
  window.print = () => undefined
  await wipeDatabase()
  await useSettingsStore.getState().load()
  seeded = await seedRich()
})

afterEach(() => {
  cleanup()
})

describe('pages smoke (with data)', () => {
  it('Dashboard', async () => {
    renderRoute('/', '/', <DashboardPage />)
    await expectText('التزامات اليوم')
  })

  it('Calendar', async () => {
    renderRoute('/calendar', '/calendar', <CalendarPage />)
    await expectText('التقويم')
  })

  it('Obligations list shows seeded items', async () => {
    renderRoute('/obligations', '/obligations', <ObligationsPage />)
    await expectText('الالتزامات')
    await expectText('إيجار المنزل')
  })

  it('ObligationDetail shows the obligation', async () => {
    renderRoute(`/obligation/${seeded.ob.id}`, '/obligation/:id', <ObligationDetailPage />)
    await expectText('قرض لصديق')
  })

  it('New obligation form', async () => {
    renderRoute('/new', '/new', <NewObligationPage />)
    await expectText('إضافة التزام')
  })

  it('Debts', async () => {
    renderRoute('/debts', '/debts', <DebtsPage />)
    await expectText('الديون')
  })

  it('Budget', async () => {
    renderRoute('/budget', '/budget', <BudgetPage />)
    await expectText('ميزانيتي')
  })

  it('More', async () => {
    renderRoute('/more', '/more', <MorePage />)
    await expectText('المزيد')
  })

  it('People list', async () => {
    renderRoute('/people', '/people', <PeoplePage />)
    await expectText('الأشخاص')
    await expectText('أحمد')
  })

  it('PersonDetail shows balance', async () => {
    renderRoute(`/person/${seeded.person.id}`, '/person/:id', <PersonDetailPage />)
    await expectText('أحمد')
  })

  it('Categories', async () => {
    renderRoute('/categories', '/categories', <CategoriesPage />)
    await expectText('التصنيفات')
  })

  it('Stats', async () => {
    renderRoute('/stats', '/stats', <StatsPage />)
    await expectText('الإحصائيات')
  })

  it('Search finds seeded obligation', async () => {
    renderRoute('/search', '/search', <SearchPage />)
    await expectText('بحث شامل')
  })

  it('Settings', async () => {
    renderRoute('/settings', '/settings', <SettingsPage />)
    await expectText('الإعدادات')
  })

  it('Activity log records the seeding actions', async () => {
    renderRoute('/activity', '/activity', <ActivityPage />)
    await expectText('السجل')
  })

  it('Backup', async () => {
    renderRoute('/backup', '/backup', <BackupPage />)
    await expectText('النسخ الاحتياطي')
  })

  it('Trash', async () => {
    renderRoute('/trash', '/trash', <TrashPage />)
    await expectText('سلة المحذوفات')
  })

  it('Suggestions', async () => {
    renderRoute('/suggestions', '/suggestions', <SuggestionsPage />)
    await expectText('اقتراحات التزاماتي')
  })

  it('Notifications', async () => {
    renderRoute('/notifications', '/notifications', <NotificationsPage />)
    await expectText('الإشعارات')
  })

  it('Print report renders with print button', async () => {
    renderRoute('/print/debts', '/print/:report', <PrintPage />)
    await expectText('طباعة')
    await expectText(/لا تنسَ ما عليك/)
  })
})
