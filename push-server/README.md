# خادم Web Push — «التزاماتي» ☁️

خادم إرسال إشعارات Push حقيقي (يعمل حتى والتطبيق مغلق) مبني كـ **Cloudflare Worker** —
مجاني بالكامل ضمن الحدود المجانية (100 ألف طلب/يوم، وقراءة KV غير محدودة عمليًا).

> التطبيق يعمل 100% بدونه: التنبيهات المحلية (المجدولة داخل الجهاز) لا تحتاج أي خادم.
> هذا الخادم يضيف فقط إشعارات Push العابرة للأجهزة/الخلفية.

## 1) ولّد مفاتيح VAPID

```bash
node scripts/generate-vapid.mjs   # من جذر المستودع
```

ينتج سطرّين: `VAPID_PUBLIC_KEY=...` (عام — يُوضع في التطبيق والخادم) و`VAPID_PRIVATE_KEY=...`
(**سرّ مطلق** — للخادم فقط، لا يدخل المستودع ولا الواجهة أبدًا).

## 2) انشر الخادم (مرة واحدة، ~5 دقائق)

```bash
cd push-server
npm install

# سجّل دخول Cloudflare (حساب مجاني)
npx wrangler login

# أنشئ مخزن الاشتراكات ثم الصق المعرف في wrangler.toml مكان REPLACE_WITH_YOUR_KV_NAMESPACE_ID
npx wrangler kv namespace create SUBS

# اضبط الأسرار (سيُطلب منك لصق كل قيمة)
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put ADMIN_TOKEN        # أي كلمة سر قوية تختارها لإدارة الإرسال
npx wrangler secret put VAPID_SUBJECT      # مثل mailto:you@example.com (اختياري)

npx wrangler deploy
# ← ستحصل على رابط مثل: https://my-obligations-push.<حسابك>.workers.dev
```

## 3) اربط التطبيق بالخادم

في التطبيق: **الإعدادات ← Web Push**:
1. الصق `VAPID_PUBLIC_KEY` في حقل المفتاح العام.
2. الصق رابط الخادم (رابط الـ Worker) في حقل رابط خادم الدفع.
3. اضغط **«اشتراك»** — سيُنشئ الاشتراك ويُرسل للخادم تلقائيًا (أو اضغط «إرسال الاشتراك للخادم» لاحقًا).

## 4) أرسل إشعارًا

```bash
curl -X POST https://YOUR-WORKER.workers.dev/send \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"التزاماتي","body":"إيجار المنزل يستحق غدًا","route":"/obligations"}'
```

الاستجابة: `{"ok":true,"sent":1,"failed":0,"stale":0,"total":1}`.
الإشعار يفتح التطبيق على المسار المحدد في `route`، والاشتراكات المنتهية تُحذف تلقائيًا (404/410).

## نقاط النهاية

| الطريقة | المسار | الحماية | الوظيفة |
|---|---|---|---|
| GET | `/health` | عامة | حالة الخادم وعدد الاشتراكات |
| POST | `/register` | عامة (الاشتراك نفسه هو Credential) | تخزين اشتراك من التطبيق |
| DELETE | `/register` | `Bearer ADMIN_TOKEN` | حذف اشتراك بـ endpoint |
| POST | `/send` | `Bearer ADMIN_TOKEN` | إرسال إشعار (للجميع أو endpoint محدد) |

## تطوير محلي

```bash
cd push-server
cp .dev.vars.example .dev.vars   # واملأ القيم
npm run dev                      # http://localhost:8787
```

## ملاحظات أمان

- المفتاح الخاص و`ADMIN_TOKEN` أسرار Worker مشفّرة — لا تظهر في الكود أو السجلات.
- `/register` مفتوح عمدًا (مثل أي خدمة push): معرفة endpoint+keys وحدها تسمح بالتسجيل،
  ولا تسمح بالإرسال لأحد. إن أردت تقييده أضف تحقق `Authorization` في `worker.js`.
- الحمولة مشفرة AES-128-GCM وفق RFC 8291 وموقّعة VAPID وفق RFC 8292 — تصلح لكل خدمات
  الدفع بما فيها Apple (iOS 16.4+ لتطبيقات PWA المثبتة).
