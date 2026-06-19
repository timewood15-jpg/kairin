'use strict';

const { generateRewrite } = require('../rewriteEngine');

function testCase(label) {
  console.log('\n' + '='.repeat(60));
  console.log('  TEST: ' + label);
  console.log('='.repeat(60));
}

function printResult(r) {
  console.log('  Success:    ' + r.success);
  if (r.error) console.log('  Error:      ' + r.error);
  if (r.originalContent != null) {
    var n = r.originalContent.split('\n').length;
    console.log('  Original:   ' + n + ' lines');
  }
  if (r.modifiedContent != null) {
    var n2 = r.modifiedContent.split('\n').length;
    console.log('  Modified:   ' + n2 + ' lines');
  }
}

var sampleContent = [
  "'use strict';",
  '',
  'var fs = require("fs");',
  'var path = require("path");',
  '',
  'function loadConfig(name) {',
  '  var filePath = path.join(__dirname, name);',
  '  return JSON.parse(fs.readFileSync(filePath, "utf8"));',
  '}',
  '',
  'module.exports = { loadConfig: loadConfig };',
  ''
].join('\n');

var basePlan = {
  targetFile: 'src/config.js',
  goal: 'Add JSDoc and validation to loadConfig',
  originalContent: sampleContent,
  instructions: [
    'Preserve existing exports',
    'Preserve existing imports/requires',
    'Keep current coding style'
  ],
  changes: []
};

async function main() {

  // ── 1: Valid plan ──────────────────────────────────────────────
  testCase('1: Valid plan');
  var plan1 = JSON.parse(JSON.stringify(basePlan));
  plan1.changes = [
    {
      op: 'replace',
      find: 'function loadConfig(name) {',
      replace: '/**\n * Load a JSON config file.\n * @param {string} name\n * @returns {object}\n */\nfunction loadConfig(name) {'
    },
    {
      op: 'replace',
      find: 'return JSON.parse(fs.readFileSync(filePath, "utf8"));',
      replace: '  if (!fs.existsSync(filePath)) {\n    throw new Error("Config not found: " + filePath);\n  }\n  return JSON.parse(fs.readFileSync(filePath, "utf8"));'
    }
  ];
  var r1 = await generateRewrite(plan1);
  printResult(r1);

  var hasJSDoc    = r1.modifiedContent && r1.modifiedContent.indexOf('/**') !== -1;
  var hasThrow    = r1.modifiedContent && r1.modifiedContent.indexOf('throw new Error') !== -1;
  var hasExport   = r1.modifiedContent && r1.modifiedContent.indexOf('module.exports') !== -1;
  var hasStrict   = r1.modifiedContent && r1.modifiedContent.indexOf("'use strict'") !== -1;

  console.log('  JSDoc added:      ' + (hasJSDoc ? '\u2713' : '\u2717'));
  console.log('  Validation added: ' + (hasThrow ? '\u2713' : '\u2717'));
  console.log('  Exports kept:     ' + (hasExport ? '\u2713' : '\u2717'));
  console.log('  Strict kept:      ' + (hasStrict ? '\u2713' : '\u2717'));

  var p1 = r1.success
        && r1.originalContent === sampleContent
        && r1.modifiedContent !== sampleContent
        && hasJSDoc && hasThrow && hasExport;
  console.log('  Verdict:    ' + (p1 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── 2: Missing plan ────────────────────────────────────────────
  testCase('2: Missing plan (null)');
  var r2 = await generateRewrite(null);
  printResult(r2);
  var p2 = !r2.success && r2.error.indexOf('non-null object') !== -1;
  console.log('  Verdict:    ' + (p2 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── 3: Missing originalContent ─────────────────────────────────
  testCase('3: Missing originalContent');
  var plan3 = { targetFile: 'src/x.js', goal: 'x', originalContent: null, changes: [] };
  var r3 = await generateRewrite(plan3);
  printResult(r3);
  var p3 = !r3.success && r3.error.indexOf('originalContent') !== -1;
  console.log('  Verdict:    ' + (p3 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── 4: Missing targetFile ──────────────────────────────────────
  testCase('4: Missing targetFile');
  var plan4 = { targetFile: '', goal: 'x', originalContent: 'x', changes: [] };
  var r4 = await generateRewrite(plan4);
  printResult(r4);
  var p4 = !r4.success && r4.error.indexOf('targetFile') !== -1;
  console.log('  Verdict:    ' + (p4 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── 5: Replace operation ───────────────────────────────────────
  testCase('5: Replace operation');
  var plan5 = { targetFile: 'src/math.js', goal: 'Rename', originalContent: 'function add(a,b) { return a+b; }\n', changes: [{ op: 'replace', find: 'function add', replace: 'function sum' }] };
  var r5 = await generateRewrite(plan5);
  printResult(r5);
  var p5 = r5.success && r5.modifiedContent.indexOf('function sum') !== -1 && r5.modifiedContent.indexOf('function add') === -1;
  console.log('  Verdict:    ' + (p5 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── 6: Append operation ────────────────────────────────────────
  testCase('6: Append operation');
  var plan6 = { targetFile: 'src/util.js', goal: 'Add export', originalContent: 'function id(x) { return x; }\n', changes: [{ op: 'append', content: 'module.exports = { id };\n' }] };
  var r6 = await generateRewrite(plan6);
  printResult(r6);
  var p6 = r6.success && r6.modifiedContent.indexOf('module.exports') !== -1;
  console.log('  Verdict:    ' + (p6 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── 7: Delete operation ────────────────────────────────────────
  testCase('7: Delete operation');
  var plan7 = { targetFile: 'src/debug.js', goal: 'Remove debug', originalContent: 'function run() {\n  console.log("debug");\n  doWork();\n}\n', changes: [{ op: 'delete', match: 'console.log' }] };
  var r7 = await generateRewrite(plan7);
  printResult(r7);
  var p7 = r7.success && r7.modifiedContent.indexOf('console.log') === -1 && r7.modifiedContent.indexOf('doWork') !== -1;
  console.log('  Verdict:    ' + (p7 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── 8: Unknown operation type ──────────────────────────────────
  testCase('8: Unknown operation type');
  var plan8 = { targetFile: 'src/t.js', goal: 'x', originalContent: 'var x=1;\n', changes: [{ op: 'refactor', strategy: 'extract-function' }] };
  var r8 = await generateRewrite(plan8);
  printResult(r8);
  var p8 = !r8.success && r8.error.indexOf('Unknown operation type') !== -1 && r8.error.indexOf('refactor') !== -1;
  console.log('  Verdict:    ' + (p8 ? '\u2713 PASS' : '\u2717 FAIL'));

  // ── Summary ────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log('  All tests completed. No files were read or written.\n');
}

main().catch(function (err) {
  console.error('Test suite error:', err.message);
  process.exit(1);
});