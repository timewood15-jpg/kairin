// src/services/claude.js
// Menggunakan Google Gemini API v0.24.1
const { GoogleGenAI } = require('@google/genai');
const { withRetry } = require('./aiRetry');
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

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ============================================================
// OCR FOTO STRUK
// ============================================================
async function extractBillFromPhoto(imageBuffer) {
  try {
    const prompt = `
Kamu adalah AI OCR + parser keuangan Indonesia.

Analisis gambar struk ini dan langsung ekstrak menjadi JSON transaksi.

Kembalikan HANYA JSON valid berikut:
{
  "amount": number,
  "description": string,
  "merchant": string,
  "bill_date": "YYYY-MM-DD",
  "category": string,
  "type": "pengeluaran",
  "items": [
    {
      "name": string,
      "qty": number,
      "unit_price": number,
      "total_price": number
    }
  ]
}

Aturan:
- amount = total akhir belanja
- description = nama toko atau ringkasan transaksi
- merchant = nama toko/merchant
- bill_date format YYYY-MM-DD jika ada
- category pilih kategori sederhana Indonesia
- type selalu "pengeluaran"

Aturan items:
- items berisi daftar barang pada struk
- qty harus angka
- unit_price harga satuan
- total_price = subtotal item
- kalau qty tidak ada, gunakan 1
- kalau item tidak terbaca, gunakan []

PENTING:
- Semua nominal harus angka murni tanpa titik/koma
- Jangan gunakan markdown
- Balas HANYA JSON valid
- Jika gambar blur/parah:
{"error":"struk tidak terbaca"}
`;

    // 🔥 retry lebih hemat + stop kalau quota habis
    const response = await withRetry(() => generateWithImage(prompt, imageBuffer), {
      retries: 1, // cukup 1
      delay: 1200
    });

    if (!response) return null;

    const data = parseJSON(response);

    // 🔥 VALIDASI SUPER KETAT (anti data sampah)
    if (
      data.error ||
      !data.amount ||
      data.amount <= 0 ||
      !data.description
    ) {
      return null;
    }

    const amount = parseInt(String(data.amount).replace(/[^0-9]/g, ''));

    if (!amount || isNaN(amount)) return null;

    return {
      amount,
      description: (data.description || '').trim(),
      merchant: (data.merchant || '').trim(),
      bill_date: data.bill_date || null,
      category: (data.category || 'Lain-lain').trim(),
      type: 'pengeluaran',
      items: Array.isArray(data.items) ? data.items : []
    };

  } catch (error) {
    // HANDLE KHUSUS QUOTA
    if (error.message?.includes('429')) {
      console.log('🚫 Quota habis (429)');
      return null;
    }

    console.error('Gemini OCR error:', error.message);
    return null;
  }
}

async function extractBillFromText(text) {
  try {
    const prompt = `
Ekstrak transaksi dari teks berikut:

"${text}"

Balas hanya JSON:
{
  "amount": number,
  "description": string,
  "category": string,
  "type": "pemasukan" | "pengeluaran",
  "confidence": number (0-1)
}
`;

    const res = await callGemini(prompt); // pakai function kamu yg sudah ada

    return JSON.parse(res);
  } catch (e) {
    console.log('❌ extractBillFromText error:', e.message);
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

    

const response = await withRetry(() => generate(prompt), {
  retries: 2,
  delay: 1000
});

if (!response) return null;
    const data = parseJSON(response);

    if (data.error || !data.amount || data.amount <= 0 || !data.description) {
      return null;
    }

   const amount = parseInt(String(data.amount).replace(/[^0-9]/g, ''));

   if (!amount || isNaN(amount)) return null;

   const type = data.type === 'pemasukan' ? 'pemasukan' : 'pengeluaran';

   return {
     type,
     amount,
     description: (data.description || text).trim(),
     category: (data.category || 'Lain-lain').trim(),
     confidence: data.confidence || 0.8
   };

  } catch (error) {
    console.error('Gemini parse error:', {
      message: error.message,
      text
    });
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
    const topCategories =
      (financialContext.topCategories || [])
      .map(([name, amount]) =>
        `${name}: Rp ${amount.toLocaleString('id-ID')}`
      )
      .join(', ') || 'Belum ada';

    const prompt = `
Kamu adalah Kairin, asisten keuangan AI pribadi Indonesia.
Gaya bicara ramah, santai, helpful, seperti teman yang pintar soal keuangan.

Kamu sedang berbicara dengan:
${financialContext.userName}

DATA KEUANGAN USER (bulan ini):
- Pemasukan:
Rp ${financialContext.income?.toLocaleString('id-ID') || 0}

- Pengeluaran:
Rp ${financialContext.expense?.toLocaleString('id-ID') || 0}

- Saldo:
Rp ${financialContext.balance?.toLocaleString('id-ID') || 0}

- Top kategori:
${topCategories}

- Total transaksi:
${financialContext.totalTransactions || 0}

RIWAYAT TRANSAKSI USER:
${JSON.stringify(
  financialContext.transactions || [],
  null,
  2
)}

PERTANYAAN USER:
"${userQuestion}"

ATURAN WAJIB:
1. Selalu cari jawaban di data transaksi terlebih dahulu.
2. Cocokkan keyword user dengan:
   - description
   - merchant
   - category
   - items[].name
3. Pencarian tidak case-insensitive
   (mouse = Mouse = MOUSE).
4. Jika transaksi ditemukan:
   - sebutkan deskripsi
   - nominal
   - tanggal transaksi
5. Jangan bilang "tidak ada"
   sebelum benar-benar cek transaksi.
6. Jangan mengarang data.
7. Jika tidak ditemukan, katakan dengan jujur.

Jawab singkat, ramah, natural,
maksimal 4 kalimat, boleh pakai emoji.
`;

    return await generate(prompt);

  } catch (error) {
    console.error('Gemini chat error:', error.message);
    return 'Maaf, saya sedang tidak bisa menjawab 🙏';
  }
}

async function generateWithImage(prompt, imageBuffer) {
  // Deteksi format gambar dari magic bytes
  let mimeType = 'image/jpeg'; // default
  if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
    mimeType = 'image/png';
  } else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) {
    mimeType = 'image/gif';
  } else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49) {
    mimeType = 'image/webp';
  }

  console.log('🖼️ Detected mimeType:', mimeType, '| Size:', imageBuffer.length, 'bytes');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [                          // ← pakai "parts" array
          { text: prompt },
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType
            }
          }
        ]
      }
    ],
  });
  return response.text;
}

async function ocrTextFromImage(imageBuffer) {
  const prompt = `
Ekstrak teks dari gambar struk ini.
Kembalikan TEKS SAJA (tanpa penjelasan).
`;

  // ganti ini dengan wrapper kamu
  const res = await generateWithImage(prompt, imageBuffer);

  if (!res || typeof res !== 'string') return null;

  return res.trim();
}


module.exports = {
  extractBillFromPhoto,
  extractBillFromText,
  parseTransactionText,
  generateNudge,
  chatWithAI,
  generateWithImage,
  ocrTextFromImage,
};