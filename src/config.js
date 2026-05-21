// config.js — Central configuration for Emble Bot
require('dotenv').config();

module.exports = {
  // Discord
  TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  PANEL_CHANNEL_ID: '1506267894068285542',
  SUMMARY_USER_ID: '918320537443385396',
  ADMIN_ROLE_ID: '1480919691982667826',

  // Google Sheets
  SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_CREDENTIALS: process.env.GOOGLE_CREDENTIALS, // JSON string of service account

  // Sheet tab names
  SHEETS: {
    USERS: 'Users',
    SUBJECTS: 'Subjects',
    HOMEWORK: 'Homework',
    COMPLETION: 'Completion',
  },

  // Session timeout in ms (2 hours)
  SESSION_TIMEOUT: 2 * 60 * 60 * 1000,
};
