const fs = require('fs');
const path = require('path');

function hsNormKey(s) {
  s = s == null ? '' : String(s);
  // remove accents
  try {
    s = s.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
  } catch (e) {
    // best effort
  }
  s = s.toLowerCase().replace(/[’‘]/g, "'");
  return s.replace(/[^a-z0-9]/g, '');
}

const root = 'C:/Users/whf97/Downloads/temp';
const missingKeysPath = path.join(root, '_missing_hupu_era_keys.txt');
const photosJsPath = path.join(root, 'assets/js/hupu/legend-era/hupu-player-photos.js');

const missingKeys = fs.readFileSync(missingKeysPath, 'utf8')
  .split(/\r?\n/).map(x => x.trim()).filter(Boolean);

const code = fs.readFileSync(photosJsPath, 'utf8');

// Minimal globals for the evaluated script.
global.window = global;
global.HUPU_PLAYER_PHOTOS = null;

try {
  eval(code);
} catch (e) {
  console.error('eval failed:', e && e.message ? e.message : e);
  process.exit(2);
}

const photos = global.HUPU_PLAYER_PHOTOS || global.window.HUPU_PLAYER_PHOTOS;
if (!photos || !photos.lookup) {
  console.error('HUPU_PLAYER_PHOTOS.lookup not found');
  process.exit(3);
}

const lookup = photos.lookup;
const idx = Object.create(null);

function toHttpsNoQuery(url) {
  if (!url) return '';
  let u = String(url);
  if (u.startsWith('http://')) u = 'https://' + u.slice(7);
  u = u.split('?')[0];
  return u;
}

for (const k of Object.keys(lookup)) {
  const rec = lookup[k] || {};
  const url = toHttpsNoQuery(rec.b || rec.p || '');
  if (!url) continue;
  const ck1 = hsNormKey(k);
  if (ck1 && !idx[ck1]) idx[ck1] = url;
  if (rec.e) {
    const ck2 = hsNormKey(rec.e);
    if (ck2 && !idx[ck2]) idx[ck2] = url;
  }
}

const out = {};
for (const mk of missingKeys) {
  out[mk] = idx[mk] || '';
}

const outPath = path.join(root, '_missing_hupu_era_urls.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('missing keys:', missingKeys.length);
console.log('found urls:', missingKeys.filter(k => out[k]).length, 'not found:', missingKeys.filter(k => !out[k]).length);

