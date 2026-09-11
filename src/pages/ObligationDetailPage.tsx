import { useEffect, useMemo, useState, type JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDataBundle } from '@/hooks/useLiveData'
import { useNow } from '@/hooks/useNow'
import { obligationsService } from '@/services/obligations.service'
import { attachmentsRepo } from '@/repositories/attachments.repo'
import { paymentAttribution } from '@/services/instances'
import { describeRecurrence, nextOccurrence } from '@/services/recurrence'
import { buildDebtShareText, shareText } from '@/services/sharing.service'
import { Badge, Button, Card, EmptyState, IconButton, Progress, SectionTitle } from '@/components/ui/primitives'
import { ConfirmDialog, Sheet } from '@/components/ui/overlays'
import { AmountInput, Field, TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import { addDays, formatDate, formatDateShort, formatTime, nowISO, todayISO } from '@/utils/date'
import { currencySymbol, formatAmount, formatAmountCompact, round2 } from '@/utils/money'
import { newId } from '@/utils/ids'

const PRIORITY_LABELS = { low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة' } as const

export default function ObligationDetailPage(): JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const bundle = useDataBundle()
  const now = useNow(30_000)
  const [payOpen, setPayOpen] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [reschedOpen, setReschedOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmPayment, setConfirmPayment] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [payNote, setPayNote] = useState('')
  const [newDate, setNewDate] = useState(todayISO())
  const [newTime, setNewTime] = useState('')
  const [scope, setScope] = useState<'this' | 'future'>('this')
  const [customSnooze, setCustomSnooze] = useState('')

  const ob = bundle.obligations.find((o) => o.id === id)
  const payments = useMemo(() => bundle.payments.filter((p) => p.obligationId === id), [bundle.payments, id])

  if (!ob) {
    return <EmptyState icon="alert-circle" title="الالتزام غير موجود" actionLabel="رجوع" onAction={() => navigate('/obligations')} />
  }

  const person = bundle.persons.find((p) => p.id === ob.personId)
  const category = bundle.categories.find((c) => c.id === ob.categoryId)
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0))
  const remaining = round2(Math.max(0, ob.amount - paid))
  const map = paymentAttribution(ob, bundle.payments)
  void map
  const isOverdue = ob.status === 'active' && ob.dueDate < todayISO() && (!ob.financial || remaining > 0)
  const nextDates: string[] = []
  if (ob.recurrence.type !== 'none') {
    let cur = ob.dueDate
    let guard = 0
    while (nextDates.length < 5 && guard < 500) {
      const n = nextOccurrence(ob.recurrence, cur, todayISO())
      if (!n) break
      nextDates.push(n)
      cur = n
      guard++
    }
  }

  const complete = async (baseDate: string): Promise<void> => {
    await obligationsService.completeInstance(ob.id, baseDate)
    notifyDataChanged()
    showToast('تم إكمال الالتزام 🎉', 'success')
  }

  const snoozeUntil = (iso: string): void => {
    void obligationsService.snoozeInstance(ob.id, ob.dueDate, iso).then(() => {
      notifyDataChanged()
      showToast('تم تأجيل التنبيه', 'info')
      setSnoozeOpen(false)
    })
  }

  const doShare = async (): Promise<void> => {
    const text = buildDebtShareText({
      title: ob.title,
      amount: ob.amount,
      remaining,
      dueDate: formatDateShort(ob.dueDate),
      currencyLabel: currencySymbol(ob.currency),
      direction: ob.direction === 'owed' ? 'owed' : 'owe',
      personName: person?.name,
    })
    const res = await shareText('التزاماتي', text)
    showToast(res === 'shared' ? 'تمت المشاركة' : res === 'copied' ? 'تم نسخ النص للحافظة' : 'تعذرت المشاركة', res === 'failed' ? 'danger' : 'success')
  }

  const doDelete = async (): Promise<void> => {
    setConfirmDelete(false)
    await obligationsService.softDelete(ob.id)
    notifyDataChanged()
    showToast('تم حذف الالتزام', 'info', {
      actionLabel: 'تراجع',
      durationMs: 8000,
      onAction: async () => {
        await obligationsService.restore(ob.id)
        notifyDataChanged()
        showToast('تم الاسترجاع', 'success')
      },
    })
    navigate('/obligations')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold">{ob.title}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {category ? (
              <Badge tone="brand">
                <span className="inline-flex items-center gap-1">
                  <Icon name={category.icon} size={11} />
                  {category.name}
                </span>
              </Badge>
            ) : null}
            <Badge tone={ob.direction === 'owe' ? 'danger' : ob.direction === 'owed' ? 'ok' : 'neutral'}>
              {ob.direction === 'owe' ? 'عليّ' : ob.direction === 'owed' ? 'لي' : 'غير مالي'}
            </Badge>
            <Badge tone={isOverdue ? 'danger' : 'neutral'}>{isOverdue ? 'متأخر' : formatDateShort(ob.dueDate)}</Badge>
            <Badge tone="neutral">{PRIORITY_LABELS[ob.priority]}</Badge>
            {ob.recurrence.type !== 'none' ? <Badge tone="info" icon="repeat">{describeRecurrence(ob.recurrence)}</Badge> : null}
            {ob.status === 'archived' ? <Badge tone="warn" icon="archive">مؤرشف</Badge> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton icon="edit" label="تعديل" onClick={() => navigate(`/edit/${ob.id}`)} />
          <IconButton icon="share" label="مشاركة" onClick={() => void doShare()} />
          <IconButton icon="trash" label="حذف" className="text-danger" onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      {ob.financial ? (
        <Card className="p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] font-bold text-muted">المبلغ</div>
              <div className={`text-2xl font-extrabold ${ob.direction === 'owe' ? 'text-danger' : 'text-ok'}`}>
                {formatAmount(ob.amount, ob.currency)}
              </div>
            </div>
            <div className="text-end text-[11px] font-semibold text-muted">
              <div>
                المدفوع: <span className="font-extrabold text-ok">{formatAmountCompact(paid, ob.currency)}</span>
              </div>
              <div>
                المتبقي: <span className="font-extrabold text-ink">{formatAmountCompact(remaining, ob.currency)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={ob.amount > 0 ? (paid / ob.amount) * 100 : 0} tone={remaining <= 0 ? 'ok' : 'brand'} />
          </div>
          {remaining <= 0 ? <div className="mt-2 text-center text-xs font-extrabold text-ok">تم السداد ✓</div> : null}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2 p-4 text-xs">
        <div className="flex items-center gap-2">
          <Icon name="calendar-clock" size={15} className="text-muted" />
          <span className="font-bold">{formatDate(ob.dueDate)}</span>
          {ob.dueTime ? <Badge tone="neutral">{formatTime(ob.dueTime)}</Badge> : null}
        </div>
        {person ? (
          <div className="flex items-center gap-2">
            <Icon name="user" size={15} className="text-muted" />
            <button type="button" className="tap font-bold text-brand underline-offset-4" onClick={() => navigate(`/person/${person.id}`)}>
              {person.name}
            </button>
            {person.phone ? (
              <a dir="ltr" href={`tel:${person.phone}`} className="tap ms-auto rounded-lg bg-card2 px-2 py-1 text-[10px] font-bold">
                {person.phone}
              </a>
            ) : null}
          </div>
        ) : null}
        {ob.notes ? (
          <div className="flex items-start gap-2">
            <Icon name="note" size={15} className="mt-0.5 shrink-0 text-muted" />
            <span className="whitespace-pre-wrap leading-5 text-muted">{ob.notes}</span>
          </div>
        ) : null}
      </Card>

      {/* actions */}
      <div className="grid grid-cols-4 gap-2">
        <Button variant="soft" icon="check" onClick={() => void complete(ob.dueDate)}>
          إكمال
        </Button>
        <Button variant="outline" icon="alarm" onClick={() => setSnoozeOpen(true)}>
          تأجيل
        </Button>
        <Button variant="outline" icon="calendar" onClick={() => { setNewDate(ob.dueDate); setNewTime(ob.dueTime ?? ''); setReschedOpen(true) }}>
          الموعد
        </Button>
        <Button
          variant="outline"
          icon={ob.status === 'archived' ? 'undo' : 'archive'}
          onClick={() => {
            void obligationsService.archive(ob.id, ob.status !== 'archived').then(() => {
              notifyDataChanged()
              showToast(ob.status === 'archived' ? 'أُخرج من الأرشيف' : 'تمت الأرشفة', 'info')
            })
          }}
        >
          {ob.status === 'archived' ? 'استرجاع' : 'أرشفة'}
        </Button>
      </div>

      {/* payments */}
      {ob.financial ? (
        <div>
          <SectionTitle
            action={
              <Button size="sm" icon="plus" onClick={() => setPayOpen(true)}>
                دفعة
              </Button>
            }
          >
            الدفعات ({payments.length})
          </SectionTitle>
          {payments.length === 0 ? (
            <EmptyState icon="coins" title="لا دفعات بعد" hint="سجّل دفعات جزئية وسيُحدَّث المتبقي تلقائيًا." />
          ) : (
            <div className="flex flex-col gap-2">
              {[...payments]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((p) => (
                  <Card key={p.id} className="flex items-center gap-2 p-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-oksoft text-ok">
                      <Icon name="check-circle" size={15} />
                    </span>
                    <div className="flex-1">
                      <div className="text-xs font-extrabold">{formatAmount(p.amount, ob.currency)}</div>
                      <div className="text-[10px] text-muted">
                        {formatDateShort(p.date)}
                        {p.note ? ` — ${p.note}` : ''}
                      </div>
                    </div>
                    <IconButton icon="trash" label="حذف الدفعة" className="text-danger" onClick={() => setConfirmPayment(p.id)} />
                  </Card>
                ))}
            </div>
          )}
        </div>
      ) : null}

      {/* next occurrences */}
      {nextDates.length ? (
        <div>
          <SectionTitle>المواعيد القادمة</SectionTitle>
          <Card className="flex flex-col gap-1.5 p-3">
            {nextDates.map((d) => (
              <div key={d} className="flex items-center justify-between text-[11px] font-semibold">
                <span>{formatDate(d)}</span>
                <span className="text-muted">{formatDateShort(d)}</span>
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      {/* attachments */}
      <div>
        <SectionTitle
          action={
            <label className="tap cursor-pointer rounded-xl bg-brandsoft px-2.5 py-1.5 text-[11px] font-bold text-brand">
              إرفاق ملف
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    await attachmentsRepo.add({
                      id: newId(),
                      obligationId: ob.id,
                      name: file.name,
                      type: file.type,
                      size: file.size,
                      blob: file,
                      createdAt: nowISO(),
                    })
                    notifyDataChanged()
                    showToast('تم إرفاق الملف', 'success')
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'تعذر الإرفاق', 'danger')
                  }
                  e.target.value = ''
                }}
              />
            </label>
          }
        >
          المرفقات
        </SectionTitle>
        <AttachmentsList obligationId={ob.id} />
      </div>

      {/* payment sheet */}
      <Sheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="تسجيل دفعة"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              const amount = Number(payAmount.replace(/[^\d.]/g, ''))
              if (!(amount > 0)) {
                showToast('أدخل مبلغًا صحيحًا', 'danger')
                return
              }
              void obligationsService.addPayment({ obligationId: ob.id, amount, date: payDate, note: payNote }).then(() => {
                notifyDataChanged()
                setPayOpen(false)
                setPayAmount('')
                setPayNote('')
                showToast('تم تسجيل الدفعة', 'success')
              })
            }}
          >
            حفظ الدفعة
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="المبلغ" hint={`المتبقي الحالي: ${formatAmount(remaining, ob.currency)}`}>
            <AmountInput value={payAmount} onValue={setPayAmount} currency={ob.currency} />
          </Field>
          <Field label="التاريخ">
            <TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </Field>
          <Field label="ملاحظة (اختياري)">
            <TextInput value={payNote} onChange={(e) => setPayNote(e.target.value)} />
          </Field>
        </div>
      </Sheet>

      {/* snooze sheet */}
      <Sheet open={snoozeOpen} onClose={() => setSnoozeOpen(false)} title="تأجيل التنبيه">
        <div className="flex flex-col gap-2">
          {[
            { label: '10 دقائق', iso: new Date(now.getTime() + 10 * 60000).toISOString() },
            { label: 'ساعة', iso: new Date(now.getTime() + 60 * 60000).toISOString() },
            { label: 'هذا المساء (8:00 م)', iso: eveningISO() },
            { label: 'غدًا (9:00 ص)', iso: `${addDays(todayISO(), 1)}T09:00:00` },
          ].map((o) => (
            <Button key={o.label} variant="outline" icon="alarm" onClick={() => snoozeUntil(o.iso)}>
              {o.label}
            </Button>
          ))}
          <Field label="موعد مخصص">
            <TextInput type="datetime-local" value={customSnooze} onChange={(e) => setCustomSnooze(e.target.value)} />
          </Field>
          <Button disabled={!customSnooze} onClick={() => snoozeUntil(new Date(customSnooze).toISOString())}>
            تأجيل إلى الموعد المحدد
          </Button>
        </div>
      </Sheet>

      {/* reschedule sheet */}
      <Sheet
        open={reschedOpen}
        onClose={() => setReschedOpen(false)}
        title="تغيير الموعد"
        footer={
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                void (scope === 'this'
                  ? obligationsService.rescheduleThis(ob.id, ob.dueDate, newDate, newTime || null)
                  : obligationsService.splitFuture(ob.id, ob.dueDate, { dueDate: newDate, dueTime: newTime || null })
                ).then(() => {
                  notifyDataChanged()
                  setReschedOpen(false)
                  showToast('تم تغيير الموعد', 'success')
                })
              }}
            >
              حفظ
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex rounded-xl bg-card2 p-1">
            {(['this', 'future'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${scope === s ? 'bg-card shadow-sm' : 'text-muted'}`}
              >
                {s === 'this' ? 'هذه المرة فقط' : 'هذا والمستقبل'}
              </button>
            ))}
          </div>
          <Field label="التاريخ الجديد">
            <TextInput type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </Field>
          <Field label="الوقت (اختياري)">
            <TextInput type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          </Field>
          {ob.recurrence.type !== 'none' ? (
            <Button
              variant="danger"
              icon="x"
              onClick={() => {
                void obligationsService.stopRecurrence(ob.id, ob.dueDate).then(() => {
                  notifyDataChanged()
                  setReschedOpen(false)
                  showToast('تم إلغاء التكرار', 'info')
                })
              }}
            >
              إلغاء التكرار نهائيًا
            </Button>
          ) : null}
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف الالتزام"
        message="سينتقل الالتزام إلى سلة المحذوفات ويمكنك التراجع خلال 8 ثوانٍ أو من السلة لاحقًا."
        danger
        confirmLabel="حذف"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void doDelete()}
      />
      <ConfirmDialog
        open={!!confirmPayment}
        title="حذف الدفعة"
        message="سيُعاد احتساب المتبقي، وقد يُعاد فتح الالتزام إن لم يعد مسددًا بالكامل."
        danger
        confirmLabel="حذف"
        onClose={() => setConfirmPayment(null)}
        onConfirm={async () => {
          if (confirmPayment) {
            await obligationsService.deletePayment(confirmPayment)
            notifyDataChanged()
            showToast('تم حذف الدفعة', 'info')
          }
          setConfirmPayment(null)
        }}
      />
    </div>
  )
}

function eveningISO(): string {
  const d = new Date()
  d.setHours(20, 0, 0, 0)
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

function AttachmentsList({ obligationId }: { obligationId: string }): JSX.Element {
  const [items, setItems] = useState<{ id: string; name: string; size: number; type: string; url: string }[]>([])
  useEffect(() => {
    let alive = true
    void attachmentsRepo.byObligation(obligationId).then((atts) => {
      if (!alive) return
      setItems(atts.map((a) => ({ id: a.id, name: a.name, size: a.size, type: a.type, url: URL.createObjectURL(a.blob) })))
    })
    return () => {
      alive = false
    }
  }, [obligationId])
  if (items.length === 0) return <div className="text-[11px] text-muted">لا مرفقات</div>
  return (
    <div className="flex flex-col gap-2">
      {items.map((a) => (
        <Card key={a.id} className="flex items-center gap-2 p-2.5">
          <Icon name="file-json" size={16} className="text-muted" />
          <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-xs font-bold text-brand underline-offset-4 hover:underline">
            {a.name}
          </a>
          <span className="text-[10px] text-muted">{Math.round(a.size / 1024)}KB</span>
          <IconButton
            icon="trash"
            label="حذف المرفق"
            className="text-danger"
            onClick={() => {
              void attachmentsRepo.remove(a.id).then(() => {
                notifyDataChanged()
                showToast('تم حذف المرفق', 'info')
              })
            }}
          />
        </Card>
      ))}
    </div>
  )
}
