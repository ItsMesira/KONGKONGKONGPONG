// handlers/selects.js — Select menu interaction handlers
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { SHEETS } = require('../config');
const { getSession } = require('../utils/auth');
const { readSheet, appendRow } = require('../utils/sheets');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

// Discord embed description hard limit
const EMBED_DESC_LIMIT = 4096;

async function handleSelect(interaction) {
  const { customId, values, user } = interaction;

  // ─── Subject selected → show info + confirm button ────────────────────────
  // IMPORTANT: Do NOT call showModal() here — Discord only allows ONE response
  // per interaction. The confirm button (btn_open_hw_modal_) opens the modal
  // as a fresh interaction in buttons.js.
  if (customId === 'select_subject_for_hw') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', ...EPHEMERAL });
    }

    const subjectCode = values[0];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subjects    = await readSheet(SHEETS.SUBJECTS);
    const subject     = subjects.find((s) => s.subjectCode === subjectCode);

    if (!subject) {
      return interaction.editReply({ content: '❌ ไม่พบวิชาที่เลือก', ...EPHEMERAL });
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle(`📚 ข้อมูลวิชา — ${subject.subjectCode}`)
      .addFields(
        { name: 'ชื่อวิชา',      value: subject.subjectName, inline: true },
        { name: 'รหัสวิชา',      value: subject.subjectCode, inline: true },
        { name: 'หน่วยกิต',      value: subject.credits,     inline: true },
        { name: 'อาจารย์ผู้สอน', value: subject.instructor,  inline: false },
      )
      .setFooter({ text: 'ตรวจสอบข้อมูลให้ถูกต้องก่อนกด' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_open_hw_modal_${subjectCode}`)
        .setLabel('✏️ กรอกข้อมูลการบ้าน')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({ embeds: [embed], components: [row], ...EPHEMERAL });
  }

  // ─── Mark homework as complete ─────────────────────────────────────────────
  if (customId === 'select_mark_complete') {
    const session = getSession(user.id);
    if (!session) {
      return interaction.reply({ content: '❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', ...EPHEMERAL });
    }

    const homeworkId  = values[0];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const completions = await readSheet(SHEETS.COMPLETION);
    const alreadyDone = completions.find(
      (c) => c.homeworkId === homeworkId && c.studentId === session.studentId
    );

    if (alreadyDone) {
      return interaction.editReply({ content: '✅ คุณได้ทำเครื่องหมายงานนี้ว่าเสร็จแล้ว', ...EPHEMERAL });
    }

    const now = new Date().toISOString();
    await appendRow(SHEETS.COMPLETION, [homeworkId, session.studentId, now]);

    const hw = (await readSheet(SHEETS.HOMEWORK)).find((h) => h.homeworkId === homeworkId);
    return interaction.editReply({
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


}

module.exports = { handleSelect };
