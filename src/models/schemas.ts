/**
 * Runtime validation schemas (used for import/backup validation and form guards).
 * The domain types are derived from these schemas where practical.
 */
import { z } from 'zod'

export const idSchema = z.string().min(1).max(64)

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ غير صالح (YYYY-MM-DD)')

export const isoDateTimeSchema = z.string().datetime({ offset: true }).or(z.string().min(10))

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'وقت غير صالح (HH:mm)')

export const timeOrNullSchema = timeSchema.nullable()

export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'شهر غير صالح (YYYY-MM)')

export const amountSchema = z
  .number({ message: 'المبلغ يجب أن يكون رقمًا' })
  .finite('المبلغ يجب أن يكون رقمًا منتهيًا')
  .nonnegative('المبلغ لا يمكن أن يكون سالبًا')
  .max(1_000_000_000_000, 'المبلغ كبير جدًا')

export const recurrenceSchema = z.object({
  type: z.enum([
    'none',
    'daily',
    'every_n_days',
    'weekly',
    'biweekly',
    'monthly',
    'every_n_months',
    'quarterly',
    'semiannual',
    'annual',
    'custom',
  ]),
  interval: z.number().int().min(1).max(3650).default(1),
  endDate: isoDateSchema.nullable().default(null),
})

export const instanceOverrideSchema = z.object({
  status: z.enum(['completed', 'skipped', 'cancelled']).nullable().optional(),
  completedAt: z.string().nullable().optional(),
  dueDate: isoDateSchema.nullable().optional(),
  dueTime: timeOrNullSchema.optional(),
  snoozedUntil: z.string().nullable().optional(),
})

export const obligationSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1, 'اسم الالتزام مطلوب').max(200),
  notes: z.string().max(4000).default(''),
  categoryId: idSchema.nullable().default(null),
  personId: idSchema.nullable().default(null),
  direction: z.enum(['owe', 'owed', 'none']).default('none'),
  financial: z.boolean().default(false),
  amount: amountSchema.default(0),
  currency: z.string().min(1).max(8).default('YER'),
  dueDate: isoDateSchema,
  dueTime: timeOrNullSchema.default(null),
  recurrence: recurrenceSchema.default({ type: 'none', interval: 1, endDate: null }),
  overrides: z.record(z.string(), instanceOverrideSchema).default({}),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  status: z.enum(['active', 'completed', 'cancelled', 'archived']).default('active'),
  reminders: z.array(z.number().int().min(-10080).max(525600)).default([]),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
  completedAt: z.string().nullable().default(null),
  archivedAt: z.string().nullable().default(null),
  deletedAt: z.string().nullable().default(null),
})

export const paymentSchema = z.object({
  id: idSchema,
  obligationId: idSchema,
  amount: amountSchema.refine((n) => n > 0, 'الدفعة يجب أن تكون أكبر من صفر'),
  date: isoDateSchema,
  note: z.string().max(1000).default(''),
  createdAt: z.string().default(''),
})

export const personSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, 'الاسم مطلوب').max(120),
  phone: z
    .string()
    .max(32)
    .regex(/^[+\d\s()-]*$/, 'رقم هاتف غير صالح')
    .default(''),
  notes: z.string().max(2000).default(''),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
  deletedAt: z.string().nullable().default(null),
})

export const categorySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, 'اسم التصنيف مطلوب').max(60),
  icon: z.string().min(1).max(40).default('tag'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'لون غير صالح')
    .default('#0d9488'),
  isSystem: z.boolean().default(false),
  createdAt: z.string().default(''),
  deletedAt: z.string().nullable().default(null),
})

export const incomeSourceSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, 'اسم المصدر مطلوب').max(120),
  kind: z.enum(['salary', 'business', 'rent', 'freelance', 'investment', 'other']).default('other'),
  amount: amountSchema,
  active: z.boolean().default(true),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
})

export const incomeEntrySchema = z.object({
  id: idSchema,
  month: monthSchema,
  label: z.string().trim().min(1).max(120),
  amount: amountSchema,
  sourceId: idSchema.nullable().default(null),
  createdAt: z.string().default(''),
})

export const settingsSchema = z.object({
  id: z.literal(1).default(1),
  userName: z.string().max(60).default(''),
  currency: z.string().min(1).max(8).default('YER'),
  currencies: z.array(z.string().min(1).max(8)).min(1).default(['YER', 'SAR', 'USD']),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  budgetThresholds: z
    .object({
      comfortable: z.number().min(1).max(100).default(50),
      attention: z.number().min(1).max(100).default(70),
      tight: z.number().min(1).max(100).default(90),
    })
    .default({ comfortable: 50, attention: 70, tight: 90 }),
  remindersDefault: z.array(z.number().int()).default([60, 1440]),
  digest: z
    .object({
      morning: z.boolean().default(true),
      evening: z.boolean().default(true),
      morningTime: timeSchema.default('08:00'),
      eveningTime: timeSchema.default('21:00'),
    })
    .default({ morning: true, evening: true, morningTime: '08:00', eveningTime: '21:00' }),
  lock: z
    .object({
      mode: z.enum(['none', 'pin', 'webauthn']).default('none'),
      pinHash: z.string().nullable().default(null),
      pinSalt: z.string().nullable().default(null),
      credentialId: z.string().nullable().default(null),
      autoLockMinutes: z.number().int().min(0).max(1440).default(5),
    })
    .default({ mode: 'none', pinHash: null, pinSalt: null, credentialId: null, autoLockMinutes: 5 }),
  dailyAllowance: z.boolean().default(true),
  grouping: z.boolean().default(true),
  weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]).default(6),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
})

export const activitySchema = z.object({
  id: idSchema,
  type: z.enum([
    'create',
    'update',
    'delete',
    'restore',
    'complete',
    'uncomplete',
    'snooze',
    'reschedule',
    'payment',
    'cancel',
    'recurrence_change',
    'income_change',
    'settings_change',
    'import',
    'export',
  ]),
  entity: z.enum(['obligation', 'person', 'category', 'payment', 'income', 'settings', 'backup']),
  entityId: idSchema.nullable().default(null),
  message: z.string().max(500),
  meta: z.record(z.string(), z.unknown()).default({}),
  at: z.string(),
})

/** Full backup payload — used to validate imported files. */
export const backupSchema = z.object({
  app: z.literal('my-obligations'),
  version: z.number().int().default(1),
  exportedAt: z.string(),
  settings: settingsSchema.optional(),
  obligations: z.array(obligationSchema).default([]),
  payments: z.array(paymentSchema).default([]),
  persons: z.array(personSchema).default([]),
  categories: z.array(categorySchema).default([]),
  incomeSources: z.array(incomeSourceSchema).default([]),
  incomeEntries: z.array(incomeEntrySchema).default([]),
  activity: z.array(activitySchema).default([]),
})

export type BackupPayload = z.infer<typeof backupSchema>
