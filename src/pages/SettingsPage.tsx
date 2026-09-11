import { useState, type JSX } from 'react'
import { useSettingsStore } from '@/store/settings.store'
import { useUIStore, showToast } from '@/store/ui.store'
import { lockService } from '@/services/lock.service'
import { requestPermission, permissionState, showAppNotification } from '@/notifications/notify'
import { subscribe, unsubscribe, pushSupported, exportSubscriptionForServer } from '@/notifications/push'
import { Button, Card, SectionTitle, Switch } from '@/components/ui/primitives'
import { ConfirmDialog, Sheet } from '@/components/ui/overlays'
import { Field, Select, TextInput } from '@/components/ui/fields'
import { Icon } from '@/components/ui/Icon'
import { CURRENCY_META } from '@/utils/money'
import { notifyDataChanged } from '@/notifications/scheduler'

export default function SettingsPage(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const setLocked = useUIStore((s) => s.setLocked)
  const [pinOpen, setPinOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [newCurrency, setNewCurrency] = useState('')
  const [vapid, setVapid] = useState('')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="px-1 text-base font-extrabold">الإعدادات</h1>

      <div>
        <SectionTitle>عام</SectionTitle>
        <Card className="flex flex-col gap-3 p-4">
          <Field label="اسمك (للتحية)">
            <TextInput value={settings.userName} maxLength={60} onChange={(e) => void update({ userName: e.target.value }, 'غيّر الاسم')} />
          </Field>
          <Field label="المظهر">
            <Select value={settings.theme} onChange={(e) => void update({ theme: e.target.value as 'light' | 'dark' | 'system' }, 'غيّر المظهر')}>
              <option value="light">فاتح</option>
              <option value="dark">داكن</option>
              <option value="system">حسب النظام</option>
            </Select>
          </Field>
          <Field label="العملة الافتراضية">
            <Select value={settings.currency} onChange={(e) => void update({ currency: e.target.value }, 'غيّر العملة')}>
              {settings.currencies.map((c) => (
                <option key={c} value={c}>
                  {c} — {CURRENCY_META[c]?.name ?? c}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <TextInput placeholder="أضف عملة (رمز مثل YER)" value={newCurrency} maxLength={8} onChange={(e) => setNewCurrency(e.target.value.toUpperCase())} />
            <Button
              variant="outline"
              icon="plus"
              onClick={() => {
                const c = newCurrency.trim()
                if (!c || settings.currencies.includes(c)) return
                void update({ currencies: [...settings.currencies, c] }, `أضاف عملة ${c}`)
                setNewCurrency('')
                showToast('تمت إضافة العملة', 'success')
              }}
            >
              إضافة
            </Button>
          </div>
          <Field label="بداية الأسبوع">
            <Select value={String(settings.weekStartsOn)} onChange={(e) => void update({ weekStartsOn: Number(e.target.value) as 0 | 1 | 6 }, 'غيّر بداية الأسبوع')}>
              <option value="6">السبت</option>
              <option value="0">الأحد</option>
              <option value="1">الإثنين</option>
            </Select>
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">مؤشر المتاح اليومي</span>
            <Switch checked={settings.dailyAllowance} onChange={(v) => void update({ dailyAllowance: v }, 'بدّل المتاح اليومي')} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">دمج التنبيهات المتقاربة</span>
            <Switch checked={settings.grouping} onChange={(v) => void update({ grouping: v }, 'بدّل دمج التنبيهات')} />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>عتبات مؤشر الميزانية (%)</SectionTitle>
        <Card className="grid grid-cols-3 gap-2 p-4">
          {(
            [
              ['comfortable', 'مريح حتى'],
              ['attention', 'انتباه حتى'],
              ['tight', 'مضغوطة حتى'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <TextInput
                inputMode="numeric"
                value={String(settings.budgetThresholds[key])}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/\D/g, ''))
                  if (v >= 1 && v <= 100) void update({ budgetThresholds: { ...settings.budgetThresholds, [key]: v } }, 'عدّل عتبات الميزانية')
                }}
              />
            </Field>
          ))}
        </Card>
      </div>

      <div>
        <SectionTitle>الإشعارات</SectionTitle>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">إذن الإشعارات: {permissionState() === 'granted' ? 'ممنوح ✓' : permissionState()}</span>
            <Button
              size="sm"
              variant="soft"
              onClick={async () => {
                const res = await requestPermission()
                showToast(res === 'granted' ? 'تم منح الإذن' : 'لم يُمنح الإذن', res === 'granted' ? 'success' : 'warning')
              }}
            >
              طلب الإذن
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            icon="bell"
            onClick={() => void showAppNotification({ title: 'اختبار الإشعارات', body: 'هكذا سيبدو تنبيه التزاماتك 🔔', tag: 'test' })}
          >
            إرسال إشعار تجريبي
          </Button>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">الملخص الصباحي</span>
            <Switch checked={settings.digest.morning} onChange={(v) => void update({ digest: { ...settings.digest, morning: v } }, 'بدّل الملخص الصباحي')} />
          </div>
          <TextInput type="time" value={settings.digest.morningTime} onChange={(e) => void update({ digest: { ...settings.digest, morningTime: e.target.value } }, 'عدّل وقت الملخص الصباحي')} />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">الملخص المسائي</span>
            <Switch checked={settings.digest.evening} onChange={(v) => void update({ digest: { ...settings.digest, evening: v } }, 'بدّل الملخص المسائي')} />
          </div>
          <TextInput type="time" value={settings.digest.eveningTime} onChange={(e) => void update({ digest: { ...settings.digest, eveningTime: e.target.value } }, 'عدّل وقت الملخص المسائي')} />
        </Card>
      </div>

      <div>
        <SectionTitle>Web Push (اختياري — يتطلب خادومًا خارجيًا)</SectionTitle>
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-[11px] leading-5 text-muted">
            التنبيهات المحلية تعمل بدون أي خادوم. لتفعيل Push الحقيقي في الخلفية تحتاج خادوم إرسال بمفاتيح VAPID عامة — الصق المفتاح العام هنا (لا أسرار في الواجهة أبدًا).
          </p>
          <TextInput dir="ltr" placeholder="VAPID public key (Base64)" value={vapid} onChange={(e) => setVapid(e.target.value.trim())} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!pushSupported() || vapid.length < 20}
              onClick={async () => {
                const sub = await subscribe(vapid)
                showToast(sub ? 'تم إنشاء اشتراك Push — صدّر البيانات لخادومك' : 'تعذر الاشتراك', sub ? 'success' : 'danger')
              }}
            >
              اشتراك
            </Button>
            <Button size="sm" variant="outline" onClick={() => void unsubscribe().then(() => showToast('تم إلغاء الاشتراك', 'info'))}>
              إلغاء الاشتراك
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const json = exportSubscriptionForServer()
                if (!json) return showToast('لا اشتراك بعد', 'warning')
                void navigator.clipboard.writeText(json).then(() => showToast('تم نسخ بيانات الاشتراك', 'success'))
              }}
            >
              نسخ الاشتراك
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>قفل التطبيق</SectionTitle>
        <Card className="flex flex-col gap-3 p-4">
          <Field label="طريقة القفل">
            <Select
              value={settings.lock.mode}
              onChange={async (e) => {
                const mode = e.target.value as 'none' | 'pin' | 'webauthn'
                if (mode === 'pin') {
                  setPinOpen(true)
                  return
                }
                if (mode === 'webauthn') {
                  const ok = await lockService.registerWebAuthn()
                  showToast(ok ? 'تم تفعيل القفل بالبصمة' : 'البصمة غير مدعومة على هذا الجهاز', ok ? 'success' : 'warning')
                  if (ok) return
                  return
                }
                await lockService.disable()
                notifyDataChanged()
                showToast('تم إيقاف القفل', 'info')
              }}
            >
              <option value="none">بدون قفل</option>
              <option value="pin">رمز PIN</option>
              <option value="webauthn">بصمة / WebAuthn</option>
            </Select>
          </Field>
          {settings.lock.mode !== 'none' ? (
            <>
              <Field label="قفل تلقائي بعد (دقائق، 0 = عند الفتح فقط)">
                <TextInput
                  inputMode="numeric"
                  value={String(settings.lock.autoLockMinutes)}
                  onChange={(e) => void update({ lock: { ...settings.lock, autoLockMinutes: Number(e.target.value.replace(/\D/g, '')) } }, 'عدّل القفل التلقائي')}
                />
              </Field>
              <Button variant="outline" icon="lock" onClick={() => setLocked(true)}>
                قفل الآن
              </Button>
            </>
          ) : null}
        </Card>
      </div>

      <div>
        <SectionTitle>منطقة الخطر</SectionTitle>
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-[11px] text-muted">مسح جميع البيانات المحلية نهائيًا (صدّر نسخة احتياطية أولًا).</p>
          <Button variant="danger" icon="trash" onClick={() => setConfirmWipe(true)}>
            مسح جميع البيانات
          </Button>
        </Card>
      </div>

      <Sheet
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        title="تعيين رمز PIN"
        footer={
          <Button
            className="w-full"
            onClick={async () => {
              if (pin !== pin2) return showToast('الرمزان غير متطابقين', 'danger')
              try {
                await lockService.setPin(pin)
                notifyDataChanged()
                setPinOpen(false)
                setPin('')
                setPin2('')
                showToast('تم تفعيل قفل PIN', 'success')
              } catch (e) {
                showToast(e instanceof Error ? e.message : 'خطأ', 'danger')
              }
            }}
          >
            حفظ الرمز
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="الرمز (4-8 أرقام)" hint="يُخزن مشفرًا PBKDF2 ولا يُحفظ كنص صريح">
            <TextInput dir="ltr" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          </Field>
          <Field label="تأكيد الرمز">
            <TextInput dir="ltr" type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          </Field>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmWipe}
        title="مسح جميع البيانات"
        message="سيُحذف كل شيء من هذا الجهاز نهائيًا включая الإعدادات والسجل. لا يمكن التراجع."
        danger
        confirmLabel="مسح نهائي"
        onClose={() => setConfirmWipe(false)}
        onConfirm={async () => {
          const { wipeDatabase } = await import('@/database/db')
          await wipeDatabase()
          location.reload()
        }}
      />
      <div className="flex items-center justify-center gap-1 pb-2 text-[10px] text-muted">
        <Icon name="info" size={11} />
        الإصدار 1.0.0 — بياناتك على جهازك فقط
      </div>
    </div>
  )
}
