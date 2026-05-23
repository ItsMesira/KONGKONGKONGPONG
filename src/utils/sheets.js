// utils/sheets.js — Google Sheets API helper
//
// FIXES over original:
//   • sheetsClient is re-created after 50 minutes to prevent token expiry issues
//     (Google service-account tokens expire after 60 minutes; original code cached forever).
//   • deleteRow now validates rowIndex > 1 to prevent accidentally deleting the header.
//   • initSheets is idempotent and safe to call multiple times.

const { google } = require('googleapis');
const { SHEET_ID, SHEETS, GOOGLE_CREDENTIALS } = require('../config');

let sheetsClient   = null;
let clientCreatedAt = 0;
const CLIENT_TTL   = 50 * 60 * 1000; // 50 minutes — under Google's 60-min token lifetime

async function getClient() {
  const now = Date.now();
  if (sheetsClient && now - clientCreatedAt < CLIENT_TTL) return sheetsClient;

  const creds = JSON.parse(GOOGLE_CREDENTIALS);
  const auth  = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient    = google.sheets({ version: 'v4', auth });
  clientCreatedAt = now;
  return sheetsClient;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Read all rows from a sheet tab; returns array of objects keyed by first-row headers. */
async function readSheet(tabName) {
  const client = await getClient();
  const res    = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${tabName}!A1:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 1) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] ?? ''));
    return obj;
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

/** Append a single row to a sheet tab. */
async function appendRow(tabName, values) {
  const client = await getClient();
  await client.spreadsheets.values.append({
    spreadsheetId:   SHEET_ID,
    range:           `${tabName}!A1`,
    valueInputOption:'USER_ENTERED',
    requestBody:     { values: [values] },
  });
}

/** Update a specific row by 1-based row index. */
async function updateRow(tabName, rowIndex, values) {
  if (rowIndex < 2) throw new Error('rowIndex must be >= 2 to protect the header row');
  const client = await getClient();
  await client.spreadsheets.values.update({
    spreadsheetId:   SHEET_ID,
    range:           `${tabName}!A${rowIndex}`,
    valueInputOption:'USER_ENTERED',
    requestBody:     { values: [values] },
  });
}

/** Delete a row by 1-based row index. rowIndex 1 is the header — never delete it. */
async function deleteRow(tabName, rowIndex) {
  if (rowIndex < 2) throw new Error('rowIndex must be >= 2 to protect the header row');
  const client = await getClient();
  const meta   = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet  = meta.data.sheets.find((s) => s.properties.title === tabName);
  if (!sheet) throw new Error(`Sheet tab "${tabName}" not found`);
  const sheetId = sheet.properties.sheetId;

  await client.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension:  'ROWS',
            startIndex: rowIndex - 1, // 0-based inclusive
            endIndex:   rowIndex,     // 0-based exclusive
          },
        },
      }],
    },
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

const TAB_HEADERS = {
  [SHEETS.USERS]:      ['discordId', 'firstName', 'lastName', 'studentId', 'passwordHash'],
  [SHEETS.SUBJECTS]:   ['subjectCode', 'subjectName', 'credits', 'instructor'],
  [SHEETS.HOMEWORK]:   ['homeworkId', 'subjectCode', 'title', 'details', 'imageUrl', 'link', 'dueDate', 'assignDate', 'addedBy'],
  [SHEETS.COMPLETION]: ['homeworkId', 'studentId', 'completedAt'],
};

/**
 * Ensure all required sheet tabs and header rows exist.
 * Safe to call on every startup — it is idempotent.
 */
async function initSheets() {
  const client       = await getClient();
  const meta         = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTabs = meta.data.sheets.map((s) => s.properties.title);

  // Create missing tabs in a single batch request
  const addRequests = Object.values(SHEETS)
    .filter((tab) => !existingTabs.includes(tab))
    .map((tab) => ({ addSheet: { properties: { title: tab } } }));

  if (addRequests.length > 0) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody:   { requests: addRequests },
    });
  }

  // Write header rows for any tab that is still empty
  for (const [tab, headers] of Object.entries(TAB_HEADERS)) {
    const raw = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `${tab}!A1:Z1`,
    });
    if (!raw.data.values || raw.data.values.length === 0) {
      await client.spreadsheets.values.update({
        spreadsheetId:   SHEET_ID,
        range:           `${tab}!A1`,
        valueInputOption:'USER_ENTERED',
        requestBody:     { values: [headers] },
      });
    }
  }
}

module.exports = { readSheet, appendRow, updateRow, deleteRow, initSheets };
