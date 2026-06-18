const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PENDING = path.join(ROOT, 'proposals', 'pending');
const APPROVED = path.join(ROOT, 'proposals', 'approved');

const APPLIED = path.join(ROOT, 'proposals', 'applied');
const REJECTED = path.join(ROOT, 'proposals', 'rejected');

function loadProposal(file) {
  try {
    return JSON.parse(
      fs.readFileSync(file, 'utf8')
    );
  } catch (err) {
    throw new Error(
      `Failed to load proposal: ${file}`
    );
  }
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

function moveProposal(id, fromDir, toDir) {
  const oldPath = path.join(fromDir, `${id}.json`);
  const newPath = path.join(toDir, `${id}.json`);

  if (!fs.existsSync(oldPath)) {
    throw new Error(
      `Proposal not found: ${id}`
    );
  }

  fs.renameSync(oldPath, newPath);

  return newPath;
}
function getPending() {
  return fs
    .readdirSync(PENDING)
    .filter(f => f.endsWith('.json'))
    .map(f =>
      loadProposal(
        path.join(PENDING, f)
      )
    );
}

function getApproved() {
  return fs
    .readdirSync(APPROVED)
    .filter(f => f.endsWith('.json'))
    .map(f =>
      loadProposal(
        path.join(APPROVED, f)
      )
    );
}

function approveProposal(id) {
  return moveProposal(
    id,
    PENDING,
    APPROVED
  );
}

function rejectProposal(id) {
  return moveProposal(
    id,
    PENDING,
    REJECTED
  );
}

function markApplied(id) {
  return moveProposal(
    id,
    APPROVED,
    APPLIED
  );
}

function getLatestApproved() {
  const files = fs
    .readdirSync(APPROVED)
    .filter(f => f.endsWith('.json'));

  if (!files.length) return null;

  const latest = files
    .map(file => ({
      file,
      time: fs.statSync(
        path.join(APPROVED, file)
      ).mtimeMs
    }))
    .sort((a, b) => b.time - a.time)[0];

  return loadProposal(
    path.join(APPROVED, latest.file)
  );
}

module.exports = {
  loadProposal,
  saveProposal,
  moveProposal,
  getPending,
  getApproved,
  approveProposal,
  rejectProposal,
  markApplied,
  getLatestApproved
};