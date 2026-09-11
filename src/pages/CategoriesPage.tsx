import { useState, type JSX } from 'react'
import { useDataBundle } from '@/hooks/useLiveData'
import { db } from '@/database/db'
import { activityRepo } from '@/repositories/activity.repo'
import { Card, Button, IconButton } from '@/components/ui/primitives'
import { ConfirmDialog, Sheet } from '@/components/ui/overlays'
import { ColorPick, Field, IconPick, TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'
import { ICON_NAMES } from '@/components/ui/iconSet'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import { newId } from '@/utils/ids'
import { nowISO } from '@/utils/date'
import type { Category } from '@/types'

export default function CategoriesPage(): JSX.Element {
  const bundle = useDataBundle()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('tag')
  const [color, setColor] = useState('#0d9488')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const counts = new Map<string, number>()
  for (const o of bundle.obligations) {
    if (o.categoryId) counts.set(o.categoryId, (counts.get(o.categoryId) ?? 0) + 1)
  }

  const openNew = (): void => {
    setEditing(null)
    setName('')
    setIcon('tag')
    setColor('#0d9488')
    setOpen(true)
  }
  const openEdit = (c: Category): void => {
    setEditing(c)
    setName(c.name)
    setIcon(c.icon)
    setColor(c.color)
    setOpen(true)
  }

  const save = async (): Promise<void> => {
    if (!name.trim()) {
      showToast('اسم التصنيف مطلوب', 'danger')
      return
    }
    if (editing) {
      await db.categories.put({ ...editing, name: name.trim(), icon, color })
      await activityRepo.log('update', 'category', `عدّل تصنيف «${name.trim()}»`, editing.id, {})
    } else {
      await db.categories.put({ id: newId(), name: name.trim(), icon, color, isSystem: false, createdAt: nowISO(), deletedAt: null })
      await activityRepo.log('create', 'category', `أضاف تصنيف «${name.trim()}»`, null, {})
    }
    notifyDataChanged()
    setOpen(false)
    showToast('تم الحفظ', 'success')
  }

  const remove = async (c: Category): Promise<void> => {
    await db.categories.put({ ...c, deletedAt: nowISO() })
    // unlink obligations
    const linked = bundle.obligations.filter((o) => o.categoryId === c.id)
    for (const o of linked) await db.obligations.put({ ...o, categoryId: null })
    await activityRepo.log('delete', 'category', `حذف تصنيف «${c.name}»`, c.id, {})
    notifyDataChanged()
    showToast('تم حذف التصنيف', 'info', {
      actionLabel: 'تراجع',
      durationMs: 8000,
      onAction: async () => {
        await db.categories.put({ ...c, deletedAt: null })
        for (const o of linked) await db.obligations.put({ ...o, categoryId: c.id })
        notifyDataChanged()
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-extrabold">التصنيفات</h1>
        <Button size="sm" icon="plus" onClick={openNew}>
          تصنيف جديد
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {bundle.categories.map((c) => (
          <Card key={c.id} className="flex items-center gap-2 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${c.color}22`, color: c.color }}>
              <Icon name={c.icon} size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold">{c.name}</span>
              <span className="block text-[10px] text-muted">{counts.get(c.id) ?? 0} التزام</span>
            </span>
            <span className="flex flex-col">
              <IconButton icon="edit" label="تعديل" size={14} className="h-7 w-7" onClick={() => openEdit(c)} />
              {c.isSystem ? null : <IconButton icon="trash" label="حذف" size={14} className="h-7 w-7 text-danger" onClick={() => setConfirmId(c.id)} />}
            </span>
          </Card>
        ))}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل التصنيف' : 'تصنيف جديد'}
        footer={
          <Button className="w-full" onClick={() => void save()}>
            حفظ
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="الاسم" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="الأيقونة">
            <IconPick value={icon} onChange={setIcon} names={ICON_NAMES.slice(0, 40)} />
          </Field>
          <Field label="اللون">
            <ColorPick value={color} onChange={setColor} />
          </Field>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!confirmId}
        title="حذف التصنيف"
        message="سيُحذف التصنيف وتصبح التزاماته بدون تصنيف. يمكنك التراجع خلال 8 ثوانٍ."
        danger
        confirmLabel="حذف"
        onClose={() => setConfirmId(null)}
        onConfirm={async () => {
          const c = bundle.categories.find((x) => x.id === confirmId)
          if (c) await remove(c)
          setConfirmId(null)
        }}
      />
    </div>
  )
}
