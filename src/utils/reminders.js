// utils/reminders.js — DM reminders and daily summary scheduler
//
// FIXES over original:
//   • Reminder deduplication: a Set keyed by "homeworkId:studentId:label" prevents
//     double-firing if the bot restarts near a reminder window or the cron fires twice.
//     Entries auto-expire after REMINDER_DEDUP_TTL (25h) so the same homework *can*
//     fire its 1-day, 12h, and 1h reminders — they each have a different label.
//   • SUMMARY_USER_ID null-guard: if the env var is missing or fetch fails, the daily
//     summary silently logs and returns instead of crashing the scheduler.
//   • Date parsing is consistently done with .replace(' ', 'T') throughout.
//   • Tolerance reduced to 14 min (half of 30-min interval minus 1 min buffer) so
//     consecutive runs don't overlap and double-fire, but a 1-min late cron still fires.

const cron = require('node-cron');
const { SUMMARY_USER_ID, SHEETS, REMINDER_DEDUP_TTL } = require('../config');
const { readSheet } = require('./sheets');

let clientRef = null;

// Deduplication store: key -> expiresAt (ms)
const sentReminders = new Map();

function markSent(key) {
  sentReminders.set(key, Date.now() + REMINDER_DEDUP_TTL);
}

function alreadySent(key) {
  const exp = sentReminders.get(key);
  if (!exp) return false;
  if (Date.now() > exp) {
    sentReminders.delete(key);
    return false;
  }
  return true;
}

// Periodically prune expired dedup entries (every hour)
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of sentReminders) {
    if (now > exp) sentReminders.delete(k);
  }
}, 60 * 60 * 1000);

// ─── Scheduler ────────────────────────────────────────────────────────────────

function startScheduler(client) {
  clientRef = client;

  // Check reminders every 30 minutes
  cron.schedule('*/30 * * * *', () => checkReminders().catch((e) => log('Reminder check error:', e)));

  // Daily summary at 08:00 Thailand time (UTC+7 = 01:00 UTC)
  cron.schedule('0 1 * * *', () => sendDailySummary().catch((e) => log('Daily summary error:', e)));

  log('Scheduler started ✅');
}

// ─── Per-homework reminder check ──────────────────────────────────────────────

async function checkReminders() {
  const [homeworkList, users, completions] = await Promise.all([
    readSheet(SHEETS.HOMEWORK),
    readSheet(SHEETS.USERS),
    readSheet(SHEETS.COMPLETION),
  ]);

  const now = Date.now();

  for (const hw of homeworkList) {
    if (!hw.dueDate) continue;

    const due = new Date(hw.dueDate.replace(' ', 'T')).getTime();
    if (isNaN(due) || due < now) continue;

    const diff = due - now;

    // Tolerance = 14 min. With a 30-min cron, two consecutive runs are 30 min apart.
    // Window [T-14, T+14] (28 min wide) fits inside the 30-min gap without overlap.
    const tolerance = 14 * 60 * 1000;
    const thresholds = [
      { ms: 24 * 60 * 60 * 1000, label: '📅 อีก 1 วัน' },
      { ms: 12 * 60 * 60 * 1000, label: '⏰ อีก 12 ชั่วโมง' },
      { ms:  1 * 60 * 60 * 1000, label: '🚨 อีก 1 ชั่วโมง' },
    ];

    let reminderLabel = null;
    for (const { ms, label } of thresholds) {
      if (Math.abs(diff - ms) < tolerance) { reminderLabel = label; break; }
    }
    if (!reminderLabel) continue;

    for (const user of users) {
      const dedupKey = `${hw.homeworkId}:${user.studentId}:${reminderLabel}`;
      if (alreadySent(dedupKey)) continue;

      const done = completions.find(
        (c) => c.homeworkId === hw.homeworkId && c.studentId === user.studentId
      );
      if (done) { markSent(dedupKey); continue; } // already submitted — skip and dedup

      try {
        const discordUser = await clientRef.users.fetch(user.discordId);
        await discordUser.send({
          embeds: [{
            color: 0xf59e0b,
            title: `⚠️ แจ้งเตือนการบ้าน — ${reminderLabel}`,
            fields: [
              { name: '📚 วิชา',      value: hw.subjectCode || '-', inline: true },
              { name: '📝 ชื่องาน',   value: hw.title       || '-', inline: true },
              { name: '📅 กำหนดส่ง', value: hw.dueDate,             inline: false },
              ...(hw.link ? [{ name: '🔗 ลิงก์', value: hw.link }] : []),
            ],
            footer:    { text: 'Emble Bot • ระบบติดตามการบ้าน' },
            timestamp: new Date().toISOString(),
          }],
        });
        markSent(dedupKey);
      } catch {
        // User may have DMs disabled — silently skip but do NOT mark as sent
        // so a future retry can still attempt delivery
      }
    }
  }
}

