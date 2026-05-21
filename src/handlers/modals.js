// handlers/modals.js — Modal submission handlers
const { EmbedBuilder } = require('discord.js');
const { SHEETS, ADMIN_ROLE_ID } = require('../config');
const { hashPassword, createSession } = require('../utils/auth');
const { readSheet, appendRow, deleteRow } = require('../utils/sheets');
const { sendNewHomeworkDM } = require('../utils/reminders');

let clientRef = null;
function setClient(client) { clientRef = client; }

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function handleModalSubmit(interaction) {
  const { customId, user, member } = interaction;

  // ─── Registration ─────────────────────────────────────────────────────────
  if (customId === 'modal_register') {
    const firstName  = interaction.fields.getTextInputValue('firstName').trim();
    const lastName   = interaction.fields.getTextInputValue('lastName').trim();
    const studentId  = interaction.fields.getTextInputValue('studentId').trim();
    const password   = interaction.fields.getTextInputValue('password');

    const users = await readSheet(SHEETS.USERS);
    if (users.find((u) => u.studentId === studentId)) {
      return interaction.reply({ content: '❌ รหัสนักศึกษานี้ถูกลงทะเบียนแล้ว', ephemeral: true });
    }
    if (users.find((u) => u.discordId === user.id)) {
      return interaction.reply({ content: '❌ Discord ของคุณได้ลงทะเบียนแล้ว', ephemeral: true });
    }

    const passwordHash = hashPassword(password);
    await appendRow(SHEETS.USERS, [user.id, firstName, lastName, studentId, passwordHash]);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('✅ ลงทะเบียนสำเร็จ!')
          .setDescription(`ยินดีต้อนรับ **${firstName} ${lastName}**!\nรหัสนักศึกษา: \`${studentId}\`\nกรุณาเข้าสู่ระบบเพื่อใช้งาน`)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  if (customId === 'modal_login') {
    const studentId = interaction.fields.getTextInputValue('studentId').trim();
    const password  = interaction.fields.getTextInputValue('password');

    const users = await readSheet(SHEETS.USERS);
    const found = users.find((u) => u.studentId === studentId);
    if (!found) {
      return interaction.reply({ content: '❌ ไม่พบรหัสนักศึกษานี้ในระบบ', ephemeral: true });
    }
    if (found.discordId !== user.id) {
      return interaction.reply({ content: '❌ รหัสนักศึกษานี้ไม่ตรงกับบัญชี Discord ของคุณ', ephemeral: true });
    }
    if (found.passwordHash !== hashPassword(password)) {
      return interaction.reply({ content: '❌ รหัสผ่านไม่ถูกต้อง', ephemeral: true });
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
      ephemeral: true,
    });
  }

  // ─── Add Homework ─────────────────────────────────────────────────────────
  if (customId.startsWith('modal_add_homework_')) {
    const subjectCode = customId.replace('modal_add_homework_', '');
    const title     = interaction.fields.getTextInputValue('title').trim();
    const details   = interaction.fields.getTextInputValue('details').trim();
    const imageUrl  = interaction.fields.getTextInputValue('imageUrl').trim();
    const link      = interaction.fields.getTextInputValue('link').trim();
    const dueDate   = interaction.fields.getTextInputValue('dueDate').trim();

    // Validate date
    const parsedDate = new Date(dueDate.replace(' ', 'T'));
    if (isNaN(parsedDate.getTime())) {
      return interaction.reply({ content: '❌ รูปแบบวันที่ไม่ถูกต้อง ใช้รูปแบบ YYYY-MM-DD HH:MM', ephemeral: true });
    }

    const homeworkId = generateId('HW');
    const assignDate = new Date().toLocaleDateString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });

    const users = await readSheet(SHEETS.USERS);
    const addedByUser = users.find((u) => u.discordId === user.id);
    const addedBy = addedByUser ? `${addedByUser.firstName} ${addedByUser.lastName}` : user.username;

    await appendRow(SHEETS.HOMEWORK, [
      homeworkId, subjectCode, title, details, imageUrl, link, dueDate, assignDate, addedBy,
    ]);

    const hw = { homeworkId, subjectCode, title, details, imageUrl, link, dueDate, assignDate };
    if (clientRef) sendNewHomeworkDM(clientRef, hw);

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('✅ เพิ่มการบ้านสำเร็จ!')
      .addFields(
        { name: 'รหัสงาน', value: `\`${homeworkId}\``, inline: true },
        { name: 'วิชา', value: subjectCode, inline: true },
        { name: 'ชื่องาน', value: title, inline: false },
        { name: 'กำหนดส่ง', value: dueDate, inline: true },
        { name: 'เพิ่มโดย', value: addedBy, inline: true },
        ...(details ? [{ name: 'รายละเอียด', value: details }] : []),
        ...(link ? [{ name: 'ลิงก์', value: link }] : []),
        ...(imageUrl ? [{ name: 'รูปภาพ', value: imageUrl }] : []),
      )
      .setTimestamp();

    if (imageUrl) embed.setImage(imageUrl);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ─── Admin: Add Subject ───────────────────────────────────────────────────
  if (customId === 'modal_add_subject') {
    if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ephemeral: true });
    }

    const subjectCode = interaction.fields.getTextInputValue('subjectCode').trim().toUpperCase();
    const subjectName = interaction.fields.getTextInputValue('subjectName').trim();
    const credits     = interaction.fields.getTextInputValue('credits').trim();
    const instructor  = interaction.fields.getTextInputValue('instructor').trim();

    const subjects = await readSheet(SHEETS.SUBJECTS);
    if (subjects.find((s) => s.subjectCode === subjectCode)) {
      return interaction.reply({ content: '❌ รหัสวิชานี้มีอยู่แล้วในระบบ', ephemeral: true });
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
            { name: 'หน่วยกิต', value: credits, inline: true },
            { name: 'อาจารย์', value: instructor, inline: false },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  // ─── Admin: Delete Homework ───────────────────────────────────────────────
  if (customId === 'modal_delete_homework') {
    if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ephemeral: true });
    }

    const homeworkId = interaction.fields.getTextInputValue('homeworkId').trim();
    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const rowIndex = homeworkList.findIndex((h) => h.homeworkId === homeworkId);

    if (rowIndex === -1) {
      return interaction.reply({ content: `❌ ไม่พบการบ้าน ID: \`${homeworkId}\``, ephemeral: true });
    }

    // +2 because: +1 for header row, +1 for 1-based index
    await deleteRow(SHEETS.HOMEWORK, rowIndex + 2);

    return interaction.reply({ content: `✅ ลบการบ้าน \`${homeworkId}\` เรียบร้อยแล้ว`, ephemeral: true });
  }

  // ─── Admin: Remove User ───────────────────────────────────────────────────
  if (customId === 'modal_remove_user') {
    if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ephemeral: true });
    }

    const studentId = interaction.fields.getTextInputValue('studentId').trim();
    const users = await readSheet(SHEETS.USERS);
    const rowIndex = users.findIndex((u) => u.studentId === studentId);

    if (rowIndex === -1) {
      return interaction.reply({ content: `❌ ไม่พบผู้ใช้รหัส: \`${studentId}\``, ephemeral: true });
    }

    await deleteRow(SHEETS.USERS, rowIndex + 2);
    return interaction.reply({ content: `✅ ลบผู้ใช้รหัส \`${studentId}\` เรียบร้อยแล้ว`, ephemeral: true });
  }
}

module.exports = { handleModalSubmit, setClient };
