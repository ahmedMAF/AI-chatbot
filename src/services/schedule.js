// منطق المواعيد والتحقق من المدخلات (التواريخ كنصوص YYYY-MM-DD بتوقيت العيادة)
const clinic = require('../config/clinic');

const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// التاريخ والوقت الحاليين بتوقيت Asia/Gaza
function nowInClinic() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: clinic.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const dayOfWeek = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const dayName = (date) => AR_DAYS[dayOfWeek(date)];

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isValidDateString(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === date;
}

// كل فترات اليوم حسب الدوام ومدة الموعد
function allSlots() {
  const out = [];
  for (let m = toMin(clinic.openTime); m + clinic.slotMinutes <= toMin(clinic.closeTime); m += clinic.slotMinutes) {
    out.push(toHHMM(m));
  }
  return out;
}

// يرجّع رسالة خطأ بالعربي أو null إذا التاريخ مقبول
function validateDate(date) {
  if (!isValidDateString(date)) return 'التاريخ غير صحيح، الصيغة المطلوبة YYYY-MM-DD';
  const today = nowInClinic().date;
  if (date < today) return 'هذا التاريخ في الماضي';
  if (date > addDays(today, clinic.maxDaysAhead)) return `الحجز متاح فقط خلال ${clinic.maxDaysAhead} يومًا من اليوم`;
  if (!clinic.workingDays.includes(dayOfWeek(date))) return `يوم ${dayName(date)} عطلة، العيادة مغلقة`;
  return null;
}

// الفترات المتبقية لليوم (تستبعد الأوقات التي مضت إذا كان التاريخ اليوم)
function candidateSlots(date) {
  const now = nowInClinic();
  const slots = allSlots();
  return date === now.date ? slots.filter((t) => toMin(t) > now.minutes) : slots;
}

// يقبل الأرقام العربية/الهندية والمسافات و +970
function normalizePhone(raw) {
  if (raw === undefined || raw === null) return '';
  let p = String(raw)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[\s\-().]/g, '');
  p = p.replace(/^(\+|00)97[02]/, '0');
  return p;
}

const isValidPhone = (p) => /^05[96]\d{7}$/.test(p);

function normalizeTime(raw) {
  const m = /^(\d{1,2}):(\d{2})(:00)?$/.exec(String(raw || '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

// نص "اليوم" للـ Agent
function todayText() {
  const { date } = nowInClinic();
  return `${dayName(date)} ${date}`;
}

module.exports = {
  nowInClinic, dayName, addDays, validateDate, candidateSlots,
  normalizePhone, isValidPhone, normalizeTime, todayText,
};
