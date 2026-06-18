const pm = require('./proposalManager');

console.log('PENDING');
console.log(pm.getPending());

console.log('\nAPPROVE');

pm.approveProposal('test-001');

console.log(pm.getApproved());

console.log('\nLATEST');

console.log(
  pm.getLatestApproved()
);

console.log('\nAPPLY');

pm.markApplied('test-001');

console.log('DONE');