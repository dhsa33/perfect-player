/* 全明星周末 — 名单、队长、选秀、正赛 */
(function () {
  'use strict';

  var AS_OF_GAME = 55;
  var MAX_PER_NBA_TEAM = 4;
  var DRAFT_PICKS = 11;

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

  function nbaTeamOf(p) {
    return p._nbaTeam || p.team || '';
  }

  function countNbaTeam(teamArr, nbaTeam) {
    if (!nbaTeam) return 0;
    return teamArr.filter(function (p) { return nbaTeamOf(p) === nbaTeam; }).length;
  }

  function aiDraftPick(remaining, teamArr, slimRemaining) {
    var best = null;
    var bestScore = -1e9;
  var i;
    for (i = 0; i < remaining.length; i++) {
      var p = remaining[i];
      var slim = slimRemaining[i];
      var score = ovrOf(p) + n(slim && slim.allStarScore) * 0.25 + n(slim && slim.mvpScore) * 0.08 + rand() * 4;
      var t = nbaTeamOf(p) || (slim && slim.team);
      if (countNbaTeam(teamArr, t) >= MAX_PER_NBA_TEAM) score -= 500;
      if (score > bestScore) {
        bestScore = score;
        best = { p: p, slim: slim, idx: i };
      }
    }
    if (!best) return null;
    remaining.splice(best.idx, 1);
    slimRemaining.splice(best.idx, 1);
    teamArr.push(best.p);
    return { player: best.p, slim: best.slim };
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
      teamE: [eastCap],
      teamW: [westCap],
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
      teamEast: state.teamE.map(slimFromLive),
      teamWest: state.teamW.map(slimFromLive),
      picks: state.picks.slice()
    };
  }

  function simulateDraft(pack) {
    var state = initDraftState(pack);
    while (!draftFinished(state)) {
      var side = pickSideForIndex(state);
      var team = side === 'EAST' ? state.teamE : state.teamW;
      var pick = aiDraftPick(state.remaining, team, state.remainingSlim);
      if (!pick) break;
      state.picks.push({ side: side, slim: pick.slim });
      state.pickIndex++;
    }
    return finalizeDraft(state);
  }

  function removeDraftModal() {
    var el = document.getElementById('allstar-draft-modal');
    if (el) el.remove();
  }

  function renderDraftRoster(title, players, captainSlim) {
    var html = '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:11px;font-weight:800;color:var(--text);margin-bottom:4px;">' + title + '</div>';
    html += '<div style="font-size:10px;line-height:1.5;color:var(--text-dim);">';
    players.forEach(function (p, i) {
      var slim = slimFromLive(p);
      var cap = captainSlim && slimId(captainSlim) === slimId(slim) ? ' 👑' : '';
      var you = p._isUser ? ' <span style="color:var(--orange);">你</span>' : '';
      html += '<div>' + (i + 1) + '. ' + (slim.name || '') + cap + you + '</div>';
    });
    html += '</div></div>';
    return html;
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

    function render() {
      var statusEl = document.getElementById('allstar-draft-status');
      var teamsEl = document.getElementById('allstar-draft-teams');
      var poolEl = document.getElementById('allstar-draft-pool');
      var actionsEl = document.getElementById('allstar-draft-actions');
      if (!statusEl || !teamsEl || !poolEl) return;

      var eastName = captainLabel(state.eastCapSlim);
      var westName = captainLabel(state.westCapSlim);
      teamsEl.innerHTML = renderDraftRoster(eastName, state.teamE, state.eastCapSlim)
        + renderDraftRoster(westName, state.teamW, state.westCapSlim);

      if (draftFinished(state)) {
        statusEl.textContent = '选秀完成，双方各12人出战。';
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
      statusEl.innerHTML = '第 <strong>' + (state.pickIndex + 1) + '</strong> 顺位 · ' + turnName + ' 选人'
        + (isUserTurn ? ' <span style="color:var(--orange);">（轮到你了）</span>' : '（模拟中）');

      if (isUserTurn) {
        var poolHtml = '<div style="font-size:11px;font-weight:700;margin-bottom:6px;">可选球员</div>';
        poolHtml += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">';
        state.remainingSlim.forEach(function (slim, idx) {
          var p = state.remaining[idx];
          var t = slim.team || nbaTeamOf(p);
          var blocked = countNbaTeam(side === 'EAST' ? state.teamE : state.teamW, t) >= MAX_PER_NBA_TEAM;
          poolHtml += '<button type="button" class="btn btn-secondary btn-sm allstar-pick-btn" data-idx="' + idx + '"'
            + (blocked ? ' disabled style="opacity:.45;"' : '')
            + ' style="text-align:left;font-size:11px;padding:6px 8px;">';
          poolHtml += '<div><strong>' + (slim.name || '') + '</strong></div>';
          poolHtml += '<div style="color:var(--text-dim);">' + (slim.pos || '') + ' · ' + (t || '') + '</div>';
          if (blocked) poolHtml += '<div style="color:var(--orange);font-size:10px;">该队已满4人</div>';
          poolHtml += '</button>';
        });
        poolHtml += '</div>';
        poolEl.innerHTML = poolHtml;
        actionsEl.innerHTML = '';
        var btns = poolEl.querySelectorAll('.allstar-pick-btn');
        btns.forEach(function (btn) {
          if (btn.disabled) return;
          btn.onclick = function () {
            var pickIdx = parseInt(btn.getAttribute('data-idx'), 10);
            var team = side === 'EAST' ? state.teamE : state.teamW;
            var slim = state.remainingSlim[pickIdx];
            var player = state.remaining[pickIdx];
            team.push(player);
            state.remaining.splice(pickIdx, 1);
            state.remainingSlim.splice(pickIdx, 1);
            state.picks.push({ side: side, slim: slim });
            state.pickIndex++;
            render();
            if (!draftFinished(state) && !(userCaptain && state.userCaptainSide === pickSideForIndex(state))) {
              setTimeout(aiStep, 280);
            }
          };
        });
      } else {
        poolEl.innerHTML = '<div style="font-size:11px;color:var(--text-dim);">剩余 ' + state.remaining.length + ' 人待选…</div>';
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
      var team = side === 'EAST' ? state.teamE : state.teamW;
      var pick = aiDraftPick(state.remaining, team, state.remainingSlim);
      if (pick) {
        state.picks.push({ side: side, slim: pick.slim });
      }
      state.pickIndex++;
      render();
      if (!draftFinished(state) && !(userCaptain && state.userCaptainSide === pickSideForIndex(state))) {
        setTimeout(aiStep, 280);
      }
    }

    render();
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
    html += '<div style="padding:8px 14px;font-size:12px;color:var(--text-dim);">双方队长完成交替选秀，每队12人（同NBA球队最多4人）。</div>';
    html += '<div style="display:flex;gap:10px;padding:8px 14px;">';
    html += '<div style="flex:1;font-size:11px;line-height:1.5;color:var(--text-dim);"><strong>' + eastName + '</strong><br>';
    (draft.teamEast || []).forEach(function (p, i) { html += (i + 1) + '. ' + (p.name || '') + '<br>'; });
    html += '</div>';
    html += '<div style="flex:1;font-size:11px;line-height:1.5;color:var(--text-dim);"><strong>' + westName + '</strong><br>';
    (draft.teamWest || []).forEach(function (p, i) { html += (i + 1) + '. ' + (p.name || '') + '<br>'; });
    html += '</div></div>';
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

  function beginAllStarStoryWindow() {
    if (STATE.season) STATE.season._allStarStoryActive = true;
  }

  function endAllStarStoryWindow() {
    if (STATE.season) STATE.season._allStarStoryActive = false;
  }

  function runAllStarStoryChain(done) {
    if (!packUserSelected(STATE.season && STATE.season.allStar)) {
      if (typeof done === 'function') done();
      return;
    }
    if (typeof showSeasonBranchEvent !== 'function' || typeof getBranchEventById !== 'function') {
      if (typeof done === 'function') done();
      return;
    }
    beginAllStarStoryWindow();
    var order = ['story_allstar_skills', 'story_allstar_dunk', 'story_allstar_game'];

    function nextInChain() {
      var picked = null;
      var i;
      for (i = 0; i < order.length; i++) {
        var ev = getBranchEventById(order[i]);
        if (!ev) continue;
        try {
          if (!ev.requires || ev.requires()) {
            picked = ev;
            break;
          }
        } catch (e) { /* ignore */ }
      }
      if (!picked) {
        endAllStarStoryWindow();
        if (typeof done === 'function') done();
        return;
      }
      if (typeof markSeasonEventSeen === 'function' && STATE.career) {
        markSeasonEventSeen(picked, STATE.career);
      }
      showSeasonBranchEvent(picked, nextInChain);
    }
    nextInChain();
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
    if (pack.userMeta && pack.userMeta.selected && typeof setBranchNode === 'function') {
      setBranchNode('allstar_story', 'start');
    }
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

  function captainMethodLabel(method) {
    if (method === 'mvp_pop') return 'MVP表现+人气';
    if (method === 'lottery') return '分区票选Top3抽签';
    return '';
  }

  function renderRosterColumn(title, list, captain) {
    var html = '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:6px;">' + title + '</div>';
    if (captain && captain.name) {
      html += '<div style="font-size:11px;color:var(--orange);margin-bottom:8px;padding:6px 8px;background:var(--orange-bg);border-radius:8px;">';
      html += '队长：<strong>' + captain.name + '</strong>';
      if (captain.method) html += '<span style="color:var(--text-dim);"> · ' + captainMethodLabel(captain.method) + '</span>';
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
          runAllStarStoryChain(function () {
            runDraftFlow(pack, done);
          });
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
    if (window.__PP_ensure && !window.__PP_groupsReady(['story'])) {
      window.__PP_ensure(['story']).then(run, run);
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
