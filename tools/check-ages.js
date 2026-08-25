const fs = require('fs');

// Load birth data
const birthsSrc = fs.readFileSync('assets/js/hupu/legend-era/era-historical-births.js','utf8');
const birthsMatch = birthsSrc.match(/var ERA_HISTORICAL_BIRTHS\s*=\s*(\{[\s\S]*?\});/);
const births = birthsMatch ? eval('(' + birthsMatch[1] + ')') : {};

for (const era of ['1984','1996','2003']) {
  const src = fs.readFileSync('assets/js/hupu/legend-era/legend-era-' + era + '-static.js','utf8');
  
  // Extract player objects by finding "nameEN" and "_age" pairs
  const players = [];
  const re = /"nameEN":\s*"([^"]+)"[^}]*?"_age":\s*(\d+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    players.push({ name: m[1], listedAge: parseInt(m[2]) });
  }
  // Also try reverse order (_age before nameEN)
  const re2 = /"_age":\s*(\d+)[^}]*?"nameEN":\s*"([^"]+)"/g;
  while ((m = re2.exec(src)) !== null) {
    if (!players.find(p => p.name === m[2])) {
      players.push({ name: m[2], listedAge: parseInt(m[1]) });
    }
  }

  let wrong = 0, correct = 0, noBirth = 0;
  const errors = [];

  for (const p of players) {
    const birth = births[p.name];
    if (birth == null) { noBirth++; continue; }
    const correctAge = parseInt(era) - birth;
    if (Math.abs(p.listedAge - correctAge) > 1) {
      wrong++;
      errors.push({ name: p.name, listed: p.listedAge, correct: correctAge, diff: p.listedAge - correctAge });
    } else {
      correct++;
    }
  }

  console.log('\n' + era + ' era: ' + players.length + ' players with _age');
  console.log('  Correct(±1yr): ' + correct + ', Wrong(>1yr): ' + wrong + ', No birth data: ' + noBirth);
  if (errors.length > 0) {
    errors.sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff));
    console.log('  Worst errors:');
    errors.slice(0, 15).forEach(e => console.log('    ' + e.name + ': listed=' + e.listed + ' correct=' + e.correct + ' (off by ' + e.diff + 'yr)'));
  }
}
