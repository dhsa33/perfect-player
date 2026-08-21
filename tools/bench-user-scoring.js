/**
 * Local scoring bench (no browser). Mirrors generatePlayerStatsNew FGA/PTS math
 * so we can compare profiles vs real NBA anchors before shipping.
 *
 * Usage: node tools/bench-user-scoring.js
 */
'use strict';

var USER_PLAYER_SCORING_SCALE = 0.85;
var OLD_SCALE = 1.0;

var SHOT_DIST = {
  PG: { threePT: 0.35, MID: 0.25, FIN: 0.25 },
  SG: { threePT: 0.38, MID: 0.22, FIN: 0.22 },
  SF: { threePT: 0.30, MID: 0.20, FIN: 0.30 },
  PF: { threePT: 0.20, MID: 0.18, FIN: 0.38 },
  C:  { threePT: 0.08, MID: 0.18, FIN: 0.48 }
};

function softCap99(v) {
  v = Number(v);
  if (!isFinite(v)) return 0;
  return v <= 99 ? v : 99 + (v - 99) * 0.5;
}
function simSkill01(v) {
  return Math.max(0, (softCap99(v) - 25) / 74);
}
function clampHalf(v, lo, hi, hard) {
  v = Number(v);
  if (!isFinite(v)) v = lo;
  if (v <= hi) return Math.max(lo, v);
  var out = hi + (v - hi) * 0.5;
  return hard != null ? Math.min(hard, out) : out;
}
function interpolateShotCurve(attrVal, anchors) {
  var value = Math.max(25, softCap99(Number(attrVal) || 50));
  for (var i = 1; i < anchors.length; i++) {
    if (value <= anchors[i][0]) {
      var left = anchors[i - 1];
      var right = anchors[i];
      var t = (value - left[0]) / Math.max(1, right[0] - left[0]);
      return left[1] + (right[1] - left[1]) * t;
    }
  }
  var last = anchors[anchors.length - 1];
  var prev = anchors[anchors.length - 2] || last;
  var slope = (last[1] - prev[1]) / Math.max(1, last[0] - prev[0]);
  return last[1] + slope * Math.max(0, value - last[0]);
}
function calcShotPct(type, attrVal, defensePressure, gameForm) {
  var curves = {
    threePT: [[25, 0.22], [50, 0.28], [70, 0.34], [85, 0.385], [99, 0.435]],
    MID: [[25, 0.25], [50, 0.33], [70, 0.40], [85, 0.455], [99, 0.51]],
    FIN: [[25, 0.35], [50, 0.48], [70, 0.58], [85, 0.66], [99, 0.73]],
    FT: [[25, 0.52], [50, 0.67], [70, 0.77], [85, 0.85], [99, 0.92]]
  };
  var curve = curves[type];
  var pressureScale = type === 'FIN' ? 0.82 : (type === 'MID' ? 0.92 : 1);
  var pct = interpolateShotCurve(attrVal, curve) - (Number(defensePressure) || 0) * pressureScale + (Number(gameForm) || 0);
  var lo = curve[0][1];
  var hi = curve[curve.length - 1][1];
  return clampHalf(pct, lo, hi, hi + 0.08);
}
function calcPlayerCreationRating(attrs, pos) {
  var weights = {
    PG: { threePT: 0.18, MID: 0.13, FIN: 0.13, HAN: 0.28, PAS: 0.18, CLU: 0.10 },
    SG: { threePT: 0.23, MID: 0.18, FIN: 0.18, HAN: 0.23, PAS: 0.08, CLU: 0.10 },
    SF: { threePT: 0.19, MID: 0.15, FIN: 0.22, DNK: 0.08, HAN: 0.18, PAS: 0.08, CLU: 0.10 },
    PF: { threePT: 0.12, MID: 0.12, FIN: 0.28, DNK: 0.10, HAN: 0.13, PAS: 0.08, STR: 0.10, CLU: 0.07 },
    C:  { threePT: 0.07, MID: 0.10, FIN: 0.34, DNK: 0.12, HAN: 0.10, PAS: 0.10, STR: 0.12, CLU: 0.05 }
  };
  var selected = weights[pos] || weights.SF;
  return Object.keys(selected).reduce(function (sum, key) {
    return sum + softCap99(parseInt(attrs[key], 10) || 50) * selected[key];
  }, 0);
}
function minutesForOvr(ovr, isStarter) {
  var roleMinutes;
  if (ovr >= 90) roleMinutes = 36;
  else if (ovr >= 82) roleMinutes = 33;
  else if (ovr >= 75) roleMinutes = 28;
  else if (ovr >= 68) roleMinutes = 21;
  else roleMinutes = 13;
  if (isStarter) roleMinutes = Math.max(30, roleMinutes);
  return roleMinutes;
}
function expectedPts(attrs, pos, ovr, scale) {
  var mins = minutesForOvr(ovr, true);
  var pace = 99.4;
  var defensePressure = 0;
  var creation = calcPlayerCreationRating(attrs, pos);
  var creation01 = simSkill01(creation);
  var posUsage = { PG: 0.005, SG: 0.012, SF: 0.004, PF: -0.004, C: -0.002 };
  var usage = Math.max(0.10, Math.min(0.39, 0.10 + Math.pow(creation01, 1.24) * 0.27 + (posUsage[pos] || 0)));
  var teamFGA = pace * 0.896;
  var scoringAverage = ((parseInt(attrs.threePT, 10) || 50) + (parseInt(attrs.MID, 10) || 50) + (parseInt(attrs.FIN, 10) || 50)) / 3;
  var aggression = Math.max(0.78, Math.min(1.12, 0.96 + (scoringAverage - 70) * 0.004));
  var expectedFga = teamFGA * (mins / 48) * usage * aggression * (1 - defensePressure * 1.5) * 0.90 * scale;
  var baseDist = SHOT_DIST[pos] || SHOT_DIST.SF;
  var finRating = (parseInt(attrs.FIN, 10) || 50) * 0.72 + (parseInt(attrs.DNK, 10) || 50) * 0.28;
  var threeW = baseDist.threePT * (0.45 + Math.pow(simSkill01(attrs.threePT), 1.15) * 1.25);
  var midW = baseDist.MID * (0.45 + Math.pow(simSkill01(attrs.MID), 1.15) * 1.25);
  var finW = baseDist.FIN * (0.45 + Math.pow(simSkill01(finRating), 1.15) * 1.25);
  var distTotal = Math.max(0.001, threeW + midW + finW);
  var threeA = expectedFga * threeW / distTotal;
  var midA = expectedFga * midW / distTotal;
  var finA = Math.max(0, expectedFga - threeA - midA);
  var threePct = clampHalf(calcShotPct('threePT', attrs.threePT, defensePressure, 0), 0.18, 0.52, 0.58);
  var midPct = clampHalf(calcShotPct('MID', attrs.MID, defensePressure, 0), 0.22, 0.58, 0.66);
  var finPct = clampHalf(calcShotPct('FIN', finRating, defensePressure, 0), 0.32, 0.80, 0.88);
  var ftRate = Math.max(0.07, Math.min(0.62, 0.07 + simSkill01(attrs.FIN) * 0.20 + simSkill01(attrs.STR) * 0.11 + simSkill01(attrs.HAN) * 0.06));
  var freeThrowRating = (parseInt(attrs.CLU, 10) || 50) * 0.5 + (parseInt(attrs.MID, 10) || 50) * 0.25 + (parseInt(attrs.threePT, 10) || 50) * 0.25;
  var ftPct = clampHalf(calcShotPct('FT', freeThrowRating, 0, 0), 0.50, 0.96, 0.99);
  var pts = threeA * threePct * 3 + midA * midPct * 2 + finA * finPct * 2 + expectedFga * ftRate * ftPct;
  return {
    mins: mins,
    usage: Math.round(usage * 1000) / 1000,
    fga: Math.round(expectedFga * 10) / 10,
    pts: Math.round(pts * 10) / 10,
    fgish: Math.round(((threeA * threePct + midA * midPct + finA * finPct) / Math.max(0.001, expectedFga)) * 1000) / 1000
  };
}

