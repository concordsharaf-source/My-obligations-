/** Default seed data — created once on first launch (never mock data in views). */
import type { AppSettings, Category } from '@/types'
import { nowISO } from '@/utils/date'
import { newId } from '@/utils/ids'

export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  { id: 'cat-money', name: 'مالي', icon: 'wallet', color: '#0d9488', isSystem: true, deletedAt: null },
  { id: 'cat-social', name: 'اجتماعي', icon: 'users', color: '#8b5cf6', isSystem: true, deletedAt: null },
  { id: 'cat-work', name: 'عمل', icon: 'briefcase', color: '#2563eb', isSystem: true, deletedAt: null },
  { id: 'cat-sport', name: 'رياضة', icon: 'dumbbell', color: '#16a34a', isSystem: true, deletedAt: null },
  { id: 'cat-study', name: 'دراسة', icon: 'graduation', color: '#ea580c', isSystem: true, deletedAt: null },
  { id: 'cat-home', name: 'منزل', icon: 'home', color: '#ca8a04', isSystem: true, deletedAt: null },
  { id: 'cat-appointments', name: 'مواعيد', icon: 'calendar-clock', color: '#0891b2', isSystem: true, deletedAt: null },
  { id: 'cat-bills', name: 'فواتير', icon: 'receipt', color: '#dc2626', isSystem: true, deletedAt: null },
  { id: 'cat-installments', name: 'أقساط', icon: 'layers', color: '#c026d3', isSystem: true, deletedAt: null },
  { id: 'cat-personal', name: 'شخصي', icon: 'user', color: '#64748b', isSystem: true, deletedAt: null },
  { id: 'cat-health', name: 'صحة', icon: 'heart', color: '#e11d48', isSystem: true, deletedAt: null },
  { id: 'cat-other', name: 'أخرى', icon: 'tag', color: '#475569', isSystem: true, deletedAt: null },
]

export function buildDefaultSettings(): AppSettings {
  const now = nowISO()
  return {
    id: 1,
    userName: '',
    currency: 'YER',
    currencies: ['YER', 'SAR', 'USD'],
    theme: 'system',
    budgetThresholds: { comfortable: 50, attention: 70, tight: 90 },
    remindersDefault: [60, 1440],
    digest: { morning: true, evening: true, morningTime: '08:00', eveningTime: '21:00' },
    lock: { mode: 'none', pinHash: null, pinSalt: null, credentialId: null, autoLockMinutes: 5 },
    dailyAllowance: true,
    grouping: true,
    weekStartsOn: 6,
    createdAt: now,
    updatedAt: now,
  }
}

export function seedCategories(): Category[] {
  const now = nowISO()
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, id: c.id || newId(), createdAt: now }))
}
