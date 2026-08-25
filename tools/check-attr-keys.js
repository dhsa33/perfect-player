const fs = require('fs');
const path = require('path');

const VALID = ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU','STA'];

const files = [
  'assets/js/perfect-player-core.js',
  'assets/js/perfect-player-story-events.js',
  'assets/js/perfect-player-hupu-life-events.js',
  'assets/js/perfect-player-legend-story.js',
  'assets/js/perfect-player-event-runtime.js',
  'assets/js/perfect-player-legend-challenge.js',
];

const re = /addAttrDelta\(\s*['"]([A-Za-z]+)['"]/g;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  const invalid = new Map();
  while ((m = re.exec(src)) !== null) {
    const key = m[1];
    if (!VALID.includes(key)) {
      // find line number
      const line = src.slice(0, m.index).split('\n').length;
      if (!invalid.has(key)) invalid.set(key, []);
      invalid.get(key).push(line);
    }
  }
  if (invalid.size) {
    for (const [key, lines] of invalid) {
      console.log(f + ' → INVALID KEY "' + key + '" used ' + lines.length + 'x at lines: ' + lines.slice(0, 12).join(', ') + (lines.length > 12 ? ' ...' : ''));
    }
  }
}
console.log('Scan complete.');
