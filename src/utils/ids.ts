/** Stable, collision-resistant id generation (works offline, no server). */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** time-sortable id: base36 timestamp + random suffix */
export function newId(): string {
  const t = Date.now().toString(36)
  let rand = ''
  for (let i = 0; i < 8; i++) {
    const arr = new Uint8Array(1)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr)
    else arr[0] = Math.floor(Math.random() * 256)
    rand += ALPHABET[arr[0] % 32]
  }
  return `${t}${rand}`
}

export function randomToken(bytes = 16): string {
  return randomHex(bytes)
}
