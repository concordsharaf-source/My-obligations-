/**
 * «التزاماتي» — domain types.
 * Pure type definitions only; no runtime code.
 */

export type ID = string

/** عليّ (I owe) | لي (owed to me) | none (non-financial) */
export type Direction = 'owe' | 'owed' | 'none'

export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export type ObligationStatus = 'active' | 'completed' | 'cancelled' | 'archived'

export type RecurrenceType =
  | 'none'
  | 'daily'
  | 'every_n_days'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'every_n_months'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom'

export interface RecurrenceRule {
  type: RecurrenceType
  /** interval in days for `every_n_days` / `custom`, in months for `every_n_months` */
  interval: number
  /** ISO date (YYYY-MM-DD) after which the series stops, or null = endless */
  endDate: string | null
}

/** Per-occurrence adjustments ("this time only" edits, completions, snoozes…). */
export interface InstanceOverride {
  status?: 'completed' | 'skipped' | 'cancelled' | null
  completedAt?: string | null
  /** rescheduled date for this occurrence only */
  dueDate?: string | null
  dueTime?: string | null
  /** ISO datetime until which reminders for this occurrence are silenced */
  snoozedUntil?: string | null
}

export interface Obligation {
  id: ID
  title: string
  notes: string
  categoryId: ID | null
  personId: ID | null
  direction: Direction
  /** true when the obligation carries money (either direction) */
  financial: boolean
  /** amount in major currency units, rounded to 2 decimals */
  amount: number
  currency: string
  /** first due date, YYYY-MM-DD (local) */
  dueDate: string
  /** HH:mm or null */
  dueTime: string | null
  recurrence: RecurrenceRule
  /** keyed by original occurrence date (YYYY-MM-DD) */
  overrides: Record<string, InstanceOverride>
  priority: Priority
  status: ObligationStatus
  /** minutes before due; negative values mean "after due" (e.g. -60 = 1h late) */
  reminders: number[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
  archivedAt: string | null
  deletedAt: string | null
}

export interface Payment {
  id: ID
  obligationId: ID
  amount: number
  /** YYYY-MM-DD */
  date: string
  note: string
  createdAt: string
}

export interface Person {
  id: ID
  name: string
  phone: string
  notes: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Category {
  id: ID
  name: string
  /** lucide-style icon key used by <Icon/> */
  icon: string
  /** css color */
  color: string
  isSystem: boolean
  createdAt: string
  deletedAt: string | null
}

export type IncomeKind = 'salary' | 'business' | 'rent' | 'freelance' | 'investment' | 'other'

export interface IncomeSource {
  id: ID
  name: string
  kind: IncomeKind
  /** monthly amount */
  amount: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Variable / one-off income recorded against a specific month. */
export interface IncomeEntry {
  id: ID
  /** YYYY-MM */
  month: string
  label: string
  amount: number
  sourceId: ID | null
  createdAt: string
}

export type LockMode = 'none' | 'pin' | 'webauthn'

export interface AppSettings {
  id: 1
  userName: string
  currency: string
  /** currency codes the user can pick from (extendable) */
  currencies: string[]
  theme: 'light' | 'dark' | 'system'
  /** percentage of income at which each budget stage begins */
  budgetThresholds: { comfortable: number; attention: number; tight: number }
  remindersDefault: number[]
  digest: {
    morning: boolean
    evening: boolean
    morningTime: string
    eveningTime: string
  }
  lock: {
    mode: LockMode
    pinHash: string | null
    pinSalt: string | null
    credentialId: string | null
    /** minutes of inactivity before re-lock (0 = only on launch) */
    autoLockMinutes: number
  }
  /** show the theoretical daily-available indicator */
  dailyAllowance: boolean
  /** group nearby reminders into a single notification */
  grouping: boolean
  /** first day of week: 6 = Saturday, 0 = Sunday, 1 = Monday */
  weekStartsOn: 0 | 1 | 6
  /** Web Push (اختياري): المفتاح العام ورابط خادم الإرسال — لا أسرار هنا أبدًا */
  push: {
    vapidPublicKey: string
    serverUrl: string
  }
  createdAt: string
  updatedAt: string
}

export type ActivityType =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'complete'
  | 'uncomplete'
  | 'snooze'
  | 'reschedule'
  | 'payment'
  | 'cancel'
  | 'recurrence_change'
  | 'income_change'
  | 'settings_change'
  | 'import'
  | 'export'

export interface ActivityEntry {
  id: ID
  type: ActivityType
  entity: 'obligation' | 'person' | 'category' | 'payment' | 'income' | 'settings' | 'backup'
  entityId: ID | null
  message: string
  meta: Record<string, unknown>
  at: string
}

export interface TrashItem {
  id: ID
  kind: 'obligation' | 'person' | 'category' | 'payment'
  label: string
  payload: unknown
  deletedAt: string
}

/** key: `${obligationId}|${occurrenceISO}|${offsetMinutes}` */
export interface FiredReminder {
  id: string
  at: string
}

/** A concrete due instance of an obligation (recurring or single). */
export interface ObligationInstance {
  obligation: Obligation
  /** occurrence date after overrides, YYYY-MM-DD */
  dueDate: string
  dueTime: string | null
  /** original occurrence date before "this time only" reschedule */
  baseDate: string
  status: 'pending' | 'completed' | 'skipped' | 'cancelled'
  completedAt: string | null
  snoozedUntil: string | null
  /** paid portion attributed to this instance (FIFO across instances) */
  paid: number
  remaining: number
  isOverdue: boolean
}

export type BudgetStage = 'comfortable' | 'attention' | 'tight' | 'over'

export interface BudgetMonth {
  month: string
  income: number
  incomeBreakdown: { label: string; amount: number }[]
  commitments: number
  paid: number
  remaining: number
  overdue: number
  lateCount: number
  ratio: number
  stage: BudgetStage
  daysInMonth: number
  dailyAllowance: number
  byCategory: { categoryId: string | null; name: string; color: string; amount: number }[]
  annual: { name: string; annualCost: number; monthlyAverage: number }[]
}

export interface Suggestion {
  id: string
  severity: 'info' | 'warning' | 'danger' | 'success'
  title: string
  detail: string
  /** hash-route to navigate to */
  to: string
}
