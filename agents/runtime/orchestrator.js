const {
  selectFiles
} = require('./selectFiles');

const {
  synthesizeResults
} = require('./synthesizeResults');

const {
  selectAgents
} = require('./selectAgents');

const {
  invokeAgent
} = require('./invokeAgent');

const MAX_RETRY = 1;

async function orchestrate(task) {
  const selectedAgents =
    selectAgents(task);

  const results = {};

  console.log(
    '\n⚕ Nusa Orchestrator\n'
  );

  console.log(
    'Selected specialists:'
  );

  selectedAgents.forEach((a) =>
    console.log(`✓ ${a}`)
  );

  console.log('');

  // parallel execution
  await Promise.all(
    selectedAgents.map(
      async (agent) => {
        try {
          console.log(
            `Running ${agent}...\n`
          );

          // initial file selection
          let relevantFiles =
            selectFiles(task);

          // enrich using current files
          let enrichedTask =
            enrichTask(
              task,
              relevantFiles
            );

          let response =
            await invokeAgent(
              agent,
              enrichedTask,
              relevantFiles
            );

          // retry with more files
          for (
            let retry = 0;
            retry < MAX_RETRY;
            retry++
          ) {
            if (
              !shouldRetryWithMoreFiles(
                response
              )
            ) {
              break;
            }

            console.log(
              `↻ ${agent} requesting more context...`
            );

            const extraFiles = [
              ...selectFiles(
                response
              ),

              ...extractRequestedFiles(
                response
              )
            ];

            const mergedFiles =
              [
                ...new Set([
                  ...relevantFiles,
                  ...extraFiles
                ])
              ];

            // stop if no new files
            const hasNewFiles =
              mergedFiles.length >
              relevantFiles.length;

            if (!hasNewFiles) {
              break;
            }

            relevantFiles =
              mergedFiles;

            // rebuild enriched task
            enrichedTask =
              enrichTask(
                task,
                relevantFiles
              );

            response =
              await invokeAgent(
                agent,
                enrichedTask,
                relevantFiles
              );
          }

          results[agent] =
            response;

        } catch (err) {
          results[agent] =
            `ERROR: ${err.message}`;
        }
      }
    )
  );

  const finalReport =
    await synthesizeResults(
      task,
      results
    );

  return {
    selectedAgents,
    results,
    finalReport
  };
}

function shouldRetryWithMoreFiles(
  response = ''
) {
  const text =
    response.toLowerCase();

  return [
    'need file',
    'need files',
    'missing file',
    'missing files',

    'requires inspecting',
    'requires inspection',

    'requires access',
    'need access',
    'requesting files',

    'requires additional files',
    'need additional files',

    'unable to verify',
    'cannot verify',

    'pending further inspection',

    'specific files',
    'inspect additional',
    'provide files',
    'requires more context'
  ].some((keyword) =>
    text.includes(keyword)
  );
}

function enrichTask(
  task,
  relevantFiles = []
) {
  const lower =
    task.toLowerCase();

  const fileHint =
    relevantFiles.length
      ? `
Repository files included:

${relevantFiles.join('\n')}

Critical Rules:
- Analyze ONLY provided repository files.
- Never assume missing code exists.
- Never invent implementation details.
- If evidence incomplete:
  mark as "unverified suspicion".
- If repo state unclear:
  prefer NO CHANGE.
`
      : `
Repository context may be incomplete.

Critical Rules:
- Never assume code exists.
- If evidence incomplete:
  mark as "unverified suspicion".
`;

  // historical lookup bug
  if (
    lower.includes(
      'lookupflow'
    ) &&
    lower.includes(
      'stale'
    )
  ) {
    return `
${fileHint}

Historical bug context:

Observed bug:
1. User:
"Saya pernah makan nasi padang?"

2. User:
"Jadi banyak pengeluaran daripada pemasukan?"

3. User:
"Detailnya"

Wrong behavior:
Old lookupContext hijacked
previous transaction.

Historical patch:
clearLookupContext(user.id)
on non-follow-up message.

Critical Rule:
VERIFY CURRENT IMPLEMENTATION.
Never assume bug still exists.

Task:
${task}
`;
  }

  return `
${fileHint}

Task:
${task}
`;
}

function extractRequestedFiles(
  response = ''
) {
  const text =
    response.toLowerCase();

  const inferred = [];

  const fileHints = {
    '.env': [
      '.env',
      '.env.example'
    ],

    auth: [
      'src/auth',
      'src/services/auth.js',
      'src/middleware'
    ],

    supabase: [
      'src/services/database.js',
      'src/services/supabase.js'
    ],

    route: [
      'src/routes',
      'src/router'
    ],

    config: [
      'next.config.js',
      'src/config'
    ],

    client: [
      'src/client',
      'src/frontend'
    ]
  };

  for (const [
    keyword,
    files
  ] of Object.entries(
    fileHints
  )) {
    if (
      text.includes(keyword)
    ) {
      inferred.push(
        ...files
      );
    }
  }

  return [
    ...new Set(inferred)
  ];
}

module.exports = {
  orchestrate,
  enrichTask,
  extractRequestedFiles
};
