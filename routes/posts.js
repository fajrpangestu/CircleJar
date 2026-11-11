const router = require('express').Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { uploadSingle, resolveImage, removeImage, discardUpload } = require('../utils/images');

router.use(requireAuth);

const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
const toFeed = (res, id) => res.redirect(id ? `/#post-${id}` : '/');
const validId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

// ---------- Feed ----------
router.get('/', async (req, res, next) => {
  try {
    const [posts] = await pool.query(
      `SELECT p.id, p.user_id, p.content, p.image, p.created_at, u.name, u.avatar,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked
         FROM posts p JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC, p.id DESC`,
      [res.locals.me.id]
    );
    const byPost = {};
    if (posts.length) {
      const [comments] = await pool.query(
        `SELECT c.id, c.post_id, c.comment, c.image, c.created_at, u.name, u.avatar
           FROM comments c JOIN users u ON u.id = c.user_id
          WHERE c.post_id IN (?) ORDER BY c.created_at ASC, c.id ASC`,
        [posts.map((p) => p.id)]
      );
      comments.forEach((c) => (byPost[c.post_id] = byPost[c.post_id] || []).push(c));
    }
    posts.forEach((p) => (p.comments = byPost[p.id] || []));
    res.render('index', { title: 'Beranda', posts });
  } catch (e) { next(e); }
});

router.get('/posts/new', (req, res) => res.render('post-new', { title: 'Buat Postingan' }));

// ---------- Buat postingan ----------
router.post('/posts', uploadSingle('image'), async (req, res, next) => {
  try {
    const content = String(req.body.content || '').trim();
    const img = resolveImage(req, 'image_url');
    let error = img.error;
    if (!error && content.length > 2000) error = 'Teks status maksimal 2000 karakter.';
    if (!error && !content && !img.path) error = 'Status tidak boleh kosong: isi teks atau sertakan gambar.';
    if (error) {
      discardUpload(req);
      flash(req, 'danger', error);
      return res.redirect(req.get('Referer') || '/');
    }
    await pool.execute('INSERT INTO posts (user_id, content, image) VALUES (?, ?, ?)', [res.locals.me.id, content || null, img.path]);
    flash(req, 'success', 'Status berhasil diposting.');
    res.redirect('/');
  } catch (e) { discardUpload(req); next(e); }
});

// ---------- Like (toggle) ----------
router.post('/posts/:id/like', async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.redirect('/');
    const [p] = await pool.execute('SELECT id FROM posts WHERE id = ?', [id]);
    if (!p.length) { flash(req, 'danger', 'Postingan tidak ditemukan.'); return res.redirect('/'); }

    const uid = res.locals.me.id;
    const [del] = await pool.execute('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [uid, id]); // unlike
    if (del.affectedRows === 0) {
      try {
        await pool.execute('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [uid, id]); // like
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e; // klik ganda cepat: UNIQUE KEY menjaga 1 like/user/post
      }
    }
    toFeed(res, id);
  } catch (e) { next(e); }
});

// ---------- Komentar (teks + gambar opsional) ----------
router.post('/posts/:id/comments', uploadSingle('image'), async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    const comment = String(req.body.comment || '').trim();
    const img = resolveImage(req, 'image_url');
    let error = img.error;
    if (!error && !id) error = 'Postingan tidak valid.';
    if (!error && comment.length > 1000) error = 'Komentar maksimal 1000 karakter.';
    if (!error && !comment && !img.path) error = 'Komentar tidak boleh kosong: isi teks atau sertakan gambar.';
    if (!error) {
      const [p] = await pool.execute('SELECT id FROM posts WHERE id = ?', [id]);
      if (!p.length) error = 'Postingan tidak ditemukan.';
    }
    if (error) {
      discardUpload(req);
      flash(req, 'danger', error);
      return toFeed(res, id);
    }
    await pool.execute('INSERT INTO comments (post_id, user_id, comment, image) VALUES (?, ?, ?, ?)', [id, res.locals.me.id, comment || null, img.path]);
    toFeed(res, id);
  } catch (e) { discardUpload(req); next(e); }
});

// ---------- Hapus postingan (hanya pemilik) ----------
router.post('/posts/:id/delete', async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    const uid = res.locals.me.id;
    const [rows] = id ? await pool.execute('SELECT image FROM posts WHERE id = ? AND user_id = ?', [id, uid]) : [[]];
    if (!rows.length) {
      flash(req, 'danger', 'Anda tidak berhak menghapus postingan ini.');
      return res.status(403).redirect('/');
    }
    const [cimgs] = await pool.execute('SELECT image FROM comments WHERE post_id = ? AND image IS NOT NULL', [id]);
    await pool.execute('DELETE FROM posts WHERE id = ? AND user_id = ?', [id, uid]); // komentar & like ikut terhapus (CASCADE)
    removeImage(rows[0].image);
    cimgs.forEach((c) => removeImage(c.image));
    flash(req, 'success', 'Postingan dihapus.');
    res.redirect('/');
  } catch (e) { next(e); }
});

module.exports = router;
