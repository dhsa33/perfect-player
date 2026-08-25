const fs = require('fs');

// runtime-loaded js files that will have .min.js versions
const RUNTIME = [
  'assets/js/perfect-player-boot.js',
  'assets/js/hupu/script-00-2678-58zyeprc-upload-1783508428855-12.js',
  'assets/js/hupu/script-01-2678-5hu3djrc-upload-1783494754597-12.js',
  'assets/js/current-player-ratings-2026.js',
  'assets/js/hupu/script-02-2678-gd4jvxrc-upload-1783494754597-15.js',
  'assets/js/hupu/script-03-2678-456sfprc-upload-1783494754597-18.js',
  'assets/js/hupu/script-04-2678-mdo4zerc-upload-1783494754597-21.js',
  'assets/js/hupu/script-05-2678-qlg35lrc-upload-1783494754597-24.js',
  'assets/js/perfect-player-core.js',
  'assets/js/perfect-player-era-mode.js',
  'assets/js/perfect-player-era-draft.js',
  'assets/js/perfect-player-event-runtime.js',
  'assets/js/perfect-player-poster.js',
  'assets/js/perfect-player-hupu-extensions.js',
  'assets/js/perfect-player-skills.js',
  'assets/js/perfect-player-enhancements.js',
  'assets/js/perfect-player-event-library.js',
  'assets/js/perfect-player-story-events.js',
  'assets/js/perfect-player-hupu-life-events.js',
  'assets/js/perfect-player-legend-story.js',
  'assets/js/perfect-player-legend-challenge.js',
  'assets/js/perfect-player-awards.js',
  'assets/js/perfect-player-allstar.js',
  'assets/js/perfect-player-live-court.js',
  'assets/js/perfect-player-live-sim.js',
  'assets/js/hupu/legend-era/legend-era-1984-static.js',
  'assets/js/hupu/legend-era/legend-era-1996-static.js',
  'assets/js/hupu/legend-era/legend-era-2003-static.js',
  'assets/js/hupu/legend-era/era-config.js',
  'assets/js/hupu/legend-era/draft-classes.js',
  'assets/js/hupu/legend-era/historical-players.js',
  'assets/js/hupu/legend-era/era-bench-pools.js',
  'assets/js/hupu/legend-era/era-historical-births.js',
  'assets/js/hupu/legend-era/era-rosters.js',
  'assets/js/hupu/legend-era/hupu-player-photos.js',
];

const REFERRERS = [
  'nba-perfect-player.html',
  'assets/js/perfect-player-boot.js',
  'assets/js/perfect-player-era-mode.js',
];

for (const rf of REFERRERS) {
  let s = fs.readFileSync(rf, 'utf8');
  let count = 0;
  for (const p of RUNTIME) {
    // "X.js?v=" or "X.js'" (era static map has no query)
    const a = p + '?';
    const b = p + "'";
    if (s.includes(a)) { s = s.split(a).join(p.replace('.js', '.min.js') + '?'); count++; }
    else if (s.includes(b)) { s = s.split(b).join(p.replace('.js', '.min.js') + "'"); count++; }
  }
  fs.writeFileSync(rf, s);
  console.log(rf + ': ' + count + ' references → .min.js');
}
