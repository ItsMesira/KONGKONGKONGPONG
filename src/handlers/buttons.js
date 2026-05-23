// handlers/buttons.js — All button interaction handlers
const { MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { ADMIN_ROLE_ID, SHEETS } = require('../config');
const { getSession } = require('../utils/auth');
const { readSheet } = require('../utils/sheets');
const {
  registerModal,
  loginModal,
  addSubjectModal,
  deleteHomeworkModal,
  removeUserModal,
  homeworkModal,
} = require('../modals');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

function isAdmin(member) {
  return member.roles.cache.has(ADMIN_ROLE_ID);
}

async function handleButton(interaction) {
  const { customId, member, user } = interaction;

  // ─── Registration ─────────────────────────────────────────────────────────
  if (customId === 'btn_register') {
    return interaction.showModal(registerModal());
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  if (customId === 'btn_login') {
    return interaction.showModal(loginModal());
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  if (customId === 'btn_logout') {
    const { destroySession } = require('../utils/auth');
    destroySession(user.id);
    return interaction.reply({ content: '🚪 ออกจากระบบเรียบร้อยแล้ว', flags: MessageFlags.Ephemeral });
  }

  // ─── Add Homework → show subject dropdown ────────────────────────────────
  if (customId === 'btn_add_homework') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ กรุณาเข้าสู่ระบบก่อนใช้งาน', flags: MessageFlags.Ephemeral });
    }

    const subjects = await readSheet(SHEETS.SUBJECTS);
    if (subjects.length === 0) {
      return interaction.reply({ content: '❌ ยังไม่มีวิชาในระบบ กรุณาให้ Admin เพิ่มวิชาก่อน', flags: MessageFlags.Ephemeral });
    }

    const options = subjects.slice(0, 25).map((s) => ({
      label: `${s.subjectCode} — ${s.subjectName}`,
      description: `${s.credits} หน่วยกิต | อ.${s.instructor}`,
      value: s.subjectCode,
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_subject_for_hw')
        .setPlaceholder('📚 เลือกวิชา...')
        .addOptions(options)
    );

    return interaction.reply({ content: '📚 กรุณาเลือกวิชา:', components: [row], flags: MessageFlags.Ephemeral });
  }

  // ─── Open homework modal (fired from confirm button after subject select) ─
  if (customId.startsWith('btn_open_hw_modal_')) {
    const subjectCode = customId.replace('btn_open_hw_modal_', '');
    return interaction.showModal(homeworkModal(subjectCode));
  }

  // ─── View Homework ────────────────────────────────────────────────────────
  if (customId === 'btn_view_homework') {
    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const now = Date.now();
    const pending = homeworkList.filter((hw) => {
      if (!hw.dueDate) return true;
      return new Date(hw.dueDate.replace(' ', 'T')).getTime() >= now;
    });

    if (pending.length === 0) {
      return interaction.reply({ content: '✅ ไม่มีการบ้านที่ค้างอยู่ในขณะนี้', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('📋 รายการการบ้านทั้งหมด')
      .setFooter({ text: 'Emble Bot • แสดงสูงสุด 10 รายการ' })
      .setTimestamp();

    for (const hw of pending.slice(0, 10)) {
      const parts = [`📅 กำหนดส่ง: **${hw.dueDate}**`];
      if (hw.details) parts.push(`📋 ${hw.details}`);
      if (hw.link) parts.push(`🔗 ${hw.link}`);
      if (hw.imageUrl) parts.push(`🖼️ ${hw.imageUrl}`);
      embed.addFields({
        name: `[${hw.homeworkId}] ${hw.title} — ${hw.subjectCode}`,
        value: parts.join('\n'),
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // ─── Check / Mark Completion ──────────────────────────────────────────────
  if (customId === 'btn_check_completion') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ กรุณาเข้าสู่ระบบก่อน', flags: MessageFlags.Ephemeral });
    }

    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const completions = await readSheet(SHEETS.COMPLETION);
    const now = Date.now();
    const pending = homeworkList.filter((hw) => {
      if (!hw.dueDate) return true;
      return new Date(hw.dueDate.replace(' ', 'T')).getTime() >= now;
    });

    if (pending.length === 0) {
      return interaction.reply({ content: '✅ ไม่มีการบ้านที่ค้างอยู่', flags: MessageFlags.Ephemeral });
    }

    const options = pending.slice(0, 25).map((hw) => {
      const done = completions.find(
        (c) => c.homeworkId === hw.homeworkId && c.studentId === session.studentId
      );
      return {
        label: `${done ? '✅' : '⏳'} ${hw.title}`,
        description: `${hw.subjectCode} | กำหนดส่ง: ${hw.dueDate}`,
        value: hw.homeworkId,
      };
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_mark_complete')
        .setPlaceholder('เลือกงานที่ส่งแล้วเพื่อทำเครื่องหมาย')
        .addOptions(options)
    );

    return interaction.reply({
      content: '✅ เลือกการบ้านที่คุณส่งแล้ว:',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ─── Admin panel (single dropdown menu) ───────────────────────────────────
  if (customId === 'btn_admin_panel') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานนี้', flags: MessageFlags.Ephemeral });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_admin_subject_action')
        .setPlaceholder('⚙️ เลือกการดำเนินการ Admin...')
        .addOptions([
          { label: '➕ เพิ่มวิชาใหม่', description: 'เพิ่มวิชาเข้าสู่ระบบ', value: 'add_subject' },
          { label: '🗑️ ลบการบ้าน', description: 'ลบการบ้านโดยใช้ Homework ID', value: 'delete_homework' },
          { label: '👥 จัดการผู้ใช้', description: 'ดูรายชื่อและลบผู้ใช้', value: 'manage_users' },
        ])
    );

    return interaction.reply({ content: '⚙️ **Admin Panel** — กรุณาเลือกการดำเนินการ:', components: [row], flags: MessageFlags.Ephemeral });
  }

  // ─── Admin: Remove User (from user list embed) ────────────────────────────
  if (customId === 'btn_remove_user') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', flags: MessageFlags.Ephemeral });
    }
    return interaction.showModal(removeUserModal());
  }
}

module.exports = { handleButton };
