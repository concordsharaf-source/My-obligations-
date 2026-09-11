/** Money helpers: rounding, formatting and a currency registry (extendable by the user). */

export const CURRENCY_META: Record<string, { symbol: string; name: string }> = {
  YER: { symbol: 'ر.ي', name: 'ريال يمني' },
  SAR: { symbol: 'ر.س', name: 'ريال سعودي' },
  USD: { symbol: '$', name: 'دولار أمريكي' },
  AED: { symbol: 'د.إ', name: 'درهم إماراتي' },
  KWD: { symbol: 'د.ك', name: 'دينار كويتي' },
  QAR: { symbol: 'ر.ق', name: 'ريال قطري' },
  EUR: { symbol: '€', name: 'يورو' },
  EGP: { symbol: 'ج.م', name: 'جنيه مصري' },
  JOD: { symbol: 'د.أ', name: 'دينار أردني' },
  OMR: { symbol: 'ر.ع', name: 'ريال عماني' },
  BHD: { symbol: 'د.ب', name: 'دينار بحريني' },
  TRY: { symbol: '₺', name: 'ليرة تركية' },
}

const fmt = new Intl.NumberFormat('ar-u-nu-latn', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const fmtCompact = new Intl.NumberFormat('ar-u-nu-latn', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Round to 2 decimals, guarding float noise. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatMoney(n: number): string {
  return fmt.format(round2(n))
}

export function formatMoneyCompact(n: number): string {
  if (Math.abs(n) >= 10_000) return fmtCompact.format(round2(n))
  return fmt.format(round2(n))
}

export function currencySymbol(code: string): string {
  return CURRENCY_META[code]?.symbol ?? code
}

export function currencyName(code: string): string {
  return CURRENCY_META[code]?.name ?? code
}

export function formatAmount(n: number, code: string): string {
  return `${formatMoney(n)} ${currencySymbol(code)}`
}

export function formatAmountCompact(n: number, code: string): string {
  return `${formatMoneyCompact(n)} ${currencySymbol(code)}`
}

export function formatPercent(n: number): string {
  return `${fmt.format(round2(n))}%`
}

/** Parse a user-typed amount; returns null when invalid. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[٬,\s_]/g, '').replace(/[٫]/g, '.')
  if (cleaned === '' || cleaned === '.') return null
  if (!/^\d*\.?\d*$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return round2(n)
}

/** Convert Arabic-Indic digits to latin so numeric inputs behave everywhere. */
export function normalizeDigits(raw: string): string {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9',
  }
  return raw.replace(/[٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹]/g, (d) => map[d] ?? d)
}
