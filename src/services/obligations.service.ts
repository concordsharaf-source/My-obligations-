/**
 * Business logic for obligations & payments.
 * Every mutation is validated, persisted and written to the activity log.
 */
import { db } from '@/database/db'
import { obligationsRepo } from '@/repositories/obligations.repo'
import { paymentsRepo } from '@/repositories/payments.repo'
import { activityRepo } from '@/repositories/activity.repo'
import { trashRepo } from '@/repositories/trash.repo'
import { remindersRepo } from '@/repositories/reminders.repo'
import { obligationSchema, paymentSchema } from '@/models/schemas'
import type { Obligation, ObligationInstance, Payment } from '@/types'
import { nowISO, todayISO } from '@/utils/date'
import { newId } from '@/utils/ids'
import { round2 } from '@/utils/money'
import { instancesIn, paymentAttribution } from './instances'
import { stepDate } from './recurrence'

export type ObligationInput = Omit<
  Obligation,
  'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'archivedAt' | 'deletedAt' | 'overrides'
> & { overrides?: Obligation['overrides'] }

function serialize(input: ObligationInput & { id?: string }): Obligation {
  const parsed = obligationSchema.parse({
    id: newId(),
    ...input,
    overrides: input.overrides ?? {},
    createdAt: nowISO(),
    updatedAt: nowISO(),
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
  })
  return parsed as Obligation
}

