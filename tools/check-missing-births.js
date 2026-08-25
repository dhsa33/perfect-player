const fs = require('fs');
const birthsSrc = fs.readFileSync('assets/js/hupu/legend-era/era-historical-births.js','utf8');
const birthsMatch = birthsSrc.match(/var ERA_HISTORICAL_BIRTHS\s*=\s*(\{[\s\S]*?\});/);
const births = birthsMatch ? eval('(' + birthsMatch[1] + ')') : {};

for (const era of ['1984','1996','2003']) {
  const src = fs.readFileSync('assets/js/hupu/legend-era/legend-era-' + era + '-static.js','utf8');
  // Find all players with nameEN and ovr
  const players = [];
  const re = /"nameEN":\s*"([^"]+)"[^}]*?"ovr":\s*(\d+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    players.push({ name: m[1], ovr: parseInt(m[2]) });
  }
  // Also try reverse order
  const re2 = /"ovr":\s*(\d+)[^}]*?"nameEN":\s*"([^"]+)"/g;
  while ((m = re2.exec(src)) !== null) {
    if (!players.find(p => p.name === m[2])) {
      players.push({ name: m[2], ovr: parseInt(m[1]) });
    }
  }

  const missing = players.filter(p => p.ovr >= 80 && !births[p.name]);
  if (missing.length) {
    missing.sort((a,b) => b.ovr - a.ovr);
    console.log(era + ' era - Missing birth data (OVR>=80):');
    missing.forEach(p => console.log('  ' + p.name + ' (OVR ' + p.ovr + ')'));
  }
}
