import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { useUIStore } from '@/store/ui.store'
import { useNow } from '@/hooks/useNow'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { AR_LOCALE } from '@/utils/date'

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }): JSX.Element {
  const navigate = useNavigate()
  const now = useNow(60_000)
  const overdueBadge = useUIStore((s) => s.overdueBadge)
  const online = useOnlineStatus()

  const dateLabel = new Intl.DateTimeFormat(AR_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5">
        <button type="button" className="tap flex items-center gap-2" onClick={() => navigate('/')}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brandink shadow-sm">
            <Icon name="check-circle" size={20} />
          </span>
          <span className="text-start">
            <span className="block text-sm font-extrabold leading-4">{title}</span>
            <span className="block text-[10px] text-muted leading-4">{subtitle ?? dateLabel}</span>
          </span>
        </button>
        <div className="flex-1" />
        {!online && (
          <span
            className="no-print flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[9px] font-bold text-muted"
            title="أنت غير متصل — التطبيق يعمل بالكامل من جهازك"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            بدون إنترنت
          </span>
        )}
        <IconButton icon="search" label="بحث" onClick={() => navigate('/search')} />
        <IconButton
          icon="bell"
          label="الإشعارات"
          badge={overdueBadge || undefined}
          onClick={() => navigate('/notifications')}
        />
        <IconButton icon="settings" label="الإعدادات" onClick={() => navigate('/settings')} />
      </div>
    </header>
  )
}
