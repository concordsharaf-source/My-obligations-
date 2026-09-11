/** People directory + per-person balances derived from obligations & payments. */
import { db } from '@/database/db'
import { personsRepo } from '@/repositories/persons.repo'
import { activityRepo } from '@/repositories/activity.repo'
import { trashRepo } from '@/repositories/trash.repo'
import { personSchema } from '@/models/schemas'
import type { Obligation, Payment, Person } from '@/types'
import { nowISO } from '@/utils/date'
import { newId } from '@/utils/ids'
import { round2 } from '@/utils/money'
import { paymentAttribution } from './instances'

export interface PersonBalance {
  person: Person
  /** money I owe them */
  oweTotal: number
  owePaid: number
  oweRemaining: number
  /** money they owe me */
  owedTotal: number
  owedCollected: number
  owedRemaining: number
  /** positive = they owe me more */
  net: number
  obligations: Obligation[]
  payments: Payment[]
  overdueCount: number
}

export function computePersonBalance(
  person: Person,
  obligations: Obligation[],
  payments: Payment[],
  now = new Date(),
): PersonBalance {
  const mine = obligations.filter((o) => o.personId === person.id && o.deletedAt === null)
  const ids = mine.map((o) => o.id)
  const pays = payments.filter((p) => ids.includes(p.obligationId))
  let oweTotal = 0
  let owePaid = 0
  let owedTotal = 0
  let owedCollected = 0
  let overdueCount = 0
  for (const ob of mine) {
    if (!ob.financial) continue
    const map = paymentAttribution(ob, pays)
    const paidAll = round2([...map.values()].reduce((s, v) => s + v, 0))
    if (ob.direction === 'owe') {
      oweTotal = round2(oweTotal + ob.amount)
      owePaid = round2(owePaid + Math.min(paidAll, ob.amount))
    } else if (ob.direction === 'owed') {
      owedTotal = round2(owedTotal + ob.amount)
      owedCollected = round2(owedCollected + Math.min(paidAll, ob.amount))
    }
    if (ob.status === 'active' && ob.dueDate < nowISO().slice(0, 10) && paidAll + 0.004 < ob.amount) {
      void now
      overdueCount++
    }
  }
  return {
    person,
    oweTotal,
    owePaid,
    oweRemaining: round2(oweTotal - owePaid),
    owedTotal,
    owedCollected,
    owedRemaining: round2(owedTotal - owedCollected),
    net: round2(owedTotal - owedCollected - (oweTotal - owePaid)),
    obligations: mine,
    payments: pays,
    overdueCount,
  }
}

export const personsService = {
  async create(input: { name: string; phone?: string; notes?: string }): Promise<Person> {
    const person = personSchema.parse({
      id: newId(),
      name: input.name,
      phone: input.phone ?? '',
      notes: input.notes ?? '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      deletedAt: null,
    }) as Person
    await personsRepo.put(person)
    await activityRepo.log('create', 'person', `أضاف شخصًا «${person.name}»`, person.id, {})
    return person
  },

  async update(id: string, patch: Partial<Person>): Promise<Person> {
    const existing = await personsRepo.byId(id)
    if (!existing) throw new Error('الشخص غير موجود')
    const merged = personSchema.parse({
      ...existing,
      ...patch,
      updatedAt: nowISO(),
    }) as Person
    await personsRepo.put(merged)
    await activityRepo.log('update', 'person', `عدّل بيانات «${merged.name}»`, id, {})
    return merged
  },

  async softDelete(id: string): Promise<void> {
    const person = await personsRepo.byId(id)
    if (!person || person.deletedAt) return
    await db.transaction('rw', db.persons, db.trash, async () => {
      await trashRepo.put({
        id: `trash-${id}`,
        kind: 'person',
        label: person.name,
        payload: { person },
        deletedAt: nowISO(),
      })
      await personsRepo.put({ ...person, deletedAt: nowISO(), updatedAt: nowISO() })
    })
    await activityRepo.log('delete', 'person', `حذف شخصًا «${person.name}» (قابل للاسترجاع)`, id, {})
  },

  async restore(id: string): Promise<void> {
    const person = await personsRepo.byId(id)
    if (!person || !person.deletedAt) return
    await db.transaction('rw', db.persons, db.trash, async () => {
      await personsRepo.put({ ...person, deletedAt: null, updatedAt: nowISO() })
      await trashRepo.remove(`trash-${id}`)
    })
    await activityRepo.log('restore', 'person', `استرجع «${person.name}»`, id, {})
  },
}
