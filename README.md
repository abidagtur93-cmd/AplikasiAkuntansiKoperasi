# Modul OTP Email Real-Time (Arsitektur PHPMailer & bisangoding-id/OTP-Email)

Modul ini adalah implementasi backend PHP dan MySQL untuk pengiriman OTP real-time:

1. **Database Schema (`db_regis.sql`)**:
   - Tabel `otp_mail` dengan kolom `email`, `otp_hash` (SHA-256), `expire`, dan `created_at`.
2. **Koneksi Database (`koneksi.php`)**:
   - Menghubungkan script ke database MySQL.
3. **Endpoint API Real-Time (`api_otp.php`)**:
   - `action=send_otp`: Menghasilkan 6-digit OTP, menyimpan hash terenkripsi ke database dengan masa aktif 120 detik, dan mengirimkan email secara instan.
   - `action=verify_otp`: Memvalidasi OTP yang dimasukkan pengguna, memeriksa masa berlaku `expire >= NOW()`, dan menghapus OTP setelah digunakan (*one-time password*).
4. **Vercel Serverless Alternative (`/api/cloud-sync.js`)**:
   - SIAKAD-KDMP v4.5 juga menyertakan endpoint Node.js serverless bawaan Vercel yang otomatis menjalankan logika OTP yang sama tanpa mewajibkan server PHP/MySQL terpisah.
