import type { InputHTMLAttributes, JSX, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '@/utils/cn'
import { Icon } from './Icon'

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
  required?: boolean
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 px-0.5 text-xs font-semibold text-muted">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 flex items-center gap-1 px-0.5 text-[11px] font-semibold text-danger">
          <Icon name="alert-circle" size={12} />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block px-0.5 text-[11px] text-muted">{hint}</span>
      ) : null}
    </label>
  )
}

const baseInput =
  'w-full rounded-xl border border-border bg-card px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-50'

export function TextInput({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }): JSX.Element {
  return (
    <input
      className={cn(baseInput, 'h-11', invalid && 'border-danger focus:border-danger focus:ring-danger/20', className)}
      {...rest}
    />
  )
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return <textarea className={cn(baseInput, 'min-h-20 py-2 leading-6', className)} {...rest} />
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <div className="relative">
      <select className={cn(baseInput, 'h-11 appearance-none pe-9', className)} {...rest}>
        {children}
      </select>
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="chevron-down" size={16} />
      </span>
    </div>
  )
}

export function AmountInput({
  value,
  onValue,
  currency,
  invalid,
  placeholder = '0',
}: {
  value: string
  onValue: (v: string) => void
  currency: string
  invalid?: boolean
  placeholder?: string
}): JSX.Element {
  const id = useId()
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="decimal"
        dir="ltr"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className={cn(
          baseInput,
          'h-11 pe-16 text-start font-semibold tracking-wide',
          invalid && 'border-danger focus:border-danger focus:ring-danger/20',
        )}
      />
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
        {currency}
      </span>
    </div>
  )
}

export function IconPick({
  value,
  onChange,
  names,
}: {
  value: string
  onChange: (v: string) => void
  names: string[]
}): JSX.Element {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {names.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            'tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            value === n ? 'border-brand bg-brandsoft text-brand' : 'border-border bg-card text-muted',
          )}
          aria-label={n}
        >
          <Icon name={n} size={18} />
        </button>
      ))}
    </div>
  )
}

export function ColorPick({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const colors = ['#0d9488', '#2563eb', '#8b5cf6', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#c026d3', '#64748b']
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn(
            'tap h-8 w-8 rounded-full border-2',
            value === c ? 'border-ink scale-110' : 'border-transparent',
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}
