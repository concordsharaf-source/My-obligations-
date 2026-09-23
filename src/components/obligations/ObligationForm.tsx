import { useMemo, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Category, Obligation, Person, Priority, RecurrenceType } from '@/types'
import { obligationsService } from '@/services/obligations.service'
import { personsService } from '@/services/persons.service'
import { RECURRENCE_LABELS } from '@/services/recurrence'
import { obligationSchema } from '@/models/schemas'
import { useSettings } from '@/store/settings.store'
import { showToast } from '@/store/ui.store'
import { notifyDataChanged } from '@/notifications/scheduler'
import { Button, Segmented } from '@/components/ui/primitives'
import { AmountInput, Field, Select, TextArea, TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'
import { newId } from '@/utils/ids'
import { todayISO } from '@/utils/date'
import { cn } from '@/utils/cn'

export type QuickKind = 'new' | 'owe' | 'owed' | 'bill' | 'installment' | 'appointment' | 'task' | 'recurring'

const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: 'قبل 5 دقائق' },
  { value: 15, label: 'قبل 15 دقيقة' },
  { value: 30, label: 'قبل 30 دقيقة' },
  { value: 60, label: 'قبل ساعة' },
  { value: 180, label: 'قبل 3 ساعات' },
  { value: 1440, label: 'قبل يوم' },
  { value: 2880, label: 'قبل يومين' },
  { value: 10080, label: 'قبل أسبوع' },
  { value: 0, label: 'وقت الاستحقاق' },
  { value: -60, label: 'بعد التأخر بساعة' },
]

interface FormState {
  title: string
  categoryId: string | null
  personId: string | null
  direction: 'owe' | 'owed' | 'none'
  amount: string
  currency: string
  dueDate: string
  dueTime: string
  recurrenceType: RecurrenceType
  interval: string
  recurrenceEnd: string
  priority: Priority
  notes: string
  reminders: number[]
  newPersonName: string
}

function presetFor(kind: QuickKind, categories: Category[], currency: string): FormState {
  const cat = (name: string): string | null => categories.find((c) => c.name === name)?.id ?? null
  const base: FormState = {
    title: '',
    categoryId: null,
    personId: null,
    direction: 'none',
    amount: '',
    currency,
    dueDate: todayISO(),
    dueTime: '',
    recurrenceType: 'none',
    interval: '1',
    recurrenceEnd: '',
    priority: 'normal',
    notes: '',
    reminders: [],
    newPersonName: '',
  }
  switch (kind) {
    case 'owe':
      return { ...base, direction: 'owe', categoryId: cat('مالي') }
    case 'owed':
      return { ...base, direction: 'owed', categoryId: cat('مالي') }
    case 'bill':
      return { ...base, direction: 'owe', categoryId: cat('فواتير'), recurrenceType: 'monthly' }
    case 'installment':
      return { ...base, direction: 'owe', categoryId: cat('أقساط'), recurrenceType: 'monthly' }
    case 'appointment':
      return { ...base, categoryId: cat('مواعيد') }
    case 'task':
      return { ...base, categoryId: cat('شخصي') }
    case 'recurring':
      return { ...base, direction: 'owe', recurrenceType: 'monthly', categoryId: cat('مالي') }
    default:
      return base
  }
}

/** حالة النموذج من التزام موجود (تعديل) أو من قالب الإضافة */
function buildInitialState(
  existing: Obligation | undefined,
  kind: QuickKind,
  categories: Category[],
  currency: string,
): FormState {
  if (!existing) return presetFor(kind, categories, currency)
  return {
    title: existing.title,
    categoryId: existing.categoryId,
    personId: existing.personId,
    direction: existing.direction,
    amount: existing.amount ? String(existing.amount) : '',
    currency: existing.currency,
    dueDate: existing.dueDate,
    dueTime: existing.dueTime ?? '',
    recurrenceType: existing.recurrence.type,
    interval: String(existing.recurrence.interval),
    recurrenceEnd: existing.recurrence.endDate ?? '',
    priority: existing.priority,
    notes: existing.notes,
    reminders: existing.reminders,
    newPersonName: '',
  }
}

