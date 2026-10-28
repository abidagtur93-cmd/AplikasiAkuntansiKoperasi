-- Database schema sesuai repositori bisangoding-id/OTP-Email & panduan PHPMailer
CREATE DATABASE IF NOT EXISTS db_regis;
USE db_regis;

-- Tabel otp_mail untuk menyimpan hash OTP dan masa berlaku
CREATE TABLE IF NOT EXISTS otp_mail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expire DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk pencarian cepat berdasarkan email
CREATE INDEX idx_otp_email ON otp_mail (email);
