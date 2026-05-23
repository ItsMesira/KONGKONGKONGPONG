// handlers/modals.js — Modal submission handlers
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { SHEETS, ADMIN_ROLE_ID } = require('../config');
const { hashPassword, verifyPassword, createSession } = require('../utils/auth');
const { readSheet, appendRow, deleteRow } = require('../utils/sheets');
const { sendNewHomeworkDM } = require('../utils/reminders');

let clientRef = null;
function setClient(client) { clientRef = client; }

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Sanitise a user-supplied string to remove invisible/control characters. */
function sanitise(str) {
  return str.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

async function handleModalSubmit(interaction) {
  const { customId, user, member } = interaction;

  // ─── Registration ──────────────────────────────────────────────────────────
  if (customId === 'modal_register') {
    const firstName = sanitise(interaction.fields.getTextInputValue('firstName'));
    const lastName  = sanitise(interaction.fields.getTextInputValue('lastName'));
    const studentId = sanitise(interaction.fields.getTextInputValue('studentId'));
    const password  = interaction.fields.getTextInputValue('password'); // don't sanitise — may contain special chars

    if (!firstName || !lastName || !studentId) {
      return interaction.reply({ content: '❌ กรุณากรอกข้อมูลให้ครบถ้วน', flags: MessageFlags.Ephemeral });
    }

    const users = await readSheet(SHEETS.USERS);
    if (users.find((u) => u.studentId === studentId)) {
      return interaction.reply({ content: '❌ รหัสนักศึกษานี้ถูกลงทะเบียนแล้ว', flags: MessageFlags.Ephemeral });
    }
    if (users.find((u) => u.discordId === user.id)) {
      return interaction.reply({ content: '❌ Discord ของคุณได้ลงทะเบียนแล้ว', flags: MessageFlags.Ephemeral });
    }

    const passwordHash = hashPassword(password); // PBKDF2 + salt
    await appendRow(SHEETS.USERS, [user.id, firstName, lastName, studentId, passwordHash]);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('✅ ลงทะเบียนสำเร็จ!')
          .setDescription(`ยินดีต้อนรับ **${firstName} ${lastName}**!\nรหัสนักศึกษา: \`${studentId}\`\nกรุณาเข้าสู่ระบบเพื่อใช้งาน`)
          .setTimestamp(),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ─── Login ─────────────────────────────────────────────────────────────────
  if (customId === 'modal_login') {
    const studentId = sanitise(interaction.fields.getTextInputValue('studentId'));
    const password  = interaction.fields.getTextInputValue('password');

    const users = await readSheet(SHEETS.USERS);
    const found = users.find((u) => u.studentId === studentId);
    if (!found) {
      return interaction.reply({ content: '❌ ไม่พบรหัสนักศึกษานี้ในระบบ', flags: MessageFlags.Ephemeral });
    }
    if (found.discordId !== user.id) {
      return interaction.reply({ content: '❌ รหัสนักศึกษานี้ไม่ตรงกับบัญชี Discord ของคุณ', flags: MessageFlags.Ephemeral });
    }
    // FIX: use verifyPassword() which handles both PBKDF2 and legacy SHA-256
    if (!verifyPassword(password, found.passwordHash)) {
      return interaction.reply({ content: '❌ รหัสผ่านไม่ถูกต้อง', flags: MessageFlags.Ephemeral });
    }

    createSession(user.id, studentId);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('🔑 เข้าสู่ระบบสำเร็จ!')
          .setDescription(`ยินดีต้อนรับ **${found.firstName} ${found.lastName}**\nเซสชันจะหมดอายุใน 2 ชั่วโมง`)
          .setTimestamp(),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ─── Add Homework ──────────────────────────────────────────────────────────
  if (customId.startsWith('modal_add_homework_')) {
    const subjectCode = customId.replace('modal_add_homework_', '');
    const title     = sanitise(interaction.fields.getTextInputValue('title'));
    const details   = sanitise(interaction.fields.getTextInputValue('details'));
    const imageUrl  = sanitise(interaction.fields.getTextInputValue('imageUrl'));
    const link      = sanitise(interaction.fields.getTextInputValue('link'));
    const dueDate   = sanitise(interaction.fields.getTextInputValue('dueDate'));

    if (!title) {
      return interaction.reply({ content: '❌ กรุณากรอกชื่องาน', flags: MessageFlags.Ephemeral });
    }

    // Validate date format
    const parsedDate = new Date(dueDate.replace(' ', 'T'));
    if (isNaN(parsedDate.getTime())) {
      return interaction.reply({ content: '❌ รูปแบบวันที่ไม่ถูกต้อง ใช้รูปแบบ YYYY-MM-DD HH:MM', flags: MessageFlags.Ephemeral });
    }

    // Warn if due date is in the past
    if (parsedDate.getTime() < Date.now()) {
      return interaction.reply({ content: '❌ วันที่กำหนดส่งต้องอยู่ในอนาคต', flags: MessageFlags.Ephemeral });
    }

    const homeworkId = generateId('HW');
    const assignDate = new Date().toLocaleDateString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });

    const users       = await readSheet(SHEETS.USERS);
    const addedByUser = users.find((u) => u.discordId === user.id);
    const addedBy     = addedByUser ? `${addedByUser.firstName} ${addedByUser.lastName}` : user.username;

    await appendRow(SHEETS.HOMEWORK, [
      homeworkId, subjectCode, title, details, imageUrl, link, dueDate, assignDate, addedBy,
    ]);

    const hw = { homeworkId, subjectCode, title, details, imageUrl, link, dueDate, assignDate };
    // Fire-and-forget — don't block the reply waiting for potentially hundreds of DMs
    if (clientRef) sendNewHomeworkDM(clientRef, hw).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('✅ เพิ่มการบ้านสำเร็จ!')
      .addFields(
        { name: 'รหัสงาน',  value: `\`${homeworkId}\``, inline: true },
        { name: 'วิชา',     value: subjectCode,          inline: true },
        { name: 'ชื่องาน',  value: title,                inline: false },
        { name: 'กำหนดส่ง', value: dueDate,              inline: true },
        { name: 'เพิ่มโดย', value: addedBy,              inline: true },
        ...(details  ? [{ name: 'รายละเอียด', value: details.slice(0, 1024) }] : []),
        ...(link     ? [{ name: 'ลิงก์',      value: link }]     : []),
        ...(imageUrl ? [{ name: 'รูปภาพ',     value: imageUrl }] : []),
      )
      .setTimestamp();

    if (imageUrl) embed.setImage(imageUrl);

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // ─── Admin: Add Subject ────────────────────────────────────────────────────
  if (customId === 'modal_add_subject') {
    if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', flags: MessageFlags.Ephemeral });
    }

    const subjectCode = sanitise(interaction.fields.getTextInputValue('subjectCode')).toUpperCase();
    const subjectName = sanitise(interaction.fields.getTextInputValue('subjectName'));
    const credits     = sanitise(interaction.fields.getTextInputValue('credits'));
    const instructor  = sanitise(interaction.fields.getTextInputValue('instructor'));

    if (!subjectCode || !subjectName || !credits || !instructor) {
      return interaction.reply({ content: '❌ กรุณากรอกข้อมูลให้ครบถ้วน', flags: MessageFlags.Ephemeral });
    }

    if (isNaN(Number(credits)) || Number(credits) <= 0) {
      return interaction.reply({ content: '❌ หน่วยกิตต้องเป็นตัวเลขมากกว่า 0', flags: MessageFlags.Ephemeral });
    }

    const subjects = await readSheet(SHEETS.SUBJECTS);
    if (subjects.find((s) => s.subjectCode === subjectCode)) {
      return interaction.reply({ content: '❌ รหัสวิชานี้มีอยู่แล้วในระบบ', flags: MessageFlags.Ephemeral });
    }

    await appendRow(SHEETS.SUBJECTS, [subjectCode, subjectName, credits, instructor]);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('✅ เพิ่มวิชาสำเร็จ!')
          .addFields(
            { name: 'รหัสวิชา', value: subjectCode, inline: true },
            { name: 'ชื่อวิชา', value: subjectName, inline: true },
            { name: 'หน่วยกิต', value: credits,     inline: true },
            { name: 'อาจารย์',  value: instructor,  inline: false },
          )
          .setTimestamp(),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ─── Admin: Delete Homework ────────────────────────────────────────────────
  if (customId === 'modal_delete_homework') {
    if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', flags: MessageFlags.Ephemeral });
    }

    const homeworkId   = sanitise(interaction.fields.getTextInputValue('homeworkId'));
    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const rowIndex     = homeworkList.findIndex((h) => h.homeworkId === homeworkId);

    if (rowIndex === -1) {
      return interaction.reply({ content: `❌ ไม่พบการบ้าน ID: \`${homeworkId}\``, flags: MessageFlags.Ephemeral });
    }

    // +2: +1 for header row, +1 for 0→1 index conversion
    await deleteRow(SHEETS.HOMEWORK, rowIndex + 2);

    return interaction.reply({ content: `✅ ลบการบ้าน \`${homeworkId}\` เรียบร้อยแล้ว`, flags: MessageFlags.Ephemeral });
  }

  // ─── Admin: Remove User ────────────────────────────────────────────────────
  if (customId === 'modal_remove_user') {
    if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', flags: MessageFlags.Ephemeral });
    }

    const studentId = sanitise(interaction.fields.getTextInputValue('studentId'));
    const users     = await readSheet(SHEETS.USERS);
    const rowIndex  = users.findIndex((u) => u.studentId === studentId);

    if (rowIndex === -1) {
      return interaction.reply({ content: `❌ ไม่พบผู้ใช้รหัส: \`${studentId}\``, flags: MessageFlags.Ephemeral });
    }

    await deleteRow(SHEETS.USERS, rowIndex + 2);
    return interaction.reply({ content: `✅ ลบผู้ใช้รหัส \`${studentId}\` เรียบร้อยแล้ว`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { handleModalSubmit, setClient };
