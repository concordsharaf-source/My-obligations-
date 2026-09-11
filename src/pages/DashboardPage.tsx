import { useMemo, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBudgetContext, useDataBundle } from '@/hooks/useLiveData'
import { useSettings } from '@/store/settings.store'
import { useNow } from '@/hooks/useNow'
import { expandInstances, obligationsService } from '@/services/obligations.service'
import { computeBudgetMonth } from '@/services/budget.service'
import { computeStats } from '@/services/stats.service'
import { buildSuggestions } from '@/services/suggestions.service'
import { ObligationCard } from '@/components/obligations/ObligationCard'
import { Badge, Card, EmptyState, SectionTitle } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import {
  addDays,
  currentMonthKey,
  formatDate,
  greeting,
  startOfWeekISO,
  todayISO,
  weekDatesISO,
} from '@/utils/date'
import { formatAmountCompact } from '@/utils/money'
import type { ObligationInstance } from '@/types'

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  icon: string
  tone: 'danger' | 'ok' | 'brand' | 'warn' | 'info' | 'neutral'
  onClick: () => void
}): JSX.Element {
  const tones: Record<string, string> = {
    danger: 'bg-dangersoft text-danger',
    ok: 'bg-oksoft text-ok',
    brand: 'bg-brandsoft text-brand',
    warn: 'bg-warnsoft text-warn',
    info: 'bg-infosoft text-info',
    neutral: 'bg-card2 text-muted',
  }
  return (
    <Card className="tap p-3" onClick={onClick}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon name={icon} size={16} />
        </span>
        <span className="text-[11px] font-bold text-muted">{label}</span>
      </div>
      <div className="mt-2 truncate text-lg font-extrabold">{value}</div>
      {sub ? <div className="mt-0.5 truncate text-[10px] text-muted">{sub}</div> : null}
    </Card>
  )
}

