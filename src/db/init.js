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

async function initDb() {
  await pool.query(CREATE_TABLE);
}

module.exports = initDb;
