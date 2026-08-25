const fs = require('fs');
const s = fs.readFileSync('assets/js/perfect-player-core.js', 'utf8');
const lines = s.split('\n');

let staReads = 0;
lines.forEach((l, i) => {
  if (l.includes('.STA') && !l.includes('addAttrDelta')) {
    staReads++;
    if (staReads <= 8) console.log('STA read line ' + (i + 1) + ': ' + l.trim().slice(0, 120));
  }
});
console.log('STA total reads:', staReads);

console.log('applyEventTrainingGrant defined:', s.includes('function applyEventTrainingGrant'));
const i = s.indexOf('function applyEventTrainingGrant');
if (i !== -1) console.log(s.slice(i, i + 500));

// getVeteranMaintenanceLevel reads STA?
const j = s.indexOf('function getVeteranMaintenanceLevel');
if (j !== -1) console.log('\n--- getVeteranMaintenanceLevel:\n' + s.slice(j, j + 500));
