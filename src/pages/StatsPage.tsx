import { useMemo, type JSX } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useBudgetContext } from '@/hooks/useLiveData'
import { computeStats } from '@/services/stats.service'
import { Card, EmptyState, SectionTitle } from '@/components/ui/primitives'
import { openPrintReport } from '@/services/print.service'
import { Button } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { formatAmountCompact, formatPercent } from '@/utils/money'
import { monthShort } from '@/utils/date'

export default function StatsPage(): JSX.Element {
  const { ctx } = useBudgetContext()
  const stats = useMemo(() => (ctx ? computeStats(ctx) : null), [ctx])
  if (!ctx || !stats) return <div className="p-6 text-center text-sm text-muted">جارٍ التحميل…</div>
  const cur = ctx.settings.currency

  const debtRows = [
    { label: 'إجمالي الديون عليّ', value: stats.owe.total, tone: 'text-danger' },
    { label: 'المسدّد', value: stats.owe.paid, tone: 'text-ok' },
    { label: 'المتبقي', value: stats.owe.remaining, tone: 'text-ink' },
    { label: 'المتأخر', value: stats.owe.overdue, tone: 'text-warn' },
  ]
  const owedRows = [
    { label: 'إجمالي المستحق لي', value: stats.owed.total, tone: 'text-ok' },
    { label: 'المحصّل', value: stats.owed.paid, tone: 'text-ok' },
    { label: 'المتبقي', value: stats.owed.remaining, tone: 'text-ink' },
    { label: 'المتأخر تحصيله', value: stats.owed.overdue, tone: 'text-warn' },
  ]

  const catData = stats.byCategory.map((c) => ({ name: c.name, value: c.count, color: c.color }))
  const trend = stats.trend.map((t) => ({ name: monthShort(t.month), الدخل: t.income, الالتزامات: t.commitments }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-extrabold">الإحصائيات</h1>
        <Button size="sm" variant="outline" icon="printer" onClick={() => openPrintReport('budget')}>
          طباعة
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-muted">مكتمل</div>
          <div className="mt-1 text-lg font-extrabold text-ok">{stats.completedCount}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-muted">قيد التنفيذ</div>
          <div className="mt-1 text-lg font-extrabold text-brand">{stats.openCount}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-muted">متأخر</div>
          <div className="mt-1 text-lg font-extrabold text-danger">{stats.overdueCount}</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-danger">
            <Icon name="arrow-up" size={14} /> عليّ
          </div>
          {debtRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-muted">{r.label}</span>
              <span className={`font-extrabold ${r.tone}`}>{formatAmountCompact(r.value, cur)}</span>
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-ok">
            <Icon name="arrow-down" size={14} /> لي
          </div>
          {owedRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-muted">{r.label}</span>
              <span className={`font-extrabold ${r.tone}`}>{formatAmountCompact(r.value, cur)}</span>
            </div>
          ))}
        </Card>
      </div>

      <div>
        <SectionTitle>الالتزامات حسب التصنيف</SectionTitle>
        <Card className="p-3">
          {catData.length === 0 ? (
            <EmptyState icon="pie" title="لا بيانات بعد" />
          ) : (
            <div dir="ltr" className="h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={catData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {catData.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div>
        <SectionTitle>تطور الميزانية — الدخل مقابل الالتزامات</SectionTitle>
        <Card className="p-3">
          <div dir="ltr" className="h-56 w-full">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip formatter={(v) => formatAmountCompact(Number(v), cur)} />
                <Legend formatter={(v) => <span className="text-[11px] font-bold">{v}</span>} />
                <Line type="monotone" dataKey="الدخل" stroke="#16a34a" strokeWidth={2.2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="الالتزامات" stroke="#dc2626" strokeWidth={2.2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="flex items-center justify-between p-3">
        <span className="text-xs font-bold">نسبة الالتزامات من الدخل (هذا الشهر)</span>
        <span className="text-sm font-extrabold text-brand">
          {stats.trend.length ? formatPercent(stats.trend[stats.trend.length - 1].income > 0 ? (stats.trend[stats.trend.length - 1].commitments / stats.trend[stats.trend.length - 1].income) * 100 : 0) : '—'}
        </span>
      </Card>
    </div>
  )
}
