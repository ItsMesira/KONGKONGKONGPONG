// utils/reminders.js — DM reminders and daily summary scheduler
const cron = require('node-cron');
const { SUMMARY_USER_ID, SHEETS } = require('../config');
const { readSheet } = require('./sheets');

let clientRef = null;

function startScheduler(client) {
  clientRef = client;

  // Check reminders every 30 minutes
  cron.schedule('*/30 * * * *', () => checkReminders());

  // FIX #3: 0 8 * * * = 08:00 UTC = 15:00 Thailand (UTC+7) — WRONG
  // Fixed to 0 1 * * * = 01:00 UTC = 08:00 Thailand time (UTC+7)
  cron.schedule('0 1 * * *', () => sendDailySummary());
}

async function checkReminders() {
  try {
    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const users        = await readSheet(SHEETS.USERS);
    const completions  = await readSheet(SHEETS.COMPLETION);
    const now = Date.now();

    for (const hw of homeworkList) {
      if (!hw.dueDate) continue;

      // FIX #4: replace space with T for reliable ISO parsing across all Node environments
      // "2025-12-31 23:59" → "2025-12-31T23:59" — works everywhere
      const due = new Date(hw.dueDate.replace(' ', 'T')).getTime();
      if (isNaN(due) || due < now) continue;

      const diff         = due - now;
      const oneDay       = 24 * 60 * 60 * 1000;
      const twelveHours  = 12 * 60 * 60 * 1000;
      const oneHour      =  1 * 60 * 60 * 1000;

      // FIX #5: tolerance reduced from 30min to 20min to prevent double-firing
      // Scheduler runs every 30min, so worst-case a reminder is 29min late.
      // 20min tolerance means the window [T-20, T+20] won't overlap between runs.
      const tolerance = 20 * 60 * 1000;

      let reminderLabel = null;
      if      (Math.abs(diff - oneDay)      < tolerance) reminderLabel = '📅 อีก 1 วัน';
      else if (Math.abs(diff - twelveHours) < tolerance) reminderLabel = '⏰ อีก 12 ชั่วโมง';
      else if (Math.abs(diff - oneHour)     < tolerance) reminderLabel = '🚨 อีก 1 ชั่วโมง';

      if (!reminderLabel) continue;

      for (const user of users) {
        const done = completions.find(
          (c) => c.homeworkId === hw.homeworkId && c.studentId === user.studentId
        );
        if (done) continue;
        try {
          const discordUser = await clientRef.users.fetch(user.discordId);
          await discordUser.send({
            embeds: [{
              color: 0xf59e0b,
              title: `⚠️ แจ้งเตือนการบ้าน — ${reminderLabel}`,
              fields: [
                { name: '📚 วิชา',      value: hw.subjectCode, inline: true },
                { name: '📝 ชื่องาน',   value: hw.title,       inline: true },
                { name: '📅 กำหนดส่ง', value: hw.dueDate,     inline: false },
                ...(hw.link ? [{ name: '🔗 ลิงก์', value: hw.link }] : []),
              ],
              footer: { text: 'Emble Bot • ระบบติดตามการบ้าน' },
              timestamp: new Date().toISOString(),
            }],
          });
        } catch (_) {
          // User may have DMs disabled — skip silently
        }
      }
    }
  } catch (err) {
    console.error('[Reminders] Error:', err);
  }
}

async function sendNewHomeworkDM(client, hw) {
  try {
    const users = await readSheet(SHEETS.USERS);
    for (const user of users) {
      try {
        const discordUser = await client.users.fetch(user.discordId);
        await discordUser.send({
          embeds: [{
            color: 0x6366f1,
            title: '📬 มีการบ้านใหม่!',
            fields: [
              { name: '📚 วิชา',           value: hw.subjectCode,    inline: true },
              { name: '📝 ชื่องาน',        value: hw.title,          inline: true },
              { name: '📋 รายละเอียด',     value: hw.details || '-', inline: false },
              { name: '📅 กำหนดส่ง',      value: hw.dueDate,        inline: true },
              { name: '🗓️ วันที่มอบหมาย', value: hw.assignDate,     inline: true },
              ...(hw.link     ? [{ name: '🔗 ลิงก์',   value: hw.link }]     : []),
              ...(hw.imageUrl ? [{ name: '🖼️ รูปภาพ', value: hw.imageUrl }] : []),
            ],
            footer: { text: 'Emble Bot • ระบบติดตามการบ้าน' },
            timestamp: new Date().toISOString(),
          }],
        });
      } catch (_) {}
    }
  } catch (err) {
    console.error('[NewHomework DM] Error:', err);
  }
}

async function sendDailySummary() {
  try {
    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const completions  = await readSheet(SHEETS.COMPLETION);
    const users        = await readSheet(SHEETS.USERS);
    const now = Date.now();

    // FIX #4 applied here too: consistent date parsing
    const pending = homeworkList.filter((hw) => {
      if (!hw.dueDate) return false;
      return new Date(hw.dueDate.replace(' ', 'T')).getTime() >= now;
    });

    const summaryUser = await clientRef.users.fetch(SUMMARY_USER_ID);

    if (pending.length === 0) {
      await summaryUser.send({
        embeds: [{
          color: 0x22c55e,
          title: '📊 รายงานประจำวัน — Emble Bot',
          description: '✅ ไม่มีการบ้านที่ค้างอยู่ในขณะนี้',
          footer: { text: 'Emble Bot • Daily Summary' },
          timestamp: new Date().toISOString(),
        }],
      });
      return;
    }

    const fields = pending.map((hw) => {
      const doneCount = completions.filter((c) => c.homeworkId === hw.homeworkId).length;
      return {
        name: `📝 ${hw.title} (${hw.subjectCode})`,
        value: `กำหนดส่ง: ${hw.dueDate}\nส่งแล้ว: ${doneCount}/${users.length} คน`,
        inline: false,
      };
    });

    await summaryUser.send({
      embeds: [{
        color: 0x6366f1,
        title: '📊 รายงานประจำวัน — Emble Bot',
        description: `มีการบ้านที่ยังไม่ถึงกำหนดทั้งหมด **${pending.length}** รายการ`,
        fields,
        footer: { text: 'Emble Bot • Daily Summary' },
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (err) {
    console.error('[Daily Summary] Error:', err);
  }
}

module.exports = { startScheduler, sendNewHomeworkDM, sendDailySummary };
