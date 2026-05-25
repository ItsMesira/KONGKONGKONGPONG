// handlers/selects.js — Select menu interaction handlers
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { SHEETS, ADMIN_ROLE_ID } = require('../config');
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

  // ─── Admin dropdown ────────────────────────────────────────────────────────
  if (customId === 'select_admin_subject_action') {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์', ...EPHEMERAL });
    }

    const { addSubjectModal, deleteHomeworkModal } = require('../modals');
    const action = values[0];

    if (action === 'add_subject') {
      return interaction.showModal(addSubjectModal());
    }

    if (action === 'delete_homework') {
      // showModal() must be the first and only response — no async calls before it
      return interaction.showModal(deleteHomeworkModal());
    }

    if (action === 'manage_users') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const users = await readSheet(SHEETS.USERS);
      if (users.length === 0) {
        return interaction.editReply({ content: '❌ ไม่มีผู้ใช้ในระบบ', ...EPHEMERAL });
      }

      // FIX: chunk user list to stay within Discord's 4096-char embed description limit
      const lines = users.map(
        (u) => `• **${u.firstName} ${u.lastName}** | รหัส: \`${u.studentId}\` | <@${u.discordId}>`
      );

      const chunks = chunkLines(lines, EMBED_DESC_LIMIT);
      const embeds = chunks.map((chunk, i) =>
        new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle(chunks.length > 1 ? `👥 รายชื่อผู้ใช้ทั้งหมด (${i + 1}/${chunks.length})` : '👥 รายชื่อผู้ใช้ทั้งหมด')
          .setDescription(chunk)
          .setFooter({ text: `ทั้งหมด ${users.length} คน` })
      );

      // Only first embed gets the remove-user button; Discord allows max 10 embeds
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_remove_user')
          .setLabel('🗑️ ลบผู้ใช้')
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.editReply({
        embeds:     embeds.slice(0, 10), // Discord max 10 embeds per message
        components: [row],
        ...EPHEMERAL,
      });
    }

    // NEW: list all subjects
    if (action === 'list_subjects') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const subjects = await readSheet(SHEETS.SUBJECTS);
      if (subjects.length === 0) {
        return interaction.editReply({ content: '❌ ยังไม่มีวิชาในระบบ', ...EPHEMERAL });
      }
      const embed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle('📚 รายการวิชาทั้งหมด')
        .setDescription(
          subjects
            .map((s) => `• **${s.subjectCode}** — ${s.subjectName} (${s.credits} หน่วยกิต) | อ.${s.instructor}`)
            .join('\n')
            .slice(0, EMBED_DESC_LIMIT)
        )
        .setFooter({ text: `ทั้งหมด ${subjects.length} วิชา` });
      return interaction.editReply({ embeds: [embed], ...EPHEMERAL });
    }
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Split an array of lines into chunks where each chunk's joined text is
 * within `maxLen` characters.
 */
function chunkLines(lines, maxLen) {
  const chunks = [];
  let current  = [];
  let len      = 0;

  for (const line of lines) {
    if (len + line.length + 1 > maxLen && current.length > 0) {
      chunks.push(current.join('\n'));
      current = [];
      len     = 0;
    }
    current.push(line);
    len += line.length + 1;
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks;
}

module.exports = { handleSelect };
