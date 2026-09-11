import { db } from '@/database/db'
import type { Person } from '@/types'

export const personsRepo = {
  async all(): Promise<Person[]> {
    return db.persons.toArray()
  },

  async active(): Promise<Person[]> {
    return db.persons.filter((p) => p.deletedAt === null).toArray()
  },

  async byId(id: string): Promise<Person | undefined> {
    return db.persons.get(id)
  },

  async put(item: Person): Promise<void> {
    await db.persons.put(item)
  },

  async bulkPut(items: Person[]): Promise<void> {
    if (items.length) await db.persons.bulkPut(items)
  },

  async remove(id: string): Promise<void> {
    await db.persons.delete(id)
  },
}
