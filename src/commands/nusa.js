const { exec } =
  require('child_process');

const path =
  require('path');

const activeJobs =
  new Set();

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
      'Usage:\n/nusa <task>'
    );
  }

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

  const safeTask =
    task.replace(
      /"/g,
      '\\"'
    );

  // FIX PATH FOR RAILWAY
  const hermesPath =
    path.resolve(
      __dirname,
      '../../hermes.js'
    );

  console.log(
    'NUSA RUN:',
    hermesPath
  );

  const isAudit =
  /^audit\s+/i.test(
    task
  );

const cleanedTask =
  task.replace(
    /^audit\s+/i,
    ''
  );

const command =
  isAudit
    ? `node "${hermesPath}" audit "${cleanedTask}"`
    : `node "${hermesPath}" "${safeTask}"`;

console.log(
  'NUSA CMD:',
  command
);

  exec(command,
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
            );

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

        cleaned =
          cleaned.trim();

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