export const obligationsService = {
  async create(input: ObligationInput): Promise<Obligation> {
    const ob = serialize(input)
    await obligationsRepo.put(ob)
    await activityRepo.log('create', 'obligation', `أضاف التزام «${ob.title}»`, ob.id, {
      amount: ob.amount,
      dueDate: ob.dueDate,
    })
    return ob
  },

  async update(id: string, patch: Partial<ObligationInput>, label?: string): Promise<Obligation> {
    const existing = await obligationsRepo.byId(id)
    if (!existing || existing.deletedAt) throw new Error('الالتزام غير موجود')
    const merged = serialize({ ...existing, ...patch, id: existing.id } as ObligationInput)
    const next: Obligation = {
      ...merged,
      overrides: patch.overrides ?? existing.overrides,
      createdAt: existing.createdAt,
      updatedAt: nowISO(),
    }
    await obligationsRepo.put(next)
    await activityRepo.log('update', 'obligation', label ?? `عدّل التزام «${next.title}»`, id, {})
    return next
  },

  async setOverride(id: string, baseDate: string, patch: Partial<Obligation['overrides'][string]>, log?: { type: 'complete' | 'uncomplete' | 'snooze' | 'reschedule' | 'cancel'; message: string }): Promise<void> {
    const ob = await obligationsRepo.byId(id)
    if (!ob) throw new Error('الالتزام غير موجود')
    const prev = ob.overrides[baseDate] ?? {}
    const next: Obligation = {
      ...ob,
      overrides: { ...ob.overrides, [baseDate]: { ...prev, ...patch } },
      updatedAt: nowISO(),
    }
    if (ob.recurrence.type === 'none') {
      const st = next.overrides[baseDate]?.status
      if (st === 'completed') {
        next.status = 'completed'
        next.completedAt = next.overrides[baseDate]?.completedAt ?? nowISO()
      } else if (st == null) {
        next.status = 'active'
        next.completedAt = null
      }
    }
    await obligationsRepo.put(next)
    if (log) await activityRepo.log(log.type, 'obligation', log.message, id, { baseDate })
  },

  async completeInstance(id: string, baseDate: string): Promise<void> {
    await this.setOverride(id, baseDate, { status: 'completed', completedAt: nowISO() }, {
      type: 'complete',
      message: `أكمل التزامًا (${baseDate})`,
    })
  },

  async uncompleteInstance(id: string, baseDate: string): Promise<void> {
    await this.setOverride(id, baseDate, { status: null, completedAt: null }, {
      type: 'uncomplete',
      message: `أعاد فتح التزام (${baseDate})`,
    })
  },

  async skipInstance(id: string, baseDate: string): Promise<void> {
    await this.setOverride(id, baseDate, { status: 'skipped' }, {
      type: 'cancel',
      message: `تخطّى مرة من التزام (${baseDate})`,
    })
  },

  async snoozeInstance(id: string, baseDate: string, untilISODateTime: string): Promise<void> {
    await this.setOverride(id, baseDate, { snoozedUntil: untilISODateTime }, {
      type: 'snooze',
      message: `أجّل تنبيه التزام إلى ${untilISODateTime}`,
    })
  },

  /** Reschedule one occurrence ("this time only"). */
  async rescheduleThis(id: string, baseDate: string, newDate: string, newTime: string | null): Promise<void> {
    await this.setOverride(
      id,
      baseDate,
      { dueDate: newDate, dueTime: newTime },
      { type: 'reschedule', message: `غيّر موعد مرة واحدة إلى ${newDate}` },
    )
  },

  /**
   * "Edit this & future": close the old series right before `baseDate`
   * and start a new series from `baseDate` with the patch applied.
   */
  async splitFuture(id: string, baseDate: string, patch: Partial<ObligationInput>): Promise<Obligation> {
    const ob = await obligationsRepo.byId(id)
    if (!ob) throw new Error('الالتزام غير موجود')
    // previous occurrence before baseDate
    let prev = ob.dueDate
    let cur = ob.dueDate
    let guard = 0
    while (cur < baseDate && guard < 4000) {
      prev = cur
      cur = stepDate(cur, ob.recurrence)
      guard++
    }
    const closed: Obligation = {
      ...ob,
      recurrence: { ...ob.recurrence, endDate: prev === baseDate ? ob.dueDate : prev },
      updatedAt: nowISO(),
    }
    const fresh = serialize({
      ...ob,
      ...patch,
      id: newId(),
      dueDate: baseDate,
      overrides: {},
      recurrence: patch.recurrence ?? { ...ob.recurrence, endDate: ob.recurrence.endDate },
    } as ObligationInput)
    await db.transaction('rw', db.obligations, async () => {
      await obligationsRepo.put(closed)
      await obligationsRepo.put(fresh)
    })
    await activityRepo.log('recurrence_change', 'obligation', `عدّل المستقبل من «${ob.title}» اعتبارًا من ${baseDate}`, id, {})
    return fresh
  },

  /** Stop the repetition entirely (keep history). */
  async stopRecurrence(id: string, afterDate: string | null): Promise<void> {
    const ob = await obligationsRepo.byId(id)
    if (!ob) throw new Error('الالتزام غير موجود')
    await obligationsRepo.put({
      ...ob,
      recurrence: { ...ob.recurrence, type: 'none', endDate: afterDate },
      updatedAt: nowISO(),
    })
    await activityRepo.log('recurrence_change', 'obligation', `ألغى تكرار «${ob.title}»`, id, {})
  },

  async addPayment(input: { obligationId: string; amount: number; date: string; note?: string }): Promise<Payment> {
    const payment = paymentSchema.parse({
      id: newId(),
      obligationId: input.obligationId,
      amount: round2(input.amount),
      date: input.date,
      note: input.note ?? '',
      createdAt: nowISO(),
    }) as Payment
    const ob = await obligationsRepo.byId(input.obligationId)
    if (!ob) throw new Error('الالتزام غير موجود')

    await db.transaction('rw', db.payments, db.obligations, async () => {
      await paymentsRepo.put(payment)
      // auto-settle when fully paid
      const all = await paymentsRepo.byObligation(ob.id)
      const paid = round2(all.reduce((s, p) => s + p.amount, 0))
      if (ob.financial && paid + 0.004 >= ob.amount) {
        if (ob.recurrence.type === 'none') {
          await this.setOverride(ob.id, ob.dueDate, { status: 'completed', completedAt: nowISO() })
        } else {
          // settle earliest unsettled instance(s) covered by the paid pool
          let pool = paid
          let cur = ob.dueDate
          let guard = 0
          const updated = { ...ob, overrides: { ...ob.overrides } }
          while (pool > 0.004 && guard < 1500) {
            const st = updated.overrides[cur]?.status
            if (st !== 'completed' && st !== 'skipped' && st !== 'cancelled') {
              updated.overrides[cur] = { ...updated.overrides[cur], status: 'completed', completedAt: nowISO() }
              pool = round2(pool - ob.amount)
            }
            cur = stepDate(cur, ob.recurrence)
            guard++
          }
          updated.updatedAt = nowISO()
          await obligationsRepo.put(updated)
        }
      }
    })
    await activityRepo.log('payment', 'payment', `سجّل دفعة ${payment.amount} على «${ob.title}»`, ob.id, {
      paymentId: payment.id,
    })
    return payment
  },

  async deletePayment(paymentId: string): Promise<void> {
    const payment = await db.payments.get(paymentId)
    if (!payment) return
    const ob = await obligationsRepo.byId(payment.obligationId)
    await db.transaction('rw', db.payments, db.obligations, async () => {
      await paymentsRepo.remove(paymentId)
      if (ob) {
        const all = await paymentsRepo.byObligation(ob.id)
        const paid = round2(all.reduce((s, p) => s + p.amount, 0))
        if (ob.financial && paid + 0.004 < ob.amount) {
          // reopen auto-settled instances that are no longer covered
          if (ob.recurrence.type === 'none') {
            const ov = ob.overrides[ob.dueDate]
            if (ov?.status === 'completed') {
              await this.setOverride(ob.id, ob.dueDate, { status: null, completedAt: null })
            }
          } else {
            const map = paymentAttribution(ob, all)
            const updated = { ...ob, overrides: { ...ob.overrides } }
            let cur = ob.dueDate
            let guard = 0
            while (guard < 1500) {
              const covered = map.get(cur) ?? 0
              const ov = updated.overrides[cur]
              if (ov?.status === 'completed' && ov.completedAt && covered + 0.004 < ob.amount) {
                // only reopen auto-completed ones (no manual completedAt difference is tracked);
                // we reopen when the FIFO pool no longer covers the instance
                updated.overrides[cur] = { ...ov, status: null, completedAt: null }
              }
              cur = stepDate(cur, ob.recurrence)
              guard++
            }
            updated.updatedAt = nowISO()
            await obligationsRepo.put(updated)
          }
        }
      }
    })
    await activityRepo.log('delete', 'payment', `حذف دفعة ${payment.amount}`, payment.obligationId, {
      paymentId,
    })
  },

  /** Soft delete → trash (restorable / undoable). */
  async softDelete(id: string): Promise<void> {
    const ob = await obligationsRepo.byId(id)
    if (!ob || ob.deletedAt) return
    const payments = await paymentsRepo.byObligation(id)
    await db.transaction('rw', db.obligations, db.trash, async () => {
      await trashRepo.put({
        id: `trash-${id}`,
        kind: 'obligation',
        label: ob.title,
        payload: { obligation: ob, payments },
        deletedAt: nowISO(),
      })
      await obligationsRepo.put({ ...ob, deletedAt: nowISO(), updatedAt: nowISO() })
    })
    await remindersRepo.clearFor(id)
    await activityRepo.log('delete', 'obligation', `حذف التزام «${ob.title}» (قابل للاسترجاع)`, id, {})
  },

  async restore(id: string): Promise<void> {
    const ob = await obligationsRepo.byId(id)
    if (!ob || !ob.deletedAt) return
    await db.transaction('rw', db.obligations, db.trash, async () => {
      await obligationsRepo.put({ ...ob, deletedAt: null, updatedAt: nowISO() })
      await trashRepo.remove(`trash-${id}`)
    })
    await activityRepo.log('restore', 'obligation', `استرجع التزام «${ob.title}»`, id, {})
  },

  async purge(id: string): Promise<void> {
    const payments = await paymentsRepo.byObligation(id)
    await db.transaction('rw', db.obligations, db.payments, db.trash, async () => {
      await obligationsRepo.remove(id)
      await paymentsRepo.bulkRemove(payments.map((p) => p.id))
      await trashRepo.remove(`trash-${id}`)
    })
  },

  async archive(id: string, archived: boolean): Promise<void> {
    const ob = await obligationsRepo.byId(id)
    if (!ob) return
    await obligationsRepo.put({
      ...ob,
      status: archived ? 'archived' : 'active',
      archivedAt: archived ? nowISO() : null,
      updatedAt: nowISO(),
    })
    await activityRepo.log('update', 'obligation', archived ? `أرشف «${ob.title}»` : `أخرج «${ob.title}» من الأرشيف`, id, {})
  },

  async cancel(id: string): Promise<void> {
    const ob = await obligationsRepo.byId(id)
    if (!ob) return
    await obligationsRepo.put({ ...ob, status: 'cancelled', updatedAt: nowISO() })
    await activityRepo.log('cancel', 'obligation', `ألغى «${ob.title}»`, id, {})
  },
}

/** Cross-cutting query helper used by dashboard / calendar / lists. */
export function expandInstances(
  obligations: Obligation[],
  payments: Payment[],
  from: string,
  to: string,
  opts: { includeArchived?: boolean; now?: Date } = {},
): ObligationInstance[] {
  const now = opts.now ?? new Date()
  const out: ObligationInstance[] = []
  for (const ob of obligations) {
    if (ob.deletedAt) continue
    if (!opts.includeArchived && ob.status === 'archived') continue
    const map = paymentAttribution(ob, payments)
    out.push(...instancesIn(ob, { from, to, now }, map))
  }
  out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
  return out
}

export function isOpenInstance(inst: ObligationInstance): boolean {
  return inst.status === 'pending'
}

export function todayInstances(obligations: Obligation[], payments: Payment[]): ObligationInstance[] {
  const t = todayISO()
  return expandInstances(obligations, payments, t, t).filter(isOpenInstance)
}
