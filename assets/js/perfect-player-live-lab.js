/* 局内模拟实验室 — 仅挂载 PP_LIVE，无生涯/赛季 UI */
(function () {
  'use strict';

  var LAB_TEAM_A = 'CLE';
  var LAB_TEAM_B = 'OKC';
  var BROADCAST_SCALE = 1;
  var DEBUG_REBOUND_LAB = false;
  var FLAVOR_LAB = false;
  var THREE_ONLY_LAB = false;

  /* 主游戏在 nba-perfect-player.html 内联脚本提供，实验室页需自备 */
  function ensureLabRuntime() {
    if (typeof window.HUPU_USER === 'undefined') {
      window.HUPU_USER = {
        requested: true, loaded: true, promise: null, raw: null,
        isLogin: true, nickname: '实验室球员',
        avatar: 'assets/images/Player/ai-avatars/avatar-asia-01.png',
        source: 'lab', requestCount: 0
      };
      window.__HUPU_USER__ = window.HUPU_USER;
    }
    if (typeof window.getCustomPlayerName !== 'function') {
      window.getCustomPlayerName = function () { return '实验室球员'; };
    }
    if (typeof window.getHupuDisplayName !== 'function') {
      window.getHupuDisplayName = function () {
        if (window.PERFECT_PLAYER_PROFILE && window.PERFECT_PLAYER_PROFILE.name) {
          return window.PERFECT_PLAYER_PROFILE.name;
        }
        var custom = window.getCustomPlayerName();
        return custom || '实验室球员';
      };
    }
    if (typeof window.getHupuAvatarUrl !== 'function') {
      window.DEFAULT_HUPU_AVATAR = 'assets/images/Player/ai-avatars/avatar-asia-01.png';
      window.getHupuAvatarUrl = function () {
        var avatar = (window.HUPU_USER && window.HUPU_USER.avatar) || '';
        return avatar || window.DEFAULT_HUPU_AVATAR;
      };
    }
    if (typeof NBA2K_TEAMS !== 'undefined' && typeof NBA2K_DATA !== 'undefined') {
      var fixMap = { 'Tamar Bates': '塔马尔贝茨', 'Trey Lyles': '特雷-莱尔斯' };
      NBA2K_TEAMS.forEach(function (t) {
        (NBA2K_DATA[t] || []).forEach(function (p) {
          if (fixMap[p.name]) p.cname = fixMap[p.name];
        });
      });
    }
  }

  function showLabError(msg) {
    var el = document.getElementById('live-lab-banner');
    if (!el) return;
    el.innerHTML = '<strong style="color:#b33">局内模拟启动失败</strong> · ' + String(msg || '未知错误');
  }

  var ARCHETYPES = [
    { threePT: 94, MID: 84, FIN: 72, DNK: 58, HAN: 90, PAS: 74, PDEF: 64, IDEF: 50, BLK: 44, REB: 54, ATH: 82, STR: 62, CLU: 82 },
    { threePT: 72, MID: 90, FIN: 86, DNK: 78, HAN: 86, PAS: 76, PDEF: 68, IDEF: 58, BLK: 52, REB: 58, ATH: 80, STR: 70, CLU: 84 },
    { threePT: 68, MID: 76, FIN: 92, DNK: 90, HAN: 82, PAS: 70, PDEF: 62, IDEF: 55, BLK: 48, REB: 62, ATH: 92, STR: 82, CLU: 78 },
    { threePT: 62, MID: 70, FIN: 88, DNK: 94, HAN: 78, PAS: 68, PDEF: 58, IDEF: 72, BLK: 88, REB: 90, ATH: 76, STR: 92, CLU: 70 },
    { threePT: 58, MID: 66, FIN: 82, DNK: 86, HAN: 74, PAS: 72, PDEF: 60, IDEF: 88, BLK: 94, REB: 92, ATH: 70, STR: 88, CLU: 68 },
    { threePT: 80, MID: 82, FIN: 74, DNK: 62, HAN: 88, PAS: 92, PDEF: 70, IDEF: 52, BLK: 40, REB: 48, ATH: 84, STR: 58, CLU: 86 },
    { threePT: 76, MID: 78, FIN: 80, DNK: 72, HAN: 84, PAS: 78, PDEF: 82, IDEF: 76, BLK: 58, REB: 64, ATH: 86, STR: 74, CLU: 80 },
    { threePT: 88, MID: 80, FIN: 70, DNK: 60, HAN: 92, PAS: 80, PDEF: 66, IDEF: 48, BLK: 42, REB: 50, ATH: 88, STR: 60, CLU: 88 },
    { threePT: 70, MID: 88, FIN: 84, DNK: 76, HAN: 84, PAS: 74, PDEF: 72, IDEF: 64, BLK: 54, REB: 60, ATH: 78, STR: 76, CLU: 82 },
    { threePT: 64, MID: 74, FIN: 90, DNK: 88, HAN: 80, PAS: 72, PDEF: 64, IDEF: 70, BLK: 82, REB: 86, ATH: 74, STR: 86, CLU: 74 }
  ];

  function avgOvr(attrs) {
    var keys = (window.SIM_CONFIG && SIM_CONFIG.ATTR_LIST) || Object.keys(attrs);
    var sum = 0, n = 0;
    keys.forEach(function (k) {
      var v = parseInt(attrs[k], 10);
      if (!isFinite(v)) return;
      sum += v;
      n++;
    });
    return n ? Math.round(sum / n) : 75;
  }

  function applyArchetype(player, arch) {
    if (!player || !arch) return;
    Object.keys(arch).forEach(function (k) { player[k] = arch[k]; });
    player.ovr = avgOvr(arch);
    player._lineupOvr = player.ovr;
  }

  function diversifyTeam(team) {
    var roster = (typeof NBA2K_DATA !== 'undefined' && NBA2K_DATA[team]) || [];
    if (!roster.length) return;
    roster.sort(function (a, b) {
      return (parseInt(b.ovr, 10) || 0) - (parseInt(a.ovr, 10) || 0);
    });
    var i, p;
    for (i = 0; i < Math.min(10, roster.length); i++) {
      p = roster[i];
      if (!p || p._isUser) continue;
      applyArchetype(p, ARCHETYPES[i % ARCHETYPES.length]);
    }
  }

  function labUserAttrs() {
    return {
      threePT: 90, MID: 88, FIN: 82, DNK: 76, HAN: 90, PAS: 86,
      PDEF: 68, IDEF: 58, BLK: 52, REB: 58, ATH: 88, STR: 72, CLU: 86
    };
  }

  function setupState(teamA) {
    if (typeof restoreBaseLeagueRoster === 'function') restoreBaseLeagueRoster();
    if (typeof attachOfficialPlayerHeadshots === 'function') {
      try { attachOfficialPlayerHeadshots(); } catch (e) { console.warn(e); }
    }
    if (typeof clearLineupCache === 'function') clearLineupCache();

    STATE.careerTeam = teamA;
    STATE.position = 'SG';
    STATE.finalOVR = 90;
    STATE.attrs = labUserAttrs();
    if (!STATE.career || !STATE.career.flags) {
      STATE.career = typeof createFreshCareer === 'function' ? createFreshCareer() : { flags: {}, seasonCount: 3 };
    }
    STATE.career.flags = STATE.career.flags || {};
    delete STATE.career.flags.startBench;
  }

  function mountBanner() {
    var el = document.getElementById('live-lab-banner');
    if (!el) return;
    var a = typeof getTeamName === 'function' ? getTeamName(LAB_TEAM_A) : LAB_TEAM_A;
    var b = typeof getTeamName === 'function' ? getTeamName(LAB_TEAM_B) : LAB_TEAM_B;
    var mode = THREE_ONLY_LAB
      ? '三分专项（每回合外线出手，验线位/动画/记分）'
      : (FLAVOR_LAB ? '高光动作演练（超远三分/颜射/隔扣）' : '常规局内');
    el.innerHTML =
      '<strong>局内模拟实验室</strong> · ' + a + ' vs ' + b +
      ' · ' + mode + ' · 看完可点「再打一场」';
  }

  function runLab(done) {
    ensureLabRuntime();
    if (!window.PP_LIVE || typeof PP_LIVE.playTheaterWatch !== 'function') {
      showLabError('PP_LIVE 未加载，请检查脚本路径');
      console.error('[live-lab] PP_LIVE 未加载');
      return;
    }
    try {
      setupState(LAB_TEAM_A);
      diversifyTeam(LAB_TEAM_A);
      diversifyTeam(LAB_TEAM_B);
      mountBanner();
      PP_LIVE.playTheaterWatch({
        teamA: LAB_TEAM_A,
        teamB: LAB_TEAM_B,
        options: {
          watch: true,
          neutralState: true,
          teamAHome: true,
          fatigueA: 0,
          fatigueB: 0,
          broadcastScale: BROADCAST_SCALE,
          debugReboundLab: DEBUG_REBOUND_LAB,
          flavorLab: FLAVOR_LAB,
          threeOnlyLab: THREE_ONLY_LAB,
          attrs: STATE.attrs,
          isPlayoff: false
        }
      }, done || function (pack) {
        console.log('[live-lab] finished', pack && pack.result);
      });
    } catch (e) {
      console.error('[live-lab]', e);
      showLabError(e && e.message ? e.message : e);
    }
  }

  window.PP_LIVE_LAB = {
    teamA: LAB_TEAM_A,
    teamB: LAB_TEAM_B,
    broadcastScale: BROADCAST_SCALE,
    debugReboundLab: DEBUG_REBOUND_LAB,
    flavorLab: FLAVOR_LAB,
    threeOnlyLab: THREE_ONLY_LAB,
    run: runLab,
    diversifyTeam: diversifyTeam,
    setupState: setupState
  };
})();