function flat(n) {
  return {
    threePT: n, MID: n, FIN: n, DNK: n, HAN: n, PAS: n,
    PDEF: n, IDEF: n, BLK: n, REB: n, ATH: n, STR: n, CLU: n
  };
}
function blend(base, bump) {
  var out = {};
  Object.keys(base).forEach(function (k) {
    out[k] = Math.min(99, (base[k] || 70) + (bump[k] || 0));
  });
  return out;
}

// Approximate real NBA anchors (recent peak seasons, PPG)
var NBA_ANCHORS = {
  'MVP级(~30)': 30,
  '超级得分王峰值(~33)': 33,
  '全明星侧翼(~23)': 23,
  '优质首发(~18)': 18,
  '角色轮换(~12)': 12
};

var profiles = [
  { name: '新秀合格首发 SF 78', pos: 'SF', ovr: 78, attrs: blend(flat(74), { threePT: 4, FIN: 6, ATH: 8, HAN: 2 }) },
  { name: '全明星侧翼 SF 86', pos: 'SF', ovr: 86, attrs: blend(flat(82), { threePT: 6, MID: 4, FIN: 8, HAN: 4, ATH: 6, CLU: 4 }) },
  { name: 'MVP级组织核 PG 92', pos: 'PG', ovr: 92, attrs: blend(flat(88), { threePT: 6, MID: 5, HAN: 8, PAS: 10, CLU: 6, FIN: 4 }) },
  { name: '造神得分后卫 SG 96', pos: 'SG', ovr: 96, attrs: blend(flat(93), { threePT: 6, MID: 5, FIN: 5, HAN: 4, CLU: 6, ATH: 4 }) },
  { name: '满配近满分 SG 99', pos: 'SG', ovr: 99, attrs: flat(99) },
  { name: '事件溢出 SG 110效', pos: 'SG', ovr: 99, attrs: flat(110) },
  { name: '内线核心 C 90', pos: 'C', ovr: 90, attrs: blend(flat(84), { FIN: 10, DNK: 8, STR: 10, REB: 10, BLK: 8, IDEF: 6, threePT: -10 }) }
];

