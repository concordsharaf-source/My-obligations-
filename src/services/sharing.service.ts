/** Web Share API with clipboard fallback (required on some Android WebViews / desktops). */

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (canShare()) {
      await navigator.share({ title, text })
      return 'shared'
    }
  } catch (err) {
    // user cancelled → fall through to clipboard
    if (err instanceof DOMException && err.name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function buildDebtShareText(args: {
  title: string
  amount: number
  remaining: number
  dueDate: string
  currencyLabel: string
  direction: 'owe' | 'owed'
  personName?: string
}): string {
  const { title, amount, remaining, dueDate, currencyLabel, direction, personName } = args
  const lines = [
    personName ? `${direction === 'owe' ? 'دين لـ' : 'دين على'} ${personName} — ${title}` : title,
    `المبلغ: ${amount} ${currencyLabel}`,
    `المتبقي: ${remaining} ${currencyLabel}`,
    `موعد السداد: ${dueDate}`,
  ]
  return lines.join('\n')
}
