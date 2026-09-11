/// <reference lib="webworker" />
/**
 * Service Worker: offline precache, SPA navigation fallback, notification
 * actions (complete / snooze) handled directly against IndexedDB, and a
 * `push` event handler ready for a future Web Push server.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { clientsClaim } from 'workbox-core'
import { db } from '@/database/db'
import { nowISO } from '@/utils/date'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA: serve the app shell for navigations, network-first so updates land fast
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// runtime caches for anything fetched outside the precache
registerRoute(({ request }) => request.destination === 'font', new CacheFirst({ cacheName: 'fonts' }))
registerRoute(({ request }) => request.destination === 'image', new StaleWhileRevalidate({ cacheName: 'images' }))

void self.skipWaiting()
clientsClaim()

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | undefined
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

interface NotifData {
  route?: string
  obligationId?: string
  baseDate?: string
}

async function setInstanceStatus(obligationId: string, baseDate: string, status: 'completed' | null, snoozeMinutes?: number): Promise<void> {
  const ob = await db.obligations.get(obligationId)
  if (!ob) return
  const prev = ob.overrides[baseDate] ?? {}
  const next = { ...prev }
  if (status) {
    next.status = status
    next.completedAt = nowISO()
  } else if (snoozeMinutes !== undefined) {
    next.snoozedUntil = new Date(Date.now() + snoozeMinutes * 60_000).toISOString()
  }
  await db.obligations.put({ ...ob, overrides: { ...ob.overrides, [baseDate]: next }, updatedAt: nowISO() })
  const wins = await self.clients.matchAll({ type: 'window' })
  for (const win of wins) win.postMessage({ type: 'obligations:changed' })
}

async function openRoute(route: string): Promise<void> {
  const url = new URL(route.startsWith('#') ? route : `#${route}`, self.location.origin)
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const win of wins) {
    if (win.url.includes(self.location.origin)) {
      await win.focus()
      win.navigate(url.pathname + url.hash)
      return
    }
  }
  await self.clients.openWindow(url.pathname + url.hash)
}

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  const data = (event.notification.data ?? {}) as NotifData
  const action = event.action
  event.notification.close()

  if (action === 'complete' && data.obligationId && data.baseDate) {
    event.waitUntil(setInstanceStatus(data.obligationId, data.baseDate, 'completed'))
    return
  }
  if (action === 'snooze60' && data.obligationId && data.baseDate) {
    event.waitUntil(setInstanceStatus(data.obligationId, data.baseDate, null, 60))
    return
  }
  event.waitUntil(openRoute(data.route ?? '/'))
})

self.addEventListener('notificationclose', () => {
  /* no-op: kept for analytics hooks later */
})

/** Web Push ready: payload { title, body, route } from YOUR push server. */
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; route?: string } = {}
  try {
    payload = event.data ? (event.data.json() as typeof payload) : {}
  } catch {
    payload = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'التزاماتي', {
      body: payload.body ?? '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-64.png',
      dir: 'rtl',
      lang: 'ar',
      data: { route: payload.route ?? '/' },
    }),
  )
})
