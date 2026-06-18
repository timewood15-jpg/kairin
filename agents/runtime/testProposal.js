const fs = require('fs');
const path = require('path');
const pm = require('./proposalManager');

const ROOT = path.join(__dirname, '..', 'proposals');

const pendingFile = path.join(
  ROOT,
  'pending',
  'test-001.json'
);

const approvedFile = path.join(
  ROOT,
  'approved',
  'test-001.json'
);

const appliedFile = path.join(
  ROOT,
  'applied',
  'test-001.json'
);

// Cleanup test sebelumnya
[pendingFile, approvedFile, appliedFile]
  .forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

// Create proposal
pm.saveProposal(
  path.join(ROOT, 'pending'),
  {
    id: 'test-001',
    title: 'Test Proposal',
    status: 'pending'
  }
);

console.log('\n=== PENDING ===');
console.log(pm.getPending());

console.log('\n=== APPROVE ===');
pm.approveProposal('test-001');

console.log(pm.getApproved());

console.log('\n=== LATEST APPROVED ===');
console.log(pm.getLatestApproved());

console.log('\n=== APPLY ===');
pm.markApplied('test-001');

console.log(
  'Applied exists:',
  fs.existsSync(appliedFile)
);

console.log('\n=== ERROR TEST ===');

try {
  pm.approveProposal('tidak-ada');
} catch (err) {
  console.log('OK:', err.message);
}

console.log('\n=== TEST FINISHED ===');