// handlers/selects.js — Select menu interaction handlers
const { EmbedBuilder } = require('discord.js');
const { SHEETS } = require('../config');
const { getSession } = require('../utils/auth');
const { readSheet, appendRow } = require('../utils/sheets');
const { homeworkModal } = require('../modals');

async function handleSelect(interaction) {
  const { customId, values, user } = interaction;

  // ─── Subject selected for adding homework ─────────────────────────────────
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

    // Show subject info embed before the modal
    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle(`📚 ข้อมูลวิชา — ${subject.subjectCode}`)
      .addFields(
        { name: 'ชื่อวิชา', value: subject.subjectName, inline: true },
        { name: 'รหัสวิชา', value: subject.subjectCode, inline: true },
        { name: 'หน่วยกิต', value: subject.credits, inline: true },
        { name: 'อาจารย์ผู้สอน', value: subject.instructor, inline: false }
      )
      .setFooter({ text: 'ข้อมูลนี้แสดงเพื่อยืนยันเท่านั้น' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    // Slight delay so user sees the subject info before modal pops
    setTimeout(() => {
      interaction.followUp({
        content: '📝 กรุณากรอกข้อมูลการบ้าน:',
        ephemeral: true,
      });
    }, 300);

    // Show homework modal
    return interaction.showModal(homeworkModal(subjectCode));
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
}

module.exports = { handleSelect };
