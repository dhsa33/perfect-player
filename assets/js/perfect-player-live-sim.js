/* ============================================================
 * Perfect Player — 单局回合模拟
 * 队分蓝图与跳过同源（pace × 效率 + 方差）；回合内逐球模拟。
 * 禁止终场改比分/数据栏——与跳过对齐只调回合参数（usage、neededPPP 等）。
 * ============================================================ */
(function () {
  'use strict';

  var PP_LIVE = window.PP_LIVE = window.PP_LIVE || {};
  var REGULAR_OFFER_CAP = 10;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }
  function clampHalf(v, lo, hi, hard) {
    if (typeof clampWithHalfOverflow === 'function') return clampWithHalfOverflow(v, lo, hi, hard);
    v = Number(v);
    if (!isFinite(v)) v = lo;
    if (v <= hi) return Math.max(lo, v);
    var out = hi + (v - hi) * 0.5;
    return hard != null ? Math.min(hard, out) : out;
  }
  function effectiveAttr(v) {
    if (typeof softCap99 === 'function') return softCap99(v);
    v = Number(v);
    if (!isFinite(v)) return 0;
    return v <= 99 ? v : 99 + (v - 99) * 0.5;
  }
  function rand() { return Math.random(); }
  function chance(p) { return rand() < p; }
  function irand(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
  function attr(p, k) { return parseInt(p && p[k], 10) || 50; }
  function ovrOf(p) { return parseInt(p && (p._lineupOvr != null ? p._lineupOvr : p.ovr), 10) || 50; }
  function posOf(p) {
    var pos = String((p && p.pos) || 'SF').split('/')[0].trim();
    return ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(pos) >= 0 ? pos : 'SF';
  }
  function nm(p) { return (p && (p.cname || p.name)) || '球员'; }
  function pid(p) { return (p && (p._isUser ? '__user__' : (p.name || p.cname))) || 'x'; }
  function skill01(v) {
    if (typeof simSkill01 === 'function') return simSkill01(v);
    return Math.max(0, (effectiveAttr(v) - 25) / 74);
  }
  function gauss(mean, sd) {
    if (typeof simGaussian === 'function') return simGaussian(mean, sd);
    var u = Math.max(1e-6, rand()), v = Math.max(1e-6, rand());
    return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
  }
  function pickWeighted(list, weightFn) {
    if (!list || !list.length) return null;
    var total = 0, i, w, roll;
    for (i = 0; i < list.length; i++) total += Math.max(0.0001, weightFn(list[i]) || 0);
    roll = rand() * total;
    for (i = 0; i < list.length; i++) {
      roll -= Math.max(0.0001, weightFn(list[i]) || 0);
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }
  function teamName(t) { return (typeof getTeamName === 'function' ? getTeamName(t) : t) || t; }
  function teamLogoHtml(code, size) {
    var map = window.TEAM_LOGOS;
    var url = map && code && map[code];
    if (!url) return '';
    size = size || 28;
    return '<img class="pp-live-logo" src="' + esc(url) + '" width="' + size + '" height="' + size + '" alt="' + esc(code) + '">';
  }
  function teamBoardHtml(code, displayName) {
    var label = displayName || teamName(code);
    return teamLogoHtml(code, 36) + '<span>' + esc(label) + '</span>';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtClock(sec) {
    sec = Math.max(0, Number(sec) || 0);
    if (sec >= 60) {
      var m = Math.floor(sec / 60);
      var s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
    return sec.toFixed(1) + '"';
  }
  function fmtElapsed(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function elapsedSec(q, secLeft, isOT, ot, quarterSec) {
    var qSec = Number(quarterSec) || 720;
    var left = Math.max(0, Number(secLeft) || 0);
    if (!isOT) return (Math.max(1, q) - 1) * qSec + (qSec - left);
    var gameMins = (Number(quarterSec) && quarterSec < 720) ? 40 : 48;
    return gameMins * 60 + Math.max(0, (ot || 1) - 1) * 300 + (300 - left);
  }
  function periodLabel(q, isOT, ot) {
    if (isOT) return (ot && ot > 1) ? ('第' + ot + '加时') : '加时';
    return ['第一节', '第二节', '第三节', '第四节'][(q || 1) - 1] || '比赛';
  }
  function shotVerb(shot, fx) {
    if (shot === 'threePT' || shot === 'three') return '三分';
    if (shot === 'MID') return '中距离跳投';
    if (fx && fx.dunk) return '扣篮';
    if (shot === 'FIN') return '上篮';
    return '跳投';
  }
  function liveFx(ev) {
    if (!ev) return {};
    if (ev._fx) return ev._fx;
    return eventFx(ev);
  }

  function injectStyle() {
    var old = document.getElementById('pp-live-style');
    if (old) old.remove();
    var s = document.createElement('style');
    s.id = 'pp-live-style';
    s.textContent =
      '.pp-live-card{background:var(--bg);border:2px solid var(--border);border-radius:16px;width:100%;max-width:560px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.28)}' +
      '.pp-live-head{padding:16px 16px 10px;text-align:center}' +
      '.pp-live-kicker{font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--orange);letter-spacing:1px}' +
      '.pp-live-title{font-family:var(--font-display);font-size:20px;font-weight:700;margin-top:4px}' +
      '.pp-live-sub{font-size:13px;color:var(--text-dim);line-height:1.55;margin-top:8px}' +
      '.pp-live-actions{display:flex;flex-direction:row;flex-wrap:wrap;gap:8px;padding:10px 14px 14px}' +
      '.pp-live-actions .btn{flex:1;min-width:90px}' +
      '.pp-live-actions .pp-live-wide{flex:1 1 100%}' +
      '.pp-live-board{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;background:var(--bg-card);border-bottom:1px solid var(--border)}' +
      '.pp-live-team{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;font-family:var(--font-display);font-weight:700;font-size:13px}' +
      '.pp-live-logo{width:36px;height:36px;object-fit:contain;border-radius:8px;background:#fff;flex-shrink:0}' +
      '.pp-live-who .pp-live-logo{width:18px;height:18px;border-radius:4px}' +
      '.pp-live-score{font-family:var(--font-display);font-size:28px;font-weight:700;min-width:92px;text-align:center}' +
      '.pp-live-clockline{display:flex;justify-content:space-between;align-items:center;padding:6px 14px;font-size:12px;color:var(--text-dim);background:var(--bg-card);border-bottom:1px solid var(--border)}' +
      '.pp-live-clockline b{color:var(--text);font-family:var(--font-display)}' +
      '.pp-live-feed{padding:0;display:flex;flex-direction:column;gap:0;min-height:180px;max-height:38vh;overflow:auto;flex:1}' +
      '.pp-live-row{display:grid;grid-template-columns:54px 92px 1fr 56px;gap:6px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:13px;line-height:1.45;align-items:start}' +
      '.pp-live-row.is-us{background:var(--orange-bg)}' +
      '.pp-live-row.is-make .pp-live-tag{color:#1f8a4c}' +
      '.pp-live-row.is-miss .pp-live-tag{color:var(--text-dim)}' +
      '.pp-live-row.is-stop .pp-live-tag{color:var(--orange)}' +
      '.pp-live-row.is-flavor .pp-live-tag{color:var(--orange)}' +
      '.pp-live-row.is-meta{background:var(--bg-card);color:var(--text-dim);grid-template-columns:1fr;text-align:center;font-family:var(--font-display);font-size:12px}' +
      '.pp-live-time{font-family:var(--font-display);font-size:12px;color:var(--text-dim);padding-top:2px}' +
      '.pp-live-who{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text-dim);padding-top:1px;min-width:0}' +
      '.pp-live-who span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pp-live-body{min-width:0;overflow-wrap:anywhere}' +
      '.pp-live-tag{font-family:var(--font-display);font-size:11px;font-weight:700;margin-right:4px}' +
      '.pp-live-sc{font-family:var(--font-display);font-size:12px;text-align:right;color:var(--text);padding-top:1px}' +
      '.pp-live-ev{background:var(--bg-card);border:1.5px solid var(--border);border-radius:10px;padding:8px 10px;font-size:12.5px;line-height:1.55}' +
      '.pp-live-ev b{color:var(--orange)}' +
      '.pp-live-qrow{display:flex;justify-content:space-between;font-family:var(--font-display);font-size:12px;padding:3px 14px;color:var(--text-dim)}' +
      '.pp-live-final{margin:8px 12px 12px;padding:10px;border-radius:10px;text-align:center;font-family:var(--font-display)}' +
      '.pp-live-court-wrap{height:220px;background:var(--bg-card);border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
      '.pp-live-court-wrap.is-off{display:none}' +
      '.pp-live-hero{display:flex;align-items:center;gap:8px;padding:6px 12px 7px;background:var(--orange-bg);border-bottom:1px solid var(--border);flex-shrink:0}' +
      '.pp-live-hero-face{width:28px;height:28px;border-radius:50%;object-fit:cover;border:1.5px solid var(--orange);flex-shrink:0;background:#fff}' +
      '.pp-live-hero-face.is-off{display:none}' +
      '.pp-live-hero-meta{min-width:0;flex:0 1 86px}' +
      '.pp-live-hero-name{font-family:var(--font-display);font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pp-live-hero-on{font-size:10px;color:var(--text-dim);margin-top:1px}' +
      '.pp-live-hero-on.is-on{color:#1f8a4c}' +
      '.pp-live-hero-nums{flex:1;display:flex;justify-content:space-between;gap:2px;min-width:0}' +
      '.pp-live-hero-stat{text-align:center;min-width:0}' +
      '.pp-live-hero-stat b{display:block;font-family:var(--font-display);font-size:15px;font-weight:700;line-height:1.1}' +
      '.pp-live-hero-stat small{display:block;font-size:9px;color:var(--text-dim)}' +
      '.pp-live-hero-stat.is-bump b{animation:ppHeroBump .38s ease}' +
      '@keyframes ppHeroBump{0%{transform:scale(1.28);color:var(--orange)}100%{transform:scale(1)}}' +
      '@media (prefers-reduced-motion: reduce){.pp-live-hero-stat.is-bump b{animation:none}}' +
      '.pp-live-lineups{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px 10px;text-align:left}' +
      '.pp-live-lu{background:var(--bg-card);border:1.5px solid var(--border);border-radius:10px;padding:8px 8px 6px;min-width:0}' +
      '.pp-live-lu-h{display:flex;align-items:center;gap:6px;font-family:var(--font-display);font-size:12px;font-weight:700;margin-bottom:5px}' +
      '.pp-live-lu-h .pp-live-logo{width:20px;height:20px;border-radius:4px}' +
      '.pp-live-lu-row{display:flex;align-items:center;gap:4px;font-size:11px;line-height:1.35;padding:2px 0;border-top:1px solid var(--border-light);min-width:0}' +
      '.pp-live-lu-pos{width:22px;flex-shrink:0;color:var(--text-dim);font-family:var(--font-display);font-size:10px}' +
      '.pp-live-lu-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pp-live-lu-name.is-me{color:var(--orange);font-weight:700}' +
      '.pp-live-lu-ovr{flex-shrink:0;font-family:var(--font-display);font-weight:700;font-size:11px;color:var(--text-dim)}';
    document.head.appendChild(s);
  }

  /* ---------- 蓝图：与跳过引擎同一套攻防效率 ---------- */
  function creationOf(p) {
    var pos = posOf(p);
    if (typeof calcPlayerCreationRating === 'function') return calcPlayerCreationRating(p, pos);
    return attr(p, 'HAN') * 0.28 + attr(p, 'PAS') * 0.18 + attr(p, 'FIN') * 0.18 + attr(p, 'threePT') * 0.18 + attr(p, 'CLU') * 0.18;
  }

  var STYLE_IDS = [
    'cold_arrow', 'mid_craftsman', 'off_ball', 'finisher', 'dunk_threat', 'post_bully',
    'tempo_master', 'pnr_maestro', 'fast_break', 'perimeter_lock', 'rim_protector',
    'steal_instinct', 'box_out', 'iron_man', 'clutch_heart', 'leader_aura', 'ice_ft'
  ];

  function rollStyles() {
    var out = {}, i, id;
    for (i = 0; i < STYLE_IDS.length; i++) {
      id = STYLE_IDS[i];
      out[id] = 1;
      if (typeof getStyleSkillRoll === 'function') {
        try { out[id] = getStyleSkillRoll(id); } catch (e) { out[id] = 1; }
      }
    }
    return out;
  }

  function st(styles, id) {
    var v = styles && styles[id];
    return v == null ? 1 : v;
  }

  function expectedUserLine(attrs, bp, isPlayoff) {
    var pos = (typeof STATE !== 'undefined' && STATE.position) || 'SF';
    var pace = bp.pace;
    var mins = bp.userMins;
    var styles = bp.styles || {};
    var coldM = st(styles, 'cold_arrow');
    var midM = st(styles, 'mid_craftsman');
    var offBallM = st(styles, 'off_ball');
    var finishM = st(styles, 'finisher');
    var dunkM = st(styles, 'dunk_threat');
    var postM = st(styles, 'post_bully');
    var tempoM = st(styles, 'tempo_master');
    var breakM = st(styles, 'fast_break');
    var lockM = st(styles, 'perimeter_lock');
    var rimM = st(styles, 'rim_protector');
    var stealM = st(styles, 'steal_instinct');
    var boxM = st(styles, 'box_out');
    var iceM = st(styles, 'ice_ft');
    var creation = typeof calcPlayerCreationRating === 'function' ? calcPlayerCreationRating(attrs, pos) : 70;
    var creation01 = skill01(creation);
    var posUsage = { PG: 0.005, SG: 0.012, SF: 0.004, PF: -0.004, C: -0.002 };
    var usage = clamp(0.10 + Math.pow(creation01, 1.24) * 0.27 + (posUsage[pos] || 0), 0.10, 0.39);
    usage *= 1 - (offBallM - 1) * 0.35;
    usage *= 1 + (breakM - 1) * 0.18;
    usage = clamp(usage, 0.10, 0.39);
    var defensePressure = bp.defPressure;
    var teamFGA = pace * 0.896;
    var scoringAverage = (attr(attrs, 'threePT') + attr(attrs, 'MID') + attr(attrs, 'FIN')) / 3;
    var aggression = clamp(0.96 + (scoringAverage - 70) * 0.004, 0.78, 1.12);
    var scoringScale = (typeof USER_PLAYER_SCORING_SCALE === 'number') ? USER_PLAYER_SCORING_SCALE : 0.85;
    var expectedFga = teamFGA * (mins / 48) * usage * aggression * (1 - defensePressure * 1.5) * 0.90 * scoringScale;
    var dist = (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.SHOT_DIST[pos]) || { threePT: 0.32, MID: 0.22, FIN: 0.28 };
    var threeW = dist.threePT * (0.45 + Math.pow(skill01(attr(attrs, 'threePT')), 1.15) * 1.25);
    var midW = dist.MID * (0.45 + Math.pow(skill01(attr(attrs, 'MID')), 1.15) * 1.25);
    var finRating = attr(attrs, 'FIN') * 0.72 + attr(attrs, 'DNK') * 0.28;
    var finW = dist.FIN * (0.45 + Math.pow(skill01(finRating), 1.15) * 1.25);
    threeW *= 1 + (coldM - 1) * 0.55 - (postM - 1) * 0.35;
    midW *= 1 + (midM - 1) * 0.55;
    finW *= 1 + (dunkM - 1) * 0.50 + (postM - 1) * 0.60 + (breakM - 1) * 0.28;
    var distTotal = Math.max(0.001, threeW + midW + finW);
    var form = 0;
    var midPressure = defensePressure * (1 - (midM - 1) * 0.7);
    var threePct = typeof calcShotPct === 'function' ? calcShotPct('threePT', attr(attrs, 'threePT'), 0, defensePressure, form) : 0.36;
    var midPct = typeof calcShotPct === 'function' ? calcShotPct('MID', attr(attrs, 'MID'), 0, midPressure, form) : 0.42;
    var finPct = typeof calcShotPct === 'function' ? calcShotPct('FIN', finRating, 0, defensePressure, form) : 0.58;
    threePct = clampHalf(threePct * coldM * (1 + (offBallM - 1) * 0.45), 0.18, 0.52, 0.58);
    midPct = clampHalf(midPct * midM * (1 + (offBallM - 1) * 0.35), 0.22, 0.58, 0.66);
    finPct = clampHalf(finPct * (1 + (dunkM - 1) * 0.35), 0.32, 0.80, 0.88);
    var fga = expectedFga;
    var threeA = fga * (threeW / distTotal);
    var midA = fga * (midW / distTotal);
    var finA = Math.max(0, fga - threeA - midA);
    var ftRate = clamp((0.07 + skill01(attr(attrs, 'FIN')) * 0.20 + skill01(attr(attrs, 'STR')) * 0.11 + skill01(attr(attrs, 'HAN')) * 0.06) * finishM, 0.07, 0.62);
    var freeThrowRating = attr(attrs, 'CLU') * 0.5 + attr(attrs, 'MID') * 0.25 + attr(attrs, 'threePT') * 0.25;
    var ftPct = typeof calcShotPct === 'function' ? calcShotPct('FT', freeThrowRating, 0, 0, 0) : 0.78;
    ftPct = clampHalf(ftPct * iceM, 0.50, 0.96, 0.99);
    var pts = threeA * threePct * 3 + midA * midPct * 2 + finA * finPct * 2 + fga * ftRate * ftPct;
    var rebBase = { PG: 1.2, SG: 1.4, SF: 1.8, PF: 2.5, C: 3.0 };
    var rebCeil = { PG: 7.0, SG: 7.2, SF: 9.0, PF: 11.5, C: 13.2 };
    var astBase = { PG: 0.8, SG: 0.6, SF: 0.6, PF: 0.5, C: 0.5 };
    var astCeil = { PG: 12.0, SG: 9.2, SF: 8.8, PF: 9.0, C: 10.0 };
    var playmaking = attr(attrs, 'PAS') * 0.65 + attr(attrs, 'HAN') * 0.25 + attr(attrs, 'CLU') * 0.10;
    var reb36 = ((rebBase[pos] || 1.8) + Math.pow(skill01(attr(attrs, 'REB')), 1.20) * (rebCeil[pos] || 9)) * boxM;
    var ast36 = ((astBase[pos] || 0.6) + Math.pow(skill01(playmaking), 1.32) * (astCeil[pos] || 8.8)) * tempoM;
    var pointDefense = attr(attrs, 'PDEF') * 0.70 + attr(attrs, 'ATH') * 0.20 + attr(attrs, 'HAN') * 0.10;
    var stl36 = (0.25 + Math.pow(skill01(pointDefense), 1.25) * 2.05) * lockM * stealM;
    var rimDefense = attr(attrs, 'BLK') * 0.72 + attr(attrs, 'IDEF') * 0.20 + attr(attrs, 'ATH') * 0.08;
    var blk36 = (({ PG: 0.04, SG: 0.05, SF: 0.08, PF: 0.14, C: 0.20 }[pos] || 0.08)
      + Math.pow(skill01(rimDefense), 1.35) * ({ PG: 1.15, SG: 1.35, SF: 2.10, PF: 3.30, C: 4.20 }[pos] || 2.1))
      * rimM * (1 + (dunkM - 1) * 0.25);
    var control = attr(attrs, 'HAN') * 0.58 + attr(attrs, 'PAS') * 0.27 + attr(attrs, 'CLU') * 0.15;
    var tov36 = clamp((0.65 + usage * 7.5 + ast36 * 0.14 - skill01(control) * 1.0) / (1 + (tempoM - 1) * 0.7) * (1 + (stealM - 1) * 0.25), 0.45, 5.5);
    var paceScale = pace / 99.4;
    return {
      usage: usage,
      mins: mins,
      fga: fga,
      pts: pts,
      reb: reb36 * mins / 36 * paceScale,
      ast: ast36 * mins / 36 * paceScale,
      stl: stl36 * mins / 36 * paceScale,
      blk: blk36 * mins / 36 * paceScale,
      tov: tov36 * mins / 36 * paceScale,
      threePct: threePct,
      midPct: midPct,
      finPct: finPct,
      threeShare: threeW / distTotal
    };
  }

  function buildBlueprint(teamA, teamB, options) {
    options = options || {};
    var powerA = options.customPowerA || (typeof calcTeamPowerWithPlayer === 'function' ? calcTeamPowerWithPlayer(teamA) : { offense: 70, defense: 70, athletic: 70, clutch: 70, depth: 70 });
    var powerB = options.customPowerB || (typeof calcTeamPowerWithPlayer === 'function' ? calcTeamPowerWithPlayer(teamB) : { offense: 70, defense: 70, athletic: 70, clutch: 70, depth: 70 });
    var baseline = typeof getSimulationPowerBaseline === 'function' ? getSimulationPowerBaseline() : { offense: 70, defense: 70, athletic: 70, depth: 70 };
    var modA = options.neutralState ? { offense: 0, defense: 0, variance: 0 } : (typeof getCareerTeamGameModifiers === 'function' ? getCareerTeamGameModifiers(teamA) : { offense: 0, defense: 0, variance: 0 });
    var modB = options.neutralState ? { offense: 0, defense: 0, variance: 0 } : (typeof getCareerTeamGameModifiers === 'function' ? getCareerTeamGameModifiers(teamB) : { offense: 0, defense: 0, variance: 0 });
    var teamAHome = options.teamAHome !== false;
    var homeA = teamAHome ? 0.018 : 0;
    var homeB = teamAHome ? 0 : 0.018;
    if (!options.neutralState && typeof getCareerProfileEffects === 'function') {
      var fan = Number(getCareerProfileEffects().homeCourtBonus) || 0;
      if (teamA === STATE.careerTeam && teamAHome) homeA += fan;
      if (teamB === STATE.careerTeam && !teamAHome) homeB += fan;
    }
    var fatigueA = Number(options.fatigueA) || 0;
    var fatigueB = Number(options.fatigueB) || 0;
    if (fatigueA && teamA === STATE.careerTeam && typeof getStyleSkillMu === 'function') {
      var ironMu = getStyleSkillMu('iron_man');
      if (ironMu > 1) fatigueA *= Math.max(0.35, 1 - (ironMu - 1) * 3.5);
    }
    var averageAthletic = ((Number(powerA.athletic) || 60) + (Number(powerB.athletic) || 60)) / 2;
    var averageDepth = ((Number(powerA.depth) || 60) + (Number(powerB.depth) || 60)) / 2;
    var pace = clamp(Math.round(99.4 + (averageAthletic - baseline.athletic) * 0.08 + (averageDepth - baseline.depth) * 0.02 + gauss(0, 2.8)), 90, 109);
    if (!options.neutralState && (teamA === STATE.careerTeam || teamB === STATE.careerTeam) && typeof getStyleSkillMu === 'function') {
      var paceAdj = 0;
      var tempoMu = getStyleSkillMu('tempo_master');
      var breakMu = getStyleSkillMu('fast_break');
      var postMu = getStyleSkillMu('post_bully');
      if (tempoMu > 1) paceAdj += (tempoMu - 1) * 8;
      if (breakMu > 1) paceAdj += (breakMu - 1) * 10;
      if (postMu > 1) paceAdj -= (postMu - 1) * 8;
      if (paceAdj) pace = clamp(Math.round(pace + paceAdj), 90, 109);
    }
    var edgeA = ((powerA.offense - baseline.offense) + modA.offense) - ((powerB.defense - baseline.defense) + modB.defense);
    var edgeB = ((powerB.offense - baseline.offense) + modB.offense) - ((powerA.defense - baseline.defense) + modA.defense);
    var depthEdge = ((Number(powerA.depth) || 60) - (Number(powerB.depth) || 60)) * 0.00075;
    var seedPts = (Number(options.seedBonus) || 0) * 0.65;
    var injuryPts = options.probMultiplier == null ? 0 : (Number(options.probMultiplier) - 1) * 28;
    var efficiencyA = clamp(1.154 + edgeA * 0.0034 + depthEdge + homeA - fatigueA * 0.012 + seedPts / pace + injuryPts / pace, 0.91, 1.36);
    var efficiencyB = clamp(1.154 + edgeB * 0.0034 - depthEdge + homeB - fatigueB * 0.012 - seedPts / pace, 0.91, 1.36);
    var lineupA = options.customLineupA || (typeof calcTeamLineup === 'function' ? calcTeamLineup(teamA) : { starters: {}, bench: [], isUserStarter: false });
    var lineupB = options.customLineupB || (typeof calcTeamLineup === 'function' ? calcTeamLineup(teamB) : { starters: {}, bench: [], isUserStarter: false });
    var rosterSize = Math.max(10, Math.min(12, Number(options.rosterSize) || 10));
    var userMins = 28;
    if (options.allStarExhibition) {
      userMins = Number(options.userAllStarMins) || 22;
    } else if (teamA === STATE.careerTeam && typeof getPlayerRotationMinutes === 'function') {
      userMins = getPlayerRotationMinutes(options.attrs || STATE.attrs, STATE.position || 'SF', !!options.isPlayoff);
    }
    var defPressure = clamp((Number(powerB.defense) - baseline.defense) * 0.003, -0.035, 0.045);
    var bp = {
      teamA: teamA, teamB: teamB, teamAHome: teamAHome, isPlayoff: !!options.isPlayoff,
      powerA: powerA, powerB: powerB, baseline: baseline,
      pace: pace, efficiencyA: efficiencyA, efficiencyB: efficiencyB,
      edgeA: edgeA, edgeB: edgeB, modA: modA, modB: modB,
      expA: pace * efficiencyA, expB: pace * efficiencyB,
      lineupA: lineupA, lineupB: lineupB,
      rosterA: rosterFromLineup(lineupA, rosterSize), rosterB: rosterFromLineup(lineupB, rosterSize),
      userStarter: options.allStarExhibition
        ? !!lineupA.isUserStarter
        : !!(lineupA.isUserStarter && !(STATE.career && STATE.career.flags && STATE.career.flags.startBench)),
      userMins: userMins, defPressure: defPressure,
      varianceA: clamp(6.4 + (modA.variance || 0), 4.6, 10),
      varianceB: clamp(6.4 + (modB.variance || 0), 4.6, 10),
      styles: rollStyles()
    };
    bp.tgtA = clamp(Math.round(bp.pace * bp.efficiencyA + gauss(0, bp.varianceA)), 80, 155);
    bp.tgtB = clamp(Math.round(bp.pace * bp.efficiencyB + gauss(0, bp.varianceB)), 80, 155);
    if (!options.allStarExhibition) {
      bp.user = expectedUserLine(options.attrs || STATE.attrs || {}, bp, bp.isPlayoff);
      bp.userMins = bp.user.mins;
    }
    if (options.allStarExhibition) {
      bp._allStarExhibition = true;
      bp._quarterSec = Number(options.quarterSec) || 600;
      bp._gameMins = Number(options.gameMins) || 40;
      bp._noOT = !!options.noOT;
      bp.displayNameA = options.displayNameA || '';
      bp.displayNameB = options.displayNameB || '';
      bp.pace = clamp(Math.round(102 + gauss(0, 2.2)), 98, 108);
      bp.efficiencyA = clamp(1.118 + gauss(0, 0.035), 1.02, 1.28);
      bp.efficiencyB = clamp(1.118 + gauss(0, 0.035), 1.02, 1.28);
      bp.expA = bp.pace * bp.efficiencyA;
      bp.expB = bp.pace * bp.efficiencyB;
      bp.varianceA = 8.2;
      bp.varianceB = 8.2;
      bp.defPressure = 0;
      bp.tgtA = clamp(Math.round(bp.pace * bp.efficiencyA + gauss(0, bp.varianceA)), 95, 145);
      bp.tgtB = clamp(Math.round(bp.pace * bp.efficiencyB + gauss(0, bp.varianceB)), 95, 145);
    }
    if (options.debugReboundLab) bp._debugReboundLab = true;
    if (options.flavorLab) bp._flavorLab = true;
    if (options.threeOnlyLab) bp._threeOnlyLab = true;
    return bp;
  }

  function rosterFromLineup(lineup, max) {
    max = Math.max(5, Number(max) || 10);
    var order = ['PG', 'SG', 'SF', 'PF', 'C'];
    var starters = order.map(function (k) { return lineup.starters && lineup.starters[k]; }).filter(Boolean);
    if (starters.length < 5) {
      var extra = Object.keys(lineup.starters || {}).map(function (k) { return lineup.starters[k]; }).filter(Boolean);
      extra.sort(function (a, b) { return ovrOf(b) - ovrOf(a); });
      extra.forEach(function (p) {
        if (starters.length < 5 && starters.indexOf(p) < 0) starters.push(p);
      });
    }
    var used = {};
    starters.forEach(function (p) { used[pid(p)] = true; });
    var bench = (lineup.bench || []).slice().sort(function (a, b) { return ovrOf(b) - ovrOf(a); }).filter(function (p) {
      return p && !used[pid(p)];
    });
    var roster = starters.concat(bench);
    var user = roster.filter(function (p) { return p && p._isUser; })[0]
      || (lineup.bench || []).filter(function (p) { return p && p._isUser; })[0]
      || (lineup.allPlayers || []).filter(function (p) { return p && p._isUser; })[0];
    if (user && !roster.slice(0, max).some(function (p) { return p && p._isUser; })) {
      if (roster.length >= max) roster[max - 1] = user;
      else roster.push(user);
    }
    return roster.slice(0, max);
  }

  function roster10(lineup) {
    return rosterFromLineup(lineup, 10);
  }

  function emptyLine() {
    return { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, twoM: 0, mins: 0 };
  }

  /* ---------- 回合引擎 ---------- */
  function makeGameState(bp) {
    var lines = {};
    function addRoster(roster) {
      roster.forEach(function (p) { lines[pid(p)] = emptyLine(); });
    }
    addRoster(bp.rosterA);
    addRoster(bp.rosterB);
    return {
      bp: bp,
      scoreA: 0, scoreB: 0,
      qA: [0, 0, 0, 0], qB: [0, 0, 0, 0],
      otA: 0, otB: 0, ot: 0,
      lines: lines,
      tags: {},
      windows: [],
      fouls: {},
      last6: { A: [], B: [] },
      events: [],
      feed: [],
      plays: [],
      profile: {},
      spotlightUsed: false,
      eventCount: 0,
      cooldown: 0,
      scheme: 'drop',
      possA: 0,
      possB: 0,
      regPossA: 0,
      regPossB: 0,
      tgtA: bp.tgtA,
      tgtB: bp.tgtB,
      styles: bp.styles || {},
      formA: gauss(0, 0.016 * 1.20 / Math.max(1, st(bp.styles, 'leader_aura'))),
      formB: gauss(0, 0.016),
      _courtLive: false
    };
  }

  function stintOf(q, secLeft, margin, isOT, opts) {
    opts = opts || {};
    if (opts.allStar) {
      var qSec = Number(opts.quarterSec) || 600;
      var played = (qSec - secLeft) / 60;
      if (played < 3) return 'starters';
      if (played < 6) return 'mix';
      if (played < 9) return 'bench';
      return 'mix';
    }
    if (isOT) return Math.abs(margin) >= 10 ? 'mix' : 'starters';
    var played = (720 - secLeft) / 60;
    if (q === 4 && Math.abs(margin) >= 18 && played >= 3) return 'bench';
    if (q === 4 && Math.abs(margin) <= 8) return 'starters';
    if ((q === 1 || q === 3) && played < 8.6) return 'starters';
    if (q === 2 && played >= 4.2) return 'starters';
    if (q === 4 && played < 8) return 'starters';
    if ((q === 1 || q === 3) && played >= 8.6) return 'bench';
    if (q === 2 && played < 4.2) return 'bench';
    return 'mix';
  }

  function pickCourt(roster, stint, userOn, userPlayer) {
    var starters = roster.slice(0, 5);
    var bench = roster.slice(5);
    var unit;
    if (stint === 'starters') unit = starters.slice();
    else if (stint === 'bench') unit = bench.length >= 5 ? bench.slice() : starters.slice(3).concat(bench).slice(0, 5);
    else {
      unit = starters.slice(0, 3).concat(bench.slice(0, 2));
      if (unit.length < 5) unit = starters.slice();
    }
    if (userPlayer) {
      var hasUser = unit.some(function (p) { return p && p._isUser; });
      if (userOn && !hasUser) {
        unit[unit.length - 1] = userPlayer;
      } else if (!userOn && hasUser) {
        var fill = (stint === 'bench' ? bench : starters).filter(function (p) { return p && !p._isUser; })[0];
        if (fill) {
          unit = unit.map(function (p) { return p && p._isUser ? fill : p; });
        }
      }
    }
    var seen = {};
    unit = unit.filter(function (p) {
      if (!p) return false;
      var id = pid(p);
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    });
    while (unit.length < 5 && roster[unit.length]) unit.push(roster[unit.length]);
    return unit.slice(0, 5);
  }

  function userWantedOn(game, stint, q, secLeft, margin, isOT) {
    var bp = game.bp;
    var user = bp.rosterA.filter(function (p) { return p && p._isUser; })[0];
    if (!user) return false;
    var played = (game.lines[pid(user)] && game.lines[pid(user)].mins) || 0;
    var left = Math.max(0.4, remainingMins(q, secLeft, isOT, game));
    var need = bp.userMins - played;
    if (need <= -1.2 && !(q === 4 && Math.abs(margin) <= 6 && bp.userMins >= 20)) return false;
    if (need <= 0.85 && stint === 'mix' && !(q === 4 && Math.abs(margin) <= 8)) return false;
    if (need / left > 0.78) return true;
    if (bp.userStarter) return stint !== 'bench';
    if (q === 4 && Math.abs(margin) <= 8 && ovrOf(user) >= 78 && bp.userMins >= 22) return true;
    if (bp.userMins <= 18) return stint === 'bench' || (stint === 'mix' && need > 0);
    return stint !== 'starters';
  }

  function remainingMins(q, secLeft, isOT, game) {
    var qSec = (game.bp && game.bp._quarterSec) || 720;
    var qMins = qSec / 60;
    if (isOT) return secLeft / 60;
    var left = secLeft / 60 + Math.max(0, 4 - q) * qMins;
    if (game.scoreA === game.scoreB && q === 4 && secLeft < 20 && !game.bp._allStarExhibition) left += 5;
    return left;
  }

  function ftSkill(p) {
    return (attr(p, 'CLU') * 0.5 + attr(p, 'MID') * 0.25 + attr(p, 'threePT') * 0.25) / 99;
  }

  function playerFits(p, when, fx, asActor) {
    if (!p) return false;
    when = when || {};
    fx = fx || {};
    var pos = posOf(p);
    if (asActor && when.pos) {
      var allowed = String(when.pos).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (allowed.length && allowed.indexOf(pos) < 0) return false;
    }
    function gate(key, attrKey) {
      if (when[key] == null) return true;
      return attr(p, attrKey) >= when[key];
    }
    if (!asActor) return true;
    if (!gate('three', 'threePT')) return false;
    if (!gate('mid', 'MID')) return false;
    if (!gate('fin', 'FIN')) return false;
    if (!gate('han', 'HAN')) return false;
    if (!gate('ath', 'ATH')) return false;
    if (!gate('pas', 'PAS')) return false;
    if (!gate('dnk', 'DNK')) return false;
    if (!gate('blk', 'BLK')) return false;
    if (!gate('reb', 'REB')) return false;
    if (!gate('pdef', 'PDEF')) return false;
    if (!gate('str', 'STR')) return false;
    if (when.hanLow && attr(p, 'HAN') >= 72) return false;
    if (when.ftMax != null && ftSkill(p) > when.ftMax) return false;
    if (when.ftMin != null && ftSkill(p) < when.ftMin) return false;
    if (when.ftBad && ftSkill(p) >= 0.62) return false;
    if (when.userFtBad && (!p._isUser || ftSkill(p) >= 0.62)) return false;
    if (when.threeOpp != null && attr(p, 'threePT') < when.threeOpp) return false;
    if (fx.dunk && attr(p, 'DNK') < 80) return false;
    if (fx.hack && ftSkill(p) >= 0.62) return false;
    if (fx.blk && attr(p, 'BLK') < 72) return false;
    if (fx.stl && attr(p, 'PDEF') < 74) return false;
    if ((fx.shot === 'three' || fx.shot === 'threePT') && attr(p, 'threePT') < 74) return false;
    if (fx.shot === 'MID' && attr(p, 'MID') < 68) return false;
    return true;
  }

  function roleOn(court, role, exclude, pred) {
    var list = (court || []).filter(function (p) {
      if (!p) return false;
      if (exclude && pid(p) === pid(exclude)) return false;
      if (pred && !pred(p)) return false;
      return true;
    });
    if (!list.length) return null;
    if (role === 'user') return list.filter(function (p) { return p._isUser; })[0] || null;
    if (role === 'dunker' || role === 'finisher') {
      return list.filter(function (p) { return attr(p, 'DNK') >= 78; })
        .sort(function (a, b) { return (attr(b, 'DNK') * 1.2 + attr(b, 'ATH') * 0.3) - (attr(a, 'DNK') * 1.2 + attr(a, 'ATH') * 0.3); })[0] || null;
    }
    if (role === 'thief' || role === 'lock') {
      return list.slice().sort(function (a, b) {
        return (attr(b, 'PDEF') * 1.4 + attr(b, 'HAN') * 0.3) - (attr(a, 'PDEF') * 1.4 + attr(a, 'HAN') * 0.3);
      })[0];
    }
    if (role === 'star' || role === 'our_star' || role === 'opp_star') {
      return list.slice().sort(function (a, b) { return ovrOf(b) - ovrOf(a); })[0];
    }
    if (role === 'pg' || role === 'our_pg' || role === 'opp_pg') {
      return list.filter(function (p) { return posOf(p) === 'PG'; })[0]
        || list.slice().sort(function (a, b) { return attr(b, 'PAS') - attr(a, 'PAS'); })[0]
        || null;
    }
    if (role === 'wing' || role === 'our_wing' || role === 'opp_wing' || role === 'shooter' || role === 'our_shooter' || role === 'opp_shooter') {
      return list.slice().sort(function (a, b) { return attr(b, 'threePT') - attr(a, 'threePT'); })[0];
    }
    if (role === 'big' || role === 'our_big' || role === 'opp_big' || role === 'rim' || role === 'opp_rim') {
      var bigs = list.filter(function (p) { return posOf(p) === 'C' || posOf(p) === 'PF'; });
      if (!bigs.length) return null;
      if (role === 'rim' || role === 'opp_rim') {
        return bigs.slice().sort(function (a, b) { return (attr(b, 'BLK') + attr(b, 'IDEF')) - (attr(a, 'BLK') + attr(a, 'IDEF')); })[0];
      }
      return bigs.slice().sort(function (a, b) { return (attr(b, 'REB') + attr(b, 'STR')) - (attr(a, 'REB') + attr(a, 'STR')); })[0];
    }
    if (role === 'bench') {
      return list.filter(function (p) { return !p._isUser; }).sort(function (a, b) { return ovrOf(b) - ovrOf(a); })[0] || list[0];
    }
    return list[0];
  }

  function eventFx(ev) {
    var fx = {};
    var src = (ev && ev.fx) || {};
    Object.keys(src).forEach(function (k) { fx[k] = src[k]; });
    if (!fx.dunk && /扣|空接|砸筐/.test(String((ev && ev.name) || '') + String((ev && ev.text) || ''))) {
      fx.dunk = true;
    }
    return fx;
  }

  function defaultActorRole(ev) {
    var fx = eventFx(ev);
    var when = ev.when || {};
    var needs = parseNeed(when.need);
    if (needs[0]) return needs[0];
    if (when.userFtBad || when.userOffBall) return 'user';
    if (fx.dunk) return 'dunker';
    if (fx.hack && fx.opp) return 'big';
    if (fx.hack) return 'user';
    if (fx.blk) return fx.opp ? 'opp_rim' : 'rim';
    if (fx.stl) return 'thief';
    if (fx.shot === 'three' || fx.shot === 'threePT') return 'shooter';
    return 'star';
  }

  function actorCourtFor(ev, ctx) {
    var fx = eventFx(ev);
    var role = defaultActorRole(ev);
    if (fx.hack && fx.opp) return ctx.offCourt;
    if (fx.stl || fx.blk) return ctx.defCourt;
    if (fx.opp && (fx.shot || (fx.off && fx.off > 0)) && !fx.blk) return ctx.offCourt;
    return courtForNeed(role, ctx);
  }

  function shotPctFor(player, type, defP, form, clutchMul, userBoost) {
    var a;
    if (type === 'threePT') a = attr(player, 'threePT');
    else if (type === 'MID') a = attr(player, 'MID');
    else if (type === 'FT') a = attr(player, 'CLU') * 0.5 + attr(player, 'MID') * 0.25 + attr(player, 'threePT') * 0.25;
    else a = attr(player, 'FIN') * 0.72 + attr(player, 'DNK') * 0.28;
    var pct;
    if (typeof calcShotPct === 'function') pct = calcShotPct(type === 'FIN' ? 'FIN' : type, a, 0, defP, form);
    else {
      var base = { threePT: 0.34, MID: 0.41, FIN: 0.56, FT: 0.76 }[type] || 0.4;
      pct = base + skill01(a) * 0.12 - defP * 0.8;
    }
    pct *= clutchMul || 1;
    if (userBoost) pct *= userBoost;
    if (type === 'threePT') return clampHalf(pct, 0.18, 0.48, 0.56);
    if (type === 'MID') return clampHalf(pct, 0.22, 0.56, 0.64);
    if (type === 'FIN') return clampHalf(pct, 0.32, 0.78, 0.88);
    return clampHalf(pct, 0.50, 0.95, 0.98);
  }

  function styleMul(id, game) {
    if (game && game.styles) return st(game.styles, id);
    if (typeof getStyleSkillMu === 'function') {
      try { return getStyleSkillMu(id) || 1; } catch (e) { return 1; }
    }
    return 1;
  }

  function userLiveScoringScale() {
    var base = (typeof USER_PLAYER_SCORING_SCALE === 'number') ? USER_PLAYER_SCORING_SCALE : 0.85;
    return base * 0.94;
  }

  function pickShooter(court, userOnCourt, usage, clutch) {
    var user = court.filter(function (p) { return p && p._isUser; })[0];
    if (userOnCourt && user && usage > 0) {
      var uUsage = clamp(usage * userLiveScoringScale(), 0.06, 0.39);
      if (chance(uUsage)) return user;
    }
    var pool = (userOnCourt && user) ? court.filter(function (p) { return p && !p._isUser; }) : court;
    if (!pool.length) pool = court;
    if (clutch) {
      return pickWeighted(pool, function (p) {
        return Math.pow(skill01(creationOf(p)), 1.2) * (0.7 + skill01(attr(p, 'CLU')) * 0.8);
      });
    }
    return pickWeighted(pool, function (p) {
      return Math.pow(skill01(creationOf(p)), 1.35) * (0.35 + ovrOf(p) / 120);
    });
  }

  function pickShotType(player, distHint, styles) {
    var pos = posOf(player);
    var dist = (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.SHOT_DIST[pos]) || { threePT: 0.3, MID: 0.22, FIN: 0.3 };
    var three = dist.threePT * (0.45 + Math.pow(skill01(attr(player, 'threePT')), 1.15) * 1.25);
    var mid = dist.MID * (0.45 + Math.pow(skill01(attr(player, 'MID')), 1.15) * 1.25);
    var fin = dist.FIN * (0.45 + Math.pow(skill01(attr(player, 'FIN') * 0.72 + attr(player, 'DNK') * 0.28), 1.15) * 1.25);
    if (player && player._isUser && styles) {
      three *= 1 + (st(styles, 'cold_arrow') - 1) * 0.55 - (st(styles, 'post_bully') - 1) * 0.35;
      mid *= 1 + (st(styles, 'mid_craftsman') - 1) * 0.55;
      fin *= 1 + (st(styles, 'dunk_threat') - 1) * 0.50 + (st(styles, 'post_bully') - 1) * 0.60 + (st(styles, 'fast_break') - 1) * 0.28;
    }
    if (distHint === 'three') { three *= 2.2; mid *= 0.6; fin *= 0.5; }
    if (distHint === 'MID') { mid *= 2.1; }
    if (distHint === 'FIN') { fin *= 2.2; three *= 0.45; }
    var t = three + mid + fin;
    var r = rand() * t;
    if (r < three) return 'threePT';
    if (r < three + mid) return 'MID';
    return 'FIN';
  }

  function lineOf(game, p) {
    var id = pid(p);
    if (!game.lines[id]) game.lines[id] = emptyLine();
    return game.lines[id];
  }

  function addMins(game, court, seconds) {
    var m = seconds / 60;
    court.forEach(function (p) { if (p) lineOf(game, p).mins += m; });
  }

  function addScore(game, side, pts, qIdx, isOT) {
    if (side === 'A') {
      game.scoreA += pts;
      if (isOT) game.otA += pts;
      else game.qA[qIdx] += pts;
    } else {
      game.scoreB += pts;
      if (isOT) game.otB += pts;
      else game.qB[qIdx] += pts;
    }
  }

  function recordShot(game, shooter, type, made, pts, passer, side, qIdx, isOT) {
    var ln = lineOf(game, shooter);
    ln.fga++;
    if (type === 'threePT') ln.threeA++;
    if (made) {
      ln.fgm++;
      if (type === 'threePT') ln.threeM++;
      else ln.twoM++;
      ln.pts += pts;
      addScore(game, side, pts, qIdx, isOT);
      if (passer && pid(passer) !== pid(shooter)) lineOf(game, passer).ast++;
    }
    var arr = game.last6[side];
    arr.push(made ? 1 : 0);
    if (arr.length > 6) arr.shift();
  }

  function windowMod(game, side, kind, decay) {
    var sum = 0;
    game.windows = game.windows.filter(function (w) { return w.left > 0; });
    game.windows.forEach(function (w) {
      if (w.side === side) sum += (w[kind] || 0);
      if (decay) w.left--;
    });
    return sum;
  }

  function isHot(game, side, player) {
    var arr = game.last6[side] || [];
    if (arr.length < 5) return false;
    var made = arr.reduce(function (s, v) { return s + v; }, 0);
    return made >= 5;
  }
  function isCold(game, side) {
    var arr = game.last6[side] || [];
    if (arr.length < 5) return false;
    return arr.reduce(function (s, v) { return s + v; }, 0) <= 1;
  }

  function paceOfStar(game, player, qIdx) {
    if (!player) return 0;
    var pts = lineOf(game, player).pts;
    var mins = Math.max(1, lineOf(game, player).mins);
    return pts / mins * 36;
  }

  /* ---------- 事件 ---------- */
  function E(id, name, cat, w, when, text, fx, extra) {
    extra = extra || {};
    return { id: id, name: name, cat: cat, w: w, when: when || {}, text: text, fx: fx || {}, extra: extra };
  }

  var LIVE_EVENTS = [
    E('a01', '跳球后第一攻', 'open', 12, { q: 1, early: true }, '{actor}接球推进，这是今晚第一攻。', { off: 0.08 }),
    E('a02', '客场开场哑火', 'open', 8, { q: 1, early: true, road: true }, '客场前几分钟球在圈外转，{actor}的第一下出手也偏了。', { off: -0.03, window: 4, windowOff: -0.02 }),
    E('a03', '主场第一记三分', 'open', 10, { q: 1, early: true, home: true, need: 'shooter' }, '{actor}在主场第一记三分出手。', { off: 0.05, shot: 'three' }),
    E('a04', '开场转换成势', 'open', 9, { q: 1, early: true }, '两边都想先打转换。{actor}推着往前走。', { off: 0.05, window: 3, windowOff: 0.04, grant: 'transition' }),
    E('a05', '开场半场磨', 'open', 8, { q: 1, early: true, forbid: 'transition' }, '对方护筐顶在禁区，这球只能半场磨。', { off: -0.03, grant: 'grind' }),
    E('a06', '开场两记打铁', 'open', 9, { q: 1, cold: true }, '前两下都没进。{actor}得把球先动起来。', { grant: 'committee' }),
    E('a07', '开场连进', 'open', 9, { q: 1, hot: true }, '{actor}开场两球都进，对位开始沉下来。', { grant: 'hero_hunt' }),
    E('a08', '开场被打8-0', 'open', 7, { q: 1, down8: true }, '暂停。教练改口令：先把防守站稳。', { scheme: 'drop', grant: 'scheme_change' }),
    E('a09', '背靠背腿沉', 'open', 8, { b2b: true, qMax: 2 }, '第二场的腿明显沉。{actor}第一下突破少了半步。', { off: -0.04, window: 5, windowOff: -0.03 }),
    E('a10', '全国转播开场', 'open', 5, { national: true, q: 1 }, '转播机位比平时多。{actor}拍了拍地板。', {}),

    E('b01', '中路挡拆下滑', 'tactics', 14, { need: 'pg,big', forbid: 'hack_a' }, '{helper}给{actor}挡住，自己下滑。', { off: 0.12, shot: 'FIN', helperAst: true }),
    E('b02', '挡拆外弹', 'tactics', 12, { need: 'pg,shooter', three: 78 }, '{helper}挡完弹到弧顶，{actor}把球给出去。', { off: 0.11, shot: 'three', helperAst: true }),
    E('b03', '西班牙挡拆', 'tactics', 10, { need: 'pg,big,wing' }, '西班牙挡拆：{helper}反跑，{actor}早出球。', { off: 0.10, shot: 'three' }),
    E('b04', '牛角双掩护', 'tactics', 10, {}, '牛角位双掩护，{actor}从缝里走出来。', { off: 0.09, shot: 'MID' }),
    E('b05', 'Floppy底线', 'tactics', 11, { need: 'shooter' }, '{actor}从底线掩护里钻出来。', { off: 0.10, shot: 'three' }),
    E('b06', '手递手出角', 'tactics', 11, { need: 'pg,shooter' }, '{helper}手递手给到{actor}底角。', { off: 0.11, shot: 'three', helperAst: true }),
    E('b07', '电梯门', 'tactics', 8, { qMin: 2, need: 'shooter' }, '电梯门合上，{actor}接球就拔。', { off: 0.12, shot: 'three' }),
    E('b08', '弱侧清空单打', 'tactics', 12, { tags: 'hero_hunt', need: 'star' }, '弱侧清空。这球只留给{actor}。', { off: 0.11, grant: 'hero_hunt' }),
    E('b09', '额外传球', 'tactics', 12, { forbid: 'hero_hunt' }, '{actor}多传一次。球到了更合适的人手里。', { off: 0.08, grant: 'committee' }),
    E('b10', '假挡真切', 'tactics', 10, { need: 'big' }, '{actor}假挡真切，往篮下钻。', { off: 0.11, shot: 'FIN' }),
    E('b11', 'Delay拖挡拆', 'tactics', 7, { marginMax: 12 }, '消耗时间的挡拆。{actor}把钟走到个位数。', { clock: 1 }),
    E('b12', 'Pistol侧挡', 'tactics', 9, { need: 'wing' }, '侧翼侧挡，{actor}走中距离。', { off: 0.09, shot: 'MID' }),
    E('b13', 'Hammer底角', 'tactics', 9, { tags: 'transition', need: 'shooter' }, '转换收成Hammer，底角{actor}。', { off: 0.10, shot: 'three' }),
    E('b14', 'Horns Flash', 'tactics', 8, {}, '牛角切出，{actor}中距离出手。', { off: 0.08, shot: 'MID' }),
    E('b15', '倒挡给大个', 'tactics', 9, { need: 'big', forbid: 'hack_a' }, '倒挡把{actor}送到禁区。', { off: 0.11, shot: 'FIN' }),
    E('b16', '挡拆被夹', 'tactics', 10, { scheme: 'blitz' }, '对方夹持球，{actor}必须早出球。', { tov: 0.06, off: -0.02 }),
    E('b17', '短挡拆早出', 'tactics', 10, { scheme: 'blitz', need: 'shooter' }, '夹出来的弱侧，球到{actor}。', { off: 0.10, shot: 'three' }),
    E('b18', '拒绝掩护改单打', 'tactics', 9, { need: 'star' }, '{actor}拒绝掩护，自己走。', { off: 0.08, grant: 'hero_hunt' }),

    E('c01', '底线后仰', 'iso', 12, { need: 'star', mid: 78 }, '{actor}在底线后仰。', { off: 0.13, shot: 'MID' }),
    E('c02', '金鸡独立', 'iso', 8, { need: 'big', mid: 76 }, '{actor}金鸡独立，对位只能伸手。', { off: 0.12, shot: 'MID' }),
    E('c03', '梦幻脚步', 'iso', 8, { need: 'big', fin: 80 }, '{actor}连续假动作，最后一步到篮下。', { off: 0.14, shot: 'FIN' }),
    E('c04', '欧洲步', 'iso', 10, { ath: 80 }, '{actor}欧洲步过了最后一人。', { off: 0.11, shot: 'FIN' }),
    E('c05', '变向过第一人', 'iso', 10, { han: 82 }, '{actor}一个变向过掉第一人。', { off: 0.10 }),
    E('c06', '背身三威胁', 'iso', 9, { need: 'big' }, '{actor}背身三威胁，等协防。', { off: 0.09, shot: 'FIN' }),
    E('c07', '清空一侧', 'iso', 11, { tags: 'hero_hunt' }, '一侧完全清空。{actor}持球。', { off: 0.11, grant: 'hero_hunt' }),
    E('c08', '二当家接管', 'iso', 9, { forbid: 'hero_hunt', coldStar: true }, '核手冷。这球改由{actor}来处理。', { off: 0.09 }),
    E('c09', '内线造杀伤', 'iso', 11, { need: 'big' }, '{actor}往里扛，造犯规。', { foul: true, shot: 'FIN' }),
    E('c10', '中距离诊所', 'iso', 8, { hot: true, mid: 76 }, '{actor}连续中距离，对位开始后撤。', { off: 0.06, window: 4, windowOff: 0.05, shot: 'MID' }),
    E('c11', '冲击内线连攻', 'iso', 8, { ath: 82 }, '{actor}连续往里冲。', { window: 3, windowOff: 0.05, shot: 'FIN' }),
    E('c12', '高位发牌', 'iso', 10, { need: 'big', pas: 78 }, '{actor}提到高位，一眼找到空切。', { off: 0.10, helperAst: true }),
    E('c13', '无球空切', 'iso', 10, { userOffBall: true }, '{actor}无球空切，球到了。', { off: 0.11, shot: 'FIN' }),
    E('c14', '错位点名', 'iso', 10, { mismatch: true }, '换防出现错位。{actor}点名打。', { off: 0.11 }),

    E('d01', '三分摊手', 'shot', 6, { hot: true, three: 80, spotlight: true, clutchish: true }, '{actor}三分进了，对着看台摊手。', { off: 0.04, shot: 'three', profile: { fame: 1 } }),
    E('d02', '底角抢射', 'shot', 12, { need: 'shooter' }, '球到{actor}底角，拔得很快。', { off: 0.10, shot: 'three' }),
    E('d03', '提前进攻三分', 'shot', 8, { tags: 'transition', need: 'shooter' }, '{actor}转换里提前拔三分。', { off: 0.06, tov: 0.04, shot: 'three' }),
    E('d04', '手感发烫', 'shot', 9, { hot: true }, '{actor}这节手感烫。下几攻还会找他。', { window: 5, windowOff: 0.05, grant: 'hero_hunt' }),
    E('d05', '打铁潮', 'shot', 9, { cold: true }, '连续打铁。{actor}得先把球传出去。', { window: 4, windowOff: -0.05, grant: 'committee' }),
    E('d06', '放空射手', 'shot', 11, { need: 'opp_shooter', threeOpp: 84 }, '放了{actor}。这记三分不该留。', { opp: true, off: 0.13, shot: 'three' }),
    E('d07', '贴身干扰', 'shot', 11, { need: 'wing' }, '{actor}伸手贴上去，这记投篮很难看。', { def: 0.10 }),
    E('d08', '暂停后设计三分', 'shot', 9, { afterTimeout: true, need: 'shooter' }, '暂停回来的设计给{actor}。', { off: 0.09, shot: 'three' }),
    E('d09', '加时第一记三分', 'shot', 7, { ot: true, need: 'shooter' }, '加时第一记，{actor}直接拔。', { off: 0.11, shot: 'three' }),
    E('d10', '超远试投', 'shot', 5, { hot: true, forbid: 'cold', need: 'shooter', three: 88 }, '{actor}在logo附近试了一下。', { off: -0.08, shot: 'three' }),
    E('d11', '多传一次再投', 'shot', 10, { tags: 'committee', need: 'shooter' }, '还能传。{actor}接到的是真正空位。', { off: 0.07, shot: 'three' }),
    E('d12', '节奏器投进', 'shot', 8, { need: 'pg' }, '{actor}自己投进，下一波转换更顺。', { off: 0.07, window: 2, windowOff: 0.03 }),

    E('e01', '前场板补扣', 'paint', 11, { need: 'big', dnk: 78 }, '{actor}抢到前场板，直接补上。', { dunk: true, orb: 0.14, shot: 'FIN' }),
    E('e02', '后卫乱战板', 'paint', 5, { need: 'pg' }, '乱战里{actor}居然抢到篮板。', { orb: 0.06 }),
    E('e03', '护筐大帽', 'paint', 11, { need: 'rim' }, '{actor}把这次上篮钉在板上。', { blk: true, def: 0.16 }),
    E('e04', '追帽', 'paint', 8, { need: 'rim', tags: 'transition', ath: 84 }, '{actor}从后面追出来，把快攻帽掉。', { blk: true, def: 0.18 }),
    E('e05', '二次进攻造犯', 'paint', 9, { need: 'big' }, '进攻板后{actor}再攻一次，对手只好伸手。', { foul: true, orb: 0.08 }),
    E('e06', '内线苦战', 'paint', 8, { need: 'big' }, '两名内线在禁区里较劲，节奏慢下来。', { window: 4, windowOff: -0.03, grant: 'grind' }),
    E('e07', '高位策应撕内线', 'paint', 10, { need: 'big', pas: 76 }, '{actor}高位一眼找到空切。', { off: 0.10 }),
    E('e08', '五外拉开', 'paint', 7, { fiveOut: true }, '五外站位，禁区被拉开。', { window: 4, windowOff: 0.04, shot: 'FIN' }),
    E('e09', '传统双塔', 'paint', 6, { twoBigs: true, forbid: 'fiveOut', need: 'big' }, '两个大个同时在场，这球往里打。', { shot: 'FIN', off: 0.06 }),
    E('e10', '篮板点名', 'paint', 9, { need: 'big' }, '对方漏点，{actor}卡住人拿板。', { orb: 0.12 }),
    E('e11', '被卡住', 'paint', 8, { need: 'opp_big' }, '{actor}把人挡住，这记前场板没了。', { opp: true, orb: -0.10 }),
    E('e12', '扣完不看人', 'paint', 6, { need: 'dunker', forbid: 'garbage' }, '{actor}扣完，场边声音一下子大了。', { dunk: true, shot: 'FIN' }),

    E('f01', '延误挡拆', 'defense', 12, {}, '我方选择drop。对方中距离会多一点，三分少一点。', { scheme: 'drop', grant: 'drop' }),
    E('f02', '全换防', 'defense', 10, {}, '全部换防。挡拆走不掉，但错位会来。', { scheme: 'switch', grant: 'switch' }),
    E('f03', '包夹持球核', 'defense', 12, { oppHero: true, forbid: 'double_role' }, '开始包夹对方的核。弱侧必须轮转。', { grant: 'double_star', def: 0.06, window: 4, windowDef: 0.04 }),
    E('f04', '放角色人', 'defense', 10, { tags: 'double_star' }, '放对方角色人，人堆到核身上。', { def: 0.05 }),
    E('f05', '2-3联防', 'defense', 8, { afterTimeout: true }, '改2-3联防，先把禁区填上。', { scheme: 'zone', grant: 'zone' }),
    E('f06', '联防被拆', 'defense', 8, { tags: 'zone', need: 'opp_shooter' }, '联防被拆到{actor}底角。', { opp: true, off: 0.13, shot: 'three', grant: 'scheme_change' }),
    E('f07', '全场紧逼', 'defense', 8, { down8: true, qMin: 4 }, '全场紧逼。要失误，也要转换。', { window: 4, windowDef: 0.05, grant: 'press' }),
    E('f08', '半场收缩', 'defense', 8, { lead12: true }, '领先后收缩禁区，三分交给运气。', { window: 4, windowDef: 0.03 }),
    E('f09', '绕前防内', 'defense', 9, { need: 'opp_big' }, '绕前。内线接不到，球只能往外走。', { def: 0.07 }),
    E('f10', '协防到位', 'defense', 11, { need: 'rim' }, '{actor}协防到位，这次上篮要改。', { def: 0.10 }),
    E('f11', '协防过度', 'defense', 10, { need: 'opp_shooter' }, '协防过去了，弱侧{actor}空了。', { opp: true, off: 0.11, shot: 'three' }),
    E('f12', '换防被点名', 'defense', 10, { tags: 'switch' }, '换出了错位，对方点名打。', { opp: true, off: 0.10, grant: 'mismatch' }),
    E('f13', '防守沟通', 'defense', 8, {}, '{actor}在喊轮转。这几波对方不容易找到空位。', { window: 4, windowDef: 0.04 }),
    E('f14', '被挡拆挂住', 'defense', 9, { need: 'big' }, '挡拆把人挂住了。{actor}下滑接到球。', { opp: true, off: 0.09, shot: 'FIN' }),
    E('f15', '改延误', 'defense', 7, { cooldownScheme: true }, '改回延误。先把简单的球防死。', { scheme: 'drop', grant: 'scheme_change' }),
    E('f16', '最后不换防', 'defense', 8, { clutch: true }, '最后一防不换。就让{actor}对持球核。', { def: 0.08 }),

    E('g01', '抢断推反击', 'to', 11, { pdef: 76 }, '{actor}把球断下来，立刻往前推。', { stl: true, grant: 'transition' }),
    E('g02', '长传一条龙', 'to', 9, { need: 'pg', tags: 'transition' }, '{actor}长传找到前面的人。', { off: 0.12 }),
    E('g03', '推进失误', 'to', 10, { need: 'pg', hanLow: true }, '{actor}推进时球被摸掉。', { forceTov: true }),
    E('g04', '传穿自己人', 'to', 6, {}, '这记传球太炫，落到了自己人脚边。', { forceTov: true }),
    E('g05', '界外球发歪', 'to', 5, { afterTimeout: true }, '界外球发歪。这球白给。', { forceTov: true }),
    E('g06', '快攻以多打少', 'to', 10, { tags: 'transition' }, '人数优势。{actor}把这次转换打完。', { off: 0.14, shot: 'FIN' }),
    E('g07', '转换造犯', 'to', 8, { tags: 'transition' }, '{actor}转换里把人撞开，哨响。', { foul: true }),
    E('g08', '回防不到位', 'to', 8, { b2b: true }, '回防慢了半步，对方转换已经成形。', { opp: true, off: 0.10, grant: 'transition' }),
    E('g09', '端线被抄', 'to', 7, { down8: true, qMin: 4 }, '赶时间的端线球被抄。', { forceTov: true }),
    E('g10', '24秒违例', 'to', 6, { tags: 'grind' }, '半场磨到最后，24秒灯亮了。', { forceTov: true }),

    E('h01', '砍罚球差的人', 'foul', 7, { need: 'big', ftMax: 0.62, pos: 'C,PF', forbid: 'hack_a_off' }, '故意送{actor}上罚球线。', { hack: true, opp: true, grant: 'hack_a' }),
    E('h02', '被砍', 'foul', 6, { need: 'user', userFtBad: true, ftMax: 0.62 }, '对方开始砍人。{actor}走上罚球线。', { hack: true, grant: 'hack_a' }),
    E('h03', '投篮犯规', 'foul', 11, {}, '{actor}起跳时被拽了一下。', { foul: true }),
    E('h04', '首节两犯', 'foul', 7, { q: 1, need: 'star' }, '{actor}首节两犯，先坐下。', { sit: true, grant: 'foul_2q1' }),
    E('h05', '第六人顶上', 'foul', 8, { tags: 'foul_2q1' }, '核坐下，{actor}上来接管球权。', { off: 0.06, window: 4, windowOff: 0.04 }),
    E('h06', '技术犯规', 'foul', 4, { forbid: 'garbage', spotlight: true }, '{actor}对裁判说话，技术犯规。', { tech: true, profile: { controversy: 1 } }),
    E('h07', '战术犯规', 'foul', 8, { clutch: true, down: true }, '故意战术犯规，不让对方把钟走完。', { foul: true }),
    E('h08', '关键罚球', 'foul', 8, { clutch: true, spotlight: true }, '{actor}站上罚球线。这罚很重。', { foul: true, profile: { mediaTrust: 1 } }),

    E('i01', '最后24秒清空', 'clutch', 10, { clutch: true, spotlight: true }, '最后一攻清空给{actor}。', { off: 0.08, grant: 'hero_hunt', profile: { fame: 1 } }),
    E('i02', '底角绝杀结构', 'clutch', 9, { clutch: true, need: 'shooter' }, '传导到{actor}底角。这就是最后一投的位置。', { off: 0.07, shot: 'three' }),
    E('i03', '零点几秒一投', 'clutch', 6, { lastSecond: true, need: 'shooter', three: 76 }, '时间只够{actor}接球就拔。', { off: -0.10, shot: 'three' }),
    E('i04', '追平三分', 'clutch', 8, { clutch: true, down3: true, need: 'shooter' }, '落后三分。{actor}接球，这记必须拔。', { off: 0.06, shot: 'three' }),
    E('i05', '造杀伤两罚', 'clutch', 9, { clutch: true }, '{actor}往里冲，要把哨喊出来。', { foul: true }),
    E('i06', '防住最后一攻', 'clutch', 9, { clutch: true, lead: true, spotlight: true }, '最后一防。{actor}卡住持球人。', { def: 0.12, profile: { lockerRoomTrust: 1 } }),
    E('i07', '加时谁接手', 'clutch', 7, { ot: true }, '加时这球由{actor}来持。', { off: 0.06, grant: 'hero_hunt' }),
    E('i08', '绝杀被帽', 'clutch', 6, { clutch: true, need: 'opp_rim', spotlight: true }, '{actor}把最后一投帽掉。', { blk: true, opp: true, profile: { controversy: 1 } }),
    E('i09', '暂停后画饼', 'clutch', 8, { clutch: true, afterTimeout: true }, '暂停画的就是这球。{actor}执行。', { off: 0.10 }),
    E('i10', '最后一防沟通', 'clutch', 8, { clutch: true, lead: true }, '{actor}把轮转喊清楚。最后一攻不能漏人。', { def: 0.08 }),

    E('a11', '跳球拨给后卫', 'open', 8, { q: 1, early: true, need: 'pg' }, '跳球拨到{actor}手里，第一波先过半场。', { off: 0.04 }),
    E('a12', '首攻被换防', 'open', 7, { q: 1, early: true }, '开场对方就换防。{actor}面对的不是原来的对位。', { grant: 'switch' }),
    E('a13', '客场第一记打铁', 'open', 7, { q: 1, early: true, road: true }, '客场第一记没进。球回过来，{actor}得把节奏稳住。', { off: -0.02 }),
    E('a14', '主场开场提速', 'open', 8, { q: 1, early: true, home: true }, '主场想先快起来。{actor}一接球就往前推。', { off: 0.04, window: 3, windowOff: 0.03, grant: 'transition' }),
    E('a15', '季后赛开场肉搏', 'open', 7, { q: 1, early: true, playoff: true }, '季后赛第一攻就贴上来。{actor}每一下都要对抗。', { off: -0.03, grant: 'grind' }),

    E('b19', 'Iverson横切', 'tactics', 10, { need: 'shooter' }, '{actor}从强侧横切出来，接球就有空间。', { off: 0.10, shot: 'MID' }),
    E('b20', 'Zipper上提', 'tactics', 9, { need: 'pg' }, '{actor}拉链切到弧顶接球，下一动才开始。', { off: 0.07 }),
    E('b21', 'UCLA空切', 'tactics', 9, { need: 'wing' }, 'UCLA掩护后{actor}直切篮下。', { off: 0.11, shot: 'FIN' }),
    E('b22', '双人Stagger', 'tactics', 10, { need: 'shooter,big' }, '{helper}和内线连续给{actor}错开掩护。', { off: 0.10, shot: 'three', helperAst: true }),
    E('b23', 'Pin-in钉掩护', 'tactics', 10, { need: 'shooter' }, '底角钉住，{actor}往上弹出来接球。', { off: 0.10, shot: 'three' }),
    E('b24', 'Chicago手递手', 'tactics', 9, { need: 'pg,shooter' }, 'Chicago：{helper}手递手后再挡，{actor}走出来。', { off: 0.10, shot: 'three', helperAst: true }),
    E('b25', 'Ram提前挡', 'tactics', 9, { need: 'pg,big' }, '{helper}提前给持球人挡住，{actor}走中路。', { off: 0.09, shot: 'MID' }),
    E('b26', '假掩护弹开', 'tactics', 8, { need: 'shooter' }, '{actor}假挡真弹到三分线。', { off: 0.09, shot: 'three' }),
    E('b27', '掩护滑脱', 'tactics', 9, { need: 'big', forbid: 'hack_a' }, '{actor}刚要挡就下滑，口袋传球来了。', { off: 0.11, shot: 'FIN' }),
    E('b28', '二次掩护', 'tactics', 8, { need: 'pg,big' }, '第一挡没挡住。{helper}再给{actor}挡一次。', { off: 0.08, shot: 'MID' }),
    E('b29', 'Double Drag', 'tactics', 10, { tags: 'transition', need: 'pg,big' }, '转换里连续两个拖挡。{actor}选择往里走。', { off: 0.10, shot: 'FIN' }),
    E('b30', 'Horns Twist', 'tactics', 8, {}, '牛角位交叉换位，{actor}从中间出来。', { off: 0.08, shot: 'MID' }),

    E('c15', '后撤步中投', 'iso', 10, { need: 'star', mid: 80 }, '{actor}后撤一步，中距离出手。', { off: 0.11, shot: 'MID' }),
    E('c16', '侧步三分', 'iso', 8, { need: 'star', three: 82, hot: true }, '{actor}侧一步把防守人甩掉，直接拔三分。', { off: 0.10, shot: 'three' }),
    E('c17', '抛投打延误', 'iso', 10, { scheme: 'drop', need: 'pg' }, '对方drop。{actor}在罚球线附近抛投。', { off: 0.10, shot: 'MID' }),
    E('c18', '蛇形挡拆', 'iso', 9, { need: 'star' }, '{actor}挡拆后折回来走中路，把换防人带走。', { off: 0.09, shot: 'MID' }),
    E('c19', '面筐跳投', 'iso', 8, { need: 'big', mid: 76 }, '{actor}提到肘区面筐，对位只能伸手。', { off: 0.10, shot: 'MID' }),
    E('c20', '转身擦板', 'iso', 8, { need: 'big', fin: 78 }, '{actor}低位转身，擦板打进这个角度。', { off: 0.12, shot: 'FIN' }),
    E('c21', '突破分球', 'iso', 11, { forbid: 'hero_hunt', need: 'star' }, '{actor}往里吸了两人，球分出去。', { off: 0.08, helperAst: true, grant: 'committee' }),
    E('c22', '换防点名打', 'iso', 10, { tags: 'switch', need: 'star' }, '换出来的错位。{actor}直接点名。', { off: 0.11, grant: 'mismatch' }),
    E('c23', '无球反跑', 'iso', 9, { userOffBall: true }, '{actor}反跑，球正好到。', { off: 0.10, shot: 'FIN' }),
    E('c24', '背打要球', 'iso', 9, { need: 'big' }, '{actor}在低位要球，先把位置卡住。', { off: 0.08, shot: 'FIN' }),

    E('d13', 'drive-and-kick', 'shot', 11, { need: 'shooter' }, '突破把人带走，球到{actor}这一侧。', { off: 0.10, shot: 'three' }),
    E('d14', '弱侧Skip', 'shot', 10, { need: 'shooter' }, '大对角传到{actor}，这记是空位。', { off: 0.11, shot: 'three', helperAst: true }),
    E('d15', '快攻跟进三分', 'shot', 9, { tags: 'transition', need: 'shooter' }, '前面把人吸进禁区，跟进的{actor}在后面拔三分。', { off: 0.10, shot: 'three' }),
    E('d16', 'Drift底角', 'shot', 9, { need: 'shooter' }, '{actor}从45度漂到底角，接球就有空档。', { off: 0.09, shot: 'three' }),
    E('d17', 'Closeout假动作', 'shot', 9, { need: 'star' }, '防守人扑出来。{actor}一个假动作过掉。', { off: 0.08, shot: 'FIN' }),
    E('d18', '接球就拔', 'shot', 10, { need: 'shooter', three: 80 }, '{actor}脚还没站稳就拔了。', { off: 0.07, shot: 'three' }),
    E('d19', '第二节手感来了', 'shot', 7, { q: 2, hot: true }, '{actor}这节连续进，对位开始贴上去。', { window: 4, windowOff: 0.04, grant: 'hero_hunt' }),
    E('d20', '三分打铁转传导', 'shot', 8, { cold: true, forbid: 'hero_hunt' }, '这记又偏。{actor}挥手让球继续动。', { grant: 'committee' }),
    E('d21', '放空底角还手', 'shot', 9, { need: 'opp_shooter', threeOpp: 82 }, '底角又放了{actor}。这记不能再留。', { opp: true, off: 0.12, shot: 'three' }),
    E('d22', '暂停后Floppy', 'shot', 8, { afterTimeout: true, need: 'shooter' }, '暂停回来Floppy，{actor}从底线钻出来。', { off: 0.10, shot: 'three' }),

    E('e13', '空接', 'paint', 9, { need: 'big', ath: 82, dnk: 82, forbid: 'hack_a' }, '{helper}一吊，{actor}在空中把球按进去。', { dunk: true, off: 0.13, shot: 'FIN', helperAst: true }),
    E('e14', '口袋传球', 'paint', 10, { need: 'pg,big' }, '{helper}从夹缝里塞给下滑的{actor}。', { off: 0.11, shot: 'FIN', helperAst: true }),
    E('e15', 'Dunker Spot切', 'paint', 9, { need: 'big' }, '{actor}站在dunker位，防守一帮忙他就切。', { off: 0.10, shot: 'FIN' }),
    E('e16', '高底配合', 'paint', 9, { need: 'big', twoBigs: true }, '高位一吊，{actor}在禁区里把位置卡住。', { off: 0.10, shot: 'FIN' }),
    E('e17', '补篮', 'paint', 9, { need: 'big' }, '球在圈上，{actor}把补篮点进。', { orb: 0.10, shot: 'FIN' }),
    E('e18', '乱战50-50', 'paint', 8, {}, '球在地上。{actor}先扑上去。', { orb: 0.07 }),
    E('e19', '护筐垂直起跳', 'paint', 9, { need: 'rim' }, '{actor}垂直起跳，这记上篮很难看。', { def: 0.11 }),
    E('e20', '造进攻犯规', 'paint', 7, { need: 'big' }, '{actor}把位置站住，进攻人撞上来。', { def: 0.10, forceTov: true }),
    E('e21', '被卡死要不到', 'paint', 8, { need: 'opp_big' }, '{actor}把低位卡住，这记内传球传不进去。', { opp: true, def: 0.08 }),
    E('e22', '小个阵容五外', 'paint', 7, { fiveOut: true, stint: 'mix' }, '场上五个都能拉开。禁区给{actor}留出来了。', { window: 3, windowOff: 0.03, shot: 'FIN' }),

    E('f17', 'Ice挡拆', 'defense', 10, {}, '弱侧冰防。逼持球人往边线走。', { scheme: 'drop', grant: 'drop', def: 0.05 }),
    E('f18', 'Blitz夹持球', 'defense', 9, { oppHero: true, forbid: 'hero_hunt' }, '上来夹持球核。弱侧必须轮转。', { scheme: 'blitz', grant: 'double_star', def: 0.06 }),
    E('f19', '夹完回收', 'defense', 8, { scheme: 'blitz' }, '夹完立刻回收。{actor}对着持球人举手。', { def: 0.07 }),
    E('f20', '换防点名下一档', 'defense', 9, { tags: 'switch', need: 'opp_star' }, '换完对方继续点。这球还是打{actor}。', { opp: true, off: 0.09, grant: 'mismatch' }),
    E('f21', 'Tag下滑人', 'defense', 10, { need: 'wing' }, '{actor}去Tag下滑，这记口袋传球被碰到。', { def: 0.09 }),
    E('f22', 'Nail协防', 'defense', 9, { need: 'wing' }, '{actor}站在罚球线协防，中路过不去。', { def: 0.08 }),
    E('f23', 'Help the helper', 'defense', 8, { need: 'rim' }, '第一人去补，{actor}再补第一人的人。', { def: 0.08 }),
    E('f24', 'Closeout不到位', 'defense', 10, { need: 'opp_shooter' }, '补防扑晚了。{actor}接球就有空。', { opp: true, off: 0.11, shot: 'three' }),
    E('f25', '联防Overload', 'defense', 8, { tags: 'zone' }, '球堆到强侧。{actor}在弱侧等下一传。', { opp: true, off: 0.08, shot: 'three' }),
    E('f26', '联防高位闪出', 'defense', 7, { tags: 'zone', need: 'opp_big' }, '{actor}提到罚球线，联防中间空了。', { opp: true, off: 0.09, shot: 'MID' }),
    E('f27', '紧逼过半场', 'defense', 7, { tags: 'press', need: 'pg' }, '全场紧逼。{actor}把球运过半场再说。', { tov: 0.05 }),
    E('f28', '领先后拖延', 'defense', 8, { lead8: true, qMin: 4 }, '领先就拖。{actor}把球带到前线再组织。', { clock: 1, grant: 'grind' }),

    E('g11', '抢板一传', 'to', 10, { need: 'pg' }, '{actor}拿后场板，第一传直接往前甩。', { grant: 'transition', off: 0.08 }),
    E('g12', '推进长传', 'to', 9, { tags: 'transition', need: 'pg' }, '{actor}过半场前就把球送到前面。', { off: 0.11 }),
    E('g13', '二打一', 'to', 9, { tags: 'transition' }, '前面二打一。{actor}自己攻还是分。', { off: 0.12, shot: 'FIN' }),
    E('g14', '三打二', 'to', 8, { tags: 'transition' }, '三打二成型。{actor}把这次转换打完。', { off: 0.11 }),
    E('g15', '8秒违例边缘', 'to', 6, { tags: 'press' }, '过半场只剩两秒。{actor}只能往前扔。', { tov: 0.08 }),
    E('g16', '传球被预判', 'to', 8, { need: 'thief', pdef: 76 }, '{actor}提前读到传球路线，把球断下来。', { stl: true, grant: 'transition' }),
    E('g17', '走步', 'to', 5, { forbid: 'garbage' }, '{actor}这一下步子乱了。哨响。', { forceTov: true }),
    E('g18', '回场', 'to', 4, { tags: 'press' }, '球被顶回后场。这次进攻作废。', { forceTov: true }),

    E('h09', '2+1', 'foul', 9, { need: 'star' }, '{actor}打进还要加罚。', { foul: true, shot: 'FIN', off: 0.04 }),
    E('h10', '造三分犯规', 'foul', 7, { need: 'shooter', three: 78 }, '{actor}起跳时被碰到，这是三分犯规。', { foul: true, shot: 'three' }),
    E('h11', '三犯坐下', 'foul', 6, { qMax: 3, need: 'star' }, '{actor}三犯，教练先换下来。', { grant: 'foul_trouble' }),
    E('h12', '四犯不敢伸手', 'foul', 7, { qMin: 3, need: 'star' }, '{actor}四犯，对位开始往里扛。', { opp: true, off: 0.07, grant: 'foul_trouble' }),
    E('h13', '罚球一轮', 'foul', 8, { qMin: 4 }, '全队犯规到了。{actor}走上罚球线。', { foul: true }),
    E('h14', '故意送罚球', 'foul', 6, { clutch: true, down: true }, '故意犯规。不让对方把时间耗完。', { foul: true }),

    E('i11', '最后一攻传导', 'clutch', 9, { clutch: true, forbid: 'hero_hunt' }, '最后一攻先动起来。球到{actor}时才出手。', { off: 0.07, grant: 'committee' }),
    E('i12', '最后一攻单打', 'clutch', 9, { clutch: true, need: 'star' }, '最后一攻不传了。留给{actor}。', { off: 0.07, grant: 'hero_hunt' }),
    E('i13', '落后两分中投', 'clutch', 8, { clutch: true, down: true, need: 'star', mid: 78 }, '落后两分。{actor}走中距离，不把球权交给三分。', { off: 0.08, shot: 'MID' }),
    E('i14', '领先守24秒', 'clutch', 8, { clutch: true, lead: true }, '领先就守这24秒。{actor}对持球人贴死。', { def: 0.10 }),
    E('i15', '加时先打内', 'clutch', 7, { ot: true, need: 'big' }, '加时先往里打。{actor}要位置。', { off: 0.08, shot: 'FIN' }),
    E('i16', '绝杀结构被换', 'clutch', 7, { clutch: true, afterTimeout: true }, '暂停画的对位被换掉。{actor}得重新处理。', { off: -0.04 }),
    E('i17', '最后防守不放三分', 'clutch', 8, { clutch: true, lead: true, need: 'wing' }, '{actor}死卡底角。最后一攻不给三分。', { def: 0.09 }),
    E('i18', '加时抢板一攻', 'clutch', 6, { ot: true, need: 'big' }, '加时这记后场板是下一次进攻的开始。{actor}护下来。', { orb: 0.06 }),

    E('j01', '第六人点燃', 'rotation', 9, { stint: 'bench', need: 'star' }, '替补这段由{actor}带着打。场上活了。', { off: 0.07, window: 3, windowOff: 0.03 }),
    E('j02', '首发回归', 'rotation', 8, { stint: 'starters', qMin: 2 }, '首发回到场上。球重新到{actor}手里。', { off: 0.05 }),
    E('j03', '替补前三分钟', 'rotation', 8, { stint: 'bench', q: 2 }, '第二节替补先打。{actor}得把分差守住。', { off: 0.04 }),
    E('j04', '三节体能下降', 'rotation', 8, { q: 3, b2b: true }, '背靠背第三节，腿明显沉。{actor}突破少了半步。', { off: -0.04, window: 4, windowOff: -0.03 }),
    E('j05', '小个换防阵', 'rotation', 7, { stint: 'mix', fiveOut: true }, '场上偏小。换防容易，篮板要五个人一起抢。', { grant: 'switch' }),
    E('j06', '双塔守筐', 'rotation', 7, { twoBigs: true, stint: 'starters', need: 'big' }, '两个大个同时在，篮下先顶住。球到{actor}低位。', { shot: 'FIN', off: 0.05 }),
    E('j07', ' foul trouble顶上', 'rotation', 8, { tags: 'foul_trouble', need: 'star' }, '核坐在场边。这几攻由{actor}处理。', { off: 0.06, window: 3, windowOff: 0.03 }),
    E('j08', '垃圾时间轮换', 'rotation', 5, { garbage: true }, '分差大了。这球给{actor}练一下。', {}),
    E('j09', '用户无球跑动', 'rotation', 8, { userOffBall: true, userOn: true }, '{actor}连续无球跑，终于把防守人甩掉。', { off: 0.09, shot: 'three' }),
    E('j10', '混合段提速', 'rotation', 8, { stint: 'mix' }, '混合段两边都想打转换。{actor}推着往前。', { grant: 'transition', off: 0.05 }),

    E('k01', '主场三分起势', 'atmosphere', 8, { home: true, need: 'shooter', qMax: 2 }, '主场这记三分把声浪带起来。下一攻还找{actor}。', { off: 0.05, window: 3, windowOff: 0.03, shot: 'three' }),
    E('k02', '客场嘘声', 'atmosphere', 7, { road: true, qMin: 4 }, '客场嘘声压下来。{actor}罚球前拍了拍球。', {}),
    E('k03', '全国转播单打', 'atmosphere', 6, { national: true, need: 'star', qMin: 4 }, '全国转播镜头跟着{actor}。这球交给他。', { off: 0.06, grant: 'hero_hunt' }),
    E('k04', '季后赛对抗升级', 'atmosphere', 8, { playoff: true }, '每一次卡住都更重。{actor}要球之前先要位置。', { off: -0.02, grant: 'grind' }),
    E('k05', '季后赛边线球', 'atmosphere', 7, { playoff: true, afterTimeout: true }, '季后赛边线球，{actor}是第一接应。', { off: 0.08 }),
    E('k06', '主场防守起势', 'atmosphere', 7, { home: true, need: 'wing' }, '主场防守这波把人逼到边线。{actor}举手要球。', { def: 0.07 }),
    E('k07', '客场前场板', 'atmosphere', 6, { road: true, need: 'big' }, '客场还能抢到这记前场板。{actor}把球拨回来。', { orb: 0.08 }),
    E('k08', '暂停冰罚球', 'atmosphere', 6, { clutch: true, afterTimeout: true }, '暂停回来先罚。{actor}走上线。', { foul: true }),
    E('k09', '挑战后的一攻', 'atmosphere', 6, { afterTimeout: true, forbid: 'garbage' }, '回放确认完。球权给到{actor}这一侧。', { off: 0.05 })
  ];

  function hasTag(game, tag) { return !!game.tags[tag]; }
  function grantTag(game, tag) { if (tag) game.tags[tag] = true; }

  function parseNeed(need) {
    return String(need || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function isDefRole(role) {
    return role === 'rim' || role === 'thief' || role === 'lock' || /^opp_/.test(role || '');
  }
  function baseRole(role) {
    return String(role || 'star').replace(/^opp_/, '').replace(/^our_/, '');
  }
  function courtForNeed(role, ctx) {
    return isDefRole(role) ? ctx.defCourt : ctx.offCourt;
  }

  function matchWhen(when, ctx, game) {
    if (!when) return true;
    if (when.q != null && ctx.q !== when.q) return false;
    if (when.qMin != null && ctx.q < when.qMin) return false;
    if (when.qMax != null && ctx.q > when.qMax) return false;
    if (when.early && ctx.secLeft < 560) return false;
    if (when.home && !ctx.home) return false;
    if (when.road && ctx.home) return false;
    if (when.b2b && !ctx.b2b) return false;
    if (when.ot && !ctx.isOT) return false;
    if (when.national && !ctx.national) return false;
    if (when.clutch && !ctx.clutch) return false;
    if (when.clutchish && !(ctx.clutch || ctx.q >= 4)) return false;
    if (when.lastSecond && !(ctx.clutch && ctx.secLeft <= 8)) return false;
    if (when.down8 && ctx.margin > -8) return false;
    if (when.down12 && ctx.margin > -12) return false;
    if (when.lead8 && ctx.margin < 8) return false;
    if (when.lead12 && ctx.margin < 12) return false;
    if (when.lead && ctx.margin <= 0) return false;
    if (when.down && ctx.margin >= 0) return false;
    if (when.playoff && !ctx.playoff) return false;
    if (when.stint && ctx.stint !== when.stint) return false;
    if (when.userOn && !ctx.userOn) return false;
    if (when.down3 && !(ctx.margin <= -3 && ctx.margin >= -4)) return false;
    if (when.marginMax != null && Math.abs(ctx.margin) > when.marginMax) return false;
    if (when.hot && !ctx.hot) return false;
    if (when.cold && !ctx.cold) return false;
    if (when.forbid && hasTag(game, when.forbid)) return false;
    if (when.tags && !hasTag(game, when.tags)) return false;
    if (when.scheme && game.scheme !== when.scheme) return false;
    if (when.afterTimeout && !ctx.afterTimeout) return false;
    if (when.userOffBall && !(ctx.userOn && ctx.usage < 0.22)) return false;
    if (when.oppHero && ctx.oppPace < 28) return false;
    if (when.coldStar && ctx.starPace > 32) return false;
    if (when.garbage && !ctx.garbage) return false;
    if (when.spotlight && (game.spotlightUsed || !ctx.clutch)) return false;
    if (when.userFtBad && !ctx.userOn) return false;
    if (when.fiveOut && !ctx.fiveOut) return false;
    if (when.twoBigs && !ctx.twoBigs) return false;
    if (when.mismatch && !hasTag(game, 'mismatch') && game.scheme !== 'switch') return false;
    if (when.cooldownScheme && !hasTag(game, 'scheme_change')) return false;
    if (ctx.garbage && (when.clutch || when.spotlight)) return false;
    return true;
  }

  function fillText(text, map) {
    return String(text || '').replace(/\{(\w+)\}/g, function (_, k) { return map[k] || ''; });
  }

  function maybeEvent(game, ctx) {
    if (game.cooldown > 0) { game.cooldown--; return null; }
    var target = game.bp.isPlayoff ? 11 : (game.bp._allStarExhibition ? 5 : 8);
    if (game.eventCount >= target + 2) return null;
    var baseP = game.bp.isPlayoff ? 0.12 : (game.bp._allStarExhibition ? 0.06 : 0.095);
    if (ctx.clutch) baseP += 0.06;
    if (!chance(baseP)) return null;
    var pool = LIVE_EVENTS.filter(function (ev) {
      if (matchWhen(ev.when, ctx, game) === false) return false;
      var fx = eventFx(ev);
      if (fx.opp && (fx.shot || (fx.off && fx.off > 0) || fx.hack) && !fx.blk && ctx.side !== 'B') return false;
      if (fx.hack && !fx.opp && ctx.side !== 'A') return false;
      if (hasTag(game, 'hero_hunt') && (ev.id === 'f03' || ev.id === 'f04' || fx.grant === 'double_star')) return false;
      if (hasTag(game, 'committee') && fx.grant === 'hero_hunt' && !ctx.hot) return false;
      if (ctx.garbage && ev.cat === 'clutch') return false;
      var actorRole = defaultActorRole(ev);
      if (baseRole(actorRole) === 'user' && !ctx.userOn) return false;
      var actorPred = function (p) { return playerFits(p, ev.when, fx, true); };
      if (!roleOn(actorCourtFor(ev, ctx), baseRole(actorRole), null, actorPred)) return false;
      var needs = parseNeed(ev.when && ev.when.need);
      for (var i = 1; i < needs.length; i++) {
        if (needs[i] === 'user' && !ctx.userOn) return false;
        if (!roleOn(courtForNeed(needs[i], ctx), baseRole(needs[i]))) return false;
      }
      return true;
    });
    if (!pool.length) return null;
    var picked = pickWeighted(pool, function (ev) { return ev.w || 10; });
    game.eventCount++;
    game.cooldown = irand(6, 11);
    return {
      id: picked.id,
      name: picked.name,
      cat: picked.cat,
      w: picked.w,
      when: picked.when,
      text: picked.text,
      fx: picked.fx
    };
  }

  function bindEventPeople(ev, ctx) {
    var fx = eventFx(ev);
    var needs = parseNeed(ev.when && ev.when.need);
    var actorRole = defaultActorRole(ev);
    var actorCourt = actorCourtFor(ev, ctx);
    var actorPred = function (p) { return playerFits(p, ev.when, fx, true); };
    var actor = roleOn(actorCourt, baseRole(actorRole), null, actorPred)
      || actorCourt.filter(actorPred)[0];
    if (!actor) return { map: { actor: '球员', helper: '队友', target: '对位', team: teamName(ctx.teamOff), opp: teamName(ctx.teamDef) }, actor: null, helper: null, text: fillText(ev.text, { actor: '球员', helper: '队友', target: '对位', team: teamName(ctx.teamOff), opp: teamName(ctx.teamDef) }) };
    if (ctx.userOn && (ev.id === 'c13' || (ev.when && ev.when.userOffBall))) {
      var u = roleOn(ctx.offCourt, 'user');
      if (u && actorPred(u)) actor = u;
    }
    var helperRole = needs[1] || 'pg';
    var helper = roleOn(ctx.offCourt, baseRole(helperRole), actor)
      || roleOn(ctx.offCourt, 'big', actor)
      || ctx.offCourt.filter(function (p) { return p && pid(p) !== pid(actor); })[0]
      || ctx.offCourt[0];
    var map = {
      actor: nm(actor),
      helper: nm(helper),
      target: nm(roleOn(ctx.defCourt, 'star') || ctx.defCourt[0]),
      team: teamName(ctx.teamOff),
      opp: teamName(ctx.teamDef)
    };
    return { map: map, actor: actor, helper: helper, text: fillText(ev.text, map) };
  }

  function applyEventFx(game, ev, ctx, bind) {
    var fx = liveFx(ev);
    if (fx.grant) grantTag(game, fx.grant);
    if (fx.scheme) game.scheme = fx.scheme;
    if (fx.window) {
      var winSide = ctx.side;
      if (fx.opp && !fx.off && !fx.shot && !fx.windowOff) winSide = ctx.defSide;
      game.windows.push({
        left: fx.window,
        side: winSide,
        off: fx.windowOff || 0,
        def: fx.windowDef || 0
      });
    }
    if (fx.profile && !game.spotlightUsed && ctx.clutch) {
      game.spotlightUsed = true;
      Object.keys(fx.profile).forEach(function (k) {
        game.profile[k] = clamp((game.profile[k] || 0) + (fx.profile[k] > 0 ? 1 : -1), -1, 1);
      });
    }
    game.events.push({ id: ev.id, name: ev.name, q: ctx.q, isOT: ctx.isOT, text: bind.text, scoreA: game.scoreA, scoreB: game.scoreB });
    return bind;
  }

  function remainingPossFor(game, ctx) {
    var bp = game.bp;
    if (ctx.isOT) return Math.max(1.15, bp.pace * (ctx.secLeft / 60) / 48);
    var minsLeft = remainingMins(ctx.q, ctx.secLeft, false, game);
    var gameMins = bp._gameMins || 48;
    return Math.max(1.15, bp.pace * (minsLeft / gameMins));
  }

  function neededPPP(game, ctx) {
    var side = ctx.side;
    if (ctx.isOT) {
      var otTgt = side === 'A' ? (game.thisOtA || 9) : (game.thisOtB || 9);
      var curOt = side === 'A' ? game.otA : game.otB;
      return clamp((otTgt - curOt) / remainingPossFor(game, ctx), 0.35, 2.2);
    }
    var tgt = side === 'A' ? game.tgtA : game.tgtB;
    var cur = side === 'A' ? game.scoreA : game.scoreB;
    var lo = 0.62, hi = 1.72;
    if (ctx.q >= 4 && ctx.secLeft < 90) { lo = 0.25; hi = 2.35; }
    return clamp((tgt - cur) / remainingPossFor(game, ctx), lo, hi);
  }

  function possessionClock(ctx, ev, game) {
    var clock;
    var fx = liveFx(ev);
    if (fx.clock) clock = irand(18, 23);
    else if (hasTag(game, 'transition')) clock = irand(5, 9);
    else if (hasTag(game, 'grind')) clock = irand(16, 22);
    else {
      var r = rand();
      var transP = 0.05;
      if (ctx.userOn && game.styles) {
        transP += (st(game.styles, 'fast_break') - 1) * 0.18;
        transP -= (st(game.styles, 'post_bully') - 1) * 0.25;
      }
      transP = clamp(transP, 0.03, 0.14);
      if (r < transP) clock = irand(5, 9);
      else if (r < transP + 0.18) clock = irand(8, 13);
      else clock = irand(14, 18);
    }
    var bp = game.bp;
    var done = game.possA + game.possB;
    var frac = ctx.isOT
      ? 1 - ctx.secLeft / 300
      : 1 - remainingMins(ctx.q, ctx.secLeft, false, game) / 48;
    var expectedDone = (ctx.isOT ? bp.pace * 10 / 48 : bp.pace) * 2 * clamp(frac, 0, 1);
    if (done < expectedDone - 3) clock = Math.max(5, Math.round(clock * 0.84));
    if (done > expectedDone + 3) clock = Math.round(clock * 1.12);
    if (ctx.clutch) clock = Math.min(clock, Math.max(4, ctx.secLeft - 0.2));
    return Math.max(1.8, Math.min(clock, ctx.secLeft));
  }

  function pushPlay(game, ctx, name, text) {
    game.feed.push({
      type: 'event', q: ctx.q, isOT: ctx.isOT,
      name: name, text: text,
      scoreA: game.scoreA, scoreB: game.scoreB
    });
  }

  function rebounder(court, styles) {
    return pickWeighted(court, function (p) {
      var pos = posOf(p);
      var big = (pos === 'C' || pos === 'PF') ? 1.35 : 0.82;
      var w = 0.12 + skill01(attr(p, 'REB')) * big;
      if (p && p._isUser) w *= st(styles, 'box_out');
      return w;
    });
  }

  function doRebound(game, ctx, orbRate) {
    if (chance(orbRate)) {
      var p = rebounder(ctx.offCourt, game.styles);
      if (p) lineOf(game, p).reb++;
      return { orb: true, player: p };
    }
    var d = rebounder(ctx.defCourt, game.styles);
    if (d) lineOf(game, d).reb++;
    return { orb: false, player: d };
  }

  function reboundRows(ctx, reb) {
    if (!reb || !reb.player) return [];
    if (reb.orb) {
      return [{ kind: 'orb', tag: '前场板', tone: 'make', teamSide: ctx.side, text: nm(reb.player) + ' 抢到进攻篮板', rebounderPlayer: reb.player }];
    }
    return [{ kind: 'drb', tag: '后场板', tone: 'stop', teamSide: ctx.defSide, text: nm(reb.player) + ' 拼下防守篮板', rebounderPlayer: reb.player }];
  }

  function mergeReboundClip(rows, ctx, game) {
    if (!rows || !rows.length || !window.PP_COURT || typeof PP_COURT.appendReboundContest !== 'function') return;
    var missI = -1, rebI = -1, i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].kind === 'miss' || rows[i].kind === 'blk') missI = i;
      if (rows[i].kind === 'orb' || rows[i].kind === 'drb') rebI = i;
    }
    if (missI < 0 || rebI < 0 || !rows[rebI].rebounderPlayer) return;
    var miss = rows[missI];
    if (!miss.clip) return;
    var rebPlayer = rows[rebI].rebounderPlayer;
    var rebId = pid(rebPlayer);
    var isOrb = rows[rebI].kind === 'orb';
    var oppCourt = isOrb ? ctx.defCourt : ctx.offCourt;
    var challenger = roleOn(oppCourt, 'big') || oppCourt[0];
    if (challenger && pid(challenger) === rebId) challenger = oppCourt[1] || oppCourt[0];
    var rest = (window.PP_COURT.ballRestFromClip && PP_COURT.ballRestFromClip(miss.clip))
      || { x: 0, y: 0, z: 0.22 };
    var bank = !!(miss._pbp && miss._pbp.bank);
    PP_COURT.appendReboundContest(miss.clip, {
      rebounder: rebId,
      challenger: pid(challenger),
      looseZ: rest.z != null ? rest.z : 0.22,
      bank: bank,
      kind: rows[rebI].kind,
      rebPos: posOf(rebPlayer),
      off: (ctx.offCourt || []).map(function (p) { return slimCourtPlayer(p, 'off'); }).filter(Boolean),
      def: (ctx.defCourt || []).map(function (p) { return slimCourtPlayer(p, 'def'); }).filter(Boolean)
    });
  }

  /* ============================================================
   * 回合过程文案
   * 先由算法抽出对位、协防、干扰档、动作，再拼一句过程+结果。
   * 干扰档会微调制成率/盖帽率，均值尽量为 0，避免观看和跳过分差跑飞。
   *
   * 干扰档：open 无人 / close 贴身 / contest 对位干扰 / help 协防 / heavy 夹击
   * 动作库：三分 catch/spot/cut/pull3/stepback；
   *         中距 pullup/jumper/fade/hook/float；
   *         篮下 layup/euro/hop/upunder/slash/dunk/lob/coast
   * 禁则：人名必须在当场五人；颜射仅三分命中+对位干扰；
   *       无人防守不得写干扰；隔扣仅扣篮命中；空接必须有传球人。
   * ============================================================ */
  var POS_RANK = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  var CONTEST_PCT = { open: 0.048, close: 0.010, contest: -0.024, help: -0.040, heavy: -0.062 };
  var CONTEST_PCT_CENTER = 0.004;
  var CONTEST_BLK = { open: 0.42, close: 0.82, contest: 1.00, help: 1.38, heavy: 1.72 };

  function pickWeightedId(pairs) {
    var list = (pairs || []).filter(function (x) { return x && x[1] > 0; });
    if (!list.length) return null;
    var total = 0, i, r;
    for (i = 0; i < list.length; i++) total += list[i][1];
    r = rand() * total;
    for (i = 0; i < list.length; i++) {
      r -= list[i][1];
      if (r <= 0) return list[i][0];
    }
    return list[list.length - 1][0];
  }

  function eventActionHint(ev, fx) {
    fx = fx || {};
    var blob = '';
    if (ev) blob = String(ev.name || '') + ' ' + String(ev.text || '') + ' ' + String((ev._bind && ev._bind.text) || '');
    var hint = { action: null, contest: null, dunk: !!fx.dunk, trans: false };
    if (/欧洲步/.test(blob)) hint.action = 'euro';
    else if (/金鸡|勾手/.test(blob)) hint.action = 'hook';
    else if (/后仰/.test(blob)) hint.action = 'fade';
    else if (/梦幻脚步/.test(blob)) hint.action = 'upunder';
    else if (/无球空切/.test(blob)) hint.action = 'cut';
    else if (/一条龙/.test(blob)) hint.action = 'coast';
    else if (/空接/.test(blob)) hint.action = 'lob';
    else if (fx.dunk || /补扣|扣完|暴扣/.test(blob)) hint.action = 'dunk';
    else if (/Floppy|底角|出角|Hammer/.test(blob)) hint.action = 'spot';
    else if (/电梯门|抢射|接球就拔/.test(blob)) hint.action = 'catch';
    else if (/变向过/.test(blob)) hint.action = 'cross';
    else if (/手递手/.test(blob)) hint.action = 'dho';
    else if (/反跑|空切/.test(blob) && /无球/.test(blob)) hint.action = 'backdoor';
    else if (/补篮|前场板补/.test(blob)) hint.action = 'putback';
    if (/放空|真正空位|弱侧.{0,6}空/.test(blob)) hint.contest = 'open';
    if (/贴身干扰/.test(blob)) hint.contest = 'contest';
    if (/协防到位/.test(blob)) hint.contest = 'help';
    if (/协防过度/.test(blob)) hint.contest = 'open';
    if (/转换|快攻/.test(blob)) hint.trans = true;
    return hint;
  }

  function pickOutletPasser(court, shooter) {
    var pool = (court || []).filter(function (p) { return p && pid(p) !== pid(shooter); });
    if (!pool.length) return null;
    return pickWeighted(pool, function (p) {
      var pos = posOf(p);
      var w = 0.12 + skill01(attr(p, 'PAS')) * 1.15 + skill01(attr(p, 'REB')) * 0.35;
      if (pos === 'PG') w += 1.6;
      if (pos === 'C') w += 0.95;
      if (pos === 'PF') w += 0.55;
      if (p._isUser) w *= 1.12;
      return w;
    });
  }

  function pickMatchup(shooter, defCourt) {
    var court = (defCourt || []).filter(Boolean);
    if (!court.length) return null;
    var pos = posOf(shooter);
    var same = court.filter(function (p) { return posOf(p) === pos; });
    if (same.length) {
      return pickWeighted(same, function (p) {
        return 0.45 + skill01(attr(p, 'PDEF')) * 1.1 + skill01(ovrOf(p)) * 0.25;
      });
    }
    return pickWeighted(court, function (p) {
      var d = Math.abs((POS_RANK[posOf(p)] || 2) - (POS_RANK[pos] || 2));
      var prox = d === 1 ? 3.2 : (d === 2 ? 1.4 : 0.55);
      return prox * (0.4 + skill01(ovrOf(p)));
    });
  }

  function pickHelp(shot, matchup, defCourt, hint) {
    var pool = (defCourt || []).filter(function (p) {
      return p && (!matchup || pid(p) !== pid(matchup));
    });
    if (!pool.length) return null;
    var helpP = shot === 'FIN' ? 0.22 : (shot === 'MID' ? 0.14 : 0.08);
    if (matchup) {
      var defA = shot === 'FIN' ? attr(matchup, 'IDEF') : attr(matchup, 'PDEF');
      if (defA < 62) helpP += 0.12;
      if (defA > 84) helpP -= 0.08;
    }
    if (hint && hint.contest === 'open') return null;
    if (hint && hint.contest === 'help') helpP = 1;
    if (!chance(clamp(helpP, 0.04, 0.78))) return null;
    if (shot === 'FIN') {
      return pickWeighted(pool, function (p) {
        return 0.18 + skill01(attr(p, 'BLK')) * 1.5 + skill01(attr(p, 'IDEF')) * 1.15;
      });
    }
    return pickWeighted(pool, function (p) {
      return 0.18 + skill01(attr(p, 'PDEF')) * 1.2 + skill01(attr(p, 'ATH')) * 0.45;
    });
  }

  function rollContest(shot, shooter, matchup, help, hint) {
    if (hint && hint.contest === 'open') return 'open';
    if (!matchup && !help) return 'open';
    if (hint && hint.contest === 'help') return help ? (chance(0.32) ? 'heavy' : 'help') : 'contest';
    if (hint && hint.contest === 'contest') return help ? 'help' : 'contest';
    var defA, offA;
    if (!matchup) return help ? 'help' : 'open';
    if (shot === 'FIN') {
      defA = attr(matchup, 'IDEF') * 0.52 + attr(matchup, 'BLK') * 0.24 + attr(matchup, 'STR') * 0.24;
      offA = attr(shooter, 'HAN') * 0.42 + attr(shooter, 'ATH') * 0.34 + attr(shooter, 'FIN') * 0.24;
    } else {
      defA = attr(matchup, 'PDEF') * 0.66 + attr(matchup, 'ATH') * 0.34;
      offA = attr(shooter, 'ATH') * 0.32 + attr(shooter, shot === 'threePT' ? 'threePT' : 'MID') * 0.28 + attr(shooter, 'HAN') * 0.40;
    }
    var score = skill01(defA) - skill01(offA) * 0.70 + gauss(0, 0.10);
    if (shot === 'threePT') score -= 0.04;
    if (help) score += 0.08 + skill01(attr(help, shot === 'FIN' ? 'IDEF' : 'PDEF')) * 0.16;
    if (help && score >= 0.46) return 'heavy';
    if (help && score >= 0.00) return 'help';
    if (score >= 0.24) return 'contest';
    if (score >= -0.02) return 'close';
    return 'open';
  }

  function pickAction(shooter, shot, passer, contest, trans, hint, fx) {
    var forced = hint && hint.action;
    var pos = posOf(shooter);
    if (forced) {
      if (shot === 'threePT' && /^(euro|dunk|hook|upunder|lob|hop|slash|layup)$/.test(forced)) {
        if (forced === 'cut') return 'cut';
        return passer ? ((contest === 'open' || contest === 'close') ? 'cut' : 'catch') : 'pull3';
      }
      if (shot === 'MID' && /^(dunk|lob|coast|euro|hop)$/.test(forced)) return forced === 'euro' ? 'float' : 'fade';
      if (shot === 'FIN' && /^(catch|spot|pull3|stepback)$/.test(forced)) {
        return attr(shooter, 'DNK') >= 78 ? 'dunk' : 'layup';
      }
      if (shot !== 'FIN' && forced === 'coast') return shot === 'threePT' ? 'pull3' : 'pullup';
      return forced;
    }
    if (shot === 'threePT') {
      var t3 = [['pull3', 1.8], ['stepback', attr(shooter, 'HAN') >= 74 ? 2.0 : 0.4], ['snatch', attr(shooter, 'HAN') >= 80 ? 1.1 : 0.2]];
      if (passer) {
        t3.push(['catch', 3.4], ['spot', 2.2], ['pin', 1.2], ['dho', 0.9]);
        if (contest === 'open' || contest === 'close') t3.push(['cut', 3.6], ['flare', 1.4]);
      }
      if (trans) t3.push(['trail', 1.2]);
      return pickWeightedId(t3) || 'pull3';
    }
    if (shot === 'MID') {
      var t2 = [['pullup', 2.6], ['jumper', 1.8], ['fade', 1.0 + skill01(attr(shooter, 'MID')) * 1.4], ['jab', 1.1]];
      if (pos === 'C' || pos === 'PF') t2.push(['hook', 1.8 + skill01(attr(shooter, 'FIN'))], ['skyhook', attr(shooter, 'FIN') >= 80 ? 1.2 : 0.3], ['fade', 1.6], ['postspin', 1.1]);
      else t2.push(['float', attr(shooter, 'HAN') >= 70 ? 2.0 : 0.35], ['runner', 1.2]);
      return pickWeightedId(t2) || 'jumper';
    }
    var dnk = attr(shooter, 'DNK');
    var han = attr(shooter, 'HAN');
    if ((trans || (hint && hint.trans)) && passer && shot === 'FIN' && chance(0.20 + skill01(attr(shooter, 'ATH')) * 0.10)) {
      return 'coast';
    }
    if ((trans || (hint && hint.trans)) && !passer && (dnk >= 76 || han >= 78) && chance(0.08 + skill01(dnk) * 0.06)) {
      return 'coast';
    }
    if (passer && dnk >= 82 && chance(0.032 + skill01(dnk) * 0.04)) {
      return 'lob';
    }
    var t1 = [['layup', 2.6]];
    if (dnk >= 74) t1.push(['dunk', 1.5 + skill01(dnk) * 2.3]);
    if (han >= 76 && pos !== 'C') t1.push(['euro', 2.2], ['cross', 1.4], ['hesi', 1.1], ['reverse', 0.9]);
    else if (han >= 80) t1.push(['euro', 0.7]);
    if (han >= 70) t1.push(['hop', 1.4], ['faceup', 1.0]);
    if ((pos === 'PF' || pos === 'C' || pos === 'SF') && attr(shooter, 'FIN') >= 72) t1.push(['upunder', 1.5], ['dropstep', pos === 'C' || pos === 'PF' ? 1.6 : 0.4]);
    if (han >= 72 && pos !== 'C') t1.push(['slash', 0.9]);
    if (passer && (contest === 'open' || contest === 'close')) t1.push(['backdoor', 1.3]);
    if (fx && fx.dunk) t1.push(['dunk', 6], ['putback', 1.5]);
    return pickWeightedId(t1) || 'layup';
  }

  function actionIsDunk(action, shooter, fx) {
    if (action === 'dunk' || action === 'lob' || action === 'putback') return true;
    if (action === 'coast' && attr(shooter, 'DNK') >= 78) return true;
    return !!(fx && fx.dunk && action !== 'euro' && action !== 'hop');
  }

  function syncShotAction(shot, action) {
    if (shot === 'threePT') {
      if (/^(pullup|jumper|fade|float|runner|jab|hook|skyhook|postspin)$/.test(action)) return 'pull3';
      return action;
    }
    if (/^(pull3|stepback|snatch|logo|trail|spot|catch|cut|flare|pin|dho)$/.test(action)) {
      return (action === 'stepback' || action === 'snatch') ? 'pullup' : 'jumper';
    }
    return action;
  }

  function movePhrase(action, dunk, shot) {
    if (action === 'euro') return '欧洲步上篮';
    if (action === 'hop') return '跳步上篮';
    if (action === 'upunder') return '上下步上篮';
    if (action === 'slash') return '突破上篮';
    if (action === 'cross') return '变向上篮';
    if (action === 'hesi') return '变速上篮';
    if (action === 'reverse') return '反手上篮';
    if (action === 'faceup') return '面筐杀篮下';
    if (action === 'backdoor') return '反跑上篮';
    if (action === 'dropstep') return '低位撤步上篮';
    if (action === 'layup') return '上篮';
    if (action === 'putback') return dunk ? '补扣' : '补篮';
    if (action === 'dunk' || dunk && (action === 'coast' || action === 'lob')) return '扣篮';
    if (action === 'lob') return '空接扣篮';
    if (action === 'coast') return dunk ? '一条龙暴扣' : '一条龙上篮';
    if (action === 'float') return '抛投';
    if (action === 'runner') return '跑投';
    if (action === 'jab') return '假动作跳投';
    if (action === 'fade') return '背身后仰';
    if (action === 'hook') return '勾手';
    if (action === 'skyhook') return '天空钩';
    if (action === 'postspin') return '低位转身跳投';
    if (action === 'pullup') return '急停跳投';
    if (action === 'jumper') return '跳投';
    if (action === 'stepback') return shot === 'threePT' ? '后撤步三分' : '后撤步跳投';
    if (action === 'snatch') return shot === 'threePT' ? '后撤一步拔三分' : '后撤一步拔投';
    if (action === 'pull3') return '持球拔三分';
    if (action === 'trail') return '快攻跟进三分';
    if (action === 'flare' || action === 'pin' || action === 'dho') return shot === 'threePT' ? '投三分' : '跳投';
    if (action === 'spot' || action === 'catch' || action === 'cut') return shot === 'threePT' ? '投三分' : '跳投';
    if (action === 'logo') return '超远三分';
    return dunk ? '扣篮' : '跳投';
  }

  function driveAction(action) {
    return /^(euro|hop|upunder|slash|layup|dunk|cross|hesi|reverse|faceup|backdoor|dropstep|putback)$/.test(action);
  }

  function rollBankShot(scene) {
    if (!scene || scene.dunk || scene.shot === 'threePT') return false;
    if (scene.action === 'dunk' || scene.action === 'lob' || scene.action === 'putback') return false;
    var zone = scene.zone || '';
    var action = scene.action || '';
    var p = 0.10;
    if (action === 'reverse' || action === 'hook' || action === 'skyhook' || action === 'float' || action === 'runner' || action === 'dropstep') p = 0.16;
    else if (scene.shot === 'FIN') p = 0.12;
    else if (scene.shot === 'MID') p = 0.09;
    else return false;
    if (zone === 'wing' || zone === 'slot' || zone === 'corner' || zone === 'post' || zone === 'elbow' || zone === 'short') p += 0.02;
    if (zone === 'top' || zone === 'logo' || zone === 'nail') p -= 0.03;
    return chance(clamp(p, 0.06, 0.18));
  }

  function canPostUp(shooter, matchup) {
    var pos = posOf(shooter);
    if (pos === 'C' || pos === 'PF') return true;
    if (pos === 'SF' && matchup && POS_RANK[posOf(matchup)] >= 2 && attr(shooter, 'STR') >= attr(matchup, 'STR') + 8) return true;
    return false;
  }

  var ZONE_CN = {
    rim: '篮下', paint: '禁区', ft: '罚球线', elbow: '肘区', slot: '四十五度',
    wing: '侧翼', corner: '底角', top: '弧顶', post: '低位', dunker: '空切位',
    short: '短底角', logo: 'logo区', mid: '中距离', nail: '禁区前沿'
  };

  function remapActionForBody(shooter, matchup, action, trans) {
    var pos = posOf(shooter);
    if (/^(hook|skyhook|dropstep|upunder|postspin)$/.test(action) && !canPostUp(shooter, matchup)) {
      return attr(shooter, 'MID') >= 72 ? 'fade' : 'jumper';
    }
    if (action === 'fade' && pos === 'PG' && matchup && posOf(matchup) === 'C') return 'pullup';
    if (action === 'euro' && pos === 'C' && !trans) return 'dropstep';
    if (action === 'skyhook' && pos !== 'C' && pos !== 'PF') return 'hook';
    return action;
  }

  function pickZone(action, tactic, shot) {
    if (shot === 'threePT') {
      if (action === 'spot' || action === 'flare' || action === 'pin') return 'corner';
      if (action === 'catch' || action === 'dho') return chance(0.45) ? 'corner' : 'top';
      if (action === 'pull3' || action === 'snatch' || action === 'trail') return chance(0.5) ? 'top' : 'corner';
      if (action === 'stepback') return chance(0.5) ? 'top' : 'corner';
      if (action === 'logo') return 'logo';
      return chance(0.55) ? 'top' : 'corner';
    }
    if (action === 'spot' || action === 'flare') return 'corner';
    if (action === 'cut' || action === 'backdoor') return 'slot';
    if (action === 'catch' || action === 'pin' || action === 'dho') return chance(0.5) ? 'slot' : 'wing';
    if (action === 'pull3' || action === 'snatch') return chance(0.55) ? 'top' : 'wing';
    if (action === 'stepback') return chance(0.5) ? 'wing' : 'slot';
    if (action === 'trail') return 'slot';
    if (action === 'pullup' || action === 'jumper' || action === 'jab') return chance(0.55) ? 'elbow' : 'mid';
    if (action === 'float' || action === 'runner') return 'nail';
    if (action === 'hook' || action === 'skyhook' || action === 'dropstep' || action === 'postspin' || action === 'upunder') return 'post';
    if (action === 'fade') return /post/.test(tactic || '') ? 'post' : 'elbow';
    if (action === 'putback' || action === 'lob' || action === 'dunk' || action === 'coast' || driveAction(action)) return 'rim';
    if (action === 'logo') return 'logo';
    return 'wing';
  }

  function pickTactic(action, trans, ev, fx, shooter, passer, shot) {
    var blob = ev ? String(ev.name || '') + String(ev.text || '') : '';
    if (fx && (fx.hack || fx.tech)) return { tactic: 'ft', branch: 'line', camera: 'half' };
    if (trans || action === 'coast' || action === 'trail') {
      if (action === 'coast') return { tactic: 'trans_coast', branch: 'coast', camera: 'full' };
      if (action === 'trail') return { tactic: 'trans_num', branch: 'trail', camera: 'full' };
      return { tactic: 'trans_num', branch: 'ahead', camera: 'full' };
    }
    if (action === 'putback') return { tactic: 'putback', branch: 'tip', camera: 'half' };
    if (/西班牙/.test(blob)) return { tactic: 'spain', branch: 'back', camera: 'half' };
    if (/牛角/.test(blob)) return { tactic: 'horns', branch: 'flash', camera: 'half' };
    if (/电梯门/.test(blob)) return { tactic: 'elevator', branch: 'catch', camera: 'half' };
    if (/Floppy|Hammer|底角/.test(blob)) return { tactic: 'hammer', branch: 'corner', camera: 'half' };
    if (/手递手/.test(blob)) return { tactic: 'dho', branch: 'pull', camera: 'half' };
    if (/挡拆外弹/.test(blob)) return { tactic: 'pnr_side', branch: 'pop', camera: 'half' };
    if (/挡拆下滑|倒挡|假挡/.test(blob)) return { tactic: 'pnr_side', branch: 'roll', camera: 'half' };
    if (/弱侧清空|拒绝掩护/.test(blob)) return { tactic: 'iso_clear', branch: 'drive', camera: 'half' };
    if (/联防/.test(blob)) return { tactic: 'zone', branch: 'overload', camera: 'half' };
    if (passer && chance(0.10)) return { tactic: 'dho', branch: /dho|catch|pull/.test(action) ? 'pull' : 'turn', camera: 'half' };
    if (passer && chance(0.08)) return { tactic: 'horns', branch: 'flash', camera: 'half' };
    if (passer && chance(0.06)) return { tactic: 'spain', branch: 'back', camera: 'half' };
    if (passer && chance(0.07)) return { tactic: 'elevator', branch: 'catch', camera: 'half' };
    if (passer && chance(0.06)) return { tactic: 'zone', branch: 'overload', camera: 'half' };
    if (!passer && chance(0.08) && !driveAction(action)) return { tactic: 'delay', branch: 'dribble', camera: 'half' };
    if (action === 'lob') return { tactic: passer ? 'pnr_high' : 'trans_num', branch: 'roll', camera: passer ? 'half' : 'full' };
    if (action === 'spot' || action === 'flare') return { tactic: 'hammer', branch: 'corner', camera: 'half' };
    if (action === 'cut' || action === 'backdoor') return { tactic: 'floppy', branch: 'cut', camera: 'half' };
    if (/^(hook|skyhook|dropstep|postspin|upunder)$/.test(action)) return { tactic: 'post', branch: action === 'upunder' ? 'upunder' : 'hook', camera: 'half' };
    if (action === 'fade' && canPostUp(shooter)) return { tactic: 'post', branch: 'fade', camera: 'half' };
    if (action === 'logo') return { tactic: 'iso_clear', branch: 'step', camera: 'full' };
    if (!passer && /^(stepback|pull3|snatch|slash|euro|cross|hesi|faceup)$/.test(action)) {
      return { tactic: 'iso_clear', branch: /stepback|pull3|snatch/.test(action) ? 'step' : 'drive', camera: 'half' };
    }
    if (passer && shot === 'threePT') return { tactic: chance(0.42) ? 'five_out' : 'pnr_side', branch: 'extra', camera: 'half' };
    if (passer && driveAction(action)) return { tactic: 'pnr_side', branch: 'turn', camera: 'half' };
    if (passer) return { tactic: 'pnr_side', branch: 'pop', camera: 'half' };
    return { tactic: 'iso_mid', branch: 'jumper', camera: 'half' };
  }

  function fillSceneMeta(scene, trans, ev, fx) {
    scene.action = remapActionForBody(scene.shooter, scene.matchup, scene.action, trans);
    scene.action = syncShotAction(scene.shot, scene.action);
    var meta = pickTactic(scene.action, trans, ev, fx, scene.shooter, scene.passer, scene.shot);
    scene.tactic = meta.tactic;
    scene.branch = meta.branch;
    scene.camera = meta.camera;
    scene.strong = chance(0.54) ? 'R' : 'L';
    scene.zone = pickZone(scene.action, scene.tactic, scene.shot);
    if (scene.action === 'fade' && scene.tactic !== 'post') scene.zone = 'elbow';
    if (scene.zone === 'post' && !canPostUp(scene.shooter, scene.matchup)) {
      scene.zone = 'elbow';
      scene.tactic = 'iso_mid';
      scene.branch = 'fade';
      if (/^(hook|skyhook|dropstep|postspin|upunder)$/.test(scene.action)) scene.action = attr(scene.shooter, 'MID') >= 72 ? 'fade' : 'jumper';
    }
    return scene;
  }

  function pickBlocker(shot, matchup, help, rim, userDef, game) {
    var cands = [];
    function add(p, w) { if (p) cands.push([p, w]); }
    if (help && shot === 'FIN') add(help, 3.4 + skill01(attr(help, 'BLK')) * 2);
    if (rim && (!help || pid(rim) !== pid(help))) add(rim, 2.2 + skill01(attr(rim, 'BLK')) * 2.4);
    if (matchup) add(matchup, shot === 'FIN' ? 0.9 : 0.45);
    if (userDef && (st(game.styles, 'rim_protector') > 1.01 || st(game.styles, 'dunk_threat') > 1.01)) {
      var userBlkW = 0.16 * st(game.styles, 'rim_protector') * (1 + (st(game.styles, 'dunk_threat') - 1) * 0.25);
      if (posOf(userDef) === 'C' || posOf(userDef) === 'PF') userBlkW += 0.18;
      add(userDef, 1.2 + clamp(userBlkW, 0.06, 0.72) * 4);
    }
    if (!cands.length) return rim || matchup || help;
    var total = 0, i, r;
    for (i = 0; i < cands.length; i++) total += cands[i][1];
    r = rand() * total;
    for (i = 0; i < cands.length; i++) {
      r -= cands[i][1];
      if (r <= 0) return cands[i][0];
    }
    return cands[cands.length - 1][0];
  }

  function composeShotText(s) {
    var a = nm(s.shooter);
    var m = s.matchup ? nm(s.matchup) : '';
    var h = s.help ? nm(s.help) : '';
    var p = s.passer ? nm(s.passer) : '';
    var dunk = !!s.dunk;
    var move = movePhrase(s.action, dunk, s.shot);
    var zcn = ZONE_CN[s.zone] || '';
    var finishMove = /上篮|扣篮|杀篮下|补篮|补扣/.test(move);
    var useZ = !!(zcn && !/^(spot|cut|coast|lob|trail|putback)$/.test(s.action || '') && !(s.zone === 'rim' && finishMove));
    var loc = useZ ? ('在' + zcn) : '';
    var core;
    if (s.action === 'cut' && p) core = a + '跑出空档接' + p + '传球，' + move;
    else if (s.action === 'spot' && p) core = p + '找到底角' + a + '，' + move;
    else if (s.action === 'flare' && p) core = a + '外弹接' + p + '传球，' + move;
    else if (s.action === 'dho' && p) core = p + '手递手给' + a + '，' + move;
    else if (s.action === 'pin' && p) core = a + '借掩护接' + p + '传球，' + move;
    else if (s.action === 'catch' && p) core = a + '接' + p + '传球' + (loc ? loc : '') + '，' + move;
    else if (s.action === 'backdoor' && p) core = a + '反跑接' + p + '传球，' + move;
    else if (s.beat && s.matchup && driveAction(s.action)) core = a + '过掉' + m + '，' + loc + move;
    else core = a + loc + move;

    if (s.action === 'lob' && p) {
      if (s.outcome === 'blk' && s.blocker) return p + '空接，' + nm(s.blocker) + '帽掉' + a;
      if (s.outcome === 'make') return p + '空接给' + a + '砸筐';
      if (s.outcome === 'andone') return p + '空接给' + a + '，打成2+1，加罚' + (s.ftMade ? '命中' : '不中');
      if (s.outcome === 'foul') return p + '空接给' + a + '，造成犯规，罚球 ' + s.ftMade + '/' + s.fta;
      return p + '空接给' + a + '，没扣进';
    }
    if (s.action === 'logo') {
      if (s.outcome === 'blk' && s.blocker) return a + 'logo区超远三分，被' + nm(s.blocker) + '盖帽';
      if (s.outcome === 'foul') return a + 'logo区超远三分造犯，罚球 ' + s.ftMade + '/' + s.fta;
      if (s.outcome === 'make') return a + 'logo区超远三分飙进';
      return a + 'logo区超远三分不中';
    }
    if (s.action === 'coast') {
      if (s.outcome === 'blk' && s.blocker) return a + '快攻一条龙，被' + nm(s.blocker) + '追上帽掉';
      if (s.outcome === 'make') {
        if (s.poster) {
          if (s.help) return a + '快攻隔扣' + h;
          if (s.matchup) return a + '快攻隔扣' + m;
          return a + '快攻一条龙隔扣';
        }
        if (dunk) return a + '快攻一条龙暴扣';
        return a + (s.bank ? '快攻一条龙上篮打板命中' : '快攻一条龙上篮得手');
      }
      if (s.outcome === 'andone') return a + (s.bank ? '快攻一条龙打板打成2+1' : '快攻一条龙打成2+1') + '，加罚' + (s.ftMade ? '命中' : '不中');
      if (s.outcome === 'foul') return a + '快攻一条龙造犯，罚球 ' + s.ftMade + '/' + s.fta;
      return a + '快攻一条龙，' + (dunk ? '扣篮' : '上篮') + '不中';
    }
    if (s.poster && s.outcome === 'make') {
      if (s.matchup && s.help && pid(s.matchup) !== pid(s.help)) return a + '过掉' + m + '后隔扣' + h;
      if (s.help) return a + '隔扣' + h;
      if (s.matchup) return a + '隔扣' + m;
    }
    if (s.face && s.outcome === 'make' && m) return a + '三分颜射' + m;

    if (s.outcome === 'blk' && s.blocker) return core + '，被' + nm(s.blocker) + '盖帽';
    if (s.outcome === 'andone') return core + (s.bank ? '打板打成2+1' : '打成2+1') + '，加罚' + (s.ftMade ? '命中' : '不中');
    if (s.outcome === 'foul') return core + '造成犯规，罚球 ' + s.ftMade + '/' + s.fta;

    var def = '';
    if (s.contest === 'open' && s.action !== 'cut') def = '无人防守';
    else if (s.contest === 'contest' && m && !(s.beat && driveAction(s.action))) def = m + '举手干扰';
    else if (s.contest === 'help' && h) def = h + '协防干扰';
    else if (s.contest === 'heavy' && m && h) def = m + '和' + h + '夹击';
    else if (s.contest === 'close' && m && !s.beat && s.action !== 'cut') def = '面对' + m;

    var end = s.outcome === 'make' ? (s.bank && !dunk ? '打板命中' : '命中') : '不中';
    if (def === '无人防守') return core.replace(move, '无人防守' + move) + end;
    if (def) return core + '，' + def + '，' + end;
    return core + end;
  }

  function composeTurnoverText(loser, stealer, fx, ev) {
    var a = nm(loser);
    var blob = ev ? String(ev.name || '') + String(ev.text || '') : '';
    if (stealer) {
      var s = nm(stealer);
      if (/推进|运/.test(blob) || chance(0.62)) return s + '抄掉' + a + '的运球';
      return s + '断下' + a + '的传球';
    }
    if (/24秒/.test(blob)) return a + '这攻耗到24秒违例';
    if (/界外/.test(blob)) return a + '界外球发歪';
    if (/欧洲/.test(blob)) return a + '欧洲步没迈开，球丢了';
    if (/传穿|传球太炫/.test(blob)) return a + '传球出界';
    if (attr(loser, 'HAN') < 68 && chance(0.45)) return a + '运球失误';
    if (chance(0.34)) return a + '传球出界';
    return a + '处理球失误';
  }

  function shortenPbp(text) {
    text = String(text || '');
    if (text.length <= 48) return text;
    return text.replace(/，[^，]{2,8}干扰/, '').replace(/面对[^，]{1,6}，/, '');
  }

  function slimCourtPlayer(p, team) {
    if (!p) return null;
    return { id: pid(p), name: nm(p), pos: posOf(p), hero: !!p._isUser, team: team };
  }

  function courtInputFrom(scene, ctx, game, kind) {
    if (!scene || !ctx) return null;
    return {
      tactic: scene.tactic || (kind === 'stl' ? 'steal' : 'iso_mid'),
      branch: scene.branch || (kind === 'stl' ? 'strip' : 'jumper'),
      zone: scene.zone || 'wing',
      strong: scene.strong || 'R',
      camera: scene.camera || (kind === 'stl' ? 'full' : 'half'),
      action: scene.action,
      contest: scene.contest,
      outcome: scene.outcome,
      shot: scene.shot,
      dunk: scene.dunk,
      beat: scene.beat,
      bank: !!scene.bank,
      kind: kind,
      side: ctx.side,
      q: ctx.q,
      isOT: !!ctx.isOT,
      attackRight: attackRightFor(ctx),
      teamAHome: !!(game && game.bp && game.bp.teamAHome),
      shooter: scene.shooter && pid(scene.shooter),
      passer: scene.passer && pid(scene.passer),
      matchup: scene.matchup && pid(scene.matchup),
      help: scene.help && pid(scene.help),
      blocker: scene.blocker && pid(scene.blocker),
      stealer: scene.stealer && pid(scene.stealer),
      loser: scene.loser && pid(scene.loser),
      off: (ctx.offCourt || []).map(function (p) { return slimCourtPlayer(p, 'off'); }).filter(Boolean),
      def: (ctx.defCourt || []).map(function (p) { return slimCourtPlayer(p, 'def'); }).filter(Boolean)
    };
  }

  function attackRightFor(ctx) {
    var q = (ctx && ctx.q) || 1;
    var aRight = (q % 2 === 1);
    if (ctx && ctx.isOT) aRight = true;
    if (!ctx) return true;
    return ctx.side === 'A' ? aRight : !aRight;
  }

  function courtLiveAfter(kind) {
    if (kind === 'drb') return false;
    return kind === 'miss' || kind === 'blk' || kind === 'stl' || kind === 'orb';
  }

  function attachPbp(row, scene, ctx, game) {
    if (PP_LIVE._collectPbp && scene) row._pbp = scene;
    row.text = shortenPbp(row.text);
    if (window.PP_COURT && typeof PP_COURT.compose === 'function' && scene && ctx) {
      try {
        var clip = PP_COURT.compose(courtInputFrom(scene, ctx, game, row.kind));
        if (clip) {
          clip.attackRight = attackRightFor(ctx);
          clip.chain = !!(game && game._courtLive) && !ctx.afterTimeout;
          if (clip.chain && (row.kind === 'stl' || scene.camera === 'full' || scene.tactic === 'trans_coast' || scene.tactic === 'steal' || scene.action === 'logo')) {
            clip.camera = 'full';
          }
        }
        row.clip = clip;
      } catch (err) { row.clip = null; }
    }
    if (game) game._courtLive = courtLiveAfter(row.kind);
    return row;
  }

  function auditPbpScene(scene, text) {
    var errs = [];
    if (!scene || !text) return errs;
    if (scene.face && (scene.shot !== 'threePT' || scene.outcome !== 'make' || scene.contest === 'open' || !scene.matchup)) {
      errs.push('face');
    }
    if (/颜射/.test(text) && (scene.contest === 'open' || scene.shot !== 'threePT')) errs.push('face-text');
    if (/无人防守/.test(text) && scene.contest !== 'open') errs.push('open-text');
    if (scene.contest === 'open' && /举手干扰|协防干扰|夹击/.test(text)) errs.push('open-contest');
    if (/隔扣/.test(text) && (scene.outcome !== 'make' || !scene.dunk)) errs.push('poster');
    if (/空接/.test(text) && !scene.passer) errs.push('lob');
    if (scene.help && scene.matchup && pid(scene.help) === pid(scene.matchup)) errs.push('help=matchup');
    if (/协防/.test(text) && !scene.help) errs.push('help-text');
    if (/跑出空档/.test(text) && /面对|举手干扰|夹击|协防/.test(text)) errs.push('cut-contest');
    if (/背身后仰|勾手|后撤步|急停/.test(text) && /无人防守/.test(text)) errs.push('iso-open');
    if (/欧洲步|跳步上篮|上下步|突破上篮|变向上篮|变速上篮/.test(text) && /无人防守/.test(text)) errs.push('drive-open');
    if (/在低位|天空钩|低位撤步|低位转身/.test(text) && scene.shooter && !canPostUp(scene.shooter, scene.matchup) && posOf(scene.shooter) !== 'PF' && posOf(scene.shooter) !== 'C') errs.push('post-mismatch');
    if (/打板/.test(text) && (!scene.bank || scene.dunk || scene.shot === 'threePT')) errs.push('bank-text');
    if (scene.bank && scene.outcome !== 'make' && scene.outcome !== 'andone') errs.push('bank');
    if (scene.zone && ZONE_CN[scene.zone] && text.indexOf(ZONE_CN[scene.zone]) >= 0 && scene.zone === 'post' && scene.shooter && posOf(scene.shooter) === 'PG') errs.push('pg-post');
    return errs;
  }

  function userHunger(game, ctx) {
    var bp = game.bp;
    var user = bp.rosterA.filter(function (p) { return p && p._isUser; })[0];
    if (!user || !ctx.userOn) return 0;
    var ln = lineOf(game, user);
    var frac = clamp(ln.mins / Math.max(4, bp.userMins), 0, 1.35);
    var gap = bp.user.fga * frac - ln.fga;
    return clamp(bp.user.usage * 0.92 * (1 + gap * 0.025), 0.06, 0.34);
  }

  var FLAVOR_ACTION_POOL = [
    { id: 'logo', shot: 'threePT', action: 'logo', contest: 'close' },
    { id: 'logo_contest', shot: 'threePT', action: 'logo', contest: 'contest' },
    { id: 'face_step', shot: 'threePT', action: 'stepback', contest: 'contest', face: true },
    { id: 'face_pull', shot: 'threePT', action: 'pull3', contest: 'contest', face: true },
    { id: 'face_snatch', shot: 'threePT', action: 'snatch', contest: 'help', face: true },
    { id: 'poster', shot: 'FIN', action: 'dunk', contest: 'help', dunk: true, poster: true, beat: true },
    { id: 'poster_heavy', shot: 'FIN', action: 'dunk', contest: 'heavy', dunk: true, poster: true, beat: true },
    { id: 'coast_poster', shot: 'FIN', action: 'coast', contest: 'help', dunk: true, poster: true, beat: true, trans: true, needPasser: true }
  ];

  function pickFlavorSpec(bp) {
    var i = bp._flavorIdx || 0;
    bp._flavorIdx = (i + 1) % FLAVOR_ACTION_POOL.length;
    return FLAVOR_ACTION_POOL[i];
  }

  function forceHelpDefender(scene, ctx, shot) {
    var pool = (ctx.defCourt || []).filter(function (p) {
      return p && pid(p) !== pid(scene.matchup) && pid(p) !== pid(scene.shooter);
    });
    if (!pool.length) return null;
    return pickWeighted(pool, function (p) {
      return 0.2 + skill01(attr(p, shot === 'FIN' ? 'IDEF' : 'PDEF')) * 1.1 + skill01(attr(p, 'BLK')) * 0.9;
    });
  }

  function sceneFlavorMade(scene) {
    return scene.outcome === 'make' || scene.outcome === 'andone';
  }

  function flavorShotTag(scene, made) {
    if (scene.poster && made) return '隔扣';
    if (scene.deep) return made ? '超远命中' : '超远打铁';
    if (scene.face && made) return '颜射三分';
    return made ? '进攻成功' : '进攻失败';
  }

  function applyFlavorSpec(scene, ctx, game, ev, fx, made, flavor) {
    if (!flavor || !scene) return;
    var bp = game.bp;
    var trans = !!flavor.trans;
    var contest = flavor.contest || scene.contest || 'close';
    if (!scene.matchup) scene.matchup = pickMatchup(scene.shooter, ctx.defCourt);
    scene.shot = flavor.shot;
    scene.contest = contest;
    if (contest === 'help' || contest === 'heavy') {
      scene.help = forceHelpDefender(scene, ctx, flavor.shot) || scene.help;
      if (!scene.help) scene.help = pickHelp(flavor.shot, scene.matchup, ctx.defCourt, { contest: 'help' });
    } else {
      scene.help = null;
    }
    if (flavor.needPasser) {
      scene.passer = pickOutletPasser(ctx.offCourt.filter(function (p) {
        return p && pid(p) !== pid(scene.shooter);
      }), scene.shooter);
    } else if (/^(logo|stepback|pull3|snatch|dunk)$/.test(flavor.action)) {
      scene.passer = null;
    }
    scene.action = remapActionForBody(scene.shooter, scene.matchup, flavor.action, trans);
    scene.dunk = !!(flavor.dunk || actionIsDunk(scene.action, scene.shooter, fx));
    fillSceneMeta(scene, trans, ev, fx);
    scene.dunk = flavor.dunk ? true : actionIsDunk(scene.action, scene.shooter, fx);
    scene.poster = !!(made && flavor.poster && scene.dunk);
    scene.face = !!(made && flavor.face);
    scene.deep = scene.action === 'logo';
    scene.beat = !!(made && flavor.beat);
    scene._flavorId = flavor.id;
  }

  function applyFlavorVisual(scene, ctx, game, ev, fx, made) {
    var bp = game.bp;
    if (!bp || !bp._flavorLab || !scene) return;
    applyFlavorSpec(scene, ctx, game, ev, fx, made, pickFlavorSpec(bp));
  }

  function maybeFlavorVisual(scene, ctx, game, ev, fx, made) {
    var bp = game.bp;
    if (!bp || bp._flavorLab || !scene) return;
    var shooter = scene.shooter;
    var shot = scene.shot;
    var action = scene.action;
    var contest = scene.contest || 'close';
    var flavor = null;
    if (shot === 'threePT' && chance(0.018 + skill01(attr(shooter, 'threePT')) * 0.015)) {
      flavor = {
        id: 'logo', shot: 'threePT', action: 'logo',
        contest: contest === 'open' ? 'close' : contest
      };
    } else if (made && shot === 'threePT' && scene.matchup && (contest === 'contest' || contest === 'help') &&
      /^(stepback|pull3|snatch|catch)$/.test(action) && chance(0.26)) {
      flavor = {
        id: 'face', shot: 'threePT',
        action: action === 'catch' ? 'stepback' : action,
        contest: contest, face: true
      };
    } else if (made && scene.dunk && action === 'coast' && (contest === 'help' || contest === 'heavy') && chance(0.32)) {
      flavor = {
        id: 'coast_poster', shot: 'FIN', action: 'coast', contest: contest,
        dunk: true, poster: true, beat: true, trans: true, needPasser: true
      };
    } else if (made && scene.dunk && action === 'dunk' && (contest === 'help' || contest === 'heavy') && chance(0.42)) {
      flavor = {
        id: 'poster', shot: 'FIN', action: 'dunk', contest: contest,
        dunk: true, poster: true, beat: true
      };
    }
    if (!flavor) return;
    applyFlavorSpec(scene, ctx, game, ev, fx, made, flavor);
  }

  function finishFlavorOverlay(scene, ctx, game, ev, fx, made) {
    if (!scene || !game || !game.bp) return;
    if (game.bp._flavorLab) applyFlavorVisual(scene, ctx, game, ev, fx, made);
    else maybeFlavorVisual(scene, ctx, game, ev, fx, made);
  }

  function shotRowTag(scene, made, flavorLab) {
    if (flavorLab || scene._flavorId) return flavorShotTag(scene, made);
    return made ? '进攻成功' : '进攻失败';
  }

  function resolvePossession(game, ctx, ev) {
    var bp = game.bp;
    var labReb = !!(bp && bp._debugReboundLab);
    var flavorLab = !!(bp && bp._flavorLab);
    var threeOnlyLab = !!(bp && bp._threeOnlyLab);
    var labShotOnly = flavorLab || threeOnlyLab;
    var side = ctx.side;
    var fx = liveFx(ev);
    var rows = [];
    var offEdge = side === 'A' ? bp.edgeA : bp.edgeB;
    var e = neededPPP(game, ctx);
    var offAdj = windowMod(game, side, 'off', false) + (fx.off || 0);
    var defAdj = windowMod(game, ctx.defSide, 'def', true) + (fx.def || 0);
    e = clamp(e + offAdj * 0.42 - defAdj * 0.42, 0.50, 2.05);
    var tovRate = clamp(0.134 - offEdge * 0.004 - offAdj * 0.02 + (fx.tov || 0) * 0.65, 0.09, 0.18);
    if (ctx.userOn) {
      tovRate = clamp(tovRate / (1 + (st(game.styles, 'tempo_master') - 1) * 0.7) * (1 + (st(game.styles, 'steal_instinct') - 1) * 0.25), 0.09, 0.18);
    }
    if (labShotOnly) tovRate = 0;
    var orbRate = clamp(0.265 + offEdge * 0.003 + (fx.orb || 0), 0.16, 0.38);
    var clock = possessionClock(ctx, ev, game);
    var form = (side === 'A' ? game.formA : game.formB) + gauss(0, 0.008);
    var rush = ctx.secLeft <= 6 ? -0.10 : 0;

    if (fx.tech && !labReb && !labShotOnly) {
      addScore(game, ctx.defSide, 1, ctx.qIdx, ctx.isOT);
      rows.push({ kind: 'tech', tag: '罚球', tone: 'make', teamSide: ctx.defSide, text: '技术犯规罚球命中' });
      return { clock: Math.min(clock, 8), orb: false, rows: rows };
    }

    if (fx.hack && !labReb && !labShotOnly) {
      var victim = (ev && ev._bind && ev._bind.actor) || ctx.offCourt[0];
      if (!victim || ctx.offCourt.indexOf(victim) < 0) victim = ctx.offCourt[0];
      var hackFt = shotPctFor(victim, 'FT', 0, form * 0.4, 1, victim && victim._isUser ? styleMul('ice_ft', game) : 1);
      var hackLn = lineOf(game, victim);
      var hackMade = 0, hackFta = 2, hi;
      for (hi = 0; hi < hackFta; hi++) {
        hackLn.fta++;
        if (chance(hackFt)) { hackLn.ftm++; hackLn.pts++; addScore(game, side, 1, ctx.qIdx, ctx.isOT); hackMade++; }
      }
      rows.push({
        kind: 'hack', tag: '造杀伤', tone: hackMade ? 'make' : 'miss', teamSide: side,
        text: '故意送 ' + nm(victim) + ' 上罚球线，罚球 ' + hackMade + '/' + hackFta
      });
      return { clock: Math.min(clock, 10), orb: false, rows: rows };
    }

    if (!labReb && !labShotOnly && (fx.forceTov || fx.stl || chance(tovRate))) {
      var loser = pickShooter(ctx.offCourt, ctx.userOn, ctx.usage * 0.55, false) || ctx.offCourt[0];
      lineOf(game, loser).tov++;
      var userOnDef = ctx.defCourt.filter(function (p) { return p && p._isUser; })[0];
      var stealMul = 1;
      if (userOnDef) stealMul = 1 + (st(game.styles, 'perimeter_lock') * st(game.styles, 'steal_instinct') - 1) * 0.35;
      var stealer = null;
      if (fx.stl || chance(0.58 * stealMul)) {
        stealer = (ev && ev._bind && ev._bind.actor && ctx.defCourt.indexOf(ev._bind.actor) >= 0)
          ? ev._bind.actor
          : pickWeighted(ctx.defCourt, function (p) {
            var w = 0.2 + skill01(attr(p, 'PDEF')) * 1.4;
            if (p && p._isUser) w *= 1.35 * st(game.styles, 'perimeter_lock') * st(game.styles, 'steal_instinct');
            return w;
          });
        if (stealer) lineOf(game, stealer).stl++;
      }
      if (stealer) {
        rows.push(attachPbp({
          kind: 'stl', tag: '防守成功', tone: 'stop', teamSide: ctx.defSide,
          text: composeTurnoverText(loser, stealer, fx, ev)
        }, { kind: 'stl', shooter: loser, stealer: stealer, loser: loser, matchup: stealer, tactic: 'steal', branch: 'strip', camera: 'full', action: 'layup', contest: 'contest', outcome: 'miss' }, ctx, game));
      } else {
        var tovText = composeTurnoverText(loser, null, fx, ev);
        var passTov = /传球出界|传穿/.test(tovText);
        var sceneShooter = loser;
        var scenePasser = null;
        if (passTov) {
          scenePasser = loser;
          sceneShooter = pickWeighted(ctx.offCourt.filter(function (p) { return p && pid(p) !== pid(loser); }), function (p) {
            var w = 0.25 + skill01(attr(p, 'ATH')) * 0.9 + skill01(attr(p, 'HAN')) * 0.35;
            if (p._isUser) w *= 1.2;
            return w;
          });
          if (!sceneShooter) {
            sceneShooter = ctx.offCourt.filter(function (p) { return p && pid(p) !== pid(loser); })[0];
          }
          if (!sceneShooter) sceneShooter = loser;
        }
        rows.push(attachPbp({
          kind: 'tov', tag: '进攻失败', tone: 'miss', teamSide: side,
          text: tovText
        }, {
          kind: 'tov',
          shooter: sceneShooter,
          passer: scenePasser,
          loser: loser,
          tactic: passTov ? 'pnr_side' : 'iso_mid',
          branch: passTov ? 'extra' : 'jumper',
          camera: 'half',
          action: passTov ? 'catch' : 'slash',
          contest: 'contest',
          outcome: 'miss'
        }, ctx, game));
      }
      return { clock: clock, orb: false, rows: rows };
    }

    var shooter = (ev && ev._bind && ev._bind.actor && ctx.offCourt.indexOf(ev._bind.actor) >= 0)
      ? ev._bind.actor
      : pickShooter(ctx.offCourt, ctx.userOn, ctx.usage, ctx.clutch);
    if (!shooter) shooter = ctx.offCourt[0];
    var passer = null;
    if (fx.helperAst && ev._bind && ev._bind.helper && pid(ev._bind.helper) !== pid(shooter)) passer = ev._bind.helper;
    else if (chance(0.62 + (ctx.userOn ? (st(game.styles, 'tempo_master') - 1) * 0.18 : 0))) {
      passer = pickWeighted(ctx.offCourt.filter(function (p) { return p && pid(p) !== pid(shooter); }), function (p) {
        var w = 0.2 + skill01(attr(p, 'PAS')) * 1.6;
        if (p._isUser) w *= 1.75 * st(game.styles, 'tempo_master');
        return w;
      });
    }

    var shot;
    if (threeOnlyLab) shot = 'threePT';
    else {
      var hint = fx.shot === 'three' ? 'threePT' : fx.shot;
      shot = hint || pickShotType(shooter, null, game.styles);
      if (shot === 'three') shot = 'threePT';
    }
    var evHint = eventActionHint(ev, fx);
    var trans = clock <= 9 || hasTag(game, 'transition') || !!(evHint && evHint.trans);
    if (threeOnlyLab) trans = false;
    if (trans) {
      if (!passer) passer = pickOutletPasser(ctx.offCourt, shooter);
    }
    if (evHint.action === 'coast' && !passer) passer = pickOutletPasser(ctx.offCourt, shooter);
    var matchup = pickMatchup(shooter, ctx.defCourt);
    var help = pickHelp(shot, matchup, ctx.defCourt, evHint);
    var contest = rollContest(shot, shooter, matchup, help, evHint);
    var action = pickAction(shooter, shot, passer, contest, trans, evHint, fx);
    if (action === 'coast' && !passer) passer = pickOutletPasser(ctx.offCourt, shooter);
    if (action === 'lob' && !passer) {
      action = threeOnlyLab ? 'pull3' : (attr(shooter, 'DNK') >= 78 ? 'dunk' : 'layup');
    }
    if (threeOnlyLab && /^(layup|dunk|euro|hop|upunder|slash|cross|hesi|reverse|faceup|backdoor|dropstep|putback|coast)$/.test(action)) {
      action = passer ? (chance(0.55) ? 'catch' : 'spot') : (chance(0.35) ? 'stepback' : 'pull3');
    }
    if ((action === 'cut' || action === 'spot' || action === 'catch' || action === 'flare' || action === 'pin' || action === 'dho') && !passer) action = shot === 'threePT' ? 'pull3' : 'jumper';
    if (passer && shot === 'threePT' && (action === 'catch' || action === 'spot' || action === 'cut' || action === 'flare' || action === 'pin')) {
      if (contest === 'heavy') contest = 'help';
      else if (contest === 'contest' && chance(0.55)) contest = 'close';
      else if (contest === 'close' && chance(0.50)) contest = 'open';
      else if (contest === 'contest' && chance(0.22)) contest = 'open';
    }
    if (/^(fade|hook|skyhook|stepback|pullup|jab|postspin|snatch|runner)$/.test(action) && contest === 'open') contest = 'close';
    if (!threeOnlyLab && contest === 'open' && /^(euro|hop|upunder|slash|cross|hesi|faceup|reverse)$/.test(action)) {
      action = attr(shooter, 'DNK') >= 82 && chance(0.4) ? 'dunk' : 'layup';
    }
    if (action === 'cut' && contest !== 'open' && contest !== 'close') action = passer ? 'catch' : 'pull3';
    if (contest === 'open') help = null;
    action = remapActionForBody(shooter, matchup, action, trans);
    action = syncShotAction(shot, action);
    var dunk = actionIsDunk(action, shooter, fx);
    var scene = {
      shooter: shooter, passer: passer, matchup: matchup, help: help,
      shot: shot, contest: contest, action: action, dunk: dunk
    };
    fillSceneMeta(scene, trans, ev, fx);
    if (threeOnlyLab) {
      scene.shot = 'threePT';
      scene.dunk = false;
      if (/^(layup|dunk|euro|hop|upunder|slash|cross|hesi|reverse|faceup|backdoor|dropstep|putback|lob|coast|trail)$/.test(scene.action)) {
        scene.action = scene.passer ? (chance(0.55) ? 'catch' : 'spot') : (chance(0.35) ? 'stepback' : 'pull3');
      }
      scene.action = syncShotAction('threePT', scene.action);
      scene.dunk = false;
      var labMeta = pickTactic(scene.action, false, ev, fx, scene.shooter, scene.passer, 'threePT');
      scene.tactic = labMeta.tactic;
      scene.branch = labMeta.branch;
      scene.camera = labMeta.camera;
      scene.zone = pickZone(scene.action, scene.tactic, 'threePT');
      shot = 'threePT';
      action = scene.action;
      dunk = false;
    }
    if (trans && scene.passer && scene.shooter && pid(scene.passer) === pid(scene.shooter)) {
      scene.passer = pickOutletPasser(ctx.offCourt.filter(function (p) { return p && pid(p) !== pid(scene.shooter); }), scene.shooter);
    }
    dunk = scene.dunk = actionIsDunk(scene.action, shooter, fx);
    action = scene.action;

    var rim = (ev && ev._bind && ev._bind.actor && ctx.defCourt.indexOf(ev._bind.actor) >= 0)
      ? ev._bind.actor
      : (roleOn(ctx.defCourt, 'rim') || ctx.defCourt[0]);
    var userDef = ctx.defCourt.filter(function (p) { return p && p._isUser; })[0];
    var blkP = 0.055 + skill01(attr(rim, 'BLK')) * 0.09;
    blkP = shot === 'FIN' ? blkP + 0.04 : blkP * 0.35;
    if (userDef && (st(game.styles, 'rim_protector') > 1.01 || st(game.styles, 'dunk_threat') > 1.01)) {
      blkP *= 1 + (st(game.styles, 'rim_protector') - 1) * 0.35 + (st(game.styles, 'dunk_threat') - 1) * 0.12;
    }
    blkP *= CONTEST_BLK[contest] || 1;
    if (fx.blk || chance(blkP)) {
      if (fx.blk || chance(0.62)) {
        var blocker = fx.blk && ev && ev._bind && ev._bind.actor && ctx.defCourt.indexOf(ev._bind.actor) >= 0
          ? ev._bind.actor
          : pickBlocker(shot, matchup, help, rim, userDef, game);
        if (!blocker) blocker = rim || ctx.defCourt[0];
        lineOf(game, blocker).blk++;
        lineOf(game, shooter).fga++;
        if (shot === 'threePT') lineOf(game, shooter).threeA++;
        scene.outcome = 'blk';
        scene.blocker = blocker;
        finishFlavorOverlay(scene, ctx, game, ev, fx, false);
        rows.push(attachPbp({
          kind: 'blk', tag: '防守成功', tone: 'stop', teamSide: ctx.defSide,
          text: composeShotText(scene)
        }, scene, ctx, game));
        var blkReb = doRebound(game, ctx, orbRate * 0.72);
        rows = rows.concat(reboundRows(ctx, blkReb));
        return { clock: clock, orb: !!blkReb.orb, rows: rows };
      }
    }

    var clutchMul = ctx.clutch ? (1 + skill01(attr(shooter, 'CLU')) * 0.12) : 1;
    var userBoost = 1;
    if (shooter && shooter._isUser) {
      if (shot === 'threePT') userBoost *= st(game.styles, 'cold_arrow') * (1 + (st(game.styles, 'off_ball') - 1) * 0.45);
      if (shot === 'MID') userBoost *= st(game.styles, 'mid_craftsman') * (1 + (st(game.styles, 'off_ball') - 1) * 0.35);
      if (shot === 'FIN') userBoost *= (1 + (st(game.styles, 'dunk_threat') - 1) * 0.35);
      if (ctx.clutch) userBoost *= (1 + (st(game.styles, 'clutch_heart') - 1) * 0.45);
    }
    var defP = bp.defPressure + (side === 'B' ? -bp.defPressure * 0.25 : 0) + defAdj * 0.04;
    if (shooter && shooter._isUser && shot === 'MID') {
      defP *= (1 - (st(game.styles, 'mid_craftsman') - 1) * 0.7);
    }
    var pct = shotPctFor(shooter, shot, defP, form, clutchMul, userBoost);
    pct += (e - 1.154) * (e >= 1.154 ? 0.50 : 0.44);
    if (ctx.home) pct += 0.005;
    pct += rush;
    if (hasTag(game, 'transition') && shot === 'FIN') pct += 0.06;
    pct += (CONTEST_PCT[contest] || 0) - CONTEST_PCT_CENTER;
    pct = clampHalf(pct, 0.16, 0.80, 0.90);

    var ftRate = clamp(0.07 + skill01(attr(shooter, 'FIN')) * 0.20 + skill01(attr(shooter, 'STR')) * 0.11 + skill01(attr(shooter, 'HAN')) * 0.06, 0.07, 0.62);
    if (shooter && shooter._isUser) ftRate = clamp(ftRate * 0.82 * st(game.styles, 'finisher'), 0.07, 0.62);
    var foulP = shot === 'FIN' ? ftRate * 0.82 : ftRate * 0.38;
    if (fx.hack) foulP = 1;
    else if (fx.foul) foulP = Math.max(foulP, 0.72);
    var shootingFoul = chance(foulP);

    if (shootingFoul && !labReb) {
      var fta = shot === 'threePT' ? 3 : 2;
      var andOne = false;
      if (!labReb && !fx.hack && shot === 'FIN' && chance(0.20)) {
        if (chance(pct)) {
          recordShot(game, shooter, 'FIN', true, 2, passer, side, ctx.qIdx, ctx.isOT);
          fta = 1;
          andOne = true;
        } else {
          lineOf(game, shooter).fga++;
        }
      }
      var ftPct = shotPctFor(shooter, 'FT', 0, form * 0.4, clutchMul, shooter._isUser ? styleMul('ice_ft', game) : 1);
      var ln = lineOf(game, shooter);
      var madeFt = 0;
      for (var i = 0; i < fta; i++) {
        ln.fta++;
        if (chance(ftPct)) {
          ln.ftm++; ln.pts++; addScore(game, side, 1, ctx.qIdx, ctx.isOT);
          madeFt++;
        }
      }
      scene.ftMade = madeFt;
      scene.fta = fta;
      scene.outcome = andOne ? 'andone' : 'foul';
      scene.beat = driveAction(action) && (andOne || contest === 'help' || contest === 'heavy');
      if (andOne) scene.bank = rollBankShot(scene);
      finishFlavorOverlay(scene, ctx, game, ev, fx, andOne);
      rows.push(attachPbp({
        kind: andOne ? 'andone' : 'foul', tag: '造杀伤', tone: madeFt ? 'make' : 'miss', teamSide: side,
        text: composeShotText(scene)
      }, scene, ctx, game));
      return { clock: clock, orb: false, rows: rows };
    }

    var made = labReb ? false : chance(pct);
    var pts = shot === 'threePT' ? 3 : 2;
    recordShot(game, shooter, shot, made, pts, passer, side, ctx.qIdx, ctx.isOT);
    scene.outcome = made ? 'make' : 'miss';
    scene.beat = !!(driveAction(action) && matchup && (contest === 'help' || contest === 'heavy' || (made && contest !== 'open')));
    if (made) scene.bank = rollBankShot(scene);
    finishFlavorOverlay(scene, ctx, game, ev, fx, made);
    rows.push(attachPbp({
      kind: made ? 'make' : 'miss',
      tag: shotRowTag(scene, made, flavorLab),
      tone: made ? 'make' : 'miss',
      teamSide: side,
      text: composeShotText(scene)
    }, scene, ctx, game));
    if (made) return { clock: clock, orb: false, rows: rows };
    var missReb = doRebound(game, ctx, orbRate);
    rows = rows.concat(reboundRows(ctx, missReb));
    return { clock: clock, orb: !!missReb.orb, rows: rows };
  }

  function emitPlay(sess, ctx, row) {
    var game = sess.game;
    var bp = game.bp;
    var sec = row.secLeft != null ? row.secLeft : (ctx && ctx.secLeft != null ? ctx.secLeft : sess.clock);
    var q = ctx && ctx.q != null ? ctx.q : sess.q;
    var isOT = ctx ? !!ctx.isOT : !!sess.isOT;
    var play = {
      type: row.kind === 'meta' ? 'meta' : 'pbp',
      q: q,
      isOT: isOT,
      ot: game.ot,
      secLeft: sec,
      clock: fmtClock(sec),
      elapsed: elapsedSec(q, sec, isOT, game.ot, bp._quarterSec),
      elapsedLabel: fmtElapsed(elapsedSec(q, sec, isOT, game.ot, bp._quarterSec)),
      team: row.teamSide === 'B' ? teamName(game.bp.teamB) : (row.teamSide === 'A' ? teamName(game.bp.teamA) : ''),
      teamCode: row.teamSide === 'B' ? game.bp.teamB : (row.teamSide === 'A' ? game.bp.teamA : ''),
      teamSide: row.teamSide || '',
      tag: row.tag || '',
      text: row.text || '',
      kind: row.kind || 'pbp',
      tone: row.tone || '',
      scoreA: game.scoreA,
      scoreB: game.scoreB
    };
    if (row.clip) play.clip = row.clip;
    if (PP_LIVE._collectPbp && row._pbp) {
      play._pbp = row._pbp;
      play._pbpErrs = auditPbpScene(row._pbp, play.text);
    }
    game.plays.push(play);
    game.feed.push(play);
    sess.tickPlays.push(play);
    if (game) {
      if (row.kind === 'orb') game._courtLive = true;
      else if (row.kind === 'drb') game._courtLive = false;
    }
    return play;
  }

  function emitMeta(sess, text) {
    if (sess.game) sess.game._courtLive = false;
    emitPlay(sess, { q: sess.q, isOT: sess.isOT, secLeft: sess.clock }, {
      kind: 'meta', tag: '', tone: '', text: text, secLeft: sess.clock
    });
  }

  function emitJumpBall(sess) {
    var game = sess.game;
    var bp = game.bp;
    var q = sess.q;
    var clock = sess.clock;
    var isOT = sess.isOT;
    var margin = game.scoreA - game.scoreB;
    var stintOpts = { allStar: bp._allStarExhibition, quarterSec: bp._quarterSec };
    var stint = stintOf(q, clock, margin, isOT, stintOpts);
    var user = bp.rosterA.filter(function (p) { return p && p._isUser; })[0];
    var userWanted = userWantedOn(game, stint, q, clock, margin, isOT);
    var courtA = pickCourt(bp.rosterA, stint, userWanted, user);
    var courtB = pickCourt(bp.rosterB, stint, false, null);
    var centerA = roleOn(courtA, 'big') || courtA[0];
    var centerB = roleOn(courtB, 'big') || courtB[0];
    var winCourt = sess.possessor === 'A' ? courtA : courtB;
    var tipTo = roleOn(winCourt, 'pg') || winCourt[0];
    var winnerTeam = sess.possessor === 'A'
      ? (bp.displayNameA || teamName(bp.teamA))
      : (bp.displayNameB || teamName(bp.teamB));
    var text = nm(centerA) + '与' + nm(centerB) + '中圈争球，球拨给' + nm(tipTo) + '，' + winnerTeam + '先攻';
    var ctx = { q: q, isOT: isOT, secLeft: clock, side: sess.possessor };
    var row = {
      kind: 'jump',
      tag: '跳球',
      tone: '',
      teamSide: sess.possessor,
      text: text,
      secLeft: clock
    };
    if (window.PP_COURT && typeof PP_COURT.composeJumpBall === 'function') {
      try {
        var clip = PP_COURT.composeJumpBall({
          centerA: pid(centerA),
          centerB: pid(centerB),
          tipTo: pid(tipTo),
          winner: sess.possessor,
          off: courtA.map(function (p) { return slimCourtPlayer(p, 'off'); }).filter(Boolean),
          def: courtB.map(function (p) { return slimCourtPlayer(p, 'def'); }).filter(Boolean),
          teamAHome: !!bp.teamAHome,
          attackRight: attackRightFor({ side: 'A', q: q, isOT: isOT })
        });
        if (clip) {
          clip.attackRight = attackRightFor({ side: 'A', q: q, isOT: isOT });
          row.clip = clip;
        }
      } catch (e) { /* ignore */ }
    }
    game._courtLive = false;
    emitPlay(sess, ctx, row);
  }

  function stintLabel(stint) {
    if (stint === 'starters') return '首发阵容上场';
    if (stint === 'bench') return '替补时段';
    return '混合轮换';
  }

  function buildCtx(sess) {
    var game = sess.game;
    var bp = game.bp;
    var q = sess.q;
    var clock = sess.clock;
    var isOT = sess.isOT;
    var qIdx = sess.qIdx;
    var margin = game.scoreA - game.scoreB;
    var stintOpts = { allStar: bp._allStarExhibition, quarterSec: bp._quarterSec };
    var stint = stintOf(q, clock, margin, isOT, stintOpts);
    var user = bp.rosterA.filter(function (p) { return p && p._isUser; })[0];
    var userWanted = userWantedOn(game, stint, q, clock, margin, isOT);
    var courtA = pickCourt(bp.rosterA, stint, userWanted, user);
    var courtB = pickCourt(bp.rosterB, stint, false, null);
    var side = sess.possessor;
    var offCourt = side === 'A' ? courtA : courtB;
    var defCourt = side === 'A' ? courtB : courtA;
    var clutch = !isOT && q === 4 && clock <= 180 && Math.abs(margin) <= 8;
    if (isOT && Math.abs(margin) <= 8) clutch = true;
    var garbage = q === 4 && !isOT && clock <= 480 && Math.abs(margin) >= 18;
    if (garbage) grantTag(game, 'garbage');
    var ctx = {
      q: q, qIdx: qIdx, secLeft: clock, isOT: isOT, ot: game.ot,
      side: side, defSide: side === 'A' ? 'B' : 'A',
      margin: side === 'A' ? margin : -margin,
      home: bp.teamAHome && side === 'A',
      b2b: !!bp._b2b && side === 'A',
      national: !!bp._national,
      playoff: !!bp.isPlayoff,
      stint: stint,
      clutch: clutch && !garbage, garbage: garbage,
      offCourt: offCourt, defCourt: defCourt,
      courtA: courtA, courtB: courtB,
      teamOff: side === 'A' ? bp.teamA : bp.teamB,
      teamDef: side === 'A' ? bp.teamB : bp.teamA,
      userOn: !!(user && courtA.indexOf(user) >= 0 && side === 'A'),
      userOnFloor: !!(user && courtA.indexOf(user) >= 0),
      user: user,
      usage: 0,
      hot: isHot(game, side),
      cold: isCold(game, side),
      afterTimeout: sess.afterTimeout,
      han: attr(roleOn(offCourt, 'pg') || offCourt[0], 'HAN'),
      ath: attr(roleOn(offCourt, 'star') || offCourt[0], 'ATH'),
      three: attr(roleOn(offCourt, 'shooter') || offCourt[0], 'threePT'),
      oppThree: attr(roleOn(defCourt, 'shooter') || defCourt[0], 'threePT'),
      mid: attr(roleOn(offCourt, 'star') || offCourt[0], 'MID'),
      fin: attr(roleOn(offCourt, 'big') || offCourt[0], 'FIN'),
      pas: attr(roleOn(offCourt, 'pg') || offCourt[0], 'PAS'),
      oppPace: paceOfStar(game, roleOn(defCourt, 'star'), qIdx),
      starPace: paceOfStar(game, roleOn(offCourt, 'star'), qIdx),
      fiveOut: offCourt.filter(function (p) { return attr(p, 'threePT') >= 76; }).length >= 4,
      twoBigs: offCourt.filter(function (p) { return posOf(p) === 'C' || posOf(p) === 'PF'; }).length >= 2,
      oppFt: (attr(roleOn(defCourt, 'big'), 'CLU') + attr(roleOn(defCourt, 'big'), 'MID')) / 200,
      userFt: user ? (attr(user, 'CLU') * 0.5 + attr(user, 'MID') * 0.25 + attr(user, 'threePT') * 0.25) / 99 : 0.8
    };
    ctx.usage = userHunger(game, ctx);
    return ctx;
  }

  function applyOutcome(sess, ctx, outcome) {
    var game = sess.game;
    addMins(game, ctx.courtA.concat(ctx.courtB), outcome.clock);
    sess.clock -= outcome.clock;
    sess.afterTimeout = false;
    if (hasTag(game, 'transition') && rand() < 0.55) game.tags.transition = false;
    if (outcome.orb && sess.clock > 2.5) {
      sess.possessor = ctx.side;
    } else {
      if (ctx.side === 'A') game.possA++; else game.possB++;
      sess.possessor = ctx.side === 'A' ? 'B' : 'A';
    }
    game._nextPoss = sess.possessor;
  }

  function emitOutcomeRows(sess, ctx, outcome) {
    var after = Math.max(0, ctx.secLeft - (outcome.clock || 0));
    mergeReboundClip(outcome.rows, ctx, sess.game);
    (outcome.rows || []).forEach(function (row) {
      row.secLeft = after;
      emitPlay(sess, ctx, row);
    });
  }

  function runPreparedPossession(sess, ctx, ev) {
    var outcome = resolvePossession(sess.game, ctx, ev);
    emitOutcomeRows(sess, ctx, outcome);
    applyOutcome(sess, ctx, outcome);
  }

  function closePeriod(sess) {
    var game = sess.game;
    var bp = game.bp;
    if (!sess.isOT && sess.q === 4 && bp._noOT && game.scoreA === game.scoreB) {
      if (rand() < 0.5) game.scoreA++;
      else game.scoreB++;
    }
    var qA = sess.isOT ? game.otA : game.qA[sess.qIdx];
    var qB = sess.isOT ? game.otB : game.qB[sess.qIdx];
    emitMeta(sess, periodLabel(sess.q, sess.isOT, game.ot) + '结束　' + qA + '-' + qB);
    if (!sess.isOT && sess.q === 4) {
      game.regPossA = game.possA;
      game.regPossB = game.possB;
    }
    sess.awaitingPeriod = true;
  }

  function openNextPeriod(sess) {
    var game = sess.game;
    if (!sess.isOT && sess.q < 4) {
      sess.q += 1;
      sess.qIdx = sess.q - 1;
      sess.clock = game.bp._quarterSec || 720;
      sess.isOT = false;
      sess.afterTimeout = true;
      sess.lastStint = null;
      sess.lastUserOn = null;
      sess.possessor = game._nextPoss || sess.possessor || 'A';
      emitMeta(sess, periodLabel(sess.q, false) + '开始');
      return true;
    }
    if (game.scoreA !== game.scoreB) {
      return false;
    }
    if (game.bp._noOT) return false;
    game.ot++;
    game.thisOtA = clamp(Math.round(gauss(9, 2.2)), 4, 16);
    game.thisOtB = clamp(Math.round(gauss(9, 2.2)), 4, 16);
    if (game.thisOtA === game.thisOtB) game.thisOtA++;
    game.otTgtA = (game.otTgtA || 0) + game.thisOtA;
    game.otTgtB = (game.otTgtB || 0) + game.thisOtB;
    game.otA = 0;
    game.otB = 0;
    sess.q = 4;
    sess.qIdx = 3;
    sess.isOT = true;
    sess.clock = 300;
    sess.afterTimeout = true;
    sess.lastStint = null;
    sess.lastUserOn = null;
    if (game.ot === 1) {
      sess.possessor = rand() < 0.5 ? 'A' : 'B';
      emitMeta(sess, periodLabel(sess.q, true, game.ot) + '开始');
      emitJumpBall(sess);
    } else {
      sess.possessor = sess.possessor === 'A' ? 'B' : 'A';
      var otFirst = sess.possessor === 'A' ? teamName(game.bp.teamA) : teamName(game.bp.teamB);
      emitMeta(sess, periodLabel(sess.q, true, game.ot) + '开始　' + otFirst + '先攻');
    }
    return true;
  }

  function finishGame(sess) {
    if (sess.done) return;
    var game = sess.game;
    var bp = game.bp;
    if (game.scoreA === game.scoreB) {
      sess.awaitingPeriod = true;
      if (openNextPeriod(sess)) return;
    }
    // 终场比分与数据栏以回合模拟结果为准，不再事后校准
    emitMeta(sess, '终场　' + Math.round(game.scoreA) + '-' + Math.round(game.scoreB));
    var won = game.scoreA > game.scoreB;
    var margin = Math.abs(game.scoreA - game.scoreB);
    var keyEvents = game.events.map(function (e) { return e.name; }).slice(0, 6);
    if (game.ot) keyEvents.unshift('⏱ 加时赛 #' + game.ot);
    if (margin <= 3) keyEvents.push(won ? '⚡ 关键回合守住胜局' : '💔 最后回合惜败');
    var expectedMargin = bp.pace * (bp.efficiencyA - bp.efficiencyB);
    var expectedWinProb = 1 / (1 + Math.exp(-expectedMargin / 7.2));
    var teamA = bp.teamA;
    var teamB = bp.teamB;
    var result = {
      won: won, scoreA: Math.round(game.scoreA), scoreB: Math.round(game.scoreB),
      qScoresA: game.qA.slice(), qScoresB: game.qB.slice(),
      highlight: game.ot > 0 || margin <= 3,
      keyEvents: keyEvents, ot: game.ot,
      teamA: { power: bp.powerA }, teamB: { power: bp.powerB },
      pace: bp.pace, possPerQ: Math.round(bp.pace / 4), expectedWinProb: expectedWinProb,
      home: bp.teamAHome,
      boxScore: {},
      liveSim: true
    };
    result.boxScore[teamA] = toBox(game, teamA, bp.rosterA);
    result.boxScore[teamB] = toBox(game, teamB, bp.rosterB);
    var stats = toUserStats(game, bp);
    if (typeof syncUserStatsIntoBoxScore === 'function') syncUserStatsIntoBoxScore(result, stats);
    applyProfile(game);
    sess.pack = { result: result, stats: stats, live: game, bp: bp };
    sess.done = true;
  }

  function maybeRotationLines(sess, ctx) {
    if (sess.lastStint && sess.lastStint !== ctx.stint) {
      emitPlay(sess, ctx, { kind: 'meta', tag: '轮换', tone: '', text: '[轮换] ' + stintLabel(ctx.stint) });
    }
    sess.lastStint = ctx.stint;
    if (ctx.user && sess.lastUserOn != null && ctx.userOnFloor !== sess.lastUserOn) {
      emitPlay(sess, ctx, {
        kind: 'meta', tag: '轮换', tone: '',
        text: '[轮换] ' + nm(ctx.user) + (ctx.userOnFloor ? ' 回到场上' : ' 下场休息')
      });
    }
    sess.lastUserOn = ctx.userOnFloor;
  }

  function startPossession(sess) {
    var ctx = buildCtx(sess);
    maybeRotationLines(sess, ctx);
    var ev = maybeEvent(sess.game, ctx);
    if (ev) {
      ev._bind = bindEventPeople(ev, ctx);
      emitPlay(sess, ctx, {
        kind: 'flavor', tag: ev.name, tone: 'flavor', teamSide: ctx.side,
        text: ev._bind.text
      });
      applyEventFx(sess.game, ev, ctx, ev._bind);
    }
    runPreparedPossession(sess, ctx, ev);
  }

  function tickSession(sess) {
    sess.tickPlays = [];
    if (sess.done) return { done: true, plays: [] };
    if (sess.awaitingPeriod) {
      sess.awaitingPeriod = false;
      if (!openNextPeriod(sess)) {
        finishGame(sess);
        return { done: true, plays: sess.tickPlays };
      }
      return { done: false, plays: sess.tickPlays };
    }
    if (sess.clock <= 1.2) {
      closePeriod(sess);
      return { done: false, plays: sess.tickPlays };
    }
    startPossession(sess);
    if (sess.clock <= 1.2) closePeriod(sess);
    return { done: false, plays: sess.tickPlays };
  }

  function normalizeLiveOptions(options) {
    options = options || {};
    if (options.fatigueA == null) {
      var sch = STATE.season && STATE.season.schedule || [];
      var gg = options.game || sch.find(function (x) { return !x.simulated; });
      if (gg) {
        var gidx = sch.indexOf(gg);
        options.fatigueA = gidx > 0 && sch[gidx - 1] && sch[gidx - 1].isB2B ? 1 : 0;
      }
    }
    if (options.teamAHome == null) {
      var schedule = STATE.season && STATE.season.schedule || [];
      var g = options.game || schedule.find(function (x) { return !x.simulated; });
      options.teamAHome = g ? !!g.home : true;
    }
    return options;
  }

  function createLiveSession(teamA, teamB, options) {
    options = normalizeLiveOptions(options);
    var bp = buildBlueprint(teamA, teamB, options);
    bp._b2b = !!options.fatigueA;
    bp._national = !!options.national;
    var game = makeGameState(bp);
    var sess = {
      watch: !!options.watch,
      fastForward: false,
      broadcastScale: Math.max(0.25, Number(options.broadcastScale) || 1),
      bp: bp,
      game: game,
      q: 1,
      qIdx: 0,
      clock: bp._quarterSec || 720,
      isOT: false,
      possessor: rand() < 0.5 ? 'A' : 'B',
      afterTimeout: true,
      lastStint: null,
      lastUserOn: null,
      awaitingPeriod: false,
      done: false,
      pack: null,
      tickPlays: []
    };
    emitJumpBall(sess);
    return sess;
  }

  function runSessionToEnd(sess) {
    var guard = 0;
    while (!sess.done && guard < 4000) {
      tickSession(sess);
      guard++;
    }
    if (!sess.done) finishGame(sess);
    return sess.pack;
  }

  function toBox(game, team, roster) {
    return roster.map(function (p) {
      var ln = lineOf(game, p);
      return {
        name: nm(p), pos: posOf(p),
        pts: Math.round(ln.pts), reb: Math.round(ln.reb), ast: Math.round(ln.ast),
        stl: Math.round(ln.stl), blk: Math.round(ln.blk), tov: Math.round(ln.tov),
        fgm: Math.round(ln.fgm), fga: Math.round(ln.fga),
        threeM: Math.round(ln.threeM), threeA: Math.round(ln.threeA),
        ftm: Math.round(ln.ftm), fta: Math.round(ln.fta),
        mins: Math.max(0, Math.round(ln.mins)),
        isUser: !!p._isUser
      };
    });
  }

  function toUserStats(game, bp) {
    var user = bp.rosterA.filter(function (p) { return p && p._isUser; })[0];
    var ln = user ? lineOf(game, user) : emptyLine();
    return {
      pts: Math.round(ln.pts), reb: Math.round(ln.reb), ast: Math.round(ln.ast),
      stl: Math.round(ln.stl), blk: Math.round(ln.blk), tov: Math.round(ln.tov),
      fgm: Math.round(ln.fgm), fga: Math.max(Math.round(ln.fga), Math.round(ln.fgm)),
      ftm: Math.round(ln.ftm), fta: Math.max(Math.round(ln.fta), Math.round(ln.ftm)),
      threeM: Math.round(ln.threeM), threeA: Math.max(Math.round(ln.threeA), Math.round(ln.threeM)),
      mins: Math.max(0, Math.round(ln.mins || 0))
    };
  }

  function applyProfile(game) {
    if (!game.profile || typeof addProfileDelta !== 'function') return;
    Object.keys(game.profile).forEach(function (k) {
      var v = game.profile[k];
      if (v) addProfileDelta(k, v > 0 ? 1 : -1);
    });
  }

  function run(teamA, teamB, options) {
    var sess = createLiveSession(teamA, teamB, options);
    return runSessionToEnd(sess);
  }
  PP_LIVE.run = run;
  PP_LIVE.EVENT_COUNT = LIVE_EVENTS.length;

  /* ---------- 关键场次 ---------- */
  function describeRegular(game, index, total) {
    var opp = teamName(game.opponent);
    var loc = game.home ? '主场对' : '客场挑战';
    if (index === 0) return '赛季揭幕战，' + loc + opp + '。';
    if (index === total - 1) return '常规赛收官战，' + loc + opp + '。';
    if (isRivalGame(game)) return '死敌所在的 ' + opp + ' 来了，' + loc + '他们。';
    if (isMvpHeatGame(game)) return '上届 MVP 所在的 ' + opp + '，联盟焦点战。';
    if (isRaceGame(game, index, total)) return '排名咬得很紧，' + loc + opp + ' 可能改写排位。';
    return loc + opp + '。';
  }

  function isRivalGame(game) {
    var r = STATE.career && STATE.career.flags && STATE.career.flags.storyRival;
    return !!(r && r.team && game && game.opponent === r.team);
  }
  function lastMvpInfo() {
    var m = STATE.career && STATE.career.lastMvp;
    if (m && m.team) return m;
    if (!STATE.career || !STATE.career.seasonCount) return { team: 'OKC', isUser: false };
    return null;
  }
  function isMvpHeatGame(game) {
    var m = lastMvpInfo();
    if (!m || m.isUser || !m.team) return false;
    return !!(game && game.opponent === m.team);
  }
  function isRaceGame(game, index, total) {
    if (!game || total - index > 18) return false;
    if (typeof getConference !== 'function' || typeof getConferenceSeed !== 'function') return false;
    var me = STATE.careerTeam;
    var opp = game.opponent;
    if (!me || !opp || getConference(me) !== getConference(opp)) return false;
    var mySeed = getConferenceSeed(me);
    var oppSeed = getConferenceSeed(opp);
    if (mySeed > 12 && oppSeed > 12) return false;
    return Math.abs(mySeed - oppSeed) <= 2;
  }

  function shouldOfferRegular(game, index, total) {
    if (!game || game._livePrompted) return false;
    var season = STATE.season || {};
    if (season._skipLiveRegular) return false;
    var opener = index === 0;
    var closer = index === total - 1;
    if (!opener && !closer && (season._liveOffers || 0) >= REGULAR_OFFER_CAP) return false;
    var reason = null;
    if (opener) reason = 'opener';
    else if (closer) reason = 'closer';
    else if (isRivalGame(game)) reason = 'rival';
    else if (isMvpHeatGame(game)) reason = 'mvp';
    else if (isRaceGame(game, index, total) && (season._liveRace || 0) < 3) reason = 'race';
    if (!reason) return false;
    game._livePrompted = true;
    season._liveOffers = (season._liveOffers || 0) + 1;
    if (reason === 'race') season._liveRace = (season._liveRace || 0) + 1;
    return true;
  }
  PP_LIVE.shouldOfferRegular = shouldOfferRegular;
  PP_LIVE.describeRegular = describeRegular;

  function shouldOfferPlayoff() {
    var season = STATE.season || {};
    if (season._skipLiveSeries) return false;
    return true;
  }
  PP_LIVE.shouldOfferPlayoff = shouldOfferPlayoff;
  PP_LIVE.skipSeries = function () { if (STATE.season) STATE.season._skipLiveSeries = true; };
  PP_LIVE.skipRegularSeason = function () { if (STATE.season) STATE.season._skipLiveRegular = true; };

  /* ---------- UI ---------- */
  function starterRowsHtml(teamCode) {
    if (!teamCode || typeof calcTeamLineup !== 'function') return '';
    var lineup = calcTeamLineup(teamCode);
    var order = ['PG', 'SG', 'SF', 'PF', 'C'];
    var posShort = { PG: '控', SG: '分', SF: '小', PF: '大', C: '中' };
    var html = '';
    var i, pos, p, name, ovr, me;
    for (i = 0; i < order.length; i++) {
      pos = order[i];
      p = lineup.starters && lineup.starters[pos];
      if (!p) continue;
      name = p.cname || p.name || '球员';
      ovr = parseInt(p._lineupOvr != null ? p._lineupOvr : p.ovr, 10) || '—';
      me = !!p._isUser;
      html += '<div class="pp-live-lu-row">' +
        '<span class="pp-live-lu-pos">' + (posShort[pos] || pos) + '</span>' +
        '<span class="pp-live-lu-name' + (me ? ' is-me' : '') + '">' + esc(name) + (me ? ' ★' : '') + '</span>' +
        '<span class="pp-live-lu-ovr">' + ovr + '</span>' +
      '</div>';
    }
    return html;
  }

  function lineupsPreviewHtml(teamA, teamB) {
    if (!teamA || !teamB) return '';
    return '<div class="pp-live-lineups">' +
      '<div class="pp-live-lu">' +
        '<div class="pp-live-lu-h">' + teamLogoHtml(teamA, 20) + '<span>' + esc(teamName(teamA)) + ' 首发</span></div>' +
        starterRowsHtml(teamA) +
      '</div>' +
      '<div class="pp-live-lu">' +
        '<div class="pp-live-lu-h">' + teamLogoHtml(teamB, 20) + '<span>' + esc(teamName(teamB)) + ' 首发</span></div>' +
        starterRowsHtml(teamB) +
      '</div>' +
    '</div>';
  }

  function promptChoice(info, onSkip, onWatch) {
    injectStyle();
    var old = document.getElementById('pp-live-prompt');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.className = 'awards-overlay';
    overlay.id = 'pp-live-prompt';
    var extra = '';
    if (info.allowSeriesSkip) {
      extra = '<button class="btn btn-secondary pp-live-wide" id="pp-live-series">本系列都跳过</button>';
    } else if (info.allowSeasonSkip) {
      extra = '<button class="btn btn-secondary pp-live-wide" id="pp-live-season">跳过本赛季常规赛</button>';
    }
    var lineups = lineupsPreviewHtml(info.teamA, info.teamB);
    overlay.innerHTML =
      '<div class="pp-live-card">' +
        '<div class="pp-live-head">' +
          '<div class="pp-live-kicker">' + (info.kicker || '关键赛事') + '</div>' +
          '<div class="pp-live-title">' + (info.title || '观看本场？') + '</div>' +
          '<div class="pp-live-sub">' + (info.reason || '') + '</div>' +
        '</div>' +
        lineups +
        '<div class="pp-live-actions">' +
          '<button class="btn btn-primary" id="pp-live-watch">观看比赛</button>' +
          '<button class="btn btn-secondary" id="pp-live-skip">快速跳过</button>' +
          extra +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('pp-live-watch').onclick = function () { overlay.remove(); onWatch(); };
    document.getElementById('pp-live-skip').onclick = function () { overlay.remove(); onSkip(); };
    var sb = document.getElementById('pp-live-series');
    if (sb) sb.onclick = function () { PP_LIVE.skipSeries(); overlay.remove(); onSkip(); };
    var seasonBtn = document.getElementById('pp-live-season');
    if (seasonBtn) seasonBtn.onclick = function () {
      PP_LIVE.skipRegularSeason();
      overlay.remove();
      onSkip();
    };
  }
  PP_LIVE.promptChoice = promptChoice;

  function playRowHtml(p) {
    if (!p) return '';
    if (p.kind === 'meta') {
      return '<div class="pp-live-row is-meta">' + esc(p.text) + '</div>';
    }
    var cls = 'pp-live-row';
    if (p.teamSide === 'A') cls += ' is-us';
    if (p.tone && p.tone !== 'meta') cls += ' is-' + p.tone;
    var tag = p.tag ? '<span class="pp-live-tag">[' + esc(p.tag) + ']</span>' : '';
    return '<div class="' + cls + '">' +
      '<div class="pp-live-time">' + esc(p.clock) + '</div>' +
      '<div class="pp-live-who">' + teamLogoHtml(p.teamCode, 18) + '<span>' + esc(p.team) + '</span></div>' +
      '<div class="pp-live-body">' + tag + esc(p.text) + '</div>' +
      '<div class="pp-live-sc">' + esc(p.scoreA + '-' + p.scoreB) + '</div>' +
    '</div>';
  }

  function mountTheaterShell(bp) {
    var old = document.getElementById('pp-live-theater');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.className = 'awards-overlay';
    overlay.id = 'pp-live-theater';
    overlay.innerHTML =
      '<div class="pp-live-card">' +
        '<div class="pp-live-board">' +
          '<div class="pp-live-team" id="pp-live-name-a">' + teamBoardHtml(bp.teamA, bp.displayNameA) + '</div>' +
          '<div class="pp-live-score" id="pp-live-score">0-0</div>' +
          '<div class="pp-live-team" id="pp-live-name-b">' + teamBoardHtml(bp.teamB, bp.displayNameB) + '</div>' +
        '</div>' +
        '<div class="pp-live-clockline">' +
          '<span><b id="pp-live-periodclock">第一节 12:00</b></span>' +
          '<span>开赛 <b id="pp-live-elapsed">0:00</b></span>' +
        '</div>' +
        '<div class="pp-live-court-wrap" id="pp-live-court-wrap"></div>' +
        '<div class="pp-live-hero" id="pp-live-hero">' +
          '<img class="pp-live-hero-face is-off" id="pp-live-hero-face" alt="主角头像">' +
          '<div class="pp-live-hero-meta"><div class="pp-live-hero-name" id="pp-live-hero-name">我</div><div class="pp-live-hero-on" id="pp-live-hero-on">上场 0′</div></div>' +
          '<div class="pp-live-hero-nums" id="pp-live-hero-nums">' +
            '<div class="pp-live-hero-stat" data-k="pts"><b>0</b><small>分</small></div>' +
            '<div class="pp-live-hero-stat" data-k="reb"><b>0</b><small>板</small></div>' +
            '<div class="pp-live-hero-stat" data-k="ast"><b>0</b><small>助</small></div>' +
            '<div class="pp-live-hero-stat" data-k="stl"><b>0</b><small>断</small></div>' +
            '<div class="pp-live-hero-stat" data-k="blk"><b>0</b><small>帽</small></div>' +
            '<div class="pp-live-hero-stat" data-k="fg"><b>0-0</b><small>投</small></div>' +
          '</div>' +
        '</div>' +
        '<div id="pp-live-qrows"></div>' +
        '<div class="pp-live-feed" id="pp-live-feed"></div>' +
        '<div class="pp-live-actions" id="pp-live-actions">' +
          '<button class="btn btn-secondary" id="pp-live-pause">暂停</button>' +
          '<button class="btn btn-secondary" id="pp-live-fast">加快</button>' +
          '<button class="btn btn-primary" id="pp-live-end">看完本场</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderQRows(sess) {
    var el = document.getElementById('pp-live-qrows');
    if (!el) return;
    var game = sess.game;
    var html = '';
    var n = sess.isOT ? 4 : sess.q;
    var i;
    for (i = 0; i < n; i++) {
      html += '<div class="pp-live-qrow"><span>' + periodLabel(i + 1, false) + '</span><span>' +
        game.qA[i] + '-' + game.qB[i] + '</span></div>';
    }
    if (game.ot) {
      html += '<div class="pp-live-qrow"><span>' + periodLabel(4, true, game.ot) + '</span><span>' +
        game.otA + '-' + game.otB + '</span></div>';
    }
    el.innerHTML = html;
  }

  function liveUserSnapshot(sess) {
    var game = sess && sess.game;
    var bp = game && game.bp;
    if (!bp) return null;
    var user = bp.rosterA.filter(function (p) { return p && p._isUser; })[0];
    if (!user) return null;
    var on = sess.lastUserOn;
    if (on == null) {
      var margin = game.scoreA - game.scoreB;
      var stint = stintOf(sess.q, sess.clock, margin, sess.isOT, {
        allStar: bp._allStarExhibition,
        quarterSec: bp._quarterSec
      });
      on = userWantedOn(game, stint, sess.q, sess.clock, margin, sess.isOT);
    }
    return { player: user, ln: lineOf(game, user), on: !!on };
  }

  function bumpHeroStat(el, value) {
    var b = el && el.querySelector('b');
    if (!b) return;
    var next = String(value);
    var prev = el.getAttribute('data-v');
    b.textContent = next;
    el.setAttribute('data-v', next);
    if (prev == null || prev === next) return;
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
  }

  function renderHeroLine(sess, pack) {
    var wrap = document.getElementById('pp-live-hero');
    if (!wrap) return;
    var snap = liveUserSnapshot(sess);
    if (!snap) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    var ln = snap.ln;
    var stats = pack && pack.stats ? pack.stats : {
      pts: Math.round(ln.pts), reb: Math.round(ln.reb), ast: Math.round(ln.ast),
      stl: Math.round(ln.stl), blk: Math.round(ln.blk),
      fgm: Math.round(ln.fgm), fga: Math.round(ln.fga),
      mins: Math.max(0, Math.round(ln.mins || 0))
    };
    var nameEl = document.getElementById('pp-live-hero-name');
    var onEl = document.getElementById('pp-live-hero-on');
    var face = document.getElementById('pp-live-hero-face');
    var name = (typeof getHupuDisplayName === 'function' ? getHupuDisplayName() : '') || nm(snap.player);
    if (nameEl) nameEl.textContent = name;
    if (onEl) {
      onEl.textContent = (sess.done ? '本场 ' : (snap.on ? '在场 ' : '休息 ')) + (stats.mins || 0) + '′';
      onEl.classList.toggle('is-on', !sess.done && !!snap.on);
    }
    if (face) {
      var url = typeof getHupuAvatarUrl === 'function' ? getHupuAvatarUrl() : '';
      if (url) { face.src = url; face.classList.remove('is-off'); }
      else face.classList.add('is-off');
    }
    var nums = document.getElementById('pp-live-hero-nums');
    if (!nums) return;
    var map = {
      pts: stats.pts || 0,
      reb: stats.reb || 0,
      ast: stats.ast || 0,
      stl: stats.stl || 0,
      blk: stats.blk || 0,
      fg: (stats.fgm || 0) + '-' + (stats.fga || 0)
    };
    [].forEach.call(nums.querySelectorAll('.pp-live-hero-stat'), function (el) {
      bumpHeroStat(el, map[el.getAttribute('data-k')]);
    });
  }

  function renderBoard(sess, pack) {
    var game = sess.game;
    var scoreEl = document.getElementById('pp-live-score');
    var clockEl = document.getElementById('pp-live-periodclock');
    var elapsedEl = document.getElementById('pp-live-elapsed');
    if (!scoreEl) return;
    var sa = pack && pack.result ? pack.result.scoreA : Math.round(game.scoreA);
    var sb = pack && pack.result ? pack.result.scoreB : Math.round(game.scoreB);
    scoreEl.textContent = sa + '-' + sb;
    var qSec = game.bp._quarterSec || 720;
    if (sess.done) {
      clockEl.textContent = '终场';
      elapsedEl.textContent = fmtElapsed(elapsedSec(4, 0, !!game.ot, game.ot || 1, qSec));
    } else {
      clockEl.textContent = periodLabel(sess.q, sess.isOT, game.ot) + ' ' + fmtClock(sess.clock);
      elapsedEl.textContent = fmtElapsed(elapsedSec(sess.q, sess.clock, sess.isOT, game.ot, qSec));
    }
    renderQRows(sess);
    renderHeroLine(sess, pack);
  }

  function insertPlayRows(plays) {
    var feedEl = document.getElementById('pp-live-feed');
    if (!feedEl || !plays || !plays.length) return;
    var html = '';
    for (var i = 0; i < plays.length; i++) html += playRowHtml(plays[i]);
    feedEl.insertAdjacentHTML('beforeend', html);
    feedEl.scrollTop = feedEl.scrollHeight;
  }

  function pickCourtClip(plays) {
    if (!plays || !plays.length) return null;
    var clip = null, i, pl;
    for (i = 0; i < plays.length; i++) {
      pl = plays[i];
      if (pl && pl.clip && (pl.kind === 'make' || pl.kind === 'andone' || pl.tone === 'make')) clip = pl.clip;
    }
    if (!clip) {
      for (i = 0; i < plays.length; i++) if (plays[i] && plays[i].clip) clip = plays[i].clip;
    }
    return clip;
  }

  function playMergedMissReb(missP, rebP, dur, next) {
    var clip = missP.clip;
    var missU = clip.missSplitU || 0.72;
    var missDone = false;
    var finished = false;
    function complete() {
      if (finished) return;
      finished = true;
      clearTimeout(missTimer);
      clearTimeout(watchdog);
      if (!missDone) {
        missDone = true;
        insertPlayRows([missP]);
      }
      insertPlayRows([rebP]);
      if (next) next();
    }
    var missTimer = setTimeout(function () {
      if (!missDone) {
        missDone = true;
        insertPlayRows([missP]);
      }
    }, Math.round(dur * missU));
    var watchdog = setTimeout(complete, dur + 900);
    PP_COURT.play(clip, dur, complete);
  }

  function appendPlays(plays, opt) {
    opt = opt || {};
    if (!plays || !plays.length) {
      if (opt.onDone) opt.onDone();
      return;
    }
    var baseDur = opt.duration || 1400;
    var courtOn = opt.court && window.PP_COURT && typeof PP_COURT.play === 'function';
    var deferText = !!opt.deferText;
    var seqDone = false;

    function finishSeq() {
      if (seqDone) return;
      seqDone = true;
      if (opt.onDone) opt.onDone();
    }

    function clipDuration(clip) {
      var d = baseDur;
      if (clip.reboundMerged) d = Math.round(d * 1.16);
      if (clip.reboundMode === 'tipout') d = Math.round(d * 1.08);
      if (clip.jumpBall) d = Math.round(d * 1.22);
      return d;
    }

    function playSeq(idx) {
      if (idx >= plays.length) {
        finishSeq();
        return;
      }
      var p = plays[idx];
      if ((p.kind === 'miss' || p.kind === 'blk') && courtOn) {
        var rebI = -1, j;
        for (j = idx + 1; j < plays.length; j++) {
          if (plays[j].kind === 'orb' || plays[j].kind === 'drb') { rebI = j; break; }
        }
        if (rebI >= 0 && p.clip && p.clip.reboundMerged) {
          if (deferText) {
            playMergedMissReb(p, plays[rebI], clipDuration(p.clip), function () { playSeq(rebI + 1); });
            return;
          }
          insertPlayRows([p, plays[rebI]]);
          PP_COURT.play(p.clip, clipDuration(p.clip), function () { playSeq(rebI + 1); });
          return;
        }
      }
      var clip = courtOn && p && p.clip ? p.clip : null;
      if (deferText && clip) {
        PP_COURT.play(clip, clipDuration(clip), function () {
          insertPlayRows([p]);
          playSeq(idx + 1);
        });
        return;
      }
      insertPlayRows([p]);
      if (clip) {
        var clipDur = clipDuration(clip);
        var clipWatchdog = setTimeout(function () { playSeq(idx + 1); }, clipDur + 900);
        PP_COURT.play(clip, clipDur, function () {
          clearTimeout(clipWatchdog);
          playSeq(idx + 1);
        });
        return;
      }
      playSeq(idx + 1);
    }
    playSeq(0);
  }

  function showFinalCard(pack) {
    var feedEl = document.getElementById('pp-live-feed');
    if (!feedEl || !pack || !pack.result) return;
    if (document.getElementById('pp-live-final')) return;
    var stats = pack.stats || {};
    var html = '<div class="pp-live-final ' + (pack.result.won ? 'result-win' : 'result-loss') + '" id="pp-live-final">' +
      (pack.result.won ? '胜利' : '失利') + '　' + pack.result.scoreA + '-' + pack.result.scoreB +
      '<div style="font-size:12px;margin-top:4px;">我　' + stats.pts + '分 ' + stats.reb + '板 ' + stats.ast + '助　' +
      stats.fgm + '-' + stats.fga + '</div></div>';
    feedEl.insertAdjacentHTML('beforeend', html);
    feedEl.scrollTop = feedEl.scrollHeight;
  }

  function playTheaterWatch(spec, done) {
    injectStyle();
    spec = spec || {};
    var options = {};
    var src = spec.options || {};
    Object.keys(src).forEach(function (k) { options[k] = src[k]; });
    options.watch = true;
    var sess = createLiveSession(spec.teamA, spec.teamB, options);
    var overlay = mountTheaterShell(sess.bp);
    if (window.PP_COURT && typeof PP_COURT.mount === 'function') PP_COURT.mount('pp-live-court-wrap');
    var paused = false;
    var fast = false;
    var timer = null;
    var closed = false;

    appendPlays(sess.game.plays, {
      court: !sess.fastForward,
      deferText: !sess.fastForward,
      duration: 1400 * (sess.broadcastScale || 1),
      onDone: function () { pump(); }
    });
    renderBoard(sess, null);

    function readGap() {
      if (sess.fastForward) return 0;
      var scale = sess.broadcastScale || 1;
      return fast ? Math.round(160 * scale) : Math.round(360 * scale);
    }
    function stopTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }
    function finishUI() {
      stopTimer();
      renderBoard(sess, sess.pack);
      showFinalCard(sess.pack);
      var actions = document.getElementById('pp-live-actions');
      if (actions) {
        actions.innerHTML = '<button class="btn btn-primary" id="pp-live-continue">继续赛程</button>';
        var btn = document.getElementById('pp-live-continue');
        if (btn) btn.onclick = close;
      }
    }
    function close() {
      if (closed) return;
      closed = true;
      stopTimer();
      overlay.remove();
      if (done) done(sess.pack);
    }
    function scheduleNext() {
      stopTimer();
      if (closed || paused || sess.done) return;
      var gap = readGap();
      if (gap === 0) {
        pump();
        return;
      }
      timer = setTimeout(pump, gap);
    }
    function scheduleGap() {
      stopTimer();
      if (closed || paused || sess.done) return;
      if (readGap() === 0) {
        var n = 0;
        while (!sess.done && n < 12) {
          handleTick(tickSession(sess));
          n++;
        }
        if (!sess.done) timer = setTimeout(scheduleGap, 0);
        return;
      }
      scheduleNext();
    }
    function handleTick(out) {
      var scale = sess.broadcastScale || 1;
      var courtOn = !fast && !sess.fastForward;
      appendPlays(out.plays, {
        court: courtOn,
        deferText: courtOn,
        duration: 1400 * scale,
        onDone: function () {
          renderBoard(sess, sess.done ? sess.pack : null);
          if (sess.done) finishUI();
          else if (courtOn) pump();
          else scheduleNext();
        }
      });
    }
    function pump() {
      if (closed || paused || sess.done) return;
      handleTick(tickSession(sess));
    }
    function schedule() {
      scheduleGap();
    }
    function skipToEnd() {
      sess.fastForward = true;
      paused = false;
      if (window.PP_COURT && typeof PP_COURT.setEnabled === 'function') PP_COURT.setEnabled(false);
      stopTimer();
      var guard = 0;
      while (!sess.done && guard < 4000) {
        var out = tickSession(sess);
        appendPlays(out.plays);
        guard++;
      }
      if (!sess.done) finishGame(sess);
      finishUI();
    }

    document.getElementById('pp-live-pause').onclick = function () {
      if (sess.done) return;
      paused = !paused;
      this.textContent = paused ? '继续' : '暂停';
      if (!paused) schedule();
      else stopTimer();
    };
    document.getElementById('pp-live-fast').onclick = function () {
      fast = !fast;
      this.textContent = fast ? '恢复' : '加快';
      if (window.PP_COURT && typeof PP_COURT.setEnabled === 'function') PP_COURT.setEnabled(!fast);
      if (!paused && !sess.done) schedule();
    };
    document.getElementById('pp-live-end').onclick = skipToEnd;
  }
  PP_LIVE.playTheaterWatch = playTheaterWatch;

  function playTheater(pack, done) {
    if (!pack || !pack.live) { if (done) done(pack); return; }
    injectStyle();
    var live = pack.live;
    var plays = live.plays || [];
    var overlay = mountTheaterShell(live.bp);
    if (window.PP_COURT && typeof PP_COURT.mount === 'function') PP_COURT.mount('pp-live-court-wrap');
    var idx = 0;
    var paused = false;
    var fast = false;
    var timer = null;
    var fakeSess = {
      game: live, q: 1, qIdx: 0, clock: 720, isOT: false, done: false
    };
    function currentClockFromPlay(p) {
      if (!p) return;
      fakeSess.q = p.q || fakeSess.q;
      fakeSess.isOT = !!p.isOT;
      fakeSess.clock = p.secLeft != null ? p.secLeft : fakeSess.clock;
      live.scoreA = p.scoreA;
      live.scoreB = p.scoreB;
    }
    function pump() {
      if (paused) return;
      if (idx >= plays.length) {
        fakeSess.done = true;
        renderBoard(fakeSess, pack);
        showFinalCard(pack);
        var actions = document.getElementById('pp-live-actions');
        if (actions) {
          actions.innerHTML = '<button class="btn btn-primary" id="pp-live-continue">继续赛程</button>';
          var btn = document.getElementById('pp-live-continue');
          if (btn) btn.onclick = function () { overlay.remove(); if (done) done(pack); };
        }
        return;
      }
      var p = plays[idx++];
      currentClockFromPlay(p);
      var courtOn = !fast;
      appendPlays([p], {
        court: courtOn,
        deferText: courtOn,
        duration: 1400,
        onDone: function () {
          renderBoard(fakeSess, null);
          timer = setTimeout(pump, fast ? 160 : 360);
        }
      });
    }
    document.getElementById('pp-live-pause').onclick = function () {
      paused = !paused;
      this.textContent = paused ? '继续' : '暂停';
      if (!paused) pump();
      else if (timer) clearTimeout(timer);
    };
    document.getElementById('pp-live-fast').onclick = function () {
      fast = !fast;
      this.textContent = fast ? '恢复' : '加快';
      if (window.PP_COURT && typeof PP_COURT.setEnabled === 'function') PP_COURT.setEnabled(!fast);
    };
    document.getElementById('pp-live-end').onclick = function () {
      if (timer) clearTimeout(timer);
      if (idx < plays.length) appendPlays(plays.slice(idx));
      idx = plays.length;
      var last = plays[plays.length - 1];
      currentClockFromPlay(last);
      fakeSess.done = true;
      renderBoard(fakeSess, pack);
      showFinalCard(pack);
      var actions = document.getElementById('pp-live-actions');
      if (actions) {
        actions.innerHTML = '<button class="btn btn-primary" id="pp-live-continue">继续赛程</button>';
        var btn = document.getElementById('pp-live-continue');
        if (btn) btn.onclick = function () { overlay.remove(); if (done) done(pack); };
      }
    };
    renderBoard(fakeSess, null);
    pump();
  }
  PP_LIVE.playTheater = playTheater;

  var CALIBRATION_CASES = [
    { teamA: 'LAL', teamB: 'BOS', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'LAL', teamB: 'BOS', teamAHome: false, neutralState: true, fatigueA: 0 },
    { teamA: 'CLE', teamB: 'OKC', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'CLE', teamB: 'OKC', teamAHome: false, neutralState: true, fatigueA: 0 },
    { teamA: 'DEN', teamB: 'MIN', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'DEN', teamB: 'MIN', teamAHome: false, neutralState: true, fatigueA: 0 },
    { teamA: 'GSW', teamB: 'PHX', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'GSW', teamB: 'PHX', teamAHome: false, neutralState: true, fatigueA: 0 },
    { teamA: 'NYK', teamB: 'MIL', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'NYK', teamB: 'MIL', teamAHome: false, neutralState: true, fatigueA: 0 },
    { teamA: 'PHI', teamB: 'MIA', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'PHI', teamB: 'MIA', teamAHome: false, neutralState: true, fatigueA: 0 },
    { teamA: 'DAL', teamB: 'SAC', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'DAL', teamB: 'SAC', teamAHome: false, neutralState: true, fatigueA: 0 },
    { teamA: 'LAL', teamB: 'BOS', teamAHome: true, neutralState: true, fatigueA: 1 },
    { teamA: 'CLE', teamB: 'OKC', teamAHome: true, neutralState: false, fatigueA: 0 },
    { teamA: 'BOS', teamB: 'LAL', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'OKC', teamB: 'CLE', teamAHome: false, neutralState: true, fatigueA: 0 },
    { teamA: 'MIN', teamB: 'DEN', teamAHome: true, neutralState: true, fatigueA: 0 },
    { teamA: 'PHX', teamB: 'GSW', teamAHome: false, neutralState: true, fatigueA: 0 }
  ];

  function benchAvg(obj, n) {
    return {
      avgA: obj.a / n, avgB: obj.b / n,
      userPts: obj.u / n, userReb: obj.r / n, userAst: obj.t / n,
      win: obj.w / n
    };
  }

  PP_LIVE.calibrateBenchmark = function (opts) {
    opts = opts || {};
    var gamesPerCase = Math.max(8, Math.min(80, parseInt(opts.gamesPerCase, 10) || 24));
    var cases = opts.cases || CALIBRATION_CASES;
    var attrs = opts.attrs || (typeof STATE !== 'undefined' && STATE.attrs) || {};
    var pos = opts.position || (typeof STATE !== 'undefined' && STATE.position) || 'SG';
    var oldTeam = typeof STATE !== 'undefined' ? STATE.careerTeam : null;
    var oldPos = typeof STATE !== 'undefined' ? STATE.position : null;
    var oldAttrs = typeof STATE !== 'undefined' ? STATE.attrs : null;
    var rows = [];
    var totSkip = { a: 0, b: 0, u: 0, r: 0, t: 0, w: 0, n: 0 };
    var totLive = { a: 0, b: 0, u: 0, r: 0, t: 0, w: 0, n: 0 };
    var ci, gi, c, r, st, p, skip, live, sAvg, lAvg;
    for (ci = 0; ci < cases.length; ci++) {
      c = cases[ci];
      if (typeof STATE !== 'undefined') {
        STATE.careerTeam = c.teamA;
        STATE.position = pos;
        STATE.attrs = attrs;
        if (!STATE.finalOVR) {
          STATE.finalOVR = typeof calcOVR === 'function' ? calcOVR(attrs, pos) : 88;
        }
        STATE._lineupCache = {};
      }
      skip = { a: 0, b: 0, u: 0, r: 0, t: 0, w: 0 };
      live = { a: 0, b: 0, u: 0, r: 0, t: 0, w: 0 };
      for (gi = 0; gi < gamesPerCase; gi++) {
        r = simulate82StyleMatchup(c.teamA, c.teamB, {
          teamAHome: c.teamAHome, neutralState: c.neutralState, fatigueA: c.fatigueA || 0,
          includeBoxScore: false
        });
        st = generatePlayerStatsNew(attrs, r, false);
        skip.a += r.scoreA; skip.b += r.scoreB; skip.u += st.pts; skip.r += st.reb; skip.t += st.ast;
        if (r.won) skip.w++;
        p = run(c.teamA, c.teamB, {
          teamAHome: c.teamAHome, neutralState: c.neutralState, fatigueA: c.fatigueA || 0,
          attrs: attrs
        });
        live.a += p.result.scoreA; live.b += p.result.scoreB;
        live.u += p.stats.pts; live.r += p.stats.reb; live.t += p.stats.ast;
        if (p.result.won) live.w++;
      }
      sAvg = benchAvg(skip, gamesPerCase);
      lAvg = benchAvg(live, gamesPerCase);
      rows.push({
        case: c,
        games: gamesPerCase,
        skip: sAvg,
        live: lAvg,
        delta: {
          avgA: lAvg.avgA - sAvg.avgA, avgB: lAvg.avgB - sAvg.avgB,
          userPts: lAvg.userPts - sAvg.userPts, userReb: lAvg.userReb - sAvg.userReb,
          userAst: lAvg.userAst - sAvg.userAst, win: lAvg.win - sAvg.win
        }
      });
      totSkip.a += skip.a; totSkip.b += skip.b; totSkip.u += skip.u; totSkip.r += skip.r; totSkip.t += skip.t;
      totSkip.w += skip.w; totSkip.n += gamesPerCase;
      totLive.a += live.a; totLive.b += live.b; totLive.u += live.u; totLive.r += live.r; totLive.t += live.t;
      totLive.w += live.w; totLive.n += gamesPerCase;
    }
    if (typeof STATE !== 'undefined') {
      if (oldTeam) STATE.careerTeam = oldTeam;
      if (oldPos) STATE.position = oldPos;
      if (oldAttrs) STATE.attrs = oldAttrs;
    }
    var skipAll = benchAvg(totSkip, totSkip.n);
    var liveAll = benchAvg(totLive, totLive.n);
    return {
      cases: rows.length,
      gamesPerCase: gamesPerCase,
      totalGames: totSkip.n,
      skip: skipAll,
      live: liveAll,
      delta: {
        avgA: liveAll.avgA - skipAll.avgA, avgB: liveAll.avgB - skipAll.avgB,
        userPts: liveAll.userPts - skipAll.userPts, userReb: liveAll.userReb - skipAll.userReb,
        userAst: liveAll.userAst - skipAll.userAst, win: liveAll.win - skipAll.win
      },
      rows: rows
    };
  };

  PP_LIVE.compareEngines = function (games) {
    games = Math.max(40, Math.min(400, parseInt(games, 10) || 80));
    var teamA = STATE.careerTeam;
    var teamB = (STATE.season && STATE.season.schedule && STATE.season.schedule[0] && STATE.season.schedule[0].opponent) || 'BOS';
    var skip = { a: 0, b: 0, u: 0, r: 0, t: 0, w: 0 };
    var live = { a: 0, b: 0, u: 0, r: 0, t: 0, w: 0 };
    for (var i = 0; i < games; i++) {
      var r = simulate82StyleMatchup(teamA, teamB, { teamAHome: i % 2 === 0, includeBoxScore: false, neutralState: true });
      var st = generatePlayerStatsNew(STATE.attrs, r, false);
      skip.a += r.scoreA; skip.b += r.scoreB; skip.u += st.pts; skip.r += st.reb; skip.t += st.ast; if (r.won) skip.w++;
      var p = run(teamA, teamB, { teamAHome: i % 2 === 0, neutralState: true, fatigueA: 0 });
      live.a += p.result.scoreA; live.b += p.result.scoreB; live.u += p.stats.pts; live.r += p.stats.reb; live.t += p.stats.ast; if (p.result.won) live.w++;
    }
    function avg(obj) {
      return {
        avgA: obj.a / games, avgB: obj.b / games,
        userPts: obj.u / games, userReb: obj.r / games, userAst: obj.t / games,
        win: obj.w / games
      };
    }
    var s = avg(skip), l = avg(live);
    return {
      games: games, skip: s, live: l,
      delta: {
        avgA: l.avgA - s.avgA, avgB: l.avgB - s.avgB,
        userPts: l.userPts - s.userPts, userReb: l.userReb - s.userReb, userAst: l.userAst - s.userAst,
        win: l.win - s.win
      }
    };
  };

  PP_LIVE.benchPbp = function (games) {
    games = Math.max(8, Math.min(80, parseInt(games, 10) || 24));
    PP_LIVE._collectPbp = true;
    var teamA = (typeof STATE !== 'undefined' && STATE.careerTeam) || 'LAL';
    var teamB = 'BOS';
    var contest = {};
    var actions = {};
    var errs = {};
    var samples = [];
    var lens = 0;
    var nPbp = 0;
    var scores = { a: 0, b: 0 };
    var flavor = { face: 0, poster: 0, open: 0, help: 0, lob: 0, coast: 0, euro: 0 };
    var tactics = {};
    var clips = 0;
    var i, j, pack, plays, p, e, tx;
    for (i = 0; i < games; i++) {
      pack = run(teamA, teamB, { teamAHome: i % 2 === 0, neutralState: true, fatigueA: 0 });
      scores.a += pack.result.scoreA;
      scores.b += pack.result.scoreB;
      plays = (pack.live && pack.live.plays) || [];
      for (j = 0; j < plays.length; j++) {
        p = plays[j];
        if (!p || p.type === 'meta' || p.kind === 'flavor' || p.kind === 'orb' || p.kind === 'drb') continue;
        if (!p._pbp) continue;
        nPbp++;
        tx = String(p.text || '');
        lens += tx.length;
        contest[p._pbp.contest || p.kind] = (contest[p._pbp.contest || p.kind] || 0) + 1;
        actions[p._pbp.action || p.kind] = (actions[p._pbp.action || p.kind] || 0) + 1;
        if (/颜射/.test(tx)) flavor.face++;
        if (/隔扣/.test(tx)) flavor.poster++;
        if (/无人防守/.test(tx)) flavor.open++;
        if (/协防/.test(tx)) flavor.help++;
        if (/空接/.test(tx)) flavor.lob++;
        if (/一条龙/.test(tx)) flavor.coast++;
        if (/欧洲步/.test(tx)) flavor.euro++;
        if (p.clip && p.clip.tactic) {
          clips++;
          tactics[p.clip.tactic] = (tactics[p.clip.tactic] || 0) + 1;
        }
        if (p._pbpErrs && p._pbpErrs.length) {
          for (e = 0; e < p._pbpErrs.length; e++) errs[p._pbpErrs[e]] = (errs[p._pbpErrs[e]] || 0) + 1;
        }
        if (samples.length < 24 && /颜射|无人|协防|隔扣|空接|一条龙|欧洲步|后仰|勾手|跑出空档/.test(tx)) {
          samples.push(tx);
        }
      }
    }
    PP_LIVE._collectPbp = false;
    return {
      games: games,
      avgA: scores.a / games,
      avgB: scores.b / games,
      nPbp: nPbp,
      avgLen: nPbp ? lens / nPbp : 0,
      contest: contest,
      actions: actions,
      flavor: flavor,
      clips: clips,
      tactics: tactics,
      errs: errs,
      samples: samples
    };
  };
})();
