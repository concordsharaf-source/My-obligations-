# التزاماتي — My Obligations

> **لا تنسَ ما عليك... ولا ما لك.**
> تطبيق ويب تقدمي (PWA) شخصي لإدارة الالتزامات والديون والأقساط والفواتير والمواعيد — مع نظام **«ميزانيتي»** متكامل.
> يعمل **بدون إنترنت** بالكامل، قابل للتثبيت على الهاتف، ومهيأ للتحويل لاحقًا إلى تطبيق Android عبر Capacitor أو TWA دون إعادة بناء.

**My Obligations** — an offline-first, installable PWA (Arabic, RTL) for managing obligations, debts, installments, bills and appointments, with a full personal budget system ("My Budget"). No account, no server: all data stays on-device in IndexedDB.

---

## ✨ المميزات / Features

| المجال | التفاصيل |
|---|---|
| الرئيسية Dashboard | تحية المستخدم، التاريخ، بطاقات: عليّ / لي / اليوم / هذا الأسبوع / هذا الشهر / المتأخر / المتبقي من الميزانية |
| ميزانيتي | دخل شهري multi-source + دخل متغير شهريًا، ارتباط تلقائي بالالتزامات المالية (بدون إدخال مزدوج)، المتبقي، المدفوع، المتأخر، نسبة الالتزام من الدخل، مؤشر حالة (مريح/انتباه/مضغوطة/تجاوز بنِسب قابلة للتعديل)، المتاح اليومي التقديري، التزامات سنوية (تكلفة سنوية + متوسط شهري)، سجل الميزانية عبر الأشهر، **3 رسوم بيانية ديناميكية** |
| الالتزامات | أي نوع: ديون، أقساط، فواتير، إيجار، اشتراكات، مواعيد، التزامات اجتماعية/عمل/دراسة/رياضة/منزل/صحة… تصنيفات مخصصة بأيقونات وألوان |
| الديون | عليّ / لي: إجمالي، مسدد/محصّل، متبقٍ، قادم، متأخر + **دفعات جزئية** حتى السداد التام مع سجل كامل |
| التكرار | يومي، كل ن يوم، أسبوعي، كل أسبوعين، شهري، كل ن شهر، ربع/نصف سنوي، سنوي، مخصص + انتهاء التكرار + «تعديل هذه المرة / هذا والمستقبل / إلغاء التكرار» |
| التقويم | عرض شهري / أسبوعي / يومي مع تفاصيل اليوم |
| الإشعارات | تنبيهات حقيقية (Web Notifications عبر Service Worker): قبل 5/15/30 دقيقة، ساعة، 3 ساعات، يوم، يومين، أسبوع، وقت الاستحقاق، بعد التأخر + دمج ذكي للتنبيهات المتقاربة + ملخص صباحي/مسائي + أزرار إجراء (تم ✓ / تأجيل) |
| التأجيل Snooze | 10 دقائق، ساعة، هذا المساء، غدًا، موعد مخصص |
| اقتراحات التزاماتي | Rules Engine محلية سريعة (بدون AI خارجي) مع تصميم قابل لإضافة AI مستقبلًا |
| الأشخاص | لكل شخص: ديونه له/عليه، الدفعات، الرصيد، الالتزامات المرتبطة، كشف printable |
| البحث | شامل (اسم/شخص/هاتف/ملاحظات/تصنيف/مبلغ) + فلاتر متعددة |
| الإحصائيات | ديون/مسدد/متبقي/متأخر/مكتمل، حسب التصنيف، تطور الدخل مقابل الالتزامات |
| السجل | توثيق كل عملية (إضافة/تعديل/حذف/إكمال/تأجيل/دفعة/دخل/إعدادات…) بالتاريخ والوقت |
| النسخ الاحتياطي | Export/Import JSON (بتحقق صارم zod) + Export CSV (التزامات ودفعات) |
| الأمان | قفل PIN مخزن PBKDF2-SHA256 (لا نص صريح) أو WebAuthn/بصمة عند الدعم، تحقق zod من كل إدخال واستيراد |
| UX | RTL كامل، Mobile-first، وضع داكن/فاتح/نظام، Empty states، تأكيد الحذف + **Undo** + سلة محذوفات 30 يوم، مشاركة Web Share مع fallback للحافظة، Print CSS لتقارير حقيقية |

## 🧰 التقنيات / Stack

