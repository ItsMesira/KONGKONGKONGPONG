// utils/panel.js — Build and post the main homework panel embed
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

function buildPanelComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_register')
      .setLabel('📝 ลงทะเบียน')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_login')
      .setLabel('🔑 เข้าสู่ระบบ')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_logout')
      .setLabel('🚪 ออกจากระบบ')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_add_homework')
      .setLabel('➕ เพิ่มการบ้าน')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_view_homework')
      .setLabel('📋 ดูการบ้าน')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_check_completion')
      .setLabel('✅ ตรวจสอบงาน')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_admin_subject')
      .setLabel('⚙️ จัดการวิชา (Admin)')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_admin_delete_hw')
      .setLabel('🗑️ ลบการบ้าน (Admin)')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_admin_users')
      .setLabel('👥 จัดการผู้ใช้ (Admin)')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('📚 Emble — ระบบติดตามการบ้าน')
    .setDescription(
      '**ยินดีต้อนรับสู่ระบบจัดการการบ้าน**\n\n' +
      '🔹 **ลงทะเบียน** — สร้างบัญชีของคุณ\n' +
      '🔹 **เข้าสู่ระบบ** — ล็อกอินด้วยรหัสนักศึกษา\n' +
      '🔹 **เพิ่มการบ้าน** — เพิ่มงานใหม่ (ต้องเข้าสู่ระบบ)\n' +
      '🔹 **ดูการบ้าน** — ดูรายการงานทั้งหมด\n' +
      '🔹 **ตรวจสอบงาน** — ทำเครื่องหมายงานที่เสร็จแล้ว\n\n' +
      '⚙️ ปุ่มสีแดงสำหรับ Admin เท่านั้น'
    )
    .setFooter({ text: 'Emble Bot • ระบบติดตามการบ้าน' })
    .setTimestamp();
}

async function postOrUpdatePanel(channel) {
  const embed = buildPanelEmbed();
  const components = buildPanelComponents();

  // Try to find existing panel message
  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = messages.find(
    (m) => m.author.bot && m.embeds.length > 0 && m.embeds[0].title?.includes('Emble')
  );

  if (existing) {
    await existing.edit({ embeds: [embed], components });
  } else {
    await channel.send({ embeds: [embed], components });
  }
}

module.exports = { postOrUpdatePanel, buildPanelEmbed, buildPanelComponents };
