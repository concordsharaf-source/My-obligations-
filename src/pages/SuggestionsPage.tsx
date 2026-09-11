import { useMemo, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBudgetContext } from '@/hooks/useLiveData'
import { buildSuggestions } from '@/services/suggestions.service'
import { Card, EmptyState } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

const TONES = {
  danger: 'bg-dangersoft text-danger',
  warning: 'bg-warnsoft text-warn',
  info: 'bg-infosoft text-info',
  success: 'bg-oksoft text-ok',
} as const

export default function SuggestionsPage(): JSX.Element {
  const navigate = useNavigate()
  const { ctx } = useBudgetContext()
  const suggestions = useMemo(() => (ctx ? buildSuggestions(ctx) : []), [ctx])

  return (
    <div className="flex flex-col gap-3">
      <h1 className="px-1 text-base font-extrabold">اقتراحات التزاماتي</h1>
      <p className="px-1 text-[11px] text-muted">تحليل محلي فوري لبياناتك — بدون أي خدمة خارجية.</p>
      {suggestions.length === 0 ? (
        <EmptyState icon="sparkle" title="لا اقتراحات حاليًا" hint="وضعك منتظم — سننبهك فور وجود ما يستحق الانتباه." />
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <Card key={s.id} className="tap flex items-start gap-3 p-3" onClick={() => navigate(s.to)}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[s.severity]}`}>
                <Icon name={s.severity === 'danger' ? 'alert-triangle' : s.severity === 'warning' ? 'alert-circle' : s.severity === 'success' ? 'check-circle' : 'bulb'} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold">{s.title}</span>
                <span className="mt-0.5 block text-[11px] leading-5 text-muted">{s.detail}</span>
              </span>
              <Icon name="chevron-left" size={14} className="mt-2 text-muted" />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
