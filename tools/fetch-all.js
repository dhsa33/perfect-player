const { execSync } = require('child_process');
const fs = require('fs');

const html = fs.readFileSync('nba-perfect-player.html', 'utf8');
const urls = [];
let m;
const re = /(?:src|href)="(assets\/[^"]+|sw\.js)"/g;
while ((m = re.exec(html)) !== null) urls.push(m[1]);

// dynamic deps from boot.min + era-mode.min
for (const f of ['assets/js/perfect-player-boot.min.js', 'assets/js/perfect-player-era-mode.min.js']) {
  const s = fs.readFileSync(f, 'utf8');
  const re2 = /["']((?:assets\/js)\/[^"']+?\.min\.js)[^"']*["']/g;
  while ((m = re2.exec(s)) !== null) urls.push(m[1] + '?v=20260825-1325');
}

let fail = 0, ok = 0, totalBytes = 0;
for (const u of [...new Set(urls)]) {
  try {
    const out = execSync('curl -s -o NUL -w "%{http_code} %{size_download}" "http://127.0.0.1:8035/' + u + '"', { shell: 'cmd.exe' }).toString();
    const [code, size] = out.split(' ');
    totalBytes += parseInt(size) || 0;
    if (code === '200') ok++;
    else { console.log('FAIL ' + code + ' ' + u); fail++; }
  } catch (e) { console.log('ERR ' + u); fail++; }
}
console.log('\n' + ok + ' OK, ' + fail + ' failed, total ' + (totalBytes / 1024).toFixed(0) + ' KB raw (uncompressed local)');
