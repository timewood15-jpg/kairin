const fs = require('fs');
const path = require('path');

function loadPersona(agentName) {
  const personaPath = path.join(
    process.cwd(),
    'agents',
    'personas',
    `${agentName}.md`
  );

  if (!fs.existsSync(personaPath)) {
    throw new Error(`Persona not found: ${agentName}`);
  }

  return fs.readFileSync(personaPath, 'utf8');
}

module.exports = {
  loadPersona
};