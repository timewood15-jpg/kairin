const { google } = require('googleapis');

async function syncSheet(auth, spreadsheetId, transactions) {
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Transaksi!A2:D'
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Transaksi!A2:D',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: transactions.map(t => [
        new Date(t.transacted_at).toLocaleString('id-ID'),
        t.description,
        t.amount,
        t.category
      ])
    }
  });
}

module.exports = {
  syncSheet
};