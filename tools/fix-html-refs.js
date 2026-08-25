const fs = require('fs');
let s = fs.readFileSync('nba-perfect-player.html', 'utf8');
const files = [
  'assets/js/hupu/script-00-2678-58zyeprc-upload-1783508428855-12.js',
  'assets/js/hupu/script-01-2678-5hu3djrc-upload-1783494754597-12.js',
  'assets/js/current-player-ratings-2026.js',
  'assets/js/hupu/script-02-2678-gd4jvxrc-upload-1783494754597-15.js',
  'assets/js/hupu/script-03-2678-456sfprc-upload-1783494754597-18.js',
  'assets/js/hupu/script-04-2678-mdo4zerc-upload-1783494754597-21.js',
  'assets/js/hupu/script-05-2678-qlg35lrc-upload-1783494754597-24.js',
];
let n = 0;
for (const p of files) {
  const a = 'src="' + p + '"';
  const b = 'src="' + p.replace('.js', '.min.js') + '"';
  if (s.includes(a)) { s = s.split(a).join(b); n++; }
}
fs.writeFileSync('nba-perfect-player.html', s);
console.log('fixed ' + n);
