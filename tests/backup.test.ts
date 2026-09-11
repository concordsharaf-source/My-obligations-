import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { db, wipeDatabase } from '@/database/db'
import { exportJSON, importJSON, obligationsToCSV, parseBackup } from '@/services/backup.service'
import { obligationsService } from '@/services/obligations.service'
import { todayISO } from '@/utils/date'

beforeEach(async () => {
  await wipeDatabase()
})

const sample = {
  title: 'إيجار',
  notes: '',
  categoryId: null,
  personId: null,
  direction: 'owe' as const,
  financial: true,
  amount: 80_000,
  currency: 'YER',
  dueDate: todayISO(),
  dueTime: null,
  recurrence: { type: 'monthly' as const, interval: 1, endDate: null },
  priority: 'normal' as const,
  status: 'active' as const,
  reminders: [60],
}

describe('backup & restore', () => {
  it('exports a valid payload that re-imports', async () => {
    await obligationsService.create(sample)
    const json = await exportJSON()
    const parsed = parseBackup(json)
    expect(parsed.app).toBe('my-obligations')
    expect(parsed.obligations).toHaveLength(1)

    await wipeDatabase()
    expect(await db.obligations.count()).toBe(0)
    const res = await importJSON(json, 'replace')
    expect(res.counts.obligations).toBe(1)
    expect(await db.obligations.count()).toBe(1)
  })

  it('rejects corrupted / foreign files', () => {
    expect(() => parseBackup('not json')).toThrow()
    expect(() => parseBackup(JSON.stringify({ app: 'other', version: 1 }))).toThrow()
    expect(() =>
      parseBackup(
        JSON.stringify({
          app: 'my-obligations',
          version: 1,
          exportedAt: new Date().toISOString(),
          obligations: [{ id: 'x', title: '', dueDate: 'bad-date' }],
        }),
      ),
    ).toThrow()
  })

  it('merge keeps existing and adds new', async () => {
    await obligationsService.create(sample)
    const json = await exportJSON()
    const payload = JSON.parse(json) as { obligations: { id: string }[] }
    payload.obligations[0].id = 'different-id'
    await importJSON(JSON.stringify(payload), 'merge')
    expect(await db.obligations.count()).toBe(2)
  })

  it('CSV starts with BOM and contains the rows', async () => {
    await obligationsService.create(sample)
    const obligations = await db.obligations.toArray()
    const csv = obligationsToCSV(obligations, [])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('إيجار')
    expect(csv).toContain('80000')
  })
})
