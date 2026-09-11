import { useMemo, useState, type JSX } from 'react'
import { useDataBundle } from '@/hooks/useLiveData'
import { emptyFilters, searchObligations, type SearchFilters } from '@/services/search.service'
import { paymentAttribution } from '@/services/instances'
import { ObligationCard } from '@/components/obligations/ObligationCard'
import { Button, EmptyState } from '@/components/ui/primitives'
import { Sheet } from '@/components/ui/overlays'
import { Field, Select, TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'
import { parseAmount } from '@/utils/money'

export default function SearchPage(): JSX.Element {
  const bundle = useDataBundle()
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters)
  const [open, setOpen] = useState(false)

  const hits = useMemo(() => {
    if (!bundle.ready) return []
    return searchObligations(
      q,
      filters,
      { obligations: bundle.obligations, payments: bundle.payments, persons: bundle.persons, categories: bundle.categories },
      (ob) => {
        const map = paymentAttribution(ob, bundle.payments)
        return [...map.values()].reduce((s, v) => s + v, 0)
      },
    )
  }, [q, filters, bundle])

  const activeFilterCount =
    (filters.categoryId ? 1 : 0) +
    (filters.personId ? 1 : 0) +
    (filters.direction ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.amountMin !== null || filters.amountMax !== null ? 1 : 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon name="search" size={16} />
          </span>
          <TextInput
            autoFocus
            className="ps-9"
            placeholder="ابحث بالاسم، الشخص، الهاتف، الملاحظات، المبلغ…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button variant="outline" icon="filter" onClick={() => setOpen(true)}>
          {activeFilterCount ? `(${activeFilterCount})` : ''}
        </Button>
      </div>

      {q === '' && activeFilterCount === 0 ? (
        <EmptyState icon="search" title="بحث شامل" hint="اكتب أي جزء من الاسم أو الشخص أو الهاتف أو المبلغ، أو استخدم الفلاتر." />
      ) : hits.length === 0 ? (
        <EmptyState icon="search" title="لا نتائج مطابقة" hint="جرّب كلمة أخرى أو خفّف الفلاتر." />
      ) : (
        <div className="flex flex-col gap-2">
          {hits.map((h) => (
            <ObligationCard
              key={h.obligation.id}
              inst={{
                obligation: h.obligation,
                dueDate: h.obligation.dueDate,
                dueTime: h.obligation.dueTime,
                baseDate: h.obligation.dueDate,
                status: h.obligation.status === 'completed' ? 'completed' : 'pending',
                completedAt: h.obligation.completedAt,
                snoozedUntil: null,
                paid: 0,
                remaining: h.obligation.amount,
                isOverdue: false,
              }}
              category={bundle.categories.find((c) => c.id === h.obligation.categoryId)}
              person={bundle.persons.find((p) => p.id === h.obligation.personId)}
            />
          ))}
        </div>
      )}
      <div className="text-center text-[10px] text-muted">{hits.length ? `${hits.length} نتيجة` : ''}</div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="الفلاتر"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setOpen(false)}>
              تطبيق
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setFilters(emptyFilters)
                setOpen(false)
              }}
            >
              مسح الفلاتر
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="التصنيف">
            <Select value={filters.categoryId ?? ''} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value || null })}>
              <option value="">الكل</option>
              {bundle.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الشخص">
            <Select value={filters.personId ?? ''} onChange={(e) => setFilters({ ...filters, personId: e.target.value || null })}>
              <option value="">الكل</option>
              {bundle.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="النوع">
            <Select
              value={filters.direction ?? ''}
              onChange={(e) => setFilters({ ...filters, direction: (e.target.value || null) as SearchFilters['direction'] })}
            >
              <option value="">الكل</option>
              <option value="owe">عليّ</option>
              <option value="owed">لي</option>
              <option value="none">غير مالي</option>
            </Select>
          </Field>
          <Field label="الحالة">
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as SearchFilters['status'] })}>
              <option value="all">الكل</option>
              <option value="open">قيد التنفيذ</option>
              <option value="completed">مكتمل</option>
              <option value="overdue">متأخر</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="من تاريخ">
              <TextInput type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || null })} />
            </Field>
            <Field label="إلى تاريخ">
              <TextInput type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || null })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="أقل مبلغ">
              <TextInput
                inputMode="decimal"
                value={filters.amountMin !== null ? String(filters.amountMin) : ''}
                onChange={(e) => setFilters({ ...filters, amountMin: parseAmount(e.target.value) })}
              />
            </Field>
            <Field label="أعلى مبلغ">
              <TextInput
                inputMode="decimal"
                value={filters.amountMax !== null ? String(filters.amountMax) : ''}
                onChange={(e) => setFilters({ ...filters, amountMax: parseAmount(e.target.value) })}
              />
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
