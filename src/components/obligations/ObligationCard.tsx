import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Category, ObligationInstance, Person } from '@/types'
import { Badge, Card } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { formatAmountCompact } from '@/utils/money'
import { relativeDay, formatTime, todayISO } from '@/utils/date'
import { cn } from '@/utils/cn'

export function ObligationCard({
  inst,
  category,
  person,
  onAction,
}: {
  inst: ObligationInstance
  category?: Category
  person?: Person
  onAction?: (inst: ObligationInstance) => void
}): JSX.Element {
  const navigate = useNavigate()
  const ob = inst.obligation
  const today = todayISO()

  return (
    <Card
      className="p-3"
      onClick={() => navigate(`/obligation/${ob.id}`)}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={inst.status === 'completed' ? 'إلغاء الإكمال' : 'إكمال'}
          onClick={(e) => {
            e.stopPropagation()
            onAction?.(inst)
          }}
          className={cn(
            'tap mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            inst.status === 'completed'
              ? 'border-ok bg-ok text-white'
              : inst.isOverdue
                ? 'border-danger'
                : 'border-border',
          )}
        >
          {inst.status === 'completed' ? <Icon name="check" size={13} strokeWidth={3} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold">{ob.title}</span>
            {ob.recurrence.type !== 'none' ? <Icon name="repeat" size={13} className="shrink-0 text-muted" /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {category ? (
              <Badge tone="neutral">
                <span className="inline-flex items-center gap-1">
                  <Icon name={category.icon} size={11} />
                  {category.name}
                </span>
              </Badge>
            ) : null}
            <Badge tone={inst.isOverdue ? 'danger' : inst.dueDate === today ? 'brand' : 'neutral'}>
              {relativeDay(inst.dueDate, today)}
            </Badge>
            {inst.dueTime ? <Badge tone="neutral">{formatTime(inst.dueTime)}</Badge> : null}
            {person ? (
              <Badge tone="neutral">
                <span className="inline-flex items-center gap-1">
                  <Icon name="user" size={11} />
                  {person.name}
                </span>
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-end">
          {ob.financial ? (
            <>
              <div className={cn('text-sm font-extrabold', ob.direction === 'owe' ? 'text-danger' : 'text-ok')}>
                {ob.direction === 'owe' ? '−' : '+'}
                {formatAmountCompact(ob.amount, ob.currency)}
              </div>
              {inst.remaining > 0 && inst.paid > 0 ? (
                <div className="text-[10px] font-semibold text-muted">متبقٍ {formatAmountCompact(inst.remaining, ob.currency)}</div>
              ) : inst.remaining <= 0 && ob.financial ? (
                <div className="text-[10px] font-bold text-ok">تم السداد</div>
              ) : null}
            </>
          ) : (
            <Badge tone={ob.direction === 'none' ? 'neutral' : 'info'}>
              {ob.direction === 'owed' ? 'لي' : 'غير مالي'}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}