// ─── New homework DM ──────────────────────────────────────────────────────────

async function sendNewHomeworkDM(client, hw) {
  try {
    const users = await readSheet(SHEETS.USERS);
    const sends = users.map(async (user) => {
      try {
        const discordUser = await client.users.fetch(user.discordId);
        await discordUser.send({
          embeds: [{
            color: 0x6366f1,
            title: '📬 มีการบ้านใหม่!',
            fields: [
              { name: '📚 วิชา',           value: hw.subjectCode     || '-', inline: true },
              { name: '📝 ชื่องาน',        value: hw.title           || '-', inline: true },
              { name: '📋 รายละเอียด',     value: hw.details         || '-', inline: false },
              { name: '📅 กำหนดส่ง',      value: hw.dueDate,                inline: true },
              { name: '🗓️ วันที่มอบหมาย', value: hw.assignDate      || '-', inline: true },
              ...(hw.link     ? [{ name: '🔗 ลิงก์',   value: hw.link }]     : []),
              ...(hw.imageUrl ? [{ name: '🖼️ รูปภาพ', value: hw.imageUrl }] : []),
            ],
            footer:    { text: 'Emble Bot • ระบบติดตามการบ้าน' },
            timestamp: new Date().toISOString(),
          }],
        });
      } catch { /* DMs disabled — skip */ }
    });
    await Promise.allSettled(sends);
  } catch (err) {
    log('[NewHomework DM] Error:', err);
  }
}

// ─── Daily summary ────────────────────────────────────────────────────────────

async function sendDailySummary() {
  // Guard: if SUMMARY_USER_ID is not configured, skip gracefully
  if (!SUMMARY_USER_ID) {
    log('[Daily Summary] SUMMARY_USER_ID not set — skipping');
    return;
  }

  try {
    const [homeworkList, completions, users] = await Promise.all([
      readSheet(SHEETS.HOMEWORK),
      readSheet(SHEETS.COMPLETION),
      readSheet(SHEETS.USERS),
    ]);

    const now     = Date.now();
    const pending = homeworkList.filter((hw) => {
      if (!hw.dueDate) return false;
      return new Date(hw.dueDate.replace(' ', 'T')).getTime() >= now;
    });

    let summaryUser;
    try {
      summaryUser = await clientRef.users.fetch(SUMMARY_USER_ID);
    } catch (err) {
      log('[Daily Summary] Cannot fetch SUMMARY_USER_ID:', err.message);
      return;
    }

    if (pending.length === 0) {
      await summaryUser.send({
        embeds: [{
          color:       0x22c55e,
          title:       '📊 รายงานประจำวัน — Emble Bot',
          description: '✅ ไม่มีการบ้านที่ค้างอยู่ในขณะนี้',
          footer:      { text: 'Emble Bot • Daily Summary' },
          timestamp:   new Date().toISOString(),
        }],
      });
      return;
    }

    // Discord embed has a 25-field limit — chunk if needed
    const fields = pending.map((hw) => {
      const doneCount = completions.filter((c) => c.homeworkId === hw.homeworkId).length;
      return {
        name:   `📝 ${hw.title} (${hw.subjectCode})`,
        value:  `กำหนดส่ง: ${hw.dueDate}\nส่งแล้ว: ${doneCount}/${users.length} คน`,
        inline: false,
      };
    });

    // Send in batches of 25 fields to stay within Discord limits
    const CHUNK = 25;
    for (let i = 0; i < fields.length; i += CHUNK) {
      const chunk = fields.slice(i, i + CHUNK);
      const part  = Math.floor(i / CHUNK) + 1;
      const total = Math.ceil(fields.length / CHUNK);
      await summaryUser.send({
        embeds: [{
          color:       0x6366f1,
          title:       `📊 รายงานประจำวัน — Emble Bot${total > 1 ? ` (${part}/${total})` : ''}`,
          description: `มีการบ้านที่ยังไม่ถึงกำหนดทั้งหมด **${pending.length}** รายการ`,
          fields:      chunk,
          footer:      { text: 'Emble Bot • Daily Summary' },
          timestamp:   new Date().toISOString(),
        }],
      });
    }
  } catch (err) {
    log('[Daily Summary] Error:', err);
  }
}

// ─── Logger helper ────────────────────────────────────────────────────────────

function log(...args) {
  console.log(`[${new Date().toISOString()}] [Reminders]`, ...args);
}

module.exports = { startScheduler, sendNewHomeworkDM, sendDailySummary };
