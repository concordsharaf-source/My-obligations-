import { useEffect, useMemo, type JSX } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useBudgetContext, useDataBundle } from '@/hooks/useLiveData'
import { computeBudgetMonth } from '@/services/budget.service'
import { computePersonBalance } from '@/services/persons.service'
import { computeStats } from '@/services/stats.service'
import { expandInstances } from '@/services/obligations.service'
import { paymentAttribution } from '@/services/instances'
import { Button } from '@/components/ui/primitives'
import { currentMonthKey, formatDateShort, monthLabel, todayISO } from '@/utils/date'
import { formatAmount, round2 } from '@/utils/money'
import type { JSX as ReactJSX } from 'react'

function Row({ cells }: { cells: (string | number)[] }): ReactJSX.Element {
  return (
    <tr className="border-b border-gray-300">
      {cells.map((c, i) => (
        <td key={i} className="px-2 py-1.5 text-[11px]">
          {c}
        </td>
      ))}
    </tr>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }): ReactJSX.Element {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b-2 border-gray-500 bg-gray-100">
          {head.map((h) => (
            <th key={h} className="px-2 py-1.5 text-start text-[11px] font-extrabold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map((r, i) => <Row key={i} cells={r} />)}</tbody>
    </table>
  )
}

export default function PrintPage(): JSX.Element {
  const { report = 'debts' } = useParams()
  const [params] = useSearchParams()
  const bundle = useDataBundle()
  const { ctx } = useBudgetContext()

  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 350)
    return () => window.clearTimeout(t)
  }, [])

  const content = useMemo(() => {
    if (!ctx) return null
    const cur = ctx.settings.currency
    if (report === 'debts') {
      const stats = computeStats(ctx)
      const rows = ctx.obligations
        .filter((o) => o.financial && o.deletedAt === null)
        .map((o) => {
          const map = paymentAttribution(o, ctx.payments)
          const paid = round2([...map.values()].reduce((s, v) => s + v, 0))
          return [
            o.title,
            o.direction === 'owe' ? 'عليّ' : 'لي',
            formatAmount(o.amount, o.currency),
            formatAmount(paid, o.currency),
            formatAmount(Math.max(0, o.amount - paid), o.currency),
            formatDateShort(o.dueDate),
          ]
        })
      return (
        <>
          <h2 className="mb-1 text-sm font-extrabold">تقرير الديون</h2>
          <p className="mb-2 text-[10px]">
            عليّ: {formatAmount(stats.owe.remaining, cur)} متبقٍ · لي: {formatAmount(stats.owed.remaining, cur)} متبقٍ · بتاريخ {formatDateShort(todayISO())}
          </p>
          <Table head={['الالتزام', 'النوع', 'المبلغ', 'المدفوع', 'المتبقي', 'الاستحقاق']} rows={rows} />
        </>
      )
    }
    if (report === 'month') {
      const month = currentMonthKey()
      const insts = expandInstances(ctx.obligations, ctx.payments, `${month}-01`, `${month}-31`)
      const rows = insts.map((i) => [
        i.obligation.title,
        formatDateShort(i.dueDate),
        i.status === 'completed' ? 'مكتمل' : i.isOverdue ? 'متأخر' : 'قيد التنفيذ',
        i.obligation.financial ? formatAmount(i.obligation.amount, i.obligation.currency) : '—',
      ])
      return (
        <>
          <h2 className="mb-2 text-sm font-extrabold">التزامات شهر {monthLabel(month)}</h2>
          <Table head={['الالتزام', 'التاريخ', 'الحالة', 'المبلغ']} rows={rows} />
        </>
      )
    }
    if (report === 'person') {
      const id = params.get('id') ?? ''
      const person = ctx.settings ? bundle.persons.find((p) => p.id === id) : undefined
      if (!person) return <p>الشخص غير موجود</p>
      const b = computePersonBalance(person, bundle.obligations, bundle.payments)
      const rows = b.obligations.map((o) => {
        const paid = b.payments.filter((p) => p.obligationId === o.id).reduce((s, p) => s + p.amount, 0)
        return [
          o.title,
          o.direction === 'owe' ? 'عليّ' : o.direction === 'owed' ? 'لي' : 'غير مالي',
          formatAmount(o.amount, o.currency),
          formatAmount(paid, o.currency),
          formatDateShort(o.dueDate),
        ]
      })
      return (
        <>
          <h2 className="mb-1 text-sm font-extrabold">كشف حساب: {person.name}</h2>
          <p className="mb-2 text-[10px]">
            له: {formatAmount(b.oweRemaining, cur)} · عليه: {formatAmount(b.owedRemaining, cur)} · الرصيد: {formatAmount(Math.abs(b.net), cur)} {b.net >= 0 ? 'لك' : 'عليك'}
          </p>
          <Table head={['الالتزام', 'النوع', 'المبلغ', 'المدفوع', 'الاستحقاق']} rows={rows} />
        </>
      )
    }
    // budget
    const budget = computeBudgetMonth(currentMonthKey(), ctx)
    return (
      <>
        <h2 className="mb-1 text-sm font-extrabold">ميزانية {monthLabel(budget.month)}</h2>
        <Table
          head={['البند', 'القيمة']}
          rows={[
            ['إجمالي الدخل', formatAmount(budget.income, cur)],
            ['إجمالي الالتزامات', formatAmount(budget.commitments, cur)],
            ['المدفوع', formatAmount(budget.paid, cur)],
            ['المتبقي', formatAmount(budget.remaining, cur)],
            ['المتأخر', formatAmount(budget.overdue, cur)],
            ['نسبة الاستخدام', `${Math.round(budget.ratio)}%`],
            ...budget.byCategory.map((c) => [`تصنيف: ${c.name}`, formatAmount(c.amount, cur)] as (string | number)[]),
          ]}
        />
      </>
    )
  }, [report, ctx, bundle, params])

  return (
    <div className="print-area mx-auto max-w-3xl bg-white p-4 text-black">
      <div className="no-print mb-3 flex justify-end">
        <Button icon="printer" onClick={() => window.print()}>
          طباعة
        </Button>
      </div>
      <div className="mb-3 flex items-center justify-between border-b-2 border-gray-800 pb-2">
        <span className="text-base font-extrabold">التزاماتي</span>
        <span className="text-[10px]">لا تنسَ ما عليك... ولا ما لك</span>
      </div>
      {content ?? <p className="text-xs">جارٍ التحميل…</p>}
    </div>
  )
}
