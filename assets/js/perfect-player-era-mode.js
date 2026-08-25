/* ============================================================
   历史时代模式（本地试验）
   核心：用虎扑静态包替换 NBA2K_DATA 各队名单；其余生涯流程沿用现役逻辑。
   ============================================================ */

(function () {
  'use strict';

  var ERA_STATIC_SCRIPTS = {
    '1984': 'assets/js/hupu/legend-era/legend-era-1984-static.min.js',
    '1996': 'assets/js/hupu/legend-era/legend-era-1996-static.min.js',
    '2003': 'assets/js/hupu/legend-era/legend-era-2003-static.min.js'
  };

  var ERA_LABELS = {
    '1984': '1984 黄金一代',
    '1996': '1996 黄金一代',
    '2003': '2003 白金一代',
    '2026': '2026 现役联盟'
  };

  var CAREER_START_YEARS = ['1984', '1996', '2003', '2026'];

  /** 与虎扑 ERA_TEAM_EVOLUTION 一致：开局名单 + 按赛季年扩军/迁队。 */
  var ERA_TEAM_EVOLUTION = {
    1984: {
      startActive: ['ATL','BKN','BOS','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MIL','NYK','OKC','PHI','PHX','POR','SAC','SAS','UTA','WAS'],
      expansions: {
        1988: ['CHA','MIA'],
        1989: ['ORL','MIN'],
        1995: ['TOR','MEM'],
        2002: { add: ['NOP'], remove: ['CHA'] },
        2004: ['CHA']
      }
    },
    1996: {
      startActive: ['ATL','BKN','BOS','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'],
      expansions: { 2002: { add: ['NOP'], remove: ['CHA'] }, 2004: ['CHA'] }
    },
    2003: {
      startActive: ['ATL','BKN','BOS','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'],
      expansions: { 2004: ['CHA'] }
    }
  };
  var ERA_RELOCATIONS = { '1984': { CHA: 'NOP' }, '1996': { CHA: 'NOP' }, '2003': {} };

  var _eraLoadPromises = {};
  var _photoLoadPromise = null;
  var _photoCompactIndex = null;
  var _draftDepsPromise = null;
  var _leagueDepsPromise = null;

  var _eraLoaded = {};
  var ERA_MIRRORS = location.hostname.indexOf('github.io') >= 0
    ? ['https://cdn.jsdelivr.net/gh/dhsa33/perfect-player@main/',
       'https://fastly.jsdelivr.net/gh/dhsa33/perfect-player@main/']
    : [];
  var _eraMirrorDead = {};

  function eraFetchExec(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var ctrl = ('AbortController' in self) ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error('timeout: ' + url));
      }, timeoutMs || 8000);
      fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status + ': ' + url);
        return r.text();
      }).then(function (code) {
        clearTimeout(timer);
        (0, eval)(code);
        resolve(true);
      }).catch(function (err) {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function loadScriptOnce(src) {
    if (_eraLoaded[src]) return Promise.resolve(true);
    var path = src.replace(/^https?:\/\/[^/]+\//, '');
    var candidates = [];
    ERA_MIRRORS.forEach(function (m) { if (!_eraMirrorDead[m]) candidates.push(m + path); });
    candidates.push(src);
    return (async function () {
      for (var i = 0; i < candidates.length; i++) {
        var isMirror = i < candidates.length - 1;
        try {
          await eraFetchExec(candidates[i], isMirror ? 3500 : 12000);
          _eraLoaded[src] = true;
          return true;
        } catch (e) {
          if (isMirror) _eraMirrorDead[candidates[i].slice(0, candidates[i].indexOf(path))] = true;
        }
      }
      throw new Error('failed: ' + src);
    })();
  }

  function loadEraDraftDeps() {
    if (typeof HISTORICAL_DRAFT_CLASSES !== 'undefined' && typeof applyEraDraftClassNoSalary === 'function') {
      return Promise.resolve(true);
    }
    if (_draftDepsPromise) return _draftDepsPromise;
    _draftDepsPromise = Promise.all([
      loadScriptOnce('assets/js/hupu/legend-era/era-config.min.js?v=20260824-era-draft'),
      loadScriptOnce('assets/js/hupu/legend-era/draft-classes.min.js?v=20260824-era-draft'),
      loadScriptOnce('assets/js/perfect-player-era-draft.min.js?v=20260824-hupu-era-local-v1')
    ]).then(function () { return true; });
    return _draftDepsPromise;
  }

  /** 联盟结构模块：真实分区/东西部年表 + 扩军真实名单（era-rosters 及其数据依赖） */
  function loadEraLeagueDeps() {
    if (typeof getEraConferenceOf === 'function' && typeof buildEraTeamRoster === 'function') {
      return Promise.resolve(true);
    }
    if (_leagueDepsPromise) return _leagueDepsPromise;
    _leagueDepsPromise = Promise.all([
      loadScriptOnce('assets/js/hupu/legend-era/historical-players.min.js?v=20260824-era-align-v1'),
      loadScriptOnce('assets/js/hupu/legend-era/era-bench-pools.min.js?v=20260824-era-align-v1'),
      loadScriptOnce('assets/js/hupu/legend-era/era-historical-births.min.js?v=20260824-era-align-v1'),
      loadScriptOnce('assets/js/hupu/legend-era/era-rosters.min.js?v=20260824-era-align-v1')
    ]).then(function () { return true; });
    return _leagueDepsPromise;
  }

  // ── 历史时代中文队名/城市名（按年份切换；队徽缺资源暂用现代图标） ──
  var ERA_TEAM_NAME_OVERRIDES = {
    BKN: [{ to: 2012, name: '篮网', city: '新泽西' }],
    LAC: [{ to: 1984, name: '快船', city: '圣地亚哥' }],
    SAC: [{ to: 1985, name: '国王', city: '堪萨斯城' }],
    OKC: [{ to: 2008, name: '超音速', city: '西雅图' }],
    WAS: [{ to: 1997, name: '子弹', city: '华盛顿' }],
    MEM: [{ to: 2001, name: '灰熊', city: '温哥华' }],
    CHA: [{ from: 2004, to: 2014, name: '山猫', city: '夏洛特' }],
    NOP: [{ to: 2013, name: '黄蜂', city: '新奥尔良' }]
  };
  var _origTeamCity = null;

  function eraCurrentYear() {
    if (!STATE || STATE.draftMode !== 'historical' || !STATE.eraStart) return null;
    return (parseInt(STATE.eraStart, 10) || 0) + ((STATE.career && STATE.career.seasonCount) || 0);
  }

  function resolveEraTeamDisplay(team, year) {
    var list = ERA_TEAM_NAME_OVERRIDES[String(team || '')];
    if (!list || !list.length) return null;
    var yr = year != null ? parseInt(year, 10) : eraCurrentYear();
    if (yr == null || !isFinite(yr)) return null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if ((e.from == null || yr >= e.from) && (e.to == null || yr <= e.to)) return e;
    }
    return null;
  }

  /** 历史时代显示名（无匹配返回 null，交给现代名兜底） */
  function getEraTeamDisplayName(team, year) {
    var d = resolveEraTeamDisplay(team, year);
    return d ? d.name : null;
  }

  /** TEAM_CITY 被大量 UI 直接下标读取，按赛季年原地覆写；退出历史模式时还原 */
  function applyEraCityOverrides() {
    if (typeof window === 'undefined' || !window.TEAM_CITY) return;
    if (!_origTeamCity) _origTeamCity = Object.assign({}, window.TEAM_CITY);
    var yr = eraCurrentYear();
    Object.keys(ERA_TEAM_NAME_OVERRIDES).forEach(function (code) {
      window.TEAM_CITY[code] = _origTeamCity[code] || window.TEAM_CITY[code] || '';
      var d = resolveEraTeamDisplay(code, yr);
      if (d && d.city) window.TEAM_CITY[code] = d.city;
    });
  }

  function restoreEraCityOverrides() {
    if (_origTeamCity && typeof window !== 'undefined' && window.TEAM_CITY) {
      Object.assign(window.TEAM_CITY, _origTeamCity);
    }
  }

  function getLegendEraStaticPack(era) {
    era = String(era || '');
    if (window.LEGEND_ERA_STATIC_PACKS && window.LEGEND_ERA_STATIC_PACKS[era]) {
      return window.LEGEND_ERA_STATIC_PACKS[era];
    }
    if (era === '1984') return window.LEGEND_ERA_1984_STATIC || null;
    if (era === '1996') return window.LEGEND_ERA_1996_STATIC || null;
    if (era === '2003') return window.LEGEND_ERA_2003_STATIC || null;
    return null;
  }

  function loadEraStaticPack(era) {
    era = String(era || '');
    var cached = getLegendEraStaticPack(era);
    if (cached) {
      return loadEraDraftDeps().catch(function () { return null; })
        .then(function () { return loadEraLeagueDeps().catch(function () { return null; }); })
        .then(function () { return cached; });
    }
    if (_eraLoadPromises[era]) return _eraLoadPromises[era];

    var src = ERA_STATIC_SCRIPTS[era];
    if (!src) return Promise.reject(new Error('unknown era: ' + era));

    _eraLoadPromises[era] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src + '?v=20260824-era-local';
      s.async = true;
      s.onload = function () {
        var pack = getLegendEraStaticPack(era);
        if (pack) resolve(pack);
        else reject(new Error('era pack loaded but empty: ' + era));
      };
      s.onerror = function () { reject(new Error('failed to load era pack: ' + era)); };
      document.head.appendChild(s);
    }).then(function (pack) {
      return loadEraDraftDeps().catch(function () { return null; })
        .then(function () { return loadEraLeagueDeps().catch(function () { return null; }); })
        .then(function () { return pack; });
    });
    return _eraLoadPromises[era];
  }

  function compactPhotoKey(value) {
    var text = String(value || '').trim();
    if (!text) return '';
    if (typeof text.normalize === 'function') text = text.normalize('NFKD');
    text = text.replace(/[\u0300-\u036f]/g, '');
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function normalizeHupuPlayerLookupKey(value) {
    var text = String(value || '').trim();
    if (!text) return '';
    if (typeof text.normalize === 'function') text = text.normalize('NFKD');
    text = text.replace(/[\u0300-\u036f]/g, '');
    text = text.replace(/[^0-9A-Za-z\u3400-\u4DBF\u4E00-\u9FFF]+/g, ' ');
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function getPhotoCompactIndex() {
    if (_photoCompactIndex) return _photoCompactIndex;
    _photoCompactIndex = {};
    var pack = window.HUPU_PLAYER_PHOTOS;
    if (!pack || !pack.lookup) return _photoCompactIndex;
    Object.keys(pack.lookup).forEach(function (key) {
      var compact = compactPhotoKey(key);
      if (!compact) return;
      if (!_photoCompactIndex[compact]) _photoCompactIndex[compact] = pack.lookup[key];
    });
    return _photoCompactIndex;
  }

  function compactPhotoKeyVariants(value) {
    var text = String(value || '').trim();
    if (!text) return [];
    var keys = [];
    function push(k) {
      if (k && keys.indexOf(k) < 0) keys.push(k);
    }
    push(compactPhotoKey(text));
    // Joe C. Meriweather → Joe Meriweather（去掉中间单字母缩写）
    var parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
      var filtered = parts.filter(function (p) {
        return p.replace(/\./g, '').length > 1;
      });
      if (filtered.length >= 2 && filtered.length < parts.length) {
        push(compactPhotoKey(filtered.join(' ')));
      }
    }
    return keys;
  }

  function getHupuPlayerPhotoRecord(playerName) {
    var pack = window.HUPU_PLAYER_PHOTOS;
    if (!pack || !pack.lookup) return null;
    var rawNames = [];
    if (playerName && typeof playerName === 'object') {
      rawNames.push(playerName.nameEN, playerName.nameEn, playerName.cname, playerName.name);
    } else {
      rawNames.push(playerName);
    }
    var compactIndex = getPhotoCompactIndex();
    for (var ni = 0; ni < rawNames.length; ni++) {
      var rawName = String(rawNames[ni] || '').trim();
      if (!rawName) continue;
      var candidates = [
        rawName,
        rawName.toLowerCase(),
        normalizeHupuPlayerLookupKey(rawName)
      ];
      for (var i = 0; i < candidates.length; i++) {
        var key = candidates[i];
        if (key && pack.lookup[key]) return pack.lookup[key];
      }
      var compactKeys = compactPhotoKeyVariants(rawName);
      for (var ci = 0; ci < compactKeys.length; ci++) {
        if (compactIndex[compactKeys[ci]]) return compactIndex[compactKeys[ci]];
      }
    }
    return null;
  }

  function getHupuPlayerPhotoUrl(playerName) {
    var record = getHupuPlayerPhotoRecord(playerName);
    var url = (record && (record.b || record.p)) || '';
    if (url.indexOf('http://') === 0) url = 'https://' + url.slice(7);
    return url;
  }

  function loadHupuPlayerPhotos() {
    if (window.HUPU_PLAYER_PHOTOS && window.HUPU_PLAYER_PHOTOS.lookup) {
      return Promise.resolve(window.HUPU_PLAYER_PHOTOS);
    }
    if (_photoLoadPromise) return _photoLoadPromise;
    _photoLoadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'assets/js/hupu/legend-era/hupu-player-photos.min.js?v=20260824-era-photos';
      s.async = true;
      s.onload = function () {
        _photoCompactIndex = null;
        if (window.HUPU_PLAYER_PHOTOS && window.HUPU_PLAYER_PHOTOS.lookup) resolve(window.HUPU_PLAYER_PHOTOS);
        else reject(new Error('hupu player photos empty'));
      };
      s.onerror = function () { reject(new Error('failed to load hupu player photos')); };
      document.head.appendChild(s);
    });
    return _photoLoadPromise;
  }

  function hupuEraLocalPhotoPath(player, remoteUrl) {
    var raw = '';
    if (player && typeof player === 'object') {
      raw = player.nameEN || player.nameEn || player.cname || player.name || '';
    } else {
      raw = String(player || '');
    }
    var key = compactPhotoKey(raw);
    if (!key) return '';
    var ext = '.jpg';
    if (remoteUrl) {
      var clean = String(remoteUrl).split('?')[0].toLowerCase();
      if (clean.indexOf('.png') >= 0) ext = '.png';
      else if (clean.indexOf('.webp') >= 0) ext = '.webp';
      else if (clean.indexOf('.gif') >= 0) ext = '.gif';
    }
    return 'assets/images/Player/hupu-era/' + key + ext;
  }

  function attachEraPlayerPhotos() {
    if (typeof NBA2K_TEAMS === 'undefined' || typeof NBA2K_DATA === 'undefined') return 0;
    var attached = 0;
    NBA2K_TEAMS.forEach(function (team) {
      (NBA2K_DATA[team] || []).forEach(function (player) {
        if (!player) return;
        var url = player.photoUrl || getHupuPlayerPhotoUrl(player);
        if (!url) return;
        if (url.indexOf('http://') === 0) url = 'https://' + url.slice(7);
        player.photoUrl = url;
        player._photoUrl = url;
        if (!player.photoLocal && !player._photoLocal) {
          var localPath = hupuEraLocalPhotoPath(player, url);
          if (localPath) {
            player.photoLocal = localPath;
            player._photoLocal = localPath;
          }
        }
        player.photoSource = player.photoSource || 'hupu-player-photos';
        attached += 1;
      });
    });
    return attached;
  }

  function getEraActiveTeams(era, seasonCount) {
    var ev = ERA_TEAM_EVOLUTION[String(era)];
    if (!ev || !ev.startActive) return [];
    var active = ev.startActive.slice();
    var yr = (parseInt(era, 10) || 0) + (parseInt(seasonCount, 10) || 0);
    Object.keys(ev.expansions || {}).forEach(function (y) {
      if (parseInt(y, 10) > yr) return;
      var entry = ev.expansions[y] || [];
      var adds = Array.isArray(entry) ? entry : (entry.add || []);
      var rems = Array.isArray(entry) ? [] : (entry.remove || []);
      adds.forEach(function (t) { if (active.indexOf(t) < 0) active.push(t); });
      rems.forEach(function (t) {
        var ix = active.indexOf(t);
        if (ix >= 0) active.splice(ix, 1);
      });
    });
    return active;
  }

  function fillExpansionRoster(team) {
    if (!team || typeof NBA2K_DATA === 'undefined') return;
    var roster = NBA2K_DATA[team] || [];
    if (roster.length >= 12) {
      NBA2K_DATA[team] = roster;
      return;
    }
    var donors = (typeof NBA2K_TEAMS !== 'undefined' ? NBA2K_TEAMS : []).filter(function (t) {
      return t !== team && (NBA2K_DATA[t] || []).length > 10;
    });
    donors.forEach(function (t) {
      if (roster.length >= 14) return;
      var pool = (NBA2K_DATA[t] || []).filter(function (p) {
        if (!p || p._isUser) return false;
        var ov = parseInt(p.ovr, 10) || 0;
        return ov > 0 && ov < 80;
      });
      pool.sort(function (a, b) { return (parseInt(a.ovr, 10) || 0) - (parseInt(b.ovr, 10) || 0); });
      if (!pool.length || (NBA2K_DATA[t] || []).length <= 10) return;
      var pick = pool[0];
      NBA2K_DATA[t] = (NBA2K_DATA[t] || []).filter(function (p) { return p !== pick; });
      roster.push(pick);
    });
    var incomingYear = (parseInt(STATE.eraStart, 10) || 1984) + ((STATE.career && STATE.career.seasonCount) || 0);
    while (roster.length < 14 && typeof generateRookie === 'function') {
      var rk = generateRookie({ useStarQueue: false });
      if (!rk) break;
      rk._eraRoster = true;
      rk._enterYear = incomingYear;
      roster.push(rk);
    }
    NBA2K_DATA[team] = roster;
  }

  /** 休赛期：新队入盟 / 黄蜂迁新奥尔良。seasonCount 在存档刚结束的赛季后已自增。 */
  function syncLeagueEvolution() {
    if (!STATE || STATE.draftMode !== 'historical' || !STATE.eraStart) return null;
    if (typeof NBA2K_DATA === 'undefined' || typeof NBA2K_TEAMS === 'undefined') return null;
    var era = String(STATE.eraStart);
    var sc = (STATE.career && STATE.career.seasonCount) || 0;
    var now = getEraActiveTeams(era, sc);
    if (!now.length) return null;
    var prev = sc > 0 ? getEraActiveTeams(era, sc - 1) : now.slice();
    var newcomers = now.filter(function (t) { return prev.indexOf(t) < 0; });
    var removed = prev.filter(function (t) { return now.indexOf(t) < 0; });
    var yr = (parseInt(era, 10) || 0) + sc;
    if (!STATE._leagueChanges) STATE._leagueChanges = {};
    STATE._leagueChanges.expansion = (STATE._leagueChanges.expansion || []).filter(function (e) { return e && e.year === yr; });
    STATE._leagueChanges.relocations = (STATE._leagueChanges.relocations || []).filter(function (r) { return r && r.year === yr; });

    var relocMap = ERA_RELOCATIONS[era] || {};
    var relocatedDest = {};
    removed.forEach(function (rt) {
      var dest = relocMap[rt];
      if (!dest) return;
      var oldRoster = NBA2K_DATA[rt] || [];
      NBA2K_DATA[dest] = (NBA2K_DATA[dest] || []).concat(oldRoster);
      NBA2K_DATA[rt] = [];
      relocatedDest[dest] = true;
      var userMoving = STATE.careerTeam === rt;
      if (userMoving) STATE.careerTeam = dest;
      if (!STATE._leagueChanges.relocations) STATE._leagueChanges.relocations = [];
      var dup = STATE._leagueChanges.relocations.some(function (r) { return r.from === rt && r.year === yr; });
      if (!dup) {
        STATE._leagueChanges.relocations.push({ from: rt, to: dest, year: yr, userInvolved: userMoving });
      }
    });

    newcomers.forEach(function (t) {
      if (relocatedDest[t] && (NBA2K_DATA[t] || []).length) {
        /* 迁址继承原队名单，不再扩张选秀 */
      } else if (typeof buildEraTeamRoster === 'function') {
        /* 扩军用时代真实名单池（核心+替补池+角色球员，无假人）；失败再退回旧逻辑 */
        try { buildEraTeamRoster(String(STATE.eraStart), t); }
        catch (e) { fillExpansionRoster(t); }
      } else {
        fillExpansionRoster(t);
      }
      if (!STATE._leagueChanges.expansion) STATE._leagueChanges.expansion = [];
      var dupExp = STATE._leagueChanges.expansion.some(function (e) { return e && e.team === t && e.year === yr; });
      if (!dupExp) STATE._leagueChanges.expansion.push({ team: t, year: yr });
    });

    NBA2K_TEAMS.forEach(function (t) {
      if (now.indexOf(t) < 0) NBA2K_DATA[t] = [];
    });
    if (typeof clearLineupCache === 'function') {
      try { clearLineupCache(); } catch (e) {}
    }
    applyEraCityOverrides();
    return { newcomers: newcomers, removed: removed, year: yr, active: now };
  }

  function applyEraRosterPack(era) {
    if (typeof restoreBaseLeagueRoster === 'function') restoreBaseLeagueRoster();
    var pack = getLegendEraStaticPack(era);
    if (!pack || !pack.rosters || typeof NBA2K_DATA === 'undefined' || typeof NBA2K_TEAMS === 'undefined') {
      return false;
    }

    era = String(era);
    STATE.mode = 'historical';
    STATE.draftMode = 'historical';
    STATE.eraStart = parseInt(era, 10);

    var sc0 = (STATE.career && STATE.career.seasonCount) || 0;
    var active = getEraActiveTeams(era, sc0);
    if (!active.length) active = pack.activeTeams || [];
    NBA2K_TEAMS.forEach(function (t) {
      if (active.indexOf(t) >= 0 && pack.rosters[t]) {
        NBA2K_DATA[t] = cloneLeagueData(pack.rosters[t]);
        if (typeof eraPlayerAgeByDraft === 'function') {
          (NBA2K_DATA[t] || []).forEach(function (p) {
            if (!p || p._isUser) return;
            var correctAge = eraPlayerAgeByDraft(era, p.nameEN || p.name || '');
            if (correctAge == null && (parseInt(p.ovr, 10) || 0) >= 80) correctAge = 28;
            if (correctAge != null && Math.abs((p._age || correctAge) - correctAge) > 1) {
              p._age = correctAge;
            }
          });
        }
      } else {
        NBA2K_DATA[t] = [];
      }
    });
    window.__PP_ERA_PACK__ = pack;
    delete NBA2K_DATA._draftClass2026Applied;
    if (typeof clearLineupCache === 'function') clearLineupCache();
    attachEraPlayerPhotos();
    if (typeof applyEraDraftClassNoSalary === 'function') {
      try { applyEraDraftClassNoSalary(era); } catch (e) {}
    }
    attachEraPlayerPhotos();
    applyEraCityOverrides();
    return true;
  }

  function restoreCurrentLeagueMode() {
    STATE.mode = 'current';
    STATE.draftMode = 'current';
    delete STATE.eraStart;
    restoreEraCityOverrides();
    try { delete window.__PP_ERA_PACK__; } catch (e) { window.__PP_ERA_PACK__ = null; }
    if (typeof restoreBaseLeagueRoster === 'function') restoreBaseLeagueRoster();
    if (typeof applyDraftClass2026 === 'function') applyDraftClass2026();
    if (typeof clearLineupCache === 'function') clearLineupCache();
  }

  function showEraSelectModal() {
    return new Promise(function (resolve) {
      var existing = document.getElementById('era-select-modal');
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.className = 'team-picker-overlay';
      overlay.id = 'era-select-modal';
      overlay.innerHTML =
        '<div class="team-picker-modal">' +
          '<div class="team-picker-header"><span>📅 选择开局年代</span></div>' +
          '<div style="padding:16px 12px 8px;display:flex;flex-direction:column;gap:14px;">' +
            CAREER_START_YEARS.map(function (e) {
              return '<button type="button" class="btn btn-primary btn-sm era-pick-btn" data-era="' + e + '" style="width:100%;">' +
                ERA_LABELS[e] + '</button>';
            }).join('') +
          '</div>' +
          '<div style="padding:0 12px 14px;text-align:center;">' +
            '<button type="button" class="btn btn-secondary btn-sm" id="era-select-cancel" style="max-width:160px;">取消</button>' +
          '</div>' +
        '</div>';

      function close(result) {
        overlay.remove();
        resolve(result);
      }

      overlay.querySelector('#era-select-cancel').onclick = function () { close(null); };
      overlay.querySelectorAll('.era-pick-btn').forEach(function (btn) {
        btn.onclick = function () { close(btn.getAttribute('data-era')); };
      });
      document.body.appendChild(overlay);
    });
  }

  async function applyHistoricalEraYear(era) {
    var loading = document.createElement('div');
    loading.className = 'team-picker-overlay';
    loading.id = 'era-loading-overlay';
    loading.innerHTML =
      '<div class="team-picker-modal" style="text-align:center;padding:28px 20px;">' +
        '<div style="font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:8px;">加载 ' + (ERA_LABELS[era] || era) + '</div>' +
        '<div style="font-size:12px;color:var(--text-dim);">正在读取时代名单、新秀与头像…</div>' +
      '</div>';
    document.body.appendChild(loading);

    try {
      await Promise.all([
        loadEraStaticPack(era),
        loadHupuPlayerPhotos().catch(function () { return null; }),
        loadEraDraftDeps().catch(function (e) {
          try { console.warn('[era-mode] draft deps', e); } catch (err) {}
          return null;
        })
      ]);
      if (!applyEraRosterPack(era)) throw new Error('apply era roster failed');
      return true;
    } catch (err) {
      try { console.error('[era-mode]', err); } catch (e) {}
      alert('时代名单加载失败，请刷新后重试。');
      restoreCurrentLeagueMode();
      return false;
    } finally {
      var el = document.getElementById('era-loading-overlay');
      if (el) el.remove();
    }
  }

  /** 生涯统一入口：选 1984 / 1996 / 2003 / 2026 */
  async function enterCareerWithYearSelect() {
    var year = await showEraSelectModal();
    if (!year) return false;
    if (year === '2026') {
      restoreCurrentLeagueMode();
      return true;
    }
    return applyHistoricalEraYear(year);
  }

  async function enterHistoricalEraMode() {
    return enterCareerWithYearSelect();
  }

  function rosterReady(team) {
    return team && ((NBA2K_DATA[team] || []).length > 0);
  }

  function scheduleTablePlayable(table) {
    if (!table) return false;
    var teams = Object.keys(table);
    if (!teams.length) return false;
    for (var i = 0; i < teams.length; i++) {
      var team = teams[i];
      if (!rosterReady(team)) return false;
      var games = table[team] || [];
      for (var j = 0; j < games.length; j++) {
        if (!rosterReady(games[j] && games[j].opponent)) return false;
      }
    }
    return true;
  }

  /** 虎扑静态包按扩军年份存了多份赛程；只用当前赛季名单齐全的那份。 */
  function getScheduleTable() {
    if (!window.PP_ERA_MODE.isHistoricalActive()) return null;
    var pack = window.__PP_ERA_PACK__ || getLegendEraStaticPack(STATE.eraStart);
    if (!pack) return null;
    var sc = (STATE.career && STATE.career.seasonCount) || 0;
    var candidates = [];
    if (pack.schedule) candidates.push({ sc: 0, table: pack.schedule });
    var schedules = pack.schedules || {};
    Object.keys(schedules).forEach(function (k) {
      var n = parseInt(k, 10);
      if (!isFinite(n) || n > sc) return;
      var snap = schedules[k];
      if (snap && snap.schedule) candidates.push({ sc: n, table: snap.schedule });
    });
    candidates.sort(function (a, b) { return b.sc - a.sc; });
    for (var i = 0; i < candidates.length; i++) {
      if (scheduleTablePlayable(candidates[i].table)) return candidates[i].table;
    }
    return pack.schedule || null;
  }

  window.PP_ERA_MODE = {
    getLegendEraStaticPack: getLegendEraStaticPack,
    loadEraStaticPack: loadEraStaticPack,
    applyEraRosterPack: applyEraRosterPack,
    restoreCurrentLeagueMode: restoreCurrentLeagueMode,
    enterCareerWithYearSelect: enterCareerWithYearSelect,
    enterHistoricalEraMode: enterHistoricalEraMode,
    hupuEraLocalPhotoPath: hupuEraLocalPhotoPath,
    attachEraPlayerPhotos: attachEraPlayerPhotos,
    getScheduleTable: getScheduleTable,
    getEraActiveTeams: getEraActiveTeams,
    syncLeagueEvolution: syncLeagueEvolution,
    getEraTeamDisplayName: getEraTeamDisplayName,
    applyEraCityOverrides: applyEraCityOverrides,
    restoreEraCityOverrides: restoreEraCityOverrides,
    isHistoricalActive: function () {
      return !!(STATE && STATE.draftMode === 'historical' && STATE.eraStart);
    },
    /** 建球员老虎机：历史模式只从有名单的球队里抽 */
    getSpinTeams: function () {
      if (typeof NBA2K_TEAMS === 'undefined') return [];
      if (!window.PP_ERA_MODE.isHistoricalActive()) return NBA2K_TEAMS.slice();
      return getEraActiveTeams(String(STATE.eraStart), (STATE.career && STATE.career.seasonCount) || 0).filter(function (t) {
        return (NBA2K_DATA[t] || []).length > 0;
      });
    }
  };

  window.getHupuPlayerPhotoUrl = getHupuPlayerPhotoUrl;
  window.hupuEraLocalPhotoPath = hupuEraLocalPhotoPath;
  window.getEraTeamDisplayName = getEraTeamDisplayName;

  // 页面加载后先快照现役名单，便于来回切换
  function bootCapture() {
    if (typeof captureBaseLeagueRoster === 'function') captureBaseLeagueRoster();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCapture);
  } else {
    bootCapture();
  }
})();
