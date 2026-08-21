(function () {
  'use strict';

  // Browser-test hook used by the game QA harness. The game itself remains
  // timer-driven; this helper simply lets tests advance through short UI waits.
  if (typeof window.advanceTime !== 'function') {
    window.advanceTime = function (ms) {
      return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
    };
  }

  var PROFILE_KEY = 'perfect-player-profile-v1';
  var AVATAR_GROUPS = ['亚洲', '白人', '黑人'];
  var AVATAR_META = [];
  AVATAR_GROUPS.forEach(function (group, groupIndex) {
    for (var index = 1; index <= 6; index++) {
      var id = groupIndex * 6 + index;
      AVATAR_META.push({
        src: 'assets/images/Player/ai-avatars/' + (id === 1 ? 'avatar-asia-01.png' : ('avatar-' + String(id).padStart(2, '0') + '.png')),
        group: group
      });
    }
  });
  var AVATARS = AVATAR_META.map(function (avatar) { return avatar.src; });

  function readProfile() {
    try {
      var saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      if (saved && saved.avatar === 'assets/images/Player/ai-avatars/avatar-01.png') {
        saved.avatar = 'assets/images/Player/ai-avatars/avatar-asia-01.png';
      }
      if (saved && saved.name && AVATARS.indexOf(saved.avatar) >= 0) return saved;
    } catch (e) {}
    return null;
  }

  function applyProfile(profile) {
    window.PERFECT_PLAYER_PROFILE = profile;
    if (!profile) return;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {}
    try { localStorage.setItem('buildplayer_nickname', profile.name); } catch (e) {}
    if (typeof HUPU_USER !== 'undefined') {
      HUPU_USER.loaded = true;
      HUPU_USER.requested = true;
      HUPU_USER.isLogin = true;
      HUPU_USER.nickname = profile.name;
      HUPU_USER.avatar = profile.avatar;
      HUPU_USER.source = 'perfect-player-character';
    }
  }

  applyProfile(readProfile());
  var selectedAvatar = window.PERFECT_PLAYER_PROFILE ? window.PERFECT_PLAYER_PROFILE.avatar : AVATARS[0];
  var selectedAvatarMeta = AVATAR_META.filter(function (avatar) { return avatar.src === selectedAvatar; })[0];
  var activeAvatarGroup = selectedAvatarMeta ? selectedAvatarMeta.group : AVATAR_GROUPS[0];

  window.renderCharacterCreator = function () {
    var grid = document.getElementById('character-avatar-grid');
    var tabs = document.getElementById('character-avatar-tabs');
    var input = document.getElementById('character-name');
    if (!grid || !input) return;
    // 兼容被浏览器/CDN 缓存的旧版入口：旧 DOM 没有头像分组节点时现场补齐，
    // 不能因为一个辅助节点缺失就让整个头像网格保持空白。
    if (!tabs) {
      tabs = document.createElement('div');
      tabs.className = 'character-avatar-tabs';
      tabs.id = 'character-avatar-tabs';
      grid.parentNode.insertBefore(tabs, grid);
    }
    input.value = window.PERFECT_PLAYER_PROFILE ? window.PERFECT_PLAYER_PROFILE.name : '';
    tabs.innerHTML = AVATAR_GROUPS.map(function (group) {
      return '<button type="button" class="character-avatar-tab' + (group === activeAvatarGroup ? ' active' : '') + '" onclick="selectCharacterAvatarGroup(\'' + group + '\')">' + group + ' · 6</button>';
    }).join('');
    var visibleAvatars = AVATAR_META.filter(function (avatar) { return avatar.group === activeAvatarGroup; });
    grid.innerHTML = visibleAvatars.map(function (avatar, index) {
      var src = avatar.src;
      var selected = src === selectedAvatar ? ' selected' : '';
      return '<button type="button" class="character-avatar' + selected + '" data-avatar="' + src + '" onclick="selectCharacterAvatar(\'' + src + '\')" aria-label="选择' + activeAvatarGroup + '头像' + (index + 1) + '">' +
        '<img src="' + src + '?v=restore" alt="' + activeAvatarGroup + '球员头像' + (index + 1) + '">' +
      '</button>';
    }).join('');
    input.oninput = function () {
      var error = document.getElementById('character-error');
      if (error) error.textContent = '';
    };
  };

  window.selectCharacterAvatar = function (src) {
    if (AVATARS.indexOf(src) < 0) return;
    selectedAvatar = src;
    document.querySelectorAll('.character-avatar').forEach(function (button) {
      button.classList.toggle('selected', button.getAttribute('data-avatar') === src);
    });
    var error = document.getElementById('character-error');
    if (error) error.textContent = '';
  };

  window.showCharacterCreate = function () {
    window.renderCharacterCreator();
    if (typeof showScreen === 'function') showScreen('screen-character');
    setTimeout(function () {
      var input = document.getElementById('character-name');
      if (input) input.focus();
    }, 80);
  };

  window.confirmCharacter = function () {
    var input = document.getElementById('character-name');
    var error = document.getElementById('character-error');
    var name = input ? input.value.trim() : '';
    if (!name) {
      if (error) error.textContent = '请输入球员姓名';
      if (input) input.focus();
      return;
    }
    var profile = { name: name.slice(0, 12), avatar: selectedAvatar };
    applyProfile(profile);
    if (typeof beginAttributeBuild === 'function') {
      beginAttributeBuild();
    } else if (typeof showScreen === 'function') {
      showScreen('screen-build');
    }
  };

  var TEAM_TO_ABBR = {
    '凯尔特人':'BOS', '篮网':'BKN', '尼克斯':'NYK', '76人':'PHI', '猛龙':'TOR',
    '公牛':'CHI', '骑士':'CLE', '活塞':'DET', '步行者':'IND', '雄鹿':'MIL',
    '老鹰':'ATL', '黄蜂':'CHA', '热火':'MIA', '魔术':'ORL', '奇才':'WAS',
    '掘金':'DEN', '森林狼':'MIN', '雷霆':'OKC', '开拓者':'POR', '爵士':'UTA',
    '勇士':'GSW', '快船':'LAC', '湖人':'LAL', '太阳':'PHX', '国王':'SAC',
    '独行侠':'DAL', '火箭':'HOU', '灰熊':'MEM', '鹈鹕':'NOP', '马刺':'SAS'
  };
  var POSITIONS = { 1:'PG', 2:'SG', 3:'SF', 4:'PF', 5:'C' };
  var POSITION_HEIGHT = { PG:"6'2'", SG:"6'5'", SF:"6'7'", PF:"6'9'", C:"6'11'" };

  function clamp(value, low, high) {
    value = Math.round(Number(value) || low);
    return Math.max(low, Math.min(high, value));
  }

  function average(a, b) {
    return Math.round(((Number(a) || 50) + (Number(b) || 50)) / 2);
  }

  function convertPlayer(player) {
    var attrs = player.attrs || {};
    var mainPos = POSITIONS[player.pos] || 'SF';
    var secondPos = POSITIONS[player.pos2];
    var pos = mainPos + (secondPos && secondPos !== mainPos ? ' / ' + secondPos : '');
    var historical = player.source && player.source.kind !== 'current';
    var clutchBoost = Math.min(8, Math.round((Number(player.starScore) || 0) / 35));
    return {
      name: player.nameEn || player.altName || player.name,
      cname: player.nameCn || player.name,
      pos: pos,
      height: POSITION_HEIGHT[mainPos],
      type: historical
        ? (player.historicalTier === 'hall-of-fame' ? '名人堂惊喜' : '近代全明星惊喜')
        : '现役球员',
      ovr: clamp(player.rating, 50, 99),
      threePT: clamp(attrs.shotExt, 35, 99),
      MID: clamp(attrs.shotInt, 35, 99),
      FIN: clamp(average(attrs.shotInt, attrs.physique), 35, 99),
      DNK: clamp(average(attrs.shotInt, attrs.strength), 35, 99),
      HAN: clamp(average(attrs.pass, attrs.speed), 35, 99),
      PAS: clamp(attrs.pass, 35, 99),
      PDEF: clamp(average(attrs.stl, attrs.speed), 35, 99),
      IDEF: clamp(average(attrs.blk, attrs.reb), 35, 99),
      BLK: clamp(attrs.blk, 35, 99),
      REB: clamp(attrs.reb, 35, 99),
      ATH: clamp(average(attrs.speed, attrs.physique), 35, 99),
      STR: clamp(attrs.strength, 35, 99),
      CLU: clamp((Number(player.rating) || 70) + clutchBoost, 35, 99),
      _sourceKind: historical ? 'historical' : 'current',
      _sourceYear: player.source ? player.source.year : 2025,
      _sourceLabel: player.source ? player.source.label : '2025-26',
      _historicalTier: player.historicalTier || '',
      _historicalPeak: !!player.historicalPeak,
      _peakRating: Number(player.peakRating || player.rating || 0),
      _peakSource: player.peakSource || '',
      _photoLocal: player.photoLocal,
      _photoUrl: player.photoUrl || '',
      _poolUid: player.uid
    };
  }

  window.PERFECT_PLAYER_PHOTO_BY_NAME = window.PERFECT_PLAYER_PHOTO_BY_NAME || {};
  window.PERFECT_PLAYER_DISPLAY_BY_NAME = window.PERFECT_PLAYER_DISPLAY_BY_NAME || {};
  window.PERFECT_PLAYER_BUILD_DATA = window.PERFECT_PLAYER_BUILD_DATA || {};
  window.PERFECT_PLAYER_HISTORICAL_SURPRISE_DATA = window.PERFECT_PLAYER_HISTORICAL_SURPRISE_DATA || {};
  window.PERFECT_PLAYER_DATA_READY = fetch('assets/data/perfect-player-pool.json?v=20260809-static-peak-table')
    .then(function (response) {
      if (!response.ok) throw new Error('球员库加载失败：' + response.status);
      return response.json();
    })
    .then(function (payload) {
      var report = {
        teams: 0,
        teamsWithTarget12: 0,
        teamsWithHistorical5: 0,
        current: 0,
        historical: 0,
        total: 0,
        historicalBuildOnly: true,
        competitionRosterSource: 'NBA2K_DATA (current-only)'
      };
      Object.keys(payload.teams || {}).forEach(function (teamId) {
        var sourceTeam = payload.teams[teamId];
        var abbr = TEAM_TO_ABBR[sourceTeam.name];
        if (!abbr || typeof NBA2K_DATA === 'undefined' || !NBA2K_DATA[abbr]) return;
        var converted = (sourceTeam.players || []).map(convertPlayer);
        var historicalSurprises = (sourceTeam.historicalPlayers || []).map(convertPlayer);
        converted.concat(historicalSurprises).forEach(function (player) {
          window.PERFECT_PLAYER_PHOTO_BY_NAME[player.name] = player._photoLocal || player._photoUrl || '';
          window.PERFECT_PLAYER_DISPLAY_BY_NAME[player.name] = player.cname || player.name;
          report[player._sourceKind] += 1;
        });
        window.PERFECT_PLAYER_BUILD_DATA[abbr] = converted;
        window.PERFECT_PLAYER_HISTORICAL_SURPRISE_DATA[abbr] = historicalSurprises;
        report.teams += 1;
        if (sourceTeam.currentCount === 12 && converted.length === 12) report.teamsWithTarget12 += 1;
        if (sourceTeam.historicalCount === 5 && historicalSurprises.length === 5) report.teamsWithHistorical5 += 1;
        report.total += converted.length + historicalSurprises.length;
      });
      window.PERFECT_PLAYER_POOL_REPORT = report;
      return report;
    })
    .catch(function (error) {
      window.PERFECT_PLAYER_POOL_ERROR = String(error && error.message ? error.message : error);
      return null;
    });

  function signed(value) {
    value = Math.round(Number(value) || 0);
    return value > 0 ? '+' + value : String(value);
  }

  window.renderPlayerStateStrip = function () {
    var career = typeof STATE !== 'undefined' && STATE.career ? STATE.career : {};
    var profile = career.profile || {};
    var mods = typeof getNextSeasonMods === 'function' ? getNextSeasonMods() : {};
    var effects = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : { teamStanding:0, publicStanding:0, legacyScoreContribution:0 };
    var values = [
      { group:'竞技状态', key:'pressure', label:'压力', value:typeof getMentalPressure === 'function' ? Math.round(getMentalPressure()) : 0, badHigh:true, raw:true, impact:'提高事件风险与负面状态触发' },
      { group:'竞技状态', key:'staminaLoad', label:'体能负荷', value:mods.staminaLoad, badHigh:true, impact:'直接降低攻防；低负荷可减免老将衰退' },
      { group:'竞技状态', key:'moraleBonus', label:'士气', value:mods.moraleBonus, goodHigh:true, impact:'直接提升球队进攻与防守效率' },
      { group:'竞技状态', key:'formVariance', label:'状态波动', value:mods.formVariance, badHigh:true, impact:'改变每场比赛结果的波动幅度' },
      { group:'竞技状态', key:'injuryRiskBonus', label:'伤病风险', value:mods.injuryRiskBonus, badHigh:true, impact:'影响伤病概率；低风险可减免老将衰退' },
      { group:'球队关系', key:'teamChemistry', label:'球队默契', value:mods.teamChemistry, goodHigh:true, impact:'直接提升球队进攻与防守效率' },
      { group:'球队关系', key:'coachTrust', label:'教练信任', value:profile.coachTrust, goodHigh:true, impact:'影响首发、时间、交易、裁员与续约' },
      { group:'球队关系', key:'lockerRoomTrust', label:'更衣室信任', value:profile.lockerRoomTrust, goodHigh:true, impact:'提升进攻，降低交易与裁员风险' },
      { group:'球队关系', key:'leadership', label:'领导力', value:profile.leadership, goodHigh:true, impact:'提升球队攻防并帮助竞争首发' },
      { group:'球队关系', key:'loyalty', label:'忠诚', value:profile.loyalty, goodHigh:true, impact:'降低主动交易风险，提高母队续约率' },
      { group:'舆论环境', key:'mediaPressure', label:'媒体压力', value:mods.mediaPressure, badHigh:true, impact:'降低进攻效率并增加心理压力' },
      { group:'舆论环境', key:'mediaTrust', label:'媒体信任', value:profile.mediaTrust, goodHigh:true, impact:'降低比赛波动，增加自由市场报价，评选MVP、FMVP、DPOY时更吃媒体叙事' },
      { group:'舆论环境', key:'controversy', label:'争议', value:profile.controversy, badHigh:true, impact:'增加波动、交易与裁员风险，降低续约' },
      { group:'舆论环境', key:'fanSupport', label:'球迷支持', value:profile.fanSupport, goodHigh:true, impact:'降低裁员风险，提高续约和市场热度，主场表现更好' },
      { group:'舆论环境', key:'fame', label:'人气', value:profile.fame, goodHigh:true, impact:'提高自由市场热度，也更容易入选全明星' },
      { group:'生涯影响', key:'businessValue', label:'商业价值', value:profile.businessValue, goodHigh:true, impact:'提高续约率与自由市场报价数量' },
      { group:'生涯影响', key:'chinaPopularity', label:'中国人气', value:profile.chinaPopularity, goodHigh:true, impact:'提高公众影响力与自由市场热度' },
      { group:'生涯影响', key:'legacyBonus', label:'传奇声望', value:profile.legacyBonus, goodHigh:true, impact:'直接计入最终历史分，范围 -15~+20' }
    ];

    function stateClass(item, value) {
      if (item.badHigh && value > 0) return ' alert';
      if (item.badHigh && value < 0) return ' good';
      if (item.goodHigh && value > 0) return ' good';
      if (item.goodHigh && value < 0) return ' alert';
      return '';
    }
    function band(score) {
      if (score >= 6) return '出色';
      if (score >= 2) return '良好';
      if (score <= -6) return '警戒';
      if (score <= -2) return '承压';
      return '平稳';
    }
    function summaryItem(key, label, score, impact) {
      var cls = score >= 2 ? ' good' : (score <= -2 ? ' alert' : '');
      return '<div class="player-state-item' + cls + '" data-status-key="' + key + '" title="' + impact + '">' +
        '<span class="player-state-value">' + band(score) + '</span><span class="player-state-label">' + label + '</span></div>';
    }
    function detailItem(item) {
      var value = Math.round(Number(item.value) || 0);
      return '<div class="player-state-detail' + stateClass(item, value) + '" data-status-key="' + item.key + '">' +
        '<span class="player-state-value">' + (item.raw ? value : signed(value)) + '</span><span class="player-state-label">' + item.label + '</span><span class="player-state-impact">' + item.impact + '</span></div>';
    }

    var pressure = typeof getMentalPressure === 'function' ? Math.round(getMentalPressure()) : 0;
    var competitiveScore = (Number(mods.moraleBonus) || 0) - (Number(mods.staminaLoad) || 0) - Math.max(0, Number(mods.formVariance) || 0) - Math.max(0, Number(mods.injuryRiskBonus) || 0) - pressure / 4;
    var teamScore = (Number(mods.teamChemistry) || 0) + (Number(effects.teamStanding) || 0) / 4;
    var publicScore = (Number(effects.publicStanding) || 0) / 4 - (Number(mods.mediaPressure) || 0) - pressure / 6;
    var legacyScore = (Number(effects.legacyScoreContribution) || 0) + (Number(profile.loyalty) || 0) * 0.2;
    var summaryHtml = summaryItem('competitiveSummary', '竞技状态', competitiveScore, '士气、疲劳、伤病与状态波动的综合结果')
      + summaryItem('teamSummary', '球队关系', teamScore, '影响球队攻防、首发、上场时间、交易与续约')
      + summaryItem('publicSummary', '舆论环境', publicScore, '影响比赛波动、续约与自由市场报价')
      + summaryItem('legacySummary', '生涯影响', legacyScore, '影响最终历史分与生涯评价');
    var groupOrder = ['竞技状态','球队关系','舆论环境','生涯影响'];
    var groupsHtml = groupOrder.map(function (group) {
      return '<div class="player-state-group"><div class="player-state-group-title">' + group + '</div>' + values.filter(function (item) {
        return item.group === group;
      }).map(detailItem).join('') + '</div>';
    }).join('');
    return '<div class="player-state-strip" id="player-state-strip" aria-label="球员状态摘要与完整作用">' +
      '<div class="player-state-summary">' + summaryHtml + '</div>' +
      '<details class="player-state-details"><summary>查看 18 项详细状态与作用</summary><div class="player-state-groups">' + groupsHtml + '</div></details></div>';
  };

  function draftPending() {
    if (typeof STATE === 'undefined') return null;
    STATE._draftPending = STATE._draftPending || { draftStockBonus:0, randomEventIds:[] };
    STATE._draftPending.randomEventIds = STATE._draftPending.randomEventIds || [];
    return STATE._draftPending;
  }

  function changeDraftStock(amount) {
    var pending = draftPending();
    if (pending) pending.draftStockBonus = (Number(pending.draftStockBonus) || 0) + amount;
  }

  function getDraftPrepAdjustment(pending) {
    if (!pending) return 0;
    if (pending.prep === 'combine') return pending.combineHurt ? -2 : 1;
    if (pending.prep === 'workouts') return 1;
    if (pending.prep === 'skip') return -3;
    return 0;
  }

  function getDraftRankFromScore(score) {
    if (score >= 92) return 1;
    if (score >= 88) return clamp(1 + Math.round((92 - score) * 1), 1, 5);
    if (score >= 84) return clamp(6 + Math.round((88 - score) * 2), 6, 14);
    if (score >= 78) return clamp(15 + Math.round((84 - score) * 2.5), 15, 30);
    if (score >= 70) return clamp(31 + Math.round((78 - score) * 1.75), 31, 45);
    if (score >= 65) return clamp(46 + Math.round((70 - score) * 2.8), 46, 60);
    return null;
  }

  function getDraftRoundRange(start, end) {
    if (end <= 30) return '首轮 · ' + start + '–' + end;
    if (start > 30) return '次轮 · ' + start + '–' + end;
    return '首轮末至次轮初';
  }

  window.changePerfectPlayerDraftStock = changeDraftStock;
  window.getPerfectPlayerDraftProjection = function () {
    var pending = draftPending();
    if (!pending) return null;
    var ovr = Number(STATE.finalOVR) || 50;
    var stock = Number(pending.draftStockBonus) || 0;
    var prep = getDraftPrepAdjustment(pending);
    var score = ovr + stock + prep;
    var rank = getDraftRankFromScore(score);
    var rangeStart = rank == null ? null : Math.max(1, rank - 3);
    var rangeEnd = rank == null ? null : Math.min(60, rank + 3);
    return {
      ovr: ovr,
      score: score,
      rank: rank,
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      round: rank == null ? 0 : (rank <= 30 ? 1 : 2),
      stock: stock,
      prepAdjustment: prep,
      rangeLabel: rank == null ? '次轮末 / 落选' : getDraftRoundRange(rangeStart, rangeEnd)
    };
  };

  window.selectCharacterAvatarGroup = function (group) {
    if (AVATAR_GROUPS.indexOf(group) < 0) return;
    activeAvatarGroup = group;
    window.renderCharacterCreator();
  };

  window.renderPerfectPlayerDraftProjection = function (contextTitle) {
    if (typeof STATE === 'undefined' || !STATE._draftPending) return '';
    var pending = STATE._draftPending;
    var title = String(contextTitle || '');
    var revealResult = pending.draftResultRevealed || /^(选秀结果|落选)/.test(title);
    if (/^(选秀结果|落选)/.test(title)) pending.draftResultRevealed = true;
    var projection = window.getPerfectPlayerDraftProjection();
    if (!projection) return '';
    var rankText = projection.rank == null ? '落选边缘' : '第' + projection.rank + '顺位';
    var rangeText = projection.rangeLabel;
    var statusLabel = '选秀行情';
    var stockText = projection.stock > 0 ? '↑ +' + projection.stock : (projection.stock < 0 ? '↓ ' + projection.stock : '— 稳定');
    var stockClass = projection.stock > 0 ? ' is-up' : (projection.stock < 0 ? ' is-down' : '');
    if (revealResult && pending.type) {
      rankText = pending.type === 'undrafted' ? '落选' : '第' + pending.pick + '顺位';
      rangeText = pending.type === 'undrafted' ? '未被选中' : (pending.round === 1 ? '首轮' : '次轮');
      statusLabel = '选秀结果';
      stockText = pending.type === 'undrafted' ? '继续争取' : '已确定';
      stockClass = pending.type === 'undrafted' ? ' is-down' : ' is-up';
    }
    return '<div class="draft-projection-card" data-draft-projection aria-label="选秀预测排名">' +
      '<div class="draft-projection-cell is-primary"><span>' + (revealResult ? '最终顺位' : '当前预测') + '</span><strong data-draft-rank>' + rankText + '</strong></div>' +
      '<div class="draft-projection-cell"><span>预测区间</span><strong data-draft-range>' + rangeText + '</strong></div>' +
      '<div class="draft-projection-cell"><span>' + statusLabel + '</span><strong class="draft-stock-value' + stockClass + '" data-draft-stock>' + stockText + '</strong></div>' +
    '</div>';
  };

  (function installDraftProjectionStyles() {
    if (document.getElementById('perfect-player-draft-projection-style')) return;
    var style = document.createElement('style');
    style.id = 'perfect-player-draft-projection-style';
    style.textContent =
      '.draft-projection-card{margin:8px 12px 0;padding:7px 6px;display:grid;grid-template-columns:1.08fr 1fr .88fr;gap:5px;background:linear-gradient(135deg,rgba(255,107,53,.14),rgba(255,255,255,.02));border:1px solid var(--orange-dim);border-radius:10px}' +
      '.draft-projection-cell{min-width:0;padding:1px 5px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:2px}' +
      '.draft-projection-cell:first-child{border-left:0}.draft-projection-cell span{font-size:9px;color:var(--text-dim);white-space:nowrap}' +
      '.draft-projection-cell strong{font-family:var(--font-display);font-size:11px;color:var(--text);line-height:1.25;white-space:normal}' +
      '.draft-projection-cell.is-primary strong{font-size:14px;color:var(--orange)}.draft-stock-value.is-up{color:#34c759!important}.draft-stock-value.is-down{color:var(--red)!important}' +
      '@media(max-width:360px){.draft-projection-card{margin-left:9px;margin-right:9px;padding-left:3px;padding-right:3px;gap:2px}.draft-projection-cell{padding-left:4px;padding-right:4px}.draft-projection-cell strong{font-size:10px}.draft-projection-cell.is-primary strong{font-size:13px}}';
    document.head.appendChild(style);
  })();

  var DRAFT_RANDOM_EVENTS = [
    { id:'medical_recheck', stage:'pre', title:'医疗复查', scene:'一支握有高顺位签的球队临时要求追加膝盖检查。检查室外已经站了几名记者，经纪人问你要不要公开结果。', choices:[
      { label:'公开检查结果', hint:'透明，但结果也可能改变行情', apply:function() { var clean = Math.random() < 0.72; addProfileDelta('mediaTrust', 1); changeDraftStock(clean ? 1 : -1); if (!clean) addSeasonMod('injuryRiskBonus', 1, -4, 8); return clean ? '报告没有异常，球队对你的透明态度很满意。<br><br>效果：媒体信任+1；选秀行情上升。' : '报告里出现一处需要观察的小问题，消息很快传到各队。<br><br>效果：媒体信任+1；选秀行情下降；伤病风险+1。'; } },
      { label:'只交给球队', hint:'控制消息，不让媒体介入', apply:function() { addProfileDelta('controversy', 1); addProfileDelta('mediaTrust', -1); return '报告只在球队之间流转。你避免了公开讨论，但媒体开始猜测你在隐瞒什么。<br><br>效果：争议+1；媒体信任-1。'; } }
    ]},
    { id:'elite_workout', stage:'pre', title:'加赛试训', scene:'试训结束后，球探临时安排你和另一名热门新秀打一组五分钟对抗。所有摄像机又重新开了起来。', choices:[
      { label:'接下单挑', hint:'赢了大涨，输了也会被看见', apply:function() { var won = Math.random() < 0.58; changeDraftStock(won ? 2 : -1); if (won) addProfileDelta('fame', 1); else addSeasonMod('formVariance', 1, -10, 10); return won ? '你连续打成两个关键回合，球探席明显躁动起来。<br><br>效果：人气+1；选秀行情明显上升。' : '你强行接管比赛，却在最后两个回合失误。<br><br>效果：选秀行情下降；状态波动+1。'; } },
      { label:'按战术打完', hint:'不抢镜，展示执行力', apply:function() { addProfileDelta('coachTrust', 1); changeDraftStock(1); return '你没有把它当单挑，而是连续做出正确传球。主教练在报告上圈出了你的名字。<br><br>效果：教练信任+1；选秀行情小幅上升。'; } }
    ]},
    { id:'viral_interview', stage:'pre', title:'采访突然走红', scene:'你在训练馆门口的一段即兴采访突然登上热搜。经纪人建议趁热再录一段完整回应。', choices:[
      { label:'趁热回应', hint:'扩大曝光，也增加压力', apply:function() { addProfileDelta('fame', 2); addSeasonMod('mediaPressure', 1, -10, 10); if (Math.random() < 0.35) changeDraftStock(1); return '第二段采访的播放量继续上涨，你的名字第一次冲出球探圈。<br><br>效果：人气+2；媒体压力+1。'; } },
      { label:'回训练馆', hint:'让热度自然过去', apply:function() { addSeasonMod('formVariance', -1, -10, 10); addProfileDelta('coachTrust', 1); return '你没有继续追热点。第二天球探收到的是你加练到深夜的消息。<br><br>效果：状态波动-1；教练信任+1。'; } }
    ]},
    { id:'team_promise', stage:'pre', title:'口头承诺', scene:'一支球队私下暗示会在自己的顺位选你，条件是你取消后面的所有试训。经纪人提醒：口头承诺随时可能变化。', choices:[
      { label:'接受承诺', hint:'锁定下限，但把主动权交出去', apply:function() { var kept = Math.random() < 0.76; changeDraftStock(kept ? 1 : -2); addProfileDelta('loyalty', 1); return kept ? '球队兑现了大部分承诺，你的团队也停止向外放消息。<br><br>效果：忠诚+1；选秀行情稳定上升。' : '交易流言改变了球队计划，原来的承诺开始松动。<br><br>效果：忠诚+1；选秀行情明显下降。'; } },
      { label:'继续全部试训', hint:'保留选择，承担体能消耗', apply:function() { addProfileDelta('coachTrust', 1); addSeasonMod('staminaLoad', 1, -10, 10); return '你按原计划完成剩余试训。几支球队认可你的职业态度，但连续奔波留下了疲劳。<br><br>效果：教练信任+1；体能负荷+1。'; } }
    ]},
    { id:'flight_delay', stage:'pre', title:'航班延误', scene:'前往最后一站试训的航班延误六小时。改签红眼航班还能赶上，推迟则可能错过球队最后的决策会。', choices:[
      { label:'连夜赶过去', hint:'保住机会，状态未必在线', apply:function() { addSeasonMod('staminaLoad', 1, -10, 10); var sharp = Math.random() < 0.55; changeDraftStock(sharp ? 1 : -1); return sharp ? '你几乎没睡，却在投篮测试里保持了准度。<br><br>效果：体能负荷+1；选秀行情上升。' : '疲劳让你的横移和投篮都慢了半拍。<br><br>效果：体能负荷+1；选秀行情下降。'; } },
      { label:'申请改期', hint:'保护身体，但球队未必等你', apply:function() { addSeasonMod('formVariance', -1, -10, 10); if (Math.random() < 0.35) changeDraftStock(-1); return '你选择先恢复身体。球队接受了说明，但没有保证会重新安排。<br><br>效果：状态波动-1。'; } }
    ]},
    { id:'film_room_test', stage:'pre', title:'临场录像问答', scene:'试训结束前，教练突然暂停一段比赛录像，让你在十秒内说出场上五个人下一步该怎么站位。', choices:[
      { label:'立刻回答', hint:'相信第一判断', apply:function() { var right = Math.random() < 0.66; changeDraftStock(right ? 1 : -1); return right ? '你的答案和教练的战术板几乎一致。<br><br>效果：选秀行情上升。' : '你看到了第一层机会，却漏掉弱侧轮转。<br><br>效果：选秀行情小幅下降。'; } },
      { label:'先问战术原则', hint:'展示沟通和学习能力', apply:function() { addProfileDelta('coachTrust', 2); return '你先确认球队的防守原则，再给出完整答案。教练对这种沟通方式很满意。<br><br>效果：教练信任+2。'; } }
    ]},
    { id:'family_phone', stage:'post', title:'家人的电话', scene:'选秀结果出来后，家里第一个电话打了进来。电话那头很吵，所有人都在等你说第一句话。', choices:[
      { label:'把这一刻留给家人', hint:'先离开镜头几分钟', apply:function() { addProfileDelta('loyalty', 2); addProfileDelta('fanSupport', 1); return '你走到走廊尽头，和家人安静地说完这通电话。<br><br>效果：忠诚+2；球迷支持+1。'; } },
      { label:'开免提一起庆祝', hint:'让镜头记录这一刻', apply:function() { addProfileDelta('fame', 1); addProfileDelta('fanSupport', 2); return '欢呼声通过免提传遍房间，这段画面很快被转发。<br><br>效果：人气+1；球迷支持+2。'; } }
    ]},
    { id:'suit_sponsor', stage:'post', title:'西装赞助邀约', scene:'一家新品牌当晚提出赞助，希望你立刻穿着他们的西装接受采访，但经纪人还没来得及审合同。', choices:[
      { label:'先签短约', hint:'抓住第一笔商业机会', apply:function() { addProfileDelta('businessValue', 2); addProfileDelta('mediaTrust', -1); return '你完成了第一次商业合作，合同细节却被记者追问了整晚。<br><br>效果：商业价值+2；媒体信任-1。'; } },
      { label:'等团队审核', hint:'少赚一点，避免仓促决定', apply:function() { addProfileDelta('mediaTrust', 1); addProfileDelta('businessValue', 1); return '你没有被当晚的热度催着签字，品牌最终仍保留了合作。<br><br>效果：媒体信任+1；商业价值+1。'; } }
    ]},
    { id:'trade_rumor', stage:'post', title:'交易流言', scene:'你的名字刚出现在选秀字幕上，记者就说选中你的球队正在讨论交易。经纪人问你是否要公开回应。', choices:[
      { label:'不评论流言', hint:'等官方消息', apply:function() { addProfileDelta('mediaTrust', 1); addSeasonMod('mediaPressure', -1, -10, 10); return '你只说自己会为任何球队做好准备，流言没有从你这里得到第二轮热度。<br><br>效果：媒体信任+1；媒体压力-1。'; } },
      { label:'表达加盟意愿', hint:'先向选中你的球队示好', apply:function() { addProfileDelta('loyalty', 1); addProfileDelta('controversy', 1); return '你的表态赢得一部分球迷，也让潜在交易对象感到尴尬。<br><br>效果：忠诚+1；争议+1。'; } }
    ]},
    { id:'veteran_message', stage:'post', title:'老将的短信', scene:'一名球队老将发来短信：欢迎，但轮换位置不会因为顺位自动交给你。', choices:[
      { label:'约他第二天训练', hint:'直接用行动回应', apply:function() { addProfileDelta('lockerRoomTrust', 2); addSeasonMod('teamChemistry', 1, -10, 10); return '你们约好第二天早上见。第一堂训练课比发布会更早开始。<br><br>效果：更衣室信任+2；球队默契+1。'; } },
      { label:'回复会靠自己争取', hint:'明确竞争态度', apply:function() { addProfileDelta('leadership', 1); addProfileDelta('controversy', 1); return '老将只回了一个拳头表情。更衣室已经知道你不会安静等待。<br><br>效果：领导力+1；争议+1。'; } }
    ]},
    { id:'social_reaction', stage:'post', title:'社交媒体评价', scene:'评论区同时出现“最大遗珠”和“严重高估”两种声音。团队问你要不要转发其中一条。', choices:[
      { label:'转发支持者', hint:'回应球迷，扩大热度', apply:function() { addProfileDelta('fanSupport', 2); addSeasonMod('mediaPressure', 1, -10, 10); return '支持你的话题迅速聚集起来，新的关注也意味着新的审视。<br><br>效果：球迷支持+2；媒体压力+1。'; } },
      { label:'关闭评论', hint:'把注意力拉回篮球', apply:function() { addSeasonMod('formVariance', -1, -10, 10); addProfileDelta('mediaTrust', 1); return '你把手机交给团队，回到训练计划。第二天采访时，你的回答明显更平静。<br><br>效果：状态波动-1；媒体信任+1。'; } }
    ]},
    { id:'rookie_number', stage:'post', title:'号码选择', scene:'装备经理发来可选号码。你最熟悉的号码不在其中，只能在纪念过去和开启新身份之间做选择。', choices:[
      { label:'选有纪念意义的号码', hint:'向来路致意', apply:function() { addProfileDelta('loyalty', 1); addProfileDelta('chinaPopularity', 1); return '你选了一个只有家人和老球迷能看懂的号码。它很快有了自己的故事。<br><br>效果：忠诚+1；中国人气+1。'; } },
      { label:'选一个全新号码', hint:'从 NBA 重新开始', apply:function() { addProfileDelta('fame', 1); addProfileDelta('leadership', 1); return '你决定让新号码只代表 NBA 里的自己。第一批球衣很快开始印刷。<br><br>效果：人气+1；领导力+1。'; } }
    ]},
    // ===== 追加事件：扩充池子（弹出概率已在 runPerfectPlayerDraftRandomEvent 中收紧） =====
    { id:'shoe_deal_bidding', stage:'pre', title:'球鞋竞标', scene:'两家球鞋品牌在选秀前争抢你的签名。一家给的钱更多，另一家承诺给你专属产品线，但要你现在就站队。', choices:[
      { label:'选高报价合同', hint:'先把钱拿到手', apply:function() { addProfileDelta('businessValue', 3); addProfileDelta('loyalty', -1); return '你签下了报价更高的一份。数字很漂亮，但另一家在社媒上意味深长地祝你好运。<br><br>效果：商业价值+3；忠诚-1。'; } },
      { label:'选专属产品线', hint:'赌长期价值', apply:function() { addProfileDelta('businessValue', 1); addProfileDelta('fame', 1); if (Math.random() < 0.4) changeDraftStock(1); return '你押注在能长期陪你成长的品牌上。发布会当天，你的名字第一次和一双鞋绑在了一起。<br><br>效果：商业价值+1；人气+1。'; } }
    ]},
    { id:'draft_night_outfit', stage:'pre', title:'选秀夜造型', scene:'造型团队准备了三套方案：低调经典、大胆先锋、还是带有家乡元素的定制款。镜头会记住你走上舞台的第一个画面。', choices:[
      { label:'大胆先锋造型', hint:'博眼球，也可能被议论', apply:function() { addProfileDelta('fame', 2); addProfileDelta('controversy', 1); return '你的造型当晚就上了时尚版热搜，评价两极，但没有人记不住你。<br><br>效果：人气+2；争议+1。'; } },
      { label:'家乡元素定制', hint:'讲好自己的故事', apply:function() { addProfileDelta('chinaPopularity', 2); addProfileDelta('fanSupport', 1); return '你把家乡的图案缝进西装内衬。采访里你讲起它的含义，很多人因此记住了你从哪来。<br><br>效果：中国人气+2；球迷支持+1。'; } },
      { label:'低调经典造型', hint:'让实力说话', apply:function() { addProfileDelta('mediaTrust', 1); return '你穿了一套挑不出毛病的西装，把所有话题都留给了球场。<br><br>效果：媒体信任+1。'; } }
    ]},
    { id:'mock_draft_slip', stage:'pre', title:'模拟选秀下滑', scene:'一份权威模拟选秀把你的顺位往后调了几位，理由是"上限存疑"。经纪人问你要不要公开回应这份榜单。', choices:[
      { label:'用训练视频回应', hint:'把质疑变成动力', apply:function() { if (Math.random() < 0.55) { changeDraftStock(1); return '你放出一段高强度训练视频，几家球队重新把你列入试训名单。<br><br>效果：选秀行情回升。'; } addSeasonMod('formVariance', 1, -10, 10); return '视频没有改变太多风向，但至少证明了你没有松懈。<br><br>效果：状态波动+1。'; } },
      { label:'不予理会', hint:'专注自己的节奏', apply:function() { addProfileDelta('mediaTrust', 1); addSeasonMod('formVariance', -1, -10, 10); return '你没有回应任何一份榜单，只是照常训练。安静反而让人高看一眼。<br><br>效果：媒体信任+1；状态波动-1。'; } }
    ]},
    { id:'agent_dinner', stage:'pre', title:'球队高层晚宴', scene:'一支彩票区球队约你共进晚餐。饭桌上没有谈篮球，全在聊你的性格和抗压能力。你意识到这也是一场考试。', choices:[
      { label:'坦诚展现自己', hint:'真实，但风险自负', apply:function() { if (Math.random() < 0.6) { changeDraftStock(1); addProfileDelta('mediaTrust', 1); return '你没有背稿子，聊得很真诚。第二天球队管理层给了你很正面的评价。<br><br>效果：选秀行情上升；媒体信任+1。'; } addProfileDelta('controversy', 1); return '你说得太直接，有句玩笑被理解偏了。<br><br>效果：争议+1。'; } },
      { label:'滴水不漏地应对', hint:'安全，但少了记忆点', apply:function() { addProfileDelta('coachTrust', 1); return '你把每个问题都答得四平八稳。球队觉得你成熟，但也没什么惊喜。<br><br>效果：教练信任+1。'; } }
    ]},
    { id:'draft_charity', stage:'post', title:'第一笔慈善', scene:'签约奖金还没到账，家乡的青少年篮球营就发来求助信息。经纪团队提醒你现金流还很紧张。', choices:[
      { label:'个人出资支持', hint:'回馈家乡', apply:function() { addProfileDelta('chinaPopularity', 3); addProfileDelta('fanSupport', 1); addProfileDelta('businessValue', -1); return '你悄悄捐了第一笔钱，直到孩子们的照片被传上网，大家才知道。<br><br>效果：中国人气+3；球迷支持+1；商业价值-1。'; } },
      { label:'承诺赛季后再帮', hint:'先稳住自己的脚跟', apply:function() { addProfileDelta('loyalty', 1); return '你回复说等站稳脚跟一定回来。这句话被截图保存，很多人在等你兑现。<br><br>效果：忠诚+1。'; } }
    ]},
    { id:'summer_league_buzz', stage:'post', title:'夏季联赛焦点', scene:'夏季联赛第一场你就打出亮眼表现，媒体开始造势。教练组却提醒你别被夏联的数据冲昏头。', choices:[
      { label:'继续保持火力', hint:'趁热证明自己', apply:function() { if (Math.random() < 0.55) { addProfileDelta('fame', 2); return '你在夏联持续爆发，新秀榜上开始有了你的名字。<br><br>效果：人气+2。'; } addSeasonMod('staminaLoad', 1, -10, 10); return '你太想证明自己，出手选择有些勉强，教练在场边皱了眉。<br><br>效果：体能负荷+1。'; } },
      { label:'打磨短板', hint:'把夏联当训练场', apply:function() { addProfileDelta('coachTrust', 2); return '你主动要求多打自己不擅长的位置。数据没那么华丽，但教练组记住了你的态度。<br><br>效果：教练信任+2。'; } }
    ]},
    { id:'hometown_return', stage:'post', title:'衣锦还乡', scene:'选秀结束后的第一个休息日，家乡想为你办一场欢迎仪式。这会占掉你宝贵的适应期时间。', choices:[
      { label:'回去参加仪式', hint:'和家乡一起庆祝', apply:function() { addProfileDelta('chinaPopularity', 2); addProfileDelta('fanSupport', 2); addSeasonMod('staminaLoad', 1, -10, 10); return '你站在挤满人的广场上，忽然明白自己代表的不只是一个人。<br><br>效果：中国人气+2；球迷支持+2；体能负荷+1。'; } },
      { label:'留队投入训练', hint:'先抓住立足机会', apply:function() { addProfileDelta('coachTrust', 1); addSeasonMod('formVariance', -1, -10, 10); return '你婉拒了仪式，把时间全给了训练馆。家乡人有点失落，但更多人说理解。<br><br>效果：教练信任+1；状态波动-1。'; } }
    ]},
    { id:'measurement_day', stage:'pre', title:'体测数据争议', scene:'官方体测公布后，你的裸足身高比大学资料矮了两厘米。节目开始争论你能不能防住更高大的同位置球员。', choices:[
      { label:'申请公开复测', hint:'用数据正面回应', apply:function() { var passed = Math.random() < 0.68; changeDraftStock(passed ? 1 : -1); addProfileDelta('mediaTrust', 1); return passed ? '复测结果证明误差来自设备，球队更新了你的资料。<br><br>效果：媒体信任+1；预测顺位上升。' : '复测没有改变数字，讨论反而持续了一整天。<br><br>效果：媒体信任+1；预测顺位下降。'; } },
      { label:'用对抗录像回应', hint:'不争数字，展示换防能力', apply:function() { addProfileDelta('coachTrust', 1); addSeasonMod('formVariance', -1, -10, 10); return '你放出几段成功换防大个子的录像。数字没变，但球探报告里的担忧少了一条。<br><br>效果：教练信任+1；状态波动-1。'; } }
    ]},
    { id:'shooting_streak', stage:'pre', title:'投篮测试连中', scene:'公开投篮测试最后一组，你已经连续命中十球。场边开始有人计数，下一球会决定这段视频能不能登上当晚集锦。', choices:[
      { label:'挑战更远距离', hint:'命中就会成为试训焦点', apply:function() { var hit = Math.random() < 0.54; changeDraftStock(hit ? 2 : -1); if (hit) addProfileDelta('fame', 1); return hit ? '篮球从中圈标志旁飞出，空心入网。球探席第一次集体抬头。<br><br>效果：人气+1；预测顺位明显上升。' : '球砸在篮筐前沿，连中纪录停住了，但没人忘记前面的十球。<br><br>效果：预测顺位小幅下降。'; } },
      { label:'收在最舒服的位置', hint:'保住稳定印象', apply:function() { changeDraftStock(1); addProfileDelta('coachTrust', 1); return '你在战术要求的位置再中两球，然后主动结束。球队更喜欢这种可复制的稳定。<br><br>效果：教练信任+1；预测顺位上升。'; } }
    ]},
    { id:'defense_assignment', stage:'pre', title:'防守专项考题', scene:'一支球队没有让你展示进攻，只要求你连续防守三种位置。最后一组对抗，对面正好是本届最会得分的新秀。', choices:[
      { label:'全场贴防', hint:'消耗大，但态度最直接', apply:function() { var stopped = Math.random() < 0.6; addSeasonMod('staminaLoad', 1, -10, 10); changeDraftStock(stopped ? 2 : 0); return stopped ? '你把他逼出舒适区，最后一次出手只碰到篮板。<br><br>效果：体能负荷+1；预测顺位明显上升。' : '你没完全限制住他，但每个回合都追到了最后。<br><br>效果：体能负荷+1。'; } },
      { label:'按球队体系协防', hint:'展示判断与执行力', apply:function() { addProfileDelta('coachTrust', 2); changeDraftStock(1); return '你没有追着球跑，而是提前封住了球队最在意的线路。教练在报告上写下：能立即进入体系。<br><br>效果：教练信任+2；预测顺位上升。'; } }
    ]},
    { id:'workout_report_leak', stage:'pre', title:'试训报告泄露', scene:'一份内部试训报告被发到了网上。优点写得很满，缺点也毫不留情。经纪团队怀疑是某支球队故意压价。', choices:[
      { label:'要求球队澄清', hint:'保护行情，也可能激化关系', apply:function() { var owned = Math.random() < 0.45; addProfileDelta('controversy', 1); changeDraftStock(owned ? 1 : -1); return owned ? '球队承认报告未经授权流出，几家媒体撤回了负面标题。<br><br>效果：争议+1；预测顺位回升。' : '没有球队愿意出面，公开交涉反而让报告传播得更广。<br><br>效果：争议+1；预测顺位下降。'; } },
      { label:'逐条补强短板', hint:'把报告当成免费反馈', apply:function() { addProfileDelta('coachTrust', 1); addSeasonMod('formVariance', -1, -10, 10); return '你把报告打印出来贴在训练馆，每解决一条就划掉一条。球探后来收到了这张写满笔记的纸。<br><br>效果：教练信任+1；状态波动-1。'; } }
    ]},
    { id:'last_minute_workout', stage:'pre', title:'最后一分钟试训邀请', scene:'选秀前四十八小时，一支此前没有联系过你的球队突然发来专机邀请。它的顺位正好处在你的预测区间。', choices:[
      { label:'立即赴约', hint:'多一次机会，也多一次风险', apply:function() { var sharp = Math.random() < 0.62; addSeasonMod('staminaLoad', 1, -10, 10); changeDraftStock(sharp ? 2 : -1); return sharp ? '临时试训异常顺利，总经理亲自把你送到门口。<br><br>效果：体能负荷+1；预测顺位明显上升。' : '仓促行程影响了状态，你的最后几次出手都短了一点。<br><br>效果：体能负荷+1；预测顺位下降。'; } },
      { label:'礼貌拒绝', hint:'保护已有评价', apply:function() { addProfileDelta('loyalty', 1); if (Math.random() < 0.25) changeDraftStock(-1); return '你选择相信已经完成的试训。球队表示理解，但没有透露他们是否还会考虑你。<br><br>效果：忠诚+1。'; } }
    ]},
    { id:'psychology_test', stage:'pre', title:'心理抗压测试', scene:'面试官故意连续否定你的回答，又突然问：如果前十顺位都不选你，你会怎么看自己？房间里没有一个人笑。', choices:[
      { label:'坦承会失望', hint:'真实地表达竞争心', apply:function() { addProfileDelta('mediaTrust', 2); addSeasonMod('mediaPressure', -1, -10, 10); return '你说会失望，但第二天仍会训练。面试官第一次放下笔，和你认真握手。<br><br>效果：媒体信任+2；媒体压力-1。'; } },
      { label:'回答顺位不重要', hint:'强调长期职业目标', apply:function() { addProfileDelta('coachTrust', 1); changeDraftStock(1); return '你把话题拉回比赛和成长。球队认为你的注意力没有被榜单绑住。<br><br>效果：教练信任+1；预测顺位上升。'; } }
    ]},
    { id:'legend_phone_call', stage:'pre', title:'名宿来电', scene:'一位退役名宿看过你的录像，主动打来电话。他说球队正在讨论你，但他只愿意帮你传一句话。', choices:[
      { label:'请他谈篮球能力', hint:'让评价回到球场', apply:function() { changeDraftStock(1); addProfileDelta('coachTrust', 1); return '他在管理层会议上讲了你读防守的细节。那不是夸奖，更像一份专业担保。<br><br>效果：教练信任+1；预测顺位上升。'; } },
      { label:'请他谈个人性格', hint:'让球队相信你的长期价值', apply:function() { addProfileDelta('lockerRoomTrust', 1); addProfileDelta('mediaTrust', 1); return '他没有谈数据，只说你愿意听、也愿意承担。球队把这句话写进了最终报告。<br><br>效果：更衣室信任+1；媒体信任+1。'; } }
    ]},
    { id:'draft_week_flu', stage:'pre', title:'选秀周感冒', scene:'选秀周第一天醒来，你开始低烧。下午还有一场重要见面会，团队担心缺席会被理解成回避。', choices:[
      { label:'戴口罩按时出席', hint:'守住承诺，但身体负荷增加', apply:function() { addSeasonMod('staminaLoad', 2, -10, 10); addProfileDelta('coachTrust', 1); if (Math.random() < 0.3) changeDraftStock(-1); return '你完成了全部会面，声音有些沙哑。球队认可态度，也记下了健康风险。<br><br>效果：教练信任+1；体能负荷+2。'; } },
      { label:'公开说明并休息', hint:'先把身体恢复好', apply:function() { addProfileDelta('mediaTrust', 1); addSeasonMod('formVariance', -1, -10, 10); return '你主动公布情况并取消行程。透明处理避免了猜测，第二天体温也恢复正常。<br><br>效果：媒体信任+1；状态波动-1。'; } }
    ]},
    { id:'rookie_orientation', stage:'post', title:'新秀说明会', scene:'联盟的新秀说明会上，工作人员列出社交媒体、赌博信息和财务陷阱。休息时，有人邀请你提前离场去参加派对。', choices:[
      { label:'留下听完课程', hint:'先学会保护职业生涯', apply:function() { addProfileDelta('mediaTrust', 1); addProfileDelta('coachTrust', 1); return '你记下了每个紧急联系人。几个月后，这些规则真的帮你避开了一次麻烦。<br><br>效果：媒体信任+1；教练信任+1。'; } },
      { label:'跟新秀们去聚会', hint:'更快融入同届圈子', apply:function() { addProfileDelta('fame', 1); addProfileDelta('controversy', 1); return '你认识了半届新秀，也被路人拍到凌晨离开。照片不算严重，但已经足够成为话题。<br><br>效果：人气+1；争议+1。'; } }
    ]},
    { id:'jersey_sales', stage:'post', title:'首日球衣销量', scene:'球队通知你，新秀球衣首日销量超出预期。市场团队想立刻追加一场直播带货，教练却安排了同一时间的录像课。', choices:[
      { label:'参加球队录像课', hint:'篮球优先', apply:function() { addProfileDelta('coachTrust', 2); addProfileDelta('businessValue', -1); return '你把直播交给品牌团队，自己坐进录像室。销量少了一点，教练却把你的名字写进轮换讨论。<br><br>效果：教练信任+2；商业价值-1。'; } },
      { label:'完成商业直播', hint:'抓住新秀期热度', apply:function() { addProfileDelta('businessValue', 2); addSeasonMod('mediaPressure', 1, -10, 10); return '直播间数字不断上涨，第二天每个记者都在问你如何平衡商业和篮球。<br><br>效果：商业价值+2；媒体压力+1。'; } }
    ]},
    { id:'locker_location', stage:'post', title:'更衣柜位置', scene:'你的更衣柜被安排在队内核心旁边。装备经理说只是巧合，记者却已经把它解读成球队地位暗示。', choices:[
      { label:'主动向核心请教', hint:'把距离变成学习机会', apply:function() { addProfileDelta('lockerRoomTrust', 2); addSeasonMod('teamChemistry', 1, -10, 10); return '你第一天就问了三个战术问题。老将没有多说，只把自己的录像清单发给了你。<br><br>效果：更衣室信任+2；球队默契+1。'; } },
      { label:'不回应外界解读', hint:'保持新秀姿态', apply:function() { addProfileDelta('mediaTrust', 1); return '你只说每个柜子都一样。话题很快过去，更衣室也没人觉得你在抢位置。<br><br>效果：媒体信任+1。'; } }
    ]},
    { id:'midnight_coach_call', stage:'post', title:'教练的深夜电话', scene:'抵达酒店的第一晚，主教练在午夜打来电话。他没有祝贺，只问你能不能在训练营先从防守和无球做起。', choices:[
      { label:'接受从小角色做起', hint:'先争取上场时间', apply:function() { addProfileDelta('coachTrust', 2); addProfileDelta('leadership', -1); return '你答应先把每次轮转做对。教练说：很好，明早七点见。<br><br>效果：教练信任+2；领导力-1。'; } },
      { label:'争取持球机会', hint:'提前说清自己的能力', apply:function() { addProfileDelta('leadership', 1); addProfileDelta('coachTrust', -1); return '你解释了自己最有价值的打法。电话那头沉默了几秒：训练营里证明给我看。<br><br>效果：领导力+1；教练信任-1。'; } }
    ]},
    { id:'city_welcome', stage:'post', title:'抵达新城市', scene:'机场外已经站着一群穿球队球衣的球迷。团队准备了后门通道，但现场有人举着写有你名字的手牌。', choices:[
      { label:'走正门和球迷见面', hint:'建立第一批本地支持者', apply:function() { addProfileDelta('fanSupport', 2); addProfileDelta('fame', 1); addSeasonMod('staminaLoad', 1, -10, 10); return '你签完最后一件球衣才离开。到酒店已经很晚，但这座城市第一次像主场。<br><br>效果：球迷支持+2；人气+1；体能负荷+1。'; } },
      { label:'走后门先去休息', hint:'保持训练状态', apply:function() { addSeasonMod('formVariance', -1, -10, 10); addProfileDelta('fanSupport', -1); return '你避开了人群。训练师满意你的安排，少数等候很久的球迷却有些失望。<br><br>效果：状态波动-1；球迷支持-1。'; } }
    ]},
    { id:'rookie_group_chat', stage:'post', title:'新秀群聊', scene:'同届新秀建了一个群，大家在里面比较合同、号码和媒体评分。有人把你的顺位当成玩笑的素材。', choices:[
      { label:'用玩笑回应', hint:'融入同届球员', apply:function() { addProfileDelta('lockerRoomTrust', 1); addProfileDelta('fanSupport', 1); return '你回了一张自嘲表情包，气氛立刻轻松下来。后来这群人真成了你联盟里的第一批朋友。<br><br>效果：更衣室信任+1；球迷支持+1。'; } },
      { label:'记住这句话', hint:'把轻视留作动力', apply:function() { addSeasonMod('formVariance', 1, -10, 10); addProfileDelta('leadership', 1); return '你没有回话，只把截图存进了训练相册。动力更强了，心态也更紧。<br><br>效果：领导力+1；状态波动+1。'; } }
    ]},
    { id:'first_misquote', stage:'post', title:'第一次被断章取义', scene:'发布会后，一条标题写成了“我比队内老将更适合首发”。你原本说的是完全不同的一句话。', choices:[
      { label:'立即发布完整录音', hint:'澄清事实，正面处理', apply:function() { addProfileDelta('mediaTrust', 2); addProfileDelta('controversy', -1); return '完整录音很快传开，标题被修改。更衣室也知道你没有说过那句话。<br><br>效果：媒体信任+2；争议-1。'; } },
      { label:'先向老将私下解释', hint:'更衣室优先', apply:function() { addProfileDelta('lockerRoomTrust', 2); addProfileDelta('mediaTrust', -1); return '老将听完只说：欢迎来到联盟。外界争论没有停，但队内没有留下误会。<br><br>效果：更衣室信任+2；媒体信任-1。'; } }
    ]},
    { id:'camp_roommate', stage:'post', title:'训练营室友', scene:'球队安排你和另一名边缘球员共享训练营公寓。他每天凌晨起床加练，也会把闹钟吵醒你。', choices:[
      { label:'跟他一起晨练', hint:'建立竞争伙伴关系', apply:function() { addProfileDelta('lockerRoomTrust', 1); addSeasonMod('staminaLoad', 1, -10, 10); addSeasonMod('teamChemistry', 1, -10, 10); return '你们从互相较劲变成彼此提醒。训练营结束时，两个人都进了轮换讨论。<br><br>效果：更衣室信任+1；球队默契+1；体能负荷+1。'; } },
      { label:'协商错开训练时间', hint:'保护睡眠和状态', apply:function() { addSeasonMod('formVariance', -1, -10, 10); addProfileDelta('mediaTrust', 1); return '你们重新排了作息，各练各的，也学会了直接沟通。<br><br>效果：状态波动-1；媒体信任+1。'; } }
    ]}
  ];

  var DRAFT_EVENT_STAGE_CHANCE = { pre: 0.9, post: 0.85 };
  var DRAFT_EVENT_PRE_COUNT = DRAFT_RANDOM_EVENTS.filter(function(event) { return event.stage === 'pre'; }).length;
  var DRAFT_EVENT_POST_COUNT = DRAFT_RANDOM_EVENTS.filter(function(event) { return event.stage === 'post'; }).length;
  var DRAFT_EVENT_MAX_PER_RUN = 2;
  window.PERFECT_PLAYER_DRAFT_EVENT_REPORT = {
    total: DRAFT_RANDOM_EVENTS.length,
    pre: DRAFT_EVENT_PRE_COUNT,
    post: DRAFT_EVENT_POST_COUNT,
    perRun: DRAFT_EVENT_MAX_PER_RUN,
    stageChance: DRAFT_EVENT_STAGE_CHANCE
  };
  window.pickPerfectPlayerDraftEventId = function(stage, seen) {
    seen = seen || [];
    var pool = DRAFT_RANDOM_EVENTS.filter(function(event) { return event.stage === stage && seen.indexOf(event.id) < 0; });
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
  };
  // Probability that a random event actually fires at each draft stage.
  // Why: the draft already runs a long fixed narrative chain (前夜→经纪→试训→结果→合同…),
  // so firing a guaranteed extra modal both pre- and post-draft felt like event spam.
  // Gate each stage and cap the whole draft at two events. The seen-id filter
  // keeps the pre/post pulls from repeating within one draft run.

  window.runPerfectPlayerDraftRandomEvent = function(stage, done) {
    var pending = draftPending();
    if (!pending || typeof showDraftChoiceModal !== 'function') { if (done) done(); return; }
    // Hard cap: at most two random events across the entire draft run.
    if ((pending.randomEventIds || []).length >= DRAFT_EVENT_MAX_PER_RUN) { if (done) done(); return; }
    var chance = DRAFT_EVENT_STAGE_CHANCE[stage];
    if (chance == null) chance = 0.4;
    if (Math.random() >= chance) { if (done) done(); return; }
    var id = window.pickPerfectPlayerDraftEventId(stage, pending.randomEventIds);
    var event = DRAFT_RANDOM_EVENTS.find(function(item) { return item.id === id; });
    if (!event) { if (done) done(); return; }
    pending.randomEventIds.push(event.id);
    showDraftChoiceModal('draft_random_' + event.id, event.title, event.scene, event.choices, done);
  };

  window.render_game_to_text = function () {
    var active = document.querySelector('.screen.active');
    var state = typeof STATE !== 'undefined' ? STATE : {};
    var career = state.career || {};
    var season = state.season || {};
    return JSON.stringify({
      screen: active ? active.id : null,
      character: window.PERFECT_PLAYER_PROFILE || null,
      build: { team:state.currentTeam || null, locked:state.lockedCount || 0, candidates:document.querySelectorAll('.br-player').length, historicalCandidates:document.querySelectorAll('.br-player.historical-effect-card').length, hallOfFameCandidates:document.querySelectorAll('.br-player.hall-of-fame-card').length, peakAllStarCandidates:document.querySelectorAll('.br-player.peak-all-star-card').length, candidatesUnique: (function () { var names = []; document.querySelectorAll('.br-player .bp-name').forEach(function (el) { names.push(el.textContent.trim()); }); return new Set(names).size === names.length; })(), mockAdRerollsLeft: state._mockAdRerollsLeft == null ? 3 : state._mockAdRerollsLeft, pool:window.PERFECT_PLAYER_POOL_REPORT || null },
      competition: { team:state.careerTeam || null, rosterSize:state.careerTeam && typeof NBA2K_DATA !== 'undefined' && NBA2K_DATA[state.careerTeam] ? NBA2K_DATA[state.careerTeam].length : 0, historical:state.careerTeam && typeof NBA2K_DATA !== 'undefined' && NBA2K_DATA[state.careerTeam] ? NBA2K_DATA[state.careerTeam].filter(function (p) { return p && p._sourceKind === 'historical'; }).length : 0, source:'NBA2K_DATA (current-only)' },
      career: { team:state.careerTeam || null, season:career.seasonCount || 0, record:[season.wins || 0, season.losses || 0], profile:career.profile || {}, modifiers:career.nextSeasonMods || {}, profileEffects:typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : {} },
      draftProjection: state._draftPending ? window.getPerfectPlayerDraftProjection() : null,
      draftEvents: window.PERFECT_PLAYER_DRAFT_EVENT_REPORT || null,
      seasonEvents: window.PERFECT_PLAYER_SEASON_EVENT_REPORT || null,
      seasonEventState: career._lastSeasonEventState || null,
      legacyRanking: career.legacy ? { rank:career.legacy.historicalRank || null, score:career.legacy.score || 0, top100:!!career.legacy.top100, animationComplete:!!document.querySelector('.legacy-top100-wrap[data-animation-complete="1"]') } : null,
      careerArchive: typeof CAREER_ARCHIVE_CACHE !== 'undefined' ? { count:CAREER_ARCHIVE_CACHE.length, open:!!document.getElementById('career-archive-modal'), detail:!!document.querySelector('#career-archive-modal .career-archive-detail-hero'), ranking:CAREER_ARCHIVE_CACHE.map(function(item) { return { id:item.id, name:item.name, score:item.score, historicalRank:item.historicalRank }; }) } : null,
      simulation: window.PERFECT_PLAYER_SIM_REPORT || null
    });
  };

  function registerExpandedEvents() {
    if (typeof EVENT_REGISTRY === 'undefined') return;
    var expanded = [
      { id:'ankle_landing', emoji:'🦶', title:'落地踩脚', desc:'脚踝扭伤', body:'一次争抢篮板落地时，你踩到防守人的鞋面，脚踝立刻肿了起来。队医要求你休战观察。', min:2, max:5 },
      { id:'knee_contusion', emoji:'🦵', title:'膝盖碰撞', desc:'膝盖挫伤', body:'突破过程中对手的膝盖撞上你的膝侧。影像检查没有结构损伤，但疼痛让你无法正常发力。', min:2, max:4 },
      { id:'finger_jam', emoji:'🖐️', title:'手指戳伤', desc:'手指关节扭伤', body:'抢断时篮球正面撞上指尖。你坚持打完比赛，赛后手指已经无法弯曲。', min:1, max:3 },
      { id:'back_spasm', emoji:'⚕️', title:'背部痉挛', desc:'背部痉挛', body:'连续客场和高负荷训练引发背部痉挛，队医建议暂停对抗训练并进行恢复。', min:2, max:6 },
      { id:'hamstring_tightness', emoji:'🩹', title:'腿筋拉紧', desc:'腿筋不适', body:'一次全速回防后，你感觉大腿后侧突然发紧。球队选择谨慎处理，避免演变成拉伤。', min:2, max:5 },
      { id:'shoulder_stinger', emoji:'💥', title:'肩部撞击', desc:'肩部挫伤', body:'掩护碰撞让你的肩膀一阵麻木。力量测试没有通过，队医暂时不允许你上场。', min:1, max:4 },
      { id:'wrist_sprain', emoji:'🤕', title:'手腕扭伤', desc:'手腕扭伤', body:'救球时你用手掌撑地，手腕承受了全部冲击。投篮动作受到明显影响。', min:2, max:5 },
      { id:'calf_strain', emoji:'🩺', title:'小腿拉伤', desc:'小腿肌肉拉伤', body:'启动的一瞬间，小腿像被拉住一样疼。检查确认轻度肌肉拉伤，需要一段恢复期。', min:4, max:8 },
      { id:'rib_bruise', emoji:'🛡️', title:'肋骨挫伤', desc:'肋骨挫伤', body:'冲击篮筐时你被撞出底线，肋部重重磕在摄影席。呼吸疼痛迫使你休战。', min:2, max:5 },
      { id:'concussion_protocol', emoji:'🧠', title:'触发脑震荡保护程序', desc:'脑震荡观察', body:'防守回合中你与对手头部相撞。虽然意识清醒，联盟保护程序仍要求你通过全部检测。', min:3, max:7 },
      { id:'meniscus_major', emoji:'🏥', title:'半月板损伤', desc:'半月板损伤', body:'一次急停变向后，膝盖出现卡顿和肿胀。进一步检查确认半月板损伤，你将长期缺阵。', min:18, max:32, major:true },
      { id:'achilles_major', emoji:'🚑', title:'跟腱重伤', desc:'跟腱损伤', body:'无对抗启动时，你突然回头看向身后，像是有人踢了你。检查结果让整个更衣室沉默。', min:35, max:55, major:true }
    ];
    expanded.forEach(function (def) {
      var id = 'injury_pp_' + def.id;
      if (EVENT_REGISTRY.some(function (event) { return event.id === id; })) return;
      EVENT_REGISTRY.push({
        id: id,
        name: def.title,
        weight: def.major ? 2 : 5,
        majorInjury: !!def.major,
        condition: function () { return true; },
        execute: function () {
          var games = def.min + Math.floor(Math.random() * (def.max - def.min + 1));
          return { emoji:def.emoji, title:def.title, body:def.body, desc:def.desc, _consequence:'injury', _games:games, _majorInjury:!!def.major };
        }
      });
    });
    window.PERFECT_PLAYER_EVENT_REPORT = { added: expanded.length, total: EVENT_REGISTRY.length };
  }

  function applyExpandedSeasonChoice(choice) {
    Object.keys(choice.profile || {}).forEach(function (key) {
      addProfileDelta(key, choice.profile[key]);
    });
    var modBounds = {
      injuryRiskBonus:[-4, 8], formVariance:[-10, 10], teamChemistry:[-10, 10],
      moraleBonus:[-10, 10], mediaPressure:[-10, 10], staminaLoad:[-10, 10]
    };
    Object.keys(choice.mods || {}).forEach(function (key) {
      var bounds = modBounds[key] || [-10, 10];
      addSeasonMod(key, choice.mods[key], bounds[0], bounds[1]);
    });
    return choice.result || '';
  }

  function registerExpandedSeasonEvents() {
    if (typeof STAGED_BRANCH_EVENTS === 'undefined') return;
    var definitions = [
      { id:'rookie_wall', stateContext:'rookie_wall', title:'赛季日常：撞上新秀墙', scene:'连续客场后的早晨，你第一次感觉双腿完全没有弹性。训练师说这就是新秀墙，教练下午仍安排了高强度对抗。', body:'你必须在保持竞争力和保护身体之间做决定。', choices:[
        { label:'申请减量恢复', hint:'恢复状态，但可能被认为不够硬', profile:{coachTrust:-1}, mods:{staminaLoad:-2,formVariance:-1}, result:'你和训练师完成了单独恢复，比赛日终于找回腿部力量。教练嘴上没说什么，但少给了你一组对抗。<br><br>效果：体能负荷-2；状态波动-1；教练信任-1。' },
        { label:'咬牙完成训练', hint:'争取教练认可，承担疲劳风险', profile:{coachTrust:2}, mods:{staminaLoad:2}, result:'你完成了最后一组折返跑。队友为你鼓掌，训练师却把冰袋直接塞进你手里。<br><br>效果：教练信任+2；体能负荷+2。' }
      ]},
      { id:'empty_gym', title:'赛季日常：空馆加练', scene:'赛后球馆已经熄掉一半灯，你的最后一次投篮偏得很远。助教问你：还练，还是明天再说？', body:'一次普通的失准，也可能改变你接下来一周的节奏。', choices:[
        { label:'再投一百球', hint:'用重复找回手感', profile:{coachTrust:1}, mods:{staminaLoad:1,formVariance:-1}, result:'最后二十球，你只丢了两个。离开时保安已经在等你关灯。<br><br>效果：教练信任+1；状态波动-1；体能负荷+1。' },
        { label:'收拾东西回家', hint:'接受一场普通的失准', mods:{staminaLoad:-1,moraleBonus:1}, result:'你没有惩罚自己，回家吃饭睡觉。第二天第一球空心入网。<br><br>效果：体能负荷-1；士气+1。' }
      ]},
      { id:'film_detail', title:'赛季日常：录像里的一帧', scene:'录像师停在第三节的一帧：弱侧队友已经空了，而你还盯着篮筐。房间里所有人都在等你解释。', body:'这不是一次失误复盘，而是球队在判断你愿不愿意改变。', choices:[
        { label:'承认漏看队友', hint:'用坦诚换取信任', profile:{coachTrust:1,lockerRoomTrust:1}, result:'你让录像继续播放，并主动说出下一次该怎么传。队友点了点头。<br><br>效果：教练信任+1；更衣室信任+1。' },
        { label:'解释当时的进攻判断', hint:'坚持自己的阅读', profile:{leadership:1,coachTrust:-1}, mods:{formVariance:1}, result:'你把自己的判断讲得很完整。教练认可逻辑，却提醒你：正确答案不只一个。<br><br>效果：领导力+1；教练信任-1；状态波动+1。' }
      ]},
      { id:'road_sleep', title:'赛季日常：凌晨客场', scene:'球队凌晨三点抵达酒店，第二天上午还有投篮训练。几名队友准备在大堂吃点东西再睡。', body:'漫长赛季里，作息也是比赛的一部分。', choices:[
        { label:'直接回房睡觉', hint:'优先恢复', mods:{staminaLoad:-2,formVariance:-1}, result:'你拉上窗帘，把手机调成勿扰。早上的腿依然沉，但脑子很清醒。<br><br>效果：体能负荷-2；状态波动-1。' },
        { label:'陪队友吃宵夜', hint:'增加更衣室交流', profile:{lockerRoomTrust:2}, mods:{staminaLoad:1,teamChemistry:1}, result:'一顿宵夜聊出了很多训练场上不会说的话。第二天你很困，但和队友更熟了。<br><br>效果：更衣室信任+2；球队默契+1；体能负荷+1。' }
      ]},
      { id:'autograph_line', title:'赛季日常：球员通道签名', scene:'主场比赛结束后，球员通道还站着几十个孩子。球队大巴已经在等，工作人员提醒你必须尽快离开。', body:'球迷只会记住这一次见面，你却还要打完整个赛季。', choices:[
        { label:'留下签完', hint:'回报现场球迷', profile:{fanSupport:2,fame:1}, mods:{staminaLoad:1}, result:'最后一个孩子抱着球衣跑开时，大巴司机无奈地看了表。<br><br>效果：球迷支持+2；人气+1；体能负荷+1。' },
        { label:'让球队安排下次活动', hint:'守住赛程节奏', profile:{mediaTrust:1}, mods:{staminaLoad:-1}, result:'你请工作人员登记联系方式，球队后来补办了一场签名会。<br><br>效果：媒体信任+1；体能负荷-1。' }
      ]},
      { id:'locker_music', contextId:'slump', title:'赛季日常：更衣室歌单', scene:'连败期间，更衣室安静得只剩鞋带摩擦声。队友把音响递给你：今天你来选。', body:'一张歌单不会直接赢球，但能决定大家带着什么情绪走出门。', choices:[
        { label:'放大家都会唱的歌', hint:'先把气氛拉回来', profile:{lockerRoomTrust:1}, mods:{teamChemistry:2,moraleBonus:1}, result:'副歌响起时，终于有人笑了。训练开始前，整个更衣室一起唱完最后一句。<br><br>效果：球队默契+2；士气+1；更衣室信任+1。' },
        { label:'保持安静专注', hint:'让每个人面对问题', profile:{leadership:1}, mods:{formVariance:-1}, result:'你把音响放回柜子，只说：先把今天练好。房间没有变热闹，但所有人准时走上训练场。<br><br>效果：领导力+1；状态波动-1。' }
      ]},
      { id:'practice_argument', title:'赛季日常：训练赛冲突', scene:'一次强硬防守后，{队友}把球摔在地上，说你训练时动作太大。全队停下来，看着你们。', body:'竞争可以让球队变强，也可能让裂缝越来越大。', choices:[
        { label:'先道歉再继续', hint:'控制冲突，保护关系', profile:{lockerRoomTrust:2}, mods:{teamChemistry:1}, result:'你伸手把他拉起来，下一回合仍然认真防，但收住了多余动作。<br><br>效果：更衣室信任+2；球队默契+1。' },
        { label:'告诉他比赛会更狠', hint:'坚持训练标准', profile:{leadership:1,controversy:1}, mods:{teamChemistry:-1}, result:'你没有退让。训练强度继续上升，所有人都知道今天不会轻松结束。<br><br>效果：领导力+1；争议+1；球队默契-1。' }
      ]},
      { id:'quote_context', title:'赛季日常：采访被剪短', scene:'你十分钟的采访被剪成八秒，其中一句听起来像在抱怨战术。节目组问你要不要连线解释。', body:'回应会延长热度，沉默也可能让误解留下。', choices:[
        { label:'放出完整回答', hint:'把语境交给观众', profile:{mediaTrust:2,controversy:-1}, result:'完整视频没有短片传播得快，但认真看过的人知道发生了什么。<br><br>效果：媒体信任+2；争议-1。' },
        { label:'用玩笑带过', hint:'降低冲突，保留热度', profile:{fame:1,mediaTrust:-1}, mods:{mediaPressure:1}, result:'你的表情包迅速传开，误解没有完全消失，话题却变得轻松。<br><br>效果：人气+1；媒体信任-1；媒体压力+1。' }
      ]},
      { id:'tactical_role', title:'赛季日常：临时战术角色', scene:'教练临时调整轮换，希望你下一场多做掩护和弱侧牵制，出手数可能明显下降。', body:'有些角色不会写进数据，却会直接影响胜负。', choices:[
        { label:'接受无球任务', hint:'优先球队执行', profile:{coachTrust:2}, mods:{teamChemistry:2}, result:'你整场只出手九次，却让队友得到一连串空位。教练赛后把战术板递给你看。<br><br>效果：教练信任+2；球队默契+2。' },
        { label:'争取保留持球回合', hint:'维护自己的比赛节奏', profile:{leadership:1,coachTrust:-1}, mods:{moraleBonus:1}, result:'你和教练谈了十五分钟，最终保留了几套持球战术。机会还在，要求也更高。<br><br>效果：领导力+1；士气+1；教练信任-1。' }
      ]},
      { id:'community_clinic', title:'赛季日常：社区篮球课', scene:'球队临时邀请你去社区球馆给孩子们上课，活动时间正好占用原定恢复下午。', body:'这不是大型公益项目，只是一群真的想见到你的孩子。', choices:[
        { label:'亲自去球馆', hint:'用时间换取真实连接', profile:{fanSupport:2,chinaPopularity:1}, mods:{staminaLoad:1}, result:'你把四十五分钟的活动上成了两个小时。孩子们离开时还在模仿你的脚步。<br><br>效果：球迷支持+2；中国人气+1；体能负荷+1。' },
        { label:'捐装备并视频连线', hint:'保留恢复时间', profile:{businessValue:1,fanSupport:1}, mods:{staminaLoad:-1}, result:'新篮球和球鞋先到了，你在恢复室里完成连线。距离远了一点，承诺没有缺席。<br><br>效果：商业价值+1；球迷支持+1；体能负荷-1。' }
      ]},
      { id:'social_challenge', title:'赛季日常：投篮挑战走红', scene:'队友发起的中圈投篮挑战突然走红，并点名让你接力。品牌团队希望你马上拍，训练师希望你别增加无效负荷。', body:'一段轻松视频也可能改变公众对你的印象。', choices:[
        { label:'接受挑战', hint:'和球迷一起玩', profile:{fame:2,fanSupport:1}, mods:{mediaPressure:1}, result:'你第六次终于投进，前五次打铁反而成了最受欢迎的片段。<br><br>效果：人气+2；球迷支持+1；媒体压力+1。' },
        { label:'转发但不参加', hint:'保留训练安排', profile:{mediaTrust:1}, mods:{formVariance:-1}, result:'你在评论区给队友加油，然后继续自己的训练计划。<br><br>效果：媒体信任+1；状态波动-1。' }
      ]},
      { id:'sponsor_schedule', title:'赛季日常：商业拍摄撞车', scene:'赞助商把拍摄临时提前，和球队恢复课完全重叠。合同允许你请假，但教练组会知道。', body:'职业球员的时间也会被场外价值争夺。', choices:[
        { label:'完成商业拍摄', hint:'兑现合同，牺牲恢复', profile:{businessValue:2,coachTrust:-1}, mods:{staminaLoad:2}, result:'拍摄效果很好，广告很快上线。第二天训练时，你的腿比镜头里沉得多。<br><br>效果：商业价值+2；教练信任-1；体能负荷+2。' },
        { label:'要求品牌改期', hint:'球队安排优先', profile:{coachTrust:2,businessValue:-1}, mods:{staminaLoad:-1}, result:'品牌方不太高兴，但还是改了档期。教练在恢复课点名表上看见了你。<br><br>效果：教练信任+2；商业价值-1；体能负荷-1。' }
      ]},
      { id:'family_tickets', title:'赛季日常：家乡亲友团', scene:'家乡亲友想集体来看客场比赛，人数远超你的球员赠票额度。每个人都觉得自己应该有一张。', body:'进入联盟后，家人的期待也会变得具体。', choices:[
        { label:'自己补齐所有门票', hint:'不让任何人失望', profile:{loyalty:2,businessValue:-1}, mods:{mediaPressure:1}, result:'看台上坐满了熟悉的脸。你花了不少钱，也背上了必须打好的额外压力。<br><br>效果：忠诚+2；商业价值-1；媒体压力+1。' },
        { label:'只邀请最亲近的人', hint:'提前建立边界', profile:{mediaTrust:1,loyalty:-1}, mods:{mediaPressure:-1}, result:'你把规则解释清楚。有人失望，但以后终于没人把赠票当成理所当然。<br><br>效果：媒体信任+1；忠诚-1；媒体压力-1。' }
      ]},
      { id:'home_booing', stateContext:'home_struggle', title:'赛季日常：主场嘘声', scene:'你连续投丢后，主场第一次响起明显嘘声。暂停回来，下一次触球时声音更大了。', body:'主场的期待有时比客场防守更重。', choices:[
        { label:'继续果断出手', hint:'正面穿过压力', profile:{leadership:1}, mods:{mediaPressure:1,moraleBonus:1}, result:'下一球仍然投了。球进的那一刻，嘘声变成全场起立。<br><br>效果：领导力+1；士气+1；媒体压力+1。' },
        { label:'先用防守和传球回应', hint:'重新把比赛打简单', profile:{coachTrust:1,fanSupport:1}, mods:{formVariance:-1}, result:'你没有和声音较劲，先抢下篮板、送出助攻。几分钟后，球迷重新喊起你的名字。<br><br>效果：教练信任+1；球迷支持+1；状态波动-1。' }
      ]},
      { id:'veteran_note', title:'赛季日常：老将的手写纸条', scene:'训练后，你在更衣柜里发现一张纸条，上面写着对手最常用的三个假动作，没有署名。', body:'有人在用自己的方式教你如何留在联盟。', choices:[
        { label:'找到老将当面请教', hint:'把一次提醒变成长期交流', profile:{lockerRoomTrust:2,coachTrust:1}, result:'老将没有承认纸条是他写的，只让你坐下看完一整节录像。<br><br>效果：更衣室信任+2；教练信任+1。' },
        { label:'自己研究并在比赛验证', hint:'独立消化提示', profile:{leadership:1}, mods:{formVariance:-1}, result:'第二天你连续识破两个假动作。回到替补席时，那名老将冲你点了点头。<br><br>效果：领导力+1；状态波动-1。' }
      ]},
      { id:'shoe_failure', title:'赛季日常：球鞋临场故障', scene:'热身时鞋底突然开胶。装备经理拿来一双全新备用鞋，但你从没穿它打过正式比赛。', body:'继续使用熟悉装备有风险，临时更换也会影响脚感。', choices:[
        { label:'立刻换备用鞋', hint:'安全优先，接受陌生脚感', profile:{coachTrust:1}, mods:{injuryRiskBonus:-1,formVariance:1}, result:'前几分钟脚感陌生，好在整场没有再出问题。<br><br>效果：教练信任+1；伤病风险-1；状态波动+1。' },
        { label:'让装备师紧急修补', hint:'保留熟悉感，承担隐患', mods:{injuryRiskBonus:1,moraleBonus:1}, result:'装备师用胶带和热压完成修补。你打得很顺，但每次急停都忍不住低头看鞋。<br><br>效果：士气+1；伤病风险+1。' }
      ]},
      { id:'players_meeting', title:'赛季日常：球员内部会议', scene:'教练组离开后，队长把门关上：今天只让球员说。所有人看向你，等你先开口。', body:'更衣室需要声音，也需要有人愿意听。', choices:[
        { label:'先说出球队的问题', hint:'主动承担领袖角色', profile:{leadership:2,controversy:1}, mods:{teamChemistry:1}, result:'你把最难听的话先说了，也把自己的问题放在第一条。会议很长，但没人提前离开。<br><br>效果：领导力+2；球队默契+1；争议+1。' },
        { label:'先听每个人说完', hint:'建立更深的队友信任', profile:{lockerRoomTrust:2}, mods:{teamChemistry:2}, result:'你最后一个发言，只总结大家真正重复的问题。第二天训练明显更安静也更专注。<br><br>效果：更衣室信任+2；球队默契+2。' }
      ]},
      { id:'trade_question', contextId:'deadline', title:'赛季日常：交易流言追问', scene:'截止日前，记者突然问你是否愿意长期留队。管理层没有给你任何保证，队友就在旁边换衣服。', body:'一句话可能影响球迷、队友和未来谈判。', choices:[
        { label:'公开表达留队意愿', hint:'先给球队和球迷承诺', profile:{loyalty:2,fanSupport:2}, mods:{mediaPressure:1}, result:'你的回答当晚登上本地头条。球迷更爱你，经纪人却提醒：谈判筹码少了一点。<br><br>效果：忠诚+2；球迷支持+2；媒体压力+1。' },
        { label:'只谈当前比赛', hint:'不给流言更多信息', profile:{mediaTrust:1}, mods:{mediaPressure:-1,teamChemistry:1}, result:'你说今天只关心下一场。答案没有制造标题，也没有让更衣室多想。<br><br>效果：媒体信任+1；媒体压力-1；球队默契+1。' }
      ]},
      { id:'recovery_lab', title:'赛季日常：恢复实验室', scene:'训练团队推荐一套新恢复设备，数据很好看，但队友说第一次使用后整晚都睡不好。', body:'科技能提供答案，也会带来新的不确定。', choices:[
        { label:'尝试新方案', hint:'恢复更快，存在适应波动', profile:{coachTrust:1}, mods:{staminaLoad:-2,formVariance:1}, result:'腿部恢复数据明显变好，睡眠却乱了两天。团队决定继续微调。<br><br>效果：体能负荷-2；状态波动+1；教练信任+1。' },
        { label:'坚持传统恢复', hint:'稳定优先', mods:{staminaLoad:-1,formVariance:-1}, result:'你继续冰敷、拉伸和睡眠管理。变化不惊人，但每天都可预测。<br><br>效果：体能负荷-1；状态波动-1。' }
      ]},
      { id:'team_dinner', stateContext:'road_win', title:'赛季日常：客场聚餐账单', scene:'客场赢球后，全队一起吃饭。账单被放到你面前，大家笑着说新合同的人该请客。', body:'更衣室的规矩常常不会写进任何手册。', choices:[
        { label:'爽快买单', hint:'用一次聚餐拉近关系', profile:{lockerRoomTrust:2,businessValue:-1}, mods:{teamChemistry:2}, result:'你签下账单，全桌开始喊你的名字。第二天训练，传给你的球明显更多了。<br><br>效果：更衣室信任+2；球队默契+2；商业价值-1。' },
        { label:'提议AA并开个玩笑', hint:'建立边界，也不破坏气氛', profile:{mediaTrust:1}, mods:{teamChemistry:1}, result:'大家笑着掏出手机转账。你没按旧规矩来，但也没有让场面冷掉。<br><br>效果：媒体信任+1；球队默契+1。' }
      ]},
      { id:'weather_delay', title:'赛季日常：暴雪滞留', scene:'客场城市遭遇暴雪，球队被困在酒店。原定训练取消，会议室和小健身房成了仅有的活动空间。', body:'意外空出的一天，可以恢复，也可以变成额外准备。', choices:[
        { label:'组织全队看录像', hint:'把滞留变成战术准备', profile:{leadership:1,coachTrust:1}, mods:{teamChemistry:1}, result:'你们在酒店会议室把下一场战术过了两遍。教练到场时，球员已经自己开始讨论。<br><br>效果：领导力+1；教练信任+1；球队默契+1。' },
        { label:'彻底休息一天', hint:'利用意外恢复身体', mods:{staminaLoad:-2,moraleBonus:1}, result:'你睡了一个完整午觉，晚上和队友玩牌。航班恢复时，每个人都轻松了一点。<br><br>效果：体能负荷-2；士气+1。' }
      ]}
    ];
    var extraDefinitions = window.PERFECT_PLAYER_EXTRA_SEASON_EVENT_DEFINITIONS || [];
    definitions = definitions.concat(extraDefinitions);
    var added = [];
    definitions.forEach(function (def) {
      var id = 'pp_season_' + def.id;
      if (STAGED_BRANCH_EVENTS.some(function (event) { return event.id === id; })) return;
      var event = {
        id: id,
        branch: 'pp_moment_' + def.id,
        phase: 'season',
        slot: 'main',
        weight: 10,
        topicId: def.topicId || def.id,
        contextId: def.contextId || null,
        stateContext: def.stateContext || null,
        title: def.title,
        scenes: [def.scene],
        body: def.body,
        choices: def.choices.map(function (choice) {
          return {
            label: choice.label,
            hint: choice.hint,
            apply: function () { return applyExpandedSeasonChoice(choice); }
          };
        })
      };
      STAGED_BRANCH_EVENTS.push(event);
      added.push(id);
    });
    var seasonTotal = STAGED_BRANCH_EVENTS.filter(function (event) {
      var phases = event.phases || [event.phase || 'offseason'];
      return phases.indexOf('season') >= 0;
    }).length;
    window.PERFECT_PLAYER_SEASON_EVENT_REPORT = {
      added: added.length,
      ids: added,
      totalSeason: seasonTotal,
      config: typeof SEASON_BRANCH_EVENT_CONFIG !== 'undefined' ? SEASON_BRANCH_EVENT_CONFIG : null,
      openingPoolOnly: true
    };
    if (window.PERFECT_PLAYER_EVENT_REPORT) window.PERFECT_PLAYER_EVENT_REPORT.seasonAdded = added.length;
  }

  registerExpandedEvents();
  registerExpandedSeasonEvents();
  if (typeof window.renderCharacterCreator === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', window.renderCharacterCreator);
    } else {
      window.renderCharacterCreator();
    }
  }
})();
