// src/services/claude.js
// Menggunakan Google Gemini API v0.24.1
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================================
// HELPER
// ============================================================
async function generate(prompt) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text;
}

async function generateWithImage(prompt, imageBuffer) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { text: prompt },
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }
    ],
  });
  return response.text;
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ============================================================
// OCR FOTO STRUK
// ============================================================
async function extractBillFromPhoto(imageBuffer) {
  try {
    const prompt = `Kamu adalah asisten OCR untuk struk/bill belanja Indonesia.
Analisis gambar struk ini dan ekstrak informasi dalam format JSON.

Kembalikan HANYA JSON ini, tanpa penjelasan tambahan:
{
  "merchant": "nama toko/merchant",
  "total": angka_numerik_saja_tanpa_titik_koma,
  "date": "YYYY-MM-DD atau null",
  "category": "salah satu dari: Makanan & Minuman / Belanja / Transportasi / Kesehatan / Utilitas / Hiburan / Pulsa & Data / Lain-lain",
  "description": "deskripsi singkat 3-5 kata",
  "items": [{"name": "nama item", "qty": 1, "price": 10000}],
  "tax": angka_pajak_atau_0,
  "subtotal": angka_subtotal
}

PENTING:
- total harus angka murni (contoh: 200998 bukan "Rp 200.998")
- Kalau tidak bisa membaca: {"error": "tidak dapat membaca struk"}
- items boleh array kosong []`;

    const response = await generateWithImage(prompt, imageBuffer);
    const data = parseJSON(response);

    if (data.error || !data.total || data.total <= 0) return null;

    return {
      merchant: data.merchant || 'Tidak diketahui',
      total: parseInt(data.total),
      date: data.date || null,
      category: data.category || 'Lain-lain',
      description: data.description || data.merchant || 'Belanja',
      items: data.items || [],
      tax: parseInt(data.tax) || 0,
      subtotal: parseInt(data.subtotal) || parseInt(data.total),
    };

  } catch (error) {
    console.error('Gemini OCR error:', error.message);
    return null;
  }
}

// ============================================================
// PARSE TRANSAKSI DARI TEKS
// ============================================================
async function parseTransactionText(text) {
  try {
    const prompt = `Kamu adalah parser transaksi keuangan Indonesia.
Parse teks berikut menjadi data transaksi dalam format JSON.

Teks: "${text}"

Kembalikan HANYA JSON ini tanpa penjelasan:
{
  "type": "pemasukan atau pengeluaran",
  "amount": angka_numerik_saja,
  "description": "deskripsi singkat",
  "category": "salah satu dari: Makanan & Minuman / Transportasi / Belanja / Kesehatan / Utilitas / Hiburan / Pulsa & Data / Gaji / Bonus / Penjualan / Transfer Masuk / Transfer / Lain-lain"
}

Aturan:
- Teks dengan "+" di depan atau kata: gaji, bonus, terima, dapat, masuk → pemasukan
- Sisanya → pengeluaran
- "rb" = ribuan (50rb = 50000), "jt" = jutaan (2jt = 2000000)
- amount harus angka murni tanpa format
- Kalau tidak ada angka: {"error": "nominal tidak ditemukan"}`;

    const response = await generate(prompt);
    const data = parseJSON(response);

    if (data.error || !data.amount || data.amount <= 0) return null;

    return {
      type: data.type || 'pengeluaran',
      amount: parseInt(data.amount),
      description: data.description || text,
      category: data.category || 'Lain-lain',
    };

  } catch (error) {
    console.error('Gemini parse error:', error.message);
    return null;
  }
}

// ============================================================
// FRIENDLY NUDGE
// ============================================================
async function generateNudge(userData, transactionData, nudgeType) {
  try {
    const prompts = {
      big_expense: `User bernama ${userData.name} baru catat pengeluaran:
- Nominal: Rp ${transactionData.amount.toLocaleString('id-ID')}
- Kategori: ${transactionData.category}
- Deskripsi: ${transactionData.description}

Buat pesan FRIENDLY, LUCU, PEDULI (bukan roasting kasar).
Maksimal 2 kalimat. Pakai emoji. Bahasa Indonesia casual.`,

      budget_warning: `User bernama ${userData.name} budget ${transactionData.category} hampir habis.
Sisa: Rp ${transactionData.budgetRemaining?.toLocaleString('id-ID')}.
Buat pesan FRIENDLY dan SUPPORTIF. Maksimal 2 kalimat. Pakai emoji.`,

      good_job: `User bernama ${userData.name} berhasil hemat ${transactionData.savedPercent}% bulan ini!
Buat pesan SEMANGAT dan MEMOTIVASI. Maksimal 2 kalimat. Pakai emoji.`,

      streak: `User bernama ${userData.name} catat transaksi ${transactionData.streakDays} hari berturut-turut!
Buat pesan BANGGA dan MOTIVASI. Maksimal 2 kalimat. Pakai emoji.`,
    };

    const prompt = prompts[nudgeType];
    if (!prompt) return null;
    return await generate(prompt);

  } catch (error) {
    console.error('Gemini nudge error:', error.message);
    return null;
  }
}

// ============================================================
// CHAT AI
// ============================================================
async function chatWithAI(userQuestion, financialContext) {
  try {
    const prompt = `Kamu adalah Kairin, asisten keuangan AI pribadi yang friendly dan pintar.
Kamu berbicara dengan ${financialContext.userName}.

DATA KEUANGAN USER (bulan ini):
- Pemasukan: Rp ${financialContext.income?.toLocaleString('id-ID') || 0}
- Pengeluaran: Rp ${financialContext.expense?.toLocaleString('id-ID') || 0}
- Saldo: Rp ${financialContext.balance?.toLocaleString('id-ID') || 0}
- Top kategori: ${JSON.stringify(financialContext.topCategories || [])}
- Total transaksi: ${financialContext.totalTransactions || 0}

DETAIL TRANSAKSI:
${JSON.stringify(financialContext.transactions || [], null, 2)}

PERTANYAAN: "${userQuestion}"

PENTING — Cara cari data:
- Kalau user tanya nama tempat/merchant → cek field "merchant" di setiap transaksi
- Kalau user tanya item makanan → cek field "items" dan "description"
- Kalau user tanya tanggal → cek field "date"
- Cari dengan case-insensitive (Padang = padang = PADANG)

Jawab berdasarkan DATA DI ATAS. Bahasa Indonesia casual, friendly, 
maksimal 4-5 kalimat, pakai emoji.`;

    return await generate(prompt);

  } catch (error) {
    console.error('Gemini chat error:', error.message);
    return 'Maaf, saya sedang tidak bisa menjawab. Coba lagi ya! 🙏';
  }
}

module.exports = {
  extractBillFromPhoto,
  parseTransactionText,
  generateNudge,
  chatWithAI,
};