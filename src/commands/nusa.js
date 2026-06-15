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
        '/nusa audit <task>',
        '/nusa apply',
        '/nusa cancel'
      ].join('\n')
    );
  }

  // =====================
  // APPLY MODE
  // =====================
  if (
    /^apply$/i.test(task)
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

    return runHermes(
      bot,
      chatId,
      `apply "${pending}"`,
      pending
    );
  }

  // =====================
  // CANCEL MODE
  // =====================
  if (
    /^cancel$/i.test(task)
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
  // AUDIT MODE
  // =====================
  const isAudit =
    /^audit\s+/i.test(
      task
    );

  const cleanedTask =
    task.replace(
      /^audit\s+/i,
      ''
    ).trim();

  // save pending task
  pendingTasks.set(
    chatId,
    cleanedTask
  );

  return runHermes(
    bot,
    chatId,
    isAudit
      ? `audit "${cleanedTask}"`
      : `"${cleanedTask}"`,
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