import { db, type Attachment } from '@/database/db'

const MAX_SIZE = 5 * 1024 * 1024

export const attachmentsRepo = {
  async byObligation(obligationId: string): Promise<Attachment[]> {
    return db.attachments.where('obligationId').equals(obligationId).toArray()
  },

  async add(att: Attachment): Promise<void> {
    if (att.size > MAX_SIZE) throw new Error('حجم المرفق أكبر من 5MB')
    await db.attachments.put(att)
  },

  async remove(id: string): Promise<void> {
    await db.attachments.delete(id)
  },

  async removeForObligation(obligationId: string): Promise<void> {
    const keys = await db.attachments.where('obligationId').equals(obligationId).primaryKeys()
    if (keys.length) await db.attachments.bulkDelete(keys)
  },
}
