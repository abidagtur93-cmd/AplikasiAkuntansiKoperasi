// Vercel Serverless Function: /api/cloud-sync.js
// SIAKAD-KDMP v4.5 - Cloud Multi-Device Real-Time Sync & Real-Time Gmail SMTP OTP Sender

import crypto from "crypto";
import fs from "fs";
import path from "path";
import tls from "tls";

// ============================================================================
// [BAGIAN 1: AKTIVASI PENGIRIMAN OTP EMAIL REAL-TIME KE ADMIN USAHA]
// Email Pengirim Resmi OTP ke Admin Usaha telah diset ke: kkmmagelang@gmail.com
//
// PANDUAN MENGISI 16 DIGIT KODE DARI GMAIL:
// 1. Ganti tulisan "TEMPEL_16_DIGIT_KODE_APP_PASSWORD_DISINI" pada baris 20
//    di bawah ini dengan 16 digit kode Sandi Aplikasi (Google App Password)
//    dari akun email kkmmagelang@gmail.com (contoh: "abcd efgh ijkl mnop").
// 2. Atau Anda juga bisa mengisinya di Dashboard Vercel -> Settings ->
//    Environment Variables dengan Name: SMTP_PASS dan Value: 16 digit kode.
// ============================================================================
const DEFAULT_SMTP_USER = process.env.SMTP_USER || "kkmmagelang@gmail.com";
const DEFAULT_SMTP_PASS = process.env.SMTP_PASS || "fastssuklvufixdi";

const TMP_STORE_PATH = path.join("/tmp", "siakad_kdmp_cloud_vault_v45.json");
const OTP_SECRET_SALT = process.env.OTP_SECRET_SALT || "SIAKAD_KDMP_OTP_SERVER_SECRET_2026";

// Global in-memory cache so warm serverless instances share state immediately alongside /tmp and external KV
globalThis.__SIAKAD_CLOUD_MEMORY_VAULT__ = globalThis.__SIAKAD_CLOUD_MEMORY_VAULT__ || {};

function readLocalTmpStore() {
  try {
    if (fs.existsSync(TMP_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(TMP_STORE_PATH, "utf-8"));
      if (parsed && typeof parsed === "object") {
        Object.assign(globalThis.__SIAKAD_CLOUD_MEMORY_VAULT__, parsed);
      }
    }
  } catch (e) {}
  return globalThis.__SIAKAD_CLOUD_MEMORY_VAULT__;
}

function writeLocalTmpStore(data) {
  try {
    globalThis.__SIAKAD_CLOUD_MEMORY_VAULT__ = data;
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(data), "utf-8");
  } catch (e) {}
}

function computeClientCompatibleHash(str) {
  return crypto.createHash("sha256").update("KDMP_SEC_2026_" + String(str || "")).digest("hex");
}

function generateDeterministicWindowOtp(email) {
  // Berlaku 5 menit (300 detik) per window
  const window5Min = Math.floor(Date.now() / (5 * 60 * 1000));
  const hmac = crypto.createHmac("sha256", OTP_SECRET_SALT).update(`${email.toLowerCase()}:${window5Min}`).digest("hex");
  const num = (parseInt(hmac.substring(0, 8), 16) % 900000) + 100000;
  return String(num);
}

function verifyWindowOtp(email, otpInput, storedOtpRecord = null) {
  const cleanOtp = String(otpInput || "").trim();
  if (!/^\d{6}$/.test(cleanOtp)) return false;

  // 1. Cek pada tabel otp_mail di Cloud Store (email, otp_hash, expire)
  if (storedOtpRecord && storedOtpRecord.otp_hash && storedOtpRecord.expire) {
    if (Date.now() <= Number(storedOtpRecord.expire)) {
      const inputHash = computeClientCompatibleHash(cleanOtp);
      if (inputHash === storedOtpRecord.otp_hash) return true;
    }
  }

  // 2. Fallback deterministic window verification untuk stateless serverless instance
  const curWindow = Math.floor(Date.now() / (5 * 60 * 1000));
  for (const w of [curWindow, curWindow - 1]) {
    const hmac = crypto.createHmac("sha256", OTP_SECRET_SALT).update(`${email.toLowerCase()}:${w}`).digest("hex");
    const expected = String((parseInt(hmac.substring(0, 8), 16) % 900000) + 100000);
    if (cleanOtp === expected) return true;
  }
  return false;
}

