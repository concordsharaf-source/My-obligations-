/**
 * خادم Web Push لتطبيق «التزاماتي» — Cloudflare Worker (مجاني بالكامل).
 *
 * النقاط:
 *   GET    /health   → حالة الخادم وعدد الاشتراكات
 *   POST   /register → يستقبل {subscription} من التطبيق ويخزنه في KV
 *   DELETE /register → (محمي بـ ADMIN_TOKEN) يحذف اشتراكًا بـ {endpoint}
 *   POST   /send     → (محمي بـ ADMIN_TOKEN) يرسل إشعارًا لكل الاشتراكات
 *                       أو لاشتراك محدد: {title, body, route, ttl, endpoint}
 *
 * الأسرار عبر env (wrangler secret put):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ADMIN_TOKEN, VAPID_SUBJECT (اختياري)
 */
import { buildPushPayload } from '@block65/webcrypto-web-push'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  })
}

function authorized(request, env) {
  const header = request.headers.get('Authorization') || ''
  return Boolean(env.ADMIN_TOKEN) && header === `Bearer ${env.ADMIN_TOKEN}`
}

async function keyForEndpoint(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return (
    'sub:' +
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

function validSubscription(sub) {
  return (
    sub &&
    typeof sub.endpoint === 'string' &&
    sub.endpoint.startsWith('https://') &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  )
}

async function listAllSubs(kv) {
  const out = []
  let cursor
  do {
    const page = await kv.list({ cursor, limit: 1000 })
    for (const k of page.keys) {
      const raw = await kv.get(k.name)
      if (raw) out.push({ key: k.name, sub: JSON.parse(raw) })
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
      return json({ ok: false, error: 'الخادم غير مهيأ: أضف VAPID_PUBLIC_KEY وVAPID_PRIVATE_KEY' }, 500)
    }
    const vapid = {
      subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    }

    // ---- health ----
    if (path === '/health' || path === '/') {
      const subs = await listAllSubs(env.SUBS)
      return json({
        ok: true,
        service: 'my-obligations-push',
        subscriptions: subs.length,
        endpoints: { register: 'POST /register', send: 'POST /send (Bearer ADMIN_TOKEN)' },
      })
    }

    // ---- register (open: subscription itself is the credential) ----
    if (path === '/register' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ ok: false, error: 'JSON غير صالح' }, 400)
      }
      const sub = body && body.subscription
      if (!validSubscription(sub)) {
        return json({ ok: false, error: 'subscription غير صالح' }, 400)
      }
      await env.SUBS.put(await keyForEndpoint(sub.endpoint), JSON.stringify(sub))
      return json({ ok: true })
    }

    // ---- unregister (admin) ----
    if (path === '/register' && request.method === 'DELETE') {
      if (!authorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401)
      let body
      try {
        body = await request.json()
      } catch {
        return json({ ok: false, error: 'JSON غير صالح' }, 400)
      }
      if (!body || typeof body.endpoint !== 'string') return json({ ok: false, error: 'endpoint مطلوب' }, 400)
      await env.SUBS.delete(await keyForEndpoint(body.endpoint))
      return json({ ok: true })
    }

    // ---- send (admin) ----
    if (path === '/send' && request.method === 'POST') {
      if (!authorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401)
      let body
      try {
        body = await request.json()
      } catch {
        body = {}
      }
      const data = JSON.stringify({
        title: typeof body.title === 'string' && body.title ? body.title : 'التزاماتي',
        body: typeof body.body === 'string' ? body.body : '',
        route: typeof body.route === 'string' && body.route ? body.route : '/',
      })
      const message = { data, options: { ttl: Number.isFinite(body.ttl) ? body.ttl : 3600 } }

      const subs = await listAllSubs(env.SUBS)
      let sent = 0
      let failed = 0
      let stale = 0
      for (const { key, sub } of subs) {
        if (typeof body.endpoint === 'string' && body.endpoint && sub.endpoint !== body.endpoint) continue
        try {
          const payload = await buildPushPayload(message, sub, vapid)
          const res = await fetch(sub.endpoint, payload)
          if (res.status === 404 || res.status === 410) {
            await env.SUBS.delete(key) // اشتراك منتهي — نظّفه
            stale += 1
            failed += 1
          } else if (res.ok || res.status === 201) {
            sent += 1
          } else {
            failed += 1
          }
        } catch {
          failed += 1
        }
      }
      return json({ ok: true, sent, failed, stale, total: subs.length })
    }

    return json({ ok: false, error: 'not found' }, 404)
  },
}
