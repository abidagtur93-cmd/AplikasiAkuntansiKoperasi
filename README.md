# SIAKAD-KDMP v4.5 - Sistem Informasi Akuntansi Koperasi Desa Merah Putih (Cloud Multi-Device & Real-Time OTP)

Paket kode lengkap **SIAKAD-KDMP v4.5** yang telah dilengkapi keamanan berlapis (3-faktor verifikasi terenkripsi SHA-256 untuk Administrator Aplikasi, 2FA Real-Time Email OTP dari `kkmmagelang@gmail.com` untuk Admin Utama Usaha, Login Terpisah untuk Karyawan), sinkronisasi penuh antara Daftar Akun (COA) dengan seluruh Wizard Transaksi (Kas/Bank, Simpan Pinjam, Pinjaman Eksternal, Hibah, Persediaan & Barang Konsinyasi), validasi input wajib angka berpemisah ribuan (`.`), serta inisialisasi ruang kerja kosong (`0` data) saat pembuatan akun usaha baru.

## 1. Panduan Bagian Koding untuk Memasukkan 16 Digit Kode App Password Email (`kkmmagelang@gmail.com`)

Pengiriman email OTP *real-time* kepada Admin Utama Usaha kini dikunci menggunakan email resmi pengirim **`kkmmagelang@gmail.com`** di sisi server (`api/cloud-sync.js`), sehingga panel pengaturan SMTP telah dihapus dari tampilan layar aplikasi agar aman dari perubahan pihak luar.

### Langkah A — Cara Mendapatkan 16 Digit Kode Google App Password dari `kkmmagelang@gmail.com`
1. Masuk ke akun Google **`kkmmagelang@gmail.com`** melalui alamat: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Pastikan fitur **Verifikasi 2 Langkah (2-Step Verification)** sudah berstatus **Aktif (On)**.
3. Buka halaman pembuatan Sandi Aplikasi (App Passwords) di: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Pada kolom **App name (Nama aplikasi)**, ketik: `SIAKAD-KDMP` lalu klik tombol **Create (Buat)**.
5. Akan muncul kotak berisi **16 digit kode huruf** (contoh: `abcd efgh ijkl mnop`). Salin 16 digit kode tersebut.

### Langkah B — Bagian Koding Tempat Menempelkan 16 Digit Kode (`api/cloud-sync.js`)
Buka file **`api/cloud-sync.js`** pada baris **19–20**:

```javascript
// File: api/cloud-sync.js (Baris 19 - 20)
const DEFAULT_SMTP_USER = process.env.SMTP_USER || "kkmmagelang@gmail.com";
const DEFAULT_SMTP_PASS = process.env.SMTP_PASS || "TEMPEL_16_DIGIT_KODE_APP_PASSWORD_DISINI";
```

Ganti tulisan `"TEMPEL_16_DIGIT_KODE_APP_PASSWORD_DISINI"` pada **baris 20** dengan 16 digit kode yang Anda dapatkan dari akun `kkmmagelang@gmail.com` (spasi otomatis dihapus oleh sistem, jadi boleh ditulis dengan atau tanpa spasi):

```javascript
// Contoh setelah diisi 16 digit kode di file api/cloud-sync.js (Baris 19 - 20):
const DEFAULT_SMTP_USER = process.env.SMTP_USER || "kkmmagelang@gmail.com";
const DEFAULT_SMTP_PASS = process.env.SMTP_PASS || "abcdefghijklmnop";
```

*(Alternatif Tanpa Edit Koding)*: Selain mengedit baris 20 di `api/cloud-sync.js`, Anda juga dapat memasukkan 16 digit kode tersebut langsung di dashboard **Vercel** melalui menu **Settings** &rarr; **Environment Variables**:
- **Key / Name**: `SMTP_PASS`
- **Value**: *(16 digit kode App Password dari `kkmmagelang@gmail.com`)*
- Klik **Save**, lalu lakukan **Redeploy**.

## 2. Tutorial Server Hosting & Database Cloud (Vercel + Upstash Redis) Agar Aplikasi Bisa Diakses di Mana Saja & Kapan Saja oleh Semua Device

Agar aplikasi dapat diakses dari perangkat mana saja (Laptop, PC, HP, Tablet) secara *real-time* dan data yang diinput atau dihapus di Device 1 langsung ter-update otomatis di Device 2, aplikasi membutuhkan **Hosting Web Serverless (Vercel)** + **Cloud Database Penyimpanan Bersama (Upstash Redis)**.

### Tahap 1 — Upload Kode ke GitHub
1. Login ke akun GitHub Anda dan buka repositori proyek Anda (contoh: `AplikasiAkuntansiKoperasi`).
2. Ekstrak file **`siakad_kdmp_vercel_ready.zip`**, lalu upload seluruh isinya ke repositori GitHub Anda:
   - `index.html`
   - `api/cloud-sync.js` *(pastikan baris 20 sudah diisi 16 digit kode App Password `kkmmagelang@gmail.com`)*
   - `vercel.json`
   - `package.json`
   - `README.md`
