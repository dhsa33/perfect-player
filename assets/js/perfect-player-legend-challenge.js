/* 隐藏挑战：梦境传奇系列赛（≥3 MVP + ≥3 FMVP 触发） */
(function () {
  'use strict';

  var LEGEND_ROSTERS_URL = 'assets/data/historical/legend-team-rosters.json?v=20260823-legend-v3';
  var LEGEND_ROUND = -99;
  var LEGEND_SERIES_IDX = -99;
  var LEGEND_ABBR = {
    'chi-1995-96': '_LEG_CHI',
    'gsw-2016-17': '_LEG_GSW',
    'bos-1985-86': '_LEG_BOS',
    'lal-2000-01': '_LEG_LAL01',
    'lal-1986-87': '_LEG_LAL87'
  };
  var ALL_LEGEND_IDS = Object.keys(LEGEND_ABBR);

  /** 击败传奇队解锁对应球风技能四级 */
  var LEGEND_TEAM_SKILLS = {
    'gsw-2016-17': ['cold_arrow', 'off_ball'],
    'lal-1986-87': ['tempo_master', 'pnr_maestro'],
    'lal-2000-01': ['post_bully', 'dunk_threat'],
    'bos-1985-86': ['ice_ft', 'clutch_heart'],
    'chi-1995-96': ['mid_craftsman', 'steal_instinct']
  };

  var _legendData = null;
  var _legendDataPromise = null;

  function ensureLegendFlags() {
    if (!STATE.career) return null;
    STATE.career.flags = STATE.career.flags || {};
    if (!STATE.career.flags.legendChallenge) {
      STATE.career.flags.legendChallenge = {
        introSeen: false,
        defeated: [],
        completed: false,
        pendingAfterChampion: false,
        skillUnlocks: {}
      };
    }
    var f = STATE.career.flags.legendChallenge;
    f.defeated = Array.isArray(f.defeated) ? f.defeated : [];
    f.skillUnlocks = f.skillUnlocks || {};
    syncLegendSkillUnlocksFromDefeated(f);
    return f;
  }

  function syncLegendSkillUnlocksFromDefeated(flags) {
    if (!flags) return;
    flags.skillUnlocks = flags.skillUnlocks || {};
    flags.defeated.forEach(function (teamId) {
      var ids = LEGEND_TEAM_SKILLS[teamId] || [];
      ids.forEach(function (sid) { flags.skillUnlocks[sid] = true; });
    });
    if (typeof PP_SKILLS !== 'undefined' && PP_SKILLS.syncLegendPurchasedFromUnlocks) {
      PP_SKILLS.syncLegendPurchasedFromUnlocks();
    }
  }

  function grantLegendTeamSkillRewards(teamId) {
    var skillIds = LEGEND_TEAM_SKILLS[teamId];
    if (!skillIds || !skillIds.length) return [];
    var flags = ensureLegendFlags();
    if (!flags) return [];
    var names = [];
    skillIds.forEach(function (sid) {
      if (typeof PP_SKILLS !== 'undefined' && PP_SKILLS.grantLegendTierUnlock) {
        PP_SKILLS.grantLegendTierUnlock(sid);
      } else {
        flags.skillUnlocks[sid] = true;
      }
      if (typeof PP_SKILLS !== 'undefined' && PP_SKILLS.getSkillDisplayName) {
        names.push(PP_SKILLS.getSkillDisplayName(sid));
      }
    });
    return names;
  }

  function ensureLegendRostersLoaded() {
    if (_legendData) return Promise.resolve(_legendData);
    if (_legendDataPromise) return _legendDataPromise;
    _legendDataPromise = fetch(LEGEND_ROSTERS_URL, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('legend rosters http ' + r.status);
        return r.json();
      })
      .then(function (d) {
        _legendData = d;
        return d;
      })
      .catch(function (err) {
        try { console.warn('[legend-challenge] roster load failed', err); } catch (e) {}
        return null;
      });
    return _legendDataPromise;
  }

  function countCareerRegularMvp() {
    var n = 0;
    (STATE.career && STATE.career.honors || []).forEach(function (h) {
      if ((h.label || '') === 'MVP') n++;
    });
    (STATE.season && STATE.season.awards || []).forEach(function (a) {
      if (a.act === 'mvp' && a.isUser) n++;
    });
    return n;
  }

  function countCareerFmvp() {
    var n = 0;
    (STATE.career && STATE.career.honors || []).forEach(function (h) {
      var label = h.label || '';
      if (label.indexOf('总决赛MVP') >= 0 || label.indexOf('FMVP') >= 0) n++;
    });
    (STATE.season && STATE.season.awards || []).forEach(function (a) {
      if (a.act === 'fmvp' && a.isUser) n++;
    });
    return n;
  }

  function isLegendChallengeEligible() {
    if (!STATE.career || !STATE.season) return false;
    return countCareerRegularMvp() >= 3 && countCareerFmvp() >= 3;
  }

  function getLegendTeamById(id) {
    if (!_legendData || !_legendData.teams) return null;
    for (var i = 0; i < _legendData.teams.length; i++) {
      if (_legendData.teams[i].id === id) return _legendData.teams[i];
    }
    return null;
  }

  function pickRandomLegendTeam() {
    var flags = ensureLegendFlags();
    if (!flags) return null;
    var pool = ALL_LEGEND_IDS.filter(function (id) {
      return flags.defeated.indexOf(id) < 0;
    });
    if (!pool.length) return null;
    var pickId = pool[Math.floor(Math.random() * pool.length)];
    return getLegendTeamById(pickId);
  }

  function mapLegendPlayerTo2k(p) {
    var attrs = p.attrs || {};
    return {
      name: p.nameEn || p.nameCn,
      cname: p.nameCn,
      pos: p.pos,
      ovr: p.ovr,
      threePT: attrs.threePT,
      MID: attrs.MID,
      FIN: attrs.FIN,
      DNK: attrs.DNK,
      HAN: attrs.HAN,
      PAS: attrs.PAS,
      PDEF: attrs.PDEF,
      IDEF: attrs.IDEF,
      BLK: attrs.BLK,
      REB: attrs.REB,
      ATH: attrs.ATH,
      STR: attrs.STR,
      CLU: attrs.CLU
    };
  }

  function injectLegendRoster(team) {
    var abbr = LEGEND_ABBR[team.id] || '_LEG_' + String(team.id || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    var roster = (team.players || []).map(mapLegendPlayerTo2k);
    if (typeof NBA2K_DATA !== 'undefined') NBA2K_DATA[abbr] = roster;
    if (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.TEAM_NAMES) SIM_CONFIG.TEAM_NAMES[abbr] = team.label;
    return abbr;
  }

  function clearLegendInjection() {
    var lc = STATE.season && STATE.season.legendChallenge;
    if (lc && lc.legendAbbr) {
      if (typeof NBA2K_DATA !== 'undefined') delete NBA2K_DATA[lc.legendAbbr];
      if (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.TEAM_NAMES) delete SIM_CONFIG.TEAM_NAMES[lc.legendAbbr];
    }
    if (STATE.season) STATE.season.legendChallenge = null;
  }

  function isLegendChallengeSeriesActive() {
    return !!(STATE.season && STATE.season.legendChallenge && STATE.season.legendChallenge.active);
  }

  function showLegendOverlay(html, btnId, onClick) {
    var existing = document.querySelector('.legend-challenge-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.className = 'legend-challenge-overlay champion-celebration-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    var btn = document.getElementById(btnId);
    if (btn) {
      btn.onclick = function () {
        overlay.remove();
        if (typeof onClick === 'function') onClick();
      };
    }
  }

  function showLegendIntroModal(team, onContinue) {
    showLegendOverlay(
      '<div class="champion-card" style="max-width:520px;">' +
        '<div style="width:52px;height:3px;margin:0 auto 14px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.85;"></div>' +
        '<div class="champion-title">看台一闪</div>' +
        '<div class="champion-sub" style="text-align:left;line-height:1.65;font-size:13px;">' +
          '领奖台上，欢呼声一层层涌过来。你余光掠过看台高处——你仿佛看到了乔丹坐在那里。你来不及确认，举起奖杯之后再次望回去却再也没找到他：你已成为王朝领袖，可那些刻在历史上的冠军球队，若真拉出来同台较量，谁又能占上风？你和那个篮球之神，还有多少差距？<br><br>' +
          '庆祝持续了很久。回到家，你闭上眼，任由困意把自己一点点按进床垫里。<br><br>' +
          '下一秒，脚底传来木地板的触感。球馆大灯亮得刺眼，哨声在不远处响起——你站在中场，对面正在热身的，是一支你在录像带里看过无数次的冠军球队。' +
        '</div>' +
        '<button class="awards-next" id="legendIntroBtn">进入挑战</button>' +
      '</div>',
      'legendIntroBtn',
      onContinue
    );
  }

  function showLegendSeriesStartModal(team, userTeam, legendAbbr, onWatch, onSkipGame, onSkipSeries) {
    var existing = document.querySelector('.legend-challenge-overlay');
    if (existing) existing.remove();
    if (window.PP_LIVE && typeof PP_LIVE.injectLiveStyle === 'function') PP_LIVE.injectLiveStyle();
    var lineups = '';
    if (window.PP_LIVE && typeof PP_LIVE.lineupsPreviewHtml === 'function' && userTeam && legendAbbr) {
      lineups = PP_LIVE.lineupsPreviewHtml(userTeam, legendAbbr);
    }
    var overlay = document.createElement('div');
    overlay.className = 'legend-challenge-overlay champion-celebration-overlay';
    overlay.innerHTML =
      '<div class="champion-card" style="max-width:560px;">' +
        '<div style="width:52px;height:3px;margin:0 auto 14px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.85;"></div>' +
        '<div class="champion-title">梦境系列赛</div>' +
        '<div class="champion-sub">7 场 4 胜 · 对阵 ' + team.label + '</div>' +
        lineups +
        '<div style="margin-top:12px;width:100%;">' +
          '<button class="awards-next" id="legendWatchBtn" style="width:100%;box-sizing:border-box;">观看比赛</button>' +
          '<div class="pp-live-actions" style="padding:0;margin-top:8px;">' +
            '<button class="btn btn-secondary" id="legendSkipGameBtn">快速跳过</button>' +
            '<button class="btn btn-secondary" id="legendSkipSeriesBtn">本系列都跳过</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var closeAnd = function (fn) {
      overlay.remove();
      if (typeof fn === 'function') fn();
    };
    var watchBtn = document.getElementById('legendWatchBtn');
    if (watchBtn) watchBtn.onclick = function () { closeAnd(onWatch); };
    var skipGameBtn = document.getElementById('legendSkipGameBtn');
    if (skipGameBtn) skipGameBtn.onclick = function () { closeAnd(onSkipGame); };
    var skipSeriesBtn = document.getElementById('legendSkipSeriesBtn');
    if (skipSeriesBtn) skipSeriesBtn.onclick = function () { closeAnd(onSkipSeries); };
  }

  function runLegendSeriesGames(team, onDone, preferWatch, forceSkipLive) {
    var flags = ensureLegendFlags();
    if (!flags || !team) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    if (STATE.season) {
      STATE.season._skipLiveSeries = !!forceSkipLive;
      STATE.season._legendFirstGameWatch = !!preferWatch && !forceSkipLive;
    }
    var userTeam = STATE.careerTeam;
    var legendAbbr = STATE.season.legendChallenge && STATE.season.legendChallenge.legendAbbr;
    if (!legendAbbr) legendAbbr = injectLegendRoster(team);
    var roundName = '梦境挑战';
    if (typeof simOnePlayoffGame !== 'function') {
      clearLegendInjection();
      if (typeof onDone === 'function') onDone();
      return;
    }
    simOnePlayoffGame(
      LEGEND_ROUND, LEGEND_SERIES_IDX, userTeam, legendAbbr, true,
      0, 0, 0, [], [], roundName,
      function (winsA, winsB) {
        var userWon = winsA >= 4;
        clearLegendInjection();
        if (userWon) {
          if (flags.defeated.indexOf(team.id) < 0) flags.defeated.push(team.id);
          if (flags.defeated.length >= ALL_LEGEND_IDS.length) flags.completed = true;
        }
        var skillNames = userWon ? grantLegendTeamSkillRewards(team.id) : [];
        if (typeof clearPlayoffGamecast === 'function') clearPlayoffGamecast();
        showLegendResultModal(userWon, team.label, skillNames, onDone);
      }
    );
  }

  function beginLegendSeriesWithLive(team, onDone, preferWatch, forceSkipLive) {
    var launch = function () { runLegendSeriesGames(team, onDone, preferWatch, forceSkipLive); };
    if (window.__PP_ensure) {
      window.__PP_ensure('live').then(launch, launch);
    } else {
      launch();
    }
  }

  function showLegendResultModal(userWon, teamLabel, skillNames, onDone) {
    var title = userWon ? '梦境成真' : '传奇未褪';
    var sub = userWon
      ? '你击败了 ' + teamLabel + '。'
      : '未能击败 ' + teamLabel + '。梦境散去，你回到现实。';
    if (userWon && skillNames && skillNames.length) {
      sub += '<br><br>技能：' + skillNames.join('、') + ' 四级已解锁';
    }
    showLegendOverlay(
      '<div class="champion-card">' +
        (userWon ? '<div class="champion-cup">🏆</div>' : '<div style="width:52px;height:3px;margin:0 auto 14px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--text-muted),transparent);opacity:.5;"></div>') +
        '<div class="champion-title">' + title + '</div>' +
        '<div class="champion-sub">' + sub + '</div>' +
        '<button class="awards-next" id="legendResultBtn">继续</button>' +
      '</div>',
      'legendResultBtn',
      onDone
    );
  }

  function startLegendChallengeSeries(team, onDone) {
    var flags = ensureLegendFlags();
    if (!flags || !team) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    flags.pendingAfterChampion = false;

    if (STATE.season) STATE.season._skipLiveSeries = false;

    var legendAbbr = injectLegendRoster(team);
    STATE.season.legendChallenge = {
      active: true,
      teamId: team.id,
      label: team.label,
      legendAbbr: legendAbbr,
      seriesGames: []
    };

    if (typeof clearPlayoffGamecast === 'function') clearPlayoffGamecast();
    var gc = document.getElementById('playoff-gamecast');
    if (gc) {
      gc.style.display = 'block';
      gc.innerHTML = '<div style="font-size:11px;color:var(--orange);padding:4px 0;font-family:var(--font-display);">梦境挑战 · ' + team.label + '</div>';
    }

    var openSeriesModal = function () {
      showLegendSeriesStartModal(team, STATE.careerTeam, legendAbbr, function () {
        beginLegendSeriesWithLive(team, onDone, true, false);
      }, function () {
        beginLegendSeriesWithLive(team, onDone, false, false);
      }, function () {
        if (window.PP_LIVE && typeof PP_LIVE.skipSeries === 'function') PP_LIVE.skipSeries();
        beginLegendSeriesWithLive(team, onDone, false, true);
      });
    };
    if (window.__PP_ensure) {
      window.__PP_ensure('live').then(openSeriesModal, openSeriesModal);
    } else {
      openSeriesModal();
    }
  }

  function maybeOfferLegendChallenge(onDone) {
    var done = typeof onDone === 'function' ? onDone : function () {};
    var flags = ensureLegendFlags();
    if (!flags || !isLegendChallengeEligible() || flags.completed) {
      flags && (flags.pendingAfterChampion = false);
      done();
      return;
    }

    ensureLegendRostersLoaded().then(function (data) {
      if (!data) {
        flags.pendingAfterChampion = false;
        done();
        return;
      }
      var team = pickRandomLegendTeam();
      if (!team) {
        flags.completed = true;
        flags.pendingAfterChampion = false;
        done();
        return;
      }

      var launch = function () {
        flags.introSeen = true;
        startLegendChallengeSeries(team, done);
      };

      if (!flags.introSeen) {
        showLegendIntroModal(team, launch);
      } else {
        startLegendChallengeSeries(team, done);
      }
    });
  }

  function prepareLegendChallengeAfterChampion() {
    var flags = ensureLegendFlags();
    if (!flags) return;
    if (isLegendChallengeEligible() && !flags.completed) {
      flags.pendingAfterChampion = true;
    } else {
      flags.pendingAfterChampion = false;
    }
  }

  function maybeResumePendingLegendChallenge() {
    var flags = ensureLegendFlags();
    if (!flags || !flags.pendingAfterChampion) return;
    if (!STATE.season || !STATE.season.isChampion) {
      flags.pendingAfterChampion = false;
      return;
    }
    if (!isLegendChallengeEligible() || flags.completed) {
      flags.pendingAfterChampion = false;
      return;
    }
    flags.pendingAfterChampion = false;
    maybeOfferLegendChallenge(function () {});
  }

  function shouldOfferLegendChallengeAfterChampion() {
    var flags = ensureLegendFlags();
    if (!flags || !isLegendChallengeEligible() || flags.completed) return false;
    var pool = ALL_LEGEND_IDS.filter(function (id) {
      return flags.defeated.indexOf(id) < 0;
    });
    return pool.length > 0;
  }

  window.isLegendChallengeSeriesActive = isLegendChallengeSeriesActive;
  window.maybeOfferLegendChallenge = maybeOfferLegendChallenge;
  window.prepareLegendChallengeAfterChampion = prepareLegendChallengeAfterChampion;
  window.maybeResumePendingLegendChallenge = maybeResumePendingLegendChallenge;
  window.shouldOfferLegendChallengeAfterChampion = shouldOfferLegendChallengeAfterChampion;

  (function hookSaveLoad() {
    var orig = window.renderAfterSaveLoad;
    if (typeof orig !== 'function' || orig._legendHooked) return;
    orig._legendHooked = true;
    window.renderAfterSaveLoad = function (screen) {
      var ret = orig.apply(this, arguments);
      setTimeout(function () { maybeResumePendingLegendChallenge(); }, 600);
      return ret;
    };
  })();

  ensureLegendRostersLoaded();
})();
