/* ============================================================
 * Perfect Player — 单局回合模拟
 * 夜场总分先按跳过引擎同一套 pace × 效率 + 方差抽蓝图，
 * 再按 NBA 球权把出手/罚球/篮板拆开。观看与跳过不必同种子，
 * 分布对齐（队分、胜率、你的场均）。
 * ============================================================ */
(function () {
  'use strict';

  var PP_LIVE = window.PP_LIVE = window.PP_LIVE || {};
  var REGULAR_OFFER_CAP = 9;
  var DERBY = {
    LAL: 'LAC', LAC: 'LAL', NYK: 'BKN', BKN: 'NYK', GSW: 'SAC', SAC: 'GSW',
    BOS: 'PHI', PHI: 'BOS', MIA: 'ORL', ORL: 'MIA', CHI: 'MIL', MIL: 'CHI',
    DAL: 'HOU', HOU: 'DAL', DEN: 'UTA', UTA: 'DEN', SAS: 'MEM', MEM: 'SAS',
    PHX: 'LAC', OKC: 'MIN', MIN: 'OKC', POR: 'GSW', ATL: 'CHA', CHA: 'ATL',
    CLE: 'DET', DET: 'CLE', IND: 'MIL', TOR: 'BOS', WAS: 'PHI', NOP: 'HOU'
  };

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
  function teamBoardHtml(code) {
    return teamLogoHtml(code, 36) + '<span>' + esc(teamName(code)) + '</span>';
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
  function elapsedSec(q, secLeft, isOT, ot) {
    var left = Math.max(0, Number(secLeft) || 0);
    if (!isOT) return (Math.max(1, q) - 1) * 720 + (720 - left);
    return 48 * 60 + Math.max(0, (ot || 1) - 1) * 300 + (300 - left);
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
      '.pp-live-feed{padding:0;display:flex;flex-direction:column;gap:0;min-height:220px;max-height:46vh;overflow:auto;flex:1}' +
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
      '.pp-live-final{margin:8px 12px 12px;padding:10px;border-radius:10px;text-align:center;font-family:var(--font-display)}';
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
    var expectedFga = teamFGA * (mins / 48) * usage * aggression * (1 - defensePressure * 1.5) * 0.90;
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
    var powerA = typeof calcTeamPowerWithPlayer === 'function' ? calcTeamPowerWithPlayer(teamA) : { offense: 70, defense: 70, athletic: 70, clutch: 70, depth: 70 };
    var powerB = typeof calcTeamPowerWithPlayer === 'function' ? calcTeamPowerWithPlayer(teamB) : { offense: 70, defense: 70, athletic: 70, clutch: 70, depth: 70 };
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
    var lineupA = typeof calcTeamLineup === 'function' ? calcTeamLineup(teamA) : { starters: {}, bench: [], isUserStarter: false };
    var lineupB = typeof calcTeamLineup === 'function' ? calcTeamLineup(teamB) : { starters: {}, bench: [], isUserStarter: false };
    var userMins = 28;
    if (teamA === STATE.careerTeam && typeof getPlayerRotationMinutes === 'function') {
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
      rosterA: roster10(lineupA), rosterB: roster10(lineupB),
      userStarter: !!(lineupA.isUserStarter && !(STATE.career && STATE.career.flags && STATE.career.flags.startBench)),
      userMins: userMins, defPressure: defPressure,
      varianceA: clamp(6.4 + (modA.variance || 0), 4.6, 10),
      varianceB: clamp(6.4 + (modB.variance || 0), 4.6, 10),
      styles: rollStyles()
    };
    bp.user = expectedUserLine(options.attrs || STATE.attrs || {}, bp, bp.isPlayoff);
    bp.userMins = bp.user.mins;
    bp.tgtA = clamp(Math.round(bp.pace * bp.efficiencyA + gauss(0, bp.varianceA)), 80, 155);
    bp.tgtB = clamp(Math.round(bp.pace * bp.efficiencyB + gauss(0, bp.varianceB)), 80, 155);
    return bp;
  }

  function roster10(lineup) {
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
    if (user && !roster.slice(0, 10).some(function (p) { return p && p._isUser; })) {
      if (roster.length >= 10) roster[9] = user;
      else roster.push(user);
    }
    return roster.slice(0, 10);
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
      formB: gauss(0, 0.016)
    };
  }

  function stintOf(q, secLeft, margin, isOT) {
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
    if (isOT) return secLeft / 60;
    var left = secLeft / 60 + Math.max(0, 4 - q) * 12;
    if (game.scoreA === game.scoreB && q === 4 && secLeft < 20) left += 5;
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

  function pickShooter(court, userOnCourt, usage, clutch) {
    var user = court.filter(function (p) { return p && p._isUser; })[0];
    if (userOnCourt && user && usage > 0 && chance(clamp(usage, 0.06, 0.39))) return user;
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
    E('b26', 'Ghost虚挡', 'tactics', 8, { need: 'shooter' }, '{actor}假挡真弹到三分线。', { off: 0.09, shot: 'three' }),
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
    E('d15', '转换Trailer三分', 'shot', 9, { tags: 'transition', need: 'shooter' }, '前面把人吸进去，拖车{actor}在后面拔。', { off: 0.10, shot: 'three' }),
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
    var target = game.bp.isPlayoff ? 11 : 8;
    if (game.eventCount >= target + 2) return null;
    var baseP = game.bp.isPlayoff ? 0.12 : 0.095;
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
    return Math.max(1.15, bp.pace * (minsLeft / 48));
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
      var transP = 0.08;
      if (ctx.userOn && game.styles) {
        transP += (st(game.styles, 'fast_break') - 1) * 0.35;
        transP -= (st(game.styles, 'post_bully') - 1) * 0.25;
      }
      transP = clamp(transP, 0.04, 0.22);
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
      return [{ kind: 'orb', tag: '前场板', tone: 'make', teamSide: ctx.side, text: nm(reb.player) + ' 抢到进攻篮板，球权还在' }];
    }
    return [{ kind: 'drb', tag: '后场板', tone: 'stop', teamSide: ctx.defSide, text: nm(reb.player) + ' 保护后场篮板' }];
  }

  function userHunger(game, ctx) {
    var bp = game.bp;
    var user = bp.rosterA.filter(function (p) { return p && p._isUser; })[0];
    if (!user || !ctx.userOn) return 0;
    var ln = lineOf(game, user);
    var frac = clamp(ln.mins / Math.max(4, bp.userMins), 0, 1.35);
    var gap = bp.user.fga * frac - ln.fga;
    return clamp(bp.user.usage * 0.98 * (1 + gap * 0.05), 0.06, 0.39);
  }

  function resolvePossession(game, ctx, ev) {
    var bp = game.bp;
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
    var orbRate = clamp(0.265 + offEdge * 0.003 + (fx.orb || 0), 0.16, 0.38);
    var clock = possessionClock(ctx, ev, game);
    var form = (side === 'A' ? game.formA : game.formB) + gauss(0, 0.008);
    var rush = ctx.secLeft <= 6 ? -0.10 : 0;

    if (fx.tech) {
      addScore(game, ctx.defSide, 1, ctx.qIdx, ctx.isOT);
      rows.push({ kind: 'tech', tag: '罚球', tone: 'make', teamSide: ctx.defSide, text: '技术犯规罚球命中' });
      return { clock: Math.min(clock, 8), orb: false, rows: rows };
    }

    if (fx.hack) {
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

    if (fx.forceTov || fx.stl || chance(tovRate)) {
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
        rows.push({
          kind: 'stl', tag: '防守成功', tone: 'stop', teamSide: ctx.defSide,
          text: nm(stealer) + ' 抢断 ' + nm(loser)
        });
      } else {
        rows.push({
          kind: 'tov', tag: '进攻失败', tone: 'miss', teamSide: side,
          text: nm(loser) + ' 失误'
        });
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

    var hint = fx.shot === 'three' ? 'threePT' : fx.shot;
    var shot = hint || pickShotType(shooter, null, game.styles);
    if (shot === 'three') shot = 'threePT';
    var verb = shotVerb(shot, fx);

    var rim = (ev && ev._bind && ev._bind.actor && ctx.defCourt.indexOf(ev._bind.actor) >= 0)
      ? ev._bind.actor
      : (roleOn(ctx.defCourt, 'rim') || ctx.defCourt[0]);
    var userDef = ctx.defCourt.filter(function (p) { return p && p._isUser; })[0];
    var blkP = 0.055 + skill01(attr(rim, 'BLK')) * 0.09;
    blkP = shot === 'FIN' ? blkP + 0.04 : blkP * 0.35;
    if (userDef && (st(game.styles, 'rim_protector') > 1.01 || st(game.styles, 'dunk_threat') > 1.01)) {
      blkP *= 1 + (st(game.styles, 'rim_protector') - 1) * 0.35 + (st(game.styles, 'dunk_threat') - 1) * 0.12;
    }
    if (fx.blk || chance(blkP)) {
      if (fx.blk || chance(0.62)) {
        var blocker = rim;
        if (userDef && (st(game.styles, 'rim_protector') > 1.01 || st(game.styles, 'dunk_threat') > 1.01)) {
          var userBlkW = 0.16 * st(game.styles, 'rim_protector') * (1 + (st(game.styles, 'dunk_threat') - 1) * 0.25);
          if (posOf(userDef) === 'C' || posOf(userDef) === 'PF') userBlkW += 0.18;
          if (chance(clamp(userBlkW, 0.06, 0.72))) blocker = userDef;
        }
        lineOf(game, blocker).blk++;
        lineOf(game, shooter).fga++;
        if (shot === 'threePT') lineOf(game, shooter).threeA++;
        rows.push({
          kind: 'blk', tag: '防守成功', tone: 'stop', teamSide: ctx.defSide,
          text: nm(blocker) + ' 盖帽 ' + nm(shooter) + ' 的' + verb
        });
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
    pct += (e - 1.154) * (e >= 1.154 ? 0.62 : 0.56);
    if (ctx.home) pct += 0.005;
    pct += rush;
    if (hasTag(game, 'transition') && shot === 'FIN') pct += 0.06;
    pct = clampHalf(pct, 0.16, 0.80, 0.90);

    var ftRate = clamp(0.07 + skill01(attr(shooter, 'FIN')) * 0.20 + skill01(attr(shooter, 'STR')) * 0.11 + skill01(attr(shooter, 'HAN')) * 0.06, 0.07, 0.62);
    if (shooter && shooter._isUser) ftRate = clamp(ftRate * 0.82 * st(game.styles, 'finisher'), 0.07, 0.62);
    var foulP = shot === 'FIN' ? ftRate * 0.82 : ftRate * 0.38;
    if (fx.hack) foulP = 1;
    else if (fx.foul) foulP = Math.max(foulP, 0.72);
    var shootingFoul = chance(foulP);

    if (shootingFoul) {
      var fta = shot === 'threePT' ? 3 : 2;
      var andOne = false;
      if (!fx.hack && shot === 'FIN' && chance(0.20)) {
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
      var foulTone = madeFt ? 'make' : 'miss';
      var foulText;
      if (andOne) foulText = nm(shooter) + ' 打成2+1，加罚' + (madeFt ? '命中' : '不中');
      else foulText = nm(shooter) + ' 造成犯规，罚球 ' + madeFt + '/' + fta;
      rows.push({ kind: 'foul', tag: '造杀伤', tone: foulTone, teamSide: side, text: foulText });
      return { clock: clock, orb: false, rows: rows };
    }

    var made = chance(pct);
    var pts = shot === 'threePT' ? 3 : 2;
    recordShot(game, shooter, shot, made, pts, passer, side, ctx.qIdx, ctx.isOT);
    if (made) {
      rows.push({
        kind: 'make', tag: '进攻成功', tone: 'make', teamSide: side,
        text: nm(shooter) + ' ' + verb + '命中' + (passer ? '（' + nm(passer) + '助攻）' : '')
      });
      return { clock: clock, orb: false, rows: rows };
    }
    rows.push({
      kind: 'miss', tag: '进攻失败', tone: 'miss', teamSide: side,
      text: nm(shooter) + ' ' + verb + '不中'
    });
    var missReb = doRebound(game, ctx, orbRate);
    rows = rows.concat(reboundRows(ctx, missReb));
    return { clock: clock, orb: !!missReb.orb, rows: rows };
  }

  function emitPlay(sess, ctx, row) {
    var game = sess.game;
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
      elapsed: elapsedSec(q, sec, isOT, game.ot),
      elapsedLabel: fmtElapsed(elapsedSec(q, sec, isOT, game.ot)),
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
    game.plays.push(play);
    game.feed.push(play);
    sess.tickPlays.push(play);
    return play;
  }

  function emitMeta(sess, text) {
    emitPlay(sess, { q: sess.q, isOT: sess.isOT, secLeft: sess.clock }, {
      kind: 'meta', tag: '', tone: '', text: text, secLeft: sess.clock
    });
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
    var stint = stintOf(q, clock, margin, isOT);
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
      sess.clock = 720;
      sess.isOT = false;
      sess.afterTimeout = true;
      sess.lastStint = null;
      sess.lastUserOn = null;
      sess.possessor = game._nextPoss || sess.possessor || 'A';
      emitMeta(sess, periodLabel(sess.q, false) + '开始');
      return true;
    }
    if (game.scoreA === game.scoreB && game.ot < 3) {
      game.ot++;
      game.thisOtA = clamp(Math.round(gauss(9, 2.2)), 4, 16);
      game.thisOtB = clamp(Math.round(gauss(9, 2.2)), 4, 16);
      if (game.thisOtA === game.thisOtB && game.ot === 3) game.thisOtA++;
      game.otTgtA = (game.otTgtA || 0) + game.thisOtA;
      game.otTgtB = (game.otTgtB || 0) + game.thisOtB;
      sess.q = 4;
      sess.qIdx = 3;
      sess.isOT = true;
      sess.clock = 300;
      sess.afterTimeout = true;
      sess.lastStint = null;
      sess.lastUserOn = null;
      sess.possessor = rand() < 0.5 ? 'A' : 'B';
      emitMeta(sess, periodLabel(4, true, game.ot) + '开始');
      return true;
    }
    return false;
  }

  function finishGame(sess) {
    if (sess.done) return;
    var game = sess.game;
    var bp = game.bp;
    if (game.scoreA === game.scoreB) game.scoreA++;
    calibrate(game, bp);
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
      bp: bp,
      game: game,
      q: 1,
      qIdx: 0,
      clock: 720,
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
    emitMeta(sess, periodLabel(1, false) + '开始');
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

  function addPtsToLine(ln, pts) {
    var left = pts;
    if (left > 0) {
      while (left >= 3) { ln.fga++; ln.threeA++; ln.threeM++; ln.fgm++; ln.pts += 3; left -= 3; }
      while (left >= 2) { ln.fga++; ln.twoM++; ln.fgm++; ln.pts += 2; left -= 2; }
      if (left > 0) { ln.fta += left; ln.ftm += left; ln.pts += left; }
      return pts;
    }
    var need = -left;
    while (need > 0 && ln.pts > 0) {
      if (ln.threeM > 0 && need >= 3) {
        ln.threeM--; ln.fgm--; ln.fga = Math.max(ln.fgm, ln.fga - 1);
        ln.threeA = Math.max(ln.threeM, ln.threeA - 1); ln.pts -= 3; need -= 3;
      } else if (ln.twoM > 0) {
        ln.twoM--; ln.fgm--; ln.pts -= 2; need -= 2;
      } else if (ln.ftm > 0) {
        ln.ftm--; ln.pts--; need--;
      } else break;
    }
    return pts + need;
  }

  function distributeAdj(game, roster, adj, skipUser) {
    if (!adj) return 0;
    var cands = roster.filter(function (p) {
      if (!p) return false;
      if (skipUser && p._isUser) return false;
      return lineOf(game, p).mins >= 6;
    });
    if (!cands.length) cands = roster.filter(Boolean);
    cands.sort(function (a, b) { return lineOf(game, b).pts - lineOf(game, a).pts; });
    var left = adj;
    var guard = 0;
    while (left !== 0 && cands.length && guard < 80) {
      var p = cands[guard % cands.length];
      var ln = lineOf(game, p);
      var step = left > 0 ? Math.min(3, left) : Math.max(-3, left);
      if (left < 0 && ln.pts < -step) { guard++; continue; }
      var applied = addPtsToLine(ln, step);
      left -= applied;
      guard++;
    }
    return adj - left;
  }

  function calibrate(game, bp) {
    var user = bp.rosterA.filter(function (p) { return p && p._isUser; })[0];
    if (user) {
      var ln = lineOf(game, user);
      var diff = ln.pts - bp.user.pts;
      if (Math.abs(diff) > 2.2) {
        var uAdj = Math.round((Math.abs(diff) - 2.2) * 0.90) * (diff > 0 ? -1 : 1);
        var before = ln.pts;
        addPtsToLine(ln, uAdj);
        var got = ln.pts - before;
        game.scoreA += got;
        game.qA[3] += got;
      }
      ['reb', 'ast', 'stl', 'blk', 'tov'].forEach(function (k) {
        var exp = bp.user[k];
        if (exp == null) return;
        if (Math.abs(ln[k] - exp) > 0.7) {
          ln[k] = Math.max(0, Math.round(exp * 0.82 + ln[k] * 0.18));
        }
      });
    }

    var maxDev = bp.isPlayoff ? 2.6 : 1.8;
    function pullTeam(side) {
      var tgt = (side === 'A' ? game.tgtA : game.tgtB) + (side === 'A' ? (game.otTgtA || 0) : (game.otTgtB || 0));
      var cur = side === 'A' ? game.scoreA : game.scoreB;
      var diff = cur - tgt;
      if (Math.abs(diff) <= maxDev) return;
      var adj = Math.round((Math.abs(diff) - maxDev) * 0.94) * (diff > 0 ? -1 : 1);
      var applied = distributeAdj(game, side === 'A' ? bp.rosterA : bp.rosterB, adj, true);
      if (side === 'A') { game.scoreA += applied; game.qA[3] += applied; }
      else { game.scoreB += applied; game.qB[3] += applied; }
    }
    pullTeam('A');
    pullTeam('B');

    function syncBox(roster, teamPts) {
      var sum = 0;
      roster.forEach(function (p) { sum += lineOf(game, p).pts; });
      var gap = Math.round(teamPts - sum);
      if (gap) distributeAdj(game, roster, gap, true);
    }
    syncBox(bp.rosterA, game.scoreA);
    syncBox(bp.rosterB, game.scoreB);
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
  function derbyOpp(team) { return DERBY[team] || null; }

  function describeRegular(game, index, total) {
    var opp = teamName(game.opponent);
    var loc = game.home ? '主场对' : '客场挑战';
    if (index === 0) return '赛季揭幕战，' + loc + opp + '。';
    if (isChristmas(game)) return '圣诞大战，' + loc + opp + '。';
    if (isHomeOpener(game, index)) return '主场揭幕，' + loc + opp + '。';
    if (isDerbyGame(game)) return '德比夜，' + loc + opp + '。';
    if (isRivalGame(game)) return '和宿敌的对话，' + loc + opp + '。';
    if (isRaceGame(index, total)) return '排名边缘的关键战，' + loc + opp + '。';
    if (isNationalGame(index)) return '全国转播夜，' + loc + opp + '。';
    return loc + opp + '，值得自己看完。';
  }

  function isChristmas(game) { return game && game.day >= 62 && game.day <= 68; }
  function isHomeOpener(game, index) {
    if (!game || !game.home) return false;
    var sch = STATE.season && STATE.season.schedule || [];
    for (var i = 0; i < sch.length; i++) {
      if (sch[i].home) return sch[i] === game || i === index;
    }
    return false;
  }
  function isDerbyGame(game) {
    var me = STATE.careerTeam;
    var d = (STATE.career && STATE.career.flags && STATE.career.flags.storyDerby && STATE.career.flags.storyDerby.team) || derbyOpp(me);
    return !!(d && game && game.opponent === d);
  }
  function isRivalGame(game) {
    var r = STATE.career && STATE.career.flags && STATE.career.flags.storyRival;
    return !!(r && r.team && game && game.opponent === r.team);
  }
  function isNationalGame(index) {
    var fame = 0, ovr = STATE.finalOVR || 0;
    try { fame = Number(getCareerProfile().fame) || 0; } catch (e) {}
    if (fame >= 7 || ovr >= 88) return index >= 11 && (index + 1) % 11 === 0;
    return index >= 21 && (index + 1) % 14 === 0;
  }
  function isRaceGame(index, total) {
    if (total - index > 12) return false;
    if (typeof getConferenceSeed !== 'function') return false;
    var seed = getConferenceSeed(STATE.careerTeam);
    return seed >= 5 && seed <= 12;
  }
  function isEliteOpp(game) {
    if (!game || typeof calcTeamPowerWithPlayer !== 'function') return false;
    var p = calcTeamPowerWithPlayer(game.opponent);
    return (p.depth || 0) >= 84;
  }

  function shouldOfferRegular(game, index, total) {
    if (!game || game._livePrompted) return false;
    var season = STATE.season || {};
    if (season._skipLiveRegular) return false;
    if ((season._liveOffers || 0) >= REGULAR_OFFER_CAP) return false;
    var hit = index === 0 || isChristmas(game) || isHomeOpener(game, index) || isDerbyGame(game)
      || isRivalGame(game) || isNationalGame(index) || isRaceGame(index, total);
    if (!hit && isEliteOpp(game) && (season._liveElite || 0) < 2) hit = true;
    if (!hit) return false;
    game._livePrompted = true;
    season._liveOffers = (season._liveOffers || 0) + 1;
    if (isEliteOpp(game)) season._liveElite = (season._liveElite || 0) + 1;
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
    overlay.innerHTML =
      '<div class="pp-live-card">' +
        '<div class="pp-live-head">' +
          '<div class="pp-live-kicker">' + (info.kicker || '关键赛事') + '</div>' +
          '<div class="pp-live-title">' + (info.title || '观看本场？') + '</div>' +
          '<div class="pp-live-sub">' + (info.reason || '') + '</div>' +
        '</div>' +
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
    if (p.tone) cls += ' is-' + p.tone;
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
          '<div class="pp-live-team" id="pp-live-name-a">' + teamBoardHtml(bp.teamA) + '</div>' +
          '<div class="pp-live-score" id="pp-live-score">0-0</div>' +
          '<div class="pp-live-team" id="pp-live-name-b">' + teamBoardHtml(bp.teamB) + '</div>' +
        '</div>' +
        '<div class="pp-live-clockline">' +
          '<span><b id="pp-live-periodclock">第一节 12:00</b></span>' +
          '<span>开赛 <b id="pp-live-elapsed">0:00</b></span>' +
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

  function renderBoard(sess, pack) {
    var game = sess.game;
    var scoreEl = document.getElementById('pp-live-score');
    var clockEl = document.getElementById('pp-live-periodclock');
    var elapsedEl = document.getElementById('pp-live-elapsed');
    if (!scoreEl) return;
    var sa = pack && pack.result ? pack.result.scoreA : Math.round(game.scoreA);
    var sb = pack && pack.result ? pack.result.scoreB : Math.round(game.scoreB);
    scoreEl.textContent = sa + '-' + sb;
    if (sess.done) {
      clockEl.textContent = '终场';
      elapsedEl.textContent = fmtElapsed(elapsedSec(4, 0, !!game.ot, game.ot || 1));
    } else {
      clockEl.textContent = periodLabel(sess.q, sess.isOT, game.ot) + ' ' + fmtClock(sess.clock);
      elapsedEl.textContent = fmtElapsed(elapsedSec(sess.q, sess.clock, sess.isOT, game.ot));
    }
    renderQRows(sess);
  }

  function appendPlays(plays) {
    var feedEl = document.getElementById('pp-live-feed');
    if (!feedEl || !plays || !plays.length) return;
    var html = '';
    for (var i = 0; i < plays.length; i++) html += playRowHtml(plays[i]);
    feedEl.insertAdjacentHTML('beforeend', html);
    feedEl.scrollTop = feedEl.scrollHeight;
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
    var paused = false;
    var fast = false;
    var timer = null;
    var closed = false;

    appendPlays(sess.game.plays);
    renderBoard(sess, null);

    function delay() {
      if (sess.fastForward) return 0;
      return fast ? 280 : 700;
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
    function handleTick(out) {
      appendPlays(out.plays);
      renderBoard(sess, sess.done ? sess.pack : null);
      if (sess.done) finishUI();
    }
    function pump() {
      if (closed || paused || sess.done) return;
      handleTick(tickSession(sess));
      if (!sess.done) schedule();
    }
    function schedule() {
      stopTimer();
      if (closed || paused || sess.done) return;
      if (delay() === 0) {
        var n = 0;
        while (!sess.done && n < 12) {
          handleTick(tickSession(sess));
          n++;
        }
        if (!sess.done) timer = setTimeout(schedule, 0);
        return;
      }
      timer = setTimeout(pump, delay());
    }
    function skipToEnd() {
      sess.fastForward = true;
      paused = false;
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
      if (!paused && !sess.done) schedule();
    };
    document.getElementById('pp-live-end').onclick = skipToEnd;
    schedule();
  }
  PP_LIVE.playTheaterWatch = playTheaterWatch;

  function playTheater(pack, done) {
    if (!pack || !pack.live) { if (done) done(pack); return; }
    injectStyle();
    var live = pack.live;
    var plays = live.plays || [];
    var overlay = mountTheaterShell(live.bp);
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
      appendPlays([p]);
      renderBoard(fakeSess, null);
      timer = setTimeout(pump, fast ? 280 : 700);
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
})();
