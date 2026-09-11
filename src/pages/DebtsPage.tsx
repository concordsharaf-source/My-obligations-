import { useMemo, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBudgetContext, useDataBundle } from '@/hooks/useLiveData'
import { computeStats } from '@/services/stats.service'
import { Card, EmptyState, Progress, Segmented, SectionTitle, Badge } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { formatAmount, formatAmountCompact } from '@/utils/money'
import { relativeDay, todayISO } from '@/utils/date'
import { openPrintReport } from '@/services/print.service'

export default function DebtsPage(): JSX.Element {
  const navigate = useNavigate()
  const bundle = useDataBundle()
  const { ctx } = useBudgetContext()
  const [dir, setDir] = useState<'owe' | 'owed'>('owe')

  const stats = useMemo(() => (ctx ? computeStats(ctx) : null), [ctx])

  if (!stats) return <div className="p-6 text-center text-sm text-muted">جارٍ التحميل…</div>

  const t = dir === 'owe' ? stats.owe : stats.owed
  const list = bundle.obligations
    .filter((o) => o.financial && o.direction === dir && o.status !== 'archived')
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
  const paidOf = (id: string): number =>
    bundle.payments.filter((p) => p.obligationId === id).reduce((s, p) => s + p.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-extrabold">الديون</h1>
        <button type="button" className="tap flex items-center gap-1 text-[11px] font-bold text-brand" onClick={() => openPrintReport('debts')}>
          <Icon name="printer" size={13} />
          طباعة التقرير
        </button>
      </div>

      <Segmented
        value={dir}
        onChange={setDir}
        options={[
          { value: 'owe', label: 'ديون عليّ', icon: 'arrow-up' },
          { value: 'owed', label: 'ديون لي', icon: 'arrow-down' },
        ]}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Card className="p-3">
          <div className="text-[11px] font-bold text-muted">{dir === 'owe' ? 'إجمالي الدين' : 'إجمالي المستحق'}</div>
          <div className="mt-1 text-base font-extrabold text-danger">{formatAmountCompact(t.total, ctx?.settings.currency ?? 'YER')}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-bold text-muted">{dir === 'owe' ? 'المسدد' : 'المحصّل'}</div>
          <div className="mt-1 text-base font-extrabold text-ok">{formatAmountCompact(t.paid, ctx?.settings.currency ?? 'YER')}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-bold text-muted">المتبقي</div>
          <div className="mt-1 text-base font-extrabold">{formatAmountCompact(t.remaining, ctx?.settings.currency ?? 'YER')}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-bold text-muted">المتأخر</div>
          <div className="mt-1 text-base font-extrabold text-warn">
            {formatAmountCompact(t.overdue, ctx?.settings.currency ?? 'YER')}
            <span className="ms-1 text-[10px]">({t.overdueCount})</span>
          </div>
        </Card>
      </div>

      {t.upcoming ? (
        <Card className="flex items-center gap-2 p-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-infosoft text-info">
            <Icon name="calendar-clock" size={16} />
          </span>
          <div className="flex-1 text-xs">
            <div className="font-bold">القادم: {t.upcoming.title}</div>
            <div className="text-muted">
              {relativeDay(t.upcoming.date, todayISO())} — {formatAmount(t.upcoming.amount, ctx?.settings.currency ?? 'YER')}
            </div>
          </div>
        </Card>
      ) : null}

      <div>
        <SectionTitle>{dir === 'owe' ? 'ما عليك' : 'ما لك'}</SectionTitle>
        {list.length === 0 ? (
          <EmptyState
            icon="coins"
            title={dir === 'owe' ? 'لا ديون عليك' : 'لا ديون لك'}
            hint="سجّل الدين مرة واحدة وتابع الدفعات الجزئية حتى السداد الكامل."
            actionLabel="سجّل دينًا"
            onAction={() => navigate(`/new?kind=${dir === 'owe' ? 'owe' : 'owed'}`)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((o) => {
              const paid = paidOf(o.id)
              const pct = o.amount > 0 ? Math.min(100, (paid / o.amount) * 100) : 0
              const settled = paid + 0.004 >= o.amount
              return (
                <Card key={o.id} className="tap p-3" onClick={() => navigate(`/obligation/${o.id}`)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold">{o.title}</span>
                    <Badge tone={settled ? 'ok' : o.dueDate < todayISO() ? 'danger' : 'neutral'}>
                      {settled ? 'تم السداد' : relativeDay(o.dueDate, todayISO())}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-muted">
                    <span>
                      المدفوع {formatAmountCompact(paid, o.currency)} / {formatAmountCompact(o.amount, o.currency)}
                    </span>
                    <span className={settled ? 'text-ok' : ''}>متبقٍ {formatAmountCompact(Math.max(0, o.amount - paid), o.currency)}</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={pct} tone={settled ? 'ok' : 'brand'} />
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
