require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pool = require('./config/db');

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.fmt = (d) => new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-ganti-di-produksi',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 },
}));

// Variabel global view + muat pengguna login (agar avatar/nama selalu terbaru)
app.use(async (req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.errors = [];
  res.locals.old = {};
  res.locals.title = 'ConnectSpace';
  res.locals.me = null;
  try {
    if (req.session.userId) {
      const [rows] = await pool.execute('SELECT id, name, email, avatar, bio FROM users WHERE id = ?', [req.session.userId]);
      if (rows.length) res.locals.me = rows[0];
      else delete req.session.userId;
    }
    next();
  } catch (e) { next(e); }
});

app.use(require('./routes/auth'));
app.use(require('./routes/profile'));
app.use(require('./routes/posts'));

app.use((req, res) => res.status(404).render('error', { title: 'Tidak ditemukan', message: 'Halaman tidak ditemukan.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Kesalahan', message: 'Terjadi kesalahan pada server.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ConnectSpace berjalan di http://localhost:${port}`));
