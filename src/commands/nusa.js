const { exec } =
  require('child_process');

const path =
  require('path');

const activeJobs =
  new Set();

const pendingTasks =
  new Map();

const ALLOWED_USERS =
[
  1021505730
];

// ── Runtime managers (reused, not recreated) ──────────────────────────
const proposalManager =
  require('../../agents/runtime/proposalManager');

const {
  runGate
} = require('../../agents/runtime/reviewManager');

const {
  applyProposal
} = require('../../agents/runtime/applyManager');

const PROPOSAL_ROOT =
  path.join(__dirname, '../../agents/proposals');

async function handleNusa(
  bot,
  chatId,
  user,
  text
) {

  // whitelist
  if (
    !ALLOWED_USERS.includes(
      user.telegram_id
    )
  ) {
    return bot.sendMessage(
      chatId,
      '⛔ Unauthorized'
    );
  }

  const task =
    text.replace(
      /^\/nusa\s*/i,
      ''
    ).trim();

  if (!task) {
    return bot.sendMessage(
      chatId,
      [
        'Usage:',
        '/nusa investigate <tujuan>',
        '/nusa review',
        '/nusa apply',
        '/nusa apply --write',
        '/nusa status',
        '/nusa audit <task>',
        '/nusa cancel'
      ].join('\n')
    );
  }

  // =====================
  // INVESTIGATE MODE
  // =====================
  console.log('[NUSA DEBUG] handleNusa ENTERED — text:', text, '| task:', task);

  if (
    /^investigate\s+/i.test(task)
  ) {
    console.log('[NUSA DEBUG] investigate MATCHED');
    const description =
      task.replace(
        /^investigate\s+/i,
        ''
      ).trim();

    if (!description) {
      console.log('[NUSA DEBUG] description empty, returning usage');
      return bot.sendMessage(
        chatId,
        'Usage: /nusa investigate <deskripsi>'
      );
    }

    // Generate a simple ID from the description
    const id =
      description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

    const proposal = {
      id,
      title: description,
      status: 'pending',
      files: ['src/placeholder.js'],
      winner: 'investigate',
      patch: {
        file: 'src/placeholder.js',
        goal: `Investigate: ${description}`,
        changes: []
      }
    };

    console.log('[NUSA DEBUG] proposal GENERATED — id:', proposal.id);

    try {
      const targetDir = path.join(PROPOSAL_ROOT, 'pending');
      console.log('[NUSA DEBUG] saveProposal CALLED — target:', targetDir);

      const saved =
        proposalManager.saveProposal(
          targetDir,
          proposal
        );

      console.log('[NUSA DEBUG] saveProposal RETURNED — saved path:', saved);

      return bot.sendMessage(
        chatId,
        [
          `✅ Proposal dibuat:`,
          `${path.basename(saved)}`,
          '',
          `Gunakan /nusa review untuk review.`
        ].join('\n')
      );
    } catch (err) {
      console.log('[NUSA DEBUG] saveProposal THREW —', err.message);
      return bot.sendMessage(
        chatId,
        `❌ Gagal membuat proposal: ${err.message}`
      );
    }
  }

  // =====================
  // REVIEW MODE
  // =====================
  console.log('[NUSA DEBUG] not investigate, task:', task);

  if (
    /^review\b/i.test(task)
  ) {
    const pending =
      proposalManager.getPending();

    if (!pending.length) {
      return bot.sendMessage(
        chatId,
        '📭 Tidak ada proposal pending.'
      );
    }

    // Review the first pending proposal
    const proposal = pending[0];
    const gate = runGate(proposal);

    if (!gate.approved) {
      // Move to rejected
      try {
        proposalManager.rejectProposal(proposal.id);
      } catch (_) {}

      return bot.sendMessage(
        chatId,
        [
          `❌ Proposal "${proposal.id}" ditolak.`,
          '',
          gate.issues.length
            ? `Issues:\n${gate.issues.map(i => `• ${i}`).join('\n')}`
            : '',
          gate.warnings.length
            ? `Warnings:\n${gate.warnings.map(w => `• ${w}`).join('\n')}`
            : ''
        ].filter(Boolean).join('\n')
      );
    }

    // Move to approved
    try {
      proposalManager.approveProposal(proposal.id);

      return bot.sendMessage(
        chatId,
        [
          `✅ Proposal "${proposal.id}" approved.`,
          '',
          gate.warnings.length
            ? `Warnings:\n${gate.warnings.map(w => `• ${w}`).join('\n')}`
            : '',
          '',
          `Gunakan /nusa apply untuk preview.`
        ].filter(Boolean).join('\n')
      );
    } catch (err) {
      return bot.sendMessage(
        chatId,
        `❌ Gagal approve proposal: ${err.message}`
      );
    }
  }

  // =====================
  // STATUS MODE
  // =====================
  console.log('[NUSA DEBUG] not review, task:', task);

  if (
    /^status\b/i.test(task)
  ) {
    const pending =
      proposalManager.getPending();

    const approved =
      proposalManager.getApproved();

    // Get applied & rejected by reading dirs directly
    let applied = [];
    let rejected = [];

    try {
      const fs = require('fs');
      applied = fs
        .readdirSync(path.join(PROPOSAL_ROOT, 'applied'))
        .filter(f => f.endsWith('.json'));
    } catch (_) {}

    try {
      const fs = require('fs');
      rejected = fs
        .readdirSync(path.join(PROPOSAL_ROOT, 'rejected'))
        .filter(f => f.endsWith('.json'));
    } catch (_) {}

    const lines = ['📋 Nusa Status', ''];

    lines.push(
      `📌 Pending: ${pending.length}`
    );
    pending.forEach(p =>
      lines.push(`  • ${p.id}: ${p.title || '-'}`.slice(0, 80))
    );

    lines.push('');
    lines.push(
      `✅ Approved: ${approved.length}`
    );
    approved.forEach(a =>
      lines.push(`  • ${a.id}: ${a.title || '-'}`.slice(0, 80))
    );

    lines.push('');
    lines.push(
      `🔧 Applied: ${applied.length}`
    );
    applied.forEach(a => lines.push(`  • ${a.replace('.json', '')}`));

    lines.push('');
    lines.push(
      `🗑 Rejected: ${rejected.length}`
    );
    rejected.forEach(r => lines.push(`  • ${r.replace('.json', '')}`));

    return bot.sendMessage(
      chatId,
      lines.join('\n')
    );
  }

  // =====================
  // APPLY MODE (proposal-based)
  // =====================
  console.log('[NUSA DEBUG] not status, task:', task);

  if (
    /^apply\b/i.test(task)
  ) {
    const writeFlag =
      /--write\b/i.test(task);

    const proposal =
      proposalManager.getLatestApproved();

    if (!proposal) {
      return bot.sendMessage(
        chatId,
        '📭 Tidak ada proposal approved. Jalankan /nusa review dulu.'
      );
    }

    if (writeFlag) {
      // ── WRITE MODE ────────────────────────────────────────────
      const result =
        await applyProposal(
          proposal,
          { write: true }
        );

      if (!result.success) {
        return bot.sendMessage(
          chatId,
          [
            `❌ Gagal apply "${proposal.id}":`,
            `Stage: ${result.stage}`,
            result.error || 'Unknown error'
          ].join('\n')
        );
      }

      // Mark as applied
      try {
        proposalManager.markApplied(proposal.id);
      } catch (_) {}

      const diffLines =
        (result.diff?.diff || '')
          .split('\n')
          .slice(0, 30)
          .join('\n');

      return bot.sendMessage(
        chatId,
        [
          `✅ Applied: "${proposal.id}"`,
          `File: ${result.targetFile}`,
          `Changes: +${result.diff?.added || 0} / -${result.diff?.removed || 0}`,
          `Backup: ${result.backup?.backup || '-'}`,
          '',
          '```',
          diffLines,
          '```'
        ].join('\n')
      );
    }

    // ── PREVIEW MODE (default) ──────────────────────────────────
    const result =
      await applyProposal(
        proposal,
        { write: false }
      );

    if (!result.success) {
      return bot.sendMessage(
        chatId,
        [
          `❌ Preview failed "${proposal.id}":`,
          `Stage: ${result.stage}`,
          result.error || 'Unknown error'
        ].join('\n')
      );
    }

    const diffLines =
      (result.diff?.diff || '')
        .split('\n')
        .slice(0, 25)
        .join('\n');

    return bot.sendMessage(
      chatId,
      [
        `📋 Preview: "${proposal.id}"`,
        `File: ${result.targetFile}`,
        `Changes: +${result.diff?.added || 0} / -${result.diff?.removed || 0}`,
        '',
        '```',
        diffLines,
        '```',
        '',
        `Untuk apply, jalankan:`,
        `/nusa apply --write`
      ].join('\n')
    );
  }

  // =====================
  // LEGACY: APPLY via child_process
  // =====================
  console.log('[NUSA DEBUG] not apply, task:', task);

  if (
    /^apply-hermes\b/i.test(task)
  ) {

    const pending =
      pendingTasks.get(
        chatId
      );

    if (!pending) {
      return bot.sendMessage(
        chatId,
        '⚠️ Tidak ada pending task.'
      );
    }

      await bot.sendMessage(
    chatId,
    `⚙️ Applying:\n${JSON.stringify(
  pending
)}`
  );

    return runHermes(
      bot,
      chatId,
      `apply "${JSON.stringify(
  pending
)}"`,
      pending
    );
  }

  // =====================
  // CANCEL MODE
  // =====================
  console.log('[NUSA DEBUG] not apply-hermes, task:', task);

  if (
    /^cancel\b/i.test(task)
  ) {

    pendingTasks.delete(
      chatId
    );

    return bot.sendMessage(
      chatId,
      '🗑 Pending task dibatalkan.'
    );
  }

  // =====================
  // AUDIT MODE (legacy)
  // =====================
  console.log('[NUSA DEBUG] no subcommand matched, routing to runHermes. task:', task);

  const isAudit =
    /^audit\s+/i.test(
      task
    );

  const cleanedTask =
    task.replace(
      /^audit\s+/i,
      ''
    ).trim();

  return runHermes(
  bot,
  chatId,
  isAudit
    ? `audit ${JSON.stringify(
        cleanedTask
      )}`
    : JSON.stringify(
        cleanedTask
      ),
  cleanedTask
);
}

