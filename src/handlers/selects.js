// handlers/selects.js — Select menu interaction handlers
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SHEETS } = require('../config');
const { getSession } = require('../utils/auth');
const { readSheet, appendRow } = require('../utils/sheets');
const { homeworkModal } = require('../modals');

async function handleSelect(interaction) {
  const { customId, values, user } = interaction;

  // ─── Subject selected → show subject info embed + confirm button ──────────
  // Discord does NOT allow reply() + showModal() in the same interaction.
  // Fix: reply with subject info + a "Confirm & Fill Homework" button.
  // The button interaction then shows the modal.
  if (customId === 'select_subject_for_hw') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', ephemeral: true });
    }

    const subjectCode = values[0];
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const subject = subjects.find((s) => s.subjectCode === subjectCode);

    if (!subject) {
      return interaction.reply({ content: '❌ ไม่พบวิชาที่เลือก', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle(`📚 ข้อมูลวิชา — ${subject.subjectCode}`)
      .addFields(
        { name: 'ชื่อวิชา', value: subject.subjectName, inline: true },
        { name: 'รหัสวิชา', value: subject.subjectCode, inline: true },
        { name: 'หน่วยกิต', value: subject.credits, inline: true },
        { name: 'อาจารย์ผู้สอน', value: subject.instructor, inline: false }
      )
      .setFooter({ text: 'ตรวจสอบข้อมูลให้ถูกต้องก่อนกด' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_open_hw_modal_${subjectCode}`)
        .setLabel('✏️ กรอกข้อมูลการบ้าน')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // ─── Mark homework as complete ────────────────────────────────────────────
  if (customId === 'select_mark_complete') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', ephemeral: true });
    }

    const homeworkId = values[0];
    const completions = await readSheet(SHEETS.COMPLETION);
    const alreadyDone = completions.find(
      (c) => c.homeworkId === homeworkId && c.studentId === session.studentId
    );

    if (alreadyDone) {
      return interaction.reply({ content: '✅ คุณได้ทำเครื่องหมายงานนี้ว่าเสร็จแล้ว', ephemeral: true });
    }

    const now = new Date().toISOString();
    await appendRow(SHEETS.COMPLETION, [homeworkId, session.studentId, now]);

    const hw = (await readSheet(SHEETS.HOMEWORK)).find((h) => h.homeworkId === homeworkId);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('✅ บันทึกสำเร็จ!')
          .setDescription(`ทำเครื่องหมายว่าเสร็จแล้ว: **${hw?.title || homeworkId}**`)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  // ─── Admin: subject action menu ───────────────────────────────────────────
  if (customId === 'select_admin_subject_action') {
    const { ADMIN_ROLE_ID } = require('../config');
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ephemeral: true });
    }
    const { addSubjectModal, editSubjectModal } = require('../modals');
    const action = values[0];
    if (action === 'add_subject') return interaction.showModal(addSubjectModal());
    if (action === 'delete_homework') return interaction.showModal(require('../modals').deleteHomeworkModal());
    if (action === 'manage_users') {
      const users = await readSheet(SHEETS.USERS);
      if (users.length === 0) {
        return interaction.reply({ content: '❌ ไม่มีผู้ใช้ในระบบ', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('👥 รายชื่อผู้ใช้ทั้งหมด')
        .setDescription(
          users.map((u) => `• **${u.firstName} ${u.lastName}** | รหัส: \`${u.studentId}\` | <@${u.discordId}>`).join('\n')
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_remove_user').setLabel('🗑️ ลบผู้ใช้').setStyle(ButtonStyle.Danger)
      );
      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  }
}

module.exports = { handleSelect };
