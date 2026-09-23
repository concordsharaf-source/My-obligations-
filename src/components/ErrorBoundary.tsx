import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * شبكة أمان أخيرة: أي خطأ غير متوقع في أي شاشة يعرض واجهة عربية واضحة
 * بدل شاشة بيضاء — مع إعادة محاولة أو عودة للرئيسية. البيانات محفوظة
 * دائمًا في IndexedDB على الجهاز فلا يُفقد شيء.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-extrabold">تعذّر عرض هذه الشاشة</h1>
          <p className="mt-1 max-w-xs text-xs leading-6 text-muted">
            حدث خطأ غير متوقع. بياناتك محفوظة بالكامل على جهازك ولم يُفقد شيء — جرّب إعادة التحميل أو
            العودة إلى الرئيسية.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="tap rounded-xl bg-brand px-4 py-2.5 text-xs font-extrabold text-brandink shadow-sm"
            onClick={() => this.setState({ error: null })}
          >
            إعادة المحاولة
          </button>
          <button
            type="button"
            className="tap rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-extrabold text-ink"
            onClick={() => {
              this.setState({ error: null })
              window.location.hash = '#/'
            }}
          >
            العودة للرئيسية
          </button>
        </div>
        <p dir="ltr" className="max-w-sm truncate text-[9px] text-muted opacity-70">
          {error.message}
        </p>
      </div>
    )
  }
}
