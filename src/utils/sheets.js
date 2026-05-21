// utils/sheets.js — Google Sheets API helper
const { google } = require('googleapis');
const { SHEET_ID, SHEETS, GOOGLE_CREDENTIALS } = require('../config');

let sheetsClient = null;

async function getClient() {
  if (sheetsClient) return sheetsClient;
  const creds = JSON.parse(GOOGLE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// Read all rows from a sheet tab (returns array of objects using first row as headers)
async function readSheet(tabName) {
  const client = await getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A1:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 1) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] || ''));
    return obj;
  });
}

// Append a row to a sheet tab (values = array matching column order)
async function appendRow(tabName, values) {
  const client = await getClient();
  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// Update a specific row by 1-based row index (rowIndex includes header, so data starts at 2)
async function updateRow(tabName, rowIndex, values) {
  const client = await getClient();
  await client.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// Delete a row by 1-based row index
async function deleteRow(tabName, rowIndex) {
  const client = await getClient();
  // Get sheet ID (gid) for the tab
  const meta = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = meta.data.sheets.find(
    (s) => s.properties.title === tabName
  );
  if (!sheet) throw new Error(`Sheet tab "${tabName}" not found`);
  const sheetId = sheet.properties.sheetId;
  await client.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-based
              endIndex: rowIndex,       // exclusive
            },
          },
        },
      ],
    },
  });
}

// Ensure all required sheet tabs + headers exist
async function initSheets() {
  const client = await getClient();
  const meta = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTabs = meta.data.sheets.map((s) => s.properties.title);

  const tabHeaders = {
    [SHEETS.USERS]:      ['discordId', 'firstName', 'lastName', 'studentId', 'passwordHash'],
    [SHEETS.SUBJECTS]:   ['subjectCode', 'subjectName', 'credits', 'instructor'],
    [SHEETS.HOMEWORK]:   ['homeworkId', 'subjectCode', 'title', 'details', 'imageUrl', 'link', 'dueDate', 'assignDate', 'addedBy'],
    [SHEETS.COMPLETION]: ['homeworkId', 'studentId', 'completedAt'],
  };

  const addRequests = [];
  for (const tab of Object.values(SHEETS)) {
    if (!existingTabs.includes(tab)) {
      addRequests.push({ addSheet: { properties: { title: tab } } });
    }
  }

  if (addRequests.length > 0) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: addRequests },
    });
  }

  // Write headers if tab was empty
  for (const [tab, headers] of Object.entries(tabHeaders)) {
    const existing = await readSheet(tab);
    // Re-read raw to check if header row exists
    const raw = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A1:Z1`,
    });
    if (!raw.data.values || raw.data.values.length === 0) {
      await client.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${tab}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      });
    }
  }
}

module.exports = { readSheet, appendRow, updateRow, deleteRow, initSheets };
