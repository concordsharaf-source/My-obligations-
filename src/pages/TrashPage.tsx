import type { JSX } from 'react'
import { useTrash } from '@/hooks/useLiveData'
import { db } from '@/database/db'
import { obligationsService } from '@/services/obligations.service'
import { personsService } from '@/services/persons.service'
import { Button, Card, EmptyState } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import { formatDateTime } from '@/utils/date'
import type { Category } from '@/types'

export default function TrashPage(): JSX.Element {
  const items = useTrash()

  const restore = async (id: string, kind: string): Promise<void> => {
    const realId = id.replace('trash-', '')
    if (kind === 'obligation') await obligationsService.restore(realId)
    else if (kind === 'person') await personsService.restore(realId)
    else if (kind === 'category') {
      const item = await db.trash.get(id)
      if (item) {
        const payload = item.payload as { category?: Category }
        if (payload.category) await db.categories.put({ ...payload.category, deletedAt: null })
        await db.trash.delete(id)
      }
    } else if (kind === 'payment') {
      const item = await db.trash.get(id)
      if (item) {
        const payload = item.payload as { payment?: { id: string } }
        // payments are restored with their obligation restore; standalone purge only
        void payload
      }
    }
    notifyDataChanged()
    showToast('تم الاسترجاع', 'success')
  }

  const purge = async (id: string, kind: string): Promise<void> => {
    if (kind === 'obligation') await obligationsService.purge(id.replace('trash-', ''))
    else await db.trash.delete(id)
    notifyDataChanged()
    showToast('تم الحذف نهائيًا', 'info')
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="px-1 text-base font-extrabold">سلة المحذوفات</h1>
      <p className="px-1 text-[11px] text-muted">تُحفظ العناصر 30 يومًا ثم تُحذف تلقائيًا.</p>
      {!items ? (
        <div className="p-6 text-center text-sm text-muted">جارٍ التحميل…</div>
      ) : items.length === 0 ? (
        <EmptyState icon="trash" title="السلة فارغة" />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((t) => (
            <Card key={t.id} className="flex items-center gap-2 p-3">
              <Icon name={t.kind === 'person' ? 'user' : t.kind === 'category' ? 'tag' : 'list'} size={17} className="text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">{t.label}</span>
                <span className="block text-[10px] text-muted">حُذف {formatDateTime(t.deletedAt)}</span>
              </span>
              <Button size="sm" variant="soft" icon="undo" onClick={() => void restore(t.id, t.kind)}>
                استرجاع
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => void purge(t.id, t.kind)}>
                حذف نهائي
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
