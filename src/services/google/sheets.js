const { google } = require('googleapis');

async function appendToSheet(auth, spreadsheetId, data) {
  const sheets = google.sheets({
    version: 'v4',
    auth
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Transaksi!A2:D',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[
        data.tanggal,
        data.keterangan,
        data.jumlah,
        data.kategori
      ]]
    }
  });
}

module.exports = {
  appendToSheet
};