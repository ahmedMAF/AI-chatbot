// صفحات الواجهة
const express = require('express');
const path = require('path');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
const pub = path.join(__dirname, '..', '..', 'public');

router.get('/', (req, res) => res.sendFile(path.join(pub, 'index.html')));
router.get('/admin', adminAuth, (req, res) => res.sendFile(path.join(pub, 'admin.html')));

module.exports = router;
