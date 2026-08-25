const fs = require('fs');

const VALID = ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU','STA'];

// 1. applyTrainingOutcome(primary, secondary, ...) - check both keys
const files = [
  'assets/js/perfect-player-core.js',
  'assets/js/perfect-player-story-events.js',
  'assets/js/perfect-player-legend-story.js',
  'assets/js/perfect-player-event-runtime.js',
];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');

  // applyTrainingOutcome calls
  const re1 = /applyTrainingOutcome\(\s*['"]([A-Za-z]+)['"]\s*,\s*['"]([A-Za-z]+)['"]/g;
  let m;
  while ((m = re1.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    for (const key of [m[1], m[2]]) {
      if (!VALID.includes(key)) {
        console.log(f + ':' + line + ' → applyTrainingOutcome invalid key "' + key + '"');
      }
    }
  }

  // addAttrDelta with template/concat keys
  const re2 = /addAttrDelta\(\s*[^'"][,)]/g;
  while ((m = re2.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    console.log(f + ':' + line + ' → addAttrDelta with VARIABLE key: ' + lines[line-1].trim().slice(0, 110));
  }

  // addAttrDelta with string concat
  const re3 = /addAttrDelta\(\s*['"`][A-Za-z]+['"`]\s*\+/g;
  while ((m = re3.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    console.log(f + ':' + line + ' → addAttrDelta CONCAT key: ' + lines[line-1].trim().slice(0, 110));
  }
}
console.log('Done.');
