const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap';

const css = execSync('curl -s -A "' + UA + '" "' + CSS_URL + '"', { maxBuffer: 10 * 1024 * 1024 }).toString();

// Parse @font-face blocks; keep only latin subset
const blocks = css.split('/*').filter(b => b.trim());
const outDir = 'assets/fonts';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const faces = [];
for (const b of blocks) {
  if (!b.trim().startsWith('latin */') || b.trim().startsWith('latin-ext')) continue; // only plain latin subset
  const family = (b.match(/font-family:\s*'([^']+)'/) || [])[1];
  const style = (b.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
  const weight = (b.match(/font-weight:\s*(\d+)/) || [])[1] || '400';
  const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
  if (!family || !url) continue;
  const fname = (family + '-' + weight + (style === 'italic' ? 'i' : '') + '-latin.woff2').toLowerCase();
  faces.push({ family, style, weight, url, fname });
}

(async () => {
  for (const f of faces) {
    const dest = path.join(outDir, f.fname);
    execSync('curl -s -o "' + dest + '" "' + f.url + '"', { maxBuffer: 10 * 1024 * 1024 });
    const kb = (fs.statSync(dest).size / 1024).toFixed(1);
    console.log(f.fname + '  ' + kb + ' KB');
  }
  // emit @font-face css
  let cssOut = '/* self-hosted latin subsets; CJK falls back to system fonts */\n';
  for (const f of faces) {
    cssOut += '@font-face{font-family:\'' + f.family + '\';font-style:' + f.style + ';font-weight:' + f.weight + ';font-display:swap;src:url(../fonts/' + f.fname + ') format(\'woff2\');}\n';
  }
  fs.writeFileSync('assets/css/fonts.css', cssOut);
  console.log('\nwrote assets/css/fonts.css with ' + faces.length + ' faces');
})();
