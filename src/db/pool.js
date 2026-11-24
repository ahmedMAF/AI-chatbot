// Connection pool (promise API)
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  dateStrings: true,        // DATE/TIME تُرجع نصوص بدل Date لتجنّب مشاكل المنطقة الزمنية
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
