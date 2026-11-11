const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { guestOnly } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Buat sesi baru (anti session fixation) lalu arahkan ke Beranda
function startSession(req, res, userId, msg) {
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.userId = userId;
    req.session.flash = { type: 'success', msg };
    res.redirect('/');
  });
}

router.get('/register', guestOnly, (req, res) => res.render('register', { title: 'Daftar' }));

router.post('/register', guestOnly, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const confirm = String(req.body.password_confirmation || '');
    const errors = [];

    if (!name) errors.push('Nama lengkap wajib diisi.');
    else if (name.length > 100) errors.push('Nama maksimal 100 karakter.');
    if (!email) errors.push('Email wajib diisi.');
    else if (email.length > 150 || !EMAIL_RE.test(email)) errors.push('Format email tidak valid.');
    if (password.length < 6) errors.push('Password minimal 6 karakter.');
    if (password !== confirm) errors.push('Konfirmasi password tidak cocok.');

    if (!errors.length) {
      const [dup] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (dup.length) errors.push('Email sudah terdaftar.');
    }
    if (errors.length) return res.status(422).render('register', { title: 'Daftar', errors, old: { name, email } });

    const hash = await bcrypt.hash(password, 10);
    let result;
    try {
      [result] = await pool.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(422).render('register', { title: 'Daftar', errors: ['Email sudah terdaftar.'], old: { name, email } });
      }
      throw e;
    }
    // Auto-login: tidak lewat form login, langsung ke Beranda
    startSession(req, res, result.insertId, 'Registrasi berhasil. Selamat datang di ConnectSpace!');
  } catch (e) { next(e); }
});

router.get('/login', guestOnly, (req, res) => res.render('login', { title: 'Login' }));

router.post('/login', guestOnly, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.execute('SELECT id, password FROM users WHERE email = ?', [email]);
    const ok = rows.length && (await bcrypt.compare(password, rows[0].password));
    if (!ok) {
      return res.status(401).render('login', { title: 'Login', errors: ['Email atau password salah.'], old: { email } });
    }
    startSession(req, res, rows[0].id, 'Login berhasil.');
  } catch (e) { next(e); }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;
