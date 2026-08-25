const fs = require('fs');

const s = fs.readFileSync('nba-perfect-player.html', 'utf8');
const scripts = [];
let re = /<script[^>]*src="([^"]+)"[^>]*>/g, m;
while ((m = re.exec(s)) !== null) scripts.push(m[1]);
console.log('=== script tags (' + scripts.length + '):');
scripts.forEach(x => console.log('  ' + x));

console.log('\n=== file sizes (KB) ===');
let total = 0;
scripts.forEach(p => {
  const f = p.split('?')[0];
  try {
    const kb = fs.statSync(f).size / 1024;
    total += kb;
    console.log('  ' + kb.toFixed(0).padStart(6) + ' KB  ' + f);
  } catch (e) { console.log('   MISSING  ' + f); }
});
console.log('  --------');
console.log('  ' + total.toFixed(0).padStart(6) + ' KB  TOTAL (static scripts)');

// inline script size
const inline = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].reduce((a, m) => a + m[1].length, 0);
console.log('\ninline <script> blocks total: ' + (inline / 1024).toFixed(0) + ' KB');

// css
const css = [...s.matchAll(/<link[^>]*href="([^"]+\.css[^"]*)"/g)].map(x => x[1]);
let cssTotal = 0;
css.forEach(p => { const f = p.split('?')[0]; try { cssTotal += fs.statSync(f).size / 1024; } catch(e){} });
console.log('css files: ' + css.length + ', total ' + cssTotal.toFixed(0) + ' KB');