function pctVs(mvp, pts) {
  return Math.round(((pts / mvp) - 1) * 100);
}

console.log('USER_PLAYER_SCORING_SCALE =', USER_PLAYER_SCORING_SCALE);
console.log('Real NBA anchors (approx):', NBA_ANCHORS);
console.log('');
console.log(
  [
    'profile'.padEnd(22),
    'oldPPG'.padStart(7),
    'newPPG'.padStart(7),
    'ratio'.padStart(6),
    'vsMVP30'.padStart(8),
    'fga'.padStart(6),
    'usage'.padStart(7),
    'mins'.padStart(5)
  ].join(' ')
);

profiles.forEach(function (p) {
  var old = expectedPts(p.attrs, p.pos, p.ovr, OLD_SCALE);
  var neu = expectedPts(p.attrs, p.pos, p.ovr, USER_PLAYER_SCORING_SCALE);
  var vs = pctVs(30, neu.pts);
  var flag = vs > 60 ? '  << TOO HIGH' : (vs > 35 ? '  (okish +30% band)' : '');
  console.log(
    [
      p.name.padEnd(22),
      String(old.pts).padStart(7),
      String(neu.pts).padStart(7),
      String(Math.round((neu.pts / old.pts) * 100) + '%').padStart(6),
      (('+' + vs + '%').padStart(8)),
      String(neu.fga).padStart(6),
      String(neu.usage).padStart(7),
      String(neu.mins).padStart(5)
    ].join(' ') + flag
  );
});

console.log('\nTeam PPG sanity (league baseline target ~115.6): unchanged by this patch (player FGA only).');
console.log('Acceptance: created god build should be ~+20~+35% vs real MVP (~30), not +60%.');
