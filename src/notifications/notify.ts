/**
 * Real notifications: shown through the ServiceWorker registration when
 * available (so they survive tab closure), with a plain Notification fallback.
 */
export interface AppNotification {
  title: string
  body: string
  tag: string
  route?: string
  obligationId?: string
  baseDate?: string
  actions?: { action: string; title: string }[]
  silent?: boolean
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function permissionState(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return (await navigator.serviceWorker.ready) as ServiceWorkerRegistration
  } catch {
    return null
  }
}

export async function showAppNotification(n: AppNotification): Promise<void> {
  const reg = await getRegistration()
  const options: NotificationOptions = {
    body: n.body,
    tag: n.tag,
    icon: './icons/icon-192.png',
    badge: './icons/icon-64.png',
    dir: 'rtl',
    lang: 'ar',
    silent: n.silent ?? false,
    // @ts-expect-error — actions & data are supported by SW-shown notifications
    actions: n.actions ?? [],
    data: { route: n.route, obligationId: n.obligationId, baseDate: n.baseDate },
  }
  if (reg) {
    await reg.showNotification(n.title, options)
    return
  }
  if (notificationsSupported() && Notification.permission === 'granted') {
    const fallback = new Notification(n.title, options)
    void fallback
  }
}
