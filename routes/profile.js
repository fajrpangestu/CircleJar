const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { uploadSingle, resolveImage, removeImage, discardUpload } = require('../utils/images');

router.use(requireAuth);

router.get('/profile', (req, res) => res.render('profile', { title: 'Edit Profil' }));

router.post('/profile', uploadSingle('avatar'), async (req, res, next) => {
  try {
    const me = res.locals.me;
    const name = String(req.body.name || '').trim();
    const bio = String(req.body.bio || '').trim();
    const errors = [];
    if (!name) errors.push('Nama pengguna wajib diisi.');
    else if (name.length > 100) errors.push('Nama maksimal 100 karakter.');
    if (bio.length > 500) errors.push('Bio maksimal 500 karakter.');

    let avatar = me.avatar;
    const img = resolveImage(req, 'avatar_url');
    if (img.error) errors.push(img.error);

    if (errors.length) {
      discardUpload(req);
      return res.status(422).render('profile', { title: 'Edit Profil', errors, old: { name, bio } });
    }
    if (img.path) avatar = img.path;
    else if (req.body.remove_avatar === '1') avatar = null;

    await pool.execute('UPDATE users SET name = ?, bio = ?, avatar = ? WHERE id = ?', [name, bio || null, avatar, me.id]);
    if (avatar !== me.avatar) removeImage(me.avatar);

    req.session.flash = { type: 'success', msg: 'Profil berhasil diperbarui.' };
    res.redirect('/profile');
  } catch (e) { discardUpload(req); next(e); }
});

router.post('/profile/password', async (req, res, next) => {
  try {
    const oldPw = String(req.body.old_password || '');
    const newPw = String(req.body.new_password || '');
    const confirm = String(req.body.new_password_confirmation || '');
    const errors = [];

    const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [res.locals.me.id]);
    if (!oldPw || !(await bcrypt.compare(oldPw, rows[0].password))) errors.push('Password lama salah.');
    if (newPw.length < 6) errors.push('Password baru minimal 6 karakter.');
    if (newPw !== confirm) errors.push('Konfirmasi password baru tidak cocok.');
    if (!errors.length && oldPw === newPw) errors.push('Password baru tidak boleh sama dengan password lama.');
    if (errors.length) return res.status(422).render('profile', { title: 'Edit Profil', errors });

    const hash = await bcrypt.hash(newPw, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hash, res.locals.me.id]);
    req.session.flash = { type: 'success', msg: 'Password berhasil diubah.' };
    res.redirect('/profile');
  } catch (e) { next(e); }
});

module.exports = router;
