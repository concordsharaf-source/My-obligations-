import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import { Button, IconButton } from './primitives'
import { Icon } from './Icon'
import { useUIStore } from '@/store/ui.store'

/* ---------------- Bottom sheet / modal ---------------- */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="إغلاق" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          'anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-base font-bold">{title}</h3>
          <IconButton icon="x" label="إغلاق" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="safe-b border-t border-border px-4 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- Confirm dialog ---------------- */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  danger,
  onConfirm,
  onClose,
  extra,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
  extra?: ReactNode
}): JSX.Element | null {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-muted">{message}</p>
      {extra}
    </Sheet>
  )
}

/* ---------------- Toasts ---------------- */
function ToastItem({ id }: { id: string }): JSX.Element | null {
  const toast = useUIStore((s) => s.toasts.find((t) => t.id === id))
  const dismiss = useUIStore((s) => s.dismissToast)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (!toast) return
    timer.current = window.setTimeout(() => dismiss(toast.id), toast.durationMs)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [toast, dismiss])
  if (!toast) return null
  const tones: Record<string, string> = {
    info: 'border-info/40 bg-infosoft text-info',
    success: 'border-ok/40 bg-oksoft text-ok',
    warning: 'border-warn/40 bg-warnsoft text-warn',
    danger: 'border-danger/40 bg-dangersoft text-danger',
  }
  return (
    <div
      className={cn(
        'anim-pop pointer-events-auto flex w-full items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur',
        tones[toast.kind],
      )}
      role="status"
    >
      <span className="flex-1 text-xs font-semibold leading-5">{toast.message}</span>
      {toast.actionLabel ? (
        <button
          type="button"
          className="tap rounded-lg px-2 py-1 text-xs font-bold underline underline-offset-4"
          onClick={() => {
            void toast.onAction?.()
            dismiss(toast.id)
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <button type="button" aria-label="إخفاء" onClick={() => dismiss(toast.id)}>
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

export function ToastHost(): JSX.Element {
  const toasts = useUIStore((s) => s.toasts)
  return createPortal(
    <div className="no-print pointer-events-none fixed inset-x-3 bottom-24 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:end-4 sm:w-96">
      {toasts.slice(-3).map((t) => (
        <ToastItem key={t.id} id={t.id} />
      ))}
    </div>,
    document.body,
  )
}

/* ---------------- Simple menu ---------------- */
export function Menu({
  trigger,
  items,
}: {
  trigger: (open: () => void) => ReactNode
  items: { label: string; icon?: string; danger?: boolean; onClick: () => void }[]
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      {trigger(() => setOpen((v) => !v))}
      {open ? (
        <div className="anim-pop absolute end-0 top-11 z-40 min-w-44 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-start text-xs font-semibold hover:bg-card2',
                it.danger && 'text-danger',
              )}
            >
              {it.icon ? <Icon name={it.icon} size={15} /> : null}
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
