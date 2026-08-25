const fs = require('fs');
const { execSync } = require('child_process');

// 1. every asset referenced by html must exist on disk
const html = fs.readFileSync('nba-perfect-player.html', 'utf8');
let bad = 0;
let m;
const re = /(?:src|href)="(assets\/[^"]+)"/g;
while ((m = re.exec(html)) !== null) {
  const p = m[1].split('?')[0];
  if (!fs.existsSync(p)) { console.log('MISSING: ' + p); bad++; }
}
console.log('html asset check: ' + (bad ? bad + ' MISSING' : 'all exist'));

// 2. every dynamic load in boot.min/era-mode.min must exist
for (const f of ['assets/js/perfect-player-boot.min.js', 'assets/js/perfect-player-era-mode.min.js']) {
  const s = fs.readFileSync(f, 'utf8');
  const re2 = /["']((?:assets\/js)\/[^"']+?\.min\.js)[^"']*["']/g;
  let miss = 0;
  while ((m = re2.exec(s)) !== null) {
    if (!fs.existsSync(m[1])) { console.log(f + ' MISSING dep: ' + m[1]); miss++; }
  }
  console.log(f.split('/').pop() + ' deps: ' + (miss ? miss + ' MISSING' : 'all exist'));
}

// 3. node --check on all .min.js
const minFiles = [];
function scan(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = dir + '/' + f;
    if (fs.statSync(p).isDirectory()) { if (!p.includes('node_modules')) scan(p); continue; }
    if (f.endsWith('.min.js')) minFiles.push(p);
  }
}
scan('assets/js');
let syntaxBad = 0;
for (const p of minFiles) {
  try { execSync('node --check "' + p + '"', { stdio: 'pipe' }); }
  catch (e) { console.log('SYNTAX FAIL: ' + p); syntaxBad++; }
}
console.log('node --check: ' + minFiles.length + ' min files, ' + (syntaxBad ? syntaxBad + ' FAIL' : 'all pass'));

// 4. sw.js precache list all exist
const sw = fs.readFileSync('sw.js', 'utf8');
const listMatch = sw.match(/var PRECACHE = (\[[\s\S]*?\]);/);
const list = JSON.parse(listMatch[1]);
let swBad = 0;
for (const u of list) {
  const p = u.replace(/^\.\//, '').split('?')[0];
  if (!fs.existsSync(p)) { console.log('SW PRECACHE MISSING: ' + u); swBad++; }
}
console.log('sw.js precache: ' + list.length + ' entries, ' + (swBad ? swBad + ' MISSING' : 'all exist'));
console.log('sw BUILD: ' + (sw.match(/var BUILD = '([^']+)'/) || [])[1]);
