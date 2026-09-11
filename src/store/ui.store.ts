/** UI store: toasts, bottom-sheets, lock state, PWA install + update prompts. */
import { create } from 'zustand'
import { newId } from '@/utils/ids'

export interface Toast {
  id: string
  message: string
  kind: 'info' | 'success' | 'warning' | 'danger'
  actionLabel?: string
  onAction?: () => void | Promise<void>
  durationMs: number
}

interface UIState {
  toasts: Toast[]
  locked: boolean
  overdueBadge: number
  installPrompt: BeforeInstallPromptEvent | null
  updateAvailable: boolean
  applyUpdate: (() => void) | null
  toast: (t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => string
  dismissToast: (id: string) => void
  setLocked: (v: boolean) => void
  setOverdueBadge: (n: number) => void
  setInstallPrompt: (e: BeforeInstallPromptEvent | null) => void
  setUpdate: (available: boolean, apply: (() => void) | null) => void
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  locked: false,
  overdueBadge: 0,
  installPrompt: null,
  updateAvailable: false,
  applyUpdate: null,
  toast: (t) => {
    const id = newId()
    set({ toasts: [...get().toasts, { ...t, id, durationMs: t.durationMs ?? 4000 }] })
    return id
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
  setLocked: (v) => set({ locked: v }),
  setOverdueBadge: (n) => set({ overdueBadge: n }),
  setInstallPrompt: (e) => set({ installPrompt: e }),
  setUpdate: (available, apply) => set({ updateAvailable: available, applyUpdate: apply }),
}))

export function showToast(
  message: string,
  kind: Toast['kind'] = 'info',
  extra?: { actionLabel?: string; onAction?: () => void | Promise<void>; durationMs?: number },
): string {
  return useUIStore.getState().toast({ message, kind, ...extra })
}
