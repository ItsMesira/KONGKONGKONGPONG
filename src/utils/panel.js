// utils/panel.js — Build and post the main homework panel embed
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// Class banner image (Discord CDN)
const PANEL_IMAGE = 'https://media.discordapp.net/attachments/1481129431211708467/1507323556030316624/content.png';

function buildPanelComponents() {
  // Row 1: Account actions
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_register')
      .setLabel('ลงทะเบียน')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_login')
      .setLabel('เข้าสู่ระบบ')
      .setEmoji('🔑')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_logout')
      .setLabel('ออกจากระบบ')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 2: Homework actions
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_add_homework')
      .setLabel('เพิ่มการบ้าน')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_view_homework')
      .setLabel('ดูการบ้าน')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_check_completion')
      .setLabel('ตรวจสอบงาน')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_my_stats')
      .setLabel('สถิติของฉัน')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📚  ระบบติดตามการบ้าน — MEP4')
    .setDescription(
      '> ยินดีต้อนรับสู่ระบบจัดการการบ้านของห้อง\n\n' +
      '**สำหรับนักเรียน**\n' +
      '`📝` **ลงทะเบียน** — สร้างบัญชีครั้งแรก\n' +
      '`🔑` **เข้าสู่ระบบ** — ล็อกอินก่อนใช้งาน\n' +
      '`➕` **เพิ่มการบ้าน** — บันทึกงานใหม่\n' +
      '`📋` **ดูการบ้าน** — ดูรายการงานทั้งหมด\n' +
      '`✅` **ตรวจสอบงาน** — ทำเครื่องหมายงานที่เสร็จ\n' +
      '`📊` **สถิติของฉัน** — ดูความคืบหน้าส่วนตัว\n\n' +
      '─────────────────────────────\n' +
      '*ระบบจะแจ้งเตือนทาง DM เมื่อมีการบ้านใหม่\n' +
      'และก่อนถึงกำหนดส่ง 1 วัน / 12 ชม. / 1 ชม.*'
    )
    .setImage(PANEL_IMAGE)
    .setFooter({ text: 'Emble Bot • ระบบติดตามการบ้าน MEP4' })
    .setTimestamp();
}

async function postOrUpdatePanel(channel) {
  const embed      = buildPanelEmbed();
  const components = buildPanelComponents();

  // Try to find and edit an existing panel to avoid spamming the channel
  const messages = await channel.messages.fetch({ limit: 50 });
  const existing  = messages.find(
    (m) => m.author.bot && m.embeds.length > 0 && m.embeds[0].title?.includes('ระบบติดตามการบ้าน')
  );

  if (existing) {
    await existing.edit({ embeds: [embed], components });
  } else {
    await channel.send({ embeds: [embed], components });
  }
}

module.exports = { postOrUpdatePanel, buildPanelEmbed, buildPanelComponents };
