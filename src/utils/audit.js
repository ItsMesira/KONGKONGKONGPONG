const { appendRow } = require('./sheets')
const { SHEETS } = require('../config')

async function log(auditEntry) {
  try {
    await appendRow(SHEETS.LOGS, [
      new Date().toISOString(),
      auditEntry.adminId || '',
      auditEntry.adminName || '',
      auditEntry.action || '',
      auditEntry.target || '',
      auditEntry.details || '',
    ])
  } catch (err) {
    console.error('audit log error:', err.message)
  }
}

module.exports = { log }
