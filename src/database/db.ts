/**
 * Data layer — IndexedDB via Dexie.
 * UI never talks to Dexie directly: it goes through `src/repositories/*`,
 * which in turn are wrapped by business services in `src/services/*`.
 */
import Dexie, { type Table } from 'dexie'
import type {
  ActivityEntry,
  AppSettings,
  Category,
  FiredReminder,
  IncomeEntry,
  IncomeSource,
  Obligation,
  Payment,
  Person,
  TrashItem,
} from '@/types'

export interface Attachment {
  id: string
  obligationId: string
  name: string
  type: string
  size: number
  blob: Blob
  createdAt: string
}

export class ObligationsDB extends Dexie {
  obligations!: Table<Obligation, string>
  payments!: Table<Payment, string>
  persons!: Table<Person, string>
  categories!: Table<Category, string>
  incomeSources!: Table<IncomeSource, string>
  incomeEntries!: Table<IncomeEntry, string>
  settings!: Table<AppSettings, number>
  activity!: Table<ActivityEntry, string>
  trash!: Table<TrashItem, string>
  firedReminders!: Table<FiredReminder, string>
  attachments!: Table<Attachment, string>

  constructor() {
    super('my-obligations')

    this.version(1).stores({
      obligations: 'id, dueDate, status, categoryId, personId, direction, deletedAt, updatedAt',
      payments: 'id, obligationId, date',
      persons: 'id, name, deletedAt',
      categories: 'id, name, deletedAt',
      incomeSources: 'id, active',
      incomeEntries: 'id, month',
      settings: 'id',
      activity: 'id, at, type',
      trash: 'id, kind, deletedAt',
      firedReminders: 'id, at',
      attachments: 'id, obligationId',
    })
  }
}

export const db = new ObligationsDB()

/** Fully wipe the local database (used by "مسح جميع البيانات" in settings). */
export async function wipeDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.obligations,
      db.payments,
      db.persons,
      db.categories,
      db.incomeSources,
      db.incomeEntries,
      db.settings,
      db.activity,
      db.trash,
      db.firedReminders,
      db.attachments,
    ],
    async () => {
      await db.obligations.clear()
      await db.payments.clear()
      await db.persons.clear()
      await db.categories.clear()
      await db.incomeSources.clear()
      await db.incomeEntries.clear()
      await db.settings.clear()
      await db.activity.clear()
      await db.trash.clear()
      await db.firedReminders.clear()
      await db.attachments.clear()
    },
  )
}
