import { useState, type JSX } from 'react'
import { lockService } from '@/services/lock.service'
import { useSettings } from '@/store/settings.store'
import { useUIStore } from '@/store/ui.store'
import { Button } from '@/components/ui/primitives'
import { TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'

export function LockScreen(): JSX.Element {
  const settings = useSettings()
  const setLocked = useUIStore((s) => s.setLocked)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const unlockPin = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const ok = await lockService.verifyPin(pin)
    setBusy(false)
    if (ok) setLocked(false)
    else setError('رمز غير صحيح')
  }

  const unlockBio = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const ok = await lockService.verifyWebAuthn()
    setBusy(false)
    if (ok) setLocked(false)
    else setError('تعذّر التحقق بالبصمة')
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-surface px-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brandsoft text-brand">
        <Icon name={settings.lock.mode === 'webauthn' ? 'fingerprint' : 'lock'} size={30} />
      </span>
      <div className="text-lg font-extrabold">التطبيق مقفل</div>
      {settings.lock.mode === 'pin' ? (
        <form
          className="flex w-full max-w-xs flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void unlockPin()
          }}
        >
          <TextInput
            type="password"
            inputMode="numeric"
            dir="ltr"
            autoFocus
            maxLength={8}
            placeholder="••••"
            value={pin}
            invalid={!!error}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
          {error ? <div className="text-center text-xs font-bold text-danger">{error}</div> : null}
          <Button type="submit" disabled={busy || pin.length < 4}>
            فتح
          </Button>
        </form>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          {error ? <div className="text-center text-xs font-bold text-danger">{error}</div> : null}
          <Button icon="fingerprint" disabled={busy} onClick={() => void unlockBio()}>
            فتح بالبصمة
          </Button>
        </div>
      )}
    </div>
  )
}
