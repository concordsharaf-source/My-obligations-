import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function Boom(): never {
  throw new Error('test crash')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('يعرض واجهة طوارئ عربية بدل الشاشة البيضاء عند أي خطأ', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('تعذّر عرض هذه الشاشة')).toBeInTheDocument()
    expect(screen.getByText(/بياناتك محفوظة بالكامل على جهازك/)).toBeInTheDocument()
    expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument()
    expect(screen.getByText('العودة للرئيسية')).toBeInTheDocument()
  })

  it('زر «إعادة المحاولة» يعيد ضبط الحالة (لا يبقى عالقًا)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { rerender } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    screen.getByText('إعادة المحاولة').click()
    // بعد إعادة الضبط سيُرمي الطفل الخطأ مجددًا فتظهر الواجهة مرة أخرى — المهم أنها استجابت
    rerender(
      <ErrorBoundary>
        <div>OK_NOW</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('OK_NOW')).toBeInTheDocument()
  })

  it('يمرر الأطفال الطبيعيين بدون تدخل', () => {
    render(
      <ErrorBoundary>
        <div>EVERYTHING_FINE</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('EVERYTHING_FINE')).toBeInTheDocument()
    expect(screen.queryByText('تعذّر عرض هذه الشاشة')).not.toBeInTheDocument()
  })
})
