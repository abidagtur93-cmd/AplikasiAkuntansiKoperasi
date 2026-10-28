<?php
// ============================================================================
// HALAMAN VERIFIKASI 6-DIGIT OTP + AUTO-PASTE & COUNTDOWN TIMER
// Referensi: https://github.com/bisangoding-id/OTP-Email
// ============================================================================
session_start();
require_once 'koneksi.php';

if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit;
}

$email = $_SESSION['email'];
$remaining = 0;

if ($conn) {
    $email_esc = mysqli_real_escape_string($conn, $email);
    $q = mysqli_query($conn, "SELECT * FROM otp_mail WHERE email = '$email_esc' ORDER BY id DESC LIMIT 1");
    if ($row = mysqli_fetch_assoc($q)) {
        $remaining = max(0, strtotime($row['expire']) - time());
    }
} else if (isset($_SESSION['otp_expire_fallback'])) {
    $remaining = max(0, $_SESSION['otp_expire_fallback'] - time());
}

$msg = "";
$is_valid = false;

if (isset($_POST['verifikasi_otp'])) {
    $digits = $_POST['otp'] ?? [];
    $entered_otp = implode("", array_map('trim', (array)$digits));

    $hash_to_check = null;
    $not_expired = false;

    if ($conn) {
        $email_esc = mysqli_real_escape_string($conn, $email);
        $q = mysqli_query($conn, "SELECT * FROM otp_mail WHERE email = '$email_esc' ORDER BY id DESC LIMIT 1");
        if ($row = mysqli_fetch_assoc($q)) {
            $hash_to_check = $row['otp_hash'];
            $not_expired = (strtotime($row['expire']) >= time());
        }
    } else if (isset($_SESSION['otp_hash_fallback'])) {
        $hash_to_check = $_SESSION['otp_hash_fallback'];
        $not_expired = (($_SESSION['otp_expire_fallback'] ?? 0) >= time());
    }

    if ($hash_to_check && $not_expired && password_verify($entered_otp, $hash_to_check)) {
        $is_valid = true;
        $msg = "Verifikasi OTP Berhasil!";
        if ($conn) {
            $email_esc = mysqli_real_escape_string($conn, $email);
            mysqli_query($conn, "DELETE FROM otp_mail WHERE email = '$email_esc'");
        }
        unset($_SESSION['email']);
    } else {
        $msg = "Kode OTP tidak sesuai atau sudah kedaluwarsa!";
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Verifikasi Kode OTP - SIAKAD KDMP</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; background: #f1f5f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #fff; padding: 28px; border-radius: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); width: 100%; max-width: 420px; text-align: center; }
        .otp-boxes { display: flex; gap: 8px; justify-content: center; margin: 18px 0; }
        .otp-boxes input { width: 44px; height: 50px; text-align: center; font-size: 20px; font-weight: bold; border: 2px solid #cbd5e1; border-radius: 8px; }
        button { width: 100%; padding: 11px; border: none; border-radius: 8px; background: #b91c1c; color: #fff; font-weight: bold; cursor: pointer; }
        .timer { font-size: 13px; color: #475569; margin-bottom: 14px; font-weight: bold; }
    </style>
</head>
<body>
<div class="card">
    <h3>Verifikasi Kode OTP Email</h3>
    <p style="font-size:13px;color:#64748b;">Email: <strong><?= htmlspecialchars($email) ?></strong></p>
    <?php if ($msg): ?>
        <p style="padding:10px;border-radius:8px;background:<?= $is_valid ? '#ecfdf5' : '#fef2f2' ?>;color:<?= $is_valid ? '#065f46' : '#991b1b' ?>;font-weight:bold;"><?= htmlspecialchars($msg) ?></p>
    <?php endif; ?>
    <form method="POST" action="">
        <div class="otp-boxes" id="otpInputsContainer">
            <?php for ($i = 0; $i < 6; $i++): ?>
                <input type="text" name="otp[]" maxlength="1" required inputmode="numeric" pattern="[0-9]">
            <?php endfor; ?>
        </div>
        <div class="timer" id="countdownTimer">Sisa Waktu: <?= (int)$remaining ?> detik</div>
        <button type="submit" name="verifikasi_otp">Verifikasi OTP</button>
    </form>
</div>
<script>
    // Countdown Timer & Auto-Paste 6 Digit OTP (Sesuai bisangoding-id/OTP-Email)
    let remaining = <?= (int)$remaining ?>;
    const timerEl = document.getElementById('countdownTimer');
    const timerInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(timerInterval);
            timerEl.textContent = "OTP Kedaluwarsa! Mengalihkan kembali...";
            setTimeout(() => { window.location.href = 'index.php'; }, 2000);
        } else {
            timerEl.textContent = "Sisa Waktu: " + remaining + " detik";
        }
    }, 1000);

    const inputs = document.querySelectorAll('#otpInputsContainer input');
    inputs.forEach((inp, idx) => {
        inp.addEventListener('input', () => {
            inp.value = inp.value.replace(/[^0-9]/g, '');
            if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
        });
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
        });
        inp.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
            pasted.split('').forEach((ch, i) => {
                if (inputs[i]) inputs[i].value = ch;
            });
            if (inputs[Math.min(pasted.length, 5)]) inputs[Math.min(pasted.length, 5)].focus();
        });
    });
</script>
</body>
</html>
