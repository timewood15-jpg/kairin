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

const MAX_RETRY =
  1;

async function orchestrate(
  task,
  options = {}
) {

  const {
    patchMode = false
  } = options;

  // apply mode
  if (patchMode) {
    task = `
PATCH MODE ENABLED

Task:
${task}

Rules:
- choose safest proposal
- prefer minimal diff
- produce exact patch
- include validation plan
- no commit
- no push
`;
  }

  const selectedAgents =
    selectAgents(task);

  const results =
    {};

  console.log(
    '\n⚕ Nusa Orchestrator\n'
  );

  console.log(
    'Selected specialists:'
  );

  selectedAgents.forEach(
    (a) =>
      console.log(
        `✓ ${a}`
      )
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
            selectFiles(
              task,
              agent
            );

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
            retry <
            MAX_RETRY;
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

            const extraFiles =
              [

                ...selectFiles(
                  response,
                  agent
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

            if (
              !hasNewFiles
            ) {
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

          results[
            agent
          ] =
            response;

        } catch (
          err
        ) {

          results[
            agent
          ] =
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

module.exports = {
  orchestrate,
  enrichTask,
  extractRequestedFiles
};