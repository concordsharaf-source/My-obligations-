import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Icon } from './Icon'

/* ---------------- Button ---------------- */
type Variant = 'primary' | 'soft' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const variantClass: Record<Variant, string> = {
  primary: 'bg-brand text-brandink hover:opacity-90 shadow-sm',
  soft: 'bg-brandsoft text-brand hover:opacity-85',
  ghost: 'text-ink hover:bg-card2',
  danger: 'bg-danger text-white hover:opacity-90',
  outline: 'border border-border bg-card text-ink hover:bg-card2',
}
const sizeClass: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-2xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: string }): JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'tap inline-flex items-center justify-center font-semibold disabled:opacity-50 disabled:pointer-events-none select-none',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 18} /> : null}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className,
  size = 20,
  badge,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; size?: number; badge?: number }): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'tap relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-card2',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
      {badge ? (
        <span className="absolute -top-0.5 -left-0.5 min-w-4.5 rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  )
}

/* ---------------- Card ---------------- */
export function Card({
  className,
  children,
  onClick,
}: {
  className?: string
  children: ReactNode
  onClick?: () => void
}): JSX.Element {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn('card block w-full text-start', onClick && 'tap cursor-pointer', className)}
    >
      {children}
    </Tag>
  )
}

/* ---------------- Badge / Chip ---------------- */
export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: 'neutral' | 'brand' | 'danger' | 'warn' | 'ok' | 'info'
  children: ReactNode
  className?: string
  icon?: string
}): JSX.Element {
  const tones: Record<string, string> = {
    neutral: 'bg-card2 text-muted',
    brand: 'bg-brandsoft text-brand',
    danger: 'bg-dangersoft text-danger',
    warn: 'bg-warnsoft text-warn',
    ok: 'bg-oksoft text-ok',
    info: 'bg-infosoft text-info',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}

/* ---------------- Segmented ---------------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: string }[]
  className?: string
}): JSX.Element {
  return (
    <div className={cn('flex rounded-xl bg-card2 p-1 gap-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'tap flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5',
            value === o.value ? 'bg-card text-ink shadow-sm' : 'text-muted',
          )}
        >
          {o.icon ? <Icon name={o.icon} size={14} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Switch ---------------- */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'start-[22px]' : 'start-0.5',
        )}
      />
    </button>
  )
}

/* ---------------- Progress ---------------- */
export function Progress({ value, tone = 'brand' }: { value: number; tone?: string }): JSX.Element {
  const pct = Math.max(0, Math.min(100, value))
  const colors: Record<string, string> = {
    brand: 'bg-brand',
    danger: 'bg-danger',
    warn: 'bg-warn',
    ok: 'bg-ok',
  }
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-card2">
      <div className={cn('h-full rounded-full transition-all', colors[tone] ?? 'bg-brand')} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  icon = 'inbox',
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon?: string
  title: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
}): JSX.Element {
  return (
    <div className="anim-fade-up flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brandsoft text-brand">
        <Icon name={icon} size={30} />
      </div>
      <div className="text-base font-bold">{title}</div>
      {hint ? <div className="max-w-60 text-xs leading-5 text-muted">{hint}</div> : null}
      {actionLabel && onAction ? (
        <Button size="sm" icon="plus" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

/* ---------------- Section title ---------------- */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }): JSX.Element {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="text-sm font-bold text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function Spinner({ size = 20 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-brand" aria-label="جارٍ التحميل">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}
