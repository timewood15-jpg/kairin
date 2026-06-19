'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Timestamp format: YYYYMMDD-HHmmss
 * Example: 20260618-160001
 */
function timestamp() {
  const now = new Date();

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

/**
 * Backup directory resolved relative to this module's location:
 *   agents/runtime/backupManager.js → agents/backups/
 */
function backupDir() {
  return path.join(__dirname, '..', 'backups');
}

/**
 * createBackup — copies a file to agents/backups/ with a timestamp suffix.
 * Read-only on the target; creates only the backup file.
 * Guarantees unique filenames: if the generated path already exists,
 * appends a counter (-1, -2, etc.) before .bak.
 *
 * @param {string} filePath  Path to the file to back up
 * @returns {{ success: boolean, original: ?string, backup: ?string, error: ?string }}
 */
function createBackup(filePath) {
  // Resolve and validate target
  const resolved = path.resolve(filePath);

  if (!resolved) {
    return { success: false, original: null, backup: null, error: 'File path must be a non-empty string' };
  }

  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      original: resolved,
      backup: null,
      error: `Target file not found: ${resolved}`
    };
  }

  // Stat the file to confirm it's a regular file (not a directory)
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (err) {
    return {
      success: false,
      original: resolved,
      backup: null,
      error: `Cannot stat target file: ${err.message}`
    };
  }

  if (!stat.isFile()) {
    return {
      success: false,
      original: resolved,
      backup: null,
      error: `Target is not a regular file: ${resolved}`
    };
  }

  // Ensure backup directory exists
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });

  // Build backup filename: <basename>.<timestamp>.bak
  // Guarantee uniqueness with counter suffix when there's a collision
  const basename = path.basename(resolved);
  const ts = timestamp();

  let backupPath;
  let counter = 0;

  while (true) {
    const suffix = counter === 0 ? '' : `-${counter}`;
    const backupName = `${basename}.${ts}${suffix}.bak`;
    backupPath = path.join(dir, backupName);

    if (!fs.existsSync(backupPath)) break;
    counter++;
  }

  // Copy the file (atomic on most platforms)
  try {
    fs.copyFileSync(resolved, backupPath);
  } catch (err) {
    return {
      success: false,
      original: resolved,
      backup: backupPath,
      error: `Failed to create backup: ${err.message}`
    };
  }

  return {
    success: true,
    original: resolved,
    backup: backupPath
  };
}

module.exports = { createBackup };