import { useEffect, type JSX } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { useTheme } from '@/hooks/useTheme'
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

const TITLES: Record<string, string> = {
  '/': 'التزاماتي — الرئيسية',
  '/calendar': 'التقويم — التزاماتي',
  '/obligations': 'الالتزامات — التزاماتي',
  '/debts': 'الديون — التزاماتي',
  '/budget': 'ميزانيتي — التزاماتي',
  '/more': 'المزيد — التزاماتي',
  '/settings': 'الإعدادات — التزاماتي',
}

function TitleSync(): null {
  useEffect(() => {
    const hash = window.location.hash.replace('#', '').split('?')[0] || '/'
    document.title = TITLES[hash] ?? 'التزاماتي — لا تنسَ ما عليك... ولا ما لك'
  }, [])
  return null
}

export default function App(): JSX.Element {
  useTheme()

  return (
    <HashRouter>
      <TitleSync />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/obligations" element={<ObligationsPage />} />
          <Route path="/obligation/:id" element={<ObligationDetailPage />} />
          <Route path="/new" element={<NewObligationPage />} />
          <Route path="/edit/:id" element={<NewObligationPage />} />
          <Route path="/debts" element={<DebtsPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/person/:id" element={<PersonDetailPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/print/:report" element={<PrintPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
