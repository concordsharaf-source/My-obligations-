import { useMemo, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataBundle } from '@/hooks/useLiveData'
import { useSettings } from '@/store/settings.store'
import { useNow } from '@/hooks/useNow'
import { expandInstances, obligationsService } from '@/services/obligations.service'
import { ObligationCard } from '@/components/obligations/ObligationCard'
import { EmptyState, IconButton, Segmented } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import {
  addDays,
  currentMonthKey,
  daysInMonth,
  monthKeyFromParts,
  monthLabel,
  parseISODate,
  shiftMonth,
  startOfWeekISO,
  todayISO,
  weekDatesISO,
  WEEKDAY_NAMES,
} from '@/utils/date'
import { cn } from '@/utils/cn'
import type { ObligationInstance } from '@/types'

type View = 'month' | 'week' | 'day'

export default function CalendarPage(): JSX.Element {
  const navigate = useNavigate()
  const bundle = useDataBundle()
  const settings = useSettings()
  const now = useNow(60_000)
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(todayISO())
  const [selected, setSelected] = useState(todayISO())

  const month = anchor.slice(0, 7)

  const instances = useMemo(() => {
    if (!bundle.ready) return []
    const from = `${shiftMonth(month, -1)}-01`
    const to = `${shiftMonth(month, 1)}-31`
    return expandInstances(bundle.obligations, bundle.payments, from, to, { now })
  }, [bundle, month, now])

  const byDate = useMemo(() => {
    const map = new Map<string, ObligationInstance[]>()
    for (const i of instances) {
      const arr = map.get(i.dueDate) ?? []
      arr.push(i)
      map.set(i.dueDate, arr)
    }
    return map
  }, [instances])

  const weekDays = weekDatesISO(anchor, settings.weekStartsOn)
  const dayList = view === 'day' ? (byDate.get(selected) ?? []) : view === 'week' ? weekDays.flatMap((d) => byDate.get(d) ?? []) : (byDate.get(selected) ?? [])

  const gridDays = useMemo(() => {
    const first = `${month}-01`
    const start = startOfWeekISO(first, settings.weekStartsOn)
    const count = daysInMonth(month)
    const last = `${month}-${String(count).padStart(2, '0')}`
    const endWeekStart = startOfWeekISO(last, settings.weekStartsOn)
    const days: string[] = []
    let cur = start
    let guard = 0
    while (cur <= endWeekStart && guard < 60) {
      for (let i = 0; i < 7; i++) {
        days.push(cur)
        cur = addDays(cur, 1)
      }
      guard++
    }
    return days
  }, [month, settings.weekStartsOn])

  const shift = (dir: 1 | -1): void => {
    if (view === 'month') {
      const next = shiftMonth(month, dir)
      const [y, m] = next.split('-').map(Number)
      setAnchor(monthKeyFromParts(y, m) + '-01')
    } else if (view === 'week') {
      setAnchor(addDays(anchor, dir * 7))
    } else {
      const d = addDays(selected, dir)
      setSelected(d)
      setAnchor(d)
    }
  }

  const today = todayISO()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-extrabold">التقويم</h1>
        <div className="flex items-center gap-1">
          <IconButton icon="chevron-right" label="السابق" onClick={() => shift(-1)} />
          <button type="button" className="tap rounded-lg px-2 py-1 text-xs font-bold" onClick={() => { setAnchor(today); setSelected(today) }}>
            اليوم
          </button>
          <IconButton icon="chevron-left" label="التالي" onClick={() => shift(1)} />
        </div>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'month', label: 'شهري', icon: 'calendar' },
          { value: 'week', label: 'أسبوعي', icon: 'repeat' },
          { value: 'day', label: 'يومي', icon: 'clock' },
        ]}
      />

      {view === 'month' ? (
        <div className="card overflow-hidden p-2">
          <div className="mb-1 text-center text-sm font-extrabold">{monthLabel(month)}</div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="py-1 text-[10px] font-bold text-muted">
                {WEEKDAY_NAMES[(settings.weekStartsOn + i) % 7]?.slice(0, 3)}
              </div>
            ))}
            {gridDays.map((d) => {
              const inMonth = d.startsWith(month)
              const items = byDate.get(d) ?? []
              const openCount = items.filter((i) => i.status === 'pending').length
              const hasOverdue = items.some((i) => i.isOverdue)
              const done = items.length > 0 && items.every((i) => i.status === 'completed')
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelected(d)
                    setView('day')
                  }}
                  className={cn(
                    'tap relative flex h-11 flex-col items-center justify-center rounded-xl text-xs font-semibold',
                    !inMonth && 'opacity-35',
                    d === selected ? 'bg-brandsoft text-brand' : 'hover:bg-card2',
                    d === today && 'ring-1 ring-brand',
                  )}
                >
                  {Number(d.slice(8))}
                  <span className="mt-0.5 flex h-1.5 gap-0.5">
                    {openCount > 0 ? (
                      <span className={cn('h-1.5 w-1.5 rounded-full', hasOverdue ? 'bg-danger' : 'bg-brand')} />
                    ) : done ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                    ) : null}
                    {openCount > 1 ? <span className="h-1.5 w-1.5 rounded-full bg-muted" /> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : view === 'week' ? (
        <div className="card flex flex-col gap-1 p-2">
          {weekDays.map((d) => {
            const items = byDate.get(d) ?? []
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSelected(d)
                  setView('day')
                }}
                className={cn('tap flex items-center justify-between rounded-xl px-3 py-2', d === selected ? 'bg-brandsoft' : 'hover:bg-card2')}
              >
                <span className="text-xs font-bold">
                  {WEEKDAY_NAMES[parseISODate(d).getDay()]} {Number(d.slice(8))}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                  {items.length ? `${items.length} التزام` : '—'}
                  <Icon name="chevron-left" size={12} />
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-muted">
            {view === 'day' ? `تفاصيل ${selected}` : `تفاصيل ${selected} (${dayList.length})`}
          </h2>
        </div>
        {dayList.length === 0 ? (
          <EmptyState icon="calendar" title="لا توجد التزامات في هذا اليوم" actionLabel="أضف التزامًا" onAction={() => navigate('/new')} />
        ) : (
          <div className="flex flex-col gap-2">
            {dayList.map((inst) => (
              <ObligationCard
                key={`${inst.obligation.id}-${inst.baseDate}`}
                inst={inst}
                category={bundle.categories.find((c) => c.id === inst.obligation.categoryId)}
                person={bundle.persons.find((p) => p.id === inst.obligation.personId)}
                onAction={(i) => {
                  void obligationsService.completeInstance(i.obligation.id, i.baseDate).then(() => {
                    notifyDataChanged()
                    showToast('تم إكمال الالتزام', 'success')
                  })
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="text-center text-[10px] text-muted">{currentMonthKey() === month ? 'الشهر الحالي' : monthLabel(month)}</div>
    </div>
  )
}
