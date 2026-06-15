const fs = require('fs');
const path = require('path');

const MAX_FILE_CHARS = 6000;
const MAX_FILE_CHARS_DEFAULT = 4000;

const CRITICAL_FILES = new Set([
  'src/flows/lookupFlow.js',
  'src/flows/ocrFlow.js',
  'src/flows/ocrSessionFlow.js',
  'src/services/claude.js',
  'src/router/messageRouter.js',
  'src/bot.js',
]);

function loadRepoContext(
  paths = []
) {
  let output = '';

  for (
    const filePath of paths
  ) {
    const absolutePath =
      path.join(
        process.cwd(),
        filePath
      );

    if (
      !fs.existsSync(
        absolutePath
      )
    ) {
      continue;
    }

    try {
      let content =
        fs.readFileSync(
          absolutePath,
          'utf8'
        );

      // adaptive truncation
      const maxChars =
        CRITICAL_FILES.has(filePath)
          ? MAX_FILE_CHARS
          : MAX_FILE_CHARS_DEFAULT;

      if (
        content.length >
        maxChars
      ) {
        content =
          content.slice(
            0,
            maxChars
          );

        content +=
          '\n\n/* FILE TRUNCATED */';
      }

      output += `
FILE: ${filePath}

\`\`\`js
${content}
\`\`\`

`;
    } catch (err) {
      output += `
FILE: ${filePath}

ERROR:
${err.message}

`;
    }
  }

  return output;
}

module.exports = {
  loadRepoContext
};