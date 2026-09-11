import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { useUIStore } from '@/store/ui.store'
import { useSettingsStore } from '@/store/settings.store'

const LINKS = [
  { to: '/budget', icon: 'wallet', label: 'ميزانيتي', desc: 'الدخل والالتزامات والرسوم البيانية', tone: 'bg-brandsoft text-brand' },
  { to: '/people', icon: 'users', label: 'الأشخاص', desc: 'الأرصدة والديون المرتبطة', tone: 'bg-infosoft text-info' },
  { to: '/categories', icon: 'tag', label: 'التصنيفات', desc: 'أضف وعدّل تصنيفاتك', tone: 'bg-warnsoft text-warn' },
  { to: '/stats', icon: 'chart', label: 'الإحصائيات', desc: 'أرقامك وتطور وضعك المالي', tone: 'bg-oksoft text-ok' },
  { to: '/suggestions', icon: 'bulb', label: 'اقتراحات التزاماتي', desc: 'تحليل محلي ذكي لبياناتك', tone: 'bg-warnsoft text-warn' },
  { to: '/search', icon: 'search', label: 'بحث شامل', desc: 'بحث وفلاتر في كل شيء', tone: 'bg-infosoft text-info' },
  { to: '/activity', icon: 'history', label: 'السجل', desc: 'كل عمليات الإضافة والتعديل والدفع', tone: 'bg-card2 text-muted' },
  { to: '/backup', icon: 'database', label: 'النسخ الاحتياطي', desc: 'تصدير واستيراد JSON وCSV', tone: 'bg-brandsoft text-brand' },
  { to: '/trash', icon: 'trash', label: 'سلة المحذوفات', desc: 'استرجاع العناصر المحذوفة', tone: 'bg-dangersoft text-danger' },
  { to: '/notifications', icon: 'bell', label: 'الإشعارات', desc: 'الأذونات والملخص اليومي', tone: 'bg-warnsoft text-warn' },
  { to: '/settings', icon: 'settings', label: 'الإعدادات', desc: 'المظهر والعملات والقفل', tone: 'bg-card2 text-muted' },
]

export default function MorePage(): JSX.Element {
  const navigate = useNavigate()
  const installPrompt = useUIStore((s) => s.installPrompt)
  const setInstallPrompt = useUIStore((s) => s.setInstallPrompt)
  const setLocked = useUIStore((s) => s.setLocked)
  const settings = useSettingsStore((s) => s.settings)

  return (
    <div className="flex flex-col gap-3">
      <h1 className="px-1 text-base font-extrabold">المزيد</h1>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Card key={l.to} className="tap flex items-center gap-3 p-3" onClick={() => navigate(l.to)}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${l.tone}`}>
              <Icon name={l.icon} size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{l.label}</span>
              <span className="block truncate text-[11px] text-muted">{l.desc}</span>
            </span>
            <Icon name="chevron-left" size={15} className="text-muted" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {installPrompt ? (
          <Card
            className="tap flex items-center gap-2 p-3"
            onClick={() => {
              void installPrompt.prompt()
              setInstallPrompt(null)
            }}
          >
            <Icon name="download" size={17} className="text-brand" />
            <span className="text-xs font-bold">تثبيت التطبيق</span>
          </Card>
        ) : null}
        {settings.lock.mode !== 'none' ? (
          <Card className="tap flex items-center gap-2 p-3" onClick={() => setLocked(true)}>
            <Icon name="lock" size={17} className="text-danger" />
            <span className="text-xs font-bold">قفل الآن</span>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
