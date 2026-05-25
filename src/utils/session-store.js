const fs = require('fs')
const path = require('path')
const { SESSION_TIMEOUT } = require('../config')

const SESSION_FILE = path.join(__dirname, '..', '..', 'data', 'sessions.json')

let sessions = new Map()
let loaded = false
let dirty = false
let saveTimer = null

function ensureDir() {
  const dir = path.dirname(SESSION_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function load() {
  if (loaded) return
  loaded = true
  ensureDir()
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8')
    const data = JSON.parse(raw)
    const now = Date.now()
    sessions = new Map()
    for (const [id, s] of Object.entries(data)) {
      if (now < s.expiresAt) sessions.set(id, s)
    }
  } catch {
    sessions = new Map()
  }
}

function save() {
  if (!dirty) return
  dirty = false
  ensureDir()
  const obj = {}
  for (const [id, s] of sessions) obj[id] = s
  fs.writeFileSync(SESSION_FILE, JSON.stringify(obj, null, 2), 'utf-8')
}

function scheduleSave() {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 2000)
}

function createSession(discordId, studentId) {
  load()
  sessions.set(discordId, {
    studentId,
    expiresAt: Date.now() + SESSION_TIMEOUT,
  })
  scheduleSave()
}

function getSession(discordId) {
  load()
  const session = sessions.get(discordId)
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    sessions.delete(discordId)
    scheduleSave()
    return null
  }
  session.expiresAt = Date.now() + SESSION_TIMEOUT
  scheduleSave()
  return session
}

function destroySession(discordId) {
  load()
  sessions.delete(discordId)
  scheduleSave()
}

setInterval(() => {
  load()
  const now = Date.now()
  let changed = false
  for (const [id, s] of sessions) {
    if (now > s.expiresAt) {
      sessions.delete(id)
      changed = true
    }
  }
  if (changed) scheduleSave()
}, 15 * 60 * 1000)

module.exports = { createSession, getSession, destroySession }
