// Basic Auth بسيطة للأدمن (اسم المستخدم: admin، كلمة المرور من .env)
const crypto = require('crypto');

function safeEqual(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

module.exports = function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).send('ADMIN_PASSWORD غير مضبوط في .env');

  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString();
    const idx = decoded.indexOf(':');
    const user = decoded.slice(0, idx), pass = decoded.slice(idx + 1);
    if (idx > -1 && safeEqual(user, 'admin') && safeEqual(pass, expected)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Clinic Admin", charset="UTF-8"');
  res.status(401).send('غير مصرح');
};
