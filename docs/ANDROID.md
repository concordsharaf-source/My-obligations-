# التحويل إلى تطبيق Android / Packaging for Android

التطبيق PWA حقيقية ومستقلة تمامًا، لذا تغليفه لا يتطلب إعادة كتابة أي سطر.

## الخيار 1 — Capacitor (موصى به للوصول إلى مزايا أصلية لاحقًا)

```bash
# مرة واحدة
npm i -D @capacitor/cli @capacitor/core
npx cap init "التزاماتي" com.yourname.myobligations --web-dir=dist

# كل بناء
npm run build
npx cap add android      # أول مرة فقط
npx cap sync android
npx cap open android     # يفتح Android Studio لبناء APK/AAB
```

ملاحظات:
- `webDir: dist` — نفس مخرجات الويب، لا بناء منفصل.
- المسارات Hash-based تعمل داخل WebView بدون أي إعداد إضافي.
- IndexedDB وService Worker مدعومان في Android WebView (Chrome 61+).
- للإشعارات المحلية داخل التطبيق لا حاجة لأي إضافة؛ ولـ Push الحقيقي أضف `@capacitor/push-notifications` واربطه بنفس معمارية `src/notifications/push.ts`.

## الخيار 2 — TWA (Trusted Web Activity) عبر Bubblewrap

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-HOST/manifest.webmanifest
bubblewrap build    # ينتج APK موقعًا
```

متطلبات TWA:
- نشر التطبيق على HTTPS (GitHub Pages كافٍ).
- إضافة `assetlinks.json` على النطاق للتحقق من الملكية (يولده Bubblewrap).
- الأيقونات maskable موجودة مسبقًا في `public/icons/`.

## ما الذي يبقى كما هو؟

- كل الكود، قاعدة البيانات IndexedDB، النسخ الاحتياطي، القفل، الرسوم البيانية.
- بيانات المستخدم تبقى على جهازه في الحالتين.

## قيود معروفة وحلولها

| القيد | الحل المطبق |
|---|---|
| `navigator.share` غير متاح في بعض WebViews | fallback تلقائي للحافظة |
| Wake-up بدون push غير مضمون | مجدول محلي + معمارية Push جاهزة |
| WebAuthn غير متاح | تراجع إلى PIN تلقائيًا |
