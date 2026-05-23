// handlers/buttons.js — All button interaction handlers
const {
  MessageFlags,
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

  // ─── Registration ────────────────────────────────────────────────────────
  if (customId === 'btn_register') {
    return interaction.showModal(registerModal());
  }

  // ─── Login ───────────────────────────────────────────────────────────────
  if (customId === 'btn_login') {
    return interaction.showModal(loginModal());
  }

  // ─── Logout ──────────────────────────────────────────────────────────────
  if (customId === 'btn_logout') {
    const { destroySession } = require('../utils/auth');
    const session = getSession(user.id);
    destroySession(user.id);
    if (!session) {
      return interaction.reply({ content: 'ℹ️ คุณไม่ได้เข้าสู่ระบบอยู่', ...EPHEMERAL });
    }
    return interaction.reply({ content: '🚪 ออกจากระบบเรียบร้อยแล้ว', ...EPHEMERAL });
  }

  // ─── Add Homework → show subject dropdown ────────────────────────────────
  if (customId === 'btn_add_homework') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ กรุณาเข้าสู่ระบบก่อนใช้งาน', ...EPHEMERAL });
    }

    const subjects = await readSheet(SHEETS.SUBJECTS);
    if (subjects.length === 0) {
      return interaction.reply({ content: '❌ ยังไม่มีวิชาในระบบ กรุณาให้ Admin เพิ่มวิชาก่อน', ...EPHEMERAL });
    }

    const options = subjects.slice(0, 25).map((s) => ({
      label:       `${s.subjectCode} — ${s.subjectName}`.slice(0, 100),
      description: `${s.credits} หน่วยกิต | อ.${s.instructor}`.slice(0, 100),
      value:       s.subjectCode,
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_subject_for_hw')
        .setPlaceholder('📚 เลือกวิชา...')
        .addOptions(options)
    );

    return interaction.reply({ content: '📚 กรุณาเลือกวิชา:', components: [row], ...EPHEMERAL });
  }

  // ─── Open homework modal (fired from confirm button after subject select) ─
  if (customId.startsWith('btn_open_hw_modal_')) {
    const subjectCode = customId.replace('btn_open_hw_modal_', '');
    return interaction.showModal(homeworkModal(subjectCode));
  }

  // ─── View Homework ────────────────────────────────────────────────────────
  if (customId === 'btn_view_homework') {
    // No session required — viewing is public so any classmate can check due dates
    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const now          = Date.now();
    const pending      = homeworkList.filter((hw) => {
      if (!hw.dueDate) return true;
      return new Date(hw.dueDate.replace(' ', 'T')).getTime() >= now;
    });

    if (pending.length === 0) {
      return interaction.reply({ content: '✅ ไม่มีการบ้านที่ค้างอยู่ในขณะนี้', ...EPHEMERAL });
    }

    // Sort by due date ascending so nearest deadlines appear first
    pending.sort((a, b) => {
      const da = new Date(a.dueDate.replace(' ', 'T')).getTime();
      const db = new Date(b.dueDate.replace(' ', 'T')).getTime();
      return da - db;
    });

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('📋 รายการการบ้านทั้งหมด')
      .setFooter({ text: `Emble Bot • แสดง ${Math.min(pending.length, 10)} จาก ${pending.length} รายการ` })
      .setTimestamp();

    for (const hw of pending.slice(0, 10)) {
      const parts = [`📅 กำหนดส่ง: **${hw.dueDate}**`];
      if (hw.details)  parts.push(`📋 ${hw.details}`);
      if (hw.link)     parts.push(`🔗 ${hw.link}`);
      if (hw.imageUrl) parts.push(`🖼️ ${hw.imageUrl}`);
      embed.addFields({
        name:   `[${hw.homeworkId}] ${hw.title} — ${hw.subjectCode}`,
        value:  parts.join('\n').slice(0, 1024), // Discord field value limit
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed], ...EPHEMERAL });
  }

  // ─── Check / Mark Completion ──────────────────────────────────────────────
  if (customId === 'btn_check_completion') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ กรุณาเข้าสู่ระบบก่อน', ...EPHEMERAL });
    }

    const [homeworkList, completions] = await Promise.all([
      readSheet(SHEETS.HOMEWORK),
      readSheet(SHEETS.COMPLETION),
    ]);
    const now     = Date.now();
    const pending = homeworkList.filter((hw) => {
      if (!hw.dueDate) return true;
      return new Date(hw.dueDate.replace(' ', 'T')).getTime() >= now;
    });

    if (pending.length === 0) {
      return interaction.reply({ content: '✅ ไม่มีการบ้านที่ค้างอยู่', ...EPHEMERAL });
    }

    const options = pending.slice(0, 25).map((hw) => {
      const done = completions.find(
        (c) => c.homeworkId === hw.homeworkId && c.studentId === session.studentId
      );
      return {
        label:       `${done ? '✅' : '⏳'} ${hw.title}`.slice(0, 100),
        description: `${hw.subjectCode} | กำหนดส่ง: ${hw.dueDate}`.slice(0, 100),
        value:       hw.homeworkId,
      };
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_mark_complete')
        .setPlaceholder('เลือกงานที่ส่งแล้วเพื่อทำเครื่องหมาย')
        .addOptions(options)
    );

    return interaction.reply({
      content:    '✅ เลือกการบ้านที่คุณส่งแล้ว:',
      components: [row],
      ...EPHEMERAL,
    });
  }

  // ─── My Stats ─────────────────────────────────────────────────────────────
  // NEW: shows personal completion rate and upcoming deadlines
  if (customId === 'btn_my_stats') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ กรุณาเข้าสู่ระบบก่อน', ...EPHEMERAL });
    }

    const [homeworkList, completions, users] = await Promise.all([
      readSheet(SHEETS.HOMEWORK),
      readSheet(SHEETS.COMPLETION),
      readSheet(SHEETS.USERS),
    ]);

    const userRecord = users.find((u) => u.studentId === session.studentId);
    const now        = Date.now();
    const pending    = homeworkList.filter((hw) => {
      if (!hw.dueDate) return true;
      return new Date(hw.dueDate.replace(' ', 'T')).getTime() >= now;
    });

    const myCompletions = completions.filter((c) => c.studentId === session.studentId);
    const doneCount     = pending.filter((hw) =>
      myCompletions.some((c) => c.homeworkId === hw.homeworkId)
    ).length;
    const todoCount = pending.length - doneCount;
    const pct       = pending.length > 0 ? Math.round((doneCount / pending.length) * 100) : 100;

    // Build progress bar
    const filled = Math.round(pct / 10);
    const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);

    const upcoming = pending
      .filter((hw) => !myCompletions.some((c) => c.homeworkId === hw.homeworkId))
      .sort((a, b) => new Date(a.dueDate.replace(' ', 'T')) - new Date(b.dueDate.replace(' ', 'T')))
      .slice(0, 5);

    const embed = new EmbedBuilder()
      .setColor(pct === 100 ? 0x22c55e : pct >= 50 ? 0xf59e0b : 0xef4444)
      .setTitle(`📊 สถิติของ ${userRecord?.firstName ?? user.username} ${userRecord?.lastName ?? ''}`)
      .addFields(
        { name: '✅ ส่งแล้ว',    value: `${doneCount} งาน`, inline: true },
        { name: '⏳ ยังไม่ส่ง',  value: `${todoCount} งาน`, inline: true },
        { name: '📈 ความคืบหน้า', value: `${bar} ${pct}%`,   inline: false },
      );

    if (upcoming.length > 0) {
      embed.addFields({
        name:  '🔜 งานที่ใกล้ครบกำหนด',
        value: upcoming.map((hw) => `• **${hw.title}** — ${hw.dueDate}`).join('\n'),
        inline: false,
      });
    }

    embed.setFooter({ text: 'Emble Bot • สถิติส่วนตัว' }).setTimestamp();
    return interaction.reply({ embeds: [embed], ...EPHEMERAL });
  }

  // ─── Admin panel ──────────────────────────────────────────────────────────
  if (customId === 'btn_admin_panel') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานนี้', ...EPHEMERAL });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_admin_subject_action')
        .setPlaceholder('⚙️ เลือกการดำเนินการ Admin...')
        .addOptions([
          { label: '➕ เพิ่มวิชาใหม่',  description: 'เพิ่มวิชาเข้าสู่ระบบ',                value: 'add_subject' },
          { label: '🗑️ ลบการบ้าน',      description: 'ลบการบ้านโดยใช้ Homework ID',          value: 'delete_homework' },
          { label: '👥 จัดการผู้ใช้',   description: 'ดูรายชื่อและลบผู้ใช้',                 value: 'manage_users' },
          { label: '📋 ดูรายการวิชา',   description: 'แสดงวิชาทั้งหมดในระบบ',                value: 'list_subjects' },
        ])
    );

    return interaction.reply({ content: '⚙️ **Admin Panel** — กรุณาเลือกการดำเนินการ:', components: [row], ...EPHEMERAL });
  }

  // ─── Admin: Remove User (from user list embed) ────────────────────────────
  if (customId === 'btn_remove_user') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ...EPHEMERAL });
    }
    return interaction.showModal(removeUserModal());
  }
}

module.exports = { handleButton };
