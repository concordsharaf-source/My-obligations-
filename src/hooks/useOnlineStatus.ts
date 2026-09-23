import { useEffect, useState } from 'react'

/**
 * حالة الاتصال بالشبكة — للتوضيح فقط. التطبيق يعمل بالكامل بدون إنترنت؛
 * الشبكة مطلوبة فقط للتحميل الأول/التحديثات واشتراك Web Push الاختياري.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine)

  useEffect(() => {
    const goOnline = (): void => setOnline(true)
    const goOffline = (): void => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
