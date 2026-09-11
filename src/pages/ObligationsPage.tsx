import { useMemo, useState, type JSX } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDataBundle } from '@/hooks/useLiveData'
import { useNow } from '@/hooks/useNow'
import { expandInstances, obligationsService } from '@/services/obligations.service'
import { ObligationCard } from '@/components/obligations/ObligationCard'
import { EmptyState, Segmented } from '@/components/ui/primitives'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import { addDays, todayISO } from '@/utils/date'
import type { ObligationInstance } from '@/types'

type Tab = 'all' | 'open' | 'overdue' | 'done' | 'archived'

export default function ObligationsPage(): JSX.Element {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const bundle = useDataBundle()
  const now = useNow(30_000)
  const initial = params.get('filter') === 'overdue' ? 'overdue' : 'all'
  const [tab, setTab] = useState<Tab>(initial)

  const today = todayISO()

  const rows = useMemo(() => {
    if (!bundle.ready) return []
    const from = addDays(today, -400)
    const to = addDays(today, 400)
    const instances = expandInstances(bundle.obligations, bundle.payments, from, to, {
      now,
      includeArchived: tab === 'archived',
    })
    // latest relevant instance per obligation
    const byOb = new Map<string, ObligationInstance>()
    for (const inst of instances) {
      const prev = byOb.get(inst.obligation.id)
      if (!prev) {
        byOb.set(inst.obligation.id, inst)
        continue
      }
      // prefer open & nearest, else most recent
      const prevOpen = prev.status === 'pending'
      const curOpen = inst.status === 'pending'
      if (curOpen && (!prevOpen || Math.abs(new Date(inst.dueDate).getTime() - now.getTime()) < Math.abs(new Date(prev.dueDate).getTime() - now.getTime()))) {
        byOb.set(inst.obligation.id, inst)
      } else if (!prevOpen && inst.dueDate > prev.dueDate) {
        byOb.set(inst.obligation.id, inst)
      }
    }
    for (const ob of bundle.obligations) {
      if (byOb.has(ob.id)) continue
      const archived = ob.status === 'archived'
      if (archived ? tab !== 'archived' : tab === 'archived') continue
      byOb.set(ob.id, {
        obligation: ob,
        dueDate: ob.dueDate,
        dueTime: ob.dueTime,
        baseDate: ob.dueDate,
        status: ob.status === 'completed' ? 'completed' : 'pending',
        completedAt: ob.completedAt,
        snoozedUntil: null,
        paid: 0,
        remaining: ob.amount,
        isOverdue: ob.status === 'active' && ob.dueDate < today && (!ob.financial || ob.amount > 0),
      })
    }
    let list = [...byOb.values()]
    if (tab === 'archived') list = list.filter((i) => i.obligation.status === 'archived')
    else list = list.filter((i) => i.obligation.status !== 'archived')
    if (tab === 'open') list = list.filter((i) => i.status === 'pending' && !i.isOverdue)
    if (tab === 'overdue') list = list.filter((i) => i.isOverdue)
    if (tab === 'done') list = list.filter((i) => i.status === 'completed')
    list.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    return list
  }, [bundle, tab, now, today])

  const switchTab = (t: Tab): void => {
    setTab(t)
    if (t === 'overdue') setParams({ filter: 'overdue' })
    else setParams({})
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-extrabold">الالتزامات</h1>
        <span className="text-[11px] font-semibold text-muted">{rows.length}</span>
      </div>
      <Segmented
        value={tab}
        onChange={switchTab}
        options={[
          { value: 'all', label: 'الكل' },
          { value: 'open', label: 'قيد التنفيذ' },
          { value: 'overdue', label: 'متأخر' },
          { value: 'done', label: 'مكتمل' },
          { value: 'archived', label: 'أرشيف' },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon="list"
          title={tab === 'overdue' ? 'لا متأخرات 🎉' : 'لا توجد التزامات بعد'}
          hint="أضف التزامك الأول وسيظهر هنا وفي التقويم والميزانية تلقائيًا."
          actionLabel="أضف أول التزام"
          onAction={() => navigate('/new')}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((inst) => (
            <ObligationCard
              key={`${inst.obligation.id}-${inst.baseDate}`}
              inst={inst}
              category={bundle.categories.find((c) => c.id === inst.obligation.categoryId)}
              person={bundle.persons.find((p) => p.id === inst.obligation.personId)}
              onAction={(i) => {
                const done = i.status === 'completed'
                void (done
                  ? obligationsService.uncompleteInstance(i.obligation.id, i.baseDate)
                  : obligationsService.completeInstance(i.obligation.id, i.baseDate)
                ).then(() => {
                  notifyDataChanged()
                  showToast(done ? 'أُعيد فتح الالتزام' : 'تم إكمال الالتزام', 'success')
                })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
