// إنشاء الجدول تلقائيًا عند تشغيل السيرفر
const pool = require('./pool');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS appointments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  appt_date   DATE         NOT NULL,
  appt_time   TIME         NOT NULL,
  status      ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  is_active   TINYINT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_slot (appt_date, appt_time, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const REQUIRED = ['id', 'name', 'phone', 'appt_date', 'appt_time', 'status', 'is_active', 'created_at'];

async function initDb() {
  await pool.query(CREATE_TABLE);

  // إذا كان في جدول appointments قديم بأعمدة مختلفة، نوقف التشغيل برسالة واضحة
  const [cols] = await pool.execute(
    'SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    ['appointments']
  );
  const have = cols.map((r) => r.c);
  const missing = REQUIRED.filter((c) => !have.includes(c));
  if (missing.length) {
    throw new Error(
      `جدول appointments الموجود في قاعدة البيانات "${process.env.DB_NAME}" قديم وناقصه الأعمدة: ${missing.join(', ')}.\n` +
      '   الحل: استخدم قاعدة بيانات جديدة (DB_NAME=clinic_db بعد تشغيل db/schema.sql)، أو احذف الجدول القديم إذا لا تحتاج بياناته.'
    );
  }
}

module.exports = initDb;
