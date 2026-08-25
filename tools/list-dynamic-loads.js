const fs = require('fs');
const files = [
  'assets/js/perfect-player-boot.js',
  'assets/js/perfect-player-era-mode.js',
  'assets/js/perfect-player-era-draft.js',
  'assets/js/perfect-player-event-runtime.js',
  'assets/js/perfect-player-core.js',
  'assets/js/perfect-player-hupu-extensions.js',
  'assets/js/perfect-player-story-events.js',
  'assets/js/perfect-player-legend-story.js',
];
const seen = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /["']((?:assets\/(?:js|data))[^"']+?\.(?:js|json))[^"']*["']/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(f.split('/').pop() + ' → ' + key);
  }
}
