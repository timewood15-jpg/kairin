const { google } = require('googleapis');
const SHEET_REKAP = 'Rekap Bulanan';

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
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureSheetExists(auth, spreadsheetId, SHEET_REKAP);

  // 1. CLEAR DATA (tanpa header)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_REKAP}!A2:D`
  });

  // 2. SET HEADER
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_REKAP}!A1:D1`,
    valueInputOption: 'RAW',
    resource: {
      values: [[
        'Bulan',
        'Pemasukan',
        'Pengeluaran',
        'Saldo'
      ]]
    }
  });

  // 3. HITUNG REKAP
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

  // urutkan ASC
  rows.sort((a, b) => a[0].localeCompare(b[0]));

  // 4. INSERT DATA
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_REKAP}!A2:D`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: rows }
  });

  console.log('✅ REKAP BULANAN BERHASIL');
}

async function ensureSheetExists(auth, spreadsheetId, sheetName) {
  const { google } = require('googleapis');
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.get({
    spreadsheetId
  });

  const exists = res.data.sheets.some(
    s => s.properties.title === sheetName
  );

  if (!exists) {
    console.log(`📄 Sheet "${sheetName}" belum ada, bikin...`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: { title: sheetName }
            }
          }
        ]
      }
    });
    
    // 🔥 PENTING: kasih delay biar ke-create dulu
    await new Promise(r => setTimeout(r, 500));
  }
}

module.exports = {
  syncSheet,
  syncMonthlySummary,
  ensureSheetExists
};