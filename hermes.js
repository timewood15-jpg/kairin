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
node hermes.js quick-fix "<task>"
node hermes.js audit "<task>"
node hermes.js apply "<task>"

Examples:
node hermes.js quick "Fix lookupFlow stale context bug"
node hermes.js audit "Audit Supabase token leak"
node hermes.js apply "Refactor duplicated Google Sheet sync"
`);

    return;
  }

  let mode =
    'quick';

  let task =
    '';

  const firstArg =
    args[0]
      .toLowerCase();

  // explicit mode
  if (
    [
      'quick',
      'quick-fix',
      'audit',
      'apply'
    ].includes(
      firstArg
    )
  ) {

    mode =
      firstArg;

    task =
      args
        .slice(1)
        .join(' ')
        .trim();

  } else {

    // fallback
    task =
      args
        .join(' ')
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

    // AUDIT MODE
    if (
      mode ===
      'audit'
    ) {

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
    }

    // APPLY MODE (DRY RUN)
    else if (
      mode ===
      'apply'
    ) {

      output =
        await orchestrate(
          task,
          {
            patchMode:
              true
          }
        );

      console.log(
        '\n========================'
      );

      console.log(
        '⚕ APPLY REPORT'
      );

      console.log(
        '========================\n'
      );

      console.log(
        output.finalReport
      );
    }

    // QUICK / QUICK-FIX
    else {

      const result =
        await quickSolve(
          task,
          {
            patchMode:
              mode ===
              'quick-fix'
          }
        );

      console.log(
        result
      );
    }

  } catch (err) {

    console.error(
      '\n❌ HERMES ERROR:\n'
    );

    console.error(
      err
    );
  }
}

main();