export function ObligationForm({
  kind = 'new',
  existing,
  categories,
  persons,
  onDone,
}: {
  kind?: QuickKind
  existing?: Obligation
  categories: Category[]
  persons: Person[]
  onDone?: () => void
}): JSX.Element {
  const settings = useSettings()
  const navigate = useNavigate()
  const [state, setState] = useState<FormState>(() =>
    buildInitialState(existing, kind, categories, settings.currency),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  /*
   * إصلاح «التعديل يفتح بخانات فاضية»: بيانات Dexie تصل بعد أول رسم، فقيمة
   * useState الابتدائية تكون حُسبت و«existing» ما وصلت بعد (نموذج فارغ).
   * نتتبّع من أي سجل حُمّل النموذج، وإذا تغيّر المصدر (وصل الالتزام، أو انتقل
   * المستخدم من «جديد» إلى «تعديل») تُعاد تعبئة الخانات — أثناء الرسم نفسه فلا
   * وميض. الاعتماد على المعرّف وحده (لا updatedAt) حتى لا تضيع كتابات المستخدم
   * عند وصول تحديث حيّ من مصدر آخر.
   */
  const sourceKey = existing ? `edit:${existing.id}` : `new:${kind}`
  const [loadedKey, setLoadedKey] = useState(sourceKey)
  if (loadedKey !== sourceKey) {
    setLoadedKey(sourceKey)
    setState(buildInitialState(existing, kind, categories, settings.currency))
    setErrors({})
  }

  const set = (patch: Partial<FormState>): void => setState((s) => ({ ...s, ...patch }))
  const financial = state.direction !== 'none'

  const needsInterval = state.recurrenceType === 'every_n_days' || state.recurrenceType === 'every_n_months' || state.recurrenceType === 'custom'

  const submit = async (): Promise<void> => {
    const amountNum = financial ? Number(state.amount.replace(/[^\d.]/g, '')) : 0
    const payload = {
      title: state.title.trim(),
      notes: state.notes,
      categoryId: state.categoryId,
      personId: state.personId,
      direction: state.direction,
      financial,
      amount: financial ? amountNum : 0,
      currency: state.currency,
      dueDate: state.dueDate,
      dueTime: state.dueTime || null,
      recurrence: {
        type: state.recurrenceType,
        interval: Number(state.interval) || 1,
        endDate: state.recurrenceEnd || null,
      },
      priority: state.priority,
      status: existing?.status ?? ('active' as const),
      reminders: state.reminders,
    }
    const parsed = obligationSchema.safeParse({
      ...payload,
      id: existing?.id ?? newId(),
      overrides: existing?.overrides ?? {},
      createdAt: existing?.createdAt ?? '',
      updatedAt: '',
      completedAt: existing?.completedAt ?? null,
      archivedAt: existing?.archivedAt ?? null,
      deletedAt: null,
    })
    if (!parsed.success) {
      const map: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'general')
        map[key] ??= issue.message
      }
      setErrors(map)
      showToast('تحقق من الحقول المعلَّمة', 'danger')
      return
    }
    setSaving(true)
    try {
      let personId = payload.personId
      if (state.newPersonName.trim()) {
        const person = await personsService.create({ name: state.newPersonName.trim() })
        personId = person.id
      }
      if (existing) {
        await obligationsService.update(existing.id, { ...payload, personId })
        showToast('تم حفظ التعديلات', 'success')
      } else {
        await obligationsService.create({ ...payload, personId })
        showToast('تمت إضافة الالتزام', 'success')
      }
      notifyDataChanged()
      if (onDone) onDone()
      else navigate(-1)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'حدث خطأ', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const toggleReminder = (v: number): void =>
    set({ reminders: state.reminders.includes(v) ? state.reminders.filter((r) => r !== v) : [...state.reminders, v] })

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name, 'ar')), [categories])

  return (
    <div className="anim-fade-up flex flex-col gap-4">
      <Field label="اسم الالتزام" required error={errors.title}>
        <TextInput
          autoFocus={!existing}
          value={state.title}
          invalid={!!errors.title}
          maxLength={200}
          placeholder="مثال: إيجار المنزل"
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>

      <Field label="النوع">
        <Segmented
          value={state.direction}
          onChange={(v) => set({ direction: v })}
          options={[
            { value: 'owe', label: 'عليّ', icon: 'arrow-up' },
            { value: 'owed', label: 'لي', icon: 'arrow-down' },
            { value: 'none', label: 'غير مالي', icon: 'note' },
          ]}
        />
      </Field>

      {financial ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Field label="المبلغ" required error={errors.amount}>
              <AmountInput
                value={state.amount}
                onValue={(v) => set({ amount: v })}
                currency={state.currency}
                invalid={!!errors.amount}
              />
            </Field>
          </div>
          <Field label="العملة">
            <Select value={state.currency} onChange={(e) => set({ currency: e.target.value })}>
              {settings.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label="تاريخ الاستحقاق" required error={errors.dueDate}>
          <TextInput type="date" value={state.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
        </Field>
        <Field label="وقت الاستحقاق (اختياري)">
          <TextInput type="time" value={state.dueTime} onChange={(e) => set({ dueTime: e.target.value })} />
        </Field>
      </div>

      <Field label="التصنيف">
        <Select value={state.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || null })}>
          <option value="">بدون تصنيف</option>
          {sortedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="الشخص المرتبط" hint="اختر شخصًا أو أضف جديدًا بالاسم أسفل القائمة">
        <Select value={state.personId ?? ''} onChange={(e) => set({ personId: e.target.value || null })}>
          <option value="">بدون شخص</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.phone ? ` — ${p.phone}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <TextInput
        placeholder="+ شخص جديد (اسم اختياري)"
        value={state.newPersonName}
        onChange={(e) => set({ newPersonName: e.target.value })}
      />

      <div className="card p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted">
          <Icon name="repeat" size={14} />
          التكرار
        </div>
        <div className="flex flex-col gap-2">
          <Select
            value={state.recurrenceType}
            onChange={(e) => set({ recurrenceType: e.target.value as RecurrenceType })}
          >
            {(Object.keys(RECURRENCE_LABELS) as RecurrenceType[]).map((t) => (
              <option key={t} value={t}>
                {RECURRENCE_LABELS[t]}
              </option>
            ))}
          </Select>
          {needsInterval ? (
            <Field label={state.recurrenceType === 'every_n_months' ? 'كل كم شهر؟' : 'كل كم يوم؟'}>
              <TextInput inputMode="numeric" value={state.interval} onChange={(e) => set({ interval: e.target.value.replace(/\D/g, '') })} />
            </Field>
          ) : null}
          <Field label="تاريخ انتهاء التكرار (اختياري)">
            <TextInput type="date" value={state.recurrenceEnd} onChange={(e) => set({ recurrenceEnd: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="الأولوية">
          <Select value={state.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
            <option value="low">منخفضة</option>
            <option value="normal">عادية</option>
            <option value="high">عالية</option>
            <option value="urgent">عاجلة</option>
          </Select>
        </Field>
      </div>

      <Field label="التنبيهات" hint="يمكن اختيار أكثر من تنبيه">
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={state.reminders.includes(r.value)}
              onClick={() => toggleReminder(r.value)}
              className={cn(
                'tap rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                state.reminders.includes(r.value)
                  ? 'border-brand bg-brandsoft text-brand'
                  : 'border-border bg-card text-muted',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="ملاحظات">
        <TextArea value={state.notes} maxLength={4000} onChange={(e) => set({ notes: e.target.value })} />
      </Field>

      <div className="safe-b sticky bottom-0 -mx-3 flex gap-2 border-t border-border bg-surface/95 px-3 py-3 backdrop-blur">
        <Button className="flex-1" size="lg" disabled={saving} onClick={() => void submit()}>
          {existing ? 'حفظ التعديلات' : 'إضافة الالتزام'}
        </Button>
        <Button variant="outline" size="lg" onClick={() => (onDone ? onDone() : navigate(-1))}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}
