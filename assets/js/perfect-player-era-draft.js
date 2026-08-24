/* Perfect Player — 历史时代选秀/新秀生成（参考虎扑） */
(function () {
  'use strict';

  function getActiveLeagueTeams() {
    if (typeof NBA2K_TEAMS === 'undefined') return [];
    if (window.PP_ERA_MODE && typeof PP_ERA_MODE.getEraActiveTeams === 'function' && PP_ERA_MODE.isHistoricalActive && PP_ERA_MODE.isHistoricalActive()) {
      var listed = PP_ERA_MODE.getEraActiveTeams(String(STATE.eraStart), (STATE.career && STATE.career.seasonCount) || 0);
      if (listed && listed.length) {
        return listed.filter(function (t) { return (NBA2K_DATA[t] || []).length > 0; });
      }
    }
    if (window.PP_ERA_MODE && typeof PP_ERA_MODE.isHistoricalActive === 'function' && PP_ERA_MODE.isHistoricalActive()) {
      return NBA2K_TEAMS.filter(function (t) {
        return (NBA2K_DATA[t] || []).length > 0;
      });
    }
    return NBA2K_TEAMS.slice();
  }

  function resolveEraSeasonYear() {
    if (typeof getEraSeasonYear === 'function' && STATE && STATE.eraStart != null) {
      return String(getEraSeasonYear(STATE.eraStart, (STATE.career && STATE.career.seasonCount) || 0));
    }
    if (STATE && STATE.draftMode === 'historical' && STATE.eraStart) {
      return String((parseInt(STATE.eraStart, 10) || 0) + ((STATE.career && STATE.career.seasonCount) || 0));
    }
    return null;
  }

  function draftOvrFallback(pick) {
    if (typeof draftOvrByPick === 'function') return draftOvrByPick(pick || 99);
    if (pick <= 3) return 81;
    if (pick <= 8) return 80;
    if (pick <= 15) return 79;
    if (pick <= 30) return 77;
    if (pick <= 45) return 73;
    return 70;
  }

  function buildHistoricalDraftPlayerNoSalary(eraYear, pickData) {
    if (!pickData) return null;
    var player = null;
    if (typeof buildEraCorePlayer === 'function' && pickData.en) {
      try {
        player = buildEraCorePlayer(String(eraYear), pickData.team || '', pickData.en, 1);
      } catch (e) {
        player = null;
      }
    }
    if (player) {
      if (pickData.ovr != null) player.ovr = parseInt(pickData.ovr, 10) || player.ovr;
      if (pickData.pos) player.pos = String(pickData.pos).split('/')[0].trim();
      if (pickData.height) player.height = pickData.height;
      if (pickData._potential != null) player._potential = parseInt(pickData._potential, 10);
      if (pickData.cn) player.cname = pickData.cn;
      player._enterYear = parseInt(eraYear, 10);
    }
    if (!player) {
      var ovr = parseInt(pickData.ovr, 10) || draftOvrFallback(pickData.pick || 99);
      player = {
        name: 'EraDraft_' + eraYear + '_' + String(pickData.en || pickData.cn || pickData.pick || '').replace(/[^A-Za-z0-9]+/g, ''),
        nameEN: pickData.en || '',
        cname: pickData.cn || pickData.en || ('历史新秀' + (pickData.pick || '')),
        pos: String(pickData.pos || 'SF').split('/')[0].trim(),
        height: pickData.height || '',
        type: ovr >= 88 ? '球星' : (ovr >= 80 ? '主力' : '新秀'),
        ovr: ovr,
        _age: pickData.birth
          ? Math.max(18, parseInt(eraYear, 10) - parseInt(pickData.birth, 10))
          : (19 + Math.floor((typeof rngNext === 'function' ? rngNext() : Math.random()) * 3)),
        _eraRoster: true,
        _rookieSeason: 0,
        _draftYear: parseInt(eraYear, 10),
        _enterYear: parseInt(eraYear, 10),
        _proYear: 1,
        _potential: pickData._potential,
        _awardStreak: {}
      };
      var attrKeys = (SIM_CONFIG && SIM_CONFIG.ATTR_LIST) || ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
      var attrs = pickData.attrs || (typeof getEraPlayerAttrs === 'function' ? getEraPlayerAttrs(player.pos, ovr) : null) || {};
      attrKeys.forEach(function (k) {
        var roll = typeof rngNext === 'function' ? rngNext() : Math.random();
        player[k] = attrs[k] != null ? attrs[k] : Math.max(25, Math.min(99, ovr + Math.floor(roll * 16) - 8));
      });
    }
    player.contract = pickData.pick <= 14 ? 3 : (pickData.pick <= 30 ? 2 : 1);
    player.type = player.type || '新秀';
    delete player.salary;
    delete player.contractType;
    delete player.contractPO;
    if (typeof window.getHupuPlayerPhotoUrl === 'function') {
      var url = window.getHupuPlayerPhotoUrl(player);
      if (url) {
        if (url.indexOf('http://') === 0) url = 'https://' + url.slice(7);
        player.photoUrl = url;
        player._photoUrl = url;
        if (!player.photoLocal && typeof window.hupuEraLocalPhotoPath === 'function') {
          var localPath = window.hupuEraLocalPhotoPath(player, url);
          if (localPath) {
            player.photoLocal = localPath;
            player._photoLocal = localPath;
          }
        }
        player.photoSource = player.photoSource || 'hupu-player-photos';
      }
    }
    return player;
  }

  function eraIdentityKey(player) {
    if (!player) return '';
    var en = player.nameEN || player.en || '';
    if (en) {
      return String(en).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    }
    var cn = player.cname || player.nameCN || player.cn || '';
    return cn ? ('cn:' + String(cn).replace(/\s+/g, '')) : '';
  }

  function findLeaguePlayerByIdentity(key, teams) {
    if (!key || !NBA2K_DATA) return null;
    for (var ti = 0; ti < teams.length; ti++) {
      var team = teams[ti];
      var roster = NBA2K_DATA[team];
      if (!roster) continue;
      for (var pi = 0; pi < roster.length; pi++) {
        if (eraIdentityKey(roster[pi]) === key) return { team: team, idx: pi, roster: roster };
      }
    }
    return null;
  }

  function applyEraDraftClassNoSalary(eraYear) {
    if (!NBA2K_DATA || typeof HISTORICAL_DRAFT_CLASSES === 'undefined') return false;
    eraYear = String(eraYear || (STATE && STATE.eraStart) || '');
    var cls = HISTORICAL_DRAFT_CLASSES[eraYear];
    if (!cls || !cls.length || NBA2K_DATA['_eraDraftApplied_' + eraYear]) return false;
    NBA2K_DATA['_eraDraftApplied_' + eraYear] = true;
    var activeTeams = getActiveLeagueTeams();
    if (!activeTeams.length) return false;
    cls.forEach(function (pk) {
      var t = pk.team;
      if (!t || activeTeams.indexOf(t) < 0) {
        t = activeTeams[(Math.max(1, pk.pick || 1) - 1) % activeTeams.length];
      }
      var roster = NBA2K_DATA[t];
      if (!roster) return;
      var rookie = buildHistoricalDraftPlayerNoSalary(eraYear, pk);
      if (!rookie) return;
      var ident = eraIdentityKey(rookie) || eraIdentityKey({ nameEN: pk.en, cname: pk.cn });
      var existing = ident ? findLeaguePlayerByIdentity(ident, activeTeams) : null;
      if (existing) {
        var oldP = existing.roster[existing.idx];
        if (oldP && oldP._isUser) return;
        if (existing.team === t) existing.roster[existing.idx] = rookie;
        return;
      }
      var lowestIdx = -1;
      var lowestOvr = 999;
      roster.forEach(function (p, pi) {
        if (p && !p._isUser && (parseInt(p.ovr, 10) || 0) < lowestOvr) {
          lowestOvr = parseInt(p.ovr, 10) || 0;
          lowestIdx = pi;
        }
      });
      if (lowestIdx >= 0 && roster.length >= 12) roster[lowestIdx] = rookie;
      else roster.push(rookie);
    });
    if (typeof clearLineupCache === 'function') clearLineupCache();
    return true;
  }

  function recordLeagueRookieArrival(player, team) {
    if (!player || !team) return;
    if (!STATE._leagueChanges) STATE._leagueChanges = { retired: [], rookies: [], teamChanges: {}, trades: [] };
    if (!STATE._leagueChanges.rookies) STATE._leagueChanges.rookies = [];
    if (!STATE._leagueChanges.teamChanges) STATE._leagueChanges.teamChanges = {};
    if (!STATE._leagueChanges.teamChanges[team]) {
      STATE._leagueChanges.teamChanges[team] = { retired: [], rookies: [] };
    }
    var item = {
      name: player.cname || player.nameCN || player.cn || player.nameEN || player.en || player.name || '',
      en: player.nameEN || player.en || player.name || '',
      nameEN: player.nameEN || player.en || '',
      ovr: parseInt(player.ovr, 10) || 0,
      pos: player.pos || '',
      team: team
    };
    STATE._leagueChanges.rookies.push(item);
    if (team === STATE.careerTeam) {
      STATE._leagueChanges.teamChanges[team].rookies.push(item.name);
    }
  }

  window.PP_ERA_DRAFT = {
    getActiveLeagueTeams: getActiveLeagueTeams,
    resolveEraSeasonYear: resolveEraSeasonYear,
    buildHistoricalDraftPlayerNoSalary: buildHistoricalDraftPlayerNoSalary,
    applyEraDraftClassNoSalary: applyEraDraftClassNoSalary,
    recordLeagueRookieArrival: recordLeagueRookieArrival
  };

  window.getActiveLeagueTeams = getActiveLeagueTeams;
  window.buildHistoricalDraftPlayerNoSalary = buildHistoricalDraftPlayerNoSalary;
  window.applyEraDraftClassNoSalary = applyEraDraftClassNoSalary;
  window.recordLeagueRookieArrival = recordLeagueRookieArrival;
})();
