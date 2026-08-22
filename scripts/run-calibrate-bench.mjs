/**
 * 在 Node 中跑跳过 vs 局内校准基准（需完整数据脚本，较慢）。
 * 用法: node scripts/run-calibrate-bench.mjs [gamesPerCase]
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

const gamesPerCase = Math.max(4, parseInt(process.argv[2], 10) || 12);

const sandbox = {
  console,
  Math,
  Date,
  parseInt,
  parseFloat,
  isFinite,
  Number,
  String,
  Boolean,
  Array,
  Object,
  JSON,
  setTimeout,
  clearTimeout,
  window: {},
  document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }) },
  STATE: {
    careerTeam: 'LAL',
    position: 'SG',
    attrs: { threePT: 90, MID: 88, FIN: 82, DNK: 76, HAN: 90, PAS: 86, PDEF: 68, IDEF: 58, BLK: 52, REB: 58, ATH: 88, STR: 72, CLU: 86 },
    career: { flags: {} },
    season: { schedule: [] }
  },
  USER_PLAYER_SCORING_SCALE: 0.85,
  SIM_CONFIG: { ATTR_LIST: ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'], SHOT_DIST: { PG: { threePT: 0.28, MID: 0.26, FIN: 0.22 }, SG: { threePT: 0.34, MID: 0.24, FIN: 0.22 }, SF: { threePT: 0.30, MID: 0.26, FIN: 0.24 }, PF: { threePT: 0.22, MID: 0.28, FIN: 0.30 }, C: { threePT: 0.12, MID: 0.22, FIN: 0.38 } } }
};

sandbox.window = sandbox;
sandbox.globalThis = sandbox;

function loadScript(rel) {
  const code = readFileSync(join(root, rel), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: rel });
}

const dataScripts = [
  'assets/js/hupu/script-01-2678-5hu3djrc-upload-1783494754597-12.js',
  'assets/js/current-player-ratings-2026.js',
  'assets/js/hupu/script-02-2678-gd4jvxrc-upload-1783494754597-15.js',
  'assets/js/hupu/script-03-2678-456sfprc-upload-1783494754597-18.js',
  'assets/js/hupu/script-04-2678-mdo4zerc-upload-1783494754597-21.js',
  'assets/js/hupu/script-05-2678-qlg35lrc-upload-1783494754597-24.js'
];

for (const s of dataScripts) {
  try { loadScript(s); } catch (e) { console.warn('skip', s, e.message); }
}

loadScript('assets/js/perfect-player-core.js');
loadScript('assets/js/perfect-player-live-court.js');
loadScript('assets/js/perfect-player-live-sim.js');

const PP_LIVE = sandbox.PP_LIVE;
if (!PP_LIVE || !PP_LIVE.calibrateBenchmark) {
  console.error('PP_LIVE.calibrateBenchmark 未加载');
  process.exit(1);
}

console.log('Running calibrateBenchmark, gamesPerCase=' + gamesPerCase + ' ...');
const t0 = Date.now();
const report = PP_LIVE.calibrateBenchmark({ gamesPerCase, attrs: sandbox.STATE.attrs });
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log('\n=== 汇总 (' + report.totalGames + ' 场, ' + elapsed + 's) ===');
console.log('跳过  A/B:', report.skip.avgA.toFixed(1), report.skip.avgB.toFixed(1), '用户', report.skip.userPts.toFixed(1), '胜', report.skip.win.toFixed(3));
console.log('局内  A/B:', report.live.avgA.toFixed(1), report.live.avgB.toFixed(1), '用户', report.live.userPts.toFixed(1), '胜', report.live.win.toFixed(3));
console.log('差值  A/B:', report.delta.avgA.toFixed(2), report.delta.avgB.toFixed(2), '用户', report.delta.userPts.toFixed(2), '胜', report.delta.win.toFixed(3));
