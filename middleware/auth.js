// Auth guard: hanya untuk pengguna yang sudah login
function requireAuth(req, res, next) {
  if (res.locals.me) return next();
  req.session.flash = { type: 'warning', msg: 'Silakan login terlebih dahulu untuk mengakses halaman tersebut.' };
  res.redirect('/login');
}

// Guest guard: pengguna yang sudah login dilarang membuka Login/Register
function guestOnly(req, res, next) {
  if (res.locals.me) return res.redirect('/');
  next();
}

module.exports = { requireAuth, guestOnly };
