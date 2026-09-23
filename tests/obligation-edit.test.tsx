/**
 * تعديل التزام — كان يفتح بنموذج فارغ «وكأنك تكتب التزامًا جديدًا».
 *
 * السبب: بيانات Dexie تصل عبر useLiveQuery بعد أول رسم، والنموذج كان يُهيَّأ من
 * `existing` مرة واحدة فقط (حيث المصفوفة ما زالت []) ثم لا يعيد القراءة.
 * هذه الاختبارات تمرّ على الصفحة الحقيقية `/edit/:id` وتتأكد أن كل خانة تحمل قيمة
 * السجل — وبأن «إضافة» بقيت فارغة، وبأن المعرّف غير الموجود يعطي رسالة لا نموذجًا.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import 'fake-indexeddb/auto'
import { wipeDatabase } from '@/database/db'
import { seedCategories } from '@/database/defaults'
import { useSettingsStore } from '@/store/settings.store'
import { obligationsService, type ObligationInput } from '@/services/obligations.service'
import { personsService } from '@/services/persons.service'
import type { Obligation } from '@/types'
import NewObligationPage from '@/pages/NewObligationPage'
import { ObligationForm } from '@/components/obligations/ObligationForm'

function baseInput(over: Partial<ObligationInput> = {}): ObligationInput {
  return {
    title: 'قسط الجامعة',
    notes: 'دفعة أولى',
    categoryId: null,
    personId: null,
    direction: 'owe',
    financial: true,
    amount: 45_000,
    currency: 'YER',
    dueDate: '2026-09-30',
    dueTime: '10:30',
    recurrence: { type: 'every_n_months', interval: 2, endDate: '2026-12-20' },
    priority: 'high',
    status: 'active',
    reminders: [1440],
    ...over,
  }
}

function at(id: string): React.ReactElement {
  return (
    <MemoryRouter initialEntries={[`/edit/${id}`]}>
      <Routes>
        <Route path="/edit/:id" element={<NewObligationPage />} />
        <Route path="/new" element={<NewObligationPage />} />
      </Routes>
    </MemoryRouter>
  )
}

/** يعيد السؤال عن العنصر في كل محاولة (النموذج يُعاد تركيبه عند وصول البيانات) */
async function expectValue(label: string | RegExp, value: string): Promise<void> {
  await waitFor(
    () => {
      const el = screen.getByLabelText(label) as HTMLInputElement
      expect(el.value).toBe(value)
    },
    { timeout: 5000 },
  )
}

// في هذا المشروع globals=false في vitest.config ⇒ لا تنظيف تلقائي: بلا cleanup
// تتراكم النماذج في DOM بين الاختبارات وتظهر «multiple elements».
afterEach(() => cleanup())

beforeEach(async () => {
  await wipeDatabase()
  await useSettingsStore.getState().load()
  const { db } = await import('@/database/db')
  await db.categories.bulkPut(seedCategories())
})

describe('نموذج تعديل الالتزام', () => {
  it('يملأ كل الخانات من الالتزام الموجود (لا يفتح نموذجًا فارغًا)', async () => {
    const created = await obligationsService.create(baseInput())
    render(at(created.id))

    expect(await screen.findByText('تعديل الالتزام', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'حفظ التعديلات' })).toBeInTheDocument()

    await expectValue(/اسم الالتزام/, 'قسط الجامعة')
    await expectValue(/المبلغ/, '45000')
    await expectValue(/تاريخ الاستحقاق/, '2026-09-30')
    await expectValue(/وقت الاستحقاق/, '10:30')
    await expectValue(/ملاحظات/, 'دفعة أولى')

    // التكرار: النوع + عدد الفترات + تاريخ النهاية
    expect(screen.getByDisplayValue('كل عدة أشهر')).toBeInTheDocument()
    await expectValue(/كل كم شهر/, '2')
    await expectValue(/تاريخ انتهاء التكرار/, '2026-12-20')

    // الأولوية والتنبيه المختار
    await expectValue(/الأولوية/, 'high')
    expect(screen.getByRole('button', { name: 'قبل يوم' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'قبل ساعة' })).toHaveAttribute('aria-pressed', 'false')

    // لا عناصر «إضافة» متخفية
    expect(screen.queryByText('إضافة الالتزام')).not.toBeInTheDocument()
  })

  it('«إضافة التزام» يبقى فارغًا كما هو', async () => {
    await obligationsService.create(baseInput())
    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/edit/:id" element={<NewObligationPage />} />
          <Route path="/new" element={<NewObligationPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('إضافة الالتزام', undefined, { timeout: 5000 })).toBeInTheDocument()
    await expectValue(/اسم الالتزام/, '')
    await expectValue(/ملاحظات/, '')
  })

  it('معرّف غير موجود: رسالة واضحة بدل نموذج إضافة يوحي بأن الالتزام مفقود', async () => {
    render(at('nope-not-here'))

    expect(await screen.findByText('لم أجد هذا الالتزام', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByLabelText(/اسم الالتزام/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /رجوع إلى الالتزامات/ })).toHaveAttribute('href', '#/obligations')
  })

  it('الحفظ من وضع التعديل يعدّل نفس السجل ولا ينشئ واحدًا جديدًا', async () => {
    const created = await obligationsService.create(baseInput())
    const user = userEvent.setup()
    render(at(created.id))

    await expectValue(/اسم الالتزام/, 'قسط الجامعة')
    const title = screen.getByLabelText(/اسم الالتزام/) as HTMLInputElement

    await user.clear(title)
    await user.type(title, 'قسط الجامعة — معدّل')
    await user.click(screen.getByRole('button', { name: 'حفظ التعديلات' }))

    await waitFor(
      async () => {
        const { db } = await import('@/database/db')
        const after = await db.obligations.get(created.id)
        expect(after?.title).toBe('قسط الجامعة — معدّل')
        expect(await db.obligations.count()).toBe(1)
      },
      { timeout: 5000 },
    )
  })

  it('التصنيف والشخص المرتبط يُختاران من السجل', async () => {
    const cats = seedCategories()
    const person = await personsService.create({ name: 'أحمد' })
    const created = await obligationsService.create(
      baseInput({ categoryId: cats.find((c) => c.name === 'أقساط')?.id ?? null, personId: person.id }),
    )
    render(at(created.id))

    await expectValue(/الشخص المرتبط/, person.id)
    if (created.categoryId) await expectValue(/التصنيف/, created.categoryId)
    expect(screen.getByDisplayValue('أحمد')).toBeInTheDocument()
  })

  it('لو وصل السجل بعد تركيب النموذج تُعاد تعبئة الخانات (لا تبقى فارغة)', async () => {
    const created = await obligationsService.create(baseInput())
    const cats = seedCategories()
    const form = (existing?: Obligation) => (
      <MemoryRouter>
        <ObligationForm kind="new" existing={existing} categories={cats} persons={[]} />
      </MemoryRouter>
    )
    const view = render(form())

    await expectValue(/اسم الالتزام/, '')

    // وصول الالتزام بعد التركيب (نفس عنصر النموذج، بلا إعادة تركيب)
    view.rerender(form(created))

    await expectValue(/اسم الالتزام/, 'قسط الجامعة')
    await expectValue(/ملاحظات/, 'دفعة أولى')
    await expectValue(/المبلغ/, '45000')

    // والعودة إلى «جديد» تُفرّغ النموذج (لا يبقى نص الالتزام السابق عالقًا)
    view.rerender(form())
    await expectValue(/اسم الالتزام/, '')
  })
})