3. Klik **Commit changes**.

### Tahap 2 — Hubungkan GitHub ke Hosting Vercel
1. Buka [https://vercel.com](https://vercel.com) dan login menggunakan akun GitHub Anda.
2. Klik **Add New...** &rarr; **Project**, lalu pilih repositori **`AplikasiAkuntansiKoperasi`** dan klik **Import** &rarr; **Deploy**.

### Tahap 3 — Hubungkan Database Cloud Upstash Redis (Wajib untuk Sinkronisasi Lintas Device)
Karena fungsi API standar di Vercel bersifat *stateless* (sementara), Anda wajib menyambungkan gudang database cloud gratis **Upstash Redis** agar semua perangkat membaca dan menyimpan ke satu database pusat yang sama:
1. Buka proyek Anda di Dashboard Vercel, lalu klik tab **Storage** di menu atas.
2. Klik tombol **Create Database** atau **Browse Storage**.
3. Pada daftar penyedia database yang muncul, pilih **Upstash** (*Serverless DB - Redis*) &rarr; pilih **Redis** &rarr; klik **Continue**.
4. Pilih paket **Free (Gratis - $0/bulan)**, pilih region terdekat (misalnya `Singapore / ap-southeast-1`), beri nama database (misalnya `siakad-kdmp-db`), lalu klik **Create**.
5. Setelah database selesai dibuat, klik tombol **Connect Project**, pilih proyek aplikasi Anda (`aplikasiakuntansikoperasi`), centang semua *environment* (*Production, Preview, Development*), lalu klik **Connect**.
   *(Langkah ini otomatis mengisi `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` ke dalam kode `api/cloud-sync.js` baris 204–205).*

### Tahap 4 — Lakukan Redeploy (Wajib Agar Database & OTP Aktif)
1. Masih di Dashboard Vercel proyek Anda, klik tab **Deployments** di menu atas.
2. Pada baris deployment paling atas (terbaru), klik ikon titik tiga (**`...`**) di sebelah kanan &rarr; pilih **Redeploy** &rarr; klik **Redeploy**.
3. Tunggu sekitar 15–30 detik hingga status berubah menjadi **Ready**.
4. Sekarang buka link aplikasi Vercel Anda dari Laptop maupun HP — setiap pembuatan akun usaha, transaksi jurnal, perubahan COA, hingga penghapusan akun akan langsung tersinkronisasi secara *real-time* di semua perangkat!

## 3. Ringkasan Fitur & Pembaruan Terbaru

| Modul / Fitur | Spesifikasi Teknis & Akuntansi |
| :--- | :--- |
| **Keamanan Login Administrator Aplikasi** | Menggunakan 3 lapis verifikasi: Username, Password, dan **Unique Code Verifikasi Admin** yang disimpan menggunakan *one-way hash* SHA-256 (`SYS_ADMIN_UNIQUE_CODE_HASHES`), sehingga kode verifikasi tidak pernah tampil di *source code* saat di-*inspect* (F12). |
| **OTP Real-Time Admin Usaha** | Dikirim otomatis dari email sistem **`kkmmagelang@gmail.com`** melalui protokol TLS `smtp.gmail.com:465` ke email resmi Admin Utama Usaha yang didaftarkan. |
| **Inisialisasi Akun Usaha Baru Kosong (Clean State)** | Saat membuat Akun Usaha baru, seluruh form **Identitas Koperasi**, **Database Anggota**, **Daftar Barang Persediaan**, **Data Supplier**, **Database Karyawan**, dan **Buku Jurnal** dimulai dalam keadaan kosong (`0` data / belum terisi). |
| **Integrasi Penuh COA & Wizard Transaksi** | Seluruh *dropdown* akun di **Wizard Simpan Pinjam, Pinjaman & Hibah** maupun **Wizard Transaksi Barang & Konsinyasi** terhubung langsung secara dinamis ke **Daftar Akun (COA)**. Mencakup akun Kas & Bank (`1.1.1.*`), Piutang/Pinjaman Anggota (`1.1.2.*`), Persediaan & Konsinyasi (`1.1.4.*`), Utang Usaha/Konsinyasi/Dana Bergulir (`2.1.*`), Pinjaman Bank & Pihak Ketiga (`2.2.*`), Simpanan Anggota (`3.1.*`), Hibah (`3.2.1.*`), Cadangan (`3.3.1.*`), dan Laba Ditahan (`3.4.2.01`). Jika nama atau kode akun diedit di menu COA, seluruh Wizard dan Laporan otomatis mengikuti perubahan tersebut. |
| **Validasi Input Nominal Wajib Angka + Pemisah Titik (`.`)** | Seluruh kolom input nominal dan kuantitas menolak ketikan huruf/simbol non-angka secara *real-time* dan otomatis memformat ribuan dengan tanda titik (`.`). |
