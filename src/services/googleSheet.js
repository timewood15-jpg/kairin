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

async function syncMonthlySummary(auth, spreadsheetId, transactions) {
  const { google } = require('googleapis');
  const sheets = google.sheets({ version: 'v4', auth });

  const summary = {};

  transactions.forEach(t => {
    const date = new Date(t.transacted_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!summary[key]) {
      summary[key] = { income: 0, expense: 0 };
    }

    if (t.type === 'pemasukan') {
      summary[key].income += t.amount;
    } else {
      summary[key].expense += t.amount;
    }
  });

  const rows = Object.entries(summary).map(([bulan, val]) => [
    bulan,
    val.income,
    val.expense,
    val.income - val.expense
  ]);

  // urutkan bulan ASC
  rows.sort((a, b) => a[0].localeCompare(b[0]));

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: "'Rekap Bulanan'!A2:D"
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Rekap Bulanan'!A2:D",
    valueInputOption: 'USER_ENTERED',
    resource: { values: rows }
  });
}

module.exports = {
  syncSheet,
  syncMonthlySummary
};