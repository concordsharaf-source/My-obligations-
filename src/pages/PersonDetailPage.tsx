import { useEffect, useMemo, useState, type JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDataBundle } from '@/hooks/useLiveData'
import { useSettings } from '@/store/settings.store'
import { computePersonBalance, personsService } from '@/services/persons.service'
import { openPrintReport } from '@/services/print.service'
import { shareText } from '@/services/sharing.service'
import { Badge, Button, Card, EmptyState, IconButton, SectionTitle } from '@/components/ui/primitives'
import { Sheet } from '@/components/ui/overlays'
import { Field, TextArea, TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import { formatDateShort, relativeDay, todayISO } from '@/utils/date'
import { formatAmount, formatAmountCompact } from '@/utils/money'

export default function PersonDetailPage(): JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const bundle = useDataBundle()
  const settings = useSettings()
  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  const person = bundle.persons.find((p) => p.id === id)
  const balance = useMemo(
    () => (person ? computePersonBalance(person, bundle.obligations, bundle.payments) : null),
    [person, bundle.obligations, bundle.payments],
  )

  useEffect(() => {
    if (person) {
      setName(person.name)
      setPhone(person.phone)
      setNotes(person.notes)
    }
  }, [person])

  if (!person || !balance) {
    return <EmptyState icon="user" title="الشخص غير موجود" actionLabel="رجوع" onAction={() => navigate('/people')} />
  }

  const doShare = async (): Promise<void> => {
    const text = [
      `سجل: ${person.name}`,
      `ديون له (عليّ): ${formatAmount(balance.oweRemaining, settings.currency)}`,
      `ديون عليه (لي): ${formatAmount(balance.owedRemaining, settings.currency)}`,
      `الرصيد: ${formatAmount(Math.abs(balance.net), settings.currency)} ${balance.net >= 0 ? 'لك' : 'عليك'}`,
    ].join('\n')
    const res = await shareText('التزاماتي', text)
    showToast(res === 'shared' ? 'تمت المشاركة' : res === 'copied' ? 'تم نسخ النص' : 'تعذرت المشاركة', res === 'failed' ? 'danger' : 'success')
  }

  const save = async (): Promise<void> => {
    if (!name.trim()) {
      showToast('الاسم مطلوب', 'danger')
      return
    }
    await personsService.update(person.id, { name: name.trim(), phone, notes })
    notifyDataChanged()
    setEditOpen(false)
    showToast('تم الحفظ', 'success')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brandsoft text-lg font-extrabold text-brand">
          {person.name.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold">{person.name}</h1>
          {person.phone ? (
            <a dir="ltr" href={`tel:${person.phone}`} className="tap inline-flex items-center gap-1 text-[11px] font-bold text-brand">
              <Icon name="phone" size={12} />
              {person.phone}
            </a>
          ) : (
            <div className="text-[11px] text-muted">بدون هاتف</div>
          )}
        </div>
        <IconButton icon="share" label="مشاركة" onClick={() => void doShare()} />
        <IconButton icon="printer" label="طباعة الكشف" onClick={() => openPrintReport('person', person.id)} />
        <IconButton icon="edit" label="تعديل" onClick={() => setEditOpen(true)} />
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-muted">ديون له (عليّ)</div>
          <div className="mt-1 text-sm font-extrabold text-danger">{formatAmountCompact(balance.oweRemaining, settings.currency)}</div>
          <div className="text-[9px] text-muted">من {formatAmountCompact(balance.oweTotal, settings.currency)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-muted">ديون عليه (لي)</div>
          <div className="mt-1 text-sm font-extrabold text-ok">{formatAmountCompact(balance.owedRemaining, settings.currency)}</div>
          <div className="text-[9px] text-muted">من {formatAmountCompact(balance.owedTotal, settings.currency)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] font-bold text-muted">الرصيد</div>
          <div className={`mt-1 text-sm font-extrabold ${balance.net > 0 ? 'text-ok' : balance.net < 0 ? 'text-danger' : 'text-muted'}`}>
            {formatAmountCompact(Math.abs(balance.net), settings.currency)}
          </div>
          <div className="text-[9px] text-muted">{balance.net > 0 ? 'لك' : balance.net < 0 ? 'عليك' : 'متعادل'}</div>
        </Card>
      </div>

      <div>
        <SectionTitle
          action={
            <Button size="sm" icon="plus" onClick={() => navigate('/new')}>
              التزام
            </Button>
          }
        >
          الالتزامات المرتبطة ({balance.obligations.length})
        </SectionTitle>
        {balance.obligations.length === 0 ? (
          <EmptyState icon="list" title="لا التزامات مرتبطة" actionLabel="أضف التزامًا" onAction={() => navigate('/new')} />
        ) : (
          <div className="flex flex-col gap-2">
            {balance.obligations.map((o) => {
              const paid = balance.payments.filter((p) => p.obligationId === o.id).reduce((s, p) => s + p.amount, 0)
              return (
                <Card key={o.id} className="tap flex items-center gap-2 p-3" onClick={() => navigate(`/obligation/${o.id}`)}>
                  <Badge tone={o.direction === 'owe' ? 'danger' : o.direction === 'owed' ? 'ok' : 'neutral'}>
                    {o.direction === 'owe' ? 'عليّ' : o.direction === 'owed' ? 'لي' : 'غير مالي'}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{o.title}</span>
                  <span className="text-[10px] font-semibold text-muted">{relativeDay(o.dueDate, todayISO())}</span>
                  {o.financial ? (
                    <span className="text-[11px] font-extrabold">{formatAmountCompact(Math.max(0, o.amount - paid), o.currency)}</span>
                  ) : null}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <SectionTitle>الدفعات ({balance.payments.length})</SectionTitle>
        {balance.payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted">لا دفعات مسجلة</div>
        ) : (
          <Card className="flex flex-col gap-2 p-3">
            {[...balance.payments]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[11px] font-semibold">
                  <span>
                    {formatDateShort(p.date)} — {balance.obligations.find((o) => o.id === p.obligationId)?.title ?? ''}
                  </span>
                  <span className="font-extrabold text-ok">{formatAmount(p.amount, settings.currency)}</span>
                </div>
              ))}
          </Card>
        )}
      </div>

      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="تعديل الشخص"
        footer={
          <Button className="w-full" onClick={() => void save()}>
            حفظ التعديلات
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="الاسم" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="الهاتف">
            <TextInput dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="ملاحظات">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </div>
  )
}
