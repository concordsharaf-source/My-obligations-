/**
 * Backup & restore: JSON (full fidelity) + CSV (spreadsheet-friendly).
 * Import is strictly validated with zod before touching the database.
 */
import { db } from '@/database/db'
import { wipeDatabase } from '@/database/db'
import { backupSchema, type BackupPayload } from '@/models/schemas'
import { activityRepo } from '@/repositories/activity.repo'
import type { Obligation, Payment } from '@/types'
import { nowISO } from '@/utils/date'

const VERSION = 1

export async function exportJSON(): Promise<string> {
  const [obligations, payments, persons, categories, incomeSources, incomeEntries, settings, activity] =
    await Promise.all([
      db.obligations.filter((o) => o.deletedAt === null).toArray(),
      db.payments.toArray(),
      db.persons.filter((p) => p.deletedAt === null).toArray(),
      db.categories.filter((c) => c.deletedAt === null).toArray(),
      db.incomeSources.toArray(),
      db.incomeEntries.toArray(),
      db.settings.get(1),
      db.activity.toArray(),
    ])
  const payload: BackupPayload = {
    app: 'my-obligations',
    version: VERSION,
    exportedAt: nowISO(),
    settings: settings ?? undefined,
    obligations,
    payments,
    persons,
    categories,
    incomeSources,
    incomeEntries,
    activity,
  }
  await activityRepo.log('export', 'backup', 'صدّر نسخة احتياطية JSON', null, {
    obligations: obligations.length,
  })
  return JSON.stringify(payload, null, 2)
}

export interface ImportResult {
  ok: true
  counts: Record<string, number>
}

export function parseBackup(text: string): BackupPayload {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('الملف ليس JSON صالحًا')
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new Error(`بيانات غير صالحة: ${first?.message ?? 'خطأ غير معروف'} (${first?.path.join('.') ?? ''})`)
  }
  if (parsed.data.app !== 'my-obligations') throw new Error('الملف لا يعود لتطبيق «التزاماتي»')
  return parsed.data
}

export async function importJSON(text: string, mode: 'merge' | 'replace'): Promise<ImportResult> {
  const data = parseBackup(text)

  if (mode === 'replace') await wipeDatabase()
  await db.transaction(
    'rw',
    [db.obligations, db.payments, db.persons, db.categories, db.incomeSources, db.incomeEntries, db.settings, db.activity],
    async () => {
      if (data.settings) await db.settings.put(data.settings)
      if (data.categories.length) await db.categories.bulkPut(data.categories)
      if (data.persons.length) await db.persons.bulkPut(data.persons)
      if (data.obligations.length) await db.obligations.bulkPut(data.obligations)
      if (data.payments.length) await db.payments.bulkPut(data.payments)
      if (data.incomeSources.length) await db.incomeSources.bulkPut(data.incomeSources)
      if (data.incomeEntries.length) await db.incomeEntries.bulkPut(data.incomeEntries)
      if (mode === 'replace' && data.activity.length) await db.activity.bulkPut(data.activity)
    },
  )
  await activityRepo.log('import', 'backup', `استورد نسخة احتياطية (${mode === 'merge' ? 'دمج' : 'استبدال'})`, null, {
    obligations: data.obligations.length,
  })
  return {
    ok: true,
    counts: {
      obligations: data.obligations.length,
      payments: data.payments.length,
      persons: data.persons.length,
      categories: data.categories.length,
      incomeSources: data.incomeSources.length,
      incomeEntries: data.incomeEntries.length,
    },
  }
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function obligationsToCSV(obligations: Obligation[], payments: Payment[]): string {
  const header = [
    'الاسم',
    'التصنيف',
    'النوع',
    'المبلغ',
    'العملة',
    'تاريخ الاستحقاق',
    'الوقت',
    'التكرار',
    'الأولوية',
    'الحالة',
    'الشخص',
    'الهاتف',
    'المدفوع',
    'المتبقي',
    'الملاحظات',
  ]
  const paidMap = new Map<string, number>()
  for (const p of payments) paidMap.set(p.obligationId, (paidMap.get(p.obligationId) ?? 0) + p.amount)
  const rows = obligations
    .filter((o) => o.deletedAt === null)
    .map((o) => {
      const paid = paidMap.get(o.id) ?? 0
      return [
        o.title,
        o.categoryId ?? '',
        o.direction === 'owe' ? 'عليّ' : o.direction === 'owed' ? 'لي' : 'غير مالي',
        o.amount,
        o.currency,
        o.dueDate,
        o.dueTime ?? '',
        o.recurrence.type,
        o.priority,
        o.status,
        o.personId ?? '',
        '',
        paid,
        Math.max(0, o.amount - paid),
        o.notes,
      ]
        .map(csvEscape)
        .join(',')
    })
  // BOM so Excel opens Arabic correctly
  return '\uFEFF' + [header.map(csvEscape).join(','), ...rows].join('\r\n')
}

export function paymentsToCSV(payments: Payment[], obligations: Obligation[]): string {
  const titleOf = new Map(obligations.map((o) => [o.id, o.title]))
  const header = ['الالتزام', 'المبلغ', 'التاريخ', 'ملاحظة']
  const rows = payments.map((p) =>
    [titleOf.get(p.obligationId) ?? p.obligationId, p.amount, p.date, p.note].map(csvEscape).join(','),
  )
  return '\uFEFF' + [header.map(csvEscape).join(','), ...rows].join('\r\n')
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
