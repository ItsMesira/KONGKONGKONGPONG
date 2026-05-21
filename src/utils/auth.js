// utils/auth.js — Password hashing and session management
const crypto = require('crypto');
const { SESSION_TIMEOUT } = require('../config');

// In-memory session store: { discordId -> { studentId, expiresAt } }
const sessions = new Map();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createSession(discordId, studentId) {
  sessions.set(discordId, {
    studentId,
    expiresAt: Date.now() + SESSION_TIMEOUT,
  });
}

function getSession(discordId) {
  const session = sessions.get(discordId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(discordId);
    return null;
  }
  // Refresh session on activity
  session.expiresAt = Date.now() + SESSION_TIMEOUT;
  return session;
}

function destroySession(discordId) {
  sessions.delete(discordId);
}

module.exports = { hashPassword, createSession, getSession, destroySession };
