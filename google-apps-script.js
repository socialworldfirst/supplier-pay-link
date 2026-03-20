/**
 * ============================================================
 * WorldFirst Supplier Card — Google Apps Script
 * ============================================================
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Go to https://script.google.com/ and create a new project.
 *
 * 2. Paste this entire file into Code.gs (replace default content).
 *
 * 3. Create a Google Sheet and copy its ID from the URL:
 *    https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
 *    Paste that ID into the SPREADSHEET_ID variable below.
 *
 * 4. In the Google Sheet, create a tab named "Submissions" (or rename
 *    Sheet1 to "Submissions"). Add these headers in row 1:
 *    Timestamp | Company Name (CN) | Company Name (EN) | Address |
 *    Categories | Website | WhatsApp | WeChat | Email | Approved
 *
 * 5. In the Apps Script editor:
 *    - Click Deploy > New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    - Click Deploy and authorize when prompted
 *
 * 6. Copy the Web App URL and paste it into your form.html file
 *    as the value of GOOGLE_SCRIPT_URL.
 *
 * 7. Test by submitting the form. Check the Google Sheet for new rows.
 *
 * ============================================================
 */

// ── Configuration ──────────────────────────────────────────
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'Submissions';

// ── Handle POST requests from the supplier form ───────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Append a new row
    sheet.appendRow([
      new Date().toISOString(),       // Timestamp
      data.nameCn || '',              // Company Name (CN)
      data.nameEn || '',              // Company Name (EN)
      data.address || '',             // Address
      data.categories || '',          // Categories
      data.website || '',             // Website
      data.whatsapp || '',            // WhatsApp
      data.wechat || '',              // WeChat
      data.email || '',               // Email
      ''                              // Approved (empty by default)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Submission recorded' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Handle CORS preflight (OPTIONS) and GET requests ──────
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Supplier form API is running. Use POST to submit data.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
