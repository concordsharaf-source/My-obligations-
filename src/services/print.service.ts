/** Printing: navigates to a dedicated print route; Print CSS hides all app chrome. */

export type PrintReport = 'debts' | 'month' | 'person' | 'budget'

export function openPrintReport(report: PrintReport, param?: string): void {
  const query = param ? `?id=${encodeURIComponent(param)}` : ''
  const hash = `#/print/${report}${query}`
  if (window.location.hash === hash) {
    window.setTimeout(() => window.print(), 120)
    return
  }
  window.location.hash = hash
}
