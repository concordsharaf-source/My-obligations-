import { useMemo, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataBundle } from '@/hooks/useLiveData'
import { computePersonBalance, personsService } from '@/services/persons.service'
import { Card, EmptyState, Button, IconButton } from '@/components/ui/primitives'
import { Sheet, ConfirmDialog } from '@/components/ui/overlays'
import { Field, TextArea, TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import { useSettings } from '@/store/settings.store'
import { formatAmountCompact } from '@/utils/money'

export default function PeoplePage(): JSX.Element {
  const navigate = useNavigate()
  const bundle = useDataBundle()
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const balances = useMemo(
    () => bundle.persons.map((p) => computePersonBalance(p, bundle.obligations, bundle.payments)),
    [bundle],
  )

  const add = async (): Promise<void> => {
    if (!name.trim()) {
      showToast('الاسم مطلوب', 'danger')
      return
    }
    const person = await personsService.create({ name: name.trim(), phone, notes })
    notifyDataChanged()
    setOpen(false)
    setName('')
    setPhone('')
    setNotes('')
    showToast('تمت إضافة الشخص', 'success')
    navigate(`/person/${person.id}`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-extrabold">الأشخاص</h1>
        <Button size="sm" icon="plus" onClick={() => setOpen(true)}>
          شخص جديد
        </Button>
      </div>

      {balances.length === 0 ? (
        <EmptyState icon="users" title="لا أشخاص بعد" hint="أضف الأشخاص المرتبطين بديونك والتزاماتك." actionLabel="أضف شخصًا" onAction={() => setOpen(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {balances.map((b) => (
            <Card key={b.person.id} className="tap flex items-center gap-3 p-3" onClick={() => navigate(`/person/${b.person.id}`)}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brandsoft text-sm font-extrabold text-brand">
                {b.person.name.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{b.person.name}</div>
                <div className="text-[11px] text-muted">
                  له {formatAmountCompact(b.oweRemaining, settings.currency)} · عليه {formatAmountCompact(b.owedRemaining, settings.currency)}
                </div>
              </div>
              <div className={`text-xs font-extrabold ${b.net > 0 ? 'text-ok' : b.net < 0 ? 'text-danger' : 'text-muted'}`}>
                {b.net === 0 ? 'متعادل' : formatAmountCompact(Math.abs(b.net), settings.currency)}
                <div className="text-[9px] font-semibold text-muted">{b.net > 0 ? 'لك' : b.net < 0 ? 'عليك' : ''}</div>
              </div>
              <IconButton icon="trash" label="حذف" className="text-danger" onClick={() => setConfirmId(b.person.id)} />
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="شخص جديد"
        footer={
          <Button className="w-full" onClick={() => void add()}>
            حفظ
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="الاسم" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="رقم الهاتف">
            <TextInput dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="ملاحظات">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!confirmId}
        title="حذف الشخص"
        message="سينتقل إلى سلة المحذوفات. التزاماته تبقى لكن بدون ربط بالشخص."
        danger
        confirmLabel="حذف"
        onClose={() => setConfirmId(null)}
        onConfirm={async () => {
          if (confirmId) {
            await personsService.softDelete(confirmId)
            notifyDataChanged()
            showToast('تم حذف الشخص', 'info', {
              actionLabel: 'تراجع',
              durationMs: 8000,
              onAction: async () => {
                await personsService.restore(confirmId)
                notifyDataChanged()
              },
            })
          }
          setConfirmId(null)
        }}
      />
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted">
        <Icon name="info" size={11} />
        الرصيد = ما لك ناقص ما عليك
      </div>
    </div>
  )
}
