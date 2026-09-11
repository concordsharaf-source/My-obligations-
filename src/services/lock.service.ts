/**
 * App lock: PIN (PBKDF2-SHA256, never stored in plain text) or WebAuthn/biometrics
 * when the platform supports it. Everything stays on-device.
 */
import { settingsRepo } from '@/repositories/settings.repo'
import { randomToken } from '@/utils/ids'

const ITERATIONS = 150_000

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes.buffer
}

async function pbkdf2(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(saltHex), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return bufToHex(bits)
}

export const lockService = {
  async setPin(pin: string): Promise<void> {
    if (!/^\d{4,8}$/.test(pin)) throw new Error('الرمز يجب أن يكون 4-8 أرقام')
    const salt = randomToken(16)
    const hash = await pbkdf2(pin, salt)
    const settings = await settingsRepo.get()
    await settingsRepo.put({
      ...settings,
      lock: { ...settings.lock, mode: 'pin', pinHash: hash, pinSalt: salt },
      updatedAt: new Date().toISOString(),
    })
  },

  async verifyPin(pin: string): Promise<boolean> {
    const settings = await settingsRepo.get()
    if (!settings.lock.pinHash || !settings.lock.pinSalt) return false
    const hash = await pbkdf2(pin, settings.lock.pinSalt)
    // constant-time-ish compare
    if (hash.length !== settings.lock.pinHash.length) return false
    let diff = 0
    for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ settings.lock.pinHash.charCodeAt(i)
    return diff === 0
  },

  async disable(): Promise<void> {
    const settings = await settingsRepo.get()
    await settingsRepo.put({
      ...settings,
      lock: { ...settings.lock, mode: 'none', pinHash: null, pinSalt: null, credentialId: null },
      updatedAt: new Date().toISOString(),
    })
  },

  canWebAuthn(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof crypto !== 'undefined' &&
      !!crypto.subtle
    )
  },

  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.canWebAuthn()) return false
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch {
      return false
    }
  },

  async registerWebAuthn(): Promise<boolean> {
    if (!this.canWebAuthn()) return false
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const userId = crypto.getRandomValues(new Uint8Array(16))
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'التزاماتي' },
          user: { id: userId, name: 'local-user', displayName: 'مستخدم التزاماتي' },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null
      if (!cred) return false
      const settings = await settingsRepo.get()
      const idB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)))
      await settingsRepo.put({
        ...settings,
        lock: { ...settings.lock, mode: 'webauthn', credentialId: idB64 },
        updatedAt: new Date().toISOString(),
      })
      return true
    } catch {
      return false
    }
  },

  async verifyWebAuthn(): Promise<boolean> {
    const settings = await settingsRepo.get()
    if (!settings.lock.credentialId || !this.canWebAuthn()) return false
    try {
      const raw = atob(settings.lock.credentialId)
      const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0))
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: bytes }],
          userVerification: 'required',
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null
      return !!assertion
    } catch {
      return false
    }
  },
}