export default function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const settings = useSettings()
  const bundle = useDataBundle()
  const { ctx } = useBudgetContext()
  const now = useNow(30_000)
  const today = todayISO()

  const data = useMemo(() => {
    if (!bundle.ready) return null
    const week = weekDatesISO(today, settings.weekStartsOn)
    const month = currentMonthKey()
    const todayInsts = expandInstances(bundle.obligations, bundle.payments, today, today, { now })
    const weekInsts = expandInstances(bundle.obligations, bundle.payments, week[0], week[6], { now })
    const monthInsts = expandInstances(bundle.obligations, bundle.payments, `${month}-01`, `${month}-31`, { now })
    const open = (list: ObligationInstance[]): ObligationInstance[] => list.filter((i) => i.status === 'pending')
    const stats = computeStats({
      obligations: bundle.obligations,
      payments: bundle.payments,
      incomeSources: bundle.incomeSources,
      incomeEntries: bundle.incomeEntries,
      categories: bundle.categories,
      settings,
    })
    const budget = ctx
      ? computeBudgetMonth(month, ctx)
      : null
    const suggestions = ctx ? buildSuggestions(ctx).slice(0, 3) : []
    return {
      todayOpen: open(todayInsts),
      weekCount: open(weekInsts).length,
      monthCount: open(monthInsts).length,
      overdue: open(monthInsts.concat(todayInsts.filter((t) => !monthInsts.some((m) => m.baseDate === t.baseDate && m.obligation.id === t.obligation.id)))).filter((i) => i.isOverdue),
      stats,
      budget,
      suggestions,
    }
  }, [bundle, settings, ctx, now, today])

  if (!data) {
    return <div className="p-6 text-center text-sm text-muted">جارٍ التحميل…</div>
  }

  const overdueCount = expandInstances(bundle.obligations, bundle.payments, addDays(today, -365), today, { now }).filter(
    (i) => i.isOverdue,
  ).length
  void data.overdue

  const cur = settings.currency

  return (
    <div className="flex flex-col gap-4">
      {/* greeting */}
      <div className="anim-fade-up flex items-end justify-between px-1">
        <div>
          <div className="text-xl font-extrabold">
            {greeting(now)}
            {settings.userName ? `، ${settings.userName}` : ''} 👋
          </div>
          <div className="mt-0.5 text-xs text-muted">{formatDate(today)}</div>
        </div>
        <Badge tone="brand" icon="sparkle">
          {data.todayOpen.length ? `${data.todayOpen.length} اليوم` : 'يوم هادئ'}
        </Badge>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard
          label="عليّ"
          value={formatAmountCompact(data.stats.owe.remaining, cur)}
          sub={`${data.stats.owe.count} التزام`}
          icon="arrow-up"
          tone="danger"
          onClick={() => navigate('/debts')}
        />
        <StatCard
          label="لي"
          value={formatAmountCompact(data.stats.owed.remaining, cur)}
          sub={`${data.stats.owed.count} التزام`}
          icon="arrow-down"
          tone="ok"
          onClick={() => navigate('/debts')}
        />
        <StatCard
          label="اليوم"
          value={String(data.todayOpen.length)}
          icon="clock"
          tone="brand"
          onClick={() => navigate('/calendar')}
        />
        <StatCard
          label="هذا الأسبوع"
          value={String(data.weekCount)}
          icon="calendar"
          tone="info"
          onClick={() => navigate('/calendar')}
        />
        <StatCard
          label="هذا الشهر"
          value={String(data.monthCount)}
          icon="calendar-clock"
          tone="neutral"
          onClick={() => navigate('/obligations')}
        />
        <StatCard
          label="المتأخر"
          value={String(overdueCount)}
          icon="alert-triangle"
          tone={overdueCount ? 'warn' : 'neutral'}
          onClick={() => navigate('/obligations?filter=overdue')}
        />
        <StatCard
          label="المتبقي من الميزانية"
          value={data.budget ? formatAmountCompact(Math.max(0, data.budget.remaining), cur) : '—'}
          sub={data.budget && data.budget.remaining < 0 ? `عجز ${formatAmountCompact(-data.budget.remaining, cur)}` : `من ${formatAmountCompact(data.budget?.income ?? 0, cur)}`}
          icon="wallet"
          tone={data.budget && data.budget.remaining < 0 ? 'danger' : 'ok'}
          onClick={() => navigate('/budget')}
          key="budget"
        />
      </div>

      {/* suggestions */}
      {data.suggestions.length ? (
        <div>
          <SectionTitle
            action={
              <button type="button" className="tap text-[11px] font-bold text-brand" onClick={() => navigate('/suggestions')}>
                عرض الكل
              </button>
            }
          >
            اقتراحات التزاماتي
          </SectionTitle>
          <div className="flex flex-col gap-2">
            {data.suggestions.map((s) => (
              <Card key={s.id} className="tap flex items-center gap-2.5 p-3" onClick={() => navigate(s.to)}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    s.severity === 'danger'
                      ? 'bg-dangersoft text-danger'
                      : s.severity === 'warning'
                        ? 'bg-warnsoft text-warn'
                        : 'bg-infosoft text-info'
                  }`}
                >
                  <Icon name={s.severity === 'danger' ? 'alert-triangle' : s.severity === 'warning' ? 'alert-circle' : 'bulb'} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">{s.title}</span>
                  <span className="block truncate text-[11px] text-muted">{s.detail}</span>
                </span>
                <Icon name="chevron-left" size={14} className="text-muted" />
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* today */}
      <div>
        <SectionTitle>التزامات اليوم</SectionTitle>
        {data.todayOpen.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="لا التزامات اليوم"
            hint="استمتع بيومك، أو أضف التزامًا جديدًا بزر + أسفل الشاشة."
            actionLabel="أضف أول التزام"
            onAction={() => navigate('/new')}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {data.todayOpen.map((inst) => (
              <ObligationCard
                key={`${inst.obligation.id}-${inst.baseDate}`}
                inst={inst}
                category={bundle.categories.find((c) => c.id === inst.obligation.categoryId)}
                person={bundle.persons.find((p) => p.id === inst.obligation.personId)}
                onAction={(i) => {
                  void obligationsService.completeInstance(i.obligation.id, i.baseDate).then(() => {
                    notifyDataChanged()
                    showToast('أحسنت! تم إكمال الالتزام', 'success')
                  })
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="text-center text-[10px] text-muted">
        بداية الأسبوع: {formatDate(startOfWeekISO(today, settings.weekStartsOn), { weekday: 'long' })}
      </div>
    </div>
  )
}
