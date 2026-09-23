#!/usr/bin/env node
/**
 * توليد زوج مفاتيح VAPID (P-256) بصيغة web-push — بدون أي تبعيات.
 *
 *   node scripts/generate-vapid.mjs
 *
 * الناتج:
 *   - Public key  (base64url, 65 بايت نقطة غير مضغوطة) → يُلصق في إعدادات التطبيق
 *     ويُحفظ في متغير بيئة الخادم VAPID_PUBLIC_KEY.
 *   - Private key (base64url, 32 بايت)                 → سرّ الخادم VAPID_PRIVATE_KEY فقط.
 *
 * ⚠️ لا تضع المفتاح الخاص في المستودع أو في واجهة التطبيق أبدًا.
 */
import { generateKeyPairSync } from 'node:crypto'

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })

// SPKI DER: آخر 65 بايت هي النقطة العامة غير المضغوطة (0x04 || X || Y)
const spki = publicKey.export({ format: 'der', type: 'spki' })
const rawPublic = spki.subarray(spki.length - 65)
if (rawPublic[0] !== 0x04) {
  console.error('unexpected public point format')
  process.exit(1)
}

// JWK: الحقل d هو المفتاح الخاص (32 بايت، base64url بالفعل)
const jwk = privateKey.export({ format: 'jwk' })

console.log('VAPID_PUBLIC_KEY=' + rawPublic.toString('base64url'))
console.log('VAPID_PRIVATE_KEY=' + jwk.d)
console.log('')
console.log('Public key length (bytes):', rawPublic.length)
