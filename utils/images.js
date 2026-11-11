const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Whitelist tipe gambar; ekstensi ditentukan server (bukan dari nama file pengguna)
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error('Format gambar harus JPG, PNG, GIF, atau WebP.')),
});

// Middleware upload 1 file; error upload -> flash + redirect
function uploadSingle(field) {
  const handler = upload.single(field);
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (!err) return next();
      req.session.flash = {
        type: 'danger',
        msg: err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar maksimal 2 MB.' : err.message,
      };
      res.redirect(req.get('Referer') || '/');
    });
}

// Cek "magic bytes" agar berkas benar-benar gambar, bukan sekadar mimetype palsu
function hasImageSignature(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(12);
    fs.readSync(fd, b, 0, 12, 0);
    fs.closeSync(fd);
    return (
      (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
      b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ||
      b.slice(0, 4).toString('ascii') === 'GIF8' ||
      (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP')
    );
  } catch {
    return false;
  }
}

// Hapus berkas lokal (abaikan jika berupa URL eksternal)
function removeImage(p) {
  if (!p || !p.startsWith('/uploads/')) return;
  const full = path.join(UPLOAD_DIR, path.basename(p));
  fs.unlink(full, () => {});
}

function discardUpload(req) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

// Tentukan sumber gambar: file upload (prioritas) atau URL. Return { path } atau { error }
function resolveImage(req, urlField) {
  if (req.file) {
    if (!hasImageSignature(req.file.path)) {
      discardUpload(req);
      return { error: 'Berkas yang diunggah bukan gambar yang valid.' };
    }
    return { path: '/uploads/' + req.file.filename };
  }
  const url = String((req.body && req.body[urlField]) || '').trim();
  if (!url) return { path: null };
  let ok = url.length <= 255 && /^https?:\/\/\S+$/i.test(url);
  if (ok) {
    try { new URL(url); } catch { ok = false; }
  }
  return ok ? { path: url } : { error: 'URL gambar tidak valid (harus http/https, maksimal 255 karakter).' };
}

module.exports = { uploadSingle, resolveImage, removeImage, discardUpload };
