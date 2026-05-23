// index.js — Emble Bot Entry Point
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  MessageFlags,
} = require('discord.js');

const { TOKEN, PANEL_CHANNEL_ID } = require('./config');
const { initSheets }              = require('./utils/sheets');
const { startScheduler }          = require('./utils/reminders');
const { postOrUpdatePanel }       = require('./utils/panel');
const { handleButton }            = require('./handlers/buttons');
const { handleSelect }            = require('./handlers/selects');
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
  log(`✅ Emble Bot พร้อมใช้งาน! เข้าสู่ระบบในนาม: ${client.user.tag}`);

  try {
    await initSheets();
    log('✅ Google Sheets พร้อมใช้งาน');
  } catch (err) {
    log('❌ ไม่สามารถเชื่อมต่อ Google Sheets:', err.message);
    // Don't exit — bot can still handle interactions even if Sheets is temporarily down
  }

  setClient(client);
  startScheduler(client);
  log('✅ ระบบแจ้งเตือนเปิดใช้งานแล้ว');

  try {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
    if (channel) {
      await postOrUpdatePanel(channel);
      log('✅ Panel โพสต์สำเร็จ');
    } else {
      log('⚠️ ไม่พบช่องทาง Panel Channel (ID:', PANEL_CHANNEL_ID, ')');
    }
  } catch (err) {
    log('⚠️ ไม่สามารถโพสต์ Panel:', err.message);
  }
});

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if      (interaction.isButton())          await handleButton(interaction);
    else if (interaction.isStringSelectMenu()) await handleSelect(interaction);
    else if (interaction.isModalSubmit())      await handleModalSubmit(interaction);
  } catch (err) {
    log('❌ ข้อผิดพลาด interaction:', err);
    const msg = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', flags: MessageFlags.Ephemeral };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch { /* interaction may have already timed out */ }
  }
});

// ─── Global error handlers (prevent crashes on unhandled rejections) ──────────
process.on('unhandledRejection', (reason) => {
  log('⚠️ Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  log('❌ Uncaught exception:', err);
  // Give the logger a tick to flush before potentially exiting
  setTimeout(() => process.exit(1), 500);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  log(`🛑 Received ${signal} — shutting down gracefully…`);
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Logger helper ─────────────────────────────────────────────────────────────
function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// ─── Start ────────────────────────────────────────────────────────────────────
client.login(TOKEN);
