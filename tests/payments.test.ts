import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { db, wipeDatabase } from '@/database/db'
import { obligationsService } from '@/services/obligations.service'
import { personsService, computePersonBalance } from '@/services/persons.service'
import { paymentAttribution } from '@/services/instances'
import { todayISO } from '@/utils/date'
import type { Obligation } from '@/types'

const base = {
  title: 'دين أحمد',
  notes: '',
  categoryId: null,
  personId: null,
  direction: 'owe' as const,
  financial: true,
  amount: 100_000,
  currency: 'YER',
  dueDate: todayISO(),
  dueTime: null,
  recurrence: { type: 'none' as const, interval: 1, endDate: null },
  priority: 'normal' as const,
  status: 'active' as const,
  reminders: [],
}

beforeEach(async () => {
  await wipeDatabase()
})

describe('partial payments', () => {
  it('tracks remaining across partial payments and auto-settles at zero', async () => {
    const ob = await obligationsService.create(base)
    await obligationsService.addPayment({ obligationId: ob.id, amount: 20_000, date: todayISO() })
    let stored = await db.obligations.get(ob.id)
    let paid = await db.payments.where('obligationId').equals(ob.id).toArray()
    expect(paymentAttribution(stored as Obligation, paid).get(stored!.dueDate)).toBe(20_000)

    await obligationsService.addPayment({ obligationId: ob.id, amount: 30_000, date: todayISO() })
    stored = await db.obligations.get(ob.id)
    paid = await db.payments.where('obligationId').equals(ob.id).toArray()
    expect([...paymentAttribution(stored as Obligation, paid).values()].reduce((s, v) => s + v, 0)).toBe(50_000)

    await obligationsService.addPayment({ obligationId: ob.id, amount: 50_000, date: todayISO() })
    stored = await db.obligations.get(ob.id)
    expect(stored!.status).toBe('completed') // تم السداد
  })

  it('deleting a payment reopens the obligation', async () => {
    const ob = await obligationsService.create(base)
    const p = await obligationsService.addPayment({ obligationId: ob.id, amount: 100_000, date: todayISO() })
    expect((await db.obligations.get(ob.id))!.status).toBe('completed')
    await obligationsService.deletePayment(p.id)
    expect((await db.obligations.get(ob.id))!.status).toBe('active')
  })

  it('rejects invalid payment amounts', async () => {
    const ob = await obligationsService.create(base)
    await expect(obligationsService.addPayment({ obligationId: ob.id, amount: -5, date: todayISO() })).rejects.toThrow()
    await expect(obligationsService.addPayment({ obligationId: ob.id, amount: 0, date: todayISO() })).rejects.toThrow()
  })

  it('person balances reflect debts both ways', async () => {
    const person = await personsService.create({ name: 'أحمد', phone: '777123456' })
    await obligationsService.create({ ...base, personId: person.id }) // عليّ 100k
    await obligationsService.create({ ...base, title: 'دين لي', direction: 'owed', amount: 40_000, personId: person.id })
    const persons = await db.persons.toArray()
    const obligations = await db.obligations.toArray()
    const b = computePersonBalance(persons[0], obligations, [])
    expect(b.oweRemaining).toBe(100_000)
    expect(b.owedRemaining).toBe(40_000)
    expect(b.net).toBe(-60_000)
  })
})
