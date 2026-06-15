require('dotenv').config();

const {
  orchestrate
} = require(
  './agents/runtime/orchestrator'
);

const {
  quickSolve
} = require(
  './agents/runtime/quickSolve'
);

async function main() {
  const args =
    process.argv.slice(2);

  if (!args.length) {
    console.log(`
Usage:

node hermes.js quick "<task>"
node hermes.js audit "<task>"

Examples:
node hermes.js quick "Fix lookupFlow stale context bug"
node hermes.js audit "Audit Supabase token leak"
`);
    return;
  }

  let mode = 'audit';
  let task = '';

  const firstArg =
    args[0].toLowerCase();

  // explicit mode
  if (
    ['quick', 'quick-fix', 'audit']
      .includes(firstArg)
  ) {
    mode = firstArg;
    task =
      args.slice(1)
        .join(' ')
        .trim();
  } else {
    // fallback default
    task =
      args.join(' ')
        .trim();
  }

  if (!task) {
    console.log(
      'Task required.'
    );
    return;
  }

  try {
    console.log(
      `\n⚕ Hermes (${mode.toUpperCase()})\n`
    );

    let output;

    if (mode === 'audit') {
      output =
        await orchestrate(
          task
        );

      console.log(
        '\n========================'
      );

      console.log(
        '⚕ FINAL REPORT'
      );

      console.log(
        '========================\n'
      );

      console.log(
        output.finalReport
      );

    } else {
      const result =
        await quickSolve(
          task,
          {
            patchMode:
              mode ===
              'quick-fix'
          }
        );

      console.log(result);
    }

  } catch (err) {
    console.error(
      '\n❌ HERMES ERROR:\n'
    );

    console.error(err);
  }
}

main();