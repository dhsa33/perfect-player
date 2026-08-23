/* 全明星周末 — 名单、队长、选秀、正赛 */
(function () {
  'use strict';

  var AS_OF_GAME = 55;
  var MAX_PER_NBA_TEAM = 4;
  var DRAFT_PICKS = 11;
  var STARTER_POS = ['PG', 'SG', 'SF', 'PF', 'C'];
  var BENCH_SIZE = 7;
  var POS_LABEL = { PG: '控卫', SG: '分卫', SF: '小前', PF: '大前', C: '中锋' };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function n(v, fb) {
    var x = Number(v);
    return Number.isFinite(x) ? x : (fb == null ? 0 : fb);
  }

  function rand() {
    return Math.random();
  }

  function engine() {
    return window.PERFECT_PLAYER_AWARD_ENGINE;
  }

  function popularityCoeff() {
    var profile = typeof getCareerProfile === 'function' ? getCareerProfile() : {};
    var pop = (n(profile.fame) + n(profile.fanSupport)) / 2;
    return clamp(0.95, 1.05, 1 + (pop - 5) * 0.01);
  }

  function conferenceOf(team) {
    return typeof getConference === 'function' ? getConference(team) : 'WEST';
  }

  function captainMvpScore(candidate, popMul) {
    var mvp = n(candidate._awardScores && candidate._awardScores.mvp);
    if (candidate.isUser) mvp *= popMul;
    return mvp;
  }

  function electCaptain(conference, roster12, userConference, seasonKey) {
    var top3 = roster12.slice(0, 3);
    if (!top3.length) return { method: 'empty', captain: null };

    function lotteryPick() {
      var r = engine().hash01(seasonKey + '|allstar-captain|' + conference);
      if (r < 0.6) return top3[0];
      if (r < 0.9) return top3[1] || top3[0];
      return top3[2] || top3[top3.length - 1];
    }

    if (userConference && conference === userConference) {
      var user = roster12.filter(function (c) { return c && c.isUser; })[0];
      if (user) {
        var pop = popularityCoeff();
        var ranked = roster12.map(function (c) {
          return { c: c, score: captainMvpScore(c, c.isUser ? pop : 1) };
        }).sort(function (a, b) {
          return b.score - a.score || (a.c.key || '').localeCompare(b.c.key || '');
        });
        if (ranked[0] && ranked[0].c.isUser) {
          return { method: 'mvp_pop', captain: user, popCoeff: pop };
        }
      }
      var lot = lotteryPick();
      return { method: 'lottery', captain: lot };
    }

    return { method: 'lottery', captain: lotteryPick() };
  }

  function syncAllStarAwardRecord(pack) {
    if (!pack || !STATE.season) return;
    var eng = engine();
    var record = eng && eng.allStarRecordFromPack ? eng.allStarRecordFromPack(pack) : null;
    if (!record) return;
    var awards = STATE.season.awards || [];
    var i, found = false;
    for (i = 0; i < awards.length; i++) {
      if (awards[i] && awards[i].act === 'allStar') {
        awards[i] = record;
        found = true;
        break;
      }
    }
    if (!found) awards.push(record);
    STATE.season.awards = awards;
  }

  function maybePushSeasonHonor() {
    if (!packUserSelected(STATE.season.allStar)) return;
    var c = STATE.career;
    if (!c) return;
    c.honors = c.honors || [];
    var sn = n(c.seasonCount, 0) + 1;
    var dup = c.honors.some(function (h) {
      return n(h.seasonNum) === sn && String(h.label || '').indexOf('全明星') >= 0;
    });
    if (!dup) {
      c.honors.push({ seasonNum: sn, label: '全明星', emoji: '⭐' });
    }
  }

  function packUserSelected(pack) {
    return pack && pack.userMeta && pack.userMeta.selected;
  }

  function playerId(p) {
    if (!p) return '';
    if (p._isUser) return '__USER__';
    return String(p.key || p.nameEN || p.name || p.cname || '').toLowerCase();
  }

  function slimId(slim) {
    if (!slim) return '';
    return slim.isUser ? '__USER__' : String(slim.key || slim.nameEN || slim.name || '').toLowerCase();
  }

  function slimFromLive(p) {
    if (!p) return null;
    if (p._isUser) {
      return {
        key: '__USER__',
        name: p.cname || p.name || '你',
        nameEN: '',
        team: STATE.careerTeam || '',
        pos: p.pos || STATE.position || 'SF',
        isUser: true
      };
    }
    return {
      key: p._asKey || p.key || ('player:' + String(p.nameEN || p.name || '').toLowerCase()),
      name: p.cname || p.name || p.nameEN || '',
      nameEN: p.nameEN || p.name || '',
      team: p._nbaTeam || p.team || '',
      pos: p.pos || 'SF',
      isUser: false,
      allStarScore: p._allStarScore,
      mvpScore: p._mvpScore,
      ovr: n(p.ovr, 75)
    };
  }

  function buildUserLivePlayer() {
    var name = typeof getHupuDisplayName === 'function' ? getHupuDisplayName() : '你';
    var ovr = Math.max(60, parseInt(STATE.finalOVR, 10) || 75);
    var attrs = STATE.attrs || {};
    return {
      name: name,
      cname: name,
      ovr: ovr,
      pos: STATE.position || 'SF',
      FIN: attrs.FIN, MID: attrs.MID, threePT: attrs.threePT,
      PAS: attrs.PAS, REB: attrs.REB, STL: attrs.STL, BLK: attrs.BLK,
      SPD: attrs.SPD, STR: attrs.STR, JMP: attrs.JMP, HAN: attrs.HAN,
      CLU: attrs.CLU, ATH: attrs.ATH, PDEF: attrs.PDEF, IDEF: attrs.IDEF,
      _isUser: true,
      _nbaTeam: STATE.careerTeam || ''
    };
  }

  function resolveSlimToLive(slim) {
    if (!slim) return null;
    if (slim.isUser) return buildUserLivePlayer();
    var eng = engine();
    var wantKey = slimId(slim);
    var teams = window.NBA2K_TEAMS || Object.keys(window.NBA2K_DATA || {});
    for (var ti = 0; ti < teams.length; ti++) {
      var team = teams[ti];
      var list = (window.NBA2K_DATA && window.NBA2K_DATA[team]) || [];
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (!p || p._isUser) continue;
        var key = eng && eng.candidateKey ? eng.candidateKey(p, team) : ('player:' + String(p.nameEN || p.name || '').toLowerCase());
        if (key === wantKey || slim.nameEN && (p.nameEN === slim.nameEN || p.name === slim.nameEN)) {
          var live = Object.assign({}, p);
          live._nbaTeam = team;
          live._asKey = key;
          live._allStarScore = slim.allStarScore;
          live._mvpScore = slim.mvpScore;
          return live;
        }
      }
    }
    return {
      name: slim.name || slim.nameEN || '球员',
      cname: slim.name || slim.nameEN || '球员',
      nameEN: slim.nameEN || '',
      ovr: n(slim.ovr, 78),
      pos: slim.pos || 'SF',
      FIN: 70, MID: 70, threePT: 70, PAS: 70, REB: 70, STL: 70, BLK: 70,
      SPD: 70, STR: 70, JMP: 70, HAN: 70, CLU: 70, ATH: 70, PDEF: 70, IDEF: 70,
      _nbaTeam: slim.team || '',
      _asKey: wantKey
    };
  }

  function ovrOf(p) {
    return parseInt(p && (p._lineupOvr != null ? p._lineupOvr : p.ovr), 10) || 75;
  }

  function lineupFromRoster(players) {
    var POS = ['PG', 'SG', 'SF', 'PF', 'C'];
    var sorted = (players || []).slice().sort(function (a, b) { return ovrOf(b) - ovrOf(a); });
    var starters = {};
    var used = {};
    POS.forEach(function (pos) {
      var pick = null;
      for (var i = 0; i < sorted.length; i++) {
        var p = sorted[i];
        var id = playerId(p);
        if (used[id]) continue;
        if (typeof canPlayPosition === 'function' && canPlayPosition(p.pos || '', pos)) {
          pick = p;
          break;
        }
      }
      if (!pick) {
        for (var j = 0; j < sorted.length; j++) {
          var q = sorted[j];
          var id2 = playerId(q);
          if (!used[id2]) { pick = q; break; }
        }
      }
      if (pick) {
        starters[pos] = pick;
        used[playerId(pick)] = true;
      }
    });
    var bench = sorted.filter(function (p) { return !used[playerId(p)]; });
    var user = sorted.filter(function (p) { return p && p._isUser; })[0];
    var isUserStarter = !!(user && POS.some(function (k) { return starters[k] === user; }));
    return { starters: starters, bench: bench, allPlayers: players, isUserStarter: isUserStarter };
  }

  function avgPower(lineup) {
    var roster = [];
    var POS = ['PG', 'SG', 'SF', 'PF', 'C'];
    POS.forEach(function (k) { if (lineup.starters && lineup.starters[k]) roster.push(lineup.starters[k]); });
    (lineup.bench || []).forEach(function (p) { if (p) roster.push(p); });
    if (!roster.length) return { offense: 75, defense: 75, athletic: 75, clutch: 75, depth: 75 };
    var ovr = roster.reduce(function (s, p) { return s + ovrOf(p); }, 0) / roster.length;
    return {
      offense: Math.round(ovr),
      defense: Math.round(ovr * 0.98),
      athletic: Math.round(ovr),
      clutch: Math.round(ovr),
      depth: Math.round(ovr)
    };
  }

  function firstPickSide(pack) {
    var east = (pack.roster && pack.roster.EAST) || [];
    var west = (pack.roster && pack.roster.WEST) || [];
    var eastSum = east.reduce(function (s, p) { return s + n(p.mvpScore); }, 0);
    var westSum = west.reduce(function (s, p) { return s + n(p.mvpScore); }, 0);
    return eastSum >= westSum ? 'EAST' : 'WEST';
  }

  function captainLabel(captain) {
    return (captain && captain.name) ? captain.name + '队' : '全明星队';
  }

  function posLabel(slot) {
    return POS_LABEL[slot] || slot || '';
  }

  function canPlaySlot(p, slot) {
    if (!p || !slot) return false;
    if (typeof canPlayPosition === 'function') return canPlayPosition(p.pos || '', slot);
    var pos = String(p.pos || '').toUpperCase();
    return pos.indexOf(slot) >= 0 || slot === pos;
  }

  function teamRosterPlayers(roster) {
    if (!roster) return [];
    return STARTER_POS.map(function (k) { return roster.starters[k]; }).filter(Boolean).concat(roster.bench || []);
  }

  function openStarterSlots(roster) {
    return STARTER_POS.filter(function (k) { return !roster.starters[k]; });
  }

  function startersComplete(roster) {
    return openStarterSlots(roster).length === 0;
  }

  function draftPhase(state) {
    if (!startersComplete(state.rosterE) || !startersComplete(state.rosterW)) return 'starters';
    return 'bench';
  }

  function rosterForSide(state, side) {
    return side === 'EAST' ? state.rosterE : state.rosterW;
  }

  function pickStarterSlotForPlayer(p, starters) {
    var open = STARTER_POS.filter(function (k) { return !starters[k]; });
    if (!open.length) return null;
    var natural = String(p.pos || 'SF').toUpperCase();
    var best = open[0];
    var bestScore = -1e9;
    open.forEach(function (slot) {
      var score = ovrOf(p);
      if (canPlaySlot(p, slot)) score += 18;
      if (natural.indexOf(slot) >= 0 || slot === natural) score += 10;
      if (score > bestScore) {
        bestScore = score;
        best = slot;
      }
    });
    return best;
  }

  function validStarterSlotsForPlayer(p, starters) {
    return STARTER_POS.filter(function (slot) {
      return !starters[slot] && canPlaySlot(p, slot);
    });
  }

  function initTeamRoster(captain, captainSlim) {
    var starters = { PG: null, SG: null, SF: null, PF: null, C: null };
    var capSlot = pickStarterSlotForPlayer(captain, starters);
    if (capSlot) starters[capSlot] = captain;
    return { starters: starters, bench: [], captainSlim: captainSlim };
  }

  function addPickToTeam(roster, player, phase, slot) {
    if (phase === 'starters') {
      var pickSlot = slot || pickStarterSlotForPlayer(player, roster.starters);
      if (!pickSlot || roster.starters[pickSlot]) return null;
      roster.starters[pickSlot] = player;
      return { role: 'starter', slot: pickSlot };
    }
    roster.bench.push(player);
    return { role: 'bench', slot: String(player.pos || '') };
  }

  function exportTeamSlims(roster) {
    var out = [];
    STARTER_POS.forEach(function (k) {
      var p = roster.starters[k];
      if (!p) return;
      var slim = slimFromLive(p);
      slim.draftRole = 'starter';
      slim.draftSlot = k;
      slim.ovr = ovrOf(p);
      out.push(slim);
    });
    (roster.bench || []).forEach(function (p) {
      var slim = slimFromLive(p);
      slim.draftRole = 'bench';
      slim.draftSlot = String(p.pos || slim.pos || '');
      slim.ovr = ovrOf(p);
      out.push(slim);
    });
    return out;
  }

  function playerCardLabel(p, slim) {
    slim = slim || slimFromLive(p);
    var ovr = ovrOf(p) || n(slim.ovr, 75);
    var nat = slim.pos || p.pos || '';
    var team = slim.team || nbaTeamOf(p) || '';
    return {
      name: slim.name || p.cname || p.name || '',
      ovr: ovr,
      nat: nat,
      team: team,
      isUser: !!(p && p._isUser)
    };
  }

  function nbaTeamOf(p) {
    return p._nbaTeam || p.team || '';
  }

  function countNbaTeam(roster, nbaTeam) {
    if (!nbaTeam) return 0;
    return teamRosterPlayers(roster).filter(function (p) { return nbaTeamOf(p) === nbaTeam; }).length;
  }

  function aiDraftPick(remaining, slimRemaining, roster, phase) {
    var best = null;
    var bestScore = -1e9;
    var i;
    for (i = 0; i < remaining.length; i++) {
      var p = remaining[i];
      var slim = slimRemaining[i];
      var score = ovrOf(p) + n(slim && slim.allStarScore) * 0.25 + n(slim && slim.mvpScore) * 0.08 + rand() * 4;
      var t = nbaTeamOf(p) || (slim && slim.team);
      if (countNbaTeam(roster, t) >= MAX_PER_NBA_TEAM) score -= 500;
      if (phase === 'starters') {
        var slot = pickStarterSlotForPlayer(p, roster.starters);
        if (!slot) score -= 400;
        else if (canPlaySlot(p, slot)) score += 14;
      }
      if (score > bestScore) {
        bestScore = score;
        best = { p: p, slim: slim, idx: i };
      }
    }
    if (!best) return null;
    remaining.splice(best.idx, 1);
    slimRemaining.splice(best.idx, 1);
    var meta = addPickToTeam(roster, best.p, phase);
    if (!meta) return null;
    return { player: best.p, slim: best.slim, meta: meta };
  }

  function initDraftState(pack) {
    var eastCapSlim = pack.captains && pack.captains.EAST;
    var westCapSlim = pack.captains && pack.captains.WEST;
    var eastCap = resolveSlimToLive(eastCapSlim);
    var westCap = resolveSlimToLive(westCapSlim);
    var allSlim = ((pack.roster && pack.roster.EAST) || []).concat((pack.roster && pack.roster.WEST) || []);
    var remainingSlim = [];
    var remaining = [];
    allSlim.forEach(function (slim) {
      if (!slim) return;
      var id = slimId(slim);
      if (id === slimId(eastCapSlim) || id === slimId(westCapSlim)) return;
      remainingSlim.push(slim);
      remaining.push(resolveSlimToLive(slim));
    });
    return {
      rosterE: initTeamRoster(eastCap, eastCapSlim),
      rosterW: initTeamRoster(westCap, westCapSlim),
      remaining: remaining,
      remainingSlim: remainingSlim,
      first: firstPickSide(pack),
      pickIndex: 0,
      picks: [],
      userCaptainSide: (pack.userMeta && pack.userMeta.isCaptain) ? pack.userMeta.conference : null,
      eastCapSlim: eastCapSlim,
      westCapSlim: westCapSlim
    };
  }

  function pickSideForIndex(state) {
    if (state.first === 'EAST') return state.pickIndex % 2 === 0 ? 'EAST' : 'WEST';
    return state.pickIndex % 2 === 0 ? 'WEST' : 'EAST';
  }

  function draftFinished(state) {
    return state.pickIndex >= DRAFT_PICKS || state.remaining.length === 0;
  }

  function finalizeDraft(state) {
    return {
      firstPick: state.first,
      teamEast: exportTeamSlims(state.rosterE),
      teamWest: exportTeamSlims(state.rosterW),
      picks: state.picks.slice()
    };
  }

  function simulateDraft(pack) {
    var state = initDraftState(pack);
    while (!draftFinished(state)) {
      var side = pickSideForIndex(state);
      var roster = rosterForSide(state, side);
      var phase = draftPhase(state);
      var pick = aiDraftPick(state.remaining, state.remainingSlim, roster, phase);
      if (!pick) break;
      state.picks.push({ side: side, slim: pick.slim, role: pick.meta && pick.meta.role, slot: pick.meta && pick.meta.slot });
      state.pickIndex++;
    }
    return finalizeDraft(state);
  }

  function removeDraftModal() {
    var el = document.getElementById('allstar-draft-modal');
    if (el) el.remove();
  }

  function renderNeedSlots(roster) {
    var open = openStarterSlots(roster);
    if (!open.length) return '<span style="color:#1f8a4c;">首发已满</span>';
    return '缺 ' + open.map(function (s) {
      return '<span style="color:var(--orange);font-weight:700;">' + s + '</span>';
    }).join(' ');
  }

  function renderDraftRoster(title, roster) {
    var captainSlim = roster.captainSlim;
    var html = '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:11px;font-weight:800;color:var(--text);margin-bottom:4px;">' + title + '</div>';
    html += '<div style="font-size:10px;font-weight:700;color:var(--text-dim);margin-bottom:4px;">首发</div>';
    html += '<div style="font-size:10px;line-height:1.55;color:var(--text-dim);margin-bottom:6px;">';
    STARTER_POS.forEach(function (slot) {
      var p = roster.starters[slot];
      if (!p) {
        html += '<div style="opacity:.55;">' + slot + ' · <span style="color:var(--orange);">待选</span></div>';
        return;
      }
      var card = playerCardLabel(p);
      var cap = captainSlim && slimId(captainSlim) === slimId(slimFromLive(p)) ? ' 👑' : '';
      var you = card.isUser ? ' <span style="color:var(--orange);">你</span>' : '';
      html += '<div><span style="font-weight:700;color:var(--text);">' + slot + '</span> · ' + card.name
        + ' <span style="color:var(--orange);font-weight:800;">' + card.ovr + '</span>'
        + (card.nat && card.nat !== slot ? ' <span style="opacity:.75;">(' + card.nat + ')</span>' : '')
        + cap + you + '</div>';
    });
    html += '</div>';
    html += '<div style="font-size:10px;font-weight:700;color:var(--text-dim);margin-bottom:4px;">替补 ' + (roster.bench.length || 0) + '/' + BENCH_SIZE + '</div>';
    html += '<div style="font-size:10px;line-height:1.55;color:var(--text-dim);">';
    if (!roster.bench.length) {
      html += '<div style="opacity:.55;">暂无</div>';
    } else {
      roster.bench.forEach(function (p, i) {
        var card = playerCardLabel(p);
        var you = card.isUser ? ' <span style="color:var(--orange);">你</span>' : '';
        html += '<div>' + (i + 1) + '. ' + card.name + ' <span style="color:var(--orange);font-weight:800;">' + card.ovr + '</span>'
          + ' · ' + (card.nat || '—') + you + '</div>';
      });
    }
    html += '</div></div>';
    return html;
  }

  function renderDraftPoolCard(slim, p, idx, side, roster, phase, blocked) {
    var card = playerCardLabel(p, slim);
    var slots = phase === 'starters' ? validStarterSlotsForPlayer(p, roster.starters) : [];
    var slotHint = phase === 'starters' && slots.length
      ? '可落位 ' + slots.join('/') : (phase === 'bench' ? '替补' : '');
    var html = '<button type="button" class="btn btn-secondary btn-sm allstar-pick-btn" data-idx="' + idx + '"'
      + (blocked ? ' disabled' : '')
      + ' style="text-align:left;font-size:11px;padding:8px 10px;' + (blocked ? 'opacity:.45;' : '') + '">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">';
    html += '<strong style="font-size:12px;">' + card.name + (card.isUser ? ' <span style="color:var(--orange);">你</span>' : '') + '</strong>';
    html += '<span style="font-family:var(--font-display);font-size:15px;font-weight:800;color:var(--orange);">' + card.ovr + '</span>';
    html += '</div>';
    html += '<div style="color:var(--text-dim);font-size:10px;margin-top:2px;">' + card.nat + ' · ' + (card.team || '—') + '</div>';
    if (slotHint) html += '<div style="font-size:10px;color:var(--text);margin-top:3px;">' + slotHint + '</div>';
    if (blocked) html += '<div style="color:var(--orange);font-size:10px;margin-top:2px;">该NBA队已满4人</div>';
    html += '</button>';
    return html;
  }

  function draftStatusHtml(state, side, turnName, isUserTurn) {
    var phase = draftPhase(state);
    var roster = rosterForSide(state, side);
    var phaseLabel = phase === 'starters' ? '阶段一 · 挑选首发' : '阶段二 · 挑选替补';
    var need = phase === 'starters'
      ? renderNeedSlots(roster)
      : ('还需 <strong>' + (BENCH_SIZE - roster.bench.length) + '</strong> 人');
    var turn = '第 <strong>' + (state.pickIndex + 1) + '</strong> 顺位 · <strong>' + turnName + '</strong> 选人';
    if (isUserTurn) turn += ' <span style="color:var(--orange);">（轮到你了）</span>';
    else turn += '（模拟中）';
    return '<div style="margin-bottom:4px;">' + phaseLabel + '</div>'
      + '<div>' + turn + '</div>'
      + '<div style="margin-top:4px;font-size:11px;">本队' + need + '</div>';
  }

  function showDraftModal(pack, done) {
    removeDraftModal();
    var state = initDraftState(pack);
    var userCaptain = pack.userMeta && pack.userMeta.isCaptain;

    var html = '<div class="team-picker-overlay" id="allstar-draft-modal">';
    html += '<div class="team-picker-modal" style="max-width:560px;">';
    html += '<div class="team-picker-header"><span>⭐ 队长选秀</span></div>';
    html += '<div id="allstar-draft-status" style="padding:8px 14px;font-size:12px;color:var(--text-dim);line-height:1.55;"></div>';
    html += '<div id="allstar-draft-teams" style="display:flex;gap:10px;padding:0 14px 8px;"></div>';
    html += '<div id="allstar-draft-pool" style="padding:0 14px 10px;"></div>';
    html += '<div style="padding:0 14px 14px;" id="allstar-draft-actions"></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    function commitUserPick(pickIdx, slot) {
      var side = pickSideForIndex(state);
      var roster = rosterForSide(state, side);
      var phase = draftPhase(state);
      var slim = state.remainingSlim[pickIdx];
      var player = state.remaining[pickIdx];
      var meta = addPickToTeam(roster, player, phase, slot);
      if (!meta) return;
      state.remaining.splice(pickIdx, 1);
      state.remainingSlim.splice(pickIdx, 1);
      state.picks.push({ side: side, slim: slim, role: meta.role, slot: meta.slot });
      state.pickIndex++;
      state._pendingSlotPick = null;
      render();
      if (!draftFinished(state) && !(userCaptain && state.userCaptainSide === pickSideForIndex(state))) {
        setTimeout(aiStep, 280);
      }
    }

    function render() {
      var statusEl = document.getElementById('allstar-draft-status');
      var teamsEl = document.getElementById('allstar-draft-teams');
      var poolEl = document.getElementById('allstar-draft-pool');
      var actionsEl = document.getElementById('allstar-draft-actions');
      if (!statusEl || !teamsEl || !poolEl) return;

      var eastName = captainLabel(state.eastCapSlim);
      var westName = captainLabel(state.westCapSlim);
      teamsEl.innerHTML = renderDraftRoster(eastName, state.rosterE)
        + renderDraftRoster(westName, state.rosterW);

      if (draftFinished(state)) {
        statusEl.innerHTML = '选秀完成：双方各5名首发 + 7名替补（同NBA球队最多4人）。';
        poolEl.innerHTML = '';
        actionsEl.innerHTML = '<button type="button" class="btn btn-primary btn-sm" style="width:100%;" id="allstar-draft-finish">开始全明星赛</button>';
        var fin = document.getElementById('allstar-draft-finish');
        if (fin) fin.onclick = function () {
          removeDraftModal();
          var draft = finalizeDraft(state);
          pack.draft = draft;
          pack.phase = 'game';
          if (STATE.season) STATE.season.allStar = pack;
          playAllStarGame(pack, done);
        };
        return;
      }

      var side = pickSideForIndex(state);
      var turnName = side === 'EAST' ? eastName : westName;
      var isUserTurn = userCaptain && state.userCaptainSide === side;
      var phase = draftPhase(state);
      var roster = rosterForSide(state, side);
      statusEl.innerHTML = draftStatusHtml(state, side, turnName, isUserTurn);

      if (isUserTurn) {
        var poolHtml = '<div style="font-size:11px;font-weight:700;margin-bottom:6px;">可选球员（按总评）</div>';
        poolHtml += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">';
        var ranked = state.remainingSlim.map(function (slim, idx) {
          return { slim: slim, p: state.remaining[idx], idx: idx, ovr: ovrOf(state.remaining[idx]) };
        }).sort(function (a, b) { return b.ovr - a.ovr; });
        ranked.forEach(function (row) {
          var t = row.slim.team || nbaTeamOf(row.p);
          var blocked = countNbaTeam(roster, t) >= MAX_PER_NBA_TEAM;
          poolHtml += renderDraftPoolCard(row.slim, row.p, row.idx, side, roster, phase, blocked);
        });
        poolHtml += '</div>';
        if (state._pendingSlotPick != null) {
          var pend = state._pendingSlotPick;
          var pendPlayer = state.remaining[pend.idx];
          var slots = validStarterSlotsForPlayer(pendPlayer, roster.starters);
          poolHtml += '<div style="margin-top:10px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;">';
          poolHtml += '<div style="font-size:11px;font-weight:700;margin-bottom:6px;">落位 · ' + playerCardLabel(pendPlayer, pend.slim).name + '</div>';
          poolHtml += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
          slots.forEach(function (slot) {
            poolHtml += '<button type="button" class="btn btn-primary btn-sm allstar-slot-btn" data-slot="' + slot + '">' + slot + ' ' + posLabel(slot) + '</button>';
          });
          poolHtml += '<button type="button" class="btn btn-secondary btn-sm allstar-slot-cancel">取消</button>';
          poolHtml += '</div></div>';
        }
        poolEl.innerHTML = poolHtml;
        actionsEl.innerHTML = '';
        poolEl.querySelectorAll('.allstar-pick-btn').forEach(function (btn) {
          if (btn.disabled) return;
          btn.onclick = function () {
            var pickIdx = parseInt(btn.getAttribute('data-idx'), 10);
            var slim = state.remainingSlim[pickIdx];
            var player = state.remaining[pickIdx];
            if (phase === 'starters') {
              var slots = validStarterSlotsForPlayer(player, roster.starters);
              if (slots.length > 1) {
                state._pendingSlotPick = { idx: pickIdx, slim: slim };
                render();
                return;
              }
              commitUserPick(pickIdx, slots[0] || pickStarterSlotForPlayer(player, roster.starters));
            } else {
              commitUserPick(pickIdx, null);
            }
          };
        });
        poolEl.querySelectorAll('.allstar-slot-btn').forEach(function (btn) {
          btn.onclick = function () {
            if (!state._pendingSlotPick) return;
            commitUserPick(state._pendingSlotPick.idx, btn.getAttribute('data-slot'));
          };
        });
        var cancelBtn = poolEl.querySelector('.allstar-slot-cancel');
        if (cancelBtn) cancelBtn.onclick = function () {
          state._pendingSlotPick = null;
          render();
        };
      } else {
        poolEl.innerHTML = '<div style="font-size:11px;color:var(--text-dim);">剩余 ' + state.remaining.length + ' 人 · ' + (phase === 'starters' ? '补首发' : '补替补') + '…</div>';
        actionsEl.innerHTML = '';
        setTimeout(aiStep, 320);
      }
    }

    function aiStep() {
      if (draftFinished(state)) {
        render();
        return;
      }
      var side = pickSideForIndex(state);
      if (userCaptain && state.userCaptainSide === side) {
        render();
        return;
      }
      var roster = rosterForSide(state, side);
      var phase = draftPhase(state);
      var pick = aiDraftPick(state.remaining, state.remainingSlim, roster, phase);
      if (pick) {
        state.picks.push({ side: side, slim: pick.slim, role: pick.meta && pick.meta.role, slot: pick.meta && pick.meta.slot });
      }
      state.pickIndex++;
      render();
      if (!draftFinished(state) && !(userCaptain && state.userCaptainSide === pickSideForIndex(state))) {
        setTimeout(aiStep, 280);
      }
    }

    render();
  }

  function renderDraftSlimColumn(title, slims) {
    var html = '<div style="flex:1;font-size:11px;line-height:1.55;color:var(--text-dim);">';
    html += '<strong style="color:var(--text);">' + title + '</strong><br>';
    html += '<span style="font-size:10px;font-weight:700;">首发</span><br>';
    (slims || []).forEach(function (p) {
      if (!p || p.draftRole !== 'starter') return;
      html += p.draftSlot + ' · ' + (p.name || '') + ' <span style="color:var(--orange);font-weight:800;">' + n(p.ovr, '—') + '</span><br>';
    });
    html += '<span style="font-size:10px;font-weight:700;">替补</span><br>';
    (slims || []).forEach(function (p) {
      if (!p || p.draftRole !== 'bench') return;
      html += (p.name || '') + ' <span style="color:var(--orange);font-weight:800;">' + n(p.ovr, '—') + '</span> · ' + (p.draftSlot || p.pos || '') + '<br>';
    });
    html += '</div>';
    return html;
  }

  function showDraftSummaryModal(pack, done) {
    removeDraftModal();
    var draft = pack.draft;
    if (!draft) {
      if (typeof done === 'function') done();
      return;
    }
    var eastName = captainLabel(pack.captains && pack.captains.EAST);
    var westName = captainLabel(pack.captains && pack.captains.WEST);
    var html = '<div class="team-picker-overlay" id="allstar-draft-modal">';
    html += '<div class="team-picker-modal" style="max-width:520px;">';
    html += '<div class="team-picker-header"><span>⭐ 选秀完成</span></div>';
    html += '<div style="padding:8px 14px;font-size:12px;color:var(--text-dim);">先补满双方首发，再交替挑选替补。同NBA球队最多4人。</div>';
    html += '<div style="display:flex;gap:10px;padding:8px 14px;">';
    html += renderDraftSlimColumn(eastName, draft.teamEast);
    html += renderDraftSlimColumn(westName, draft.teamWest);
    html += '</div>';
    html += '<div style="padding:0 14px 14px;"><button type="button" class="btn btn-primary btn-sm" style="width:100%;" id="allstar-draft-play">观看全明星正赛</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var btn = document.getElementById('allstar-draft-play');
    if (btn) {
      btn.onclick = function () {
        removeDraftModal();
        playAllStarGame(pack, done);
      };
    }
  }

  function removeRewardModal() {
    var el = document.getElementById('allstar-reward-modal');
    if (el) el.remove();
  }

  function applyAllStarVictoryRewards(pack) {
    if (!pack || pack.rewardsApplied) return null;
    var gr = pack.gameResult;
    if (!gr || !gr.won) return null;
    pack.rewardsApplied = true;
    var rewards = { style: 0, training: 0, fame: 0 };
    if (window.PP_SKILLS && typeof PP_SKILLS.ensureSkillState === 'function') {
      var st = PP_SKILLS.ensureSkillState();
      st.points = n(st.points) + 1;
      st.earned = n(st.earned) + 1;
      rewards.style = 1;
    }
    if (typeof addEventTrainingPoints === 'function') {
      rewards.training = addEventTrainingPoints(1) || 0;
    }
    if (typeof addProfileDelta === 'function') {
      addProfileDelta('fame', 1);
      rewards.fame = 1;
    }
    pack.rewardSummary = rewards;
    if (STATE.season) STATE.season.allStar = pack;
    if (typeof autoSaveGame === 'function') autoSaveGame();
    return rewards;
  }

  function showAllStarRewardModal(pack, done) {
    removeRewardModal();
    var gr = pack.gameResult || {};
    var won = !!gr.won;
    var scoreLine = (gr.scoreA != null && gr.scoreB != null)
      ? (gr.scoreA + '-' + gr.scoreB)
      : '';
    var teamLine = (gr.teamA && gr.teamB) ? (gr.teamA + ' vs ' + gr.teamB) : '';
    var rewards = won ? applyAllStarVictoryRewards(pack) : null;

    var html = '<div class="team-picker-overlay" id="allstar-reward-modal">';
    html += '<div class="team-picker-modal" style="max-width:400px;">';
    html += '<div class="team-picker-header"><span>⭐ 全明星赛结算</span></div>';
    html += '<div style="padding:14px 14px 8px;font-size:13px;line-height:1.65;color:var(--text-dim);">';
    if (won) {
      html += '<div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:8px;">胜利！</div>';
      if (teamLine) html += '<div>' + teamLine + '</div>';
      if (scoreLine) html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--orange);margin:8px 0;">' + scoreLine + '</div>';
      html += '<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--orange-bg);border:1px solid rgba(255,107,53,.28);">';
      html += '<div style="font-size:11px;font-weight:800;color:var(--orange);margin-bottom:6px;">胜利奖励</div>';
      html += '<div style="font-size:12px;line-height:1.7;color:var(--text);">';
      if (rewards && rewards.style) html += '球风点 <strong>+1</strong><br>';
      if (rewards && rewards.fame) html += '人气 <strong>+1</strong><br>';
      if (rewards && rewards.training) {
        html += '训练点 <strong>+' + rewards.training + '</strong>';
        if (rewards.training < 1) html += '<span style="color:var(--text-dim);">（本季事件训练点已达上限）</span>';
        html += '<br>';
      } else if (won) {
        html += '训练点 <span style="color:var(--text-dim);">本季事件池已满，未计入</span><br>';
      }
      html += '</div></div>';
    } else {
      html += '<div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:8px;">比赛结束</div>';
      if (teamLine) html += '<div>' + teamLine + '</div>';
      if (scoreLine) html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:700;margin:8px 0;">' + scoreLine + '</div>';
      html += '<div style="margin-top:8px;">表演赛输赢不影响排名，本赛季全明星周末到此结束。</div>';
    }
    html += '</div>';
    html += '<div style="padding:0 14px 14px;"><button type="button" class="btn btn-primary btn-sm" style="width:100%;" id="allstar-reward-close">继续赛季</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    if (won && rewards && window.PP_FX && typeof PP_FX.toast === 'function') {
      var bits = [];
      if (rewards.style) bits.push('球风点+1');
      if (rewards.fame) bits.push('人气+1');
      if (rewards.training) bits.push('训练点+' + rewards.training);
      if (bits.length) PP_FX.toast('全明星胜利 · ' + bits.join(' · '), { gold: true, icon: '⭐', duration: 3600 });
    }

    var btn = document.getElementById('allstar-reward-close');
    if (btn) {
      btn.onclick = function () {
        removeRewardModal();
        if (typeof done === 'function') done();
      };
    }
  }

  function playAllStarGame(pack, done) {
    var draft = pack.draft;
    if (!draft || !window.PP_LIVE || typeof PP_LIVE.playTheaterWatch !== 'function') {
      pack.phase = 'done';
      if (typeof done === 'function') done();
      return;
    }
    var teamE = (draft.teamEast || []).map(resolveSlimToLive);
    var teamW = (draft.teamWest || []).map(resolveSlimToLive);
    var userInE = teamE.some(function (p) { return p && p._isUser; });
    var userInW = teamW.some(function (p) { return p && p._isUser; });
    var eastName = captainLabel(pack.captains && pack.captains.EAST);
    var westName = captainLabel(pack.captains && pack.captains.WEST);
    var lineupA, lineupB, codeA, codeB, nameA, nameB;

    if (userInE || userInW) {
      var userSideE = userInE;
      lineupA = lineupFromRoster(userSideE ? teamE : teamW);
      lineupB = lineupFromRoster(userSideE ? teamW : teamE);
      codeA = STATE.careerTeam || (userSideE ? (pack.captains.EAST && pack.captains.EAST.team) : (pack.captains.WEST && pack.captains.WEST.team)) || 'BOS';
      codeB = userSideE
        ? ((pack.captains.WEST && pack.captains.WEST.team) || 'LAL')
        : ((pack.captains.EAST && pack.captains.EAST.team) || 'BOS');
      nameA = userSideE ? eastName : westName;
      nameB = userSideE ? westName : eastName;
    } else {
      lineupA = lineupFromRoster(teamE);
      lineupB = lineupFromRoster(teamW);
      codeA = (pack.captains.EAST && pack.captains.EAST.team) || 'BOS';
      codeB = (pack.captains.WEST && pack.captains.WEST.team) || 'LAL';
      nameA = eastName;
      nameB = westName;
    }

    var powerA = avgPower(lineupA);
    var powerB = avgPower(lineupB);
  var userMins = pack.userMeta && pack.userMeta.isCaptain ? 26 : 22;

    PP_LIVE.playTheaterWatch({
      teamA: codeA,
      teamB: codeB,
      options: {
        allStarExhibition: true,
        noOT: true,
        neutralState: true,
        fatigueA: 0,
        fatigueB: 0,
        customLineupA: lineupA,
        customLineupB: lineupB,
        customPowerA: powerA,
        customPowerB: powerB,
        displayNameA: nameA,
        displayNameB: nameB,
        rosterSize: 12,
        userAllStarMins: userMins,
        quarterSec: 600,
        gameMins: 40,
        broadcastScale: 1
      }
    }, function (livePack) {
      var result = livePack && livePack.result;
      if (result) {
        pack.gameResult = {
          scoreA: result.scoreA,
          scoreB: result.scoreB,
          won: result.won,
          teamA: nameA,
          teamB: nameB
        };
      }
      pack.phase = 'done';
      if (STATE.season) STATE.season.allStar = pack;
      showAllStarRewardModal(pack, done);
    });
  }

  function runDraftFlow(pack, done) {
    pack.phase = 'draft';
    if (STATE.season) STATE.season.allStar = pack;
    var userCaptain = pack.userMeta && pack.userMeta.isCaptain;
    if (userCaptain) {
      showDraftModal(pack, done);
      return;
    }
    pack.draft = simulateDraft(pack);
    pack.phase = 'game';
    if (STATE.season) STATE.season.allStar = pack;
    showDraftSummaryModal(pack, done);
  }

  function buildWeekend(asOfGame) {
    var eng = engine();
    if (!eng || !eng.buildAllCandidatesAsOf || !eng.buildAllStarRoster) return null;
    asOfGame = n(asOfGame, AS_OF_GAME);
    var candidates = eng.buildAllCandidatesAsOf(asOfGame);
    var roster = eng.buildAllStarRoster(candidates);
    var userCand = candidates.filter(function (c) { return c && c.isUser; })[0];
    var userConf = STATE.careerTeam ? conferenceOf(STATE.careerTeam) : 'WEST';
    var seasonKey = eng.currentAwardSeasonKey ? eng.currentAwardSeasonKey() : 'allstar';

    var eastPick = electCaptain('EAST', roster.EAST, userConf, seasonKey);
    var westPick = electCaptain('WEST', roster.WEST, userConf, seasonKey);

    var selectedUser = roster.EAST.concat(roster.WEST).some(function (c) { return c && c.isUser; });
    var rank = -1;
    if (userCand) {
      var pool = userConf === 'EAST' ? roster.EAST : roster.WEST;
      rank = pool.findIndex(function (c) { return c && c.isUser; }) + 1;
    }
    var userRank = selectedUser ? '⭐ 入选' : (
      userCand && userCand.games < 40 ? '出勤不足' : (rank > 0 ? '分区第' + rank + '名' : '未入围')
    );

    function slimList(list) {
      return (list || []).map(function (c, idx) {
        return eng.slimAllStarCandidate(c, idx + 1);
      });
    }

    function slimCaptain(c, method, popCoeff) {
      if (!c) return null;
      var slim = eng.slimAllStarCandidate(c, 0);
      slim.method = method || '';
      if (popCoeff != null) slim.popCoeff = popCoeff;
      return slim;
    }

    return {
      asOfGame: asOfGame,
      locked: true,
      phase: selectedUser ? 'announce' : 'done',
      roster: {
        EAST: slimList(roster.EAST),
        WEST: slimList(roster.WEST)
      },
      captains: {
        EAST: slimCaptain(eastPick.captain, eastPick.method, eastPick.popCoeff),
        WEST: slimCaptain(westPick.captain, westPick.method, westPick.popCoeff)
      },
      userMeta: {
        selected: selectedUser,
        userRank: userRank,
        conference: userConf,
        isCaptain: !!(selectedUser && (
          (userConf === 'EAST' && eastPick.captain && eastPick.captain.isUser) ||
          (userConf === 'WEST' && westPick.captain && westPick.captain.isUser)
        )),
        popCoeff: popularityCoeff()
      }
    };
  }

  function runWeekend(asOfGame) {
    if (!STATE || !STATE.season) return null;
    if (STATE.season.allStar && STATE.season.allStar.locked) return STATE.season.allStar;
    var pack = buildWeekend(asOfGame || AS_OF_GAME);
    if (!pack) return null;
    STATE.season.allStar = pack;
    syncAllStarAwardRecord(pack);
    maybePushSeasonHonor();
    if (typeof updateAwardStreaks === 'function') updateAwardStreaks();
    return pack;
  }

  function shouldTrigger(exact) {
    if (!STATE || !STATE.season || !STATE.season.playerStats) return false;
    if (STATE.season.allStar && STATE.season.allStar.locked) return false;
    var games = n(STATE.season.playerStats.games);
    if (exact) return games === AS_OF_GAME;
    return games >= AS_OF_GAME;
  }

  function renderRosterColumn(title, list, captain) {
    var html = '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:6px;">' + title + '</div>';
    if (captain && captain.name) {
      html += '<div style="font-size:11px;color:var(--orange);margin-bottom:8px;padding:6px 8px;background:var(--orange-bg);border-radius:8px;">';
      html += '队长：<strong>' + captain.name + '</strong>';
      html += '</div>';
    }
    html += '<div style="font-size:11px;line-height:1.55;color:var(--text-dim);">';
    (list || []).forEach(function (p, i) {
      if (!p) return;
      var tag = p.isUser ? ' <span style="color:var(--orange);font-weight:700;">你</span>' : '';
      var cap = captain && captain.key === p.key ? ' 👑' : '';
      html += '<div style="padding:2px 0;">' + (i + 1) + '. ' + p.name + cap + tag + '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function showWeekendModal(done) {
    var pack = STATE.season.allStar;
    if (!pack || !pack.locked) {
      if (typeof done === 'function') done();
      return;
    }
    if (pack.phase === 'draft' || pack.phase === 'game') {
      runDraftFlow(pack, done);
      return;
    }
    if (pack.phase === 'done' && packUserSelected(pack) && !pack.draft) {
      runDraftFlow(pack, done);
      return;
    }
    if (pack.phase === 'done' && !packUserSelected(pack)) {
      if (typeof done === 'function') done();
      return;
    }

    var old = document.getElementById('allstar-weekend-modal');
    if (old) old.remove();

    var user = pack.userMeta || {};
    var scene = '第' + pack.asOfGame + '场后，联盟公布本赛季全明星24人名单。';
    if (user.selected) {
      scene += user.isCaptain
        ? '你入选全明星，并担任' + (user.conference === 'EAST' ? '东部' : '西部') + '队长。'
        : '你入选全明星。';
    } else {
      scene += '你未能入选本届全明星。';
    }

    var btnLabel = user.selected ? '进入队长选秀' : '继续赛季';
    var html = '<div class="team-picker-overlay" id="allstar-weekend-modal">';
    html += '<div class="team-picker-modal" style="max-width:520px;">';
    html += '<div class="team-picker-header"><span>⭐ 全明星周末</span></div>';
    html += '<div style="padding:12px 14px 6px;font-size:12px;color:var(--text-dim);line-height:1.6;">' + scene + '</div>';
    html += '<div style="display:flex;gap:12px;padding:8px 14px 12px;">';
    html += renderRosterColumn('东部', pack.roster && pack.roster.EAST, pack.captains && pack.captains.EAST);
    html += renderRosterColumn('西部', pack.roster && pack.roster.WEST, pack.captains && pack.captains.WEST);
    html += '</div>';
    html += '<div style="padding:0 14px 14px;"><button type="button" class="btn btn-primary btn-sm" style="width:100%;" id="allstar-weekend-close">' + btnLabel + '</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var btn = document.getElementById('allstar-weekend-close');
    if (btn) {
      btn.onclick = function () {
        var el = document.getElementById('allstar-weekend-modal');
        if (el) el.remove();
        if (!packUserSelected(pack)) {
          pack.phase = 'done';
          if (typeof done === 'function') done();
          return;
        }
        var ensureLive = function () {
          runDraftFlow(pack, done);
        };
        if (window.__PP_ensure && !window.__PP_groupsReady(['live'])) {
          window.__PP_ensure(['live']).then(ensureLive, ensureLive);
        } else {
          ensureLive();
        }
      };
    }
  }

  function maybeShowWeekend(done, options) {
    options = options || {};
    var exact = options.exact !== false;
    if (!shouldTrigger(exact)) return false;
    var run = function () {
      if (!engine()) return;
      runWeekend(AS_OF_GAME);
      showWeekendModal(done);
    };
    if (window.__PP_ensure && !window.__PP_groupsReady(['allstar'])) {
      window.__PP_ensure(['allstar']).then(run, run);
      return true;
    }
    if (!engine()) {
      if (window.__PP_ensure) {
        window.__PP_ensure(['story']).then(run, function () {});
        return true;
      }
      return false;
    }
    run();
    return true;
  }

  window.PP_ALLSTAR = {
    AS_OF_GAME: AS_OF_GAME,
    runWeekend: runWeekend,
    shouldTrigger: shouldTrigger,
    maybeShowWeekend: maybeShowWeekend,
    showWeekendModal: showWeekendModal,
    simulateDraft: simulateDraft
  };
})();
