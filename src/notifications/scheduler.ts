/**
 * Local reminder scheduler.
 * Ticks while the app (or its SW-driven page) is alive: on interval, on data
 * changes and on visibility/focus. Reminders are de-duplicated through the
 * `firedReminders` store so a reload never double-notifies.
 *
 * NOTE: browsers cannot wake a closed PWA without Web Push — see `push.ts`
 * and the README for the production push architecture.
 */
import type { AppSettings, Obligation, Payment } from '@/types'
import { dueDateTime, nowISO, todayISO } from '@/utils/date'
import { addDays } from '@/utils/date'
import { expandInstances } from '@/services/obligations.service'
import { remindersRepo } from '@/repositories/reminders.repo'
import { showAppNotification } from './notify'
import { computeStats } from '@/services/stats.service'
import type { BudgetContext } from '@/services/budget.service'

const HORIZON_DAYS = 21
const DEFAULT_DUE_TIME_FOR_REMINDERS = '09:00'

export interface SchedulerData {
  obligations: Obligation[]
  payments: Payment[]
  settings: AppSettings
}

export function reminderOffsets(ob: Obligation, settings: AppSettings): number[] {
  return ob.reminders.length ? ob.reminders : settings.remindersDefault
}

export interface DueReminder {
  key: string
  title: string
  body: string
  route: string
  obligationId: string
  baseDate: string
  dueAt: Date
}

export function collectDueReminders(data: SchedulerData, now = new Date()): DueReminder[] {
  const today = todayISO()
  const instances = expandInstances(data.obligations, data.payments, addDays(today, -30), addDays(today, HORIZON_DAYS), { now })
  const out: DueReminder[] = []
  for (const inst of instances) {
    if (inst.status !== 'pending') continue
    if (inst.snoozedUntil && new Date(inst.snoozedUntil).getTime() > now.getTime()) continue
    const ob = inst.obligation
    const due = dueDateTime(inst.dueDate, inst.dueTime ?? DEFAULT_DUE_TIME_FOR_REMINDERS)
    for (const offset of reminderOffsets(ob, data.settings)) {
      const fireAt = new Date(due.getTime() - offset * 60_000)
      if (fireAt.getTime() > now.getTime()) continue
      // do not fire reminders older than the horizon back-window
      if (now.getTime() - fireAt.getTime() > HORIZON_DAYS * 86_400_000) continue
      const label =
        offset === 0
          ? 'حان موعد الالتزام'
          : offset > 0
            ? `تذكير قبل ${describeOffset(offset)}`
            : `تأخر الالتزام (${describeOffset(-offset)})`
      out.push({
        key: `${ob.id}|${inst.baseDate}|${offset}`,
        title: label,
        body: `${ob.title} — ${inst.dueDate}${inst.dueTime ? ' ' + inst.dueTime : ''}`,
        route: `/obligation/${ob.id}`,
        obligationId: ob.id,
        baseDate: inst.baseDate,
        dueAt: due,
      })
    }
  }
  return out
}

function describeOffset(minutes: number): string {
  if (minutes < 60) return `${minutes} دقيقة`
  if (minutes < 1440) {
    const h = minutes / 60
    return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? `${h} ساعات` : `${h} ساعة`
  }
  const d = Math.round(minutes / 1440)
  if (d === 1) return 'يوم'
  if (d === 2) return 'يومين'
  if (d === 7) return 'أسبوع'
  return `${d} يوم`
}

/** Group reminders whose due times are close together (anti-noise). */
export function groupReminders(items: DueReminder[], grouping: boolean, now = new Date()): DueReminder[][] {
  if (!grouping) return items.map((i) => [i])
  const windowMs = 2 * 60 * 60 * 1000
  const soon = items.filter((i) => Math.abs(i.dueAt.getTime() - now.getTime()) <= windowMs)
  const rest = items.filter((i) => !soon.includes(i))
  const groups: DueReminder[][] = rest.map((i) => [i])
  if (soon.length >= 3) groups.push(soon)
  else groups.push(...soon.map((i) => [i]))
  return groups
}

