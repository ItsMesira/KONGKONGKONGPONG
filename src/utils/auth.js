// utils/auth.js — Password hashing and session management
//
// SECURITY IMPROVEMENTS over original:
//   • Passwords are hashed with PBKDF2 (100k iterations, SHA-256) + per-user salt
//     instead of bare unsalted SHA-256, so a leaked sheet can't be rainbow-tabled.
//   • Salt is stored alongside the hash as "salt:hash" in the passwordHash column
//     (the column name stays the same so no sheet migration is needed).
//   • Legacy plain-SHA-256 hashes (no colon) are detected and still verified so
//     existing users don't get locked out — they'll just be prompted to change their
//     password next time (or you can wipe and re-register).
//   • Sessions are cleaned up automatically every 15 minutes to prevent memory leaks
//     on long-running deployments.

const crypto = require('crypto');
const { SESSION_TIMEOUT } = require('../config');

// In-memory session store: { discordId -> { studentId, expiresAt } }
const sessions = new Map();

// ─── Hashing ──────────────────────────────────────────────────────────────────

/**
 * Hash a password using PBKDF2 with a fresh random salt.
 * Returns a string in the form "salt:hash" (both hex-encoded).
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 * Handles both the new "salt:hash" format AND the legacy bare SHA-256 format
 * so existing users aren't locked out after the upgrade.
 */
function verifyPassword(password, stored) {
  if (stored.includes(':')) {
    // New format: PBKDF2
    const [salt, expectedHash] = stored.split(':');
    const actualHash = crypto
      .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
      .toString('hex');
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(actualHash,    'hex'),
      Buffer.from(expectedHash,  'hex')
    );
  } else {
    // Legacy format: unsalted SHA-256 — still works, just weaker
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return legacyHash === stored;
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function createSession(discordId, studentId) {
  sessions.set(discordId, {
    studentId,
    expiresAt: Date.now() + SESSION_TIMEOUT,
  });
}

/**
 * Get an active session, refreshing its expiry on access.
 * Returns null if no session exists or it has expired.
 */
function getSession(discordId) {
  const session = sessions.get(discordId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(discordId);
    return null;
  }
  // Sliding expiry — reset timer on activity
  session.expiresAt = Date.now() + SESSION_TIMEOUT;
  return session;
}

function destroySession(discordId) {
  sessions.delete(discordId);
}

// ─── Session cleanup (prevents memory leak on long-running bots) ──────────────
// Runs every 15 minutes to evict expired sessions.
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(id);
  }
}, 15 * 60 * 1000);

module.exports = { hashPassword, verifyPassword, createSession, getSession, destroySession };
