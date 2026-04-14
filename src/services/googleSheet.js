const { google } = require('googleapis');

async function syncSheet(auth, spreadsheetId, transactions) {
  console.log('🔥 SYNC DIPANGGIL');
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('🚀 SYNC SHEET JALAN');

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
        new Date(t.transacted_at)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' '),
        t.description,
        t.amount,
        t.category
      ])
    }
  });
  
  console.log('✅ SELESAI UPDATE SHEET');
}

module.exports = {
  syncSheet
};