async function runHermes(
  bot,
  chatId,
  commandArg,
  taskLabel
) {

  if (
    activeJobs.has(chatId)
  ) {
    return bot.sendMessage(
      chatId,
      '⚠️ Nusa masih bekerja.'
    );
  }

  activeJobs.add(chatId);

  await bot.sendMessage(
    chatId,
    '⚕ Nusa sedang berpikir...'
  );

  const hermesPath =
    path.resolve(
      __dirname,
      '../../hermes.js'
    );

  const command =
    `node "${hermesPath}" ${commandArg}`;

  console.log(
    'NUSA CMD:',
    command
  );

  exec(
    command,
    {
      cwd:
        process.cwd(),

      maxBuffer:
        1024 * 1024 * 10,

      timeout:
        1000 * 60 * 5
    },

    async (
      err,
      stdout,
      stderr
    ) => {

      try {

        if (
          stderr?.trim()
        ) {
          console.log(
            'NUSA STDERR:',
            stderr
          );
        }

        if (err) {

          const msg =
            err.killed
              ? '⏰ Hermes timeout (5 menit)'
              : err.message;

          return bot.sendMessage(
            chatId,
            `❌ Hermes error:\n${msg}`
          );
        }

        let cleaned =
          stdout
            .replace(
              /\[dotenv.*\n/g,
              ''
            )
            .trim();

        const reportIndex =
          cleaned.indexOf(
            '## Findings'
          );

        if (
          reportIndex !== -1
        ) {
          cleaned =
            cleaned.slice(
              reportIndex
            );
        }

        if (!cleaned) {
          return bot.sendMessage(
            chatId,
            '⚠️ Hermes tidak mengembalikan output.'
          );
        }

        if (
  commandArg.startsWith(
    'audit'
  )
) {
  pendingTasks.set(
    chatId,
    taskLabel
  );
}

        const chunkSize =
          3500;

        for (
          let i = 0;
          i < cleaned.length;
          i += chunkSize
        ) {
          await bot.sendMessage(
            chatId,
            cleaned.slice(
              i,
              i + chunkSize
            )
          );
        }

        // hint apply
        if (
          commandArg.startsWith(
            'audit'
          )
        ) {
          await bot.sendMessage(
            chatId,
            [
              '📌 Pending task disimpan.',
              'Jika ingin lanjut:',
              '/nusa apply',
              '',
              'Untuk batal:',
              '/nusa cancel'
            ].join('\n')
          );
        }

      } catch (sendErr) {

        console.error(
          'NUSA SEND ERROR:',
          sendErr
        );

        await bot.sendMessage(
          chatId,
          '❌ Gagal mengirim hasil Nusa.'
        );

      } finally {

        activeJobs.delete(
          chatId
        );
      }
    }
  );
}

module.exports = {
  handleNusa
};