- **React 19 + TypeScript 5.9 (strict)** + **Vite 7**
- **Tailwind CSS 4** (design tokens + dark mode عبر `data-theme`)
- **Dexie 4 (IndexedDB)** — طبقة بيانات منفصلة تمامًا عن UI ومنطق الأعمال
- **Zustand** لحالة الواجهة والإعدادات، **dexie-react-hooks** لمزامنة حيّة
- **Recharts 3** للرسوم البيانية الديناميكية
- **Zod 4** للتحقق وقت التشغيل (نماذج + استيراد النسخ الاحتياطية)
- **vite-plugin-pwa (Workbox 7)** — استراتيجية `injectManifest` مع Service Worker مكتوب يدويًا
- اختبارات: **Vitest + Testing Library + fake-indexeddb**

## 📦 التشغيل / Getting started

```bash
npm install
npm run dev        # تطوير مع Service Worker فعّال (devOptions)
npm run build      # typecheck + بناء إنتاجي + توليد SW
npm run preview    # معاينة نسخة الإنتاج
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (app + node configs)
npm test           # Vitest
npm run ci         # lint + typecheck + test + build
```

## 📱 PWA والتثبيت / PWA & install

- `manifest.webmanifest` مولّد تلقائيًا: `lang: ar`, `dir: rtl`, `display: standalone`, `orientation: portrait`, أيقونات 192/512 + maskable، اختصارات (إضافة/ديون/ميزانية/تقويم).
- Service Worker (`src/pwa/sw.ts`): precache لكل الأصول (بما فيها الخطوط العربية المضمّنة)، fallback للتنقل، معالجة `notificationclick` (إكمال/تأجيل/فتح)، ومعالج `push` جاهز.
- زر التثبيت يظهر تلقائيًا (`beforeinstallprompt`)، وتنبيه تحديث عند توفر إصدار جديد.
- **Offline**: إضافة/تعديل/حذف/بحث/تقويم/ديون/دفعات/ميزانية/إحصائيات/تصدير — كلها محلية 100%.

### 🚪 حاجز التثبيت / Install Gatekeeper
شاشة تثبيت مستقلة بـ HTML/CSS/JS قياسي (بدون أي إطار عمل) في `public/gatekeeper/` + `index.html`:

- **الكشف**: `display-mode: standalone` / `window-controls-overlay` / `navigator.standalone` → يظهر `#app-content` ويختفي `#install-screen`؛ وإلا العكس. القرار يُتخذ **قبل أول رسم** عبر سكربت inline في `<head>` (لا وميض).
- **أندرويد/سطح المكتب** (Chrome/Edge/Brave): يُلتقط `beforeinstallprompt` مبكرًا (`preventDefault` لإلغاء الشريط المصغّر) ويُربط بزر «تثبيت التطبيق الآن» — وعند القبول أو `appinstalled` يُفتح التطبيق مباشرة.
- **iOS Safari** (لا يدعم `beforeinstallprompt`): يختفي زر التثبيت وتظهر 3 خطوات: أيقونة المشاركة ← «Add to Home Screen» ← «إضافة» ثم التشغيل من الشاشة الرئيسية. يشمل iPadOS (`MacIntel` + `maxTouchPoints > 1`) ويستثني متصفحات الطرف الثالث على iOS.
- **متصفحات أخرى / انتهاء المهلة (2.5 ثانية)**: تعليمات تثبيت يدوية من قائمة المتصفح.
- رابط «المتابعة في المتصفح» يمنع الانحسار (lockout) ويحفظ الاختيار في `sessionStorage`.
- جسر أحداث `pwa:installprompt` / `pwa:installed` / `pwa:gate-revealed` يربط الحاجز بواجهة React (بانر التثبيت الداخلي) بدون استهلاك مزدوج للحدث.
- CSS الحالة الحرج inline في `index.html`، والتنسيق البصري (dark mode، RTL، animations) في `public/gatekeeper/style.css` — وكلاهما ضمن precache للـ SW. الاختبارات: `tests/gatekeeper.test.ts` (11 حالة).

### الخطوط
خط **IBM Plex Sans Arabic** مُضمّن ومُجزّأ (woff2 ≈ 190KB للأوزان الأربعة) ويعمل offline عبر precache — لا طلبات شبكة خارجية إطلاقًا.

## 🔔 الإشعارات وWeb Push / Notifications & Push

1. **محليًا (يعمل الآن):** مجدول تنبيهات داخل التطبيق + Service Worker؛ يُخزن ما أُطلق في IndexedDB لمنع التكرار؛ الملخص الصباحي/المسائي اختياري.
   ملاحظة صادقة: المتصفحات لا توقظ تطبيقًا مغلقًا بدون Push حقيقي.
