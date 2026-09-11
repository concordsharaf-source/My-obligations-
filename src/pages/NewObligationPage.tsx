import type { JSX } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useDataBundle } from '@/hooks/useLiveData'
import { ObligationForm, type QuickKind } from '@/components/obligations/ObligationForm'

export default function NewObligationPage(): JSX.Element {
  const [params] = useSearchParams()
  const { id } = useParams()
  const bundle = useDataBundle()
  const kind = (params.get('kind') as QuickKind) ?? 'new'
  const existing = id ? bundle.obligations.find((o) => o.id === id) : undefined

  return (
    <div>
      <h1 className="mb-3 px-1 text-base font-extrabold">{existing ? 'تعديل الالتزام' : 'إضافة التزام'}</h1>
      <ObligationForm kind={kind} existing={existing} categories={bundle.categories} persons={bundle.persons} />
    </div>
  )
}
