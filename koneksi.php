<?php
// Koneksi database MySQL untuk modul OTP-Email
$host = "localhost";
$user = "root";
$pass = "";
$db   = "db_regis";

$koneksi = mysqli_connect($host, $user, $pass, $db);

if (!$koneksi) {
    die("Koneksi Database Gagal: " . mysqli_connect_error());
}
?>
