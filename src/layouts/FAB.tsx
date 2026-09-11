import { useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { Icon } from '@/components/ui/Icon'

const QUICK = [
  { kind: 'new', label: 'التزام جديد', icon: 'plus' },
  { kind: 'owe', label: 'دين عليّ', icon: 'arrow-up' },
  { kind: 'owed', label: 'دين لي', icon: 'arrow-down' },
  { kind: 'bill', label: 'فاتورة', icon: 'receipt' },
  { kind: 'installment', label: 'قسط', icon: 'layers' },
  { kind: 'appointment', label: 'موعد', icon: 'calendar-clock' },
  { kind: 'task', label: 'مهمة', icon: 'check' },
  { kind: 'recurring', label: 'التزام متكرر', icon: 'repeat' },
]

export function FAB(): JSX.Element {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <>
      {open ? (
        <button type="button" aria-label="إغلاق القائمة" className="fixed inset-0 z-40 bg-black/35" onClick={() => setOpen(false)} />
      ) : null}
      <div className="no-print fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-2xl flex-col items-end gap-2 px-4">
        {open
          ? QUICK.map((q, i) => (
              <button
                key={q.kind}
                type="button"
                style={{ animationDelay: `${i * 22}ms` }}
                className="anim-pop tap flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold shadow-lg"
                onClick={() => {
                  setOpen(false)
                  navigate(`/new?kind=${q.kind}`)
                }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brandsoft text-brand">
                  <Icon name={q.icon} size={16} />
                </span>
                {q.label}
              </button>
            ))
          : null}
      </div>
      <button
        type="button"
        aria-label="إضافة"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'no-print tap fixed bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brandink shadow-xl transition-transform',
          'end-4 sm:end-[calc(50%-16rem+1rem)]',
          open && 'rotate-45',
        )}
      >
        <Icon name="plus" size={26} strokeWidth={2.4} />
      </button>
    </>
  )
}
