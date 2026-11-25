// نقطة تشغيل السيرفر
require('dotenv').config();
const express = require('express');
const path = require('path');
const initDb = require('./src/db/init');
const apiRoutes = require('./src/routes/api');
const pageRoutes = require('./src/routes/pages');

const app = express();
app.use(express.json({ limit: '10kb' }));

// سجل مختصر لطلبات الـ API في الطرفية (للتشخيص)
app.use('/api', (req, res, next) => {
  res.on('finish', () => {
    const body = req.method === 'POST' ? ` ${JSON.stringify(req.body)}` : '';
    console.log(`[api] ${req.method} ${req.originalUrl} → ${res.statusCode}${body}`);
  });
  next();
});

// مكتبة ElevenLabs للمتصفح (نسخة IIFE من الحزمة @elevenlabs/client)
app.get('/vendor/elevenlabs-client.js', (req, res) =>
  res.sendFile(path.join(__dirname, 'node_modules/@elevenlabs/client/dist/lib.iife.js')));

app.use('/api', apiRoutes);
app.use('/', pageRoutes);
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// JSON غير صالح أو أخطاء غير متوقعة
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, message: 'JSON غير صالح' });
  console.error(err);
  res.status(500).json({ ok: false, message: 'خطأ في السيرفر، حاول مرة أخرى' });
});

const PORT = Number(process.env.PORT) || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log(`✅ السيرفر شغّال: http://localhost:${PORT}`)))
  .catch((e) => { console.error('❌ فشل الاتصال بقاعدة البيانات:', e.message); process.exit(1); });
