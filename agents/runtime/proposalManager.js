const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PENDING = path.join(ROOT, 'proposals', 'pending');
const APPROVED = path.join(ROOT, 'proposals', 'approved');

const APPLIED = path.join(ROOT, 'proposals', 'applied');
const REJECTED = path.join(ROOT, 'proposals', 'rejected');

// ── Directory auto-creation ──────────────────────────────────────────
const ALL_DIRS = [PENDING, APPROVED, APPLIED, REJECTED];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── Load ──────────────────────────────────────────────────────────────
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

// ── Save ──────────────────────────────────────────────────────────────
function saveProposal(folder, proposal) {
  ensureDir(folder);

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

// ── Move ──────────────────────────────────────────────────────────────
function moveProposal(id, fromDir, toDir) {
  const oldPath = path.join(fromDir, `${id}.json`);
  const newPath = path.join(toDir, `${id}.json`);

  if (!fs.existsSync(oldPath)) {
    throw new Error(
      `Proposal not found: ${id}`
    );
  }

  ensureDir(toDir);
  fs.renameSync(oldPath, newPath);

  return newPath;
}

// ── List (graceful if missing) ────────────────────────────────────────
function getPending() {
  try {
    return fs
      .readdirSync(PENDING)
      .filter(f => f.endsWith('.json'))
      .map(f =>
        loadProposal(
          path.join(PENDING, f)
        )
      );
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function getApproved() {
  try {
    return fs
      .readdirSync(APPROVED)
      .filter(f => f.endsWith('.json'))
      .map(f =>
        loadProposal(
          path.join(APPROVED, f)
        )
      );
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// ── Transitions ───────────────────────────────────────────────────────
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

// ── Latest approved (graceful if missing) ─────────────────────────────
function getLatestApproved() {
  let files;
  try {
    files = fs
      .readdirSync(APPROVED)
      .filter(f => f.endsWith('.json'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }

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