// كل استعلامات الحجوزات (Prepared Statements عبر pool.execute)
const pool = require('./pool');
const { timezone } = require('../config/clinic');

const fmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const fmtLocal = (ms) => fmt.format(new Date(ms));

async function getBookedTimes(date) {
  const [rows] = await pool.execute(
    'SELECT TIME_FORMAT(appt_time, "%H:%i") AS t FROM appointments WHERE appt_date = ? AND is_active = 1',
    [date]
  );
  return rows.map((r) => r.t);
}

async function create({ name, phone, date, time }) {
  const [res] = await pool.execute(
    'INSERT INTO appointments (name, phone, appt_date, appt_time) VALUES (?, ?, ?, ?)',
    [name, phone, date, `${time}:00`]
  );
  return res.insertId;
}

async function list({ date } = {}) {
  let sql = `SELECT id, name, phone, appt_date AS date, TIME_FORMAT(appt_time, "%H:%i") AS time,
             status, UNIX_TIMESTAMP(created_at) AS created_ts FROM appointments`;
  const params = [];
  if (date) { sql += ' WHERE appt_date = ?'; params.push(date); }
  sql += ' ORDER BY appt_date, appt_time, id';
  const [rows] = await pool.execute(sql, params);
  // وقت الإنشاء بتوقيت العيادة بدل توقيت سيرفر MySQL
  return rows.map(({ created_ts, ...r }) => ({ ...r, created_at: fmtLocal(Number(created_ts) * 1000) }));
}

// الإلغاء: is_active = NULL حتى يتحرر الموعد للحجز من جديد
async function cancel(id) {
  const [res] = await pool.execute(
    "UPDATE appointments SET status = 'cancelled', is_active = NULL WHERE id = ? AND is_active = 1",
    [id]
  );
  return res.affectedRows > 0;
}

module.exports = { getBookedTimes, create, list, cancel };
