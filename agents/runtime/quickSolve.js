require('dotenv').config();

const {
  selectFiles
} = require('./selectFiles');

const {
  loadRepoContext
} = require('./loadRepoContext');

async function quickSolve(
  task,
  options = {}
) {
  const files =
    selectFiles(task);

   const {
     patchMode = false
   } = options;

  const repoContext =
    loadRepoContext(
      files
    );

  const response =
    await fetch(
      `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${process.env.OPENROUTER_API_KEY}`,

          'Content-Type':
            'application/json',

          'HTTP-Referer':
            'https://kairin.local',

          'X-Title':
            'Kairin Hermes'
        },

        body: JSON.stringify({
          model:
            'openai/gpt-5-mini',

          temperature: 0.1,

          messages: [
            {
              role:
                'system',

              content: `
You are Hermes Quick Engineer.

You are working inside
the Kairin codebase.

Mission:
Solve engineering problems quickly.

Rules:
- Minimal diff first
- Preserve backward compatibility
- Read-only before patch
- Never hallucinate framework
- MUST prioritize repository context

${
  patchMode
    ? `
PATCH MODE ENABLED.

Output format:

## Root Cause
...

## Risk
Low / Medium / High

## Minimal Patch

Return EXACT code patch.

Rules:
- minimal diff only
- no rewrite
- preserve architecture
- include exact file path
- prefer unified diff format
`
    : `

CRITICAL RULES:
- NEVER assume architecture
- Verify current implementation first
- If uncertain, mark as hypothesis
- Only patch code visible in repository context
- Never invent object shape

Output format:

## Findings
...

## Recommendation
...
`
}

Repository context:

${repoContext}
`
            },

            {
              role:
                'user',

              content:
                task
            }
          ]
        })
      }
    );

  if (!response.ok) {
    const err =
      await response.text();

    throw new Error(err);
  }

  const data =
    await response.json();

  return data
    .choices?.[0]
    ?.message?.content;
}

module.exports = {
  quickSolve
};