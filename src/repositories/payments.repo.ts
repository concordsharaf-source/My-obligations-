import { db } from '@/database/db'
import type { Payment } from '@/types'

export const paymentsRepo = {
  async all(): Promise<Payment[]> {
    return db.payments.toArray()
  },

  async byObligation(obligationId: string): Promise<Payment[]> {
    return db.payments.where('obligationId').equals(obligationId).toArray()
  },

  async byObligations(ids: string[]): Promise<Payment[]> {
    if (ids.length === 0) return []
    return db.payments.where('obligationId').anyOf(ids).toArray()
  },

  async put(item: Payment): Promise<void> {
    await db.payments.put(item)
  },

  async bulkPut(items: Payment[]): Promise<void> {
    if (items.length) await db.payments.bulkPut(items)
  },

  async remove(id: string): Promise<void> {
    await db.payments.delete(id)
  },

  async bulkRemove(ids: string[]): Promise<void> {
    if (ids.length) await db.payments.bulkDelete(ids)
  },
}
