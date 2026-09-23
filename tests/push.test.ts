import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendSubscriptionToServer } from '@/notifications/push'
import { settingsSchema } from '@/models/schemas'

const SUB_KEY = 'my-obligations:push-subscription'
const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'BNcRdreALRFXTkOOpJHLxH3b', auth: 'sbxTACqqVvvYaTzjyQWa2Q' },
}

function mockFetch(impl: () => Promise<Response>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sendSubscriptionToServer', () => {
  it('بدون رابط خادم → no-url', async () => {
    expect(await sendSubscriptionToServer('   ')).toBe('no-url')
  })

  it('بدون اشتراك محفوظ → no-sub', async () => {
    expect(await sendSubscriptionToServer('https://push.example.dev')).toBe('no-sub')
  })

  it('بدون اتصال → offline (ولا يحاول fetch إطلاقًا)', async () => {
    localStorage.setItem(SUB_KEY, JSON.stringify(SUB))
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const fn = mockFetch(async () => new Response('{}', { status: 200 }))
    expect(await sendSubscriptionToServer('https://push.example.dev')).toBe('offline')
    expect(fn).not.toHaveBeenCalled()
  })

  it('يرسل POST /register بحمولة الاشتراك → sent', async () => {
    localStorage.setItem(SUB_KEY, JSON.stringify(SUB))
    const fn = mockFetch(async () => new Response('{"ok":true}', { status: 200 }))
    expect(await sendSubscriptionToServer('https://push.example.dev/')).toBe('sent')
    expect(fn).toHaveBeenCalledOnce()
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://push.example.dev/register') // الشريطة الأخيرة تُطبع
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ subscription: SUB })
  })

  it('استجابة خادم خاطئة → failed', async () => {
    localStorage.setItem(SUB_KEY, JSON.stringify(SUB))
    mockFetch(async () => new Response('boom', { status: 500 }))
    expect(await sendSubscriptionToServer('https://push.example.dev')).toBe('failed')
  })

  it('خطأ شبكة → failed (لا يرمي استثناءً)', async () => {
    localStorage.setItem(SUB_KEY, JSON.stringify(SUB))
    mockFetch(async () => {
      throw new TypeError('network down')
    })
    expect(await sendSubscriptionToServer('https://push.example.dev')).toBe('failed')
  })
})

describe('إعدادات Push في المخطط', () => {
  it('الافتراضيات تتضمن قسم push فارغًا', () => {
    const s = settingsSchema.parse({})
    expect(s.push).toEqual({ vapidPublicKey: '', serverUrl: '' })
  })

  it('نسخة احتياطية قديمة بدون push تُستورد وتتعبأ الافتراضيات (توافق خلفي)', () => {
    const s = settingsSchema.parse({ id: 1, userName: 'قديم', currency: 'YER' })
    expect(s.userName).toBe('قديم')
    expect(s.push.vapidPublicKey).toBe('')
    expect(s.push.serverUrl).toBe('')
  })

  it('يحفظ القيم المُدخلة', () => {
    const s = settingsSchema.parse({
      push: { vapidPublicKey: 'BPK', serverUrl: 'https://push.example.dev' },
    })
    expect(s.push.vapidPublicKey).toBe('BPK')
    expect(s.push.serverUrl).toBe('https://push.example.dev')
  })
})
