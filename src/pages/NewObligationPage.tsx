import type { JSX } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useDataBundle } from '@/hooks/useLiveData'
import { ObligationForm, type QuickKind } from '@/components/obligations/ObligationForm'
import { Button } from '@/components/ui/primitives'

export default function NewObligationPage(): JSX.Element {
  const [params] = useSearchParams()
  const { id } = useParams()
  const bundle = useDataBundle()
  const kind = (params.get('kind') as QuickKind) ?? 'new'
  const existing = id ? bundle.obligations.find((o) => o.id === id) : undefined

  // وضع التعديل: لا نرسم نموذجًا فارغًا قبل وصول البيانات — وإلا يبدو كالتزام جديد
  if (id && !bundle.ready) {
    return (
      <div className="px-1 py-6 text-center text-sm font-bold text-muted" role="status">
        جارٍ تحميل الالتزام…
      </div>
    )
  }
  if (id && !existing) {
    return (
      <div className="px-1 py-6 text-center">
        <p className="text-sm font-extrabold">لم أجد هذا الالتزام</p>
        <p className="mt-1 text-xs text-muted">ربما حُذف، أو فُتح من رابط قديم.</p>
        <a href="#/obligations" className="mt-3 inline-block">
          <Button size="sm" variant="outline">
            رجوع إلى الالتزامات
          </Button>
        </a>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-3 px-1 text-base font-extrabold">{existing ? 'تعديل الالتزام' : 'إضافة التزام'}</h1>
      <ObligationForm
        key={existing ? `edit:${existing.id}` : `new:${kind}`}
        kind={kind}
        existing={existing}
        categories={bundle.categories}
        persons={bundle.persons}
      />
    </div>
  )
}
