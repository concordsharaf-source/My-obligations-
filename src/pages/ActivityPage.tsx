import type { JSX } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/database/db'
import { Card, EmptyState } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { formatDateTime } from '@/utils/date'

const TYPE_ICONS: Record<string, { icon: string; tone: string }> = {
  create: { icon: 'plus', tone: 'bg-oksoft text-ok' },
  update: { icon: 'edit', tone: 'bg-infosoft text-info' },
  delete: { icon: 'trash', tone: 'bg-dangersoft text-danger' },
  restore: { icon: 'undo', tone: 'bg-oksoft text-ok' },
  complete: { icon: 'check-circle', tone: 'bg-oksoft text-ok' },
  uncomplete: { icon: 'undo', tone: 'bg-warnsoft text-warn' },
  snooze: { icon: 'alarm', tone: 'bg-warnsoft text-warn' },
  reschedule: { icon: 'calendar', tone: 'bg-infosoft text-info' },
  payment: { icon: 'coins', tone: 'bg-oksoft text-ok' },
  cancel: { icon: 'x', tone: 'bg-dangersoft text-danger' },
  recurrence_change: { icon: 'repeat', tone: 'bg-infosoft text-info' },
  income_change: { icon: 'wallet', tone: 'bg-brandsoft text-brand' },
  settings_change: { icon: 'settings', tone: 'bg-card2 text-muted' },
  import: { icon: 'upload', tone: 'bg-brandsoft text-brand' },
  export: { icon: 'download', tone: 'bg-brandsoft text-brand' },
}

export default function ActivityPage(): JSX.Element {
  const entries = useLiveQuery(() => db.activity.orderBy('at').reverse().limit(300).toArray(), [], [])

  return (
    <div className="flex flex-col gap-3">
      <h1 className="px-1 text-base font-extrabold">السجل</h1>
      {!entries ? (
        <div className="p-6 text-center text-sm text-muted">جارٍ التحميل…</div>
      ) : entries.length === 0 ? (
        <EmptyState icon="history" title="السجل فارغ" hint="كل عملية إضافة أو تعديل أو دفعة ستُوثَّق هنا تلقائيًا." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((e) => {
            const meta = TYPE_ICONS[e.type] ?? TYPE_ICONS.update
            return (
              <Card key={e.id} className="flex items-center gap-2.5 p-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                  <Icon name={meta.icon} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">{e.message}</span>
                  <span className="block text-[10px] text-muted">{formatDateTime(e.at)}</span>
                </span>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
