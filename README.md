# ConnectSpace – MVP Media Sosial (Node.js + Express + MySQL + Tailwind CSS)

## Menjalankan
1. `npm install`
2. Impor skema: `mysql -u root -p < schema.sql`
3. `cp .env.example .env` lalu sesuaikan kredensial DB dan `SESSION_SECRET`
4. `npm start` → buka http://localhost:3000

## Tailwind CSS
- File CSS hasil build sudah disertakan di `public/css/app.css`, jadi tidak perlu build ulang untuk menjalankan aplikasi.
- Jika Anda mengubah tampilan (`views/*.ejs` atau `src/input.css`), jalankan:
  - `npm run build:css` (sekali), atau
  - `npm run watch:css` (otomatis saat file berubah)
- Konfigurasi: `tailwind.config.js`; komponen kustom (`.btn`, `.input`, `.card`, dst.) ada di `src/input.css`.
- Font Inter dimuat dari Google Fonts (jika offline, otomatis memakai font sistem).
