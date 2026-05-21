// handlers/buttons.js — All button interaction handlers
const {
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
} = require('../modals');

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
    destroySession(user.id);
    return interaction.reply({ content: '🚪 ออกจากระบบเรียบร้อยแล้ว', ephemeral: true });
  }

  // ─── Add Homework ─────────────────────────────────────────────────────────
  if (customId === 'btn_add_homework') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ กรุณาเข้าสู่ระบบก่อนใช้งาน', ephemeral: true });
    }

    const subjects = await readSheet(SHEETS.SUBJECTS);
    if (subjects.length === 0) {
      return interaction.reply({ content: '❌ ยังไม่มีวิชาในระบบ กรุณาให้ Admin เพิ่มวิชาก่อน', ephemeral: true });
    }

    const options = subjects.map((s) => ({
      label: `${s.subjectCode} — ${s.subjectName}`,
      description: `${s.credits} หน่วยกิต | อ.${s.instructor}`,
      value: s.subjectCode,
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_subject_for_hw')
        .setPlaceholder('เลือกวิชาที่ต้องการเพิ่มการบ้าน')
        .addOptions(options)
    );

    return interaction.reply({ content: '📚 กรุณาเลือกวิชา:', components: [row], ephemeral: true });
  }

  // ─── View Homework ────────────────────────────────────────────────────────
  if (customId === 'btn_view_homework') {
    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const now = Date.now();
    const pending = homeworkList.filter((hw) => {
      if (!hw.dueDate) return true;
      return new Date(hw.dueDate).getTime() >= now;
    });

    if (pending.length === 0) {
      return interaction.reply({ content: '✅ ไม่มีการบ้านที่ค้างอยู่ในขณะนี้', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('📋 รายการการบ้านทั้งหมด')
      .setFooter({ text: 'Emble Bot' })
      .setTimestamp();

    for (const hw of pending.slice(0, 10)) {
      embed.addFields({
        name: `[${hw.homeworkId}] ${hw.title} (${hw.subjectCode})`,
        value: `📅 กำหนดส่ง: ${hw.dueDate}\n📋 ${hw.details || '-'}\n${hw.link ? `🔗 ${hw.link}` : ''}`,
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ─── Check Completion ─────────────────────────────────────────────────────
  if (customId === 'btn_check_completion') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ กรุณาเข้าสู่ระบบก่อน', ephemeral: true });
    }

    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    const completions = await readSheet(SHEETS.COMPLETION);
    const now = Date.now();
    const pending = homeworkList.filter((hw) => {
      if (!hw.dueDate) return true;
      return new Date(hw.dueDate).getTime() >= now;
    });

    if (pending.length === 0) {
      return interaction.reply({ content: '✅ ไม่มีการบ้านที่ค้างอยู่', ephemeral: true });
    }

    const options = pending.map((hw) => {
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
        .setPlaceholder('เลือกงานที่ส่งแล้ว')
        .addOptions(options.slice(0, 25))
    );

    return interaction.reply({
      content: '✅ เลือกการบ้านที่คุณส่งแล้ว:',
      components: [row],
      ephemeral: true,
    });
  }

  // ─── Admin: Add Subject ───────────────────────────────────────────────────
  if (customId === 'btn_admin_subject') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานนี้', ephemeral: true });
    }
    return interaction.showModal(addSubjectModal());
  }

  // ─── Admin: Delete Homework ───────────────────────────────────────────────
  if (customId === 'btn_admin_delete_hw') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานนี้', ephemeral: true });
    }

    // Show list of homework then modal
    const homeworkList = await readSheet(SHEETS.HOMEWORK);
    if (homeworkList.length === 0) {
      return interaction.reply({ content: '❌ ไม่มีการบ้านในระบบ', ephemeral: true });
    }

    const list = homeworkList
      .map((hw) => `\`${hw.homeworkId}\` — **${hw.title}** (${hw.subjectCode}) | กำหนดส่ง: ${hw.dueDate}`)
      .join('\n');

    await interaction.reply({ content: `📋 **รายการการบ้าน:**\n${list}`, ephemeral: true });

    // Follow up with modal trigger button
    return; // Admin will use the modal after seeing the list
  }

  // ─── Admin: Delete Homework (confirm modal) ───────────────────────────────
  if (customId === 'btn_confirm_delete_hw') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ephemeral: true });
    }
    return interaction.showModal(deleteHomeworkModal());
  }

  // ─── Admin: Manage Users ──────────────────────────────────────────────────
  if (customId === 'btn_admin_users') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานนี้', ephemeral: true });
    }

    const users = await readSheet(SHEETS.USERS);
    if (users.length === 0) {
      return interaction.reply({ content: '❌ ไม่มีผู้ใช้ในระบบ', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('👥 รายชื่อผู้ใช้ทั้งหมด')
      .setDescription(
        users.map((u) => `• **${u.firstName} ${u.lastName}** | รหัส: \`${u.studentId}\` | Discord: <@${u.discordId}>`).join('\n')
      )
      .setFooter({ text: 'Emble Bot Admin' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_remove_user')
        .setLabel('🗑️ ลบผู้ใช้')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // ─── Admin: Remove User ───────────────────────────────────────────────────
  if (customId === 'btn_remove_user') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ephemeral: true });
    }
    return interaction.showModal(removeUserModal());
  }
}

module.exports = { handleButton };
