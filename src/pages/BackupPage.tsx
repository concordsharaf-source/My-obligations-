import { useRef, useState, type JSX } from 'react'
import { useDataBundle } from '@/hooks/useLiveData'
import { downloadFile, exportJSON, importJSON, obligationsToCSV, paymentsToCSV } from '@/services/backup.service'
import { Button, Card, SectionTitle } from '@/components/ui/primitives'
import { ConfirmDialog } from '@/components/ui/overlays'
import { Icon } from '@/components/ui/Icon'
import { notifyDataChanged } from '@/notifications/scheduler'
import { showToast } from '@/store/ui.store'
import { todayISO } from '@/utils/date'

export default function BackupPage(): JSX.Element {
  const bundle = useDataBundle()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [pendingFile, setPendingFile] = useState<string | null>(null)

  const doExportJSON = async (): Promise<void> => {
    const json = await exportJSON()
    downloadFile(`my-obligations-backup-${todayISO()}.json`, json, 'application/json')
    showToast('تم تصدير النسخة الاحتياطية', 'success')
  }

  const onFile = (file: File): void => {
    const reader = new FileReader()
    reader.onload = () => setPendingFile(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="px-1 text-base font-extrabold">النسخ الاحتياطي</h1>

      <div>
        <SectionTitle>تصدير</SectionTitle>
        <div className="flex flex-col gap-2">
          <Card className="tap flex items-center gap-3 p-3" onClick={() => void doExportJSON()}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brandsoft text-brand">
              <Icon name="file-json" size={19} />
            </span>
            <span className="flex-1">
              <span className="block text-xs font-extrabold">Export JSON</span>
              <span className="block text-[10px] text-muted">كل البيانات: التزامات، ديون، دفعات، أشخاص، تصنيفات، ميزانية، دخل، إعدادات، سجل</span>
            </span>
            <Icon name="download" size={17} className="text-muted" />
          </Card>
          <Card
            className="tap flex items-center gap-3 p-3"
            onClick={() => {
              downloadFile(`obligations-${todayISO()}.csv`, obligationsToCSV(bundle.obligations, bundle.payments), 'text/csv')
              showToast('تم تصدير CSV الالتزامات', 'success')
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-oksoft text-ok">
              <Icon name="download" size={19} />
            </span>
            <span className="flex-1">
              <span className="block text-xs font-extrabold">Export CSV — الالتزامات</span>
              <span className="block text-[10px] text-muted">يفتح في Excel مع دعم العربية</span>
            </span>
          </Card>
          <Card
            className="tap flex items-center gap-3 p-3"
            onClick={() => {
              downloadFile(`payments-${todayISO()}.csv`, paymentsToCSV(bundle.payments, bundle.obligations), 'text/csv')
              showToast('تم تصدير CSV الدفعات', 'success')
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-infosoft text-info">
              <Icon name="download" size={19} />
            </span>
            <span className="flex-1">
              <span className="block text-xs font-extrabold">Export CSV — الدفعات</span>
            </span>
          </Card>
        </div>
      </div>

      <div>
        <SectionTitle>استيراد</SectionTitle>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex rounded-xl bg-card2 p-1">
            {(['merge', 'replace'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${mode === m ? 'bg-card shadow-sm' : 'text-muted'}`}
              >
                {m === 'merge' ? 'دمج مع البيانات الحالية' : 'استبدال كامل'}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            اختر ملف النسخة الاحتياطية
          </Button>
          <p className="text-[10px] leading-4 text-muted">يُتحقق من الملف بالكامل قبل الاستيراد — أي بيانات تالفة تُرفض ولن تُعدل بياناتك.</p>
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingFile}
        title={mode === 'merge' ? 'استيراد بالدمج' : 'استيراد بالاستبدال'}
        message={
          mode === 'merge'
            ? 'ستُضاف بيانات الملف وتُحدَّث السجلات Matching بالمعرّفات.'
            : 'سيُمحى كل ما على الجهاز ويُستبدل بمحتوى الملف. صدّر نسخة أولًا إن كنت غير متأكد.'
        }
        confirmLabel="استيراد"
        onClose={() => setPendingFile(null)}
        onConfirm={async () => {
          if (!pendingFile) return
          try {
            const res = await importJSON(pendingFile, mode)
            notifyDataChanged()
            showToast(`تم الاستيراد: ${res.counts.obligations} التزام، ${res.counts.payments} دفعة`, 'success')
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'ملف غير صالح', 'danger')
          }
          setPendingFile(null)
        }}
      />
    </div>
  )
}
