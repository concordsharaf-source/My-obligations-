/**
 * Gatekeeper behaviour tests — the gatekeeper is a framework-free classic
 * script (public/gatekeeper/app.js); we execute it inside jsdom via node:vm.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const CODE = readFileSync(resolve(process.cwd(), 'public/gatekeeper/app.js'), 'utf8')

const GATE_HTML = `
<div id="install-screen" data-ui="loading">
  <button id="gk-install-button" type="button"></button>
  <button id="gk-continue" type="button"></button>
</div>
<div id="app-content"></div>
`

interface DeferredStub {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function makeDeferred(outcome: 'accepted' | 'dismissed'): DeferredStub {
  return {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  }
}

function stubMatchMedia(standalone: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: standalone && /standalone|window-controls-overlay/.test(query),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function setUA(ua: string, platform = ''): void {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true })
}

function runGatekeeper(): void {
  vm.runInThisContext(CODE, { filename: 'gatekeeper/app.js' })
}

function screenEl(): HTMLElement {
  return document.getElementById('install-screen') as HTMLElement
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = GATE_HTML
  document.documentElement.removeAttribute('data-mode')
  document.documentElement.removeAttribute('data-gate')
  window.sessionStorage.clear()
  delete (window as unknown as { __gkDeferred?: unknown }).__gkDeferred
  Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true })
  stubMatchMedia(false)
  setUA('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PWA install gatekeeper', () => {
  it('browser mode: shows install screen, hides app content (CSS contract)', () => {
    runGatekeeper()
    expect(document.documentElement.getAttribute('data-mode')).toBe('browser')
    expect(screenEl().getAttribute('data-ui')).toBe('loading')
    // the visibility contract is CSS-driven in index.html:
    // html[data-mode="browser"]:not([data-gate="dismissed"]) #app-content { display:none }
    expect(document.documentElement.getAttribute('data-gate')).toBeNull()
  })

  it('falls back to manual instructions when no beforeinstallprompt arrives', () => {
    runGatekeeper()
    vi.advanceTimersByTime(2600)
    expect(screenEl().getAttribute('data-ui')).toBe('manual')
  })

  it('binds beforeinstallprompt to the install button and reveals on accept', async () => {
    runGatekeeper()
    const deferred = makeDeferred('accepted')
    const event = new CustomEvent('beforeinstallprompt', { cancelable: true })
    Object.assign(event, deferred)
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(screenEl().getAttribute('data-ui')).toBe('prompt')

    document.getElementById('gk-install-button')!.click()
    await vi.waitFor(() => {
      expect(document.documentElement.getAttribute('data-gate')).toBe('dismissed')
    })
    expect(deferred.prompt).toHaveBeenCalled()
    expect(screenEl().getAttribute('data-ui')).toBe('done')
    expect(window.sessionStorage.getItem('my-obligations:gate')).toBe('dismissed')
  })

  it('reveals the app when the user dismisses the native prompt', async () => {
    runGatekeeper()
    const deferred = makeDeferred('dismissed')
    const event = new CustomEvent('beforeinstallprompt', { cancelable: true })
    Object.assign(event, deferred)
    window.dispatchEvent(event)
    document.getElementById('gk-install-button')!.click()
    await vi.waitFor(() => {
      expect(document.documentElement.getAttribute('data-gate')).toBe('dismissed')
    })
  })

  it('iOS Safari: shows Add-to-Home-Screen steps instead of the install button', () => {
    setUA(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    )
    runGatekeeper()
    expect(screenEl().getAttribute('data-ui')).toBe('ios')
    vi.advanceTimersByTime(3000)
    expect(screenEl().getAttribute('data-ui')).toBe('ios') // never flips to manual/prompt
  })

  it('iPadOS (MacIntel + touch) is treated as iOS', () => {
    setUA(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
      'MacIntel',
    )
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true })
    runGatekeeper()
    expect(screenEl().getAttribute('data-ui')).toBe('ios')
  })

  it('standalone (installed): no gate at all', () => {
    stubMatchMedia(true)
    runGatekeeper()
    expect(document.documentElement.getAttribute('data-mode')).toBe('standalone')
    expect(document.documentElement.getAttribute('data-gate')).toBeNull()
    expect(screenEl().getAttribute('data-ui')).toBe('loading') // untouched
  })

  it('navigator.standalone (iOS launched from home screen) counts as installed', () => {
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true })
    runGatekeeper()
    expect(document.documentElement.getAttribute('data-mode')).toBe('standalone')
  })

  it('session-dismissed users skip the gate', () => {
    window.sessionStorage.setItem('my-obligations:gate', 'dismissed')
    document.documentElement.setAttribute('data-gate', 'dismissed') // inline head script does this pre-paint
    runGatekeeper()
    expect(document.documentElement.getAttribute('data-mode')).toBe('browser')
    expect(screenEl().getAttribute('data-ui')).toBe('loading') // never switched on
  })

  it('"continue in browser" reveals the app and remembers the choice', () => {
    runGatekeeper()
    document.getElementById('gk-continue')!.click()
    expect(document.documentElement.getAttribute('data-gate')).toBe('dismissed')
    expect(window.sessionStorage.getItem('my-obligations:gate')).toBe('dismissed')
  })

  it('appinstalled event reveals the app', () => {
    runGatekeeper()
    window.dispatchEvent(new Event('appinstalled'))
    expect(document.documentElement.getAttribute('data-gate')).toBe('dismissed')
  })
})
