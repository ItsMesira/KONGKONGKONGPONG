// handlers/selects.js — Select menu interaction handlers
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { SHEETS, ADMIN_ROLE_ID } = require('../config');
const { getSession } = require('../utils/auth');
const { readSheet, appendRow } = require('../utils/sheets');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

async function handleSelect(interaction) {
  const { customId, values, user } = interaction;

  // ─── Subject selected → reply ONLY with subject info + confirm button ─────
  // IMPORTANT: Do NOT call showModal() here — Discord only allows ONE response
  // per interaction. The confirm button (btn_open_hw_modal_) opens the modal
  // as a fresh interaction in buttons.js.
  if (customId === 'select_subject_for_hw') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', ...EPHEMERAL });
    }

    const subjectCode = values[0];
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const subject = subjects.find((s) => s.subjectCode === subjectCode);

    if (!subject) {
      return interaction.reply({ content: '❌ ไม่พบวิชาที่เลือก', ...EPHEMERAL });
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle(`📚 ข้อมูลวิชา — ${subject.subjectCode}`)
      .addFields(
        { name: 'ชื่อวิชา',      value: subject.subjectName, inline: true },
        { name: 'รหัสวิชา',      value: subject.subjectCode, inline: true },
        { name: 'หน่วยกิต',      value: subject.credits,     inline: true },
        { name: 'อาจารย์ผู้สอน', value: subject.instructor,  inline: false }
      )
      .setFooter({ text: 'ตรวจสอบข้อมูลให้ถูกต้องก่อนกด' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_open_hw_modal_${subjectCode}`)
        .setLabel('✏️ กรอกข้อมูลการบ้าน')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.reply({ embeds: [embed], components: [row], ...EPHEMERAL });
  }

  // ─── Mark homework as complete ────────────────────────────────────────────
  if (customId === 'select_mark_complete') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', ...EPHEMERAL });
    }

    const homeworkId = values[0];
    const completions = await readSheet(SHEETS.COMPLETION);
    const alreadyDone = completions.find(
      (c) => c.homeworkId === homeworkId && c.studentId === session.studentId
    );

    if (alreadyDone) {
      return interaction.reply({ content: '✅ คุณได้ทำเครื่องหมายงานนี้ว่าเสร็จแล้ว', ...EPHEMERAL });
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
      ...EPHEMERAL,
    });
  }

  // ─── Admin dropdown ───────────────────────────────────────────────────────
  if (customId === 'select_admin_subject_action') {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ...EPHEMERAL });
    }

    const { addSubjectModal, deleteHomeworkModal } = require('../modals');
    const action = values[0];

    // showModal() is safe here — this is the first and only response
    if (action === 'add_subject') {
      return interaction.showModal(addSubjectModal());
    }

    if (action === 'delete_homework') {
      // FIX: removed readSheet() call before showModal() — async await before
      // showModal() can cause interaction timeout (>3s = Discord rejects modal).
      // Admin uses "ดูการบ้าน" button to find the ID first, then enters it here.
      return interaction.showModal(deleteHomeworkModal());
    }

    if (action === 'manage_users') {
      const users = await readSheet(SHEETS.USERS);
      if (users.length === 0) {
        return interaction.reply({ content: '❌ ไม่มีผู้ใช้ในระบบ', ...EPHEMERAL });
      }
      const embed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('👥 รายชื่อผู้ใช้ทั้งหมด')
        .setDescription(
          users.map((u) => `• **${u.firstName} ${u.lastName}** | รหัส: \`${u.studentId}\` | <@${u.discordId}>`).join('\n')
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_remove_user')
          .setLabel('🗑️ ลบผู้ใช้')
          .setStyle(ButtonStyle.Danger)
      );
      return interaction.reply({ embeds: [embed], components: [row], ...EPHEMERAL });
    }
  }
}

module.exports = { handleSelect };