2. **Push حقيقي (جاهز معماريًا):** `src/notifications/push.ts` يوفر `subscribe(vapidPublicKey)` وتصدير الاشتراك لخادومك. المفتاح العام يُدخل من الإعدادات وقت التشغيل — **لا أسرار داخل الواجهة أبدًا**. الـ SW يعالج حدث `push` ويعرض الحمولة `{title, body, route}`.

## 💾 النسخ الاحتياطي / Backup

- **Export JSON**: كل الجداول (التزامات، دفعات، أشخاص، تصنيفات، مصادر دخل، دخل إضافي، إعدادات، سجل).
- **Import**: وضعان — دمج أو استبدال — مع تحقق zod كامل قبل لمس قاعدة البيانات.
- **Export CSV**: التزامات + دفعات، بـ BOM ليفتح عربيًا سليمًا في Excel.

## 🖨️ الطباعة / Printing

مسار `/print/:report` مع Print CSS: `debts` تقرير الديون، `month` التزامات الشهر، `person?id=` كشف شخص، `budget` الميزانية.

## 🔒 القفل / App lock

- PIN: يُشتق PBKDF2-SHA256 (150k iterations) مع salt عشوائي — لا يُخزن الرمز نفسه أبدًا.
- WebAuthn (بصمة/وجه) عند توفر `PublicKeyCredential` مع تراجع تلقائي.
- قفل تلقائي بعد مدة خمول قابلة للإعداد + زر «قفل الآن».

## 🤖 التحويل إلى Android / Capacitor & TWA readiness

التطبيق مصمم packaging-ready من اليوم:

```bash
npm i -D @capacitor/cli @capacitor/core && npx cap init my-obligations com.example.myobligations --web-dir=dist
npm run build && npx cap add android && npx cap sync && npx cap open android
```

- لا اعتماد على أي API متصفح غير متوفرة في WebView بدون fallback (مشاركة→حافظة، إشعارات→تحقق دعم، Push→اختياري).
- كل المسارات Hash-based (`#/…`) فتعمل من `file://` وخادم Capacitor المحلي بدون إعادة توجيه.
- بديل TWA: استخدم `npx @bubblewrap/cli init --manifest <url>/manifest.webmanifest`.
- تفاصيل أوفى: `docs/ANDROID.md`.

## 🚀 النشر / Deploy

- **GitHub Pages**: workflow `deploy.yml` يبني وينشر على `gh-pages` (فعّل Pages ← Source: GitHub Actions).
  للبناء يدويًا بمسار فرعي: `BASE_PATH=/My-obligations-/ npm run build`.
- أي استضافة ثابتة (Netlify/Vercel/خادم خاص): انشر مجلد `dist/` فقط.

## 🧪 حالة الجودة / Quality gates

GitHub Actions (`ci.yml`) يفشل تلقائيًا عند أي خطأ في: `npm install → lint → typecheck → test → build`.

## 🗂️ بنية المشروع / Structure

```
src/
├── components/   # ui primitives + layouts pieces + domain widgets
├── layouts/      # AppShell, TopBar, BottomNav, FAB, LockScreen
├── pages/        # كل الشاشات
├── hooks/        # useLiveData (Dexie live), useNow, useTheme
├── services/     # منطق الأعمال: obligations, budget, recurrence, suggestions, backup, lock, print, sharing, stats, search
├── repositories/ # وصول بيانات رفيع فوق Dexie
├── database/     # مخطط Dexie + البذور الافتراضية
├── models/       # zod schemas
├── types/        # أنواع النطاق
├── notifications/# scheduler + notify + push architecture
├── pwa/          # sw.ts + register.ts
├── store/        # zustand stores
├── styles/       # Tailwind 4 tokens + print CSS
└── utils/        # date/money/cn/ids
public/gatekeeper/# حاجز تثبيت PWA: app.js + style.css (vanilla, تُنشر كما هي)
tests/            # Vitest suites (engine, budget, payments, backup, search, suggestions, gatekeeper, ui smoke)
```

## 🛡️ الأمان / Security

- تحقق zod لكل إدخال واستيراد؛ مبالغ وتواريخ مقيدة المدى.
- لا `eval`/`new Function` (مفروض عبر ESLint)، لا أسرار في الواجهة، لا تتبع، لا شبكة خارجية.

## 📄 الرخصة / License

MIT
