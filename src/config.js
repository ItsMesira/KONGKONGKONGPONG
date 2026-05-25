// config.js — Central configuration for Emble Bot
require('dotenv').config();

// ─── Startup env validation ────────────────────────────────────────────────
// Fail fast with a clear message rather than cryptic errors at runtime.
const REQUIRED_ENV = [
  'DISCORD_TOKEN',
  'CLIENT_ID',
  'GUILD_ID',
  'GOOGLE_SHEET_ID',
  'GOOGLE_CREDENTIALS',
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `❌ ตัวแปรสภาพแวดล้อมที่จำเป็นหายไป: ${missing.join(', ')}\n` +
    '   คัดลอก .env.example เป็น .env แล้วกรอกค่าให้ครบ'
  );
  process.exit(1);
}

// Validate that GOOGLE_CREDENTIALS is parseable JSON early
try {
  JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch {
  console.error('❌ GOOGLE_CREDENTIALS ไม่ใช่ JSON ที่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
  process.exit(1);
}

module.exports = {
  // Discord
  TOKEN:            process.env.DISCORD_TOKEN,
  CLIENT_ID:        process.env.CLIENT_ID,
  GUILD_ID:         process.env.GUILD_ID,
  PANEL_CHANNEL_ID: process.env.PANEL_CHANNEL_ID || '1508323164839477248',
  SUMMARY_USER_ID:  process.env.SUMMARY_USER_ID  || '915089884979556433',
  ADMIN_ROLE_ID:    process.env.ADMIN_ROLE_ID     || '1508338553606897724',

  // Google Sheets
  SHEET_ID:           process.env.GOOGLE_SHEET_ID,
  GOOGLE_CREDENTIALS: process.env.GOOGLE_CREDENTIALS,

  // Sheet tab names
  SHEETS: {
    USERS:      'Users',
    SUBJECTS:   'Subjects',
    HOMEWORK:   'Homework',
    COMPLETION: 'Completion',
  },

  // Session timeout in ms (2 hours)
  SESSION_TIMEOUT: 2 * 60 * 60 * 1000,

  // Reminder deduplication TTL in ms (25 hours — slightly over 1 day to survive
  // bot restarts without re-firing the same reminder)
  REMINDER_DEDUP_TTL: 25 * 60 * 60 * 1000,
};
