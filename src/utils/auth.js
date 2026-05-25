const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (stored.includes(':')) {
    const [salt, expectedHash] = stored.split(':');
    const actualHash = crypto
      .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
      .toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(actualHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } else {
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return legacyHash === stored;
  }
}

const sessionStore = require('./session-store');

function createSession(discordId, studentId) {
  sessionStore.createSession(discordId, studentId);
}

function getSession(discordId) {
  return sessionStore.getSession(discordId);
}

function destroySession(discordId) {
  sessionStore.destroySession(discordId);
}

module.exports = { hashPassword, verifyPassword, createSession, getSession, destroySession };
