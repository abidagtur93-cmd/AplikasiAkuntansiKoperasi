<?php
// ============================================================================
// FORM KIRIM OTP EMAIL DENGAN PHPMAILER & OTP HASHING
// Referensi:
// - Library PHPMailer: https://github.com/PHPMailer/PHPMailer
// - Source Code: https://github.com/bisangoding-id/OTP-Email
// ============================================================================
session_start();
require_once 'koneksi.php';
require_once 'PHPMailer/src/Exception.php';
require_once 'PHPMailer/src/PHPMailer.php';
require_once 'PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Hapus otomatis OTP yang sudah kedaluwarsa (expire)
if ($conn) {
    $now = date("Y-m-d H:i:s");
    mysqli_query($conn, "DELETE FROM otp_mail WHERE expire < '$now'");
}

$notif = "";
$notif_type = "";

if (isset($_POST['kirim_otp'])) {
    unset($_SESSION['email']);
    $raw_email = trim($_POST['email'] ?? '');
    $email = filter_var($raw_email, FILTER_SANITIZE_EMAIL);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $notif = "Format alamat email tidak valid!";
        $notif_type = "error";
    } else {
        // Generate 6 digit OTP (100000 s.d. 999999)
        $otp = random_int(100000, 999999);
        // Enkripsi OTP menggunakan password_hash agar di database tersimpan sebagai hash aman
        $otp_hash = password_hash((string)$otp, PASSWORD_DEFAULT);
        // Masa berlaku OTP: 120 detik (2 menit) sesuai bisangoding-id/OTP-Email
        $expire = date("Y-m-d H:i:s", time() + 120);

        if ($conn) {
            $email_esc = mysqli_real_escape_string($conn, $email);
            $hash_esc = mysqli_real_escape_string($conn, $otp_hash);
            mysqli_query($conn, "DELETE FROM otp_mail WHERE email = '$email_esc'");
            mysqli_query($conn, "INSERT INTO otp_mail (email, otp_hash, expire) VALUES ('$email_esc', '$hash_esc', '$expire')");
        }

        $_SESSION['email'] = $email;
        $_SESSION['otp_hash_fallback'] = $otp_hash;
        $_SESSION['otp_expire_fallback'] = time() + 120;

        // Pengaturan SMTP PHPMailer (Gunakan Google App Password 16 karakter)
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host       = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = getenv('SMTP_USER') ?: 'bisangoding.id@gmail.com'; // Ganti dengan email pengirim
            $mail->Password   = getenv('SMTP_PASS') ?: 'xxxx xxxx xxxx xxxx';      // Ganti dengan Google App Password (tanpa spasi)
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = (int)(getenv('SMTP_PORT') ?: 587);

            $mail->setFrom($mail->Username, 'SIAKAD-KDMP OTP Verification');
            $mail->addAddress($email);
            $mail->isHTML(true);
            $mail->Subject = 'Kode OTP Verifikasi Anda - SIAKAD KDMP';
            $mail->Body    = "
                <div style='font-family:Arial,sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:10px;'>
                    <h3 style='color:#991b1b;margin-top:0;'>Kode OTP Verifikasi Anda</h3>
                    <p>Berikut adalah kode OTP verifikasi login Admin Utama SIAKAD-KDMP Anda:</p>
                    <h1 style='letter-spacing:6px;background:#fef2f2;color:#991b1b;padding:12px 20px;display:inline-block;border-radius:8px;'>$otp</h1>
                    <p>Kode ini berlaku selama <strong>2 menit</strong>. Jangan berikan kode OTP ini kepada siapapun.</p>
                </div>
            ";
            $mail->send();
            $notif = "OTP telah dikirim ke email $email";
            $notif_type = "success";
        } catch (Exception $e) {
            $notif = "OTP tercatat di sistem. Catatan SMTP: " . $mail->ErrorInfo;
            $notif_type = "success";
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Kirim OTP Email - SIAKAD KDMP (bisangoding-id/OTP-Email)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; background: #f1f5f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #fff; padding: 28px; border-radius: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); width: 100%; max-width: 400px; }
        h2 { margin-top: 0; color: #0f172a; font-size: 18px; }
        input[type="email"] { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; margin-bottom: 14px; }
        button, .btn-link { width: 100%; padding: 10px; border: none; border-radius: 8px; background: #b91c1c; color: #fff; font-weight: bold; cursor: pointer; display: block; text-align: center; text-decoration: none; box-sizing: border-box; }
        .btn-link { background: #059669; margin-top: 10px; }
        .alert { padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    </style>
</head>
<body>
<div class="card">
    <h2>Verifikasi OTP Email SIAKAD-KDMP</h2>
    <?php if ($notif): ?>
        <div class="alert"><?= htmlspecialchars($notif) ?></div>
        <?php if ($notif_type === 'success'): ?>
            <a href="verifikasi.php" class="btn-link">Masuk ke Verifikasi OTP &rarr;</a>
        <?php endif; ?>
    <?php endif; ?>
    <form method="POST" action="">
        <label style="font-size:13px;font-weight:bold;display:block;margin-bottom:6px;">Alamat Email Terdaftar</label>
        <input type="email" name="email" required placeholder="Masukkan alamat email..." autocomplete="off">
        <button type="submit" name="kirim_otp">Kirim Kode OTP</button>
    </form>
</div>
</body>
</html>
