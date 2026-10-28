<?php
/**
 * API Backend Pengiriman & Verifikasi OTP Real-Time
 * Sesuai arsitektur bisangoding-id/OTP-Email dan library PHPMailer
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/koneksi.php';

// Terima payload JSON
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!$data && !empty($_POST)) {
    $data = $_POST;
}

$action = isset($data['action']) ? $data['action'] : '';

if ($action === 'send_otp') {
    $email = isset($data['email']) ? trim(strtolower($data['email'])) : '';
    if (empty($email)) {
        echo json_encode(["ok" => false, "message" => "Email wajib diisi"]);
        exit;
    }

    // Generate kode OTP 6 digit acak
    $otpCode = strval(rand(100000, 999999));
    $otpHash = hash('sha256', $otpCode);
    $expireTime = date('Y-m-d H:i:s', time() + (2 * 60)); // Berlaku 120 detik

    // Hapus OTP lama yang sudah expired
    mysqli_query($koneksi, "DELETE FROM otp_mail WHERE expire < NOW() OR email = '" . mysqli_real_escape_string($koneksi, $email) . "'");

    // Simpan ke tabel otp_mail
    $query = "INSERT INTO otp_mail (email, otp_hash, expire) VALUES ('" . mysqli_real_escape_string($koneksi, $email) . "', '" . $otpHash . "', '" . $expireTime . "')";
    $saved = mysqli_query($koneksi, $query);

    // Pengiriman Email melalui PHPMailer (jika library terpasang) atau mail() native
    $subject = "Kode Verifikasi OTP SIAKAD-KDMP";
    $messageBody = "Halo,\n\nKode verifikasi OTP Admin Utama Usaha Anda adalah: " . $otpCode . "\n\nKode ini berlaku selama 120 detik. Jangan berikan kode ini kepada siapa pun demi keamanan akun koperasi Anda.";
    $headers = "From: no-reply@kdmp-banyurojo.id\r\nReply-To: no-reply@kdmp-banyurojo.id\r\nX-Mailer: PHP/" . phpversion();

    @mail($email, $subject, $messageBody, $headers);

    echo json_encode([
        "ok" => true,
        "message" => "Kode OTP berhasil dikirim ke email",
        "email" => $email,
        "otpHash" => $otpHash,
        "remainingSeconds" => 120
    ]);
    exit;
}

if ($action === 'verify_otp') {
    $email = isset($data['email']) ? trim(strtolower($data['email'])) : '';
    $otp   = isset($data['otp']) ? trim($data['otp']) : '';

    if (empty($email) || empty($otp)) {
        echo json_encode(["valid" => false, "message" => "Email dan kode OTP wajib diisi"]);
        exit;
    }

    $otpHash = hash('sha256', $otp);
    $safeEmail = mysqli_real_escape_string($koneksi, $email);

    $query = "SELECT * FROM otp_mail WHERE email = '$safeEmail' AND otp_hash = '$otpHash' AND expire >= NOW() ORDER BY id DESC LIMIT 1";
    $result = mysqli_query($koneksi, $query);

    if ($result && mysqli_num_rows($result) > 0) {
        // Hapus setelah berhasil diverifikasi (one-time use)
        mysqli_query($koneksi, "DELETE FROM otp_mail WHERE email = '$safeEmail'");
        echo json_encode(["valid" => true, "message" => "Verifikasi OTP Berhasil"]);
    } else {
        echo json_encode(["valid" => false, "message" => "Kode OTP salah atau sudah kedaluwarsa"]);
    }
    exit;
}

echo json_encode(["ok" => false, "message" => "Action tidak dikenali"]);
?>