export async function tickReminders(data: SchedulerData): Promise<number> {
  const now = new Date()
  const due = collectDueReminders(data, now)
  if (!due.length) return 0
  const fresh: DueReminder[] = []
  for (const r of due) {
    if (!(await remindersRepo.has(r.key))) fresh.push(r)
  }
  if (!fresh.length) return 0
  const groups = groupReminders(fresh, data.settings.grouping, now)
  let shown = 0
  for (const group of groups) {
    if (group.length >= 3) {
      await showAppNotification({
        title: `لديك ${group.length} التزامات قريبة`,
        body: group
          .slice(0, 4)
          .map((g) => `• ${g.obligationId ? '' : ''}${titleOf(group, g)}`)
          .join('\n'),
        tag: `group-${group[0].key}`,
        route: '/obligations',
      })
    } else {
      const g = group[0]
      await showAppNotification({
        title: g.title,
        body: g.body,
        tag: g.key,
        route: g.route,
        obligationId: g.obligationId,
        baseDate: g.baseDate,
        actions: [
          { action: 'complete', title: 'تم ✓' },
          { action: 'snooze60', title: 'تأجيل ساعة' },
        ],
      })
    }
    await remindersRepo.markMany(group.map((g) => g.key))
    shown++
  }
  return shown
}

function titleOf(group: DueReminder[], g: DueReminder): string {
  void group
  return g.body.split(' — ')[0] ?? g.title
}

// ---------- daily digests ----------

const DIGEST_KEY = 'my-obligations:digest'

function digestState(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DIGEST_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export async function tickDigests(ctx: BudgetContext): Promise<void> {
  const now = new Date()
  const today = todayISO()
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const state = digestState()
  const { digest } = ctx.settings

  if (digest.morning && state.morning !== today && hhmm >= digest.morningTime) {
    const count = computeStats(ctx).instances.filter((i) => i.dueDate === today && i.status === 'pending').length
    await showAppNotification({
      title: 'صباح الخير 👋',
      body: count > 0 ? `لديك اليوم ${count} التزامات.` : 'لا التزامات عليك اليوم.',
      tag: `digest-morning-${today}`,
      route: '/',
      silent: false,
    })
    state.morning = today
    localStorage.setItem(DIGEST_KEY, JSON.stringify(state))
  }

  if (digest.evening && state.evening !== today && hhmm >= digest.eveningTime) {
    const insts = computeStats(ctx).instances.filter((i) => i.dueDate === today)
    const completed = insts.filter((i) => i.status === 'completed').length
    const overdue = insts.filter((i) => i.isOverdue).length
    const skipped = insts.filter((i) => i.status === 'skipped').length
    await showAppNotification({
      title: 'ملخص اليوم',
      body: `${completed} مكتملة\n${skipped} مؤجلة\n${overdue} متأخرة`,
      tag: `digest-evening-${today}`,
      route: '/',
    })
    state.evening = today
    localStorage.setItem(DIGEST_KEY, JSON.stringify(state))
  }
  void nowISO
}

// ---------- lifecycle ----------

let timer: number | null = null
let getData: (() => Promise<SchedulerData | null>) | null = null
let getCtx: (() => Promise<BudgetContext | null>) | null = null

export function startScheduler(
  fetchData: () => Promise<SchedulerData | null>,
  fetchCtx: () => Promise<BudgetContext | null>,
): () => void {
  getData = fetchData
  getCtx = fetchCtx
  const run = (): void => {
    void (async () => {
      if (!getData) return
      const data = await getData()
      if (data) await tickReminders(data)
      if (getCtx) {
        const ctx = await getCtx()
        if (ctx) await tickDigests(ctx)
      }
    })()
  }
  run()
  timer = window.setInterval(run, 30_000)
  const onWake = (): void => {
    if (document.visibilityState === 'visible') run()
  }
  document.addEventListener('visibilitychange', onWake)
  window.addEventListener('focus', onWake)
  window.addEventListener('obligations:changed', onWake)
  return () => {
    if (timer) window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onWake)
    window.removeEventListener('focus', onWake)
    window.removeEventListener('obligations:changed', onWake)
    timer = null
  }
}

export function notifyDataChanged(): void {
  window.dispatchEvent(new Event('obligations:changed'))
}
