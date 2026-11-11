const mysql = require('mysql2');

// Membuat koneksi ke database MySQL (XAMPP default: user 'root', password kosong)
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'CircleJar' // Pastikan database ini sudah Anda buat di phpMyAdmin
});

db.connect((err) => {
  if (err) {
    console.error('❌ Gagal terhubung ke database:', err.stack);
    return;
  }
  console.log('✅ Berhasil terhubung ke database MySQL dengan ID:', db.threadId);
});

module.exports = db;