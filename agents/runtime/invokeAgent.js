const fs = require('fs');
const path = require('path');
require('dotenv').config();

const {
  loadPersona
} = require('./loadPersona');

const {
  loadRepoContext
} = require('./loadRepoContext');

const escalationRules =
  require('../config/escalationRules.json');

const registry =
  require('../config/modelRegistry.json');

async function invokeAgent(
  agentName,
  task,
  files = []
) {
  let config =
    { ...registry[agentName] };

  config.model =
    selectModel(
      agentName,
      task,
      config.model
    );

  if (!config) {
    throw new Error(
      `Unknown agent: ${agentName}`
    );
  }

  const persona =
    loadPersona(agentName);

  const repoContext =
    loadRepoContext(files);

  // only load project context
  // when actually useful
  const projectContext =
    shouldLoadProjectContext(
      agentName
    )
      ? loadProjectContext()
      : '';

  const systemPrompt = buildPrompt({
    projectContext,
    persona,
    repoContext
  });

  console.log(
  '[AGENT]',
  agentName,
  config.model
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
          model: config.model,
          temperature:
            config.temperature,
          messages: [
            {
              role: 'system',
              content:
                systemPrompt
            },
            {
              role: 'user',
              content: task
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

  return data.choices?.[0]
    ?.message?.content;
}

function shouldLoadProjectContext(
  agentName
) {
  // only agents that need
  // broader business context
  return [
    'nusa',
    'nami'
  ].includes(agentName);
}

function buildPrompt({
  projectContext,
  persona,
  repoContext
}) {
  return `
${projectContext}

${persona}

Repository context:

${repoContext}
`;
}

function loadProjectContext() {
  const contextPath =
    path.join(
      process.cwd(),
      'agents',
      'context',
      'kairin-project.md'
    );

  if (
    !fs.existsSync(
      contextPath
    )
  ) {
    return '';
  }

  return fs.readFileSync(
    contextPath,
    'utf8'
  );
}

function selectModel(
  agentName,
  task,
  defaultModel
) {
  const rule =
    escalationRules[agentName];

  if (!rule) {
    return defaultModel;
  }

  const rawTask =
  String(task || '')
    .split('task:')
    .pop()
    .trim()
    .toLowerCase();

const matchedKeyword =
  rule.heavyKeywords.find(
    (keyword) =>
      rawTask.includes(
        keyword.toLowerCase()
      )
  );

  const shouldEscalate =
    !!matchedKeyword;

  console.log(
  '[MODEL]',
  agentName,
  {
    rawTask,
    matchedKeyword,
    shouldEscalate,
    fallback:
      rule.fallbackModel,
    escalated:
      rule.escalatedModel
  }
);

  return shouldEscalate
    ? rule.escalatedModel
    : rule.fallbackModel;
}

module.exports = {
  invokeAgent,
  loadProjectContext,
  selectModel
};