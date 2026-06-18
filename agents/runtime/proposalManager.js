const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PENDING = path.join(ROOT, 'proposals', 'pending');
const APPROVED = path.join(ROOT, 'proposals', 'approved');

function loadProposal(file) {
  return JSON.parse(
    fs.readFileSync(file, 'utf8')
  );
}

function saveProposal(folder, proposal) {
  const file = path.join(
    folder,
    `${proposal.id}.json`
  );

  fs.writeFileSync(
    file,
    JSON.stringify(proposal, null, 2)
  );

  return file;
}

module.exports = {
  loadProposal,
  saveProposal
};