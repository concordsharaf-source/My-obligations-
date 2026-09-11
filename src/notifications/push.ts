/**
 * Web Push architecture (future-ready).
 *
 * The app is fully functional with LOCAL reminders (see scheduler.ts).
 * Real background push requires an external push server + VAPID keys, which
 * must NEVER live in the frontend. This module provides the client half:
 *
 *   1. `subscribe(vapidPublicKey)` → PushSubscription (browser ↔ push service)
 *   2. Hand the subscription JSON to YOUR backend (settings → "تصدير اشتراك الدفع")
 *   3. The SW already handles the `push` event and renders the payload.
 *
 * No secret is stored in the bundle; the public VAPID key is supplied at
 * runtime (settings) by whoever operates the push server.
 */
import { showAppNotification } from './notify'

const SUB_KEY = 'my-obligations:push-subscription'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function subscribe(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
  localStorage.setItem(SUB_KEY, JSON.stringify(sub.toJSON()))
  return sub
}

export async function unsubscribe(): Promise<boolean> {
  const sub = await currentSubscription()
  localStorage.removeItem(SUB_KEY)
  if (!sub) return false
  return sub.unsubscribe()
}

export function exportSubscriptionForServer(): string | null {
  return localStorage.getItem(SUB_KEY)
}

/** Called by the SW on `push`. Kept here for documentation symmetry. */
export async function renderPushPayload(payload: { title?: string; body?: string; route?: string }): Promise<void> {
  await showAppNotification({
    title: payload.title ?? 'التزاماتي',
    body: payload.body ?? '',
    tag: `push-${Date.now()}`,
    route: payload.route ?? '/',
  })
}
