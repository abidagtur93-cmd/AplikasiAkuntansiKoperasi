// Vercel Serverless Function: /api/cloud-sync.js
// SIAKAD-KDMP v4.5 - Cloud Multi-Device Real-Time Sync & GitHub OTP-Email (PHPMailer / SMTP / Cloud Vault)
// Menangani:
// 1. Sinkronisasi Otomatis Akun & Ruang Kerja Lintas Perangkat (Cloud-Based: Vercel KV / Upstash Redis / GitHub Repo Vault / Memory+Tmp)
// 2. Login Lintas Perangkat (Admin Usaha & Karyawan Koperasi berdasarkan Nama Koperasi, Username/Nama Karyawan & Password)
// 3. Pengiriman & Verifikasi Kode OTP Email Terenkripsi (Terhubung dengan arsitektur github.com/bisangoding-id/OTP-Email & PHPMailer)

import crypto from "crypto";
import fs from "fs";
import path from "path";

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

  // 1. Cek pada tabel otp_mail di Cloud Store (sesuai skema bisangoding-id/OTP-Email: email, otp_hash, expire)
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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

    const { action, key, value, batch, email, otp, coopName, adminName, phpEndpointUrl } = body;

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

    // Pengiriman OTP Email sesuai skema GitHub bisangoding-id/OTP-Email & PHPMailer
    if (action === "send_otp" && email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const otpCode = generateDeterministicWindowOtp(cleanEmail);
      const otpHash = computeClientCompatibleHash(otpCode);
      const expireTime = Date.now() + (5 * 60 * 1000); // 5 menit

      // Simpan ke tabel otp_mail di Cloud Store (email, otp_hash, expire)
      const store = await getStoreObject();
      if (!store.otp_mail || typeof store.otp_mail !== "object") {
        store.otp_mail = {};
      }
      // Hapus OTP yang sudah expire (seperti DELETE FROM otp_mail WHERE expire < NOW() di bisangoding-id/OTP-Email)
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
      let providerName = "Cloud OTP Vault (bisangoding-id/OTP-Email Schema)";

      // 1. Jika ada endpoint PHP PHPMailer (github.com/bisangoding-id/OTP-Email) yang dikonfigurasi
      const targetPhpUrl = phpEndpointUrl || process.env.PHPMAILER_OTP_ENDPOINT;
      if (targetPhpUrl) {
        try {
          const phpResp = await fetch(targetPhpUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "send_otp",
              email: cleanEmail,
              otp_code: otpCode,
              coop_name: coopName || "SIAKAD-KDMP",
              admin_name: adminName || "Admin Utama"
            })
          });
          if (phpResp.ok) {
            sentViaExternalProvider = true;
            providerName = "PHPMailer SMTP (bisangoding-id/OTP-Email)";
          }
        } catch (e) {}
      }

      // 2. Jika RESEND_API_KEY diset di Vercel Environment
      const resendKey = process.env.RESEND_API_KEY;
      if (!sentViaExternalProvider && resendKey) {
        try {
          const rResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || "SIAKAD-KDMP <onboarding@resend.dev>",
              to: [cleanEmail],
              subject: `Kode OTP Verifikasi Anda - ${coopName || "SIAKAD-KDMP"}`,
              html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
                <h2 style="color:#991b1b;">Kode OTP Verifikasi Anda</h2>
                <p>Halo <strong>${adminName || "Admin Utama"}</strong> (${coopName || "Koperasi Desa Merah Putih"}),</p>
                <p>Berikut adalah 6 digit Kode OTP Verifikasi Anda (berlaku selama 5 menit):</p>
                <div style="font-size:28px;font-weight:bold;letter-spacing:6px;padding:12px 20px;background:#fef2f2;color:#991b1b;display:inline-block;border-radius:8px;">${otpCode}</div>
                <p style="font-size:12px;color:#64748b;margin-top:16px;">Jangan berikan kode ini kepada siapapun. (Terintegrasi dengan PHPMailer & bisangoding-id/OTP-Email)</p>
              </div>`
            })
          });
          if (rResp.ok) {
            sentViaExternalProvider = true;
            providerName = "Resend SMTP Cloud";
          }
        } catch (e) {}
      }

      return res.status(200).json({
        ok: true,
        sentTo: cleanEmail,
        otpHash,
        expire: expireTime,
        remainingSeconds: 300,
        provider: providerName,
        sentViaExternalProvider,
        // Sertakan otpPreviewCode hanya bila belum ada SMTP eksternal agar user tetap bisa login di mode demo/sandbox
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
