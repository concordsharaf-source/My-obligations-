/**
 * PWA wiring: service-worker registration with update prompt,
 * install prompt capture, and SW→client messaging.
 */
import { registerSW } from 'virtual:pwa-register'
import { useUIStore, type BeforeInstallPromptEvent } from '@/store/ui.store'
import { showToast } from '@/store/ui.store'

export function setupPWA(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      useUIStore.getState().setUpdate(true, () => updateSW(true))
    },
    onOfflineReady() {
      showToast('التطبيق جاهز للعمل بدون إنترنت', 'success', { durationMs: 3000 })
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      // check for updates hourly
      window.setInterval(() => void reg.update(), 60 * 60 * 1000)
    },
    onRegisterError(error) {
      console.warn('SW registration failed', error)
    },
  })

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    useUIStore.getState().setInstallPrompt(e as BeforeInstallPromptEvent)
  })

  window.addEventListener('appinstalled', () => {
    useUIStore.getState().setInstallPrompt(null)
    showToast('تم تثبيت التطبيق بنجاح 🎉', 'success')
  })

  // SW tells us when data changed from a notification action
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined
      if (data?.type === 'obligations:changed') {
        window.dispatchEvent(new Event('obligations:changed'))
      }
    })
  }
}
