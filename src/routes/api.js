// مسارات الـ API
const express = require('express');
const clinic = require('../config/clinic');
const appts = require('../db/appointments');
const s = require('../services/schedule');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// يلفّ الدوال async حتى تصل الأخطاء لمعالج الأخطاء
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

async function freeSlots(date) {
  const booked = new Set(await appts.getBookedTimes(date));
  return s.candidateSlots(date).filter((t) => !booked.has(t));
}

// معلومات العيادة + تاريخ اليوم (للواجهة والمتغير today)
router.get('/clinic', (req, res) => {
  res.json({ ...clinic, today: s.todayText(), todayDate: s.nowInClinic().date });
});

// Signed URL من ElevenLabs حتى لا يظهر الـ API Key في المتصفح
router.get('/signed-url', wrap(async (req, res) => {
  const { ELEVENLABS_API_KEY: key, ELEVENLABS_AGENT_ID: agentId } = process.env;
  if (!key || !agentId) return res.status(500).json({ ok: false, message: 'مفاتيح ElevenLabs غير مضبوطة في .env' });

  const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`;
  let r;
  try {
    r = await fetch(url, { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(10000) });
  } catch (e) {
    console.error('ElevenLabs network error:', e.cause?.code || e.message);
    return res.status(502).json({ ok: false, message: 'تعذّر الوصول لخدمة ElevenLabs' });
  }
  if (!r.ok) {
    console.error('ElevenLabs signed-url error:', r.status, await r.text());
    return res.status(502).json({ ok: false, message: 'تعذّر الاتصال بخدمة ElevenLabs' });
  }
  const data = await r.json();
  res.json({ ok: true, signedUrl: data.signed_url });
}));

// المواعيد الفاضية لتاريخ معيّن
router.get('/slots', wrap(async (req, res) => {
  const date = String(req.query.date || '').trim();
  const err = s.validateDate(date);
  if (err) return res.status(400).json({ ok: false, date, slots: [], message: err });

  const slots = await freeSlots(date);
  res.json({
    ok: true, date, day: s.dayName(date), slots,
    message: slots.length
      ? `المواعيد المتاحة يوم ${s.dayName(date)} ${date}: ${slots.join('، ')}`
      : `لا توجد مواعيد فاضية يوم ${s.dayName(date)} ${date}، اقترح يومًا آخر`,
  });
}));

// إنشاء حجز
router.post('/appointments', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const phone = s.normalizePhone(req.body.phone);
  const date = String(req.body.date || '').trim();
  const time = s.normalizeTime(req.body.time);

  const fail = (status, message) => res.status(status).json({ ok: false, message });
  if (name.length < 2 || name.length > 100) return fail(400, 'الاسم مطلوب (من 2 إلى 100 حرف)');
  if (!s.isValidPhone(phone)) return fail(400, 'رقم الجوال غير صحيح، لازم يبدأ بـ 059 أو 056 ويتكوّن من 10 أرقام');
  const dateErr = s.validateDate(date);
  if (dateErr) return fail(400, dateErr);
  if (!time || !s.candidateSlots(date).includes(time)) {
    return fail(400, `الوقت ${req.body.time} غير متاح ضمن فترات الدوام. الفترات كل ${clinic.slotMinutes} دقيقة من ${clinic.openTime} حتى ${clinic.closeTime}`);
  }

  try {
    const id = await appts.create({ name, phone, date, time });
    res.status(201).json({
      ok: true, id, name, phone, date, time, day: s.dayName(date),
      message: `تم الحجز بنجاح باسم ${name} يوم ${s.dayName(date)} ${date} الساعة ${time}. رقم الحجز ${id}`,
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      const slots = await freeSlots(date);
      return res.status(409).json({
        ok: false, slots,
        message: `الموعد انحجز، اقترح وقتًا آخر. المتاح الآن: ${slots.length ? slots.join('، ') : 'لا يوجد في هذا اليوم'}`,
      });
    }
    throw e;
  }
}));

// للأدمن فقط: كل الحجوزات (مع فلترة اختيارية بالتاريخ)
router.get('/appointments', adminAuth, wrap(async (req, res) => {
  const date = req.query.date ? String(req.query.date) : undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ ok: false, message: 'تاريخ غير صحيح' });
  res.json({ ok: true, appointments: await appts.list({ date }) });
}));

// للأدمن فقط: إلغاء حجز
router.delete('/appointments/:id', adminAuth, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, message: 'رقم حجز غير صحيح' });
  const done = await appts.cancel(id);
  if (!done) return res.status(404).json({ ok: false, message: 'الحجز غير موجود أو ملغى مسبقًا' });
  res.json({ ok: true, message: 'تم إلغاء الحجز' });
}));

module.exports = router;
