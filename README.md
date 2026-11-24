# سكرتيرة صوتية بالذكاء الاصطناعي لعيادة (Prototype)

المريض يفتح صفحة العيادة، يضغط **📞 اتصل بالعيادة**، ويتكلم بصوته مع "سارة" (Agent على ElevenLabs).
سارة تفحص المواعيد الفاضية وتحجز الموعد مباشرة في قاعدة بيانات MySQL، والسكرتيرة تتابع الحجوزات من لوحة `/admin`.

## التقنيات

- Node.js + Express
- MySQL عبر `mysql2` (promise API + connection pool + prepared statements)
- HTML + CSS + Vanilla JS (RTL)
- `@elevenlabs/client` (Web SDK)

## هيكل المشروع

```
server.js                  نقطة التشغيل
src/config/clinic.js       إعدادات العيادة (الاسم، الدوام، مدة الموعد، السعر...)
src/db/pool.js             الاتصال بـ MySQL
src/db/init.js             إنشاء الجدول تلقائيًا عند التشغيل
src/db/appointments.js     استعلامات الحجوزات
src/services/schedule.js   حساب المواعيد والتحقق من المدخلات (بتوقيت Asia/Gaza)
src/middleware/adminAuth.js  Basic Auth للأدمن
src/routes/api.js          مسارات /api
src/routes/pages.js        الصفحات / و /admin
public/                    الواجهة (index.html, admin.html, css, js)
db/schema.sql              سكربت قاعدة البيانات
AGENT_SETUP.md             إعداد الـ Agent على ElevenLabs
```

## 1) إنشاء قاعدة البيانات

```bash
mysql -u root -p < db/schema.sql
```

ثم أنشئ مستخدمًا للتطبيق (أو استخدم مستخدمًا موجودًا):

```sql
CREATE USER 'clinic'@'localhost' IDENTIFIED BY 'clinic_pass';
GRANT ALL ON clinic_db.* TO 'clinic'@'localhost';
```

> السيرفر ينشئ جدول `appointments` تلقائيًا إذا لم يكن موجودًا، لكن قاعدة البيانات نفسها يجب أن تكون موجودة.

## 2) التثبيت والإعداد

```bash
npm install
cp .env.example .env
```

عدّل `.env`:

| المتغير | الوصف |
|---|---|
| `ELEVENLABS_API_KEY` | مفتاح ElevenLabs (يبقى على السيرفر فقط) |
| `ELEVENLABS_AGENT_ID` | رقم الـ Agent |
| `ADMIN_PASSWORD` | كلمة مرور لوحة السكرتيرة (اسم المستخدم: `admin`) |
| `PORT` | منفذ السيرفر (افتراضي 3000) |
| `DB_*` | بيانات الاتصال بـ MySQL |

ثم جهّز الـ Agent حسب [AGENT_SETUP.md](AGENT_SETUP.md).

## 3) التشغيل

```bash
npm start
```

- صفحة المريض: <http://localhost:3000>
- لوحة السكرتيرة: <http://localhost:3000/admin> (المستخدم `admin` وكلمة المرور من `.env`)

## 4) كيف أجرّب؟

### المكالمة الصوتية
1. افتح <http://localhost:3000> في Chrome واسمح باستخدام المايكروفون.
2. اضغط **اتصل بالعيادة** وقل مثلًا: "بدي أحجز موعد بكرا".
3. اختر وقتًا، وأعطِ اسمك ورقم جوال مثل `0599123456`، ثم أكّد الحجز.
4. افتح `/admin` وسترى الحجز (التحديث تلقائي كل 15 ثانية).

> المايكروفون يعمل على `localhost` أو عبر HTTPS فقط. للتجربة من جوال استخدم نفقًا مثل ngrok.

### الـ API عبر curl

```bash
# المواعيد الفاضية
curl "http://localhost:3000/api/slots?date=2026-11-25"

# حجز
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"name":"محمد أحمد","phone":"0599123456","date":"2026-11-25","time":"10:00"}'

# نفس الحجز مرة ثانية → 409 "الموعد انحجز، اقترح وقتًا آخر"

# كل الحجوزات (أدمن)
curl -u admin:YOUR_PASSWORD "http://localhost:3000/api/appointments?date=2026-11-25"

# إلغاء حجز (أدمن)
curl -u admin:YOUR_PASSWORD -X DELETE http://localhost:3000/api/appointments/1
```

## الـ Endpoints

| Method | المسار | الوصف |
|---|---|---|
| GET | `/api/clinic` | معلومات العيادة وتاريخ اليوم بتوقيت غزة |
| GET | `/api/signed-url` | Signed URL من ElevenLabs |
| GET | `/api/slots?date=YYYY-MM-DD` | المواعيد الفاضية |
| POST | `/api/appointments` | إنشاء حجز |
| GET | `/api/appointments?date=` | 🔒 كل الحجوزات |
| DELETE | `/api/appointments/:id` | 🔒 إلغاء حجز |

## قواعد التحقق

- التاريخ صحيح، ليس في الماضي، ضمن 14 يومًا، وليس يوم جمعة.
- الوقت من فترات الدوام (كل 30 دقيقة من 09:00 حتى 16:30)، ولا يُقبل وقت مضى إذا كان الحجز لليوم نفسه.
- الجوال: `059` أو `056` + 7 أرقام. يقبل الأرقام العربية (٠٥٩...) والصيغة `+970`.

## منع الحجز المزدوج

- `UNIQUE KEY (appt_date, appt_time, is_active)`: قاعدة البيانات نفسها تمنع حجزين فعّالين لنفس الموعد، حتى لو وصل الطلبان في نفس اللحظة.
- عند الإلغاء تصبح `is_active = NULL`، وقيم NULL لا تتعارض مع الـ UNIQUE، فيصير الموعد متاحًا من جديد.
- خطأ `ER_DUP_ENTRY` يرجع 409 مع الأوقات المتاحة حتى تقترح سارة بديلًا.

## تعديل إعدادات العيادة

كل شيء في `src/config/clinic.js`. إذا غيّرت الدوام أو السعر، حدّث الـ System Prompt في ElevenLabs أيضًا.

## ملاحظات للـ Prototype

- لا يوجد Rate limiting على `POST /api/appointments`. أضفه قبل النشر الفعلي.
- Basic Auth يحتاج HTTPS في الإنتاج.
