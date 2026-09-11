import { useMemo, useState, type JSX } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { useBudgetContext } from '@/hooks/useLiveData'
import {
  activeMonths,
  computeBudgetHistory,
  computeBudgetMonth,
  STAGE_META,
} from '@/services/budget.service'
import { incomeRepo } from '@/repositories/income.repo'
import { activityRepo } from '@/repositories/activity.repo'
import { Badge, Button, Card, EmptyState, IconButton, Progress, SectionTitle } from '@/components/ui/primitives'
import { Sheet, ConfirmDialog } from '@/components/ui/overlays'
import { AmountInput, Field, Select, TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import { currentMonthKey, monthLabel, monthShort, shiftMonth, todayISO } from '@/utils/date'
import { formatAmount, formatAmountCompact, formatPercent, round2 } from '@/utils/money'
import { newId } from '@/utils/ids'
import { nowISO } from '@/utils/date'
import type { IncomeKind } from '@/types'

const KIND_LABELS: Record<IncomeKind, string> = {
  salary: 'راتب',
  business: 'تجارة',
  rent: 'إيجار',
  freelance: 'عمل إضافي',
  investment: 'استثمار',
  other: 'دخل آخر',
}

export default function BudgetPage(): JSX.Element {
  const { ctx } = useBudgetContext()
  const [month, setMonth] = useState(currentMonthKey())
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [confirmSource, setConfirmSource] = useState<string | null>(null)
  const [confirmEntry, setConfirmEntry] = useState<string | null>(null)

  // income form state
  const [srcName, setSrcName] = useState('')
  const [srcKind, setSrcKind] = useState<IncomeKind>('salary')
  const [srcAmount, setSrcAmount] = useState('')
  const [entryLabel, setEntryLabel] = useState('')
  const [entryAmount, setEntryAmount] = useState('')

  const budget = useMemo(() => (ctx ? computeBudgetMonth(month, ctx) : null), [ctx, month])
  const history = useMemo(() => (ctx ? computeBudgetHistory(month, 5, 2, ctx) : []), [ctx, month])
  const months = useMemo(() => (ctx ? activeMonths(ctx) : []), [ctx])

  if (!ctx || !budget) return <div className="p-6 text-center text-sm text-muted">جارٍ التحميل…</div>
  const cur = ctx.settings.currency
  const stage = STAGE_META[budget.stage]

  const donutData = [
    { name: 'الالتزامات', value: Math.max(0, Math.min(budget.commitments, budget.income)), color: '#dc2626' },
    { name: 'المتبقي', value: Math.max(0, budget.income - budget.commitments), color: '#16a34a' },
  ]
  const trendData = history.map((h) => ({
    name: monthShort(h.month),
    الدخل: h.income,
    الالتزامات: h.commitments,
    المتبقي: h.remaining,
  }))

  const addSource = async (): Promise<void> => {
    const amount = Number(srcAmount.replace(/[^\d.]/g, ''))
    if (!srcName.trim() || !(amount > 0)) {
      showToast('أدخل اسم المصدر ومبلغًا صحيحًا', 'danger')
      return
    }
    await incomeRepo.putSource({
      id: newId(),
      name: srcName.trim(),
      kind: srcKind,
      amount: round2(amount),
      active: true,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    })
    await activityRepo.log('income_change', 'income', `أضاف مصدر دخل «${srcName.trim()}»`, null, { amount })
    setSrcName('')
    setSrcAmount('')
    notifyDataChanged()
    showToast('تمت إضافة مصدر الدخل', 'success')
  }

  const addEntry = async (): Promise<void> => {
    const amount = Number(entryAmount.replace(/[^\d.]/g, ''))
    if (!entryLabel.trim() || !(amount > 0)) {
      showToast('أدخل الوصف والمبلغ', 'danger')
      return
    }
    await incomeRepo.putEntry({
      id: newId(),
      month,
      label: entryLabel.trim(),
      amount: round2(amount),
      sourceId: null,
      createdAt: nowISO(),
    })
    await activityRepo.log('income_change', 'income', `سجّل دخلًا إضافيًا لشهر ${monthLabel(month)}`, null, { amount })
    setEntryLabel('')
    setEntryAmount('')
    notifyDataChanged()
    showToast('تم تسجيل الدخل الإضافي', 'success')
  }

  const monthEntries = ctx.incomeEntries.filter((e) => e.month === month)

  return (
    <div className="flex flex-col gap-4">
      {/* header + month nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-extrabold">ميزانيتي</h1>
        <div className="flex items-center gap-1">
          <IconButton icon="chevron-right" label="الشهر السابق" onClick={() => setMonth(shiftMonth(month, -1))} />
          <select
            className="tap rounded-xl border border-border bg-card px-2 py-1.5 text-xs font-bold"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="اختيار الشهر"
          >
            {months.includes(month) ? null : <option value={month}>{monthLabel(month)}</option>}
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <IconButton icon="chevron-left" label="الشهر التالي" onClick={() => setMonth(shiftMonth(month, 1))} />
        </div>
      </div>

      {/* status gauge */}
      <Card className="p-4" >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-muted">نسبة الالتزامات من الدخل</div>
            <div className="mt-1 text-2xl font-extrabold" style={{ color: stage.color }}>
              {budget.income > 0 ? formatPercent(Math.min(budget.ratio, 999)) : '—'}
            </div>
          </div>
          <Badge tone={budget.stage === 'over' ? 'danger' : budget.stage === 'comfortable' ? 'ok' : 'warn'} icon="target">
            {stage.label}
          </Badge>
        </div>
        <div className="mt-3">
          <Progress
            value={Math.min(100, budget.ratio)}
            tone={budget.stage === 'over' ? 'danger' : budget.stage === 'tight' ? 'warn' : budget.stage === 'attention' ? 'warn' : 'ok'}
          />
        </div>
        <div className="mt-2 text-[11px] font-semibold" style={{ color: stage.color }}>
          {budget.income > 0 ? `المتبقي من دخلك: ${formatPercent(Math.max(0, 100 - budget.ratio))}` : stage.hint}
        </div>
        {budget.remaining < 0 && budget.income > 0 ? (
          <div className="mt-3 rounded-2xl border border-danger/40 bg-dangersoft p-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-danger">
              <Icon name="alert-triangle" size={15} />
              تنبيه الميزانية
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-danger">
              التزاماتك المالية لهذا الشهر تتجاوز دخلك بمقدار {formatAmount(Math.abs(budget.remaining), cur)}.
            </p>
            <ul className="mt-2 list-inside list-disc text-[11px] leading-5 text-danger/90">
              <li>مراجعة الالتزامات غير الضرورية.</li>
              <li>تأجيل الالتزام القابل للتأجيل.</li>
              <li>تخفيض الالتزامات غير الضرورية.</li>
              <li>مراجعة المصروفات العامة.</li>
            </ul>
            <p className="mt-1 text-[10px] text-danger/70">لن يتم تعديل أو حذف أي التزام تلقائيًا — القرار لك دائمًا.</p>
          </div>
        ) : null}
      </Card>

      {/* summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'الدخل', value: budget.income, tone: 'text-ok', icon: 'trend' },
          { label: 'الالتزامات', value: budget.commitments, tone: 'text-danger', icon: 'arrow-up' },
          { label: 'المتبقي', value: budget.remaining, tone: budget.remaining < 0 ? 'text-danger' : 'text-ink', icon: 'wallet' },
          { label: 'المدفوع', value: budget.paid, tone: 'text-ok', icon: 'check-circle' },
          { label: 'المتأخر', value: budget.overdue, tone: budget.overdue > 0 ? 'text-warn' : 'text-muted', icon: 'alarm' },
          { label: 'متأخرات (عدد)', value: budget.lateCount, tone: 'text-muted', icon: 'list', raw: true },
        ].map((c) => (
          <Card key={c.label} className="p-3">
            <div className="flex items-center gap-1 text-[10px] font-bold text-muted">
              <Icon name={c.icon} size={12} />
              {c.label}
            </div>
            <div className={`mt-1 truncate text-sm font-extrabold ${c.tone}`}>
              {c.raw ? c.value : formatAmountCompact(Number(c.value), cur)}
            </div>
          </Card>
        ))}
      </div>

      {/* daily allowance */}
      {ctx.settings.dailyAllowance ? (
        <Card className="flex items-center gap-3 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brandsoft text-brand">
            <Icon name="sun" size={17} />
          </span>
          <div className="flex-1">
            <div className="text-xs font-bold">المتاح النظري يوميًا</div>
            <div className="text-[10px] text-muted">مؤشر تقديري للمساعدة وليس ميزانية محاسبية كاملة</div>
          </div>
          <div className="text-sm font-extrabold text-brand">
            {budget.dailyAllowance > 0 ? formatAmountCompact(budget.dailyAllowance, cur) : '—'}
          </div>
        </Card>
      ) : null}

      {/* charts */}
      <div>
        <SectionTitle>توزيع الدخل</SectionTitle>
        <Card className="p-3">
          {budget.income <= 0 ? (
            <EmptyState icon="trend" title="لا يوجد دخل مسجل" hint="أضف دخلك الشهري ليظهر الرسم البياني." actionLabel="إضافة دخل" onAction={() => setIncomeOpen(true)} />
          ) : (
            <div dir="ltr" className="h-52 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
                    {donutData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatAmountCompact(Number(v), cur)} />
                  <Legend formatter={(v) => <span className="text-[11px] font-bold">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-1 text-center text-[11px] font-bold text-muted">
            إجمالي الدخل: {formatAmount(budget.income, cur)}
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>الالتزامات حسب التصنيف</SectionTitle>
        <Card className="p-3">
          {budget.byCategory.length === 0 ? (
            <EmptyState icon="pie" title="لا التزامات مالية هذا الشهر" />
          ) : (
            <div dir="ltr" className="h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={budget.byCategory.map((c) => ({ name: c.name, value: c.amount, color: c.color }))} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <Tooltip formatter={(v) => formatAmountCompact(Number(v), cur)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {budget.byCategory.map((c) => (
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
        <SectionTitle>الدخل مقابل الالتزامات عبر الأشهر</SectionTitle>
        <Card className="p-3">
          <div dir="ltr" className="h-56 w-full">
            <ResponsiveContainer>
              <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <Tooltip formatter={(v) => formatAmountCompact(Number(v), cur)} />
                <Legend formatter={(v) => <span className="text-[11px] font-bold">{v}</span>} />
                <Bar dataKey="الالتزامات" fill="#dc2626" radius={[6, 6, 0, 0]} barSize={14} />
                <Bar dataKey="الدخل" fill="#16a34a" radius={[6, 6, 0, 0]} barSize={14} />
                <Line type="monotone" dataKey="المتبقي" stroke="#0f766e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* annual commitments */}
      {budget.annual.length ? (
        <div>
          <SectionTitle>التزامات سنوية</SectionTitle>
          <div className="flex flex-col gap-2">
            {budget.annual.map((a) => (
              <Card key={a.name} className="flex items-center justify-between p-3">
                <div className="text-xs font-bold">{a.name}</div>
                <div className="text-end text-[11px] font-semibold text-muted">
                  <div>
                    التكلفة السنوية: <span className="font-extrabold text-ink">{formatAmountCompact(a.annualCost, cur)}</span>
                  </div>
                  <div>
                    المتوسط الشهري: <span className="font-extrabold text-ink">{formatAmountCompact(a.monthlyAverage, cur)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* income management */}
      <div>
        <SectionTitle
          action={
            <Button size="sm" icon="plus" onClick={() => setIncomeOpen(true)}>
              إدارة الدخل
            </Button>
          }
        >
          مصادر الدخل ({formatAmountCompact(budget.income, cur)})
        </SectionTitle>
        <div className="flex flex-col gap-2">
          {budget.incomeBreakdown.length === 0 ? (
            <EmptyState icon="wallet" title="لا مصادر دخل" hint="أضف راتبك أو أي مصدر دخل، وسيُحدَّث الإجمالي تلقائيًا." actionLabel="إضافة دخل" onAction={() => setIncomeOpen(true)} />
          ) : (
            budget.incomeBreakdown.map((s) => (
              <Card key={s.label} className="flex items-center justify-between p-3">
                <span className="text-xs font-bold">{s.label}</span>
                <span className="text-xs font-extrabold text-ok">{formatAmount(s.amount, cur)}</span>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* history */}
      <div>
        <SectionTitle>سجل الميزانية</SectionTitle>
        <div className="flex flex-col gap-2">
          {history
            .filter((h) => h.income > 0 || h.commitments > 0)
            .map((h) => (
              <button
                key={h.month}
                type="button"
                onClick={() => setMonth(h.month)}
                className={`card tap flex items-center justify-between p-3 text-start ${h.month === month ? 'ring-2 ring-brand' : ''}`}
              >
                <span className="text-xs font-bold">{monthLabel(h.month)}</span>
                <span className="flex gap-3 text-[10px] font-semibold text-muted">
                  <span>دخل {formatAmountCompact(h.income, cur)}</span>
                  <span>التزامات {formatAmountCompact(h.commitments, cur)}</span>
                  <span className={h.remaining < 0 ? 'text-danger' : 'text-ok'}>متبقٍ {formatAmountCompact(h.remaining, cur)}</span>
                </span>
              </button>
            ))}
        </div>
      </div>

      {/* income sheet */}
      <Sheet open={incomeOpen} onClose={() => setIncomeOpen(false)} title="إدارة الدخل">
        <div className="flex flex-col gap-4">
          <div>
            <SectionTitle>المصادر الشهرية الثابتة</SectionTitle>
            <div className="flex flex-col gap-2">
              {ctx.incomeSources.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                  <div className="flex-1">
                    <div className="text-xs font-bold">
                      {s.name} <span className="text-[10px] font-semibold text-muted">({KIND_LABELS[s.kind]})</span>
                    </div>
                    <div className="text-[11px] font-extrabold text-ok">{formatAmount(s.amount, cur)}</div>
                  </div>
                  <button
                    type="button"
                    className="tap rounded-lg px-2 py-1 text-[10px] font-bold text-muted"
                    onClick={async () => {
                      await incomeRepo.putSource({ ...s, active: !s.active, updatedAt: nowISO() })
                      await activityRepo.log('income_change', 'income', `${s.active ? 'أوقف' : 'فعّل'} مصدر «${s.name}»`, s.id, {})
                      notifyDataChanged()
                    }}
                  >
                    {s.active ? 'إيقاف' : 'تفعيل'}
                  </button>
                  <IconButton icon="trash" label="حذف المصدر" className="text-danger" onClick={() => setConfirmSource(s.id)} />
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="اسم المصدر">
                <TextInput value={srcName} onChange={(e) => setSrcName(e.target.value)} placeholder="راتب، تجارة…" />
              </Field>
              <Field label="النوع">
                <Select value={srcKind} onChange={(e) => setSrcKind(e.target.value as IncomeKind)}>
                  {(Object.keys(KIND_LABELS) as IncomeKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="col-span-2">
                <Field label="المبلغ الشهري">
                  <AmountInput value={srcAmount} onValue={setSrcAmount} currency={cur} />
                </Field>
              </div>
              <Button className="col-span-2" icon="plus" onClick={() => void addSource()}>
                إضافة مصدر
              </Button>
            </div>
          </div>

          <div>
            <SectionTitle>دخل إضافي لشهر {monthLabel(month)}</SectionTitle>
            <div className="flex flex-col gap-2">
              {monthEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                  <div className="flex-1">
                    <div className="text-xs font-bold">{e.label}</div>
                    <div className="text-[11px] font-extrabold text-ok">{formatAmount(e.amount, cur)}</div>
                  </div>
                  <IconButton icon="trash" label="حذف الدخل الإضافي" className="text-danger" onClick={() => setConfirmEntry(e.id)} />
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="الوصف">
                <TextInput value={entryLabel} onChange={(e) => setEntryLabel(e.target.value)} placeholder="مثال: عمل إضافي" />
              </Field>
              <Field label="المبلغ">
                <AmountInput value={entryAmount} onValue={setEntryAmount} currency={cur} />
              </Field>
              <Button className="col-span-2" icon="plus" onClick={() => void addEntry()}>
                تسجيل دخل إضافي
              </Button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted">
              تعديل الدخل لا يمسّ الالتزامات — بيانات منفصلة تمامًا. الالتزامات المالية تُحتسب في الميزانية تلقائيًا من قسم الالتزامات.
            </p>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!confirmSource}
        title="حذف مصدر الدخل"
        message="سيُحذف المصدر ويَتحدَّث إجمالي الدخل. الالتزامات لن تتأثر."
        danger
        confirmLabel="حذف"
        onClose={() => setConfirmSource(null)}
        onConfirm={async () => {
          if (confirmSource) {
            await incomeRepo.removeSource(confirmSource)
            await activityRepo.log('income_change', 'income', 'حذف مصدر دخل', confirmSource, {})
            notifyDataChanged()
            showToast('تم حذف المصدر', 'success')
          }
          setConfirmSource(null)
        }}
      />
      <ConfirmDialog
        open={!!confirmEntry}
        title="حذف الدخل الإضافي"
        message="سيُحذف هذا الدخل من شهره ويَتحدَّث الإجمالي."
        danger
        confirmLabel="حذف"
        onClose={() => setConfirmEntry(null)}
        onConfirm={async () => {
          if (confirmEntry) {
            await incomeRepo.removeEntry(confirmEntry)
            await activityRepo.log('income_change', 'income', 'حذف دخلًا إضافيًا', confirmEntry, {})
            notifyDataChanged()
            showToast('تم الحذف', 'success')
          }
          setConfirmEntry(null)
        }}
      />
      <div className="text-center text-[10px] text-muted">بيوم {todayISO()} — تُحدَّث الأرقام لحظيًا مع كل تعديل</div>
    </div>
  )
}
