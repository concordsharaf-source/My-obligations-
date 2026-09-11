/** Tiny class-name combiner (no dependency). */
export type ClassValue = string | number | null | false | undefined | ClassValue[]

export function cn(...values: ClassValue[]): string {
  const out: string[] = []
  const walk = (v: ClassValue): void => {
    if (v === null || v === undefined || v === false || v === '') return
    if (Array.isArray(v)) {
      v.forEach(walk)
      return
    }
    out.push(String(v))
  }
  values.forEach(walk)
  return out.join(' ')
}
