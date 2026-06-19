'use strict';

var fs = require('fs');
var path = require('path');
var { applyProposal } = require('../applyManager');

var BACKUPS_DIR = path.join(__dirname, '..', 'backups');

function testCase(label) {
  console.log('\n' + '='.repeat(60));
  console.log('  TEST: ' + label);
  console.log('='.repeat(60));
}

function printDiff(d) {
  if (!d) { console.log('  diff:      (none)'); return; }
  console.log('  changed:   ' + d.changed);
  console.log('  added:     ' + d.added + '  removed: ' + d.removed);
  if (d.diff) {
    var lines = d.diff.split('\n');
    console.log('  diff:      ' + lines.length + ' hunk lines');
    lines.slice(0, 4).forEach(function (l) { console.log('    ' + l); });
    if (lines.length > 4) console.log('    ...');
  }
}

function cleanup(files) {
  (files || []).forEach(function (p) {
    try { fs.unlinkSync(p); } catch (_) {}
  });
}

// ── Build a proposal targeting auditor.js ──────────────────────
// We'll replace one line: "module.exports = { audit };" with "module.exports = { audit, auditV2 };"
// and add the new function. This is safe — we're using preview mode for TEST 1.
var targetFile = path.resolve('agents/runtime/auditor.js');
var proposal = {
  id: 'apply-test-001',
  title: 'Add auditV2 export to auditor',
  status: 'approved',
  winner: 'fix-audit',
  files: ['agents/runtime/auditor.js'],
  patch: {
    file: 'agents/runtime/auditor.js',
    goal: 'Add auditV2 alias export to auditor module',
    changes: [
      {
        op: 'replace',
        find: 'module.exports = { audit };',
        replace: 'module.exports = { audit, auditV2 };'
      }
    ]
  }
};

// Proposal that fails audit (no patch section)
var badProposal = {
  id: 'apply-test-bad',
  title: 'Bad proposal',
  status: 'pending',
  winner: null,
  files: []
};

// Proposal targeting a file that doesn't exist
var missingFileProposal = {
  id: 'apply-test-missing',
  title: 'Missing file',
  status: 'approved',
  winner: 'fix-missing',
  files: ['agents/runtime/nonexistent.js'],
  patch: {
    file: 'agents/runtime/nonexistent.js',
    goal: 'Fix nonexistent file',
    changes: [{ op: 'append', content: '// test' }]
  }
};

// Track backup files for cleanup
var createdBackups = [];

async function main() {

  // ── TEST 1: Valid proposal, preview mode ──────────────────────
  testCase('1: Valid proposal, preview mode (write=false)');

  // Snapshot original content before the test
  var beforeContent = fs.readFileSync(targetFile, 'utf8');

  var r1 = await applyProposal(proposal, { write: false });

  // Snapshot after (should be unchanged in preview mode)
  var afterContent = fs.readFileSync(targetFile, 'utf8');
  var fileUnchanged = beforeContent === afterContent;

  console.log('  success:    ' + r1.success);
  console.log('  targetFile: ' + r1.targetFile);
  console.log('  backup:     ' + (r1.backup ? r1.backup.backup : '(none)'));
  printDiff(r1.diff);
  console.log('  file unchanged: ' + (fileUnchanged ? '\u2713' : '\u2717'));

  if (r1.backup && r1.backup.backup) createdBackups.push(r1.backup.backup);

  var p1 = r1.success
        && r1.diff !== null
        && r1.diff.changed === true
        && r1.diff.added === 1
        && r1.diff.removed === 1
        && fileUnchanged
        && r1.backup !== null
        && r1.backup.success === true;
  console.log('  Verdict:    ' + (p1 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── TEST 2: Valid proposal, write mode ────────────────────────
  testCase('2: Valid proposal, write mode (write=true)');

  // Create a disposable copy of auditor.js to modify safely
  var scratchName = '_scratch_apply_test.js';
  var scratchRelative = 'agents/backups/' + scratchName;
  var scratchFile = path.resolve(scratchRelative);
  fs.writeFileSync(scratchFile, beforeContent, 'utf8');

  var writeProposal = {
    id: 'apply-test-002',
    title: 'Modify scratch file',
    status: 'approved',
    winner: 'fix-scratch',
    files: [scratchRelative],
    patch: {
      file: scratchRelative,
      goal: 'Add auditV2 export to scratch copy',
      changes: [
        {
          op: 'replace',
          find: 'module.exports = { audit };',
          replace: 'module.exports = { audit, auditV2 };'
        }
      ]
    }
  };

  var r2 = await applyProposal(writeProposal, { write: true });

  console.log('  success:    ' + r2.success);
  console.log('  stage:      ' + r2.stage);
  console.log('  error:      ' + r2.error);
  console.log('  backup:     ' + (r2.backup ? r2.backup.backup : '(none)'));
  printDiff(r2.diff);

  if (r2.backup && r2.backup.backup) createdBackups.push(r2.backup.backup);

  // Verify scratch file was actually modified
  var scratchContent = fs.readFileSync(scratchFile, 'utf8');
  var fileModified = scratchContent !== beforeContent;
  var hasNewExport = scratchContent.indexOf('auditV2') !== -1;

  console.log('  file modified:  ' + (fileModified ? '\u2713' : '\u2717'));
  console.log('  has auditV2:    ' + (hasNewExport ? '\u2713' : '\u2717'));

  // Clean up scratch file
  cleanup([scratchFile]);

  var p2 = r2.success
        && r2.diff !== null
        && r2.diff.changed === true
        && fileModified
        && hasNewExport;
  console.log('  Verdict:    ' + (p2 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── TEST 3: Audit failure ─────────────────────────────────────
  testCase('3: Audit failure (bad proposal)');
  var r3 = await applyProposal(badProposal, { write: false });
  console.log('  success:    ' + r3.success);
  console.log('  stage:      ' + r3.stage);
  console.log('  error:      ' + r3.error);

  var p3 = !r3.success
        && r3.stage === 'audit'
        && r3.error !== null;
  console.log('  Verdict:    ' + (p3 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── TEST 4: Backup failure (missing target file) ──────────────
  testCase('4: Backup failure (missing target file)');
  var r4 = await applyProposal(missingFileProposal, { write: false });
  console.log('  success:    ' + r4.success);
  console.log('  stage:      ' + r4.stage);
  console.log('  error:      ' + r4.error);

  var p4 = !r4.success
        && (r4.stage === 'patchContext')
        && r4.error.indexOf('not found') !== -1;
  console.log('  Verdict:    ' + (p4 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log('  Cleaning up ' + createdBackups.length + ' backup files...');
  cleanup(createdBackups);
  console.log('  All tests completed.');
  console.log('');
}

main().catch(function (err) {
  console.error('Test suite error:', err.message);
  process.exit(1);
});