// index.js — Emble Bot Entry Point
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require('discord.js');

const { TOKEN, PANEL_CHANNEL_ID } = require('./config');
const { initSheets } = require('./utils/sheets');
const { startScheduler } = require('./utils/reminders');
const { postOrUpdatePanel } = require('./utils/panel');
const { handleButton } = require('./handlers/buttons');
const { handleSelect } = require('./handlers/selects');
const { handleModalSubmit, setClient } = require('./handlers/modals');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log(`✅ Emble Bot พร้อมใช้งาน! เข้าสู่ระบบในนาม: ${client.user.tag}`);

  try {
    // Init Google Sheets structure
    await initSheets();
    console.log('✅ Google Sheets พร้อมใช้งาน');

    // Pass client to modules that need it
    setClient(client);
    startScheduler(client);
    console.log('✅ ระบบแจ้งเตือนเปิดใช้งานแล้ว');

    // Post/update main panel
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
    if (channel) {
      await postOrUpdatePanel(channel);
      console.log('✅ Panel โพสต์สำเร็จ');
    } else {
      console.warn('⚠️ ไม่พบช่องทาง Panel Channel');
    }
  } catch (err) {
    console.error('❌ ข้อผิดพลาดขณะเริ่มต้น:', err);
  }
});

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelect(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (err) {
    console.error('❌ ข้อผิดพลาด interaction:', err);
    const msg = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch (_) {}
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
client.login(TOKEN);
