// config.js — Central configuration for Emble Bot
require('dotenv').config();

// ─── Startup env validation ────────────────────────────────────────────────
// Fail fast with a clear message rather than cryptic errors at runtime.
// Resolve Google credentials — try file path first, then inline JSON
function resolveCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_FILE) {
    const fs = require('fs');
    const path = require('path');
    const credPath = path.resolve(process.env.GOOGLE_CREDENTIALS_FILE);
    if (fs.existsSync(credPath)) {
      const raw = fs.readFileSync(credPath, 'utf-8');
      try { return JSON.parse(raw); } catch { /* fall through */ }
    }
  }
  if (process.env.GOOGLE_CREDENTIALS) {
    try { return JSON.parse(process.env.GOOGLE_CREDENTIALS); } catch { /* fall through */ }
  }
  return null;
}

const resolvedCreds = resolveCredentials();
if (!resolvedCreds) {
  console.error(
    '❌ ไม่พบ Google credentials\n' +
    '   ใส่ GOOGLE_CREDENTIALS_FILE=google-credentials.json ใน .env\n' +
    '   หรือใส่ GOOGLE_CREDENTIALS (JSON inline)'
  );
  process.exit(1);
}

module.exports = {
  // Discord
  TOKEN:            process.env.DISCORD_TOKEN,
  CLIENT_ID:        process.env.CLIENT_ID,
  CLIENT_SECRET:    process.env.CLIENT_SECRET,
  GUILD_ID:         process.env.GUILD_ID,
  PANEL_CHANNEL_ID: process.env.PANEL_CHANNEL_ID || '1508323164839477248',
  SUMMARY_USER_ID:  process.env.SUMMARY_USER_ID  || '915089884979556433',
  ADMIN_ROLE_ID:    process.env.ADMIN_ROLE_ID     || '1508338553606897724',

  // Google Sheets
  SHEET_ID:           process.env.GOOGLE_SHEET_ID,
  GOOGLE_CREDENTIALS: resolvedCreds,

  // Sheet tab names
  SHEETS: {
    USERS:      'Users',
    SUBJECTS:   'Subjects',
    HOMEWORK:   'Homework',
    COMPLETION: 'Completion',
    SETTINGS:   'Settings',
    POLLS:      'Polls',
    LOGS:       'Logs',
  },

  // Session timeout in ms (2 hours)
  SESSION_TIMEOUT: 2 * 60 * 60 * 1000,

  // Reminder deduplication TTL in ms (25 hours — slightly over 1 day to survive
  // bot restarts without re-firing the same reminder)
  REMINDER_DEDUP_TTL: 25 * 60 * 60 * 1000,

  // WebUI
  SESSION_SECRET: process.env.SESSION_SECRET || 'emble-bot-secret-change-me',
  WEBUI_PORT:     process.env.WEBUI_PORT || process.env.PORT || 3000,
  BASE_URL:       process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
};