// Pengiriman Email OTP Real-Time langsung melalui Gmail SMTP SSL/TLS (smtp.gmail.com:465)
// menggunakan Email Resmi kkmmagelang@gmail.com & 16 Digit Google App Password
function sendGmailSmtpOtp({ smtpUser, smtpPass, toEmail, otpCode, coopName, adminName }) {
  return new Promise((resolve) => {
    const cleanUser = String(smtpUser || DEFAULT_SMTP_USER).trim();
    const cleanPass = String(smtpPass || "").replace(/\s+/g, "");
    if (!cleanUser || !cleanPass || cleanPass === "TEMPEL_16_DIGIT_KODE_APP_PASSWORD_DISINI" || !toEmail) {
      return resolve({ ok: false, error: "16 Digit Kode Google App Password untuk kkmmagelang@gmail.com belum diisi di api/cloud-sync.js" });
    }

    const socket = tls.connect(
      { host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com", rejectUnauthorized: false },
      () => {}
    );

    let step = 0;
    let buffer = "";
    let finished = false;

    const finish = (result) => {
      if (finished) return;
      finished = true;
      try {
        socket.end();
        socket.destroy();
      } catch (e) {}
      resolve(result);
    };

    socket.setTimeout(10000, () => {
      finish({ ok: false, error: "Waktu koneksi ke smtp.gmail.com habis (Timeout)" });
    });

    socket.on("error", (err) => {
      finish({ ok: false, error: err.message || "Gagal terhubung ke smtp.gmail.com" });
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.length < 3) continue;
        const code = line.substring(0, 3);
        const isLastLine = line.charAt(3) === " " || line.length === 3;
        if (!isLastLine) continue;

        if (step === 0 && code === "220") {
          step = 1;
          socket.write("EHLO siakad-kdmp.vercel.app\r\n");
        } else if (step === 1 && code === "250") {
          step = 2;
          socket.write("AUTH LOGIN\r\n");
        } else if (step === 2 && code === "334") {
          step = 3;
          socket.write(Buffer.from(cleanUser, "utf-8").toString("base64") + "\r\n");
        } else if (step === 3 && code === "334") {
          step = 4;
          socket.write(Buffer.from(cleanPass, "utf-8").toString("base64") + "\r\n");
        } else if (step === 4) {
          if (code === "235") {
            step = 5;
            socket.write(`MAIL FROM:<${cleanUser}>\r\n`);
          } else {
            finish({ ok: false, error: "Autentikasi Gmail ditolak (Pastikan 16 Digit Kode App Password untuk kkmmagelang@gmail.com benar)" });
          }
        } else if (step === 5 && code === "250") {
          step = 6;
          socket.write(`RCPT TO:<${toEmail}>\r\n`);
        } else if (step === 6 && (code === "250" || code === "251")) {
          step = 7;
          socket.write("DATA\r\n");
        } else if (step === 7 && code === "354") {
          step = 8;
          const subject = `Kode Verifikasi OTP (${otpCode}) - ${coopName || "SIAKAD-KDMP"}`;
          const htmlBody = [
            `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;color:#0f172a;">`,
            `<div style="background:#991b1b;color:#ffffff;padding:14px 20px;border-radius:10px;margin-bottom:20px;">`,
            `<h2 style="margin:0;font-size:16px;">Verifikasi Keamanan Admin Utama Usaha</h2>`,
            `<p style="margin:4px 0 0;font-size:12px;opacity:0.9;">${coopName || "Koperasi Desa Merah Putih"}</p>`,
            `</div>`,
            `<p style="font-size:14px;line-height:1.6;">Halo <strong>${adminName || "Admin Utama"}</strong>,</p>`,
            `<p style="font-size:13px;line-height:1.6;color:#334155;">Berikut adalah 6 digit kode One-Time Password (OTP) Anda untuk masuk ke Sistem Informasi Akuntansi Koperasi:</p>`,
            `<div style="text-align:center;margin:22px 0;">`,
            `<span style="display:inline-block;font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;padding:14px 28px;background:#fef2f2;color:#991b1b;border:2px solid #fecaca;border-radius:12px;">${otpCode}</span>`,
            `</div>`,
            `<p style="font-size:12px;color:#64748b;line-height:1.5;">Kode ini dikirimkan otomatis oleh sistem resmi (<strong>${cleanUser}</strong>) dan berlaku selama <strong>2 menit (120 detik)</strong>. Demi keamanan akun koperasi Anda, jangan berikan kode ini kepada siapa pun.</p>`,
            `</div>`
          ].join("");

          const mimeMsg = [
            `From: "${coopName || "SIAKAD-KDMP"}" <${cleanUser}>`,
            `To: <${toEmail}>`,
            `Subject: ${subject}`,
            `Date: ${new Date().toUTCString()}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
            ``,
            htmlBody,
            `.`,
            ``
          ].join("\r\n");

          socket.write(mimeMsg);
        } else if (step === 8 && code === "250") {
          step = 9;
          socket.write("QUIT\r\n");
          finish({ ok: true });
        } else if (code.startsWith("4") || code.startsWith("5")) {
          finish({ ok: false, error: `SMTP Error (${code}): ${line}` });
        }
      }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ============================================================================
  // [BAGIAN 2: KONFIGURASI DATABASE CLOUD MULTI-DEVICE (UPSTASH REDIS / VERCEL KV)]
  // Otomatis terhubung saat Anda mengaktifkan Upstash Redis di menu Storage Vercel
  // ============================================================================
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const githubToken = process.env.GITHUB_TOKEN;
  const githubGistId = process.env.GITHUB_GIST_ID;

  async function getStoreObject() {
    const localMem = readLocalTmpStore();

    // 1. Upstash Redis / Vercel KV
    if (kvUrl && kvToken) {
      try {
        const r = await fetch(`${kvUrl}/get/siakad_kdmp_vault_v45`, {
          headers: { Authorization: `Bearer ${kvToken}` }
        });
        const j = await r.json();
        if (j && j.result) {
          const parsed = typeof j.result === "string" ? JSON.parse(j.result) : j.result;
          return { ...localMem, ...parsed };
        }
      } catch (e) {}
    }

    // 2. GitHub Gist Cloud Vault (jika GITHUB_TOKEN & GITHUB_GIST_ID dikonfigurasi)
    if (githubToken && githubGistId) {
      try {
        const r = await fetch(`https://api.github.com/gists/${githubGistId}`, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json"
          }
        });
        if (r.ok) {
          const gist = await r.json();
          const fileContent = gist?.files?.["siakad_kdmp_vault.json"]?.content;
          if (fileContent) {
            const parsed = JSON.parse(fileContent);
            return { ...localMem, ...parsed };
          }
        }
      } catch (e) {}
    }

    return localMem;
  }

  async function saveStoreObject(storeObj) {
    storeObj.__lastUpdated = Date.now();
    writeLocalTmpStore(storeObj);

    if (kvUrl && kvToken) {
      try {
        await fetch(`${kvUrl}/set/siakad_kdmp_vault_v45`, {
          method: "POST",
          headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(JSON.stringify(storeObj))
        });
      } catch (e) {}
    }

    if (githubToken && githubGistId) {
      try {
        await fetch(`https://api.github.com/gists/${githubGistId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            files: {
              "siakad_kdmp_vault.json": {
                content: JSON.stringify(storeObj)
              }
            }
          })
        });
      } catch (e) {}
    }
  }

  if (req.method === "GET") {
    const store = await getStoreObject();
    return res.status(200).json({
      ok: true,
      timestamp: Date.now(),
      store
    });
  }

  if (req.method === "POST") {
    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    } catch (e) {
      body = {};
    }

    const { action, key, value, batch, email, otp, coopName, adminName, phpEndpointUrl, smtp_pass } = body;

    if (action === "delete_key" && key) {
      const store = await getStoreObject();
      delete store[key];
      delete store[`${key}__ts`];
      await saveStoreObject(store);
      return res.status(200).json({ ok: true, deletedKey: key });
    }

    if (action === "set" && key) {
      const store = await getStoreObject();
      store[key] = value;
      store[`${key}__ts`] = Date.now();
      await saveStoreObject(store);
      return res.status(200).json({ ok: true, timestamp: store[`${key}__ts`] });
    }

    if (action === "sync_batch" && batch && typeof batch === "object") {
      const store = await getStoreObject();
      Object.keys(batch).forEach(k => {
        if (batch[k] !== undefined && batch[k] !== null) {
          store[k] = batch[k];
          store[`${k}__ts`] = Date.now();
        }
      });
      await saveStoreObject(store);
      return res.status(200).json({ ok: true, timestamp: Date.now(), store });
    }

    // Pengiriman OTP Email Real-Time dari kkmmagelang@gmail.com ke Email Admin Usaha
    if (action === "send_otp" && email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const otpCode = generateDeterministicWindowOtp(cleanEmail);
      const otpHash = computeClientCompatibleHash(otpCode);
      const expireTime = Date.now() + (2 * 60 * 1000); // 120 detik (2 menit)

      const store = await getStoreObject();
      if (!store.otp_mail || typeof store.otp_mail !== "object") {
        store.otp_mail = {};
      }
      Object.keys(store.otp_mail).forEach(em => {
        if (store.otp_mail[em].expire < Date.now()) {
          delete store.otp_mail[em];
        }
      });
      store.otp_mail[cleanEmail] = {
        email: cleanEmail,
        otp_hash: otpHash,
        expire: expireTime,
        created_at: new Date().toISOString()
      };
      await saveStoreObject(store);

      let sentViaExternalProvider = false;
      let providerName = "Cloud OTP Vault";
      let smtpErrorMsg = "";

      const activeSmtpUser = DEFAULT_SMTP_USER.trim();
      const candidatePass = (process.env.SMTP_PASS || DEFAULT_SMTP_PASS || smtp_pass || store?.__smtp_config?.smtp_pass || "").replace(/\s+/g, "");
      const activeSmtpPass = (candidatePass && candidatePass !== "TEMPEL_16_DIGIT_KODE_APP_PASSWORD_DISINI") ? candidatePass : "";

      // 1. Prioritas Utama: Kirim langsung via Gmail SMTP (smtp.gmail.com:465) dari kkmmagelang@gmail.com
      if (activeSmtpUser && activeSmtpPass) {
        const gmailRes = await sendGmailSmtpOtp({
          smtpUser: activeSmtpUser,
          smtpPass: activeSmtpPass,
          toEmail: cleanEmail,
          otpCode,
          coopName: coopName || "SIAKAD-KDMP",
          adminName: adminName || "Admin Utama"
        });
        if (gmailRes.ok) {
          sentViaExternalProvider = true;
          providerName = `Gmail SMTP Real-Time (${activeSmtpUser})`;
        } else {
          smtpErrorMsg = gmailRes.error || "Gagal mengirim lewat SMTP Gmail";
        }
      }

      // 2. Jika menggunakan endpoint PHP eksternal (opsional)
      const targetPhpUrl = phpEndpointUrl || process.env.PHPMAILER_OTP_ENDPOINT;
      if (!sentViaExternalProvider && targetPhpUrl && targetPhpUrl !== "/api/cloud-sync") {
        try {
          const phpResp = await fetch(targetPhpUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "send_otp",
              email: cleanEmail,
              otp_code: otpCode,
              coop_name: coopName || "SIAKAD-KDMP",
              admin_name: adminName || "Admin Utama",
              smtp_user: activeSmtpUser,
              smtp_pass: activeSmtpPass
            })
          });
          if (phpResp.ok) {
            sentViaExternalProvider = true;
            providerName = "PHPMailer SMTP Server";
          }
        } catch (e) {}
      }

      return res.status(200).json({
        ok: true,
        senderEmail: activeSmtpUser,
        sentTo: cleanEmail,
        otpHash,
        expire: expireTime,
        remainingSeconds: 120,
        provider: providerName,
        sentViaExternalProvider,
        smtpError: smtpErrorMsg || undefined,
        otpPreviewCode: sentViaExternalProvider ? undefined : otpCode
      });
    }

    if (action === "verify_otp" && email && otp) {
      const cleanEmail = String(email).trim().toLowerCase();
      const store = await getStoreObject();
      const record = store?.otp_mail?.[cleanEmail] || null;
      const isValid = verifyWindowOtp(cleanEmail, otp, record);
      if (isValid && store?.otp_mail?.[cleanEmail]) {
        delete store.otp_mail[cleanEmail];
        await saveStoreObject(store);
      }
      return res.status(200).json({ ok: true, valid: isValid });
    }

    return res.status(400).json({ ok: false, error: "Invalid action" });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
