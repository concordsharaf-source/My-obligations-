import type { JSX } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { Icon } from '@/components/ui/Icon'

const ITEMS = [
  { to: '/', icon: 'home', label: 'الرئيسية', end: true },
  { to: '/calendar', icon: 'calendar', label: 'التقويم', end: false },
  { to: '/obligations', icon: 'list', label: 'التزامات', end: false },
  { to: '/debts', icon: 'coins', label: 'الديون', end: false },
  { to: '/more', icon: 'more', label: 'المزيد', end: false },
]

export function BottomNav(): JSX.Element {
  return (
    <nav className="no-print safe-b fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'tap flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[10px] font-semibold',
                isActive ? 'text-brand' : 'text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('rounded-xl px-3 py-0.5', isActive && 'bg-brandsoft')}>
                  <Icon name={item.icon} size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
