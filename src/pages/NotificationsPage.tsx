import { useMemo, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataBundle } from '@/hooks/useLiveData'
import { useSettings } from '@/store/settings.store'
import { collectDueReminders } from '@/notifications/scheduler'
import { permissionState, requestPermission, showAppNotification } from '@/notifications/notify'
import { Badge, Button, Card, EmptyState, SectionTitle } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { formatDateTime } from '@/utils/date'

export default function NotificationsPage(): JSX.Element {
  const navigate = useNavigate()
  const bundle = useDataBundle()
  const settings = useSettings()
  const perm = permissionState()

  const upcoming = useMemo(() => {
    if (!bundle.ready) return []
    return collectDueReminders({ obligations: bundle.obligations, payments: bundle.payments, settings })
      .slice(0, 20)
  }, [bundle, settings])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="px-1 text-base font-extrabold">الإشعارات</h1>

      <Card className="flex items-center gap-3 p-4">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${perm === 'granted' ? 'bg-oksoft text-ok' : 'bg-warnsoft text-warn'}`}>
          <Icon name="bell" size={19} />
        </span>
        <div className="flex-1">
          <div className="text-xs font-extrabold">حالة الإذن: {perm === 'granted' ? 'ممنوح' : perm === 'denied' ? 'مرفوض' : perm === 'unsupported' ? 'غير مدعوم' : 'لم يُطلب بعد'}</div>
          <div className="text-[10px] text-muted">التنبيهات تعمل محليًا حتى بدون إنترنت</div>
        </div>
        {perm !== 'granted' ? (
          <Button size="sm" onClick={() => void requestPermission()}>
            تفعيل
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void showAppNotification({ title: 'إشعار تجريبي', body: 'كل شيء يعمل 🔔', tag: 'test' })}>
            تجربة
          </Button>
        )}
      </Card>

      <div>
        <SectionTitle
          action={
            <button type="button" className="tap text-[11px] font-bold text-brand" onClick={() => navigate('/settings')}>
              إعدادات الملخص
            </button>
          }
        >
          تنبيهات قادمة ({upcoming.length})
        </SectionTitle>
        {upcoming.length === 0 ? (
          <EmptyState icon="bell" title="لا تنبيهات معلّقة" hint="أضف تنبيهات لأي التزام من نموذج الإضافة." />
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((r) => (
              <Card key={r.key} className="flex items-center gap-2 p-3">
                <Badge tone={r.title.startsWith('تأخر') ? 'danger' : 'brand'}>{r.title}</Badge>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{r.body}</span>
                <span className="shrink-0 text-[10px] text-muted">{formatDateTime(r.dueAt.toISOString())}</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
