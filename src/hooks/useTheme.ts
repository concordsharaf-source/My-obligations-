import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings.store'

/** Applies light/dark/system theme to <html data-theme>. */
export function useTheme(): void {
  const theme = useSettingsStore((s) => s.settings.theme)
  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      root.dataset.theme = dark ? 'dark' : 'light'
      const meta = document.querySelector('meta[name="theme-color"][media]')
      void meta
      root.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
