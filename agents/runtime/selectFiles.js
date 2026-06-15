const fs = require('fs');
const path = require('path');

const registry =
  require('../config/fileRegistry.json');

function selectFiles(
  task,
  agentName = null
) {
  const t =
    task.toLowerCase();

  const selected =
    new Set();

  const keywordMap = {
      google: [
        'google',
        'sheet',
        'sheets',
        'sync',
        'spreadsheet'
      ],

      lookup: [
      'lookup',
      'lookupflow',
      'detailnya',
      'transaksi terakhir',
      'riwayat',
      'stale',
      'stale context'
    ],

    finance: [
      'finance',
      'pengeluaran',
      'pemasukan',
      'boros',
      'bulan ini',
      'saldo',
      'budget'
    ],

    transaction: [
      'transaksi',
      'save',
      'parser',
      'amount',
      'expense',
      'income'
    ],

    ocr: [
      'ocr',
      'receipt',
      'struk',
      'bill',
      'scan',
      'photo'
    ],

    security: [
      'token',
      'auth',
      'oauth',
      'credential',
      'apikey',
      'jwt',
      'supabase',
      'leak',
      'security',
      'vulnerability'
    ],

    router: [
      'router',
      'message',
      'command',
      'flow',
      'session'
    ],

    telegram: [
      'telegram',
      'bot'
    ],

    ai: [
      'ai',
      'claude',
      'gemini',
      'prompt',
      'llm'
    ]
  };

  // detect domains
  const matchedDomains = [];

  for (const [
    domain,
    keywords
  ] of Object.entries(
    keywordMap
  )) {
    const matched =
      keywords.some((kw) =>
        t.includes(kw)
      );

    if (matched) {
      matchedDomains.push(
        domain
      );
    }
  }

  // inject registry files
  for (
    const domain of matchedDomains
  ) {
    const files =
      filterFilesForAgent(
        domain,
        agentName
      );

    files.forEach((file) =>
      selected.add(file)
    );
  }

  // =====================
  // CRITICAL OVERRIDES
  // =====================

  // lookup stale context
  if (
    t.includes('lookupflow') ||
    (
      t.includes('lookup') &&
      t.includes('stale')
    )
  ) {
    [
      'src/flows/lookupFlow.js',
      'src/router/messageRouter.js',
      'src/handlers/message.js'
    ].forEach((f) =>
      selected.add(f)
    );
  }

  // OCR parsing
  if (
    t.includes('ocr') ||
    t.includes('receipt') ||
    t.includes('struk')
  ) {
    [
      'src/flows/ocrFlow.js',
      'src/flows/ocrSessionFlow.js',
      'src/services/claude.js',
      'src/config/app.js'
    ].forEach((f) =>
      selected.add(f)
    );
  }

  // Supabase audit
  if (
    t.includes('supabase')
  ) {
    [
      'src/services/database.js',
      '.env.example',
      'src/config'
    ].forEach((f) =>
      selected.add(f)
    );
  }

  // Google Sheet sync
  if (
    t.includes('google') ||
    t.includes('sheet') ||
    t.includes('sync')
  ) {
    [
      'src/services/googleSheet.js',
      'src/flows/transactionFlow.js',
      'src/handlers/edit.js',
      'src/flows/ocrSessionFlow.js'
    ].forEach((f) =>
      selected.add(f)
    );
  }

  // One-hop dependency expansion
  // Scans selected files for local require() calls
  // and auto-adds missing transitive dependencies
  const frozen = [...selected];

  for (const filePath of frozen) {
    const absPath =
      path.join(
        process.cwd(),
        filePath
      );

    if (
      !fs.existsSync(absPath)
    ) {
      continue;
    }

    try {
      const content =
        fs.readFileSync(
          absPath,
          'utf8'
        );

      const depRe =
        /require\(\s*['"]((\.\.?\/)[^'"]+)['"]\s*\)/g;

      let match;

      while (
        (match =
          depRe.exec(content)) !==
        null
      ) {
        const relPath =
          match[1];
        const dir =
          path.dirname(filePath);

        const resolved =
          path
            .normalize(
              path.join(
                dir,
                relPath
              )
            )
            .replace(/\\/g, '/');

        const candidate =
          resolved.endsWith('.js')
            ? resolved
            : resolved + '.js';

        if (
          !selected.has(
            candidate
          ) &&
          fs.existsSync(
            path.join(
              process.cwd(),
              candidate
            )
          )
        ) {
          selected.add(
            candidate
          );
          continue;
        }

        const candidateIdx =
          resolved + '/index.js';

        if (
          !selected.has(
            candidateIdx
          ) &&
          fs.existsSync(
            path.join(
              process.cwd(),
              candidateIdx
            )
          )
        ) {
          selected.add(
            candidateIdx
          );
        }
      }
    } catch (_) {
      // skip unreadable files
    }
  }

  return [...selected];
}

function filterFilesForAgent(
  domain,
  agentName
) {
  const files =
    registry[domain] || [];

  // no agent context
  if (!agentName) {
    return files;
  }

  const rules = {
    maze: {
      remove: [
        '.env',
        'readme'
      ]
    },

    sega: {
      remove: [
        '.env'
      ]
    },

    aegis: {
      keepOnly: [
        'auth',
        'database',
        'supabase',
        '.env',
        'middleware',
        'security',
        'config'
      ]
    },

    nami: {
      keepOnly: [
        'ocr',
        'claude',
        'finance',
        'sheet',
        'transaction',
        'parser'
      ]
    }
  };

  const rule =
    rules[agentName];

  if (!rule) {
    return files;
  }

  // keepOnly
  if (rule.keepOnly) {
    const filtered =
      files.filter((file) =>
        rule.keepOnly.some(
          (kw) =>
            file
              .toLowerCase()
              .includes(kw)
        )
      );

    // fallback:
    // never return empty
    return filtered.length
      ? filtered
      : files;
  }

  // remove
  if (rule.remove) {
    return files.filter(
      (file) =>
        !rule.remove.some(
          (kw) =>
            file
              .toLowerCase()
              .includes(kw)
        )
    );
  }

  return files;
}

module.exports = {
  selectFiles
};
