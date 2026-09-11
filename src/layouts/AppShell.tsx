import { useEffect, useRef, type JSX } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { FAB } from './FAB'
import { LockScreen } from './LockScreen'
import { ToastHost } from '@/components/ui/overlays'
import { Button } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { useUIStore } from '@/store/ui.store'
import { useSettings } from '@/store/settings.store'
import { expandInstances } from '@/services/obligations.service'
import { useDataBundle } from '@/hooks/useLiveData'
import { todayISO } from '@/utils/date'

const HIDE_CHROME = ['/print/']

export function AppShell(): JSX.Element {
  const locked = useUIStore((s) => s.locked)
  const setLocked = useUIStore((s) => s.setLocked)
  const setOverdueBadge = useUIStore((s) => s.setOverdueBadge)
  const updateAvailable = useUIStore((s) => s.updateAvailable)
  const applyUpdate = useUIStore((s) => s.applyUpdate)
  const installPrompt = useUIStore((s) => s.installPrompt)
  const setInstallPrompt = useUIStore((s) => s.setInstallPrompt)
  const settings = useSettings()
  const bundle = useDataBundle()
  const location = useLocation()
  const hiddenAt = useRef<number | null>(null)

  const isPrint = HIDE_CHROME.some((p) => location.pathname.includes(p) || location.hash.includes(p))

  // live overdue badge for the bell
  useEffect(() => {
    if (!bundle.ready) return
    const insts = expandInstances(bundle.obligations, bundle.payments, todayISO(), todayISO())
    setOverdueBadge(insts.filter((i) => i.isOverdue).length)
  }, [bundle, setOverdueBadge])

  // auto-lock on inactivity
  useEffect(() => {
    if (settings.lock.mode === 'none') return
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
    }
    const onShow = (): void => {
      if (document.visibilityState !== 'visible' || hiddenAt.current === null) return
      const minutes = (Date.now() - hiddenAt.current) / 60_000
      hiddenAt.current = null
      if (settings.lock.autoLockMinutes > 0 && minutes >= settings.lock.autoLockMinutes) setLocked(true)
    }
    document.addEventListener('visibilitychange', onHide)
    document.addEventListener('visibilitychange', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [settings.lock.mode, settings.lock.autoLockMinutes, setLocked])

  const dismissedInstall = sessionStorage.getItem('my-obligations:install-dismissed') === '1'

  return (
    <div className="min-h-dvh">
      {!isPrint ? <TopBar title="التزاماتي" /> : null}
      <main className={`mx-auto w-full max-w-2xl px-3 pt-3 ${isPrint ? 'pb-4' : 'pb-36'}`}>
        <Outlet />
      </main>
      {!isPrint ? (
        <>
          <FAB />
          <BottomNav />
        </>
      ) : null}
      <ToastHost />

      {updateAvailable ? (
        <div className="no-print fixed inset-x-3 top-3 z-[65] mx-auto max-w-md">
          <div className="anim-pop flex items-center gap-2 rounded-2xl border border-info/40 bg-infosoft px-3 py-2.5 text-info shadow-lg">
            <Icon name="refresh" size={16} />
            <span className="flex-1 text-xs font-bold">يتوفر إصدار جديد من التطبيق</span>
            <Button size="sm" variant="soft" onClick={() => applyUpdate?.()}>
              تحديث الآن
            </Button>
          </div>
        </div>
      ) : null}

      {installPrompt && !dismissedInstall ? (
        <div className="no-print fixed inset-x-3 bottom-40 z-[55] mx-auto max-w-md">
          <div className="anim-pop flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brandsoft text-brand">
              <Icon name="download" size={18} />
            </span>
            <span className="flex-1 text-xs font-bold leading-5">ثبّت تطبيق «التزاماتي» على جهازك ليعمل بدون إنترنت</span>
            <Button
              size="sm"
              onClick={() => {
                void installPrompt.prompt()
                setInstallPrompt(null)
              }}
            >
              تثبيت
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                sessionStorage.setItem('my-obligations:install-dismissed', '1')
                setInstallPrompt(null)
              }}
            >
              لاحقًا
            </Button>
          </div>
        </div>
      ) : null}

      {locked ? <LockScreen /> : null}
    </div>
  )
}
