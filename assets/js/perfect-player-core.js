/* ============================================================
   BuildPlayer - 核心游戏逻辑
   ============================================================ */

// ==================== 游戏状态 ====================
const STATE = {
  mode: null,           // 'current' | 'legend'
  position: null,       // 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  
  // 建球员
  attrs: {},            // { threePT: 75, ... } 锁定后的值
  attrSlots: {},        // { threePT: { player, team, value }, ... }
  lockedCount: 0,
  usedPlayers: [],      // 已选球员名列表
  buildRoster: [],      // 建球员阶段先选中的13人
  buildPhase: 'recruit', // recruit | lottery | done
  
  // Build phase state
  buildStep: 'select',  // 'select' | 'spin' | 'pick'
  selectedAttr: null,   // currently selected attribute key
  
  // 当前 spin
  currentTeam: null,    // 'LAL'
  currentRoster: [],    // 该队球员列表
  _shownThisTeam: [],   // 当前球队已展示过的球员名
  _rerollsLeft: 999,  // 更换球员无限次数（不再扣减）
  _mockAdRerollsLeft: 999, // 广告补次已不再使用
  _teamsVisited: [],  // 抽到过的球队列表
  _drawPlayers: [],   // 当前这一轮展示的5名球员（同轮不重复）
  
  // 选中球员状态
  selectedPlayer: null, // 当前选中球员
  _locking: false,      // 防止连点
  
  // 揭幕后
  finalOVR: 0,
  finalPosition: null,
  finalArchetype: null,
  careerTeam: null,     // 分配到的球队
  
  // 赛季
  season: {
    games: [],          // 所有比赛结果
    wins: 0,
    losses: 0,
    playerStats: {},    // { pts, reb, ast, stl, blk }
    playoffStats: {},   // { pts, reb, ast, stl, blk, games: 0 } 季后赛单独统计
    awards: [],
    playoffResult: null,
    standings: {},      // { team: { wins, losses } }
    isPlayoffs: false,
    playoffBracket: null,
    events: { suspensionGamesLeft: 0, suspensionReason: '', injuryGamesLeft: 0, injuryReason: '', triggeredIds: [], storyTimeline: [], lastTriggerGameNum: null, playoffEventCount: 0, injuryRiskBonus: 0, majorInjuryThisSeason: false, playThroughPrompted: {}, regularPlayThroughPromptCount: 0 },
  },

  // 生涯
  career: {
    seasonCount: 0,
    currentAge: 22,
    contract: 4,
    seasons: [],
    totalStats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, games: 0, mins: 0 },
    playoffStats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, games: 0, mins: 0 },
    honors: [],
    offseasonHistory: [],
    branchHistory: [],
    _seenCareerEventIds: [],
    _seenSeasonEventIds: [],
    _seasonEventPlayCounts: {},
    branches: {},
    profile: { fame: 0, businessValue: 0, mediaTrust: 0, controversy: 0, chinaPopularity: 0, loyalty: 0, leadership: 0, coachTrust: 0, lockerRoomTrust: 0, fanSupport: 0, legacyBonus: 0 },
    relationships: {},
    flags: {},
    draft: null,
    mobility: null,
    nextSeasonMods: { injuryRiskBonus: 0, formVariance: 0, teamChemistry: 0, moraleBonus: 0, mediaPressure: 0, staminaLoad: 0 },
    annualChangeSeason: 0,
    offseasonEventSeason: 0,
    skills: { points: 0, earned: 0, purchased: {}, lastGrant: null },
  },
};

// ==================== UI 工具 ====================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function getSeasonLabel(seasonNum) {
  var n = Math.max(1, parseInt(seasonNum) || 1);
  var start = 2025 + n;
  return start + '-' + String((start + 1) % 100) + '赛季';
}

function getCurrentSeasonLabel() {
  var count = STATE.career && STATE.career.seasonCount ? STATE.career.seasonCount : 0;
  return getSeasonLabel(count + 1);
}

function getNextSeasonMods() {
  var defaults = { injuryRiskBonus: 0, formVariance: 0, teamChemistry: 0, moraleBonus: 0, mediaPressure: 0, staminaLoad: 0 };
  if (!STATE.career) return defaults;
  STATE.career.nextSeasonMods = Object.assign(defaults, STATE.career.nextSeasonMods || {});
  return STATE.career.nextSeasonMods;
}

function clearSeasonModsForNewOffseason() {
  if (!STATE.career) return;
  STATE.career.nextSeasonMods = { injuryRiskBonus: 0, formVariance: 0, teamChemistry: 0, moraleBonus: 0, mediaPressure: 0, staminaLoad: 0 };
  refreshPlayerStateStripLive();
}

function updateSeasonBadge(activeId) {
  var el = document.getElementById('seasonBadge');
  if (!el) return;
  if (!activeId) {
    var cur = document.querySelector('.screen.active');
    activeId = cur ? cur.id : '';
  }
  if (activeId === 'screen-season' || activeId === 'screen-menu') { el.style.display = 'none'; return; }
  el.style.display = '';
  var label = '2025-26赛季';
  try { label = getCurrentSeasonLabel(); } catch(e) {}
  el.innerHTML = '<span style="display:inline-block;background:var(--bg-card);border:1px solid var(--border);border-radius:999px;padding:4px 12px;box-shadow:var(--shadow);">🏀 ' + label + '</span>';
}

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  updateSeasonBadge(id);
}

function html(id, content) {
  const el = document.getElementById(id);
  if (el && content !== undefined) el.innerHTML = content;
  return el;
}

// 事件/选择结果修改数值后立即刷新状态条，不再等到下一年或重新进入赛季页。
function refreshPlayerStateStripLive() {
  var current = document.getElementById('player-state-strip');
  if (!current || typeof renderPlayerStateStrip !== 'function') return;
  var currentDetails = current.querySelector('.player-state-details');
  var detailsWereOpen = !!(currentDetails && currentDetails.open);
  var parent = current.parentNode;
  if (!parent) return;
  var htmlText = renderPlayerStateStrip();
  if (!htmlText) return;
  current.outerHTML = htmlText;
  var next = document.getElementById('player-state-strip');
  if (next) {
    var nextDetails = next.querySelector('.player-state-details');
    if (nextDetails && detailsWereOpen) nextDetails.open = true;
    next.classList.add('live-updated');
    setTimeout(function() { if (next) next.classList.remove('live-updated'); }, 650);
  }
}
window.refreshPlayerStateStripLive = refreshPlayerStateStripLive;

var _trackedExposureKeys = {};
function trackEvent(params) {
  try {
    if (window.ColorboxAI && typeof window.ColorboxAI.track === 'function') {
      window.ColorboxAI.track(params);
    }
  } catch(e) {}
}

function trackExposureOnce(el, params) {
  if (!el || !params) return;
  var key = [params.act, params.blk, params.pos, params.label || ''].join('|');
  if (_trackedExposureKeys[key]) return;
  function report() {
    if (_trackedExposureKeys[key]) return;
    _trackedExposureKeys[key] = true;
    trackEvent(params);
  }
  if (!('IntersectionObserver' in window)) { report(); return; }
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        report();
        observer.disconnect();
      }
    });
  }, { threshold: [0.5] });
  observer.observe(el);
}

// ==================== 属性工具 ====================
const ATTR_KEYS = SIM_CONFIG.ATTR_LIST;
const ATTR_CN = SIM_CONFIG.ATTR_CN;
ATTR_CN.HAN = '护球';
ATTR_CN.STA = '耐力';
const ATTR_DESC = SIM_CONFIG.ATTR_DESC;
const GRADE = SIM_CONFIG.GRADE;

function attrCN(key) { return ATTR_CN[key] || key; }
function attrDesc(key) { return ATTR_DESC[key] || ''; }
function getGrade(val) { return GRADE.getGrade(val); }
function getOvrGrade(ovr) { return GRADE.getOvrGrade(ovr); }

// 跨位置衰减已取消：无论来源球员打什么位置，锁定的都是原始属性。
function getPosPenalty(userPos, srcPos, attrKey) {
  return 1.0;
}

/** 从球员的 pos 字段提取主位置（'PG / SG' → 'PG'） */
function getPlayerMainPos(player) {
  const pos = (player.pos || 'SG').split('/')[0].trim();
  return (SIM_CONFIG.POS_AVG[pos] ? pos : 'SF');
}
// ==================== 初始化 ====================

/** 安全返回赛季页面：重新渲染后再显示，防止状态异常 */
function backToSeason() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC20",label:"返回赛季"});
  const schedule = STATE.season?.schedule;
  const hasGames = schedule && schedule.length > 0;
  if (!hasGames) { showScreen('screen-menu'); return; }
  // 重新渲染赛季UI确保状态同步
  if (typeof renderSeasonUI === 'function') renderSeasonUI();
  if (typeof renderCalendar === 'function') renderCalendar();
  showScreen('screen-season');
}

/** 从 storage 读取上次保存的球员数据并输出到控制台 */
function logSavedPlayerData() {
  Storage.waitForReady().then(function() {
    Storage.getValue('players').then(function(raw) {
      if (raw == null) { console.log('📦 暂无保存的球员数据'); return; }
      var arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : null);
      if (Array.isArray(arr) && arr.length > 0) {
        console.log('📦 已保存的球员列表 (共' + arr.length + '个):');
        arr.forEach(function(data, i) {
          console.log('  #' + (i+1), '位置:', data.position, '| 球队:', data.team, '| OVR:', data.finalOVR, '| 属性:', data.attrs);
        });
      } else { console.log('📦 暂无保存的球员数据'); }
    });
  });
}
setTimeout(logSavedPlayerData, 500);

/** 验证 ColorboxAI.storage 读写回路 */
function verifyStorage() {
  Storage.waitForReady().then(function(){
    Storage.setValue({ _ping: 'pong' }).then(function(){
      Storage.getValue('_ping').then(function(v){
        console.log('[StorageTest] setValue/getValue 回路:', v === 'pong' ? '✅ 通过' : '❌ 失败', v);
      });
    });
  });
}
setTimeout(verifyStorage, 1000);

/** 生成全局唯一游戏局ID */
function generateGameId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '-' + Math.random().toString(36).slice(2, 6);
}

var _baseLeagueRosterSnapshot = null;

function cloneLeagueData(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function captureBaseLeagueRoster() {
  if (_baseLeagueRosterSnapshot || typeof NBA2K_DATA === 'undefined' || typeof NBA2K_TEAMS === 'undefined') return;
  _baseLeagueRosterSnapshot = {};
  NBA2K_TEAMS.forEach(function(t) {
    _baseLeagueRosterSnapshot[t] = cloneLeagueData(NBA2K_DATA[t] || []);
  });
}

function restoreBaseLeagueRoster() {
  captureBaseLeagueRoster();
  if (!_baseLeagueRosterSnapshot || typeof NBA2K_DATA === 'undefined' || typeof NBA2K_TEAMS === 'undefined') return;
  NBA2K_TEAMS.forEach(function(t) {
    NBA2K_DATA[t] = cloneLeagueData(_baseLeagueRosterSnapshot[t] || []);
  });
  delete NBA2K_DATA._draftClass2026Applied;
}

function createFreshCareer() {
  return {
    seasonCount: 0,
    currentAge: 22,
    contract: 4,
    seasons: [],
    totalStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, games:0, mins:0 },
    playoffStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, games:0, mins:0 },
    honors: [],
    offseasonHistory: [],
    branchHistory: [],
    _seenCareerEventIds: [],
    _seenSeasonEventIds: [],
    _seasonEventPlayCounts: {},
    branches: {},
    profile: { fame:0, businessValue:0, mediaTrust:0, controversy:0, chinaPopularity:0, loyalty:0, leadership:0, coachTrust:0, lockerRoomTrust:0, fanSupport:0, legacyBonus:0 },
    relationships: {},
    flags: {},
    draft: null,
    mobility: null,
    nextSeasonMods: { injuryRiskBonus:0, formVariance:0, teamChemistry:0, moraleBonus:0, mediaPressure:0, staminaLoad:0 },
    annualChangeSeason: 0,
    offseasonEventSeason: 0,
    skills: { points:0, earned:0, purchased:{}, lastGrant:null }
  };
}

function initGame() {
  restoreBaseLeagueRoster();
  _rngState = null;
  _rookieNameSeq = 0;
  // 重置状态（保留 gameId 持久不变，直到下一次显式重置）
  Object.assign(STATE, {
    mode: null, position: null,
    attrs: {}, attrSlots: {}, lockedCount: 0,
    usedPlayers: [], buildRoster: [], buildPhase: 'recruit',
    buildStep: 'select', noPlayerSelected: true,
    currentTeam: null, currentRoster: [],
    _shownThisTeam: [], _rerollsLeft: 999, _mockAdRerollsLeft: 999, _teamsVisited: [], _drawPlayers: [],
    selectedPlayer: null, _locking: false,
    finalOVR: 0, finalPosition: null, finalArchetype: null,
    careerTeam: null,
    gameId: generateGameId(),
    career: createFreshCareer(),
    season: { games: [], wins: 0, losses: 0, playerStats: {}, playoffStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, mins:0, games:0 }, awards: [], playoffResult: null, playoffEliminated: false, standings: {}, isPlayoffs: false, playoffBracket: null, otherBracket: null, _viewConf: null },
  });
  delete STATE._tpPending;
  delete STATE._careerSaved;
  delete STATE._offseasonQueue;
  delete STATE._offseasonEventIdx;
  delete STATE._seasonBranchEvent;
  delete STATE._postCareerEvent;
  delete STATE._postCareerScenePage;
  delete STATE._countdownLegacyEvent;
  delete STATE._countdownLegacyScenePage;
  delete STATE._userAwardStreak;
  delete STATE._userAwardRankStreak;
  delete STATE._contractsInited;
  delete STATE._leagueChanges;
  delete STATE._freeAgentPool;
  delete STATE._draftPending;
  delete STATE._draftSelfPick;
  delete STATE._draftModalStep;
  delete STATE._draftSceneStep;
  delete STATE._draftResultDone;
  delete STATE._mobilityChoice;
  clearLineupCache();
  
  try { attachOfficialPlayerHeadshots(); } catch(e) {}
  try { applyDraftClass2026(); } catch(e) {}

  // 属性槽初始化为空
  ATTR_KEYS.forEach(k => { STATE.attrs[k] = null; STATE.attrSlots[k] = null; });
  
  showScreen('screen-menu');
  renderModeSelect();
}

// ==================== 1. 模式选择 ====================
function renderModeSelect() {
  const container = html('feature-grid');
  container.innerHTML = '';
  
  // 保留虎扑原模式卡布局，只移除未实现的传奇占位模式。
  const cards = [
    {
      tag: 'Current',
      tagClass: 'gold',
      title: '生涯模式',
      sub: '从现役球员中夺取属性，组建我的球员',
      btnLabel: '🎮 进入活动',
      mode: 'current',
    },
  ];
  
  cards.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'feature-card';
    if (c.disabled) card.classList.add('disabled-card');
    if (c.mode === 'current') card.classList.add('selected');
    card.innerHTML = `
      <span class="fc-tag ${c.tagClass}">${c.tag}</span>
      <div class="fc-title">${c.title}</div>
      <div class="fc-sub">${c.sub}</div>
      <button class="fc-btn" ${c.disabled ? 'disabled' : ''}>
        ${c.btnLabel}
      </button>
      
    `;
    const btn = card.querySelector('.fc-btn');
    if (!c.disabled) {
      btn.onclick = (e) => {
        trackEvent({act:"click",blk:"BMC098",pos:"TC1",label:"开始游戏"});
        e.stopPropagation();
        STATE.mode = c.mode;
        startGame();
      };
    }
    container.appendChild(card);
    if (c.mode === 'current') {
      var mainBtn = card.querySelector('.fc-btn');
      if (mainBtn) {
        mainBtn.insertAdjacentHTML('afterend', '<button type="button" class="fc-btn" id="continue-activity-btn" style="margin-top:10px;background:#2f6fed;box-shadow:0 4px 0 #1d4fb8;" onclick="event.stopPropagation();manualLoadGame(1)">▶ 继续活动</button>' +
          '<button class="fc-btn career-archive-home-btn" id="career-archive-btn" onclick="event.stopPropagation();showCareerArchive()">🏛️ 生涯档案馆 <span id="career-archive-count">0</span></button>');
      }
    }
  });

  STATE.mode = 'current';
  refreshContinueActivityButton();
  refreshCareerArchiveButton();
}

async function startGame() {
  if (window.PERFECT_PLAYER_DATA_READY) await window.PERFECT_PLAYER_DATA_READY;
  if (STATE.mode === 'current') {
    showCharacterCreate();
  } else {
    alert('该模式开发中');
  }
}

function beginAttributeBuild() {
  STATE.position = null;
  STATE.selectedPlayer = null;
  STATE.currentTeam = null;
  STATE.buildPhase = 'recruit';
  STATE.buildRoster = [];
  STATE.usedPlayers = [];
  STATE.lockedCount = 0;
  STATE._lotteryOrder = null;
  STATE._lotteryIndex = 0;
  STATE._lotterySpinning = false;
  if (STATE._lotteryTimer) {
    clearTimeout(STATE._lotteryTimer);
    STATE._lotteryTimer = null;
  }
  ATTR_KEYS.forEach(function(k) { STATE.attrs[k] = null; STATE.attrSlots[k] = null; });
  showScreen('screen-build');
  renderBuildUI();
  renderTeamPicker();
}

// ==================== 2. 位置选择（属性锁定之后） ====================
function renderPositionSelect() {
  const grid = html('pos-grid');
  grid.innerHTML = '';
  const attrsReady = STATE.lockedCount >= 13;
  const icons = { PG: '🎯', SG: '🔥', SF: '🏃', PF: '💪', C: '🧱' };
  var bestPos = null;
  var bestOvr = -1;
  var ovrByPos = {};
  if (attrsReady) {
    SIM_CONFIG.POS_LIST.forEach(function(pos) {
      var ovr = calcOVR(STATE.attrs, pos);
      ovrByPos[pos] = ovr;
      if (ovr > bestOvr) { bestOvr = ovr; bestPos = pos; }
    });
  }
  SIM_CONFIG.POS_LIST.forEach(pos => {
    const card = document.createElement('div');
    card.className = 'pos-card' + (STATE.position === pos ? ' selected' : '');
    var ovrLine = attrsReady
      ? '<div class="pos-ovr">OVR ' + ovrByPos[pos] + (pos === bestPos ? ' · 最高' : '') + '</div>'
      : '';
    card.innerHTML = `
      <div class="pos-label">${SIM_CONFIG.POSITIONS[pos]}</div>
      <div class="pos-en">${icons[pos] || ''} ${pos}</div>
      ${ovrLine}
    `;
    card.onclick = () => {
      $$('.pos-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      STATE.position = pos;
    };
    grid.appendChild(card);
  });
}

function confirmPosition() {
  if (!STATE.position && STATE.lockedCount >= 13) {
    var best = null, bestOvr = -1;
    SIM_CONFIG.POS_LIST.forEach(function(pos) {
      var ovr = calcOVR(STATE.attrs, pos);
      if (ovr > bestOvr) { bestOvr = ovr; best = pos; }
    });
    STATE.position = best;
  }
  if (!STATE.position) return;
  if (STATE.lockedCount >= 13) {
    revealPlayer();
    return;
  }
  beginAttributeBuild();
}

// ==================== 3. 建球员 - LEFT-RIGHT SPLIT ====================

function renderBuildUI() {
  var pi = document.getElementById('build-pos-indicator');
  if (pi) {
    if (STATE.buildPhase === 'lottery') pi.textContent = '十三人已到齐，正在抽取每人贡献的属性';
    else if (STATE.buildPhase === 'done' && STATE.position) pi.textContent = '我选择的位置：' + (SIM_CONFIG.POSITIONS[STATE.position] || STATE.position);
    else pi.textContent = '先选定十三名球员，再抽取每人贡献哪一项属性';
  }
  renderLeftAttrs();
  renderProgress();
}

function getBuildProgressCount() {
  if (STATE.buildPhase === 'recruit') return (STATE.buildRoster || []).length;
  return STATE.lockedCount || 0;
}

function renderProgress() {
  const p = document.getElementById('build-progress-area');
  if (!p) return;
  const count = getBuildProgressCount();
  const pct = Math.round((count / 13) * 100);
  const label = STATE.buildPhase === 'recruit' ? count + '/13人' : count + '/13项';
  p.innerHTML = `
    <div class="build-progress">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-text">${label}</div>
    </div>
  `;
}

/** Render left sidebar: recruited players first, then revealed attributes */
function renderLeftAttrs() {
  const ovrEl = document.getElementById('bl-ovr');
  const labelEl = document.getElementById('bl-label');
  const recruiting = STATE.buildPhase !== 'lottery' && STATE.buildPhase !== 'done' && (STATE.lockedCount || 0) < 13;
  if (labelEl) labelEl.textContent = recruiting ? '已选' : 'OVR';
  if (ovrEl) {
    if (recruiting) {
      ovrEl.textContent = String((STATE.buildRoster || []).length);
    } else {
      let ovr = STATE.finalOVR || 0;
      if (!ovr) ovr = calcOVR(STATE.attrs);
      if (!ATTR_KEYS.some(function(k) { return STATE.attrs[k] !== null; })) ovr = 0;
      ovrEl.textContent = ovr > 0 ? ovr : '--';
    }
  }

  const container = document.getElementById('bl-attrs');
  if (!container) return;
  container.innerHTML = '';

  if (recruiting) {
    for (var i = 0; i < 13; i++) {
      var pick = (STATE.buildRoster || [])[i];
      var div = document.createElement('div');
      div.className = 'ba-slot' + (pick ? ' recruited' : '');
      if (pick) {
        div.innerHTML = '<span class="ba-label">' + (i + 1) + '</span>' +
          '<span class="ba-owner">' + (pick.cname || pick.name) + '</span>' +
          '<span class="ba-pos">' + (pick.pos || '') + '</span>';
      } else {
        div.innerHTML = '<span class="ba-label">' + (i + 1) + '</span><span class="ba-empty">+</span>';
      }
      container.appendChild(div);
    }
  } else {
    ATTR_KEYS.forEach(function(key) {
      var val = STATE.attrs[key];
      var isLocked = val !== null;
      var div = document.createElement('div');
      div.className = 'ba-slot' + (isLocked ? ' locked' : '');
      if (isLocked) {
        var g = getGrade(val);
        var slot = STATE.attrSlots[key];
        var owner = '';
        if (slot && slot.player) {
          var src = (STATE.buildRoster || []).filter(function(p) { return p && p.name === slot.player; })[0];
          owner = src ? (src.cname || src.name) : getPlayerDisplayName(slot.player);
        }
        div.innerHTML = '<span class="ba-label">' + attrCN(key) + '</span>' +
          '<span class="ba-grade" style="color:' + g.color + '">' + g.letter + '</span>' +
          '<span class="ba-owner">' + owner + '</span>';
      } else {
        div.innerHTML = '<span class="ba-label">' + attrCN(key) + '</span><span class="ba-empty">+</span>';
      }
      container.appendChild(div);
    });
  }

  const footer = document.getElementById('bl-footer');
  if (footer) footer.innerHTML = '';
}

/** Render slot machine — 3 buttons (no reroll limit, forced choice) */
function renderTeamPicker() {
  const slotArea = document.getElementById('br-slot-area');
  if (!slotArea) return;
  
  const sorted = [...NBA2K_TEAMS].sort();
  const copies = 5;
  const allItems = [];
  for (let c = 0; c < copies; c++) {
    sorted.forEach(t => allItems.push(t));
  }
  
  let itemsHtml = '';
  allItems.forEach(t => {
    const cn = SIM_CONFIG.TEAM_NAMES[t] || t;
    itemsHtml += `<div class="br-slot-item" data-team="${t}">${cn}</div>`;
  });
  
  slotArea.innerHTML = buildSlotHTML(itemsHtml);
  
  const reel = document.getElementById('slot-reel');
  if (reel) {
    const offset = sorted.length * 38;
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${offset}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
  }
  
  const rosterArea = document.getElementById('br-roster-area');
  if (rosterArea) rosterArea.innerHTML = '';
}

/** 只更新按钮状态，不重建老虎机HTML（防止跳动）*/
/** 更换球员按钮（三态：有次数 / 广告加载中 / 看广告获得次数） */
function getRerollButtonHtml() {
  var hasTeam = !!STATE.currentTeam;
  return '<button class="btn btn-sm slot-btn" onclick="rerollTeamPlayers()"' +
    (hasTeam ? '' : ' disabled style="opacity:0.3;"') +
    '>👥 更换球员</button>';
}

function updateSlotButtons() {
  const slotArea = document.getElementById('br-slot-area');
  if (!slotArea) return;
  
  const hasTeam = !!STATE.currentTeam;
  const canSpin = !_slotSpinning && STATE.buildPhase !== 'lottery';
  
  // Rebuild only the actions area, keep reel intact
  const actionsEl = slotArea.querySelector('.br-slot-actions');
  if (actionsEl) {
    actionsEl.innerHTML = `
      <button class="btn btn-sm slot-btn" onclick="pullHandle()"
        ${canSpin ? '' : 'disabled'}
        style="background:var(--orange);color:#fff;${canSpin ? '' : 'opacity:0.3;'}">
        🎲 随机球队
      </button>
      ${getRerollButtonHtml()}
    `;
  }
}

function buildSlotHTML(itemsHtml) {
  const hasTeam = !!STATE.currentTeam;
  const canSpin = !_slotSpinning && STATE.buildPhase !== 'lottery';
  return `
    <div class="br-slot-area">
      <div class="br-slot-label">🎰 随机选队</div>
      <div class="br-slot-wrapper">
        <div class="br-slot-machine">
          <div class="br-slot-reel" id="slot-reel">
            ${itemsHtml}
          </div>
        </div>
      </div>
      <div class="br-slot-actions">
        <button class="btn btn-sm slot-btn" onclick="pullHandle()"
          ${canSpin ? '' : 'disabled'}
          style="background:var(--orange);color:#fff;${canSpin ? '' : 'opacity:0.3;'}">
          🎲 随机球队
        </button>
        ${getRerollButtonHtml()}
      </div>
    </div>
  `;
}

let _slotSpinning = false;

function pullHandle() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC3",label:"随机球队-建球员"});
  if (_slotSpinning || STATE.buildPhase === 'lottery') return;
  
  // Visual: flash the reel to show it's spinning
  const reel = document.getElementById('slot-reel');
  if (reel) reel.classList.add('spinning');
  
  setTimeout(spinSlotMachine, 200);
}

function spinSlotMachine() {
  if (_slotSpinning) return;
  _slotSpinning = true;
  
  const reel = document.getElementById('slot-reel');
  if (!reel) { _slotSpinning = false; return; }
  
  const sorted = [...NBA2K_TEAMS].sort();
  const teamCount = sorted.length;
  const itemH = 38;
  const copyLen = teamCount * itemH; // 一个完整复制的高度
  
  // 随机目标球队
  const targetIdx = Math.floor(Math.random() * teamCount);
  const targetTeam = sorted[targetIdx];
  
  // 目标位置：让 target 出现在窗口中间（第2个可见位）
  // 窗口显示3项，中间项索引=1，所以偏移到 targetIdx-1
  const snapIdx = (targetIdx - 1 + teamCount) % teamCount;
  
  // 落到第3个复制块（索引2），留出上下缓冲
  const targetY = copyLen * 2 + snapIdx * itemH;
  
  // 获取当前位置
  const curMatch = reel.style.transform.match(/([\d.]+)/);
  const curY = curMatch ? parseFloat(curMatch[0]) : copyLen;
  
  // 保证至少转半圈
  let finalY = targetY;
  const minSpin = copyLen * 0.5;
  while (finalY <= curY + minSpin) finalY += copyLen;
  
  // 防止超出边界（5个复制块上限）
  const maxY = copyLen * 4 - itemH * 2;
  if (finalY > maxY) {
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${copyLen}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
    finalY = targetY + copyLen;
  }
  
  // 执行旋转动画
  reel.classList.add('spinning');
  reel.style.transform = `translateY(-${finalY}px)`;
  
  // 动画结束后，精确回正到目标位置（去掉过渡，直接对齐）
  setTimeout(() => {
    reel.classList.remove('spinning');
    
    // ★ 关键修复：无过渡跳转到精确位置，确保显示正确
    const exactY = copyLen * 3 + snapIdx * itemH; // 落到第4复制块中间区
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${exactY}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
    
    // ★ 高亮中间项（窗口3项，snapIdx为顶部，中间=snapIdx+1）
    var middleIdx = teamCount * 3 + snapIdx + 1;
    highlightSlotItem('slot-reel', middleIdx);
    
    // 同步状态
    STATE.currentTeam = targetTeam;
    if (STATE._teamsVisited.indexOf(targetTeam) === -1) {
      STATE._teamsVisited.push(targetTeam);
      console.log('[Build] 已访问球队:', STATE._teamsVisited.join(', '));
    }
    STATE.selectedPlayer = null;
    STATE._shownThisTeam = [];
    _slotSpinning = false;
    
    renderLeftAttrs();
    updateSlotButtons();
    showTeamRoster(targetTeam);
  }, 2800);
}

/** 仅用于建模阶段的候选池；正式比赛始终读取 NBA2K_DATA 现役名单。 */
function getBuildPlayerPool(team) {
  return (window.PERFECT_PLAYER_BUILD_DATA && window.PERFECT_PLAYER_BUILD_DATA[team]) || NBA2K_DATA[team] || [];
}

function getBuildHistoricalSurprisePool(team) {
  return (window.PERFECT_PLAYER_HISTORICAL_SURPRISE_DATA && window.PERFECT_PLAYER_HISTORICAL_SURPRISE_DATA[team]) || [];
}

// 历史球员是低概率惊喜卡，不再像普通候选一样每轮固定出现。
const HISTORICAL_SURPRISE_DRAW_CHANCE = 0.20;

/** 从12名现役池抽一轮固定5张卡；最多插入1张巅峰惊喜卡。巅峰版与现役版视为不同卡。 */
function drawBuildPlayers(pool, count, team) {
  const source = Array.isArray(pool) ? pool.filter(Boolean) : [];
  const targetCount = Math.min(count || 5, source.length);
  const shuffled = shuffleArr(source.slice());
  const historical = shuffleArr(getBuildHistoricalSurprisePool(team).filter(Boolean));
  if (historical.length && targetCount >= 1 && Math.random() < HISTORICAL_SURPRISE_DRAW_CHANCE) {
    const currentCards = shuffled.slice(0, Math.max(0, targetCount - 1));
    const historicalCard = historical[0];
    return shuffleArr(currentCards.concat(historicalCard));
  }
  return shuffled.slice(0, targetCount);
}

/** Show team roster — 5 random players (below the slot machine) */
function showTeamRoster(team) {
  const rosterArea = document.getElementById('br-roster-area');
  if (!rosterArea) return;
  
  const players = getBuildPlayerPool(team);
  if (!players.length) {
    STATE._drawPlayers = [];
    rosterArea.innerHTML = `<div class="br-hint">❌ 球员池加载失败，请重新进入建球员</div>`;
    return;
  }

  const shown = drawBuildPlayers(players, 5, team);
  STATE._drawPlayers = shown;
  
  // 仅保留展示历史用于存档/调试，不参与下一轮抽取过滤，否则抽到第4轮会不足5人。
  shown.forEach(p => {
    if (!STATE._shownThisTeam.includes(p.name)) STATE._shownThisTeam.push(p.name);
  });
  
  renderRosterPlayers(team, shown, players);
}

/** 渲染球员列表 */
function renderRosterPlayers(team, shown, allPool) {
  const rosterArea = document.getElementById('br-roster-area');
  if (!rosterArea) return;
  
  const hasHallOfFame = shown.some(p => p._sourceKind === 'historical' && p._historicalTier === 'hall-of-fame');
  const arrivalHtml = hasHallOfFame
    ? '<div class="hall-of-fame-arrival"><span>✦</span><b>名人堂球星降临</b><span>✦</span></div>'
    : '';
  let listHtml = `<div style="display:flex;align-items:center;gap:6px;padding-bottom:4px;flex-wrap:wrap;">
    <span style="font-size:13px;font-weight:700;font-family:var(--font-display);letter-spacing:1px;">${getTeamName(team)}</span>
    <span style="font-size:11px;color:var(--text-dim);">本轮抽取 ${shown.length} 人 · 同轮不重复 · 名人堂惊喜低概率出现</span>
  </div>${arrivalHtml}<div class="br-roster-list" style="max-height:none;">`;
  
  shown.forEach((p, drawIndex) => {
    const sel = STATE.selectedPlayer === p || (STATE.selectedPlayer && STATE.selectedPlayer.name === p.name);
    const playerPos = getPlayerMainPos(p);
    const hsStyle = getPlayerHeadshotStyle(p, 32);
    const ovrGrade = getOvrGrade(parseInt(p.ovr) || 50);
    const historicalCard = p._sourceKind === 'historical';
    const hallOfFame = p._sourceKind === 'historical' && p._historicalTier === 'hall-of-fame';
    const peakAllStar = historicalCard && !hallOfFame;
    const used = (STATE.usedPlayers || []).indexOf(p.name) >= 0;
    listHtml += `<div class="br-player${historicalCard ? ' historical-effect-card' : ''}${hallOfFame ? ' hall-of-fame-card' : ''}${peakAllStar ? ' peak-all-star-card' : ''}${sel ? ' selected' : ''}${used ? ' used' : ''}" data-draw-index="${drawIndex}" ${used ? '' : 'onclick="pickPlayerAt(' + drawIndex + ')"'}>
      <div class="bp-left">
        <div class="bp-headshot" style="${hsStyle}"></div>
        <div>
          <div class="bp-name">${p.cname || p.name}</div>
          <div class="bp-detail">${playerPos}${p._sourceKind === 'historical' ? ' · ' + (p._historicalTier === 'hall-of-fame' ? '名人堂惊喜' : '近代全明星惊喜') + (p._historicalPeak ? ' · 巅峰' : '') : ''}</div>
        </div>
      </div>
      <div class="bp-meta">
        ${hallOfFame ? '<span class="hall-of-fame-badge">HOF</span>' : (peakAllStar ? '<span class="peak-all-star-badge">PEAK</span>' : '')}
        <span class="bp-ovr">${p.ovr}</span>
      </div>
    </div>`;
  });
  
  listHtml += '</div>';
  
  listHtml += `<div style="display:flex;gap:6px;padding:4px 0;flex-wrap:wrap;align-items:center;">
    <span style="font-size:10px;color:var(--accent);margin-left:auto;font-weight:600;">
      👆 点选一名球员加入阵容
    </span>
  </div>`;
  
  rosterArea.innerHTML = listHtml;
}

/** 当前球队内换一批球员 */
function rerollTeamPlayers() {
  if (!STATE.currentTeam || STATE.buildPhase === 'lottery') return;
  
  const players = getBuildPlayerPool(STATE.currentTeam);
  if (!players.length) {
    return;
  }
  const shown = drawBuildPlayers(players, 5, STATE.currentTeam);
  STATE._drawPlayers = shown;
  
  shown.forEach(p => {
    if (!STATE._shownThisTeam.includes(p.name)) STATE._shownThisTeam.push(p.name);
  });
  
  STATE.selectedPlayer = null;
  renderLeftAttrs();
  updateSlotButtons();
  renderRosterPlayers(STATE.currentTeam, shown, players);
}

function snapshotBuildPlayer(player, team) {
  var attrs = {};
  ATTR_KEYS.forEach(function(k) { attrs[k] = parseInt(player[k]) || 50; });
  return {
    name: player.name,
    cname: player.cname || player.name,
    team: team,
    pos: typeof getPlayerMainPos === 'function' ? getPlayerMainPos(player) : (player.pos || ''),
    ovr: parseInt(player.ovr) || 0,
    _sourceKind: player._sourceKind,
    _historicalTier: player._historicalTier,
    attrs: attrs,
    player: player
  };
}

function pickPlayerAt(drawIndex) {
  if (STATE._locking || !STATE.currentTeam || STATE.buildPhase === 'lottery') return;
  const players = Array.isArray(STATE._drawPlayers) ? STATE._drawPlayers : [];
  const player = players[Number(drawIndex)];
  if (!player) return;
  recruitBuildPlayer(player);
}

function pickPlayer(name) {
  if (STATE._locking || !STATE.currentTeam || STATE.buildPhase === 'lottery') return;
  const players = Array.isArray(STATE._drawPlayers) && STATE._drawPlayers.length
    ? STATE._drawPlayers : getBuildPlayerPool(STATE.currentTeam);
  const player = players.find(p => p.name === name);
  if (!player) return;
  recruitBuildPlayer(player);
}

function recruitBuildPlayer(player) {
  if (!player || STATE._locking || STATE.buildPhase === 'lottery') return;
  STATE.buildRoster = STATE.buildRoster || [];
  STATE.usedPlayers = STATE.usedPlayers || [];
  if (STATE.usedPlayers.indexOf(player.name) >= 0) return;
  if (STATE.buildRoster.length >= 13) return;
  STATE._locking = true;
  STATE.buildRoster.push(snapshotBuildPlayer(player, STATE.currentTeam));
  STATE.usedPlayers.push(player.name);
  STATE.selectedPlayer = null;
  renderLeftAttrs();
  renderProgress();

  if (STATE.buildRoster.length >= 13) {
    setTimeout(function() {
      STATE._locking = false;
      startAttrLottery();
    }, 400);
    return;
  }

  setTimeout(function() {
    STATE._locking = false;
    STATE.currentTeam = null;
    STATE.selectedPlayer = null;
    STATE._shownThisTeam = [];
    var rosterArea = document.getElementById('br-roster-area');
    if (rosterArea) rosterArea.innerHTML = '';
    renderLeftAttrs();
    updateSlotButtons();
    renderProgress();
  }, 450);
}

function startAttrLottery() {
  STATE.buildPhase = 'lottery';
  STATE._lotteryOrder = shuffleArr(ATTR_KEYS.slice());
  STATE._lotteryIndex = 0;
  STATE._lotterySpinning = false;
  STATE.lockedCount = 0;
  if (STATE._lotteryTimer) {
    clearTimeout(STATE._lotteryTimer);
    STATE._lotteryTimer = null;
  }
  ATTR_KEYS.forEach(function(k) { STATE.attrs[k] = null; STATE.attrSlots[k] = null; });
  renderBuildUI();
  renderLotteryPanel();
}

function applyLotteryAt(index) {
  var player = (STATE.buildRoster || [])[index];
  var key = (STATE._lotteryOrder || [])[index];
  if (!player || !key || STATE.attrs[key] != null) return;
  var val = player.attrs[key];
  STATE.attrs[key] = val;
  STATE.attrSlots[key] = { player: player.name, team: player.team, value: val, raw: val, penalty: 1 };
  STATE.lockedCount = ATTR_KEYS.filter(function(k) { return STATE.attrs[k] != null; }).length;
}

function renderLotteryPanel() {
  var slotArea = document.getElementById('br-slot-area');
  var rosterArea = document.getElementById('br-roster-area');
  if (!slotArea || !rosterArea) return;
  var idx = Math.min(STATE._lotteryIndex || 0, 12);
  var player = (STATE.buildRoster || [])[idx];
  var spinning = !!STATE._lotterySpinning;
  var key = (STATE._lotteryOrder || [])[idx];
  var val = key ? STATE.attrs[key] : null;
  var shownResult = !spinning && val != null;
  var allDone = (STATE.lockedCount || 0) >= 13;
  var hs = player && player.player ? getPlayerHeadshotStyle(player.player, 56) : '';
  var attrLabel = shownResult ? attrCN(key) : (spinning ? '抽取中' : '?');
  var valLabel = shownResult
    ? (attrCN(key) + ' ' + val + ' · ' + getGrade(val).letter)
    : (spinning ? '揭晓中' : '点抽取，揭晓这位球员贡献的属性');
  var btnLabel = allDone ? '选择位置' : '抽取';
  var btnAction = allDone ? 'finishAttrLottery()' : 'drawLotteryAttr()';
  var btnDisabled = spinning ? ' disabled' : '';
  slotArea.innerHTML = '<div class="lottery-wrap">' +
    '<div class="lottery-card">' +
      '<div class="lottery-kicker">属性抽取 ' + (idx + 1) + '/13</div>' +
      (hs ? '<div class="bp-headshot" style="' + hs + ';width:56px;height:56px;margin:0 auto;border-radius:50%;border:2px solid var(--border);"></div>' : '') +
      '<div class="lottery-name">' + (player ? (player.cname || player.name) : '') + '</div>' +
      '<div class="lottery-attr' + (spinning ? ' spinning' : '') + '">' + attrLabel + '</div>' +
      '<div class="lottery-val">' + valLabel + '</div>' +
      '<button class="btn btn-sm slot-btn"' + btnDisabled +
        ' style="margin-top:10px;background:var(--orange);color:#fff;' + (spinning ? 'opacity:0.45;' : '') + '"' +
        ' onclick="' + btnAction + '">' + btnLabel + '</button>' +
    '</div></div>';
  var log = '';
  (STATE._lotteryOrder || []).forEach(function(attrKey, i) {
    if (STATE.attrs[attrKey] == null) return;
    var src = STATE.buildRoster[i];
    log += '<div class="lottery-log-item"><span>' + (src ? (src.cname || src.name) : '') + '</span><b>' + attrCN(attrKey) + ' ' + STATE.attrs[attrKey] + '</b></div>';
  });
  rosterArea.innerHTML = '<div class="lottery-log">' + log + '</div>';
}

function drawLotteryAttr() {
  if (STATE.buildPhase !== 'lottery' || STATE._lotterySpinning) return;
  if (STATE._lotteryTimer) {
    clearTimeout(STATE._lotteryTimer);
    STATE._lotteryTimer = null;
  }
  var idx = STATE._lotteryIndex || 0;
  var key = (STATE._lotteryOrder || [])[idx];
  if (key && STATE.attrs[key] != null) {
    idx += 1;
    STATE._lotteryIndex = idx;
  }
  if (idx >= 13 || (STATE.lockedCount || 0) >= 13) {
    finishAttrLottery();
    return;
  }
  STATE._lotteryIndex = idx;
  STATE._lotterySpinning = true;
  renderLotteryPanel();
  renderLeftAttrs();
  renderProgress();
  STATE._lotteryTimer = setTimeout(function() {
    applyLotteryAt(idx);
    STATE._lotterySpinning = false;
    renderLotteryPanel();
    renderLeftAttrs();
    renderProgress();
  }, 480);
}

function skipAttrLottery() {
  drawLotteryAttr();
}

function finishAttrLottery() {
  if (STATE._lotteryTimer) {
    clearTimeout(STATE._lotteryTimer);
    STATE._lotteryTimer = null;
  }
  STATE.buildPhase = 'done';
  STATE._locking = false;
  STATE.lockedCount = 13;
  STATE._lotterySpinning = false;
  renderPositionSelect();
  showScreen('screen-position');
}

function lockAttr(key) {
  return;
}

function showToast(msg) {
  // Toast 已关闭
}

function unselectPlayer() {
  STATE.selectedPlayer = null;
  document.querySelectorAll('.roster-row').forEach(r => r.classList.remove('selected'));
  html('player-info-area').innerHTML = '';
  renderAttrSlots();
}

function confirmLock(playerName, attrKey, value) {
  // 防止连点
  if (STATE._locking) return;
  STATE._locking = true;
  
  // 记录锁定
  STATE.attrs[attrKey] = value;
  STATE.attrSlots[attrKey] = { player: playerName, team: STATE.currentTeam, value };
  STATE.lockedCount++;
  STATE.usedPlayers.push(playerName);
  STATE.selectedPlayer = null;
  
  // 清除球员信息
  html('player-info-area').innerHTML = '';
  
  // 更新 UI
  renderAttrSlots();
  
  if (STATE.lockedCount >= 13) {
    revealPlayer();
    return;
  }
  
  // 显示成功提示并自动下一轮
  html('roster-area').innerHTML = `<div class="locked-msg">
    <div class="locked-icon">✅</div>
    <div class="locked-title">${attrCN(attrKey)}（${value}）来自 ${playerName}</div>
    <div class="locked-sub">${13 - STATE.lockedCount > 0 ? `剩余 ${13 - STATE.lockedCount} 项属性` : '全部属性已锁定！'} · 自动进入下一轮...</div>
  </div>`;
  
  setTimeout(() => {
    STATE._locking = false;
    if (STATE.lockedCount < 13) {
      html('roster-area').innerHTML = '';
      spinTeam();
    }
  }, 1000);
}

// ==================== 4. 相似球员匹配 ====================
function findSimilarPlayers(attrs, pos, topN = 3) {
  const posAvg = SIM_CONFIG.POS_AVG[pos];
  if (!posAvg) return [];
  
  // 用户属性相对位置平均值的偏差向量
  const userVec = ATTR_KEYS.map(k => (attrs[k] || 50) - (posAvg[k] || 50));
  const userNorm = Math.sqrt(userVec.reduce((s, v) => s + v * v, 1));
  
  // 遍历所有 NBA 球员
  const scores = [];
  NBA2K_TEAMS.forEach(team => {
    (NBA2K_DATA[team] || []).forEach(player => {
      // 该球员属性相对同一位置平均值的偏差向量
      const hisVec = ATTR_KEYS.map(k => (parseInt(player[k]) || 50) - (posAvg[k] || 50));
      const hisNorm = Math.sqrt(hisVec.reduce((s, v) => s + v * v, 1));
      
      // 点积
      let dot = 0;
      for (let i = 0; i < ATTR_KEYS.length; i++) {
        dot += userVec[i] * hisVec[i];
      }
      
      // 余弦相似度（偏差向量）
      const similarity = Math.round((dot / (userNorm * hisNorm)) * 100);
      scores.push({ player, team, similarity });
    });
  });
  
  // 按相似度降序排列，取 Top N
  scores.sort((a, b) => b.similarity - a.similarity);
  return scores.slice(0, topN);
}

/**
 * 按 OVR 分三档（85-100、75-85、<75），每档取最相似球员
 */
function findTieredPlayers(attrs, pos) {
  const posAvg = SIM_CONFIG.POS_AVG[pos];
  if (!posAvg) return [];
  
  // 同位置组过滤：只匹配相同或相近位置的球员
  const POS_GROUP = {
    'PG': ['PG', 'SG'],
    'SG': ['SG', 'PG', 'SF'],
    'SF': ['SF', 'SG', 'PF'],
    'PF': ['PF', 'SF', 'C'],
    'C':  ['C', 'PF'],
  };
  const allowedPositions = POS_GROUP[pos] || ['PG', 'SG', 'SF', 'PF', 'C'];
  
  const userVec = ATTR_KEYS.map(k => (attrs[k] || 50) - (posAvg[k] || 50));
  const userNorm = Math.sqrt(userVec.reduce((s, v) => s + v * v, 1));
  
  const tiers = [
    { min: 85, max: 100, label: '精英', result: null, bestSim: -1 },
    { min: 75, max: 85, label: '主力', result: null, bestSim: -1 },
    { min: 0,  max: 75, label: '轮换', result: null, bestSim: -1 },
  ];
  
  NBA2K_TEAMS.forEach(team => {
    (NBA2K_DATA[team] || []).forEach(player => {
      const playerMainPos = getPlayerMainPos(player);
      if (!allowedPositions.includes(playerMainPos)) return;
      
      const ovr = parseInt(player.ovr) || 0;
      const tier = tiers.find(t => ovr >= t.min && ovr < t.max);
      if (!tier) return;
      
      const hisVec = ATTR_KEYS.map(k => (parseInt(player[k]) || 50) - (posAvg[k] || 50));
      const hisNorm = Math.sqrt(hisVec.reduce((s, v) => s + v * v, 1));
      let dot = 0;
      for (let i = 0; i < ATTR_KEYS.length; i++) {
        dot += userVec[i] * hisVec[i];
      }
      const similarity = Math.round((dot / (userNorm * hisNorm)) * 100);
      
      if (similarity > tier.bestSim) {
        tier.bestSim = similarity;
        tier.result = { player, team, similarity, ovr };
      }
    });
  });
  
  return tiers.map(t => t.result).filter(Boolean);
}

// ==================== 4.5 Archetype 推导匹配 ====================
/** 同类位置分组：匹配时只找同组球员 */
const POS_GROUP = {
  'PG': ['PG', 'SG'],
  'SG': ['SG', 'PG', 'SF'],
  'SF': ['SF', 'SG', 'PF'],
  'PF': ['PF', 'SF', 'C'],
  'C':  ['C', 'PF'],
};

/**
 * 按位置筛选 → 余弦匹配最相似球员 → 输出其 archetype
 */
function matchPlayerArchetype(attrs, topN = 3) {
  const ATTRS = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
  const userPos = STATE.position || 'SF';
  const allowedPositions = POS_GROUP[userPos] || ['PG', 'SG', 'SF', 'PF', 'C'];
  
  // 用户属性向量
  const userVec = ATTRS.map(k => attrs[k] || 50);
  const userNorm = Math.sqrt(userVec.reduce((s, v) => s + v * v, 1));
  
  // 遍历所有 NBA 球员，只算同位置组的余弦相似度
  const playerScores = [];
  NBA2K_TEAMS.forEach(team => {
    (NBA2K_DATA[team] || []).forEach(player => {
      const playerMainPos = getPlayerMainPos(player);
      // 不在同位置组内 → 跳过
      if (!allowedPositions.includes(playerMainPos)) return;
      
      const playerVec = ATTRS.map(k => parseInt(player[k]) || 50);
      const playerNorm = Math.sqrt(playerVec.reduce((s, v) => s + v * v, 1));
      
      let dot = 0;
      for (let i = 0; i < ATTRS.length; i++) {
        dot += userVec[i] * playerVec[i];
      }
      
      const similarity = Math.round((dot / (userNorm * playerNorm)) * 1000) / 10;
      
      playerScores.push({
        similarity,
        player,
        team,
        archetype: player.type || 'Unknown',
        playerPos: playerMainPos,
      });
    });
  });
  
  // 按相似度降序，取 Top N
  playerScores.sort((a, b) => b.similarity - a.similarity);
  const topPlayers = playerScores.slice(0, topN);
  
  // 直接输出匹配球员的 archetype 信息
  return topPlayers.map(item => {
    const p = item.player;
    const meta = NBA2K_ARCHETYPES ? NBA2K_ARCHETYPES[item.archetype] : null;
    return {
      archetype: item.archetype,
      cn: meta?.cn || item.archetype,
      icon: meta?.icon || '⭐',
      category: meta?.category || 'all_around',
      similarity: item.similarity,
      avgOVR: meta?.avgOVR || 0,
      archCount: meta?.count || 0,
      player: p,
      playerName: p.cname || p.name,
      playerPos: item.playerPos,
      playerTeam: item.team,
      playerOVR: parseInt(p.ovr) || 0,
    };
  });
}

/** 获取 archetype 的中文分类名称 */
function getArchCategoryCN(category) {
  const map = {
    'shooter': '射手型',
    'slasher': '突破型',
    'two_way': '攻防一体',
    'playmaker': '组织型',
    'iso_scorer': '单打型',
    'big': '内线型',
    'athlete': '运动型',
    'stretch_big': '空间内线',
    'skill_creator': '技术流',
    'all_around': '全能型',
  };
  return map[category] || '全能型';
}

// ==================== 4. 揭幕 ====================
function revealPlayer() {
  STATE.finalOVR = calcOVR(STATE.attrs, STATE.position);
  STATE.finalPosition = STATE.position;
  
  showScreen('screen-reveal');

  // ★ Archetype 匹配 → 仅展示最终模板
  const archMatches = matchPlayerArchetype(STATE.attrs, 1);
  let archHtml = '';
  if (archMatches.length > 0) {
    const best = archMatches[0];
    STATE.finalArchetype = best.archetype;  // ← 记录模板，供成就系统使用
    
    archHtml = `<div class="rv-item" style="animation-delay:1.0s;margin:8px 10px 0;padding:10px 10px;background:var(--bg-card);border:2px solid var(--orange);border-radius:var(--radius);">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--orange-bg);border-radius:10px;">
        <span style="font-size:22px;">${best.icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text);">${best.cn}</div>
        </div>
      </div>
    </div>`;
  }
  
  // 按 OVR 分三档展示最相似球员
  const tiered = findTieredPlayers(STATE.attrs, STATE.position);
  let top3Html = '';
  if (tiered.length > 0) {
    
    top3Html = `<div class="rv-item" style="animation-delay:1.3s;margin:8px 10px 0;padding:8px 10px;background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius);">
      <div style="font-family:var(--font-display);font-size:12px;color:var(--orange);margin-bottom:6px;letter-spacing:1px;">🔍 球员模板</div>`;
    tiered.forEach((item, i) => {
      const p = item.player;
      const hsStyle = getPlayerHeadshotStyle(p.name, 28);
      top3Html += `<div class="rv-item" style="animation-delay:${1.4 + i * 0.12}s;display:flex;align-items:center;gap:6px;padding:4px 0;${i < tiered.length-1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
        <div class="bp-headshot" style="${hsStyle};border-radius:50%;border:2px solid var(--border);"></div>
        <div style="flex:1;text-align:center;font-family:var(--font-display);font-size:12px;font-weight:600;">${p.cname || p.name}</div>
      </div>`;
    });
    top3Html += '</div>';
  }
  
  // 给每个 reveal-stat 加渐入延迟
  let statsHtmlWithDelay = '';
  ATTR_KEYS.forEach((k, i) => {
    const val = STATE.attrs[k] || 50;
    const g = getGrade(val);
    statsHtmlWithDelay += `<div class="reveal-stat" style="animation-delay:${0.5 + i * 0.06}s">
      <div class="label">${attrCN(k)}</div>
      <div class="value" style="color:${g.color}">${g.letter}</div>
    </div>`;
  });
  
  html('reveal-content').innerHTML = `
    <div class="rv-card-wrap">
      <div class="reveal-card">
        <div class="rv-item" style="animation-delay:0.05s"><img class="reveal-player-avatar" src="${getHupuAvatarUrl()}" alt="${getHupuDisplayName()}"></div>
        <div class="rv-item" style="animation-delay:0.1s"><div class="reveal-label">我的球员</div></div>
         <div class="rv-item" style="animation-delay:0.2s"><div class="big-cname">${getHupuDisplayName()}</div></div>
        <div class="rv-ovr" style="animation-delay:0.3s"><div class="big-ovr">${STATE.finalOVR}</div></div>
        <div class="rv-item" style="animation-delay:0.4s"><div class="big-pos">${SIM_CONFIG.POSITIONS[STATE.position]}</div></div>
      </div>
    </div>
    <div class="reveal-stats">${statsHtmlWithDelay}</div>
    ${archHtml}
    ${top3Html}
  `;
}

function goToCareer() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC4",label:"开始生涯"});
  showScreen('screen-career');
  if (shouldRunDraftStory()) {
    showDraftStory();
  } else {
    renderCareerSpin();
  }
}

// ==================== 选秀夜 DAG（draft_night） ====================
function shouldRunDraftStory() {
  var c = STATE.career;
  if (!c) return false;
  if (c.flags && c.flags.draftDone) return false;
  if ((c.seasonCount || 0) > 0) return false;
  if (c.draft && c.draft.pick) return false;
  return true;
}

function getDraftPickLabel(d) {
  if (!d) return '未知';
  if (d.type === 'undrafted') return '落选';
  if (d.round === 2) return '次轮第' + d.pick + '顺位';
  return '首轮第' + d.pick + '顺位';
}

function recordDraftChoice(stepId, stepTitle, label, result) {
  var c = STATE.career;
  if (!c) return;
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: 0,
    phase: 'career_start',
    branch: 'draft_night',
    eventId: stepId,
    event: stepTitle,
    choice: label,
    result: result || ''
  });
}

var EVENT_CHOICE_PREDICTION_LABELS = {
  fame:'人气', businessValue:'商业价值', mediaTrust:'媒体信任', controversy:'争议',
  chinaPopularity:'中国人气', loyalty:'忠诚', leadership:'领导力', coachTrust:'教练信任',
  lockerRoomTrust:'更衣室信任', fanSupport:'球迷支持', legacyBonus:'传奇声望',
  injuryRiskBonus:'伤病风险', formVariance:'状态波动', teamChemistry:'球队默契',
  moraleBonus:'士气', mediaPressure:'媒体压力', staminaLoad:'体能负荷',
  draftStockBonus:'选秀行情'
};
var EVENT_CHOICE_BAD_WHEN_RAISED = {
  controversy:true, injuryRiskBonus:true, formVariance:true,
  mediaPressure:true, staminaLoad:true
};

function formatEventChoiceEffect(key, amount, isAttribute) {
  var label = isAttribute && typeof attrCN === 'function' ? attrCN(key) : (EVENT_CHOICE_PREDICTION_LABELS[key] || key);
  var strong = Math.abs(amount) >= 2 ? '明显' : '';
  if (key === 'formVariance') return amount < 0 ? '状态' + strong + '更稳定' : '状态波动' + strong + '增加';
  if (EVENT_CHOICE_BAD_WHEN_RAISED[key]) return label + strong + (amount > 0 ? '增加' : '下降');
  return label + strong + (amount > 0 ? '提升' : '下降');
}

function extractEventChoiceEffectPreview(choice) {
  if (!choice || typeof choice.apply !== 'function') return '';
  var source = '';
  try { source = Function.prototype.toString.call(choice.apply); } catch(e) { return ''; }
  // 分支或随机结果不能合并成一个确定预告，避免向玩家显示并不会同时发生的变化。
  if (/Math\.random|\brandom\s*\(|\bif\s*\(|\bswitch\s*\(|\?/.test(source)) return '';
  var totals = {};
  var order = [];
  function add(key, amount, isAttribute) {
    amount = Number(amount) || 0;
    if (!amount) return;
    var mapKey = (isAttribute ? 'attr.' : 'state.') + key;
    if (!Object.prototype.hasOwnProperty.call(totals, mapKey)) order.push(mapKey);
    totals[mapKey] = (totals[mapKey] || 0) + amount;
  }
  function scan(regex, isAttribute) {
    var match;
    while ((match = regex.exec(source))) add(match[1], match[2], isAttribute);
  }
  scan(/addProfileDelta\(\s*['\"]([^'\"]+)['\"]\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g, false);
  scan(/addSeasonMod\(\s*['\"]([^'\"]+)['\"]\s*,\s*(-?\d+(?:\.\d+)?)/g, false);
  scan(/addAttrDelta\(\s*['\"]([^'\"]+)['\"]\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g, true);
  var draftMatch;
  var draftRegex = /changeDraftStock\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  while ((draftMatch = draftRegex.exec(source))) add('draftStockBonus', draftMatch[1], false);
  var changes = order.filter(function(key) { return totals[key] !== 0; }).map(function(mapKey) {
    var isAttribute = mapKey.indexOf('attr.') === 0;
    var key = mapKey.slice(mapKey.indexOf('.') + 1);
    var amount = Math.round(totals[mapKey] * 10) / 10;
    return formatEventChoiceEffect(key, amount, isAttribute);
  });
  return changes.join('、');
}

function hasEventChoiceOutcomeForecast(text) {
  return /(上升|下降|提升|降低|提高|增加|减少|回升|稳定|波动|风险|压力|负荷|行情|声望|评价|信任|默契|人气|争议|忠诚|获得|失去|解锁|开启|进入|结束|退役|留队|续约|交易|可能|概率|代价|影响|保留|牺牲|承担|大涨|大跌|更高|更低|更强|更弱|更稳|更深|更快|更慢|会带来|将改变)/.test(text || '');
}

function getEventChoicePrediction(choice, event, choiceIndex) {
  choice = choice || {};
  var hint = String(choice.prediction || choice.hint || '').trim();
  var effectPreview = extractEventChoiceEffectPreview(choice);
  if (hint && effectPreview && !hasEventChoiceOutcomeForecast(hint)) {
    hint = hint.replace(/[。；;，,\s]+$/, '') + '；' + effectPreview;
  } else if (hint && !hasEventChoiceOutcomeForecast(hint)) {
    hint = hint.replace(/[。；;，,\s]+$/, '') + '；将改变后续剧情与人物评价';
  } else if (!hint && effectPreview) {
    hint = effectPreview;
  } else if (!hint) {
    var label = String(choice.label || ('选项' + ((choiceIndex || 0) + 1))).trim();
    var title = String(event && event.title || '本事件').replace(/^(赛季日常|赛季事件)[:：]\s*/, '');
    hint = '选择“' + label + '”后将推进“' + title + '”路线，并影响后续剧情';
  }
  return hint;
}

function showDraftChoiceModal(stepId, title, scene, choices, onDone) {
  var old = document.getElementById('draft-modal');
  if (old) old.remove();
  var html = '<div class="team-picker-overlay" id="draft-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  if (typeof renderPerfectPlayerDraftProjection === 'function') html += renderPerfectPlayerDraftProjection(title);
  html += '<div style="padding:14px 14px 8px;">';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + sanitizePlayerFacingText(scene) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  choices.forEach(function(ch, ci) {
    html += '<button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;" onclick="chooseDraftChoice(' + ci + ')">' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(getEventChoicePrediction(ch, { id:stepId, title:title }, ci)) + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  STATE._draftModalStep = { stepId: stepId, title: title, choices: choices, onDone: onDone };
}

function chooseDraftChoice(idx) {
  var modal = STATE._draftModalStep;
  if (!modal) return;
  var ch = modal.choices[idx];
  if (!ch) return;
  var beforeAttributes = captureEventAttributeSnapshot();
  var msg = '';
  try { msg = ch.apply ? ch.apply() : ''; } catch(e) { msg = ''; }
  msg = sanitizePlayerFacingText(msg || '');
  recordDraftChoice(modal.stepId, modal.title, ch.label, msg);
  var done = modal.onDone;
  var overlay = document.getElementById('draft-modal');
  if (overlay) overlay.remove();
  STATE._draftModalStep = null;
  var attributeChanges = diffEventAttributeSnapshot(beforeAttributes);
  if (msg || attributeChanges.length) showDraftResultModal(modal.title, msg, done, attributeChanges);
  else if (done) done();
}

function showDraftSceneModal(title, scene, btnText, onNext) {
  var old = document.getElementById('draft-modal');
  if (old) old.remove();
  var html = '<div class="team-picker-overlay" id="draft-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  if (typeof renderPerfectPlayerDraftProjection === 'function') html += renderPerfectPlayerDraftProjection(title);
  html += '<div style="padding:14px 14px 8px;">';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + sanitizePlayerFacingText(scene) + '</div>';
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="closeDraftScene()">' + (btnText || '继续') + '</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  STATE._draftSceneStep = { onNext: onNext };
}

function closeDraftScene() {
  var s = STATE._draftSceneStep;
  var overlay = document.getElementById('draft-modal');
  if (overlay) overlay.remove();
  STATE._draftSceneStep = null;
  if (s && s.onNext) s.onNext();
}

function showDraftResultModal(title, msg, onNext, attributeChanges) {
  var old = document.getElementById('draft-result-modal');
  if (old) old.remove();
  STATE._draftResultDone = typeof onNext === 'function' ? onNext : null;
  var html = '<div class="team-picker-overlay" id="draft-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  if (typeof renderPerfectPlayerDraftProjection === 'function') html += renderPerfectPlayerDraftProjection(title);
  html += '<div class="event-result-body">';
  html += formatBranchResultText(msg);
  html += renderEventAttributeChanges(attributeChanges);
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueDraftResult()">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueDraftResult() {
  var modal = document.getElementById('draft-result-modal');
  if (modal) modal.remove();
  var done = STATE._draftResultDone;
  STATE._draftResultDone = null;
  if (typeof done === 'function') done();
}

function showDraftStory() {
  STATE._draftPending = {
    agent: null, prep: null, type: null, round: 1, pick: 1,
    twoWay: false, contractYears: 4, selfPicked: false,
    draftStockBonus: 0, randomEventIds: []
  };
  STATE.career.branches = STATE.career.branches || {};
  setBranchNode('draft_night', 'draft_entry');
  showDraftChoiceModal('draft_entry', '选秀前夜',
    '选秀大会前一晚，你躺在酒店的床上看球探报告。报告里的形容词很分裂：有天赋、有空白、上限高、下限低。经纪人打电话来，只问了一句：明天你想让联盟先记住你什么？',
    [
      { label: '仔细看球探报告', hint: '更清楚自己的定位', apply: function() {
        addProfileDelta('mediaTrust', 1);
        return '你把每条优缺点都背了下来。第二天走上台时，你至少知道自己不是来碰运气的。<br><br>效果：媒体好感+1。';
      }},
      { label: '关掉手机睡觉', hint: '让身体先休息', apply: function() {
        addSeasonMod('formVariance', -1, -10, 10);
        return '你关掉手机，把明天的自己交给睡眠。窗外城市还在亮，你已经先一步安静下来。<br><br>效果：状态波动-1。';
      }}
    ],
    function() {
      setBranchNode('draft_night', 'draft_agent');
      showDraftAgentStep();
    });
}

function showDraftAgentStep() {
  showDraftChoiceModal('draft_agent', '经纪团队',
    '经纪人把三种选择摊在桌上：大牌公司、中型团队、还是让家里人帮忙。他说这不是签一份合同，是选一种未来十年的说话方式。',
    [
      { label: '大牌经纪公司', hint: '曝光更高，压力也更大', apply: function() {
        STATE._draftPending.agent = 'big';
        addProfileDelta('fame', 2);
        addProfileDelta('businessValue', 1);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '公司第一周就给你排满了采访和商业拍摄。曝光来得很快，快到你开始重新学习怎么在镜头前呼吸。<br><br>效果：人气+2；商业价值+1；媒体压力+1。';
      }},
      { label: '中型团队', hint: '更关注你这个人', apply: function() {
        STATE._draftPending.agent = 'mid';
        addProfileDelta('coachTrust', 1);
        return '团队不大，但每个人都叫得出你高中教练的名字。他们更关心你的下一步，而不是下一条热搜。<br><br>效果：教练信任+1。';
      }},
      { label: '家人朋友团队', hint: '最信任的人陪你走', apply: function() {
        STATE._draftPending.agent = 'family';
        addProfileDelta('loyalty', 2);
        addProfileDelta('businessValue', -1);
        return '合同谈判桌上坐着的是你表哥和从小看你打球的朋友。他们不够专业，但每一个条款都会先问你一句：你开心吗。<br><br>效果：忠诚+2；商业价值-1。';
      }}
    ],
    function() {
      showDraftPrepStep();
    });
}

function showDraftPrepStep() {
  showDraftChoiceModal('draft_prep', '试训策略',
    '经纪团队把一份试训安排放在你面前：联合试训、几支球队的单独邀请，或者什么都不去。他说：联合试训是最大的舞台，也是最大的放大镜。',
    [
      { label: '参加联合试训', hint: '曝光最高，也有状态风险', apply: function() {
        STATE._draftPending.prep = 'combine';
        setBranchNode('draft_night', 'draft_combine');
        if (Math.random() < 0.1) {
          STATE._draftPending.combineHurt = true;
          addSeasonMod('formVariance', 1, -10, 10);
          addSeasonMod('mediaPressure', 1, -10, 10);
        }
        return '你走进联合试训的球馆。所有球队的球探坐在同一排，你每投进一球，就有人低头记笔记。';
      }},
      { label: '只参加单独试训', hint: '更稳，教练好感小幅上升', apply: function() {
        STATE._draftPending.prep = 'workouts';
        setBranchNode('draft_night', 'draft_workouts');
        addProfileDelta('coachTrust', 1);
        return '你只接受了几支球队的单独试训，把每一分钟都用在真正感兴趣的球队面前。<br><br>效果：教练信任+1。';
      }},
      { label: '不试训', hint: '保留神秘感，顺位可能下滑', apply: function() {
        STATE._draftPending.prep = 'skip';
        setBranchNode('draft_night', 'draft_skip');
        addProfileDelta('controversy', 1);
        addProfileDelta('mediaTrust', -1);
        return '你把试训邀请全部推掉。新闻里开始有人问：他到底在躲什么？你只是照常训练。<br><br>效果：争议+1；媒体好感-1。';
      }}
    ],
    function() {
      if (STATE._draftPending.combineHurt) {
        showDraftResultModal('试训策略',
          '联合试训的最后一场，你在一次变向时感觉大腿发紧。队医让你提前结束，顺位预测被媒体往下调了一点。<br><br>效果：状态波动+1；媒体压力+1。',
          function() {
            if (typeof runPerfectPlayerDraftRandomEvent === 'function') runPerfectPlayerDraftRandomEvent('pre', nextDraftReady);
            else nextDraftReady();
          });
      } else {
        if (typeof runPerfectPlayerDraftRandomEvent === 'function') runPerfectPlayerDraftRandomEvent('pre', nextDraftReady);
        else nextDraftReady();
      }
    });
}

function computeDraftBand() {
  var p = STATE._draftPending;
  var ovr = STATE.finalOVR || 50;
  if (typeof getPerfectPlayerDraftProjection === 'function') {
    var projection = getPerfectPlayerDraftProjection();
    p.projectedRank = projection ? projection.rank : null;
    p.projectedRange = projection ? [projection.rangeStart, projection.rangeEnd] : null;
    p.draftScore = projection ? projection.score : ovr;
    if (projection && projection.rank != null) {
      var variance = Math.floor(Math.random() * 7) - 3;
      var actualPick = Math.max(1, Math.min(60, projection.rank + variance));
      p.pick = actualPick;
      p.round = actualPick <= 30 ? 1 : 2;
      p.type = actualPick <= 14 ? 'lottery' : (actualPick <= 30 ? 'first' : 'second');
    } else if (projection && projection.score >= 62 && Math.random() < 0.28) {
      p.type = 'second'; p.round = 2; p.pick = 56 + Math.floor(Math.random() * 5);
    } else {
      p.type = 'undrafted'; p.round = 0; p.pick = 0;
    }
    if (p.type === 'lottery') p.contractYears = 4;
    else if (p.type === 'first') p.contractYears = 3 + Math.floor(Math.random() * 2);
    else if (p.type === 'second') p.contractYears = 2;
    else p.contractYears = 1;
    return p;
  }
  var shift = 0;
  if (p.prep === 'combine') {
    shift = p.combineHurt ? -2 : Math.floor(Math.random() * 4);
  } else if (p.prep === 'workouts') {
    shift = Math.random() < 0.45 ? 1 : 0;
  } else if (p.prep === 'skip') {
    shift = -(2 + Math.floor(Math.random() * 4));
  }
  shift += Number(p.draftStockBonus) || 0;
  var v = ovr + shift;
  if (v >= 88) { p.type = 'lottery'; p.round = 1; p.pick = 1 + Math.floor(Math.random() * 5); }
  else if (v >= 84) { p.type = 'lottery'; p.round = 1; p.pick = 6 + Math.floor(Math.random() * 9); }
  else if (v >= 78) { p.type = 'first'; p.round = 1; p.pick = 15 + Math.floor(Math.random() * 16); }
  else if (v >= 70) { p.type = 'second'; p.round = 2; p.pick = 31 + Math.floor(Math.random() * 15); }
  else { p.type = 'undrafted'; p.round = 0; p.pick = 0; }
  if (p.type === 'lottery') p.contractYears = 4;
  else if (p.type === 'first') p.contractYears = 3 + Math.floor(Math.random() * 2);
  else if (p.type === 'second') p.contractYears = 2;
  else p.contractYears = 1;
  return p;
}

function nextDraftReady() {
  setBranchNode('draft_night', 'draft_ready');
  computeDraftBand();
  var p = STATE._draftPending;
  var scenes = {
    lottery: '选秀大会开始。前几个名字被念出时，你听见自己的心跳。镜头切到你的方向，现场突然安静了一瞬。',
    first: '选秀大会进行到一半，你的名字出现在预测板的中间位置。电视镜头偶尔扫到你，你努力让自己看起来镇定。',
    second: '次轮的等待比首轮长得多。每念出一个名字，你都先看手机，再假装没事。',
    undrafted: '名字一路念到次轮最后一位。手机没有响。你关掉直播，站起来，把窗推开。'
  };
  showDraftSceneModal('选秀大会', scenes[p.type] || scenes.first, '继续', showDraftResultStep);
}

function showDraftResultStep() {
  var p = STATE._draftPending;
  var pickLabel = getDraftPickLabel(p);
  if (p.type === 'lottery') {
    setBranchNode('draft_night', 'draft_green_room');
    showDraftChoiceModal('draft_green_room', '选秀结果 · ' + pickLabel,
      '你在绿屋里坐着，面前摆着水和手机。念到你的名字时，全场鼓掌。聚光灯亮得看不清台下，但你记得家人的方向。',
      [
        { label: '高调庆祝', hint: '自信一点，让镜头记住你', apply: function() {
          addProfileDelta('fame', 1);
          addSeasonMod('mediaPressure', 1, -10, 10);
          return '你站起来和身边的人击掌，镜头跟着你直到落座。今晚的标题已经写好：自信，或者自大。<br><br>效果：人气+1；媒体压力+1。';
        }},
        { label: '冷静握手', hint: '话少一点，更稳一点', apply: function() {
          addProfileDelta('mediaTrust', 1);
          addProfileDelta('fanSupport', 1);
          return '你和总经理握手，对镜头点了点头。没有多余动作，反而让人记住了你的名字。<br><br>效果：媒体好感+1；球迷支持+1。';
        }},
        { label: '感谢家人', hint: '把第一句话留给最重要的人', apply: function() {
          addProfileDelta('loyalty', 1);
          addProfileDelta('fanSupport', 1);
          return '你在镜头前先看向家人。那句话很短，但全场都听见了。<br><br>效果：忠诚+1；球迷支持+1。';
        }}
      ],
      afterDraftResult);
  } else if (p.type === 'first') {
    setBranchNode('draft_night', 'draft_picked_first');
    showDraftChoiceModal('draft_picked_first', '选秀结果 · ' + pickLabel,
      '手机在桌上震了三次，你接起来，那头是球队总经理：欢迎来到 NBA。你还没回过神，电视已经打出你的名字。',
      [
        { label: '承诺努力训练', hint: '先证明态度', apply: function() {
          addProfileDelta('coachTrust', 1);
          addProfileDelta('fanSupport', 1);
          return '你接过球队球衣，只说了一句：我会第一个到训练馆。<br><br>效果：教练信任+1；球迷支持+1。';
        }},
        { label: '直接谈角色', hint: '把定位问清楚', apply: function() {
          addProfileDelta('coachTrust', -1);
          addProfileDelta('mediaTrust', 1);
          return '你直接问了球队准备怎么用你。问题很职业，但教练记住的是你第一天就谈条件。<br><br>效果：教练信任-1；媒体好感+1。';
        }},
        { label: '感谢球队', hint: '先表达尊重', apply: function() {
          addProfileDelta('loyalty', 1);
          addProfileDelta('mediaTrust', 1);
          return '你在电话里感谢了总经理和教练。话不多，但每个人都听得出来是真的。<br><br>效果：忠诚+1；媒体好感+1。';
        }}
      ],
      afterDraftResult);
  } else if (p.type === 'second') {
    setBranchNode('draft_night', 'draft_picked_second');
    showDraftChoiceModal('draft_picked_second', '选秀结果 · ' + pickLabel,
      '次轮的等待比首轮长得多。终于轮到你时，电话里没有恭喜，第一句话是：我们想先谈谈合同。',
      [
        { label: '接受双向合同', hint: '先进联盟，再谈位置', apply: function() {
          p.twoWay = true;
          p.contractYears = 2;
          return '你接受了双向合同。没有盛大的发布会，只有一份在联盟和发展联盟之间来回的日程表。<br><br>效果：双向合同。';
        }},
        { label: '争全额保障', hint: '把身价谈出来', apply: function() {
          if (Math.random() < 0.65) {
            p.contractYears = 2;
            return '你坚持要一份正式合同。谈判磨了三天，最后球队让步了。<br><br>效果：2年正式合同。';
          }
          p.twoWay = true;
          return '球队没有让步。你争到最后，拿到的还是一份双向合同，但所有人都知道你来过谈判桌。<br><br>效果：双向合同。';
        }},
        { label: '沉默等待', hint: '让球队先亮牌', apply: function() {
          p.contractYears = 2;
          addProfileDelta('mediaTrust', 1);
          return '你没有催，只是每天准时训练。两天后，球队打来电话：合同准备好了。<br><br>效果：2年正式合同；媒体好感+1。';
        }}
      ],
      afterDraftResult);
  } else {
    setBranchNode('draft_night', 'draft_undrafted');
    showDraftChoiceModal('draft_undrafted', '落选',
      '名字念完了。电视切走，经纪人发来一条消息：还有路。你关掉电视，没有立刻回，先站起来投了一组球。',
      [
        { label: '接受训练营合同', hint: '从最底层开始拼', apply: function() {
          p.contractYears = 2;
          return '你把行李搬进训练营，床位号写在最后一排。教练说：这里所有人都在抢同一个名额。<br><br>效果：2年非保障合同。';
        }},
        { label: '去海外历练', hint: '晚一年回来，但更硬', apply: function() {
          p.contractYears = 1;
          STATE.career.currentAge++;
          addAttrDelta('FIN', 1);
          addAttrDelta('PAS', 1);
          STATE.finalOVR = calcOVR(STATE.attrs);
          return '你登上飞往海外的航班。那里的对抗更脏、更挤，也让你更快学会保护球。<br><br>效果：一年后回归；终结+1，传球+1；年龄+1。';
        }},
        { label: '休整一年', hint: '把身体修好，晚点再来', apply: function() {
          p.contractYears = 1;
          STATE.career.currentAge++;
          addSeasonMod('formVariance', -1, -10, 10);
          return '你给自己放了一年假。没有球探，没有试训，只有恢复、力量和重新想明白为什么打球。<br><br>效果：年龄+1；状态波动-1。';
        }}
      ],
      afterDraftResult);
  }
}

function afterDraftResult() {
  setBranchNode('draft_night', 'draft_contract');
  if (typeof runPerfectPlayerDraftRandomEvent === 'function') runPerfectPlayerDraftRandomEvent('post', renderCareerSpin);
  else renderCareerSpin();
}

function runPostDraftContractFlow(team, done) {
  var p = STATE._draftPending;
  if (!p) { done(); return; }
  if (p.selfPicked) {
    var beforeAttributes = captureEventAttributeSnapshot();
    setBranchNode('draft_night', 'draft_forced_trade');
    p.contractYears = Math.max(1, (p.contractYears || 1) - 1);
    addProfileDelta('coachTrust', -2);
    addProfileDelta('fanSupport', -3);
    addSeasonMod('mediaPressure', 1, -10, 10);
    var tn = getTeamName ? getTeamName(team) : team;
    var msg = '你被选中的消息刚上新闻，交易流言就跟着到了。第二天，球队官宣：你最终加盟 ' + tn + '。评论区有人说你聪明，有人说你不够忠诚。<br><br>效果：教练信任-2；球迷支持-3；媒体压力+1；合同年限缩短。';
    recordDraftChoice('draft_forced_trade', '交易官宣', '接受交易', msg);
    showDraftResultModal('交易官宣', msg, function() { showDraftContractStep(team, done); }, diffEventAttributeSnapshot(beforeAttributes));
  } else {
    showDraftContractStep(team, done);
  }
}

function showDraftContractStep(team, done) {
  showDraftSceneModal('签下第一份合同',
    '合同摆在桌上，第一页是数字，后面几十页都是话。经纪人逐条念给你听：保障金额、激励条款、球队选项。你签下名字时，突然意识到这就是你从小打球的终点和起点。',
    '签下名字',
    function() {
      var p = STATE._draftPending;
      var years = (p && p.contractYears) || 4;
      showDraftResultModal('签下第一份合同',
        '你签下一份' + years + '年合同。笔尖落下去的那一刻，第一页的数字忽然变得具体。<br><br>效果：初始合同' + years + '年。',
        function() { finalizeDraft(team, done); });
    });
}

function showDraftPressStep(team, done) {
  showDraftChoiceModal('draft_press', '新秀发布会',
    '发布会上，话筒从你面前一个个传过来。有人问你最想证明什么，有人问你对交易流言的看法，还有人问：你觉得自己是新秀里的第几名？',
    [
      { label: '谦逊回应', hint: '把期待放低一点', apply: function() {
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('mediaPressure', -1, -10, 10);
        return '你说：我想先证明自己能留在这个联盟。台下有人点头，也有人觉得你太保守。<br><br>效果：媒体好感+1；媒体压力-1。';
      }},
      { label: '自信回应', hint: '把目标说出来', apply: function() {
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你说：我不只是来打球的，我是来被记住的。第二天，这句话被剪进所有选秀集锦。<br><br>效果：人气+1；争议+1。';
      }},
      { label: '沉默寡言', hint: '让表现替你说话', apply: function() {
        addProfileDelta('fanSupport', 1);
        addProfileDelta('mediaTrust', -1);
        return '你回答了每一个问题，但每一句都很短。记者们开始讨论：他是内向，还是高傲？<br><br>效果：球迷支持+1；媒体好感-1。';
      }}
    ],
    function() { showDraftFirstPracticeStep(team, done); });
}

function showDraftFirstPracticeStep(team, done) {
  showDraftChoiceModal('draft_first_practice', '教练角色谈话',
    '教练把你叫进办公室，桌上没有战术板，只有一张轮换表。他说：你想成为谁我知道，但现在球队需要你先做好另一件事。',
    [
      { label: '接受定位', hint: '先赢得教练信任', apply: function() {
        addProfileDelta('coachTrust', 2);
        return '你说：教练安排什么，我就做好什么。他看了你两秒，在轮换表上写下了你的名字。<br><br>效果：教练信任+2。';
      }},
      { label: '争取更多球权', hint: '把野心说清楚', apply: function() {
        addProfileDelta('coachTrust', -1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你当面说出了自己的想法。教练没有拒绝，只是提醒你：机会要自己挣。<br><br>效果：教练信任-1；状态波动+1。';
      }},
      { label: '用表现说话', hint: '少说多做', apply: function() {
        addProfileDelta('coachTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有多说，只是提前半小时到训练馆。教练路过时，没有说话，但记住了你的号码。<br><br>效果：教练信任+1；状态波动-1。';
      }}
    ],
    function() { finalizeDraft(team, done); });
}

function finalizeDraft(team, done) {
  var p = STATE._draftPending;
  var c = STATE.career;
  c.draft = {
    year: 2026,
    round: p.round,
    pick: p.pick,
    team: team,
    type: p.type,
    twoWay: !!p.twoWay,
    guaranteed: !p.twoWay,
    prep: p.prep,
    agent: p.agent,
    projectedRank: p.projectedRank,
    draftScore: p.draftScore,
    randomEventIds: (p.randomEventIds || []).slice(),
    contractYears: p.contractYears,
    selfPicked: !!p.selfPicked
  };
  c.flags = c.flags || {};
  c.flags.draftDone = true;
  if (p.selfPicked) c.flags.draftTrade = true;
  c.contract = p.contractYears;
  setBranchNode('draft_night', 'draft_done');
  STATE._draftPending = null;
  STATE._draftSelfPick = false;
  if (done) done();
}

function renderCareerTeamReveal(team, cnName, role, rosterHtml) {
  var isBench = !!(STATE.career && STATE.career.flags && STATE.career.flags.startBench);
  var finalRole = isBench ? '替补' : role;
  STATE.season.isUserStarter = !isBench && role === '首发';
  var draftLine = '';
  var d = STATE.career && STATE.career.draft;
  if (d && d.type !== 'undrafted') {
    draftLine = ' · ' + (d.round === 2 ? '次轮第' + d.pick + '顺位' : '首轮第' + d.pick + '顺位');
  }
  html('career-area').innerHTML = `
    <div style="padding:0 12px;" id="career-scroll">
      <div class="reveal-card" style="position:relative;">
        <div style="position:absolute;top:8px;left:8px;">${getTeamLogo(team, 32)}</div>
        <div style="font-size:13px;color:var(--text-dim);">${getCurrentSeasonLabel()} · 我的生涯球队${draftLine}</div>
        <div style="font-size:24px;font-weight:800;margin:6px 0;font-family:var(--font-display);letter-spacing:2px;">${cnName}</div>
        <div style="font-size:12px;color:var(--text-dim);">我担任的角色为${finalRole}${SIM_CONFIG.POSITIONS[STATE.position]}</div>
        <div style="margin-top:12px;">
          <button class="btn btn-primary" onclick="trackEvent({act:'click',blk:'BMC098',pos:'TC7',label:'开始赛季'});startSeason()">🏀 开始赛季</button>
        </div>
      </div>
      <div style="margin-top:8px;background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius-sm);padding:8px 4px;">
        ${rosterHtml}
      </div>
    </div>
  `;
}

// ==================== 5. 生涯球队分配 ====================
function renderCareerSpin() {
  var pool = STATE._teamsVisited.length > 0 ? STATE._teamsVisited : [...NBA2K_TEAMS].sort();
  const sorted = pool.slice().sort();
  const copies = 5;
  const allItems = [];
  for (let c = 0; c < copies; c++) {
    sorted.forEach(t => allItems.push(t));
  }
  
  let itemsHtml = '';
  allItems.forEach(t => {
    const cn = SIM_CONFIG.TEAM_NAMES[t] || t;
    itemsHtml += `<div class="br-slot-item" data-team="${t}">${cn}</div>`;
  });
  
  html('career-area').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 100px);padding:12px 12px;">
      <div class="br-slot-area" style="max-width:320px;width:100%;">
        <div class="br-slot-label">🎰 选择我的生涯球队</div>
      <div class="br-slot-wrapper">
        <div class="br-slot-machine career-slot">
          <div class="br-slot-reel" id="career-slot-reel">
            ${itemsHtml}
          </div>
        </div>
      </div>
      <div class="br-slot-actions" style="margin-top:12px;">
        <button class="btn btn-sm slot-btn" onclick="pullCareerHandle()" style="background:var(--orange);color:#fff;">
          🎲 随机球队
        </button>
        <button class="btn btn-sm slot-btn" onclick="showCareerTeamPicker()" style="background:var(--bg-card);color:var(--text);">
          🎯 自选球队
        </button>
      </div>
    </div>
  `;
  
  if (typeof fetchAdTeamTask === 'function') fetchAdTeamTask();
  
  const reel = document.getElementById('career-slot-reel');
  if (reel) {
    const offset = sorted.length * 38 + 38; // 初始偏移到第2复制块，留出上方2项缓冲
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${offset}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
  }
}

function pullCareerHandle() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC5",label:"随机球队-生涯"});
  setTimeout(spinCareerSlot, 200);
}

function spinCareerSlot() {
  const reel = document.getElementById('career-slot-reel');
  if (!reel) return;
  
  var pool = STATE._teamsVisited.length > 0 ? STATE._teamsVisited : [...NBA2K_TEAMS].sort();
  var sorted = pool.slice().sort();
  var teamCount = sorted.length;
  const itemH = 38;
  const copyLen = teamCount * itemH;
  
  const targetIdx = Math.floor(Math.random() * teamCount);
  const targetTeam = sorted[targetIdx];
  
  // 窗口显示5项，中间项索引=2，所以偏移到 targetIdx-2
  const snapIdx = (targetIdx - 2 + teamCount) % teamCount;
  const targetY = copyLen * 2 + snapIdx * itemH;
  
  const curMatch = reel.style.transform.match(/([\d.]+)/);
  const curY = curMatch ? parseFloat(curMatch[0]) : copyLen + 38;
  
  let finalY = targetY;
  while (finalY <= curY + copyLen * 0.5) {
    finalY += copyLen;
  }
  
  const maxY = copyLen * 4 - itemH * 4;
  if (finalY > maxY) {
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${copyLen}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
    finalY = targetY + copyLen;
  }
  
  reel.classList.add('spinning');
  reel.style.transform = `translateY(-${finalY}px)`;
  
  setTimeout(() => {
    reel.classList.remove('spinning');
    
    // ★ 精确回正
    const exactY = copyLen * 3 + snapIdx * itemH;
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${exactY}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
    
    // ★ 高亮中间项（窗口5项，snapIdx为顶部，中间=snapIdx+2）
    var middleIdx = teamCount * 3 + snapIdx + 2;
    highlightSlotItem('career-slot-reel', middleIdx);
    
    STATE._draftSelfPick = false;
    selectCareerTeam(targetTeam);
  }, 3300);
}

function selectCareerTeam(team) {
  STATE.careerTeam = team;
  const teamPlayers = NBA2K_DATA[team];
  const cnName = getTeamName(team);

  var pos = STATE.position;
  var myOvr = STATE.finalOVR;
  var isLogin = isHupuLoggedIn();
  var displayName = getHupuDisplayName();

  STATE._lineupCache = {};
  var lineup = calcTeamLineup(team);
  var posOrder = ['PG', 'SG', 'SF', 'PF', 'C'];
  var starters = posOrder.map(function(p) { return lineup.starters[p]; }).filter(Boolean);
  var bench = lineup.bench || [];
  var startBench = !!(STATE.career && STATE.career.flags && STATE.career.flags.startBench);
  var role = (!startBench && lineup.isUserStarter) ? '首发' : '替补';
  STATE.season.isUserStarter = !startBench && !!lineup.isUserStarter;
  
  // 自建球员头像：本地角色头像
  var defaultAvatar = (typeof DEFAULT_HUPU_AVATAR !== 'undefined') ? DEFAULT_HUPU_AVATAR : 'assets/images/Player/ai-avatars/avatar-asia-01.png';
  if (!HUPU_USER.loaded || !HUPU_USER.isLogin) { ensureHupuUser(true); }
  var avatarUrl = getHupuAvatarUrl() || defaultAvatar;
  
  function renderRosterPlayer(p, isUser, idx) {
    var pOvr = parseInt(p.ovr) || 0;
    var pPos = p.posCn || p.pos || '—';
    var pName = p.cname || p.name;
    var imgHtml;
    if (isUser) {
      imgHtml = '<img class="bp-headshot" style="border-radius:50%;border:2px solid var(--border);width:28px;height:28px;object-fit:cover;" src="' + avatarUrl + '" onerror="this.onerror=null;this.src=\'' + defaultAvatar + '\'">';
    } else {
      var hs = getPlayerHeadshotStyle(p.name, 28);
      imgHtml = hs ? '<div class="bp-headshot" style="' + hs + ';border-radius:50%;border:2px solid var(--border);width:28px;height:28px;"></div>' : '<div style="width:28px;height:28px;border-radius:50%;background:var(--border);"></div>';
    }
    var starBadge = isUser ? '<span style="font-size:10px;margin-left:2px;">⭐</span>' : '';
    return '<div style="display:flex;align-items:center;gap:5px;padding:4px 6px;border-bottom:1px solid var(--border-light);font-size:12px;' + (isUser ? 'background:var(--orange-bg);border-radius:6px;margin:1px 0;border:1.5px solid var(--orange);' : '') + '">'
      + imgHtml
      + '<span style="width:40px;font-size:10px;color:var(--text-dim);">' + pPos + '</span>'
      + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:' + (isUser ? '700' : '400') + ';color:' + (isUser ? 'var(--orange)' : 'var(--text)') + ';">' + pName + starBadge + '</span>'
      + '<span style="font-family:var(--font-display);font-weight:700;font-size:13px;color:' + (isUser ? 'var(--orange)' : 'var(--text)') + ';">' + pOvr + '</span>'
      + '</div>';
  }
  
  var rosterHtml = '<div style="font-family:var(--font-display);font-size:11px;color:var(--orange);padding:2px 4px 4px;letter-spacing:0.5px;">🏀 首发阵容</div>';
  starters.forEach(function(p) { rosterHtml += renderRosterPlayer(p, p._isUser); });
  rosterHtml += '<div style="font-family:var(--font-display);font-size:11px;color:var(--text-dim);padding:6px 4px 4px;letter-spacing:0.5px;border-top:1px solid var(--border);margin-top:2px;">🔄 替补阵容</div>';
  bench.forEach(function(p, i) { rosterHtml += renderRosterPlayer(p, p._isUser, i); });
  
  // ★ 保存本次建球员数据到 storage
  saveBuildPlayerData(team);

  if (STATE._draftPending) {
    STATE._draftPending.selfPicked = !!STATE._draftSelfPick;
    STATE._draftSelfPick = false;
    runPostDraftContractFlow(team, function() {
      renderCareerTeamReveal(team, cnName, role, rosterHtml);
    });
  } else {
    STATE._draftSelfPick = false;
    renderCareerTeamReveal(team, cnName, role, rosterHtml);
  }
}

// ==================== 5.5 自选球队弹窗 ====================
function showCareerTeamPicker(teamList) {
  var isFull = Array.isArray(teamList);
  
  // 计算可选球队数量：3(x+1)，x = 建球员阶段全局剩余的换人次数
  var x = STATE._rerollsLeft || 0;
  var pickCount = Math.min(30, 3 * (x + 1));
  
  if (!isFull && pickCount === 0) {
    return;
  }
  
  // 如果已有弹窗则移除
  var old = document.getElementById('team-picker-overlay');
  if (old) old.remove();
  
  var allTeams;
  var subLine;
  if (isFull) {
    // 全 30 队任选
    allTeams = teamList.slice();
    subLine = '🎉 全 ' + allTeams.length + ' 队任选';
  } else {
    // 从已访问球队中随机选 pickCount 支
    allTeams = STATE._teamsVisited.length > 0 ? STATE._teamsVisited.slice() : [...NBA2K_TEAMS];
    for (var i = allTeams.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = allTeams[i]; allTeams[i] = allTeams[j]; allTeams[j] = tmp;
    }
    allTeams = allTeams.slice(0, pickCount);
    subLine = '剩余换人' + x + '次 · 可选' + pickCount + '队';
  }
  var picked = allTeams;
  
  var gridHtml = '';
  picked.forEach(function(t) {
    var cn = SIM_CONFIG.TEAM_NAMES[t] || t;
    var city = window.TEAM_CITY[t] || '';
    var logo = getTeamLogo(t, 36);
    gridHtml += '<div class="team-pick-card" data-team="' + t + '" onclick="selectCareerTeamFromPicker(\'' + t + '\')">' +
      logo +
      '<span class="tpc-abbr">' + cn + '</span>' +
      '<span class="tpc-name">' + city + '</span>' +
    '</div>';
  });
  
  var overlay = document.createElement('div');
  overlay.className = 'team-picker-overlay';
  overlay.id = 'team-picker-overlay';
  overlay.innerHTML = 
    '<div class="team-picker-modal">' +
      '<div class="team-picker-header">' +
        '<span>' + (isFull ? '🎉 自选喜欢的球队' : '🎯 选择生涯球队') + '</span>' +
        '<button id="adTeamPickBtn" onclick="watchAdToPickTeam()" style="min-height:30px;padding:5px 10px;border:none;border-radius:8px;background:linear-gradient(135deg,#ff6b35,#ff8a5c);color:#fff;font-family:var(--font-display);font-size:11px;font-weight:600;cursor:pointer;box-shadow:0 2px 0 #c94d1e;">🏀 自选全部球队</button>' +
        '<button class="team-picker-close" onclick="closeCareerTeamPicker()">✕</button>' +
      '</div>' +
      '<div class="team-picker-header" style="border-bottom:none;padding:4px 14px 8px;justify-content:center;">' +
        '<span style="' + (isFull ? '' : 'display:none;') + 'font-size:11px;color:var(--text-dim);font-weight:400;">' + subLine + '</span>' +
      '</div>' +
      '<div class="team-picker-grid">' + gridHtml + '</div>' +
    '</div>';
  
  // 点击遮罩关闭
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeCareerTeamPicker();
  });
  
  document.body.appendChild(overlay);
  if (typeof renderAdTeamStatus === 'function') renderAdTeamStatus();
}

function closeCareerTeamPicker() {
  
  var el = document.getElementById('team-picker-overlay');
  if (el) el.remove();
}

function selectCareerTeamFromPicker(team) {
  trackEvent({act:"click",blk:"BMC098",pos:"TC6",label:"自选球队-生涯"});
  closeCareerTeamPicker();
  STATE._draftSelfPick = true;
  selectCareerTeam(team);
}

/** 保存本次建球员数据到 Storage（球队、位置、13项属性、总评） */
function saveBuildPlayerData(team) {
  var playerData = {
    team: team,
    position: STATE.position,
    finalOVR: STATE.finalOVR,
    attrs: {},
  };
  SIM_CONFIG.ATTR_LIST.forEach(function(k) { playerData.attrs[k] = STATE.attrs[k] || null; });
  Storage.savePlayer(playerData);
}

// ==================== 工具函数 ====================
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 老虎机高亮中间可见项（替换静态 nth-child，随滚动位置正确对齐） */
function highlightSlotItem(reelId, middleIndex) {
  var reel = document.getElementById(reelId);
  if (!reel) return;
  reel.querySelectorAll('.br-slot-item.highlight').forEach(function(el) { el.classList.remove('highlight'); });
  var items = reel.querySelectorAll('.br-slot-item');
  if (items[middleIndex]) items[middleIndex].classList.add('highlight');
}

function getConference(team) {
  if (SIM_CONFIG.CONFERENCE.EAST.includes(team)) return 'EAST';
  if (SIM_CONFIG.CONFERENCE.WEST.includes(team)) return 'WEST';
  return 'EAST';
}

function getDivision(team) {
  for (const [div, teams] of Object.entries(SIM_CONFIG.DIVISIONS)) {
    if (teams.includes(team)) return div;
  }
  return null;
}

function getTeamName(team) { return SIM_CONFIG.TEAM_NAMES[team] || team; }

/** 查找球员所属球队缩写 */
function getPlayerTeam(player) {
  for (const team of NBA2K_TEAMS) {
    if (NBA2K_DATA[team] && NBA2K_DATA[team].includes(player)) return team;
  }
  return null;
}

/** 获取球员显示名：优先中文名（取-后部分），无中文名则取逗号后的名 */
function getPlayerDisplayName(playerName) {
  if (window.PERFECT_PLAYER_DISPLAY_BY_NAME && window.PERFECT_PLAYER_DISPLAY_BY_NAME[playerName]) {
    return window.PERFECT_PLAYER_DISPLAY_BY_NAME[playerName];
  }
  // 先找中文名
  for (const team of NBA2K_TEAMS) {
    const players = NBA2K_DATA[team];
    if (!players) continue;
    const p = players.find(p => p.name === playerName);
    if (p) {
      const cn = p.cname || '';
      const dashIdx = cn.indexOf('-');
      return dashIdx >= 0 ? cn.slice(dashIdx + 1) : (cn || playerName);
    }
  }
  // 无中文名 → 取逗号后（如 "Brunson, Jalen" → "Jalen"）
  const commaIdx = playerName.indexOf(', ');
  return commaIdx >= 0 ? playerName.slice(commaIdx + 2) : playerName;
}

window.TEAM_LOGOS = {
  'ATL':'assets/images/teams/ATL.svg',
  'BKN':'assets/images/teams/BKN.svg',
  'BOS':'assets/images/teams/BOS.svg',
  'CHA':'assets/images/teams/CHA.svg',
  'CHI':'assets/images/teams/CHI.svg',
  'CLE':'assets/images/teams/CLE.svg',
  'DAL':'assets/images/teams/DAL.svg',
  'DEN':'assets/images/teams/DEN.svg',
  'DET':'assets/images/teams/DET.svg',
  'GSW':'assets/images/teams/GSW.svg',
  'HOU':'assets/images/teams/HOU.svg',
  'IND':'assets/images/teams/IND.svg',
  'LAC':'assets/images/teams/LAC.svg',
  'LAL':'assets/images/teams/LAL.svg',
  'MEM':'assets/images/teams/MEM.svg',
  'MIA':'assets/images/teams/MIA.svg',
  'MIL':'assets/images/teams/MIL.svg',
  'MIN':'assets/images/teams/MIN.svg',
  'NOP':'assets/images/teams/NOP.svg',
  'NYK':'assets/images/teams/NYK.svg',
  'OKC':'assets/images/teams/OKC.svg',
  'ORL':'assets/images/teams/ORL.svg',
  'PHI':'assets/images/teams/PHI.svg',
  'PHX':'assets/images/teams/PHX.svg',
  'POR':'assets/images/teams/POR.svg',
  'SAC':'assets/images/teams/SAC.svg',
  'SAS':'assets/images/teams/SAS.svg',
  'TOR':'assets/images/teams/TOR.svg',
  'UTA':'assets/images/teams/UTA.svg',
  'WAS':'assets/images/teams/WAS.svg'
};
if (!window.TEAM_CITY) window.TEAM_CITY = {
  'ATL':'亚特兰大','BKN':'布鲁克林','BOS':'波士顿','CHA':'夏洛特','CHI':'芝加哥',
  'CLE':'克里夫兰','DAL':'达拉斯','DEN':'丹佛','DET':'底特律','GSW':'金州',
  'HOU':'休斯顿','IND':'印第安纳','LAC':'洛杉矶','LAL':'洛杉矶','MEM':'孟菲斯',
  'MIA':'迈阿密','MIL':'密尔沃基','MIN':'明尼苏达','NOP':'新奥尔良','NYK':'纽约',
  'OKC':'俄克拉荷马城','ORL':'奥兰多','PHI':'费城','PHX':'菲尼克斯','POR':'波特兰',
  'SAC':'萨克拉门托','SAS':'圣安东尼奥','TOR':'多伦多','UTA':'犹他','WAS':'华盛顿',
};
window._HIDE_TEAM_LOGOS = false;
function getTeamLogo(team, size) {
  if (window._HIDE_TEAM_LOGOS) return '';
  if (!window.TEAM_LOGOS || !window.TEAM_LOGOS[team]) return '';
  const s = size || 20;
  return `<img class="team-logo" src="${window.TEAM_LOGOS[team]}" style="width:${s}px;height:${s}px;vertical-align:middle;object-fit:contain;background:transparent;" alt="${team}">`;
}

function toggleTeamLogos() {
  window._HIDE_TEAM_LOGOS = !window._HIDE_TEAM_LOGOS;
  var cur = document.querySelector('.screen.active');
  if (!cur) return;
  var id = cur.id;
  if (id === 'screen-season') { if (typeof quickSimAllGames === 'function') quickSimAllGames(); }
  else if (id === 'screen-playoffs' && typeof renderPlayoffs === 'function') renderPlayoffs();
  else if (id === 'screen-results' && typeof showSeasonResults === 'function') showSeasonResults();
  else if (id === 'screen-awards' && typeof showAwardsScreen === 'function') showAwardsScreen();
}

/** 获取球队在联盟中的种子排名（1-15） */
function getConferenceSeed(team) {
  const conf = getConference(team);
  const teams = conf === 'EAST' ? SIM_CONFIG.CONFERENCE.EAST : SIM_CONFIG.CONFERENCE.WEST;
  const standings = STATE.season.standings;
  if (!standings) return 99;
  const sorted = teams
    .map(t => ({ team: t, ...standings[t] }))
    .sort((a, b) => {
      const apct = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const bpct = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      return bpct - apct || b.wins - a.wins;
    });
  const idx = sorted.findIndex(s => s.team === team);
  return idx >= 0 ? idx + 1 : 99;
}

/** 获取同分区所有球队按种子排序的列表 */
function getConferenceSorted(conf) {
  const teams = conf === 'EAST' ? SIM_CONFIG.CONFERENCE.EAST : SIM_CONFIG.CONFERENCE.WEST;
  const standings = STATE.season.standings;
  if (!standings) return [];
  return teams
    .map(t => ({ team: t, wins: standings[t]?.wins || 0, losses: standings[t]?.losses || 0 }))
    .sort((a, b) => {
      const apct = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const bpct = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      return bpct - apct || b.wins - a.wins;
    });
}

// ==================== 6. 赛季模拟（新引擎）====================
function startSeason() {
  showScreen('screen-season');
  clearLineupCache();
  var currentStarterStatus = STATE.careerTeam && STATE.finalOVR ? !!calcTeamLineup(STATE.careerTeam).isUserStarter : true;
  if (STATE.career && STATE.career.flags && STATE.career.flags.startBench) currentStarterStatus = false;
  STATE.season = {
    wins: 0, losses: 0,
    games: [],
    playerStats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, games: 0, mins: 0 },
    playoffStats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, games: 0, mins: 0 },
    isUserStarter: currentStarterStatus,
    awards: [],
    playoffResult: null,
    playoffEliminated: false,
    standings: {},     // { team: { wins, losses, streak } }
    statLeaders: {},   // { pts: { name, val }, reb: {...}, ast: {...} }
    schedule: [],
    day: 0,
    isPlayoffs: false,
    playoffBracket: null,
    otherBracket: null,
    _viewConf: null,
    _gamesPlayed: {},
    _leagueGameLog: [],
    rankings: null,
    events: { suspensionGamesLeft: 0, suspensionReason: '', injuryGamesLeft: 0, injuryReason: '', triggeredIds: [], storyTimeline: [], lastTriggerGameNum: null, playoffEventCount: 0, injuryRiskBonus: getNextSeasonMods().injuryRiskBonus || 0, majorInjuryThisSeason: false, playThroughPrompted: {}, regularPlayThroughPromptCount: 0 },
  };
  
  initStandings();
  buildRealSchedule();
  clearSimSeasonFooter();
  // ★ 直接渲染赛季页，加载动画放在 dot-grid 内部
  html('season-controls').innerHTML = '';
  html('gamecast-area').innerHTML = '';
  html('game-list').innerHTML = '';

  var confName = getConference(STATE.careerTeam) === 'EAST' ? '东部' : '西部';
  html('season-header').innerHTML =
    '<div class="sh-top" style="margin-top:8px;">' +
      '<div class="sh-team"><div class="sh-team-name">' + getTeamLogo(STATE.careerTeam, 24) + ' ' + getTeamName(STATE.careerTeam) + '</div><div class="sh-team-full">' + ((window.TEAM_CITY && window.TEAM_CITY[STATE.careerTeam]) || '') + '</div></div>' +
      '<div class="sh-season">' + getCurrentSeasonLabel() + '</div>' +
      '<div class="sh-record" id="simRecord"><span class="sh-wins">0</span><span class="sh-dash">-</span><span class="sh-losses">0</span><div class="sh-pct">—</div></div>' +
    '</div>' +
    '<div class="sh-info" id="simInfo">' +
      '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
      '<span>场均 0分 0板 0助</span>' +
      '<span id="simStreak"></span>' +
    '</div>' +
    (typeof renderPlayerStateStrip === 'function' ? renderPlayerStateStrip() : '') +
    renderEventStatus() +
    '<div class="dot-grid" id="simDotGrid">' +
      '<div style="display:flex;align-items:center;justify-content:center;width:100%;min-height:120px;">' +
        '<div class="loading-balls"><span class="loading-ball"></span><span class="loading-ball"></span><span class="loading-ball"></span></div>' +
      '</div>' +
    '</div>' +
    '<div style="text-align:center;padding:4px 0 8px;font-size:12px;color:var(--text-dim);" id="simStatus"></div>';

  try { ensurePulseBoard(); refreshPulseBoard(true); } catch (e) { console.error('[Pulse]', e); }
  setTimeout(quickSimAllGames, 1200);
}

function skipUserGamePack(opponent, isPlayoff, seedBonus, probMultiplier, attrs, extra) {
  extra = extra || {};
  var teamAHome = extra.teamAHome;
  var fatigueA = extra.fatigueA;
  var schedule = STATE.season && STATE.season.schedule || [];
  var gameIdx = schedule.findIndex(function (g) { return !g.simulated; });
  if (teamAHome == null) teamAHome = gameIdx >= 0 ? !!schedule[gameIdx].home : true;
  if (fatigueA == null) {
    fatigueA = gameIdx > 0 && schedule[gameIdx - 1] && schedule[gameIdx - 1].isB2B ? 1 : 0;
    if (fatigueA && typeof getStyleSkillMu === 'function') {
      var ironMu = getStyleSkillMu('iron_man');
      if (ironMu > 1) fatigueA *= Math.max(0.35, 1 - (ironMu - 1) * 3.5);
    }
  }
  var result = simulate82StyleMatchup(STATE.careerTeam, opponent, {
    teamAHome: teamAHome !== false,
    fatigueA: fatigueA || 0,
    seedBonus: seedBonus || 0,
    probMultiplier: probMultiplier
  });
  var stats = generatePlayerStatsNew(attrs || STATE.attrs, result, !!isPlayoff);
  return { result: result, stats: stats, live: null };
}

function liveOrSkipUserPack(opponent, options, onPack) {
  options = options || {};
  var runSkip = function () {
    onPack(skipUserGamePack(opponent, options.isPlayoff, options.seedBonus, options.probMultiplier, options.attrs, {
      teamAHome: options.teamAHome,
      fatigueA: options.fatigueA
    }));
  };
  var runWatch = function () {
    if (!window.PP_LIVE || typeof PP_LIVE.playTheaterWatch !== 'function') { runSkip(); return; }
    PP_LIVE.playTheaterWatch({
      teamA: STATE.careerTeam,
      teamB: opponent,
      options: {
        isPlayoff: !!options.isPlayoff,
        seedBonus: options.seedBonus || 0,
        probMultiplier: options.probMultiplier,
        game: options.game,
        teamAHome: options.teamAHome,
        fatigueA: options.fatigueA,
        national: options.national,
        attrs: options.attrs,
        broadcastScale: 1
      }
    }, function (pack) {
      if (!pack) { runSkip(); return; }
      onPack(pack);
    });
  };
  var canPrompt = window.PP_LIVE && typeof PP_LIVE.promptChoice === 'function';
  if (!canPrompt || options.forceSkip) { runSkip(); return false; }
  if (options.isPlayoff) {
    if (typeof PP_LIVE.shouldOfferPlayoff === 'function' && !PP_LIVE.shouldOfferPlayoff()) { runSkip(); return false; }
    PP_LIVE.promptChoice({
      kicker: options.playIn ? '附加赛' : '季后赛',
      title: options.title || '观看本场？',
      reason: options.reason || ('对阵 ' + getTeamName(opponent) + '。'),
      allowSeriesSkip: !options.playIn,
      teamA: STATE.careerTeam,
      teamB: opponent
    }, runSkip, runWatch);
    return true;
  }
  if (options.game && typeof PP_LIVE.shouldOfferRegular === 'function' && PP_LIVE.shouldOfferRegular(options.game, options.index || 0, options.total || 82)) {
    PP_LIVE.promptChoice({
      kicker: '关键赛事',
      title: '观看本场？',
      reason: PP_LIVE.describeRegular(options.game, options.index || 0, options.total || 82),
      allowSeasonSkip: true,
      teamA: STATE.careerTeam,
      teamB: opponent
    }, runSkip, runWatch);
    return true;
  }
  runSkip();
  return false;
}

// ★ 逐场模拟全部 82 场常规赛，点逐个出现
function quickSimAllGames() {
  var schedule = STATE.season.schedule;
  if (!schedule || schedule.length === 0) { console.error('[Sim] 赛程为空'); renderDotGrid(); return; }
  var games = schedule.filter(function(g) { return !g.simulated; });
  if (games.length === 0) { renderDotGrid(); return; }

  // 替换加载动画为占位点阵
  var confName = getConference(STATE.careerTeam) === 'EAST' ? '东部' : '西部';
  var placeholderDots = '';
  for (var di = 0; di < games.length; di++) {
    placeholderDots += '<span class="dot dot-pending" id="gdot-' + di + '"></span>';
    if ((di + 1) % 14 === 0) placeholderDots += '<br>';
  }
  html('simDotGrid').innerHTML = placeholderDots;
  html('simStatus').innerHTML = '模拟中 0/' + games.length;
  ensurePulseBoard();
  refreshPulseBoard(true);

  var gi = 0;
  function simNextWithDelay() {
    if (gi >= games.length) {
      function finishRegularSeasonSim() {
      processAllRemainingDays();
      reconcileStandings();
      calcSeasonAwards();

      var w2 = STATE.season.wins || 0, l2 = STATE.season.losses || 0;
      var seed2 = getConferenceSeed(STATE.careerTeam);
      var pct2 = w2 + l2 > 0 ? (w2 / (w2 + l2) * 100).toFixed(1) + '%' : '—';
      var actionBtn = '';
      actionBtn = '<button type="button" class="btn btn-secondary btn-sm" onclick="showAwardsScreen()" style="margin-bottom:6px;">📊 常规赛奖项</button>';
      document.getElementById('simStatus').innerHTML = '';
      document.getElementById('simRecord').innerHTML = '<span class="sh-wins">' + w2 + '</span><span class="sh-dash">-</span><span class="sh-losses">' + l2 + '</span><div class="sh-pct">' + pct2 + '</div>';

      // 最后更新 sh-info
      var psFinal = STATE.season.playerStats;
      var gpFinal = psFinal.games || 1;
      var fPts = Math.round(psFinal.pts / gpFinal * 10) / 10;
      var fReb = Math.round(psFinal.reb / gpFinal * 10) / 10;
      var fAst = Math.round(psFinal.ast / gpFinal * 10) / 10;
      var finfo = document.getElementById('simInfo');
      if (finfo) {
        finfo.innerHTML = '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
          '<span>场均 ' + fPts + '分 ' + fReb + '板 ' + fAst + '助</span>' +
          '<span>' + (STATE.season.standings[STATE.careerTeam]?.streakLen > 0 ? (STATE.season.standings[STATE.careerTeam]?.streak === 'W' ? 'W' : 'L') + (STATE.season.standings[STATE.careerTeam]?.streakLen || '') : '') + '</span>';
      }

      // 球员赛季数据卡
      var ps = STATE.season.playerStats;
      var gp = ps.games || 1;
      var aPts = Math.round(ps.pts / gp * 10) / 10;
      var aReb = Math.round(ps.reb / gp * 10) / 10;
      var aAst = Math.round(ps.ast / gp * 10) / 10;
      var aStl = Math.round(ps.stl / gp * 10) / 10;
      var aBlk = Math.round(ps.blk / gp * 10) / 10;
      var aTov = Math.round(ps.tov / gp * 10) / 10;
      var playerCardHtml =
        '<div class="bv-po-stats">' +
          '<div class="bv-po-title">📊 常规赛场均</div>' +
          '<div class="bv-po-grid">' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aPts + '</span><span class="bv-po-lbl">得分</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aReb + '</span><span class="bv-po-lbl">篮板</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aAst + '</span><span class="bv-po-lbl">助攻</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aStl + '</span><span class="bv-po-lbl">抢断</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aBlk + '</span><span class="bv-po-lbl">盖帽</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aTov + '</span><span class="bv-po-lbl">失误</span></div>' +
          '</div>' +
          '<div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:4px;">' +
            '出战 ' + gp + ' 场 · OVR ' + STATE.finalOVR + ' · ' + SIM_CONFIG.POSITIONS[STATE.position] +
          '</div>' +
        '</div>';

      refreshPulseBoard(true);
      // 最佳比赛：pts + reb + ast 最高的一场
      var bestGame = null, bestTotal = 0;
      var allGames = STATE.season.games || [];
      for (var bgi = 0; bgi < allGames.length; bgi++) {
        var bg = allGames[bgi];
        if (!bg.stats) continue;
        var total = (bg.stats.pts || 0) + (bg.stats.reb || 0) + (bg.stats.ast || 0);
        if (total > bestTotal) { bestTotal = total; bestGame = bg; }
      }
      var bestHtml = '';
      if (bestGame) {
        var bs = bestGame.stats;
        var bgName = getTeamName(bestGame.game.opponent);
        var bWon = bestGame.result.won ? '胜' : '负';
        var bScore = bestGame.result.scoreA + '-' + bestGame.result.scoreB;
        bestHtml = '<div style="margin:8px 0;background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius);padding:8px 16px;">' +
          '<div style="font-family:var(--font-display);font-size:12px;font-weight:700;color:var(--orange);margin-bottom:4px;">🔥 赛季最佳表现：对阵 ' + bgName + '</div>' +
          '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + (bs.pts || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">得分</div></div>' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + (bs.reb || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">篮板</div></div>' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + (bs.ast || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">助攻</div></div>' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + Math.round(bs.stl || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">抢断</div></div>' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + Math.round(bs.blk || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">盖帽</div></div>' +
          '</div>' +
        '</div>';
      }
      var seasonFooter = ensureSimSeasonFooter();
      if (seasonFooter) {
        seasonFooter.innerHTML =
          '<div class="section-card">' + playerCardHtml + '</div>' +
          '<div class="section-card" style="animation-delay:0.8s">' + bestHtml + '</div>' +
          '<div style="text-align:center;padding:0 12px 16px;" id="simActions">' + actionBtn + '</div>';
      }
      trackExposureOnce(document.getElementById('simActions'), {act:"exposure",blk:"BMC099",pos:"T1",label:"赛季结果"});
      setTimeout(function() { maybeShowFirstSixtyWinCelebration(); }, 260);
      return;
      }
      if (window.PP_ALLSTAR && PP_ALLSTAR.maybeShowWeekend(finishRegularSeasonSim, { exact: false })) return;
      finishRegularSeasonSim();
      return;
    }

    try {
      var g = games[gi];

      // ★ 跳过检查（禁赛优先于伤病）
      var ev = STATE.season.events;
      var skipReason = null; // null=不跳过, 'suspension'=禁赛, 'injury'=伤病
      if (ev && ev.suspensionGamesLeft > 0) skipReason = 'suspension';
      else if (ev && ev.injuryGamesLeft > 0) skipReason = 'injury';
      if (skipReason) {
        var runSkippedRegularGame = function() {
          if (skipReason === 'suspension') ev.suspensionGamesLeft--;
          else ev.injuryGamesLeft--;
          var skipResult = simulateGameNew(STATE.careerTeam, g.opponent);
          g.simulated = true;
          g.result = skipResult;
          if (skipResult.won) STATE.season.wins++; else STATE.season.losses++;
          var ourS2 = STATE.season.standings[STATE.careerTeam];
          if (ourS2) { if (skipResult.won) ourS2.wins++; else ourS2.losses++; }
          var oppS2 = STATE.season.standings[g.opponent];
          if (oppS2) { if (skipResult.won) oppS2.losses++; else oppS2.wins++; updateStreak(g.opponent, !skipResult.won); }
          updateStreak(STATE.careerTeam, skipResult.won);
          recordUserMatchupBox(skipResult, g.opponent);
          STATE.season.games.push({ result: skipResult, stats: null, game: g, suspended: true });
          simDayLeagueGames(g.day);
          refreshPulseBoard();
          var dotEl2 = document.getElementById('gdot-' + gi);
          if (dotEl2) {
            dotEl2.className = 'dot dot-x';
            dotEl2.textContent = '✕';
            dotEl2.style.animation = 'popIn .3s ease';
            var label = skipReason === 'suspension' ? '禁赛' : '伤病';
            dotEl2.title = 'G' + (gi + 1) + ': ' + label + ' - ' + (skipReason === 'suspension' ? (ev.suspensionReason || '联盟处罚') : (ev.injuryReason || '伤病休战'));
          }
          var skipIcon = skipReason === 'suspension' ? ' 🔇' : ' 🏥';
          document.getElementById('simRecord').innerHTML = '<span class="sh-wins">' + STATE.season.wins + '</span><span class="sh-dash">-</span><span class="sh-losses">' + STATE.season.losses + '</span><div class="sh-pct">' + (STATE.season.wins + STATE.season.losses > 0 ? (STATE.season.wins / (STATE.season.wins + STATE.season.losses) * 100).toFixed(1) + '%' : '—') + '</div>';
          document.getElementById('simStatus').textContent = '模拟中 ' + (gi + 1) + '/' + games.length + skipIcon;
          var info3 = document.getElementById('simInfo');
          if (info3) {
            var ps3 = STATE.season.playerStats;
            var gp3 = ps3.games || 1;
            info3.innerHTML = '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
              '<span>场均 ' + Math.round(ps3.pts / gp3 * 10) / 10 + '分 ' + Math.round(ps3.reb / gp3 * 10) / 10 + '板 ' + Math.round(ps3.ast / gp3 * 10) / 10 + '助</span>' +
              '<span>' + (STATE.season.standings[STATE.careerTeam]?.streakLen > 0 ? (STATE.season.standings[STATE.careerTeam]?.streak === 'W' ? 'W' : 'L') + (STATE.season.standings[STATE.careerTeam]?.streakLen || '') : '') + '</span>';
          }
          var esEl = document.getElementById('eventStatusBar');
          if (esEl) esEl.outerHTML = renderEventStatus();
          gi++;
          setTimeout(simNextWithDelay, 120);
        };
        var runPlayedThroughRegularGame = function(severity) {
          ev.injuryGamesLeft = Math.max(0, (ev.injuryGamesLeft || 0) - 1);
          var hurtResult = simulateGameNew(STATE.careerTeam, g.opponent, 0, getInjuryPlayWinMultiplier(severity));
          g.simulated = true;
          g.result = hurtResult;
          if (hurtResult.won) STATE.season.wins++; else STATE.season.losses++;
          var ourH = STATE.season.standings[STATE.careerTeam];
          if (ourH) { if (hurtResult.won) ourH.wins++; else ourH.losses++; }
          var oppH = STATE.season.standings[g.opponent];
          if (oppH) { if (hurtResult.won) oppH.losses++; else oppH.wins++; updateStreak(g.opponent, !hurtResult.won); }
          updateStreak(STATE.careerTeam, hurtResult.won);
          recordUserMatchupBox(hurtResult, g.opponent);
          var hurtStats = scaleHurtStats(generatePlayerStatsNew(buildHurtAttrs(STATE.attrs, severity), hurtResult, false), severity);
          var psH = STATE.season.playerStats;
          psH.pts += hurtStats.pts; psH.reb += hurtStats.reb; psH.ast += hurtStats.ast;
          psH.stl += hurtStats.stl; psH.blk += hurtStats.blk; psH.tov += hurtStats.tov;
          psH.fgm += hurtStats.fgm; psH.fga += hurtStats.fga;
          psH.ftm += hurtStats.ftm; psH.fta += hurtStats.fta;
          psH.threeM += hurtStats.threeM; psH.threeA += hurtStats.threeA;
          psH.mins = (psH.mins || 0) + hurtStats.mins;
          psH.games++;
          STATE.season.games.push({ result: hurtResult, stats: hurtStats, game: g, playedThroughInjury: true });
          var worsenText = maybeWorsenInjuryAfterPlaying(ev, severity);
          simDayLeagueGames(g.day);
          refreshPulseBoard();
          var dotH = document.getElementById('gdot-' + gi);
          if (dotH) {
            dotH.className = 'dot ' + (hurtResult.won ? 'dot-w' : 'dot-l');
            dotH.style.animation = 'popIn .3s ease';
            dotH.title = 'G' + (gi + 1) + ': 带伤出战 ' + (hurtResult.won ? '胜' : '负') + ' ' + getTeamName(g.opponent) + (worsenText ? ' · 伤情加重' : '');
          }
          document.getElementById('simRecord').innerHTML = '<span class="sh-wins">' + STATE.season.wins + '</span><span class="sh-dash">-</span><span class="sh-losses">' + STATE.season.losses + '</span><div class="sh-pct">' + (STATE.season.wins + STATE.season.losses > 0 ? (STATE.season.wins / (STATE.season.wins + STATE.season.losses) * 100).toFixed(1) + '%' : '—') + '</div>';
          document.getElementById('simStatus').textContent = '模拟中 ' + (gi + 1) + '/' + games.length + ' 🏥 带伤';
          var infoH = document.getElementById('simInfo');
          if (infoH) {
            var gpH = psH.games || 1;
            infoH.innerHTML = '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
              '<span>场均 ' + Math.round(psH.pts / gpH * 10) / 10 + '分 ' + Math.round(psH.reb / gpH * 10) / 10 + '板 ' + Math.round(psH.ast / gpH * 10) / 10 + '助</span>' +
              '<span>' + (STATE.season.standings[STATE.careerTeam]?.streakLen > 0 ? (STATE.season.standings[STATE.careerTeam]?.streak === 'W' ? 'W' : 'L') + (STATE.season.standings[STATE.careerTeam]?.streakLen || '') : '') + '</span>';
          }
          var esH = document.getElementById('eventStatusBar');
          if (esH) esH.outerHTML = renderEventStatus();
          gi++;
          setTimeout(simNextWithDelay, 120);
        };
        if (skipReason === 'injury' && isKeyInjuredRegularGame(g, gi, games.length) && shouldOfferPlayThroughInjury('reg-' + (STATE.season.games.length + 1), true)) {
          showPlayThroughInjuryModal({
            desc: '赛季已经进入最后阶段，' + getTeamName(STATE.careerTeam) + ' 正卡在排名边缘，下一场对阵 ' + getTeamName(g.opponent) + ' 的结果可能改变季后赛位置。'
          }, runSkippedRegularGame, runPlayedThroughRegularGame);
          return;
        }
        runSkippedRegularGame();
        return;
      }

      var applyRegularPack = function (pack) {
        var result = pack.result;
        var stats = pack.stats;
        g.simulated = true;
        g.result = result;

        if (result.won) STATE.season.wins++;
        else STATE.season.losses++;

        var ourS = STATE.season.standings[STATE.careerTeam];
        if (ourS) { if (result.won) ourS.wins++; else ourS.losses++; }
        var oppS = STATE.season.standings[g.opponent];
        if (oppS) { if (result.won) oppS.losses++; else oppS.wins++; updateStreak(g.opponent, !result.won); }
        updateStreak(STATE.careerTeam, result.won);
        recordUserMatchupBox(result, g.opponent);

        var ps = STATE.season.playerStats;
        ps.pts += stats.pts; ps.reb += stats.reb; ps.ast += stats.ast;
        ps.stl += stats.stl; ps.blk += stats.blk; ps.tov += stats.tov;
        ps.fgm += stats.fgm; ps.fga += stats.fga;
        ps.ftm += stats.ftm; ps.fta += stats.fta;
        ps.threeM += stats.threeM; ps.threeA += stats.threeA;
        ps.mins = (ps.mins || 0) + stats.mins;
        ps.games++;

        STATE.season.games.push({ result: result, stats: stats, game: g, liveSim: !!result.liveSim });
        simDayLeagueGames(g.day);
        refreshPulseBoard();

        var evData = null;
        try { evData = checkRandomEvents(g, result, stats); } catch(ex) {}
        var branchEv = null;
        if (evData) {
          if (evData._consequence === 'suspension') {
            STATE.season.events.suspensionReason = evData.desc;
          } else if (evData._consequence === 'injury') {
            STATE.season.events.injuryReason = evData.desc;
          }
        } else {
          try { branchEv = checkSeasonBranchEvent(g, result, stats); } catch(ex) {}
        }

        var dotEl = document.getElementById('gdot-' + gi);
        if (dotEl) {
          dotEl.className = 'dot ' + (result.won ? 'dot-w' : 'dot-l');
          dotEl.style.animation = 'popIn .3s ease';
          dotEl.title = 'G' + (gi + 1) + ': ' + (result.won ? '胜' : '负') + ' ' + getTeamName(g.opponent) + ' ' + (result.scoreA || '') + '-' + (result.scoreB || '');
        }

        document.getElementById('simRecord').innerHTML = '<span class="sh-wins">' + STATE.season.wins + '</span><span class="sh-dash">-</span><span class="sh-losses">' + STATE.season.losses + '</span><div class="sh-pct">' + (STATE.season.wins + STATE.season.losses > 0 ? (STATE.season.wins / (STATE.season.wins + STATE.season.losses) * 100).toFixed(1) + '%' : '—') + '</div>';
        document.getElementById('simStatus').textContent = '模拟中 ' + (gi + 1) + '/' + games.length;

        var ps2 = STATE.season.playerStats;
        var gp2 = ps2.games || 1;
        var avgPts2 = Math.round(ps2.pts / gp2 * 10) / 10;
        var avgReb2 = Math.round(ps2.reb / gp2 * 10) / 10;
        var avgAst2 = Math.round(ps2.ast / gp2 * 10) / 10;
        var info = document.getElementById('simInfo');
        if (info) {
          info.innerHTML = '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
            '<span>场均 ' + avgPts2 + '分 ' + avgReb2 + '板 ' + avgAst2 + '助</span>' +
            '<span>' + (STATE.season.standings[STATE.careerTeam]?.streakLen > 0 ? (STATE.season.standings[STATE.careerTeam]?.streak === 'W' ? 'W' : 'L') + (STATE.season.standings[STATE.careerTeam]?.streakLen || '') : '') + '</span>';
        }

        var esEl2 = document.getElementById('eventStatusBar');
        if (esEl2) esEl2.outerHTML = renderEventStatus();

        gi++;
        function chainAfterGame() {
          if (evData && typeof showEventModal === 'function') {
            showEventModal(evData, function() { setTimeout(simNextWithDelay, 120); });
          } else if (branchEv) {
            showSeasonBranchEvent(branchEv, function() { setTimeout(simNextWithDelay, 120); });
          } else {
            setTimeout(simNextWithDelay, 120);
          }
        }
        if (window.PP_ALLSTAR && PP_ALLSTAR.maybeShowWeekend(chainAfterGame)) return;
        chainAfterGame();
      };

      var paused = liveOrSkipUserPack(g.opponent, {
        game: g,
        index: gi,
        total: games.length,
        teamAHome: !!g.home,
        national: (gi >= 11 && (gi + 1) % 11 === 0)
      }, applyRegularPack);
      return;
    } catch(e) { console.error('[Sim] 第' + (gi + 1) + '场异常:', e); gi++; setTimeout(simNextWithDelay, 120); }
  }

  simNextWithDelay();
}

/** 从所有比赛结果重新统计 standings */
function reconcileStandings() {
  var st = STATE.season.standings;
  if (!st) return;
  for (var team in st) {
    if (st.hasOwnProperty(team)) {
      st[team].wins = 0;
      st[team].losses = 0;
      st[team].gp = 0;
      st[team].pts = 0;
      st[team].oppPts = 0;
      st[team].poss = 0;
    }
  }
  var allGames = STATE.season.games || [];
  for (var i = 0; i < allGames.length; i++) {
    var g = allGames[i];
    if (!g.result) continue;
    var myTeam = STATE.careerTeam;
    var opp = g.game.opponent;
    if (g.result.won) { if (st[myTeam]) st[myTeam].wins++; if (st[opp]) st[opp].losses++; }
    else { if (st[myTeam]) st[myTeam].losses++; if (st[opp]) st[opp].wins++; }
    recordTeamBox(myTeam, g.result.scoreA, g.result.scoreB, g.result.pace);
    recordTeamBox(opp, g.result.scoreB, g.result.scoreA, g.result.pace);
  }
  var leagueGames = STATE.season._leagueGameLog || [];
  for (var j = 0; j < leagueGames.length; j++) {
    var lg = leagueGames[j];
    if (st[lg.home]) { if (lg.won) st[lg.home].wins++; else st[lg.home].losses++; }
    if (st[lg.away]) { if (!lg.won) st[lg.away].wins++; else st[lg.away].losses++; }
    recordTeamBox(lg.home, lg.scoreA, lg.scoreB, lg.pace);
    recordTeamBox(lg.away, lg.scoreB, lg.scoreA, lg.pace);
  }
}

// ★ 常规赛排名系统 ============================================

/** 估算球员场均数据（基于属性 + af 系数） */
function estimatePlayerStats(player) {
  var f = function(v) { return af(parseInt(v) || 50); };
  var pos = (player.pos || 'SF').split('/')[0].trim();
  var pts = (f(player.FIN) * 0.4 + f(player.MID) * 0.3 + f(player.threePT) * 0.3) * 22 + 2;
  var reb = f(player.REB) * (pos === 'C' ? 14 : pos === 'PF' ? 10 : 6) + 1;
  var ast = f(player.PAS) * (pos === 'PG' ? 10 : pos === 'SG' ? 6 : 4) + 1;
  var stl = f(player.PDEF) * 3 + 0.3;
  var blk = f(player.BLK) * (pos === 'C' ? 4 : pos === 'PF' ? 2.5 : 0.5) + 0.2;
  return { pts: Math.round(pts * 10) / 10, reb: Math.round(reb * 10) / 10, ast: Math.round(ast * 10) / 10, stl: Math.round(stl * 10) / 10, blk: Math.round(blk * 10) / 10, pos: pos, ovr: parseInt(player.ovr) || 50 };
}

/** 获取用户场均数据 */
function getUserAvg() {
  var ps = STATE.season.playerStats;
  var gp = ps.games || 1;
  return { pts: Math.round(ps.pts / gp * 10) / 10, reb: Math.round(ps.reb / gp * 10) / 10, ast: Math.round(ps.ast / gp * 10) / 10, stl: Math.round(ps.stl / gp * 10) / 10, blk: Math.round(ps.blk / gp * 10) / 10, pos: STATE.position, ovr: STATE.finalOVR };
}

function getPlayerAwardStreak(player, act) {
  return player && player._awardStreak ? (player._awardStreak[act] || 0) : 0;
}

function addPlayerAwardStreak(player, act) {
  player._awardStreak = player._awardStreak || {};
  player._awardStreak[act] = (player._awardStreak[act] || 0) + 1;
}

function getUserPlayerObject() {
  if (!STATE._userAwardStreak) STATE._userAwardStreak = {};
  if (!STATE._userAwardStreak._awardStreak) STATE._userAwardStreak._awardStreak = {};
  return STATE._userAwardStreak;
}

function getUserRankStreak(act, rank) {
  var m = STATE._userAwardRankStreak || {};
  var rec = m[act];
  return rec && rec.rank === rank ? (rec.count || 0) : 0;
}

function recordUserRank(act, rank) {
  if (!rank) return;
  STATE._userAwardRankStreak = STATE._userAwardRankStreak || {};
  var rec = STATE._userAwardRankStreak[act] || { rank: null, count: 0 };
  if (rec.rank === rank) {
    rec.count = (rec.count || 0) + 1;
  } else {
    rec.rank = rank;
    rec.count = 1;
  }
  STATE._userAwardRankStreak[act] = rec;
}

var MVP_STAR_NAMES = [
  'A-J-迪班萨', '达林-彼得森', '卡梅隆-布泽尔',
  '乔丹-史密斯二世', '泰兰-斯托克斯', '斯特凡-约克西莫维奇',
  '若阿金-布姆杰-布姆杰', '尼古拉-库斯图里卡', '马库斯-斯皮尔斯二世'
];

// 热门新秀专属最佳阵容窗口起始赛季（2026届 2029-30、2027届 2030-31、2028届 2031-32，各持续4个赛季）
var MVP_STAR_ALLNBA_START = [2029, 2029, 2029, 2030, 2030, 2030, 2031, 2031, 2031];

function isMvpStar(p) {
  return p && MVP_STAR_NAMES.indexOf(p.cname) >= 0;
}

function getMvpStarAllNbaStart(p) {
  if (!p) return null;
  var idx = MVP_STAR_NAMES.indexOf(p.cname);
  return idx >= 0 ? MVP_STAR_ALLNBA_START[idx] : null;
}

function getPlayerEnterYear(p) {
  if (p && p._enterYear) return p._enterYear;
  var age = p ? getLeaguePlayerAge(p) : 22;
  var y = 2025 + ((STATE.career && STATE.career.seasonCount) || 0);
  if (p && typeof age === 'number' && age > 0) p._enterYear = y - (age - 19);
  return (p && p._enterYear) || y;
}

function findPlayerByIdentity(nameEN, nameCN) {
  for (var _ft = 0; _ft < NBA2K_TEAMS.length; _ft++) {
    var roster = (NBA2K_DATA && NBA2K_DATA[NBA2K_TEAMS[_ft]]) || [];
    for (var _fp = 0; _fp < roster.length; _fp++) {
      var p = roster[_fp];
      if (nameEN && p.name === nameEN) return p;
      if (nameCN && p.cname === nameCN) return p;
    }
  }
  return null;
}

function pickLeagueDPOY() {
  var best = null, bestTeam = '', bestScore = -1;
  for (var _dt = 0; _dt < NBA2K_TEAMS.length; _dt++) {
    var roster = (NBA2K_DATA && NBA2K_DATA[NBA2K_TEAMS[_dt]]) || [];
    for (var _dp = 0; _dp < roster.length; _dp++) {
      var p = roster[_dp];
      if (p._isUser) continue;
      if (getPlayerAwardStreak(p, 'dpoy') >= 2) continue;
      var score = ((parseInt(p.PDEF) || 60) * 0.5) + ((parseInt(p.IDEF) || 60) * 0.5) + ((parseInt(p.BLK) || 50) * 0.8) + ((parseInt(p.ovr) || 70) * 0.3);
      if (score > bestScore) { bestScore = score; best = p; bestTeam = NBA2K_TEAMS[_dt]; }
    }
  }
  return best ? { player: best, team: bestTeam } : null;
}

function computeSixthManRank(avgPts) {
  var scores = [];
  for (var _st2 = 0; _st2 < NBA2K_TEAMS.length; _st2++) {
    var t2 = NBA2K_TEAMS[_st2];
    if (t2 === STATE.careerTeam) continue;
    var lineup2b = calcTeamLineup(t2);
    var bench2b = lineup2b.bench || [];
    var best2 = 0;
    for (var _b2 = 0; _b2 < bench2b.length; _b2++) {
      var pb = bench2b[_b2];
      if (pb._isUser) continue;
      if (getPlayerAwardStreak(pb, 'sixthman') >= 2) continue;
      var o2 = parseInt(pb.ovr) || 0;
      if (o2 > best2) best2 = o2;
    }
    if (best2 > 0) scores.push(best2);
  }
  var userScore = Math.round((avgPts || 0) * 3 + (parseInt(STATE.finalOVR) || 0) * 0.4);
  scores.push(userScore);
  scores.sort(function(x, y) { return y - x; });
  return scores.indexOf(userScore) + 1;
}

function updateAwardStreaks() {
  var c = STATE.career;
  var seasonKey = c && c.seasonCount;
  if (!seasonKey || STATE._awardStreakSeason === seasonKey) return;
  STATE._awardStreakSeason = seasonKey;
  var acts = ['mvp', 'dpoy', 'sixthman'];
  var userObj = getUserPlayerObject();
  var winnerByAct = {};
  (STATE.season.awards || []).forEach(function(a) {
    if (!a || !a.act || acts.indexOf(a.act) < 0) return;
    winnerByAct[a.act] = a.isUser ? userObj : findPlayerByIdentity(a.winnerEN || '', a.winner || '');
    if (a.userRank) recordUserRank(a.act, a.userRank);
  });
  function nextStreak(player, act) {
    var old = player && player._awardStreak ? (player._awardStreak[act] || 0) : 0;
    return winnerByAct[act] === player ? old + 1 : 0;
  }
  for (var _st = 0; _st < NBA2K_TEAMS.length; _st++) {
    var roster = (NBA2K_DATA && NBA2K_DATA[NBA2K_TEAMS[_st]]) || [];
    for (var _sp = 0; _sp < roster.length; _sp++) {
      var p = roster[_sp];
      p._awardStreak = p._awardStreak || {};
      for (var _sa = 0; _sa < acts.length; _sa++) p._awardStreak[acts[_sa]] = nextStreak(p, acts[_sa]);
    }
  }
  for (var _ua = 0; _ua < acts.length; _ua++) userObj._awardStreak[acts[_ua]] = nextStreak(userObj, acts[_ua]);
}

/** 计算四项排名，存入 STATE.season.rankings */
function calcSeasonAwards() {
  try {
  var ps = STATE.season.playerStats;
  if (!ps || !ps.games) return;
  var g = ps.games;
  var avg = STATE.season.avgStats || {
    pts: Math.round(ps.pts / g * 10) / 10,
    reb: Math.round(ps.reb / g * 10) / 10,
    ast: Math.round(ps.ast / g * 10) / 10,
    stl: Math.round(ps.stl / g * 10) / 10,
    blk: Math.round(ps.blk / g * 10) / 10,
  };
  STATE.season.awards = [];

    function lp(name) {
    for (var _t = 0; _t < NBA2K_TEAMS.length; _t++) {
      var _r = NBA2K_DATA[NBA2K_TEAMS[_t]];
      if (!_r) continue;
      for (var _p = 0; _p < _r.length; _p++) {
        if (_r[_p].name === name) return { team: NBA2K_TEAMS[_t], cname: _r[_p].cname || name, playerName: name };
      }
    }
    return null;
  }

  function getLeagueRank(team) {
    var rows = [];
    for (var _lt = 0; _lt < NBA2K_TEAMS.length; _lt++) {
      var code = NBA2K_TEAMS[_lt];
      var st = STATE.season.standings && STATE.season.standings[code];
      rows.push({ team: code, wins: st ? st.wins : 0, losses: st ? st.losses : 82 });
    }
    rows.sort(function(a, b) {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });
    for (var _lr = 0; _lr < rows.length; _lr++) {
      if (rows[_lr].team === team) return _lr + 1;
    }
    return 30;
  }

  function getAllStarTeamBonus(team) {
    var seed = getConferenceSeed(team);
    if (seed <= 3) return 4;
    if (seed <= 6) return 2;
    if (seed <= 10) return 1;
    return 0;
  }

  function calcAllStarScore(stat, ovr, team, gamesPlayed) {
    var gp = gamesPlayed == null ? 82 : gamesPlayed;
    if (gp < 40) return -999;
    var score = (stat.pts || 0) * 1.0
      + (stat.reb || 0) * 0.7
      + (stat.ast || 0) * 0.8
      + (stat.stl || 0) * 1.4
      + (stat.blk || 0) * 1.4
      + (parseInt(ovr) || 0) * 0.18
      + getAllStarTeamBonus(team);
    if (gp < 50) score -= 8;
    return score;
  }

  (function() {
    var allStarCandidates = [];
    for (var _ast = 0; _ast < NBA2K_TEAMS.length; _ast++) {
      var aTeam = NBA2K_TEAMS[_ast];
      var rosterA = NBA2K_DATA[aTeam] || [];
      for (var _asp = 0; _asp < rosterA.length; _asp++) {
        var ap = rosterA[_asp];
        var aOvr = parseInt(ap.ovr) || 50;
        if (aOvr < 82) continue;
        var aPos = (ap.pos || 'SF').split('/')[0].trim();
        var est = {
          pts: aOvr * 0.34 - 2 + Math.random() * 3,
          reb: aPos === 'C' ? aOvr * 0.16 + 1.5 : aPos === 'PF' ? aOvr * 0.13 + 1 : aOvr * 0.07 + 1,
          ast: aPos === 'PG' ? aOvr * 0.13 + 2 : aPos === 'SG' ? aOvr * 0.08 + 1 : aOvr * 0.05 + 1,
          stl: aOvr >= 88 ? 1.1 : 0.8,
          blk: (aPos === 'C' || aPos === 'PF') ? 1.0 : 0.35,
        };
        allStarCandidates.push({
          name: ap.cname || ap.name,
          playerName: ap.name || '',
          team: aTeam,
          score: calcAllStarScore(est, aOvr, aTeam, 82),
          isUser: false,
        });
      }
    }
    var userAllStarScore = calcAllStarScore(avg, STATE.finalOVR, STATE.careerTeam, g);
    var awardFx = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : {};
    userAllStarScore += Number(awardFx.awardAllStarScore) || 0;
    allStarCandidates.push({
      name: getHupuDisplayName(),
      playerName: '',
      team: STATE.careerTeam,
      score: userAllStarScore,
      isUser: true,
    });
    allStarCandidates.sort(function(a, b) { return b.score - a.score; });
    var userAllStarIndex = allStarCandidates.findIndex(function(x) { return x.isUser; });
    var userAllStarRank = userAllStarIndex >= 0 ? userAllStarIndex + 1 : 99;
    var userAllStarSelected = false;
    if (userAllStarScore >= 42) {
      userAllStarSelected = true;
    } else if (userAllStarScore >= 38 && (parseInt(STATE.finalOVR) || 0) >= 84) {
      userAllStarSelected = userAllStarRank <= 28 || Math.random() < (0.35 + (Number(awardFx.awardAllStarSwing) || 0));
    }
    if (g < 40) userAllStarSelected = false;
    var allStarUserRank = userAllStarSelected ? '⭐ 入选' : (g < 40 ? '出勤不足' : '未入围');
    STATE.season.awards.push({
      act:'allStar',
      label:'全明星',
      winner:userAllStarSelected ? getHupuDisplayName() : allStarUserRank,
      winnerEN:'',
      team:'',
      isUser:userAllStarSelected,
      userRank:allStarUserRank
    });
  })();

  var mvpTickets = [];
  var seasonYear = 2025 + ((STATE.career && STATE.career.seasonCount) || 0);
  for (var _mt = 0; _mt < NBA2K_TEAMS.length; _mt++) {
    var mTeam = NBA2K_TEAMS[_mt];
    var rosterM = NBA2K_DATA[mTeam] || [];
    var rankM = getLeagueRank(mTeam);
    for (var _mp = 0; _mp < rosterM.length; _mp++) {
      var mp = rosterM[_mp];
      var mOvr = parseInt(mp.ovr) || 0;
      if (mOvr < 92 && !isMvpStar(mp)) continue;
      if (isMvpStar(mp) && mOvr < 88) continue; // 热门新秀也要具备 MVP 候选资格
      if (getPlayerAwardStreak(mp, 'mvp') >= 2) continue; // 连续两届 MVP，下赛季大幅降权
      var mAge = getLeaguePlayerAge(mp);
      if (mAge >= 31) continue; // 31 岁及以上视为老将，不再参与 MVP
      var ticketCount = rankM <= 3 ? 2 : 1;
      var starStart2 = getMvpStarAllNbaStart(mp);
      if (starStart2 != null && seasonYear >= starStart2 && seasonYear <= starStart2 + 3) ticketCount += 4; // 热门新秀专属 MVP 窗口：+4
      var cand = { cname: mp.cname || mp.name, playerName: mp.name, team: mTeam, isUser: false, rank: rankM };
      for (var _mc = 0; _mc < ticketCount; _mc++) mvpTickets.push(cand);
    }
  }
  if ((parseInt(STATE.finalOVR) || 0) >= 92) {
    var userObjM = getUserPlayerObject();
    var userMvpBlocked = userObjM && getPlayerAwardStreak(userObjM, 'mvp') >= 2;
    if (!userMvpBlocked) {
      var userRankM = getLeagueRank(STATE.careerTeam);
      var userTickets = userRankM <= 3 ? 2 : 1;
      var mvpFx = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : {};
      var extraMvp = Number(mvpFx.awardMvpExtraTickets) || 0;
      userTickets += Math.floor(extraMvp);
      if (Math.random() < (extraMvp - Math.floor(extraMvp))) userTickets++;
      var userCand = { cname: getHupuDisplayName(), playerName: '', team: STATE.careerTeam, isUser: true, rank: userRankM };
      for (var _um = 0; _um < userTickets; _um++) mvpTickets.push(userCand);
    }
  }
  if (mvpTickets.length === 0) {
    var fallbackMvp = lp('Nikola Jokić') || { cname:'尼古拉·约基奇', playerName:'Nikola Jokić', team:'DEN', isUser:false, rank:30 };
    mvpTickets.push(fallbackMvp);
  }
  var mvpPick = mvpTickets[Math.floor(Math.random() * mvpTickets.length)];
  var mvpUserRank = mvpPick.isUser ? '🥇 第一名' : (((parseInt(STATE.finalOVR) || 0) >= 92) ? '进入评选' : '未入围');
  if (!mvpPick.isUser && mvpUserRank !== '未入围' && getUserRankStreak('mvp', mvpUserRank) >= 2) {
    mvpUserRank = '未入围'; // 连续两届同奖项同名次，下一届波动
  }
  STATE.season.awards.push({
    act:'mvp',
    label:'MVP',
    winner:mvpPick.cname,
    winnerEN:mvpPick.playerName || '',
    team:mvpPick.team || '',
    isUser:!!mvpPick.isUser,
    userRank:mvpUserRank
  });
  if (STATE.career) {
    STATE.career.lastMvp = {
      team: mvpPick.team || (mvpPick.isUser ? STATE.careerTeam : '') || '',
      isUser: !!mvpPick.isUser,
      winner: mvpPick.cname || ''
    };
  }

  var defSum = avg.stl + avg.blk;
  var dpoyFx = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : {};
  defSum += Number(dpoyFx.awardDpoyStockBump) || 0;
  var userObjD = getUserPlayerObject();
  var userDpoyStreak = userObjD ? getPlayerAwardStreak(userObjD, 'dpoy') : 0;
  var dpoyProtected = userDpoyStreak >= 2;
  var dpoyThreshold = dpoyProtected ? 4.2 : 3.55;
  var dpoyUserRank = '未进入前五';
  if (dpoyProtected) {
    dpoyUserRank = '🥈 第二名';
  } else if (defSum >= dpoyThreshold) {
    dpoyUserRank = '🥇 第一名';
  } else if (defSum >= 3.0) {
    dpoyUserRank = '🥉 第三名';
  } else if (defSum >= 2.5) {
    dpoyUserRank = '第四名';
  }
  var dpoyWin = !dpoyProtected && defSum >= dpoyThreshold;
  if (!dpoyWin && !dpoyProtected && dpoyUserRank !== '未进入前五' && getUserRankStreak('dpoy', dpoyUserRank) >= 2) {
    dpoyUserRank = '未进入前五'; // 连续两届同奖项同名次，下一届波动
  }
  if (dpoyWin) {
    STATE.season.awards.push({ act:'dpoy', label:'DPOY', winner:getHupuDisplayName(), winnerEN:'', team:STATE.careerTeam, isUser:true, userRank:'🥇 第一名' });
  } else {
    var dpoyPick = pickLeagueDPOY();
    var fallbackW = lp('Victor Wembanyama') || { team:'SAS', cname:'维克托-文班亚马', playerName:'Victor Wembanyama' };
    var w = dpoyPick ? dpoyPick.player : fallbackW;
    var wTeam = dpoyPick ? dpoyPick.team : (fallbackW.team || 'SAS');
    STATE.season.awards.push({ act:'dpoy', label:'DPOY', winner:w.cname || w.name, winnerEN:w.name || w.playerName || 'Victor Wembanyama', team:wTeam, isUser:false, userRank:dpoyUserRank });
  }

  // 最佳阵容：按位置取全联盟 Top 5
  (function() {
    var userAvg2 = { pts: avg.pts, reb: avg.reb, ast: avg.ast, stl: avg.stl, blk: avg.blk, pos: STATE.position, ovr: STATE.finalOVR, name:getHupuDisplayName(), team:STATE.careerTeam };
    var allNBACandidates = [];
    for (var _ti = 0; _ti < NBA2K_TEAMS.length; _ti++) {
      var _r2 = NBA2K_DATA[NBA2K_TEAMS[_ti]];
      if (!_r2) continue;
      for (var _pi2 = 0; _pi2 < _r2.length; _pi2++) {
        var p = _r2[_pi2];
        var pos2 = (p.pos || 'SF').split('/')[0].trim();
        var ovr2 = parseInt(p.ovr) || 50;
        // 简化估算：pts ≈ OVR * 0.4 - 5, reb/ast 按位置
        var epts = ovr2 * 0.38 - 4 + Math.random() * 4;
        var ereb = pos2 === 'C' ? ovr2 * 0.18 + 2 : pos2 === 'PF' ? ovr2 * 0.14 + 1 : ovr2 * 0.08 + 1;
        var east = pos2 === 'PG' ? ovr2 * 0.14 + 2 : pos2 === 'SG' ? ovr2 * 0.09 + 1 : ovr2 * 0.06 + 1;
        var ageNow = getLeaguePlayerAge(p);
        var score = epts * 0.4 + ereb * 0.15 + east * 0.15 + (ovr2/99) * 5;
        var starStart = getMvpStarAllNbaStart(p);
        var inStarWindow = starStart != null && seasonYear >= starStart && seasonYear <= starStart + 3;
        if (inStarWindow) {
          score += 4; // 热门新秀专属最佳阵容窗口：+4 且不叠加通用年轻加成
        } else if (ageNow >= 22 && ageNow <= 24) {
          score += ageNow === 22 ? 2 : (ageNow === 23 ? 4 : 6); // 22-24 岁年轻球员最佳阵容加成
        }
        if (ageNow >= 31 && !inStarWindow) score -= 6; // 31 岁及以上视为老将，压制（专属窗口内豁免）
        allNBACandidates.push({ name: p.cname || p.name, playerName: p.name, team: NBA2K_TEAMS[_ti], pos: pos2, pts: epts, reb: ereb, ast: east, ovr: ovr2, score: score, isUser: false });
      }
    }
    var userAllNBACandidate = { name:getHupuDisplayName(), playerName:'', team:STATE.careerTeam, pos:userAvg2.pos, pts:userAvg2.pts, reb:userAvg2.reb, ast:userAvg2.ast, ovr:userAvg2.ovr, score: userAvg2.pts * 0.4 + userAvg2.reb * 0.15 + userAvg2.ast * 0.15 + (userAvg2.ovr/99) * 5, isUser: true };
    allNBACandidates.push(userAllNBACandidate);
    allNBACandidates.sort(function(a,b) { return b.score - a.score; });

    var posOrder = ['PG','SG','SF','PF','C'];
    var selected = [], usedTeam = {};
    for (var _pi3 = 0; _pi3 < allNBACandidates.length && selected.length < 5; _pi3++) {
      var c = allNBACandidates[_pi3];
      if (selected.some(function(x) { return x.pos === c.pos; })) continue;
      selected.push(c);
    }
    // 补位：如果某位置没人，从最高分补
    for (var _pi4 = 0; _pi4 < allNBACandidates.length && selected.length < 5; _pi4++) {
      var c2 = allNBACandidates[_pi4];
      if (selected.indexOf(c2) >= 0) continue;
      selected.push(c2);
    }
    selected = selected.slice(0, 5);

    // MVP 锁定最佳阵容：当选 MVP 的球员无论是否玩家，都必须出现在最佳阵容中
    var mvpPos = STATE.position;
    if (mvpPick && !mvpPick.isUser) {
      mvpPos = 'C';
      var mvpRoster = (mvpPick.team && NBA2K_DATA[mvpPick.team]) || [];
      for (var _mpr = 0; _mpr < mvpRoster.length; _mpr++) {
        if (mvpRoster[_mpr].name === mvpPick.playerName) {
          mvpPos = (mvpRoster[_mpr].pos || 'SF').split('/')[0].trim();
          break;
        }
      }
    }
    var mvpAllNBACandidate = { name: mvpPick.cname, playerName: mvpPick.playerName || '', team: mvpPick.team || '', pos: mvpPos, pts: 0, reb: 0, ast: 0, ovr: 99, score: 99, isUser: !!mvpPick.isUser };
    var forceCandidates = [];
    function isNameForced(name) {
      return selected.some(function(x) { return x.name === name; }) || forceCandidates.some(function(x) { return x.name === name; });
    }
    if (mvpPick && !isNameForced(mvpAllNBACandidate.name)) {
      forceCandidates.push(mvpAllNBACandidate);
    }
    if (dpoyWin && !selected.some(function(x) { return x.isUser; }) && !forceCandidates.some(function(x) { return x.isUser; })) {
      forceCandidates.push(userAllNBACandidate);
    }
    var forcedNames = [];
    forceCandidates.forEach(function(fc) {
      if (selected.some(function(x) { return x.name === fc.name; })) return;
      forcedNames.push(fc.name);
      if (selected.length < 5) {
        selected.push(fc);
      } else {
        var replaceIdx = -1;
        var lowestScore = Infinity;
        for (var _sr = 0; _sr < selected.length; _sr++) {
          if (forcedNames.indexOf(selected[_sr].name) >= 0) continue;
          var sc = selected[_sr].score || 0;
          if (sc < lowestScore) {
            lowestScore = sc;
            replaceIdx = _sr;
          }
        }
        if (replaceIdx >= 0) selected[replaceIdx] = fc;
      }
    });

    var userInNBA = false;
    for (var _ri = 0; _ri < selected.length; _ri++) {
      if (selected[_ri].isUser) { userInNBA = true; break; }
    }
    var userRankNBA = userInNBA ? '🥇 入选最佳阵容' : '未入选';
    var winnerList = selected.map(function(x) { return x.name; }).join('、');
    var winnerENList = selected.map(function(x) { return x.playerName || ''; }).join(',');
    STATE.season.awards.push({ act:'allNBA', label:'最佳阵容', winner:winnerList, winnerEN:winnerENList, team:'', isUser:userInNBA, userRank:userRankNBA, isList:true });
  })();

  var isFirstCareerSeason = !STATE.career || STATE.career.seasonCount === 0;
  if (!isFirstCareerSeason) {
    STATE.season.awards = STATE.season.awards.filter(function(a) {
      return !a || (a.act !== 'roty' && a.act !== 'allRookie');
    });
  }
  if (isFirstCareerSeason) {
    function draft2026Player(cn) {
      if (typeof NBA2K_TEAMS !== 'undefined' && typeof NBA2K_DATA !== 'undefined') {
        for (var _rt = 0; _rt < NBA2K_TEAMS.length; _rt++) {
          var _rr = NBA2K_DATA[NBA2K_TEAMS[_rt]] || [];
          for (var _rp2 = 0; _rp2 < _rr.length; _rp2++) {
            if (_rr[_rp2].cname === cn) return { cname: cn, playerName: _rr[_rp2].name || '' };
          }
        }
      }
      return { cname: cn, playerName: '' };
    }
    function getDefault2026RookieAwardPool() {
      var fixedRookies = ['A-J-迪班萨', '达林-彼得森', '卡梅隆-布泽尔'];
      var randomPool = (typeof DRAFT_CLASS_2026 !== 'undefined' ? DRAFT_CLASS_2026 : [])
        .filter(function(p) { return p && fixedRookies.indexOf(p.cn) < 0; })
        .map(function(p) { return p.cn; });
      var randomRookies = [];
      while (randomPool.length && randomRookies.length < 2) {
        var pickIdx = Math.floor(Math.random() * randomPool.length);
        randomRookies.push(randomPool.splice(pickIdx, 1)[0]);
      }
      while (randomRookies.length < 2) randomRookies.push('随机26届新秀');
      return fixedRookies.concat(randomRookies).map(draft2026Player);
    }
    var default2026RookieAwardPool = getDefault2026RookieAwardPool();
    var cSeed = getConferenceSeed(STATE.careerTeam);
    var rotyRank = '未进入前五';
    if (STATE.finalOVR >= 88 && cSeed <= 6) { rotyRank = '🥇 第一名'; }
    else if (STATE.finalOVR >= 85 && cSeed < 8) { rotyRank = '🥉 第三名'; }
    else if (STATE.finalOVR >= 85 && cSeed < 10) { rotyRank = '第四名'; }
    var rotyWin = STATE.finalOVR >= 88 && cSeed <= 6;
    if (rotyWin) {
      STATE.season.awards.push({ act:'roty', label:'年度最佳新秀', winner:getHupuDisplayName(), winnerEN:'', team:STATE.careerTeam, isUser:true, userRank:'🥇 第一名' });
    } else {
      var pool = default2026RookieAwardPool;
      var rp = pool[Math.floor(Math.random() * pool.length)];
      STATE.season.awards.push({ act:'roty', label:'年度最佳新秀', winner:rp.cname, winnerEN:rp.playerName || '', team:'', isUser:false, userRank:rotyRank });
    }

    // 最佳新秀阵容：仅用户新秀赛季展示
    (function() {
      var rookies = default2026RookieAwardPool.slice();
      var rotyIsTop4 = rotyRank === '🥇 第一名' || rotyRank === '🥉 第三名' || rotyRank === '第四名';
      var userInRookie = rotyIsTop4;
      var userRookieRank = '';
      if (rotyIsTop4) {
        userRookieRank = '🥇 入选最佳新秀阵容';
      } else if (STATE.finalOVR > 75) {
        userRookieRank = '新秀二阵';
      } else {
        userRookieRank = '未入围';
      }
      var names = rookies.map(function(r) { return r.cname; });
      var enNames = rookies.map(function(r) { return r.playerName || ''; });
      if (rotyIsTop4) {
        names[4] = getHupuDisplayName();
        enNames[4] = '';  // user slot — rendered via avatar, not a CDN name
      }
      var winnerList = names.join('、');
      var winnerENList = enNames.join(',');
      STATE.season.awards.push({ act:'allRookie', label:'最佳新秀阵容', winner:winnerList, winnerEN:winnerENList, team:'', isUser:userInRookie, userRank:userRookieRank, isList:true });
    })();
  }

  // 第六人：东西部第一的替补中最高 OVR 者获奖
  (function() {
    var bestBench = null, bestBOvr = 0, bestBTeam = '';
    var confs2 = ['EAST', 'WEST'];
    for (var _ci2 = 0; _ci2 < confs2.length; _ci2++) {
      var sorted2 = getConferenceSorted(confs2[_ci2]);
      if (!sorted2.length) continue;
      var topT2 = sorted2[0].team;
      var lineup2 = calcTeamLineup(topT2);
      var bench2 = lineup2.bench || [];
      for (var _bi2 = 0; _bi2 < bench2.length; _bi2++) {
        var p2 = bench2[_bi2];
        if (p2._isUser) continue;
        if (getPlayerAwardStreak(p2, 'sixthman') >= 2) continue; // 连续两届第六人，下赛季大幅降权
        var ovr2 = parseInt(p2.ovr) || 0;
        if (ovr2 > bestBOvr) { bestBOvr = ovr2; bestBench = p2; bestBTeam = topT2; }
      }
    }
    var bCN2 = '未知';
    if (bestBench) {
      bCN2 = bestBench.cname || bestBench.name;
    }
    // 判断用户排名：评奖前按当前阵容重新同步，避免休赛期后状态过期
    syncUserStarterStatus();
    var userIsBench = !STATE.season.isUserStarter;
    var userSixthRank = '首发球员不参与评选';
    var sixthUserObj = getUserPlayerObject();
    var sixthThreshold = (sixthUserObj && getPlayerAwardStreak(sixthUserObj, 'sixthman') >= 2) ? 22 : 18;
    if (userIsBench && avg.pts >= sixthThreshold) {
      userSixthRank = '🥇 第一名';
    } else if (userIsBench) {
      var sr = computeSixthManRank(avg.pts);
      if (sr === 1) userSixthRank = '进入评选';
      else if (sr === 2) userSixthRank = '🥈 第二名';
      else if (sr === 3) userSixthRank = '🥉 第三名';
      else if (sr === 4) userSixthRank = '第四名';
      else if (sr === 5) userSixthRank = '第五名';
      else userSixthRank = '未进入前五';
    }
    var sixthWin = userIsBench && avg.pts >= sixthThreshold;
    if (!sixthWin && userSixthRank !== '未进入前五' && userSixthRank !== '首发球员不参与评选' && getUserRankStreak('sixthman', userSixthRank) >= 2) {
      userSixthRank = '未进入前五';
    }
    if (sixthWin) {
      STATE.season.awards.push({ act:'sixthman', label:'最佳第六人', winner:getHupuDisplayName(), winnerEN:'', team:STATE.careerTeam, isUser:true, userRank:'🥇 第一名' });
    } else {
      STATE.season.awards.push({ act:'sixthman', label:'最佳第六人', winner:bCN2, winnerEN:bestBench?.name || '', team:bestBTeam, isUser:false, userRank:userSixthRank });
    }
  })();
  updateAwardStreaks();
  } catch(e) { STATE.season.awards = STATE.season.awards || []; }
}

/** 奖项页：每个奖项一行，头像 + 获奖者 + 排名 */
function showAwardsScreen() {
  if (showAwardsScreen._busy) return;
  showAwardsScreen._busy = true;
  var holdBusy = false;
  try {
  trackEvent({act:"click",blk:"BMC098",pos:"TC16",label:"常规赛奖项"});
  if (!STATE._skipSixtyWinBeforeAwards && maybeShowFirstSixtyWinCelebration(function() {
    STATE._skipSixtyWinBeforeAwards = true;
    showAwardsScreen._busy = false;
    showAwardsScreen();
    STATE._skipSixtyWinBeforeAwards = false;
  })) {
    holdBusy = true;
    return;
  }
  showScreen('screen-awards');
  try {
    if (!STATE.season.awards || STATE.season.awards.length === 0) calcSeasonAwards();
  } catch (e) { console.error('[Awards] calcSeasonAwards', e); }
  var awards = STATE.season.awards;
  if (!awards || awards.length === 0) {
    html('awards-content').innerHTML =
      '<div style="text-align:center;padding:28px 16px;">' +
        '<div style="font-size:15px;font-weight:700;margin-bottom:8px;">奖项还没统计出来</div>' +
        '<div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">点下面再试一次；若仍没有，强刷后再进这一页。</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="showAwardsScreen()">重新统计</button>' +
      '</div>';
    return;
  }
  html('awards-content').innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100dvh - 120px);">' +
      '<div class="loading-balls"><span class="loading-ball"></span><span class="loading-ball"></span><span class="loading-ball"></span></div>' +
      '<div style="margin-top:16px;font-size:13px;color:var(--text-muted);font-family:var(--font-display);letter-spacing:1px;">统计选票中</div>' +
    '</div>';

  setTimeout(function() {
  try {
  var seed = getConferenceSeed(STATE.careerTeam);
  var emojiMap = { mvp:'🏆', dpoy:'🔒', mip:'📈', allStar:'⭐', allNBA:'🌟', allDefense:'🛡️', roty:'🌱', allRookie:'🌱', sixthman:'🔥' };
  var catMap = { mvp:'最有价值球员', dpoy:'最佳防守球员', mip:'进步最快球员', allStar:'全明星', allNBA:'最佳阵容', allDefense:'最佳防守阵容', roty:'最佳新秀', allRookie:'最佳新秀阵容', sixthman:'最佳第六人' };

  function getHs(enName) {
    if (!enName) return '';
    var s = getPlayerHeadshotStyle(enName, 40);
    return s ? s.replace(/width:\d+px;height:\d+px;?/, '') : '';
  }

  var rowsHtml = '';
  var order = ['mvp', 'dpoy', 'mip', 'allStar', 'roty', 'sixthman', 'allNBA', 'allDefense', 'allRookie'];
  var isFirstAwardSeason = !STATE.career || STATE.career.seasonCount === 0;
  var rowsRendered = 0;
  for (var oi = 0; oi < order.length; oi++) {
    var a = null;
    for (var ai = 0; ai < awards.length; ai++) { if (awards[ai].act === order[oi]) { a = awards[ai]; break; } }
    if (!a) continue;
    if (!isFirstAwardSeason && (a.act === 'roty' || a.act === 'allRookie')) continue;
    var idx = rowsRendered++;
    var emoji = emojiMap[a.act] || '🏅';
    var cat = catMap[a.act] || a.label;
    var rankText = a.userRank == null ? '—' : String(a.userRank);
    var rankCls = 'dim';
    if (rankText.indexOf('🥇') >= 0) rankCls = 'gold';
    else if (rankText.indexOf('🥉') >= 0) rankCls = 'orange';

    // 头像
    var headshotHtml = '';
    if (a.isList) {
      // 列表奖项（最佳阵容/新秀阵容）：头像逐行显示在名字旁（见下方 leftContent），
      // 左侧大圈用奖项 emoji 作为分组标识，取代原来加载失败的空白队标占位圈。
      headshotHtml = '<div style="width:44px;height:44px;flex-shrink:0;border-radius:50%;background:var(--orange-dim);display:flex;align-items:center;justify-content:center;font-size:20px;">' + emoji + '</div>';
    } else {
      var hsStyle = '';
      if (a.isUser) {
        var avatarUrl = getHupuAvatarUrl();
        if (avatarUrl) hsStyle = 'background-image:url(' + avatarUrl + ');background-size:cover;background-position:center;';
      } else if (a.winnerEN) {
        hsStyle = getHs(a.winnerEN);
      }
      if (hsStyle) {
        headshotHtml = '<div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;border:2px solid var(--orange);background-size:cover;background-position:center;' + hsStyle + '"></div>';
      } else {
        headshotHtml = '<div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;background:var(--orange-dim);display:flex;align-items:center;justify-content:center;font-size:18px;">' + emoji + '</div>';
      }
    }

    var leftContent = '';
    if (a.isList) {
      var names = a.winner.split('、');
      var namesEN = (a.winnerEN || '').split(',');
      var myDisplayName = getHupuDisplayName();
      leftContent = '<div style="padding:2px 0 0;">';
      for (var ni = 0; ni < names.length; ni++) {
        var isMy = names[ni] === myDisplayName;
        // 每位球员名字前显示小头像
        var rowHs;
        if (isMy) {
          var myAvatar = getHupuAvatarUrl();
          rowHs = myAvatar
            ? 'background-image:url(' + myAvatar + ');background-size:cover;background-position:center;width:18px;height:18px;'
            : getPlayerHeadshotStyle(myDisplayName, 18);
        } else {
          rowHs = getPlayerHeadshotStyle(namesEN[ni] || names[ni], 18);
        }
        leftContent += '<div style="display:flex;align-items:center;gap:6px;line-height:1.7;">' +
          '<div style="width:18px;height:18px;border-radius:50%;flex-shrink:0;border:1.5px solid ' + (isMy ? 'var(--gold)' : 'var(--border)') + ';background-size:cover;background-position:center;' + rowHs + '"></div>' +
          '<span style="font-size:11px;' + (isMy ? 'color:var(--orange);font-weight:700;' : 'color:var(--text);font-weight:500;') + '">' + (isMy ? '⭐ ' : '') + names[ni].replace(/·/g, '-') + '</span>' +
        '</div>';
      }
      leftContent += '</div>' + (a.summary ? '<div style="font-size:9px;color:var(--text-muted);line-height:1.35;margin-top:2px;">' + a.summary + '</div>' : '');
    } else {
      leftContent = '<div style="font-size:13px;font-weight:600;' + (a.isUser ? 'color:var(--orange);' : 'color:var(--text);') + 'margin:1px 0 1px;">' + (a.isUser ? '⭐ ' : '') + a.winner.replace(/·/g, '-') + '</div>' +
        (a.summary ? '<div style="font-size:9px;color:var(--text-muted);line-height:1.35;margin-top:2px;">' + a.summary + '</div>' : '');
    }

    rowsHtml +=
      '<div class="award-row" data-track-pos="T' + (idx + 2) + '" data-track-label="' + cat + '" style="display:flex;align-items:center;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;' + (idx < rowsRendered - 1 ? 'margin-bottom:5px;' : '') + 'animation-delay:' + (idx * 1.0) + 's;">' +
        // 头像区
        '<div style="padding:0 0 0 12px;flex-shrink:0;">' + headshotHtml + '</div>' +
        // 获奖信息
        '<div style="flex:1;padding:8px 12px;">' +
          '<div class="award-label">' + emoji + ' ' + cat + '</div>' +
          leftContent +
        '</div>' +
        // 排名
        '<div style="width:110px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;border-left:1px solid var(--border-light);">' +
          '<div style="font-size:10px;color:var(--text-muted);letter-spacing:1px;margin-bottom:2px;font-weight:600;">你的排名</div>' +
          '<div class="award-rank ' + rankCls + '">' + rankText + '</div>' +
        '</div>' +
      '</div>';
  }

  var actionBtns = '';
  if (seed <= 6) actionBtns = '<button class="btn btn-gold" onclick="renderPlayoffs()">🏀 进入季后赛（' + seed + '号种子）</button>';
  else if (seed <= 10) actionBtns = '<button class="btn btn-gold" onclick="renderPlayoffs()">🔥 附加赛（' + seed + '号种子）</button>';
  else actionBtns = '<button class="btn btn-secondary" onclick="showSeasonResults()">📊 查看赛季总结</button>';

  html('awards-content').innerHTML =
    rowsHtml +
    '<div style="text-align:center;padding:8px 0 0;">' + actionBtns + '</div>';
  document.querySelectorAll('#awards-content .award-row').forEach(function(row) {
    trackExposureOnce(row, {act:"exposure",blk:"BMC099",pos:row.getAttribute('data-track-pos'),label:row.getAttribute('data-track-label')});
  });
  } catch (err) {
    console.error('[Awards] render', err);
    html('awards-content').innerHTML =
      '<div style="text-align:center;padding:28px 16px;">奖项页渲染失败，请再试一次。<br><button type="button" class="btn btn-secondary btn-sm" onclick="showAwardsScreen()">重新打开</button></div>';
  }
  }, 200);
  } finally {
    if (!holdBusy) showAwardsScreen._busy = false;
  }
}

// ★ 实验性：82 场赛果点阵图
function renderDotGrid() {
  try {
  showScreen('screen-season');
  var rec = STATE.season;
  var w = rec.wins || 0, l = rec.losses || 0;
  var pct = w + l > 0 ? (w / (w + l) * 100).toFixed(1) + '%' : '—';
  var seed = getConferenceSeed(STATE.careerTeam);
  var confName = getConference(STATE.careerTeam) === 'EAST' ? '东部' : '西部';

  var actionBtn = '';
  if (seed <= 6) actionBtn = '<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="margin-top:6px;">🏀 进入季后赛（' + seed + '号种子）</button>';
  else if (seed <= 10) actionBtn = '<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="margin-top:6px;">🔥 附加赛（' + seed + '号种子）</button>';
  else actionBtn = '<button class="btn btn-secondary btn-sm" onclick="showSeasonResults()" style="margin-top:6px;">📊 查看赛季总结</button>';

  var dotsHtml = '';
  if (rec.games && rec.games.length > 0) {
    rec.games.forEach(function(g, i) {
      if (g.suspended) {
        dotsHtml += '<span class="dot dot-x" title="G' + (i + 1) + ': 禁赛">✕</span>';
      } else {
        dotsHtml += '<span class="dot ' + (g.result.won ? 'dot-w' : 'dot-l') + '" title="G' + (i + 1) + ': ' + (g.result.won ? '胜' : '负') + ' ' + getTeamName(g.game.opponent) + ' ' + (g.result.scoreA || '') + '-' + (g.result.scoreB || '') + '"></span>';
      }
      if ((i + 1) % 14 === 0) dotsHtml += '<br>';
    });
  }

  // 清空旧内容
  clearSimSeasonFooter();
  html('season-controls').innerHTML = '';
  html('gamecast-area').innerHTML = '';
  html('game-list').innerHTML = '';

  html('season-header').innerHTML =
    '<div class="sh-top" style="margin-top:8px;">' +
      '<div class="sh-team"><div class="sh-team-name">' + getTeamLogo(STATE.careerTeam, 24) + ' ' + getTeamName(STATE.careerTeam) + '</div><div class="sh-team-full">' + ((window.TEAM_CITY && window.TEAM_CITY[STATE.careerTeam]) || '') + '</div></div>' +
      '<div class="sh-season">' + getCurrentSeasonLabel() + '</div>' +
      '<div class="sh-record"><span class="sh-wins">' + w + '</span><span class="sh-dash">-</span><span class="sh-losses">' + l + '</span><div class="sh-pct">' + pct + '</div></div>' +
    '</div>' +
    '<div class="sh-info" id="simInfo2">' +
      '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
      '<span>' + (function(){ var ps=STATE.season.playerStats,g=ps.games||1; return '场均 ' + Math.round(ps.pts/g*10)/10 + '分 ' + Math.round(ps.reb/g*10)/10 + '板 ' + Math.round(ps.ast/g*10)/10 + '助'; })() + '</span>' +
    '</div>' +
    renderEventStatus() +
    '<div class="dot-grid" id="simDotGrid">' + dotsHtml + '</div>' +
    '<div style="text-align:center;padding:0 12px 16px;">' + actionBtn + '</div>';
  try { ensurePulseBoard(); refreshPulseBoard(true); } catch (e) { console.error('[Pulse]', e); }
  } catch(e) { console.error('[Grid] renderDotGrid 异常:', e); }
}

// ==================== 联盟排名初始化 ====================
function initStandings() {
  NBA2K_TEAMS.forEach(t => {
    STATE.season.standings[t] = { wins: 0, losses: 0, streak: '', streakLen: 0, gp: 0, pts: 0, oppPts: 0, poss: 0 };
  });
  STATE._pulseConf = getConference(STATE.careerTeam) === 'WEST' ? 'WEST' : 'EAST';
  STATE._pulseRanks = {};
}

function recordTeamBox(team, pts, oppPts, pace) {
  var s = STATE.season && STATE.season.standings && STATE.season.standings[team];
  if (!s) return;
  var p = Number(pace);
  if (!isFinite(p) || p < 70) p = 99.4;
  s.gp = (s.gp || 0) + 1;
  s.pts = (s.pts || 0) + (Number(pts) || 0);
  s.oppPts = (s.oppPts || 0) + (Number(oppPts) || 0);
  s.poss = (s.poss || 0) + p;
}

function recordUserMatchupBox(result, opponent) {
  if (!result) return;
  recordTeamBox(STATE.careerTeam, result.scoreA, result.scoreB, result.pace);
  recordTeamBox(opponent, result.scoreB, result.scoreA, result.pace);
}

function teamEff(s) {
  var poss = Number(s && s.poss) || 0;
  if (poss < 1) return { off: '—', def: '—', net: '—', netN: 0 };
  var off = (Number(s.pts) || 0) / poss * 100;
  var def = (Number(s.oppPts) || 0) / poss * 100;
  var net = off - def;
  return {
    off: off.toFixed(1),
    def: def.toFixed(1),
    net: (net >= 0 ? '+' : '') + net.toFixed(1),
    netN: net
  };
}

function sortedConferenceRows(conf) {
  var teams = (SIM_CONFIG.CONFERENCE && SIM_CONFIG.CONFERENCE[conf]) || [];
  var st = (STATE.season && STATE.season.standings) || {};
  return teams.map(function(t) {
    var s = st[t] || { wins: 0, losses: 0, streak: '', streakLen: 0 };
    return { team: t, wins: s.wins || 0, losses: s.losses || 0, s: s };
  }).sort(function(a, b) {
    return (b.wins - b.losses) - (a.wins - a.losses) || b.wins - a.wins || a.team.localeCompare(b.team);
  });
}

function switchPulseConf(conf) {
  STATE._pulseConf = conf === 'WEST' ? 'WEST' : 'EAST';
  STATE._standingsTab = STATE._pulseConf;
  var wrap = document.getElementById('pp-pulse');
  if (wrap) {
    var tabs = wrap.querySelectorAll('.pp-pulse-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-on', tabs[i].getAttribute('data-conf') === STATE._pulseConf);
    }
  }
  refreshPulseBoard(true);
}

/** 清除赛季模拟页底部「常规赛场均 / 最佳表现 / 奖项」区域（避免跨赛季重复堆叠） */
function clearSimSeasonFooter() {
  var footerHost = document.getElementById('sim-season-footer');
  if (footerHost) footerHost.innerHTML = '';
  var pulse = document.getElementById('pp-pulse');
  if (!pulse || !pulse.parentNode) return;
  var child = pulse.nextSibling;
  while (child) {
    if (child.nodeType !== 1) {
      child = child.nextSibling;
      continue;
    }
    if (child.id === 'sim-season-footer') {
      child = child.nextSibling;
      continue;
    }
    if (child.id === 'simActions' || child.id === 'sim-season-summary' ||
        (child.classList && child.classList.contains('section-card') && child.querySelector('.bv-po-title'))) {
      var toRemove = child;
      child = child.nextSibling;
      toRemove.remove();
      continue;
    }
    break;
  }
}

function ensureSimSeasonFooter() {
  var footerHost = document.getElementById('sim-season-footer');
  if (footerHost) return footerHost;
  var pulse = document.getElementById('pp-pulse') || ensurePulseBoard();
  if (!pulse || !pulse.parentNode) return null;
  footerHost = document.createElement('div');
  footerHost.id = 'sim-season-footer';
  pulse.parentNode.appendChild(footerHost);
  return footerHost;
}

function ensurePulseBoard() {
  var host = document.getElementById('pp-pulse-host');
  var wrap = document.getElementById('pp-pulse');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'pp-pulse';
    wrap.className = 'pp-pulse';
    if (host) host.appendChild(wrap);
    else {
      var status = document.getElementById('simStatus');
      if (status && status.parentNode) status.parentNode.insertBefore(wrap, status.nextSibling);
      else return null;
    }
  } else if (host && wrap.parentNode !== host) {
    host.appendChild(wrap);
  }
  if (!STATE._pulseConf) STATE._pulseConf = getConference(STATE.careerTeam) === 'WEST' ? 'WEST' : 'EAST';
  if (!wrap.getAttribute('data-ready')) {
    wrap.setAttribute('data-ready', '1');
    wrap.innerHTML =
      '<div class="pp-pulse-note" style="font-size:13px;font-weight:700;color:var(--text);padding:2px 4px 8px;">联盟排名</div>' +
      '<div class="pp-pulse-tabs">' +
        '<button type="button" class="pp-pulse-tab' + (STATE._pulseConf === 'EAST' ? ' is-on' : '') + '" data-conf="EAST" onclick="switchPulseConf(\'EAST\')">东部</button>' +
        '<button type="button" class="pp-pulse-tab' + (STATE._pulseConf === 'WEST' ? ' is-on' : '') + '" data-conf="WEST" onclick="switchPulseConf(\'WEST\')">西部</button>' +
      '</div>' +
      '<div class="pp-pulse-note">半区前10 · 胜差 · 百回合进攻 / 防守 / 净效率</div>' +
      '<div class="pp-pulse-hdr"><span>#</span><span>球队</span><span>胜</span><span>负</span><span>差</span><span>进攻</span><span>防守</span><span>净</span></div>' +
      '<div class="pp-pulse-list" id="pp-pulse-list"></div>';
  }
  ensureSimSeasonFooter();
  return wrap;
}

function refreshPulseBoard(instant) {
  try {
  var wrap = ensurePulseBoard();
  if (!wrap) return;
  var list = document.getElementById('pp-pulse-list');
  if (!list) return;
  var conf = STATE._pulseConf || 'EAST';
  var rows = sortedConferenceRows(conf);
  if (!rows.length) return;
  var display = [];
  var shown = {};
  for (var ri = 0; ri < rows.length && display.length < 10; ri++) {
    display.push({ s: rows[ri], rank: ri + 1 });
    shown[rows[ri].team] = 1;
  }
  if (STATE.careerTeam) {
    for (var uj = 0; uj < rows.length; uj++) {
      if (rows[uj].team === STATE.careerTeam && !shown[STATE.careerTeam]) {
        display.push({ s: rows[uj], rank: uj + 1 });
        break;
      }
    }
  }
  var leaderW = rows[0].wins, leaderL = rows[0].losses;
  var ranks = STATE._pulseRanks || (STATE._pulseRanks = {});
  var firstTops = {};
  if (!instant) {
    for (var i = 0; i < list.children.length; i++) {
      firstTops[list.children[i].getAttribute('data-team')] = list.children[i].getBoundingClientRect().top;
    }
  }
  var byTeam = {};
  for (var j = 0; j < list.children.length; j++) {
    byTeam[list.children[j].getAttribute('data-team')] = list.children[j];
  }
  display.forEach(function(item, idx) {
    var s = item.s;
    var rank = item.rank;
    var el = byTeam[s.team];
    var created = !el;
    if (created) {
      el = document.createElement('div');
      el.setAttribute('data-team', s.team);
      el.innerHTML = '<span class="pp-pulse-rank"></span><span class="pp-pulse-name"></span><span class="st-w"></span><span class="st-l"></span><span class="pp-gb"></span><span class="pp-off"></span><span class="pp-def"></span><span class="pp-pulse-net"></span>';
      el.children[1].innerHTML = getTeamLogo(s.team, 16) + '<em>' + getTeamName(s.team) + (s.team === STATE.careerTeam ? ' ★' : '') + '</em>';
    }
    var gb = rank === 1 ? '—' : ((leaderW - s.wins + s.losses - leaderL) / 2).toFixed(1);
    var m = teamEff(s.s);
    var oldRank = ranks[s.team];
    var delta = (!instant && oldRank != null) ? (oldRank - rank) : 0;
    var deltaHtml = '';
    if (delta > 0) deltaHtml = '<span class="pp-pulse-delta">▲' + delta + '</span>';
    else if (delta < 0) deltaHtml = '<span class="pp-pulse-delta">▼' + Math.abs(delta) + '</span>';
    el.className = 'pp-pulse-row'
      + (s.team === STATE.careerTeam ? ' is-mine' : '')
      + (delta > 0 ? ' is-up' : '')
      + (delta < 0 ? ' is-down' : '')
      + (rank === 7 || rank > 10 ? ' is-cut' : '');
    var netCls = m.net === '—' ? '' : (m.netN >= 0 ? ' is-pos' : ' is-neg');
    el.children[0].innerHTML = rank + deltaHtml;
    el.children[2].textContent = s.wins;
    el.children[3].textContent = s.losses;
    el.children[4].textContent = gb;
    el.children[5].textContent = m.off;
    el.children[6].textContent = m.def;
    el.children[7].textContent = m.net;
    el.children[7].className = 'pp-pulse-net' + netCls;
    list.appendChild(el);
  });
  var keep = {};
  display.forEach(function(item) { keep[item.s.team] = 1; });
  Array.prototype.slice.call(list.children).forEach(function(el) {
    if (!keep[el.getAttribute('data-team')]) el.parentNode.removeChild(el);
  });
  if (!instant) {
    for (var k = 0; k < list.children.length; k++) {
      list.children[k].style.transition = 'none';
      list.children[k].style.transform = 'none';
    }
    void list.offsetHeight;
    for (var n = 0; n < list.children.length; n++) {
      var el2 = list.children[n];
      var oldTop = firstTops[el2.getAttribute('data-team')];
      if (oldTop == null) continue;
      var dy = oldTop - el2.getBoundingClientRect().top;
      if (Math.abs(dy) < 0.5) continue;
      el2.style.transform = 'translateY(' + dy + 'px)';
    }
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        var kids = document.getElementById('pp-pulse-list');
        if (!kids) return;
        for (var p = 0; p < kids.children.length; p++) {
          kids.children[p].style.transition = 'transform .48s cubic-bezier(.22,.82,.24,1), box-shadow .4s ease';
          kids.children[p].style.transform = 'translateY(0)';
        }
      });
    });
  } else {
    for (var q = 0; q < list.children.length; q++) {
      list.children[q].style.transition = 'none';
      list.children[q].style.transform = 'none';
    }
  }
  ['EAST', 'WEST'].forEach(function(c) {
    sortedConferenceRows(c).forEach(function(s, idx) { ranks[s.team] = idx + 1; });
  });
  } catch (e) { console.error('[Pulse]', e); }
}

// ==================== 赛程生成（真实NBA赛程）====================
function buildRealSchedule() {
  const myTeam = STATE.careerTeam;
  const rawSchedule = NBA2K_SCHEDULE[myTeam];
  if (!rawSchedule) {
    console.error('No schedule for', myTeam);
    return;
  }
  
  const schedule = rawSchedule.map(g => ({
    opponent: g.opponent,
    home: g.home,
    gameNum: g.gameNum,
    day: g.day,
    simulated: false,
    result: null,
  }));
  
  STATE.season.schedule = schedule;
  
  // ★ 构建每日比赛映射（去重）
  const dayMap = {};
  // 遍历所有球队的赛程，每场比赛只记一次（用home team的entry）
  const seen = new Set();
  Object.keys(NBA2K_SCHEDULE).forEach(team => {
    NBA2K_SCHEDULE[team].forEach(g => {
      if (!g.home) return; // 只记主队entry（避免重复）
      const gameKey = `${g.day}-${team}-${g.opponent}`;
      if (seen.has(gameKey)) return;
      seen.add(gameKey);
      if (!dayMap[g.day]) dayMap[g.day] = [];
      dayMap[g.day].push({ home: team, away: g.opponent });
    });
  });
  STATE.season._dayMap = dayMap;
  STATE.season._processedDays = new Set();
  STATE.season._leagueGameLog = [];
  
  // renderGameList();  // 日历模式已注释
}

/** 模拟到目前为止所有未处理的比赛日 */
function simDayLeagueGames(day) {
  const dayMap = STATE.season._dayMap;
  if (!dayMap) return;
  const processed = STATE.season._processedDays || new Set();
  
  // 找到所有 <= day 且未处理的比赛日，一次性处理
  const daysToProcess = Object.keys(dayMap)
    .map(Number)
    .filter(d => d <= day && !processed.has(d))
    .sort((a, b) => a - b);
  
  if (daysToProcess.length === 0) return;
  
  const standings = STATE.season.standings;
  
  daysToProcess.forEach(d => {
    processed.add(d);
    const games = dayMap[d];
    if (!games) return;
    
    games.forEach(g => {
      // 跳过包含我方球队的比赛（这些已经通过我们的比赛模拟过了）
      if (g.home === STATE.careerTeam || g.away === STATE.careerTeam) return;
      
      const leagueResult = simulate82StyleMatchup(g.home, g.away, { teamAHome: true, includeBoxScore: false, leagueGame: true });
      if (leagueResult.won) {
        standings[g.home].wins++; standings[g.away].losses++;
        updateStreak(g.home, true); updateStreak(g.away, false);
      } else {
        standings[g.away].wins++; standings[g.home].losses++;
        updateStreak(g.away, true); updateStreak(g.home, false);
      }
      recordTeamBox(g.home, leagueResult.scoreA, leagueResult.scoreB, leagueResult.pace);
      recordTeamBox(g.away, leagueResult.scoreB, leagueResult.scoreA, leagueResult.pace);
      if (STATE.season._leagueGameLog) {
        STATE.season._leagueGameLog.push({
          home: g.home, away: g.away, won: !!leagueResult.won,
          scoreA: leagueResult.scoreA, scoreB: leagueResult.scoreB, pace: leagueResult.pace
        });
      }
    });
  });
  
  STATE.season._processedDays = processed;
}

// ==================== 新比赛引擎 ====================
/** 解析位置：返回该球员能打的所有位置 */
function getPlayerPositions(posStr) {
  if (!posStr) return [];
  return String(posStr).split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
}

/** 判断球员是否能打某位置 */
function canPlayPosition(playerPos, targetPos) {
  return getPlayerPositions(playerPos).includes(targetPos);
}

/** 获取球员显示位置（给UI用） */
function getPositionDisplay(posStr) {
  if (!posStr) return '—';
  return posStr;
}

/** 按位置计算球队首发+轮换（用户参与规划；未首发则第六人） */
function calcTeamLineup(team) {
  const allPlayers = (NBA2K_DATA[team] || []).slice();
  let userPlayer = null;
  var careerEffects = team === STATE.careerTeam && typeof getCareerProfileEffects === 'function'
    ? getCareerProfileEffects()
    : { lineupBonus: 0 };
  var rosterSig = allPlayers.map(function(p) {
    return [p.name, p.pos, p.ovr, p.contract || ''].join(':');
  }).join('|');
  var lineupCacheKey = [
    team,
    rosterSig,
    STATE.careerTeam || '',
    STATE.position || '',
    STATE.finalOVR || '',
    careerEffects.lineupBonus || 0,
    STATE.season?.isPlayoffs ? 'po' : 'rs'
  ].join('||');
  STATE._lineupCache = STATE._lineupCache || {};
  if (STATE._lineupCache[lineupCacheKey]) return STATE._lineupCache[lineupCacheKey];
  
  // 如果是你的球队，把你加入阵容
  if (team === STATE.careerTeam && STATE.finalOVR) {
    const playoffDebuff = 0;
    var _displayName = getHupuDisplayName();
    userPlayer = {
      name: _displayName,
      cname: _displayName,
      ovr: Math.max(60, parseInt(STATE.finalOVR) - playoffDebuff),
      _lineupOvr: Math.max(60, parseInt(STATE.finalOVR) - playoffDebuff + (careerEffects.lineupBonus || 0)),
      pos: STATE.position,
      ...STATE.attrs,
      _isUser: true,
      _playoffDebuff: playoffDebuff,
    };
    allPlayers.push(userPlayer);
  }
  
  const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
  const starters = {};
  const assigned = new Set();

  function fillBestSmall(posList, posIdx, curStarters, curAssigned, curScore, best) {
    if (posIdx >= posList.length) {
      if (curScore > best.score) {
        best.score = curScore;
        best.starters = Object.assign({}, curStarters);
        best.assigned = new Set(Array.from(curAssigned));
      }
      return best;
    }
    const pos = posList[posIdx];
    const candidates = allPlayers
      .map((p, i) => ({ player: p, idx: i, ovr: parseInt(p._lineupOvr != null ? p._lineupOvr : p.ovr) || 0 }))
      .filter(({ idx }) => !curAssigned.has(idx))
      .filter(({ player }) => canPlayPosition(player.pos || '', pos))
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 4);

    if (candidates.length === 0) {
      return fillBestSmall(posList, posIdx + 1, curStarters, curAssigned, curScore, best);
    }

    candidates.forEach(({ player, idx, ovr }) => {
      const nextStarters = Object.assign({}, curStarters);
      const nextAssigned = new Set(Array.from(curAssigned));
      nextStarters[pos] = player;
      nextAssigned.add(idx);
      fillBestSmall(posList, posIdx + 1, nextStarters, nextAssigned, curScore + ovr, best);
    });
    return best;
  }

  const best = fillBestSmall(POS_ORDER, 0, starters, assigned, 0, {
    score: -1,
    starters: Object.assign({}, starters),
    assigned: new Set(Array.from(assigned))
  });
  POS_ORDER.forEach(pos => {
    if (best.starters[pos]) {
      const idx = allPlayers.indexOf(best.starters[pos]);
      starters[pos] = best.starters[pos];
      if (idx >= 0) assigned.add(idx);
    }
  });
  
  // 替补：剩余球员按OVR排序
  let bench = allPlayers
    .map((p, i) => ({ player: p, idx: i }))
    .filter(({ idx }) => !assigned.has(idx))
    .sort((a, b) => b.player.ovr - a.player.ovr)
    .map(e => e.player);
  
  // 如果用户没进首发，固定放第六人
  if (userPlayer && Object.values(starters).indexOf(userPlayer) < 0 && !bench.includes(userPlayer)) {
    bench.unshift(userPlayer);
  } else if (userPlayer && Object.values(starters).indexOf(userPlayer) < 0) {
    bench = bench.filter(function(p) { return p !== userPlayer; });
    bench.unshift(userPlayer);
  } else {
    bench.sort((a, b) => b.ovr - a.ovr);
  }
  if (userPlayer && Object.values(starters).indexOf(userPlayer) < 0) {
    bench = bench.filter(function(p, idx) { return p === userPlayer ? idx === 0 : true; });
  } else {
    bench.sort((a, b) => b.ovr - a.ovr);
  }
  
  var result = { starters, bench, allPlayers, isUserStarter: !!(userPlayer && Object.values(starters).indexOf(userPlayer) >= 0) };
  STATE._lineupCache[lineupCacheKey] = result;
  return result;
}

function clearLineupCache() {
  STATE._lineupCache = {};
  STATE._simPowerBaseline = null;
}

function syncUserStarterStatus() {
  if (!STATE.careerTeam || !STATE.finalOVR || !STATE.season) return false;
  clearLineupCache();
  var lineup = calcTeamLineup(STATE.careerTeam);
  var starter = !!lineup.isUserStarter;
  if (STATE.career && STATE.career.flags && STATE.career.flags.startBench) starter = false;
  STATE.season.isUserStarter = starter;
  return starter;
}

/** 按真实轮换分钟计算球队实力（首发5人 + 5名替补，共240分钟）。 */
function calcTeamPowerWithPlayer(team) {
  const lineup = calcTeamLineup(team);
  const cfg = SIM_CONFIG.TEAM_POWER;
  
  const starters = Object.values(lineup.starters).sort(function(a, b) { return (parseInt(b.ovr) || 50) - (parseInt(a.ovr) || 50); });
  const bench = lineup.bench.slice().sort(function(a, b) { return (parseInt(b.ovr) || 50) - (parseInt(a.ovr) || 50); }).slice(0, 5);
  const roster = starters.concat(bench);
  
  if (roster.length === 0) return { offense: 50, defense: 50, athletic: 50, clutch: 50, depth: 50 };
  
  // 典型NBA轮换：首发约160分钟、替补约80分钟。避免旧版只计算两名替补。
  const starterMinutes = [36, 34, 32, 30, 28];
  const benchMinutes = [24, 20, 16, 12, 8];
  const rawMinutes = roster.map(function(p, i) {
    return i < starters.length ? starterMinutes[i] : benchMinutes[i - starters.length];
  });
  const totalMinutes = Math.max(1, rawMinutes.reduce(function(sum, value) { return sum + (value || 0); }, 0));
  const weightedRoster = roster.map(function(player, i) {
    return { player: player, weight: (rawMinutes[i] || 0) / totalMinutes };
  });
  
  function calcDim(weights) {
    let sum = 0, totalW = 0;
    Object.entries(weights).forEach(([attr, w]) => {
      const weightedAvg = weightedRoster.reduce((s, { player, weight }) => 
        s + softCap99(parseInt(player[attr]) || 50) * weight, 0);
      sum += weightedAvg * w;
      totalW += w;
    });
    return totalW > 0 ? sum / totalW : 50;
  }
  
  const overall = weightedRoster.reduce((s, { player, weight }) => 
    s + (parseInt(player.ovr) || 50) * weight, 0);
  
  return {
    offense: calcDim(cfg.offense),
    defense: calcDim(cfg.defense),
    athletic: calcDim(cfg.athletic),
    clutch: calcDim(cfg.clutch),
    depth: overall,
  };
}

/** Box-Muller 正态扰动，沿用 82 胜模式的“回合数 + 效率”思路。 */
function simGaussian(mean, deviation) {
  var u = Math.max(0.000001, Math.random());
  var v = Math.max(0.000001, Math.random());
  return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * deviation;
}

function splitRegulationScore(total) {
  var weights = [0, 0, 0, 0].map(function() { return Math.max(0.72, simGaussian(1, 0.13)); });
  var sum = weights.reduce(function(a, b) { return a + b; }, 0);
  var quarters = weights.map(function(w) { return Math.floor(total * w / sum); });
  var left = total - quarters.reduce(function(a, b) { return a + b; }, 0);
  for (var i = 0; i < left; i++) quarters[i % 4]++;
  return quarters;
}

function getCareerTeamGameModifiers(team) {
  if (team !== STATE.careerTeam || !STATE.career) return { offense:0, defense:0, variance:0 };
  var mods = getNextSeasonMods();
  var profileEffects = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : { gameOffenseBonus:0, gameDefenseBonus:0, gameVarianceBonus:0 };
  var lockBonus = 0;
  var rimBonus = 0;
  var pnrBonus = 0;
  var leaderVar = 0;
  if (typeof getStyleSkillMu === 'function') {
    lockBonus = (getStyleSkillMu('perimeter_lock') - 1) * 1.4;
    rimBonus = (getStyleSkillMu('rim_protector') - 1) * 1.5;
    pnrBonus = (getStyleSkillMu('pnr_maestro') - 1) * 1.6;
    leaderVar = (getStyleSkillMu('leader_aura') - 1) * -2.2;
  }
  return {
    offense: (Number(mods.moraleBonus) || 0) * 0.35 + (Number(mods.teamChemistry) || 0) * 0.28 - (Number(mods.mediaPressure) || 0) * 0.16 - (Number(mods.staminaLoad) || 0) * 0.34 + profileEffects.gameOffenseBonus + pnrBonus,
    defense: (Number(mods.teamChemistry) || 0) * 0.32 + (Number(mods.moraleBonus) || 0) * 0.18 - (Number(mods.staminaLoad) || 0) * 0.25 + profileEffects.gameDefenseBonus + lockBonus + rimBonus,
    variance: (Number(mods.formVariance) || 0) * 0.45 + profileEffects.gameVarianceBonus + leaderVar
  };
}

function getSimulationPowerBaseline() {
  var key = [STATE.careerTeam || '', STATE.finalOVR || 0, STATE.career && STATE.career.seasonCount || 0].join('|');
  if (STATE._simPowerBaseline && STATE._simPowerBaseline.key === key) return STATE._simPowerBaseline;
  var total = { offense:0, defense:0, athletic:0, depth:0 };
  NBA2K_TEAMS.forEach(function(team) {
    var power = calcTeamPowerWithPlayer(team);
    total.offense += Number(power.offense) || 0;
    total.defense += Number(power.defense) || 0;
    total.athletic += Number(power.athletic) || 0;
    total.depth += Number(power.depth) || 0;
  });
  var count = Math.max(1, NBA2K_TEAMS.length);
  STATE._simPowerBaseline = { key:key, offense:total.offense/count, defense:total.defense/count, athletic:total.athletic/count, depth:total.depth/count };
  return STATE._simPowerBaseline;
}

/** 与 82 胜模式一致：轮换实力决定攻防效率，比赛结果由真实生成的比分决定。 */
function simulate82StyleMatchup(teamA, teamB, options) {
  options = options || {};
  var powerA = calcTeamPowerWithPlayer(teamA);
  var powerB = calcTeamPowerWithPlayer(teamB);
  var baseline = getSimulationPowerBaseline();
  var modA = options.neutralState ? { offense:0, defense:0, variance:0 } : getCareerTeamGameModifiers(teamA);
  var modB = options.neutralState ? { offense:0, defense:0, variance:0 } : getCareerTeamGameModifiers(teamB);
  var teamAHome = options.teamAHome !== false;
  var homeA = teamAHome ? 0.018 : 0;
  var homeB = teamAHome ? 0 : 0.018;
  if (!options.neutralState) {
    var homeFx = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : {};
    var fanHome = Number(homeFx.homeCourtBonus) || 0;
    if (teamA === STATE.careerTeam && teamAHome) homeA += fanHome;
    if (teamB === STATE.careerTeam && !teamAHome) homeB += fanHome;
  }
  var fatigueA = Number(options.fatigueA) || 0;
  var fatigueB = Number(options.fatigueB) || 0;
  var averageAthletic = ((Number(powerA.athletic) || 60) + (Number(powerB.athletic) || 60)) / 2;
  var averageDepth = ((Number(powerA.depth) || 60) + (Number(powerB.depth) || 60)) / 2;
  // 2025-26联盟基线：99.4回合、115.7进攻效率。
  var pace = Math.max(90, Math.min(109, Math.round(99.4 + (averageAthletic - baseline.athletic) * 0.08 + (averageDepth - baseline.depth) * 0.02 + simGaussian(0, 2.8))));
  if (!options.neutralState && (teamA === STATE.careerTeam || teamB === STATE.careerTeam) && typeof getStyleSkillMu === 'function') {
    var tempoMu = getStyleSkillMu('tempo_master');
    var breakMu = getStyleSkillMu('fast_break');
    var postMu = getStyleSkillMu('post_bully');
    var paceAdj = 0;
    if (tempoMu > 1) paceAdj += (tempoMu - 1) * 8;
    if (breakMu > 1) paceAdj += (breakMu - 1) * 10;
    if (postMu > 1) paceAdj -= (postMu - 1) * 8;
    if (paceAdj) pace = Math.max(90, Math.min(109, Math.round(pace + paceAdj)));
  }
  var edgeA = ((powerA.offense - baseline.offense) + modA.offense) - ((powerB.defense - baseline.defense) + modB.defense);
  var edgeB = ((powerB.offense - baseline.offense) + modB.offense) - ((powerA.defense - baseline.defense) + modA.defense);
  var depthEdge = ((Number(powerA.depth) || 60) - (Number(powerB.depth) || 60)) * 0.00075;
  var seedPts = (Number(options.seedBonus) || 0) * 0.65;
  var injuryPts = options.probMultiplier == null ? 0 : (Number(options.probMultiplier) - 1) * 28;
  // 中立场基准1.154；计入每场一个主队的优势后，联盟均值约115.6分。
  var efficiencyA = 1.154 + edgeA * 0.0034 + depthEdge + homeA - fatigueA * 0.012 + seedPts / pace + injuryPts / pace;
  var efficiencyB = 1.154 + edgeB * 0.0034 - depthEdge + homeB - fatigueB * 0.012 - seedPts / pace;
  efficiencyA = Math.max(0.91, Math.min(1.36, efficiencyA));
  efficiencyB = Math.max(0.91, Math.min(1.36, efficiencyB));
  var varianceA = Math.max(4.6, Math.min(10, 6.4 + modA.variance));
  var varianceB = Math.max(4.6, Math.min(10, 6.4 + modB.variance));
  var regulationA = Math.max(80, Math.min(155, Math.round(pace * efficiencyA + simGaussian(0, varianceA))));
  var regulationB = Math.max(80, Math.min(155, Math.round(pace * efficiencyB + simGaussian(0, varianceB))));
  var qScoresA = splitRegulationScore(regulationA);
  var qScoresB = splitRegulationScore(regulationB);
  var scoreA = regulationA;
  var scoreB = regulationB;
  var ot = 0;
  var keyEvents = [];
  while (scoreA === scoreB) {
    ot++;
    var otA = Math.max(4, Math.min(16, Math.round(simGaussian(9, 2.2))));
    var otB = Math.max(4, Math.min(16, Math.round(simGaussian(9, 2.2))));
    var otGuard = 0;
    while (otA === otB && otGuard < 12) {
      otA = Math.max(4, Math.min(16, Math.round(simGaussian(9, 2.2))));
      otB = Math.max(4, Math.min(16, Math.round(simGaussian(9, 2.2))));
      otGuard++;
    }
    if (otA === otB) otA++;
    scoreA += otA;
    scoreB += otB;
    keyEvents.push('⏱ 加时赛 #' + ot);
    if (ot >= 20) break;
  }
  if (scoreA === scoreB) scoreA++;
  var won = scoreA > scoreB;
  var expectedMargin = pace * (efficiencyA - efficiencyB);
  var expectedWinProb = 1 / (1 + Math.exp(-expectedMargin / 7.2));
  var favoriteA = expectedWinProb >= 0.5;
  var margin = Math.abs(scoreA - scoreB);
  if (margin <= 3) keyEvents.push(won ? '⚡ 关键回合守住胜局' : '💔 最后回合惜败');
  if (won !== favoriteA && Math.abs(expectedWinProb - 0.5) >= 0.20) keyEvents.push('💥 爆冷！');
  return {
    won: won, scoreA: scoreA, scoreB: scoreB,
    qScoresA: qScoresA, qScoresB: qScoresB,
    highlight: ot > 0 || margin <= 3 || keyEvents.indexOf('💥 爆冷！') >= 0,
    keyEvents: keyEvents, ot: ot,
    teamA: { power: powerA }, teamB: { power: powerB },
    pace: pace, possPerQ: Math.round(pace / 4), expectedWinProb: expectedWinProb,
    home: teamAHome,
    boxScore: options.includeBoxScore === false ? null : generateBoxScore(teamA, teamB, scoreA, scoreB)
  };
}

function simulateGameNew(teamA, teamB, seedBonus, probMultiplier) {
  var schedule = STATE.season.schedule || [];
  var gameIdx = schedule.findIndex(function(g) { return !g.simulated; });
  var isHome = gameIdx >= 0 ? !!schedule[gameIdx].home : true;
  var isB2B = gameIdx > 0 && !!schedule[gameIdx - 1].isB2B;
  var fatigue = isB2B ? 1 : 0;
  if (fatigue && typeof getStyleSkillMu === 'function') {
    var ironMu = getStyleSkillMu('iron_man');
    if (ironMu > 1) fatigue *= Math.max(0.35, 1 - (ironMu - 1) * 3.5);
  }
  return simulate82StyleMatchup(teamA, teamB, {
    teamAHome: isHome,
    fatigueA: fatigue,
    seedBonus: seedBonus || 0,
    probMultiplier: probMultiplier
  });
}

window.samplePerfectPlayerSimulation = function(teamA, teamB, games) {
  games = Math.max(20, Math.min(2000, parseInt(games) || 400));
  var wins = 0, pointsA = 0, pointsB = 0, minScore = 999, maxScore = 0;
  for (var i = 0; i < games; i++) {
    var result = simulate82StyleMatchup(teamA, teamB, { teamAHome:i % 2 === 0, includeBoxScore:false, neutralState:true });
    if (result.won) wins++;
    pointsA += result.scoreA; pointsB += result.scoreB;
    minScore = Math.min(minScore, result.scoreA, result.scoreB);
    maxScore = Math.max(maxScore, result.scoreA, result.scoreB);
  }
  return { games:games, teamA:teamA, teamB:teamB, winRate:wins/games, avgA:pointsA/games, avgB:pointsB/games, minScore:minScore, maxScore:maxScore };
};
window.PERFECT_PLAYER_SIM_REPORT = {
  engine:'2025-26-possession-and-role', resultFromScore:true, homeCourt:true, fatigue:true, careerState:true,
  attributeDrivenStats:true, rotationMinutes:true, opponentDefense:true,
  userPlayerScoringScale: typeof USER_PLAYER_SCORING_SCALE === 'number' ? USER_PLAYER_SCORING_SCALE : 0.85,
  leagueBaseline:{ pointsPerGame:115.6, pace:99.4, offensiveRating:115.7 }
};

/** 事件可以把属性顶过 99；超出部分按一半计入模拟，不再被硬顶吃成 0。 */
var ATTR_EVENT_CEILING = 130;
/** 玩家个人得分相对旧版出手量缩放（跳过/观看共用）。约 0.85 ≈ 削 15%。 */
var USER_PLAYER_SCORING_SCALE = 0.85;
function softCap99(value) {
  var v = Number(value);
  if (!isFinite(v)) return 0;
  if (v <= 99) return v;
  return 99 + (v - 99) * 0.5;
}
function clampWithHalfOverflow(value, lo, hi, hardMax) {
  var v = Number(value);
  if (!isFinite(v)) v = lo;
  if (v <= hi) return Math.max(lo, v);
  var out = hi + (v - hi) * 0.5;
  if (hardMax != null && isFinite(hardMax)) out = Math.min(hardMax, out);
  return out;
}

function simSkill01(value) {
  var v = softCap99(value);
  if (!isFinite(v)) v = 25;
  return Math.max(0, (v - 25) / 74);
}

function allocateIntegerTotal(total, weights, minimums) {
  total = Math.max(0, Math.round(total || 0));
  minimums = minimums || weights.map(function() { return 0; });
  var allocated = minimums.map(function(value) { return Math.max(0, Math.round(value || 0)); });
  var minimumTotal = allocated.reduce(function(sum, value) { return sum + value; }, 0);
  if (minimumTotal > total) {
    allocated = allocated.map(function(value) { return Math.floor(value * total / minimumTotal); });
    minimumTotal = allocated.reduce(function(sum, value) { return sum + value; }, 0);
  }
  var remaining = total - minimumTotal;
  var safeWeights = weights.map(function(value) { return Math.max(0.0001, Number(value) || 0); });
  var weightTotal = safeWeights.reduce(function(sum, value) { return sum + value; }, 0);
  var raw = safeWeights.map(function(value) { return remaining * value / weightTotal; });
  raw.forEach(function(value, index) { allocated[index] += Math.floor(value); });
  var left = total - allocated.reduce(function(sum, value) { return sum + value; }, 0);
  var order = raw.map(function(value, index) { return { index:index, fraction:value - Math.floor(value) }; })
    .sort(function(a, b) { return b.fraction - a.fraction; });
  for (var i = 0; i < left; i++) allocated[order[i % order.length].index]++;
  return allocated;
}

function getSimPrimaryPosition(player) {
  var pos = String(player && player.pos || 'SF').split('/')[0].trim();
  return ['PG','SG','SF','PF','C'].indexOf(pos) >= 0 ? pos : 'SF';
}

/** 生成两队全队数据：240分钟、球队总分与五项统计均受对应属性驱动。 */
function generateBoxScore(teamA, teamB, totalA, totalB) {
  function getLineupStats(team, totalPts) {
    const lineup = calcTeamLineup(team);
    const starters = Object.values(lineup.starters).sort(function(a, b) { return (parseInt(b.ovr)||50) - (parseInt(a.ovr)||50); });
    const bench = lineup.bench.slice().sort(function(a, b) { return (parseInt(b.ovr)||50) - (parseInt(a.ovr)||50); }).slice(0, 5);
    const players = starters.concat(bench);
    if (players.length === 0) return [];

    const minuteTargets = [36,34,32,30,28,24,20,16,12,8].slice(0, players.length);
    const minuteMinimums = players.map(function(p, i) { return i < starters.length ? 24 : 4; });
    const minuteWeights = minuteTargets.map(function(target, i) { return Math.max(0.1, target - minuteMinimums[i]); });
    const minutes = allocateIntegerTotal(240, minuteWeights, minuteMinimums);
    const profiles = players.map(function(player, i) {
      var offense = (parseInt(player.threePT)||50) * 0.24 + (parseInt(player.MID)||50) * 0.18 +
        (parseInt(player.FIN)||50) * 0.28 + (parseInt(player.DNK)||50) * 0.08 +
        (parseInt(player.HAN)||50) * 0.14 + (parseInt(player.PAS)||50) * 0.08;
      var creation = offense * 0.58 + (parseInt(player.HAN)||50) * 0.27 + (parseInt(player.CLU)||50) * 0.15;
      return { player:player, pos:getSimPrimaryPosition(player), mins:minutes[i], offense:offense, creation:creation };
    });

    const scoringWeights = profiles.map(function(profile) {
      var form = Math.max(0.78, Math.min(1.22, simGaussian(1, 0.09)));
      return profile.mins * (0.22 + Math.pow(simSkill01(profile.creation), 1.35) * 1.45) * form;
    });
    const points = allocateIntegerTotal(totalPts, scoringWeights);
    function minuteAverage(attr) {
      return profiles.reduce(function(sum, profile) { return sum + (parseInt(profile.player[attr]) || 50) * profile.mins; }, 0) / 240;
    }
    const teamRebounds = Math.max(34, Math.min(57, Math.round(43.8 + (minuteAverage('REB') - 70) * 0.12 + simGaussian(0, 3.0))));
    const teamAssists = Math.max(15, Math.min(38, Math.round(26.7 + (minuteAverage('PAS') - 70) * 0.11 + (minuteAverage('HAN') - 70) * 0.04 + simGaussian(0, 2.7))));
    const teamSteals = Math.max(3, Math.min(15, Math.round(8.4 + (minuteAverage('PDEF') - 70) * 0.05 + simGaussian(0, 1.7))));
    const teamBlocks = Math.max(1, Math.min(12, Math.round(4.8 + (minuteAverage('BLK') - 65) * 0.055 + simGaussian(0, 1.4))));
    const teamTurnovers = Math.max(7, Math.min(22, Math.round(14.5 - (minuteAverage('HAN') - 70) * 0.05 - (minuteAverage('PAS') - 70) * 0.025 + simGaussian(0, 2.2))));
    const positionReb = { PG:0.62, SG:0.68, SF:0.82, PF:1.04, C:1.18 };
    const positionBlk = { PG:0.38, SG:0.50, SF:0.72, PF:1.00, C:1.18 };
    const rebounds = allocateIntegerTotal(teamRebounds, profiles.map(function(profile) {
      return profile.mins * (0.10 + Math.pow(simSkill01(profile.player.REB), 1.55) * positionReb[profile.pos]);
    }));
    const assists = allocateIntegerTotal(teamAssists, profiles.map(function(profile) {
      var playmaking = (parseInt(profile.player.PAS)||50) * 0.65 + (parseInt(profile.player.HAN)||50) * 0.25 + (parseInt(profile.player.CLU)||50) * 0.10;
      return profile.mins * (0.08 + Math.pow(simSkill01(playmaking), 1.65));
    }));
    const steals = allocateIntegerTotal(teamSteals, profiles.map(function(profile) {
      var pointDefense = (parseInt(profile.player.PDEF)||50) * 0.70 + (parseInt(profile.player.ATH)||50) * 0.20 + (parseInt(profile.player.HAN)||50) * 0.10;
      return profile.mins * (0.10 + Math.pow(simSkill01(pointDefense), 1.45));
    }));
    const blocks = allocateIntegerTotal(teamBlocks, profiles.map(function(profile) {
      var rimDefense = (parseInt(profile.player.BLK)||50) * 0.72 + (parseInt(profile.player.IDEF)||50) * 0.20 + (parseInt(profile.player.ATH)||50) * 0.08;
      return profile.mins * (0.06 + Math.pow(simSkill01(rimDefense), 1.55) * positionBlk[profile.pos]);
    }));
    const turnovers = allocateIntegerTotal(teamTurnovers, profiles.map(function(profile) {
      var control = (parseInt(profile.player.HAN)||50) * 0.58 + (parseInt(profile.player.PAS)||50) * 0.27 + (parseInt(profile.player.CLU)||50) * 0.15;
      return profile.mins * (0.20 + simSkill01(profile.creation)) * (1.35 - simSkill01(control) * 0.62);
    }));

    return profiles.map(function(profile, i) {
      var player = profile.player;
      var shooting = (parseInt(player.threePT)||50) * 0.34 + (parseInt(player.MID)||50) * 0.22 + (parseInt(player.FIN)||50) * 0.34 + (parseInt(player.CLU)||50) * 0.10;
      var shooting01 = simSkill01(shooting);
      var fga = points[i] <= 0 ? 0 : Math.max(1, Math.round(points[i] / (0.92 + shooting01 * 0.42) + simGaussian(0, 1.1)));
      var threeShare = Math.max(0.04, Math.min(0.68, 0.18 + ((parseInt(player.threePT)||50) - 60) * 0.008));
      var threeA = Math.min(fga, Math.max(0, Math.round(fga * threeShare)));
      var threePct = Math.max(0.24, Math.min(0.45, 0.28 + simSkill01(player.threePT) * 0.17));
      var twoPct = Math.max(0.38, Math.min(0.70, 0.43 + simSkill01((parseInt(player.MID)||50) * 0.35 + (parseInt(player.FIN)||50) * 0.65) * 0.27));
      var threeM = Math.min(threeA, Math.max(0, Math.round(threeA * threePct)));
      var twoM = Math.min(fga - threeA, Math.max(0, Math.round((fga - threeA) * twoPct)));
      return {
        name: player.cname || player.name,
        pos: profile.pos,
        pts: points[i], reb: rebounds[i], ast: assists[i], stl: steals[i], blk: blocks[i], tov: turnovers[i],
        fgm: threeM + twoM, fga: fga, threeM: threeM, threeA: threeA,
        mins: profile.mins,
        isUser: player._isUser || false,
      };
    });
  }
  return {
    [teamA]: getLineupStats(teamA, totalA),
    [teamB]: getLineupStats(teamB, totalB),
  };
}

/** 属性→效率系数：递减曲线
 *  低属性几乎没用，高属性才有显著收益
 *  35→0.18  50→0.39  65→0.57  75→0.69  85→0.82  95→0.94  99→1.00
 */
function attrFactor(val) {
  const v = Math.max(25, softCap99(val == null ? 50 : val));
  return Math.pow((v - 25) / 74, 0.85);
}

/** 严格版：只有顶尖属性才能展现顶尖数据（attrFactor^1.5）
 *  35→0.08  50→0.24  65→0.43  78→0.65  90→0.83  99→1.00
 *  用在所有数据计算上，拉开一般和顶级的差距
 */
function af(val) { return Math.pow(attrFactor(val), 1.5); }

function getSeasonUsageBias() {
  if (!STATE.season) return 1;
  if (STATE.season._usageBias == null) {
    var age = STATE.career && STATE.career.currentAge ? STATE.career.currentAge : 22;
    var ageBase = 1;
    if (age <= 23) ageBase = 0.90;
    else if (age <= 25) ageBase = 0.98;
    else if (age <= 29) ageBase = 1.06;
    else if (age <= 32) ageBase = 1.02;
    else if (age <= 35) ageBase = 0.94;
    else if (age <= 39) ageBase = 0.78;
    else ageBase = 0.68;
    STATE.season._usageBias = ageBase * (0.92 + Math.random() * 0.16);
  }
  var profileEffects = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : { minutesFactor:1 };
  return STATE.season._usageBias * profileEffects.minutesFactor;
}

function sampleBinomial(attempts, probability) {
  var made = 0;
  for (var i = 0; i < Math.max(0, Math.round(attempts)); i++) if (Math.random() < probability) made++;
  return made;
}

function samplePoisson(expected) {
  expected = Math.max(0, Number(expected) || 0);
  if (expected <= 0) return 0;
  if (expected > 12) return Math.max(0, Math.round(simGaussian(expected, Math.sqrt(expected))));
  var limit = Math.exp(-expected);
  var product = 1;
  var count = 0;
  do { count++; product *= Math.random(); } while (product > limit && count < 40);
  return Math.max(0, count - 1);
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

function calcShotPct(type, attrVal, totalScore, defensePressure, gameForm) {
  var curves = {
    threePT: [[25,.22],[50,.28],[70,.34],[85,.385],[99,.435]],
    MID: [[25,.25],[50,.33],[70,.40],[85,.455],[99,.51]],
    FIN: [[25,.35],[50,.48],[70,.58],[85,.66],[99,.73]],
    FT: [[25,.52],[50,.67],[70,.77],[85,.85],[99,.92]],
  };
  var curve = curves[type];
  if (!curve) return 0.40;
  var pressureScale = type === 'FIN' ? 0.82 : (type === 'MID' ? 0.92 : 1);
  var pct = interpolateShotCurve(attrVal, curve) - (Number(defensePressure) || 0) * pressureScale + (Number(gameForm) || 0);
  var cfg = SIM_CONFIG.SHOOTING[type] || {};
  var lo = cfg.min || curve[0][1];
  var hi = cfg.max || curve[curve.length - 1][1];
  return clampWithHalfOverflow(pct, lo, hi, hi + 0.08);
}

function calcPlayerCreationRating(attrs, pos) {
  var weights = {
    PG: { threePT:.18, MID:.13, FIN:.13, HAN:.28, PAS:.18, CLU:.10 },
    SG: { threePT:.23, MID:.18, FIN:.18, HAN:.23, PAS:.08, CLU:.10 },
    SF: { threePT:.19, MID:.15, FIN:.22, DNK:.08, HAN:.18, PAS:.08, CLU:.10 },
    PF: { threePT:.12, MID:.12, FIN:.28, DNK:.10, HAN:.13, PAS:.08, STR:.10, CLU:.07 },
    C:  { threePT:.07, MID:.10, FIN:.34, DNK:.12, HAN:.10, PAS:.10, STR:.12, CLU:.05 },
  };
  var selected = weights[pos] || weights.SF;
  return Object.keys(selected).reduce(function(sum, key) { return sum + softCap99(parseInt(attrs[key]) || 50) * selected[key]; }, 0);
}

function getPlayerRotationMinutes(attrs, pos, isPlayoff) {
  var ovr = typeof calcOVR === 'function' ? calcOVR(attrs, pos) : (STATE.finalOVR || 70);
  var rank = -1;
  var isStarter = false;
  if (STATE.careerTeam && typeof calcTeamLineup === 'function') {
    var lineup = calcTeamLineup(STATE.careerTeam);
    var ordered = (lineup.allPlayers || []).slice().sort(function(a, b) { return (parseInt(b.ovr)||50) - (parseInt(a.ovr)||50); });
    rank = ordered.findIndex(function(player) { return !!player._isUser; });
    isStarter = !!lineup.isUserStarter;
  }
  var roleMinutes;
  if (rank >= 0) {
    roleMinutes = [36,35,34,32,30,25,21,17,13,9][Math.min(9, rank)] || 7;
    if (isStarter) roleMinutes = Math.max(30, roleMinutes);
  } else if (ovr >= 90) roleMinutes = 36;
  else if (ovr >= 82) roleMinutes = 33;
  else if (ovr >= 75) roleMinutes = 28;
  else if (ovr >= 68) roleMinutes = 21;
  else roleMinutes = 13;
  if (STATE.career && STATE.career.flags && STATE.career.flags.startBench) roleMinutes = Math.min(roleMinutes, 24);
  if (isPlayoff && roleMinutes >= 17) roleMinutes += roleMinutes >= 30 ? 2 : 1;
  roleMinutes *= Math.sqrt(getSeasonUsageBias());
  if (typeof getStyleSkillMu === 'function') {
    var boxMu = getStyleSkillMu('box_out');
    if (boxMu > 1) roleMinutes += (boxMu - 1) * 14;
  }
  return Math.max(6, Math.min(42, Math.round(simGaussian(roleMinutes, 1.35))));
}

function syncUserStatsIntoBoxScore(gameResult, stats) {
  if (!gameResult || !gameResult.boxScore || !STATE.careerTeam) return;
  var rows = gameResult.boxScore[STATE.careerTeam];
  if (!Array.isArray(rows)) return;
  var userIndex = rows.findIndex(function(row) { return !!row.isUser; });
  if (userIndex < 0) return;
  var otherRows = rows.filter(function(row, index) { return index !== userIndex; });
  var otherPoints = allocateIntegerTotal(Math.max(0, (gameResult.scoreA || 0) - stats.pts), otherRows.map(function(row) { return Math.max(1, row.pts || 0); }));
  var cursor = 0;
  rows.forEach(function(row, index) {
    if (index === userIndex) {
      Object.assign(row, { pts:stats.pts, reb:stats.reb, ast:stats.ast, stl:stats.stl, blk:stats.blk, tov:stats.tov, fgm:stats.fgm, fga:stats.fga, ftm:stats.ftm, fta:stats.fta, threeM:stats.threeM, threeA:stats.threeA, mins:stats.mins });
    } else {
      var oldPoints = Math.max(1, Number(row.pts) || 0);
      var oldFga = Math.max(1, Number(row.fga) || 0);
      var oldFgPct = Math.max(0.25, Math.min(0.75, (Number(row.fgm) || 0) / oldFga));
      var oldThreeRate = Math.max(0, Math.min(1, (Number(row.threeA) || 0) / oldFga));
      var oldThreePct = row.threeA ? Math.max(0, Math.min(1, (Number(row.threeM) || 0) / row.threeA)) : 0;
      row.pts = otherPoints[cursor++];
      if (row.pts <= 0) {
        row.fgm = row.fga = row.threeM = row.threeA = 0;
      } else {
        var pointsPerAttempt = Math.max(0.75, Math.min(1.65, oldPoints / oldFga));
        row.fga = Math.max(1, Math.round(row.pts / pointsPerAttempt));
        row.fgm = Math.min(row.fga, Math.round(row.fga * oldFgPct));
        row.threeA = Math.min(row.fga, Math.round(row.fga * oldThreeRate));
        row.threeM = Math.min(row.threeA, Math.round(row.threeA * oldThreePct));
      }
    }
  });
}

/** 生成你的球员数据：分钟、球权、出手类型和每项数据分别由对应属性驱动。 */
function getFanHomeFormBonus(gameResult) {
  var isHome = gameResult && gameResult.home;
  if (!isHome || !STATE.career) return 0;
  var fan = 0;
  try { fan = Number(getCareerProfile().fanSupport) || 0; } catch (e) {}
  return clampCareerEffect(fan * 0.0004, -0.003, 0.006);
}

function generatePlayerStatsNew(attrs, gameResult, isPlayoff) {
  const pos = STATE.position || 'PG';
  const pace = Number(gameResult && gameResult.pace) || 99.4;
  const mins = getPlayerRotationMinutes(attrs, pos, isPlayoff);
  const minsFactor = mins / 48;
  const creation = calcPlayerCreationRating(attrs, pos);
  const creation01 = simSkill01(creation);
  const posUsage = { PG:.005, SG:.012, SF:.004, PF:-.004, C:-.002 };
  let usage = 0.10 + Math.pow(creation01, 1.24) * 0.27 + (posUsage[pos] || 0);
  if (isPlayoff && creation01 > 0.62) usage += 0.01;
  usage = Math.max(0.10, Math.min(0.39, usage));
  var styleRoll = typeof getStyleSkillRoll === 'function' ? getStyleSkillRoll : function () { return 1; };
  var coldM = styleRoll('cold_arrow');
  var midM = styleRoll('mid_craftsman');
  var offBallM = styleRoll('off_ball');
  var finishM = styleRoll('finisher');
  var dunkM = styleRoll('dunk_threat');
  var postM = styleRoll('post_bully');
  var tempoM = styleRoll('tempo_master');
  var breakM = styleRoll('fast_break');
  var lockM = styleRoll('perimeter_lock');
  var rimM = styleRoll('rim_protector');
  var stealM = styleRoll('steal_instinct');
  var boxM = styleRoll('box_out');
  var clutchM = styleRoll('clutch_heart');
  var leaderM = styleRoll('leader_aura');
  var iceM = styleRoll('ice_ft');
  usage *= 1 - (offBallM - 1) * 0.35;
  usage *= 1 + (breakM - 1) * 0.18;
  usage = Math.max(0.10, Math.min(0.39, usage));

  const baseline = getSimulationPowerBaseline();
  const opponentDefense = gameResult && gameResult.teamB && gameResult.teamB.power ? Number(gameResult.teamB.power.defense) : baseline.defense;
  const defensePressure = Math.max(-0.035, Math.min(0.045, (opponentDefense - baseline.defense) * 0.003));
  const teamFGA = pace * 0.896;
  const scoringAverage = ((parseInt(attrs.threePT)||50) + (parseInt(attrs.MID)||50) + (parseInt(attrs.FIN)||50)) / 3;
  const aggression = Math.max(0.78, Math.min(1.12, 0.96 + (scoringAverage - 70) * 0.004));
  const expectedFgaRaw = teamFGA * minsFactor * usage * aggression * (1 - defensePressure * 1.5) * USER_PLAYER_SCORING_SCALE;
  const expectedFga = expectedFgaRaw * 0.90;
  const fgaSigma = Math.max(0.8, expectedFgaRaw * 0.10) * 1.20;
  const minimumFga = mins >= 12 ? 2 : 0;
  let fga = Math.max(minimumFga, Math.min(32, Math.round(simGaussian(expectedFga, fgaSigma))));

  const baseDist = SIM_CONFIG.SHOT_DIST[pos] || SIM_CONFIG.SHOT_DIST.PG;
  const finRating = (parseInt(attrs.FIN)||50) * 0.72 + (parseInt(attrs.DNK)||50) * 0.28;
  var distWeights = {
    threePT: baseDist.threePT * (0.45 + Math.pow(simSkill01(attrs.threePT), 1.15) * 1.25),
    MID: baseDist.MID * (0.45 + Math.pow(simSkill01(attrs.MID), 1.15) * 1.25),
    FIN: baseDist.FIN * (0.45 + Math.pow(simSkill01(finRating), 1.15) * 1.25),
  };
  distWeights.threePT *= 1 + (coldM - 1) * 0.55 - (postM - 1) * 0.35;
  distWeights.MID *= 1 + (midM - 1) * 0.55;
  distWeights.FIN *= 1 + (dunkM - 1) * 0.50 + (postM - 1) * 0.60 + (breakM - 1) * 0.28;
  const distTotal = Math.max(0.001, distWeights.threePT + distWeights.MID + distWeights.FIN);
  const threeA = Math.max(0, Math.min(fga, Math.round(fga * distWeights.threePT / distTotal)));
  const midA = Math.max(0, Math.min(fga - threeA, Math.round(fga * distWeights.MID / distTotal)));
  const finA = Math.max(0, fga - threeA - midA);
  var formSigma = 0.016 * 1.20 / Math.max(1, leaderM);
  const gameForm = simGaussian(0, formSigma) + getFanHomeFormBonus(gameResult);
  var margin = Math.abs((Number(gameResult && gameResult.scoreA) || 0) - (Number(gameResult && gameResult.scoreB) || 0));
  var clutchShot = margin <= 7 ? (1 + (clutchM - 1) * 0.45) : 1;
  var midPressure = defensePressure * (1 - (midM - 1) * 0.7);
  const threePct = clampWithHalfOverflow(calcShotPct('threePT', attrs.threePT || 50, 0, defensePressure, gameForm) * coldM * (1 + (offBallM - 1) * 0.45) * clutchShot, 0.18, 0.52, 0.58);
  const midPct = clampWithHalfOverflow(calcShotPct('MID', attrs.MID || 50, 0, midPressure, gameForm) * midM * (1 + (offBallM - 1) * 0.35) * clutchShot, 0.22, 0.58, 0.66);
  const finPct = clampWithHalfOverflow(calcShotPct('FIN', finRating, 0, defensePressure, gameForm) * (1 + (dunkM - 1) * 0.35) * clutchShot, 0.32, 0.80, 0.88);
  const threeM = sampleBinomial(threeA, threePct);
  const midMade = sampleBinomial(midA, midPct);
  const finM = sampleBinomial(finA, finPct);
  const fgm = threeM + midMade + finM;

  const ftRate = Math.max(0.07, Math.min(0.62, (0.07 + simSkill01(attrs.FIN) * 0.20 + simSkill01(attrs.STR) * 0.11 + simSkill01(attrs.HAN) * 0.06) * finishM));
  const fta = Math.max(0, Math.min(18, Math.round(simGaussian(fga * ftRate, 1.2))));
  const freeThrowRating = (parseInt(attrs.CLU)||50) * 0.50 + (parseInt(attrs.MID)||50) * 0.25 + (parseInt(attrs.threePT)||50) * 0.25;
  const ftPct = clampWithHalfOverflow(calcShotPct('FT', freeThrowRating, 0, 0, gameForm * 0.45) * iceM * clutchShot, 0.50, 0.96, 0.99);
  const ftm = sampleBinomial(fta, ftPct);
  const pts = threeM * 3 + midMade * 2 + finM * 2 + ftm;

  const rebBase = { PG:1.2, SG:1.4, SF:1.8, PF:2.5, C:3.0 };
  const rebCeiling = { PG:7.0, SG:7.2, SF:9.0, PF:11.5, C:13.2 };
  const reb36 = (rebBase[pos] + Math.pow(simSkill01(attrs.REB), 1.20) * rebCeiling[pos]) * boxM;
  const playmaking = (parseInt(attrs.PAS)||50) * 0.65 + (parseInt(attrs.HAN)||50) * 0.25 + (parseInt(attrs.CLU)||50) * 0.10;
  const astBase = { PG:0.8, SG:0.6, SF:0.6, PF:0.5, C:0.5 };
  const astCeiling = { PG:12.0, SG:9.2, SF:8.8, PF:9.0, C:10.0 };
  const ast36 = (astBase[pos] + Math.pow(simSkill01(playmaking), 1.32) * astCeiling[pos]) * tempoM;
  const pointDefense = (parseInt(attrs.PDEF)||50) * 0.70 + (parseInt(attrs.ATH)||50) * 0.20 + (parseInt(attrs.HAN)||50) * 0.10;
  const stl36 = (0.25 + Math.pow(simSkill01(pointDefense), 1.25) * 2.05) * lockM * stealM;
  const rimDefense = (parseInt(attrs.BLK)||50) * 0.72 + (parseInt(attrs.IDEF)||50) * 0.20 + (parseInt(attrs.ATH)||50) * 0.08;
  const blkBase = { PG:.04, SG:.05, SF:.08, PF:.14, C:.20 };
  const blkCeiling = { PG:1.15, SG:1.35, SF:2.10, PF:3.30, C:4.20 };
  const blk36 = (blkBase[pos] + Math.pow(simSkill01(rimDefense), 1.35) * blkCeiling[pos]) * rimM * (1 + (dunkM - 1) * 0.25);
  const control = (parseInt(attrs.HAN)||50) * 0.58 + (parseInt(attrs.PAS)||50) * 0.27 + (parseInt(attrs.CLU)||50) * 0.15;
  const tov36 = Math.max(0.45, Math.min(5.5, (0.65 + usage * 7.5 + ast36 * 0.14 - simSkill01(control) * 1.0 + defensePressure * 8) / (1 + (tempoM - 1) * 0.7) * (1 + (stealM - 1) * 0.25)));
  const paceScale = pace / 99.4;
  const reb = samplePoisson(reb36 * mins / 36 * paceScale);
  const ast = samplePoisson(ast36 * mins / 36 * paceScale);
  const stl = samplePoisson(stl36 * mins / 36 * paceScale);
  const blk = samplePoisson(blk36 * mins / 36 * paceScale);
  const tov = samplePoisson(tov36 * mins / 36 * paceScale);
  const stats = { pts, reb, ast, stl, blk, tov, fgm, fga, ftm, fta, threeM, threeA, mins };
  syncUserStatsIntoBoxScore(gameResult, stats);
  return stats;
}

window.samplePerfectPlayerStatProfile = function(attrs, games, options) {
  options = options || {};
  games = Math.max(50, Math.min(5000, parseInt(games) || 1000));
  var oldPosition = STATE.position;
  var oldOvr = STATE.finalOVR;
  STATE.position = options.position || oldPosition || 'PG';
  STATE.finalOVR = typeof calcOVR === 'function' ? calcOVR(attrs, STATE.position) : oldOvr;
  var baseline = getSimulationPowerBaseline();
  var totals = { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, mins:0 };
  for (var i = 0; i < games; i++) {
    var line = generatePlayerStatsNew(attrs, { scoreA:116, scoreB:114, pace:99.4, teamB:{ power:{ defense:baseline.defense } }, boxScore:null }, false);
    Object.keys(totals).forEach(function(key) { totals[key] += line[key] || 0; });
  }
  STATE.position = oldPosition;
  STATE.finalOVR = oldOvr;
  var average = {};
  Object.keys(totals).forEach(function(key) { average[key] = Math.round(totals[key] / games * 100) / 100; });
  average.fgPct = totals.fga ? Math.round(totals.fgm / totals.fga * 1000) / 1000 : 0;
  average.threePct = totals.threeA ? Math.round(totals.threeM / totals.threeA * 1000) / 1000 : 0;
  average.ftPct = totals.fta ? Math.round(totals.ftm / totals.fta * 1000) / 1000 : 0;
  return { games:games, position:options.position || oldPosition || 'PG', average:average };
};

// ==================== 联盟其他比赛模拟 ====================
function simLeagueDay(daySchedule) {
  // 只模拟非你参与的比赛
  daySchedule.forEach(g => {
    if (g.opponent === undefined) return; // 是你的比赛，已经模拟过了
    
    const powerA = calcTeamPowerWithPlayer(g.opponent._team || g.opponent);
    const powerB = calcTeamPowerWithPlayer(g.opponent === STATE.careerTeam ? g.opponent : null);
    
    // 简化模拟：基于实力随机
    const avgA = (powerA.offense + powerA.defense + powerA.depth) / 3;
    const avgB = (powerB.offense + powerB.defense + powerB.depth) / 3;
    const winProb = avgA / (avgA + avgB);
    
    // 还需要补充...
  });
}

// ==================== 赛季进行 ====================
// ★ [实验性] 以下函数已被 quickSimAllGames 替代，保留作参考
/*
function simNextGame() {
  // ★ 批量进行中时禁止单场点击，防止重复计数
  if (STATE._batchInProgress) return;
  const schedule = STATE.season.schedule;
  const next = schedule.find(g => !g.simulated);
  if (!next) { showEndOfSeason(); return; }
  
  const result = simulateGameNew(STATE.careerTeam, next.opponent);
  next.simulated = true;
  next.result = result;
  
  if (result.won) STATE.season.wins++;
  else STATE.season.losses++;
  
  // 更新联盟排名（包括我们自己！）
  const ourStanding = STATE.season.standings[STATE.careerTeam];
  const oppStanding = STATE.season.standings[next.opponent];
  if (ourStanding) {
    if (result.won) ourStanding.wins++; else ourStanding.losses++;
  }
  if (oppStanding) {
    if (result.won) oppStanding.losses++; else oppStanding.wins++;
    updateStreak(next.opponent, !result.won);
  }
  updateStreak(STATE.careerTeam, result.won);
  
  // 你的数据
  const stats = generatePlayerStatsNew(STATE.attrs, result, false);
  const ps = STATE.season.playerStats;
  ps.pts += stats.pts; ps.reb += stats.reb; ps.ast += stats.ast;
  ps.stl += stats.stl; ps.blk += stats.blk; ps.tov += stats.tov;
  ps.fgm += stats.fgm; ps.fga += stats.fga;
  ps.ftm += stats.ftm; ps.fta += stats.fta;
  ps.threeM += stats.threeM; ps.threeA += stats.threeA;
  ps.mins = (ps.mins || 0) + stats.mins;
  ps.games++;
  
  STATE.season.games.push({ result, stats, game: next });
  
  // ★ 同步所有未处理比赛到当前日期
  simDayLeagueGames(next.day);
  
  // 自动翻到下一场所在月份
  const nextUnplayed = schedule.find(g => !g.simulated);
  if (nextUnplayed) {
    for (let m = 0; m < SEASON_MONTHS.length; m++) {
      if (nextUnplayed.day >= SEASON_MONTHS[m].start && nextUnplayed.day <= SEASON_MONTHS[m].end) {
        STATE._calendarMonth = m;
        break;
      }
    }
  }
  
  // renderSeasonUI();
  // renderGameList();
}
*/

function updateStreak(team, won) {
  const s = STATE.season.standings[team];
  if (!s) return;
  if (s.streakLen > 0 && won === (s.streak === 'W')) {
    s.streakLen++;
  } else {
    s.streak = won ? 'W' : 'L';
    s.streakLen = 1;
  }
}

// ★ [实验性] 以下函数已被 quickSimAllGames 替代，保留作参考
/*
function simBatch(count) {
  if (STATE._batchInProgress) return;
  STATE._batchInProgress = true;
  
  const schedule = STATE.season.schedule;
  const gamesToSim = schedule.filter(g => !g.simulated).slice(0, count);
  if (gamesToSim.length === 0) { STATE._batchInProgress = false; return; }
  
  // 显示进度指示
  const controls = document.getElementById('season-controls');
  if (controls) controls.innerHTML = '<div style="text-align:center;padding:8px;font-family:var(--font-display);font-size:13px;color:var(--orange);">⏳ 模拟中 <span id="sim-progress">0/' + gamesToSim.length + '</span></div>';
  
  let gameIdx = 0;
  
  function simNextGameInBatch() {
    if (gameIdx >= gamesToSim.length) {
      STATE._batchInProgress = false;
      if (!schedule.find(h => !h.simulated)) {
        showEndOfSeason();
      } else {
        renderSeasonUI();
      }
      return;
    }
    
    const g = gamesToSim[gameIdx++];
    
    const result = simulateGameNew(STATE.careerTeam, g.opponent);
    g.simulated = true;
    g.result = result;
    
    if (result.won) STATE.season.wins++;
    else STATE.season.losses++;
    
    const ourStanding = STATE.season.standings[STATE.careerTeam];
    const oppStanding = STATE.season.standings[g.opponent];
    if (ourStanding) {
      if (result.won) ourStanding.wins++; else ourStanding.losses++;
    }
    if (oppStanding) {
      if (result.won) oppStanding.losses++; else oppStanding.wins++;
      updateStreak(g.opponent, !result.won);
    }
    updateStreak(STATE.careerTeam, result.won);
    
    const stats = generatePlayerStatsNew(STATE.attrs, result, false);
    const ps = STATE.season.playerStats;
    ps.pts += stats.pts; ps.reb += stats.reb; ps.ast += stats.ast;
    ps.stl += stats.stl; ps.blk += stats.blk; ps.tov += stats.tov;
    ps.fgm += stats.fgm; ps.fga += stats.fga;
    ps.ftm += stats.ftm; ps.fta += stats.fta;
    ps.threeM += stats.threeM; ps.threeA += stats.threeA;
    ps.mins = (ps.mins || 0) + stats.mins;
    ps.games++;
    
    STATE.season.games.push({ result, stats, game: g });
    simDayLeagueGames(g.day);
    
    const curMonthIdx = SEASON_MONTHS.findIndex(m => g.day >= m.start && g.day <= m.end);
    if (curMonthIdx >= 0) STATE._calendarMonth = curMonthIdx;
    renderSeasonUI();
    
    const prog = document.getElementById('sim-progress');
    if (prog) prog.textContent = gameIdx + '/' + gamesToSim.length;
    
    setTimeout(simNextGameInBatch, 40);
  }
  
*/

/** 处理所有剩余比赛日（赛季结束时调用） */
function processAllRemainingDays() {
  const dayMap = STATE.season._dayMap;
  if (!dayMap) return;
  var keys = Object.keys(dayMap);
  if (keys.length === 0) return;
  const maxDay = Math.max(...keys.map(Number));
  simDayLeagueGames(maxDay);
}

/** 赛季结束 — 停留在赛季页面，让用户选择下一步 */
function showEndOfSeason() {
  processAllRemainingDays();
  // 隐藏 sh-top，只显示 eos-container
  html('season-header').innerHTML = '';
  const seed = getConferenceSeed(STATE.careerTeam);
  
  let actionBtn = '';
  let emoji = '';
  if (seed <= 6) {
    emoji = '🏀';
    actionBtn = `<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="flex:1;">🏀 进入季后赛（${seed}号种子）</button>`;
  } else if (seed <= 10) {
    emoji = '🔥';
    actionBtn = `<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="flex:1;">🔥 附加赛（${seed}号种子）</button>`;
  } else {
    emoji = '📊';
    actionBtn = `<button class="btn btn-gold btn-sm" onclick="showSeasonResults()" style="flex:1;">📊 查看赛季总结</button>`;
  }
  
  const conf = getConference(STATE.careerTeam);
  const confName = conf === 'EAST' ? '东部' : '西部';
  
  html('season-controls').innerHTML = `
    <div class="eos-container">
      <div class="eos-emoji">${emoji}</div>
      <div class="eos-title">常规赛结束</div>
      <div class="eos-record">${STATE.season.wins}-${STATE.season.losses}</div>
      <div class="eos-detail">${confName} 第 ${seed} 名</div>
      <div class="eos-actions">
        ${actionBtn}
      </div>
    </div>
  `;
  // 滚动到顶部
  document.querySelector('.sim-header')?.scrollIntoView({ behavior: 'smooth' });
  setTimeout(function() { maybeShowFirstSixtyWinCelebration(); }, 260);
}

// ==================== 新 GameCast ====================
function renderGameCastNew(game, result, stats) {
  const container = html('gamecast-area');
  let castHtml = `<div class="gamecast">`;
  
  const qLabels = ['第一节', '第二节', '第三节', '第四节'];
  const teamName = getTeamName(STATE.careerTeam);
  const oppName = getTeamName(game.opponent);
  
  for (let q = 0; q < 4; q++) {
    const qA = result.qScoresA?.[q] || Math.round(result.scoreA / 4);
    const qB = result.qScoresB?.[q] || Math.round(result.scoreB / 4);
    const cumA = result.qScoresA?.slice(0, q+1).reduce((a,b)=>a+b, 0) || Math.round(result.scoreA * (q+1) / 4);
    const cumB = result.qScoresB?.slice(0, q+1).reduce((a,b)=>a+b, 0) || Math.round(result.scoreB * (q+1) / 4);
    
    castHtml += `<div class="gc-row ${q === 3 ? 'gc-final' : ''}">
      <span class="gc-q">${qLabels[q]}</span>
      <span class="gc-score ${cumA > cumB ? 'gc-winning' : 'gc-losing'}">${qA}-${qB}</span>
      <span class="gc-total">(${cumA}-${cumB})</span>
      ${q === 3 && stats ? `<span class="gc-stats">📊 ${stats.pts}分 ${stats.reb}板 ${stats.ast}助</span>` : ''}
    </div>`;
  }
  
  if (result.ot) {
    castHtml += `<div class="gc-row gc-ot">
      <span class="gc-q">加时</span>
      <span class="gc-score">${result.scoreA - (result.qScoresA?.reduce((a,b)=>a+b,0) || 0)}-${result.scoreB - (result.qScoresB?.reduce((a,b)=>a+b,0) || 0)}</span>
    </div>`;
  }
  
  if (result.keyEvents && result.keyEvents.length > 0) {
    castHtml += `<div class="gc-events">`;
    result.keyEvents.forEach(e => {
      castHtml += `<div class="gc-event">⚡ ${e}</div>`;
    });
    castHtml += `</div>`;
  }
  
  // 你的球员表现
  if (stats) {
    const pct = stats.fga > 0 ? Math.round(stats.fgm / stats.fga * 100) : 0;
    const threePct = stats.threeA > 0 ? Math.round(stats.threeM / stats.threeA * 100) : 0;
    castHtml += `<div class="gc-player-line">
      <span class="gc-player-name">我的球员</span>
      <span>${stats.pts}分 / ${stats.reb}板 / ${stats.ast}助</span>
      <span style="color:var(--text-dim);font-size:11px;">${stats.fgm}-${stats.fga} (${pct}%) / ${stats.threeM}-${stats.threeA} (${threePct}%) / ${stats.ftm}-${stats.fta}</span>
    </div>`;
  }
  
  castHtml += `<div class="gc-result ${result.won ? 'result-win' : 'result-loss'}">
    ${result.won ? '✅ 胜利' : '❌ 失利'} · ${result.scoreA}-${result.scoreB}
    <span style="font-size:12px;color:var(--text-dim);">${teamName} vs ${oppName}</span>
  </div>`;
  
  castHtml += `</div>`;
  container.innerHTML = castHtml;
  container.scrollTop = container.scrollHeight;
}

// ==================== 赛季UI ====================
// ★ [实验性] 以下函数已被 quickSimAllGames + renderDotGrid 替代，保留作参考
/*
function renderSeasonUI() {
  const rec = STATE.season;
  if (!rec || !rec.playerStats) return;
  
  // 最近5场
  const recentGames = STATE.season.games.slice(-5);
  let last5Html = recentGames.map(g => 
    `<span class="wl-dot ${g.result.won ? 'wl-w' : 'wl-l'}">${g.result.won ? 'W' : 'L'}</span>`
  ).join('');
  
  // 场均数据
  const gp = rec.playerStats.games || 1;
  const avg = {
    pts: Math.round(rec.playerStats.pts / gp * 10) / 10,
    reb: Math.round(rec.playerStats.reb / gp * 10) / 10,
    ast: Math.round(rec.playerStats.ast / gp * 10) / 10,
  };
  
  // 连胜/连败
  const streak = STATE.season.standings[STATE.careerTeam]?.streak || '';
  const streakLen = STATE.season.standings[STATE.careerTeam]?.streakLen || 0;
  const streakStr = streakLen > 0 ? `${streak}${streakLen}` : '';
  
  html('season-header').innerHTML = `
    <div class="sh-top">
      <div class="sh-team">
        <div class="sh-team-name">${getTeamLogo(STATE.careerTeam, 24)} ${getTeamName(STATE.careerTeam)}</div>
        <div class="sh-team-full">${(window.TEAM_CITY && window.TEAM_CITY[STATE.careerTeam]) || ''}</div>
      </div>
      <div class="sh-season">${getCurrentSeasonLabel()}</div>
      <div class="sh-record">
        <span class="sh-wins">${rec.wins}</span><span class="sh-dash">-</span><span class="sh-losses">${rec.losses}</span>
        <div class="sh-pct">${rec.wins + rec.losses > 0 ? (rec.wins / (rec.wins + rec.losses) * 100).toFixed(1) + '%' : '—'}</div>
      </div>
    </div>
    <div class="sh-info">
      <span>${SIM_CONFIG.POSITIONS[STATE.position]} · OVR ${STATE.finalOVR}</span>
      <span>场均 ${avg.pts}分 ${avg.reb}板 ${avg.ast}助</span>
      <span>${last5Html ? '最近: ' + last5Html : ''} ${streakStr}</span>
    </div>
  `;
  
  // 判断所有比赛是否已打完
  const allDone = STATE.season.schedule && !STATE.season.schedule.find(g => !g.simulated);
  const seed = getConferenceSeed(STATE.careerTeam);
  let nextBtn = '';
  if (allDone) {
    if (seed <= 10) {
      nextBtn = `<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="flex:1;">🏀 进入季后赛</button>`;
    } else {
      nextBtn = `<button class="btn btn-secondary btn-sm" onclick="showSeasonResults()" style="flex:1;">📊 查看赛季总结</button>`;
    }
  } else {
    const nextGame = STATE.season.schedule?.find(g => !g.simulated);
    const oppName = nextGame ? getTeamName(nextGame.opponent) : '';
    const prefix = nextGame ? (nextGame.home ? 'vs' : '@') : '';
    nextBtn = `
      <button class="btn btn-gold btn-sm" onclick="simNextGame()" style="flex:1;">进行下一场</button>
      <button class="btn btn-gold btn-sm" onclick="simBatch(10)" style="flex:1;">⏩ 进行下十场</button>
    `;
  }
  html('season-controls').innerHTML = `
    ${nextBtn}
    <button class="btn btn-secondary btn-sm" onclick="showMyCard()">📊 我的数据</button>
  `;
  
  // renderCalendar();  // 日历模式已注释
}
*/
/*
function renderGameList() {
  // renderCalendar();  // 日历模式已注释
}
*/

// ==================== 日历赛程 ====================
/** 月份→day区间（day 0 = 2025年10月21日 赛季首日） */
const SEASON_MONTHS = [
  { name: '10月', start: 0, end: 10, firstDate: 21, days: 31, firstWday: 3 },
  { name: '11月', start: 11, end: 40, firstDate: 1, days: 30, firstWday: 6 },
  { name: '12月', start: 41, end: 71, firstDate: 1, days: 31, firstWday: 1 },
  { name: '1月', start: 72, end: 102, firstDate: 1, days: 31, firstWday: 4 },
  { name: '2月', start: 103, end: 130, firstDate: 1, days: 28, firstWday: 0 },
  { name: '3月', start: 131, end: 161, firstDate: 1, days: 31, firstWday: 0 },
  { name: '4月', start: 162, end: 191, firstDate: 1, days: 30, firstWday: 3 },
];

function renderCalendar() {
  if (!STATE._calendarMonth) STATE._calendarMonth = 0;
  const monthIdx = STATE._calendarMonth;
  const month = SEASON_MONTHS[monthIdx];
  if (!month) return;
  
  const schedule = STATE.season.schedule || [];
  const games = STATE.season.games || [];
  const nextGameIdx = schedule.findIndex(g => !g.simulated);
  const nextGame = nextGameIdx >= 0 ? schedule[nextGameIdx] : null;
  
  // 构建比赛查找表: seasonDay → info
  const dayMap = {};
  schedule.forEach(g => {
    if (g.day >= month.start && g.day <= month.end) {
      const result = g.simulated ? (games.find(gg => gg.game.gameNum === g.gameNum)?.result || null) : null;
      dayMap[g.day] = {
        opponent: g.opponent, home: g.home,
        simulated: g.simulated, result,
        isNext: nextGame && g.day === nextGame.day,
      };
    }
  });
  
  // 该月天数 & 第一天星期几
  const totalDays = month.days;
  const firstWday = month.firstWday; // 0=日 1=一 ... 6=六
  
  // 顶部：月份标题 + 排行榜按钮
  let htmlStr = `<div class="cal-wrap">
    <div class="cal-header">
      <button class="cal-nav" onclick="switchCalendar(${monthIdx - 1})" ${monthIdx === 0 ? 'disabled' : ''}>◀</button>
      <span class="cal-title">${month.name}</span>
      <button class="cal-nav" onclick="switchCalendar(${monthIdx + 1})" ${monthIdx >= SEASON_MONTHS.length - 1 ? 'disabled' : ''}>▶</button>
      <button class="cal-standings-btn" onclick="trackEvent({act:'click',blk:'BMC098',pos:'TC15',label:'排行榜'});showStandingsModal()">🏆 排行榜</button>
    </div>`;
  
  // 星期头
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  htmlStr += `<div class="cal-weekdays">${weekdays.map(d => `<span>${d}</span>`).join('')}</div>`;
  
  // 日历网格
  let cells = '';
  
  // 月首空白
  for (let i = 0; i < firstWday; i++) {
    cells += '<div class="cal-cell cal-empty"></div>';
  }
  
  // 该月每一天
  for (let date = 1; date <= totalDays; date++) {
    const seasonDay = month.start + (date - month.firstDate);
    const info = dayMap[seasonDay];
    const isGameDay = !!info;
    const isToday = info?.isNext;
    const isPast = info?.simulated;
    
    let cls = 'cal-cell';
    let content = '';
    let onclick = '';
    
    if (!isGameDay) {
      cls += ' cal-rest';
      content = `<span class="cal-date">${date}</span>`;
    } else if (isPast && info.result) {
      const won = info.result.won;
      cls += won ? ' cal-w' : ' cal-l';
      cls += ' cal-played';
      content = `<span class="cal-date">${date}</span>
        <span class="cal-opp">${info.home ? 'vs' : '@'}${getTeamLogo(info.opponent, 16)}</span>
        <span class="cal-score">${info.result.scoreA}-${info.result.scoreB}</span>`;
      onclick = `onclick="showGamePopup(${seasonDay})"`;
    } else if (isToday) {
      cls += ' cal-today';
      content = `<span class="cal-date">${date}</span>
        <span class="cal-opp">${info.home ? 'vs' : '@'}${getTeamLogo(info.opponent, 16)}</span>`;
      onclick = `onclick="simToDay(${seasonDay})"`;
    } else {
      cls += ' cal-future';
      content = `<span class="cal-date">${date}</span>
        <span class="cal-opp">${info.home ? 'vs' : '@'}${getTeamLogo(info.opponent, 16)}</span>`;
      onclick = `onclick="simToDay(${seasonDay})"`;
    }
    
    cells += `<div class="${cls}" ${onclick}>${content}</div>`;
  }
  
  htmlStr += `<div class="cal-grid">${cells}</div>`;
  
  // 底部 — 只保留进度文字
  htmlStr += `<div class="cal-footer">
    <span style="font-size:10px;color:var(--text-muted);flex:1;text-align:left;">💡 点击赛程表中任意一场比赛，可直接模拟至该场比赛</span>
    <span class="cal-progress">${schedule.filter(g => g.simulated).length} / ${schedule.length} 场</span>
  </div>`;
  
  htmlStr += '</div>';
  document.getElementById('game-list').innerHTML = htmlStr;
}

function switchCalendar(idx) {
  
  if (idx < 0 || idx >= SEASON_MONTHS.length) return;
  STATE._calendarMonth = idx;
  renderCalendar();
}

/** 点击已赛场次 → 弹窗显示比分 + 你的表现 */
function showGamePopup(seasonDay) {
  
  const gameData = STATE.season.games.find(gg => gg.game.day === seasonDay);
  if (!gameData) return;
  const { result, stats, game } = gameData;
  
  const teamName = getTeamName(STATE.careerTeam);
  const oppName = getTeamName(game.opponent);
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  // 各节比分
  let quartersHtml = '';
  for (let q = 0; q < 4; q++) {
    const qA = result.qScoresA?.[q] || 0;
    const qB = result.qScoresB?.[q] || 0;
    quartersHtml += `<div style="display:flex;gap:4px;padding:2px 0;font-family:var(--font-display);font-size:12px;border-bottom:1px solid var(--border);">
      <span style="width:28px;color:var(--text-muted);">${qLabels[q]}</span>
      <span style="flex:1;text-align:center;font-weight:${qA > qB ? 700 : 400};color:${qA > qB ? 'var(--green)' : 'var(--text-dim)'};">${qA}</span>
      <span style="flex:1;text-align:center;font-weight:${qB > qA ? 700 : 400};color:${qB > qA ? 'var(--green)' : 'var(--text-dim)'};">${qB}</span>
    </div>`;
  }
  
  // 使用你的实际比赛数据（与场均统计同源）
  const myPts = stats?.pts ?? 0;
  const myReb = stats?.reb ?? 0;
  const myAst = stats?.ast ?? 0;
  const myStl = Math.round(stats?.stl ?? 0);
  const myBlk = Math.round(stats?.blk ?? 0);
  const myTov = Math.round(stats?.tov ?? 0);
  const myFgm = stats?.fgm ?? 0;
  const myFga = stats?.fga ?? 0;
  const myMin = stats?.mins ?? 0;
  const myThreeM = stats?.threeM ?? 0;
  const myThreeA = stats?.threeA ?? 0;
  const myFtm = stats?.ftm ?? 0;
  const myFta = stats?.fta ?? 0;
  const myTwoM = myFgm - myThreeM;
  const myTwoA = myFga - myThreeA;
  
  const myTeamTotal = result.scoreA;
  const oppTotal = result.scoreB;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:310px;">
      <div class="modal-header" style="padding:8px 12px;">
        <span style="font-family:var(--font-display);font-size:15px;">${result.won ? '✅' : '❌'} ${myTeamTotal}-${oppTotal}</span>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div style="text-align:center;padding:3px 10px 6px;font-family:var(--font-display);font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border);">
        ${teamName} vs ${oppName} · ${game.home ? '主场' : '客场'} ${result.ot ? '· ' + (result.ot > 1 ? result.ot + 'OT' : 'OT') : ''}
      </div>
      
      <!-- 各节 -->
      <div style="padding:4px 12px 3px;">
        ${quartersHtml}
      </div>
      
      <!-- 你的数据 -->
      <div style="padding:6px 12px 10px;">
        <div style="font-family:var(--font-display);font-size:12px;color:var(--orange);margin-bottom:4px;">📊 我的表现</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;font-family:var(--font-display);">
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;color:var(--orange);">${myPts}</div>
            <div style="font-size:8px;color:var(--text-muted);">得分</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;">${myReb}</div>
            <div style="font-size:8px;color:var(--text-muted);">篮板</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;">${myAst}</div>
            <div style="font-size:8px;color:var(--text-muted);">助攻</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 6px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${myStl}</div>
            <div style="font-size:8px;color:var(--text-muted);">断</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 6px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${myBlk}</div>
            <div style="font-size:8px;color:var(--text-muted);">帽</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 6px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${myTov}</div>
            <div style="font-size:8px;color:var(--text-muted);">误</div>
          </span>
        </div>
        <div style="margin-top:6px;font-family:var(--font-display);font-size:10px;color:var(--text-dim);text-align:center;">
          两分 ${myTwoM}-${myTwoA} · 三分 ${myThreeM}-${myThreeA} · 罚球 ${myFtm}-${myFta}<br>
          投篮 ${myFgm}-${myFga} (${myFga > 0 ? Math.round(myFgm/myFga*100) : 0}%)
        </div>

      </div>
      
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

// ==================== 排行榜弹窗 ====================
function showStandingsModal() {
  const standings = STATE.season.standings;
  if (!standings) return;
  
  if (!STATE._standingsTab) {
    STATE._standingsTab = getConference(STATE.careerTeam) === 'EAST' ? 'EAST' : 'WEST';
  }
  
  function renderConf(teams) {
    const sorted = teams
      .map(t => ({ team: t, ...standings[t] }))
      .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.wins - a.wins);
    
    let html = '<div class="st-hdr"><span>#</span><span>球队</span><span>胜</span><span>负</span><span>胜差</span><span>近况</span></div>';
    let leaderWins = 0, leaderLosses = 0;
    sorted.forEach((s, i) => {
      if (i === 0) { leaderWins = s.wins; leaderLosses = s.losses; }
      const gb = i === 0 ? '-' : ((leaderWins - s.wins + s.losses - leaderLosses) / 2).toFixed(1);
      const isMyTeam = s.team === STATE.careerTeam;
      html += `<div class="st-row ${isMyTeam ? 'st-my' : ''}">
        <span>${i + 1}</span>
        <span>${getTeamLogo(s.team, 16)} ${getTeamName(s.team)} ${isMyTeam ? '⭐' : ''}</span>
        <span class="st-w">${s.wins}</span>
        <span class="st-l">${s.losses}</span>
        <span>${gb}</span>
        <span class="st-streak">${s.streakLen > 0 ? s.streak + s.streakLen : '-'}</span>
      </div>`;
    });
    return html;
  }
  
  const active = STATE._standingsTab;
  const tabsHtml = `
    <div class="modal-tabs">
      <button onclick="switchStandingsTab('EAST')" class="${active === 'EAST' ? 'active' : ''}">东部</button>
      <button onclick="switchStandingsTab('WEST')" class="${active === 'WEST' ? 'active' : ''}">西部</button>
    </div>`;
  
  const teams = active === 'EAST' ? SIM_CONFIG.CONFERENCE.EAST : SIM_CONFIG.CONFERENCE.WEST;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'standings-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <span style="font-family:var(--font-display);font-size:20px;">🏆 排行榜</span>
        <button class="modal-close" onclick="closeStandingsModal()">✕</button>
      </div>
      ${tabsHtml}
      <div class="modal-body">${renderConf(teams)}</div>
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) closeStandingsModal(); };
  document.body.appendChild(modal);
}

function switchStandingsTab(conf) {
  STATE._standingsTab = conf;
  const modal = document.getElementById('standings-modal');
  if (modal) modal.remove();
  showStandingsModal();
}

function closeStandingsModal() {
  
  const modal = document.getElementById('standings-modal');
  if (modal) modal.remove();
}

// ★ [实验性] 以下函数已被 quickSimAllGames 替代，保留作参考
/*
function simToDay(targetDay) {
  const month = SEASON_MONTHS.find(m => targetDay >= m.start && targetDay <= m.end);
  const dateStr = month ? `${month.name}${targetDay - month.start + month.firstDate}日` : `第${targetDay + 1}天`;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:300px;text-align:center;">
      <div class="modal-header" style="justify-content:center;border:none;padding:20px 16px 8px;">
        <span style="font-family:var(--font-display);font-size:20px;">⏩ 模拟到 ${dateStr}？</span>
      </div>
      <div style="padding:4px 16px 20px;font-size:13px;color:var(--text-dim);">
        将模拟从今天到 ${dateStr} 的所有比赛
      </div>
      <div style="display:flex;gap:8px;padding:0 16px 16px;">
        <button class="btn btn-sm" style="flex:1;background:var(--bg-card);color:var(--text);border:2px solid var(--border);border-radius:10px;" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-primary btn-sm" style="flex:1;border-radius:10px;" onclick="this.closest('.modal-overlay').remove();_simToDay(${targetDay})">确定</button>
      </div>
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function _simToDay(targetDay) {
  // ★ 批量进行中时禁止点击，防止重复计数
  if (STATE._batchInProgress) return;
  STATE._batchInProgress = true;
  
  const schedule = STATE.season.schedule;
  const gamesToSim = schedule.filter(g => !g.simulated && g.day <= targetDay);
  if (gamesToSim.length === 0) { STATE._batchInProgress = false; renderSeasonUI(); renderCalendar(); return; }
  
  // 显示进度指示
  const controls = document.getElementById('season-controls');
  if (controls) controls.innerHTML = '<div style="text-align:center;padding:8px;font-family:var(--font-display);font-size:13px;color:var(--orange);">⏳ 模拟中 <span id="sim-progress">0/' + gamesToSim.length + '</span></div>';
  
  let gameIdx = 0;
  
  function simNextGameInBatch() {
    if (gameIdx >= gamesToSim.length) {
      STATE._batchInProgress = false;
      // 全部完成
      if (!schedule.find(h => !h.simulated)) {
        showEndOfSeason();
      } else {
        renderSeasonUI(); // 内含 renderCalendar()
      }
      return;
    }
    
    const g = gamesToSim[gameIdx++];
    
    const result = simulateGameNew(STATE.careerTeam, g.opponent);
    g.simulated = true;
    g.result = result;
    
    if (result.won) STATE.season.wins++;
    else STATE.season.losses++;
    
    const ourStanding = STATE.season.standings[STATE.careerTeam];
    const oppStanding = STATE.season.standings[g.opponent];
    if (ourStanding) {
      if (result.won) ourStanding.wins++; else ourStanding.losses++;
    }
    if (oppStanding) {
      if (result.won) oppStanding.losses++; else oppStanding.wins++;
      updateStreak(g.opponent, !result.won);
    }
    updateStreak(STATE.careerTeam, result.won);
    
    const stats = generatePlayerStatsNew(STATE.attrs, result, false);
    const ps = STATE.season.playerStats;
    ps.pts += stats.pts; ps.reb += stats.reb; ps.ast += stats.ast;
    ps.stl += stats.stl; ps.blk += stats.blk; ps.tov += stats.tov;
    ps.fgm += stats.fgm; ps.fga += stats.fga;
    ps.ftm += stats.ftm; ps.fta += stats.fta;
    ps.threeM += stats.threeM; ps.threeA += stats.threeA;
    ps.mins = (ps.mins || 0) + stats.mins;
    ps.games++;
    
    STATE.season.games.push({ result, stats, game: g });
    simDayLeagueGames(g.day);
    
    // ★ 实时更新：赛程表 + 进度
    // 自动切换到当前比赛对应的月份
    const curMonthIdx = SEASON_MONTHS.findIndex(m => g.day >= m.start && g.day <= m.end);
    if (curMonthIdx >= 0) STATE._calendarMonth = curMonthIdx;
    renderSeasonUI(); // 更新header + calendar
    
    const prog = document.getElementById('sim-progress');
    if (prog) prog.textContent = gameIdx + '/' + gamesToSim.length;
    
    // 继续下一场（40ms延迟让UI能刷新）
    setTimeout(simNextGameInBatch, 40);
  }
  
  // simNextGameInBatch();
}
*/

// ==================== Play-In 附加赛 ====================
function renderPlayIn() {
  showScreen('screen-playoffs');
  
  const conf = getConference(STATE.careerTeam);
  const sorted = getConferenceSorted(conf);
  const mySeed = getConferenceSeed(STATE.careerTeam);
  
  // 提取附加赛球队 (7-10)
  const playInTeams = sorted.filter(t => {
    const s = getConferenceSeed(t.team);
    return s >= 7 && s <= 10;
  });
  
  // 确定各队角色
  const seed7 = playInTeams.find(t => getConferenceSeed(t.team) === 7);
  const seed8 = playInTeams.find(t => getConferenceSeed(t.team) === 8);
  const seed9 = playInTeams.find(t => getConferenceSeed(t.team) === 9);
  const seed10 = playInTeams.find(t => getConferenceSeed(t.team) === 10);
  
  STATE.season.playInState = {
    seed7, seed8, seed9, seed10,
    gameAResult: null,  // 7v8
    gameBResult: null,  // 9v10
    gameCResult: null,  // 败7/8 vs 胜9/10
    isEliminated: false,
    playoffSeed: null,  // 最终进入季后赛的种子 (7 or 8)
  };
  
  renderPlayInUI();
}

function renderPlayInUI() {
  const pi = STATE.season.playInState;
  if (!pi) return;
  
  const isMyTeam = (team) => team === STATE.careerTeam;
  const myTeam = STATE.careerTeam;
  
  let h = `<div class="playin-container" style="padding:8px 0;">`;
  h += `<div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:14px;color:var(--text-dim);">🔥 附加赛</div>
    <div style="font-size:20px;font-weight:800;">${getConference(STATE.careerTeam) === 'EAST' ? '东部' : '西部'} Play-In</div>
  </div>`;
  
  // Game A: 7 vs 8
  const gA = pi.gameAResult;
  const myInA = isMyTeam(pi.seed7?.team) || isMyTeam(pi.seed8?.team);
  h += `<div class="playin-game" style="background:var(--bg-card);border-radius:var(--radius);padding:12px;margin-bottom:10px;border:1px solid var(--border);">`;
  h += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">🏀 第7vs8种子 · 胜者晋级季后赛（7号种子）</div>`;
  if (!gA) {
      h += `<div style="display:flex;justify-content:space-around;align-items:center;padding:8px 0;">
        <div style="text-align:center;flex:1;">${getTeamName(pi.seed7?.team) || '?'}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed7?.wins || 0}胜</span></div>
        <div style="font-size:18px;font-weight:700;color:var(--accent);padding:0 12px;">VS</div>
        <div style="text-align:center;flex:1;">${getTeamName(pi.seed8?.team) || '?'}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed8?.wins || 0}胜</span></div>
      </div>`;
    if (myInA) {
      h += `<button class="btn btn-gold btn-sm" onclick="simPlayInGame('A')" style="margin-top:6px;">▶ 模拟附加赛第7vs8</button>`;
    }
  } else {
    const winTeam = gA.winner;
    h += `<div style="text-align:center;padding:4px 0;">
      <span style="color:var(--green);font-weight:700;">✅ ${getTeamName(winTeam)}</span> 晋级（7号种子）
      <span style="color:var(--red);margin-left:8px;">❌ ${getTeamName(gA.loser)}</span> 落入败者组
    </div>`;
    if (isMyTeam(gA.winner)) {
      h += `<div style="text-align:center;color:var(--gold);font-weight:700;margin-top:4px;">🎉 你赢了！以7号种子进入季后赛！</div>`;
    }
  }
  h += `</div>`;
  
  // Game B: 9 vs 10
  const gB = pi.gameBResult;
  const myInB = isMyTeam(pi.seed9?.team) || isMyTeam(pi.seed10?.team);
  h += `<div class="playin-game" style="background:var(--bg-card);border-radius:var(--radius);padding:12px;margin-bottom:10px;border:1px solid var(--border);">`;
  h += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">🏀 第9vs10种子 · 败者淘汰</div>`;
  if (!gB) {
      h += `<div style="display:flex;justify-content:space-around;align-items:center;padding:8px 0;">
        <div style="text-align:center;flex:1;">${getTeamName(pi.seed9?.team) || '?'}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed9?.wins || 0}胜</span></div>
        <div style="font-size:18px;font-weight:700;color:var(--accent);padding:0 12px;">VS</div>
        <div style="text-align:center;flex:1;">${getTeamName(pi.seed10?.team) || '?'}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed10?.wins || 0}胜</span></div>
      </div>`;
    if (myInB) {
      h += `<button class="btn btn-gold btn-sm" onclick="simPlayInGame('B')" style="margin-top:6px;">▶ 模拟附加赛第9vs10</button>`;
    }
  } else {
    const winTeam = gB.winner;
    h += `<div style="text-align:center;padding:4px 0;">
      <span style="color:var(--green);font-weight:700;">✅ ${getTeamName(winTeam)}</span> 进入败者组决赛
      <span style="color:var(--red);margin-left:8px;">❌ ${getTeamName(gB.loser)}</span> 淘汰
    </div>`;
    if (isMyTeam(gB.loser)) {
      h += `<div style="text-align:center;color:var(--text-dim);margin-top:4px;">😢 被淘汰了</div>`;
    }
  }
  h += `</div>`;
  
  // Game C: 败7/8 vs 胜9/10
  if (gA && gB) {
    const gC = pi.gameCResult;
    const teamA = gA.loser;
    const teamB = gB.winner;
    const myInC = isMyTeam(teamA) || isMyTeam(teamB);
    
    h += `<div class="playin-game" style="background:var(--bg-card);border-radius:var(--radius);padding:12px;margin-bottom:10px;border:1px solid var(--border);">`;
    h += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">🏀 败者组决赛 · 胜者晋级季后赛（8号种子）</div>`;
    if (!gC) {
      h += `<div style="display:flex;justify-content:space-around;align-items:center;padding:8px 0;">
        <div style="text-align:center;flex:1;">${getTeamName(teamA)}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed8?.wins || 0}胜</span></div>
        <div style="font-size:18px;font-weight:700;color:var(--accent);padding:0 12px;">VS</div>
        <div style="text-align:center;flex:1;">${getTeamName(teamB)}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed9?.wins || 0}胜</span></div>
      </div>`;
      if (myInC) {
        h += `<button class="btn btn-gold btn-sm" onclick="simPlayInGame('C')" style="margin-top:6px;">▶ 模拟附加赛败者组决赛</button>`;
      }
    } else {
      const winTeam = gC.winner;
      h += `<div style="text-align:center;padding:4px 0;">
        <span style="color:var(--green);font-weight:700;">✅ ${getTeamName(winTeam)}</span> 晋级（8号种子）
        <span style="color:var(--red);margin-left:8px;">❌ ${getTeamName(gC.loser)}</span> 淘汰
      </div>`;
      if (isMyTeam(gC.winner)) {
        h += `<div style="text-align:center;color:var(--gold);font-weight:700;margin-top:4px;">🎉 你赢了！以8号种子进入季后赛！</div>`;
      }
    }
    h += `</div>`;
  }
  
  // 检查是否晋级季后赛
  if (checkPlayInComplete()) {
    const ps = STATE.season.playInState.playoffSeed;
    h += `<button class="btn btn-gold" onclick="renderPlayoffs()" style="margin-top:8px;">🏀 进入季后赛（${ps}号种子）</button>`;
  } else if (pi.isEliminated) {
    h += `<button class="btn btn-secondary" onclick="showSeasonResults()" style="margin-top:8px;">📊 查看赛季总结</button>`;
  }
  
  h += `</div>`;
  document.getElementById('playoffs-area').innerHTML = h;
  
  // ★ 自动模拟不涉及玩家的附加赛比赛
  setTimeout(autoSimNonUserPlayInGames, 100);
}

/** 自动模拟不涉及玩家的附加赛比赛 */
function autoSimNonUserPlayInGames() {
  const pi = STATE.season.playInState;
  if (!pi || pi.isEliminated || pi.playoffSeed) return;
  
  const myTeam = STATE.careerTeam;
  const inA = pi.seed7 && (pi.seed7.team === myTeam || pi.seed8.team === myTeam);
  const inB = pi.seed9 && (pi.seed9.team === myTeam || pi.seed10.team === myTeam);
  
  // 玩家在 Game A → 自动模拟 Game B（9vs10）
  if (inA && !pi.gameBResult && pi.seed9 && pi.seed10) {
    simPlayInGame('B');
    return;
  }
  
  // 玩家在 Game B → 自动模拟 Game A（7vs8）
  if (inB && !pi.gameAResult && pi.seed7 && pi.seed8) {
    simPlayInGame('A');
    return;
  }
  
  // Game A 已打完且玩家输了 → 玩家进入Game C, 需要 Game B 完成
  if (pi.gameAResult && !pi.gameBResult && pi.seed9 && pi.seed10 && pi.gameAResult.loser === myTeam) {
    simPlayInGame('B');
    return;
  }
  
  // Game B 已打完且玩家赢了 → 需要 Game A 完成才能进行 Game C
  if (pi.gameBResult && !pi.gameAResult && pi.seed7 && pi.seed8 && pi.gameBResult.winner) {
    simPlayInGame('A');
    return;
  }
}

function simPlayInGame(gameId) {
  trackEvent({act:"click",blk:"BMC098",pos:"TC11",label:"模拟附加赛"});
  const pi = STATE.season.playInState;
  if (!pi) return;
  
  let teamA, teamB, resultKey, label;
  
  if (gameId === 'A') {
    teamA = pi.seed7.team;
    teamB = pi.seed8.team;
    resultKey = 'gameAResult';
    label = '第7vs8种子';
  } else if (gameId === 'B') {
    teamA = pi.seed9.team;
    teamB = pi.seed10.team;
    resultKey = 'gameBResult';
    label = '第9vs10种子';
  } else if (gameId === 'C') {
    teamA = pi.gameAResult.loser;
    teamB = pi.gameBResult.winner;
    resultKey = 'gameCResult';
    label = '败者组决赛';
  }
  
  const myTeam = STATE.careerTeam;
  const isMine = teamA === myTeam || teamB === myTeam;
  if (isMine && typeof liveOrSkipUserPack === 'function') {
    var opp = teamA === myTeam ? teamB : teamA;
    liveOrSkipUserPack(opp, {
      isPlayoff: true,
      playIn: true,
      teamAHome: teamA === myTeam,
      title: '附加赛',
      reason: label + '，对阵 ' + getTeamName(opp) + '。一场定胜负。'
    }, function (pack) {
      var userWon = !!pack.result.won;
      var winner = userWon ? myTeam : opp;
      var loser = userWon ? opp : myTeam;
      var result = {
        winner: winner, loser: loser,
        teamAScore: teamA === myTeam ? pack.result.scoreA : pack.result.scoreB,
        teamBScore: teamA === myTeam ? pack.result.scoreB : pack.result.scoreA,
        label: label,
        boxScore: pack.result.boxScore,
        myStats: pack.stats
      };
      pi[resultKey] = result;
      var stats = pack.stats;
      if (stats && STATE.season && STATE.season.playoffStats) {
        var po = STATE.season.playoffStats;
        po.pts += stats.pts; po.reb += stats.reb; po.ast += stats.ast;
        po.stl += stats.stl; po.blk += stats.blk; po.tov += stats.tov;
        po.fgm += stats.fgm; po.fga += stats.fga;
        po.ftm += stats.ftm; po.fta += stats.fta;
        po.threeM += stats.threeM; po.threeA += stats.threeA;
        po.mins = (po.mins || 0) + stats.mins;
        po.games++;
      }
      if (winner === myTeam) {
        if (gameId === 'A') pi.playoffSeed = 7;
        else if (gameId === 'C') pi.playoffSeed = 8;
      }
      if (loser === myTeam && (gameId === 'B' || gameId === 'C')) pi.isEliminated = true;
      renderPlayInUI();
      if (checkPlayInComplete()) STATE.season._playoffRound = 1;
    });
    return;
  }

  // 模拟单场
  const powerA = calcTeamPowerWithPlayer(teamA);
  const powerB = calcTeamPowerWithPlayer(teamB);
  const avgA = (powerA.offense + powerA.defense + powerA.depth) / 3;
  const avgB = (powerB.offense + powerB.defense + powerB.depth) / 3;
  
  // 增加随机性，让附加赛更刺激
  const rand = Math.random();
  const winProb = avgA / (avgA + avgB + 0.01);
  const adjustedProb = winProb * 0.6 + 0.2 + rand * 0.2; // 40-80%范围，增加变数
  const aWins = Math.random() < adjustedProb;
  
  const winner = aWins ? teamA : teamB;
  const loser = aWins ? teamB : teamA;
  
  const result = {
    winner, loser,
    teamAScore: Math.round(avgA * (0.8 + Math.random() * 0.4)),
    teamBScore: Math.round(avgB * (0.8 + Math.random() * 0.4)),
    label,
  };
  
  pi[resultKey] = result;
  
  // 检测是否涉及玩家
  if (winner === myTeam) {
    if (gameId === 'A') {
      pi.playoffSeed = 7;
    } else if (gameId === 'C') {
      pi.playoffSeed = 8;
    }
  }
  if (loser === myTeam && gameId === 'B') {
    pi.isEliminated = true;
  }
  if (loser === myTeam && gameId === 'C') {
    pi.isEliminated = true;
  }
  
  renderPlayInUI();
  
  // ★ 附加赛晋级后，用户通过UI按钮手动进入季后赛
  if (checkPlayInComplete()) {
    STATE.season._playoffRound = 1;
  }
}

function checkPlayInComplete() {
  const pi = STATE.season.playInState;
  if (!pi) return false;
  if (pi.isEliminated) return false;
  
  // 已经通过Game A直接晋级
  if (pi.playoffSeed === 7) return true;
  
  // Game A + Game B完成后，Game C也完成则晋级
  if (pi.gameAResult && pi.gameBResult && pi.gameCResult) {
    if (pi.playoffSeed === 8) return true;
  }
  
  return false;
}

// ==================== 赛季结束 ====================
function endSeason() {
  const ps = STATE.season.playerStats;
  const games = ps.games || 1;
  
  STATE.season.avgStats = {
    pts: Math.round(ps.pts / games * 10) / 10,
    reb: Math.round(ps.reb / games * 10) / 10,
    ast: Math.round(ps.ast / games * 10) / 10,
    stl: Math.round(ps.stl / games * 10) / 10,
    blk: Math.round(ps.blk / games * 10) / 10,
    tov: Math.round(ps.tov / games * 10) / 10,
    fgm: Math.round(ps.fgm / games * 10) / 10,
    fga: Math.round(ps.fga / games * 10) / 10,
    ftm: Math.round(ps.ftm / games * 10) / 10,
    fta: Math.round(ps.fta / games * 10) / 10,
    threeM: Math.round(ps.threeM / games * 10) / 10,
    threeA: Math.round(ps.threeA / games * 10) / 10,
    mins: Math.round(ps.mins / games),
  };
  
  calcSeasonAwards();
  
  // 赛季结束，转到 MyCard
  renderMyCard(true);
}

// ==================== 季后赛系统（真实排名版）====================
/** 为指定分区构建季后赛对阵数据结构 */
function buildPlayoffBracket(conf, playInState) {
  const sorted = getConferenceSorted(conf);
  const teams = sorted.slice(0, 8);
  
  // ★ 附加赛结果替换7/8号种子
  if (playInState && !playInState.isEliminated) {
    // Game A winner → 7号种子
    if (playInState.gameAResult?.winner) {
      teams[6] = { team: playInState.gameAResult.winner, ovr: calcTeamPowerWithPlayer(playInState.gameAResult.winner) };
    }
    // Game C winner → 8号种子（只有C打完才确定）
    if (playInState.gameCResult?.winner) {
      teams[7] = { team: playInState.gameCResult.winner, ovr: calcTeamPowerWithPlayer(playInState.gameCResult.winner) };
    }
  }
  return {
    conf: conf,
    teams: teams,
    rounds: [
      [
        { high: teams[0], low: teams[7], winner: null },
        { high: teams[1], low: teams[6], winner: null },
        { high: teams[2], low: teams[5], winner: null },
        { high: teams[3], low: teams[4], winner: null },
      ],
      [null, null],
      [null],
      [null],  // 总决赛 (第3轮)
    ],
    currentRound: 0,
    results: [],
    confChampion: null,
  };
}

/** 自动模拟整个分区的季后赛（用于另一分区） */
function autoSimConferenceBracket(confBracket) {
  if (!confBracket) return;
  const bracketOrder = [0, 7, 1, 6, 2, 5, 3, 4];
  let roundTeams = bracketOrder.map(i => confBracket.teams[i]?.team).filter(Boolean);
  
  for (let r = 0; r < 3; r++) {
    const pairs = [];
    for (let i = 0; i < roundTeams.length; i += 2) {
      if (i + 1 >= roundTeams.length) { pairs.push([roundTeams[i], null]); break; }
      pairs.push([roundTeams[i], roundTeams[i + 1]]);
    }
    const winners = [];
    pairs.forEach(([tA, tB], idx) => {
      if (!tB) { winners.push(tA); return; }
      const pA = calcTeamPowerWithPlayer(tA);
      const pB = calcTeamPowerWithPlayer(tB);
      let wA = 0, wB = 0;
      const sGames = [];
      // ★ 首轮根据种子排名计算 seedBonus
      let sb = 0;
      if (r === 0) {
        const seedIdxA = bracketOrder[idx * 2];
        const seedIdxB = bracketOrder[idx * 2 + 1];
        const gapSeed = Math.abs(seedIdxA - seedIdxB);
        sb = 0.4 * gapSeed;
        sb = seedIdxA < seedIdxB ? sb : -sb;
      }
      for (let g = 0; g < 7 && wA < 4 && wB < 4; g++) {
        const gr = simulateGameNew(tA, tB, sb);
        if (gr.won) wA++; else wB++;
        sGames.push({ myScore: gr.scoreA, oppScore: gr.scoreB, won: gr.won, home: g < 4, qScoresA: gr.qScoresA, qScoresB: gr.qScoresB, boxScore: gr.boxScore });
      }
      const sWinner = wA >= 4 ? tA : tB;
      winners.push(sWinner);
      
      // 存储结果
      if (confBracket.rounds[r]) {
        const seriesIdx = idx;
        if (!confBracket.rounds[r][seriesIdx]) {
          confBracket.rounds[r][seriesIdx] = { high: null, low: null, winner: null };
        }
        const s = confBracket.rounds[r][seriesIdx];
        if (r === 0) {
          const orderIdx = idx * 2;
          s.high = confBracket.teams[bracketOrder[orderIdx]];
          s.low = confBracket.teams[bracketOrder[orderIdx + 1]];
        } else {
          s.high = { team: tA };
          s.low = { team: tB };
        }
        s.winner = sWinner;
      }
      
      confBracket.results.push({
        round: r, seriesIdx: idx,
        roundName: ['首轮', '分区半决赛', '分区决赛'][r],
        teamA: tA, teamB: tB,
        winner: sWinner,
        winnerWins: wA >= 4 ? wA : wB,
        loserWins: wA >= 4 ? wB : wA,
        aWon: wA >= 4,
        seriesGames: sGames,
        isMySeries: false,
      });
      
      // 更新下一轮槽位（NBA标准：1v8胜者vs4v5胜者，2v7胜者vs3v6胜者）
      if (r < 2) {
        const nr = confBracket.rounds[r + 1];
        if (nr) {
          var ni, isHigh;
          if (r === 0) {
            ni = (idx === 0 || idx === 3) ? 0 : 1;
            isHigh = (idx === 0 || idx === 1);
          } else {
            ni = 0;
            isHigh = idx === 0;
          }
          if (!nr[ni]) nr[ni] = { high: null, low: null, winner: null };
          if (isHigh) nr[ni].high = { team: sWinner };
          else nr[ni].low = { team: sWinner };
        }
      }
    });
    roundTeams = winners;
  }
  confBracket.confChampion = roundTeams[0] || null;
  confBracket.currentRound = 3;
}

function renderPlayoffs() {
  STATE.season.isPlayoffs = true;
  trackEvent({act:"click",blk:"BMC098",pos:"TC10",label:"进入季后赛"});
  showScreen('screen-playoffs');
  
  // 安全检查
  if (!STATE.season || !STATE.careerTeam) {
    showScreen('screen-season');
    return;
  }
  
  // ★ 附加赛检测：种子7-10且附加赛未完成 → 初始化附加赛
  const seed = getConferenceSeed(STATE.careerTeam);
  let pi = STATE.season.playInState;
  const playInNeeded = seed >= 7 && seed <= 10;
  const playInComplete = pi?.playoffSeed != null && !pi?.isEliminated;
  const playInEliminated = pi?.isEliminated;
  
  if (playInNeeded && !playInComplete && !playInEliminated && (!pi || !pi.seed7)) {
    // 初始化附加赛状态
    const conf = getConference(STATE.careerTeam);
    const sorted = getConferenceSorted(conf);
    const playInTeams = sorted.filter(t => {
      const s = getConferenceSeed(t.team);
      return s >= 7 && s <= 10;
    });
    const seed7 = playInTeams.find(t => getConferenceSeed(t.team) === 7);
    const seed8 = playInTeams.find(t => getConferenceSeed(t.team) === 8);
    const seed9 = playInTeams.find(t => getConferenceSeed(t.team) === 9);
    const seed10 = playInTeams.find(t => getConferenceSeed(t.team) === 10);
    
    STATE.season.playInState = {
      seed7, seed8, seed9, seed10,
      gameAResult: null, gameBResult: null, gameCResult: null,
      isEliminated: false, playoffSeed: null,
    };
    pi = STATE.season.playInState;
  }
  
  // 季后赛流程
  const pi2 = STATE.season.playInState;
  const mySeed = pi2?.playoffSeed || seed;
  const conf = getConference(STATE.careerTeam);
  
  // ★ 附加赛结果修正种子：用附加赛晋级者替换原7/8号种子
  const bracket = buildPlayoffBracket(conf, pi2);
  const otherConf = conf === 'EAST' ? 'WEST' : 'EAST';
  const otherBracket = buildPlayoffBracket(otherConf);
  
  // 自动模拟另一分区的季后赛（用户不能操作）
  autoSimConferenceBracket(otherBracket);
  
  STATE.season.playoffBracket = bracket;
  STATE.season.otherBracket = otherBracket;
  STATE.season.playoffSeed = mySeed;
  STATE.season._viewConf = conf;
  
  renderPlayoffBracketUI();
}

function renderPlayoffBracketUI() {
  const bracket = STATE.season?.playoffBracket;
  if (!bracket) { renderPlayoffs(); return; }
  
  const mySeed = STATE.season.playoffSeed || getConferenceSeed(STATE.careerTeam);
  const viewConf = STATE.season._viewConf || bracket.conf;
  const isViewingOther = viewConf !== bracket.conf;
  
  if (STATE.season.isChampion) return;
  
  // 选择要显示的分区对阵数据
  const activeBracket = isViewingOther ? STATE.season.otherBracket : bracket;
  if (!activeBracket) return;
  const confName = activeBracket.conf === 'EAST' ? '东部' : '西部';
  
  // 收集所有轮次数据（含总决赛作为第4轮，附加赛作为第0轮）
  const allRoundData = [];
  const roundNames = [];
  
  // ★ 附加赛作为第0轮（如果经历过附加赛）
  const pi = STATE.season.playInState;
  const hasPlayIn = pi && pi.seed7 && !isViewingOther;
  const piCompleted = pi?.playoffSeed != null && !pi?.isEliminated;
  if (hasPlayIn) {
    const playInEntries = [];
    const myTeam = STATE.careerTeam;
    
    // Game A: 7 vs 8
    if (pi.seed7 && pi.seed8) {
      const gA = pi.gameAResult;
      playInEntries.push({
        series: {
          high: { team: pi.seed7.team, seed: 7 },
          low: { team: pi.seed8.team, seed: 8 },
          winner: gA?.winner || null,
        },
        idx: 0, isMySeries: myTeam === pi.seed7.team || myTeam === pi.seed8.team,
        isComplete: !!gA, res: gA ? { winnerWins: 1, loserWins: 0, winner: gA.winner, loser: gA.loser } : null,
        r: -1, isPlayIn: true, label: '7vs8',
      });
    }
    
    // Game B: 9 vs 10
    if (pi.seed9 && pi.seed10) {
      const gB = pi.gameBResult;
      playInEntries.push({
        series: {
          high: { team: pi.seed9.team, seed: 9 },
          low: { team: pi.seed10.team, seed: 10 },
          winner: gB?.winner || null,
        },
        idx: 1, isMySeries: myTeam === pi.seed9.team || myTeam === pi.seed10.team,
        isComplete: !!gB, res: gB ? { winnerWins: 1, loserWins: 0, winner: gB.winner, loser: gB.loser } : null,
        r: -1, isPlayIn: true, label: '9vs10',
      });
    }
    
    // Game C: 败者组决赛
    if (pi.gameAResult && pi.gameBResult) {
      const gC = pi.gameCResult;
      const teamA = pi.gameAResult.loser;
      const teamB = pi.gameBResult.winner;
      playInEntries.push({
        series: {
          high: { team: teamA, seed: 0 },
          low: { team: teamB, seed: 0 },
          winner: gC?.winner || null,
        },
        idx: 2, isMySeries: myTeam === teamA || myTeam === teamB,
        isComplete: !!gC, res: gC ? { winnerWins: 1, loserWins: 0, winner: gC.winner, loser: gC.loser } : null,
        r: -1, isPlayIn: true, label: '败者组',
      });
    }
    
    if (playInEntries.length > 0) {
      allRoundData.push(playInEntries);
      roundNames.push('附加赛');
    }
  }
  
  roundNames.push('首轮', '分区半决赛', '分区决赛', '总决赛');
  
  for (let r = 0; r <= 3; r++) {
    const seriesList = activeBracket.rounds[r];
    if (!seriesList) break;
    const entries = [];
    let hasAny = false;
    seriesList.forEach((series, idx) => {
      if (!series) { entries.push(null); return; }
      hasAny = true;
      const isMySeries = series.high?.team === STATE.careerTeam || series.low?.team === STATE.careerTeam;
      const isComplete = !!series.winner;
      const res = activeBracket.results.find(rr => rr.round === r && rr.seriesIdx === idx);
      entries.push({ series, idx, isMySeries, isComplete, res, r });
    });
    if (!hasAny) break;
    allRoundData.push(entries);
  }
  
  // 当前轮次（默认为第一轮或最近未完成的轮次）
  if (STATE.season._playoffRound === undefined) {
    STATE.season._playoffRound = 0;
    // 附加赛已晋级 → 直接跳到第一轮
    if (piCompleted) STATE.season._playoffRound = allRoundData.length > 1 ? 1 : 0;
    else {
      // 找到第一个有未完成系列赛的轮次
      for (let i = 0; i < allRoundData.length; i++) {
        const hasActive = allRoundData[i].some(e => e && !e.isComplete && e.isMySeries);
        if (hasActive) { STATE.season._playoffRound = i; break; }
      }
    }
  }
  // ★ 附加赛刚打完 → 自动跳到首轮
  if (STATE.season._playoffRound === 0 && hasPlayIn && piCompleted && allRoundData.length > 1) {
    const piRoundAllDone = allRoundData[0].every(e => e && e.isComplete);
    if (piRoundAllDone) STATE.season._playoffRound = 1;
  }
  const curRound = Math.min(STATE.season._playoffRound, allRoundData.length - 1);
  
  let h = `<div class="bv-wrap">`;
  
  // ===== 分区切换标签 =====
  const myConfName = bracket.conf === 'EAST' ? '东部' : '西部';
  const otherConfName = bracket.conf === 'EAST' ? '西部' : '东部';
  h += `<div class="bv-conf-tabs">
    <button class="bv-conf-tab ${!isViewingOther ? 'bv-conf-tab-active' : ''}" onclick="switchPlayoffConf('${bracket.conf}')">🏀 ${myConfName}</button>
    <button class="bv-conf-tab ${isViewingOther ? 'bv-conf-tab-active' : ''}" onclick="switchPlayoffConf('${bracket.conf === 'EAST' ? 'WEST' : 'EAST'}')">🏀 ${otherConfName}</button>
  </div>`;
  
  // ===== 轮次导航 =====
  h += `<div class="bv-round-nav">
    <button class="bv-round-arrow" onclick="navigatePlayoffRound(-1)" ${curRound <= 0 ? 'disabled' : ''}>◀</button>
    <div class="bv-round-title">${roundNames[curRound] || '第'+(curRound+1)+'轮'}</div>
    <button class="bv-round-arrow" onclick="navigatePlayoffRound(1)" ${curRound >= allRoundData.length - 1 ? 'disabled' : ''}>▶</button>
  </div>`;
  
  // 头部信息
  var isFinals = roundNames[curRound] === '总决赛';
  h += `<div class="bv-header">
    <div class="bv-header-title">${isFinals ? '🏆 NBA总决赛' : (confName + ' 季后赛')}</div>
    <div class="bv-header-sub">${!isViewingOther ? (isFinals ? '总决赛' : `${getTeamName(STATE.careerTeam)} · 第${mySeed}种子`) : ''}</div>
  </div>`;
  
  // ===== 当前轮次内容 =====
  const entries = allRoundData[curRound] || [];
  const isPlayInRound = entries[0]?.isPlayIn;
  
  if (isPlayInRound) {
    // 附加赛单场渲染
    h += `<div class="bv-round-content" style="gap:10px;">`;
    entries.forEach((entry) => {
      if (!entry) return;
      const { series, isComplete, res, label } = entry;
      const highTeam = series.high?.team;
      const lowTeam = series.low?.team;
      const wTeam = series.winner;
      
      h += `<div class="bv-series">
        <div style="font-size:11px;color:var(--text-dim);padding:4px 0 2px;text-align:center;letter-spacing:0.5px;">🏀 ${label}</div>`;
      
      if (isComplete && res) {
        h += `<div class="bv-s-matchup" style="cursor:default;">
          <div class="bv-s-team ${wTeam === highTeam ? 'bv-winner' : 'bv-loser'}${highTeam === STATE.careerTeam ? ' bv-s-gold' : ''}"><span class="bv-s-name">${getTeamLogo(highTeam, 16)} ${getTeamName(highTeam)}</span>${wTeam === highTeam ? '<span style="font-size:11px;color:var(--green);margin-left:4px;">W</span>' : ''}</div>
          <div class="bv-s-team ${wTeam === lowTeam ? 'bv-winner' : 'bv-loser'}${lowTeam === STATE.careerTeam ? ' bv-s-gold' : ''}"><span class="bv-s-name">${getTeamLogo(lowTeam, 16)} ${getTeamName(lowTeam)}</span>${wTeam === lowTeam ? '<span style="font-size:11px;color:var(--green);margin-left:4px;">W</span>' : ''}</div>
        </div>`;
        if (highTeam === STATE.careerTeam && wTeam === highTeam) {
          h += `<div style="text-align:center;font-size:12px;color:var(--gold);font-weight:700;padding:2px 0;">🎉 晋级！</div>`;
        } else if (lowTeam === STATE.careerTeam && wTeam === lowTeam) {
          h += `<div style="text-align:center;font-size:12px;color:var(--gold);font-weight:700;padding:2px 0;">🎉 晋级！</div>`;
        } else if (highTeam === STATE.careerTeam || lowTeam === STATE.careerTeam) {
          h += `<div style="text-align:center;font-size:12px;color:var(--red);padding:2px 0;">❌ 淘汰</div>`;
        }
      } else {
        h += `<div class="bv-s-matchup" style="cursor:default;">
          <div class="bv-s-team ${highTeam === STATE.careerTeam ? 'bv-s-gold' : ''}"><span class="bv-s-name">${getTeamLogo(highTeam, 16)} ${getTeamName(highTeam)}</span></div>
          <div style="text-align:center;font-size:13px;font-weight:700;color:var(--text-dim);padding:4px 0;">VS</div>
          <div class="bv-s-team ${lowTeam === STATE.careerTeam ? 'bv-s-gold' : ''}"><span class="bv-s-name">${getTeamLogo(lowTeam, 16)} ${getTeamName(lowTeam)}</span></div>
        </div>`;
        // 根据label决定模拟哪场
        const gameId = label === '7vs8' ? 'A' : (label === '9vs10' ? 'B' : 'C');
        h += `<button class="bv-s-btn" onclick="simPlayInGame('${gameId}')" style="margin-top:6px;">▶ 模拟${label}</button>`;
      }
      
      h += `</div>`;
    });
    h += `</div>`;
  } else {
    // 常规轮次渲染（单轮）
    h += `<div class="bv-round-content">`;
    entries.forEach((entry) => {
      if (!entry) { h += `<div class="bv-spacer"></div>`; return; }
      const { series, idx, isMySeries, isComplete, res, r } = entry;
      const teamA = series.high?.team;
      const teamB = series.low?.team;
      const wTeam = series.winner;
      
      // 按种子排序：小种子（更优）在上面
      const seedA = getSeedOf(activeBracket.teams, teamA);
      const seedB = getSeedOf(activeBracket.teams, teamB);
      const topTeam = seedA <= seedB ? teamA : teamB;
      const botTeam = seedA <= seedB ? teamB : teamA;
      const topSeed = seedA <= seedB ? seedA : seedB;
      const botSeed = seedA <= seedB ? seedB : seedA;
      const topIsWinner = wTeam === topTeam;
      const botIsWinner = wTeam === botTeam;
      
      const isOtherConf = isViewingOther;
      const sClass = isOtherConf ? ' bv-series-other' : '';
      h += `<div class="bv-series${sClass}">`;
      
      if (isComplete && res) {
        const tScore = topIsWinner ? res.winnerWins : res.loserWins;
        const bScore = topIsWinner ? res.loserWins : res.winnerWins;
        h += `<div class="bv-s-matchup" style="cursor:default;">
          <div class="bv-s-team ${topIsWinner ? 'bv-winner' : 'bv-loser'}${topTeam === STATE.careerTeam ? ' bv-s-gold' : ''}"><span class="bv-seed ${topIsWinner ? 'bv-seed-w' : ''}">${topSeed}</span><span class="bv-s-name">${getTeamLogo(topTeam, 16)} ${getTeamName(topTeam)}</span><span class="bv-s-score ${topIsWinner ? 'bv-sc-w' : ''}">${tScore}</span></div>
          <div class="bv-s-team ${topIsWinner ? 'bv-loser' : 'bv-winner'}${botTeam === STATE.careerTeam ? ' bv-s-gold' : ''}"><span class="bv-seed ${topIsWinner ? '' : 'bv-seed-w'}">${botSeed}</span><span class="bv-s-name">${getTeamLogo(botTeam, 16)} ${getTeamName(botTeam)}</span><span class="bv-s-score ${topIsWinner ? '' : 'bv-sc-w'}">${bScore}</span></div>
        </div>`;
      } else if (isMySeries && !isOtherConf) {
        const opp = STATE.careerTeam === topTeam ? botTeam : topTeam;
        h += `<div class="bv-s-matchup" style="cursor:default;">
          <div class="bv-s-team bv-w bv-s-user bv-s-gold"><span class="bv-seed bv-seed-my">${getSeedOf(activeBracket.teams, STATE.careerTeam)}</span><span class="bv-s-name">${getTeamLogo(STATE.careerTeam, 16)} ${getTeamName(STATE.careerTeam)}</span><span class="bv-s-badge">你</span></div>
          <div class="bv-s-team bv-l"><span class="bv-seed">${getSeedOf(activeBracket.teams, opp)}</span><span class="bv-s-name">${getTeamLogo(opp, 16)} ${getTeamName(opp)}</span></div>
        </div>`;
        h += `<button class="bv-s-btn" onclick="this.disabled=true;simPlayoffSeries(${r}, ${idx})">${r === 2 ? '🏆 开始分区决赛' : r === 3 ? '🏆 开始总决赛' : '▶ 开始系列赛'}</button>`;
      } else {
        h += `<div class="bv-s-matchup" style="cursor:default;">
          <div class="bv-s-team ${isComplete ? (topIsWinner ? 'bv-winner' : 'bv-loser') : ''}${topTeam === STATE.careerTeam ? ' bv-s-gold' : ''}"><span class="bv-seed ${isComplete ? (topIsWinner ? 'bv-seed-w' : '') : ''}">${topSeed}</span><span class="bv-s-name">${getTeamLogo(topTeam, 16)} ${getTeamName(topTeam)}</span>${isComplete ? `<span class="bv-s-score ${topIsWinner ? 'bv-sc-w' : ''}">${res ? (topIsWinner ? res.winnerWins : res.loserWins) : ''}</span>` : ''}</div>
          <div class="bv-s-team bv-l ${isComplete ? (topIsWinner ? 'bv-loser' : 'bv-winner') : ''}${botTeam === STATE.careerTeam ? ' bv-s-gold' : ''}"><span class="bv-seed ${isComplete ? (topIsWinner ? '' : 'bv-seed-w') : ''}">${botSeed}</span><span class="bv-s-name">${getTeamLogo(botTeam, 16)} ${getTeamName(botTeam)}</span>${isComplete ? `<span class="bv-s-score ${topIsWinner ? '' : 'bv-sc-w'}">${res ? (topIsWinner ? res.loserWins : res.winnerWins) : ''}</span>` : ''}</div>
        </div>`;
      }
      h += `</div>`;
    });
    h += `</div>`;
  }
  
  // 底部按钮
  h += `<div class="bv-actions">
    ${!isViewingOther && (STATE.season.playoffEliminated || pi?.isEliminated) ? `<button class="btn btn-primary btn-sm" onclick="showSeasonResults()">📊 查看赛季总结</button>` : ''}
  </div>`;
  
  // gamecast（放在 bv-po-stats 上方）
  h += `<div id="playoff-gamecast" style="display:none;padding:0 12px 8px;"></div>`;

  // 季后赛场均数据
  if (!isViewingOther) {
    const po = STATE.season.playoffStats;
    if (po.games > 0) {
      const poG = po.games;
      h += `<div class="bv-po-stats">
        <div class="bv-po-title">📊 季后赛场均</div>
        <div class="bv-po-grid">
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.pts/poG*10)/10}</span><span class="bv-po-lbl">得分</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.reb/poG*10)/10}</span><span class="bv-po-lbl">篮板</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.ast/poG*10)/10}</span><span class="bv-po-lbl">助攻</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.stl/poG*10)/10}</span><span class="bv-po-lbl">抢断</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.blk/poG*10)/10}</span><span class="bv-po-lbl">盖帽</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.tov/poG*10)/10}</span><span class="bv-po-lbl">失误</span></div>
        </div>
        <div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:4px;">
          出战 ${poG} 场 · 命中 ${Math.round(po.fgm/poG*10)/10}-${Math.round(po.fga/poG*10)/10} (${po.fga>0?Math.round(po.fgm/po.fga*100):0}%)
        </div>
      </div>`;
    }
  }
  
  h += `</div>`;
  document.getElementById('playoffs-area').innerHTML = h;
}

/** 切换轮次 */
function navigatePlayoffRound(dir) {
  
  // 动态计算总轮数（含附加赛）
  const pi = STATE.season.playInState;
  const viewConf = STATE.season._viewConf;
  const myConf = STATE.season.playoffBracket?.conf;
  const isViewingOther = viewConf && viewConf !== myConf;
  const hasPlayIn = !!(pi && pi.seed7 && !isViewingOther);
  const totalRounds = 4 + (hasPlayIn ? 1 : 0);
  const next = (STATE.season._playoffRound || 0) + dir;
  if (next < 0 || next >= totalRounds) return;
  STATE.season._playoffRound = next;
  renderPlayoffBracketUI();
}

/** 切换查看的分区 */
function switchPlayoffConf(conf) {
  
  STATE.season._viewConf = conf;
  renderPlayoffBracketUI();
}

/** 通过索引查找系列赛结果并弹窗 */
function showSeriesResultByIdx(round, seriesIdx, source) {
  // 已取消弹窗，改用页面刷新
  renderPlayoffBracketUI();
}

/** 获取球队在季后赛球队数组中的种子号 */
function getSeedOf(teams, team) {
  if (!teams || !team) return '?';
  const idx = teams.findIndex(t => t.team === team);
  return idx >= 0 ? (idx + 1) : '?';
}

/** 比赛单场简报卡片（用于一场一场弹） */
function renderPlayoffGameBrief(gameEntry, teamA, teamB, isMySeries, roundName, gameNum, totalNum, round, seriesIdx) {
  const gcContainer = document.getElementById('playoff-gamecast');
  if (!gcContainer) return;
  
  gcContainer.style.display = 'block';
  const isUserA = teamA === STATE.careerTeam;
  const myScore = isUserA ? gameEntry.myScore : gameEntry.oppScore;
  const oppScore = isUserA ? gameEntry.oppScore : gameEntry.myScore;
  const oppName = isUserA ? teamB : teamA;
  const stats = gameEntry.myStats;
  
  let statsLine = '';
  if (stats) {
    const pct = stats.fga > 0 ? Math.round(stats.fgm / stats.fga * 100) : 0;
    statsLine = `<div style="font-size:9px;color:var(--text-dim);margin-top:2px;">${stats.pts}分 ${stats.reb}板 ${stats.ast}助 · ${stats.fgm}-${stats.fga} (${pct}%)</div>`;
  }
  
  const brief = document.createElement('div');
  brief.style.cssText = `
    display:flex;align-items:center;gap:8px;
    padding:8px 12px;margin-bottom:6px;
    background:var(--bg-card);border:1.5px solid ${gameEntry.suspended ? '#000' : (gameEntry.won ? 'var(--green)' : 'var(--red)')};
    border-radius:10px;animation:slideUp 0.2s ease;cursor:pointer;
  `;
  brief.innerHTML = `
    <span style="font-size:13px;">${gameEntry.won ? '✅' : '❌'}</span>
    <span style="font-family:var(--font-display);font-size:12px;font-weight:700;min-width:36px;">G${gameEntry.game}</span>
    <span style="font-family:var(--font-display);font-size:14px;font-weight:700;color:${gameEntry.suspended ? '#000' : (gameEntry.won ? 'var(--green)' : 'var(--red)')};">${myScore}-${oppScore}</span>
    <span style="font-size:10px;color:var(--text-dim);flex:1;">G${gameEntry.game} vs ${getTeamName(oppName)}${gameEntry.ot ? ' · '+(gameEntry.ot>1?gameEntry.ot+'OT':'OT') : ''}${gameEntry.suspended ? (gameEntry.skipReason === 'injury' ? ' · 🏥 伤病' : ' · 🔇 禁赛') : ''}${gameEntry.playedThroughInjury ? ' · 🏥 带伤出战' : ''}</span>
    ${gameEntry.suspended ? '' : statsLine}
    <span style="font-size:16px;color:var(--text-muted);">›</span>
  `;
  // 点击查看详情
  brief.onclick = () => showPlayoffGamePopup(round, seriesIdx, gameEntry.game - 1);
  
  gcContainer.prepend(brief);
  
  // 最多保留5条简报
  while (gcContainer.children.length > 5) {
    gcContainer.removeChild(gcContainer.lastChild);
  }
}

/** 清空季后赛比赛简报 */
function clearPlayoffGamecast() {
  const gc = document.getElementById('playoff-gamecast');
  if (gc) { gc.innerHTML = ''; gc.style.display = 'none'; }
}

/** 单场模拟并更新简报（递归，一场一场模拟） */
function simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum, winsA, winsB, seriesGames, userGameStats, roundName, onDone) {
  if (winsA >= 4 || winsB >= 4 || gameNum >= 7) {
    onDone(winsA, winsB, seriesGames, userGameStats);
    return;
  }
  
  // ★ 种子保护（概率层面）：高顺位种子获得 netRating 加成
  const bracket = STATE.season.playoffBracket;
  const series = bracket?.rounds[round]?.[seriesIdx];
  const highSeed = series?.high?.team;
  const isHighA = highSeed && teamA === highSeed;
  
  let seedBonus = 0;
  // ★ 用户系列赛同样保留高顺位种子保护
  if (highSeed) {
    const conf = getConference(highSeed);
    const sorted = getConferenceSorted(conf);
    const highRank = sorted.findIndex(t => t.team === highSeed);
    const lowTeam = isHighA ? teamB : teamA;
    const lowRank = sorted.findIndex(t => t.team === lowTeam);
    const gap = Math.max(1, Math.min(8, Math.abs(highRank - lowRank)));
    seedBonus = 0.4 * gap; // gap 1→+0.4, gap 8→+3.2
    seedBonus = isHighA ? seedBonus : -seedBonus;
  }
  
  const userDebuff = 1.0;
  
  // ★ 跳过检查（禁赛优先于伤病）
  const skipEv = STATE.season.events;
  var skipReason = null;
  if (skipEv && skipEv.suspensionGamesLeft > 0) skipReason = 'suspension';
  else if (skipEv && skipEv.injuryGamesLeft > 0) skipReason = 'injury';
  if (skipReason) {
    var runSkippedPlayoffGame = function() {
      if (skipReason === 'suspension') skipEv.suspensionGamesLeft--;
      else skipEv.injuryGamesLeft--;
      var skipResult = simulateGameNew(teamA, teamB, seedBonus, userDebuff);
      const skipWon = skipResult.won;
      const skipNewWinsA = winsA + (skipWon ? 1 : 0);
      const skipNewWinsB = winsB + (skipWon ? 0 : 1);
      const skipEntry = {
        game: gameNum + 1, myScore: skipResult.scoreA, oppScore: skipResult.scoreB,
        won: skipWon, home: gameNum < 4,
        qScoresA: skipResult.qScoresA, qScoresB: skipResult.qScoresB,
        keyEvents: skipResult.keyEvents, ot: skipResult.ot,
        boxScore: skipResult.boxScore,
        suspended: true,
        skipReason: skipReason,
      };
      if (isMySeries) {
        renderPlayoffGameBrief(skipEntry, teamA, teamB, true, roundName, gameNum + 1, 7, round, seriesIdx);
      }
      seriesGames.push(skipEntry);
      setTimeout(function() {
        simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum + 1, skipNewWinsA, skipNewWinsB, seriesGames, userGameStats, roundName, onDone);
      }, isMySeries ? 600 : 50);
    };
    var runPlayedThroughPlayoffGame = function(severity) {
      skipEv.injuryGamesLeft = Math.max(0, (skipEv.injuryGamesLeft || 0) - 1);
      var hurtResult = simulateGameNew(teamA, teamB, seedBonus, getInjuryPlayWinMultiplier(severity));
      const hurtWon = hurtResult.won;
      const hurtNewWinsA = winsA + (hurtWon ? 1 : 0);
      const hurtNewWinsB = winsB + (hurtWon ? 0 : 1);
      const hurtStats = scaleHurtStats(generatePlayerStatsNew(buildHurtAttrs(STATE.attrs, severity), hurtResult, true), severity);
      userGameStats.push(hurtStats);
      const poH = STATE.season.playoffStats;
      poH.pts += hurtStats.pts; poH.reb += hurtStats.reb; poH.ast += hurtStats.ast;
      poH.stl += hurtStats.stl; poH.blk += hurtStats.blk; poH.tov += hurtStats.tov;
      poH.fgm += hurtStats.fgm; poH.fga += hurtStats.fga;
      poH.ftm += hurtStats.ftm; poH.fta += hurtStats.fta;
      poH.threeM += hurtStats.threeM; poH.threeA += hurtStats.threeA;
      poH.mins = (poH.mins || 0) + hurtStats.mins;
      poH.games++;
      const hurtEntry = {
        game: gameNum + 1, myScore: hurtResult.scoreA, oppScore: hurtResult.scoreB,
        won: hurtWon, home: gameNum < 4,
        qScoresA: hurtResult.qScoresA, qScoresB: hurtResult.qScoresB,
        keyEvents: hurtResult.keyEvents, ot: hurtResult.ot,
        boxScore: hurtResult.boxScore,
        myStats: hurtStats,
        playedThroughInjury: true,
        injuryReason: skipEv.injuryReason || '伤病',
      };
      seriesGames.push(hurtEntry);
      renderPlayoffGameBrief(hurtEntry, teamA, teamB, true, roundName, gameNum + 1, 7, round, seriesIdx);
      maybeWorsenInjuryAfterPlaying(skipEv, severity);
      setTimeout(function() {
        simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum + 1, hurtNewWinsA, hurtNewWinsB, seriesGames, userGameStats, roundName, onDone);
      }, 600);
    };
    if (isMySeries && skipReason === 'injury' && shouldOfferPlayThroughInjury('po-season', false)) {
      showPlayThroughInjuryModal({
        desc: roundName + ' G' + (gameNum + 1) + ' 前，你仍在伤病名单里，系列赛比分是 ' + winsA + '-' + winsB + '。教练组把最终决定交给你。'
      }, runSkippedPlayoffGame, runPlayedThroughPlayoffGame);
      return;
    }
    runSkippedPlayoffGame();
    return;
  }
  
  var finishPlayoffGame = function (pack) {
    var gameResult = pack.result;
    var finalA = gameResult.scoreA;
    var finalB = gameResult.scoreB;
    var won = gameResult.won;
    var newWinsA = winsA + (won ? 1 : 0);
    var newWinsB = winsB + (won ? 0 : 1);
    var isHome = gameNum < 4;
    var gameEntry = {
      game: gameNum + 1, myScore: finalA, oppScore: finalB,
      won: won, home: isHome,
      qScoresA: gameResult.qScoresA, qScoresB: gameResult.qScoresB,
      keyEvents: gameResult.keyEvents, ot: gameResult.ot,
      boxScore: gameResult.boxScore,
      liveSim: !!gameResult.liveSim
    };
    if (isMySeries) {
      var stats = pack.stats;
      gameEntry.myStats = stats;
      userGameStats.push(stats);
      var po = STATE.season.playoffStats;
      po.pts += stats.pts; po.reb += stats.reb; po.ast += stats.ast;
      po.stl += stats.stl; po.blk += stats.blk; po.tov += stats.tov;
      po.fgm += stats.fgm; po.fga += stats.fga;
      po.ftm += stats.ftm; po.fta += stats.fta;
      po.threeM += stats.threeM; po.threeA += stats.threeA;
      po.mins = (po.mins || 0) + stats.mins;
      po.games++;
      renderPlayoffGameBrief(gameEntry, teamA, teamB, true, roundName, gameNum + 1, 7, round, seriesIdx);
    }
    seriesGames.push(gameEntry);
    setTimeout(function() {
      if (isMySeries) {
        try {
          var poEvData = checkRandomEvents({ opponent: teamB, isWin: won, day: 0, simulated: true }, { won: won, scoreA: finalA, scoreB: finalB }, gameEntry.myStats || null);
          if (poEvData) {
            if (poEvData._consequence === 'suspension') {
              STATE.season.events.suspensionReason = poEvData.desc;
            } else if (poEvData._consequence === 'injury') {
              STATE.season.events.injuryReason = poEvData.desc;
            }
            if (typeof showEventModal === 'function') {
              showEventModal(poEvData, function() {
                setTimeout(function() {
                  simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum + 1, newWinsA, newWinsB, seriesGames, userGameStats, roundName, onDone);
                }, 600);
              });
              return;
            }
          }
        } catch(ex) {}
      }
      simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum + 1, newWinsA, newWinsB, seriesGames, userGameStats, roundName, onDone);
    }, isMySeries ? 600 : 50);
  };

  if (isMySeries) {
    liveOrSkipUserPack(teamB, {
      isPlayoff: true,
      seedBonus: seedBonus,
      probMultiplier: userDebuff,
      teamAHome: gameNum < 4,
      title: roundName + ' G' + (gameNum + 1),
      reason: roundName + ' 第' + (gameNum + 1) + '场，系列赛 ' + winsA + '-' + winsB + '。对阵 ' + getTeamName(teamB) + '。'
    }, finishPlayoffGame);
    return;
  }
  finishPlayoffGame({ result: simulateGameNew(teamA, teamB, seedBonus, userDebuff), stats: null, live: null });
}

/** 主要入口：模拟季后赛系列赛（用户系列赛一场一场弹） */
function simPlayoffSeries(round, seriesIdx) {
  trackEvent({act:"click",blk:"BMC098",pos:"TC12",label:"开始系列赛"});
  const bracket = STATE.season.playoffBracket;
  if (!bracket) return;
  
  const series = bracket.rounds[round]?.[seriesIdx];
  if (!series || series.winner) return;
  
  const isMySeries = series.high?.team === STATE.careerTeam || series.low?.team === STATE.careerTeam;
  if (isMySeries && STATE.season) STATE.season._skipLiveSeries = false;
  
  let teamA, teamB;
  if (isMySeries) {
    teamA = STATE.careerTeam;
    teamB = series.high?.team === teamA ? series.low?.team : series.high?.team;
  } else {
    teamA = series.high?.team;
    teamB = series.low?.team;
  }
  
  const roundName = ['首轮', '分区半决赛', '分区决赛'][round] || '第'+(round+1)+'轮';
  
  // 清空旧简报，开始新的系列赛
  clearPlayoffGamecast();
  
  if (isMySeries) {
    // 显示"开始"提示
    const gc = document.getElementById('playoff-gamecast');
    if (gc) {
      gc.style.display = 'block';
      gc.innerHTML = `<div style="font-size:11px;color:var(--orange);padding:4px 0;font-family:var(--font-display);">🏀 ${roundName} · ${getTeamName(teamA)} vs ${getTeamName(teamB)} 开始</div>`;
    }
  }
  
  // 用递归一场一场模拟
  simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, 0, 0, 0, [], [], roundName, (winsA, winsB, seriesGames, userGameStats) => {
    // ===== 系列赛结束 =====
    const aWon = winsA >= 4;
    const winner = aWon ? teamA : teamB;
    const winnerWins = aWon ? winsA : winsB;
    const loserWins = aWon ? winsB : winsA;
    series.winner = winner;
    
    const result = {
      round, seriesIdx, roundName,
      teamA, teamB, winner, winnerWins, loserWins,
      winsA, winsB, aWon, seriesGames, isMySeries,
    };
    bracket.results.push(result);
    
    // 更新下一轮对阵（NBA标准：1v8胜者vs4v5胜者，2v7胜者vs3v6胜者）
    if (round < 2) {
      const nextRound = bracket.rounds[round + 1];
      if (nextRound) {
        var nextIdx, isHigh;
        if (round === 0) {
          nextIdx = (seriesIdx === 0 || seriesIdx === 3) ? 0 : 1;
          isHigh = (seriesIdx === 0 || seriesIdx === 1);
        } else {
          nextIdx = 0;
          isHigh = seriesIdx === 0;
        }
        if (nextRound[nextIdx] === null) nextRound[nextIdx] = { high: null, low: null, winner: null };
        if (isHigh) nextRound[nextIdx].high = { team: winner };
        else nextRound[nextIdx].low = { team: winner };
      }
    } else if (round === 2) {
      bracket.confChampion = winner;
    }
    
    // ★ 自动模拟同轮其他系列赛（使用完整引擎，快速）
    const mySeriesIdx = seriesIdx;
    const otherSeries = bracket.rounds[round]
      .map((s, i) => ({ series: s, idx: i }))
      .filter(({ series: s, idx }) => s && !s.winner && idx !== mySeriesIdx);
    
    for (const { series: s, idx } of otherSeries) {
      const sTeamA = s.high?.team;
      const sTeamB = s.low?.team;
      if (!sTeamA || !sTeamB) continue;
      
      // ★ 首轮根据种子排名计算 seedBonus
      let sb = 0;
      if (round === 0) {
        const highIdx = bracket.teams.findIndex(t => t.team === sTeamA);
        const lowIdx = bracket.teams.findIndex(t => t.team === sTeamB);
        if (highIdx >= 0 && lowIdx >= 0) {
          const gapSeed = Math.abs(highIdx - lowIdx);
          sb = 0.4 * gapSeed;
          sb = highIdx < lowIdx ? sb : -sb;
        }
      }
      
      let sWA = 0, sWB = 0;
      const sGames = [];
      for (let g = 0; g < 7 && sWA < 4 && sWB < 4; g++) {
        const gr = simulateGameNew(sTeamA, sTeamB, sb);
        if (gr.won) sWA++; else sWB++;
        sGames.push({ myScore: gr.scoreA, oppScore: gr.scoreB, won: gr.won, home: g < 4, qScoresA: gr.qScoresA, qScoresB: gr.qScoresB, boxScore: gr.boxScore });
      }
      const sWinner = sWA >= 4 ? sTeamA : sTeamB;
      s.winner = sWinner;
      bracket.results.push({
        round, seriesIdx: idx, roundName,
        teamA: sTeamA, teamB: sTeamB, winner: sWinner,
        winnerWins: sWA >= 4 ? sWA : sWB, loserWins: sWA >= 4 ? sWB : sWA,
        winsA: sWA, winsB: sWB, aWon: sWA >= 4, seriesGames: sGames, isMySeries: false,
      });
      if (round < 2) {
        const nr = bracket.rounds[round + 1];
        if (nr) {
          var ni2, isHigh2;
          if (round === 0) {
            ni2 = (idx === 0 || idx === 3) ? 0 : 1;
            isHigh2 = (idx === 0 || idx === 1);
          } else {
            ni2 = 0;
            isHigh2 = idx === 0;
          }
          if (nr[ni2] === null) nr[ni2] = { high: null, low: null, winner: null };
          if (isHigh2) nr[ni2].high = { team: sWinner };
          else nr[ni2].low = { team: sWinner };
        }
      } else if (round === 2) bracket.confChampion = sWinner;
    }
    
    // 检查是否所有同轮系列赛都完成了
    const allDone = bracket.rounds[round].every(s => s?.winner);
    if (allDone && round < 2) bracket.currentRound = round + 1;
    
    // ★ 先设置淘汰标志，确保后续所有渲染都能看到
    const userWonSeries = isMySeries ? (teamA === STATE.careerTeam ? aWon : !aWon) : false;
    if (isMySeries && !userWonSeries) STATE.season.playoffEliminated = true;
    if (isMySeries && !userWonSeries) STATE.season.playoffsDone = true;
    
    // ★ 分区决赛完成 → 先设置总决赛 (第3轮) 对阵（在用户跳转前执行）
    if (round === 2 && allDone) {
      const otherBracket = STATE.season.otherBracket;
      bracket.otherConfChampion = otherBracket?.confChampion || simOtherConference(bracket.conf === 'EAST' ? 'WEST' : 'EAST');
      const finalsRound = bracket.rounds[3];
      if (finalsRound && finalsRound[0] === null) {
        finalsRound[0] = {
          high: { team: bracket.confChampion },
          low: { team: bracket.otherConfChampion },
          winner: null,
        };
        bracket.currentRound = 3;
      }
    }
    
    // 如果是用户的系列赛，直接刷新页面
    if (isMySeries) {
      // ★ 用户获胜后自动切换到下一轮tab
      if (userWonSeries) {
        STATE.season._playoffRound = (STATE.season._playoffRound || 0) + 1;
        // ★ 总决赛夺冠标记
        if (round === 3) {
          STATE.season.isChampion = true;
          STATE.season.playoffsDone = true;
          STATE.season.awards = STATE.season.awards || [];
          STATE.season.awards.push({ act: 'champion', label: '🏆 总冠军', winner: getHupuDisplayName(), winnerEN: '', team: STATE.careerTeam, isUser: true });
          var poStats = STATE.season.playoffStats || {};
          var fmvpPpg = poStats.games > 0 ? (poStats.pts || 0) / poStats.games : 0;
          var fmvpNeed = 20 - ((typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects().awardFmvpPpgRelief : 0) || 0);
          if (poStats.games > 0 && fmvpPpg >= fmvpNeed) {
            STATE.season.awards.push({ act: 'fmvp', label: '👑 总决赛MVP', winner: getHupuDisplayName(), winnerEN: '', team: STATE.careerTeam, isUser: true });
          }
          setTimeout(function() { showChampionshipCelebration(showSeasonResults); }, 300);
          return;
        }
      }
      if (!userWonSeries) {
        clearPlayoffGamecast();
        renderPlayoffBracketUI();
        showSeriesResult(result);
        return;
      }
      clearPlayoffGamecast();
      renderPlayoffBracketUI();
      return;
    }
    
    renderPlayoffBracketUI();
  });
}
/** 模拟另一分区的季后赛，返回冠军球队（使用NBA标准对阵：1v8/4v5/2v7/3v6） */
function simOtherConference(conf) {
  const sorted = getConferenceSorted(conf);
  const teams = sorted.slice(0, 8).map(t => t.team);
  if (teams.length < 8) return teams[0] || '';
  
  // NBA标准对阵：1v8, 2v7, 3v6, 4v5（种子顺序）
  const bracketOrder = [0, 7, 1, 6, 2, 5, 3, 4];
  let roundTeams = bracketOrder.map(i => teams[i]);
  
  // 3轮7场4胜
  const simSeries = (tA, tB) => {
    const pA = calcTeamPowerWithPlayer(tA);
    const pB = calcTeamPowerWithPlayer(tB);
    let wA = 0, wB = 0;
    for (let g = 0; g < 7 && wA < 4 && wB < 4; g++) {
      const sA = Math.round(pA.offense * (0.5 + Math.random() * 0.5) + pA.defense * 0.3);
      const sB = Math.round(pB.offense * (0.5 + Math.random() * 0.5) + pB.defense * 0.3);
      if ((g < 4 ? sA + 3 : sA) >= (g < 4 ? sB : sB + 3)) wA++; else wB++;
    }
    return wA >= 4 ? tA : tB;
  };
  
  for (let r = 0; r < 3; r++) {
    const winners = [];
    for (let i = 0; i < roundTeams.length; i += 2) {
      if (i + 1 >= roundTeams.length) { winners.push(roundTeams[i]); break; }
      winners.push(simSeries(roundTeams[i], roundTeams[i + 1]));
    }
    roundTeams = winners;
  }
  return roundTeams[0];
}

function getPlayoffExitRoundLabel(round) {
  return ['首轮', '次轮', '分区决赛', '总决赛'][round] || '季后赛';
}

function getSeriesWinsForTeam(result, team) {
  if (!result || !team) return 0;
  if (team === result.teamA) {
    if (typeof result.teamAWins === 'number') return result.teamAWins;
    if (typeof result.winsA === 'number') return result.winsA;
    return result.aWon ? result.winnerWins : result.loserWins;
  }
  if (team === result.teamB) {
    if (typeof result.teamBWins === 'number') return result.teamBWins;
    if (typeof result.winsB === 'number') return result.winsB;
    return result.aWon ? result.loserWins : result.winnerWins;
  }
  return 0;
}

var CHAMPION_CELEBRATION_COPY = [
  '{team}站上联盟之巅。彩带落下时，{player}终于听见这个赛季所有疲惫都有了回声。',
  '终场哨响，{team}成为最后站着的球队。{player}看着记分牌，知道这不是运气，是整整一个赛季的答案。',
  '{player}举起奖杯的那一刻，{team}的更衣室像被点亮。那些训练、伤痛和沉默，终于都有了归处。',
  '这一夜属于{team}。人群在身后翻涌，{player}站在彩带中间，像站在自己一路坚持的尽头。',
  '{team}把总冠军带回了城市。{player}没有急着庆祝，只是低头看了看手里的奖杯，像确认这一切是真的。',
  '冠军不是突然来的。它藏在{team}每一次防守、每一次补位、每一次没有放弃的回合里，今晚终于落到{player}手上。',
  '{team}赢下了最后一场。灯光照下来时，{player}知道，有些夜晚会被一座城市讲很多年。',
  '彩带从球馆上空落下，{team}的替补席冲进场内。{player}被队友抱住，整个赛季都在这一刻变轻。',
  '{team}终于抵达终点。{player}站在人群里笑了很久，因为这一路没有捷径，只有一步一步打出来的相信。',
  '总冠军属于{team}。{player}听见球迷喊着自己的名字，也听见那些没人看见的训练日终于给出了回答。',
  '{team}的冠军夜没有多余解释。比分已经定格，奖杯已经到手，{player}把所有质疑都留在了身后。',
  '这一刻，{team}不是热门、不是黑马、不是故事线，而是冠军。{player}把奖杯抱紧，像抱住整个赛季。',
  '从常规赛到最后一战，{team}把答案写完整了。{player}站在领奖台上，终于可以把所有辛苦说成值得。',
  '{team}登顶联盟。香槟还没打开，{player}已经先看向队友，因为这座奖杯从来不是一个人的。',
  '冠军彩带落在{player}肩上，也落在{team}每个人的鞋边。这个赛季走到这里，终于没有遗憾。',
  '{team}赢到了最后。{player}在喧闹中闭了一下眼，像把这一刻认真存进职业生涯。',
  '奖杯被递到{player}手里时，{team}的球迷已经沸腾。很多年后，他们还会记得今晚的声音。',
  '{team}把季后赛的每一道门都推开了。最后一扇门后面，是{player}和队友等了太久的金色。',
  '这一晚，{team}的名字被写在冠军旁边。{player}知道，从此以后，这个赛季不会再只是回忆。',
  '总冠军到手，{team}的更衣室彻底失控。{player}站在中间笑着，被彩带、队友和整座城市一起包围。'
];

function pickChampionCelebrationCopy() {
  var c = STATE.career || {};
  c.flags = c.flags || {};
  var used = Array.isArray(c.flags.usedChampionCopies) ? c.flags.usedChampionCopies : [];
  var available = CHAMPION_CELEBRATION_COPY.map(function(text, idx) {
    return { text: text, idx: idx };
  }).filter(function(item) {
    return used.indexOf(item.idx) < 0;
  });
  if (!available.length) {
    used = [];
    available = CHAMPION_CELEBRATION_COPY.map(function(text, idx) {
      return { text: text, idx: idx };
    });
  }
  var picked = available[Math.floor(Math.random() * available.length)];
  used.push(picked.idx);
  c.flags.usedChampionCopies = used;
  return picked.text
    .replace(/\{team\}/g, getTeamName(STATE.careerTeam))
    .replace(/\{player\}/g, getHupuDisplayName());
}

function showChampionshipCelebration(onDone) {
  var existing = document.querySelector('.champion-celebration-overlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.className = 'champion-celebration-overlay';
  var sparks = '';
  for (var i = 0; i < 48; i++) {
    var angle = Math.round(i * 7.5);
    var dist = 90 + Math.floor(Math.random() * 170);
    var left = 18 + Math.floor(Math.random() * 64);
    var top = 16 + Math.floor(Math.random() * 58);
    var delay = (Math.random() * 0.9).toFixed(2);
    sparks += '<span class="fw-dot" style="--a:' + angle + 'deg;--d:' + dist + 'px;left:' + left + '%;top:' + top + '%;animation-delay:' + delay + 's;"></span>';
  }
  overlay.innerHTML =
    sparks +
    '<div class="champion-card">' +
      '<div class="champion-cup">🏆</div>' +
      '<div class="champion-title">总冠军</div>' +
      '<div class="champion-sub">' + pickChampionCelebrationCopy() + '</div>' +
      '<button class="awards-next" id="championContinueBtn">查看赛季总结</button>' +
    '</div>';
  document.body.appendChild(overlay);
  document.getElementById('championContinueBtn').onclick = function() {
    overlay.remove();
    if (typeof onDone === 'function') onDone();
  };
}

function maybeShowFirstSixtyWinCelebration(onDone) {
  var c = STATE.career;
  if (!c || !STATE.season) return false;
  c.flags = c.flags || {};
  if (c.flags.firstSixtyWinCelebrated) return false;
  var wins = STATE.season.wins || 0;
  if (wins < 60) return false;
  c.flags.firstSixtyWinCelebrated = true;
  showSixtyWinCelebration(wins, onDone);
  return true;
}

function showSixtyWinCelebration(wins, onDone) {
  var existing = document.querySelector('.sixty-win-overlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.className = 'sixty-win-overlay';
  var pieces = '';
  for (var i = 0; i < 70; i++) {
    var left = Math.floor(Math.random() * 100);
    var delay = (Math.random() * 1.8).toFixed(2);
    var dur = (2.1 + Math.random() * 1.1).toFixed(2);
    var rot = Math.floor(Math.random() * 360);
    pieces += '<span class="confetti-piece" style="left:' + left + '%;animation-delay:' + delay + 's;animation-duration:' + dur + 's;--r:' + rot + 'deg;"></span>';
  }
  overlay.innerHTML =
    pieces +
    '<div class="sixty-win-card">' +
      '<div style="font-size:42px;line-height:1;margin-bottom:8px;">🎊</div>' +
      '<div class="sixty-win-title">60胜赛季</div>' +
      '<div class="sixty-win-sub">' + getTeamName(STATE.careerTeam) + '拿下' + wins + '胜。这是你生涯第一次把常规赛带到联盟顶级强队的高度，彩带先替这座城市落一次。</div>' +
      '<button class="awards-next" id="sixtyWinContinueBtn">继续</button>' +
    '</div>';
  document.body.appendChild(overlay);
  document.getElementById('sixtyWinContinueBtn').onclick = function() {
    overlay.remove();
    if (typeof onDone === 'function') onDone();
  };
}

function showSeriesResult(result) {
  const isUserA = result.teamA === STATE.careerTeam;
  const oppName = isUserA ? result.teamB : result.teamA;
  const userWins = getSeriesWinsForTeam(result, STATE.careerTeam);
  const oppWins = getSeriesWinsForTeam(result, oppName);
  const userWon = isUserA ? result.aWon : !result.aWon;
  const exitRoundLabel = getPlayoffExitRoundLabel(result.round);
  
  // 每场比分（落幕弹窗内仅展示，不再打开单场详情）
  const gamesHtml = result.seriesGames.map((g, idx) =>
    `<div class="sr-game-row" style="display:flex;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid var(--border-light);">
      <span style="width:22px;font-size:9px;color:var(--text-muted);">G${g.game}</span>
      <span style="flex:1;font-size:12px;font-weight:600;${g.won ? 'color:var(--green)' : 'color:var(--red)'}">
        ${isUserA ? g.myScore : g.oppScore}-${isUserA ? g.oppScore : g.myScore}
      </span>
      <span style="font-size:9px;color:var(--text-dim);">G${g.game} ${g.won ? '✅' : '❌'}</span>
      ${g.ot ? `<span style="font-size:8px;color:var(--accent);">${g.ot>1?g.ot+'OT':'OT'}</span>` : ''}
    </div>`
  ).join('');
  
  // 季后赛场均数据
  const po = STATE.season.playoffStats;
  const poG = po.games || 1;
  const poAvgHtml = poG > 0 ? `
    <div style="font-size:10px;color:var(--text-dim);padding:4px 0;border-top:1px solid var(--border);margin-top:4px;">
      季后赛场均: ${Math.round(po.pts/poG*10)/10}分 ${Math.round(po.reb/poG*10)/10}板 ${Math.round(po.ast/poG*10)/10}助
    </div>` : '';
  
  const existing = document.querySelector('.series-result-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'series-result-overlay';
  overlay.innerHTML = `
    <div class="sr-modal">
      <div class="sr-modal-header">
        <div style="font-size:12px;color:var(--text-dim);">${result.roundName}</div>
        <button class="modal-close" onclick="this.closest('.series-result-overlay').remove()">✕</button>
      </div>
      <div class="sr-modal-body">
        <div style="text-align:center;margin-bottom:8px;">
          <div style="font-size:18px;font-weight:700;">
            ${userWon ? '✅' : '❌'} ${getTeamName(STATE.careerTeam)} ${userWins}-${oppWins} ${getTeamName(oppName)}
          </div>
          <div style="font-size:12px;color:${userWon ? 'var(--green)' : 'var(--red)'};margin-top:4px;">
            ${userWon ? '🎉 晋级下一轮！' : '您的球队本赛季遗憾止步' + exitRoundLabel}
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">📋 系列赛比分</div>
        ${gamesHtml}
        ${poAvgHtml}
      </div>
      <div class="sr-modal-footer">
        ${userWon ?
          `<button class="btn btn-primary btn-sm" onclick="this.closest('.series-result-overlay').remove()">继续</button>` :
          `<button class="btn btn-secondary btn-sm" onclick="this.closest('.series-result-overlay').remove();showSeasonResults()">📊 查看赛季总结</button>`
        }
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/** 季后赛比赛详情弹窗（各节比分 + 你的数据 + 全队BoxScore） */
function showPlayoffGamePopup(round, seriesIdx, gameIdx) {
  const bracket = STATE.season.playoffBracket;
  if (!bracket) return;
  const result = bracket.results.find(r => r.round === round && r.seriesIdx === seriesIdx);
  if (!result || !result.seriesGames || !result.seriesGames[gameIdx]) return;
  
  const g = result.seriesGames[gameIdx];
  const isUserA = result.teamA === STATE.careerTeam;
  const myTeam = STATE.careerTeam;
  const myScore = isUserA ? g.myScore : g.oppScore;
  const oppScore = isUserA ? g.oppScore : g.myScore;
  const oppName = isUserA ? result.teamB : result.teamA;
  const myTeamTag = isUserA ? result.teamA : result.teamB;
  const oppTeamTag = isUserA ? result.teamB : result.teamA;
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  // 四节比分
  let quartersHtml = '';
  if (g.qScoresA && g.qScoresB) {
    for (let q = 0; q < 4; q++) {
      const qA = g.qScoresA[q] || 0;
      const qB = g.qScoresB[q] || 0;
      const myQ = isUserA ? qA : qB;
      const oppQ = isUserA ? qB : qA;
      quartersHtml += `<div style="display:flex;gap:4px;padding:3px 0;font-size:12px;border-bottom:1px solid var(--border);">
        <span style="width:28px;color:var(--text-muted);font-size:10px;">${qLabels[q]}</span>
        <span style="flex:1;text-align:center;font-weight:${myQ > oppQ ? 700 : 400};color:${myQ > oppQ ? 'var(--green)' : 'var(--text-dim)'};">${myQ}</span>
        <span style="flex:1;text-align:center;font-weight:${oppQ > myQ ? 700 : 400};color:${oppQ > myQ ? 'var(--green)' : 'var(--text-dim)'};">${oppQ}</span>
      </div>`;
    }
  }
  
  // 本场你的球员数据（精确到每场！）
  let myStatsHtml = '';
  if (g.myStats) {
    const s = g.myStats;
    const pct = s.fga > 0 ? Math.round(s.fgm / s.fga * 100) : 0;
    const threePct = s.threeA > 0 ? Math.round(s.threeM / s.threeA * 100) : 0;
    myStatsHtml = `
      <div style="padding:8px 14px 4px;">
        <div style="font-size:12px;color:var(--orange);margin-bottom:4px;">📊 我的球员 · 本场数据</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          <span style="background:var(--orange-bg);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;color:var(--orange);">${s.pts}</div>
            <div style="font-size:8px;color:var(--text-muted);">得分</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;">${s.reb}</div>
            <div style="font-size:8px;color:var(--text-muted);">篮板</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;">${s.ast}</div>
            <div style="font-size:8px;color:var(--text-muted);">助攻</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${Math.round(s.stl)}</div>
            <div style="font-size:8px;color:var(--text-muted);">断</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${Math.round(s.blk)}</div>
            <div style="font-size:8px;color:var(--text-muted);">帽</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${Math.round(s.tov)}</div>
            <div style="font-size:8px;color:var(--text-muted);">误</div>
          </span>
        </div>
        <div style="margin-top:4px;font-size:10px;color:var(--text-dim);text-align:center;">
          投篮 ${s.fgm}-${s.fga} (${pct}%) · 三分 ${s.threeM}-${s.threeA} (${threePct}%)
        </div>
      </div>`;
  } else {
    // 没有本场数据时显示季后赛场均
    const po = STATE.season.playoffStats;
    const poG = po.games || 1;
    myStatsHtml = `
      <div style="padding:8px 14px 4px;">
        <div style="font-size:12px;color:var(--orange);margin-bottom:4px;">📊 我的季后赛场均</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span style="background:var(--orange-bg);padding:4px 10px;border-radius:6px;text-align:center;min-width:50px;">
            <div style="font-size:16px;font-weight:700;color:var(--orange);">${Math.round(po.pts/poG*10)/10}</div>
            <div style="font-size:9px;color:var(--text-muted);">得分</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 10px;border-radius:6px;text-align:center;min-width:50px;">
            <div style="font-size:16px;font-weight:700;">${Math.round(po.reb/poG*10)/10}</div>
            <div style="font-size:9px;color:var(--text-muted);">篮板</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 10px;border-radius:6px;text-align:center;min-width:50px;">
            <div style="font-size:16px;font-weight:700;">${Math.round(po.ast/poG*10)/10}</div>
            <div style="font-size:9px;color:var(--text-muted);">助攻</div>
          </span>
        </div>
      </div>`;
  }
  
  // 全队BoxScore — 各队得分前5的球员
  let boxHtml = '';
  if (g.boxScore) {
    const homeBox = g.boxScore[myTeamTag] || [];
    const awayBox = g.boxScore[oppTeamTag] || [];
    
    // 按得分排序取前5
    const topHome = [...homeBox].sort((a, b) => b.pts - a.pts).slice(0, 5);
    const topAway = [...awayBox].sort((a, b) => b.pts - a.pts).slice(0, 5);
    
    function renderBoxRows(players, label, isHome) {
      let h = `<div style="margin-top:6px;">
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:2px;font-weight:600;">${label}</div>`;
      players.forEach(p => {
        const isU = p.isUser;
        h += `<div style="display:flex;gap:2px;padding:2px 0;font-size:9px;border-bottom:1px solid var(--border-light);${isU ? 'background:var(--orange-dim);border-radius:4px;padding:2px 4px;' : ''}">
          <span style="width:14px;font-size:8px;color:var(--text-muted);">${p.pos || '—'}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:${isU ? 700 : 400};${isU ? 'color:var(--orange);' : ''}">${p.name}</span>
          <span style="width:18px;text-align:right;font-weight:600;">${p.pts}</span>
          <span style="width:14px;text-align:right;">${p.reb}</span>
          <span style="width:14px;text-align:right;">${p.ast}</span>
          <span style="width:22px;text-align:right;font-size:8px;">${p.fgm}-${p.fga}</span>
        </div>`;
      });
      h += `</div>`;
      return h;
    }
    
    boxHtml = '';
  }
  
  // 关键事件
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:310px;">
      <div class="modal-header" style="padding:8px 12px;">
        <span style="font-family:var(--font-display);font-size:14px;">
          ${g.won ? '✅' : '❌'} G${g.game}: ${myScore}-${oppScore}
        </span>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div style="text-align:center;padding:3px 10px 6px;font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border);">
        ${result.roundName} · ${getTeamName(myTeam)} vs ${getTeamName(oppName)} · ${g.home ? '主场' : '客场'} ${g.ot ? '· ' + (g.ot > 1 ? g.ot+'OT' : 'OT') : ''}
      </div>
      
      ${quartersHtml ? `<div style="padding:4px 12px 3px;">${quartersHtml}</div>` : 
        `<div style="padding:8px 12px;text-align:center;font-size:12px;font-weight:700;">全场 ${myScore} - ${oppScore}</div>`
      }
      
      ${myStatsHtml}
      ${boxHtml}
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

// ==================== 赛季统一结果页 ====================
function showSeasonResults() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC13",label:"查看赛季总结"});
  // 安全检查：防止赛季未初始化时访问异常
  if (!STATE.season || !STATE.season.playerStats) {
    showScreen('screen-menu');
    return;
  }
  showScreen('screen-results');
  const ps = STATE.season.playerStats;
  const gp = Math.max((ps?.games) || 0, 1);
  const avg = {
    pts: Math.round(ps.pts / gp * 10) / 10,
    reb: Math.round(ps.reb / gp * 10) / 10,
    ast: Math.round(ps.ast / gp * 10) / 10,
    stl: Math.round(ps.stl / gp),
    blk: Math.round(ps.blk / gp),
    tov: Math.round(ps.tov / gp * 10) / 10,
    fgm: Math.round(ps.fgm / gp * 10) / 10,
    fga: Math.round(ps.fga / gp * 10) / 10,
    ftm: Math.round(ps.ftm / gp * 10) / 10,
    fta: Math.round(ps.fta / gp * 10) / 10,
    threeM: Math.round(ps.threeM / gp * 10) / 10,
    threeA: Math.round(ps.threeA / gp * 10) / 10,
    mins: Math.round(ps.mins / gp),
  };
  const pct = avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '—';
  const threePct = avg.threeA > 0 ? (avg.threeM / avg.threeA * 100).toFixed(1) : '—';
  const ftPct = avg.fta > 0 ? (avg.ftm / avg.fta * 100).toFixed(1) : '—';
  const ovrGrade = getOvrGrade(STATE.finalOVR);

  // 季后赛信息
  const bracket = STATE.season.playoffBracket;
  const seed = getConferenceSeed(STATE.careerTeam);
  let playoffResult = '';
  let playoffStatsHtml = '';
  
  if (STATE.season.isChampion) {
    playoffResult = '🏆 总冠军';
  } else if (bracket?.confChampion && bracket.confChampion === STATE.careerTeam) {
    const lastR3 = bracket.results?.find(r => r.round === 3);
    if (lastR3) {
      const userWonF = lastR3.teamA === STATE.careerTeam ? lastR3.aWon : !lastR3.aWon;
      playoffResult = userWonF ? '🏆 总冠军' : '🏀 总决赛 亚军';
    } else {
      playoffResult = '🏀 总决赛';
    }
  } else if (bracket?.confChampion) {
    // 已进季后赛但未夺冠
    const lastResult = bracket.results?.slice(-1)?.[0];
    const roundNames = ['首轮', '分区半决赛', '分区决赛'];
    if (lastResult) {
      const rn = roundNames[lastResult.round] || '季后赛';
      playoffResult = `🏀 ${rn} · ${STATE.season.playoffEliminated ? '淘汰' : lastResult.winner === STATE.careerTeam ? '晋级' : '淘汰'}`;
    } else {
      playoffResult = `🏀 第${seed}种子 · 季后赛`;
    }
  } else if (seed <= 10) {
    const pi = STATE.season.playInState;
    if (pi?.isEliminated) playoffResult = '🔥 附加赛 · 淘汰';
    else if (pi?.playoffSeed) playoffResult = `🔥 附加赛晋级（${pi.playoffSeed}号种子）`;
    else playoffResult = '🔥 附加赛';
  } else {
    playoffResult = '😢 未进季后赛';
  }
  
  // 季后赛数据（独立跟踪）
  const po = STATE.season.playoffStats;
  if (po.games > 0) {
    const poG = po.games;
    const poAvg = {
      pts: Math.round(po.pts / poG * 10) / 10,
      reb: Math.round(po.reb / poG * 10) / 10,
      ast: Math.round(po.ast / poG * 10) / 10,
      stl: Math.round(po.stl / poG),
      blk: Math.round(po.blk / poG),
      tov: Math.round(po.tov / poG * 10) / 10,
      fgm: Math.round(po.fgm / poG * 10) / 10,
      fga: Math.round(po.fga / poG * 10) / 10,
      threeM: Math.round(po.threeM / poG * 10) / 10,
      threeA: Math.round(po.threeA / poG * 10) / 10,
      ftm: Math.round(po.ftm / poG * 10) / 10,
      fta: Math.round(po.fta / poG * 10) / 10,
    };
    const poPct = poAvg.fga > 0 ? (poAvg.fgm / poAvg.fga * 100).toFixed(1) : '—';
    const poThreePct = poAvg.threeA > 0 ? (poAvg.threeM / poAvg.threeA * 100).toFixed(1) : '—';
    
    playoffStatsHtml = `<div class="sr-section">
      <div class="sr-section-title">🏀 季后赛数据 · ${poG}场</div>
      <div class="sr-stats-grid">
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.pts}</span><span class="sr-stat-lbl">得分</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.reb}</span><span class="sr-stat-lbl">篮板</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.ast}</span><span class="sr-stat-lbl">助攻</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.stl}</span><span class="sr-stat-lbl">抢断</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.blk}</span><span class="sr-stat-lbl">盖帽</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.tov}</span><span class="sr-stat-lbl">失误</span></div>
      </div>
      <div class="sr-pct-line">投篮 ${poAvg.fgm}-${poAvg.fga} (${poPct}%) · 三分 ${poAvg.threeM}-${poAvg.threeA} (${poThreePct}%)</div>
    </div>`;
  }
  
  // 属性HTML (字母评级)
  let attrsHtml = '';
  ATTR_KEYS.forEach(k => {
    const val = STATE.attrs[k] || 50;
    const g = getGrade(val);
    attrsHtml += `<div class="mc-attr">
      <span class="mc-alabel">${attrCN(k)}</span>
      <span class="mc-aval" style="color:${g.color}">${g.letter}</span>
    </div>`;
  });
  
  // 构建页面
  const hasPlayoffs = bracket && bracket.results?.length > 0;
  
  html('results-content').innerHTML = `
    <div class="sr-page">
      <!-- 头部 -->
      <div class="sr-header">
        <div class="sr-team">${getTeamName(STATE.careerTeam)}</div>
        <div class="sr-record">${STATE.season.wins}-${STATE.season.losses}</div>
        <div class="sr-result">${playoffResult === '🔥 附加赛' ? '' : playoffResult}</div>
      </div>

      <!-- 基础信息 -->
      <div class="sr-section">
        <div class="sr-section-title">👤 我的球员信息</div>
        <div class="sr-info-row">
          <span>位置</span><span>${SIM_CONFIG.POSITIONS[STATE.position]}</span>
        </div>
        <div class="sr-info-row">
          <span>总评</span><span class="sr-ovr">${STATE.finalOVR}</span>
        </div>
        <div class="sr-info-row">
          <span>球队</span><span>${getTeamLogo(STATE.careerTeam, 20)} ${getTeamName(STATE.careerTeam)}</span>
        </div>
      </div>

      <!-- 常规赛数据 -->
      <div class="sr-section">
        <div class="sr-section-title">📊 常规赛 · ${gp}场</div>
        <div class="sr-stats-grid">
          <div class="sr-stat"><span class="sr-stat-val">${avg.pts}</span><span class="sr-stat-lbl">得分</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.reb}</span><span class="sr-stat-lbl">篮板</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.ast}</span><span class="sr-stat-lbl">助攻</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.stl}</span><span class="sr-stat-lbl">抢断</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.blk}</span><span class="sr-stat-lbl">盖帽</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.tov}</span><span class="sr-stat-lbl">失误</span></div>
        </div>
        <div class="sr-pct-line">投篮 ${avg.fgm}-${avg.fga} (${pct}%) · 三分 ${avg.threeM}-${avg.threeA} (${threePct}%) · 罚球 ${avg.ftm}-${avg.fta} (${ftPct}%)</div>
      </div>

      ${playoffStatsHtml}

      <!-- 最终属性 -->
      <div class="sr-section">
        <div class="sr-section-title">🏷️ 最终属性</div>
        <div class="mc-attrs">${attrsHtml}</div>
      </div>

      <!-- 按钮 -->
      <div class="sr-actions">
        <button class="btn btn-primary" onclick="showMyCard()" style="display:flex;align-items:center;justify-content:center;gap:4px;">📊 生涯数据 · 进入休赛期</button>
      </div>
    </div>
  `;
}

// ==================== My Card（实时数据面板）====================
function showMyCard() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC8",label:"我的数据"});
  showScreen('screen-mycard');
  const isFinal = !STATE.season.schedule?.find(g => !g.simulated);
  renderMyCard(isFinal);
}

function renderMyCard(isFinal) {
  const ps = STATE.season.playerStats;
  const gp = ps.games || 1;
  const avg = {
    pts: Math.round(ps.pts / gp * 10) / 10,
    reb: Math.round(ps.reb / gp * 10) / 10,
    ast: Math.round(ps.ast / gp * 10) / 10,
    stl: Math.round(ps.stl / gp),
    blk: Math.round(ps.blk / gp),
    tov: Math.round(ps.tov / gp * 10) / 10,
    fgm: Math.round(ps.fgm / gp * 10) / 10,
    fga: Math.round(ps.fga / gp * 10) / 10,
    ftm: Math.round(ps.ftm / gp * 10) / 10,
    fta: Math.round(ps.fta / gp * 10) / 10,
    threeM: Math.round(ps.threeM / gp * 10) / 10,
    threeA: Math.round(ps.threeA / gp * 10) / 10,
    mins: Math.round(ps.mins / gp),
  };
  const awards = STATE.season.awards || [];
  const ovrGrade = getOvrGrade(STATE.finalOVR);
  
  const pct = avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '—';
  const threePct = avg.threeA > 0 ? (avg.threeM / avg.threeA * 100).toFixed(1) : '—';
  const ftPct = avg.fta > 0 ? (avg.ftm / avg.fta * 100).toFixed(1) : '—';
  const gamesPlayed = STATE.season.schedule?.filter(g => g.simulated).length || 0;
  
  // 属性紧凑网格
  let attrHtml = '';
  ATTR_KEYS.forEach(k => {
    const val = STATE.attrs[k] || 50;
    const g = getGrade(val);
    attrHtml += `<div class="mc-attr">
      <span class="mc-alabel">${attrCN(k)}</span>
      <span class="mc-aval" style="color:${g.color}">${g.letter}</span>
    </div>`;
  });
  
  let awardsHtml = '';
  awards.forEach(a => {
    if (typeof a === 'object' && !a.isUser) return;
    var l = (typeof a === 'object' && a.userHonorLabel) || a.label || (typeof a === 'string' ? a : '');
    if (!l) return;
    if (STATE.career && STATE.career.seasonCount > 0 && l.indexOf('最佳新秀') >= 0) return;
    var emoji = '🏅';
    if (l.indexOf('总冠军') >= 0) emoji = '🏆';
    else if (l.indexOf('MVP') >= 0 || l.indexOf('FMVP') >= 0) emoji = '👑';
    else if (l.indexOf('DPOY') >= 0 || l.indexOf('最佳防守') >= 0) emoji = '🔒';
    else if (l.indexOf('进步最快') >= 0) emoji = '📈';
    else if (l.indexOf('全明星') >= 0) emoji = '⭐';
    else if (l.indexOf('最佳阵容') >= 0) emoji = '🌟';
    else if (l.indexOf('最佳新秀') >= 0) emoji = '🌱';
    var cls = 'ch-badge';
    if (l.indexOf('总冠军') >= 0 || l.indexOf('MVP') >= 0 || l.indexOf('FMVP') >= 0) cls += ' gold';
    awardsHtml += renderHonorBadge(l, emoji, cls);
  });
  
  let playoffInfo = '';
  if (isFinal) {
    const seed = getConferenceSeed(STATE.careerTeam);
    function hasSeasonAward(key) {
      return (STATE.season.awards || []).some(function(a) {
        var l = typeof a === 'string' ? a : (a && a.label) || '';
        return l.indexOf(key) >= 0;
      });
    }
    if (hasSeasonAward('总冠军')) {
      playoffInfo = '<div class="mc-chip mc-chip-gold">🏆 总冠军</div>';
    } else if (hasSeasonAward('总决赛MVP')) {
      playoffInfo = '<div class="mc-chip mc-chip-gold">👑 总决赛MVP</div>';
    } else {
      const pi = STATE.season.playInState;
      const bracket = STATE.season.playoffBracket;
      const lastResult = bracket?.results?.slice(-1)?.[0];
      const roundNames = ['首轮', '分区半决赛', '分区决赛', '总决赛'];
      const playoffSeed = STATE.season.playoffSeed || (seed <= 6 ? seed : null);
      
      if (seed <= 6) {
        // 直接晋级季后赛
        if (lastResult) {
          const rn = roundNames[lastResult.round] || '季后赛';
          const isFinals = lastResult.round === 3;
          if (isFinals) {
            playoffInfo = `<div class="mc-chip mc-chip-gold">🏆 总决赛</div>`;
          } else {
            const userWon = lastResult.teamA === STATE.careerTeam ? lastResult.aWon : !lastResult.aWon;
            playoffInfo = `<div class="mc-chip">🏀 ${rn} · ${userWon ? '晋级' : '淘汰'}</div>`;
          }
        } else {
          playoffInfo = `<div class="mc-chip">🏀 季后赛（${playoffSeed}号种子）</div>`;
        }
      } else if (seed <= 10) {
        // 附加赛
        if (pi?.isEliminated) {
          playoffInfo = '<div class="mc-chip" style="color:var(--text-dim);">🔥 附加赛 · 淘汰</div>';
        } else if (pi?.playoffSeed) {
          playoffInfo = `<div class="mc-chip" style="color:var(--gold);">🔥 附加赛晋级 · ${pi.playoffSeed}号种子</div>`;
        } else {
          playoffInfo = '<div class="mc-chip" style="color:var(--accent);">🔥 附加赛</div>';
        }
      } else {
        playoffInfo = '<div class="mc-chip" style="color:var(--text-dim);">😢 未进季后赛</div>';
      }
    }
  }
  
  const retired = !!(STATE.career && STATE.career.retired);
  const btnHtml = isFinal ? (retired ? `
    <div style="display:flex;flex-direction:column;gap:6px;padding-top:4px;">
      <button class="btn btn-primary" onclick="showCareerStats(1)" style="display:flex;align-items:center;justify-content:center;gap:4px;">🏆 查看退役总结</button>
      <div style="text-align:center;font-size:11px;color:var(--text-dim);">生涯已结束</div>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:6px;padding-top:4px;">
      <button class="btn btn-primary" onclick="showCareerStats()" style="display:flex;align-items:center;justify-content:center;gap:4px;">📊 生涯数据</button>
      <button class="btn btn-gold" onclick="beginOffseason()" style="display:flex;align-items:center;justify-content:center;gap:4px;">🏋️ 进入休赛期</button>
    </div>`) : `
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary" onclick="backToSeason()" style="flex:1;">◀ 关闭</button>
    </div>`;
  
  html('mycard-content').innerHTML = `
    <div class="mycard">
      <div class="mc-header">
        <div class="mc-pos">${SIM_CONFIG.POSITIONS[STATE.position]}</div>
        <div class="mc-name">${getHupuDisplayName()}</div>
        <div class="mc-ovr-row">
          <span class="mc-ovr">${STATE.finalOVR}</span>

        </div>
        <div class="mc-team-line">${getTeamName(STATE.careerTeam)} · ${STATE.season.wins}-${STATE.season.losses}</div>
        ${playoffInfo}
      </div>
      
      <div class="mc-section">
        <div class="mc-section-title">📊 场均数据 · 已赛 ${gamesPlayed}${isFinal ? '' : '/82'} 场</div>
        <div class="mc-stats-grid">
          <div class="mc-stat"><span class="mc-stat-val">${avg.pts}</span><span class="mc-stat-lbl">得分</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.reb}</span><span class="mc-stat-lbl">篮板</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.ast}</span><span class="mc-stat-lbl">助攻</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.stl}</span><span class="mc-stat-lbl">抢断</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.blk}</span><span class="mc-stat-lbl">盖帽</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.tov}</span><span class="mc-stat-lbl">失误</span></div>
        </div>
        <div class="mc-pct-line">投篮 ${avg.fgm}-${avg.fga} (${pct}%) · 三分 ${avg.threeM}-${avg.threeA} (${threePct}%) · 罚球 ${avg.ftm}-${avg.fta} (${ftPct}%)</div>
      </div>
      
      <div class="mc-section">
        <div class="mc-section-title">🏷️ 最终属性</div>
        <div class="mc-attrs">${attrHtml}</div>
      </div>
      
      ${awardsHtml ? `<div class="mc-section"><div class="mc-awards">${awardsHtml}</div></div>` : ''}
      
      <div style="padding:4px 16px 16px;">${btnHtml}</div>
    </div>
  `;
}

// ==================== 生涯数据页面 ====================
function showCareerStats(tab) {
  showScreen('screen-career-stats');
  saveCurrentSeasonToCareer();
  var c = STATE.career;
  tab = tab || 0;
  var subText = tab === 0 ? (getCurrentSeasonLabel() + ' · ' + STATE.finalPosition + ' · OVR ' + STATE.finalOVR) : (tab === 1 ? ('生涯共 ' + c.honors.length + ' 项荣誉') : ('休赛期纪事 ' + ((c.offseasonHistory || []).length) + ' 条'));
  document.getElementById('career-stats-sub').textContent = subText;

  var html = '';
  // Tabs
  html += '<div class="modal-tabs" style="margin:0 0 10px;">';
  html += '<button class="' + (tab === 0 ? 'active' : '') + '" onclick="showCareerStats(0)">📊 生涯数据</button>';
  html += '<button class="' + (tab === 1 ? 'active' : '') + '" onclick="showCareerStats(1)">🏆 荣誉墙</button>';
  html += '<button class="' + (tab === 2 ? 'active' : '') + '" onclick="showCareerStats(2)">📖 休赛期</button>';
  html += '</div>';

  if (tab === 0) {
    html += renderCareerStatsTab();
  } else if (tab === 1) {
    html += renderCareerHonorsTab();
  } else {
    html += renderOffseasonHistoryTab();
  }

  html += '<div style="display:flex;flex-direction:column;gap:6px;align-items:center;margin-top:6px;">';
  if (STATE.career && STATE.career.retired) {
    html += '<div style="text-align:center;font-size:12px;color:var(--text-dim);padding:4px 0;">🏁 生涯已结束，感谢你带来的每一个赛季</div>';
    html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
    if (!(STATE.career.flags && STATE.career.flags.postCareerDone)) {
      html += '<button class="btn btn-primary btn-sm" onclick="startPostCareerFlow()">🏁 继续退役后篇章</button>';
    }
    html += '<button class="btn btn-secondary btn-sm" onclick="exitToHomepage()">🚪 回到主页</button>';
    html += '</div>';
  } else {
    html += '<button class="btn btn-primary btn-sm" onclick="showScreen(\'screen-mycard\')">📋 返回休赛期面板</button>';
  }
  html += '</div>';

  document.getElementById('career-stats-content').innerHTML = html;
}

function exitToHomepage() {
  initGame();
}

function renderCareerStatsTab() {
  var c = STATE.career;
  var ps = c.totalStats;
  var gp = ps.games || 1;
  var avg = {
    pts: Math.round(ps.pts / gp * 10) / 10,
    reb: Math.round(ps.reb / gp * 10) / 10,
    ast: Math.round(ps.ast / gp * 10) / 10,
    stl: Math.round(ps.stl / gp),
    blk: Math.round(ps.blk / gp),
    tov: Math.round(ps.tov / gp * 10) / 10,
    fgm: Math.round(ps.fgm / gp * 10) / 10,
    fga: Math.round(ps.fga / gp * 10) / 10,
    ftm: Math.round(ps.ftm / gp * 10) / 10,
    fta: Math.round(ps.fta / gp * 10) / 10,
    threeM: Math.round(ps.threeM / gp * 10) / 10,
    threeA: Math.round(ps.threeA / gp * 10) / 10,
  };
  var pct = avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '—';
  var threePct = avg.threeA > 0 ? (avg.threeM / avg.threeA * 100).toFixed(1) : '—';
  var ftPct = avg.fta > 0 ? (avg.ftm / avg.fta * 100).toFixed(1) : '—';
  var h = '';
  h += '<div class="sr-section cs-section">';
  h += '<div class="sr-section-title">📊 生涯累计</div>';
  h += '<div class="cs-grid">';
  var cStats = [
    { val: ps.pts, lbl: '总得分' }, { val: ps.reb, lbl: '总篮板' }, { val: ps.ast, lbl: '总助攻' },
    { val: Math.round(ps.stl), lbl: '总抢断' }, { val: Math.round(ps.blk), lbl: '总盖帽' }, { val: ps.games, lbl: '出场数' },
  ];
  cStats.forEach(function(s) {
    h += '<div class="cs-stat"><div class="cs-stat-val">' + s.val + '</div><div class="cs-stat-lbl">' + s.lbl + '</div></div>';
  });
  h += '</div></div>';
  h += '<div class="sr-section cs-section">';
  h += '<div class="sr-section-title">📈 生涯场均</div>';
  h += '<div class="cs-grid">';
  var aStats = [
    { val: avg.pts, lbl: '得分' }, { val: avg.reb, lbl: '篮板' }, { val: avg.ast, lbl: '助攻' },
    { val: avg.stl, lbl: '抢断' }, { val: avg.blk, lbl: '盖帽' }, { val: avg.tov, lbl: '失误' },
  ];
  aStats.forEach(function(s) {
    h += '<div class="cs-stat"><div class="cs-stat-val">' + s.val + '</div><div class="cs-stat-lbl">' + s.lbl + '</div></div>';
  });
  h += '</div>';
  h += '<div class="sr-pct-line">命中率 ' + avg.fgm + '-' + avg.fga + ' (' + pct + '%) · 三分 ' + avg.threeM + '-' + avg.threeA + ' (' + threePct + '%) · 罚球 ' + avg.ftm + '-' + avg.fta + ' (' + ftPct + '%)</div>';
  h += '</div>';
  h += '<div class="sr-section cs-section">';
  h += '<div class="sr-section-title">📋 每赛季</div>';
  if (c.seasons.length === 0) {
    h += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">暂无赛季数据</div>';
  } else {
    for (var i = c.seasons.length - 1; i >= 0; i--) {
      var s = c.seasons[i];
      var sp = s.playerStats || {};
      var sg = sp.games || 1;
      var sa = Math.round((sp.pts || 0) / sg * 10) / 10;
      var tn = getTeamName ? getTeamName(s.team) : s.team;
      var record = (s.wins || 0) + '-' + (s.losses || 0);
      h += '<div class="cs-season-row" onclick="showSeasonDetail(' + i + ')">';
      h += '<span class="cs-season-num">' + getSeasonLabel(s.seasonNum) + '</span>';
      h += '<span class="cs-season-team">' + tn + '</span>';
      h += '<span class="cs-season-record">' + record + '</span>';
      h += '<span class="cs-season-pts">' + sa + '分</span>';
      h += '<span class="cs-season-arrow">›</span>';
      h += '</div>';
    }
  }
  h += '</div>';
  return h;
}

function isRookieHonorForLaterSeason(h) {
  var label = (h && h.label) || '';
  return label.indexOf('最佳新秀') >= 0 && (parseInt(h.seasonNum, 10) || 0) !== 1;
}

function renderHonorBadge(label, emoji, cls) {
  label = label || '';
  emoji = emoji || '';
  var prefix = (emoji && label.indexOf(emoji) !== 0) ? emoji + ' ' : '';
  return '<span class="' + (cls || '') + '">' + prefix + label + '</span>';
}

function renderCareerHonorsTab() {
  var c = STATE.career;
  var h = '';
  if (c.seasons.length === 0) {
    h += '<div class="ch-empty">🏀 还没有荣誉，快去打比赛吧</div>';
  } else {
    for (var i = c.seasons.length - 1; i >= 0; i--) {
      var s = c.seasons[i];
      var tn = getTeamName ? getTeamName(s.team) : s.team;
      var seasHonors = c.honors.filter(function(hh) { return hh.seasonNum === s.seasonNum && !isRookieHonorForLaterSeason(hh); });
      h += '<div class="ch-season">';
      h += '<div class="ch-season-header">🏀 ' + getSeasonLabel(s.seasonNum) + ' <span class="ch-team">' + tn + '</span></div>';
      if (seasHonors.length === 0) {
        h += '<div style="font-size:12px;color:var(--text-muted);">暂无荣誉</div>';
      } else {
        seasHonors.forEach(function(hh) {
          var cls = 'ch-badge';
          if (hh.label.indexOf('总冠军') >= 0 || hh.label.indexOf('MVP') >= 0 || hh.label.indexOf('FMVP') >= 0) cls += ' gold';
          h += renderHonorBadge(hh.label, hh.emoji, cls);
        });
      }
      h += '</div>';
    }
  }
  var counts = {};
  c.honors.forEach(function(hh) {
    if (isRookieHonorForLaterSeason(hh)) return;
    counts[hh.label] = (counts[hh.label] || 0) + 1;
  });
  var sumParts = [];
  for (var k in counts) {
    sumParts.push(counts[k] + '×' + k);
  }
  if (sumParts.length > 0) {
    h += '<div class="ch-summary">📊 生涯总计：' + sumParts.join(' · ') + '</div>';
  }
  return h;
}

function renderOffseasonHistoryTab() {
  var c = STATE.career;
  var list = (c.offseasonHistory || []).slice().reverse();
  var h = '';
  if (list.length === 0) {
    h += '<div class="ch-empty">📖 还没有休赛期故事</div>';
    return h;
  }
  h += '<div class="sr-section cs-section">';
  h += '<div class="sr-section-title">📖 休赛期纪事</div>';
  list.forEach(function(item) {
    h += '<div class="ch-season">';
    h += '<div class="ch-season-header">' + getSeasonLabel((item.seasonNum || 1) + 1) + ' 夏天 <span class="ch-team">' + (item.event || '') + '</span></div>';
    h += '<div style="font-size:12px;color:var(--orange);font-weight:700;margin-bottom:5px;">选择：' + (item.choice || '') + '</div>';
    h += '<div style="font-size:12px;color:var(--text-dim);line-height:1.6;">' + (item.result || '').replace(/<br><br>/g, '<br>') + '</div>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

function saveCurrentSeasonToCareer() {
  var c = STATE.career;
  if (!STATE.season || !STATE.season.playerStats) return;
  if (STATE._careerSaved) return;
  if (STATE.season.schedule && STATE.season.schedule.some(function(g) { return !g.simulated; })) return;
  // 季后赛没打完不允许提前存赛季，否则总冠军荣誉会丢失或错位
  if (STATE.season.isPlayoffs && !STATE.season.playoffsDone) return;

  var sp = STATE.season.playerStats || {};
  var awards = STATE.season.awards || [];
  var honorList = [];
  var seasonNumForHonor = c.seasonCount + 1;
  function honorAlready(label) {
    return c.honors && c.honors.some(function (h) {
      return n(h.seasonNum) === seasonNumForHonor && String(h.label || '').indexOf(label) >= 0;
    });
  }
  awards.forEach(function(a) {
    if (typeof a === 'string') {
      // 字符串类奖项：属于玩家
      var l = a;
      if (!l) return;
      if (c.seasonCount > 0 && l.indexOf('最佳新秀') >= 0) return;
      if (honorAlready(l)) return;
      var emoji = '🏅';
      if (l.indexOf('总冠军') >= 0) emoji = '🏆';
      else if (l.indexOf('MVP') >= 0 || l.indexOf('FMVP') >= 0) emoji = '👑';
      else if (l.indexOf('DPOY') >= 0) emoji = '🔒';
      else if (l.indexOf('全明星') >= 0) emoji = '⭐';
      else if (l.indexOf('最佳阵容') >= 0) emoji = '🌟';
      else if (l.indexOf('最佳新秀') >= 0) emoji = '🌱';
      honorList.push({ seasonNum: c.seasonCount + 1, label: l, emoji: emoji });
    } else if (a.isUser) {
      // 结构化奖项：只取 isUser 为 true 的
      var l = a.userHonorLabel || a.label || '';
      if (!l) return;
      if (c.seasonCount > 0 && l.indexOf('最佳新秀') >= 0) return;
      if (honorAlready(l)) return;
      var emoji = '🏅';
      if (l.indexOf('总冠军') >= 0) emoji = '🏆';
      else if (l.indexOf('MVP') >= 0 || l.indexOf('FMVP') >= 0) emoji = '👑';
      else if (l.indexOf('DPOY') >= 0 || l.indexOf('最佳防守') >= 0) emoji = '🔒';
      else if (l.indexOf('进步最快') >= 0) emoji = '📈';
      else if (l.indexOf('全明星') >= 0) emoji = '⭐';
      else if (l.indexOf('最佳阵容') >= 0) emoji = '🌟';
      else if (l.indexOf('最佳新秀') >= 0) emoji = '🌱';
      honorList.push({ seasonNum: c.seasonCount + 1, label: l, emoji: emoji });
    }
  });

  var playoffResult = '';
  if (STATE.season.playoffBracket && STATE.season.playoffBracket.results) {
    var myResults = STATE.season.playoffBracket.results.filter(function(r) { return r.isMySeries; });
    if (myResults.length > 0) {
      var last = myResults[myResults.length - 1];
      var rn = ['首轮','分区半决赛','分区决赛','总决赛'][last.round] || '';
      var userWon = last.teamA === STATE.careerTeam ? last.aWon : !last.aWon;
      playoffResult = rn + (last.round === 3 && userWon ? '·总冠军' : '');
    }
  }

  c.seasonCount++;
  if (typeof updateSeasonBadge === 'function') updateSeasonBadge();
  var seasonRecord = {
    seasonNum: c.seasonCount, team: STATE.careerTeam, ovr: STATE.finalOVR,
    wins: STATE.season.wins || 0, losses: STATE.season.losses || 0,
    playerStats: JSON.parse(JSON.stringify(sp)),
    playoffResult: playoffResult || (STATE.season.playoffBracket ? '季后赛' : '未晋级'),
    awards: honorList,
    eventTimeline: JSON.parse(JSON.stringify((STATE.season.events && STATE.season.events.storyTimeline) || [])),
  };
  c.seasons.push(seasonRecord);
  c.lastCompletedSeasonSnapshot = JSON.parse(JSON.stringify(seasonRecord));

  var ts = c.totalStats;
  ['pts','reb','ast','stl','blk','tov','fgm','fga','ftm','fta','threeM','threeA','mins'].forEach(function(f) {
    ts[f] = (ts[f] || 0) + (sp[f] || 0);
  });
  ts.games = (ts.games || 0) + (sp.games || 0);

  var po = STATE.season.playoffStats || {};
  var cpo = c.playoffStats;
  ['pts','reb','ast','stl','blk','tov','fgm','fga','ftm','fta','threeM','threeA','mins'].forEach(function(f) {
    cpo[f] = (cpo[f] || 0) + (po[f] || 0);
  });
  cpo.games = (cpo.games || 0) + (po.games || 0);

  honorList.forEach(function(h) { c.honors.push(h); });
  STATE._careerSaved = true;
}

function showSeasonDetail(idx) {
  var s = STATE.career.seasons[idx];
  if (!s) return;
  var sp = s.playerStats || {};
  var sg = sp.games || 1;
  var avg = {
    pts: Math.round((sp.pts || 0) / sg * 10) / 10,
    reb: Math.round((sp.reb || 0) / sg * 10) / 10,
    ast: Math.round((sp.ast || 0) / sg * 10) / 10,
    stl: Math.round((sp.stl || 0) / sg),
    blk: Math.round((sp.blk || 0) / sg),
  };
  var tn = getTeamName ? getTeamName(s.team) : s.team;
  var record = (s.wins || 0) + '-' + (s.losses || 0);
  var awardsHtml = '';
  if (s.awards && s.awards.length) {
    s.awards.forEach(function(a) {
      var label = (a && a.label) || a || '';
      if ((parseInt(s.seasonNum, 10) || 0) !== 1 && label.indexOf('最佳新秀') >= 0) return;
      awardsHtml += '<span class="ch-badge">' + label + '</span>';
    });
  }
  var ovr = s.ovr || '—';

  var html = '<div class="cs-season-detail-overlay" onclick="closeSeasonDetail(event)">';
  html += '<div class="cs-season-detail-modal">';
  html += '<div class="cs-detail-header"><span style="font-family:var(--font-display);font-size:16px;font-weight:700;">' + getSeasonLabel(s.seasonNum) + ' · ' + tn + '</span><button class="cs-detail-close" onclick="closeSeasonDetail()">✕</button></div>';
  html += '<div class="cs-detail-body">';
  html += '<div class="sr-info-row"><span>战绩</span><span>' + record + ' · OVR ' + ovr + '</span></div>';
  html += '<div class="sr-info-row"><span>场均</span><span style="font-weight:600;">' + avg.pts + '分 ' + avg.reb + '板 ' + avg.ast + '助 ' + avg.stl + '断 ' + avg.blk + '帽</span></div>';
  html += '<div style="margin:8px 0 4px;font-size:12px;color:var(--text-dim);">季后赛：' + (s.playoffResult || '未晋级') + '</div>';
  if (awardsHtml) {
    html += '<div style="margin-top:6px;">' + awardsHtml + '</div>';
  }
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeSeasonDetail(e) {
  if (e && e.target !== e.currentTarget) return;
  var el = document.querySelector('.cs-season-detail-overlay');
  if (el) el.remove();
}

// ==================== 荣誉墙 ====================
function showCareerHonors() {
  showScreen('screen-career-honors');
  var c = STATE.career;
  document.getElementById('career-honors-sub').textContent = '生涯共 ' + c.honors.length + ' 项荣誉 · ' + c.seasonCount + ' 个赛季';

  var html = '';
  if (c.seasons.length === 0) {
    html += '<div class="ch-empty">🏀 还没有荣誉，快去打比赛吧</div>';
  } else {
    for (var i = c.seasons.length - 1; i >= 0; i--) {
      var s = c.seasons[i];
      var tn = getTeamName ? getTeamName(s.team) : s.team;
      var seasHonors = c.honors.filter(function(h) { return h.seasonNum === s.seasonNum && !isRookieHonorForLaterSeason(h); });
      html += '<div class="ch-season">';
      html += '<div class="ch-season-header">🏀 ' + getSeasonLabel(s.seasonNum) + ' <span class="ch-team">' + tn + '</span></div>';
      if (seasHonors.length === 0) {
        html += '<div style="font-size:12px;color:var(--text-muted);">暂无荣誉</div>';
      } else {
        seasHonors.forEach(function(h) {
          var cls = 'ch-badge';
          if (h.label.indexOf('总冠军') >= 0 || h.label.indexOf('MVP') >= 0 || h.label.indexOf('FMVP') >= 0) cls += ' gold';
          html += renderHonorBadge(h.label, h.emoji, cls);
        });
      }
      html += '</div>';
    }
  }

  var counts = {};
  c.honors.forEach(function(h) {
    if (isRookieHonorForLaterSeason(h)) return;
    counts[h.label] = (counts[h.label] || 0) + 1;
  });
  var sumParts = [];
  for (var k in counts) {
    sumParts.push(counts[k] + '×' + k);
  }
  if (sumParts.length > 0) {
    html += '<div class="ch-summary">📊 生涯总计：' + sumParts.join(' · ') + '</div>';
  }

  html += '<div style="display:flex;gap:8px;justify-content:center;margin-top:6px;">';
  html += '<button class="btn btn-primary btn-sm" onclick="showCareerStats()">📊 生涯数据</button>';
  html += '<button class="btn btn-secondary btn-sm" onclick="showScreen(\'screen-mycard\')">📋 My Card</button>';
  html += '</div>';

  document.getElementById('career-honors-content').innerHTML = html;
}

// ==================== 训练营 ====================
function clampAttrVal(v) {
  var ceil = typeof ATTR_EVENT_CEILING === 'number' ? ATTR_EVENT_CEILING : 130;
  return Math.max(25, Math.min(ceil, Math.round(v)));
}

function addAttrDelta(key, delta) {
  if (key === 'STA') {
    if (!STATE.attrs) STATE.attrs = {};
    var staCeil = typeof ATTR_EVENT_CEILING === 'number' ? ATTR_EVENT_CEILING : 130;
    STATE.attrs.STA = Math.max(0, Math.min(staCeil, (Number(STATE.attrs.STA) || 0) + (Number(delta) || 0)));
    return;
  }
  if (!ATTR_KEYS.includes(key)) return;
  STATE.attrs[key] = clampAttrVal((STATE.attrs[key] || 50) + delta);
}

var EVENT_TRAINING_BANK_CAP = 5;

function getEventTrainingBank() {
  if (!STATE.career) return 0;
  return Math.max(0, Math.min(EVENT_TRAINING_BANK_CAP, Math.round(Number(STATE.career.trainingEventBank) || 0)));
}

function addEventTrainingPoints(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  if (!n || !STATE.career) return 0;
  var cur = getEventTrainingBank();
  var granted = Math.min(n, Math.max(0, EVENT_TRAINING_BANK_CAP - cur));
  if (!granted) return 0;
  STATE.career.trainingEventBank = cur + granted;
  return granted;
}

function consumeEventTrainingBank() {
  if (STATE.career) STATE.career.trainingEventBank = 0;
}

function formatTrainingPointGrant(n) {
  if (!n) return '';
  return '训练点+' + n + '，休赛期加点时可用（本季事件最多 +' + EVENT_TRAINING_BANK_CAP + '）。';
}

function applyEventTrainingGrant(result, n) {
  var got = addEventTrainingPoints(n);
  if (!got) return result || '';
  return (result || '') + '<br><br>' + formatTrainingPointGrant(got);
}

function getStaminaAttr() {
  return Math.max(0, Number(STATE.attrs && STATE.attrs.STA) || 0);
}

function getVeteranMaintenanceLevel(age) {
  if ((Number(age) || 0) < 31 || !STATE.career) return 0;
  var mods = getNextSeasonMods();
  var profile = getCareerProfile();
  var level = 0;
  if ((Number(mods.staminaLoad) || 0) <= -2) level++;
  if ((Number(mods.injuryRiskBonus) || 0) <= -2) level++;
  if ((Number(profile.coachTrust) || 0) >= 10) level++;
  level = Math.min(2, level);
  if (getStaminaAttr() >= 3) level++;
  return Math.min(3, level);
}

var ATTRIBUTE_AGING_GROUPS = {
  physical: ['ATH', 'DNK', 'PDEF', 'BLK', 'IDEF', 'REB'],
  hybrid: ['FIN', 'STR'],
  skill: ['threePT', 'MID', 'HAN', 'PAS', 'CLU']
};
var PLAYER_CAREER_MAX_AGE = 42;

function getAttributeAgingGroup(key) {
  if (ATTRIBUTE_AGING_GROUPS.physical.indexOf(key) >= 0) return 'physical';
  if (ATTRIBUTE_AGING_GROUPS.hybrid.indexOf(key) >= 0) return 'hybrid';
  return 'skill';
}

// 老化采用双判定：年龄决定基础阶段，当前属性决定该项的回落压力。
// 精英高位属性更难长期维持；低位属性存在地板效应，但不会免除高龄衰退。
function getAgeAttributeDeclinePlan(age, key, currentValue) {
  age = Number(age) || 22;
  currentValue = Number(currentValue) || 50;
  var group = getAttributeAgingGroup(key);
  var plan;

  if (age <= 30) return { chance:0, minLoss:0, maxLoss:0, group:group, band:'未进入衰退期', label:'状态维持' };
  if (age <= 33) {
    plan = group === 'physical'
      ? { chance:0.72, minLoss:1, maxLoss:1, label:'初期老化' }
      : (group === 'hybrid'
        ? { chance:0.42, minLoss:1, maxLoss:1, label:'初期老化' }
        : { chance:0.20, minLoss:1, maxLoss:1, label:'技术波动' });
  } else if (age <= 36) {
    plan = group === 'physical'
      ? { chance:1, minLoss:1, maxLoss:2, label:'老将下滑' }
      : (group === 'hybrid'
        ? { chance:0.86, minLoss:1, maxLoss:2, label:'老将下滑' }
        : { chance:0.58, minLoss:1, maxLoss:1, label:'技术回落' });
  } else if (age <= 39) {
    plan = group === 'physical'
      ? { chance:1, minLoss:2, maxLoss:3, label:'高龄下滑' }
      : (group === 'hybrid'
        ? { chance:0.97, minLoss:1, maxLoss:2, label:'高龄下滑' }
        : { chance:0.84, minLoss:1, maxLoss:2, label:'经验难抵年龄' });
  } else {
    plan = group === 'physical'
      ? { chance:1, minLoss:3, maxLoss:4, label:'生涯末期' }
      : (group === 'hybrid'
        ? { chance:1, minLoss:2, maxLoss:3, label:'生涯末期' }
        : { chance:1, minLoss:1, maxLoss:2, label:'生涯末期' });
  }

  var band = '常规属性';
  if (currentValue >= 95) {
    band = '巅峰高位';
    plan.chance = Math.min(1, plan.chance + 0.14);
    plan.maxLoss += 1;
    if (age >= 34) plan.minLoss += 1;
  } else if (currentValue >= 88) {
    band = '精英高位';
    plan.chance = Math.min(1, plan.chance + 0.08);
    plan.maxLoss += 1;
  } else if (currentValue <= 65) {
    band = '低位地板';
    plan.chance = Math.max(age >= 37 ? 0.72 : 0.18, plan.chance - 0.14);
  }
  plan.group = group;
  plan.band = band;
  return plan;
}

function rollAnnualAttributeDelta(age, key, currentValue, maintenanceLevel, randomFn) {
  var rng = typeof randomFn === 'function' ? randomFn : Math.random;
  var plan = getAgeAttributeDeclinePlan(age, key, currentValue);
  if (!plan.chance || rng() >= plan.chance) return 0;
  var range = Math.max(0, plan.maxLoss - plan.minLoss);
  var loss = plan.minLoss + Math.floor(rng() * (range + 1));

  // 保养只可能减免 1 点，且 34 岁后任何已触发的衰退至少保留 1 点。
  // 旧版最多每项减 2，常把整个衰退阶段直接抵消。
  var shieldChance = 0;
  if (maintenanceLevel >= 3) shieldChance = 0.78;
  else if (maintenanceLevel >= 2) shieldChance = 0.58;
  else if (maintenanceLevel === 1) shieldChance = 0.30;
  var minimumLoss = age >= 34 ? 1 : 0;
  if (shieldChance && loss > minimumLoss && rng() < shieldChance) loss--;
  return -Math.max(minimumLoss, loss);
}

function applyAnnualAttributeDrift() {
  var c = STATE.career;
  if (!c) return [];
  var seasonKey = c.seasonCount || 0;
  if (c.annualChangeSeason === seasonKey) return c.lastAnnualChanges || [];
  var age = c.currentAge || 22;
  var changes = [];
  var skillSnap = typeof PP_SKILLS !== 'undefined' ? PP_SKILLS.snapshotEffectiveLevels() : null;
  var maintenanceLevel = getVeteranMaintenanceLevel(age);
  var slowTech = ['threePT', 'MID', 'HAN', 'PAS', 'CLU'];

  function applyList(list, minDelta, maxDelta, label) {
    list.forEach(function(k) {
      var delta = minDelta + Math.floor(Math.random() * (maxDelta - minDelta + 1));
      if (delta < 0 && maintenanceLevel > 0) delta = Math.min(0, delta + maintenanceLevel);
      if (delta !== 0) {
        addAttrDelta(k, delta);
        changes.push((delta > 0 ? '+' : '') + delta + ' ' + attrCN(k) + (label ? '（' + label + '）' : ''));
      }
    });
  }

  if (age <= 25) {
    applyList(slowTech.concat(['FIN', 'ATH']), 0, 1, '成长');
  } else if (age <= 30) {
    ATTR_KEYS.forEach(function(k) {
      if (Math.random() < 0.3) {
        var d = Math.random() < 0.45 ? 1 : -1;
        addAttrDelta(k, d);
        changes.push((d > 0 ? '+' : '') + d + ' ' + attrCN(k) + '（状态波动）');
      }
    });
  } else {
    var totalLoss = 0;
    var declinedCount = 0;
    ATTR_KEYS.forEach(function(k) {
      var currentValue = Number(STATE.attrs[k]) || 50;
      var plan = getAgeAttributeDeclinePlan(age, k, currentValue);
      var delta = rollAnnualAttributeDelta(age, k, currentValue, maintenanceLevel);
      if (delta >= 0) return;
      addAttrDelta(k, delta);
      totalLoss += -delta;
      declinedCount++;
      changes.push(delta + ' ' + attrCN(k) + '（' + plan.label + '·' + plan.band + '）');
    });
    changes.unshift('老化双判定：' + age + '岁 × 当前属性，共 ' + declinedCount + ' 项 / ' + totalLoss + ' 点回落');
  }

  if (maintenanceLevel > 0 && age >= 31) {
    changes.unshift('老将保养 Lv.' + maintenanceLevel + '：部分衰退有概率减免 1 点，但不会清零高龄回落');
  }
  if (typeof PP_SKILLS !== 'undefined') {
    var skillNotes = PP_SKILLS.skillLevelChangeNotes(skillSnap);
    for (var sn = 0; sn < skillNotes.length; sn++) changes.push(skillNotes[sn]);
  }

  STATE.finalOVR = calcOVR(STATE.attrs);
  c.annualChangeSeason = seasonKey;
  c.lastAnnualChanges = changes;
  return changes;
}

function beginOffseason() {
  if (STATE.career && STATE.career.retired) {
    showCareerStats(1);
    return;
  }
  if (typeof grantSeasonStylePoints === 'function') {
    var grant = grantSeasonStylePoints();
    if (grant && grant.total > 0 && typeof PP_FX !== 'undefined' && PP_FX.toast) {
      PP_FX.toast((typeof PP_SKILLS !== 'undefined' && PP_SKILLS.formatGrantLine(grant)) || ('本季球风点 +' + grant.total), { gold: true, icon: '⚡', duration: 3600 });
    }
  }
  saveCurrentSeasonToCareer();
  if (STATE.career && STATE.career.flags && STATE.career.flags.countdownDone) {
    STATE._retirementOfferPhase = 'pre-training';
    showPlayerRetirementChoice();
    return;
  }
  var cdNode = getBranchNode('retirement_countdown');
  if (cdNode === 'final_show' || cdNode === 'final_pass' || cdNode === 'final_enjoy' || cdNode === 'final_hurt') {
    STATE._retirementOfferPhase = 'pre-training';
    startCountdownLegacyFlow();
    return;
  }
  applyAnnualAttributeDrift();
  var c = STATE.career;
  c.flags = c.flags || {};
  c.relationships = c.relationships || {};
  c.branchHistory = c.branchHistory || [];
  c.branches = c.branches || {};
  var seasonKey = c.seasonCount || 0;
  if (c.offseasonEventSeason === seasonKey) {
    renderTrainingCamp();
    return;
  }
  // 本季临时状态到此结束；从现在起写入的休赛期选择将完整带入下一季。
  clearSeasonModsForNewOffseason();
  c.offseasonEventSeason = seasonKey;
  STATE._offseasonQueue = buildBranchEventQueue('offseason');
  STATE._offseasonEventIdx = 0;
  showNextOffseasonEvent();
}

function buildOffseasonEventQueue() {
  return buildBranchEventQueue('offseason');
}

function getBranchEventSource() {
  return (typeof STAGED_BRANCH_EVENTS !== 'undefined') ? STAGED_BRANCH_EVENTS : BRANCH_EVENTS;
}

function getEventPhases(ev) {
  return ev.phases || [ev.phase || 'offseason'];
}

var DAG_PENDING_WEIGHT_BOOST = 40;

function isDagEventPending(ev) {
  if (!ev || !ev.branch || typeof ev.requires !== 'function') return false;
  var node = getBranchNode(ev.branch);
  if (!node || node === 'start') return false;
  try {
    return !!ev.requires();
  } catch(e) {
    return false;
  }
}

function getBranchEventWeight(ev) {
  var base = ev.weight || 10;
  return isDagEventPending(ev) ? base + DAG_PENDING_WEIGHT_BOOST : base;
}

function buildBranchEventQueue(phase, maxCount) {
  var source = getBranchEventSource();
  var pool = source.filter(function(ev) {
    return getEventPhases(ev).indexOf(phase) >= 0
      && !hasCareerEventBeenSeen(ev, STATE.career)
      && (!ev.requires || ev.requires());
  });
  if (phase === 'offseason') {
    return buildOffseasonBranchQueue(pool);
  }
  var queue = [];
  while (pool.length && queue.length < (maxCount || 1)) {
    var total = pool.reduce(function(sum, ev) { return sum + getBranchEventWeight(ev); }, 0);
    var roll = Math.random() * total;
    var pickedIdx = 0;
    for (var i = 0; i < pool.length; i++) {
      roll -= getBranchEventWeight(pool[i]);
      if (roll <= 0) { pickedIdx = i; break; }
    }
    queue.push(pool.splice(pickedIdx, 1)[0]);
  }
  return queue;
}

var OFFSEASON_MAX_MAIN_EVENTS = 2;
var OFFSEASON_MAX_TRAINING_EVENTS = 2;

function pickBranchEvents(pool, preferOngoing, count) {
  var picked = [];
  var remaining = (pool || []).slice();
  var usedBranches = {};
  while (remaining.length && picked.length < (count || 1)) {
    var candidates = remaining.filter(function(ev) { return !usedBranches[ev.branch]; });
    if (!candidates.length) break;
    var ev = pickBranchEvent(candidates, preferOngoing);
    if (!ev) break;
    picked.push(ev);
    usedBranches[ev.branch] = true;
    remaining.splice(remaining.indexOf(ev), 1);
  }
  return picked;
}

function buildOffseasonBranchQueue(pool) {
  var mainPool = pool.filter(function(ev) { return (ev.slot || 'main') === 'main'; });
  var trainingPool = pool.filter(function(ev) { return (ev.slot || 'main') === 'training'; });
  var queue = [];
  var relationshipForced = false;
  var relationshipStepForced = false;
  var countdownPool = mainPool.filter(function(ev) { return ev.branch === 'retirement_countdown'; });
  if (countdownPool.length > 0) {
    var forced = pickBranchEvent(countdownPool, true);
    if (forced) queue.push(forced);
  }
  // 恋爱兜底：前两个夏天未触发，第三个夏天必触发
  if (getBranchNode('relationship') === 'start' && (STATE.career.seasonCount || 0) >= 3) {
    var firstDate = mainPool.filter(function(ev) { return ev.id === 'relationship_first_date'; })[0];
    if (firstDate && (!firstDate.requires || firstDate.requires())) {
      queue.push(firstDate);
      relationshipForced = true;
    }
  }
  // 恋爱线一旦开启，每年休赛期都强制推进一个下个节点
  if (getBranchNode('relationship') !== 'start') {
    var relPool = mainPool.filter(function(ev) {
      return ev.branch === 'relationship' && (!ev.requires || ev.requires());
    });
    if (relPool.length > 0) {
      var relStep = pickBranchEvent(relPool, true);
      if (relStep) {
        queue.push(relStep);
        relationshipStepForced = true;
      }
    }
  }
  // 揽佬《中国人能飞》支线：一旦开启，每年夏天强制推进下一节点
  var crossoverStepForced = false;
  if (getBranchNode('crossover') !== 'start') {
    var crPool = mainPool.filter(function(ev) {
      return ev.branch === 'crossover' && (!ev.requires || ev.requires());
    });
    if (crPool.length > 0) {
      var crStep = pickBranchEvent(crPool, true);
      if (crStep) {
        queue.push(crStep);
        crossoverStepForced = true;
      }
    }
  }
  // 名宿 / 故乡等新剧情线：一旦开启，夏天优先推进下一节点
  var storyStepForced = false;
  var storyOffseasonBranch = null;
  var storyOffseasonPool = mainPool.filter(function(ev) {
    return (ev.branch === 'legend' || ev.branch === 'hometown' || ev.branch === 'craft' || ev.branch === 'voice' || ev.branch === 'bench' || ev.branch === 'load') && isDagEventPending(ev);
  });
  if (storyOffseasonPool.length > 0) {
    var storyStep = pickBranchEvent(storyOffseasonPool, true);
    if (storyStep) {
      queue.push(storyStep);
      storyStepForced = true;
      storyOffseasonBranch = storyStep.branch;
    }
  }
  var forcedMainCount = (relationshipForced ? 1 : 0) + (relationshipStepForced ? 1 : 0) + (crossoverStepForced ? 1 : 0) + (storyStepForced ? 1 : 0);
  var restMain = mainPool.filter(function(ev) {
    if (ev.branch === 'retirement_countdown') return false;
    if (relationshipForced && ev.id === 'relationship_first_date') return false;
    if (relationshipStepForced && ev.branch === 'relationship') return false;
    if (crossoverStepForced && ev.branch === 'crossover') return false;
    if (storyStepForced && ev.branch === storyOffseasonBranch) return false;
    return true;
  });
  return queue
    .concat(pickBranchEvents(restMain, false, Math.max(0, OFFSEASON_MAX_MAIN_EVENTS - forcedMainCount)))
    .concat(pickBranchEvents(trainingPool, false, OFFSEASON_MAX_TRAINING_EVENTS));
}

function pickBranchEvent(pool, preferOngoing) {
  if (!pool || pool.length === 0) return null;
  var candidates = pool;
  if (preferOngoing) {
    var ongoing = pool.filter(function(ev) { return isBranchOngoing(ev.branch); });
    if (ongoing.length > 0) candidates = ongoing;
  }
  var total = candidates.reduce(function(sum, ev) { return sum + getBranchEventWeight(ev); }, 0);
  var roll = Math.random() * total;
  for (var i = 0; i < candidates.length; i++) {
    roll -= getBranchEventWeight(candidates[i]);
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function getBranchState(branchId) {
  var c = STATE.career;
  c.branches = c.branches || {};
  if (!c.branches[branchId]) c.branches[branchId] = { stage: 0, points: 0 };
  var b = c.branches[branchId];
  if (branchId === 'relationship' && !b.node && (b.stage || 0) > 0) {
    if (b.stage === 1) b.node = b.status === 'declined' ? 'declined' : 'dating';
    else if (b.stage === 2) b.node = b.status === 'volatile' ? 'volatile' : 'stable';
    else if (b.stage === 3) b.node = b.status === 'crisis' ? 'crisis' : (b.status === 'public' ? 'public' : 'private');
  }
  if (branchId === 'family' && !b.node && (b.stage || 0) > 0) {
    b.node = b.status === 'delayed' ? 'career_priority' : 'family_plan';
  }
  if (branchId === 'china_market' && !b.node && (b.stage || 0) > 0) {
    b.node = b.status === 'grassroots' ? 'market_grassroots' : 'market_tour';
  }
  if (branchId === 'network' && !b.node && (b.stage || 0) > 0) {
    if (b.stage === 1) b.node = b.status === 'training' ? 'training_focus' : 'golf_meet';
    else if (b.stage === 2) b.node = b.status === 'private_circle' ? 'private_circle' : 'career_map_meeting';
    else if (b.stage === 3) b.node = b.identity === 'training_resource' ? 'training_resource' : 'business_circle';
  }
  if (branchId === 'rich_paul' && !b.node && (b.stage || 0) > 0) {
    b.node = b.status === 'stable_team' ? 'rich_paul_stable' : 'rich_paul_mapped';
  }
  if (branchId === 'team_practice' && !b.node && (b.stage || 0) > 0) {
    if (b.stage === 1) b.node = 'practice_start';
    else if (b.stage === 2) b.node = 'practice_response';
    else if (b.stage === 3) b.node = 'practice_identity';
  }
  if (branchId === 'teammate_bond' && !b.node && (b.stage || 0) > 0) {
    b.node = b.status === 'protected' ? 'bond_protected' : 'bond_extra';
  }
  if (branchId === 'mentor' && !b.node && (b.stage || 0) > 0) {
    var tb = getBranchState('training');
    if (!tb.node || tb.node === 'start') tb.node = b.stage === 1 ? 'mentor_first' : (b.stage === 2 ? 'mentor_deep' : 'training_identity');
  }
  if (branchId === 'skill_training' && !b.node && (b.stage || 0) > 0) {
    var tb2 = getBranchState('training');
    if (!tb2.node || tb2.node === 'start') tb2.node = b.stage === 1 ? 'skill_first' : (b.stage === 2 ? 'skill_deep' : 'training_identity');
  }
  return b;
}

function getCareerProfile() {
  var c = STATE.career;
  c.profile = c.profile || {};
  var defaults = { fame: 0, businessValue: 0, mediaTrust: 0, controversy: 0, chinaPopularity: 0, loyalty: 0, leadership: 0, coachTrust: 0, lockerRoomTrust: 0, fanSupport: 0, legacyBonus: 0 };
  Object.keys(defaults).forEach(function(k) {
    if (c.profile[k] == null) c.profile[k] = defaults[k];
  });
  return c.profile;
}

function clampCareerEffect(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

// 剧情属性对稳定系统的统一映射。所有效果均有硬上限，避免剧情数值取代球员能力。
function getCareerProfileEffects() {
  var p = STATE.career ? getCareerProfile() : {};
  var teamStanding = (Number(p.coachTrust) || 0) * 0.45
    + (Number(p.lockerRoomTrust) || 0) * 0.35
    + (Number(p.leadership) || 0) * 0.25
    + (Number(p.loyalty) || 0) * 0.15
    - (Number(p.controversy) || 0) * 0.30;
  var publicStanding = (Number(p.fame) || 0) * 0.18
    + (Number(p.businessValue) || 0) * 0.35
    + (Number(p.mediaTrust) || 0) * 0.25
    + (Number(p.fanSupport) || 0) * 0.20
    + (Number(p.chinaPopularity) || 0) * 0.15
    - (Number(p.controversy) || 0) * 0.30;
  return {
    teamStanding: teamStanding,
    publicStanding: publicStanding,
    lineupBonus: clampCareerEffect(Math.round(teamStanding / 6), -3, 3),
    minutesFactor: clampCareerEffect(1 + teamStanding * 0.006, 0.88, 1.12),
    gameOffenseBonus: clampCareerEffect((Number(p.leadership) || 0) * 0.05 + (Number(p.lockerRoomTrust) || 0) * 0.04, -1.2, 1.5),
    gameDefenseBonus: clampCareerEffect((Number(p.coachTrust) || 0) * 0.04 + (Number(p.leadership) || 0) * 0.04, -1.0, 1.3),
    gameVarianceBonus: clampCareerEffect(((Number(p.controversy) || 0) - (Number(p.mediaTrust) || 0)) * 0.04, -0.8, 0.8),
    homeCourtBonus: clampCareerEffect((Number(p.fanSupport) || 0) * 0.00065, -0.004, 0.010),
    awardAllStarScore: clampCareerEffect((Number(p.fame) || 0) * 0.16, -0.4, 2.4),
    awardAllStarSwing: clampCareerEffect((Number(p.fame) || 0) * 0.006, 0, 0.08),
    awardMvpExtraTickets: clampCareerEffect((Number(p.mediaTrust) || 0) * 0.06, 0, 1.2),
    awardDpoyStockBump: clampCareerEffect((Number(p.mediaTrust) || 0) * 0.012, 0, 0.18),
    awardFmvpPpgRelief: clampCareerEffect((Number(p.mediaTrust) || 0) * 0.1, 0, 1.2),
    tradeChanceDelta: clampCareerEffect(Math.round((Number(p.controversy) || 0) * 0.25 - (Number(p.coachTrust) || 0) * 0.20 - (Number(p.lockerRoomTrust) || 0) * 0.15 - (Number(p.loyalty) || 0) * 0.12), -7, 7),
    waiveChanceDelta: clampCareerEffect(Math.round((Number(p.controversy) || 0) * 0.25 - (Number(p.coachTrust) || 0) * 0.18 - (Number(p.fanSupport) || 0) * 0.12 - (Number(p.lockerRoomTrust) || 0) * 0.10), -8, 8),
    renewalChanceBonus: clampCareerEffect((Number(p.coachTrust) || 0) * 0.006 + (Number(p.lockerRoomTrust) || 0) * 0.004 + (Number(p.loyalty) || 0) * 0.004 + (Number(p.fanSupport) || 0) * 0.002 + (Number(p.businessValue) || 0) * 0.001 - (Number(p.controversy) || 0) * 0.006, -0.20, 0.20),
    contractOfferBonus: publicStanding >= 16 ? 2 : (publicStanding >= 7 ? 1 : (publicStanding <= -7 ? -1 : 0)),
    legacyScoreContribution: clampCareerEffect(Math.round(Number(p.legacyBonus) || 0), -15, 20)
  };
}

function addProfileDelta(key, delta) {
  var p = getCareerProfile();
  p[key] = Math.max(-20, Math.min(99, (p[key] || 0) + (delta || 0)));
  if (typeof clearLineupCache === 'function') clearLineupCache();
  if (STATE.season && STATE.careerTeam && typeof syncUserStarterStatus === 'function') syncUserStarterStatus();
  refreshPlayerStateStripLive();
  return p[key];
}

function addSeasonMod(key, delta, minVal, maxVal) {
  var mods = getNextSeasonMods();
  if (mods[key] == null) mods[key] = 0;
  var min = minVal == null ? -10 : minVal;
  var max = maxVal == null ? 10 : maxVal;
  mods[key] = Math.max(min, Math.min(max, mods[key] + (delta || 0)));
  refreshPlayerStateStripLive();
  return mods[key];
}

var EVENT_ATTRIBUTE_LABELS = {
  fame:'人气', businessValue:'商业价值', mediaTrust:'媒体信任', controversy:'争议',
  chinaPopularity:'中国人气', loyalty:'忠诚', leadership:'领导力', coachTrust:'教练信任',
  lockerRoomTrust:'更衣室信任', fanSupport:'球迷支持', legacyBonus:'传奇声望',
  injuryRiskBonus:'伤病风险', formVariance:'状态波动', teamChemistry:'球队默契',
  moraleBonus:'士气', mediaPressure:'媒体压力', staminaLoad:'体能负荷',
  draftStockBonus:'选秀行情', mentalPressure:'压力', currentAge:'年龄'
};

function captureEventAttributeSnapshot() {
  var snapshot = {};
  var profile = STATE.career && STATE.career.profile ? STATE.career.profile : {};
  var mods = STATE.career && STATE.career.nextSeasonMods ? STATE.career.nextSeasonMods : {};
  ['fame','businessValue','mediaTrust','controversy','chinaPopularity','loyalty','leadership','coachTrust','lockerRoomTrust','fanSupport','legacyBonus'].forEach(function(key) {
    snapshot['profile.' + key] = Number(profile[key]) || 0;
  });
  ['injuryRiskBonus','formVariance','teamChemistry','moraleBonus','mediaPressure','staminaLoad'].forEach(function(key) {
    snapshot['mods.' + key] = Number(mods[key]) || 0;
  });
  (typeof ATTR_KEYS !== 'undefined' ? ATTR_KEYS : []).forEach(function(key) {
    if (STATE.attrs && STATE.attrs[key] != null) snapshot['attr.' + key] = Number(STATE.attrs[key]) || 0;
  });
  if (STATE.attrs) snapshot['attr.STA'] = Number(STATE.attrs.STA) || 0;
  if (STATE._draftPending) snapshot['draft.draftStockBonus'] = Number(STATE._draftPending.draftStockBonus) || 0;
  if (STATE.career && STATE.career.currentAge != null) snapshot['career.currentAge'] = Number(STATE.career.currentAge) || 0;
  if (typeof getMentalPressure === 'function') snapshot['derived.mentalPressure'] = Number(getMentalPressure()) || 0;
  return snapshot;
}

function getEventAttributeLabel(path) {
  var key = path.split('.').pop();
  if (path.indexOf('attr.') === 0 && typeof attrCN === 'function') return attrCN(key);
  return EVENT_ATTRIBUTE_LABELS[key] || key;
}

function diffEventAttributeSnapshot(before) {
  if (!before) return null;
  var after = captureEventAttributeSnapshot();
  var changes = [];
  Object.keys(after).forEach(function(path) {
    if (!Object.prototype.hasOwnProperty.call(before, path)) return;
    var delta = Math.round((after[path] - before[path]) * 10) / 10;
    if (Math.abs(delta) < 0.01) return;
    changes.push({ key:path, label:getEventAttributeLabel(path), delta:delta, value:after[path] });
  });
  return changes;
}

function renderEventAttributeChanges(changes) {
  var html = '<div class="event-attribute-summary" data-event-attribute-summary>';
  html += '<div class="event-attribute-title">本次实际数值变化</div>';
  if (!changes || !changes.length) {
    html += '<div class="event-attribute-empty">本次无可见属性变化</div>';
  } else {
    html += '<div class="event-attribute-list">';
    changes.forEach(function(change) {
      var delta = change.delta;
      var deltaText = (delta > 0 ? '+' : '') + delta;
      html += '<span class="event-attribute-chip ' + (delta > 0 ? 'up' : 'down') + '">' + change.label + ' <strong>' + deltaText + '</strong></span>';
    });
    html += '</div>';
  }
  return html + '</div>';
}

function getBranchStage(branchId) {
  return getBranchState(branchId).stage || 0;
}

function getBranchNode(branchId) {
  var b = getBranchState(branchId);
  return b.node || 'start';
}

function isBranchOngoing(branchId) {
  if (!branchId || !STATE.career || !STATE.career.branches) return false;
  var b = STATE.career.branches[branchId];
  return !!(b && (b.stage > 0 || b.status || (b.node && b.node !== 'start')));
}

function bindBondedTeammate() {
  if (!STATE.career || !STATE.careerTeam || !NBA2K_DATA) return null;
  var roster = NBA2K_DATA[STATE.careerTeam] || [];
  var candidates = roster.filter(function(p) { return p && !p._isUser; });
  if (!candidates.length) return null;
  var pick = candidates[Math.floor(Math.random() * candidates.length)];
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.bondedTeammate = {
    name: pick.name,
    cname: pick.cname || pick.name,
    pos: pick.pos,
    ovr: pick.ovr,
    team: STATE.careerTeam,
    sinceSeason: STATE.career.seasonCount
  };
  return STATE.career.flags.bondedTeammate;
}

function getBondedTeammateStatus() {
  var t = STATE.career && STATE.career.flags && STATE.career.flags.bondedTeammate;
  if (!t || !t.name) return null;
  var found = null;
  NBA2K_TEAMS.forEach(function(team) {
    if (found) return;
    (NBA2K_DATA[team] || []).forEach(function(p) {
      if (p && p.name === t.name) found = team;
    });
  });
  if (!found) return 'retired_released';
  return found === STATE.careerTeam ? 'same_team' : 'traded';
}

function getBondedTeammateName() {
  var t = STATE.career && STATE.career.flags && STATE.career.flags.bondedTeammate;
  return (t && (t.cname || t.name)) || '那位队友';
}

function fillBranchEventText(str) {
  var flags = STATE.career && STATE.career.flags ? STATE.career.flags : {};
  var recruiter = flags.superstarRecruiterName || '那位巨星';
  var recruitTeam = flags.superstarRecruitTargetTeam ? (getTeamName ? getTeamName(flags.superstarRecruitTargetTeam) : flags.superstarRecruitTargetTeam) : '他的球队';
  return String(str || '')
    .replace(/\{队友\}/g, getBondedTeammateName())
    .replace(/\{招募者\}/g, recruiter)
    .replace(/\{招募球队\}/g, recruitTeam);
}

function getSuperstarRecruitPool() {
  return [
    { aliases: ['卢卡·东契奇','卢卡-东契奇','Luka Dončić','Luka Doncic'], weight: 2 },
    { aliases: ['扬尼斯·阿德托昆博','扬尼斯-阿德托昆博','Giannis Antetokounmpo'], weight: 2 },
    { aliases: ['谢伊·吉尔杰斯-亚历山大','谢伊-吉尔杰斯-亚历山大','Shai Gilgeous-Alexander'], weight: 2 },
    { aliases: ['杰森·塔图姆','杰森-塔图姆','Jayson Tatum'], weight: 1.6 },
    { aliases: ['安东尼·爱德华兹','安东尼-爱德华兹','Anthony Edwards'], weight: 1.8 },
    { aliases: ['维克托·文班亚马','维克托-文班亚马','Victor Wembanyama'], weight: 6 }
  ];
}

function getSuperstarRecruitMatch(cn, en) {
  var pool = getSuperstarRecruitPool();
  for (var i = 0; i < pool.length; i++) {
    var aliases = pool[i].aliases || [];
    if (aliases.indexOf(cn) >= 0 || aliases.indexOf(en) >= 0) return pool[i];
  }
  return null;
}

function pickWeightedRecruitCandidate(candidates) {
  var total = candidates.reduce(function(sum, c) {
    var ovrBonus = 1 + Math.max(0, (c.ovr || 0) - 88) * 0.04;
    return sum + (c.recruitWeight || 1) * ovrBonus;
  }, 0);
  if (total <= 0) return candidates[0] || null;
  var roll = Math.random() * total;
  for (var i = 0; i < candidates.length; i++) {
    var weight = (candidates[i].recruitWeight || 1) * (1 + Math.max(0, (candidates[i].ovr || 0) - 88) * 0.04);
    roll -= weight;
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1] || null;
}

function findRecruitingSuperstar() {
  if (!NBA2K_TEAMS || !NBA2K_DATA) return null;
  var candidates = [];
  NBA2K_TEAMS.forEach(function(t) {
    if (t === STATE.careerTeam) return;
    var roster = NBA2K_DATA[t] || [];
    roster.forEach(function(p) {
      var cn = p.cname || p.name || '';
      var en = p.name || '';
      var match = getSuperstarRecruitMatch(cn, en);
      if (!match) return;
      var ovr = parseInt(p.ovr) || 0;
      if (ovr < 88) return;
      candidates.push({ name: cn, nameEN: p.name || '', team: t, ovr: ovr, recruitWeight: match.weight || 1 });
    });
  });
  if (!candidates.length) return null;
  return pickWeightedRecruitCandidate(candidates);
}

function prepareSuperstarRecruitment() {
  var c = STATE.career;
  if (!c) return null;
  c.flags = c.flags || {};
  if (c.flags.superstarRecruiterName && c.flags.superstarRecruitTargetTeam) {
    return { name: c.flags.superstarRecruiterName, team: c.flags.superstarRecruitTargetTeam };
  }
  var star = findRecruitingSuperstar();
  if (!star) return null;
  c.flags.superstarRecruiterName = star.name;
  c.flags.superstarRecruiterEN = star.nameEN || '';
  c.flags.superstarRecruitTargetTeam = star.team;
  return star;
}

function getRelationshipPartnerType() {
  var p = STATE.career && STATE.career.relationships && STATE.career.relationships.partner;
  return (p && p.type) || 'actress';
}

function isBranchChoiceLocked(ch) {
  if (!ch || typeof ch.requires !== 'function') return false;
  try { return !ch.requires(); } catch(e) { return true; }
}

function applyChoiceBonus(ch, msg) {
  if (!ch || typeof ch.bonus !== 'function') return msg;
  var bonus = null;
  try { bonus = ch.bonus(); } catch(e) { return msg; }
  if (bonus && bonus.text) msg = (msg || '') + '<br><br>强化：' + bonus.text;
  return msg;
}

function getMentalPressure() {
  if (!STATE.career) return 0;
  var mods = getNextSeasonMods();
  var profile = STATE.career.profile || {};
  var rl = getBranchNode('relationship');
  var fm = getBranchNode('family');
  var md = getBranchNode('media');
  var fc = getBranchNode('fan_culture');
  var tp = getBranchNode('team_practice');
  var score = 0;
  score += (mods.mediaPressure || 0) * 1.5;
  score += (profile.controversy || 0);
  score += (mods.formVariance || 0) * 1.5;
  score += (mods.injuryRiskBonus || 0);
  if (rl === 'hurt_scar' || rl === 'hurt_guard' || rl === 'hurt_moved_on') score += 6;
  if (fm === 'family_regret' || fm === 'family_pressure') score += 4;
  if (md === 'persona_controversial') score += 4;
  if (fc === 'fan_controversial') score += 4;
  if (tp === 'practice_identity' && getBranchState('team_practice').identity === 'locker_room_leader') score += 2;
  return score;
}

function isCityTransfer() {
  var city = getBranchState('city_culture');
  if (!city.team || !STATE.careerTeam) return false;
  var node = getBranchNode('city_culture');
  if (node === 'start') return false;
  return city.team !== STATE.careerTeam;
}

function advanceBranch(branchId, delta, data) {
  var b = getBranchState(branchId);
  b.stage = Math.max(0, (b.stage || 0) + (delta || 1));
  if (data) {
    Object.keys(data).forEach(function(k) { b[k] = data[k]; });
  }
  return b;
}

function setBranchStage(branchId, stage, data) {
  var b = getBranchState(branchId);
  b.stage = Math.max(0, stage || 0);
  if (data) {
    Object.keys(data).forEach(function(k) { b[k] = data[k]; });
  }
  return b;
}

function setBranchNode(branchId, node, data) {
  var b = getBranchState(branchId);
  b.node = node || 'start';
  if (data) {
    Object.keys(data).forEach(function(k) { b[k] = data[k]; });
  }
  return b;
}

function recordBranchChoice(ev, ch, msg, phase) {
  var c = STATE.career;
  var playerMsg = sanitizePlayerFacingText(msg);
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: c.seasonCount,
    phase: phase || ev.phase || 'offseason',
    branch: ev.branch || ev.id,
    eventId: ev.id,
    event: getPlayerFacingBranchTitle(ev.title),
    choice: ch.label,
    result: playerMsg
  });
  if ((phase || ev.phase || 'offseason') === 'offseason') {
    c.offseasonHistory = c.offseasonHistory || [];
    c.offseasonHistory.push({ seasonNum: c.seasonCount, eventId: ev.id, event: getPlayerFacingBranchTitle(ev.title), choice: ch.label, result: playerMsg });
  }
  markCareerEventSeen(ev, c);
}

var SEASON_BRANCH_EVENT_CONFIG = {
  chancePercent: 14,
  cooldownGames: 7,
  maxPerSeason: 5,
  maxWithRelationship: 5,
  openingGames: 12,
  noRepeatCareer: true,
  // 日常见过后仍可再出：第 n 次权重 = max(floor, decay^n)
  seenRepeatDecay: 0.4,
  seenRepeatFloor: 0.1
};

function isCareerEventRepeatable(event) {
  return !!(event && event.repeatable === true);
}

function isDailySeasonEvent(event) {
  if (!event) return false;
  var id = event.id || '';
  var branch = event.branch || '';
  return id.indexOf('pp_season_') === 0 || branch.indexOf('pp_moment_') === 0;
}

// 所有叙事事件共用同一份生涯去重记录；旧存档会从既有历史自动迁移。
function getSeenCareerEventIds(career) {
  var c = career || STATE.career || {};
  var ids = [];
  function add(id) {
    if (id && ids.indexOf(id) < 0) ids.push(id);
  }
  function addTimelineEntry(entry) {
    if (!entry) return;
    add(entry.eventId);
    // 兼容本次修复前、只有标题而没有 eventId 的当前赛季伤病记录。
    if (!entry.eventId && entry.title && typeof EVENT_REGISTRY !== 'undefined') {
      for (var i = 0; i < EVENT_REGISTRY.length; i++) {
        if (EVENT_REGISTRY[i] && EVENT_REGISTRY[i].name === entry.title) {
          add(EVENT_REGISTRY[i].id);
          break;
        }
      }
    }
  }
  (c._seenCareerEventIds || []).forEach(add);
  (c._seenSeasonEventIds || []).forEach(add);
  // 兼容旧存档：把旧的最近事件、剧情历史和休赛期纪事迁移为生涯永久记录。
  (c._recentSeasonEventIds || []).forEach(add);
  (c.branchHistory || []).forEach(function(entry) {
    if (entry) add(entry.eventId);
  });
  (c.offseasonHistory || []).forEach(function(entry) {
    if (entry) add(entry.eventId);
  });
  (c.seasons || []).forEach(function(season) {
    (season && season.eventTimeline || []).forEach(addTimelineEntry);
  });
  var activeEvents = STATE.season && STATE.season.events;
  (activeEvents && activeEvents.triggeredIds || []).forEach(add);
  (activeEvents && activeEvents.storyTimeline || []).forEach(addTimelineEntry);
  c._seenCareerEventIds = ids;
  return ids;
}

function hasCareerEventBeenSeen(event, career) {
  if (!event || !event.id || isCareerEventRepeatable(event)) return false;
  return getSeenCareerEventIds(career).indexOf(event.id) >= 0;
}

function markCareerEventSeen(event, career) {
  if (!event || !event.id || isCareerEventRepeatable(event)) return;
  var c = career || STATE.career || {};
  var ids = getSeenCareerEventIds(c);
  if (ids.indexOf(event.id) < 0) ids.push(event.id);
  c._seenCareerEventIds = ids;
}

function getSeenSeasonEventIds(career) {
  return getSeenCareerEventIds(career);
}

function hasSeasonEventBeenSeen(event, career) {
  return hasCareerEventBeenSeen(event, career);
}

function markSeasonEventSeen(event, career) {
  if (!event || !event.id) return;
  var c = career || STATE.career || {};
  markCareerEventSeen(event, c);
  c._seenSeasonEventIds = c._seenSeasonEventIds || [];
  if (c._seenSeasonEventIds.indexOf(event.id) < 0) c._seenSeasonEventIds.push(event.id);
  c._seasonEventPlayCounts = c._seasonEventPlayCounts || {};
  c._seasonEventPlayCounts[event.id] = (Number(c._seasonEventPlayCounts[event.id]) || 0) + 1;
}

function getSeasonEventPlayCount(event, career) {
  if (!event || !event.id) return 0;
  var c = career || STATE.career || {};
  var counts = c._seasonEventPlayCounts || {};
  var n = Number(counts[event.id]) || 0;
  if (n > 0) return n;
  return getSeenCareerEventIds(c).indexOf(event.id) >= 0 ? 1 : 0;
}

function getSeasonEventRepeatWeight(event, career) {
  if (!isDailySeasonEvent(event)) return 1;
  var n = getSeasonEventPlayCount(event, career);
  if (n <= 0) return 1;
  var decay = SEASON_BRANCH_EVENT_CONFIG.seenRepeatDecay;
  var floor = SEASON_BRANCH_EVENT_CONFIG.seenRepeatFloor;
  return Math.max(floor, Math.pow(decay, n));
}

function getSeasonEventState(game, result, stats) {
  var season = STATE.season || {};
  var career = STATE.career || {};
  var profile = career.profile || {};
  var mods = career.nextSeasonMods || {};
  var games = season.games || [];
  var standing = season.standings && season.standings[STATE.careerTeam] || {};
  var gamesPlayed = games.length;
  var recent = games.slice(-5).filter(function(entry) { return entry && entry.result; });
  var recentWins = recent.filter(function(entry) { return !!entry.result.won; }).length;
  var recentPlayerGames = recent.filter(function(entry) { return entry.stats; });
  var recentPts = recentPlayerGames.length ? recentPlayerGames.reduce(function(sum, entry) { return sum + (Number(entry.stats.pts) || 0); }, 0) / recentPlayerGames.length : 0;
  var seasonPpg = season.playerStats && season.playerStats.games
    ? (Number(season.playerStats.pts) || 0) / season.playerStats.games
    : recentPts;
  var fgPct = stats && stats.fga ? (Number(stats.fgm) || 0) / stats.fga : null;
  var currentPts = stats ? Number(stats.pts) || 0 : null;
  var won = !!(result && result.won);
  var home = game && game.home != null ? !!game.home : true;
  var day = game && Number.isFinite(Number(game.day)) ? Number(game.day) : 0;
  var streakType = standing.streak || '';
  var streakLen = Number(standing.streakLen) || 0;
  var mentalPressure = typeof getMentalPressure === 'function' ? getMentalPressure() : 0;
  var isRookie = (career.seasonCount || 0) === 0;
  var poorPerformance = !!stats && ((currentPts < Math.max(12, seasonPpg * 0.7)) || (fgPct != null && fgPct < 0.36) || (Number(stats.tov) || 0) >= 5);
  var hotPerformance = !!stats && ((currentPts >= Math.max(28, seasonPpg * 1.25)) || (fgPct != null && fgPct >= 0.56));
  var deadlineWindow = (day >= 96 && day <= 118) || (gamesPlayed >= 47 && gamesPlayed <= 61);
  var nationalSpotlight = (Number(profile.fame) || 0) >= 7 || (STATE.finalOVR || 0) >= 88 || (gamesPlayed >= 12 && gamesPlayed % 11 === 0);
  var contractYears = Number(career.contract);
  return {
    gamesPlayed: gamesPlayed,
    home: home,
    road: !home,
    won: won,
    lost: !won,
    day: day,
    streak: streakType === 'W' && streakLen >= 3,
    slump: streakType === 'L' && streakLen >= 2,
    streakLen: streakLen,
    recentWins: recentWins,
    winPct: gamesPlayed ? (Number(season.wins) || 0) / gamesPlayed : 0.5,
    poorPerformance: poorPerformance,
    hotPerformance: hotPerformance,
    recentPts: recentPts,
    seasonPpg: seasonPpg,
    highFatigue: (Number(mods.staminaLoad) || 0) >= 3,
    highPressure: mentalPressure >= 8,
    injuryConcern: (Number(mods.injuryRiskBonus) || 0) >= 2 || !!(season.events && season.events.injuryGamesLeft > 0),
    lowChemistry: (Number(mods.teamChemistry) || 0) <= -2,
    highControversy: (Number(profile.controversy) || 0) >= 4,
    highFame: (Number(profile.fame) || 0) >= 7,
    nationalSpotlight: nationalSpotlight,
    deadlineWindow: deadlineWindow,
    isRookie: isRookie,
    isPlayoff: !!season.isPlayoffs,
    sophomore: (career.seasonCount || 0) === 1,
    veteran: (career.seasonCount || 0) >= 4 || (career.currentAge || 0) >= 30,
    benchRole: gamesPlayed >= 15 && seasonPpg < 11 && (STATE.finalOVR || 80) < 87,
    contractYear: Number.isFinite(contractYears) && contractYears <= 1
  };
}

function isSeasonEventStateEligible(ev, state) {
  if (!ev || !state) return true;
  var contextId = ev.contextId || '';
  if (contextId === 'home' && !state.home) return false;
  if (contextId === 'road' && !state.road) return false;
  if (contextId === 'streak' && !state.streak) return false;
  if (contextId === 'slump' && !state.slump) return false;
  if (contextId === 'national' && !state.nationalSpotlight) return false;
  if (contextId === 'deadline' && !state.deadlineWindow) return false;
  if (contextId === 'playoff' && !state.isPlayoff) return false;
  if (ev.stateContext === 'rookie_wall' && (!state.isRookie || state.gamesPlayed < 18)) return false;
  if (ev.stateContext === 'home_struggle' && (!state.home || (!state.lost && !state.poorPerformance))) return false;
  if (ev.stateContext === 'road_win' && (!state.road || !state.won)) return false;
  if (ev.stateContext === 'loss_press' && !state.lost) return false;
  if (ev.stateContext === 'teammate_slump' && !state.slump && !state.lowChemistry) return false;
  if (ev.stateContext === 'sophomore' && !state.sophomore) return false;
  if (ev.stateContext === 'veteran' && !state.veteran) return false;
  if (ev.stateContext === 'playoff' && !state.isPlayoff) return false;
  if (ev.stateContext === 'hot_night' && !state.hotPerformance) return false;
  if (ev.stateContext === 'fatigue' && !state.highFatigue && !state.injuryConcern) return false;
  if (ev.stateContext === 'bench_role' && !state.benchRole) return false;
  var topic = ev.topicId || '';
  if (topic === 'trade_source' && !state.deadlineWindow) return false;
  if (topic === 'extension_talk' && !state.contractYear) return false;
  if (topic === 'coach_callout' && !state.slump && !state.poorPerformance && !state.lowChemistry) return false;
  if (topic === 'medical_opinion' && !state.injuryConcern && !state.highFatigue) return false;
  if ((topic === 'tv_feature' || topic === 'brand_script') && !state.highFame && !state.nationalSpotlight) return false;
  return true;
}

function getSeasonEventStateWeight(ev, state) {
  var weight = 1;
  var topic = ev && ev.topicId || '';
  if (ev && ev.contextId && ev.contextId !== 'home' && ev.contextId !== 'road') weight *= 1.3;
  if (state.slump && ['locker_music','players_meeting','switch_defense','late_pass','coach_callout'].indexOf(topic) >= 0) weight *= 1.8;
  if (state.streak && ['team_dinner','rookie_advice','veteran_rest','fan_letter'].indexOf(topic) >= 0) weight *= 1.5;
  if ((state.highFatigue || state.injuryConcern) && ['rookie_wall','recovery_lab','recovery_slot','sleep_tracker','medical_opinion','weight_room'].indexOf(topic) >= 0) weight *= 2;
  if ((state.highPressure || state.highControversy) && ['quote_context','rumor_clip','local_radio','tv_feature','privacy_leak','agent_plan'].indexOf(topic) >= 0) weight *= 1.8;
  if (state.lowChemistry && ['locker_music','practice_argument','players_meeting','switch_defense','flight_seat'].indexOf(topic) >= 0) weight *= 1.8;
  if (state.poorPerformance && ['empty_gym','film_session','shot_map','late_pass','free_throw','coach_callout'].indexOf(topic) >= 0) weight *= 2;
  if (state.hotPerformance && ['shot_map','late_pass','free_throw','coach_callout'].indexOf(topic) >= 0) weight *= 0.35;
  if (['rival_first','rival_media','rival_christmas','rival_finale','derby_week','derby_object','derby_revenge'].indexOf(topic) >= 0) weight *= 1.6;
  if (state.nationalSpotlight && ['rival_christmas','last_shot_right','iso_clearout','closeout_ball'].indexOf(topic) >= 0) weight *= 1.7;
  if (state.deadlineWindow && ['trade_whiteboard','superteam_rumor'].indexOf(topic) >= 0) weight *= 2;
  if (state.injuryConcern && topic === 'return_from_injury') weight *= 2.2;
  if (state.highFatigue && topic === 'load_manage_leak') weight *= 2;
  return Math.max(0.15, weight);
}

function getSeasonEventPickWeight(ev, state) {
  return getBranchEventWeight(ev) * getSeasonEventStateWeight(ev, state) * getSeasonEventRepeatWeight(ev);
}

function pickSeasonStateAwareEvent(pool, state) {
  if (!pool || !pool.length) return null;
  var total = pool.reduce(function(sum, ev) {
    return sum + getSeasonEventPickWeight(ev, state);
  }, 0);
  var roll = Math.random() * total;
  for (var i = 0; i < pool.length; i++) {
    roll -= getSeasonEventPickWeight(pool[i], state);
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function checkSeasonBranchEvent(game, result, stats) {
  if (!STATE.career || !STATE.season || STATE.season.isPlayoffs) return null;
  var c = STATE.career;
  var eventState = getSeasonEventState(game, result, stats);
  c._lastSeasonEventState = eventState;
  c.branchHistory = c.branchHistory || [];
  c.branchSeasonEvents = c.branchSeasonEvents || {};
  var seasonKey = c.seasonCount || 0;
  if (c.branchSeasonEvents._season !== seasonKey) {
    c.branchSeasonEvents = { _season: seasonKey, _count: 0 };
    c._lastSeasonBranchGame = null;
  }
  // 退役倒计时：按赛程均等分布触发，赛季内独占
  var gamesPlayed = (STATE.season.games || []).length;
  var totalGames = (STATE.season.schedule || []).length;
  var countdownActive = getBranchNode('retirement_countdown') !== 'start';
  if (totalGames > 0 && gamesPlayed >= 1) {
    var countdownSteps = [
      { id: 'countdown_trigger', slot: 0 },
      { id: 'countdown_reflect', slot: 1 },
      { id: 'countdown_close', slot: 2 }
    ];
    var countdownPool = [];
    countdownSteps.forEach(function(st) {
      var ev = getBranchEventById(st.id);
      if (!ev) return;
      if (getEventPhases(ev).indexOf('season') < 0) return;
      if (hasSeasonEventBeenSeen(ev, c)) return;
      try {
        if (ev.requires && !ev.requires({ game: game, result: result, stats: stats })) return;
      } catch(e) { return; }
      var target = 1 + Math.round((totalGames - 1) * (st.slot / 2));
      if (gamesPlayed >= target) countdownPool.push(ev);
    });
    if (countdownPool.length > 0) {
      var forced = pickBranchEvent(countdownPool, true);
      if (forced) {
        c._lastSeasonBranchGame = (STATE.season.games || []).length;
        markSeasonEventSeen(forced, c);
        return forced;
      }
    }
  }
  // 倒计时赛季不弹其它赛季事件
  if (countdownActive) return null;
  var sinceLast = null;
  if (c._lastSeasonBranchGame != null) {
    sinceLast = (STATE.season.games || []).length - c._lastSeasonBranchGame;
    if (sinceLast < SEASON_BRANCH_EVENT_CONFIG.cooldownGames) return null;
  }
  // 恋爱线一旦开启，每年赛季中都保证推进一次下个节点
  var romanceStepPool = [];
  if (!c.branchSeasonEvents.relationship && totalGames > 0) {
    romanceStepPool = getBranchEventSource().filter(function(ev) {
      if (ev.branch !== 'relationship') return false;
      if (getEventPhases(ev).indexOf('season') < 0) return false;
      if (hasSeasonEventBeenSeen(ev, c)) return false;
      return !ev.requires || ev.requires({ game: game, result: result, stats: stats });
    });
  }
  if (romanceStepPool.length > 0) {
    var romanceMinGame = Math.max(10, Math.round(totalGames * 0.25));
    if (gamesPlayed >= romanceMinGame && (sinceLast == null || sinceLast >= 10)) {
      var forcedRomance = pickBranchEvent(romanceStepPool, true);
      if (forcedRomance) {
        c._lastSeasonBranchGame = (STATE.season.games || []).length;
        c.branchSeasonEvents.relationship = true;
        c.branchSeasonEvents._count = (c.branchSeasonEvents._count || 0) + 1;
        markSeasonEventSeen(forcedRomance, c);
        return forcedRomance;
      }
    }
  }
  // 宿敌 / 德比 / 名宿 / 故乡 / 火炬 / 全明星：已开启的线每季保证推进一次
  var storyArcs = ['rival', 'derby', 'legend', 'hometown', 'torch'];
  if (!c.branchSeasonEvents._storyArc && totalGames > 0) {
    var storyStepPool = getBranchEventSource().filter(function(ev) {
      if (storyArcs.indexOf(ev.branch) < 0) return false;
      if (getEventPhases(ev).indexOf('season') < 0) return false;
      if (hasSeasonEventBeenSeen(ev, c)) return false;
      if (c.branchSeasonEvents[ev.branch]) return false;
      try { return isDagEventPending(ev); }
      catch (e) { return false; }
    });
    if (storyStepPool.length > 0) {
      var storyMinGame = Math.max(12, Math.round(totalGames * 0.2));
      if (gamesPlayed >= storyMinGame && (sinceLast == null || sinceLast >= SEASON_BRANCH_EVENT_CONFIG.cooldownGames)) {
        var forcedStory = pickBranchEvent(storyStepPool, true);
        if (forcedStory) {
          c._lastSeasonBranchGame = (STATE.season.games || []).length;
          c.branchSeasonEvents[forcedStory.branch] = true;
          c.branchSeasonEvents._storyArc = true;
          c.branchSeasonEvents._count = (c.branchSeasonEvents._count || 0) + 1;
          markSeasonEventSeen(forcedStory, c);
          return forcedStory;
        }
      }
    }
  }
  // 每个赛季第 4 场起保证出现一条随机日常，之后每季最多约 5 次；
  // 仍保留 14% 概率与 7 场冷却，降低全年弹窗总量但不改变事件间隔手感。
  var openingEventDue = gamesPlayed >= 4
    && gamesPlayed <= SEASON_BRANCH_EVENT_CONFIG.openingGames
    && (c.branchSeasonEvents._count || 0) === 0;
  if (!openingEventDue && Math.random() * 100 >= SEASON_BRANCH_EVENT_CONFIG.chancePercent) return null;
  var maxRandomEvents = romanceStepPool.length > 0
    ? SEASON_BRANCH_EVENT_CONFIG.maxWithRelationship
    : SEASON_BRANCH_EVENT_CONFIG.maxPerSeason;
  if ((c.branchSeasonEvents._count || 0) >= maxRandomEvents) return null;
  var pool = getBranchEventSource().filter(function(ev) {
    if (getEventPhases(ev).indexOf('season') < 0) return false;
    if (c.branchSeasonEvents[ev.branch]) return false;
    // 日常见过后仍可进池（降权），长线剧情继续生涯去重
    if (!isDailySeasonEvent(ev) && hasSeasonEventBeenSeen(ev, c)) return false;
    if (!isSeasonEventStateEligible(ev, eventState)) return false;
    try { return !ev.requires || ev.requires({ game: game, result: result, stats: stats, state: eventState }); }
    catch(e) { return false; }
  });
  // 每个赛季前 12 场优先抽日常独立事件，避免每次开局都固定出现
  // “来到这座城市 / 输球发布会”这类长支线起点。
  if (gamesPlayed <= SEASON_BRANCH_EVENT_CONFIG.openingGames) {
    var openingPool = pool.filter(function(ev) { return ev.id && ev.id.indexOf('pp_season_') === 0; });
    if (openingPool.length > 0) pool = openingPool;
  }
  if (pool.length === 0) return null;
  var picked = pickSeasonStateAwareEvent(pool, eventState);
  if (!picked) return null;
  c._lastSeasonBranchGame = (STATE.season.games || []).length;
  c.branchSeasonEvents[picked.branch] = true;
  c.branchSeasonEvents._count = (c.branchSeasonEvents._count || 0) + 1;
  markSeasonEventSeen(picked, c);
  return picked;
}

function showSeasonBranchEvent(ev, done) {
  if (!ev) return;
  STATE._seasonBranchEvent = ev;
  STATE._seasonBranchDone = typeof done === 'function' ? done : null;
  STATE._seasonBranchScenePage = 0;
  showSeasonBranchEventModal();
}

function showSeasonBranchEventModal() {
  var ev = STATE._seasonBranchEvent;
  if (!ev) return;
  var existing = document.getElementById('season-branch-modal');
  if (existing) existing.remove();
  var scenes = ev.scenes || [];
  var sceneIdx = STATE._seasonBranchScenePage || 0;
  var title = getPlayerFacingBranchTitle(ev.title);
  var html = '<div class="team-picker-overlay" id="season-branch-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  if (scenes.length && sceneIdx < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillBranchEventText(scenes[sceneIdx]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueSeasonBranchScene()">继续</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    return;
  }
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillBranchEventText(ev.body)) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  ev.choices.forEach(function(ch, ci) {
    var locked = isBranchChoiceLocked(ch);
    var lockHint = locked ? (ch.lockHint || '需要其它线路结果') : '';
    var btnStyle = 'width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;' + (locked ? 'opacity:.45;cursor:not-allowed;' : '');
    var onclick = locked ? '' : 'onclick="chooseSeasonBranchEvent(' + ci + ')"';
    html += '<button class="btn btn-secondary btn-sm" style="' + btnStyle + '" ' + onclick + (locked ? ' disabled' : '') + '>' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(fillBranchEventText(locked ? lockHint : getEventChoicePrediction(ch, ev, ci))) + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueSeasonBranchScene() {
  STATE._seasonBranchScenePage = (STATE._seasonBranchScenePage || 0) + 1;
  showSeasonBranchEventModal();
}

function chooseSeasonBranchEvent(choiceIdx) {
  var ev = STATE._seasonBranchEvent;
  if (!ev) return;
  var ch = ev.choices[choiceIdx];
  if (!ch || isBranchChoiceLocked(ch)) return;
  var beforeAttributes = captureEventAttributeSnapshot();
  var msg = ch && ch.apply ? ch.apply() : '';
  msg = applyChoiceBonus(ch, msg);
  recordBranchChoice(ev, ch, msg, 'season');
  var modal = document.getElementById('season-branch-modal');
  if (modal) modal.remove();
  STATE._seasonBranchEvent = null;
  STATE._seasonBranchScenePage = 0;
  var attributeChanges = diffEventAttributeSnapshot(beforeAttributes);
  if (msg || attributeChanges.length) showSeasonBranchResultModal(ev.title, msg, attributeChanges);
  else finishSeasonBranchEvent();
}

function showSeasonBranchResultModal(title, msg, attributeChanges) {
  var existing = document.getElementById('season-branch-result-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="season-branch-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + getPlayerFacingBranchTitle(title) + '</span></div>';
  html += '<div class="event-result-body">';
  html += formatBranchResultText(fillBranchEventText(msg));
  html += renderEventAttributeChanges(attributeChanges);
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="finishSeasonBranchEvent()">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function finishSeasonBranchEvent() {
  var modal = document.getElementById('season-branch-result-modal');
  if (modal) modal.remove();
  var done = STATE._seasonBranchDone;
  STATE._seasonBranchDone = null;
  if (typeof done === 'function') done();
}

function showNextOffseasonEvent() {
  var queue = STATE._offseasonQueue || [];
  var idx = STATE._offseasonEventIdx || 0;
  if (idx >= queue.length) {
    renderTrainingCamp();
    return;
  }
  STATE._branchScenePage = 0;
  showOffseasonEventModal(queue[idx], idx + 1, queue.length);
}

function showOffseasonEventModal(ev, idx, total) {
  var existing = document.getElementById('offseason-event-modal');
  if (existing) existing.remove();
  var scenes = ev.scenes || [];
  var sceneIdx = STATE._branchScenePage || 0;
  var title = getPlayerFacingBranchTitle(ev.title);
  var html = '<div class="team-picker-overlay" id="offseason-event-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  if (scenes.length && sceneIdx < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillBranchEventText(scenes[sceneIdx]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueOffseasonScene()">继续</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    return;
  }
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillBranchEventText(ev.body)) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  ev.choices.forEach(function(ch, ci) {
    var locked = isBranchChoiceLocked(ch);
    var lockHint = locked ? (ch.lockHint || '需要其它线路结果') : '';
    var btnStyle = 'width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;' + (locked ? 'opacity:.45;cursor:not-allowed;' : '');
    var onclick = locked ? '' : 'onclick="chooseOffseasonEvent(' + ci + ')"';
    html += '<button class="btn btn-secondary btn-sm" style="' + btnStyle + '" ' + onclick + (locked ? ' disabled' : '') + '>' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(fillBranchEventText(locked ? lockHint : getEventChoicePrediction(ch, ev, ci))) + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueOffseasonScene() {
  var queue = STATE._offseasonQueue || [];
  var idx = STATE._offseasonEventIdx || 0;
  var ev = queue[idx];
  if (!ev) return;
  STATE._branchScenePage = (STATE._branchScenePage || 0) + 1;
  showOffseasonEventModal(ev, idx + 1, queue.length);
}

function chooseOffseasonEvent(choiceIdx) {
  var queue = STATE._offseasonQueue || [];
  var idx = STATE._offseasonEventIdx || 0;
  var ev = queue[idx];
  if (!ev) return;
  var ch = ev.choices[choiceIdx];
  if (!ch || isBranchChoiceLocked(ch)) return;
  var beforeAttributes = captureEventAttributeSnapshot();
  var msg = ch && ch.apply ? ch.apply() : '';
  msg = applyChoiceBonus(ch, msg);
  msg = fillBranchEventText(msg);
  recordBranchChoice(ev, ch, msg, 'offseason');
  var modal = document.getElementById('offseason-event-modal');
  if (modal) modal.remove();
  STATE._branchScenePage = 0;
  STATE._offseasonEventIdx = idx + 1;
  var attributeChanges = diffEventAttributeSnapshot(beforeAttributes);
  if (msg || attributeChanges.length) showOffseasonResultModal(ev.title, msg, null, attributeChanges);
  else showNextOffseasonEvent();
}

function showOffseasonResultModal(title, msg, done, attributeChanges) {
  var existing = document.getElementById('offseason-result-modal');
  if (existing) existing.remove();
  STATE._offseasonResultDone = typeof done === 'function' ? done : null;
  var html = '<div class="team-picker-overlay" id="offseason-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + getPlayerFacingBranchTitle(title) + '</span></div>';
  html += '<div class="event-result-body">';
  html += formatBranchResultText(fillBranchEventText(msg));
  html += renderEventAttributeChanges(attributeChanges);
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="' + (STATE._offseasonResultDone ? 'continueOffseasonResultWithCallback()' : 'continueOffseasonEvent()') + '">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueOffseasonResultWithCallback() {
  var modal = document.getElementById('offseason-result-modal');
  if (modal) modal.remove();
  var done = STATE._offseasonResultDone;
  STATE._offseasonResultDone = null;
  if (typeof done === 'function') done();
}

function getPlayerFacingBranchTitle(title) {
  return (title || '')
    .replace(/^恋爱线：/, '恋爱：')
    .replace(/^人脉线：/, '人脉：')
    .replace(/^导师线：/, '巨星导师：')
    .replace(/^专项线：/, '专项训练：')
    .replace(/^球队线：/, '球队合练：');
}

function restoreBranchKeptSegment(seg) {
  return (seg || '')
    .replace(/恋爱线进入长期稳定，家庭线解锁。/g, '这段关系进入长期稳定，家人也真正走进你的生活。')
    .replace(/恋爱线进入长期陪伴，家庭线解锁。/g, '这段关系进入长期陪伴，家人也真正走进你的生活。')
    .replace(/恋爱线/g, '恋爱')
    .replace(/人脉线/g, '人脉')
    .replace(/导师线/g, '巨星导师')
    .replace(/专项线/g, '专项训练')
    .replace(/球队线/g, '球队合练')
    .replace(/家庭线解锁。/g, '家人也真正走进你的生活。');
}

function sanitizePlayerFacingText(text) {
  if (!text) return '';
  var keptSegments = [];
  var s = String(text);
  // 重点/影响段落先整体保护，清理内部术语时不会误删玩家可见内容
  s = s.replace(/(?:额外)?(?:重点|影响)：[\s\S]*?(?=<br><br>|$)/g, function(m) {
    keptSegments.push(m);
    return '\u0001' + (keptSegments.length - 1) + '\u0002';
  });
  s = s
    .replace(/；中国男篮支线进入[^；。<]*/g, '')
    .replace(/；恋爱线[^；。<]*/g, '')
    .replace(/；人脉线[^；。<]*/g, '')
    .replace(/；导师线[^；。<]*/g, '')
    .replace(/；专项线[^；。<]*/g, '')
    .replace(/；球队线[^；。<]*/g, '')
    .replace(/；?获得“([^”]+)”(?:长期)?标签/g, '；人们开始用“$1”形容你')
    .replace(/；?记录 Rich Paul 接触/g, '')
    .replace(/；?记录库里圈子/g, '')
    .replace(/；?未来可联动[^；。<]*/g, '')
    .replace(/；?未来自由市场\/品牌线获得伏笔/g, '')
    .replace(/；?下次将进入[^；。<]*/g, '')
    .replace(/；?进入“[^”]+”阶段/g, '')
    .replace(/；?进入二阶段/g, '')
    .replace(/；?进入传承阶段/g, '')
    .replace(/；线进入[^；。<]*/g, '')
    .replace(/；线记录为[^；。<]*/g, '')
    .replace(/；?导师线完成/g, '')
    .replace(/；?专项线完成/g, '')
    .replace(/；?队史分倾向提升/g, '')
    .replace(/结果：恋爱线开启；/g, '结果：你开始了一段关系；')
    .replace(/结果：恋爱线结束；/g, '结果：这段关系结束了；')
    .replace(/开启恋爱线/g, '开始一段关系')
    .replace(/开启人脉线/g, '进入这个圈子')
    .replace(/开启领袖线/g, '承担更多队内责任')
    .replace(/开启长期专项训练线/g, '投入一个长期训练方向')
    .replace(/选择你希望留下的打法标签/g, '选择你希望稳定下来的打法方向')
    .replace(/选择你希望形成的长期打法标签/g, '选择你希望稳定下来的打法方向')
    .replace(/球队线收束。/g, '')
    .replace(/导师线收束。/g, '')
    .replace(/人脉线进入正式会面。/g, '')
    .replace(/恋爱线进入公开节点。/g, '')
    .replace(/专项线/g, '专项训练')
    .replace(/导师线/g, '巨星导师')
    .replace(/球队线/g, '球队合练')
    .replace(/恋爱线/g, '恋爱')
    .replace(/人脉线/g, '人脉')
    .replace(/支线/g, '')
    .replace(/标签/g, '印象')
    .replace(/\s*flag\s+[A-Za-z0-9_\-/]+(?:\s*=\s*(?:true|false|'[^']*'|"[^"]*"))?/g, '')
    .replace(/[（(]\s*[）)]/g, '')
    .replace(/；[。]/g, '。')
    .replace(/；\s*；/g, '；')
    .replace(/：\s*；/g, '：')
    .replace(/<br><br>\s*$/g, '')
    .replace(/^[；。]\s*/g, '')
    .replace(/\s+$/g, '');
  return s.replace(/\u0001(\d+)\u0002/g, function(m, n) {
    return restoreBranchKeptSegment(keptSegments[parseInt(n, 10)]);
  });
}

function formatBranchResultText(msg) {
  var clean = sanitizePlayerFacingText(msg);
  var parts = clean.split('<br><br>');
  var story = parts[0] || '';
  var focus = '';
  var effect = '';
  for (var i = 1; i < parts.length; i++) {
    var p = parts[i] || '';
    if (/^(效果|结果|基础效果|额外效果|额外影响)：/.test(p)) {
      effect = p.replace(/^(效果|结果|基础效果|额外效果|额外影响)：/, '');
    } else if (!focus) {
      focus = p.replace(/^重点：/, '');
    } else {
      effect += (effect ? '<br>' : '') + p;
    }
  }
  effect = effect.replace(/^[；。，、\s]+|[；。，、\s]+$/g, '');
  focus = focus.replace(/^[；。，、\s]+|[；。，、\s]+$/g, '');
  var html = '';
  if (story) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:12px;">' + story + '</div>';
  }
  if (focus) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
    html += '<div style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:12px;">' + focus + '</div>';
  }
  if (effect) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">影响</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:14px;">' + effect + '</div>';
  }
  return html || '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + clean + '</div>';
}

function continueOffseasonEvent() {
  var modal = document.getElementById('offseason-result-modal');
  if (modal) modal.remove();
  STATE._offseasonResultDone = null;
  if (STATE.career && STATE.career.flags && STATE.career.flags.countdownDone) {
    // 告别剧情不再直接强制退役；玩家可按当前年龄与能力决定继续，直到 42 岁赛季。
    STATE._retirementOfferPhase = 'pre-training';
    showPlayerRetirementChoice();
    return;
  }
  showNextOffseasonEvent();
}

function maybeShowCityFarewell(callback) {
  if (!isCityTransfer()) return false;
  var ev = getBranchEventById('city_farewell');
  if (!ev || hasCareerEventBeenSeen(ev, STATE.career)) return false;
  STATE._cityFarewellEv = ev;
  STATE._cityFarewellDone = typeof callback === 'function' ? callback : null;
  STATE._branchScenePage = 0;
  showCityFarewellModal();
  return true;
}

function showCityFarewellModal() {
  var ev = STATE._cityFarewellEv;
  if (!ev) return;
  var existing = document.getElementById('city-farewell-modal');
  if (existing) existing.remove();
  var scenes = ev.scenes || [];
  var sceneIdx = STATE._branchScenePage || 0;
  var title = getPlayerFacingBranchTitle(ev.title);
  var html = '<div class="team-picker-overlay" id="city-farewell-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  if (scenes.length && sceneIdx < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillBranchEventText(scenes[sceneIdx]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueCityFarewellScene()">继续</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    return;
  }
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillBranchEventText(ev.body)) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  ev.choices.forEach(function(ch, ci) {
    var locked = isBranchChoiceLocked(ch);
    var lockHint = locked ? (ch.lockHint || '需要其它线路结果') : '';
    var btnStyle = 'width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;' + (locked ? 'opacity:.45;cursor:not-allowed;' : '');
    var onclick = locked ? '' : 'onclick="chooseCityFarewell(' + ci + ')"';
    html += '<button class="btn btn-secondary btn-sm" style="' + btnStyle + '" ' + onclick + (locked ? ' disabled' : '') + '>' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(fillBranchEventText(locked ? lockHint : getEventChoicePrediction(ch, ev, ci))) + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueCityFarewellScene() {
  STATE._branchScenePage = (STATE._branchScenePage || 0) + 1;
  showCityFarewellModal();
}

function chooseCityFarewell(choiceIdx) {
  var ev = STATE._cityFarewellEv;
  if (!ev) return;
  var ch = ev.choices[choiceIdx];
  if (!ch || isBranchChoiceLocked(ch)) return;
  var beforeAttributes = captureEventAttributeSnapshot();
  var msg = ch && ch.apply ? ch.apply() : '';
  msg = applyChoiceBonus(ch, msg);
  recordBranchChoice(ev, ch, msg, 'offseason');
  var modal = document.getElementById('city-farewell-modal');
  if (modal) modal.remove();
  STATE._branchScenePage = 0;
  function finishCityFarewell() {
    var done = STATE._cityFarewellDone;
    STATE._cityFarewellEv = null;
    STATE._cityFarewellDone = null;
    if (typeof done === 'function') done();
  }
  var attributeChanges = diffEventAttributeSnapshot(beforeAttributes);
  if (msg || attributeChanges.length) {
    showOffseasonResultModal(ev.title, msg, finishCityFarewell, attributeChanges);
  } else {
    finishCityFarewell();
  }
}

function pickOffseasonText(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getOffseasonSeasonStartYear() {
  var n = STATE.career && STATE.career.seasonCount ? STATE.career.seasonCount : 1;
  return 2025 + n;
}

function getChinaTournamentName() {
  var y = getOffseasonSeasonStartYear();
  if (y % 4 === 0) return '奥运会';
  if (y % 4 === 3) return '男篮世界杯';
  return pickOffseasonText(['亚洲杯', '世预赛', '亚运会', '奥运落选赛']);
}

function countCareerHonor(label) {
  var honors = (STATE.career && STATE.career.honors) || [];
  return honors.filter(function(h) { return (h.label || '').indexOf(label) >= 0 && !isRookieHonorForLaterSeason(h); }).length;
}

function hasCareerHonor(label) {
  return countCareerHonor(label) > 0;
}

function addFlagCount(key, n) {
  var c = STATE.career;
  c.flags = c.flags || {};
  c.flags[key] = (c.flags[key] || 0) + (n || 1);
  return c.flags[key];
}

function getBreakthroughChance(key, base) {
  var flags = (STATE.career && STATE.career.flags) || {};
  return Math.min(0.55, base + (flags[key] || 0) * 0.08);
}

function applyTrainingOutcome(primary, secondary, pityKey, sceneList, labels) {
  var mods = getNextSeasonMods();
  var roll = Math.random();
  var boomChance = getBreakthroughChance(pityKey, 0.16);
  var scene = pickOffseasonText(sceneList);
  if (roll < boomChance) {
    STATE.career.flags[pityKey] = 0;
    addAttrDelta(primary, 5);
    if (secondary) addAttrDelta(secondary, 3);
    STATE.finalOVR = calcOVR(STATE.attrs);
    return scene + '<br><br>突飞猛进：连续几天，训练馆里的数据都不像正常成长曲线。教练组把你的训练片段单独剪出来，认为这不是手感，而是技术动作真的换了一层。<br><br>效果：' + labels.primary + '+5' + (secondary ? '，' + labels.secondary + '+3' : '') + '。';
  }
  if (roll < 0.72) {
    addAttrDelta(primary, 2);
    if (secondary) addAttrDelta(secondary, 1);
    STATE.finalOVR = calcOVR(STATE.attrs);
    return scene + '<br><br>稳定进步：这个夏天没有奇迹，但每天都能看到一点点更稳的自己。<br><br>效果：' + labels.primary + '+2' + (secondary ? '，' + labels.secondary + '+1' : '') + '。';
  }
  if (roll < 0.9) {
    var stack = addFlagCount(pityKey, 1);
    return scene + '<br><br>瓶颈期：你练得很狠，但身体像是暂时拒绝吸收新的动作。训练师建议你别急，下次继续冲这个专项时，突破概率会提高。<br><br>效果：本次无属性变化；该专项突破保底层数+' + stack + '。';
  }
  addAttrDelta(primary, 2);
  mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
  STATE.finalOVR = calcOVR(STATE.attrs);
  return scene + '<br><br>过度训练：你咬牙把训练量顶了上去，技术确实进了，但膝盖和脚踝的反馈也变得刺耳。<br><br>效果：' + labels.primary + '+2；下赛季伤病/疲劳事件风险上升。';
}

const BRANCH_BIBLE = {
  china_team: { name: '中国男篮', layer: 'identity', unlocks: ['china_market', 'legacy'] },
  relationship: { name: '恋爱', layer: 'life', unlocks: ['family', 'brand', 'controversy'] },
  family: { name: '家庭', layer: 'late_career', unlocks: ['retirement_choice', 'post_career'] },
  network: { name: '高尔夫 / 人脉', layer: 'career_power', unlocks: ['rich_paul', 'brand'] },
  rich_paul: { name: 'Rich Paul / 经纪团队', layer: 'career_power', unlocks: ['transfer'] },
  mentor: { name: '巨星导师', layer: 'growth', unlocks: ['rich_paul', 'signature_style'] },
  training: { name: '夏日训练', layer: 'growth', unlocks: ['signature_style', 'rich_paul'] },
  skill_training: { name: '专项训练', layer: 'growth', unlocks: ['signature_style', 'playoff_moment'] },
  team_practice: { name: '球队合练 / 队内领袖', layer: 'team', unlocks: ['teammate_bond', 'legacy'] },
  teammate_bond: { name: '队友羁绊', layer: 'team', unlocks: ['playoff_moment'] },
  china_market: { name: '中国市场', layer: 'business', unlocks: ['shoe_brand', 'legacy'] },
  brand: { name: '商业 / 品牌', layer: 'business', unlocks: ['shoe_brand', 'controversy'] },
  shoe_brand: { name: '球鞋品牌', layer: 'business', unlocks: ['legacy'] },
  media: { name: '媒体形象', layer: 'identity', unlocks: ['brand', 'controversy'] },
  fan_culture: { name: '球迷文化', layer: 'identity', unlocks: ['brand', 'legacy'] },
  crossover: { name: '揽佬 · 中国人能飞', layer: 'season_texture', unlocks: ['fame', 'fan_culture'] },
  mental_health: { name: '心理健康', layer: 'risk', unlocks: ['retirement_choice', 'legacy'] },
  city_culture: { name: '城市文化', layer: 'team', unlocks: ['legacy', 'retirement_choice'] },
  family_children: { name: '家人孩子', layer: 'late_career', unlocks: ['retirement_choice', 'post_career'] },
  training_camp: { name: '训练营', layer: 'legacy_seed', unlocks: ['post_career', 'legacy'] },
  charity: { name: '公益', layer: 'identity', unlocks: ['legacy', 'post_career'] },
  retirement_countdown: { name: '退役倒计时', layer: 'late_career', unlocks: ['retirement_choice', 'legacy'] },
  controversy: { name: '道德 / 争议', layer: 'risk', unlocks: ['legacy'] },
  coach_role: { name: '教练关系 / 队内地位', layer: 'team', unlocks: ['team_practice'] },
  transfer: { name: '转会风波', layer: 'career_power', unlocks: ['contender_window', 'legacy'] },
  contender_window: { name: '争冠窗口', layer: 'championship', unlocks: ['dynasty'] },
  dynasty: { name: '王朝', layer: 'championship', unlocks: ['legacy'] },
  all_star_weekend: { name: '全明星周末', layer: 'season_texture', unlocks: ['brand', 'fame'] },
  playoff_moment: { name: '季后赛名场面', layer: 'championship', unlocks: ['legacy'] },
  milestone: { name: '数据里程碑', layer: 'legacy_seed', unlocks: ['legacy', 'brand'] },
  retirement_choice: { name: '晚年退役倾向', layer: 'late_career', unlocks: ['legacy', 'post_career'] },
  legacy: { name: '历史地位', layer: 'ending', unlocks: ['jersey_retirement', 'hall_of_fame', 'top100'] },
  post_career: { name: '退役后身份', layer: 'ending', unlocks: [] }
};

const BRANCH_EVENTS = [
  {
    id: 'national_team',
    branch: 'china_team',
    phase: 'offseason',
    slot: 'main',
    weight: 12,
    title: '中国男篮征召',
    body: '中国男篮向你发来正式征召。这个夏天，国家队需要一个真正能扛球权的人。经纪团队提醒你：这是荣誉，也是压力，回到新赛季时身体负担会更重。',
    choices: [
      { label: '接受中国男篮征召', hint: '获得国家队历练和舆论声望，但新赛季伤病/疲劳风险提高', apply: function() {
        var mods = getNextSeasonMods();
        var tournament = getChinaTournamentName();
        var branch = advanceBranch('china_team', 1, { status: 'accepted', lastTournament: tournament });
        branch.reputation = (branch.reputation || 0) + 2;
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 3);
        addAttrDelta('CLU', 1); addAttrDelta('PAS', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '你抵达中国男篮训练基地的第一天，教练组就把' + tournament + '最后五分钟的战术板交到你手里。队友们看着你，没人说话，但所有人都知道这个夏天的球权会从你这里开始。',
          tournament + '热身赛最后一攻，你在高位叫挡拆，吸引包夹后把球塞到底角。三分命中后，替补席全部站了起来，国内媒体第二天把标题写成了：中国队终于有了自己的核心。',
          tournament + '小组赛面对强硬防守，你连续几个回合被撞倒。你没有抱怨，下一回合直接顶着对抗杀进内线。那一晚之后，中国男篮更衣室默认你是关键时刻的第一选择。'
        ]);
        var roll = Math.random();
        var result = '';
        if (roll < 0.18) {
          addAttrDelta('CLU', 1);
          result = '带队爆发：淘汰赛里你连续命中关键球，中国队打出了近年最振奋的一段国际赛事。赛后你没有庆祝太久，只在采访里说：这不是终点。额外效果：关键球+1。';
        } else if (roll < 0.42) {
          addAttrDelta('PAS', 1);
          result = '血战晋级：你们每一场都打到最后两分钟，身体消耗巨大，但你学会了在更小的空间里找到队友。额外效果：传球+1。';
        } else if (roll < 0.7) {
          mods.formVariance = Math.min(3, (mods.formVariance || 0) + 1);
          result = '遗憾出局：最后一场赛后，你在替补席坐了很久。网上的争论铺天盖地，有人夸你扛起球队，也有人把失败全压到你肩上。额外影响：下赛季状态波动略升。';
        } else {
          mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
          result = '受伤隐患：密集赛程让你的腿部疲劳一直没有完全消下去。队医没有给出严重诊断，但新赛季开始前，训练师明显更谨慎。额外影响：下赛季伤病/疲劳风险继续上升。';
        }
        return scene + '<br><br>' + result + '<br><br>基础效果：关键球+1，传球+1；下赛季伤病/疲劳事件风险上升。';
      }},
      { label: '婉拒征召，专注恢复', hint: '降低开季波动，但可能承受外界议论', apply: function() {
        var mods = getNextSeasonMods();
        var branch = advanceBranch('china_team', 1, { status: 'declined' });
        branch.controversy = (branch.controversy || 0) + 1;
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        var scene = pickOffseasonText([
          '你给国家队回了一通很长的电话。你说自己尊重这身球衣，但这个夏天必须把身体彻底修好。电话那头沉默了几秒，最后只说：希望下次还能等到你。',
          '拒绝征召的消息出来后，舆论很快分成两派。有人理解你的身体管理，也有人质疑你的责任感。你没有回应，只是在训练馆里把手机调成静音。',
          '经纪团队建议你发一份声明，你删掉了所有漂亮话，只留下几句简单的感谢。接下来的几周，你把每天的恢复课排得比常规训练还满。'
        ]);
        return scene + '<br><br>效果：你保留了完整休整周期；下赛季状态波动略微降低。';
      }}
    ]
  },
  {
    id: 'superstar_camp',
    branch: 'mentor',
    phase: 'offseason',
    slot: 'main',
    weight: 13,
    title: '巨星训练营邀请',
    body: '休赛期你收到几个私人训练营邀请。它们不只是训练课，更像一次路线选择：你要从谁身上偷走一部分比赛理解？',
    choices: [
      { label: '奥拉朱旺脚步训练', hint: '内线、防守、篮板提升', apply: function() {
        advanceBranch('mentor', 1, { lastMentor: 'hakeem' });
        var great = Math.random() < 0.28;
        var rough = !great && Math.random() < 0.18;
        addAttrDelta('FIN', great ? 3 : 2); addAttrDelta('IDEF', 1); addAttrDelta('REB', rough ? 0 : 1); STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '奥拉朱旺没有急着教动作，他先让你在低位连续转身二十分钟。每次你以为找到了节奏，他都会轻轻摇头：脚先骗过人，球只是最后的证明。',
          '训练馆很安静，只有鞋底摩擦地板的声音。奥拉朱旺把防守人想象成一扇门，告诉你不要撞门，要让门自己打开。',
          '你在录像室看了一整晚低位脚步。第二天训练时，你第一次发现，背身不是慢下来，而是把防守者拖进你的时间里。'
        ]);
        if (great) return scene + '<br><br>特殊结果：你突然理解了假动作的节奏，连续几次把陪练晃到失位。奥拉朱旺笑着拍了拍你的肩。<br><br>效果：终结+3，内防+1，篮板+1。';
        if (rough) return scene + '<br><br>负面结果：低位细节比你想象中折磨人，脚踝和腰背承受了不少压力。你学到了东西，但没有完全吃透篮板卡位部分。<br><br>效果：终结+2，内防+1。';
        return scene + '<br><br>普通结果：你的低位脚步更稳，面对错位时多了一个可靠惩罚手段。<br><br>效果：终结+2，内防+1，篮板+1。';
      }},
      { label: '杜兰特投射训练', hint: '中投和三分提升', apply: function() {
        advanceBranch('mentor', 1, { lastMentor: 'durant' });
        var great = Math.random() < 0.3;
        var rough = !great && Math.random() < 0.16;
        addAttrDelta('MID', great ? 3 : 2); addAttrDelta('threePT', rough ? 0 : (great ? 2 : 1)); STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '杜兰特看了你两组投篮，只说了一句：别急着摆脱，先学会在防守人面前舒服。之后整堂课，他都让你在贴身干扰下出手。',
          '训练内容简单到残酷：同一个肘区，同一个防守角度，连续投到手臂发麻。杜兰特告诉你，伟大的投篮不是空位准，而是被看穿后依然能进。',
          '你问杜兰特怎么判断该不该拔起来。他指了指地板：当你相信这个点属于你，防守人就已经晚了。'
        ]);
        if (great) return scene + '<br><br>特殊结果：某个下午，你连续命中十几记高难度干拔，训练馆里的人开始停下来看。你的出手点变得更高，也更不讲理。<br><br>效果：中投+3，三分+2。';
        if (rough) return scene + '<br><br>负面结果：你试图复制太多高难度节奏，三分线外短暂失准。好消息是，中距离单打脚步明显干净了。<br><br>效果：中投+2。';
        return scene + '<br><br>普通结果：你的急停和面框节奏更稳定，尤其在中距离区域开始有了自己的甜点位。<br><br>效果：中投+2，三分+1。';
      }},
      { label: '詹姆斯身体训练', hint: '运动能力、力量、终结提升', apply: function() {
        advanceBranch('mentor', 1, { lastMentor: 'lebron' });
        var great = Math.random() < 0.25;
        var agency = Math.random() < 0.22;
        addAttrDelta('ATH', great ? 2 : 1); addAttrDelta('STR', 1); addAttrDelta('FIN', 1); if (agency) addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '詹姆斯的训练不是单纯上重量。他会在冲刺、对抗、传球阅读之间来回切换，让你在最累的时候做最清醒的决定。',
          '凌晨的力量房里，詹姆斯一边训练一边和你聊如何照顾一个漫长职业生涯。他说天赋让人进联盟，习惯才决定你能待多久。',
          '你以为这是身体课，结果一半时间都在看录像。詹姆斯反复暂停同一个回合，问你：如果你是持球人，第三个选择在哪里？'
        ]);
        var extra = agency ? '<br><br>隐藏结果：训练结束后，Rich Paul 的团队主动和你聊了几句。他们没有立刻谈合作，但你能感觉到，这条线以后可能会再出现。额外效果：传球+1。' : '';
        if (great) return scene + '<br><br>特殊结果：你的身体适应速度超出预期，对抗后的起跳和二次发力都有提升。<br><br>效果：运动+2，力量+1，终结+1。' + extra;
        return scene + '<br><br>普通结果：你的核心力量和冲击篮筐稳定性提升，长赛季身体管理意识也更强。<br><br>效果：运动+1，力量+1，终结+1。' + extra;
      }},
      { label: '保罗控场训练', hint: '控球、传球、关键球提升', apply: function() {
        advanceBranch('mentor', 1, { lastMentor: 'paul' });
        var great = Math.random() < 0.28;
        var rough = !great && Math.random() < 0.14;
        addAttrDelta('HAN', 1); addAttrDelta('PAS', great ? 3 : 2); addAttrDelta('CLU', rough ? 0 : 1); STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '保罗训练你的方式很烦人：每个回合都要你先说出弱侧第二个防守人的站位。你答慢半秒，他就把球拿走重来。',
          '你们花了一下午练挡拆，但真正练的不是传球，而是等待。保罗说，控卫最值钱的能力，是让九个人都先暴露答案。',
          '保罗把训练赛切成无数个最后两分钟。他不断提醒你，关键球不是英雄球，而是让对手在最紧张的时候做选择题。'
        ]);
        if (great) return scene + '<br><br>特殊结果：你开始能提前一拍读到协防，几次传球让防守完全来不及轮转。保罗说：现在你不是在运球，你是在调度。<br><br>效果：控球+1，传球+3，关键球+1。';
        if (rough) return scene + '<br><br>负面结果：你学了太多节奏控制，短期内出手欲望被压低，关键球侵略性没有同步提升。<br><br>效果：控球+1，传球+2。';
        return scene + '<br><br>普通结果：你的挡拆阅读更稳，开始学会用停顿和眼神制造传球角度。<br><br>效果：控球+1，传球+2，关键球+1。';
      }}
    ]
  },
  {
    id: 'skill_breakthrough',
    branch: 'skill_training',
    phase: 'offseason',
    slot: 'main',
    weight: 11,
    title: '专项技术突破',
    body: '训练师建议你把整个夏天押在一项技术上。高投入有机会换来突飞猛进，也可能遇到瓶颈，甚至因为过度训练把风险带进新赛季。',
    choices: [
      { label: '冲击投射突破', hint: '大概率小涨，小概率大涨', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'shooting' });
        return applyTrainingOutcome('threePT', 'MID', 'shootingPity', [
          '你把整个夏天拆成无数个投篮点：底角、45度、弧顶、肘区。训练师不再数命中，只记录你在疲劳后的出手是否还保持同一个轨迹。',
          '每天训练结束后，你都会留下来多投一百个接球三分。灯光关掉一半，球馆里只剩篮网被刷动的声音。',
          '投篮教练把你的出手慢放到每一帧，指出手肘、脚尖和落地位置。你第一次意识到，稳定不是感觉，是重复。'
        ], { primary: '三分', secondary: '中投' });
      }},
      { label: '冲击持球突破', hint: '提升控球与终结', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'handle' });
        return applyTrainingOutcome('HAN', 'FIN', 'handlePity', [
          '训练师在半场摆满障碍物，让你每次突破前都必须先读出协防位置。你不只是练运球，也是在练怎么让防守提前犯错。',
          '你连续几天只练第一步和最后一步。第一步要骗过人，最后一步要扛住人，中间所有花活都被训练师删掉。',
          '陪练不断换成更高、更壮、更快的防守者。你被断、被撞、被盖，但慢慢开始知道该用哪个角度进入身体。'
        ], { primary: '控球', secondary: '终结' });
      }},
      { label: '冲击防守突破', hint: '提升外防与抢断', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'defense' });
        return applyTrainingOutcome('PDEF', 'STL', 'defensePity', [
          '你花了一周只练横移和追防。教练不让你赌博式抢断，只要求你每次都把持球人赶到最难受的位置。',
          '录像课里，你反复看联盟顶级侧翼如何提前半步卡住路线。第二天训练，你开始在对手启动前就移动脚步。',
          '防守训练没有漂亮镜头，只有一次次被过后的重来。你慢慢学会用身体角度，而不是手，去夺走对手的舒服空间。'
        ], { primary: '外防', secondary: '抢断' });
      }},
      { label: '冲击身体终结', hint: '提升力量与终结', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'strength' });
        return applyTrainingOutcome('STR', 'FIN', 'strengthPity', [
          '力量房和禁区训练被排在同一天。你先把身体练到发沉，再去篮下完成对抗终结，训练师说这才像第四节的真实比赛。',
          '每一次上篮都有陪练撞你的肩膀和腰。你开始学会不是躲开对抗，而是借着对抗把球送到更高的位置。',
          '这个夏天你几乎不练轻松的扣篮，只练失衡、被拉拽、被延误后的终结。难看，但有用。'
        ], { primary: '力量', secondary: '终结' });
      }},
      { label: '冲击组织突破', hint: '提升传球与关键球', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'playmaking' });
        return applyTrainingOutcome('PAS', 'CLU', 'playmakingPity', [
          '你和助教把每套战术拆成三层选择：第一选择被锁死，第二选择被延误，第三选择才是真正能赢季后赛的球。',
          '训练赛里，教练要求你每次叫挡拆前先喊出弱侧两个队友的位置。你开始发现，传球不是看见人，而是提前知道人会到哪里。',
          '你被禁止连续两回合用同一种方式发起进攻。这个限制很别扭，却逼你把比赛读得更完整。'
        ], { primary: '传球', secondary: '关键球' });
      }}
    ]
  },
  {
    id: 'team_practice',
    branch: 'team_practice',
    phase: 'offseason',
    slot: 'main',
    weight: 9,
    title: '球队合练',
    body: '队友们约你提前回到训练馆合练。教练组认为这能让球队更快进入状态。',
    choices: [
      { label: '组织球队合练', hint: '提升球队默契，降低开季波动', apply: function() {
        advanceBranch('team_practice', 1, { status: 'organized' });
        var mods = getNextSeasonMods();
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 2);
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '球队合练完成：传球+1，球队默契提升';
      }},
      { label: '个人恢复优先', hint: '减少身体负担', apply: function() {
        advanceBranch('team_practice', 1, { status: 'recovery' });
        var mods = getNextSeasonMods();
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return '你选择恢复：新赛季伤病风险略降';
      }}
    ]
  },
  {
    id: 'dating_star',
    branch: 'relationship',
    phase: 'offseason',
    slot: 'main',
    weight: 8,
    title: '约会邀请',
    body: '休赛期刚开始，一位很有名的女明星通过共同朋友给你发来邀请。经纪团队提醒你：这可能是轻松的夏天，也可能把你的名字送上娱乐版头条。',
    requires: function() {
      var c = STATE.career || {};
      return (c.currentAge || 22) >= 22 && ((STATE.finalOVR || 0) >= 82 || hasCareerHonor('全明星') || hasCareerHonor('最佳阵容'));
    },
    choices: [
      { label: '接受女明星邀约', hint: '可能状态火热，也可能陷入感情纠纷', apply: function() {
        var c = STATE.career;
        c.relationships = c.relationships || {};
        advanceBranch('relationship', 1, { status: 'dating' });
        var mods = getNextSeasonMods();
        var roll = Math.random();
        var intro = pickOffseasonText([
          '你们第一次见面是在一个很低调的私人餐厅。她没有问你数据，也没有问合同，只问你赢球后为什么总是先低头。你突然发现，这个夏天可能不会只属于训练馆。',
          '她在演唱会后台给你留了一张通行证。灯光、尖叫和舞台烟雾把夜晚变得不真实，你坐在角落里，第一次感觉自己像是闯进了另一个联盟。',
          '她约你去海边散步，身边没有镜头，也没有队友。你们聊到凌晨，话题从电影到伤病，从孤独到总冠军，最后谁也没提明天的训练。'
        ]);
        if (roll < 0.25) {
          c.relationships.partner = { type: 'actress', status: 'stable', sinceSeason: c.seasonCount, volatility: 1 };
          mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
          addAttrDelta('CLU', 1);
          STATE.finalOVR = calcOVR(STATE.attrs);
          return intro + '<br><br>状态火热：这段关系没有打乱你，反而让你在训练和比赛里更想证明自己。朋友说你整个人轻了一点，关键时刻却更硬。<br><br>效果：关键球+1；下赛季状态波动略降。';
        }
        if (roll < 0.5) {
          c.relationships.partner = { type: 'singer', status: 'distraction', sinceSeason: c.seasonCount, volatility: 3 };
          mods.formVariance = Math.min(4, (mods.formVariance || 0) + 2);
          return intro + '<br><br>乐不思蜀：你开始频繁改训练时间，只为了配合她的行程。训练师没有明说，但白板上你的缺席记录越来越显眼。<br><br>效果：下赛季状态波动上升。';
        }
        if (roll < 0.72) {
          c.relationships.partner = { type: 'athlete', status: 'rumor', sinceSeason: c.seasonCount, volatility: 4 };
          mods.formVariance = Math.min(5, (mods.formVariance || 0) + 3);
          mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 1);
          return intro + '<br><br>感情纠纷：几张模糊照片被放到网上，猜测和争吵迅速发酵。你不得不在训练后处理电话和声明，身体也没恢复得那么干净。<br><br>效果：下赛季状态波动明显上升；伤病/疲劳风险略升。';
        }
        c.relationships.partner = { type: 'actress', status: 'private', sinceSeason: c.seasonCount, volatility: 0 };
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        return intro + '<br><br>低调陪伴：你们决定不公开，也不把这件事变成新闻。队友偶尔调侃你，但更衣室气氛反而轻松了不少。<br><br>效果：球队默契略升。';
      }},
      { label: '礼貌拒绝，专注训练', hint: '放弃社交剧情，换取更稳定的夏天', apply: function() {
        advanceBranch('relationship', 1, { status: 'declined' });
        var roll = Math.random();
        if (roll < 0.55) {
          addAttrDelta('STA', 1);
          STATE.finalOVR = calcOVR(STATE.attrs);
          return '你回了一条很短但体面的消息，然后把手机交给训练师保管。整个夏天，你的作息准得像比赛计时器。<br><br>效果：耐力+1。';
        }
        return '你选择不让这个夏天偏离训练计划。媒体没有故事可写，朋友笑你无趣，但教练组很满意。<br><br>效果：无属性变化，但避免了感情线风险。';
      }}
    ]
  },
  {
    id: 'golf_network',
    branch: 'network',
    phase: 'offseason',
    slot: 'main',
    weight: 7,
    title: '名人高尔夫局',
    body: '赞助商给你安排了一场名人高尔夫局。球场上不只有挥杆，还有经纪团队、人脉圈和未来合作的试探。',
    requires: function() {
      return (STATE.career.currentAge || 22) >= 24 && ((STATE.finalOVR || 0) >= 85 || hasCareerHonor('全明星') || hasCareerHonor('总冠军'));
    },
    choices: [
      { label: '参加高尔夫局', hint: '可能遇到 Rich Paul、库里团队或商业机会', apply: function() {
        var c = STATE.career;
        c.flags = c.flags || {};
        advanceBranch('network', 1, { status: 'golf' });
        var mods = getNextSeasonMods();
        var roll = Math.random();
        var intro = pickOffseasonText([
          '你到球场时，几个熟悉的联盟面孔已经在练习果岭。这里没人穿球衣，但每一次寒暄都像在试探未来的合作空间。',
          '阳光很好，球车开得很慢。赞助商介绍你认识一桌人，有投资人、退役球员、经纪团队，也有几个你只在新闻里见过的名字。',
          '你原本只是想放松，结果第一洞还没打完，就有人开始聊阵容、市场和未来几年联盟的权力流向。'
        ]);
        if (roll < 0.25) {
          c.flags.richPaulContact = true;
          return intro + '<br><br>Rich Paul 线索：你和 Rich Paul 的团队在第九洞聊了很久。他们没有直接招募你，只说如果未来想管理更大的职业版图，可以再坐下来谈。<br><br>效果：记录 Rich Paul 接触线，未来可联动经纪团队/詹姆斯训练营。';
        }
        if (roll < 0.48) {
          c.flags.curryCircle = true;
          addAttrDelta('threePT', 1);
          STATE.finalOVR = calcOVR(STATE.attrs);
          return intro + '<br><br>库里圈子：库里团队的人注意到你在果岭上的手感，玩笑说你的腕部控制像投篮。后来你们聊到训练和空间体系，对方留下了联系方式。<br><br>效果：三分+1；记录库里圈子线索。';
        }
        if (roll < 0.75) {
          mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
          return intro + '<br><br>放松成功：没有重大合作，也没有新闻爆点。你只是久违地从比赛压力里抽离出来，身体恢复得比预期更好。<br><br>效果：下赛季伤病/疲劳风险略降。';
        }
        c.flags.businessBuzz = true;
        mods.formVariance = Math.min(4, (mods.formVariance || 0) + 1);
        return intro + '<br><br>应酬过量：你认识了很多人，也拍了很多合照。商业曝光变多，但训练节奏被打碎，团队提醒你别让夏天变成巡演。<br><br>效果：记录商业热度；下赛季状态波动略升。';
      }},
      { label: '拒绝社交，留在训练馆', hint: '错过人脉，但得到纯训练收益', apply: function() {
        advanceBranch('network', 1, { status: 'training' });
        addAttrDelta('MID', 1);
        addAttrDelta('STA', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        return '你婉拒了球局，把那一整天留给训练馆。助教说你可能错过了一些人脉，但你只回了一句：球会替我介绍自己。<br><br>效果：中投+1，耐力+1。';
      }}
    ]
  }
];

const STAGED_BRANCH_EVENTS = [
  {
    id: 'china_team_first_call',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 12,
    title: '中国男篮：首次征召',
    scenes: [
      '国家队的正式征召函发到你的团队邮箱。标题很短，却让整个会议室安静下来：中国男篮集训名单确认。',
      '教练组没有把你当成普通新人。他们在战术板上写下你的名字，旁边标注：最后五分钟持球点。'
    ],
    body: '这是你第一次真正站到国家队选择面前。接受意味着荣誉和消耗，拒绝意味着恢复和争议。',
    requires: function() { return getBranchNode('china_team') === 'start'; },
    choices: [
      { label: '接受征召，证明自己', hint: '推进中国男篮线；关键球/传球提升，伤病风险上升', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('china_team', 'first_camp', { status: 'accepted', reputation: 2, controversy: 0, acceptedCount: 1 });
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
        addAttrDelta('CLU', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你穿上国家队训练服的第一天，队友们没有太多寒暄。训练赛最后一攻，教练直接把球交给你。<br><br>效果：关键球+1，传球+1；下赛季伤病风险上升。';
      }},
      { label: '婉拒征召，专注身体', hint: '降低波动，但留下舆论争议', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('china_team', 'second_call_after_decline', { status: 'declined', reputation: 0, controversy: 1, declinedCount: 1 });
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        return '你给教练组打了一通很长的电话。你说自己尊重这身球衣，但这个夏天必须把身体修好。消息传出后，舆论很快分成两派。<br><br>效果：下赛季状态波动略降。';
      }}
    ]
  },
  {
    id: 'china_team_second_call_after_decline',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 18,
    title: '中国男篮：再一次电话',
    scenes: [
      '去年婉拒之后，国家队没有把你的名字划掉。这个夏天，教练组再次打来电话。',
      '语气比第一次更克制，也更沉重：我们还是希望你回来，但这一次，我们需要一个明确答案。'
    ],
    body: '这不是简单的第二次邀请。你需要修复外界对你态度的怀疑，也需要重新决定身体和国家队之间的顺序。',
    requires: function() { return getBranchNode('china_team') === 'second_call_after_decline'; },
    choices: [
      { label: '接受再征召', hint: '带着质疑回归，用表现重新建立信任', apply: function() {
        var mods = getNextSeasonMods();
        var b = setBranchNode('china_team', 'return_under_pressure', { status: 'returned', acceptedCount: (getBranchState('china_team').acceptedCount || 0) + 1 });
        b.reputation = (b.reputation || 0) + 1;
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回到集训基地时，寒暄少了一些，观察多了一些。你没有解释太多，只是在第一堂训练课把每个回合都跑到底。<br><br>重点：信任不是靠声明修复的，你选择用训练和比赛重新把它拿回来。<br><br>影响：传球+1；下赛季伤病风险上升。';
      }},
      { label: '再次婉拒', hint: '身体更安全，但国家队关系明显疏远', apply: function() {
        var mods = getNextSeasonMods();
        var b = setBranchNode('china_team', 'national_team_distance', { status: 'distant', declinedCount: (getBranchState('china_team').declinedCount || 0) + 1 });
        b.controversy = (b.controversy || 0) + 2;
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        addProfileDelta('chinaPopularity', -1);
        return '你第二次说不。电话那头没有责备，只是安静了很久。新闻出来后，讨论不再只是身体管理，而是你和国家队之间到底还剩多少距离。<br><br>重点：你保护了身体，也让国家队关系变得更冷。<br><br>影响：下赛季伤病风险略降；国内舆论压力上升。';
      }},
      { label: '承诺未来窗口', hint: '暂缓决定，保留回归可能', apply: function() {
        setBranchNode('china_team', 'future_commitment', { status: 'future_window' });
        addProfileDelta('mediaTrust', 1);
        return '你没有把门关上。你告诉教练组，自己会在下一个大赛窗口认真考虑。这个答案不够热血，但至少诚实。<br><br>重点：你争取了一点时间，也保留了未来回归的余地。<br><br>影响：舆论暂时缓和。';
      }}
    ]
  },
  {
    id: 'china_team_future_commitment',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 14,
    title: '中国男篮：未来窗口到了',
    scenes: [
      '你曾经承诺会在下一个大赛窗口重新考虑。现在，那个窗口真的来了。',
      '这一次，国家队没有催你。选择权完整地回到了你手里。'
    ],
    body: '你要兑现承诺，还是继续把国家队放在职业规划之外？',
    requires: function() { return getBranchNode('china_team') === 'future_commitment'; },
    choices: [
      { label: '兑现承诺，回到国家队', hint: '重新开始，但需要用表现修复信任', apply: function() {
        setBranchNode('china_team', 'first_camp', { status: 'accepted_late', acceptedCount: (getBranchState('china_team').acceptedCount || 0) + 1 });
        addProfileDelta('chinaPopularity', 1);
        return '你没有再解释过去的决定。报到那天，你提前半小时到训练馆，把球放在地上，自己先练了起来。<br><br>重点：迟到的回归也是回归，接下来要靠比赛说话。<br><br>影响：中国球迷支持略有回升。';
      }},
      { label: '继续不回归', hint: '进入国家队缺席方向', apply: function() {
        setBranchNode('china_team', 'national_team_distance', { status: 'long_absence', declinedCount: (getBranchState('china_team').declinedCount || 0) + 1 });
        addProfileDelta('chinaPopularity', -2);
        return '你没有出现在名单里。久而久之，媒体每次讨论国家队都会提到你，但语气已经从期待变成了遗憾。<br><br>重点：你的 NBA 生涯仍在前进，但国家队这条路开始离你远去。<br><br>影响：中国球迷支持下降。';
      }}
    ]
  },
  {
    id: 'china_team_role_fight',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 14,
    title: '中国男篮：定位之争',
    scenes: [
      '集训第二周，教练安排了一场内部对抗。老队员仍习惯从自己手里发起进攻，年轻队员却不断把球交给你。',
      '训练馆里没人明说，但所有人都知道，这是一次无声的权力交接。'
    ],
    body: '你已经不是被观察的新人了。现在的问题是，你要怎样成为这支球队的核心。',
    requires: function() { return getBranchNode('china_team') === 'first_camp' || getBranchNode('china_team') === 'return_under_pressure'; },
    choices: [
      { label: '主动接管球权', hint: '提高个人声望和关键球，但压力上升', apply: function() {
        var b = setBranchNode('china_team', 'role_fight_primary', { role: 'primary_creator' });
        b.reputation = (b.reputation || 0) + 2;
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你在对抗赛最后三分钟连续叫挡拆，把每个回合都打成自己的判断。教练没有喊停，只是在场边点了点头。<br><br>效果：关键球+1；国家队声望提升。';
      }},
      { label: '先做组织者', hint: '提升传球和国家队默契', apply: function() {
        var b = setBranchNode('china_team', 'role_fight_connector', { role: 'connector' });
        b.reputation = (b.reputation || 0) + 1; b.chemistry = (b.chemistry || 0) + 2;
        addAttrDelta('PAS', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有急着证明自己，而是连续喂出几个简单到舒服的球。年轻队友投进后第一时间回头看你，像是在确认新的秩序。<br><br>效果：传球+2；国家队默契提升。';
      }},
      { label: '保留体能，不争定位', hint: '降低伤病风险，但声望推进较慢', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('china_team', 'role_fight_managed', { role: 'managed_load' });
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return '你主动和教练沟通出场负荷。媒体不太喜欢这个答案，但队医很满意。<br><br>效果：下赛季伤病风险略降。';
      }}
    ]
  },
  {
    id: 'china_team_core_burden',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 16,
    title: '中国男篮：绝对核心',
    scenes: [
      '这一次集训，你的名字被写在所有战术板最上面。教练没有再问你是否准备好。',
      '他说：我们需要你每晚都像核心一样活着。'
    ],
    body: '最后一攻、媒体期待、更衣室责任，现在都被推到你面前。',
    requires: function() { return ['role_fight_primary','role_fight_connector','role_fight_managed'].indexOf(getBranchNode('china_team')) >= 0; },
    choices: [
      { label: '扛起绝对核心责任', hint: '关键球大幅提升，但身体消耗明显', apply: function() {
        var mods = getNextSeasonMods();
        var b = setBranchNode('china_team', 'national_core', { coreStyle: 'hero' });
        b.reputation = (b.reputation || 0) + 3;
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
        addAttrDelta('CLU', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你接受了所有关键球。赢球时全场喊你的名字，输球时所有镜头也追着你。<br><br>效果：关键球+2；国家队声望大幅提升；下赛季伤病风险上升。';
      }},
      { label: '打造团队篮球', hint: '传球和默契提升，风险较低', apply: function() {
        var b = setBranchNode('china_team', 'team_core', { coreStyle: 'system' });
        b.reputation = (b.reputation || 0) + 2; b.chemistry = (b.chemistry || 0) + 3;
        addAttrDelta('PAS', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你开始把年轻队友带进战术中心。中国队不再只等你单挑，而是每个人都知道自己该站在哪里。<br><br>效果：传球+2；国家队默契大幅提升。';
      }},
      { label: '控制负荷，做关键时刻的核心', hint: '保护身体，把责任集中到最需要你的回合', apply: function() {
        var b = setBranchNode('china_team', 'managed_core', { coreStyle: 'managed' });
        b.reputation = (b.reputation || 0) + 1; b.chemistry = (b.chemistry || 0) + 1;
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有把每个回合都揽到自己身上。前三节你让队友承担更多，到了真正需要答案的时候，你再站出来。<br><br>效果：关键球+1；国家队默契提升；下赛季伤病风险略降。';
      }}
    ]
  },
  {
    id: 'china_team_legacy_game',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 18,
    title: '中国男篮：国际大赛关键战',
    scenes: [
      '真正决定评价的比赛来了。不是热身赛，不是小组里的普通夜晚，而是一场会被反复回看的生死战。',
      '赛前发布会上，有记者问你：中国队这次能不能过这一关？你看了看桌上的国旗，没有立刻回答。'
    ],
    body: '这是中国男篮支线的关键节点。你要决定最后一节如何打。',
    requires: function() { return ['national_core','team_core','managed_core'].indexOf(getBranchNode('china_team')) >= 0; },
    choices: [
      { label: '最后一节自己解决', hint: '高声望高压力，成败都很重', apply: function() {
        var b = getBranchState('china_team');
        var win = Math.random() < 0.58;
        if (win) { setBranchNode('china_team', 'national_flag', { ending: 'hero_ball_win' }); b = getBranchState('china_team'); b.legend = (b.legend || 0) + 4; addAttrDelta('CLU', 2); STATE.finalOVR = calcOVR(STATE.attrs); return '你连续三个回合点名对手最强防守人。最后一次出手命中后，替补席冲进场内。<br><br>结果：关键战取胜；关键球+2。'; }
        setBranchNode('china_team', 'public_trial', { ending: 'hero_ball_loss' });
        b.controversy = (b.controversy || 0) + 3;
        return '最后一投砸在篮筐前沿。你站在原地，听见场馆里的声音一点点远去。<br><br>结果：遗憾失利；舆论压力上升。';
      }},
      { label: '相信队友，打团队篮球', hint: '提升传球和传承评价，但结果取决于全队回应', apply: function() {
        var win = Math.random() < 0.68;
        if (win) {
          var b = setBranchNode('china_team', 'team_revival', { ending: 'team_basketball_win' });
          b.legend = (b.legend || 0) + 2; b.chemistry = (b.chemistry || 0) + 3;
          addAttrDelta('PAS', 2); STATE.finalOVR = calcOVR(STATE.attrs);
          return '最后两分钟，你连续把球传给位置更好的队友。有人投进，也有人替你补上防守。这支球队终于不再只靠一个人呼吸。<br><br>效果：传球+2；国家队传承评价提升。';
        }
        var b = setBranchNode('china_team', 'clutch_question', { ending: 'team_basketball_loss' });
        b.controversy = (b.controversy || 0) + 1; b.chemistry = (b.chemistry || 0) + 1;
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '你把球传给了空位队友。战术没有错，出手机会也干净，可篮球有时候就是不讲道理。终场之后，镜头还是回到你脸上。<br><br>结果：团队路线遗憾失利；传球+1；媒体压力上升。';
      }},
      { label: '带伤坚持', hint: '传奇值最高，但伤病风险大幅上升', apply: function() {
        var mods = getNextSeasonMods();
        var b = setBranchNode('china_team', 'injured_hero', { ending: 'injured_legend' });
        b.legend = (b.legend || 0) + 5;
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 4);
        return '队医建议你不要再上，但你把护具重新绑紧。那一晚之后，没人再质疑你对这身球衣的态度。<br><br>结果：国家队传奇值大幅提升；下赛季伤病风险大幅上升。';
      }}
    ]
  },
  {
    id: 'china_team_public_trial',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 16,
    title: '中国男篮：舆论审判',
    scenes: [
      '失利后的几天，你没有打开社交媒体。可有些声音不用打开也会传进来。',
      '有人说你已经尽力，也有人说最后一球证明你还不是答案。'
    ],
    body: '失败没有让国家队故事结束，但它让下一次回归变得更沉重。',
    requires: function() { return getBranchNode('china_team') === 'public_trial' || getBranchNode('china_team') === 'clutch_question'; },
    choices: [
      { label: '回应质疑，准备再次冲击', hint: '承受压力，争取下一次证明', apply: function() {
        setBranchNode('china_team', 'redemption_run', { response: 'public_answer' });
        addSeasonMod('mediaPressure', 1, -10, 10);
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有逃避采访。你说最后一球可以讨论，但下一次你还会站在那里。<br><br>重点：你把失败变成下一次回来的理由。<br><br>影响：关键球+1；媒体压力上升。';
      }},
      { label: '沉默训练', hint: '降低噪音，把回应留给下一届赛事', apply: function() {
        setBranchNode('china_team', 'redemption_run', { response: 'silent_work' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有发声明。训练馆里，助教把那场比赛最后五分钟剪成一个单独文件，你一遍遍看，一遍遍重来。<br><br>重点：你没有把情绪交给舆论，而是把它留给训练。<br><br>影响：下赛季状态更稳定。';
      }},
      { label: '退出国家队', hint: '保护身体，但留下争议结局', apply: function() {
        setBranchNode('china_team', 'controversial_exit', { retiredFromNationalTeam: true });
        addProfileDelta('chinaPopularity', -2);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你宣布暂时退出国家队。声明写得很克制，但所有人都知道，这不是一个轻松的决定。<br><br>重点：你保护了身体，也让国家队故事停在一个不完整的句号。<br><br>影响：中国球迷支持下降；下赛季伤病风险略降。';
      }}
    ]
  },
  {
    id: 'china_team_redemption_run',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 18,
    title: '中国男篮：再次冲击',
    scenes: [
      '又一个大赛窗口来了。这一次，外界不再只问你能不能带队赢，而是问你能不能从上一次失败里走出来。',
      '赛前热身时，你看见看台上有人举着旧比赛的比分牌。那不是嘲讽，更像提醒。'
    ],
    body: '这是失败后的第二次机会。它不会抹掉过去，但可能改变人们记住过去的方式。',
    requires: function() { return getBranchNode('china_team') === 'redemption_run'; },
    choices: [
      { label: '这次自己承担到底', hint: '高风险高收益', apply: function() {
        var win = Math.random() < 0.62;
        if (win) {
          var b = setBranchNode('china_team', 'national_flag', { redemption: 'won' });
          b.legend = (b.legend || 0) + 4;
          addAttrDelta('CLU', 2); STATE.finalOVR = calcOVR(STATE.attrs);
          return '最后两分钟，你没有再犹豫。每一次持球，全队都为你拉开。终场哨响时，你终于把上一次没投进的那口气吐了出来。<br><br>结果：完成救赎；关键球+2。';
        }
        setBranchNode('china_team', 'national_regret', { redemption: 'failed' });
        addProfileDelta('legacyBonus', -1);
        return '你又一次站到了最后。球出手时线路很好，却还是弹了出来。你没有低头，只是慢慢走向更衣室。<br><br>结果：再次遗憾；国家队故事留下沉重注脚。';
      }},
      { label: '坚持团队路线', hint: '强化传承和团队评价', apply: function() {
        var b = setBranchNode('china_team', 'team_revival', { redemption: 'team' });
        b.chemistry = (b.chemistry || 0) + 3;
        addAttrDelta('PAS', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你不再试图一个人回答所有问题。最后阶段，你连续把球交给年轻队友，他们有人投进，也有人投丢，但这支球队终于开始像一个整体。<br><br>效果：传球+2；国家队团队评价提升。';
      }}
    ]
  },
  {
    id: 'china_team_final_resolution',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 14,
    title: '中国男篮：传承或告别',
    scenes: [
      '年轻队友叫你一声队长。你突然意识到，自己已经不是被征召的人，而是后来者判断中国篮球高度的参照物。',
      '这个夏天，国家队没有再问你能不能来。他们问的是：你希望以什么方式继续留下？'
    ],
    body: '你已经走到国家队故事的收束点。继续出战、让位，或体面告别，都会留下不同的记忆。',
    requires: function() { return ['national_flag','team_revival','injured_hero'].indexOf(getBranchNode('china_team')) >= 0; },
    choices: [
      { label: '继续出战，为年轻人压阵', hint: '声望最高，但身体负担继续存在', apply: function() {
        var b = setBranchNode('china_team', 'national_legend', { finalRole: 'captain' });
        b.legend = (b.legend || 0) + 3;
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('legacyBonus', 2);
        addSeasonMod('injuryRiskBonus', 1, -4, 8);
        return '你没有把队长袖标交出去。训练结束后，年轻队友还在等你讲最后一组战术。<br><br>重点：你选择继续站在最前面。<br><br>影响：中国球迷支持上升；历史评价上升；下赛季伤病风险略升。';
      }},
      { label: '让位年轻球员，转为精神领袖', hint: '保护身体，强化传承评价', apply: function() {
        setBranchNode('china_team', 'national_mentor', { finalRole: 'mentor' });
        addProfileDelta('chinaPopularity', 2);
        addProfileDelta('legacyBonus', 2);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把更多球权交给年轻人。暂停时，你不再总是第一个接球的人，却成了所有人回头寻找的声音。<br><br>重点：你从核心变成参照物。<br><br>影响：中国篮球评价上升；下赛季伤病风险略降。';
      }},
      { label: '宣布退出国家队', hint: '体面告别，身体保护', apply: function() {
        setBranchNode('china_team', 'honorable_exit', { retiredFromNationalTeam: true });
        addProfileDelta('legacyBonus', 1);
        addSeasonMod('injuryRiskBonus', -2, -4, 8);
        return '发布会最后，你把国家队球衣叠好放在桌上。你说自己不是离开，只是把路让给后来的人。<br><br>重点：国家队故事有了一个完整的句号。<br><br>影响：下赛季伤病风险下降；退役后的中国篮球相关评价更完整。';
      }}
    ]
  },
  {
    id: 'china_team_distance_resolution',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 8,
    title: '中国男篮：越来越远的名单',
    scenes: [
      '又一年国家队窗口，你没有把自己的名字放进名单。公布那天你翻了一遍，果然没有你。',
      '一开始媒体还会争论，后来大家慢慢习惯把你放在另一条叙事里：NBA 成功，但国家队缺席。'
    ],
    body: '长期拒绝国家队也应该有结局。它不是错误选择，但会留下缺口。',
    requires: function() { return getBranchNode('china_team') === 'national_team_distance'; },
    choices: [
      { label: '未来主动回归', hint: '重新打开国家队关系，但需要修复信任', apply: function() {
        setBranchNode('china_team', 'return_under_pressure', { status: 'late_return' });
        addProfileDelta('chinaPopularity', 1);
        return '你主动给教练组打了电话。电话那头没有立刻热情起来，但至少那扇门又开了一条缝。<br><br>重点：你选择重新面对曾经拉开的距离。<br><br>影响：中国球迷支持略有回升。';
      }},
      { label: '长期不回归', hint: '国家队缺席结局', apply: function() {
        setBranchNode('china_team', 'national_team_absence', { finalRole: 'absent' });
        addProfileDelta('chinaPopularity', -2);
        addProfileDelta('legacyBonus', -1);
        return '你继续专注 NBA。很多年后，每次国际大赛名单公布，还是会有人提起你的名字，但语气已经从期待变成遗憾。<br><br>重点：你的职业生涯很成功，但国家队篇章留下了空白。<br><br>影响：中国球迷支持下降；历史评价略受影响。';
      }}
    ]
  },
  {
    id: 'relationship_first_date',
    branch: 'relationship', phase: 'offseason', slot: 'main', weight: 8,
    title: '恋爱线：约会邀请',
    scenes: [
      '休赛期刚开始，两条完全不同的邀请同时出现：一位当红女明星通过共同朋友发来邀请，朋友也介绍了一位圈外女孩，她在一家小设计工作室上班。',
      '经纪团队提醒你：一条路通往热搜和商业版图，另一条路安静得多，但同样会改变你的夏天。'
    ],
    body: '你要选择哪一种生活出现在训练馆以外？',
    requires: function() {
      var c = STATE.career || {};
      return getBranchNode('relationship') === 'start' && (c.currentAge || 22) >= 22;
    },
    choices: [
      { label: '接受女明星邀约', hint: '开启高曝光恋爱线，可能稳定也可能分心', apply: function() {
        var c = STATE.career; c.relationships = c.relationships || {};
        setBranchNode('relationship', 'dating', { status: 'dating' });
        c.relationships.partner = { type: 'actress', status: 'dating', sinceSeason: c.seasonCount, volatility: 2 };
        return '你们第一次见面是在一个很低调的私人餐厅。她没有问你数据，只问你赢球后为什么总是先低头。<br><br>结果：恋爱线开启；媒体曝光高；下一步进入关系走向。';
      }},
      { label: '接受圈外女孩约会', hint: '开启低曝光恋爱线，生活更安静', apply: function() {
        var c = STATE.career; c.relationships = c.relationships || {};
        setBranchNode('relationship', 'dating', { status: 'dating' });
        c.relationships.partner = { type: 'ordinary', status: 'dating', sinceSeason: c.seasonCount, volatility: 1 };
        return '她带你去吃了一家没有明星会去的街边小店。她说自己不看球，只知道你训练很拼。那个晚上没有照片，也没有热搜。<br><br>结果：恋爱线开启；媒体关注低；下一步进入关系走向。';
      }},
      { label: '礼貌拒绝，专注训练', hint: '不开启恋爱线，获得小训练收益', apply: function() {
        setBranchNode('relationship', 'declined', { status: 'declined', declinedSeason: STATE.career.seasonCount });
        addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回了一条很短但体面的消息，然后把手机交给训练师保管。<br><br>效果：耐力+1；恋爱线记录为“曾经拒绝”。';
      }}
    ]
  },
  {
    id: 'relationship_second_chance',
    branch: 'relationship', phase: 'offseason', slot: 'main', weight: 10,
    title: '恋爱线：第二次约会邀请',
    scenes: [
      '两年过去，你几乎已经习惯训练馆、客场和一个人的夏天。直到那天，一条旧消息重新出现在屏幕上。',
      '经纪团队说得很直接：当初那条没走成的路，现在又有人递来了邀请。这一次，没人替你决定。'
    ],
    body: '两年后的夏天，你要不要让恋爱线重新开始？',
    requires: function() {
      var b = getBranchState('relationship');
      var c = STATE.career || {};
      var declinedAt = b.declinedSeason || 0;
      return getBranchNode('relationship') === 'declined' && (c.seasonCount || 0) - declinedAt >= 2;
    },
    choices: [
      { label: '接受女明星邀约', hint: '高曝光恋爱线重新开启', apply: function() {
        var c = STATE.career; c.relationships = c.relationships || {};
        setBranchNode('relationship', 'dating', { status: 'dating', secondChance: true });
        c.relationships.partner = { type: 'actress', status: 'dating', sinceSeason: c.seasonCount, volatility: 2, secondChance: true };
        return '两年后，那条没走成的邀请重新出现。你们约在最初那家私人餐厅，她没有再问你为什么拒绝，只说：这次你来了。<br><br>结果：恋爱线重新开启；媒体曝光高；下一步进入关系走向。';
      }},
      { label: '接受圈外女孩约会', hint: '低曝光恋爱线重新开启', apply: function() {
        var c = STATE.career; c.relationships = c.relationships || {};
        setBranchNode('relationship', 'dating', { status: 'dating', secondChance: true });
        c.relationships.partner = { type: 'ordinary', status: 'dating', sinceSeason: c.seasonCount, volatility: 1, secondChance: true };
        return '朋友说，那个在工作室的女孩还留着两年前那条礼貌的回复。你们约在那家街边小店，她笑你比新闻里安静。<br><br>结果：恋爱线重新开启；媒体关注低；下一步进入关系走向。';
      }},
      { label: '再次拒绝，专注篮球', hint: '恋爱线永久收束', apply: function() {
        setBranchNode('relationship', 'declined_closed', { status: 'declined', secondDecline: true });
        addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回了一条很短的感谢，然后把手机交回训练师。这次你知道，自己选的就是这条路。<br><br>效果：耐力+1；恋爱线记录为“二次拒绝”，不再开启。';
      }}
    ]
  },
  {
    id: 'relationship_direction',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '恋爱线：关系走向',
    scenes: [
      '几周过去，这段关系不再只是一次约会。她开始知道你的训练表，你也开始记得她的行程。',
      '问题变得具体起来：这会成为支撑，还是成为噪音？'
    ],
    body: '你要如何处理这段关系和职业生涯的边界？',
    requires: function() { return getBranchNode('relationship') === 'dating'; },
    choices: [
      { label: '认真经营，保持低调', hint: '状态更稳定，球队默契略升', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'stable', { status: 'stable' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'stable';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        return '你们决定不公开，也不把这件事变成新闻。队友偶尔调侃你，但更衣室气氛反而轻松了不少。<br><br>效果：下赛季状态波动略降；球队默契略升。';
      }},
      { label: '享受热恋，不想太克制', hint: '可能状态火热，也可能分心', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'volatile', { status: 'volatile' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'volatile';
        var hot = Math.random() < 0.45;
        if (hot) { addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs); return '她开始频繁出现在你的主场。你每次看到场边那个位置，都像被多点燃了一点。<br><br>结果：状态火热；关键球+1。'; }
        mods.formVariance = Math.min(4, (mods.formVariance || 0) + 2);
        return '你开始频繁改训练时间，只为了配合她的行程。训练师没有明说，但白板上的缺席记录越来越显眼。<br><br>结果：乐不思蜀；下赛季状态波动上升。';
      }},
      { label: '暂时拉开距离', hint: '保护身体与专注，但关系可能降温', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'distant', { status: 'distant' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'distant';
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return '你和她约定这几个月先以比赛为重心。消息回得慢了，见面次数也少了，但至少你没有让生活失控。<br><br>效果：下赛季状态波动略降；伤病风险略降；关系进入距离期。';
      }}
    ]
  },
  {
    id: 'relationship_public_or_crisis',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '恋爱线：公开或风波',
    scenes: [
      '你不想让媒体替你们宣布。你约她坐下来，认真谈了一次：要不要由我们亲口说出这段关系？',
      '她说：你想清楚，别让我一个人站在镜头前。'
    ],
    body: '恋爱线进入公开节点。你的选择会决定这段关系的长期标签。',
    requires: function() {
      return getRelationshipPartnerType() === 'actress' && (getBranchNode('relationship') === 'stable' || getBranchNode('relationship') === 'volatile');
    },
    choices: [
      { label: '公开关系', hint: '商业热度上升，但舆论风险增加', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'public', { status: 'public' });
        STATE.career.flags.businessBuzz = true;
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'public';
        mods.formVariance = Math.min(4, (mods.formVariance || 0) + 1);
        return '你们一起发了一张没有任何品牌露出的合照。评论区爆了，赞助商也开始打电话。<br><br>结果：关系公开；商业热度上升；下赛季状态波动略升。';
      }},
      { label: '共同冷处理', hint: '稳定优先，商业收益较低', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'private', { status: 'private' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'private';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        return '你们没有回应任何传闻。几天后，新的新闻盖过旧的新闻，生活慢慢回到训练和比赛。<br><br>结果：关系保持低调；下赛季状态波动略降。';
      }},
      { label: '处理失控风波', hint: '高风险，可能影响身体和状态', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'crisis', { status: 'crisis' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'crisis';
        addProfileDelta('controversy', 1);
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 3);
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 1);
        return '几张模糊照片被放大解读，争吵和声明迅速发酵。你训练后还要处理电话，身体也没有恢复得那么干净。<br><br>结果：感情纠纷；状态波动明显上升；伤病风险略升。';
      }}
    ]
  },
  {
    id: 'relationship_ordinary_warmth',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '恋爱线：生活里的她',
    scenes: [
      '你开始主动把她带进你的生活：训练馆门口、公寓楼下、输球后的停车场。她没有热搜，也没有团队，只是每次都站在那里。',
      '你第一次意识到，和女明星在一起是“被看见”，和她在一起是“被接住”。'
    ],
    body: '普通人的恋爱没有镜头，却有温度。你选择用什么方式把这份温度留住？',
    requires: function() {
      return getRelationshipPartnerType() === 'ordinary' && (getBranchNode('relationship') === 'stable' || getBranchNode('relationship') === 'volatile');
    },
    choices: [
      { label: '带她走进你的世界', hint: '让她认识球队、家人和真实赛程', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'committed' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'committed';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        addProfileDelta('fanSupport', 1);
        return '她第一次坐在你主场的家属席，球馆灯光打下来，她比你还紧张。赛后你说这是你打过最想赢的一场。队友起哄，她脸红，你却觉得这比任何头条都值。<br><br>重点：恋爱线进入长期稳定，家庭线解锁。<br><br>影响：球队默契+1；球迷支持+1；下赛季状态波动略降。';
      }},
      { label: '走进她的世界', hint: '陪她过普通人的生活，见她的家人和朋友', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'committed' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'committed';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        addProfileDelta('fanSupport', 1);
        return '她带你去菜市场挑鱼，去她工作室看图纸，去她老家吃一顿没有赞助商的晚饭。她的妈妈说你太瘦了，往你碗里又添了一勺饭。那一晚你睡得很好。<br><br>重点：恋爱线进入长期稳定，家庭线解锁。<br><br>影响：下赛季状态波动明显下降；球迷支持+1。';
      }},
      { label: '一起扛过低谷', hint: '在她面前可以脆弱，也学会被照顾', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'committed' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'committed';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '球队连败那阵，你半夜从酒店醒来，手机里是她发的长语音：没关系，我在。后来她把感冒药和夜宵送到训练馆门口，只说了一句：吃完再练。<br><br>重点：恋爱线进入长期稳定，家庭线解锁。<br><br>影响：关键球+1；下赛季状态波动明显下降。';
      }}
    ]
  },
  {
    id: 'relationship_after_distance',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '恋爱线：距离之后',
    scenes: [
      '休赛期接近尾声，你主动约了一次安静的晚饭。没有热搜，没有行程，只有两个人重新确认彼此的位置。',
      '她说：我不想成为你训练表里的负担，也不想只是你新闻里的注脚。'
    ],
    body: '拉开距离的时间结束了。这段关系是重新靠近，还是体面退场？',
    requires: function() { return getBranchNode('relationship') === 'distant'; },
    choices: [
      { label: '重新建立节奏', hint: '关系回暖，球队默契略升', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'stable', { status: 'rekindled' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'stable';
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        return '你主动把她的时间排进恢复计划，也把训练时间排进她的行程。这次不是妥协，而是两个人都找到了节奏。<br><br>效果：关系重新稳定；球队默契略升。';
      }},
      { label: '变成普通朋友', hint: '体面结束，保护专注度', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'breakup', { status: 'friends' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'friends';
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        return '你们聊到很晚，最后把话说明白了：这段关系没有变成支撑，也没有变成噪音，只是没有继续下去的力气。<br><br>结果：和平结束；下赛季状态波动略降。';
      }}
    ]
  },
  {
    id: 'relationship_commitment',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '恋爱线：稳定关系',
    scenes: [
      '关系公开之后，生活变得更吵，但至少你们不用再躲。你主动在主场家属席给她留了位置，她也开始习惯赛后等你。',
      '真正的问题不是要不要在一起，而是要不要把彼此放进更长期的人生计划。'
    ],
    body: '这是恋爱线的收束节点。你可以把关系推向长期承诺，也可以保持现状。',
    requires: function() { return getBranchNode('relationship') === 'public' || getBranchNode('relationship') === 'private'; },
    choices: [
      { label: '正式承诺', hint: '关系进入长期稳定，家庭线可触发', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'committed' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'committed';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('fanSupport', 1);
        return '没有盛大的仪式，你在她面前把下赛季的赛程表打开，说这里面也有一份你的位置。<br><br>重点：恋爱线进入长期稳定，家庭线解锁。<br><br>影响：下赛季状态波动略降；球迷支持略升。';
      }},
      { label: '保持现状，低调陪伴', hint: '关系稳定但不急于承诺', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'long_term' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'long_term';
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        return '你们没有把承诺变成仪式，但每个休赛期都把对方排进生活。稳定不是一句口号，而是彼此都在场。<br><br>重点：恋爱线进入长期陪伴，家庭线解锁。<br><br>影响：下赛季状态波动略降；球队默契略升。';
      }}
    ]
  },
  {
    id: 'relationship_crisis_recovery',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 13,
    title: '恋爱线：风波之后',
    scenes: [
      '风波之后，你决定先关掉手机。媒体还在等声明，但你想先把话说给该听的人听。',
      '你第一次意识到，这段关系已经不是两个人的事，而是很多人的谈资。'
    ],
    body: '风波之后，你要决定这段关系往哪走。',
    requires: function() { return getBranchNode('relationship') === 'crisis'; },
    choices: [
      { label: '修复关系', hint: '关系转稳，降低争议', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'repaired' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'repaired';
        addProfileDelta('controversy', -1);
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        return '你们没有立刻回应媒体，而是先关掉手机谈了一整晚。最后你只发了一句简短的话，把故事从猜测拉回事实。<br><br>重点：风波被修复，关系进入长期稳定。<br><br>影响：争议下降；下赛季状态波动明显回落。';
      }},
      { label: '转为低调陪伴', hint: '关系降温但保留，避开聚光灯', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'private', { status: 'private_after_storm' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'private';
        addProfileDelta('controversy', -1);
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        return '你们决定不再对镜头交代任何事。慢慢地，热搜被下一件事盖过，生活重新变得安静。<br><br>结果：关系转低调；争议下降；接下来可进入稳定关系。';
      }},
      { label: '分手止损', hint: '结束关系，保护状态但留下讨论', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'breakup', { status: 'breakup' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'breakup';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return '声明很短：我们尊重彼此，也尊重各自的未来。训练馆里没人问细节，但你知道这条新闻还会被讨论很久。<br><br>结果：恋爱线结束；下赛季状态波动略降；伤病风险略降。';
      }}
    ]
  },
  {
    id: 'relationship_betrayal',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 8,
    title: '恋爱线：被情感伤害',
    scenes: [
      '最近的对话越来越不对劲：临时取消、扣过去的手机、对不上的时间。你决定主动约她见面，把话说开。',
      '她没有否认。真相摆到桌上时，你才明白，信任裂开的声音很轻。'
    ],
    body: '这是恋爱线里“被情感伤害”的走向。信任一旦裂开，继续或离开都会留下痕迹。',
    requires: function() {
      var node = getBranchNode('relationship');
      var p = (STATE.career && STATE.career.relationships && STATE.career.relationships.partner) || {};
      if (node === 'volatile' || node === 'crisis') return true;
      return node === 'distant' && p.type === 'ordinary';
    },
    choices: [
      { label: '当面问清，选择原谅', hint: '关系保留，但留下信任裂缝', apply: function() {
        var mods = getNextSeasonMods();
        var p = (STATE.career.relationships && STATE.career.relationships.partner) || {};
        var intro = p.type === 'ordinary' ? '她终于坦白：她认识了一个能每天陪她吃晚饭的人。你们隔着时差和赛程维系了半年，最后还是输给了距离。' : '那张照片拍得很清楚：她和一个陌生男人在同一辆车里，时间对不上你们的行程。';
        setBranchNode('relationship', 'hurt_scar', { status: 'hurt_scar' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'hurt_scar';
        STATE.career.flags.relationshipHurt = true;
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 2);
        return intro + '<br><br>她没有否认，也没有狡辩。你听完了所有解释，最后只说了一句：我原谅你，但需要时间。<br><br>重点：关系保留，但信任裂缝已经存在。<br><br>影响：下赛季状态波动上升；不解锁家庭线。';
      }},
      { label: '决绝分手，封存感情', hint: '结束关系，保护自己，但留下防备心', apply: function() {
        var mods = getNextSeasonMods();
        var p = (STATE.career.relationships && STATE.career.relationships.partner) || {};
        var intro = p.type === 'ordinary' ? '她最终承认，自己已经先走远了。你说不出愤怒，只觉得那半年的视频通话像一场漫长的告别。' : '照片和聊天记录被放在你面前，没有误会，也没有反转。';
        setBranchNode('relationship', 'hurt_guard', { status: 'hurt_guard' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'hurt_guard';
        STATE.career.flags.relationshipHurt = true;
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 1);
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return intro + '<br><br>你把她的联系方式全部删除。发布会没人敢问，但更衣室里所有人都知道，你的眼神变冷了。<br><br>重点：你保护了自己，也把心门关上了。<br><br>影响：下赛季状态波动略升；伤病风险略降；之后恋爱线不再开启。';
      }},
      { label: '彻底放下，专注自己', hint: '接受伤害，用训练消化情绪', apply: function() {
        var mods = getNextSeasonMods();
        var p = (STATE.career.relationships && STATE.career.relationships.partner) || {};
        var intro = p.type === 'ordinary' ? '她哭了，说对不起。你第一次发现，原谅和继续是两件完全不同的事。' : '她试图解释，但你已经不想再听版本二。';
        setBranchNode('relationship', 'hurt_moved_on', { status: 'hurt_moved_on' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'hurt_moved_on';
        STATE.career.flags.relationshipHurt = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return intro + '<br><br>你约教练加练，把那些没回的消息全部清空。痛是真的，但你决定不让它定义你。<br><br>重点：你选择走出阴影。<br><br>影响：耐力+1；下赛季状态波动略降；获得“走出阴影”标签。';
      }}
    ]
  },
  {
    id: 'relationship_single_aftermath',
    branch: 'relationship', phase: 'offseason', slot: 'main', weight: 6,
    title: '恋爱线：单身生活',
    scenes: [
      '没有新故事可写。媒体开始习惯把“感情状态”从你的档案里划掉。',
      '你发现训练馆里的时间反而变得完整：没有电话要回，没有行程要迁就。'
    ],
    body: '恋爱线以单身结束。你可以选择怎么消化这段空白。',
    requires: function() { var n = getBranchNode('relationship'); return n === 'breakup' || n === 'declined_closed'; },
    choices: [
      { label: '专注篮球', hint: '耐力提升，心更静', apply: function() {
        setBranchNode('relationship', 'single_focus', { finalStatus: 'focused' });
        addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        STATE.career.flags.singleFocus = true;
        return '你把休赛期重新排满。助教说你又回到了刚进联盟时的样子：眼里只有训练和比赛。<br><br>效果：耐力+1；获得“单身专注”标签。';
      }},
      { label: '顺其自然', hint: '保持开放，不刻意寻找', apply: function() {
        setBranchNode('relationship', 'single_open', { finalStatus: 'open' });
        addProfileDelta('fanSupport', 1);
        return '你没有把单身当成问题。偶尔和朋友吃饭，偶尔独自加练，生活没有因为缺少一段关系而变空。<br><br>效果：心态稳定；球迷支持略升。';
      }}
    ]
  },
  {
    id: 'network_golf_intro',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 7,
    title: '人脉线：名人高尔夫局',
    scenes: [
      '休赛期，赞助商的高尔夫局邀请函放在你桌上。你翻开看了很久，决定要不要用这个夏天换一张场外入场券。',
      '你原本只是想放松，结果第一洞还没打完，就有人开始聊阵容、市场和未来几年联盟的权力流向。'
    ],
    body: '你要不要进入这个场外圈子？',
    requires: function() {
      return getBranchNode('network') === 'start' && (STATE.career.currentAge || 22) >= 24 && ((STATE.finalOVR || 0) >= 85 || hasCareerHonor('全明星') || hasCareerHonor('总冠军'));
    },
    choices: [
      { label: '参加高尔夫局', hint: '开启人脉线，可能遇到 Rich Paul 或库里圈子', apply: function() {
        var c = STATE.career; c.flags = c.flags || {};
        setBranchNode('network', 'golf_meet', { status: 'golf' });
        if (Math.random() < 0.5) { c.flags.richPaulContact = true; return '你和 Rich Paul 的团队在第九洞聊了很久。他们没有直接招募你，只说未来可以坐下来谈职业版图。<br><br>结果：记录 Rich Paul 接触；人脉线进入二阶段。'; }
        c.flags.curryCircle = true; addAttrDelta('threePT', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '库里团队的人注意到你在果岭上的手感，玩笑说你的腕部控制像投篮。后来对方留下了联系方式。<br><br>效果：三分+1；记录库里圈子；人脉线进入二阶段。';
      }},
      { label: '拒绝社交，留在训练馆', hint: '放弃社交，把整个夏天留给训练', apply: function() {
        setBranchNode('network', 'training_focus', { status: 'training' });
        addAttrDelta('MID', 1); addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你婉拒了球局，把那一整天留给训练馆。助教说你可能错过了一些人脉，但你只回了一句：球会替我介绍自己。<br><br>效果：中投+1，耐力+1。';
      }}
    ]
  },
  {
    id: 'superstar_recruit_call',
    branch: 'superstar_recruit', phase: 'offseason', slot: 'main', weight: 18,
    title: '巨星招募：午夜电话',
    scenes: [
      '休赛期训练结束后，手机在储物柜里亮了很久。',
      '来电的人不是记者，也不是经纪人，而是{招募者}。他说：我不想再只隔着球衣和你对抗了。我们可以一起赢。别让忠诚害了你，你难道不想复刻詹姆斯的传奇历程吗？'
    ],
    body: '{招募者}所在的{招募球队}正在寻找另一个能改变系列赛的人。你不需要现在答应，但这通电话会让自由市场变得不一样。',
    requires: function() {
      var c = STATE.career;
      if (!c || !c.flags) return false;
      var season = c.seasonCount || 0;
      if ((STATE.finalOVR || 0) < 85 && !hasCareerHonor('全明星') && !hasCareerHonor('最佳阵容')) return false;
      if ((c.contract || 0) > 1 && (c.currentAge || 22) < 24) return false;
      if (c.flags.lastSuperstarRecruitSeason != null && season - c.flags.lastSuperstarRecruitSeason < 3) return false;
      var node = getBranchNode('superstar_recruit');
      if (node && node !== 'start') return false;
      return !!prepareSuperstarRecruitment();
    },
    choices: [
      { label: '认真考虑联手', hint: '目标球队报价倾向明显提高，但争议会上升', apply: function() {
        var c = STATE.career; c.flags = c.flags || {};
        var star = prepareSuperstarRecruitment();
        if (!star) return '你让经纪人先别回应。电话挂断后，训练馆重新安静下来。';
        c.flags.lastSuperstarRecruitSeason = c.seasonCount || 0;
        c.flags.superstarRecruitInterest = 'serious';
        c.flags.freeAgentChoice = 'contender';
        setBranchNode('superstar_recruit', 'consider_team_up', { targetTeam: c.flags.superstarRecruitTargetTeam, recruiter: c.flags.superstarRecruiterName });
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你没有答应，也没有拒绝，只说：让我的团队和你们聊聊。几分钟后，经纪人的电话就打了进来。<br><br>重点：{招募球队}会成为自由市场重点选项。<br><br>影响：人气+1；争议+1；自由市场更偏争冠联手。';
      }},
      { label: '保持距离', hint: '维持自主和忠诚，不改变报价倾向', apply: function() {
        var c = STATE.career; c.flags = c.flags || {};
        prepareSuperstarRecruitment();
        c.flags.lastSuperstarRecruitSeason = c.seasonCount || 0;
        c.flags.superstarRecruitInterest = 'declined';
        setBranchNode('superstar_recruit', 'kept_distance', { targetTeam: c.flags.superstarRecruitTargetTeam, recruiter: c.flags.superstarRecruiterName });
        addProfileDelta('loyalty', 1);
        addProfileDelta('mediaTrust', 1);
        return '你感谢了他的尊重，但没有给任何承诺。你说：如果未来真的要决定，我希望那是我自己的决定。<br><br>重点：你保持距离，也保住了主动权。<br><br>影响：忠诚+1；媒体好感+1。';
      }},
      { label: '把消息放给媒体', hint: '制造热度，大市场和争冠队更关注你', apply: function() {
        var c = STATE.career; c.flags = c.flags || {};
        var star = prepareSuperstarRecruitment();
        if (!star) return '你让经纪人先别回应。电话挂断后，训练馆重新安静下来。';
        c.flags.lastSuperstarRecruitSeason = c.seasonCount || 0;
        c.flags.superstarRecruitInterest = 'public';
        c.flags.freeAgentChoice = 'market';
        setBranchNode('superstar_recruit', 'public_leverage', { targetTeam: c.flags.superstarRecruitTargetTeam, recruiter: c.flags.superstarRecruiterName });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 2);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '第二天，记者们都在问同一个问题：{招募者}是不是已经给你打过电话？你没有承认，也没有否认。自由市场的空气一下变热了。<br><br>重点：你把招募变成筹码。<br><br>影响：人气+2；争议+2；媒体压力+1；大市场报价倾向提升。';
      }}
    ]
  },
  {
    id: 'network_court_introduction',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 8,
    title: '人脉线：迟来的入场券',
    scenes: [
      '你拒绝那次高尔夫局之后，没有离开这场游戏。三年后，你主动让经纪人把你的名字放进全明星周末的晚宴名单。',
      '助教笑着说：你看，球真的会替你介绍自己。'
    ],
    body: '拒绝不是终点。当你的表现足够硬，门会自己再开一次。',
    requires: function() {
      return getBranchNode('network') === 'training_focus' && ((STATE.finalOVR || 0) >= 88 || hasCareerHonor('全明星') || hasCareerHonor('总冠军'));
    },
    choices: [
      { label: '接受迟来的入场券', hint: '重新进入人脉线，从第二次会面继续', apply: function() {
        setBranchNode('network', 'golf_meet', { status: 'reopened' });
        addProfileDelta('fame', 1);
        addProfileDelta('businessValue', 1);
        return '你坐在同一张晚宴桌旁，这次没有人再试探你，而是直接问你想要什么。<br><br>重点：你重新回到人脉线。<br><br>影响：人气+1；商业价值+1。';
      }},
      { label: '继续把时间留给训练', hint: '彻底走训练馆路线', apply: function() {
        setBranchNode('network', 'training_resource', { identity: 'training_resource' });
        addAttrDelta('MID', 1); addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把名片收进抽屉，第二天照常出现在训练馆。助教没有再劝，因为他知道，这条路同样是你想要的。<br><br>效果：中投+1，耐力+1；获得“顶级训练资源”标签；人脉线以训练身份收束。';
      }}
    ]
  },
  {
    id: 'network_follow_up',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 12,
    title: '人脉线：第二次会面',
    scenes: [
      '这个夏天，你主动拨通了之前那次球局留下的联系方式。',
      '这一次不是寒暄。对方带着明确的问题来：你想把职业生涯经营成什么样？'
    ],
    body: '人脉线进入正式会面。你可以选择商业版图，或者保持球员身份的纯粹。',
    requires: function() { return getBranchNode('network') === 'golf_meet'; },
    choices: [
      { label: '接受职业版图会议', hint: '商业热度上升，未来会有更多选择', apply: function() {
        var b = setBranchNode('network', 'career_map_meeting', { status: 'business_team' });
        b.business = (b.business || 0) + 2;
        STATE.career.flags.businessBuzz = true;
        return '会议室里没有战术板，只有品牌、城市、合同和未来十年的规划。你第一次意识到，球员也可以经营自己的时代。<br><br>结果：商业热度提升；未来自由市场/品牌线获得伏笔。';
      }},
      { label: '只保留私人联系', hint: '降低商业噪音，保持训练稳定', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('network', 'private_circle', { status: 'private_circle' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        return '你没有答应任何团队，也没有拒绝任何朋友。关系被留在私人层面，训练节奏没有被打断。<br><br>结果：下赛季状态波动略降。';
      }}
    ]
  },
  {
    id: 'network_identity',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 10,
    title: '人脉线：圈层身份',
    scenes: [
      '几年过去，你已经不是被介绍进局的人。现在新的年轻球员会被带到你面前。',
      '他们看你的眼神，像是在看一个已经拿到入场券的人。'
    ],
    body: '你要把这条人脉线变成什么身份？',
    requires: function() { return getBranchNode('network') === 'career_map_meeting'; },
    choices: [
      { label: '建立自己的商业圈', hint: '商业标签成型', apply: function() {
        setBranchNode('network', 'business_circle', { identity: 'business_circle' });
        STATE.career.flags.businessLeader = true;
        return '你开始主动组织休赛期小型聚会。球员、经纪人、投资人都知道，有些事情可以通过你牵上线。<br><br>结果：获得“商业圈层”长期标签。';
      }},
      { label: '把圈子用于训练资源', hint: '训练收益稳定', apply: function() {
        setBranchNode('network', 'training_resource', { identity: 'training_resource' });
        addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把人脉主要用在训练师、康复师和高质量陪练上。它不热闹，但非常实用。<br><br>效果：耐力+1；获得“顶级训练资源”长期标签。';
      }}
    ]
  },
  {
    id: 'training_camp_open',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 12,
    title: '夏日训练：夏天的岔路口',
    scenes: [
      '休赛期第一天，训练馆的灯只开了一半。助教把三份计划放在桌上：巨星训练营、专项课程、身体评估。',
      '你站在门口想了很久。过去一个赛季的疲惫、遗憾和不甘心，都堆在这个夏天面前。'
    ],
    body: '这个夏天决定的不只是属性，而是你准备成为什么样的球员。',
    requires: function() { return getBranchNode('training') === 'start'; },
    choices: [
      { label: '跟巨星练一夏', hint: '从前辈身上继承比赛理解', apply: function() {
        setBranchNode('training', 'mentor_line', { route: 'mentor' });
        return '你拨通了经纪人的电话：帮我把训练营都排上，我想看看他们怎么理解篮球。<br><br>重点：选择导师线。<br><br>影响：下一步进入导师第一课。';
      }},
      { label: '把专项磨成武器', hint: '一个方向练到对手害怕', apply: function() {
        setBranchNode('training', 'skill_line', { route: 'skill' });
        return '你把夏天的日历清空，只留下一项技术。训练师说：这是最无聊也最可怕的夏天。<br><br>重点：选择专项线。<br><br>影响：下一步进入专项第一课。';
      }},
      { label: '先把身体修好', hint: '恢复、力量、作息，重建身体底子', apply: function() {
        setBranchNode('training', 'body_line', { route: 'body' });
        return '你告诉队医：这赛季的疲劳感我不想再带着打。所有计划从一次彻底的身体评估开始。<br><br>重点：选择身体线。<br><br>影响：下一步进入身体重建计划。';
      }},
      { label: '双线并行', hint: '导师点拨 + 专项训练，强度更大', apply: function() {
        setBranchNode('training', 'dual_line', { route: 'dual' });
        return '你贪心地两个都要。教练组摇头，但你列了一张精确到小时的表：上午导师，下午专项。<br><br>重点：选择双修线。<br><br>影响：下一步进入双修计划。';
      }},
      { label: '找回篮球的乐趣', hint: '野球、孩子、家庭，让热爱先回来', apply: function() {
        setBranchNode('training', 'joy_line', { route: 'joy' });
        return '你把训练表收起来，先跑去野球场打了一下午。汗水落下来的时候，你突然觉得，自己还能再爱一次。<br><br>重点：选择乐趣线。<br><br>影响：下一步进入快乐篮球计划。';
      }}
    ]
  },
  {
    id: 'mentor_first_lesson',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 13,
    title: '夏日训练：导师第一课',
    scenes: [
      '训练馆很安静，只有鞋底摩擦地板的声音。老将没有先教动作，他先问你：你上一次真正喜欢篮球是什么时候？'
    ],
    body: '选择一位导师，带走一种比赛理解。',
    requires: function() { return getBranchNode('training') === 'mentor_line'; },
    choices: [
      { label: '奥拉朱旺：梦幻脚步', hint: '终结/内防/篮板', apply: function() {
        getBranchState('mentor').lastMentor = 'hakeem';
        setBranchNode('training', 'mentor_first', { lastMentor: 'hakeem' });
        addAttrDelta('FIN', 2); addAttrDelta('IDEF', 1); addAttrDelta('REB', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '奥拉朱旺没有急着教动作，他先让你在低位连续转身二十分钟。每次你以为找到了节奏，他都会轻轻摇头：脚先骗过人，球只是最后的证明。<br><br>效果：终结+2，内防+1，篮板+1。';
      }},
      { label: '杜兰特：无差别单打', hint: '中投/三分', apply: function() {
        getBranchState('mentor').lastMentor = 'durant';
        setBranchNode('training', 'mentor_first', { lastMentor: 'durant' });
        addAttrDelta('MID', 2); addAttrDelta('threePT', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '杜兰特让你在贴身干扰下反复出手。他说：伟大的投篮不是空位准，而是被看穿后依然能进。<br><br>效果：中投+2，三分+1。';
      }},
      { label: '詹姆斯：身体管理', hint: '运动/力量/终结', apply: function() {
        getBranchState('mentor').lastMentor = 'lebron';
        setBranchNode('training', 'mentor_first', { lastMentor: 'lebron' });
        addAttrDelta('ATH', 1); addAttrDelta('STR', 1); addAttrDelta('FIN', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '詹姆斯的训练在冲刺、对抗和阅读之间来回切换。最累的时候，他要你做最清醒的决定。<br><br>效果：运动+1，力量+1，终结+1。';
      }},
      { label: '保罗：控场大师', hint: '控球/传球/关键球', apply: function() {
        getBranchState('mentor').lastMentor = 'paul';
        setBranchNode('training', 'mentor_first', { lastMentor: 'paul' });
        addAttrDelta('HAN', 1); addAttrDelta('PAS', 2); addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '保罗不断要求你说出弱侧第二个防守人的站位。你开始明白，控场是让九个人先暴露答案。<br><br>效果：控球+1，传球+2，关键球+1。';
      }},
      { label: '库里：空间与无球', hint: '三分/无球/空间理解', apply: function() {
        getBranchState('mentor').lastMentor = 'curry';
        setBranchNode('training', 'mentor_first', { lastMentor: 'curry' });
        addAttrDelta('threePT', 2); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '库里没有让你一直投。他先带着你跑无球：什么时候加速、什么时候停、什么时候让防守人以为你放弃了。他说：三分是结果，跑动才是原因。<br><br>效果：三分+2，传球+1。';
      }},
      { label: '伦纳德：防守与重心', hint: '防守/力量/稳定', apply: function() {
        getBranchState('mentor').lastMentor = 'kawhi';
        setBranchNode('training', 'mentor_first', { lastMentor: 'kawhi' });
        addAttrDelta('PDEF', 2); addAttrDelta('STR', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '伦纳德一整个下午只让你练两件事：横移和压重心。他说：大多数人输给的不是对手，是自己的重心。<br><br>效果：外防+2，力量+1。';
      }}
    ]
  },
  {
    id: 'skill_first_lesson',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 11,
    title: '夏日训练：专项第一课',
    scenes: ['你把夏天的日历清空，只留下一项技术。训练师说：这是最无聊也最可怕的夏天。'],
    body: '选择一个专项方向，一个夏天只做一件事。',
    requires: function() { return getBranchNode('training') === 'skill_line'; },
    choices: [
      { label: '投射专项', hint: '三分/中投', apply: function() {
        getBranchState('skill_training').lastFocus = 'shooting';
        setBranchNode('training', 'skill_first', { lastFocus: 'shooting' });
        return applyTrainingOutcome('threePT', 'MID', 'shootingPity', ['你把整个夏天拆成无数个投篮点。训练师不再数命中，只记录疲劳后的出手轨迹。'], { primary: '三分', secondary: '中投' });
      }},
      { label: '持球专项', hint: '控球/终结', apply: function() {
        getBranchState('skill_training').lastFocus = 'handle';
        setBranchNode('training', 'skill_first', { lastFocus: 'handle' });
        return applyTrainingOutcome('HAN', 'FIN', 'handlePity', ['训练师在半场摆满障碍物，让你每次突破前都必须先读出协防位置。'], { primary: '控球', secondary: '终结' });
      }},
      { label: '防守专项', hint: '外防/抢断', apply: function() {
        getBranchState('skill_training').lastFocus = 'defense';
        setBranchNode('training', 'skill_first', { lastFocus: 'defense' });
        return applyTrainingOutcome('PDEF', 'STL', 'defensePity', ['你花了一周只练横移和追防。教练不让你赌博式抢断，只要求你夺走对手的舒服空间。'], { primary: '外防', secondary: '抢断' });
      }},
      { label: '身体终结专项', hint: '力量/终结', apply: function() {
        getBranchState('skill_training').lastFocus = 'strength';
        setBranchNode('training', 'skill_first', { lastFocus: 'strength' });
        return applyTrainingOutcome('STR', 'FIN', 'strengthPity', ['力量房和禁区训练被排在同一天。你先把身体练到发沉，再去篮下完成对抗终结。'], { primary: '力量', secondary: '终结' });
      }},
      { label: '组织专项', hint: '传球/关键球', apply: function() {
        getBranchState('skill_training').lastFocus = 'playmaking';
        setBranchNode('training', 'skill_first', { lastFocus: 'playmaking' });
        return applyTrainingOutcome('PAS', 'CLU', 'playmakingPity', ['你和助教把每套战术拆成三层选择：第一选择被锁死，第二选择被延误，第三选择才是真正能赢的球。'], { primary: '传球', secondary: '关键球' });
      }},
      { label: '无球跑动', hint: '空间/中投/耐力', apply: function() {
        getBranchState('skill_training').lastFocus = 'offball';
        setBranchNode('training', 'skill_first', { lastFocus: 'offball' });
        addAttrDelta('MID', 1); addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你整个夏天都在和助教玩“找空位”游戏：不看球，只看防守人的眼睛。训练结束，你开始能提前半拍出现在正确的位置。<br><br>效果：中投+1，耐力+1。';
      }},
      { label: '罚球稳定', hint: '关键时刻的心理锚点', apply: function() {
        getBranchState('skill_training').lastFocus = 'free_throw';
        setBranchNode('training', 'skill_first', { lastFocus: 'free_throw' });
        addAttrDelta('CLU', 1); addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你每天罚 200 球，每一球之前都做同一个呼吸。两个月后，站在罚球线上时，你听见的只剩自己的呼吸。<br><br>效果：关键球+1，耐力+1。';
      }}
    ]
  },
  {
    id: 'body_rebuild_plan',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 9,
    title: '夏日训练：身体重建计划',
    scenes: [
      '身体评估报告摊在桌上：肌肉不平衡、睡眠负债、慢性炎症。队医说，好消息是这些都能修，坏消息是修它们不产生任何高光集锦。'
    ],
    body: '先成为健康的身体，再成为更强的球员。',
    requires: function() { return getBranchNode('training') === 'body_line'; },
    choices: [
      { label: '科学恢复', hint: '康复优先，长期风险下降', apply: function() {
        setBranchNode('training', 'body_plan', { plan: 'recovery' });
        addSeasonMod('injuryRiskBonus', -2, -4, 8);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你把每天的恢复课当成正式训练。训练师说：大多数人不是输在天赋，是输在不肯慢下来。<br><br>效果：伤病风险-2；状态波动-1。';
      }},
      { label: '力量加练', hint: '对抗和爆发提升，负荷较高', apply: function() {
        setBranchNode('training', 'body_plan', { plan: 'strength' });
        addAttrDelta('STR', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('injuryRiskBonus', 1, -4, 8);
        return '力量房成了你的第二个家。老将路过时只说了一句：别急，身体会给你的耐心付利息。<br><br>效果：力量+2；伤病风险+1。';
      }},
      { label: '营养作息', hint: '睡眠和饮食重建，状态更稳', apply: function() {
        setBranchNode('training', 'body_plan', { plan: 'nutrition' });
        addSeasonMod('formVariance', -2, -10, 10);
        addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你戒了夜宵，把手机放在客厅充电。两个月后，队医说你的恢复指标像换了个人。<br><br>效果：状态波动-2；耐力+1。';
      }},
      { label: '家人陪伴康复', hint: '心理放松，家人参与训练生活', apply: function() {
        setBranchNode('training', 'body_plan', { plan: 'family' });
        addProfileDelta('fanSupport', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你每周空出一天让家人来训练馆。孩子在场边拍球，你在场中恢复。那一年，你第一次觉得训练馆也是家的延伸。<br><br>效果：球迷支持+1；状态波动-1。';
      }}
    ]
  },
  {
    id: 'dual_training_plan',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 10,
    title: '夏日训练：双修计划',
    scenes: ['你贪心地两个都要。教练组摇头，但你列了一张精确到小时的表：上午导师，下午专项。'],
    body: '双修不是偷懒，是更高强度的自我要求。',
    requires: function() { return getBranchNode('training') === 'dual_line'; },
    choices: [
      { label: '导师主导 + 专项辅助', hint: '比赛理解优先', apply: function() {
        setBranchNode('training', 'dual_plan', { plan: 'mentor_first' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '上午跟着导师读比赛，下午用专项把理解变成肌肉记忆。导师说：你是我见过最会用身体记笔记的人。<br><br>效果：关键球+1。';
      }},
      { label: '专项主导 + 导师点拨', hint: '技术优先，导师纠正细节', apply: function() {
        setBranchNode('training', 'dual_plan', { plan: 'skill_first' });
        addAttrDelta('MID', 1); addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('formVariance', -1, -10, 10);
        return '下午的专项课决定方向，上午的导师课只负责纠错。一个夏天下来，你的动作没变多，但每个动作都变对了。<br><br>效果：中投+1，耐力+1；状态波动-1。';
      }},
      { label: '轻量双修', hint: '两项都练但都不过载', apply: function() {
        setBranchNode('training', 'dual_plan', { plan: 'light' });
        addAttrDelta('STA', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把强度控制在八成，只求每堂课都完整。训练师说：完整比猛烈更能坚持到九月。<br><br>效果：耐力+1，传球+1；伤病风险-1。';
      }}
    ]
  },
  {
    id: 'joy_basketball_plan',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 7,
    title: '夏日训练：快乐篮球计划',
    scenes: ['你把训练表收起来，先跑去野球场打了一下午。汗水落下来的时候，你突然觉得，自己还能再爱一次。'],
    body: '找回热爱，也是训练的一部分。',
    requires: function() { return getBranchNode('training') === 'joy_line'; },
    choices: [
      { label: '野球局', hint: '即兴对抗，手感与创造力', apply: function() {
        setBranchNode('training', 'joy_plan', { plan: 'pickup' });
        addAttrDelta('HAN', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你混进社区的野球局，没人让着你，也没人采访你。你打出了这个夏天最开心的几个回合。<br><br>效果：控球+1；手感提升。';
      }},
      { label: '教孩子', hint: '把技术讲出来，理解更深', apply: function() {
        setBranchNode('training', 'joy_plan', { plan: 'kids' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addProfileDelta('fanSupport', 1);
        return '你在小球馆教孩子们第一步。有个男孩怎么都学不会，你蹲下来陪他练了四十分钟。他学会那天，笑得比你还大声。<br><br>效果：传球+1；球迷支持+1。';
      }},
      { label: '家庭投篮', hint: '让篮球回到生活里', apply: function() {
        setBranchNode('training', 'joy_plan', { plan: 'family' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '你带着家人每天傍晚投一会儿篮。孩子投进第一个球时，你忽然想起自己小时候爸爸也是这样教的。<br><br>效果：状态波动-1；球迷支持+1。';
      }}
    ]
  },
  {
    id: 'mentor_deepen',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 12,
    title: '夏日训练：导师深化',
    scenes: [
      '第一次训练之后，你以为自己已经懂了。直到导师第二次见面，他把录像停在你最狼狈的那个回合：动作只是门票，理解才是房间。'
    ],
    body: '把学到的东西变成比赛习惯。',
    requires: function() { return getBranchNode('training') === 'mentor_first'; },
    choices: [
      { label: '把技术融入关键战', hint: '关键球提升', apply: function() {
        setBranchNode('training', 'mentor_deep', { lesson: 'clutch_translation' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '训练从动作课变成了最后两分钟模拟。你被迫在疲劳、包夹和噪音里做选择。<br><br>效果：关键球+1。';
      }},
      { label: '反复打磨基础动作', hint: '稳定提升核心技术', apply: function() {
        setBranchNode('training', 'mentor_deep', { lesson: 'foundation' });
        addAttrDelta('MID', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有追求新招，而是把已有动作重复到不需要思考。<br><br>效果：中投+1，传球+1。';
      }},
      { label: '学习如何教会队友', hint: '传球和队友线提升', apply: function() {
        setBranchNode('training', 'mentor_deep', { lesson: 'teaching' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        STATE.career.flags.teachingSkill = true;
        return '导师让你把刚学会的东西讲给年轻球员听。你第一次发现，教一遍比自己练十遍更能暴露理解的漏洞。<br><br>效果：传球+1；flag teachingSkill = true。';
      }},
      { label: '身体管理', hint: '伤病风险下降，晚年技术维持', apply: function() {
        setBranchNode('training', 'mentor_deep', { lesson: 'body' });
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        STATE.career.flags.bodyManagement = true;
        return '导师把恢复课排进你的每一天。他说：天赋让你进联盟，习惯才决定你能待多久。<br><br>效果：伤病风险-1；晚年技术维持倾向。';
      }}
    ]
  },
  {
    id: 'skill_deepen',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 12,
    title: '夏日训练：专项深化',
    scenes: ['第二个专项夏天，进步不再像第一次那么明显。训练师说：现在不是练更多，而是决定你到底是谁。'],
    body: '深挖、补短板、强化体能，还是拉到实战里检验？',
    requires: function() { return getBranchNode('training') === 'skill_first'; },
    choices: [
      { label: '继续深挖上次专项', hint: '更高突破概率，但过度训练风险存在', apply: function() {
        var b = getBranchState('skill_training');
        var focus = b.lastFocus || 'shooting';
        setBranchNode('training', 'skill_deep', { identityPath: focus });
        if (focus === 'handle') return applyTrainingOutcome('HAN', 'FIN', 'handlePity', ['你决定不换方向，把上个夏天没吃透的动作继续磨下去。'], { primary: '控球', secondary: '终结' });
        if (focus === 'defense') return applyTrainingOutcome('PDEF', 'STL', 'defensePity', ['你继续把自己锁在防守训练里，一次次重来脚步角度。'], { primary: '外防', secondary: '抢断' });
        if (focus === 'strength') return applyTrainingOutcome('STR', 'FIN', 'strengthPity', ['你继续泡在力量房里，把对抗终结当成每天最后一课。'], { primary: '力量', secondary: '终结' });
        if (focus === 'playmaking') return applyTrainingOutcome('PAS', 'CLU', 'playmakingPity', ['你把战术选择继续拆细，逼自己在第三选择里找到赢球答案。'], { primary: '传球', secondary: '关键球' });
        return applyTrainingOutcome('threePT', 'MID', 'shootingPity', ['你继续投，投到训练师不再看命中率，只看你的动作是否完全一样。'], { primary: '三分', secondary: '中投' });
      }},
      { label: '补强短板', hint: '低风险均衡成长', apply: function() {
        setBranchNode('training', 'skill_deep', { identityPath: 'balanced' });
        addAttrDelta('STA', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有继续追逐一个夸张突破，而是把夏天拆给体能、传球和基础动作。<br><br>效果：耐力+1，传球+1。';
      }},
      { label: '强化体能', hint: '耐力与恢复优先', apply: function() {
        setBranchNode('training', 'skill_deep', { identityPath: 'stamina' });
        addAttrDelta('STA', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把夏天后半段交给体能师。训练师说：技术决定你有多高，体能决定你能站多高多久。<br><br>效果：耐力+2；伤病风险-1。';
      }},
      { label: '实战检验', hint: '用比赛验证训练', apply: function() {
        setBranchNode('training', 'skill_deep', { identityPath: 'live' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你约了几场高强度对抗赛，把自己扔进真实的攻防里。有一场被防得很惨，但那晚你反而睡得最踏实。<br><br>效果：关键球+1；状态波动+1。';
      }}
    ]
  },
  {
    id: 'training_identity',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 10,
    title: '夏日训练：训练收束',
    scenes: [
      '九月的第一场队内训练，助教把你的新数据放到大屏幕上。它已经不只是属性，而是你的打法画像。',
      '你想起这个夏天的每一个清晨、每一滴汗、每一次想放弃又继续的瞬间。'
    ],
    body: '选择你希望被记住的样子。',
    requires: function() {
      var node = getBranchNode('training');
      return node === 'mentor_deep' || node === 'skill_deep' || node === 'body_plan' || node === 'dual_plan' || node === 'joy_plan';
    },
    choices: [
      { label: '关键战解决者', hint: '关键球提升', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'closer' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你开始有了自己的招牌回合。对手知道你要做什么，但仍然很难阻止。<br><br>效果：关键球+1；获得“关键战解决者”标签。';
      }},
      { label: '技术型领袖', hint: '传球提升', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'technical_leader' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '年轻队友开始围着你问问题。你说得越多，理解得越深。<br><br>效果：传球+1；获得“技术型领袖”标签。';
      }},
      { label: '身体管理样本', hint: '伤病风险下降', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'body_standard' });
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你的恢复课成了队内模板。没有漂亮镜头，但每个人都想复制你的长赛季。<br><br>效果：伤病风险-1；获得“身体管理样本”标签。';
      }},
      { label: '招牌技术', hint: '专项主属性提升', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'signature_skill' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你终于有了对手赛前报告里必须加粗的一项技术。<br><br>效果：关键球+1；获得“招牌技术”标签。';
      }},
      { label: '全面打法', hint: '稳定性提升', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('training', 'training_identity', { identity: 'balanced_player' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        return '你没有一项极端夸张的武器，但每个夜晚都更难被针对。<br><br>效果：状态波动-1；获得“全面打法”标签。';
      }},
      { label: '双修全能', hint: '比赛理解和专项技术并存', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'dual_versatile' });
        addAttrDelta('CLU', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '有人说你不够纯粹，但你心里清楚：你已经不是只会一种方式打球的球员。<br><br>效果：关键球+1，传球+1；获得“双修全能”标签。';
      }}
    ]
  },
  {
    id: 'team_practice_start',
    branch: 'team_practice', phase: 'offseason', slot: 'main', weight: 9,
    title: '球队线：提前合练',
    scenes: ['休赛期刚过一半，你在群里发了一条消息：想提前合练的，后天早上训练馆见。你知道这能让球队更快进入状态。'],
    body: '你要组织球队合练，还是把夏天留给个人恢复？',
    requires: function() { return getBranchNode('team_practice') === 'start'; },
    choices: [
      { label: '组织球队合练', hint: '默契提升，开启领袖线', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_start', { status: 'organized' }); mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 2); mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs); return '你把队友一个个叫回训练馆。没人说这是领袖投票，但所有人都在用行动投票。<br><br>效果：传球+1；球队默契提升；球队线进入回应阶段。'; }},
      { label: '个人恢复优先', hint: '降低伤病风险', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_start', { status: 'recovery' }); mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1); return '你选择把身体修好。教练理解这个决定，但队友们也会记住这个夏天你没有出现。<br><br>效果：下赛季伤病风险略降；球队线进入回应阶段。'; }}
    ]
  },
  {
    id: 'team_practice_response',
    branch: 'team_practice', phase: 'offseason', slot: 'main', weight: 10,
    title: '球队线：队内回应',
    scenes: ['第二年夏天，合练邀请变得微妙。年轻球员期待你开口，核心队友也在观察你的态度。'],
    body: '你要把自己推向更衣室领袖的位置吗？',
    requires: function() { return getBranchNode('team_practice') === 'practice_start'; },
    choices: [
      { label: '主动承担领袖责任', hint: '球队默契和传球提升', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_response', { leadership: 'vocal' }); mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 2); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs); return '你不再只是参加合练的人，而是安排训练内容、提醒年轻队友站位的人。<br><br>效果：传球+1；球队默契提升；球队线进入队魂阶段。'; }},
      { label: '保持低调，只做好自己', hint: '降低波动，不争队内话语权', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_response', { leadership: 'quiet' }); mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1); return '你没有演讲，也没有喊口号，只是每天第一个到训练馆。久而久之，这也成了一种声音。<br><br>效果：下赛季状态波动略降；球队线进入队魂阶段。'; }},
      { label: '把舞台让给年轻队友', hint: '年轻球员成长，个人声望温和', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_mentor', { leadership: 'mentor' }); mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1); STATE.career.flags.youthDevelopment = true; return '你把训练安排和回合组织交给年轻人，只在关键节点帮他们纠错。他们开始敢在你面前大声说话。<br><br>重点：你选择让位。<br><br>影响：球队默契略升；年轻球员成长。'; }}
    ]
  },
  {
    id: 'team_practice_identity',
    branch: 'team_practice', phase: 'offseason', slot: 'main', weight: 8,
    title: '球队线：队魂雏形',
    scenes: ['这一次，合练不再需要你发消息。年轻球员已经提前到了。教练看着你，像是在看这支球队的秩序。'],
    body: '球队线收束。你要留下怎样的队内标签？',
    requires: function() { return getBranchNode('team_practice') === 'practice_response' || getBranchNode('team_practice') === 'practice_mentor'; },
    choices: [
      { label: '成为更衣室领袖', hint: '退役球衣队史分倾向提升', apply: function() { setBranchNode('team_practice', 'practice_identity', { identity: 'locker_room_leader' }); STATE.career.flags.lockerRoomLeader = true; return '你说话不一定最多，但关键时刻所有人都会看你。<br><br>结果：获得“更衣室领袖”长期标签。'; }},
      { label: '成为训练馆标杆', hint: '身体管理更稳定', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_identity', { identity: 'gym_standard' }); mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1); return '你的训练方式成了队内年轻人的模板。没有海报，没有口号，只有每天重复。<br><br>结果：获得“训练馆标杆”长期标签；下赛季伤病风险略降。'; }},
      { label: '成为年轻球员导师', hint: '传球和年轻球员成长提升', apply: function() { setBranchNode('team_practice', 'practice_identity', { identity: 'team_mentor' }); STATE.career.flags.youthMentor = true; addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs); return '你开始把每个夏天的录像课交给年轻人讲，自己只补最后一层。他们讲得越来越像你。<br><br>效果：传球+1；获得“年轻球员导师”标签。'; }}
    ]
  },
  {
    id: 'family_table_talk',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '家庭：餐桌上的问题',
    scenes: [
      '赛季结束后，你没有第一时间去训练馆。你主动把那个一直回避的问题摆上桌。',
      '她说：我不是要你少爱篮球，我只是想知道，我们在你的人生里有没有位置。'
    ],
    body: '这不是逼你做选择，而是让你承认篮球之外也有人在等你。',
    requires: function() {
      var c = STATE.career || {};
      var partner = (c.relationships && c.relationships.partner) || {};
      var since = partner.sinceSeason == null ? 0 : (c.seasonCount || 0) - partner.sinceSeason;
      return getBranchNode('family') === 'start' && getBranchNode('relationship') === 'partnership' && ((c.currentAge || 22) >= 28 || since >= 2);
    },
    choices: [
      { label: '把家庭放进计划里', hint: '生活更稳定，但训练安排会更谨慎', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_plan', { status: 'committed' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('fanSupport', 1);
        return '你没有说漂亮话，只是把下个月的训练表打开，认真空出几天。她看着你改行程，终于笑了一下。<br><br>重点：你开始把亲密关系当成职业生涯的一部分，而不是赛季之外的附属品。<br><br>影响：下赛季状态更稳定；生活压力下降。';
      }},
      { label: '先完成争冠窗口', hint: '短期更专注，关系压力上升', apply: function() {
        setBranchNode('family', 'career_priority', { status: 'delayed' });
        addSeasonMod('moraleBonus', 1, -10, 10);
        addProfileDelta('controversy', 1);
        return '你沉默了很久，说自己还需要一到两年。她没有吵，只是点点头。那种安静比争吵更重。<br><br>重点：你把冠军窗口放在前面，但这段关系开始承受时间的磨损。<br><br>影响：短期斗志上升；未来家庭事件可能带来更大压力。';
      }},
      { label: '暂时回避承诺', hint: '暂缓决定，但关系开始磨损', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'avoid_commitment', { status: 'avoided' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('controversy', 1);
        return '你说赛季太忙，等稳定下来再谈。她没再追问，但那个晚上之后，你们的对话少了一点东西。<br><br>重点：你争取了时间，也让关系开始磨损。<br><br>影响：下赛季状态波动略降；争议上升。';
      }}
    ]
  },
  {
    id: 'family_daily_life',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '家庭：把家过成日常',
    scenes: [
      '她开始出现在你生活的固定角落：晨练前的一杯咖啡，客场回来门口的一盏灯。',
      '你发现，承诺不需要每天说，但它需要每天都有人在场。'
    ],
    body: '家庭优先不是放弃篮球，而是让生活有地方落脚。',
    requires: function() { return getBranchNode('family') === 'family_plan'; },
    choices: [
      { label: '把家庭排进赛季日历', hint: '给家人固定时间，状态更稳', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_settled', { status: 'settled' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        addProfileDelta('fanSupport', 1);
        return '你在手机日历里给家庭日上了锁，连训练师都不许改。她说你终于学会不是把所有时间都交给球队。<br><br>重点：家庭进入长期稳定。<br><br>影响：下赛季状态波动明显下降；伤病风险略降；球迷支持+1。';
      }},
      { label: '带家人一起面对客场', hint: '让家人进入你真实的生活', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_settled', { status: 'settled' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addSeasonMod('moraleBonus', 1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '孩子第一次跟你坐球队包机，全程盯着窗外。你忽然明白，你不在家的每一晚，她们都在用另一种方式等你。<br><br>重点：家庭进入长期稳定。<br><br>影响：下赛季状态波动略降；士气+1；球迷支持+1。';
      }}
    ]
  },
  {
    id: 'family_balance',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '家庭：家庭与冠军之间',
    scenes: [
      '争冠窗口没有因为家庭停下来，但它开始变得更具体：总决赛赛程、孩子的生日、她独自撑过的那些客场。',
      '你终于要回答那个被推迟很久的问题。'
    ],
    body: '冠军和家庭不是二选一，但你需要先让家里的人相信这一点。',
    requires: function() { return getBranchNode('family') === 'career_priority'; },
    choices: [
      { label: '给家庭一个明确时限', hint: '用具体承诺修复信任', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_settled', { status: 'settled' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        addProfileDelta('controversy', -1);
        addProfileDelta('mediaTrust', 1);
        return '你告诉她：给我这两年，之后时间都是你们的。她认真看着你，最后点头：好，我信你一次。<br><br>重点：家庭转稳，信任被补回来。<br><br>影响：下赛季状态波动明显下降；争议下降；媒体好感+1。';
      }},
      { label: '让家人进入决策', hint: '把选择权和家人分享', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_settled', { status: 'settled' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        addProfileDelta('fanSupport', 1);
        return '你把交易流言和赛程摊在桌上，和她一起决定夏天怎么过。她第一次觉得，自己不是被你人生排除在外的人。<br><br>重点：家庭转稳，关系更真实。<br><br>影响：下赛季状态波动略降；球队默契+1；球迷支持+1。';
      }},
      { label: '把承诺继续推后', hint: '短期专注，但家庭裂痕加深', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_pressure', { status: 'pressure' });
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 1);
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 1);
        addProfileDelta('controversy', 1);
        return '你只说“再等等”。这句话你用过太多次，她这次没有点头，只是把门轻轻带上了。<br><br>重点：家庭进入压力状态。<br><br>影响：下赛季状态波动略升；伤病风险略升；争议上升。';
      }}
    ]
  },
  {
    id: 'family_avoidance_cost',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '家庭：回避的代价',
    scenes: [
      '你回避的那个问题没有消失，它只是换了更安静的方式出现：更少的电话、更长的沉默、更客气的“没事”。',
      '你主动约她坐下来，这一次没有人愿意再假装没事。'
    ],
    body: '回避的代价，是让两个人都在等待中磨损。',
    requires: function() { return getBranchNode('family') === 'avoid_commitment'; },
    choices: [
      { label: '认真补上承诺', hint: '修复关系，但裂缝仍然存在', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_pressure', { status: 'repaired_pressure' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('controversy', -1);
        return '你推掉一个商业活动，专门空出周末。她听完你的计划，眼睛有点红：你知道我等这句话等了多久吗。<br><br>重点：关系开始修复，但裂缝还在。<br><br>影响：下赛季状态波动略降；争议下降。';
      }},
      { label: '把话说开，体面放下', hint: '结束关系，留下遗憾', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_regret', { status: 'regret' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('controversy', 1);
        return '你们没有争吵，只是承认彼此需要的东西不一样。那顿饭吃完，谁都没有再联系谁。<br><br>重点：家庭故事以遗憾收场。<br><br>影响：下赛季状态波动略降；争议上升。';
      }},
      { label: '继续回避', hint: '不面对，让关系慢慢熄灭', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_regret', { status: 'regret' });
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 2);
        addProfileDelta('controversy', 2);
        addProfileDelta('fanSupport', -1);
        return '她不再问，也不再等你。你训练完打开手机，消息停留在三天前。<br><br>重点：回避让家庭故事慢慢熄灭。<br><br>影响：下赛季状态波动上升；争议上升；球迷支持下降。';
      }}
    ]
  },
  {
    id: 'family_late_career',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '家庭：客场的深夜',
    scenes: [
      '你已经不再年轻。某个客场深夜，你看着手机里孩子发来的一段视频，突然发现自己错过了太多第一次。',
      '教练组说还能打，身体也说还能扛，但你知道，有些时间一旦错过就不会再有。'
    ],
    body: '晚年收束。家庭会改变你愿意留在球场多久。',
    requires: function() {
      var node = getBranchNode('family');
      return node === 'family_settled' || node === 'family_pressure' || node === 'family_regret';
    },
    choices: [
      { label: '继续战斗', hint: '保持角色，把家庭放进未来计划', apply: function() {
        STATE.career.flags.familyRetireTendency = 'play';
        addSeasonMod('moraleBonus', 1, -10, 10);
        return '你给家里打了电话，说再给我一年。电话那头沉默了几秒，然后说：好，但这是最后一年了。<br><br>重点：你选择继续战斗，但时间开始有边界。<br><br>影响：短期斗志上升。';
      }},
      { label: '降低角色，多陪家人', hint: '调整角色，家庭优先', apply: function() {
        var mods = getNextSeasonMods();
        STATE.career.flags.familyRetireTendency = 'family';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('fanSupport', 1);
        return '你主动和教练谈角色调整，把上场时间让给年轻人。孩子的视频，你终于能第一时间点开。<br><br>重点：你选择把时间留给家人。<br><br>影响：下赛季状态波动略降；球迷支持+1。';
      }},
      { label: '把退役提上日程', hint: '主动结束球员生涯', apply: function() {
        STATE.career.flags.familyRetireTendency = 'retire';
        addProfileDelta('legacyBonus', 1);
        return '你在更衣室待到所有人都走光，最后把护具放进包里。不是打不动了，是有些地方更需要你。<br><br>重点：你主动决定生涯的终点。<br><br>影响：历史评价略升。';
      }}
    ]
  },
  {
    id: 'china_market_homecoming',
    branch: 'china_market', phase: 'offseason', slot: 'main', weight: 10,
    title: '中国市场：中国行',
    scenes: [
      '机场出口的人群比你想象中更夸张。有人举着你国家队的照片，也有人穿着你 NBA 球队的球衣。',
      '你忽然意识到，这两种身份在这里重叠了。'
    ],
    body: '这趟中国行会消耗你的休赛期，但也会让你的影响力真正落到球迷面前。',
    requires: function() {
      var chinaNode = getBranchNode('china_team');
      return getBranchNode('china_market') === 'start'
        && (['national_core','team_core','managed_core','national_flag','team_revival','injured_hero','national_legend','national_mentor','honorable_exit'].indexOf(chinaNode) >= 0
            || hasCareerHonor('全明星') || hasCareerHonor('MVP'));
    },
    choices: [
      { label: '完整参加中国行', hint: '中国人气上升，但身体负担增加', apply: function() {
        setBranchNode('china_market', 'market_tour', { status: 'tour' });
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('businessValue', 1);
        addSeasonMod('injuryRiskBonus', 1, -4, 8);
        return '你跑了三座城市，签名签到手腕发酸。最后一站，有个孩子举着手写海报说，他也想进国家队。<br><br>重点：你不再只是海外联赛里的中国球员，而是很多年轻球迷的现实坐标。<br><br>影响：中国人气上升；商业价值上升；下赛季身体负担略增。';
      }},
      { label: '缩短行程保护身体', hint: '保留精力，但热度少一点', apply: function() {
        setBranchNode('china_market', 'market_light', { status: 'light' });
        addProfileDelta('chinaPopularity', 1);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你砍掉了两个商业站台，只留下球迷见面会和一次公开训练。机场的人没变少，但你的训练表终于没被活动塞满。<br><br>重点：你保住了身体，也让热度保持在场。<br><br>影响：中国人气略升；下赛季伤病风险略降；状态波动略降。';
      }},
      { label: '把时间留给青训活动', hint: '商业少一点，但中国篮球评价更高', apply: function() {
        setBranchNode('china_market', 'market_grassroots', { status: 'grassroots' });
        addProfileDelta('chinaPopularity', 2);
        addProfileDelta('legacyBonus', 1);
        return '你取消了两个商业站台，把时间留给一座小球馆。孩子们的动作很生涩，但每个人都在认真听你讲第一步。<br><br>重点：这不是流量最高的选择，却让你和中国篮球的关系变得更深。<br><br>影响：中国篮球评价上升；退役后的国家队/青训相关结局更容易出现。';
      }}
    ]
  },
  {
    id: 'china_market_brand_offer',
    branch: 'china_market', phase: 'offseason', slot: 'main', weight: 12,
    title: '中国市场：国产品牌接触',
    scenes: [
      '品牌方没有先谈钱。他们拿出一张设计图，上面写着你的中文名字。',
      '负责人说：我们想做一双中国孩子会记住的鞋。'
    ],
    body: '球鞋线在这里分叉：国产品牌、国际大牌，还是自己的品牌。',
    requires: function() {
      var node = getBranchNode('china_market');
      return node === 'market_tour' || node === 'market_light' || node === 'market_grassroots';
    },
    choices: [
      { label: '签国产品牌', hint: '国内支持强，品牌故事更稳', apply: function() {
        setBranchNode('china_market', 'domestic_brand', { status: 'domestic' });
        addProfileDelta('chinaPopularity', 2);
        addProfileDelta('businessValue', 2);
        addProfileDelta('mediaTrust', 1);
        return '你看着设计图上自己的中文名字，想起小时候隔着橱窗看球鞋的自己。你签下了名字，也签下了一个承诺。<br><br>重点：你和中国品牌绑定在一起。<br><br>影响：中国人气上升；商业价值上升；媒体好感上升。';
      }},
      { label: '等待国际大牌', hint: '商业收益更高，但舆论压力更大', apply: function() {
        addProfileDelta('businessValue', 3);
        addProfileDelta('chinaPopularity', 1);
        addSeasonMod('mediaPressure', 1, -10, 10);
        setBranchNode('china_market', 'global_brand', { status: 'global' });
        return '国际品牌的条件确实更好，但谈判拖了很久。网上开始有人问：你是不是看不上中国品牌？<br><br>重点：你选择了更大的盘子，也接住了更大的议论。<br><br>影响：商业价值大幅上升；中国人气略升；媒体压力上升。';
      }},
      { label: '尝试个人品牌', hint: '自由度和品牌烙印最高，风险也高', apply: function() {
        addProfileDelta('businessValue', 1);
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        setBranchNode('china_market', 'own_brand', { status: 'own' });
        return '你决定自己组团队、自己投钱、自己选颜色。所有人都说这条路更难，但你想要一双真正属于你的鞋。<br><br>重点：你把自己的名字押上去。<br><br>影响：商业价值略升；人气上升；争议上升。';
      }}
    ]
  },
  {
    id: 'china_market_shoe_deal',
    branch: 'china_market', phase: 'offseason', slot: 'main', weight: 12,
    title: '中国市场：球鞋落地',
    scenes: [
      '设计师把第一版鞋样推到你面前。你伸手摸了摸鞋面，忽然想起小时候站在商店橱窗外看球鞋的自己。',
      '球鞋会在中国发售，也会跟你的名字一起被反复提起。'
    ],
    body: '签名鞋的风格会决定它被记住的方式。',
    requires: function() {
      var node = getBranchNode('china_market');
      return node === 'domestic_brand' || node === 'global_brand' || node === 'own_brand';
    },
    choices: [
      { label: '强调性能', hint: '球场口碑优先', apply: function() {
        setBranchNode('china_market', 'shoe_settled', { status: 'settled' });
        STATE.career.flags.chinaShoeBrand = true;
        addProfileDelta('businessValue', 2);
        return '你把鞋底、防侧翻和缓震全部调成比赛标准。首发配色普通，但穿上的人都说：这是一双真正能打球的鞋。<br><br>重点：这双鞋开始替你说话。<br><br>影响：商业价值上升；球鞋口碑提升。';
      }},
      { label: '强调故事', hint: '用生涯叙事打动球迷', apply: function() {
        setBranchNode('china_market', 'shoe_settled', { status: 'settled' });
        STATE.career.flags.chinaShoeBrand = true;
        addProfileDelta('fanSupport', 2);
        addProfileDelta('legacyBonus', 1);
        return '鞋面上印着你的城市、号码和一路走来的年份。很多球迷说，这双鞋里装着一个完整的人生。<br><br>重点：这双鞋装着你的人生。<br><br>影响：球迷支持上升；历史评价上升。';
      }},
      { label: '强调中国元素', hint: '和中国篮球绑定更深', apply: function() {
        setBranchNode('china_market', 'shoe_settled', { status: 'settled' });
        STATE.career.flags.chinaShoeBrand = true;
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('legacyBonus', 1);
        return '鞋舌内侧绣着国旗的轮廓，后跟是汉字签名。发售那天，中国球迷把它当成一种身份的证明。<br><br>重点：这双鞋和你的身份连在一起。<br><br>影响：中国人气大幅上升；历史评价上升。';
      }},
      { label: '追求高利润', hint: '商业最大化，但口碑有风险', apply: function() {
        setBranchNode('china_market', 'shoe_settled', { status: 'settled' });
        STATE.career.flags.chinaShoeBrand = true;
        addProfileDelta('businessValue', 3);
        addProfileDelta('controversy', 1);
        return '你选了最轻便也最便宜的材料组合，定价却很高。销量不错，但球场上开始有人抱怨鞋底寿命。<br><br>重点：这双鞋带来了销量，也带来了争议。<br><br>影响：商业价值大幅上升；争议上升。';
      }}
    ]
  },
  {
    id: 'media_first_press',
    branch: 'media', phase: 'season', slot: 'main', weight: 12,
    stateContext: 'loss_press',
    title: '媒体：输球发布会',
    scenes: [
      '更衣室的门还没关，记者已经围上来。你刚打出一场想删掉的比赛，输球原因却在镜头前被拆成一百个问题。',
      '记者问你：今晚最后几个回合，你是不是太想自己解决了？'
    ],
    body: '同样的失利，不同的表达会留下不同的人设。',
    requires: function() {
      var c = STATE.career || {};
      var played = (c.totalStats && c.totalStats.games > 0) || (STATE.season && STATE.season.playerStats && STATE.season.playerStats.games > 0);
      var honored = hasCareerHonor('全明星') || hasCareerHonor('MVP') || hasCareerHonor('总冠军');
      return getBranchNode('media') === 'start' && (played || honored);
    },
    choices: [
      { label: '承担责任', hint: '媒体好感与队友关系提升', apply: function() {
        setBranchNode('media', 'press_accountable', { tone: 'accountable' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('lockerRoomTrust', 1);
        return '你没有甩锅，把最后几个回合的责任全部接过来。队友没有说话，但更衣室安静了几秒——那是信任开始生长的声音。<br><br>效果：媒体好感+2；更衣室信任+1。';
      }},
      { label: '强调团队问题', hint: '保护自己，但会显得回避', apply: function() {
        setBranchNode('media', 'press_team', { tone: 'team' });
        addProfileDelta('mediaTrust', 1);
        return '你说篮球是五个人的比赛，输球不该由一个人背锅。话没错，但镜头切走时，你知道媒体想要的不是答案，是标题。<br><br>效果：媒体好感+1；队友线轻微受益。';
      }},
      { label: '拒绝评价', hint: '降低热度，专注比赛', apply: function() {
        setBranchNode('media', 'press_silent', { tone: 'silent' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fame', -1);
        return '你只说了一句“下一场见”，然后起身离开。没有漂亮话，但训练师说你那晚投篮特别安静。<br><br>效果：状态波动-1；人气-1。';
      }},
      { label: '反问记者', hint: '热度上升，争议上升', apply: function() {
        setBranchNode('media', 'press_confront', { tone: 'confront', confront: true });
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你反问：如果是你最后三分钟五次失误，你会怎么总结？采访间安静了一秒，然后所有人都知道明天头条有了。<br><br>效果：人气+1；争议+1；接下来的头条，都会围着你转。';
      }}
    ]
  },
  {
    id: 'media_social_storm',
    branch: 'media', phase: 'season', slot: 'main', weight: 12,
    title: '媒体：社交媒体风波',
    scenes: [
      '你深夜发了一条社交媒体动态。醒来时，它已经被截图转发，不再是情绪话，而是所有节目讨论的标题。'
    ],
    body: '你无法控制别人怎么截图，但你可以控制自己怎么回应。',
    requires: function() {
      var node = getBranchNode('media');
      if (node === 'press_accountable' || node === 'press_team' || node === 'press_silent' || node === 'press_confront') return true;
      var rl = getBranchNode('relationship');
      var cm = getBranchNode('china_market');
      var nw = getBranchNode('network');
      var contra = (STATE.career.profile && STATE.career.profile.controversy) || 0;
      return rl === 'public' || rl === 'crisis' || cm === 'shoe_settled' || nw === 'business_circle' || contra >= 2;
    },
    choices: [
      { label: '道歉', hint: '短期口碑受损，长期形象挽回', apply: function() {
        setBranchNode('media', 'crisis_apology', { response: 'apology' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你发了一条没有删改的道歉，承认那句话不该发。评论区一半在骂，一半在说：至少他敢认。<br><br>效果：媒体好感+1；争议-1；商业热度短期下降。';
      }},
      { label: '解释', hint: '保持中立，不温不火', apply: function() {
        setBranchNode('media', 'crisis_explain', { response: 'explain' });
        return '你解释了语境，没有认错也没有反击。热度慢慢退去，但总有人觉得你在找借口。<br><br>效果：媒体好感0；争议0。';
      }},
      { label: '删除并沉默', hint: '让热度自然消退，但留下猜测', apply: function() {
        setBranchNode('media', 'crisis_delete', { response: 'delete' });
        addProfileDelta('mediaTrust', -1);
        addProfileDelta('controversy', 1);
        return '你删了动态，没有发任何解释。几天后热度被别的事盖过，但评论区永远有人提“他删了”。<br><br>效果：媒体好感-1；争议+1。';
      }},
      { label: '强硬回应', hint: '热度暴涨，人设更硬', apply: function() {
        setBranchNode('media', 'crisis_strong', { response: 'strong' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 2);
        return '你发了一条更长的回应，直接点名所有断章取义的人。转发量爆炸，支持者和批评者都更兴奋了。<br><br>效果：人气+2；争议+2。';
      }}
    ]
  },
  {
    id: 'media_persona',
    branch: 'media', phase: 'season', slot: 'main', weight: 10,
    title: '媒体：人设成型',
    scenes: [
      '几个月过去，媒体不再纠结那一条动态。他们开始用一句话概括你：你是哪种球员，也是哪种人。',
      '你发现，人设不是别人给你的，是每一次发言自己攒出来的。'
    ],
    body: '选择你希望被记住的媒体形象。每一种形象，都需要你先把对应的故事走完。',
    requires: function() {
      var node = getBranchNode('media');
      return node === 'crisis_apology' || node === 'crisis_explain' || node === 'crisis_delete' || node === 'crisis_strong';
    },
    choices: [
      { label: '谦逊团队型', hint: '媒体好感与队友信任提升', lockHint: '需要更衣室和队友已经真正认你', requires: function() {
        var tp = getBranchNode('team_practice');
        var tb = getBranchNode('teammate_bond');
        return tp === 'practice_identity' || (tb && tb !== 'start');
      }, bonus: function() {
        addProfileDelta('lockerRoomTrust', 1);
        return { text: '球队线/队友线已经成型，更衣室更认你这套说法。' };
      }, apply: function() {
        setBranchNode('media', 'persona_humble', { persona: 'humble' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('lockerRoomTrust', 1);
        return '你每次采访都先提队友。记者开始觉得你“无趣”，但更衣室里的人知道，你是把话留给他们的人。<br><br>效果：媒体好感+2；更衣室信任+1。';
      }},
      { label: '狂人巨星型', hint: '人气和争议上升', lockHint: '需要你已经在关键时刻留下名字', requires: function() {
        var t = getBranchState('training');
        return getBranchNode('training') === 'training_identity' && t.identity === 'closer';
      }, bonus: function() {
        addProfileDelta('fame', 1);
        return { text: '关键战解决者的名号让狂言更有底气。' };
      }, apply: function() {
        setBranchNode('media', 'persona_arrogant', { persona: 'arrogant' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 1);
        return '你说：我就是最好的，不接受讨论。喜欢你的人更狂热，讨厌你的人更有动力。<br><br>效果：人气+2；争议+1。';
      }},
      { label: '沉默杀手型', hint: '稳定性提升，媒体关注下降', lockHint: '需要你已经在训练中打磨出全面打法', requires: function() {
        var t = getBranchState('training');
        return getBranchNode('training') === 'training_identity' && t.identity === 'balanced_player';
      }, bonus: function() {
        addSeasonMod('formVariance', -1, -10, 10);
        return { text: '全面打法让沉默更有说服力，状态更稳。' };
      }, apply: function() {
        setBranchNode('media', 'persona_silent', { persona: 'silent' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你几乎不开口，只用表现说话。记者抱怨采访不到你，但你的比赛集锦越传越广。<br><br>效果：状态波动-1。';
      }},
      { label: '商业偶像型', hint: '商业价值上升，媒体压力上升', lockHint: '需要人脉或中国市场结果', requires: function() {
        return getBranchNode('network') === 'business_circle' || getBranchNode('china_market') === 'shoe_settled';
      }, bonus: function() {
        addProfileDelta('businessValue', 1);
        return { text: '商业圈层/球鞋线已经铺好，偶像人设直接变现。' };
      }, apply: function() {
        setBranchNode('media', 'persona_business', { persona: 'business' });
        addProfileDelta('businessValue', 3);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '你开始出现在广告牌、综艺和商业活动里。镜头喜欢你，但每个镜头后面都有一份合同在提醒你微笑。<br><br>效果：商业价值+3；媒体压力+1。';
      }},
      { label: '国家队英雄型', hint: '中国球迷支持与历史评价上升', lockHint: '需要你在国家队扛过核心位置', requires: function() {
        var cn = getBranchNode('china_team');
        return ['national_core','team_core','managed_core','national_flag','team_revival','injured_hero','national_legend','national_mentor','honorable_exit'].indexOf(cn) >= 0;
      }, bonus: function() {
        addProfileDelta('chinaPopularity', 1);
        addProfileDelta('legacyBonus', 1);
        return { text: '国家队核心身份加持，中国球迷更认这套人设。' };
      }, apply: function() {
        setBranchNode('media', 'persona_national', { persona: 'national' });
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('legacyBonus', 1);
        return '你把国家队和国家荣誉放进每一次发言。中国球迷把你当成自己人，媒体也开始用“中国篮球的骄傲”称呼你。<br><br>效果：中国人气+3；历史评价+1。';
      }},
      { label: '争议天才型', hint: '人气与争议双高', lockHint: '需要高争议值或情感伤害结果', requires: function() {
        var contra = (STATE.career.profile && STATE.career.profile.controversy) || 0;
        var rl = getBranchNode('relationship');
        return contra >= 3 || rl === 'hurt_scar' || rl === 'hurt_guard' || rl === 'hurt_moved_on' || !!getBranchState('media').confront;
      }, bonus: function() {
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return { text: '此前的争议与交锋给“天才”人设添了火。' };
      }, apply: function() {
        setBranchNode('media', 'persona_controversial', { persona: 'controversial' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 3);
        addProfileDelta('legacyBonus', 1);
        return '你承认自己不好惹，也不打算讨好任何人。媒体恨你，但离不开你；球迷也一样。<br><br>效果：人气+2；争议+3；历史评价+1。';
      }},
      { label: '自由发声', hint: '不固定人设，按本心说话', apply: function() {
        setBranchNode('media', 'persona_independent', { persona: 'independent' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有固定人设，每句话都按当时的心情来。媒体觉得你难以预测，但球迷喜欢这种真实。<br><br>效果：媒体好感+1；状态波动-1。';
      }}
    ]
  },
  {
    id: 'fan_culture_heat',
    branch: 'fan_culture', phase: 'season', slot: 'main', weight: 11,
    title: '球迷文化：虎扑的第一张热度帖',
    scenes: [
      '比赛结束两小时，虎扑湿乎乎已经开楼。你的名字挂在标题里，点灭数和点亮数同时疯涨。',
      '有人说你是“JR”，也有人把你和十年前那位传奇放在一起比。你第一次发现，虎扑比发布会更早给你定性。'
    ],
    body: '第一张热度帖会定义你在虎扑的起点，也会决定虎扑以后怎么称呼你。',
    requires: function() {
      var media = getBranchNode('media');
      return getBranchNode('fan_culture') === 'start'
        && (media === 'press_accountable' || media === 'press_team' || media === 'press_silent' || media === 'press_confront'
        || media === 'crisis_apology' || media === 'crisis_explain' || media === 'crisis_delete' || media === 'crisis_strong'
        || ['persona_humble','persona_arrogant','persona_silent','persona_business','persona_national','persona_controversial','persona_independent'].indexOf(media) >= 0);
    },
    choices: [
      { label: '晒数据回应', hint: '技术流好评，数据党认可', apply: function() {
        setBranchNode('fan_culture', 'fan_heat', { tone: 'stats' });
        addProfileDelta('fanSupport', 2);
        return '你把效率值、正负值和关键球录像贴上去。热评第一变成：这数据没得黑。<br><br>效果：球迷支持+2。';
      }},
      { label: '发段子自嘲', hint: '亲和力上升，黑粉变乐子', apply: function() {
        setBranchNode('fan_culture', 'fan_heat', { tone: 'meme' });
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', -1);
        return '你转发了那张表情包，配文：我打的，认了。评论区从对骂变成整活。<br><br>效果：人气+1；争议-1。';
      }},
      { label: '正面回应黑粉', hint: '热度爆炸，立场鲜明', apply: function() {
        setBranchNode('fan_culture', 'fan_heat', { tone: 'fight' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 2);
        return '你引用黑粉的原话，一条条回怼。帖子被转到所有分区，支持者和黑粉都更兴奋了。<br><br>效果：人气+2；争议+2。';
      }},
      { label: '不回应', hint: '热度自然消退，专注比赛', apply: function() {
        setBranchNode('fan_culture', 'fan_lowkey', { tone: 'lowkey' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '你没有登录账号。帖子慢慢沉下去，但有人记住了：那个被黑的人一句话没说。<br><br>效果：状态波动-1；球迷支持+1。';
      }}
    ]
  },
  {
    id: 'fan_culture_score',
    branch: 'fan_culture', phase: 'season', slot: 'main', weight: 12,
    title: '球迷文化：虎扑评分事件',
    scenes: [
      '赛后评分上线，你头像下的数字跳个不停。这一晚你打得很满：关键球有，失误也有。',
      '热评第一写着“这分不真实”，第二写着“反向评分走起”，第三已经开始吵你的防守。'
    ],
    body: '评分只是一个数字，但虎扑会用一整晚讨论它。你要给这串数字一个什么样的结尾？',
    requires: function() {
      var node = getBranchNode('fan_culture');
      return node === 'fan_heat' || node === 'fan_lowkey';
    },
    choices: [
      { label: '把评分当成镜子', hint: '关掉手机，把这一晚变成训练素材', apply: function() {
        setBranchNode('fan_culture', 'score_mirror', { score: 'mirror' });
        addSeasonMod('formVariance', -2, -10, 10);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你关掉手机，回训练馆把录像从头看到尾。评分不会变，但你决定下一场不一样。<br><br>效果：状态波动-2；伤病风险-1。';
      }},
      { label: '回热评自嘲', hint: '用幽默接住争议', apply: function() {
        setBranchNode('fan_culture', 'score_meme', { score: 'meme' });
        addProfileDelta('fame', 1);
        addProfileDelta('mediaTrust', 1);
        return '你在评论区回了一条：这分我先投了，下一场还。评论区从对骂变成整活。<br><br>效果：人气+1；媒体好感+1。';
      }},
      { label: '主动列出自己的失误', hint: '自己开楼，把问题摊开', apply: function() {
        setBranchNode('fan_culture', 'score_own', { score: 'own' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('fanSupport', 1);
        return '你自己开了一楼，把今晚的失误一条条列出来。有人说你太认真，也有人说这才是真实。<br><br>效果：媒体好感+2；球迷支持+1。';
      }},
      { label: '让团队控评', hint: '版面干净，但真实感下降', apply: function() {
        setBranchNode('fan_culture', 'score_report', { score: 'report' });
        addProfileDelta('controversy', -1);
        addProfileDelta('mediaTrust', -1);
        return '你让团队处理掉那些带节奏的帖子。版面干净了，但有人说你玩不起。<br><br>效果：争议-1；媒体好感-1。';
      }}
    ]
  },
  {
    id: 'fan_culture_community',
    branch: 'fan_culture', phase: 'season', slot: 'main', weight: 11,
    title: '球迷文化：社区互动',
    scenes: [
      '虎扑给你开了官方认证，邀请你空降。你发现账号有 20 万关注，但一条都没发过。',
      '编辑问你：要不要先从回一条热评开始？'
    ],
    body: '从“被谈论”到“亲自下场”，是球迷文化线最关键的转折。',
    requires: function() {
      var node = getBranchNode('fan_culture');
      return node === 'score_mirror' || node === 'score_meme' || node === 'score_own' || node === 'score_report';
    },
    choices: [
      { label: '亲自回帖', hint: '真实感上升，风评变活', apply: function() {
        setBranchNode('fan_culture', 'community_reply', { action: 'reply' });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('mediaTrust', 1);
        return '你挑了几条热评逐条回复，包括一条骂你的。骂你的那条被你回复后，楼主反而成了你粉丝。<br><br>效果：球迷支持+3；媒体好感+1。';
      }},
      { label: '空降直播', hint: '互动最高，风险也高', apply: function() {
        setBranchNode('fan_culture', 'community_live', { action: 'live' });
        addProfileDelta('fame', 3);
        addProfileDelta('controversy', 1);
        return '你在虎扑直播间聊了一个小时，从训练聊到夜宵。弹幕从“黑”变“真性情”只用了十分钟。<br><br>效果：人气+3；争议+1。';
      }},
      { label: '举报黑帖', hint: '保护自己，维护版面', apply: function() {
        setBranchNode('fan_culture', 'community_report', { action: 'report' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你让团队举报了一批带节奏的帖子。版面干净了，但也有人阴阳你“玩不起”。<br><br>效果：媒体好感+1；争议-1。';
      }},
      { label: '潜水围观', hint: '保持神秘，热度可控', apply: function() {
        setBranchNode('fan_culture', 'community_lurk', { action: 'lurk' });
        addProfileDelta('fanSupport', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你注册了账号，但只点赞不发言。老粉发现后开始找你点过赞的帖子。<br><br>效果：球迷支持+1；状态波动-1。';
      }}
    ]
  },
  {
    id: 'fan_culture_persona',
    branch: 'fan_culture', phase: 'season', slot: 'main', weight: 10,
    title: '球迷文化：球迷人设成型',
    scenes: [
      '半年后，虎扑已经不再用你的比赛评价你，而是用“你这个人”评价你。有人做了你的梗图合集，标题是：他可能不是最强的，但一定是最会整活的。'
    ],
    body: '选择你希望被虎扑记住的身份。点亮和点灭，最后都会变成你的一部分。',
    requires: function() {
      var node = getBranchNode('fan_culture');
      return node === 'community_reply' || node === 'community_live' || node === 'community_report' || node === 'community_lurk';
    },
    choices: [
      { label: '虎扑顶流', hint: '人气最高，节奏也最多', lockHint: '需要媒体已经把你塑造成偶像或争议人物', requires: function() {
        var m = getBranchNode('media');
        return m === 'persona_business' || m === 'persona_controversial';
      }, bonus: function() {
        addProfileDelta('fame', 1);
        return { text: '媒体的炒作底子，让顶流热度更高。' };
      }, apply: function() {
        setBranchNode('fan_culture', 'fan_top', { persona: 'fan_top' });
        STATE.career.flags.fanCulturePersona = 'fan_top';
        addProfileDelta('fame', 4);
        addProfileDelta('controversy', 2);
        return '你的每条动态都能上首页。黑你的人越来越多，但点亮数永远压过点灭。<br><br>效果：人气+4；争议+2。';
      }},
      { label: '球迷领袖', hint: '球迷支持最高，历史评价上升', lockHint: '需要媒体已经用谦逊或国家荣誉形容过你', requires: function() {
        var m = getBranchNode('media');
        return m === 'persona_humble' || m === 'persona_national';
      }, bonus: function() {
        addProfileDelta('fanSupport', 1);
        return { text: '谦逊或国家荣誉的形象，让球迷更认你。' };
      }, apply: function() {
        setBranchNode('fan_culture', 'fan_leader', { persona: 'fan_leader' });
        STATE.career.flags.fanCulturePersona = 'fan_leader';
        addProfileDelta('fanSupport', 4);
        addProfileDelta('legacyBonus', 1);
        return '你的评论区成了理性讨论区。新球迷来了第一句都是：这里居然能好好说话。<br><br>效果：球迷支持+4；历史评价+1。';
      }},
      { label: '低调JR', hint: '稳定，无黑点', lockHint: '需要媒体已经记住你的沉默', requires: function() {
        return getBranchNode('media') === 'persona_silent';
      }, bonus: function() {
        addProfileDelta('mediaTrust', 1);
        return { text: '沉默的形象，让低调更有分量。' };
      }, apply: function() {
        setBranchNode('fan_culture', 'fan_lowjr', { persona: 'fan_lowjr' });
        STATE.career.flags.fanCulturePersona = 'fan_lowjr';
        addProfileDelta('mediaTrust', 2);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你很少发言，但每条都很真诚。虎扑给你的标签是：被黑得最多，却从不黑别人。<br><br>效果：媒体好感+2；状态波动-1。';
      }},
      { label: '争议区常客', hint: '流量稳定，争议稳定', lockHint: '需要媒体已经被你的争议话题围绕', requires: function() {
        return getBranchNode('media') === 'persona_controversial' || !!getBranchState('media').confront;
      }, bonus: function() {
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return { text: '媒体的争议底子，让节奏停不下来。' };
      }, apply: function() {
        setBranchNode('fan_culture', 'fan_controversial', { persona: 'fan_controversial' });
        STATE.career.flags.fanCulturePersona = 'fan_controversial';
        addProfileDelta('fame', 3);
        addProfileDelta('controversy', 3);
        return '你的名字和“开会”“整活”绑定。无论输赢，虎扑都有你的版面。<br><br>效果：人气+3；争议+3。';
      }},
      { label: '普通球迷', hint: '不经营人设，做自己', apply: function() {
        setBranchNode('fan_culture', 'fan_normal', { persona: 'fan_normal' });
        STATE.career.flags.fanCulturePersona = 'fan_normal';
        addProfileDelta('fanSupport', 1);
        addProfileDelta('mediaTrust', 1);
        return '你没有刻意经营人设，只是偶尔上线看看大家怎么讨论你。没有顶流的架子，也没有黑粉的烦恼，虎扑记住的是那个愿意说真话的普通人。<br><br>效果：球迷支持+1；媒体好感+1。';
      }}
    ]
  },
  {
    id: 'mental_low',
    branch: 'mental_health', phase: 'season', slot: 'main', weight: 12,
    title: '心理健康：心理低谷',
    scenes: [
      '那段时间你照常训练、照常比赛，但一切都不对劲。赢球没有快感，输球没有愤怒，连更衣室的玩笑都让你觉得累。',
      '凌晨两点，你盯着天花板，第一次不知道自己到底在为什么打球。'
    ],
    body: '低谷不是软弱，是身体和心在提醒你停下来听一听。',
    requires: function() { return getBranchNode('mental_health') === 'start' && getMentalPressure() >= 8; },
    choices: [
      { label: '找心理医生', hint: '最专业的路径，恢复最稳', apply: function() {
        setBranchNode('mental_health', 'mh_pro', { help: 'pro' });
        addSeasonMod('formVariance', -2, -10, 10);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你约了球队推荐的心理医生。前两次你几乎不说话，第三次你开始讲童年、压力和那些“必须赢”的夜晚。她没有评价，只是听。<br><br>效果：状态波动-2；伤病风险-1。';
      }},
      { label: '找家人倾诉', hint: '最温暖的路径，关系更深', apply: function() {
        setBranchNode('mental_health', 'mh_family', { help: 'family' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '你给家里打了电话。妈妈听你说完，只说了一句：累了就回来吃饭，别自己扛。那天晚上你睡得很沉。<br><br>效果：状态波动-1；球迷支持+1；你和家人更近了一点。';
      }},
      { label: '用训练消化', hint: '保持节奏，把情绪留在球馆', apply: function() {
        setBranchNode('mental_health', 'mh_training', { help: 'training' });
        addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把自己泡在训练馆里，练到筋疲力尽。身体累了，心反而安静了一点。训练师没有劝你休息，只在你投完最后一球时递了一瓶水。<br><br>效果：耐力+1。';
      }},
      { label: '硬扛', hint: '表面没事，风险累积', apply: function() {
        setBranchNode('mental_health', 'mh_tough', { help: 'tough' });
        addSeasonMod('formVariance', -1, -10, 10);
        addSeasonMod('injuryRiskBonus', 2, -4, 8);
        return '你告诉所有人没事。笑容、训练、采访，一样都没落下。但你知道，有些东西没有消失，只是在排队。<br><br>效果：短期状态波动-1；长期伤病风险+2。';
      }}
    ]
  },
  {
    id: 'mental_recovery',
    branch: 'mental_health', phase: 'season', slot: 'main', weight: 11,
    title: '心理健康：心理恢复期',
    scenes: [
      '你开始每天固定做一件事：散步、写日记、和家人视频、或者只是睡前关掉手机。变化很小，但你重新能听清自己的呼吸。'
    ],
    body: '恢复不是突然变好，是每天多一点。',
    requires: function() {
      var node = getBranchNode('mental_health');
      return node === 'mh_pro' || node === 'mh_family' || node === 'mh_training' || node === 'mh_tough';
    },
    choices: [
      { label: '建立恢复习惯', hint: '最稳定，形成长期韧性', apply: function() {
        setBranchNode('mental_health', 'mh_resilient', { resolve: 'resilient' });
        STATE.career.flags.mentalResilient = true;
        addSeasonMod('formVariance', -2, -10, 10);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把心理恢复写进训练表，像练力量一样认真。队医说：你的恢复指标回来了，你的眼神也回来了。<br><br>效果：状态波动-2；伤病风险-1；获得“心理韧性”标签。';
      }},
      { label: '公开分享经历', hint: '影响最大，也最勇敢', apply: function() {
        setBranchNode('mental_health', 'mh_open', { resolve: 'open' });
        STATE.career.flags.mentalOpen = true;
        addProfileDelta('mediaTrust', 3);
        addProfileDelta('fanSupport', 3);
        addProfileDelta('controversy', -1);
        return '你在采访里说自己也经历过低谷。新闻稿当天刷屏，很多球迷留言说：谢谢你承认这些。<br><br>效果：媒体好感+3；球迷支持+3；争议-1。';
      }},
      { label: '保持低调恢复', hint: '安静修复，不被聚光灯打扰', apply: function() {
        setBranchNode('mental_health', 'mh_quiet', { resolve: 'quiet' });
        STATE.career.flags.mentalQuiet = true;
        addSeasonMod('formVariance', -1, -10, 10);
        addSeasonMod('mediaPressure', -1, -10, 10);
        return '你没有公开任何东西，只是让身边几个人知道。几个月后，状态悄悄回到正轨。<br><br>效果：状态波动-1；媒体关注下降。';
      }}
    ]
  },
  {
    id: 'mental_resolve',
    branch: 'mental_health', phase: 'season', slot: 'main', weight: 10,
    title: '心理健康：心理收束',
    scenes: [
      '一年后回头看，那段低谷没有毁掉你。它变成了一根你随时可以抓回来的绳子：你知道自己扛过更难的，也知道了该在什么时候向谁求助。'
    ],
    body: '选择你希望这段经历留下的形状。',
    requires: function() {
      var node = getBranchNode('mental_health');
      return node === 'mh_resilient' || node === 'mh_open' || node === 'mh_quiet';
    },
    choices: [
      { label: '成为更完整的领袖', hint: '更衣室信任提升', lockHint: '需要更衣室已经认你是领袖', requires: function() {
        return getBranchNode('team_practice') === 'practice_identity';
      }, bonus: function() {
        addProfileDelta('lockerRoomTrust', 1);
        return { text: '球队线队魂身份加持，低谷经历成了更衣室的语言。' };
      }, apply: function() {
        setBranchNode('mental_health', 'mental_leader', { final: 'leader' });
        STATE.career.flags.mentalLeader = true;
        addProfileDelta('lockerRoomTrust', 3);
        return '年轻球员状态差时，你没有催他，而是说了句：我也经历过。那晚之后，他敢在你面前说真话了。<br><br>效果：更衣室信任+3。';
      }},
      { label: '把经历讲给更多人', hint: '媒体与球迷认可', lockHint: '需要媒体或球迷已经记住你', requires: function() {
        var md = getBranchNode('media');
        var fc = getBranchNode('fan_culture');
        return ['persona_humble','persona_arrogant','persona_silent','persona_business','persona_national','persona_controversial'].indexOf(md) >= 0
          || fc === 'fan_top' || fc === 'fan_leader' || fc === 'fan_lowjr' || fc === 'fan_controversial';
      }, bonus: function() {
        addProfileDelta('mediaTrust', 1);
        return { text: '媒体/球迷人设让公开分享的声量更大。' };
      }, apply: function() {
        setBranchNode('mental_health', 'mental_advocate', { final: 'advocate' });
        STATE.career.flags.mentalAdvocate = true;
        addProfileDelta('mediaTrust', 3);
        addProfileDelta('fanSupport', 2);
        return '你开始支持心理健康公益，把经历变成别人的支撑。<br><br>效果：媒体好感+3；球迷支持+2。';
      }},
      { label: '安静地把它留在身后', hint: '稳定，不消费苦难', lockHint: '媒体线沉默杀手/球迷线低调JR可强化', requires: function() {
        return true;
      }, bonus: function() {
        var md = getBranchNode('media');
        var fc = getBranchNode('fan_culture');
        if (md === 'persona_silent' || fc === 'fan_lowjr') {
          addSeasonMod('formVariance', -1, -10, 10);
          return { text: '沉默杀手/低调JR人设加成，安静收束更有分量。' };
        }
        return { text: '你选择把低谷留在身后。' };
      }, apply: function() {
        setBranchNode('mental_health', 'mental_quiet_resolve', { final: 'quiet' });
        STATE.career.flags.mentalQuietResolve = true;
        addSeasonMod('formVariance', -2, -10, 10);
        addProfileDelta('legacyBonus', 1);
        return '你没有把低谷变成故事，只是把它留在了那年夏天。你继续打球，偶尔想起，心里没有重量。<br><br>效果：状态波动-2；历史评价+1。';
      }}
    ]
  },
  {
    id: 'city_first_impression',
    branch: 'city_culture', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '城市文化：来到这座城市',
    scenes: [
      '赛季开始前，你第一次认真看这座城市。它没有在等你，也不会因为你到来就改变自己。',
      '但你慢慢发现，城市和球员一样：你需要先向它自我介绍。'
    ],
    body: '你选择怎么和这座城市相处，决定了它以后怎么向别人介绍你。',
    requires: function() {
      var played = (STATE.career.totalStats && STATE.career.totalStats.games > 0) || (STATE.season && STATE.season.playerStats && STATE.season.playerStats.games > 0);
      var honored = hasCareerHonor('全明星') || hasCareerHonor('MVP') || hasCareerHonor('总冠军');
      return getBranchNode('city_culture') === 'start' && !isCityTransfer() && (played || honored);
    },
    choices: [
      { label: '融入城市生活', hint: '去街头、去球馆、去认识这座城', apply: function() {
        var city = getBranchState('city_culture');
        city.team = STATE.careerTeam;
        setBranchNode('city_culture', 'city_open', { team: STATE.careerTeam });
        addProfileDelta('fanSupport', 2);
        return '你开始混进城市里的野球场，去本地餐馆吃饭，听本地人怎么称呼这座城。慢慢地，有人开始喊你“咱们队的”。<br><br>效果：球迷支持+2。';
      }},
      { label: '专注篮球，暂不融入', hint: '先证明自己，再谈归属', apply: function() {
        var city = getBranchState('city_culture');
        city.team = STATE.careerTeam;
        setBranchNode('city_culture', 'city_distant', { team: STATE.careerTeam });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你告诉自己：打好球就是最好的融入。城市暂时还只是一个客场和主场之间的地名。<br><br>效果：状态波动-1；媒体关注下降。';
      }},
      { label: '主动做社区活动', hint: '用行动先给城市一点东西', apply: function() {
        var city = getBranchState('city_culture');
        city.team = STATE.careerTeam;
        setBranchNode('city_culture', 'city_community', { team: STATE.careerTeam });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你去了社区中心、小学球馆和一家公益机构。没有镜头，但很多家庭记住了你的名字。<br><br>效果：球迷支持+3；历史评价+1。';
      }}
    ]
  },
  {
    id: 'city_signature',
    branch: 'city_culture', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '城市文化：城市印记',
    scenes: [
      '你在这座城市打了两年，开始认得几条街道的名字，也开始有人在你输球时仍然站在场边。',
      '你意识到，归属感不是城市给你的，是你自己刻出来的。'
    ],
    body: '选择你留给这座城市的第一个印记。',
    requires: function() {
      var node = getBranchNode('city_culture');
      return (node === 'city_open' || node === 'city_distant' || node === 'city_community') && !isCityTransfer();
    },
    choices: [
      { label: '带球队去城市地标', hint: '球队与城市绑定，热度高', apply: function() {
        setBranchNode('city_culture', 'city_landmark', { mark: 'landmark' });
        addProfileDelta('fame', 2);
        addProfileDelta('fanSupport', 2);
        return '你把一次全队训练搬到城市地标前。球迷围了好几层，照片传遍全网。<br><br>效果：人气+2；球迷支持+2。';
      }},
      { label: '资助社区球馆', hint: '最扎实的印记，长期影响', apply: function() {
        setBranchNode('city_culture', 'city_ballcourt', { mark: 'ballcourt' });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你匿名资助了那座社区球馆。孩子们只知道有人翻新了地板，后来有人告诉他们：是你。<br><br>效果：球迷支持+3；历史评价+1。';
      }},
      { label: '把家人接来', hint: '让城市成为家', lockHint: '需要家人之间已经谈过未来', requires: function() {
        var fm = getBranchNode('family');
        return fm === 'family_plan' || fm === 'family_settled';
      }, bonus: function() {
        addProfileDelta('fanSupport', 1);
        return { text: '家庭线已经稳定，安家更顺理成章。' };
      }, apply: function() {
        setBranchNode('city_culture', 'city_family', { mark: 'family' });
        addSeasonMod('formVariance', -2, -10, 10);
        return '你把家人接到这座城市，孩子在这里上学，父母在这里散步。你终于不再把“回家”说成另一个地方。<br><br>效果：状态波动-2；家人更懂你，也更愿意站在你这边。';
      }},
      { label: '保持低调', hint: '用比赛说话，不刻意经营', apply: function() {
        setBranchNode('city_culture', 'city_quiet', { mark: 'quiet' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有做任何城市营销，只是每个休赛期都回来训练。本地人习惯了在球馆门口遇见你。<br><br>效果：媒体好感+1；状态波动-1。';
      }}
    ]
  },
  {
    id: 'city_bond',
    branch: 'city_culture', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '城市文化：城市羁绊',
    scenes: [
      '自由市场来了又走，你还在名单上。总经理问你：有没有想过这座城市对你意味着什么？',
      '你第一次没有用“职业”回答这个问题。'
    ],
    body: '羁绊不是合同，是你和城市之间互相记住的部分。',
    requires: function() {
      var node = getBranchNode('city_culture');
      return (node === 'city_landmark' || node === 'city_ballcourt' || node === 'city_family' || node === 'city_quiet') && !isCityTransfer();
    },
    choices: [
      { label: '承诺留队', hint: '忠诚评价最高，冠军不确定', lockHint: '需要你先在自由市场做出留守的决定', requires: function() {
        return !!(STATE.career.flags && STATE.career.flags.freeAgentChoice === 'stay');
      }, bonus: function() {
        addProfileDelta('fanSupport', 1);
        return { text: '自由市场前夜你已选择留守，承诺更有分量。' };
      }, apply: function() {
        setBranchNode('city_culture', 'city_loyal', { bond: 'loyal' });
        STATE.career.flags.cityLoyal = true;
        addProfileDelta('fanSupport', 4);
        addProfileDelta('legacyBonus', 2);
        return '你公开说：我想在这里退役。新闻出来的那晚，球馆外墙投影了你的号码。<br><br>效果：球迷支持+4；历史评价+2；flag cityLoyal = true。';
      }},
      { label: '把号码留给城市', hint: '城市符号，退役球衣加分', apply: function() {
        setBranchNode('city_culture', 'city_icon', { bond: 'icon' });
        STATE.career.flags.cityIcon = true;
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你说：如果有一天我离开，这个号码就留给这座城。从此“XX号”不再只是你的号码。<br><br>效果：球迷支持+3；历史评价+1；flag cityIcon = true。';
      }},
      { label: '开设青训基地', hint: '城市与下一代绑定', apply: function() {
        setBranchNode('city_culture', 'city_academy', { bond: 'academy' });
        STATE.career.flags.cityAcademy = true;
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你在城市里开了青训基地，第一批学员里有不少本地孩子。你开始教他们第一步，也教他们怎么喜欢上篮球。<br><br>效果：球迷支持+3；历史评价+1；flag cityAcademy = true。';
      }},
      { label: '城市巡游活动', hint: '热度最高，商业联动', apply: function() {
        setBranchNode('city_culture', 'city_parade', { bond: 'parade' });
        STATE.career.flags.cityParade = true;
        addProfileDelta('fame', 4);
        addProfileDelta('businessValue', 2);
        return '你在夺冠后包下整条街区办巡游。全城都是你的海报，连对手球迷都承认：这座城市爱他。<br><br>效果：人气+4；商业价值+2；flag cityParade = true。';
      }}
    ]
  },
  {
    id: 'city_farewell',
    branch: 'city_culture', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '城市文化：告别这座城市',
    scenes: [
      '转会基本敲定那天，你开车路过自己常去的那家球馆。城市没有责怪你，但你知道，有些告别应该由你来说。'
    ],
    body: '转会不是城市的背叛，但离开的方式会决定这座城市以后怎么提到你。',
    requires: function() { return isCityTransfer(); },
    choices: [
      { label: '体面告别', hint: '保留城市记忆，新城市重新开始', apply: function() {
        setBranchNode('city_culture', 'start', { team: STATE.careerTeam, farewell: 'grace' });
        addProfileDelta('fanSupport', 1);
        addProfileDelta('legacyBonus', 1);
        return '你发了一封给球迷的信：感谢这座城市把三年变成家。球迷在评论区刷屏：常回来看看。<br><br>效果：球迷支持+1；历史评价+1；新城市重新开始。';
      }},
      { label: '承诺未来回归', hint: '给未来留一扇门，城市会记得你', apply: function() {
        setBranchNode('city_culture', 'start', { team: STATE.careerTeam, farewell: 'promise' });
        STATE.career.flags.cityFutureReturn = true;
        addProfileDelta('fanSupport', 2);
        return '你答应合同到期后优先考虑回归。城市没有留你，但把你的号码挂在了心里。<br><br>效果：球迷支持+2；flag cityFutureReturn = true；新城市重新开始。';
      }},
      { label: '冷漠离开', hint: '快进快出，城市评价受损', apply: function() {
        setBranchNode('city_culture', 'start', { team: STATE.careerTeam, farewell: 'cold' });
        addProfileDelta('fanSupport', -2);
        addProfileDelta('controversy', 1);
        return '你没有公开发声，直接收拾行李走人。新闻发布会上，本地记者的问题比往常尖锐。<br><br>效果：球迷支持-2；争议+1；新城市重新开始。';
      }}
    ]
  },
  {
    id: 'child_pregnancy',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '家人孩子：怀孕确认',
    scenes: [
      '她告诉你怀孕那天，你在酒店房间愣了很久。职业球员最怕失控，但那一刻，你忽然觉得有一个更值得失控的未来在等你。'
    ],
    body: '你选择怎么迎接这个即将到来的变化？',
    requires: function() {
      return getBranchNode('family_children') === 'start' && (getBranchNode('relationship') === 'partnership' || getBranchNode('family') === 'family_settled');
    },
    choices: [
      { label: '一起规划', hint: '家人之间会更近', apply: function() {
        setBranchNode('family_children', 'pregnancy', { plan: 'together' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你们把下赛季的赛程摊在桌上，认真圈出几个日子。她笑你比画战术还认真。<br><br>效果：状态波动-1；你们之间，又多了一份默契。';
      }},
      { label: '全程陪伴', hint: '球迷支持上升，伤病风险下降', apply: function() {
        setBranchNode('family_children', 'pregnancy', { plan: 'present' });
        addProfileDelta('fanSupport', 1);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你告诉团队：那几天不要给我排任何行程。教练第一次看到你主动请假，愣了一下，然后点头。<br><br>效果：球迷支持+1；伤病风险-1。';
      }},
      { label: '事业照旧', hint: '短期专注，但关系压力上升', apply: function() {
        setBranchNode('family_children', 'pregnancy', { plan: 'career' });
        addProfileDelta('controversy', 1);
        return '你告诉自己赛季不能停。她没有说什么，只是把检查单收进了抽屉。<br><br>效果：争议+1；家庭压力上升。';
      }}
    ]
  },
  {
    id: 'child_birth',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '家人孩子：孩子出生',
    scenes: ['产房门口，你听见第一声啼哭时，训练馆、客场、合同全部退成背景。那声哭比任何哨声都响。'],
    body: '那一刻已经过去，但你怎么记住它，会写进孩子后来的人生。',
    requires: function() { return getBranchNode('family_children') === 'pregnancy'; },
    choices: [
      { label: '全程在场', hint: '孩子亲密度最高', apply: function() {
        setBranchNode('family_children', 'birth_present', { birth: 'present' });
        STATE.career.flags.childBirthPresent = true;
        addProfileDelta('fanSupport', 1);
        return '你在产房陪了全程。孩子被放进你怀里时，你发现自己的手在发抖。<br><br>效果：flag childBirthPresent = true；球迷支持+1。';
      }},
      { label: '赛程冲突缺席', hint: '留下遗憾与争议', apply: function() {
        setBranchNode('family_children', 'birth_absent', { birth: 'absent' });
        STATE.career.flags.childBirthAbsent = true;
        addProfileDelta('controversy', 1);
        return '那场比赛你打了，却记不清任何细节。视频通话里，她声音很轻：孩子像你。<br><br>效果：flag childBirthAbsent = true；争议+1。';
      }},
      { label: '两边都要', hint: '平衡但有损耗', apply: function() {
        setBranchNode('family_children', 'birth_balanced', { birth: 'balanced' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你赶上了出生，也赶上了飞机。累得在更衣室睡着时，手机里是她发来的照片。<br><br>效果：状态波动-1。';
      }}
    ]
  },
  {
    id: 'child_care',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '家人孩子：育儿分工',
    scenes: ['凌晨三点，孩子哭醒。你抱着他在客厅走了四十分钟，第一次觉得“累”可以有完全不同的意思。'],
    body: '照顾孩子的方式，会影响你接下来的精力和家庭温度。',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'birth_present' || n === 'birth_absent' || n === 'birth_balanced';
    },
    choices: [
      { label: '自己带', hint: '孩子亲密度高，消耗也大', apply: function() {
        setBranchNode('family_children', 'care_solo', { care: 'solo' });
        addSeasonMod('formVariance', 1, -10, 10);
        return '你学会换尿布、哄睡、冲奶粉。深夜的训练变成深夜的客厅散步，但你舍不得换人。<br><br>效果：状态波动+1；孩子亲密度高。';
      }},
      { label: '家人帮忙', hint: '状态更稳', apply: function() {
        setBranchNode('family_children', 'care_shared', { care: 'shared' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你爸妈搬来住了一个月。孩子被哄睡时，你坐在沙发上，忽然觉得家是这个样子。<br><br>效果：状态波动-1。';
      }},
      { label: '专业团队', hint: '训练时间更稳', apply: function() {
        setBranchNode('family_children', 'care_help', { care: 'help' });
        addAttrDelta('STA', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你请了育儿师，也请了夜班阿姨。训练没落下，但你偶尔会想：他第一次笑的时候，是谁先看见的。<br><br>效果：耐力+1。';
      }}
    ]
  },
  {
    id: 'child_conflict',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '家人孩子：事业与孩子',
    scenes: ['连续第七个客场，视频通话里他开始躲镜头。你忽然意识到，他在长大，而你一直在错过。'],
    body: '这是家人孩子线的关键分叉，选择会决定你们离得多远，或靠得多近。',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'care_solo' || n === 'care_shared' || n === 'care_help';
    },
    choices: [
      { label: '调整赛程', hint: '家庭优先', apply: function() {
        setBranchNode('family_children', 'rebalance', { conflict: 'family' });
        STATE.career.flags.familyFirst = true;
        addProfileDelta('fanSupport', 1);
        return '你第一次主动和教练谈轮休，把客场安排压缩到最低。回来那晚，孩子已经会爬了。<br><br>效果：flag familyFirst = true；球迷支持+1。';
      }},
      { label: '让家人多承担', hint: '状态稳定', apply: function() {
        setBranchNode('family_children', 'rebalance', { conflict: 'share' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你把更多陪伴交给家人，自己用视频参与。不是最好的答案，但你们都在努力。<br><br>效果：状态波动-1。';
      }},
      { label: '硬扛', hint: '短期专注，压力累积', apply: function() {
        setBranchNode('family_children', 'conflict_strain', { conflict: 'strain' });
        STATE.career.flags.careerFirst = true;
        addSeasonMod('formVariance', 2, -10, 10);
        return '你告诉自己：先把这个赛季打完。电话越来越少，你越来越不敢问他想不想你。<br><br>效果：状态波动+2；心理健康加压。';
      }}
    ]
  },
  {
    id: 'child_growth',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '家人孩子：孩子成长',
    scenes: ['他会拍球了，也会在你输球时把玩具球递给你。你第一次发现，孩子才是那个一直在教你重新开始的人。'],
    body: '你希望他的童年长成什么样子？',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'rebalance' || n === 'conflict_strain';
    },
    choices: [
      { label: '教他打球', hint: '篮球启蒙', apply: function() {
        setBranchNode('family_children', 'growth_hoop', { growth: 'hoop' });
        STATE.career.flags.childHoop = true;
        return '你教他拍球，他学会后跑到球场另一头喊：爸爸看我。那一刻你比拿到总冠军还高兴。<br><br>效果：flag childHoop = true。';
      }},
      { label: '陪他做普通的事', hint: '状态更稳', apply: function() {
        setBranchNode('family_children', 'growth_life', { growth: 'life' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '你带他去公园、超市和游乐园。他不在意你多有名，只在意你陪了他多久。<br><br>效果：状态波动-1；球迷支持+1。';
      }},
      { label: '让他自己选', hint: '自由成长', apply: function() {
        setBranchNode('family_children', 'growth_free', { growth: 'free' });
        STATE.career.flags.childFree = true;
        return '你带他看篮球，也带他画画。你说：不一定要像爸爸。<br><br>效果：flag childFree = true。';
      }},
      { label: '带他见世界', hint: '人气上升', apply: function() {
        setBranchNode('family_children', 'growth_public', { growth: 'public' });
        addProfileDelta('fame', 1);
        return '你带他看了第一次客场。镜头围过来时，他躲在你的腿后面，又偷偷探出头。<br><br>效果：人气+1。';
      }}
    ]
  },
  {
    id: 'child_public',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '家人孩子：聚光灯下的孩子',
    scenes: ['你第一次认真考虑：要不要让孩子出现在聚光灯下。照片传开后，有人夸可爱，有人讨论他的成长环境，你决定由自己掌握节奏。'],
    body: '你会怎么保护他，又怎么让他认识这个世界？',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'growth_hoop' || n === 'growth_life' || n === 'growth_free' || n === 'growth_public';
    },
    choices: [
      { label: '保护隐私', hint: '媒体好感上升', apply: function() {
        setBranchNode('family_children', 'public_protected', { publicity: 'protected' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('fanSupport', 1);
        return '你要求媒体不再拍他，把账号里的照片也删了大半。世界还在议论，但至少他自己不知道。<br><br>效果：媒体好感+1；球迷支持+1。';
      }},
      { label: '带他亮相', hint: '人气上升，争议上升', apply: function() {
        setBranchNode('family_children', 'public_spotlight', { publicity: 'spotlight' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 1);
        return '你带他参加了一次公开活动。他挥手的样子被做成表情包，全网都在喊“太像了”。<br><br>效果：人气+2；争议+1。';
      }},
      { label: '顺其自然', hint: '状态稳定', apply: function() {
        setBranchNode('family_children', 'public_normal', { publicity: 'normal' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你不刻意曝光，也不刻意躲。有人拍到就拍到，他慢慢学会不在意镜头。<br><br>效果：状态波动-1。';
      }}
    ]
  },
  {
    id: 'child_future',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 9,
    title: '家人孩子：父子未来',
    scenes: ['他问你：爸爸，我也能打 NBA 吗？你认真想了很久，才发现答案不是“能”，而是“你想不想”。'],
    body: '你希望把什么留给他？',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'public_protected' || n === 'public_spotlight' || n === 'public_normal';
    },
    choices: [
      { label: '父子同台', hint: '历史评价上升', apply: function() {
        setBranchNode('family_children', 'legacy_court', { legacy: 'court' });
        STATE.career.flags.childCourtDream = true;
        addProfileDelta('legacyBonus', 1);
        return '你告诉他：如果有一天我们同场，我会把球传给你。他笑得很用力，像是已经等到了那天。<br><br>效果：flag childCourtDream = true；历史评价+1。';
      }},
      { label: '送进青训', hint: '为他铺一条属于自己的路', apply: function() {
        setBranchNode('family_children', 'legacy_academy', { legacy: 'academy' });
        STATE.career.flags.childAcademy = true;
        addProfileDelta('legacyBonus', 1);
        return '你送他进了青训营。他第一天回来满身汗，却兴奋地讲了一整晚训练。<br><br>效果：他的篮球路有了起点，未来也可能成为你的延续。';
      }},
      { label: '尊重他的选择', hint: '球迷支持上升', apply: function() {
        setBranchNode('family_children', 'legacy_own', { legacy: 'own' });
        STATE.career.flags.childOwnChoice = true;
        addProfileDelta('fanSupport', 1);
        return '你说：你不需要像我。他第一次没有立刻反驳，只是点了点头。<br><br>效果：flag childOwnChoice = true；球迷支持+1。';
      }},
      { label: '让他过普通人生', hint: '状态稳定', apply: function() {
        setBranchNode('family_children', 'legacy_quiet', { legacy: 'quiet' });
        STATE.career.flags.childQuietLife = true;
        addSeasonMod('formVariance', -1, -10, 10);
        return '你带他钓鱼、骑车、看比赛但不教他怎么打。他想打的时候自然会来问你。<br><br>效果：flag childQuietLife = true；状态波动-1。';
      }}
    ]
  },
  {
    id: 'camp_launch',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 10,
    title: '训练营：开营决策',
    scenes: ['你租下那座球馆时，房东问你：这是要当生意做，还是当梦想做？你笑了笑：先让梦想把房租付了。'],
    body: '你选择开一间什么样的训练营？',
    requires: function() {
      var tr = getBranchNode('training');
      var tp = getBranchNode('team_practice');
      var ch = getBranchNode('charity');
      return getBranchNode('training_camp') === 'start' && (tr === 'training_identity' || tp === 'practice_identity' || ch !== 'start');
    },
    choices: [
      { label: '暑期营规模', hint: '球迷支持与商业上升', apply: function() {
        setBranchNode('training_camp', 'camp_large', { mode: 'large' });
        addProfileDelta('fanSupport', 2);
        addProfileDelta('businessValue', 1);
        return '开营第一天来了两百多个孩子，球馆门口排到街角。你站在门口，像第一次进训练馆的自己。<br><br>效果：球迷支持+2；商业价值+1。';
      }},
      { label: '精品小班', hint: '训练效果更高', apply: function() {
        setBranchNode('training_camp', 'camp_small', { mode: 'small' });
        addProfileDelta('legacyBonus', 1);
        return '你只收了十二个孩子，每个动作都亲自示范。有个孩子说：教练，你比视频里凶。<br><br>效果：历史评价+1。';
      }},
      { label: '公益名额', hint: '媒体好感与球迷支持上升', apply: function() {
        setBranchNode('training_camp', 'camp_charity', { mode: 'charity' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('fanSupport', 3);
        return '你把一半名额留给交不起学费的孩子。第一堂课上，一个男孩小声说：我以后也想当教练。<br><br>效果：媒体好感+2；球迷支持+3。';
      }},
      { label: '国际交流', hint: '人脉线效果增强', apply: function() {
        setBranchNode('training_camp', 'camp_intl', { mode: 'intl' });
        STATE.career.flags.campIntl = true;
        return '你邀请了几个海外教练和孩子来交流。语言不通，但篮球替你们翻译。<br><br>效果：flag campIntl = true。';
      }}
    ]
  },
  {
    id: 'camp_style',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 11,
    title: '训练营：教练风格',
    scenes: ['第一个学员把你教的动作做歪了。你忍住没纠正，先问他：你自己觉得哪里不对？他愣住的样子，像极了当年的你。'],
    body: '你希望孩子们记住你是一个怎样的教练？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'camp_large' || n === 'camp_small' || n === 'camp_charity' || n === 'camp_intl';
    },
    choices: [
      { label: '亲自带', hint: '最真实', apply: function() {
        setBranchNode('training_camp', 'style_own', { style: 'own' });
        STATE.career.flags.campOwnCoach = true;
        return '你每堂课都亲自下场示范。膝盖有点旧伤，但你舍不得站在场边。<br><br>效果：flag campOwnCoach = true。';
      }},
      { label: '请导师助阵', hint: '人脉更强', apply: function() {
        setBranchNode('training_camp', 'style_mentors', { style: 'mentors' });
        STATE.career.flags.campMentors = true;
        return '你请来几位老将和教练。孩子们第一次看到这么多名字一起出现，像参加全明星。<br><br>效果：flag campMentors = true。';
      }},
      { label: '让学员互相教', hint: '更衣室信任上升', apply: function() {
        setBranchNode('training_camp', 'style_peer', { style: 'peer' });
        STATE.career.flags.campPeer = true;
        addProfileDelta('lockerRoomTrust', 1);
        return '你让大孩子教小孩子。被教的那个学会后，第一件事是跑去教更小的。<br><br>效果：flag campPeer = true；更衣室信任+1。';
      }},
      { label: '魔鬼训练', hint: '成长快但风险高', apply: function() {
        setBranchNode('training_camp', 'style_strict', { style: 'strict' });
        STATE.career.flags.campStrict = true;
        return '你要求每个动作做够一百次。孩子们喊累，但结营时没人想走。<br><br>效果：flag campStrict = true。';
      }}
    ]
  },
  {
    id: 'camp_student',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 12,
    title: '训练营：特殊学员',
    scenes: ['开营第三天，一个瘦小的男孩站在门口，说想试训，但交不起学费。你让他进来，他练到所有人都走了还没走。'],
    body: '你会怎么对待这个特别的学员？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'style_own' || n === 'style_mentors' || n === 'style_peer' || n === 'style_strict';
    },
    choices: [
      { label: '按天赋重点培养', hint: '故事性最强', apply: function() {
        setBranchNode('training_camp', 'student_prodigy', { student: 'prodigy' });
        STATE.career.flags.studentProdigy = true;
        return '他的天赋比同龄人高出一截。训练时你故意压着他，怕他太早觉得世界很简单。<br><br>效果：flag studentProdigy = true。';
      }},
      { label: '免学费，送他新鞋', hint: '公益联动', apply: function() {
        setBranchNode('training_camp', 'student_hardship', { student: 'hardship' });
        STATE.career.flags.studentHardship = true;
        return '你免了他的学费，还给他买了一双新鞋。他低着头说了声谢谢，练得更狠了。<br><br>效果：flag studentHardship = true。';
      }},
      { label: '先定规矩再收下', hint: '争议上升', apply: function() {
        setBranchNode('training_camp', 'student_rebel', { student: 'rebel' });
        STATE.career.flags.studentRebel = true;
        addProfileDelta('controversy', 1);
        return '他顶撞你、迟到、态度差，但投篮手感是真的好。你决定不赶他走。<br><br>效果：flag studentRebel = true；争议+1。';
      }},
      { label: '给他时间慢慢熟悉', hint: '最有耐心的故事', apply: function() {
        setBranchNode('training_camp', 'student_quiet', { student: 'quiet' });
        STATE.career.flags.studentQuiet = true;
        return '他从不抢话，训练完总是一个人加练。你问他为什么，他说：怕被落下。<br><br>效果：flag studentQuiet = true。';
      }}
    ]
  },
  {
    id: 'camp_crisis',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 12,
    title: '训练营：训练营危机',
    scenes: ['训练营进入第三周，问题一起冒出来：那个瘦小男孩训练时扭伤了脚踝，家长群里开始质疑训练强度，赞助商也在催你加课时，还有两个学员差点在场上动手。你站在球馆门口，知道这是这个夏天第一次真正的考验。'],
    body: '问题一起压过来，你要先处理哪一件？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'student_prodigy' || n === 'student_hardship' || n === 'student_rebel' || n === 'student_quiet';
    },
    choices: [
      { label: '先守在受伤学员身边', hint: '把孩子放在第一位', apply: function() {
        setBranchNode('training_camp', 'crisis_injury', { crisis: 'injury' });
        addProfileDelta('controversy', 1);
        return '片子出来没有大碍，但舆论已经把“训练营不安全”写进标题。你守在球馆门口等他复查。<br><br>效果：争议+1。';
      }},
      { label: '先回应家长的质疑', hint: '把训练安排讲清楚', apply: function() {
        setBranchNode('training_camp', 'crisis_parent', { crisis: 'parent' });
        addProfileDelta('mediaPressure', 1, -10, 10);
        return '有家长在群里质疑训练强度。你没有删消息，只发了一条长回复，把每堂课的内容列出来。<br><br>效果：媒体压力+1。';
      }},
      { label: '先顶住赞助商的要求', hint: '坚持训练营的纯粹', apply: function() {
        setBranchNode('training_camp', 'crisis_sponsor', { crisis: 'sponsor' });
        addProfileDelta('businessValue', -1);
        return '赞助商希望加广告位、加课时、加利润。你看着那份合同，第一次知道什么叫“被钱绑架”。<br><br>效果：商业价值-1。';
      }},
      { label: '先把冲突带到中圈', hint: '让双方把话说完', apply: function() {
        setBranchNode('training_camp', 'crisis_rivalry', { crisis: 'rivalry' });
        addProfileDelta('controversy', 1);
        return '两个学员在球场上差点动手。你把所有人叫到中圈，让他们把话说完。<br><br>效果：争议+1。';
      }}
    ]
  },
  {
    id: 'camp_response',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 11,
    title: '训练营：危机回应',
    scenes: ['你关掉手机想了一晚。最后你决定：先做对的事，再谈对的话。'],
    body: '你怎么回应这场危机？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'crisis_injury' || n === 'crisis_parent' || n === 'crisis_sponsor' || n === 'crisis_rivalry';
    },
    choices: [
      { label: '安全优先', hint: '媒体好感上升', apply: function() {
        setBranchNode('training_camp', 'respond_safety', { respond: 'safety' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('controversy', -1);
        return '你停训三天，请队医给每个孩子做了检查。有人觉得小题大做，但家长群里安静了。<br><br>效果：媒体好感+2；争议-1。';
      }},
      { label: '坦诚沟通', hint: '球迷支持上升', apply: function() {
        setBranchNode('training_camp', 'respond_truth', { respond: 'truth' });
        addProfileDelta('fanSupport', 2);
        return '你没有公关稿，直接录了一段视频，把前因后果讲清楚。结尾说：我会负责。<br><br>效果：球迷支持+2。';
      }},
      { label: '拒绝干预', hint: '原则更清晰', apply: function() {
        setBranchNode('training_camp', 'respond_exit', { respond: 'exit' });
        addProfileDelta('mediaTrust', -1);
        return '你拒绝了赞助商和部分家长的“建议”。训练营少了一些人，但留下的人知道这里的规矩。<br><br>效果：媒体好感-1；原则更清晰。';
      }},
      { label: '化危机为课程', hint: '历史评价上升', apply: function() {
        setBranchNode('training_camp', 'respond_lesson', { respond: 'lesson' });
        STATE.career.flags.campLesson = true;
        addProfileDelta('legacyBonus', 1);
        return '你把这次危机变成一堂课：怎么面对伤病、压力和外界的评价。孩子们听得比训练还认真。<br><br>效果：flag campLesson = true；历史评价+1。';
      }}
    ]
  },
  {
    id: 'camp_legacy',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 9,
    title: '训练营：学员成名',
    scenes: ['五年后，那个男孩进了大学校队。他给你打电话时声音发抖：教练，我做到了。你听完只说了句：我知道。'],
    body: '你希望这段师生关系以什么方式收尾？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'respond_safety' || n === 'respond_truth' || n === 'respond_exit' || n === 'respond_lesson';
    },
    choices: [
      { label: '全力支持', hint: '球迷支持上升', apply: function() {
        setBranchNode('training_camp', 'legacy_support', { legacy: 'support' });
        STATE.career.flags.campSupport = true;
        addProfileDelta('fanSupport', 2);
        return '他首秀那天，你坐在场边第一排。他进球后朝你比了个手势，那是你们训练营的暗号。<br><br>效果：flag campSupport = true；球迷支持+2。';
      }},
      { label: '保持距离', hint: '媒体好感上升', apply: function() {
        setBranchNode('training_camp', 'legacy_space', { legacy: 'space' });
        STATE.career.flags.campSpace = true;
        addProfileDelta('mediaTrust', 1);
        return '你没有蹭他的热度，只在电话里说：好好打。媒体问起来，你只说：那是他自己的故事。<br><br>效果：flag campSpace = true；媒体好感+1。';
      }},
      { label: '签约培养', hint: '商业价值上升', apply: function() {
        setBranchNode('training_camp', 'legacy_sign', { legacy: 'sign' });
        STATE.career.flags.campSign = true;
        addProfileDelta('businessValue', 2);
        return '你和他签了培养协议，帮他找经纪和训练资源。有人说你精明，你知道这是你唯一能给他的承诺。<br><br>效果：flag campSign = true；商业价值+2。';
      }},
      { label: '放手', hint: '历史评价上升', apply: function() {
        setBranchNode('training_camp', 'legacy_free', { legacy: 'free' });
        STATE.career.flags.campFree = true;
        addProfileDelta('legacyBonus', 1);
        return '他说想靠自己的名字打球。你点点头：那就不提我。<br><br>效果：flag campFree = true；历史评价+1。';
      }}
    ]
  },
  {
    id: 'charity_entry',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 3,
    title: '公益：第一次公益',
    scenes: ['经纪人递来公益活动清单，你原本想挑一场最省事的，直到看见一张社区球馆的照片：地板开裂，但孩子们还在打。'],
    body: '你选择怎么开始这段公益之路？',
    requires: function() {
      var played = (STATE.career.totalStats && STATE.career.totalStats.games > 0) || (STATE.season && STATE.season.playerStats && STATE.season.playerStats.games > 0);
      var honored = hasCareerHonor('全明星') || hasCareerHonor('MVP') || hasCareerHonor('总冠军');
      return getBranchNode('charity') === 'start' && (played || honored);
    },
    choices: [
      { label: '捐款', hint: '媒体好感上升，争议下降', apply: function() {
        setBranchNode('charity', 'charity_donate', { entry: 'donate' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你捐了一笔钱，没让团队宣传。直到球馆翻新的照片出来，人们才知道是你。<br><br>效果：媒体好感+1；争议-1。';
      }},
      { label: '亲自下场', hint: '球迷支持上升', apply: function() {
        setBranchNode('charity', 'charity_play', { entry: 'play' });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('fame', 1);
        return '你穿着便装出现在社区球馆，和孩子们打了两个小时。没人要求签名，但每个人都想和你一队。<br><br>效果：球迷支持+3；人气+1。';
      }},
      { label: '低调参与', hint: '状态稳定', apply: function() {
        setBranchNode('charity', 'charity_lowkey', { entry: 'lowkey' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你以个人名义参加了志愿者活动，没让任何镜头进来。结束时，你反而觉得轻松。<br><br>效果：媒体好感+1；状态波动-1。';
      }},
      { label: '商业合作', hint: '商业价值上升', apply: function() {
        setBranchNode('charity', 'charity_biz', { entry: 'biz' });
        STATE.career.flags.charityBiz = true;
        addProfileDelta('businessValue', 2);
        return '品牌方愿意配捐。你在合同里加了一条：收益的一定比例必须进公益账户。<br><br>效果：flag charityBiz = true；商业价值+2。';
      }}
    ]
  },
  {
    id: 'charity_project',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 4,
    title: '公益：公益项目',
    scenes: ['你决定不只捐钱，而是把一个项目做起来。第一次开协调会，你发现自己比打抢七还紧张。'],
    body: '你想把公益做成什么样子？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'charity_donate' || n === 'charity_play' || n === 'charity_lowkey' || n === 'charity_biz';
    },
    choices: [
      { label: '建球馆', hint: '球迷支持上升', apply: function() {
        setBranchNode('charity', 'charity_court', { project: 'court' });
        STATE.career.flags.charityCourt = true;
        addProfileDelta('fanSupport', 3);
        return '你翻新了那座社区球馆，地板、篮板、灯光全部换新。开馆那天，孩子们第一次有了自己的主场。<br><br>效果：flag charityCourt = true；球迷支持+3。';
      }},
      { label: '资助学校', hint: '历史评价上升', apply: function() {
        setBranchNode('charity', 'charity_school', { project: 'school' });
        STATE.career.flags.charitySchool = true;
        addProfileDelta('legacyBonus', 1);
        return '你资助了一所学校的篮球课程，也补上了体育老师的工资。校长说，孩子们比以前更愿意上学了。<br><br>效果：flag charitySchool = true；历史评价+1。';
      }},
      { label: '成立基金会', hint: '商业价值上升', apply: function() {
        setBranchNode('charity', 'charity_foundation', { project: 'foundation' });
        STATE.career.flags.charityFoundation = true;
        addProfileDelta('businessValue', 2);
        return '你成立了基金会，请了专业的团队。第一次理事会上，你发现自己要做的不只是给钱。<br><br>效果：flag charityFoundation = true；商业价值+2。';
      }},
      { label: '国际项目', hint: '人脉线效果增强', apply: function() {
        setBranchNode('charity', 'charity_intl', { project: 'intl' });
        STATE.career.flags.charityIntl = true;
        return '你把项目带到海外，和当地青训合作。语言不同，但球场上的默契是一样的。<br><br>效果：flag charityIntl = true。';
      }}
    ]
  },
  {
    id: 'charity_scale',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 4,
    title: '公益：规模抉择',
    scenes: ['项目做起来了，问题也跟着变多。有人劝你扩大，有人劝你收缩，你说不出哪边更对。'],
    body: '你决定把项目带到多大？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'charity_court' || n === 'charity_school' || n === 'charity_foundation' || n === 'charity_intl';
    },
    choices: [
      { label: '扩大', hint: '影响力上升，风险上升', apply: function() {
        setBranchNode('charity', 'scale_grow', { scale: 'grow' });
        STATE.career.flags.charityGrow = true;
        addProfileDelta('fame', 2);
        return '你把项目复制到三座城市。团队忙到凌晨，你第一次觉得“被需要”也会让人喘不过气。<br><br>效果：flag charityGrow = true；人气+2。';
      }},
      { label: '保持', hint: '状态稳定', apply: function() {
        setBranchNode('charity', 'scale_keep', { scale: 'keep' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有急着扩张，先把现有项目做扎实。第二年，那些孩子真的长高了。<br><br>效果：状态波动-1。';
      }},
      { label: '收缩', hint: '争议下降', apply: function() {
        setBranchNode('charity', 'scale_cut', { scale: 'cut' });
        addProfileDelta('controversy', -1);
        addProfileDelta('mediaTrust', 1);
        return '你主动收缩了规模，只保留最扎实的部分。有人说你雷声大雨点小，你知道自己在做什么。<br><br>效果：争议-1；媒体好感+1。';
      }},
      { label: '交给团队', hint: '更可持续', apply: function() {
        setBranchNode('charity', 'scale_team', { scale: 'team' });
        STATE.career.flags.charityTeam = true;
        return '你请了执行团队，自己只当发起人。第一次放手时你很不习惯，后来发现项目反而跑得更顺。<br><br>效果：flag charityTeam = true。';
      }}
    ]
  },
  {
    id: 'charity_crisis',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 4,
    title: '公益：公益争议',
    scenes: ['有人在评论区质疑你作秀。账目、动机、合作品牌、内部管理，全被拿出来逐条讨论。你第一次明白，做好事也需要勇气。'],
    body: '问题一起压过来，你要先回应哪一个？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'scale_grow' || n === 'scale_keep' || n === 'scale_cut' || n === 'scale_team';
    },
    choices: [
      { label: '先公开账目', hint: '最尖锐，也最诚实', apply: function() {
        setBranchNode('charity', 'crisis_book', { crisis: 'book' });
        addProfileDelta('controversy', 1);
        return '你决定公开每一笔账。团队连夜整理报表，你知道这是最累也最诚实的一天。<br><br>效果：争议+1。';
      }},
      { label: '先回应作秀质疑', hint: '舆论压力上升', apply: function() {
        setBranchNode('charity', 'crisis_show', { crisis: 'show' });
        addProfileDelta('mediaPressure', 1, -10, 10);
        return '热搜词条变成“球员作秀”。你没有急着发声明，因为你知道，解释可能让事情更糟。<br><br>效果：媒体压力+1。';
      }},
      { label: '先排查合作品牌', hint: '争议大幅上升', apply: function() {
        setBranchNode('charity', 'crisis_scandal', { crisis: 'scandal' });
        STATE.career.flags.charityScandal = true;
        addProfileDelta('controversy', 2);
        return '你排查合作品牌时发现对方出了事，你的名字被一起拖下水。你没有切割，先把孩子的事办完再说。<br><br>效果：flag charityScandal = true；争议+2。';
      }},
      { label: '先审计内部账目', hint: '信任危机', apply: function() {
        setBranchNode('charity', 'crisis_embezzle', { crisis: 'embezzle' });
        STATE.career.flags.charityEmbezzle = true;
        addProfileDelta('controversy', 2);
        return '你审计内部账目时发现一笔钱不对。团队里有人劝你私下处理，你选择把所有人叫到一起。<br><br>效果：flag charityEmbezzle = true；争议+2。';
      }}
    ]
  },
  {
    id: 'charity_response',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 4,
    title: '公益：危机回应',
    scenes: ['你关掉手机想了一晚。最后你决定：先做对的事，再谈对的话。'],
    body: '你选择怎样回应这场争议？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'crisis_book' || n === 'crisis_show' || n === 'crisis_scandal' || n === 'crisis_embezzle';
    },
    choices: [
      { label: '公开账目', hint: '媒体好感上升，争议下降', apply: function() {
        setBranchNode('charity', 'respond_book', { respond: 'book' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('controversy', -2);
        return '你把每一笔支出都公开了，包括自己的管理费。评论区从质疑变成：行，这波我服。<br><br>效果：媒体好感+2；争议-2。';
      }},
      { label: '亲自回应', hint: '球迷支持上升', apply: function() {
        setBranchNode('charity', 'respond_trust', { respond: 'trust' });
        addProfileDelta('fanSupport', 2);
        addProfileDelta('fame', 1);
        return '你没有发声明，直接在直播里回答每一个问题，回答到嗓子哑了。有人开始相信你不是在表演。<br><br>效果：球迷支持+2；人气+1。';
      }},
      { label: '沉默', hint: '热度消退但留下疑问', apply: function() {
        setBranchNode('charity', 'respond_silent', { respond: 'silent' });
        addProfileDelta('controversy', 1);
        return '你没有回应任何质疑。热度慢慢过去，但你知道，有些问题不会因为沉默消失。<br><br>效果：争议+1。';
      }},
      { label: '法律手段', hint: '争议下降，媒体好感上升', apply: function() {
        setBranchNode('charity', 'respond_law', { respond: 'law' });
        STATE.career.flags.charityLaw = true;
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你对造谣的人提起了诉讼。有人说你太较真，你说：公益经不起被当玩笑。<br><br>效果：flag charityLaw = true；媒体好感+1；争议-1。';
      }}
    ]
  },
  {
    id: 'charity_legacy',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 3,
    title: '公益：公益收束',
    scenes: ['五年后，那座球馆的孩子们已经长大。有人问你当初为什么做公益，你只说：因为被需要的感觉，比赢球更接近幸福。'],
    body: '你希望这段公益故事被怎样记住？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'respond_book' || n === 'respond_trust' || n === 'respond_silent' || n === 'respond_law';
    },
    choices: [
      { label: '慈善家', hint: '历史评价上升', apply: function() {
        setBranchNode('charity', 'legacy_legend', { legacy: 'legend' });
        STATE.career.flags.charityLegend = true;
        addProfileDelta('legacyBonus', 2);
        return '媒体开始用“慈善家”称呼你。你不喜欢这个头衔，但你知道那些球馆会替你记得。<br><br>效果：flag charityLegend = true；历史评价+2。';
      }},
      { label: '社区英雄', hint: '球迷支持大幅上升', apply: function() {
        setBranchNode('charity', 'legacy_hero', { legacy: 'hero' });
        STATE.career.flags.charityHero = true;
        addProfileDelta('fanSupport', 4);
        return '社区把那天定为“XX日”。你站在球馆门口，第一次觉得自己真的属于这里。<br><br>效果：flag charityHero = true；球迷支持+4。';
      }},
      { label: '安静善举', hint: '媒体好感上升', apply: function() {
        setBranchNode('charity', 'legacy_quiet', { legacy: 'quiet' });
        STATE.career.flags.charityQuiet = true;
        addProfileDelta('mediaTrust', 2);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你不再公开谈公益，只继续做。有人问起，你笑笑：做就是了。<br><br>效果：flag charityQuiet = true；媒体好感+2；状态波动-1。';
      }},
      { label: '商业公益', hint: '商业价值上升', apply: function() {
        setBranchNode('charity', 'legacy_biz', { legacy: 'biz' });
        STATE.career.flags.charityBizLegend = true;
        addProfileDelta('businessValue', 3);
        return '你把公益做成了可持续的模式：品牌出钱、社区受益、孩子打球。有人问是不是生意，你说：能一直做下去就行。<br><br>效果：flag charityBizLegend = true；商业价值+3。';
      }}
    ]
  },
  {
    id: 'countdown_trigger',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '退役倒计时：心里的声音',
    scenes: [
      '赛季结束后的深夜，你一个人坐在球馆里。灯只留了一盏，地板上的倒影比年轻时安静。',
      '你数了数这些年受过的伤，又数了数还能跑起来的夜晚。不是打不动了，是你开始能听见身体里的声音。'
    ],
    body: '那个声音越来越大：是不是到了该告别的时候？',
    requires: function() {
      var age = (STATE.career && STATE.career.currentAge) || 22;
      var tend = STATE.career && STATE.career.flags && STATE.career.flags.familyRetireTendency;
      return getBranchNode('retirement_countdown') === 'start' && (age >= 37 || tend === 'retire');
    },
    choices: [
      { label: '认真面对告别', hint: '开启退役倒计时', apply: function() {
        setBranchNode('retirement_countdown', 'countdown_open', { status: 'open' });
        addProfileDelta('mediaTrust', 1);
        return '你没有立刻告诉任何人。只是第二天训练结束，你多留了一会儿，把球馆看了一遍。<br><br>重点：你决定给这段生涯一个正式的告别。<br><br>影响：倒计时开启，接下来会走向退役收束。';
      }},
      { label: '推迟告别，再打几年', hint: '继续战斗', apply: function() {
        setBranchNode('retirement_countdown', 'postponed', { status: 'postponed' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.countdownPostponed = true;
        delete STATE.career.flags.countdownDone;
        return '你关掉灯，跟那个声音说：再等等。至少等到我不再期待踏上球场那天。<br><br>重点：你选择继续战斗。<br><br>影响：倒计时不开启，未来仍会正常出现退役选择。';
      }}
    ]
  },
  {
    id: 'countdown_reflect',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '退役倒计时：告别前的夜晚',
    scenes: [
      '赛季还没结束，你已经开始舍不得了。更衣室的味道、客场大巴的窗户、球迷喊你名字的尾音。',
      '一个普通训练日，你站在场边看年轻人跑战术，忽然意识到：自己真的快要离开这个画面了。'
    ],
    body: '在真正告别之前，你最想把什么留在心里？',
    requires: function() { return getBranchNode('retirement_countdown') === 'countdown_open'; },
    choices: [
      { label: '记住欢呼', hint: '球迷支持上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_memories', { memory: 'cheer' });
        addProfileDelta('fanSupport', 2);
        return '你把主场球迷的欢呼录了下来。不是用来发，是用来以后想念。<br><br>重点：你选择带着这些声音离开。<br><br>影响：球迷支持+2。';
      }},
      { label: '记住队友', hint: '更衣室信任上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_memories', { memory: 'teammates' });
        addProfileDelta('lockerRoomTrust', 2);
        return '那天晚上你请全队吃了饭。没人提退役，但每个人都多坐了一会儿。<br><br>重点：你选择带走这些关系。<br><br>影响：更衣室信任+2。';
      }},
      { label: '记住自己', hint: '媒体好感上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_memories', { memory: 'self' });
        addProfileDelta('mediaTrust', 1);
        return '你翻出新秀年的照片，坐在家里看了很久。那个少年不知道以后会走多远，但你知道，他没有走错路。<br><br>重点：你选择记住最初那个自己。<br><br>影响：媒体好感+1。';
      }}
    ]
  },
  {
    id: 'countdown_close',
    branch: 'retirement_countdown', phase: 'offseason', slot: 'main', weight: 10,
    title: '退役倒计时：放下球衣的那天',
    scenes: [
      '赛季真正结束时，你没有急着收拾。你坐在更衣室，把号码从身上摘下来，像摘下一段很长的日子。',
      '没有人催你。你知道，离开这件事，终于可以体面地发生了。'
    ],
    body: '放下球衣的那一刻，你希望心里留下的是什么？',
    requires: function() { return getBranchNode('retirement_countdown') === 'farewell_memories'; },
    choices: [
      { label: '圆满', hint: '没有遗憾', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_legend', { legacy: 'legend' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.countdownLegend = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', 3);
        return '你想起所有值得的瞬间，觉得这一路没有辜负任何人。<br><br>重点：退役收束为“圆满”。<br><br>影响：退役结算即将开始。';
      }},
      { label: '传承', hint: '为教练之路埋下种子', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_mentor', { legacy: 'mentor' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.countdownMentor = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', 1);
        return '你把最后一段时光用来教年轻人。他们后来会提起你，像提起一段路。<br><br>重点：退役收束为“传承”。<br><br>影响：为退役后的教练之路埋下种子。';
      }},
      { label: '安静', hint: '状态稳定', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_quiet', { legacy: 'quiet' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.countdownQuiet = true;
        STATE.career.flags.countdownDone = true;
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有办告别演出，只在离开前把更衣室收拾干净。有些人记得，那就够了。<br><br>重点：退役收束为“安静”。<br><br>影响：状态稳定。';
      }},
      { label: '遗憾', hint: '更真实但留伤疤', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_hurt', { legacy: 'hurt' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.legacyHurt = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', -1);
        return '伤病让最后一段路有点疼。你站在更衣室里，把护具放好，没让任何人看见你的眼睛。<br><br>重点：退役收束为“遗憾”，但更真实。<br><br>影响：历史评价-1。';
      }}
    ]
  },
  {
    id: 'countdown_route',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '退役倒计时：最后一季路线',
    scenes: ['总经理问你怎么安排这个赛季。你第一次觉得，赛季不是赛程，而是一场漫长的告别。'],
    body: '你希望最后一季以什么方式展开？',
    requires: function() { return false; },
    choices: [
      { label: '常规赛巡演', hint: '球迷支持上升', apply: function() {
        setBranchNode('retirement_countdown', 'route_regular', { route: 'regular' });
        addProfileDelta('fanSupport', 3);
        return '你打完每一场客场，认真和每个城市的球迷挥手。有人举着“再见”的牌子，你知道那是祝福。<br><br>效果：球迷支持+3。';
      }},
      { label: '只打季后赛', hint: '状态更专注', apply: function() {
        setBranchNode('retirement_countdown', 'route_playoff', { route: 'playoff' });
        STATE.career.flags.routePlayoff = true;
        return '你选择轮休常规赛，只把力气留给季后赛。媒体说你任性，你知道自己为什么这么做。<br><br>效果：flag routePlayoff = true。';
      }},
      { label: '全明星谢幕', hint: '人气上升', apply: function() {
        setBranchNode('retirement_countdown', 'route_allstar', { route: 'allstar' });
        STATE.career.flags.routeAllStar = true;
        addProfileDelta('fame', 2);
        return '你把全明星当成谢幕战。最后一球，全场起立，连对手都停下来看。<br><br>效果：flag routeAllStar = true；人气+2。';
      }},
      { label: '减少出场', hint: '伤病风险下降', apply: function() {
        setBranchNode('retirement_countdown', 'route_light', { route: 'light' });
        STATE.career.flags.routeLight = true;
        addSeasonMod('injuryRiskBonus', -2, -4, 8);
        return '你把上场时间让给年轻人，自己只打关键回合。身体轻松了，心反而有点空。<br><br>效果：flag routeLight = true；伤病风险-2。';
      }}
    ]
  },
  {
    id: 'countdown_farewell',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '退役倒计时：告别时刻',
    scenes: ['客场球迷开始为你起立。有人举着“谢谢你”的牌子，也有人从第一年就开始看你打球。'],
    body: '你希望在哪座城市、用什么方式说再见？',
    requires: function() { return false; },
    choices: [
      { label: '每城致敬', hint: '历史评价上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_city', { farewell: 'city' });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你把每个客场都变成谢幕。最后一场结束时，客队球迷也站起来鼓掌。<br><br>效果：球迷支持+3；历史评价+1。';
      }},
      { label: '回母队', hint: '队史评价上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_team', { farewell: 'team' });
        STATE.career.flags.farewellHomeTeam = true;
        addProfileDelta('legacyBonus', 2);
        return '你回到职业生涯开始的地方打完最后一场。那座球馆的灯光，比记忆中更亮。<br><br>效果：flag farewellHomeTeam = true；历史评价+2。';
      }},
      { label: '主场之夜', hint: '球迷支持上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_home', { farewell: 'home' });
        addProfileDelta('fanSupport', 2);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你只在主场告别。最后一晚，整座球馆喊你的名字喊到灯光熄灭。<br><br>效果：球迷支持+2；伤病风险-1。';
      }},
      { label: '队友之夜', hint: '更衣室信任上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_buddy', { farewell: 'buddy' });
        STATE.career.flags.farewellBuddy = true;
        addProfileDelta('lockerRoomTrust', 2);
        return '你把最后一个进球传给队友，让他完成最后一攻。他说：这球算你头上。<br><br>效果：flag farewellBuddy = true；更衣室信任+2。';
      }}
    ]
  },
  {
    id: 'countdown_teammates',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '退役倒计时：队友的反应',
    scenes: ['更衣室里没人主动提“退役”两个字。直到一个年轻球员开口：教练，我能跟你打最后一年吗？'],
    body: '队友的态度会影响你最后这段路的温度。',
    requires: function() { return false; },
    choices: [
      { label: '挽留', hint: '更衣室信任上升', apply: function() {
        setBranchNode('retirement_countdown', 'team_stay', { team: 'stay' });
        STATE.career.flags.teamStay = true;
        addProfileDelta('lockerRoomTrust', 2);
        return '老队友在更衣室说：再打一年吧，我们还行。你笑了笑：你们行，我不行了。<br><br>效果：flag teamStay = true；更衣室信任+2。';
      }},
      { label: '支持', hint: '球迷支持上升', apply: function() {
        setBranchNode('retirement_countdown', 'team_support', { team: 'support' });
        STATE.career.flags.teamSupport = true;
        addProfileDelta('fanSupport', 1);
        return '队友们没有劝你，只是把每一场都打得像你要走了一样。那一年，球队比想象中更团结。<br><br>效果：flag teamSupport = true；球迷支持+1。';
      }},
      { label: '传承', hint: '历史评价上升', apply: function() {
        setBranchNode('retirement_countdown', 'team_pass', { team: 'pass' });
        STATE.career.flags.teamPass = true;
        addProfileDelta('legacyBonus', 1);
        return '你开始把战术板交给年轻球员。他们问你为什么，你说：因为我要走的路，你们要接着走。<br><br>效果：flag teamPass = true；历史评价+1。';
      }},
      { label: '沉默', hint: '争议上升', apply: function() {
        setBranchNode('retirement_countdown', 'team_silent', { team: 'silent' });
        STATE.career.flags.teamSilent = true;
        addProfileDelta('controversy', 1);
        return '更衣室没人讨论你的退役。不是冷漠，是不知道该怎么开口。<br><br>效果：flag teamSilent = true；争议+1。';
      }}
    ]
  },
  {
    id: 'countdown_final',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '退役倒计时：最后一战',
    scenes: ['最后两分钟，教练没有叫暂停。全场都在喊你的名字，你忽然想不起自己是什么时候开始打球的。'],
    body: '你希望用哪种方式告别球场？',
    requires: function() { return false; },
    choices: [
      { label: '全力输出', hint: '历史评价上升', apply: function() {
        setBranchNode('retirement_countdown', 'final_show', { final: 'show' });
        STATE.career.flags.finalShow = true;
        addProfileDelta('legacyBonus', 1);
        return '你打出了生涯末段最好的表现，全场起立。那一刻你只想再要一个回合。<br><br>效果：flag finalShow = true；历史评价+1。';
      }},
      { label: '传给年轻人', hint: '更衣室信任上升', apply: function() {
        setBranchNode('retirement_countdown', 'final_pass', { final: 'pass' });
        STATE.career.flags.finalPass = true;
        addProfileDelta('lockerRoomTrust', 3);
        return '最后两分钟，你把球一次次交给年轻人。他们投丢了，你也不生气。<br><br>效果：flag finalPass = true；更衣室信任+3。';
      }},
      { label: '享受比赛', hint: '状态稳定', apply: function() {
        setBranchNode('retirement_countdown', 'final_enjoy', { final: 'enjoy' });
        STATE.career.flags.finalEnjoy = true;
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有在意比分，只是认真看了一遍每个角落。哨响时，你笑着走下场。<br><br>效果：flag finalEnjoy = true；状态波动-1。';
      }},
      { label: '带伤告别', hint: '争议与伤病风险上升', apply: function() {
        setBranchNode('retirement_countdown', 'final_hurt', { final: 'hurt' });
        STATE.career.flags.finalHurt = true;
        addProfileDelta('controversy', 1);
        addSeasonMod('injuryRiskBonus', 2, -4, 8);
        return '你带着伤打完最后一场。走下球场时，你把护具留在更衣室，像把一段日子留在那里。<br><br>效果：flag finalHurt = true；争议+1；伤病风险+2。';
      }}
    ]
  },
  {
    id: 'countdown_legacy',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '退役倒计时：倒计时收束',
    scenes: ['比赛结束，你绕场一圈。灯光熄灭时，你听见自己心里那句“值了”。'],
    body: '你希望这段倒计时以什么方式收尾？',
    requires: function() { return false; },
    choices: [
      { label: '完美谢幕', hint: '历史评价大幅上升', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_legend', { legacy: 'legend' });
        STATE.career.flags.countdownLegend = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', 3);
        return '你以一场漂亮的比赛结束生涯。新闻报道写下：他让告别也变成表演。<br><br>效果：flag countdownLegend/countdownDone；历史评价+3。';
      }},
      { label: '传承告别', hint: '为教练之路埋下种子', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_mentor', { legacy: 'mentor' });
        STATE.career.flags.countdownMentor = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', 1);
        return '你把最后一场留给了年轻球员。更衣室里，有人喊了你一声“教练”。<br><br>效果：你开始像一位教练一样思考，这条路从此有了方向。';
      }},
      { label: '安静转身', hint: '状态稳定', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_quiet', { legacy: 'quiet' });
        STATE.career.flags.countdownQuiet = true;
        STATE.career.flags.countdownDone = true;
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有做任何告别仪式，悄悄打完最后一场，然后安静离开。有些人记得，那就够了。<br><br>效果：flag countdownQuiet/countdownDone；状态波动-1。';
      }},
      { label: '伤病遗憾', hint: '更真实但留伤疤', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_hurt', { legacy: 'hurt' });
        STATE.career.flags.legacyHurt = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', -1);
        return '伤病让你没能以最好的状态离开。你站在更衣室里，把护具放好，没让任何人看见你的眼睛。<br><br>效果：flag legacyHurt/countdownDone；历史评价-1，但更真实。';
      }}
    ]
  },
  {
    id: 'post_career_opening',
    branch: 'post_career', phase: 'post_career', slot: 'main', weight: 12,
    title: '退役后：第一个夏天',
    scenes: [
      '球员通道没有变，只是这一次你没有穿球衣。你把行李从更衣室搬出来，站在停车场里，第一次不知道明天该去哪个球馆。',
      '手机响了一整天：解说台、教练组、品牌方、老队友，都在问你同一个问题——接下来想做什么？'
    ],
    body: '退役不是离开篮球，而是换一种方式继续留在这里。',
    requires: function() { return STATE.career && STATE.career.retired; },
    choices: [
      { label: '接受圈子邀约', hint: '进入身份选择', apply: function() {
        setBranchNode('post_career', 'post_career_map', { stage: 'map' });
        return '你答应了几场采访，见了两支球队的教练组，也和以前合作过的人吃了顿饭。门没有关上，是你第一次主动推开。<br><br>重点：你选择回到篮球旁边。<br><br>影响：下一步进入身份选择。';
      }},
      { label: '先休息一年', hint: '留白，让身体和精神真正退下来', apply: function() {
        setBranchNode('post_career', 'gap_year', { stage: 'gap' });
        return '你关掉了大部分来电，陪家人过了完整的一年：接孩子、看比赛、偶尔去野球场出汗。没有身份，但你终于睡得很好。<br><br>重点：你选择留白。<br><br>影响：下一步进入空白年之后。';
      }}
    ]
  },
  {
    id: 'post_career_gap_return',
    branch: 'post_career', phase: 'post_career', slot: 'main', weight: 8,
    title: '退役后：空白年之后',
    scenes: ['一年过去，你发现自己还是想回到篮球旁边。不是想打球，是想继续参与那些正在发生的比赛和故事。'],
    body: '空白年没有浪费，它让你确认了自己真的还想留下。',
    requires: function() { return getBranchNode('post_career') === 'gap_year'; },
    choices: [
      { label: '主动联系圈子', hint: '回到身份选择', apply: function() {
        setBranchNode('post_career', 'post_career_map', { stage: 'map' });
        return '你给经纪人和电视台回了电话。对方没有惊讶，只说：早就猜到你会回来。<br><br>重点：你主动推开那扇门。<br><br>影响：下一步进入身份选择。';
      }},
      { label: '继续低调生活', hint: '彻底放下聚光灯', apply: function() {
        setBranchNode('post_career', 'low_key', { finalIdentity: 'low_key' });
        STATE.career.flags.postCareerIdentity = 'low_key';
        addProfileDelta('fanSupport', 1);
        return '你偶尔出现在野球场和社区球馆，没人采访，也没人安排行程。你第一次觉得，篮球可以只是生活的一部分。<br><br>重点：你选择彻底退场。<br><br>影响：球迷支持+1；退役后身份线以低调生活收束。';
      }}
    ]
  },
  {
    id: 'post_career_map',
    branch: 'post_career', phase: 'post_career', slot: 'main', weight: 14,
    title: '退役后：身份选择',
    scenes: [
      '所有邀请都摆在你面前。解说台想要你的观点，教练组想要你的经验，品牌方想要你的名字。',
      '你忽然明白，退役后的身份不是别人给你的，是你选出来的。'
    ],
    body: '选择一种方式继续留在篮球里。有些路，需要你先走完一段故事才能选。',
    requires: function() { return getBranchNode('post_career') === 'post_career_map'; },
    choices: [
      { label: '电视评论员', hint: '媒体好感与出镜机会上升', lockHint: '需要媒体已经为你的形象定过调', requires: function() {
        return ['persona_humble','persona_arrogant','persona_silent','persona_business','persona_national','persona_controversial'].indexOf(getBranchNode('media')) >= 0;
      }, apply: function() {
        setBranchNode('post_career', 'commentator', { identity: 'commentator' });
        STATE.career.flags.postCareerIdentity = 'commentator';
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('fame', 1);
        return '你坐在解说台的第一晚，镜头扫过你时，你发现自己比打球时更紧张。但第三期节目后，弹幕开始有人喊你的名字。<br><br>效果：媒体好感+2；人气+1。';
      }},
      { label: '助教', hint: '更衣室信任上升', lockHint: '需要更衣室已经认你是领袖', requires: function() {
        var tp = getBranchState('team_practice');
        return getBranchNode('team_practice') === 'practice_identity' && (tp.identity === 'team_mentor' || tp.identity === 'locker_room_leader');
      }, apply: function() {
        setBranchNode('post_career', 'assistant_coach', { identity: 'assistant_coach' });
        STATE.career.flags.postCareerIdentity = 'assistant_coach';
        addProfileDelta('lockerRoomTrust', 2);
        return '你穿着训练服走进教练组办公室，年轻球员以为你是来加练的。你笑了笑：今天开始，我教你们怎么加练。<br><br>效果：更衣室信任+2。';
      }},
      { label: '主教练', hint: '球队地位大幅提升，压力上升', lockHint: '需要领袖地位和足够的生涯荣誉', requires: function() {
        var tp = getBranchState('team_practice');
        var legacy = STATE.career.legacy || {};
        return getBranchNode('team_practice') === 'practice_identity' && (legacy.hof || legacy.jersey);
      }, apply: function() {
        setBranchNode('post_career', 'head_coach', { identity: 'head_coach' });
        STATE.career.flags.postCareerIdentity = 'head_coach';
        addProfileDelta('controversy', 1);
        addProfileDelta('lockerRoomTrust', 2);
        return '管理层把战术板交给你时，你第一反应是想拒绝。但你想起了自己教过的那些年轻人：这支球队需要一个人告诉他们怎么赢。<br><br>效果：争议+1；更衣室信任+2。';
      }},
      { label: '球队老板', hint: '商业价值上升，媒体压力上升', lockHint: '需要你已经在商业圈留下名字', requires: function() {
        return getBranchNode('network') === 'business_circle' || getBranchNode('rich_paul') === 'rich_paul_mapped';
      }, apply: function() {
        setBranchNode('post_career', 'team_owner', { identity: 'team_owner' });
        STATE.career.flags.postCareerIdentity = 'team_owner';
        addProfileDelta('businessValue', 3);
        addSeasonMod('mediaPressure', 2, -10, 10);
        return '你出现在收购谈判桌的另一边。球员时代你习惯别人报价，现在轮到你拍板。<br><br>效果：商业价值+3；媒体压力+2。';
      }},
      { label: '青训学院', hint: '球迷支持与历史评价上升', lockHint: '需要家人已经稳定下来', requires: function() {
        return getBranchNode('family') === 'family_settled' || (STATE.career.flags && STATE.career.flags.familyRetireTendency === 'family');
      }, apply: function() {
        setBranchNode('post_career', 'youth_academy', { identity: 'youth_academy' });
        STATE.career.flags.postCareerIdentity = 'youth_academy';
        addProfileDelta('fanSupport', 2);
        addProfileDelta('legacyBonus', 1);
        return '你把一座旧球馆改成了青训学院。孩子们喊你教练，也喊你叔叔。你终于明白，有些影响不会出现在技术统计里。<br><br>效果：球迷支持+2；历史评价+1。';
      }},
      { label: '中国男篮顾问', hint: '中国人气与历史评价上升', lockHint: '需要你在国家队留下传奇结局', requires: function() {
        var cn = getBranchNode('china_team');
        return cn === 'national_legend' || cn === 'national_mentor' || cn === 'honorable_exit';
      }, apply: function() {
        setBranchNode('post_career', 'china_consultant', { identity: 'china_consultant' });
        STATE.career.flags.postCareerIdentity = 'china_consultant';
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('legacyBonus', 1);
        return '国家队给你发了顾问聘书。训练馆里，你把当年那些最后一攻的录像放给年轻后卫看：这里，记住这里。<br><br>效果：中国人气+3；历史评价+1。';
      }},
      { label: '经纪公司合伙人', hint: '商业价值与媒体好感上升', lockHint: '需要你已经在职业版图里留下名字', requires: function() {
        return getBranchNode('rich_paul') === 'rich_paul_mapped' || getBranchNode('network') === 'business_circle';
      }, apply: function() {
        setBranchNode('post_career', 'agency_partner', { identity: 'agency_partner' });
        STATE.career.flags.postCareerIdentity = 'agency_partner';
        addProfileDelta('businessValue', 3);
        addProfileDelta('mediaTrust', 1);
        return '你坐在会议室里，看着年轻球员签下第一份合同。你比他们更清楚，这份合同背后有多少场比赛要打。<br><br>效果：商业价值+3；媒体好感+1。';
      }},
      { label: '自由篮球人', hint: '不受任何一方绑定，按自己的节奏走', apply: function() {
        setBranchNode('post_career', 'freelancer', { identity: 'freelancer' });
        STATE.career.flags.postCareerIdentity = 'freelancer';
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('fanSupport', 1);
        return '你没有签任何长约。偶尔客串解说，偶尔去青训营教小孩，偶尔出现在品牌活动里。所有人都在猜你下一步做什么，只有你知道：你没有下一步，你在过自己的日子。<br><br>效果：媒体好感+1；球迷支持+1；退役后身份以“自由篮球人”成型。';
      }}
    ]
  },
  {
    id: 'post_career_first_year',
    branch: 'post_career', phase: 'post_career', slot: 'main', weight: 10,
    title: '退役后：身份第一年',
    scenes: [
      '第一年很快，快到像又打了一个赛季。你学会了新身份的语言，也开始明白：站在场边比站在场上，看得更清楚，也扛得更重。'
    ],
    body: '身份成型不是终点，它会继续被你的选择塑造。',
    requires: function() {
      var node = getBranchNode('post_career');
      return node === 'commentator' || node === 'assistant_coach' || node === 'head_coach' || node === 'team_owner' || node === 'youth_academy' || node === 'china_consultant' || node === 'agency_partner' || node === 'freelancer';
    },
    choices: [
      { label: '站稳脚跟', hint: '长期深耕，身份成型', apply: function() {
        setBranchNode('post_career', 'identity_settled', { finalIdentity: STATE.career.flags.postCareerIdentity || 'commentator' });
        applyPostCareerIdentityDelta(2);
        return '第二年，你已经不需要别人介绍你是谁。新身份开始自己说话。<br><br>重点：退役后身份成型。<br><br>影响：对应身份主属性+2。';
      }},
      { label: '换一种方式', hint: '调整方向，保留人脉', apply: function() {
        setBranchNode('post_career', 'identity_adjusted', { finalIdentity: STATE.career.flags.postCareerIdentity || 'commentator' });
        addProfileDelta('controversy', -1);
        return '你发现这条路不完全适合自己，但没有退出圈子，而是换了个更舒服的位置。<br><br>重点：你选择调整，而不是消失。<br><br>影响：争议-1；状态稳定。';
      }},
      { label: '公开表达争议', hint: '影响力上升，争议上升', apply: function() {
        setBranchNode('post_career', 'identity_voice', { finalIdentity: STATE.career.flags.postCareerIdentity || 'commentator' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 2);
        return '你公开批评了联盟的一项规则。支持者说你敢说，反对者说你越界。但所有人都承认：你没有消失。<br><br>重点：你选择保持声音。<br><br>影响：人气+2；争议+2。';
      }}
    ]
  },
  {
    id: 'rich_paul_career_map',
    branch: 'rich_paul', phase: 'offseason', slot: 'main', weight: 12,
    title: '经纪团队：职业版图会议',
    scenes: [
      '会议室里没有战术板，只有城市、阵容、合同和未来十年的规划。',
      '对方问你：你想只做一个好球员，还是想管理一个更大的职业版图？'
    ],
    body: '这会影响你未来合同到期时看到的选项，也会改变媒体如何解读你的每一步。',
    requires: function() {
      var netNode = getBranchNode('network');
      return getBranchNode('rich_paul') === 'start' && (STATE.career.flags.richPaulContact || getBranchState('mentor').lastMentor === 'lebron' || netNode === 'career_map_meeting' || netNode === 'private_circle');
    },
    choices: [
      { label: '接受职业版图规划', hint: '商业和大市场机会提升，舆论压力也更大', apply: function() {
        setBranchNode('rich_paul', 'rich_paul_mapped', { status: 'mapped' });
        addProfileDelta('businessValue', 2);
        addProfileDelta('fame', 1);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '你没有立刻换团队，但你开始理解他们的语言：球队、城市、品牌、窗口期，全都可以放在同一张图里。<br><br>重点：你的职业生涯开始被当成一个长期项目来经营。<br><br>影响：商业价值上升；未来自由市场会出现更激进的选择；媒体压力略升。';
      }},
      { label: '保留现有团队', hint: '稳定优先，商业增长较慢', apply: function() {
        setBranchNode('rich_paul', 'rich_paul_stable', { status: 'stable_team' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你感谢了他们的计划，但没有马上改变身边的人。离开会议室时，你反而觉得轻松了一点。<br><br>重点：你选择让篮球先于版图，至少现在如此。<br><br>影响：状态更稳定；媒体好感略升；商业扩张速度放缓。';
      }}
    ]
  },
  {
    id: 'network_free_agency_eve',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 14,
    title: '人脉线：自由市场前夜',
    scenes: [
      '自由市场开始前一晚，你的手机没有停过。有人谈城市，有人谈阵容，有人谈冠军，也有人只谈你能成为谁。',
      '经纪团队把三份方案放在桌上：忠诚、权力、冠军。'
    ],
    body: '你的选择会决定下一段职业生涯的形态，也会决定未来几年你会在哪座城市、为什么而战。',
    requires: function() {
      var contract = (STATE.career && STATE.career.contract) || 4;
      var contact = !!(STATE.career && STATE.career.flags && STATE.career.flags.richPaulContact);
      return getBranchNode('rich_paul') === 'rich_paul_mapped' || (getBranchNode('network') === 'business_circle' && contract <= 1) || (contact && contract <= 1);
    },
    choices: [
      { label: '留守母队，要求补强', hint: '队史评价上升，冠军不确定', apply: function() {
        STATE.career.flags.freeAgentChoice = 'stay';
        addProfileDelta('fanSupport', 2);
        addProfileDelta('legacyBonus', 1);
        addProfileDelta('mediaTrust', 1);
        setBranchNode('network', 'stay_team', { status: 'stay' });
        return '你没有接听任何球队的电话，先给管理层发了一条消息：把阵容修好，我留在这里打到底。<br><br>重点：你选择忠诚。<br><br>影响：球迷支持+2；历史评价+1；媒体好感+1。';
      }},
      { label: '加盟争冠球队', hint: '冠军概率上升，忠诚评价下降', apply: function() {
        STATE.career.flags.freeAgentChoice = 'contender';
        addSeasonMod('moraleBonus', 1, -10, 10);
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        setBranchNode('network', 'join_contender', { status: 'contender' });
        return '你选了那支能立刻夺冠的球队。发布会很热闹，但老球迷的眼神里多了一点复杂。<br><br>重点：你选择冠军。<br><br>影响：士气+1；人气+1；争议+1。';
      }},
      { label: '选择大市场球队', hint: '商业上升，舆论压力上升', apply: function() {
        STATE.career.flags.freeAgentChoice = 'market';
        addProfileDelta('businessValue', 3);
        addSeasonMod('mediaPressure', 2, -10, 10);
        setBranchNode('network', 'big_market', { status: 'market' });
        return '你签下了更大的城市、更大的媒体和市场。球馆更大，聚光灯也更刺眼。<br><br>重点：你选择权力。<br><br>影响：商业价值+3；媒体压力+2。';
      }},
      { label: '签短约保持自由', hint: '自由度上升，稳定性下降', apply: function() {
        STATE.career.flags.freeAgentChoice = 'short';
        addSeasonMod('formVariance', 1, -10, 10);
        setBranchNode('network', 'short_deal', { status: 'short' });
        return '你只签了一年。所有人都知道，你不想被任何一座城市锁住。<br><br>重点：你选择自由。<br><br>影响：下赛季状态波动略升。';
      }}
    ]
  },
  {
    id: 'teammate_after_hours',
    branch: 'teammate_bond', phase: 'season', slot: 'main', weight: 9,
    title: '队友：训练结束后的球',
    scenes: [
      '训练结束后，你看见{队友}还留在底角加练。你把包放回更衣柜，走回场上：再跑十组？',
      '你本来已经准备回更衣室，最后还是把球传了过去。'
    ],
    body: '有些关系不是在比赛里建立的，而是在空馆里一次次重复。',
    requires: function() {
      var tp = getBranchNode('team_practice');
      return getBranchNode('teammate_bond') === 'start'
        && ['practice_start','practice_response','practice_mentor','practice_identity'].indexOf(tp) >= 0;
    },
    choices: [
      { label: '留下加练', hint: '默契和队友关系提升', apply: function() {
        bindBondedTeammate();
        setBranchNode('teammate_bond', 'bond_extra', { status: 'extra_work' });
        addProfileDelta('lockerRoomTrust', 2);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '你们没有聊太多，只是一遍遍跑同一个战术。后来比赛里，{队友}提前半步移动，你甚至不用看就把球传了出去。<br><br>重点：你和{队友}开始形成真正的场上默契。<br><br>影响：球队默契上升；更衣室信任上升。';
      }},
      { label: '提醒他别过度', hint: '关系温和提升，风险更低', apply: function() {
        bindBondedTeammate();
        setBranchNode('teammate_bond', 'bond_protected', { status: 'protected' });
        addProfileDelta('lockerRoomTrust', 1);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把球收起来，说今天够了。{队友}愣了一下，最后点点头。第二天，他还是第一个到，但不再硬撑。<br><br>重点：你不是只想赢下一场训练，你开始照顾队友的长赛季。<br><br>影响：更衣室信任上升；下赛季伤病风险略降。';
      }},
      { label: '让助教安排计划', hint: '把加练变得可持续', apply: function() {
        bindBondedTeammate();
        setBranchNode('teammate_bond', 'bond_planned', { status: 'planned' });
        addProfileDelta('lockerRoomTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你拉上助教把十组改成一整套计划：热身、对抗、录像、恢复。{队友}笑着说，跟你练比打比赛还累。<br><br>重点：你让加练变得可持续。<br><br>影响：更衣室信任上升；状态波动略降。';
      }}
    ]
  },
  {
    id: 'teammate_court_chemistry',
    branch: 'teammate_bond', phase: 'season', slot: 'main', weight: 11,
    title: '队友：场上默契',
    scenes: [
      '有些配合不需要喊。你刚过半场，{队友}已经往那个位置移动。防守人还没反应过来，球已经到了。'
    ],
    body: '你要把这份默契塑造成什么形态？',
    requires: function() {
      var node = getBranchNode('teammate_bond');
      return node === 'bond_extra' || node === 'bond_protected' || node === 'bond_planned';
    },
    choices: [
      { label: '增加双人战术', hint: '助攻和球队配合提升', apply: function() {
        setBranchNode('teammate_bond', 'bond_duo', { bondType: 'duo' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '教练把你们俩单独拉去战术室，画了七套双人配合。从那以后，你和{队友}的名字开始被写在同一行。<br><br>效果：传球+1；球队默契+1。';
      }},
      { label: '让他承担更多球权', hint: '队友成长，关系更信任', apply: function() {
        setBranchNode('teammate_bond', 'bond_share', { bondType: 'share' });
        STATE.career.flags.teammateGrowth = true;
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '你主动把一些回合让给{队友}发起。他第一次打出生涯新高时，赛后第一件事是找你撞胸。<br><br>效果：球队默契+1；队友成长。';
      }},
      { label: '关键时刻自己接管', hint: '关键球提升，关系偏依赖', apply: function() {
        setBranchNode('teammate_bond', 'bond_own', { bondType: 'own' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '越到关键回合，球越习惯回到你手里。{队友}没有怨言，只是偶尔在训练时多练一点接球。<br><br>效果：关键球+1。';
      }}
    ]
  },
  {
    id: 'teammate_slump',
    branch: 'teammate_bond', phase: 'season', slot: 'main', weight: 12,
    stateContext: 'teammate_slump',
    title: '队友：队友低谷',
    scenes: [
      '{队友}连续几场投不进，采访区的问题越来越尖。你主动去更衣室找他，把那些问题挡在门外。他一个人坐在柜子前，鞋带解了一半。'
    ],
    body: '低谷是关系最真实的检验。',
    requires: function() {
      var node = getBranchNode('teammate_bond');
      return node === 'bond_duo' || node === 'bond_share' || node === 'bond_own';
    },
    choices: [
      { label: '公开力挺', hint: '媒体形象和队友关系提升', apply: function() {
        setBranchNode('teammate_bond', 'bond_public', { status: 'public' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('lockerRoomTrust', 1);
        return '你在采访里说：{队友}的问题不是手感，是运气。更衣室里有人笑，他低着头，但你看见他肩膀松了下来。<br><br>效果：媒体好感+1；更衣室信任+1。';
      }},
      { label: '私下谈话', hint: '关系最深，最安静', apply: function() {
        setBranchNode('teammate_bond', 'bond_private', { status: 'private' });
        addProfileDelta('lockerRoomTrust', 2);
        return '你没有提数据，只问了一句：要不要一起看录像。{队友}沉默了很久，最后说：好。<br><br>效果：更衣室信任+2。';
      }},
      { label: '用比赛给他找手感', hint: '传球和球队配合提升', apply: function() {
        setBranchNode('teammate_bond', 'bond_feel', { status: 'feel' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '接下来的三场，你不断把球送到{队友}最舒服的位置。他找回手感那天，冲你点了点头，什么都没说。<br><br>效果：传球+1；球队默契+1。';
      }},
      { label: '不介入', hint: '专注自己，关系保持距离', apply: function() {
        setBranchNode('teammate_bond', 'bond_passive', { status: 'passive' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你相信职业球员能自己走出来。{队友}没有怪你，但那天之后，你们的对话少了一些。<br><br>效果：状态波动-1；关系温度下降。';
      }}
    ]
  },
  {
    id: 'teammate_departure',
    branch: 'teammate_bond', phase: 'season', slot: 'main', weight: 10,
    title: '队友：离队或留下',
    scenes: [
      '自由市场前，你主动给{队友}打了电话：别让流言替我们说话，我想听你亲口说。'
    ],
    body: '这段羁绊要如何收场，会决定你们未来还会不会一起打球。',
    requires: function() {
      var node = getBranchNode('teammate_bond');
      var status = getBondedTeammateStatus();
      var afterSlump = node === 'bond_public' || node === 'bond_private' || node === 'bond_feel' || node === 'bond_passive';
      var mid = node === 'bond_extra' || node === 'bond_protected' || node === 'bond_planned' || node === 'bond_duo' || node === 'bond_share' || node === 'bond_own';
      return afterSlump || (mid && (status === 'traded' || status === 'retired_released'));
    },
    choices: [
      { label: '劝他留下', hint: '争取留队，关系更深', apply: function() {
        setBranchNode('teammate_bond', 'bond_stay', { status: 'stay' });
        STATE.career.flags.teammateStayed = true;
        addProfileDelta('lockerRoomTrust', 1);
        return '你直接给{队友}打了电话：留下，我们再试一次。他在电话那头停了几秒，说：好。<br><br>效果：更衣室信任+1；flag teammateStayed = true。';
      }},
      { label: '尊重他的决定', hint: '体面告别，媒体好感上升', apply: function() {
        setBranchNode('teammate_bond', 'bond_leave', { status: 'leave' });
        addProfileDelta('mediaTrust', 1);
        return '你说：去哪都行，别让自己后悔。{队友}走那天，你们没有告别仪式，只是互相拍了拍肩膀。<br><br>效果：媒体好感+1。';
      }},
      { label: '邀请未来重聚', hint: '约定未来重逢，历史会记住这段情谊', apply: function() {
        setBranchNode('teammate_bond', 'bond_reunite', { status: 'reunite' });
        STATE.career.flags.teammateReunion = true;
        addProfileDelta('legacyBonus', 1);
        return '你说：不管你去哪，等你合同到期，我们再一起打一年。{队友}笑了：这句话我会记住。<br><br>效果：历史评价+1；flag teammateReunion = true。';
      }}
    ]
  },
  {
    id: 'crossover_invite',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 12,
    title: '揽佬 · 中国人能飞：邀约',
    scenes: [
      '休赛期刚过一半，揽佬的团队打来电话：新歌《中国人能飞》的演唱会，想请你当嘉宾。电话那头没先聊档期，只问了一句——你相信这首歌是写给你的吗。'
    ],
    body: '你决定要不要站上那个舞台。',
    requires: function() {
      var c = STATE.career || {};
      var profile = c.profile || {};
      return getBranchNode('crossover') === 'start'
        && ((c.currentAge || 22) <= 25) // 25 岁后失去进入机会
        && (getBranchNode('media') !== 'start' || (profile.fame || 0) >= 6 || getBranchNode('china_market') === 'shoe_settled');
    },
    choices: [
      { label: '答应，去唱《中国人能飞》', hint: '彩排、舞台，把这首歌替你唱完', apply: function() {
        setBranchNode('crossover', 'concert_pick', { status: 'accepted' });
        addProfileDelta('fame', 1);
        return '你在电话里说：来。揽佬那边安静了一秒，然后笑着说：我就知道你会答应。<br><br>重点：你决定把篮球之外的第一个舞台，交给这首歌。<br><br>影响：人气+1；下一步进入演唱会彩排。';
      }},
      { label: '婉拒，专注训练', hint: '把邀约放进抽屉，夏天留给球馆', apply: function() {
        setBranchNode('crossover', 'declined', { status: 'declined' });
        addAttrDelta('STA', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回了一条很短的感谢，然后把手机交给训练师保管。训练馆里没有舞台，但你听了一晚上《中国人能飞》。<br><br>影响：耐力+1；你暂时选择了球馆。';
      }}
    ]
  },
  {
    id: 'concert_rehearsal',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 10,
    title: '揽佬 · 中国人能飞：演唱会彩排',
    scenes: [
      '排练室里只有你和揽佬。他放了一遍《中国人能飞》，放到那句歌词时把音乐停了，看着你说：这句你来唱，台下的人会更信。',
      '你第一次觉得，唱歌不是表演，是替很多人把一句话喊出来。'
    ],
    body: '你要用哪种方式准备这次登台？',
    requires: function() { return getBranchNode('crossover') === 'concert_pick'; },
    choices: [
      { label: '认真彩排', hint: '把每一遍都走完整，状态最稳', apply: function() {
        setBranchNode('crossover', 'rehearsal_done', { prep: 'serious' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你让乐队把同一个段落走了十二遍。揽佬说：够了。你说：再一遍。<br><br>影响：下赛季状态波动略降。';
      }},
      { label: '随性发挥', hint: '把排练室当野球场，凭感觉来', apply: function() {
        setBranchNode('crossover', 'rehearsal_done', { prep: 'free' });
        addSeasonMod('formVariance', 1, -10, 10);
        return '你没有按台本练，唱到一半还自己改了节奏。揽佬笑：你这不是彩排，是来抢歌的。<br><br>影响：舞台更有个人色彩；下赛季状态波动略升。';
      }},
      { label: '让团队把关', hint: '先录一遍，反复听哪里不够好', apply: function() {
        setBranchNode('crossover', 'rehearsal_done', { prep: 'team' });
        addProfileDelta('mediaTrust', 1);
        return '你录完一遍，和团队对着回放听了一下午。他们说已经够好了，你点头，然后又要了一次录音。<br><br>影响：媒体好感+1。';
      }}
    ]
  },
  {
    id: 'concert_stage',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 10,
    title: '揽佬 · 中国人能飞：演唱会登台',
    scenes: [
      '灯光暗下来，几万人的场馆安静了一瞬。前奏响起，揽佬在台上喊你的名字，大屏幕切到你。',
      '你看见看台上有孩子举着你的球衣，也举着手电筒。你站到麦架前，忽然明白那句歌词为什么能让人哭。'
    ],
    body: '这首歌，你要怎么唱给台下的人听？',
    requires: function() { return getBranchNode('crossover') === 'rehearsal_done'; },
    choices: [
      { label: '合唱《中国人能飞》', hint: '把歌词唱稳，也把现场唱热', apply: function() {
        setBranchNode('crossover', 'stage_done', { stage: 'sing' });
        addProfileDelta('fanSupport', 2);
        addProfileDelta('fame', 1);
        return '你和揽佬一人一句，唱到那句时，全场跟着一起喊。你没有看提词器，因为这句话你早就想喊了。<br><br>影响：球迷支持+2；人气+1。';
      }},
      { label: '扣篮舞台版', hint: '唱到那句时接球扣进临时篮筐，最炸', apply: function() {
        setBranchNode('crossover', 'stage_done', { stage: 'dunk' });
        addProfileDelta('fame', 3);
        addProfileDelta('controversy', 1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '唱到“中国人能飞”时，工作人员把球抛上来。你接住，起跳，扣进台上临时架起的小篮筐。那一刻，场馆是真的炸了。<br><br>影响：人气+3；争议+1；下赛季状态波动略升。';
      }},
      { label: '玩梗自嘲', hint: '把“球员唱歌”这个梗接住，主动笑自己', apply: function() {
        setBranchNode('crossover', 'stage_done', { stage: 'meme' });
        addProfileDelta('fanSupport', 1);
        addProfileDelta('fame', 2);
        addProfileDelta('mediaTrust', -1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你在台上先说：我唱歌和打球一样，全凭感觉。台下笑成一片，然后你认真把歌唱完了。<br><br>影响：球迷支持+1；人气+2；媒体好感-1；下赛季状态波动略升。';
      }}
    ]
  },
  {
    id: 'crossover_aftermath',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 10,
    title: '揽佬 · 中国人能飞：当晚反响',
    scenes: [
      '热搜第一是“中国人能飞 篮球版”。有人剪了你彩排时反复练同一句的画面，说这是今年最诚实的舞台。',
      '也有人问，他到底还打不打球。你刷到一条评论：我妈第一次看篮球，看到哭。'
    ],
    body: '热度来了，你决定怎么接住它？',
    requires: function() { return getBranchNode('crossover') === 'stage_done'; },
    choices: [
      { label: '高调接住', hint: '转发热搜，认真说一句谢谢', apply: function() {
        setBranchNode('crossover', 'aftermath_done', { after: 'proud' });
        addProfileDelta('fame', 2);
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你转发了那条“篮球版”的视频，只写了一句：谢谢揽佬，谢谢这首歌。评论区安静了一瞬，然后更热闹了。<br><br>影响：人气+2；媒体好感+1；下赛季状态波动略升。';
      }},
      { label: '低调消化', hint: '不回应，让讨论自然过去', apply: function() {
        setBranchNode('crossover', 'aftermath_done', { after: 'quiet' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有回复任何热搜。第二天早上，你准时出现在训练馆。有人把热搜拿给你看，你说：等练完再说。<br><br>影响：下赛季状态波动略降。';
      }},
      { label: '发段子自嘲', hint: '自己开楼，把节奏握在手里', apply: function() {
        setBranchNode('crossover', 'aftermath_done', { after: 'meme' });
        addProfileDelta('fanSupport', 2);
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你发了一条：练习时长两小时的球员歌手，请多包涵。底下全是哈哈哈，也有人开始认真讨论你的舞台。<br><br>影响：球迷支持+2；人气+1；争议+1。';
      }}
    ]
  },
  {
    id: 'crossover_close',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 10,
    title: '揽佬 · 中国人能飞：演唱会收束',
    scenes: [
      '演唱会结束，揽佬在后台叫住你：以后每年，我都给你留一首。',
      '你回到训练馆，把那天的门票夹进更衣柜，然后开始投篮。'
    ],
    body: '这个夏天留下的约定，你要怎么回答？',
    requires: function() { return getBranchNode('crossover') === 'aftermath_done'; },
    choices: [
      { label: '答应每年都来', hint: '和揽佬定下每年之约', apply: function() {
        setBranchNode('crossover', 'legacy_every_year', { legacy: 'every_year' });
        STATE.career.flags.crossoverIdentity = 'every_year';
        STATE.career.flags.crossoverDone = true;
        addProfileDelta('fanSupport', 2);
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('businessValue', 1);
        return '你说：好，每年都给我留一句。揽佬伸手，你们像队友一样击掌。回到训练馆，你练得更狠了，因为你知道夏天还有另一个舞台。<br><br>影响：球迷支持+2；媒体好感+1；商业价值+1。';
      }},
      { label: '只此一次', hint: '把这一晚当成最好的告别', apply: function() {
        setBranchNode('crossover', 'legacy_once', { legacy: 'once' });
        STATE.career.flags.crossoverIdentity = 'once';
        STATE.career.flags.crossoverDone = true;
        addProfileDelta('fame', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你笑着摇头：这一晚很值，但我想把它留成唯一。揽佬没有劝你，只是把那首歌的歌词本递给你。<br><br>影响：人气+1；下赛季状态波动略降。';
      }},
      { label: '以后再说', hint: '留个念想，不急着答应', apply: function() {
        setBranchNode('crossover', 'legacy_open', { legacy: 'open' });
        STATE.career.flags.crossoverIdentity = 'open';
        STATE.career.flags.crossoverDone = true;
        addProfileDelta('fanSupport', 1);
        return '你说：先让我把下一个赛季打好。揽佬点头：行，我等你。那张门票你一直夹在更衣柜里。<br><br>影响：球迷支持+1。';
      }}
    ]
  },
  {
    id: 'crossover_second_chance',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 8,
    title: '揽佬 · 中国人能飞：第二次邀约',
    scenes: ['一年后，揽佬托人带来一句话：上次的邀请还在。《中国人能飞》改版了，第二句我想让你唱。'],
    body: '机会又来了，这次你怎么选？',
    requires: function() {
      var c = STATE.career || {};
      var profile = c.profile || {};
      return getBranchNode('crossover') === 'declined' && (profile.fame || 0) >= 8;
    },
    choices: [
      { label: '这次答应', hint: '进入演唱会彩排', apply: function() {
        setBranchNode('crossover', 'concert_pick', { status: 'accepted_again' });
        addProfileDelta('fame', 1);
        return '你拨通了那通早就该拨的电话。揽佬接起来第一句：我就知道你会回来。<br><br>影响：人气+1；下一步进入演唱会彩排。';
      }},
      { label: '继续婉拒', hint: '彻底留在篮球这一侧', apply: function() {
        setBranchNode('crossover', 'declined', { status: 'declined' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你说：替我谢谢揽佬，这个夏天我还是想在球馆里。电话那头没有失望，只说：那歌我给你留着。<br><br>影响：下赛季状态波动略降。';
      }}
    ]
  },
  {
    id: 'transfer_settle',
    branch: 'transfer', phase: 'offseason', slot: 'main', weight: 14,
    title: '转会风波：新城市',
    body: '换一支球队，不只是换球衣。这座城市、球迷、训练馆、更衣室的规矩，都要重新学一遍。',
    requires: function() {
      var n = getBranchNode('transfer');
      return n === 'transfer_start' || n === 'transfer_resentment';
    },
    choices: [
      { label: '低调融入', hint: '先熟悉环境，再谈表现', apply: function() {
        setBranchNode('transfer', 'transfer_settle_low', { status: 'low' });
        addProfileDelta('coachTrust', 1);
        return '你提前一小时到训练馆，把每个柜子、每台器材的位置都记下来。新队友还没记住你的名字，但开始习惯了你的脚步声。<br><br>效果：教练信任+1。';
      }},
      { label: '高调登场', hint: '让新城市第一时间记住你', apply: function() {
        setBranchNode('transfer', 'transfer_settle_high', { status: 'high' });
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你在首场公开训练里打出几记好球，社交媒体立刻剪出了你的集锦。有人觉得这是态度，有人觉得太高调。<br><br>效果：人气+1；争议+1。';
      }},
      { label: '保留旧队情谊', hint: '先赢得尊重，再谈亲近', apply: function() {
        setBranchNode('transfer', 'transfer_settle_old', { status: 'old' });
        addProfileDelta('loyalty', 1);
        addProfileDelta('fanSupport', 1);
        return '你没有刻意讨好谁，只是在更衣室提起老队友时语气正常。新队友们反而先向你伸出手。<br><br>效果：忠诚+1；球迷支持+1。';
      }}
    ]
  },
  {
    id: 'transfer_identity',
    branch: 'transfer', phase: 'offseason', slot: 'main', weight: 13,
    title: '转会风波：新队角色',
    body: '教练在训练后把你叫住，说要谈谈新赛季的计划。他知道你经历过什么，所以把话问得很直接：你想在这里成为什么？',
    requires: function() {
      var n = getBranchNode('transfer');
      return n === 'transfer_settle_low' || n === 'transfer_settle_high' || n === 'transfer_settle_old';
    },
    choices: [
      { label: '证明自己', hint: '争取更多球权', apply: function() {
        setBranchNode('transfer', 'transfer_identity_prove', { status: 'prove' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你说：我不是来过渡的，我是来让这里变得更好的。教练没有立刻答应，但训练赛里给了你更多回合。<br><br>效果：媒体好感+1；状态波动+1。';
      }},
      { label: '接受角色', hint: '先站稳，再谈野心', apply: function() {
        setBranchNode('transfer', 'transfer_identity_role', { status: 'role' });
        addProfileDelta('coachTrust', 2);
        return '你说：球队需要我做什么，我就做好什么。教练点头，在新赛季计划里写下了你的名字。<br><br>效果：教练信任+2。';
      }},
      { label: '和教练谈定位', hint: '把话摊开说', apply: function() {
        setBranchNode('transfer', 'transfer_identity_talk', { status: 'talk' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('coachTrust', -1);
        return '你问了上场时间、战术地位和球权分配。教练回答得很坦率，但更衣室很快知道你很在意这些。<br><br>效果：媒体好感+1；教练信任-1。';
      }}
    ]
  },
  {
    id: 'transfer_close',
    branch: 'transfer', phase: 'offseason', slot: 'main', weight: 12,
    title: '转会风波：留下来，还是继续走',
    body: '一个夏天过去，你已经能叫出这座城市大部分球迷的口头禅。经纪人打来电话：下赛季，你想把哪里当作家？',
    requires: function() {
      var n = getBranchNode('transfer');
      return n === 'transfer_identity_prove' || n === 'transfer_identity_role' || n === 'transfer_identity_talk';
    },
    choices: [
      { label: '这里成为家', hint: '长期留队，加深城市羁绊', apply: function() {
        setBranchNode('transfer', 'transfer_close_home', { status: 'home' });
        addProfileDelta('loyalty', 1);
        addProfileDelta('fanSupport', 2);
        return '你在休赛期留在这座城市训练，参加社区的开放日。球迷开始把你的名字和这里连在一起。<br><br>效果：忠诚+1；球迷支持+2。';
      }},
      { label: '继续漂泊', hint: '保持机动，等待更大的舞台', apply: function() {
        setBranchNode('transfer', 'transfer_close_roam', { status: 'roam' });
        addProfileDelta('mediaTrust', 1);
        return '你没有买房，也没有急着表态。经纪人说：这样更自由。你点了点头：自由，也要自己挣。<br><br>效果：媒体好感+1。';
      }},
      { label: '等待争冠窗口', hint: '关注强队的动态', apply: function() {
        setBranchNode('transfer', 'transfer_close_window', { status: 'window' });
        addProfileDelta('businessValue', 1);
        return '你让经纪人盯着几支争冠球队的名单。不是想走，而是想让自己始终出现在名单上。<br><br>效果：商业价值+1。';
      }}
    ]
  },
];

const OFFSEASON_EVENTS = getBranchEventSource().filter(function(ev) {
  return getEventPhases(ev).indexOf('offseason') >= 0;
});

function getPlayoffTrainingLine() {
  var pts = 0;
  var s = STATE.season;
  if (!s || !s.playoffBracket || !s.playoffBracket.results) return 0;
  var myResults = s.playoffBracket.results.filter(function(r) { return r.isMySeries; });
  if (!myResults.length) return 0;
  var last = myResults[myResults.length - 1];
  var userWon = last.teamA === STATE.careerTeam ? last.aWon : !last.aWon;
  if (last.round === 0) return 2;
  if (last.round === 1) return 3;
  if (last.round === 2) return 4;
  if (last.round === 3) return userWon ? 6 : 5;
  return pts;
}

function getPersonalTrainingLine() {
  var s = STATE.season;
  if (!s) return 0;
  var pStats = s.playerStats || {};
  var gp = pStats.games || 1;
  var personalPts = 0;
  if ((pStats.pts || 0) / gp >= 20) personalPts++;
  if ((pStats.reb || 0) / gp >= 5) personalPts++;
  if ((pStats.ast || 0) / gp >= 5) personalPts++;
  var awardLabels = (s.awards || []).map(function(a) { return typeof a === 'string' ? a : (a.label || ''); });
  if (awardLabels.indexOf('全明星') >= 0) personalPts++;
  if (awardLabels.some(function(l) { return l.indexOf('最佳阵容') >= 0; })) personalPts++;
  if (awardLabels.indexOf('MVP') >= 0) personalPts++;
  if (awardLabels.indexOf('DPOY') >= 0) personalPts++;
  if (awardLabels.indexOf('总决赛MVP') >= 0) personalPts++;
  if (awardLabels.indexOf('最佳新秀') >= 0) personalPts++;
  return personalPts;
}

function getAgeTrainingBonus(age) {
  age = Number(age) || 0;
  if (age <= 26) return 10;
  if (age <= 30) return 6;
  if (age <= 34) return 2;
  return 0;
}

function calcTrainingPoints() {
  if (!STATE.season) return 0;
  var age = STATE.career && STATE.career.currentAge;
  return getPlayoffTrainingLine() + getPersonalTrainingLine() + getAgeTrainingBonus(age) + getEventTrainingBank();
}

function renderTrainingCamp() {
  showScreen('screen-training');
  var c = STATE.career;
  var tp = calcTrainingPoints();
  document.getElementById('training-sub').textContent = getCurrentSeasonLabel() + ' 准备就绪 · 年龄 ' + c.currentAge;

  if (!STATE._tpPending) STATE._tpPending = {};
  var pending = STATE._tpPending;
  var used = getPendingTrainingCost(pending);
  var remaining = tp - used;

  var html = '';
  html += '<div class="tp-header">';
  html += '<div class="tp-points">' + used + ' / ' + tp + '</div>';
  html += '<div class="tp-points-label">训练点数</div>';
  html += '</div>';

  var skillPts = 0;
  if (typeof PP_SKILLS !== 'undefined') {
    PP_SKILLS.ensureSkillState();
    skillPts = PP_SKILLS.availableStylePoints();
  }
  html += '<div style="margin:8px 0 10px;padding:9px 11px;background:linear-gradient(120deg,#fffaf2,#fff1e6);border:1.5px solid #ffd2b8;border-radius:10px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">';
  html += '<div style="min-width:0;">';
  html += '<div style="font-size:12px;font-weight:800;color:#2d1f0e;">⚡ 球风点 <span style="color:#ff6b35;font-size:18px;">' + skillPts + '</span></div>';
  html += '</div>';
  html += '<button type="button" class="btn btn-secondary btn-sm" onclick="if(window.PP_FX)PP_FX.openSkillPanel()">技能</button>';
  html += '</div></div>';

  html += '<div class="tp-age-info">⏳ <strong>' + c.currentAge + '岁</strong></div>';
  var annualChanges = c.lastAnnualChanges || [];
  if (annualChanges.length) {
    html += '<details style="margin:7px 0 10px;padding:7px 9px;background:var(--bg-card);border:1px solid var(--border-light);border-radius:8px;">';
    html += '<summary style="cursor:pointer;font-size:11px;font-weight:700;color:var(--text-dim);">本年自然成长与衰退（' + annualChanges.length + '项）</summary>';
    html += '<div style="margin-top:6px;font-size:10px;line-height:1.55;color:var(--text-muted);">' + annualChanges.join(' · ') + '</div></details>';
  }

  html += '<div class="tp-section-title">📈 分配属性点 <span style="font-size:12px;color:var(--text-muted);font-weight:400;">剩余 ' + remaining + ' 点</span></div>';
  html += '<div class="tp-attrs" id="tp-attrs"></div>';

  html += '<div class="tp-actions" style="justify-content:center;">';
  html += '<button class="btn btn-secondary btn-sm" onclick="resetTraining()">🔄 重置</button>';
  html += '<button class="btn btn-primary btn-sm" id="tp-confirm-btn" onclick="confirmTraining()">✅ 确认加点</button>';
  html += '</div>';

  document.getElementById('training-content').innerHTML = html;
  var tpl = calcTrainingPoints();
  renderTrainingAttrs(tpl);
}

var MANUAL_SAVE_KEYS = ['lenf_auto_slot'];
var MANUAL_SAVE_META = {};

function getManualSaveSummary(slot) {
  return MANUAL_SAVE_META[slot] || null;
}

function storageGet(key) {
  return Storage.waitForReady().then(function() {
    return Storage.getValue(key);
  });
}

function storageSet(key, value) {
  return Storage.waitForReady().then(function() {
    var d = {};
    d[key] = value;
    return Storage.setValue(d);
  });
}

function refreshManualSaveMeta() {
  return storageGet(MANUAL_SAVE_KEYS[0]).then(function(raw) {
    if (raw == null || raw === '') {
      MANUAL_SAVE_META[1] = null;
    } else {
      var data = null;
      try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {}
      if (data && (data.c === 1 || data.state)) {
        MANUAL_SAVE_META[1] = { label: data.label || '自动存档', savedAt: data.savedAt || 0 };
      } else {
        MANUAL_SAVE_META[1] = null;
      }
    }
    refreshContinueActivityButton();
    renderMenuSavePanel();
    return MANUAL_SAVE_META[1];
  });
}

function buildManualFingerprint(s) {
  var c = s.career || {};
  var sp = (s.season && s.season.playerStats) || {};
  return {
    seasonCount: c.seasonCount || 0,
    currentAge: c.currentAge || 0,
    finalOVR: s.finalOVR || 0,
    careerTeam: s.careerTeam || '',
    games: sp.games || 0,
    pts: sp.pts || 0,
    wins: (s.season && s.season.wins) || 0,
    honors: (c.honors || []).length
  };
}

function buildManualSaveSnapshot() {
  if (typeof loadPlayerAges === 'function') loadPlayerAges();
  if (!_rngState) rngReset();
  var rawState = JSON.parse(JSON.stringify(STATE));
  if (STATE.season && STATE.season._processedDays instanceof Set) {
    rawState.season._processedDays = Array.from(STATE.season._processedDays);
  }
  return {
    v: 1,
    savedAt: Date.now(),
    label: (STATE.career ? '第' + (STATE.career.seasonCount + 1) + '赛季 · ' + STATE.career.currentAge + '岁' : '未开始'),
    screen: (document.querySelector('.screen.active') || {}).id || '',
    hupuUser: {
      nickname: HUPU_USER.nickname || '',
      avatar: HUPU_USER.avatar || '',
      isLogin: !!HUPU_USER.isLogin,
      source: HUPU_USER.source || ''
    },
    state: rawState,
    league: JSON.parse(JSON.stringify(NBA2K_DATA || {})),
    ages: JSON.parse(JSON.stringify(_playerAges || {})),
    genes: JSON.parse(JSON.stringify(_playerGenes || {})),
    rookieState: {
      starQueue: JSON.parse(JSON.stringify(_starRookieQueue || [])),
      usedCandidateNames: JSON.parse(JSON.stringify(_usedRookieCandidateNames || {})),
      rookieNameSeq: _rookieNameSeq || 0
    },
    rng: JSON.parse(JSON.stringify(_rngState)),
    fingerprint: buildManualFingerprint(STATE)
  };
}

function bytesToB64(bytes) {
  var bin = '';
  var chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBytes(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function compressText(text) {
  var cs = new CompressionStream('deflate');
  var stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(cs);
  return new Response(stream).arrayBuffer().then(function(ab) {
    return bytesToB64(new Uint8Array(ab));
  });
}

function decompressText(b64) {
  var ds = new DecompressionStream('deflate');
  var stream = new Blob([b64ToBytes(b64)]).stream().pipeThrough(ds);
  return new Response(stream).arrayBuffer().then(function(ab) {
    return new TextDecoder().decode(ab);
  });
}

function manualSaveGame(slot) {
  var snap;
  try {
    snap = buildManualSaveSnapshot();
  } catch(e) {
    showManualSaveToast('保存失败：' + e.message);
    return;
  }
  var key = MANUAL_SAVE_KEYS[slot - 1];
  var raw = JSON.stringify(snap);
  function write(rawStr) {
    storageSet(key, rawStr).then(function() {
      var meta = null;
      try { var parsed = JSON.parse(rawStr); meta = { label: parsed.label || '自动存档', savedAt: parsed.savedAt || 0 }; } catch(e) {}
      MANUAL_SAVE_META[slot] = meta;
      renderAfterSaveLoad(snap.screen);
      renderMenuSavePanel();
      showManualSaveToast('已保存到存档' + slot + '（' + snap.label + '）');
    });
  }
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') {
    write(raw);
    return;
  }
  compressText(raw).then(function(compressed) {
    write(JSON.stringify({ c: 1, d: compressed, label: snap.label, savedAt: snap.savedAt }));
  }, function() {
    write(raw);
  });
}

function autoSaveGame() {
  var c = STATE.career;
  if (!c || c.retired) return;
  var snap;
  try {
    snap = buildManualSaveSnapshot();
  } catch(e) {
    return;
  }
  var key = MANUAL_SAVE_KEYS[0];
  var raw = JSON.stringify(snap);
  function write(rawStr) {
    return storageSet(key, rawStr).then(function() {
      var meta = null;
      try { var parsed = JSON.parse(rawStr); meta = { label: parsed.label || '自动存档', savedAt: parsed.savedAt || 0 }; } catch(e) {}
      MANUAL_SAVE_META[1] = meta;
      refreshContinueActivityButton();
    });
  }
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') {
    write(raw);
    return;
  }
  compressText(raw).then(function(compressed) {
    write(JSON.stringify({ c: 1, d: compressed, label: snap.label, savedAt: snap.savedAt }));
  }, function() {
    write(raw);
  });
}

function manualLoadGame(slot) {
  storageGet(MANUAL_SAVE_KEYS[slot - 1]).then(function(raw) {
    if (raw == null || raw === '') {
      showManualSaveToast('暂无自动存档');
      return;
    }
    var data;
    try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) { showManualSaveToast('自动存档损坏'); return; }
    function restoreJson(text) {
      var snap;
      try { snap = JSON.parse(text); } catch(e) { showManualSaveToast('自动存档损坏'); return; }
      if (!snap || !snap.state) { showManualSaveToast('自动存档损坏'); return; }
      try {
        // STATE 与 NBA2K_DATA 是 const，只能原地清空后填充，保证所有引用仍然有效
        Object.keys(STATE).forEach(function(k) { delete STATE[k]; });
        Object.assign(STATE, snap.state);
        if (typeof PP_SKILLS !== 'undefined' && PP_SKILLS.ensureSkillState) PP_SKILLS.ensureSkillState();
        // 旧存档没有模拟广告计数和当前抽取快照时，按新规则补齐默认值。
        if (STATE._mockAdRerollsLeft == null) STATE._mockAdRerollsLeft = 3;
        if (!Array.isArray(STATE._drawPlayers)) STATE._drawPlayers = [];
        if (STATE.season && STATE.season._processedDays && !(STATE.season._processedDays instanceof Set)) {
          STATE.season._processedDays = new Set((Array.isArray(STATE.season._processedDays) ? STATE.season._processedDays : []).map(Number));
        }
        if (snap.league && typeof NBA2K_DATA !== 'undefined') {
          Object.keys(NBA2K_DATA).forEach(function(k) { delete NBA2K_DATA[k]; });
          Object.assign(NBA2K_DATA, snap.league);
        }
        _playerAges = snap.ages || {};
        _playerGenes = snap.genes || {};
        if (snap.rookieState) {
          _starRookieQueue = JSON.parse(JSON.stringify(snap.rookieState.starQueue || []));
          _usedRookieCandidateNames = Object.assign({}, snap.rookieState.usedCandidateNames || {});
          _rookieNameSeq = snap.rookieState.rookieNameSeq || 0;
        }
        _rngState = snap.rng || null;
        if (snap.hupuUser) {
          HUPU_USER.nickname = snap.hupuUser.nickname || HUPU_USER.nickname;
          HUPU_USER.avatar = snap.hupuUser.avatar || HUPU_USER.avatar;
          HUPU_USER.isLogin = !!snap.hupuUser.isLogin;
          HUPU_USER.source = snap.hupuUser.source || HUPU_USER.source;
        }
        ['player-retirement-choice', 'contract-modal', 'contract-retirement-choice', 'legacy-modal', 'offseason-event-modal', 'offseason-result-modal', 'countdown-legacy-modal', 'countdown-legacy-result-modal', 'load-menu-modal'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.remove();
        });
        renderAfterSaveLoad(snap.screen);
        renderMenuSavePanel();
        showManualSaveToast('已恢复上局游戏');
      } catch(e) {
        showManualSaveToast('读档失败：' + e.message);
      }
    }
    if (data && data.c === 1 && typeof data.d === 'string') {
      if (typeof DecompressionStream === 'undefined') {
        showManualSaveToast('当前浏览器不支持压缩存档');
        return;
      }
      MANUAL_SAVE_META[slot] = { label: data.label || '', savedAt: data.savedAt || 0 };
      decompressText(data.d).then(restoreJson, function() {
        showManualSaveToast('自动存档解压失败');
      });
    } else {
      restoreJson(typeof raw === 'string' ? raw : JSON.stringify(raw));
    }
  });
}

function manualClearSave(slot) {
  var key = MANUAL_SAVE_KEYS[slot - 1];
  storageGet(key).then(function(raw) {
    if (raw == null || raw === '') {
      showManualSaveToast('暂无自动存档');
      return;
    }
    storageSet(key, null).then(function() {
      MANUAL_SAVE_META[slot] = null;
      var trainingEl = document.getElementById('screen-training');
      if (trainingEl && trainingEl.classList.contains('active')) renderTrainingCamp();
      else if (document.getElementById('screen-roster-review') && document.getElementById('screen-roster-review').classList.contains('active')) showRosterReview();
      renderMenuSavePanel();
      refreshContinueActivityButton();
      if (document.getElementById('load-menu-modal')) showLoadMenu();
      showManualSaveToast('已清除自动存档');
    });
  });
}

function renderAfterSaveLoad(targetScreen) {
  if (targetScreen === 'screen-roster-review' && typeof showRosterReview === 'function') {
    showRosterReview();
  } else {
    renderTrainingCamp();
  }
}

function showManualSaveToast(msg) {
  var old = document.getElementById('manual-save-toast');
  if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'manual-save-toast';
  el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;background:var(--bg-card);border:2px solid var(--orange);border-radius:12px;padding:10px 18px;font-size:13px;font-weight:600;color:var(--text);box-shadow:0 6px 24px rgba(0,0,0,.25);';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
}

function renderMenuSavePanel() {
  var el = document.getElementById('menu-save-panel');
  if (!el) return;
  var html = '<div style="padding:12px;border:2px solid var(--border);border-radius:10px;background:var(--bg-card);">';
  html += '<div style="font-size:12px;font-weight:700;color:var(--orange);margin-bottom:8px;">💾 读取存档</div>';
  for (var si = 1; si <= 2; si++) {
    var sum = getManualSaveSummary(si);
    html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border-light);">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:700;">存档' + si + '</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (sum ? sum.label + ' · ' + new Date(sum.savedAt).toLocaleString() : '空槽位') + '</div>';
    html += '</div>';
    html += '<button class="btn btn-xs" onclick="manualLoadGame(' + si + ')">读取</button>';
    html += '<button class="btn btn-xs" onclick="manualClearSave(' + si + ')">清除</button>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function hasAutoSave() {
  return !!MANUAL_SAVE_META[1];
}

function refreshContinueActivityButton() {
  var btn = document.getElementById('continue-activity-btn');
  if (!btn) return;
  if (!hasAutoSave()) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  var groups = ['create', 'career', 'story'];
  var ready = window.__PP_groupsReady && window.__PP_groupsReady(groups);
  if (ready) {
    btn.classList.remove('is-waiting');
    btn.textContent = '▶ 继续活动';
    return;
  }
  btn.classList.add('is-waiting');
  btn.textContent = '▶ 加载中…';
  if (typeof window.__PP_ensure === 'function') {
    window.__PP_ensure(groups).then(function () {
      var b = document.getElementById('continue-activity-btn');
      if (!b || b.style.display === 'none') return;
      b.classList.remove('is-waiting');
      b.textContent = '▶ 继续活动';
    });
  }
}

function clearAutoSaveStorage() {
  storageSet(MANUAL_SAVE_KEYS[0], null).then(function() {
    MANUAL_SAVE_META[1] = null;
    refreshContinueActivityButton();
  });
}

function showLoadMenu() {
  var existing = document.getElementById('load-menu-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="load-menu-modal">';
  html += '<div class="team-picker-modal" style="max-width:400px;">';
  html += '<div class="team-picker-header"><span>📂 继续活动</span><button class="team-picker-close" onclick="closeLoadMenu()">✕</button></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">自动存档会在每个休赛期开始新赛季前自动写入</div>';
  for (var si = 1; si <= 1; si++) {
    var sum = getManualSaveSummary(si);
    html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border-light);">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:700;">自动存档</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (sum ? sum.label + ' · ' + new Date(sum.savedAt).toLocaleString() : '暂无自动存档') + '</div>';
    html += '</div>';
    html += '<button class="btn btn-xs" onclick="manualLoadGame(' + si + ')">读取</button>';
    html += '<button class="btn btn-xs" onclick="manualClearSave(' + si + ')">清除</button>';
    html += '</div>';
  }
  html += '<button class="btn btn-secondary btn-sm" style="width:100%;margin-top:10px;" onclick="closeLoadMenu()">返回</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeLoadMenu() {
  var modal = document.getElementById('load-menu-modal');
  if (modal) modal.remove();
}

// ==================== 主页 · 生涯档案馆 ====================
var CAREER_ARCHIVE_KEY = 'perfect_player_career_archive_v1';
var CAREER_ARCHIVE_CACHE = [];
var CAREER_ARCHIVE_READY = null;
var CAREER_ARCHIVE_WRITE_CHAIN = Promise.resolve();

function escapeCareerArchiveHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
  });
}

function normalizeCareerArchiveRecord(record) {
  if (!record || !record.id) return null;
  var out = Object.assign({}, record);
  out.v = 1;
  out.name = out.name || '未命名球员';
  out.stats = out.stats || {};
  out.honors = out.honors || {};
  out.honorDetails = Array.isArray(out.honorDetails) ? out.honorDetails : [];
  out.teams = Array.isArray(out.teams) ? out.teams : [];
  out.score = Number(out.score) || 0;
  out.historicalRank = Number(out.historicalRank) || calculateLegacyHistoricalRank(out.score, !!out.goat);
  out.top100 = out.historicalRank <= 100;
  return out;
}

function sortCareerArchiveRecords(records) {
  return (records || []).slice().sort(function(a, b) {
    return (Number(b.score) || 0) - (Number(a.score) || 0)
      || (Number(a.historicalRank) || 999) - (Number(b.historicalRank) || 999)
      || (Number(b.honors && b.honors.championships) || 0) - (Number(a.honors && a.honors.championships) || 0)
      || (Number(b.honors && b.honors.mvp) || 0) - (Number(a.honors && a.honors.mvp) || 0)
      || (Number(b.stats && b.stats.points) || 0) - (Number(a.stats && a.stats.points) || 0)
      || (Number(a.completedAt) || 0) - (Number(b.completedAt) || 0);
  });
}

function loadCareerArchive(force) {
  if (CAREER_ARCHIVE_READY && !force) return CAREER_ARCHIVE_READY;
  CAREER_ARCHIVE_READY = storageGet(CAREER_ARCHIVE_KEY).then(function(raw) {
    var payload = raw;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch(e) { payload = null; }
    }
    var records = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.records) ? payload.records : []);
    CAREER_ARCHIVE_CACHE = sortCareerArchiveRecords(records.map(normalizeCareerArchiveRecord).filter(Boolean));
    refreshCareerArchiveButton();
    return CAREER_ARCHIVE_CACHE;
  }).catch(function() {
    CAREER_ARCHIVE_CACHE = [];
    refreshCareerArchiveButton();
    return CAREER_ARCHIVE_CACHE;
  });
  return CAREER_ARCHIVE_READY;
}

function refreshCareerArchiveButton() {
  var count = document.getElementById('career-archive-count');
  if (count) count.textContent = String(CAREER_ARCHIVE_CACHE.length || 0);
}

function buildCareerArchiveRecord() {
  var c = STATE.career || {};
  var legacy = ensureLegacyRankingDetails(c.legacy || calculateLegacyResult());
  var ts = c.totalStats || {};
  var games = Number(ts.games) || 0;
  var seasons = c.seasons || [];
  var teams = [];
  seasons.forEach(function(season) {
    if (!season || !season.team || teams.some(function(item) { return item.id === season.team; })) return;
    teams.push({ id:season.team, name:getTeamName(season.team) });
  });
  if (!teams.length && STATE.careerTeam) teams.push({ id:STATE.careerTeam, name:getTeamName(STATE.careerTeam) });
  var honorMap = {};
  var honorSeen = {};
  (c.honors || []).forEach(function(honor) {
    var label = honor && honor.label || '';
    if (!label || isRookieHonorForLaterSeason(honor)) return;
    var uniqueKey = String(honor.seasonNum == null ? '' : honor.seasonNum) + '|' + label;
    if (honorSeen[uniqueKey]) return;
    honorSeen[uniqueKey] = true;
    honorMap[label] = (honorMap[label] || 0) + 1;
  });
  var honorDetails = Object.keys(honorMap).map(function(label) { return { label:label, count:honorMap[label] }; })
    .sort(function(a, b) { return b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'); });
  var draftLabel = c.draft && typeof getDraftPickLabel === 'function' ? getDraftPickLabel(c.draft) : '未记录';
  return normalizeCareerArchiveRecord({
    id: STATE.gameId || generateGameId(),
    completedAt: Date.now(),
    name: typeof getHupuDisplayName === 'function' ? getHupuDisplayName() : '我的球员',
    avatar: typeof getHupuAvatarUrl === 'function' ? getHupuAvatarUrl() : '',
    position: (SIM_CONFIG.POSITIONS && SIM_CONFIG.POSITIONS[STATE.position || STATE.finalPosition]) || STATE.position || STATE.finalPosition || '—',
    ovr: Number(STATE.finalOVR) || 0,
    age: Number(c.currentAge) || 0,
    seasons: seasons.length || Number(legacy.seasonsCount) || 0,
    teams: teams,
    longestTeam: legacy.longestTeam ? getTeamName(legacy.longestTeam) : (teams[0] && teams[0].name || '—'),
    draft: draftLabel,
    stats: {
      games: games,
      points: Number(ts.pts) || 0,
      rebounds: Number(ts.reb) || 0,
      assists: Number(ts.ast) || 0,
      steals: Number(ts.stl) || 0,
      blocks: Number(ts.blk) || 0,
      turnovers: Number(ts.tov) || 0,
      fgm: Number(ts.fgm) || 0,
      fga: Number(ts.fga) || 0,
      threeM: Number(ts.threeM) || 0,
      threeA: Number(ts.threeA) || 0,
      ftm: Number(ts.ftm) || 0,
      fta: Number(ts.fta) || 0
    },
    honors: {
      championships: Number(legacy.championships) || 0,
      mvp: Number(legacy.mvp) || 0,
      fmvp: Number(legacy.fmvp) || 0,
      dpoy: Number(legacy.dpoy) || 0,
      allNBA: Number(legacy.allNBA) || 0,
      allStar: Number(legacy.allStar) || 0,
      hof: !!legacy.hof,
      jerseyTeams: (legacy.jerseyTeams || []).map(function(item) { return getTeamName(item.team); })
    },
    honorDetails: honorDetails,
    score: Number(legacy.score) || 0,
    tier: legacy.tier || '优秀职业球员',
    historicalRank: legacy.historicalRank,
    top100: !!legacy.top100,
    goat: !!legacy.goat
  });
}

function saveCareerArchiveRecord(record) {
  record = normalizeCareerArchiveRecord(record);
  if (!record) return Promise.resolve([]);
  CAREER_ARCHIVE_WRITE_CHAIN = CAREER_ARCHIVE_WRITE_CHAIN.then(function() {
    return loadCareerArchive(true).then(function(records) {
      var existing = records.find(function(item) { return item.id === record.id; });
      if (existing && existing.completedAt) record.completedAt = existing.completedAt;
      var next = records.filter(function(item) { return item.id !== record.id; });
      next.push(record);
      CAREER_ARCHIVE_CACHE = sortCareerArchiveRecords(next);
      return storageSet(CAREER_ARCHIVE_KEY, { v:1, records:CAREER_ARCHIVE_CACHE }).then(function() {
        refreshCareerArchiveButton();
        return CAREER_ARCHIVE_CACHE;
      });
    });
  });
  return CAREER_ARCHIVE_WRITE_CHAIN;
}

function archiveCompletedCareer() {
  if (!STATE.career || !STATE.career.retired || !STATE.career.legacy) return Promise.resolve(null);
  var record;
  try { record = buildCareerArchiveRecord(); } catch(e) { return Promise.resolve(null); }
  return saveCareerArchiveRecord(record);
}

function getCareerArchiveRank(recordId) {
  for (var i = 0; i < CAREER_ARCHIVE_CACHE.length; i++) if (CAREER_ARCHIVE_CACHE[i].id === recordId) return i + 1;
  return 0;
}

function renderCareerArchiveList(records) {
  records = sortCareerArchiveRecords(records || []);
  var championships = records.reduce(function(sum, item) { return sum + (Number(item.honors && item.honors.championships) || 0); }, 0);
  var best = records.length ? records[0] : null;
  var html = '<div class="career-archive-overview"><span><b>' + records.length + '</b>角色</span><span><b>' + championships + '</b>总冠军</span><span><b>' + (best ? best.score : 0) + '</b>最高历史分</span></div>';
  if (!records.length) {
    html += '<div class="career-archive-empty"><span>🏀</span><b>还没有退役角色</b><p>完成一次生涯并进入退役结算后，荣耀与数据会永久记录在这里。</p></div>';
    return html;
  }
  html += '<div class="career-archive-list">';
  records.forEach(function(record, index) {
    var h = record.honors || {};
    var s = record.stats || {};
    var avatar = escapeCareerArchiveHtml(record.avatar || '');
    var id = encodeURIComponent(record.id);
    html += '<button class="career-archive-row" onclick="showCareerArchiveDetail(decodeURIComponent(\'' + id + '\'))">' +
      '<span class="career-archive-user-rank">#' + (index + 1) + '</span>' +
      '<img src="' + avatar + '" alt="' + escapeCareerArchiveHtml(record.name) + '头像">' +
      '<span class="career-archive-row-main"><b>' + escapeCareerArchiveHtml(record.name) + '</b><small>' + escapeCareerArchiveHtml(record.position) + ' · OVR ' + record.ovr + ' · ' + record.seasons + '年</small><em>' + (h.championships || 0) + '冠 · ' + (h.mvp || 0) + 'MVP · ' + Math.round(s.points || 0) + '分</em></span>' +
      '<span class="career-archive-row-score"><b>' + record.score + '</b><small>历史分</small><em>历史第' + record.historicalRank + '名</em></span>' +
      '</button>';
  });
  html += '</div><div class="career-archive-rule">排名顺序：历史分 → 历史名次 → 总冠军 → MVP → 生涯总得分</div>';
  return html;
}

function showCareerArchive() {
  if (!document.getElementById('screen-menu') || !document.getElementById('screen-menu').classList.contains('active')) return;
  var existing = document.getElementById('career-archive-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="career-archive-modal"><div class="team-picker-modal career-archive-modal">' +
    '<div class="team-picker-header"><span>🏛️ 生涯档案馆</span><button class="team-picker-close" onclick="closeCareerArchive()">✕</button></div>' +
    '<div class="career-archive-content"><div class="career-archive-loading">正在读取历代角色…</div></div>' +
    '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  loadCareerArchive(true).then(function(records) {
    var content = document.querySelector('#career-archive-modal .career-archive-content');
    if (content) content.innerHTML = renderCareerArchiveList(records);
  });
}

function showCareerArchiveDetail(recordId) {
  var record = CAREER_ARCHIVE_CACHE.find(function(item) { return item.id === recordId; });
  var content = document.querySelector('#career-archive-modal .career-archive-content');
  if (!record || !content) return;
  var s = record.stats || {};
  var h = record.honors || {};
  var games = Math.max(1, Number(s.games) || 0);
  function avg(value) { return ((Number(value) || 0) / games).toFixed(1); }
  function pct(made, attempted) { return attempted ? ((made / attempted) * 100).toFixed(1) + '%' : '—'; }
  var honors = [
    ['总冠军',h.championships || 0],['常规赛MVP',h.mvp || 0],['总决赛MVP',h.fmvp || 0],
    ['DPOY',h.dpoy || 0],['最佳阵容',h.allNBA || 0],['全明星',h.allStar || 0]
  ];
  var honorDetails = record.honorDetails.length ? record.honorDetails.map(function(item) { return '<span>' + escapeCareerArchiveHtml(item.label) + (item.count > 1 ? ' ×' + item.count : '') + '</span>'; }).join('') : '<span>无联盟奖项记录</span>';
  content.innerHTML = '<button class="career-archive-back" onclick="showCareerArchiveListView()">← 返回角色排名</button>' +
    '<div class="career-archive-detail-hero"><span class="career-archive-detail-rank">#' + getCareerArchiveRank(record.id) + '</span><img src="' + escapeCareerArchiveHtml(record.avatar || '') + '" alt="角色头像"><div><b>' + escapeCareerArchiveHtml(record.name) + '</b><small>' + escapeCareerArchiveHtml(record.position) + ' · OVR ' + record.ovr + ' · ' + record.seasons + '年生涯</small><em>' + escapeCareerArchiveHtml(record.teams.map(function(team) { return team.name; }).join(' → ') || record.longestTeam) + '</em></div><strong>' + record.score + '<small>历史分</small></strong></div>' +
    '<div class="career-archive-legacy"><span><small>历史地位</small><b>' + escapeCareerArchiveHtml(record.tier) + '</b></span><span><small>历史排名</small><b>第' + record.historicalRank + '名</b></span><span><small>百大结果</small><b>' + (record.top100 ? '正式入选' : '候选区') + '</b></span></div>' +
    '<div class="career-archive-section-title">荣耀</div><div class="career-archive-honor-grid">' + honors.map(function(item) { return '<span><b>' + item[1] + '</b><small>' + item[0] + '</small></span>'; }).join('') + '</div>' +
    '<div class="career-archive-honor-details">' + honorDetails + '</div>' +
    '<div class="career-archive-section-title">生涯数据</div><div class="career-archive-stat-grid">' +
      '<span><b>' + (s.games || 0) + '</b><small>场次</small></span><span><b>' + Math.round(s.points || 0) + '</b><small>总得分</small></span><span><b>' + Math.round(s.rebounds || 0) + '</b><small>总篮板</small></span><span><b>' + Math.round(s.assists || 0) + '</b><small>总助攻</small></span>' +
      '<span><b>' + avg(s.points) + '</b><small>场均得分</small></span><span><b>' + avg(s.rebounds) + '</b><small>场均篮板</small></span><span><b>' + avg(s.assists) + '</b><small>场均助攻</small></span><span><b>' + avg(s.steals) + '</b><small>场均抢断</small></span>' +
      '<span><b>' + avg(s.blocks) + '</b><small>场均盖帽</small></span><span><b>' + pct(s.fgm,s.fga) + '</b><small>投篮命中率</small></span><span><b>' + pct(s.threeM,s.threeA) + '</b><small>三分命中率</small></span><span><b>' + pct(s.ftm,s.fta) + '</b><small>罚球命中率</small></span></div>' +
    '<div class="career-archive-meta"><span>选秀：' + escapeCareerArchiveHtml(record.draft) + '</span><span>代表球队：' + escapeCareerArchiveHtml(record.longestTeam) + '</span><span>名人堂：' + (h.hof ? '入选' : '未入选') + '</span><span>退役球衣：' + escapeCareerArchiveHtml((h.jerseyTeams || []).join('、') || '无') + '</span></div>';
}

function showCareerArchiveListView() {
  var content = document.querySelector('#career-archive-modal .career-archive-content');
  if (content) content.innerHTML = renderCareerArchiveList(CAREER_ARCHIVE_CACHE);
}

function closeCareerArchive() {
  var modal = document.getElementById('career-archive-modal');
  if (modal) modal.remove();
}

setTimeout(function() {
  refreshManualSaveMeta().then(function() {
    renderMenuSavePanel();
    refreshContinueActivityButton();
  });
  loadCareerArchive(false);
}, 600);

function calcTrainingBreakdown() {
  var playoff = getPlayoffTrainingLine();
  var personal = getPersonalTrainingLine();
  var age = STATE.career && STATE.career.currentAge;
  var ageBonus = getAgeTrainingBonus(age);
  var s = STATE.season || {};
  var parts = [];

  var playoffLabel = '未进季后赛';
  if (s.playoffBracket && s.playoffBracket.results) {
    var myResults = s.playoffBracket.results.filter(function(r) { return r.isMySeries; });
    if (myResults.length) {
      var last = myResults[myResults.length - 1];
      var rn = ['首轮','分区半决赛','分区决赛','总决赛'][last.round] || '';
      var userWon = last.teamA === STATE.careerTeam ? last.aWon : !last.aWon;
      if (last.round === 3) playoffLabel = userWon ? '总冠军' : '总决赛';
      else playoffLabel = rn;
    }
  }
  parts.push('季后赛线 ' + playoff + '（' + playoffLabel + '）');
  parts.push('个人线 ' + personal);
  parts.push('年龄补偿 +' + ageBonus + '（' + (age || '?') + '岁）');
  var eventBank = getEventTrainingBank();
  if (eventBank) parts.push('事件加练 +' + eventBank);
  return parts.join(' + ');
}

function getAgeInfo(age) {
  if (age <= 25) return { desc:'成长阶段 — 技术与终结仍有提升空间', penalty:'部分属性随机成长 0~1 点' };
  if (age <= 30) return { desc:'巅峰阶段 — 小幅状态波动', penalty:'少量属性可能 ±1 点' };
  if (age <= 33) return { desc:'转型阶段 — 年龄与当前属性开始共同判定回落', penalty:'身体属性优先衰退，高位属性压力更大' };
  if (age <= 36) return { desc:'老将阶段 — 身体项稳定回落，技术项也可能下降', penalty:'保养仅有概率减免 1 点，不再完全抵消衰退' };
  if (age <= 39) return { desc:'高龄阶段 — 年龄与属性双重压力明显增强', penalty:'身体项每年回落约 2~4 点，技术项约 1~3 点' };
  return { desc:'生涯末期 — 最多可坚持到 42 岁赛季', penalty:'高位属性回落更快，保养只能缓冲、不能逆转年龄' };
}

function renderTrainingAttrs(tp) {
  var pending = STATE._tpPending || {};
  var attrsEl = document.getElementById('tp-attrs');
  if (!attrsEl) return;
  var html = '';
  var used = getPendingTrainingCost(pending);
  var remaining = tp - used;

  ATTR_KEYS.forEach(function(k) {
    var cur = STATE.attrs[k] || 50;
    var added = pending[k] || 0;
    var after = cur + added;
    var maxAdd = getMaxAdd(added, tp, cur);
    var pct = Math.min(100, cur);
    var addPct = after > cur ? Math.min(100, after) - pct : 0;
    var curGrade = getGrade ? getGrade(cur).letter : '';
    var afterGrade = getGrade ? getGrade(after).letter : '';
    var gradeChanged = curGrade !== afterGrade ? '<span style="color:var(--gold);font-weight:700;">' + curGrade + '→' + afterGrade + '</span>' : curGrade;
    var cost = getPointCost(cur + added);
    var disabled = added >= 8 || remaining < cost || cur >= 99;
    var costLabel = cost > 1 ? ' (×' + cost + ')' : '';
    var btnLabel = remaining >= cost && after < 99 ? '+' : '';

    html += '<div class="tp-row' + (added > 0 ? ' tp-added' : '') + '">';
    html += '<span class="tp-label">' + attrCN(k) + '</span>';
    html += '<div class="tp-bar-wrap"><div class="tp-bar-fill" style="width:' + pct + '%"></div>' + (addPct > 0 ? '<div class="tp-bar-add" style="width:' + addPct + '%;left:' + pct + '%"></div>' : '') + '</div>';
    html += '<span class="tp-val' + (added > 0 ? ' tp-preview' : '') + '">' + cur + (added > 0 ? '→' + after : '') + '</span>';
    html += '<span class="tp-grade">' + gradeChanged + '</span>';
    if (btnLabel) {
      html += '<button class="tp-btn" id="tp-btn-' + k + '" ' + (disabled ? 'disabled' : '') + ' onclick="addTrainingPoint(\'' + k + '\')">+</button>';
    } else {
      html += '<button class="tp-btn" disabled>-</button>';
    }
    if (costLabel) html += '<span style="font-size:9px;color:var(--text-muted);min-width:22px;">' + costLabel + '</span>';
    html += '</div>';
  });
  attrsEl.innerHTML = html;
}

function getPointCost(val) {
  // 收益递减：高属性每提升 1 点都应消耗真实预算，而不是只在按钮旁显示倍率。
  if (val >= 98) return 7;
  if (val >= 95) return 5;
  if (val >= 90) return 3;
  if (val >= 85) return 2;
  return 1;
}

function getPendingTrainingCost(pending) {
  pending = pending || STATE._tpPending || {};
  var used = 0;
  ATTR_KEYS.forEach(function(key) {
    var added = Math.max(0, Number(pending[key]) || 0);
    var base = Number(STATE.attrs[key]) || 50;
    for (var i = 0; i < added; i++) used += getPointCost(base + i);
  });
  return used;
}

function getMaxAdd(alreadyAdded, totalPoints, curVal) {
  var remaining = totalPoints - getPendingTrainingCost(STATE._tpPending || {});
  if (remaining <= 0) return 0;
  var possible = 0;
  var value = curVal + alreadyAdded;
  while (possible + alreadyAdded < 8 && value < 99) {
    var cost = getPointCost(value);
    if (remaining < cost) break;
    remaining -= cost;
    possible++;
    value++;
  }
  return possible;
}

function addTrainingPoint(key) {
  if (!STATE._tpPending) STATE._tpPending = {};
  var added = STATE._tpPending[key] || 0;
  var cur = STATE.attrs[key] || 50;
  if (added >= 8) return;
  var tp = calcTrainingPoints();
  var used = getPendingTrainingCost(STATE._tpPending);
  var remaining = tp - used;
  var cost = getPointCost(cur + added);
  if (remaining < cost || cur + added >= 99) return;
  STATE._tpPending[key] = (STATE._tpPending[key] || 0) + 1;
  renderTrainingCamp();
}

function resetTraining() {
  STATE._tpPending = {};
  renderTrainingCamp();
}

function confirmTraining() {
  var pending = STATE._tpPending || {};
  var skillSnap = (typeof PP_SKILLS !== 'undefined') ? PP_SKILLS.snapshotEffectiveLevels() : {};
  for (var k in pending) {
    if (pending.hasOwnProperty(k)) STATE.attrs[k] = (STATE.attrs[k] || 50) + pending[k];
  }
  STATE.finalOVR = calcOVR(STATE.attrs);
  if (typeof PP_SKILLS !== 'undefined' && STATE.career) {
    var skillNotes = PP_SKILLS.skillLevelChangeNotes(skillSnap);
    if (skillNotes.length) {
      STATE.career.lastAnnualChanges = (STATE.career.lastAnnualChanges || []).concat(skillNotes);
      if (typeof PP_FX !== 'undefined' && PP_FX.toast) {
        PP_FX.toast(skillNotes.join(' · '), { gold: true, icon: '⚡', duration: 3200 });
      }
    }
  }

  // 合同扣减
  STATE.career.contract--;

  // 如果生涯还没保存（赛季结束未进生涯页面），这里补保存
  saveCurrentSeasonToCareer();

  STATE.career.currentAge++;
  STATE._tpPending = {};
  consumeEventTrainingBank();

  if (shouldOfferPlayerRetirement()) {
    STATE._retirementOfferPhase = 'post-training';
    showPlayerRetirementChoice();
    return;
  }

  continueCareerAfterTraining();
}

function continueCareerAfterTraining() {
  if (STATE.career && STATE.career.retired) return;
  evolveLeague();
  saveStandings();
  processDraft();
  assignFreeAgents();
  processTrades();
  maybeMoveUserInOffseason(finishOffseasonPipeline);
}

function finishOffseasonPipeline() {
  if (STATE.career && STATE.career.retired) {
    showCareerStats(1);
    return;
  }
  resetForNewSeason();

  // 跳转到阵容预览
  html('gamecast-area').innerHTML = '';
  html('game-list').innerHTML = '';

  // 先展示「转会里总评最高的最多20笔」，再进合同/阵容
  showOffSeasonModals(function () {
    if (STATE.career.contract <= 0) showContractOffers();
    else showRosterReview();
  });
}

function averageCareerAttributes(attrs, keys, fallback) {
  attrs = attrs || {};
  var values = keys.map(function(key) { return Number(attrs[key]); }).filter(function(value) { return isFinite(value); });
  if (!values.length) return Number(fallback) || 70;
  return values.reduce(function(sum, value) { return sum + value; }, 0) / values.length;
}

function getPlayerLongevityProfile(attrs, ovr, context) {
  attrs = attrs || {};
  ovr = Number(ovr) || 70;
  context = context || {};
  var physical = averageCareerAttributes(attrs, ['ATH', 'STR', 'FIN', 'DNK', 'REB'], ovr);
  var skill = averageCareerAttributes(attrs, ['threePT', 'MID', 'HAN', 'PAS', 'CLU'], ovr);
  var defense = averageCareerAttributes(attrs, ['PDEF', 'IDEF', 'BLK'], ovr);
  var staminaLoad = Math.max(0, Number(context.staminaLoad) || 0);
  var injuryRisk = Math.max(0, Number(context.injuryRiskBonus) || 0);
  var injuryPenalty = context.majorInjuryThisSeason ? 4 : 0;
  var score = ovr * 0.45 + physical * 0.27 + skill * 0.18 + defense * 0.10;
  score -= staminaLoad * 1.4 + injuryRisk * 1.6 + injuryPenalty;
  return {
    score: Math.max(25, Math.min(99, Math.round(score * 10) / 10)),
    physical: Math.round(physical * 10) / 10,
    skill: Math.round(skill * 10) / 10,
    defense: Math.round(defense * 10) / 10
  };
}

function getPlayerRetirementRisk(age, attrs, ovr, context) {
  age = Number(age) || 22;
  if (age > PLAYER_CAREER_MAX_AGE) return 1;
  if (age < 35) return 0;
  var baseByAge = { 35:0.03, 36:0.06, 37:0.11, 38:0.18, 39:0.28, 40:0.40, 41:0.55, 42:0.72 };
  var base = baseByAge[age] == null ? 0.03 : baseByAge[age];
  var profile = getPlayerLongevityProfile(attrs, ovr, context);
  var risk = base + (80 - profile.score) * 0.012;
  var tendency = STATE.career && STATE.career.flags && STATE.career.flags.familyRetireTendency;
  if (tendency === 'retire') risk += 0.08;
  else if (tendency === 'play') risk -= 0.04;
  var floor = age >= 40 ? 0.12 : 0.01;
  var ceiling = age >= 42 ? 0.96 : 0.88;
  return Math.max(floor, Math.min(ceiling, risk));
}

function getCurrentPlayerLongevityContext() {
  var mods = typeof getNextSeasonMods === 'function' ? getNextSeasonMods() : {};
  var events = STATE.season && STATE.season.events || {};
  return {
    staminaLoad: Number(mods.staminaLoad) || 0,
    injuryRiskBonus: (Number(mods.injuryRiskBonus) || 0) + (Number(events.injuryRiskBonus) || 0),
    majorInjuryThisSeason: !!events.majorInjuryThisSeason
  };
}

function shouldOfferPlayerRetirement(randomFn) {
  var c = STATE.career || {};
  var age = c.currentAge || 22;
  if (c.retired) return false;
  if (c.flags && c.flags.countdownDone) return true;
  if (age > PLAYER_CAREER_MAX_AGE) return true;
  var risk = getPlayerRetirementRisk(age, STATE.attrs, STATE.finalOVR, getCurrentPlayerLongevityContext());
  var rng = typeof randomFn === 'function' ? randomFn : Math.random;
  return rng() < risk;
}

function showPlayerRetirementChoice() {
  var c = STATE.career || {};
  var age = c.currentAge || 22;
  var canPlayMore = age <= PLAYER_CAREER_MAX_AGE;
  var longevity = getPlayerLongevityProfile(STATE.attrs, STATE.finalOVR, getCurrentPlayerLongevityContext());
  var riskPct = Math.round(getPlayerRetirementRisk(age, STATE.attrs, STATE.finalOVR, getCurrentPlayerLongevityContext()) * 100);
  var html = '<div class="team-picker-overlay" id="player-retirement-choice">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>职业生涯节点</span></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px;">是否宣布退役？</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:8px;">' + age + '岁，OVR ' + (STATE.finalOVR || 0) + '。' + (canPlayMore ? '年龄和当前能力共同触发了生涯节点；你仍可继续战斗，最晚打完 42 岁赛季。' : '你已经完成 42 岁赛季，这是职业生涯的硬性终点。') + '</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);line-height:1.55;margin-bottom:14px;">续航评分 ' + longevity.score + ' · 年龄退役风险 ' + riskPct + '% · 身体 ' + longevity.physical + ' / 技术 ' + longevity.skill + '</div>';
  html += '<button class="btn btn-primary btn-sm" style="width:100%;margin-bottom:8px;" onclick="announcePlayerRetirement()">宣布退役</button>';
  if (canPlayMore) {
    html += '<button class="btn btn-secondary btn-sm" style="width:100%;" onclick="playOneMoreSeason()">继续战斗</button>';
  } else {
    html += '<div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:4px;">联盟与球队已确认，这是生涯终点。</div>';
  }
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function playOneMoreSeason() {
  var modal = document.getElementById('player-retirement-choice');
  if (modal) modal.remove();
  STATE.career.flags = STATE.career.flags || {};
  if ((STATE.career.currentAge || 22) > PLAYER_CAREER_MAX_AGE) {
    announcePlayerRetirement();
    return;
  }
  var offerPhase = STATE._retirementOfferPhase || 'post-training';
  STATE.career.flags.retirementDeferrals = (STATE.career.flags.retirementDeferrals || 0) + 1;
  STATE.career.flags.lastRetirementDeferralAge = STATE.career.currentAge || 22;
  delete STATE.career.flags.playOneMore; // 兼容并清理旧版“一次续命后强制退役”标记
  delete STATE.career.flags.countdownDone;
  if (offerPhase === 'pre-training' && getBranchNode('retirement_countdown') !== 'start') {
    setBranchNode('retirement_countdown', 'postponed', { status:'postponed', deferredAtAge:STATE.career.currentAge || 22 });
    STATE.career.flags.countdownPostponed = true;
  }
  STATE._retirementOfferPhase = null;
  if (offerPhase === 'pre-training') beginOffseason();
  else continueCareerAfterTraining();
}

function announcePlayerRetirement() {
  ['player-retirement-choice', 'contract-retirement-choice', 'contract-modal', 'legacy-modal'].forEach(function(id) {
    var modal = document.getElementById(id);
    if (modal) modal.remove();
  });
  var c = STATE.career;
  if (!c) return;
  STATE._retirementOfferPhase = null;
  c.flags = c.flags || {};
  c.flags.retiredFromContractChoice = true;
  c.flags.postCareerDeferred = false;
  c.contract = 0;
  saveCurrentSeasonToCareer();
  c.retired = true;
  c.legacy = calculateLegacyResult();
  archiveCompletedCareer();
  clearAutoSaveStorage();
  showLegacyModal(0);
}

// ── 退役球衣：30 队专属文案 ──
var JERSEY_TEAM_COPY = {
  "ATL": [
    "亚特兰大的夏天很慢，慢到整座城愿意等你成长。{achievement}。你在老鹰的 {years} 年，让州立农场球馆的灯光更像家。那件球衣升上去的时候，佐治亚的晚风替全城说了一声谢谢。",
    "亚特兰大的嘻哈与篮球共用一套节奏，你踩准了它。{achievement}。你在老鹰的 {years} 年，让整座城的欢呼有了节拍。球衣升上屋顶时，ATL把最好的鼓点留给你。",
    "老鹰的球迷见过人来人往，却记得住每个认真的人。{achievement}。你在亚特兰大的 {years} 年，从不敷衍任何一个主场夜晚。球衣升上去时，看台上的人没有喊口号，只是把掌声拍得比任何时候都长。",
    "亚特兰大把桃州的热度写进篮球，你把它穿成了自己的底色。{achievement}。你在老鹰的 {years} 年，让州立农场球馆的每一次反击都像夏天的雷雨。球衣升上屋顶，整座城都记得那种痛快。",
    "老鹰的翅膀在这座城市张开过很多次，你让它们飞得最远。{achievement}。你在亚特兰大的 {years} 年，把天赋变成纪律，把欢呼变成习惯。球衣升上去时，看台上有人举着你的号码，很久没有放下。",
    "亚特兰大的球迷不常把话说满，但他们用行动投票。{achievement}。你在老鹰的 {years} 年，每一场都来，每一场都喊。球衣升上屋顶那天，他们比谁都早到，比谁都晚走。",
    "州立农场球馆的灯光记得你的每一次起跳。{achievement}。你在亚特兰大的 {years} 年，让这支球队的节奏有了自己的名字。球衣升上去时，DJ 没有再放音乐，全场用掌声打了一整拍。",
    "老鹰把一件球衣升上屋顶，像把一段夏天的记忆挂进永恒。{achievement}。你在亚特兰大的 {years} 年，让很多孩子第一次觉得，篮球可以这么自由。从今以后，他们看球衣时，都会想起你。",
  ],
  "BKN": [
    "布鲁克林的街头从不轻易服人，他们只认真本事。{achievement}。你在篮网的 {years} 年，让巴克莱中心的每个夜晚都像街区球场的荣耀。球衣升起时，整座布鲁克林都认下了这个名字。",
    "布鲁克林把坚韧写在地铁和桥墩上，也写进了你的球衣。{achievement}。你在篮网的 {years} 年，让这座城相信外来的球员也可以成为自己人。那件球衣升上去时，整座城都在为它让路。",
    "巴克莱中心的灯亮起来时，布鲁克林从不吝啬掌声。{achievement}。你在篮网的 {years} 年，把每一个客场都打成了回家的理由。球衣升上屋顶，街道上的孩子从此多了一个可以指着的名字。",
    "布鲁克林的地铁每天载着无数人穿过大桥，你让其中一节车厢永远记得你的名字。{achievement}。你在篮网的 {years} 年，把街头篮球的狠劲带进了职业球场。球衣升上去时，整座城都像完成了一次交接。",
    "篮网的蓝色是布鲁克林的底色，你把它穿成了自己的性格。{achievement}。你在篮网的 {years} 年，让巴克莱中心在季后赛的夜晚像街区球场一样沸腾。球衣升上屋顶，那些声音还在墙上回荡。",
    "布鲁克林见过太多传奇诞生，也见过太多人离开，但你不一样。{achievement}。你在篮网的 {years} 年，把这里当成了家，这里也把你当成了自己人。球衣升上去那天，整座城都没有把你当成过客。",
    "巴克莱中心的更衣室里，你的柜子被贴满了球迷的留言。{achievement}。你在布鲁克林的 {years} 年，让每一个主场夜都值得纪念。球衣升上屋顶时，工作人员把那面墙留了很久，才舍得拆。",
    "布鲁克林喜欢硬气的人，你刚好是。{achievement}。你在篮网的 {years} 年，从不挑对手，也从不让步。球衣升上去时，整座城用最响的呼喊告诉你：你是这座桥的一部分。",
  ],
  "BOS": [
    "北岸花园的十七面冠军旗帜看着你。你在这支拥有漫长历史的球队打了 {years} 年，让绿色重新滚烫。{achievement}。波士顿把一件球衣升上房梁，像把一页新的历史写进旧书。",
    "波士顿是篮球的老图书馆，每一面旗都是一页历史。{achievement}。你在凯尔特人的 {years} 年，没有让绿色蒙尘。球衣升上去时，老球迷放下手里的啤酒，站起来把掌声送给了新的一页。",
    "北岸花园的木头地板还记得你的脚步。{achievement}。你在凯尔特人的 {years} 年，让这里最挑剔的球迷也愿意为你大声。球衣升上屋顶那天，整座城像过节，又像送别老朋友。",
    "绿军的历史很重，重到不是每个人都能扛起来。{achievement}。你在波士顿的 {years} 年，把这份重量变成了自己的底气。球衣升上去时，十七面旗帜都微微让了让位置。",
    "波士顿人很少把话说完，他们把敬意放在行动里。{achievement}。你在凯尔特人的 {years} 年，让这座城愿意把最珍贵的位置留给你。球衣升上房梁，看台上有人鼓掌，有人低头擦眼睛。",
    "北岸花园的屋顶从来不缺旗帜，缺的是配得上它们的人。{achievement}。你在波士顿的 {years} 年，用每一次卡位、每一次传导，证明了自己就是那一个。球衣升上去时，绿军的老球迷们互相看了看，点了点头。",
    "波士顿的冬天很冷，但篮球让这里一直滚烫。{achievement}。你在凯尔特人的 {years} 年，让那些寒风里的夜晚有了盼头。球衣升上屋顶那天，连查尔斯河的风都慢了下来。",
    "凯尔特人的绿色是一种传承，你接住了它，又交给了下一棒。{achievement}。你在波士顿的 {years} 年，没有辜负那件球衣的重量。今天它升上屋顶，和传奇们挂在一起，没有人觉得你陌生。",
  ],
  "CHA": [
    "夏洛特把自己叫做皇后城，却愿意为你放下身段。{achievement}。你在黄蜂的 {years} 年里，让蜂巢球馆响起过最响的欢呼。那件球衣升上屋顶时，整座城都在用同一种方式说：你是我们的。",
    "黄蜂的蓝色属于夏洛特的夜晚，也属于你的汗水。{achievement}。你在黄蜂的 {years} 年，让这支年轻的球队有了可以回望的过去。球衣升上去时，蜂巢球馆的灯第一次为一个人全亮。",
    "夏洛特不大，所以这里记住一个人不需要太久。{achievement}。你在黄蜂的 {years} 年，让每个主场都像街区聚会。球衣升上屋顶，皇后城把最体面的座位留给了你。",
    "蜂巢球馆的嗡嗡声，是夏洛特最熟悉的背景音。{achievement}。你在黄蜂的 {years} 年，让那声音变得比任何时候都响。球衣升上去时，整座城都安静了一瞬，然后用最长的欢呼把你接住。",
    "黄蜂的蓝与紫，像夏洛特傍晚的天空。{achievement}。你在黄蜂的 {years} 年，让每一个主场夜都变成值得纪念的黄昏。球衣升上屋顶，皇后城的灯一盏一盏亮起来，像在为你送行。",
    "夏洛特人记得每一个认真生活的人。{achievement}。你在黄蜂的 {years} 年，把篮球打成了这座城市的一部分。球衣升上去时，看台上有人举着你的号码，从第一排一直传到最后一排。",
    "黄蜂的队史不算长，但你让它的第一页写得很有分量。{achievement}。你在夏洛特的 {years} 年，让年轻球迷有了可以骄傲说起的前辈。球衣升上屋顶，整座城都愿意把这段历史认下来。",
    "夏洛特的夏天闷热，球馆里的汗水替这座城市记得你。{achievement}。你在黄蜂的 {years} 年，把每一个主场都打得像街区荣誉战。球衣升上去时，皇后城用最朴素的掌声，送自己的家人上屋顶。",
  ],
  "CHI": [
    "芝加哥的风很急，联合中心的屋顶见过太多传奇。{achievement}。你在公牛的 {years} 年，让红色再次成为风城的信仰。球衣升空那天，密歇根湖的波浪都安静了一瞬。",
    "芝加哥把篮球当硬汉的信仰，把忠诚当城市的规矩。{achievement}。你在公牛的 {years} 年，让联合中心的屋顶多了一件值得仰望的红色。球衣升上去时，风城的风都慢了下来。",
    "公牛的历史里写满了巨人的名字，你没有躲开那份比较。{achievement}。你在芝加哥的 {years} 年，把压力和欢呼都照单全收。球衣升上屋顶，风城球迷用最响的嗓音把敬意还给了你。",
    "联合中心的门前人来人往，芝加哥只给真正留下痕迹的人立传。{achievement}。你在公牛的 {years} 年，让红色有了新的故事。球衣升上去那天，密歇根大道两侧都亮起了属于你的灯。",
    "芝加哥人爱得直接，恨得也直接，但从不假装。{achievement}。你在公牛的 {years} 年，用每一个夜晚赢得了这种直接的爱。球衣升上屋顶，整座城都在风里喊你的名字。",
    "公牛的红，是芝加哥工装裤上的油渍色，也是联合中心顶上的信仰色。{achievement}。你在公牛的 {years} 年，把这两种颜色穿成了同一种骄傲。球衣升上去时，连风都停了一会儿。",
    "芝加哥的冬天能把人冻透，但篮球让这里始终热血。{achievement}。你在公牛的 {years} 年，让无数个寒风夜有了值得走进球馆的理由。球衣升上屋顶那天，密歇根湖的冰都在反射你的红色。",
    "公牛的老球迷会记得每一个为红色拼过命的人。{achievement}。你在芝加哥的 {years} 年，让联合中心的屋顶多了一段可以讲给孙子听的故事。球衣升上去时，那些老球迷没有喊，只是举起了手里的啤酒。",
  ],
  "CLE": [
    "克里夫兰的人知道等待是什么滋味，所以他们格外珍惜自己人。{achievement}。你在骑士的 {years} 年，让伊利湖畔的失望变成过庆祝。那件球衣升上球馆上空时，整座城都记得你替他们赢回过夏天。",
    "骑士的红色是克里夫兰的倔强，你把它穿成了承诺。{achievement}。你在骑士的 {years} 年，让这座城重新相信奇迹会降临。球衣升上去时，伊利湖的风都带着咸味，像眼泪，也像欢呼。",
    "克里夫兰不擅长告别，因为你从来不是过客。{achievement}。你在骑士的 {years} 年，把最重的夜晚扛在肩上。球衣升上屋顶，整座城没有说再见，只说谢谢。",
    "伊利湖的水见证了这座城市的起落，也见证了你的坚持。{achievement}。你在克里夫兰的 {years} 年，让骑士的红色在每个主场上空重新飘起来。球衣升上去那天，湖边的风把好消息带到了每一扇窗前。",
    "克里夫兰人把所有情绪都写在脸上，你也是。{achievement}。你在骑士的 {years} 年，赢了一起喊，输了一起扛。球衣升上屋顶时，看台上没有一个人提前走，连平时最着急回家的人都在等灯亮起来。",
    "骑士的球馆里有一面墙，专门留给这座城的英雄。{achievement}。你在克里夫兰的 {years} 年，让那面墙多了一行字。球衣升上去时，连保安都抬头看了很久，像在看一段属于全城的记忆。",
    "克里夫兰的冬天很长，长到人们格外珍惜每一场胜利。{achievement}。你在骑士的 {years} 年，让那些漫长冬天有了可以期待的夜晚。球衣升上屋顶，整座城像终于等到一件好事一样，慢慢笑了。",
    "骑士把一件球衣升上屋顶，像把一段承诺挂进天空。{achievement}。你在克里夫兰的 {years} 年，让这座城相信，等待不是白费的。从今以后，抬头就能看见那件球衣，也就能想起你。",
  ],
  "DAL": [
    "达拉斯的天空开阔，德州人记得每一个守信的人。{achievement}。你在独行侠的 {years} 年，让美航中心的欢呼有了德州的厚度。球衣升上去时，整座城市都没有催你离开。",
    "达拉斯尊重孤独的英雄，也尊重沉默的坚持。{achievement}。你在独行侠的 {years} 年，让这支球队相信一个人也能撑起一座城。球衣升上屋顶，德州的风替你捎来全城的话：值得。",
    "美航中心的灯光见过你从青涩到沉稳。{achievement}。你在独行侠的 {years} 年，把达拉斯的夜晚过成了家的样子。球衣升上去那天，整座城都愿意停下来，等你把故事讲完。",
    "达拉斯的牛仔精神是独来独往，也是说到做到。{achievement}。你在独行侠的 {years} 年，把这两种劲头都打进了比赛。球衣升上屋顶，德州人用最朴素的方式点头：你算一个。",
    "美航中心的地板很亮，亮到能照见你每一次咬牙防守的样子。{achievement}。你在达拉斯的 {years} 年，让这座城市相信，沉默的人也可以打出最响的比赛。球衣升上去时，整座城都在替你鼓掌。",
    "达拉斯人见惯了石油、牛仔和辽阔的公路，他们知道什么叫走远路。{achievement}。你在独行侠的 {years} 年，走的就是那条远路。球衣升上屋顶，德州的风把它送到很远，远到每一个球迷都能看见。",
    "独行侠的蓝色像达拉斯黄昏后的天空，安静但辽阔。{achievement}。你在达拉斯的 {years} 年，让美航中心的每个夜晚都像一部德州电影。球衣升上去那天，电影落幕，观众却都没有走。",
    "达拉斯把一件球衣升上屋顶，像把一颗钉子钉进历史。{achievement}。你在独行侠的 {years} 年，让这支球队的名字多了一个可以反复提起的章节。从今以后，每一个走进美航中心的人，都会先抬头。",
  ],
  "DEN": [
    "丹佛的海拔很高，高到这里的球迷见过最纯粹的篮球。{achievement}。你在掘金的 {years} 年里，让高原的夜晚因为胜利而温暖。球衣升上球馆上空时，落基山的雪线都在发亮。",
    "掘金的文化是从泥土里长出来的，不华丽，但结实。{achievement}。你在丹佛的 {years} 年，把自己活成了这座城喜欢的样子。球衣升上屋顶，整座高原都为你安静了一瞬。",
    "丹佛人不多话，他们把喜欢放在每一声防守呐喊里。{achievement}。你在掘金的 {years} 年，让百事中心的夜夜都像主场节庆。球衣升上去时，整座城用最长久的掌声送你。",
    "落基山的雪化了又积，丹佛的篮球却因为你不曾冷却。{achievement}。你在掘金的 {years} 年，让高原球迷在每一个深夜里都有值得醒着等待的理由。球衣升上屋顶，连山风都像在点头。",
    "丹佛的球迷见过矿工的汗，也见过冠军的香槟，他们分得清谁是真认真。{achievement}。你在掘金的 {years} 年，把两种味道都尝过，却没有忘记来时的路。球衣升上去那天，整座城都愿意陪你回忆。",
    "百事中心的海拔让客队喘不上气，让主队越打越稳。{achievement}。你在丹佛的 {years} 年，就是那种越打越稳的存在。球衣升上屋顶，高原的风替全城说：你让这里更难攻了。",
    "掘金的蓝色像丹佛清晨的天空，干净、高远。{achievement}。你在掘金的 {years} 年，让这支球队在高原上扎了很深的根。球衣升上去时，看台上有人从口袋里掏出旧球票，看了很久。",
    "丹佛把一件球衣升上屋顶，像把一座山峰记进地图。{achievement}。你在掘金的 {years} 年，让落基山下的球迷有了一个可以抬头仰望的名字。从今以后，它和雪山一起，属于这座城。",
  ],
  "DET": [
    "底特律是汽车城，也是蓝领之城，他们只敬重肯干活的人。{achievement}。你在活塞的 {years} 年，把汗水和胜利都留在了这座城。球衣升上去那天，整座工厂都停了一下，向那件红色致敬。",
    "活塞的篮球从不花哨，它讲究把每一分钟都掰开用。{achievement}。你在底特律的 {years} 年，用最笨也最硬的方式赢得了尊重。球衣升上屋顶，汽车城按下了喇叭，那是它的掌声。",
    "底特律见过繁华，也见过低谷，所以它认得真正的坚韧。{achievement}。你在活塞的 {years} 年，陪这座城走过最难的一段路。球衣升上去时，整座城都愿意把这份荣耀认下来。",
    "活塞的蓝与红，是底特律机器上的机油色，也是它心脏里的热血色。{achievement}。你在活塞的 {years} 年，把两种颜色都穿出了自己的味道。球衣升上屋顶，汽车城的引擎都像在为你轰鸣。",
    "底特律人不轻易夸人，他们用加班表达敬意。{achievement}。你在活塞的 {years} 年，让这座城在每一个比赛夜都愿意早一点下班回家看球。球衣升上去那天，整条街都亮着活塞的灯。",
    "活塞的防守像底特律的冬天，硬，冷，但让人踏实。{achievement}。你在活塞的 {years} 年，把这种硬气带进了每一个主场。球衣升上屋顶时，老球迷互相碰了碰拳，像当年在车间里一样。",
    "底特律的工人相信一件事：零件会生锈，但认真不会。{achievement}。你在活塞的 {years} 年，用每一次卡位和拼抢证明了这句话。球衣升上去时，整座城都像在验收一件最好的成品。",
    "活塞把一件球衣升上屋顶，像把一把钥匙挂回车间。{achievement}。你在底特律的 {years} 年，是这座城最值得骄傲的一段工时。从今以后，每一个走进小凯撒球馆的人，都会先看到你的名字。",
  ],
  "GSW": [
    "大通中心的海风从湾区的桥下吹进来，甲骨文时代和新的浪潮在你身上交汇。{achievement}。你在勇士的 {years} 年，让三分线变成自己的领地，也让金州相信投篮可以改变世界。球衣升上去时，整片湾区都在喊你的名字。",
    "金州的球迷见过篮球最轻快的样子，也见过它最滚烫的样子。{achievement}。你在勇士的 {years} 年，让湾区的夜晚有了属于自己的节奏。球衣升上屋顶，甲骨文的回声还在，新的掌声已经响起。",
    "勇士把创新写进血液，把快乐还给篮球。{achievement}。你在金州的 {years} 年，让整支球队相信跑动和投篮可以赢下一切。球衣升上去那天，湾区的大桥都亮成了庆祝的颜色。",
    "从甲骨文到大通中心，你陪着勇士跨过了两个时代。{achievement}。你在湾区的 {years} 年，让每一段路程都有人记得。球衣升上屋顶，金州用整座城的光来送你。",
    "湾区的风很自由，勇士的篮球也很自由，你刚好是那个最懂自由的人。{achievement}。你在勇士的 {years} 年，把想象变成了冠军。球衣升上去时，整片海都在为它鼓掌。",
    "金州的球迷看过太多三分雨，但只有你的出手，让他们提前站起来。{achievement}。你在勇士的 {years} 年，让每一次球离手都像一场庆祝的开始。球衣升上屋顶，连海风都像在喊：再投一个。",
    "勇士的蓝色是湾区的天空，金色是加州傍晚的桥灯。{achievement}。你在金州的 {years} 年，把两种颜色都穿成了自己的标志。球衣升上去那天，整片海湾都把灯光留给了那件球衣。",
    "金州的孩子在野球场上模仿你的出手，一模仿就是好多年。{achievement}。你在勇士的 {years} 年，让湾区的球场上长出了一代新的投篮姿势。球衣升上屋顶时，他们还在练，只是多了一个仰望的方向。",
  ],
  "HOU": [
    "休斯顿是航天城，见惯了一飞冲天，也见惯了漫长等待。{achievement}。你在火箭的 {years} 年，让丰田中心的夜晚有了发射般的轰鸣。球衣升上屋顶时，整座城都在说：这趟旅程，值得。",
    "火箭的红色像休斯顿的日落，热烈而准时。{achievement}。你在火箭的 {years} 年，让丰田中心每个重要的夜晚都有你的身影。球衣升上去时，航天城把最亮的一束光留给了你。",
    "休斯顿人习惯把眼光放得很远，却也记得来时的路。{achievement}。你在火箭的 {years} 年，让这座城相信过程比结果更动人。球衣升上屋顶，整座城都停下手里的活，看了很久。",
    "火箭的红色是休斯顿最熟悉的速度色，你把它穿成了自己的推进器。{achievement}。你在火箭的 {years} 年，让丰田中心的每一个快攻都像点火升空。球衣升上去时，航天城用最响的轰鸣回应你。",
    "休斯顿的夏天很热，球馆里的欢呼比夏天更热。{achievement}。你在火箭的 {years} 年，让这座城的每一个主场夜都有值得挥汗的理由。球衣升上屋顶那天，连空调都像在为你鼓掌。",
    "火箭的球迷见过大场面，也见过重建的漫长。{achievement}。你在火箭的 {years} 年，是那段漫长里最亮的光。球衣升上去时，整座城都愿意承认：你让等待变得有意义。",
    "休斯顿人相信科学，也相信奇迹，你刚好两者都证明过。{achievement}。你在火箭的 {years} 年，用数据和热血填满了丰田中心的夜晚。球衣升上屋顶，航天城把这条轨道永远留给了你。",
    "火箭把一件球衣升上屋顶，像把一颗卫星送进轨道。{achievement}。你在休斯顿的 {years} 年，让这座城抬头时总能想起你的名字。从今以后，它悬在航天城上空，替这里继续飞行。",
  ],
  "IND": [
    "印第安纳是全美最懂篮球的州，这里的球迷苛刻，也长情。{achievement}。你在步行者的 {years} 年里，让印城的球馆重新像一座圣殿。球衣升上去时，看台上没有一个人提前离开。",
    "步行者的蓝与金，是印第安纳最朴素的自豪。{achievement}。你在步行者的 {years} 年，让这座小城相信大场面并不只在别处。球衣升上屋顶，印城的每一条街都在谈论同一个名字。",
    "印第安纳的球迷把篮球当礼拜，把球员当自家人。{achievement}。你在步行者的 {years} 年，没有辜负过任何一个主场的夜晚。球衣升上去时，整座城都站起来，像做完一场漫长的祈祷。",
    "印城的冬天很冷，但球馆里的蓝金两色，让每个夜晚都有温度。{achievement}。你在步行者的 {years} 年，把这种温度带给了每一个走进球馆的人。球衣升上屋顶时，整座城都像围着同一个火炉。",
    "印第安纳人讲究基本功，讲究把简单的事做到最好。{achievement}。你在步行者的 {years} 年，就是这种讲究的化身。球衣升上去那天，老教练们坐在看台上，互相点头：这孩子，教对了。",
    "步行者的球馆不大，但这里的人把篮球当信仰。{achievement}。你在印第安纳的 {years} 年，让这座小城的球馆在每个比赛夜都像大教堂。球衣升上屋顶，钟声没有响，掌声代替了它。",
    "印城球迷记得每一个细节：你的掩护、你的卡位、你给队友的那次传球。{achievement}。你在步行者的 {years} 年，让这些细节变成全城的记忆。球衣升上去时，连解说员都安静了一会儿。",
    "步行者把一件球衣升上屋顶，像把一本教科书放进历史。{achievement}。你在印第安纳的 {years} 年，让这座最懂篮球的州有了可以反复讲解的章节。从今以后，每一个孩子都会先学你的名字。",
  ],
  "LAC": [
    "洛杉矶有两束聚光灯，快船在另一束里等了很久才亮起来。{achievement}。你在快船的 {years} 年，让这座城终于看见第二面旗帜。球衣升起时，洛杉矶愿意为你们并排鼓掌。",
    "快船的蓝色带着不服输的底色，你把它穿成了自己的路。{achievement}。你在快船的 {years} 年，让这支球队第一次拥有值得仰望的历史。球衣升上屋顶，整座城都记得你们是怎样一路挤进聚光灯的。",
    "洛杉矶不缺明星，缺的是愿意等天亮的人。{achievement}。你在快船的 {years} 年，就是那段时间里最亮的那盏灯。球衣升上去时，快船球迷把最响的欢呼留给了自己人。",
    "快船在洛城的另一侧扎了根，你让它开出了自己的花。{achievement}。你在快船的 {years} 年，让这支球队有了不需要借用别人光芒的时刻。球衣升上屋顶，整座城都为这束独立的光让路。",
    "洛杉矶的日落很美，但快船的球迷更爱看你们在傍晚打响的球。{achievement}。你在快船的 {years} 年，让每一个主场夜都像洛城西部的一场庆典。球衣升上去时，连海风都带着掌声。",
    "快船的历史里写满等待，你让等待有了答案。{achievement}。你在快船的 {years} 年，把怀疑一个一个打回去。球衣升上屋顶那天，老球迷们站在看台上，像终于等到一件早就该发生的事。",
    "洛城的两支球队共用一座城市，也共用一片天空。{achievement}。你在快船的 {years} 年，让快船的那片天空终于有了自己的星。球衣升上去时，整座城都愿意承认：这一颗，很亮。",
    "快船把一件球衣升上屋顶，像把一段被低估的岁月扶正。{achievement}。你在洛杉矶的 {years} 年，让这支球队的历史有了第一页可以骄傲翻开的章节。从今以后，它和洛城的星光一起挂在天上。",
  ],
  "LAL": [
    "洛杉矶的灯光落下来，斯台普斯上空那些紫金色的旗帜替这座城开口。{achievement}。你把名字刻进好莱坞的星光里，{years} 年没有辜负任何一盏聚光灯。从今以后，球馆上空会有一件球衣，替这座城市继续记住你。",
    "紫金军团的历史是一部长篇小说，你在其中写下了自己的章节。{achievement}。你在湖人的 {years} 年，让洛城的夜晚为篮球疯狂过很多次。球衣升上屋顶，整座城市都像在看一部舍不得结局的电影。",
    "洛杉矶见惯了大场面，却愿意为真诚的人留灯。{achievement}。你在湖人的 {years} 年，把冠军文化穿在了身上。球衣升上去时，好莱坞的星光第一次为一件球衣让路。",
    "湖人意味着责任，穿上紫金就要扛起整座城的目光。{achievement}。你在湖人的 {years} 年，没有让那束目光失望过。球衣升上球馆上空，洛杉矶用最盛大的仪式，送一位自己人回家。",
    "斯台普斯的屋顶挂着很多名字，每一个都曾让这座城市心跳加速。{achievement}。你在湖人的 {years} 年，把名字写在了它们旁边。球衣升上去时，整座城都安静下来，听那件球衣说完最后一句：谢谢你。",
    "紫金的颜色里装着 Showtime 的烟花，也装着深夜训练的汗味。{achievement}。你在湖人的 {years} 年，把两种味道都穿在了身上。球衣升上屋顶那天，好莱坞大道两侧都亮起了紫金色的灯。",
    "洛杉矶人见过真正的伟大，所以他们不轻易鼓掌。{achievement}。你在湖人的 {years} 年，让这座挑剔的城市一次次站起来。球衣升上去时，那些掌声不是为了场面，是为了你。",
    "湖人把一件球衣升上屋顶，像把一枚徽章别进历史。{achievement}。你在洛杉矶的 {years} 年，让紫金的传承多了一段属于你的注脚。从今以后，每一个走进球馆的孩子，都会先听你的故事。",
  ],
  "MEM": [
    "孟菲斯的蓝调在夜里流淌，这里的篮球是硬汉写的情书。{achievement}。你在灰熊的 {years} 年，让联邦快递球馆的每一声防守呐喊都带着密西西比河的节奏。球衣升上去时，整座城用蓝调为你送行。",
    "灰熊的篮球不追求漂亮，只追求把对手磨到低头。{achievement}。你在孟菲斯的 {years} 年，就是这支球队最硬的那块骨头。球衣升上屋顶，整座城都愿意为你吼一声。",
    "孟菲斯人不轻易把谁当英雄，他们把敬意留给真正上场的人。{achievement}。你在灰熊的 {years} 年，用每一个夜晚证明了这一点。球衣升上去时，蓝调之城把最慢的一首歌留给了你。",
    "密西西比河的水不会倒流，但孟菲斯记得每一个逆流而上的人。{achievement}。你在灰熊的 {years} 年，让这支球队在最不被看好的日子里也没有低头。球衣升上屋顶，河边的风都像在唱你的歌。",
    "灰熊的蓝色像孟菲斯深夜的蓝调，低沉、有力、不讲废话。{achievement}。你在灰熊的 {years} 年，把这种力量带进了每一个防守回合。球衣升上去时，整座城都用低音跟着你哼。",
    "孟菲斯人喜欢真实的东西：烧烤要冒烟，篮球要流汗。{achievement}。你在灰熊的 {years} 年，把汗流够了，把球打真实了。球衣升上屋顶那天，街角的烧烤摊都为庆祝多开了一小时。",
    "灰熊的球迷知道，有些胜利不是靠天赋，是靠一次次咬牙。{achievement}。你在孟菲斯的 {years} 年，就是那一次次咬牙的化身。球衣升上去时，看台上的人没有华丽的词，只说：你让我们骄傲。",
    "孟菲斯把硬汉两个字写进城市性格，你把它写进了联邦快递球馆的屋顶。{achievement}。你在灰熊的 {years} 年，让每一支客队都知道这里不好打。球衣升上去那天，连客队的更衣室都安静了一瞬。",
  ],
  "MIA": [
    "迈阿密的太阳很烈，热火的训练馆比太阳更早亮灯。{achievement}。你在热火的 {years} 年里，把南海岸的夜晚烧成过火焰。球衣升上屋顶时，整座城都在喊同一个名字。",
    "热火的文化是汗水写成的，这里的每个人都被要求多跑一步。{achievement}。你在迈阿密的 {years} 年，把这一步跑成了整座城的记忆。球衣升上去时，南海岸的风都带着热浪。",
    "迈阿密是一支相信纪律的球队，也是一座相信夏天的城市。{achievement}。你在热火的 {years} 年，让两件事同时成真。球衣升上屋顶，整座城都像在庆祝一个永远不想结束的夏天。",
    "热火的红色像迈阿密的日落，热烈到让人无法忽视。{achievement}。你在热火的 {years} 年，把这种热烈带进了每一个主场夜。球衣升上去时，南海岸的沙滩上都有人在喊你的名字。",
    "迈阿密人懂得享受生活，也懂得尊重汗水。{achievement}。你在热火的 {years} 年，把两种态度都活成了比赛。球衣升上屋顶那天，整座城都像过了一场属于夏天的节日。",
    "热火的训练馆是联盟最著名的汗水车间，你在这里打磨了自己。{achievement}。你在迈阿密的 {years} 年，让那些凌晨的灯光都没有白费。球衣升上去时，连训练馆的保安都站直了身体。",
    "南海岸的球迷见惯了派对，但你的比赛让他们愿意安静下来看。{achievement}。你在热火的 {years} 年，把娱乐之城的夜晚变成了篮球的舞台。球衣升上屋顶，整座城都举起了同一面旗。",
    "热火把一件球衣升上屋顶，像把一团火焰挂进历史。{achievement}。你在迈阿密的 {years} 年，让这座城相信汗水可以点燃一切。从今以后，那件红色球衣会在每一个南海岸的夜晚发光。",
  ],
  "MIL": [
    "密尔沃基的冬天很长，长到这里的球迷懂得珍惜每一团热火。{achievement}。你在雄鹿的 {years} 年，让这座城在最冷的日子里也有值得庆祝的夜晚。球衣升上屋顶，整座城都用欢呼融化了一场雪。",
    "雄鹿的绿色像威斯康星的森林，安静、辽阔、有力量。{achievement}。你在雄鹿的 {years} 年，把这种力量带进了每一个主场。球衣升上去时，密歇根湖的冰面都像映着你的名字。",
    "密尔沃基人不张扬，他们把骄傲放在心里，放在每个周五的主场夜。{achievement}。你在雄鹿的 {years} 年，让那些夜晚变得值得炫耀。球衣升上屋顶，整座城都在心里放了一场烟花。",
    "雄鹿的鹿角是这座城的图腾，你把它戴成了自己的冠冕。{achievement}。你在密尔沃基的 {years} 年，让这支球队在最北的角落打出了最硬的篮球。球衣升上去时，连冬天的风都愿意停下来看。",
    "密尔沃基的球迷见过很多重建，也知道陪伴是什么。{achievement}。你在雄鹿的 {years} 年，让他们的陪伴有了答案。球衣升上屋顶那天，看台上有人举着老照片，照片里的你还在新秀赛季。",
    "雄鹿的球馆不算华丽，但这里的欢呼很实在。{achievement}。你在雄鹿的 {years} 年，把这种实在变成了自己的标签。球衣升上去时，整座城都像农夫看着最好的收成，满意地点了点头。",
    "威斯康星人相信耕耘，相信冬天过后一定有春天。{achievement}。你在密尔沃基的 {years} 年，就是这座城等来的春天。球衣升上屋顶，雪没有停，但每个人的心里都暖了。",
    "雄鹿把一件球衣升上屋顶，像把一棵树栽进历史。{achievement}。你在密尔沃基的 {years} 年，让这座最北的篮球城有了最深的根。从今以后，每一个冬天的夜晚，它都会替这里亮着。",
  ],
  "MIN": [
    "明尼苏达的湖很多，多到这里的球迷习惯把热爱藏在平静下面。{achievement}。你在森林狼的 {years} 年，让这份平静炸开过无数次。球衣升上屋顶，整座城都像终于喊出了憋了很久的话。",
    "森林狼的蓝色像明尼苏达的天空，辽阔而干净。{achievement}。你在森林狼的 {years} 年，把这种辽阔带进了每一个主场。球衣升上去时，千湖之州的风都像在为你鼓掌。",
    "明尼苏达的冬天能把人冻住，但篮球让这里一直活着。{achievement}。你在森林狼的 {years} 年，让无数个寒冬夜有了走进球馆的理由。球衣升上屋顶那天，湖面的冰都像在反射你的颜色。",
    "森林狼的球迷等过很久，久到他们记得每一个细节。{achievement}。你在明尼苏达的 {years} 年，让那些等待有了具体的形状。球衣升上去时，看台上有人指着屋顶说：看，那是我们的。",
    "明尼苏达人相信实干，不信虚张声势。{achievement}。你在森林狼的 {years} 年，用每一次防守和篮板证明了这一点。球衣升上屋顶，整座城都像验收了一件最可靠的农具。",
    "森林狼的狼嚎是这座城最熟悉的声响，你让它响了很多年。{achievement}。你在明尼苏达的 {years} 年，让每一次主场胜利都有回音。球衣升上去时，整片湖区的风都跟着嚎了一声。",
    "明尼苏达的球迷不多，但每一个都够真。{achievement}。你在森林狼的 {years} 年，把这份真打进了每一场比赛。球衣升上屋顶那天，球馆里没有空位，连过道都站着人。",
    "森林狼把一件球衣升上屋顶，像把一颗星投进千湖。{achievement}。你在明尼苏达的 {years} 年，让这座城在最冷的夜里也能抬头看见光亮。从今以后，它和那些湖一样，属于这里的记忆。",
  ],
  "NOP": [
    "新奥尔良是爵士之城，也是味道之城，这里的球迷分得清真假。{achievement}。你在鹈鹕的 {years} 年，让冰沙国王中心的每一个夜晚都有了自己的味道。球衣升上屋顶，整座城都像端出了一道最拿手的菜。",
    "鹈鹕的蓝色像密西西比河入海前的天空，广阔而湿润。{achievement}。你在新奥尔良的 {years} 年，把这种广阔带进了每一个主场。球衣升上去时，河口的晚风都像在为你奏乐。",
    "新奥尔良人热爱生活，他们把每场比赛都过成节日。{achievement}。你在鹈鹕的 {years} 年，让这种节日有了主角。球衣升上屋顶，整座城都像在法式区里放了一场属于你的巡游。",
    "鹈鹕的球迷见过球队一次次重建，却始终没有离开。{achievement}。你在新奥尔良的 {years} 年，让他们的等待有了回报。球衣升上去那天，连街角卖秋葵汤的老板都挂出了你的号码。",
    "新奥尔良的音乐永远不缺即兴，你的比赛也带着这种味道。{achievement}。你在鹈鹕的 {years} 年，把每一个回合都打得像一段即兴独奏。球衣升上屋顶，整座城的节拍都跟着你走。",
    "鹈鹕的翅膀在这座城市张开过很多次，你让它飞得最有记忆。{achievement}。你在新奥尔良的 {years} 年，让冰沙国王中心在季后赛的夜晚像狂欢节。球衣升上去时，连鼓点都停下来等你。",
    "密西西比河把这座城分成两半，篮球又把它们连在一起。{achievement}。你在鹈鹕的 {years} 年，就是那座连接两岸的桥。球衣升上屋顶，河两岸的球迷同时站起来，朝同一个方向鼓掌。",
    "鹈鹕把一件球衣升上屋顶，像把一段旋律写进爵士乐史。{achievement}。你在新奥尔良的 {years} 年，让这座城在篮球里也找到了自己的节拍。从今以后，每一个狂欢节，都会有人提起你的名字。",
  ],
  "NYK": [
    "纽约的灯光很亮，麦迪逊广场花园的屋顶只承认真正的明星。{achievement}。你在尼克斯的 {years} 年，让这座最挑剔的球馆为你起立。球衣升上屋顶时，整座城市都像暂停了一秒。",
    "尼克斯的蓝与橙，是纽约街头最熟悉的颜色。{achievement}。你在尼克斯的 {years} 年，让麦迪逊广场花园的每一场主场比赛都像百老汇首演。球衣升上去时，整座城都愿意买票来看你谢幕。",
    "纽约人见过太多，所以他们只对真东西鼓掌。{achievement}。你在尼克斯的 {years} 年，用每一次拼抢证明了你是真的。球衣升上屋顶，曼哈顿的霓虹都像在为你闪烁。",
    "麦迪逊广场花园是篮球的圣殿，你在这里留下了自己的名字。{achievement}。你在纽约的 {years} 年，让这座圣殿的钟声为你多响了一会儿。球衣升上去那天，连地铁里都在讨论同一件事。",
    "纽约的节奏很快，快到你必须立刻证明自己。{achievement}。你在尼克斯的 {years} 年，从来没有让这座城失望太久。球衣升上屋顶时，整座城都愿意放慢速度，陪你看完这场告别。",
    "尼克斯的球迷爱得深，也骂得狠，但他们永远记得自己人。{achievement}。你在纽约的 {years} 年，把那些骂声熬成了欢呼。球衣升上去时，麦迪逊广场花园的屋顶像是终于等到了这一刻。",
    "纽约人相信奋斗，相信在全世界最难的地方站住脚才算数。{achievement}。你在尼克斯的 {years} 年，就是这种信念的化身。球衣升上屋顶，整座城都用最纽约的方式点头：你配得上。",
    "麦迪逊广场花园的走廊里贴着很多照片，你的那张会被挂进新的位置。{achievement}。你在纽约的 {years} 年，让这座最挑剔的球馆学会了为一个人安静。球衣升上去时，连街边的热狗摊老板都关了火，抬头看。",
  ],
  "OKC": [
    "俄克拉荷马城不大，但这里的球迷把篮球当成了共同的语言。{achievement}。你在雷霆的 {years} 年，让这座小城的球馆在每个比赛夜都像整个州都在呐喊。球衣升上屋顶，整片大平原都听得到。",
    "雷霆的蓝色像俄克拉荷马的天空，高远而诚实。{achievement}。你在雷霆的 {years} 年，把这种诚实带进了每一个主场。球衣升上去时，连龙卷风季的风都像在为你让路。",
    "俄克拉荷马人经历过失去，所以他们格外珍惜拥有。{achievement}。你在雷霆的 {years} 年，让这座城市相信，一支球队可以成为所有人的家。球衣升上屋顶，整座城都像在庆祝一个迟到的拥抱。",
    "雷霆的球迷从第一秒就开始呐喊，从不停下来。{achievement}。你在俄克拉荷马城的 {years} 年，让那些呐喊有了具体的指向。球衣升上去那天，球馆的屋顶像是被声音抬高了一寸。",
    "俄克拉荷马州的公路笔直，这里的人喜欢简单直接的东西。{achievement}。你在雷霆的 {years} 年，把比赛打得直接而有力。球衣升上屋顶，整座城都像在路边停下车，按了两声喇叭。",
    "雷霆的年轻岁月里有你，你的巅峰岁月里有这座城。{achievement}。你在俄克拉荷马的 {years} 年，让彼此都成了更好的故事。球衣升上去时，看台上有人从外地赶回来，就为了看这一眼。",
    "俄克拉荷马人相信，小城也能装下大梦想。{achievement}。你在雷霆的 {years} 年，就是那个梦想最具体的形状。球衣升上屋顶，整片平原的星星都像在替你高兴。",
    "雷霆把一件球衣升上屋顶，像把一段州史写进天空。{achievement}。你在俄克拉荷马城的 {years} 年，让这座城在最辽阔的天空下，有了一颗最亮的名字。从今以后，它和那些星星一起，属于这里。",
  ],
  "ORL": [
    "奥兰多的魔法藏在主题公园里，也藏在你的比赛中。{achievement}。你在魔术的 {years} 年，让安利中心的每个夜晚都像一场演出。球衣升上屋顶时，整座城都像在等烟花绽放。",
    "魔术的蓝色像奥兰多的泳池，清澈、明亮、有夏天的味道。{achievement}。你在魔术的 {years} 年，把这种明亮带进了每一个主场。球衣升上去时，迪士尼的烟火都像在为你多放了一束。",
    "奥兰多是一座相信奇迹的城市，你让奇迹变得具体。{achievement}。你在魔术的 {years} 年，让无数孩子第一次觉得篮球可以这么梦幻。球衣升上屋顶，整座城都像在看一场永不散场的秀。",
    "魔术的球迷见过球队起落，但从未停止相信魔法。{achievement}。你在奥兰多的 {years} 年，让这份相信有了回报。球衣升上去那天，连主题公园的吉祥物都举起了你的号码。",
    "奥兰多夏天很长，球馆里的欢呼让每个夜晚都像节庆。{achievement}。你在魔术的 {years} 年，让那些夜晚有了主角。球衣升上屋顶，整座城都像在举行一场没有烟火的庆典。",
    "魔术的白色球衣像奥兰多的云，轻盈却可靠。{achievement}。你在魔术的 {years} 年，把这种反差打进了比赛。球衣升上去时，看台上的孩子们都站起来，学你的庆祝动作。",
    "奥兰多人热爱娱乐，也热爱真实，你刚好两者都有。{achievement}。你在魔术的 {years} 年，让比赛成为这座城市最好的秀。球衣升上屋顶，整座城都像在散场后久久不愿离开。",
    "魔术把一件球衣升上屋顶，像把一段魔法写进传说。{achievement}。你在奥兰多的 {years} 年，让这座城市相信，篮球可以像童话一样美好。从今以后，每一个走进安利中心的孩子，都会先听你的故事。",
  ],
  "PHI": [
    "费城是兄弟之城，这里的球迷用最直接的方式表达爱。{achievement}。你在76人的 {years} 年，让富国银行中心的屋顶多了你的声音。球衣升上去时，整座城都像在朝你吹哨致敬。",
    "76人的蓝与红，是费城独立钟的颜色，也是这座城的倔强。{achievement}。你在76人的 {years} 年，把这种倔强穿进了每一场比赛。球衣升上屋顶，兄弟之城用最响的呼喊送你。",
    "费城球迷是全联盟最苛刻的，也是最懂球的。{achievement}。你在76人的 {years} 年，让这群苛刻的人一次次站起来。球衣升上去那天，连平时最爱嘘人的角落都安静地鼓掌。",
    "费城的历史写在独立钟上，也写在篮球场上。{achievement}。你在76人的 {years} 年，让这座城在篮球里也找到了自己的宣言。球衣升上屋顶，整座城都像在宣读一份新的独立宣言。",
    "富国银行中心的欢呼很吵，但费城人知道什么时候该安静。{achievement}。你在76人的 {years} 年，让那些安静的时刻都有了意义。球衣升上去时，看台上有人举着你的旧球衣，红了眼眶。",
    "费城人相信硬朗，相信不低头就能走到天亮。{achievement}。你在76人的 {years} 年，就是这种信念的化身。球衣升上屋顶，整座城都像在工地上放下工具，朝同一个方向鼓掌。",
    "76人的球迷爱得浓烈，他们把球员当兄弟。{achievement}。你在费城的 {years} 年，用每一次倒地拼抢回应了这份兄弟情。球衣升上去那天，兄弟之城用最兄弟的方式送你：你永远是我们的人。",
    "76人把一件球衣升上屋顶，像把一面旗插进历史。{achievement}。你在费城的 {years} 年，让这座城在最喧嚣的球馆里，有了一段最安静的记忆。从今以后，它和独立钟一起，属于兄弟之城。",
  ],
  "PHX": [
    "凤凰城的太阳很烈，这里的球迷习惯了高温，也习惯了等待。{achievement}。你在太阳的 {years} 年，让足迹中心的夜晚像沙漠里的一场雨。球衣升上屋顶，整座城都像在仰望一场迟到的甘霖。",
    "太阳的橙色像亚利桑那的日落，热烈、持久、不熄灭。{achievement}。你在太阳的 {years} 年，把这种热烈带进了每一个主场。球衣升上去时，沙漠的风都像在为你升温。",
    "凤凰城相信重生，这座城市本身就源自灰烬。{achievement}。你在太阳的 {years} 年，让这种重生有了篮球的版本。球衣升上屋顶，整座城都像在庆祝一次浴火后的飞翔。",
    "太阳的球迷见过太多起落，但他们始终相信下一个日出。{achievement}。你在凤凰城的 {years} 年，让那些等待日出的夜晚有了方向。球衣升上去那天，整个山谷都亮起了橙色的灯。",
    "足迹中心的欢呼像沙漠里的热浪，扑面而来。{achievement}。你在太阳的 {years} 年，让每一次主场胜利都像一场风暴。球衣升上屋顶，整座城都像在风暴中心为你呐喊。",
    "亚利桑那的天空很少有云，太阳队的主场也这样，清楚、直接。{achievement}。你在太阳的 {years} 年，把这种直接打进了比赛。球衣升上去时，连仙人掌都像在为你鼓掌。",
    "凤凰城的球迷懂得等待的分量，所以他们的掌声格外真诚。{achievement}。你在太阳的 {years} 年，让这份等待有了最响亮的回答。球衣升上屋顶，整座城都像在日出时分醒来，看见了你。",
    "太阳把一件球衣升上屋顶，像把一束光挂进沙漠的天空。{achievement}。你在凤凰城的 {years} 年，让这座城在最热的日子里也有值得仰望的清凉。从今以后，它和太阳一起，每天都会升起。",
  ],
  "POR": [
    "波特兰的雨很多，玫瑰花园的灯光是这座城最暖的角落。{achievement}。你在开拓者的 {years} 年，让无数个雨夜有了值得出门的理由。球衣升上屋顶，整座城都像在雨停后抬起头。",
    "开拓者的红色像波特兰的玫瑰，热烈而不张扬。{achievement}。你在开拓者的 {years} 年，把这种热烈带进了每一个主场。球衣升上去时，威拉米特河的风都像在为你送香。",
    "波特兰人习惯低调，他们把热爱藏在每一个主场夜的掌声里。{achievement}。你在开拓者的 {years} 年，让那些掌声有了具体的名字。球衣升上屋顶，整座城都像在花园里种下了一棵常青树。",
    "玫瑰花园球馆的昵称不是白来的，这里的人把篮球当花一样养护。{achievement}。你在开拓者的 {years} 年，就是那朵开得最久的玫瑰。球衣升上去那天，整座城的花店都挂出了你的号码。",
    "波特兰的球迷经历过很多告别，但他们始终相信忠诚。{achievement}。你在开拓者的 {years} 年，把这份相信打进了每一场比赛。球衣升上屋顶，整座城都像在一场漫长的雨后看见了彩虹。",
    "开拓者的球馆不大，但这里的回声很长。{achievement}。你在波特兰的 {years} 年，让每一次欢呼都能绕梁很久。球衣升上去时，连河对岸的人都说，听到了你们的呐喊。",
    "波特兰人喜欢独立，喜欢小众，喜欢真正属于自己的东西。{achievement}。你在开拓者的 {years} 年，让这座城在篮球里找到了这种骄傲。球衣升上屋顶，整座城都像在说：这是我们的人。",
    "玫瑰花园球馆的每一束灯光都见过你的背影。{achievement}。你在波特兰的 {years} 年，让这座城的雨夜有了最暖的避风港。球衣升上去那天，花店老板在门口挂了一件你的球衣，旁边放了一束玫瑰。",
  ],
  "SAC": [
    "萨克拉门托的河畔很安静，但黄金一号中心的欢呼从不安静。{achievement}。你在国王的 {years} 年，让这座小城在每一个主场夜都像整个加州在呐喊。球衣升上屋顶，河边的风都带着掌声。",
    "国王的紫色像萨克拉门托的晚霞，浓烈而温暖。{achievement}。你在国王的 {years} 年，把这种温暖带进了每一个主场。球衣升上去时，整座城都像在紫色的天空下等你。",
    "萨克拉门托的球迷经历过球队的低谷，却始终没有离开。{achievement}。你在国王的 {years} 年，让他们的坚持有了回报。球衣升上屋顶，整座城都像在一场漫长的等待后终于笑了。",
    "国王的队名带着皇冠，你让这座城真的有了国王。{achievement}。你在萨克拉门托的 {years} 年，让黄金一号中心的每一场胜利都像加冕。球衣升上去那天，整条街都挂满了紫色的旗。",
    "萨克拉门托人低调，但他们知道自己拥有什么。{achievement}。你在国王的 {years} 年，让这座城在篮球版图上有了自己的位置。球衣升上屋顶，整座城都像在骄傲地点头。",
    "国王的球迷是联盟最执着的群体之一，他们记得每一个夜晚。{achievement}。你在萨克拉门托的 {years} 年，让那些夜晚都有了可以反复讲述的故事。球衣升上去时，看台上有人举着新秀年的照片。",
    "萨克拉门托的河不会干涸，这里的爱也不会。{achievement}。你在国王的 {years} 年，把这份爱打进了每一次拼抢。球衣升上屋顶，整座城都像在河畔放了一盏灯，让它随水漂远。",
    "国王把一件球衣升上屋顶，像把一顶皇冠挂进历史。{achievement}。你在萨克拉门托的 {years} 年，让这座城在最安静的角落里，有了最响亮的名字。从今以后，它和晚霞一起，永远属于这里。",
  ],
  "SAS": [
    "圣安东尼奥的河水安静地流过，这座城的篮球也带着同样的沉稳。{achievement}。你在马刺的 {years} 年，让 AT&T 中心的每一个夜晚都像一次精准的执行。球衣升上屋顶，整座城都用沉默的掌声送你。",
    "马刺的黑色与银色，是圣安东尼奥最熟悉的颜色。{achievement}。你在马刺的 {years} 年，把团队篮球打成了艺术。球衣升上去时，连对手都会停下来，为这件球衣鼓掌。",
    "圣安东尼奥人相信体系，相信每个人都做对的事。{achievement}。你在马刺的 {years} 年，就是那个最值得信赖的环节。球衣升上屋顶，整座城都像在检查一遍后确认：没有错误。",
    "马刺的文化是沉默的，但它的成就从不沉默。{achievement}。你在圣安东尼奥的 {years} 年，把这种反差穿在了身上。球衣升上去那天，河畔漫步道的人都停下来，朝球馆方向看了一眼。",
    "圣安东尼奥的球迷懂得欣赏细节：一次掩护、一次卡位、一次正确的传球。{achievement}。你在马刺的 {years} 年，让这些细节有了名字。球衣升上屋顶，连录像分析师都像在致敬。",
    "马刺的团队篮球教会你无私，你也把无私还给了它。{achievement}。你在圣安东尼奥的 {years} 年，让这支球队的传承多了一段属于你的章节。球衣升上去时，更衣室里没有人说话，但每个人都懂。",
    "圣安东尼奥的夜晚很安静，球馆里的纪律却让整座城沸腾。{achievement}。你在马刺的 {years} 年，让这种安静与沸腾完美共存。球衣升上屋顶，整座城都像在完成一次深呼吸。",
    "马刺把一件球衣升上屋顶，像把一枚徽章别进体系。{achievement}。你在圣安东尼奥的 {years} 年，让这支球队相信，低调的人也能拥有最响亮的回声。从今以后，它和河水一起，永远流在这里。",
  ],
  "TOR": [
    "多伦多的冬天很长，猛龙的比赛是这座城最暖的篝火。{achievement}。你在猛龙的 {years} 年，让无数个寒冷夜晚有了值得出门的理由。球衣升上屋顶，整座城都像在雪地里抬起头。",
    "猛龙的红色像多伦多的枫叶，热烈而鲜明。{achievement}。你在猛龙的 {years} 年，把这种热烈带进了每一个主场。球衣升上去时，安大略湖的风都像在为你鼓掌。",
    "多伦多是加拿大唯一的主场，这里的球迷把每一场比赛都当成国家的荣耀。{achievement}。你在猛龙的 {years} 年，让这种荣耀有了具体的名字。球衣升上屋顶，整座城都像在庆祝一个属于北方的冠军。",
    "猛龙的球迷跨越了整个国家来看球，他们的热爱没有距离。{achievement}。你在多伦多的 {years} 年，让这份热爱有了回报。球衣升上去那天，连温哥华的球迷都在看直播。",
    "多伦多人礼貌，但他们对篮球从不客气。{achievement}。你在猛龙的 {years} 年，把这种反差打进了每一场比赛。球衣升上屋顶，整座城都像在冰球场上喊出篮球的名字。",
    "猛龙的球馆是联盟最吵闹的主场之一，你让那些声音有了方向。{achievement}。你在多伦多的 {years} 年，让每一次防守都像整座城的呐喊。球衣升上去时，连枫叶都像在替你鼓掌。",
    "多伦多的球迷知道，篮球在这里不只是运动，是北方的骄傲。{achievement}。你在猛龙的 {years} 年，把这份骄傲扛在了肩上。球衣升上屋顶，整座城都像在暴风雪里点起了一盏灯。",
    "猛龙把一件球衣升上屋顶，像把一面旗插进北境的天空。{achievement}。你在多伦多的 {years} 年，让这座城在最冷的地方，有了最热的记忆。从今以后，它和枫叶一起，永远红在这里。",
  ],
  "UTA": [
    "盐湖城的山很高，这里的球迷也站得很稳。{achievement}。你在爵士的 {years} 年，让能源方案球馆的每一个夜晚都像高原上的篝火。球衣升上屋顶，整座城都像在雪山脚下为你鼓掌。",
    "爵士的蓝与金，是犹他州天空和矿脉的颜色。{achievement}。你在爵士的 {years} 年，把这种沉静带进了每一个主场。球衣升上去时，大盐湖的风都像在为你安静了一瞬。",
    "盐湖城的球迷忠诚，他们用整整一个赛季的到场证明热爱。{achievement}。你在爵士的 {years} 年，让这份热爱有了可以仰望的对象。球衣升上屋顶，整座城都像在完成一次庄严的仪式。",
    "爵士的名字来自音乐，这里的篮球也有自己的节奏。{achievement}。你在犹他的 {years} 年，把这种节奏打进了每一回合。球衣升上去那天，连雪山都像在跟着你的节拍点头。",
    "盐湖城人内敛，但他们把骄傲放在每一个主场夜的安静里。{achievement}。你在爵士的 {years} 年，让那些安静的时刻有了重量。球衣升上屋顶，看台上没有人喧哗，但掌声持续了很久。",
    "爵士的球迷经历过很多伟大的年代，他们记得真正的传承。{achievement}。你在犹他的 {years} 年，让这种传承多了一段属于你的章节。球衣升上去时，老球迷们互相看了看，像在确认：没错，是他。",
    "盐湖城的冬天干燥而清澈，这里的篮球也这样，干净、直接。{achievement}。你在爵士的 {years} 年，把这种清澈打进了每一场比赛。球衣升上屋顶，整座城都像在雪山反射的光里看见了你。",
    "爵士把一件球衣升上屋顶，像把一段旋律刻进山脉。{achievement}。你在盐湖城的 {years} 年，让这座城在最安静的地方，有了最悠长的回响。从今以后，它和雪山一起，永远在这里。",
  ],
  "WAS": [
    "华盛顿的纪念碑很高，奇才的球馆里也立起了属于你的碑。{achievement}。你在奇才的 {years} 年，让首都一号球馆的夜晚有了自己的节拍。球衣升上屋顶，整座城都像在国家广场上为你鼓掌。",
    "奇才的蓝色与红色，是华盛顿旗帜的颜色，也是这座城的性格。{achievement}。你在奇才的 {years} 年，把这种性格带进了每一个主场。球衣升上去时，波托马克河的风都像在为你送行。",
    "华盛顿的球迷见过政治的风云，也见过篮球的起落，他们懂得什么叫坚持。{achievement}。你在奇才的 {years} 年，让这份坚持有了具体的形状。球衣升上屋顶，整座城都像在国会山的台阶上停了一会儿。",
    "奇才的队名意味着奇迹，你让奇迹有了自己的名字。{achievement}。你在华盛顿的 {years} 年，让首都一号球馆在关键夜晚像一座沸腾的广场。球衣升上去那天，连地铁里的陌生人都在谈论你。",
    "华盛顿人务实，他们只看重真正发生过的事。{achievement}。你在奇才的 {years} 年，用每一场比赛证明了你的价值。球衣升上屋顶，整座城都像在一份文件上盖下了最重的章。",
    "奇才的球迷见过很多重建，但他们从未停止相信。{achievement}。你在华盛顿的 {years} 年，让这份相信有了回报。球衣升上去时，看台上有人举着你新秀年的海报，海报已经泛黄。",
    "波托马克河的日落很美，奇才的主场夜让这种美有了声音。{achievement}。你在华盛顿的 {years} 年，把每一个傍晚都打成了值得纪念的时刻。球衣升上屋顶，整座城都像在河边放了一盏灯。",
    "华盛顿人见过很多重要文件被签署，也知道有些名字值得用更重的方式留下。{achievement}。你在奇才的 {years} 年，让首都一号球馆的屋顶多了一个不需要解释的名字。球衣升上去时，连国会山的钟声都像在替这座城盖章。",
  ],
};

;

var JERSEY_TEAM_COPY_FALLBACK = [
    "灯光暗下来，{team}为你举办退役球衣仪式。{achievement}。你在{team}的 {years} 年，已经成了这支球队记忆的一部分。球衣缓缓升上球馆上空，现场没有人急着离开。",
    "{team}的球馆为你亮起整片灯光，{achievement}。你在{team}的 {years} 年，把每一个主场都变成了回家的理由。球衣升上屋顶时，整座城都在目送。",
    "这座城市的球迷记得你的每一次奔跑。{achievement}。你在{team}的 {years} 年里，没有辜负过任何一个夜晚。球衣升上去时，全场起立，掌声很久没有停下。",
    "退役球衣这天，{team}没有放你的集锦，先放了你在训练馆加练的画面。{achievement}。你在{team}的 {years} 年，最让这座城市记住的，不只是胜利，还有那些没人看见的认真。",
    "{team}把一件球衣升上屋顶，像把一段岁月装裱起来。{achievement}。你在{team}的 {years} 年，让很多个普通主场夜变得值得纪念。从今以后，它属于这里，也属于所有看过你的人。",
    "主持人念出你的名字时，{team}的球馆里响起了最长的欢呼。{achievement}。你在{team}的 {years} 年，把这座城市对你的陌生变成了熟悉，把熟悉变成了舍不得。",
    "球衣升上屋顶那刻，你没有抬头。{achievement}。你怕自己一看，就会想起太多事。{team}的 {years} 年，有胜利，有伤病，有拥抱，最后它们一起升上去，变成这座城市替你保管的记忆。",
    "{team}选择退役你的球衣，不是奖励一段数据，而是承认一段关系。{achievement}。你在{team}的 {years} 年，让很多球迷有了一个可以对后来人反复提起的名字。",
];

;

function buildJerseyAchievement(info) {
  var parts = [];
  if (info.championships > 0) {
    var champLine = '你为' + getTeamName(info.team) + '带来 ' + info.championships + ' 座总冠军';
    if (info.fmvp > 0) champLine += '和 ' + info.fmvp + ' 次总决赛MVP';
    parts.push(champLine);
  }
  if (info.mvp > 0) parts.push('把 ' + info.mvp + ' 座常规赛MVP留在这座城市');
  if (parts.length === 0) parts.push('你把最好的 ' + (info.years || 0) + ' 年都交给了这座城市');
  return parts.join('，');
}

function buildJerseyCeremonyCopy(info) {
  var team = info.team;
  var pool = JERSEY_TEAM_COPY[team] || JERSEY_TEAM_COPY_FALLBACK;
  var idx = 0;
  if (Array.isArray(pool)) {
    idx = typeof info.copyVariant === 'number' ? (info.copyVariant % pool.length) : Math.floor(Math.random() * pool.length);
  } else {
    pool = [pool];
  }
  var tpl = pool[idx] || pool[0];
  var vars = {
    team: getTeamName(team),
    city: (window.TEAM_CITY && window.TEAM_CITY[team]) || '',
    years: info.years || 0,
    championships: info.championships || 0,
    mvp: info.mvp || 0,
    fmvp: info.fmvp || 0,
    allStar: info.allStar || 0,
    achievement: buildJerseyAchievement(info),
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

// ── 名人堂：30 条入选 + 20 条未入选，围绕生涯经历客制化 ──
var HOF_COPY = [
    "斯普林菲尔德的名人堂玻璃厅里，灯光比想象中更亮。{achievement}。你穿过 {teamCount} 支球队的球衣，在{longestTeam}留下过最长的 {longestYears} 年。那些训练馆、客场航班、伤病名单和抢七夜晚，终于被压缩成一句话：欢迎进入篮球名人堂。",
    "名人堂公布名单那天，你的名字出现在最后一行。镜头切到你时，你没有立刻笑，只是低头揉了揉眼睛。{achievement}。从{firstTeam}到{lastTeam}，你的故事被一座又一座城市接力保存。有人问你这辈子值不值，你想起的却是每一次还没投进的球。",
    "{achievement}。你打过 {teamCount} 支球队，把最好的 {longestYears} 年留给了{longestTeam}。篮球名人堂的钥匙很轻，握在手里却像一座城的分量。名单念到你名字的那一刻，过去所有沉默的夜晚都替你开口了。",
    "你走进名人堂的时候，墙上挂着一整个时代。{achievement}。{teamList}——你走过的每一站，都在今天派出了代表。那些曾与你交手的人、曾为你欢呼的人，都在这间大厅里和你重新遇见。欢迎回家。",
    "名人堂的邀请函上没有写太多字，只有一句：请来领取属于你的位置。{achievement}。你带着 {games} 场比赛、{points} 分的足迹走进大厅，身后跟着 {teamCount} 座城市的目光。你站在那里，忽然明白，被历史记住不是终点，是更多人开始读你的故事。",
    "名人堂不是一座奖杯，是一间装满了人声的大厅。{achievement}。从{firstTeam}的第一场，到{lastTeam}的最后一场，你让很多陌生人为了同一个名字欢呼。你走进来的时候，那些欢呼声还在墙上回荡。",
    "你站在门口深呼吸，像第一次上场前一样。{achievement}。{teamCount} 支球队，{games} 场比赛，{points} 分——这些数字拼不出全部的你，却足以让一扇门为你打开。欢迎进入篮球名人堂。",
    "名人堂公布名单的清晨，你的电话响个不停。{achievement}。你没有急着接，只是坐在床边想：{longestTeam}那个破旧训练馆里挥汗的自己，大概不会相信这一天。今天，整座城都替他高兴。",
    "{achievement}。你从{firstTeam}出发，路过{teamList}，最终停在{lastTeam}。{teamCount} 座城市各自保存着你的一段时光，今天它们把时光拼在一起，拼成了名人堂里你的名字。",
    "名人堂的走廊很长，长得像你的生涯。{achievement}。{games} 场比赛、{points} 分、{teamCount} 支球队，脚步一路排到门口。你走完这段走廊，身后响起掌声，你没有回头，因为你知道那是谁。",
    "你入选名人堂那天，{longestTeam}的球迷在球馆外挂起横幅：他回来了。{achievement}。你在那里打了 {longestYears} 年，把最重的时光留给了他们。今天，他们把最亮的灯还给了你。",
    "记者问你入选名人堂的感受，你沉默了很久，说：我想起很多人。{achievement}。从{firstTeam}到{lastTeam}，{teamCount} 支球队、无数队友，都在你名字后面站了一排。篮球是团队运动，连荣耀也是。",
    "你翻出第一双球鞋，鞋底已经磨平。{achievement}。这双鞋带你去过{teamList}，打过 {games} 场，拿到过 {points} 分。今天它进不了名人堂，但它的主人可以。",
    "名人堂为你放了一段集锦，镜头从新秀赛季一路切到最后一战。{achievement}。你看见自己在{teamCount} 支球队奔跑，看见{lastTeam}的球迷在哭，也看见自己终于笑了。",
    "名单公布那晚，你一个人去了训练馆，像过去无数个夜晚一样。{achievement}。你把球投进最后一个，然后坐在中圈，第一次允许自己相信：这条路，真的走到了名人堂。",
    "名人堂的灯亮起来时，全场起立。{achievement}。你看着{teamList}的方向，每一座城市都有人举着你的号码。{teamCount} 段旅程，最终在这里汇成一条路。",
    "你入选名人堂，不是因为某一场比赛，而是因为每一场比赛。{achievement}。你为{lastTeam}打完最后一场时，{longestTeam}的人还在念你的名字。今天，两座城市都来了。",
    "大厅里有人放你总决赛的录像，你看到自己抢下篮板、投进关键球。{achievement}。那些夜晚没有白费：{teamCount} 支球队把你写进队史，篮球把你写进名人堂。",
    "你走进名人堂时，口袋里还放着球迷送的一颗旧篮球。{achievement}。这球陪你在{teamCount} 座城市流浪，也陪你在{lastTeam}谢幕。今天，它和你一起被记住。",
    "你入选了，可你最先想到的是那些输掉的夜晚。{achievement}。{teamCount} 支球队、无数场失利，都没能让你停下来。今天名人堂告诉你：那些夜晚也是路的一部分。",
    "名人堂名单公布时，你在球场边带小孩子投篮。{achievement}。你教他们把球举高、把眼睁开，就像多年前有人教你一样。电话响了，你说：等一下，让这个孩子先投完。",
    "斯普林菲尔德的门打开时，你走得很慢。{achievement}。你把最久的 {longestYears} 年留给{longestTeam}，把最后一站留给{lastTeam}，把中间那些没有被拍下来的清晨留给自己。今天，它们终于一起被承认。",
    "名单公布那天，很多人说你终于进去了。你听到“终于”两个字，反而笑了。{achievement}。因为你知道，这条路从来不是为了走进一间大厅，而是为了对得起每一次出场前系紧鞋带的自己。",
    "如果入选名人堂是一种回答，那么它回答的不是你有多伟大，而是你坚持的那些年有没有意义。{achievement}。{games} 场比赛以后，答案终于来得很轻，却压得你眼眶发热。",
    "你站在名人堂讲台上，说自己最感谢的不是高光时刻，而是低谷里还愿意相信你的人。{achievement}。从{firstTeam}到{lastTeam}，{teamCount} 座城市里都有这样的人。今天，你替他们一起站在这里。",
    "名人堂仪式那晚，你没有先看台下的明星，而是看见了一个穿着{firstTeam}旧球衣的老人。{achievement}。你忽然明白，历史不是墙上的名字，是有人隔了很多年，仍然愿意穿着你的球衣来见你。",
    "你走进那间大厅时，脚步声比任何时候都响。{achievement}。{teamCount} 支球队、{games} 场比赛、{points} 分，全部安静下来，只剩这一双脚声。欢迎进入篮球名人堂。",
    "名人堂把灯打在你身上，你没有觉得刺眼。{achievement}。你说：这光我等了很久。从{firstTeam}那个没有观众的球馆开始，到{lastTeam}的最后一场，我一直朝着有光的地方走。",
    "你入选名人堂的消息传回{firstTeam}时，那条街上的老邻居们挨个出来，像过节一样。{achievement}。你说：他们可能不知道名人堂是什么，但他们知道，那个从小打球的孩子，走得很远。",
    "你站在斯普林菲尔德的玻璃厅里，看见自己的名字刻在墙上，像看见一个陌生又熟悉的人。{achievement}。你伸手摸了一下，然后转身，对着{teamList}的方向说：我们一起进来的。",
    "名人堂的邀请函被你放在床头整整一周，你每天看一遍，才确认它不是梦。{achievement}。{seasonsCount} 个赛季、{teamCount} 支球队、{games} 场比赛，终于有了一个正式的句号。",
    "你入选名人堂那天，只说了一句话：这下，我可以告诉当年那个孩子，他没有白练。{achievement}。台下的人都笑了，然后都站起来，把掌声送给了那个还在孩子气里的你。",
    "名人堂的走廊两侧挂着所有传奇，你走过时，像在检阅自己的青春。{achievement}。你在{firstTeam}看过他们的海报，在{lastTeam}与他们交手，今天，你走到了他们中间。",
    "你入选名人堂的新闻下面，最高赞的评论是一句：他终于不用再证明了。{achievement}。你看完以后关掉手机，去训练馆投了一组篮。这一次，不是为了证明，只是为了开心。",
    "名人堂的仪式上，主持人念到你的名字，你站起来，先回头看了一眼台下。{achievement}。{teamList}的球迷都来了，他们举着不同颜色的球衣，却喊同一个名字。",
    "你站在讲台上，说：我一直觉得名人堂是别人的地方。{achievement}。台下笑了。你说：直到今天我才相信，认真打球的人，真的可以走这么远。",
    "名人堂名单公布那天，你的手机被消息塞满，你只回了一条：是真的。{achievement}。然后你放下手机，给{firstTeam}的老教练打了个电话，他在电话那头哭了。",
    "你走进名人堂时，有人问你什么感觉。你说：像打完最后一场比赛，终于可以坐下。{achievement}。{games} 场比赛、{points} 分，都在这把椅子上放下了。",
    "名人堂为你准备的介绍词很短，只有一句：他让篮球变得值得等待。{achievement}。你站在台上听完，没有忍住，还是红了眼眶。从{firstTeam}到{lastTeam}，你值得这句话。",
    "你入选名人堂那晚，没有庆祝，只是开车回了一趟{firstTeam}。{achievement}。你在那座旧球馆门口站了很久，然后对着空无一人的街道说：我做到了。",
    "名人堂的玻璃厅里，你的名字和很多名字排在一起。{achievement}。你站在自己的名字前面，想起{firstTeam}那年第一次穿正式球衣的自己。那个孩子不会相信，但你替他相信了。",
    "你入选名人堂后，记者问你最想对谁说谢谢。你想了很久，说：对每一个在我低谷时没有放弃我的人。{achievement}。从{firstTeam}到{lastTeam}，{teamCount} 座城市都有你们。",
    "名人堂的灯照下来时，你忽然想起一个普通的训练日：清晨、空馆、篮球落地的回声。{achievement}。那些没人看见的日子，今天终于被看见了。",
    "你站在名人堂的讲台上，没有讲自己的荣誉，只讲了一个故事：一个孩子在{firstTeam}的旧球馆里，一遍一遍投着罚球。{achievement}。你说：那个孩子，今天站在这里。",
    "名人堂名单公布时，你正在教小女儿打球。她问你为什么哭了，你说：爸爸打了很多年球，今天终于毕业了。{achievement}。她不懂，但她帮你擦了眼泪。",
    "你走进名人堂时，看见墙上有一张自己的旧照片，是{firstTeam}时期拍的。{achievement}。你站在照片前看了很久，像在看一个老朋友。他等这一天，等了{seasonsCount} 年。",
    "名人堂的仪式很庄重，但你忍不住笑了。{achievement}。你说：对不起，我总觉得这一切像假的。台下有人说：是真的。你说：我知道，所以才想笑。",
    "你入选名人堂那天，{lastTeam}的球馆大屏放了一整天的集锦，配文只有两个字：到了。{achievement}。你看到以后，回了一句：谢谢带路。",
    "你站在名人堂的门口，深吸了一口气，像新秀赛季第一次走进球馆。{achievement}。这一次，你没有紧张，只有平静。{games} 场比赛之后，你终于可以慢慢走进去了。",
    "名人堂把一枚戒指戴到你手上时，你想起第一枚总冠军戒指戴上来时的感觉。{achievement}。你说：那次是赢来的，这次是走来的。两条路，都值得。",
    "你入选名人堂的消息传到{firstTeam}的老街区，那里的孩子把海报贴了一墙。{achievement}。你说：我不在乎海报，我在乎的是，他们知道从这条街出发，可以走到名人堂。",
    "你站在讲台上，说：我没什么天赋，只是比别人多练了一点。{achievement}。台下安静。你说：{games} 场比赛，就是那一点一点堆起来的。今天，这一点点被看见了。",
    "名人堂的邀请函上写着你的名字，你念了三遍，才敢拆开。{achievement}。你说：第一遍是惊讶，第二遍是确认，第三遍，是谢谢。",
    "你走进名人堂时，没有带奖杯，带了一张旧照片：{firstTeam}的更衣室合影。{achievement}。你说：这才是我的荣誉。他们陪我走了第一段路，今天，我替他们走到这里。",
    "名人堂的名单公布后，你给每一个老队友发了消息：我们进去了。{achievement}。有人回：是你进去了。你说：没有你们，我进不去。",
    "你站在名人堂的玻璃厅里，忽然觉得灯光很温柔。{achievement}。{teamCount} 支球队、{games} 场比赛、{points} 分，都融化在这片光里。你终于可以不用再赶路。",
    "名人堂的仪式上，有人问你还想不想复出。你笑了：不想。{achievement}。你说：我想留在这个位置，好好看看自己走过的路。这条路，够长了。",
    "你入选名人堂那天，窗外下着雨，你没有带伞，就这样走进雨里。{achievement}。你说：{firstTeam}那年第一次训练也是雨天，现在圆满收尾，很好。",
    "你站在名人堂的讲台上，忽然说不下去了。{achievement}。台下没有催你。你缓了缓，说：对不起，我等这一刻等了太久，话都堵住了。",
    "名人堂的墙上有你的名字，也有你教过的年轻人的名字。{achievement}。你说：这才是最好的部分。我不仅走进了历史，还让更多人有了走来的方向。",
    "你入选名人堂后，第一件事是回{firstTeam}请老邻居们吃饭。{achievement}。你说：他们看着我长大，我得让他们知道，那个孩子没有白长大。",
    "名人堂的灯亮起来时，你看见台下坐着{teamList}的球迷，他们穿着不同的球衣，却像一家人。{achievement}。你说：篮球让我在很多城市都有家。今天，这些家都来了。",
    "你站在名人堂门口，最后看了一眼外面的路。{achievement}。那是一条你走了{seasonsCount} 年的路，弯弯曲曲，但一直通向这里。你推开门，走了进去。",
    "名人堂的仪式结束后，你一个人坐在大厅里，看着自己的名字。{achievement}。你没有说话，只是伸手摸了一下那行字，像确认一个迟到的拥抱。",
    "你入选名人堂那天，{longestTeam}的球迷在球馆外放了一整晚的烟花。{achievement}。你在那里打了 {longestYears} 年，他们说：这座城的光，有你一半。",
    "你站在名人堂的讲台上，说：我打球的时候，总觉得时间不够用。{achievement}。今天站在这里，我第一次觉得，时间都值了。",
    "名人堂的名单念到你时，你听见自己的名字在巨大的厅堂里回荡。{achievement}。那一刻，你想起{firstTeam}球馆里那个同样回荡过名字的傍晚。两个声音，隔了{seasonsCount} 年，终于连上了。",
    "你入选名人堂后，去看了{firstTeam}的旧球馆，它已经拆了。{achievement}。你站在空地上，没有难过，只是说：球馆没了，但路还在。今天，路把我送到了这里。",
    "名人堂的玻璃厅里，你看见自己的倒影和传奇们的照片叠在一起。{achievement}。你没有躲开，只是站直了。{games} 场比赛，给了你站直的底气。",
    "你站在名人堂的门口，像新秀赛季那样系紧鞋带。{achievement}。这一次不是为了上场，是为了走进去。{teamCount} 支球队的路，都系在这一双鞋带上。",
    "名人堂公布名单时，你正在家里看以前的比赛录像。{achievement}。电话响了，你没有接，看完那场比赛才回过去。你说：我想先和过去的自己告别。",
    "你入选名人堂那天，收到一封手写信，来自{firstTeam}的一位老球迷。信上写着：我看了你第一场，也看了你最后一场。{achievement}。你把信折好，放进口袋，说：这比荣誉重。",
    "名人堂的仪式上，你请了一位特别的嘉宾：{firstTeam}的旧球馆管理员。{achievement}。他总在深夜给你留门。你说：没有他，我练不了那么晚，也走不了这么远。",
    "你站在名人堂讲台上，说：我这一生都在追赶别人的背影，今天终于追到了这里。{achievement}。你停了一下：但我知道，后面还有很多人，在追我的背影。",
    "名人堂的名单公布后，你回到{lastTeam}的球馆，坐在空荡荡的看台上。{achievement}。你说：我想最后听一次这里的声音。安静了很久，你站起来，说：够了，走吧。",
    "你入选名人堂那天，你的启蒙教练也来了。他头发白了，但眼睛很亮。{achievement}。他只说了一句：我知道你会到。你说：是你把我送来的。",
    "名人堂的灯很亮，亮到你想起{firstTeam}训练馆里那盏忽明忽暗的灯。{achievement}。你说：那时候灯不好，但我看得清球。今天灯很好，我也看清了自己。",
    "你站在名人堂的墙前，看见自己的名字排在{teamList}之后，像一张完整的地图。{achievement}。你说：每一站都有故事，每一站都值得。这张地图，我画了{seasonsCount} 年。",
    "名人堂的仪式上，有人问你最想回到哪一天。你说：不想回。{achievement}。你说：过去每一天都把我带到了今天。今天，我很满意。",
    "你入选名人堂后，一个人在球馆投了一组罚球，全进了。{achievement}。你笑了：状态还在。然后你把球放回球架，头也不回地走了。这一次，是真正的离开。",
    "名人堂的玻璃厅里，你的名字被灯光照得很亮。{achievement}。你站在下面，像一个刚交了卷的学生。{games} 场比赛，是你写满的答卷。",
    "你入选名人堂那天，{teamCount} 座城市的电台都在播你的消息。{achievement}。你说：我听不懂很多语言，但我听得懂一个意思：他们为我高兴。",
    "你站在名人堂的讲台上，说：有人问我什么是伟大。{achievement}。你说：伟大不是赢了多少，是让多少人因为篮球而相信。今天，我想我是做到了。",
    "名人堂的名单公布时，你正在修家里的旧篮球架。{achievement}。接到电话后，你把它修完才回电。你说：这个架子陪我长大，今天的好消息，应该让它先知道。",
    "你入选名人堂后，去了一趟{firstTeam}的老球馆，在门口拍了一张照片。{achievement}。你说：这张照片，我想挂在家里的墙上。起点和终点，都在这条路上。",
    "名人堂的仪式很安静，你的心跳却很响。{achievement}。你听见自己名字被念出来的那一刻，{seasonsCount} 年的画面一起涌上来。你没有哭，只是笑了很久。",
    "你站在名人堂的门口，回头看了一眼。{achievement}。门外是{teamList}的路，门内是历史。你深吸一口气，说：走吧，该进去了。",
    "名人堂的名单公布后，你把消息告诉了{firstTeam}的一位老队友。他沉默了一会儿，说：我就知道。{achievement}。你们没有再说别的，但那四个字，你记了一辈子。",
    "你入选名人堂那天，球馆上空挂起了你的旧号码。{achievement}。你说：号码没有变，变的是看它的人。今天，它终于可以被所有人看到了。",
    "名人堂的玻璃厅里，你看见自己的名字和偶像们排在一起，像一个学生站进了老师们的教室。{achievement}。你站直了，说：我来了，带着{seasonsCount} 年的作业。",
    "你站在名人堂讲台上，最后只说了一句：谢谢篮球。{achievement}。你走下台，经过{teamList}的球迷时，停了一下，补了一句：也谢谢你们。",
    "名人堂的名单公布时，你正在给孙子讲自己打球的故事。{achievement}。他问：爷爷，那你厉害吗？你笑了：今天刚收到通知，算是有一点吧。",
    "你入选名人堂那天，{lastTeam}的球迷在球馆门口排成长队，就为了跟你说一声恭喜。{achievement}。你一个一个握手，没有急着进场。历史可以等，他们不能。",
    "你站在名人堂的墙前，看着自己的名字，忽然想起{firstTeam}那个没人认识的自己。{achievement}。你说：他没有想到，但他值得。今天，我替他来了。",
    "名人堂的仪式上，你请全场安静了一分钟，为了那些没能走到这里的人。{achievement}。你说：我很幸运。我的名字在墙上，他们的名字在我心里。",
    "你走进名人堂时，脚步很稳。{achievement}。{teamCount} 支球队、{games} 场比赛、{points} 分，都在这双脚下。你走到自己的名字前，停住，然后对全场说：我到了。",
    "名人堂公布名单那天，你正在给老队友打电话。他比你更激动，在电话那头喊了半天。{achievement}。你说：冷静点，是我进又不是你进。他说：你进就是我进。",
    "你入选名人堂后，把奖牌放在{firstTeam}老教练的墓碑前，站了很久。{achievement}。你说：老师，我到了。然后你转身，没有回头。",
    "名人堂的仪式上，你请全场一起鼓掌一分钟，为那些没有等到这一天的老队友。{achievement}。你说：今天这份荣誉，有他们一半。",
    "你入选名人堂那天，{lastTeam}的球馆在屋顶挂了一面新旗，上面是你的名字。{achievement}。你说：我没有要求他们这样做。他们说：这是你应得的。",
    "名人堂的走廊里，你看见自己新秀年的照片，照片上的你还很瘦。{achievement}。你站在它前面，说：小子，你做到了。",
    "你入选名人堂后，有人问你最想做什么。你说：想回{firstTeam}，把当年住过的出租屋门口走一遍。{achievement}。你说：那间屋子很小，但那里装着我最大的梦。",
    "名人堂的名单公布时，你在球场边看年轻人训练。教练跑来告诉你消息，你点了点头，继续看。{achievement}。你说：名单是过去的，他们才是未来。",
    "你入选名人堂那天，收到一封来自{lastTeam}小球迷的信，画着你在球场上奔跑的样子。{achievement}。你把它裱起来，挂在客厅最显眼的地方。",
    "名人堂的仪式上，你讲了一个很长很长的故事，从{firstTeam}讲到{lastTeam}。{achievement}。台下没有人催你。讲完以后，你说：这个故事，我讲完了。",
    "你入选名人堂后，在训练馆门口遇见一个年轻人。他问：前辈，进名人堂是什么感觉？你说：像打完最后一场比赛，有人告诉你，你赢了。{achievement}。",
    "名人堂公布名单那天，你正在公园里散步。接到电话后，你绕着公园走了一圈，然后回家，跟家人吃了一顿很普通的饭。{achievement}。你说：今天，很适合吃饭。",
    "你入选名人堂，却把奖杯放在书房最角落。家人问为什么不摆出来，你说：摆出来会骄傲。{achievement}。你顿了顿：但我会每天看它一眼，提醒自己别辜负。",
    "名人堂的名单公布后，你给{firstTeam}的食堂阿姨打电话，说：阿姨，我进了。她说：我就知道，我给你多打的那些饭没白打。{achievement}。",
    "你入选名人堂那天，{teamCount} 座城市的地标建筑都亮起了灯。{achievement}。你没有去现场看，只在家里的电视上看了新闻。你说：这些灯，是替球迷亮的。",
    "名人堂的仪式上，你念了一段自己在{firstTeam}时期写的日记。日记里写：今天训练很累，但我想进名人堂。{achievement}。台下安静了很久。",
    "你入选名人堂后，有人问你还想不想复出。你说：不想。{achievement}。你说：我想留在这个位置，好好看看自己走过的路。这条路，够长了。",
    "名人堂公布名单那天，你正在教小女儿骑自行车。她摔倒了，你扶她起来，说：再来。{achievement}。后来你告诉她，爸爸今天也进了一个很大很大的门。",
    "你入选名人堂，却没有参加任何庆祝活动。{achievement}。你说：我把庆祝留到{firstTeam}重建完成那天。那天，我会回去，和他们一起看新球馆的第一场比赛。",
    "名人堂的灯照在你身上时，你想起的不是任何一场胜利，而是{firstTeam}那个普通训练日的黄昏。{achievement}。你说：从那个黄昏走到今天，我走了{seasonsCount} 年。",
    "你入选名人堂那天，只说了一句话：这下，我可以告诉当年那个孩子，他没有白练。{achievement}。台下的人都笑了，然后都站起来，把掌声送给了那个还在孩子气里的你。",
];

;

var HOF_FAIL_COPY = [
    "名人堂投票结果公布，你的名字没有出现在名单里。评论员说你差一点历史重量，可你关掉电视时，信箱里还堆着球迷寄来的信。{achievement}。你没有被写进那面墙，但已经写进很多人的青春。",
    "这一年的名人堂名单里没有你。你安静地接受了这个答案，第二天照常去训练馆。{achievement}。从{firstTeam}到{lastTeam}，{teamCount} 座城市都见证过你的认真。历史有时慢一点，但那些和你一起走过夜晚的人，从不需要投票。",
    "名人堂的门暂时没有为你打开。你放下手机，看见窗外还有人在球场上练习你的动作。{achievement}。不是所有传奇都需要一座玻璃厅来证明。你把 {longestYears} 年留给了{longestTeam}，把名字留给了每一个主场。",
    "名单里没有你，{lastTeam}的球迷却在球馆外为你放了一晚的灯。{achievement}。你打过 {games} 场、拿过 {points} 分，在 {teamCount} 支球队留下故事。名人堂是投票选出来的，爱不是。",
    "你落选了，电视评论员说你的生涯还差一页。你关掉电视，想起{firstTeam}那年输掉比赛后，一个孩子在场边等你签名，等了两个小时。{achievement}。那一页，早就有人替你写好了。",
    "名人堂没有喊你的名字，可{teamList}的播报员还在喊。{achievement}。你走过 {teamCount} 座城市，每一座都把你当自己人。玻璃厅的门可以晚一点开，你已经住在很多人心里了。",
    "你没有被选进名人堂。你坐在家里，翻着旧相册，看到自己在{longestTeam}举起奖杯的样子。{achievement}。你忽然觉得，那段时光本身，就是一座不需要门票的名人堂。",
    "落选的消息传来时，你正在小区球场教邻居小孩投篮。{achievement}。小孩问你会不会难过，你说：有人记住我就够开心了。后来那个小孩把这句话写进了作文。",
    "你没有进入今年的名单。凌晨你收到一条短信，是{firstTeam}一个老队友发来的：在我心里你早就是。{achievement}。历史有时迟到，但{teamCount} 座城市的记忆不会。",
    "名人堂的门关着，你没有多看一眼，转身去接孩子放学。{achievement}。你打了 {games} 场、得了 {points} 分，把最长的 {longestYears} 年给了{longestTeam}。对家人来说，你早就是名人堂。",
    "你落选了，新闻标题很短。第二天，{longestTeam}的球馆大屏放了一整天你的集锦，配文只有两个字：谢谢。{achievement}。一座城市用这种方式投了你一票。",
    "评论员说你还差一点，你笑了：哪一点？是{firstTeam}的清晨，还是{lastTeam}的最后一投。{achievement}。你走过 {teamCount} 支球队，没有一段路是白走的。",
    "今年名单上没有你，你把手机调成静音，去跑了五公里。{achievement}。你从来不是靠别人的名单确认自己的人。{teamCount} 座城市的球馆，都记得你的脚步声。",
    "你没有入选，但{lastTeam}把最后一场比赛的球衣寄给了你，附了一张纸条：你永远是我们的一员。{achievement}。名人堂是一座厅，{teamCount} 段旅程是一座更大的厅。",
    "落选那天，你收到一封信，寄信地址是{firstTeam}，里面是一张旧球票：你新秀赛季第一场。{achievement}。那晚的球票被保存了这么多年，比任何投票都重。",
    "你没有被写进名人堂，却被写进了很多人的第一段篮球记忆。{achievement}。{teamCount} 支球队、{games} 场比赛，你的名字足够长，长到可以住进一代人的青春。",
    "名单公布时，你正在给{lastTeam}的孩子签名。孩子问：叔叔你难过吗？你说：我在做喜欢的事，不难过。{achievement}。后来那个孩子把你的签名裱了起来，比名人堂更珍贵。",
    "你没有进去，但你把门推开了一点点。{achievement}。你让{firstTeam}的孩子相信小城也能出巨星，让{longestTeam}的夜晚有过不熄的灯光。门可以下次再开，你已经照亮过路。",
    "今年没有你的名字，你的球衣号码却出现在{teamCount} 座城市的看台上。{achievement}。球迷不需要名单来记得你，他们用每一件球衣投票。",
    "名人堂的名单翻过一页，没有你。你合上手机，看了看窗外，球场的灯还亮着。{achievement}。你笑了笑：灯还在，就没什么好遗憾的。",
    "你没有入选名人堂。当晚你睡得比想象中好，因为你梦见{firstTeam}的旧球馆，那里的门一直开着。{achievement}。醒来后你对自己说：门有很多种，我走进过最重要的一扇。",
    "落选消息传来时，你正和{lastTeam}的老队友吃烧烤。没有人提这件事，大家只聊以前。{achievement}。你忽然觉得，被一群记得你的人围着，比被一面墙记着更踏实。",
    "名人堂没有你的名字，但{teamCount} 座城市的球馆里，都有人能说出你的一场比赛。{achievement}。历史有时写在墙上，有时写在记忆里。你的那部分，写在后者。",
    "你没有入选，只是把这条消息转发给了{firstTeam}的启蒙教练，说：老师，我尽力了。他回：我知道。{achievement}。两个字，比一票更重。",
    "名单公布那天，你给自己放了一天假，去看了{lastTeam}的比赛，坐在普通看台。{achievement}。周围没有人认出你，你反而很开心：原来我还可以这么安静地看篮球。",
    "你落选名人堂，但{firstTeam}把一间训练馆以你的名字命名。{achievement}。你说：这比玻璃厅更实在，因为以后每天都会有孩子在这里流汗，像当年的我。",
    "名人堂没有收下你，你的号码却在{teamCount} 座城市的野球场里被反复穿着。{achievement}。你说：那面墙我进不去，但这些球场，我早就住进去了。",
    "你没有入选，第二天照常出现在训练馆，投到天黑。{achievement}。保安问你怎么还来，你说：我不知道去哪，这里最熟。",
    "名单公布时，你正在家里修老球鞋。{achievement}。你把它修好，穿上走了两步，说：鞋还能穿，路还能走。名人堂的门，不急。",
    "你落选了，但{lastTeam}的球馆在赛前播放了你的集锦，全场起立。{achievement}。那一刻你觉得，那些掌声就是你的名人堂。",
    "名人堂没有你的名字，你的名字却在{firstTeam}的小学课本里。老师让孩子们写“你敬佩的运动员”，很多孩子写了你。{achievement}。你说：这比投票更早，也更重要。",
    "你没有入选，只是安静地坐在家里，看了一晚自己以前的比赛。{achievement}。看完以后你关了电视，说：我打得挺好。然后把遥控器放下，没有遗憾。",
    "落选消息传来时，你正推着购物车在超市排队。{achievement}。结账时收银员认出了你，说：在我心里你早进了。你笑了：那我也算有票了。",
    "名人堂名单没有你，{teamCount} 座城市的球迷群里却都在发你的集锦。{achievement}。有人配文：他们漏了一个。你看到后，没有转发，只是点了个赞。",
    "你没有入选，但把消息告诉{lastTeam}的更衣室管理员时，他愣了很久，说：他们懂什么。{achievement}。你拍了拍他的肩：够了，有你这句就行。",
    "名单公布那天，你正在给孙子讲篮球。他问：爷爷，你进名人堂了吗？你说：没有。他说：那我长大以后，帮你进。{achievement}。你笑了，眼眶却热了。",
    "你落选了，可{firstTeam}的街角球场挂上了你的海报，配文是：我们的名人堂。{achievement}。你开车路过时停了一会儿，没有下车，只是按了两声喇叭。",
    "名人堂没有收下你，你却在整理旧物时找到一张字条：{lastTeam}某场比赛的现场票。{achievement}。你看着那张票，想起那晚全场喊你名字的声音。那面墙，装不下那个夜晚。",
    "你没有入选，但{teamCount} 支球队的官方账号都发了你的退役致敬。{achievement}。你回复了每一句谢谢。有人说不用，你说：他们记得我，我也得记得他们。",
    "落选那天，你的孩子问：爸爸，他们为什么没选你？你说：可能我打的时间还不够长。孩子说：我觉得你打得够久了。{achievement}。你摸摸他的头，没有说话。",
    "名人堂名单公布时，你正在球场边看年轻人训练。{achievement}。有人问你要不要看名单，你说：不看了。他们打球的姿势里，已经有我的名字了。",
    "你没有入选，但{firstTeam}的旧球馆里还挂着你的球衣，管理员每天都会擦一遍。{achievement}。你说：那间球馆，就是我的名人堂。",
    "名单没有你，你的启蒙教练打电话来，只说了一句：孩子，你尽力了。{achievement}。你握着电话，半天没说话。最后你说：嗯，我知道。",
    "你落选了，却在停车场被一个球迷拦住，他说：我看了你十年球。{achievement}。你给他签了名，他说：你是我心里的名人堂。你笑了笑：这句话，我收下了。",
    "名人堂没有你的名字，你却在{lastTeam}的赛季总结里被写进了队史章节。{achievement}。你说：一座城市愿意把你写进书里，比一面墙更让人安心。",
    "你没有入选，但那天晚上，{teamCount} 座城市的野球场同时有人在学你的招牌动作。{achievement}。你说：历史有很多种写法，我的那页，写在球场上。",
    "名单公布时，你正在帮{firstTeam}的社区修球架。{achievement}。有人告诉你结果，你说：知道了。然后继续拧螺丝。球架修好那天，孩子们在上面打了第一场球。",
    "你落选了，却收到一箱信，来自{teamList}的球迷。{achievement}。你一封一封拆开，没有着急。你说：这些信，比一张选票重多了。",
    "名人堂没有你的名字，你的老队友们在群里说：我们心里有票。{achievement}。你回了一句：够了。然后你们约好，下周一起吃饭。",
    "你没有入选，但{lastTeam}的球馆外，有人用粉笔在地上写你的名字。{achievement}。你路过时看见，没有擦，只是站了一会儿。第二天再去看，名字还在。",
    "名单公布那天，你正在教一个孩子投篮。他问你：叔叔，你难过吗？你说：有一点。他想了想，把球递给你：那你投一个吧。{achievement}。你投进了。你说：现在不难过了。",
    "你落选了，却把车开回了{firstTeam}的老街区。{achievement}。街角水果店的老板还记得你，递给你一个苹果，说：你打得很好。你咬了一口，说：谢谢。",
    "名人堂没有收下你，你把旧球衣捐给了{firstTeam}的社区中心。{achievement}。你说：球衣穿在我身上是荣誉，挂在那里，是更多孩子的起点。",
    "你没有入选，但你的名字被写进了{lastTeam}的十年最佳阵容。{achievement}。你说：一座城市记得我，比一座厅记得我更让我踏实。",
    "名单公布时，你在家里做晚饭。{achievement}。电话响了，你没有接，把菜炒完才看消息。你说：饭不能糊，名单可以等。",
    "你落选了，却收到{firstTeam}老球迷的一封信，里面是一张泛黄的球票。{achievement}。信上写着：这是我第一次看你的位置。你把它夹进书里，说：这是我的选票。",
    "名人堂没有你的名字，你却在整理房间时找到新秀年的训练手册，上面全是你的笔记。{achievement}。你翻了几页，说：原来我这么认真过。然后你把它放回抽屉，笑了一下。",
    "你没有入选，但{teamCount} 支球队的球馆里，都有人穿着你的号码。{achievement}。你说：那面墙收不下我，这些球衣装得下。",
    "名单公布那天，你在河边走了很久。{achievement}。风很大，你没有戴帽子。走完以后你回家，给家人做了顿饭，然后说：日子照过，篮球照爱。",
    "你落选了，但{firstTeam}的孩子们在球场墙上画了一幅你的壁画。{achievement}。你说：那面墙，比名人堂的墙离我更近。",
    "名人堂没有你的名字，你却在{lastTeam}的告别赛上听到了最长的一次欢呼。{achievement}。你站在中圈，想：这就是我的入场式。",
    "你没有入选，但你的球衣号码被{firstTeam}永久封存。{achievement}。你说：一座城愿意把号码留下来，我已经很满足了。",
    "名单公布时，你正在修车。{achievement}。朋友打来电话说结果，你说：知道了。修完车你洗了手，照了照镜子，说：我还是那个我。",
    "你落选了，却在梦里走进了一间大厅，墙上全是球迷的脸。{achievement}。醒来后你对家人说：我梦见自己进了名人堂。他们问：里面有什么？你说：全是记得我的人。",
    "名人堂没有你的名字，你却在{firstTeam}的老球馆门口发现一块新牌子，上面写着：本馆由热爱篮球的人维护。{achievement}。你摸了摸那块牌子，笑了。",
    "你没有入选，但你的启蒙教练把你们当年的合影放大，挂在了家里。{achievement}。他说：我不管名人堂，我只知道我最好的学生打了很多年好球。",
    "名单公布那天，你正在菜市场买菜。摊主认出你，说：你打球很好看。{achievement}。你说：谢谢。他问：今天有什么大事吗？你说：没有，就是普通的一天。",
    "你落选了，却在深夜收到一条消息，来自{lastTeam}的一个年轻球员：前辈，我穿着你的号码打的这场比赛。{achievement}。你回：号码是你的，未来也是你的。",
    "名人堂没有你，但你教过的孩子打进了职业联赛。{achievement}。他在采访里说：我的老师，是我心里的名人堂。你看到以后，没有转发，只是笑了笑。",
    "你没有入选，却把当年{firstTeam}的队徽放在书桌上，擦了擦。{achievement}。你说：不是每段历史都要进玻璃厅，有些历史，放在心里更重。",
    "名单公布那天，你正在河边跑步。{achievement}。跑完以后你停下来，对着河说：没进就没进，日子还长。然后你跑回家，洗了个澡。",
    "你落选了，但{lastTeam}的更衣室管理员把你的球衣挂在了最里面，说：这是我们更衣室的名人堂。{achievement}。你看到以后，只说了一句：谢谢。",
    "名人堂没有你的名字，你却收到一箱信，来自{teamCount} 座城市的球迷。{achievement}。你一封一封拆开，没有着急。你说：这些信，比一张选票重多了。",
    "你没有入选，却在小区球场被孩子们围住，要你教他们打球。{achievement}。你教了一下午。回家路上你对自己说：这就是我的名人堂。",
];

;

function buildHofAchievement(r) {
  return buildCareerAchievement(r);
}

function buildCareerAchievement(r) {
  var parts = [];
  if (r.championships > 0) parts.push(r.championships + ' 座总冠军');
  if (r.mvp > 0) parts.push(r.mvp + ' 次MVP');
  if (r.fmvp > 0) parts.push(r.fmvp + ' 次总决赛MVP');
  if (r.allNBA > 0) parts.push(r.allNBA + ' 次最佳阵容');
  if (r.allStar > 0) parts.push(r.allStar + ' 次全明星');
  if (parts.length === 0) parts.push('一段没有奖杯却足够完整的生涯');
  return '生涯里，你写下过' + parts.join('、');
}

function buildHofCopy(r) {
  var pool = r.hof ? HOF_COPY : HOF_FAIL_COPY;
  var idx = typeof r.hofCopyVariant === 'number' ? (r.hofCopyVariant % pool.length) : Math.floor(Math.random() * pool.length);
  var tpl = pool[idx] || pool[0];
  var vars = {
    achievement: buildHofAchievement(r),
    tier: r.tier || '',
    score: r.score || 0,
    games: r.games || 0,
    points: Math.round(r.points || 0),
    championships: r.championships || 0,
    mvp: r.mvp || 0,
    fmvp: r.fmvp || 0,
    dpoy: r.dpoy || 0,
    allNBA: r.allNBA || 0,
    allStar: r.allStar || 0,
    teamCount: r.teamCount || 0,
    longestTeam: getTeamName(r.longestTeam || r.team || ''),
    longestYears: r.longestYears || 0,
    firstTeam: r.firstTeam || '',
    lastTeam: r.lastTeam || '',
    teamList: r.teamList || '',
    seasonsCount: r.seasonsCount || 0,
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

// ── GOAT 历史地位：6 条专属文案 ──
var GOAT_HISTORY_COPY = [
    "关于GOAT的争论，从此多了一个绕不开的名字。{achievement}。媒体不再问你排第几，因为每一份名单都要先回答：你排在哪。",
    "历史地位公布那天，{lastTeam}的球馆没有放集锦，只放了一组数字：{mvp} 次MVP、{championships} 次总冠军、{fmvp} 次总决赛MVP。{achievement}。全场起立，没有争论。",
    "你用{seasonsCount} 年把“历史第一”从形容词变成具体的人。{achievement}。后来每一代球员被比较时，都会被问同一个问题：他像不像{firstTeam}走出来的那个人。",
    "GOAT级别的评价挂在你的名字后面，不是媒体给的，是{games} 场比赛一场一场挣来的。{achievement}。你让后来者明白，伟大不是一票一票选出来的，是一场一场打出来的。",
    "历史会争论很多排名，但你的位置已经没有悬念：{achievement}。{points} 分、{championships} 座总冠军，加上{seasonsCount} 年稳定的统治，人们终于不再问“是不是”，只问“什么时候开始”。",
    "你退役后，球迷之间最流行的不是你的集锦，而是同一句话：我们看过他打球。{achievement}。{longestTeam}把这段岁月写进队史，历史把你写进最前面的那页。",
];

;

function buildGoatHistoryCopy(r) {
  var pool = GOAT_HISTORY_COPY;
  var idx = typeof r.goatCopyVariant === 'number' ? (r.goatCopyVariant % pool.length) : Math.floor(Math.random() * pool.length);
  var tpl = pool[idx] || pool[0];
  var vars = {
    achievement: buildCareerAchievement(r),
    tier: r.tier || '',
    score: r.score || 0,
    games: r.games || 0,
    points: Math.round(r.points || 0),
    championships: r.championships || 0,
    mvp: r.mvp || 0,
    fmvp: r.fmvp || 0,
    dpoy: r.dpoy || 0,
    allNBA: r.allNBA || 0,
    allStar: r.allStar || 0,
    teamCount: r.teamCount || 0,
    longestTeam: getTeamName(r.longestTeam || r.team || ''),
    longestYears: r.longestYears || 0,
    firstTeam: r.firstTeam || '',
    lastTeam: r.lastTeam || '',
    teamList: r.teamList || '',
    seasonsCount: r.seasonsCount || 0,
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

// ── 历史百大：30 条入选 + 20 条未入选，围绕生涯经历客制化 ──
var TOP100_COPY = [
    "联盟公布新版NBA历史百大球星，你的名字被放进名单。{achievement}。年轻球迷开始回看你的集锦，老球迷则争论你到底该排第几。无论争论如何，有一件事已经确定：你的生涯不只是被记住，而是被放进历史。",
    "历史百大的名单不长，一百个名字挤了七十多年。{achievement}。你从{firstTeam}打到{lastTeam}，走过{teamCount} 座城市，终于挤进了这一百个名字里。",
    "历史百大公布那天，你的电话被消息塞满。{achievement}。你想起{firstTeam}那年没人认识你，也想起{lastTeam}谢幕那天全场起立。中间那段路，叫历史。",
    "有人说历史百大是给年轻人的答案，可你更愿意把它当成老人的情书。{achievement}。你打了 {games} 场、拿了 {points} 分，把 {longestYears} 年交给{longestTeam}。这封情书写得足够长。",
    "你入选了NBA历史百大。{achievement}。{teamList}的球迷都觉得自己有份，因为每一站你都留下过让他们骄傲的夜晚。",
    "历史百大不是终点，是后辈翻书时最先看到的页码。{achievement}。从{firstTeam}到{lastTeam}，你的页码写满了{teamCount} 座城市的故事。",
    "你入选百大那天，{longestTeam}的老队友发了条朋友圈：他排低了。{achievement}。你在那里打了 {longestYears} 年，这座城永远觉得你排低了。",
    "联盟把百大名单放上网，评论区吵了一整夜。{achievement}。你没有参与，只是想起{lastTeam}的最后一投——历史有时就是这么被写下来的。",
    "{achievement}。你打过 {games} 场、拿过 {points} 分，在 {teamCount} 支球队留下名字。历史百大的名单会更新，但你的名字已经写进了那本书的目录。",
    "历史百大公布时，你正在整理旧球衣。{achievement}。你翻出{firstTeam}的球衣，又翻出{lastTeam}的，中间隔着 {teamCount} 支球队和很长一段青春。",
    "你被写进历史百大，不是因为天赋，是因为没有停下。{achievement}。伤病、换队、低谷，你一样都没躲过，但你也一样都没让它们赢到最后。",
    "百大名单念到你时，播音员多停了一秒。{achievement}。那一秒里，{teamList}的球迷都在屏幕前挺直了背。",
    "你入选NBA历史百大，媒体开始盘点你的名场面。{achievement}。你最想让他们盘点的，是那些没人看见的训练馆清晨。",
    "历史百大的名单里，你的名字和传奇排在一起。{achievement}。你没有觉得配不上，因为每一座城市的更衣室都记得你是怎么走进来的。",
    "{achievement}。你让{lastTeam}的球迷相信小城也能出历史级球星，让{longestTeam}的旗帜多了一层含义。百大名单只是把这件事写了下来。",
    "你入选历史百大，可你仍然记得被裁掉边缘的那年夏天。{achievement}。你从那里一路走到这里，名单上的名字是你，路上的脚印也是你。",
    "百大名单是给后来人看的索引。{achievement}。翻到你的名字，就能读到{teamList}，读到 {teamCount} 段旅程，读到很长的一段热爱。",
    "你被写进历史百大。{achievement}。有人问你排第几，你回答：重要的是，我让很多人第一次明白，篮球可以这样打。",
    "历史百大公布，你的名字出现在中段。{achievement}。你把手机放下，去训练馆投了一组篮。历史不会等你，但你一直没停。",
    "{achievement}。你打了 {games} 场，走过{teamList}，在{lastTeam}谢幕。百大名单把你放进去，是因为你把篮球这件事，认真做了很久。",
    "你入选NBA历史百大的消息，让{lastTeam}的街角球馆贴满了海报。{achievement}。那里的孩子第一次知道：从这片球场出发，可以走到历史里。",
    "历史百大名单公布后，人们开始争你的排名。你没有参与争论，只是翻出一张{firstTeam}时期的照片。{achievement}。照片里那个年轻人还不知道，自己有一天会被放进这么漫长的名单里。",
    "进入历史百大，不代表故事结束，而是代表后来的孩子翻到这一页时，会停下来问一句：他是谁。{achievement}。然后会有人告诉他们，你打过{teamList}，你在{longestTeam}留下过 {longestYears} 年，你认真了很久。",
    "百大名单像一张很窄的门票，一百个名字挤在里面。{achievement}。你能站进去，不只是因为{points} 分和 {games} 场比赛，也是因为很多人提到那个时代时，绕不开你的名字。",
    "你的名字进入百大那天，{lastTeam}的球馆外有人贴了一张手写海报：我们看过他。{achievement}。这五个字比排名更直接，也更像球迷能给出的最高评价。",
    "历史把你放进一百个名字里，球迷却把你放进很多个具体夜晚。{achievement}。某个绝杀、某次复出、某个没人看好的赛季，才是你真正留在时间里的方式。",
    "你入选百大那天，{firstTeam}的老邻居们聚在一起看新闻，像看一个孩子考上了最好的学校。{achievement}。你打电话回去，只说了一句：我到家了。",
    "历史百大的名单上，你的名字旁边没有注释。{achievement}。你反而笑了：不需要注释了，{teamCount} 支球队、{games} 场比赛，就是最好的注释。",
    "你被写进百大，新闻里放了你的集锦，背景音乐很响。{achievement}。你关掉声音，自己配了一句：这段路，我走了很久。",
    "百大名单公布那天，你在超市被球迷拦住，他说：我在名单上看到你了。{achievement}。你说：嗯，我也看到了。两个人都笑了，像分享同一个秘密。",
    "你入选历史百大后，{longestTeam}的球馆把纪念海报挂了一整面墙。{achievement}。你站在那里看了很久，说：这面墙，比我高。",
    "历史百大不是你的终点，是你留给后人的路标。{achievement}。你从{firstTeam}走到{lastTeam}，{teamCount} 段旅程，最后变成他们可以抬头看见的坐标。",
    "你进入百大那天，一个年轻球员发消息问你：怎么才能像你一样？你回：先打好下一场。{achievement}。后来他成了全明星。你说：我说的下一场，是一千场。",
    "百大名单公布后，你收到一封老对手的祝贺：你配。{achievement}。你回：你也差一点。他说：差一点也是差。你们约好，下次一起看百大名单里的新名字。",
    "你入选历史百大，但你在意的不是排名，是{firstTeam}那个孩子终于可以骄傲地跟同学说：他是我家乡的。{achievement}。你说：这就是我进百大的意义。",
    "历史把你写进名单，你把历史写进生活。{achievement}。百大公布那天，你照常早起，给家人做早饭，然后去球场看年轻人训练。历史没有让你变，只是确认了你一直是谁。",
    "你入选百大那天，球馆里的广播念到你的名字，全场起立。{achievement}。你坐在包厢里，没有下去，只是朝看台挥了挥手。你知道，那些掌声不是给排名的，是给你这个人的。",
    "历史百大的名单翻到你的名字，像翻到一段时代的分界线。{achievement}。你在这边，后辈在那边。你笑了笑，把接力棒留在了线上。",
    "你被写进百大，媒体问你什么感觉。你说：像做完一场很长的梦，醒来发现梦是真的。{achievement}。从{firstTeam}到{lastTeam}，这场梦，你做了{seasonsCount} 年。",
    "百大名单公布时，你在跟老队友视频。他盯着名单看了半天，说：怎么才一百？{achievement}。你笑了：够了。他说：不够，你值得单独一页。",
    "你入选历史百大，但没有发朋友圈。{achievement}。你只是把消息告诉了{firstTeam}的启蒙教练。他在电话里说：我就知道。你们沉默了一会儿，像一起走完了一段路。",
    "历史百大是一本很厚的书，你的名字在里面。{achievement}。后辈们翻到那一页，会看到{teamCount} 支球队、{games} 场比赛、{points} 分。他们会问：这个人是谁？会有人回答：他让篮球变得认真。",
    "你进入百大那天，{lastTeam}的球迷在球场外挂起横幅：历史欠他一个更高的排名。{achievement}。你看到后说：他们总觉得我低了，我也觉得他们低了，我们是同一群人。",
    "百大名单公布，你的名字排在很多传奇中间。{achievement}。你没有觉得突兀，因为你记得自己是怎么一场一场追上他们的。那份记忆，比名单更有底气。",
    "你入选历史百大，却把它当成一件普通事。{achievement}。第二天你照常去球场，投了一组篮，然后回家。你说：名字留在历史上，日子还要过在生活里。",
    "历史百大的名单很长，你的名字在中间，故事却在很多人的心里。{achievement}。你说：排第几我记不住，但{firstTeam}那年的第一场，我永远记得。",
    "你被写进百大后，一个孩子写信问你：怎么才能变得伟大？你回信：先学会不放弃。{achievement}。你附了一句：我也没有多伟大，我只是没有放弃。",
    "百大名单公布那天，你正在给母亲做饭。{achievement}。她问你：今天是什么日子？你说：普通日子。她说：我看新闻了，你上了那个一百人的名单。你说：嗯，但那不影响我给你做饭。",
    "你入选历史百大，但更让你高兴的是，{firstTeam}的旧球馆门口挂了一张你的照片。{achievement}。你说：一百个人的名单里，有很多城市；但那张照片下面，只有一条街的孩子们。",
    "历史百大公布后，你和老队友们开了个视频会。有人举着名单，把你的名字圈出来。{achievement}。你说：别圈了，字都看不清了。他说：就要圈，这是我兄弟。",
    "你被写进百大，却没有告诉任何人。直到{lastTeam}的球馆在中场休息时念到你的名字，全场才知道。{achievement}。你坐在看台上，被镜头找到，只好站起来挥了挥手。",
    "百大名单公布那天，你在球馆里捡到一个篮球，上面写着：未来的一百大。{achievement}。你把它放回球架，说：这球会比我更远。",
    "你入选历史百大，新闻标题很正式，但你只记住了{firstTeam}邻居阿姨的那句话：这孩子，从小打球我就看出来了。{achievement}。你笑着回：您当时说我打得像赶鸭子。",
    "历史把你写进名单，你把名单写进记忆。{achievement}。你记得的不是排名，是{teamList}每一个主场夜的声音。那些声音，才是你真正的历史。",
    "你进入百大那天，一个解说员说了三分钟你的故事，最后说：这就是为什么我们爱篮球。{achievement}。你听完，把电视关了，没有告诉任何人。",
    "百大名单公布，你的名字在第九十几位。朋友说太低了，你说：能进就行。{achievement}。你顿了顿：而且，这样后辈们往上爬的时候，会先路过我。",
    "你入选历史百大，却在当天晚上去了{firstTeam}的野球场，和孩子们打了半场。{achievement}。有人认出你，你说：别喊，打完这局再说。",
    "历史百大的名单上，你的名字被灯光照到，你想起{lastTeam}最后一战的中圈。{achievement}。两个灯光重合在一起，一个开始，一个收尾。",
    "你被写进百大，媒体采访你，问你最想对谁说什么。你说：对{firstTeam}的食堂阿姨说，我上历史百大了，你当年多给我的那勺饭，没白给。",
    "百大名单公布那天，你收到一封手写信，来自一个年轻球员：我会努力追上你的名字。{achievement}。你回了一行字：我等你，也在前面等你超过。",
    "你入选历史百大，却把奖杯放在储物间里。{achievement}。家人问为什么不摆出来，你说：摆出来会骄傲。然后你把它擦了擦，放回原处。",
    "历史百大不是给你的答案，是给后来者的提问：你们能不能也这样认真？{achievement}。你从{firstTeam}到{lastTeam}，把这个问题回答了{seasonsCount} 年。",
    "你进入百大那天，球馆里放了你新秀赛季的画面，全场都在笑。{achievement}。你说：那时候我确实很笨，但笨人有笨人的走法，走得久，也能走到历史里。",
    "百大名单公布后，你在车库找到一张旧球票，是{firstTeam}的第一场。{achievement}。你把它拍下来发给老队友：你看，从这张票，到那个名单。",
    "你入选历史百大，新闻里把你的生涯剪成三分钟。{achievement}。你看了两遍，说：剪漏了。家人问漏了什么，你说：漏了那些输球后坐在更衣室不说话的夜晚。",
    "历史百大名单念到你时，{longestTeam}的酒吧里所有人都举起了杯子。{achievement}。你在那里打了 {longestYears} 年，那座城用一杯敬你，也用整晚。",
    "你被写进百大，却没有去参加任何庆祝活动。{achievement}。你说：我把庆祝留到{firstTeam}重建完成那天。那天，我会回去，和他们一起看新球馆的第一场比赛。",
    "百大名单公布那天，你正在教孙子投篮。{achievement}。他问：爷爷，一百大是什么？你说：是一本很长的书里，有爷爷的名字。他说：那我以后也要在里面。你说：好，爷爷等你。",
    "你入选历史百大，但你的手机里没有存那份名单。{achievement}。你说：我存的是{teamList}的每一场比赛。名单会更新，那些夜晚不会。",
    "历史百大的名单很正式，你的回应却很家常：谢谢大家，我继续去生活了。{achievement}。你没有解释，因为你相信，认真的人不需要长篇大论。",
    "你进入百大那天，{firstTeam}的老球场管理员打来电话，只说了一句：当年那个练到最晚的孩子，上榜了。{achievement}。你说：因为您总给我留门。",
    "你被写进历史百大，媒体说你定义了某个时代。{achievement}。你笑了：我没有定义时代，我只是在每一个时代里，都认真地打了球。",
    "百大名单公布后，你把名单打印出来，贴在训练馆的墙上。{achievement}。年轻人问为什么贴这里，你说：让他们知道，历史不是远方的墙，是每天的训练。",
    "你入选历史百大，却把时间花在给{firstTeam}的孩子回信上。{achievement}。你说：一百个名字里，可能只有一个会被他们记住。我想让他们记住的是：他愿意回信。",
    "历史把你写进一百个名字，你把一百个名字写进生活。{achievement}。名单公布那天，你照常去超市，照常被认出来，照常给球迷签名，然后照常回家。",
    "你进入百大，但真正让你开心的是，{lastTeam}的食堂阿姨说：今天给你加两个菜，庆祝一下。{achievement}。你说：阿姨，我退役了。她说：那也加。",
    "百大名单公布那天，你一个人在球馆里坐着。{achievement}。有人问你为什么不来庆祝，你说：我想先和这个球馆独处一会儿。它陪我太久了。",
    "你入选历史百大，新闻里提到你的次数很多，但你没有接受采访。{achievement}。你说：我把话说在比赛里了。现在再说，反而少了。",
    "历史百大是一份名单，也是一份家谱。{achievement}。你从{firstTeam}出发，在{lastTeam}落脚，中间路过{teamList}。今天，你被写进了这份家谱。",
    "你被写进百大，却在同一天收到{firstTeam}老球迷的生日祝福。{achievement}。你说：一百大的名单我记不住，但你的生日我记得。祝你健康。",
    "百大名单公布那天，你正在看年轻人训练。{achievement}。教练问你感觉怎么样，你说：很好。名单是过去的事，他们才是未来的事。",
    "你入选历史百大，却没有告诉任何人，直到{lastTeam}的播报员在比赛前念出你的名字。{achievement}。全场起立，你坐在包厢里，朝他们举了举帽子。",
    "历史百大名单上，你的名字和很多名字排在一起，但你知道，你在他们中间不是偶然。{achievement}。{games} 场比赛，每一场都是一块台阶。",
    "你进入百大那天，一个年轻人问：怎么才能被写进历史？你说：先别想历史。{achievement}。他说：那想什么？你说：想下一场怎么打好。",
    "你入选历史百大，却把当天的时间留给了家人。{achievement}。你说：名单是工作，他们是生活。工作我做了{seasonsCount} 年，生活，我要做一辈子。",
    "百大名单公布后，你在{firstTeam}的旧球馆外拍了一张照，发在群里，配文：从这里出发。{achievement}。老队友们回了一串：值了。",
    "你被写进历史百大，但你知道，真正重要的不是这一百个名字，是名单外那些每晚看球的人。{achievement}。你说：他们才是历史的原因。",
    "历史百大公布那天，你收到一个老对手的短信：恭喜，虽然我觉得你排低了。{achievement}。你回：你也觉得我低？他说：我们那个年代的人，都觉得你低。",
    "你入选百大，但没有去领任何荣誉，只是请{teamList}的老队友们吃了顿饭。{achievement}。你说：名单是我一个人的，饭是大家的。",
    "历史把你写进名单，你把名字写进{firstTeam}的社区球场。{achievement}。你捐了一块篮板，上面写着：从这里，也可以走到历史百大。",
    "你进入百大那天，一个小孩问你：叔叔，你能教我打球吗？{achievement}。你教了他一小时。后来他说：我要像你一样。你说：像我一样认真就行。",
    "百大名单公布，你的名字出现时，你正在厨房洗碗。{achievement}。家人喊你，你擦了擦手过去看，然后说：哦，那晚上加个菜吧。",
    "你入选历史百大，却在整理衣柜时发现一件{firstTeam}的旧训练服，上面还有汗渍。{achievement}。你拿着它站了很久，说：这才是我的百大。",
    "历史百大是一百个人的名单，你只占其中一行。{achievement}。但那一行里，有{teamCount} 支球队、{games} 场比赛、{points} 分，和{seasonsCount} 年没有停过的脚步。",
    "你被写进百大，却没有发任何动态。{achievement}。你只在深夜给{firstTeam}的启蒙教练发了一条：老师，名单上有我了。他回：我早看见了，睡吧。",
    "历史百大名单公布那天，你在球馆门口遇见一个穿你球衣的小孩。他问：你就是那个一百大吗？你说：我是那个打了很多年球的人。他说：那我以后也要打很多年。{achievement}。你摸摸他的头：好。",
    "你入选历史百大，但没有发任何动态。{achievement}。你只在深夜给{firstTeam}的启蒙教练发了一条：老师，名单上有我了。他回：我早看见了，睡吧。",
    "历史百大名单公布后，你在车库找到一张旧球票，是{firstTeam}的第一场。{achievement}。你把它拍下来发给老队友：你看，从这张票，到那个名单。",
    "你入选历史百大，新闻里把你的生涯剪成三分钟。{achievement}。你看了两遍，说：剪漏了。家人问漏了什么，你说：漏了那些输球后坐在更衣室不说话的夜晚。",
    "历史百大名单念到你时，{longestTeam}的酒吧里所有人都举起了杯子。{achievement}。你在那里打了 {longestYears} 年，那座城用一杯敬你，也用整晚。",
    "你被写进百大，却没有去参加任何庆祝活动。{achievement}。你说：我把庆祝留到{firstTeam}重建完成那天。那天，我会回去，和他们一起看新球馆的第一场比赛。",
    "百大名单公布那天，你正在教孙子投篮。{achievement}。他问：爷爷，一百大是什么？你说：是一本很长的书里，有爷爷的名字。他说：那我以后也要在里面。你说：好，爷爷等你。",
    "你入选历史百大，但你的手机里没有存那份名单。{achievement}。你说：我存的是{teamList}的每一场比赛。名单会更新，那些夜晚不会。",
    "历史百大的名单很正式，你的回应却很家常：谢谢大家，我继续去生活了。{achievement}。你没有解释，因为你相信，认真的人不需要长篇大论。",
    "你进入百大那天，{firstTeam}的老球场管理员打来电话，只说了一句：当年那个练到最晚的孩子，上榜了。{achievement}。你说：因为您总给我留门。",
    "你被写进历史百大，媒体说你定义了某个时代。{achievement}。你笑了：我没有定义时代，我只是在每一个时代里，都认真地打了球。",
    "百大名单公布后，你把名单打印出来，贴在训练馆的墙上。{achievement}。年轻人问为什么贴这里，你说：让他们知道，历史不是远方的墙，是每天的训练。",
    "你入选历史百大，却把时间花在给{firstTeam}的孩子回信上。{achievement}。你说：一百个名字里，可能只有一个会被他们记住。我想让他们记住的是：他愿意回信。",
    "历史把你写进一百个名字，你把一百个名字写进生活。{achievement}。名单公布那天，你照常去超市，照常被认出来，照常给球迷签名，然后照常回家。",
    "你进入百大，但真正让你开心的是，{lastTeam}的食堂阿姨说：今天给你加两个菜，庆祝一下。{achievement}。你说：阿姨，我退役了。她说：那也加。",
    "百大名单公布那天，你一个人在球馆里坐着。{achievement}。有人问你为什么不来庆祝，你说：我想先和这个球馆独处一会儿。它陪我太久了。",
    "你入选历史百大，新闻里提到你的次数很多，但你没有接受采访。{achievement}。你说：我把话说在比赛里了。现在再说，反而少了。",
    "历史百大是一份名单，也是一份家谱。{achievement}。你从{firstTeam}出发，在{lastTeam}落脚，中间路过{teamList}。今天，你被写进了这份家谱。",
    "你被写进百大，却在同一天收到{firstTeam}老球迷的生日祝福。{achievement}。你说：一百大的名单我记不住，但你的生日我记得。祝你健康。",
    "百大名单公布那天，你正在看年轻人训练。{achievement}。教练问你感觉怎么样，你说：很好。名单是过去的事，他们才是未来的事。",
    "你入选历史百大，却没有告诉任何人，直到{lastTeam}的播报员在比赛前念出你的名字。{achievement}。全场起立，你坐在包厢里，朝他们举了举帽子。",
];

;

var TOP100_FAIL_COPY = [
    "新版NBA历史百大球星名单公布，你没有进入最终名单。但媒体仍把你称为一个时代的重要名字：不是所有传奇都需要排名证明。{achievement}。",
    "百大名单没有你，可{teamList}的球迷不答应。{achievement}。你打过 {teamCount} 支球队，每一座都愿意为你把排名重排一次。",
    "你落选历史百大。你关掉手机，想起{lastTeam}那晚的欢呼。{achievement}。名单只有一百个位置，但你占满了许多人的记忆。",
    "没有入选百大，你并不意外。{achievement}。你只是替{firstTeam}的老教练遗憾：他说你早该是。",
    "历史百大翻完了，没有你的名字。{achievement}。可{teamCount} 座城市的十年最佳阵容里，都有你。",
    "你不在百大名单里，评论员说你的巅峰短了一点。{achievement}。你的巅峰可能短，但你在{longestTeam}的 {longestYears} 年，足够长。",
    "你落选百大，{lastTeam}的球迷却在客场高喊你的名字。{achievement}。历史排名是官方写的，热爱是球迷写的。",
    "百大名单里没有你，但有一年最佳阵容里有你，有一年冠军游行的队伍里有你。{achievement}。历史有很多种写法。",
    "你没有被写进历史百大，却被写进了{firstTeam}的队史。{achievement}。对一座城市来说，那就是它的历史百大。",
    "落选消息传来时，你正在给年轻球员讲自己怎么防住那些百大球员。{achievement}。你笑着说：名单里没有我，但名单里的人，我都认真防过。",
    "你没有进入百大。{achievement}。你打了 {games} 场、拿了 {points} 分，在{teamCount} 支球队留下故事。数字替你把话说了。",
    "历史百大没有你的名字，你的号码却印在{teamCount} 座城市的看台上。{achievement}。球迷的名单比官方名单更长。",
    "百大名单公布，你排在第一百零一名的讨论里。{achievement}。你笑了笑：一百零一，说明有人愿意为我争。",
    "你不在百大里，但你的集锦还在被年轻人模仿。{achievement}。历史有时不是名单，是有人还在练你的动作。",
    "落选那天，{longestTeam}的街头贴出一张海报：他不在百大，他在我们心里。{achievement}。你把 {longestYears} 年留在了那里，他们把这行字还给了你。",
    "你没有被写进历史百大，却被写进了很多人的第一场篮球赛。{achievement}。{teamCount} 支球队的比赛里，都有人为了看你而买票。",
    "你没有进入百大，但你把{firstTeam}的孩子带进了NBA。{achievement}。有些历史不写在名单上，写在下一代人的球衣上。",
    "百大名单没有你，但你的名字被写进了{lastTeam}的荣誉走廊。{achievement}。一座城市记得你，比一百个名字更具体。",
    "你落选百大那天，收到了{teamCount} 条祝福。{achievement}。你说：谢谢，虽然没进名单，但你们的消息，比名单长。",
    "历史百大没有你，你的老队友们在群里吵了一晚：谁排的名单？{achievement}。你回了一句：行了，吃烧烤去。他们第二天真的去了。",
    "你没有进入百大，但{firstTeam}的社区球馆挂上了你的壁画。{achievement}。你说：一百个名字挂在书里，我的名字挂在街上，谁更近，说不准。",
    "名单公布那天，你正在给孙子讲自己怎么抢篮板。{achievement}。他问：爷爷，你进了百大吗？你说：没有。他说：那你还是我的一百大。",
    "你落选百大，却在超市被一个年轻人拦住：我从小看你打球。{achievement}。你给他签了名。他说：名单是他们的，你是我记忆里的。你点点头：那也够了。",
    "历史百大没有你的名字，但你被写进了{lastTeam}的告别赛季手册。{achievement}。你说：那本手册，比一百个名字更让我安心。",
    "你没有入选百大，但你把所有荣誉奖杯擦了一遍，摆回原处。{achievement}。你说：一百个人的名单放不下，我的奖杯架还放得下。",
    "落选那天，你收到一张明信片，寄自{firstTeam}，上面写着：我们的百大。{achievement}。你把它贴在冰箱上，每天都能看见。",
    "百大名单公布时，你正在公园里打太极。{achievement}。有人告诉你了结果，你说：哦。然后继续打完那套。收势的时候，你笑了一下。",
    "你没有被写进历史百大，但你的球衣被{firstTeam}退役了。{achievement}。你说：一件球衣，比一行名字更重。",
    "名单没有你，你的启蒙教练打来电话：在我心里，你排第一。{achievement}。你握着电话，半天才说：够了，老师。",
    "你落选百大，但{lastTeam}的球馆在赛前放了一段你的集锦，全场起立。{achievement}。那一刻你明白，有些名单写在纸上，有些写在掌声里。",
    "历史百大没有你的名字，你的名字却出现在{firstTeam}的地名里：那条街改叫了你的名字。{achievement}。你说：一百个名字挤一本书，我的名字住一条街。",
    "你没有进入百大，却把时间花在陪{lastTeam}的年轻球员练球上。{achievement}。你说：名单是过去的，他们才是未来的。",
    "落选那天，你的家人做了一桌菜，没人提名单。{achievement}。你说：这桌菜，比一百个名字香。",
    "百大名单没有你，但你在{teamCount} 座城市都有球迷会。{achievement}。你说：官方名单一百个，民间名单三千个，我选民间。",
    "你不在百大里，却被写进了很多人的毕业作文。{achievement}。老师让学生写“最想成为的人”，有人写了你。你说：这才是历史。",
    "名单公布那天，你在训练馆教年轻人卡位。{achievement}。有人问你看名单了吗，你说：看了，没有我。然后你示范了一个卡位，说：但我还在教你怎么站稳。",
    "你落选百大，但你的旧号码被{lastTeam}永久保留。{achievement}。你说：一个号码，比一行名字活得久。",
    "历史百大没有你，你的纪录片却已经拍了两部。{achievement}。你说：一百个名字等下一版，我的故事已经有人想听了。",
    "你没有进入百大，却在小区球场被孩子们围着要签名。{achievement}。你签了一个小时。有人问累不累，你说：不累，这些签名比名单实在。",
    "名单公布那天，你正给老母亲读新闻。读到没有你的名字，她问：是不是他们漏了？{achievement}。你说：可能吧。她说：回头我给他们打电话。",
    "你落选百大，但{firstTeam}的旧队友们给你办了一场聚会，主题是“我们的一百大”。{achievement}。你笑着举杯：这名字起得好。",
    "百大名单没有你，你的球衣却在{teamCount} 个博物馆里展出。{achievement}。你说：博物馆不收名单，收球衣。",
    "你不在名单里，但一个年轻球员说，他的打法像你。{achievement}。你听完，想了很久，说：这可能比一百个名字都重要。",
    "你没有进入百大，却在{lastTeam}的告别赛上听到了最长的欢呼。{achievement}。你站在中圈，想：这就是我的排名。",
    "名单公布那天，你在球馆门口遇见一个小球迷，他穿着你的球衣。{achievement}。他说：叔叔，他们没选你，我选你。你说：谢谢你，我也选我自己。",
    "你落选百大，但{firstTeam}把新训练馆命名为你的名字。{achievement}。你说：一百个名字写在书里，我的名字写在门上，每天都有孩子推门进去。",
    "历史百大没有你，你的老对手在采访里说：他应该在我的位置。{achievement}。你看到后，发了条消息：别让记者听到。他回：我认真的。",
    "你没有进入百大，却在整理房间时发现一张旧海报：{firstTeam}全队合影，你在角落。{achievement}。你看了很久，说：那一年，没有人在意我。今天，也不在意。",
    "名单公布时，你正在河边钓鱼。{achievement}。朋友打来电话，你说：鱼上钩了。他说：你没进百大。你说：那正好，今天的鱼归我了。",
    "你落选百大，但{teamList}的球迷论坛里，你的帖子盖了几千层楼。{achievement}。你一条一条看完，没有回复，只在最后点了一个赞。",
    "百大名单没有你，你却出现在{firstTeam}的十年纪录片里。{achievement}。导演说：你代表了一座城的十年。你说：那比一百个名字久。",
    "你没有进入百大，却在球馆门口给一个哭鼻子的孩子签了名。{achievement}。孩子说：他们没选你。你说：那你会记得我吗？他点头。你说：那你就是我的名单。",
    "名单公布那天，你给自己买了一双新球鞋。{achievement}。你说：旧的磨穿了，新的还能走。一百个名字翻篇了，我的路还长。",
    "你落选百大，但{lastTeam}的食堂阿姨给你留了一碗汤。{achievement}。她说：没进就没进，汤还是要喝。你喝完，说：比名单暖。",
    "历史百大没有你，你的故事却进了教科书，作为“坚持”的案例。{achievement}。你说：那比一百个名字有用。",
    "你没有进入百大，但在{teamCount} 座城市都有以你命名的篮球营。{achievement}。你说：孩子们在里面学到的，比名单上的名字多。",
    "名单公布那天，你正在教邻居小孩运球。{achievement}。小孩说：叔叔，你没进一百大。你说：嗯。他想了想：那你教我，我以后进。你说：好。",
    "你落选百大，却收到一封来自{firstTeam}的信，里面是社区孩子们画的你。{achievement}。你把它裱起来，挂在客厅。家人问是什么，你说：我的百大。",
    "百大名单没有你，你的球衣却在{lastTeam}的告别展览里。{achievement}。你说：名单会过时，球衣不会。",
    "你没有进入百大，但你的每一次复出都被媒体写成了传奇。{achievement}。你说：他们写了很多，我只是想打球。",
    "名单公布那天，你在健身房里练到力竭。{achievement}。教练问你还练什么，你说：练一个没进百大的人，也要好好活着。",
    "你落选百大，但{firstTeam}的孩子们在球场上喊你的名字当口号。{achievement}。你说：那比一百个名字更响。",
    "历史百大没有你，你却把一枚戒指送给了{lastTeam}的保安，因为他每天第一个跟你打招呼。{achievement}。他说这太贵重，你说：一百个名字里没有你，但我的戒指有你。",
    "你没有进入百大，却在深夜收到一条消息，来自一个你教过的孩子：教练，我进国家队了。{achievement}。你回：比我进百大高兴。他说：是你带我进来的。",
    "历史百大没有你，但你的球衣被{firstTeam}退役了。{achievement}。你说：一件球衣，比一行名字更重。",
    "名单没有你，你的启蒙教练打来电话：在我心里，你排第一。{achievement}。你握着电话，半天才说：够了，老师。",
    "你落选百大，但{lastTeam}的球馆在赛前放了一段你的集锦，全场起立。{achievement}。那一刻你明白，有些名单写在纸上，有些写在掌声里。",
    "历史百大没有你的名字，你的名字却出现在{firstTeam}的地名里：那条街改叫了你的名字。{achievement}。你说：一百个名字挤一本书，我的名字住一条街。",
    "你没有进入百大，却把时间花在陪{lastTeam}的年轻球员练球上。{achievement}。你说：名单是过去的，他们才是未来的。",
    "落选那天，你的家人做了一桌菜，没人提名单。{achievement}。你说：这桌菜，比一百个名字香。",
    "百大名单没有你，但你在{teamCount} 座城市都有球迷会。{achievement}。你说：官方名单一百个，民间名单三千个，我选民间。",
    "你不在百大里，却被写进了很多人的毕业作文。{achievement}。老师让学生写“最想成为的人”，有人写了你。你说：这才是历史。",
    "名单公布那天，你在训练馆教年轻人卡位。{achievement}。有人问你看名单了吗，你说：看了，没有我。然后你示范了一个卡位，说：但我还在教你怎么站稳。",
    "你落选百大，但你的旧号码被{lastTeam}永久保留。{achievement}。你说：一个号码，比一行名字活得久。",
];

;

function buildTop100Copy(r) {
  var pool = r.top100 ? TOP100_COPY : TOP100_FAIL_COPY;
  var idx = typeof r.top100CopyVariant === 'number' ? (r.top100CopyVariant % pool.length) : Math.floor(Math.random() * pool.length);
  var tpl = pool[idx] || pool[0];
  var vars = {
    achievement: buildCareerAchievement(r),
    tier: r.tier || '',
    score: r.score || 0,
    games: r.games || 0,
    points: Math.round(r.points || 0),
    championships: r.championships || 0,
    mvp: r.mvp || 0,
    fmvp: r.fmvp || 0,
    dpoy: r.dpoy || 0,
    allNBA: r.allNBA || 0,
    allStar: r.allStar || 0,
    teamCount: r.teamCount || 0,
    longestTeam: getTeamName(r.longestTeam || r.team || ''),
    longestYears: r.longestYears || 0,
    firstTeam: r.firstTeam || '',
    lastTeam: r.lastTeam || '',
    teamList: r.teamList || '',
    seasonsCount: r.seasonsCount || 0,
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

// 游戏内历史百大基准榜。最终结算会按生涯历史分把主角插入对应名次，
// 其后席位依次顺延。这是游戏评价模型，不代表联盟或媒体的官方排名。
var LEGACY_TOP100_BASELINE = [
  '迈克尔·乔丹','勒布朗·詹姆斯','卡里姆·阿卜杜尔-贾巴尔','比尔·拉塞尔','魔术师约翰逊',
  '拉里·伯德','威尔特·张伯伦','蒂姆·邓肯','科比·布莱恩特','沙奎尔·奥尼尔',
  '斯蒂芬·库里','哈基姆·奥拉朱旺','奥斯卡·罗伯特森','凯文·杜兰特','杰里·韦斯特',
  '摩西·马龙','朱利叶斯·欧文','凯文·加内特','德克·诺维茨基','扬尼斯·阿德托昆博',
  '大卫·罗宾逊','尼古拉·约基奇','卡尔·马龙','查尔斯·巴克利','埃尔金·贝勒',
  '德维恩·韦德','科怀·伦纳德','伊塞亚·托马斯','克里斯·保罗','约翰·斯托克顿',
  '斯科蒂·皮蓬','约翰·哈夫利切克','里克·巴里','史蒂夫·纳什','阿伦·艾弗森',
  '帕特里克·尤因','鲍勃·佩蒂特','詹姆斯·哈登','拉塞尔·威斯布鲁克','克莱德·德雷克斯勒',
  '乔治·麦肯','凯文·麦克海尔','鲍勃·库西','杰森·基德','加里·佩顿',
  '乔治·格文','埃尔文·海耶斯','保罗·皮尔斯','雷吉·米勒','德怀特·霍华德',
  '安东尼·戴维斯','雷·阿伦','卡梅隆·安东尼','多米尼克·威尔金斯','戴夫·考恩斯',
  '沃尔特·弗雷泽','威利斯·里德','韦斯·昂塞尔德','内特·瑟蒙德','鲍勃·麦卡杜',
  '比尔·沃顿','戴夫·德布斯切尔','萨姆·琼斯','哈尔·格里尔','多尔夫·谢伊斯',
  '保罗·阿里金','比利·坎宁安','皮特·马拉维奇','厄尔·门罗','杰里·卢卡斯',
  '罗伯特·帕里什','詹姆斯·沃西','丹尼斯·罗德曼','托尼·帕克','马努·吉诺比利',
  '保罗·加索尔','文斯·卡特','特雷西·麦克格雷迪','格兰特·希尔','阿隆佐·莫宁',
  '迪肯贝·穆托姆博','本·华莱士','克里斯·韦伯','亚历克斯·英格利什','伯纳德·金',
  '鲍勃·兰尼尔','悉尼·蒙克利夫','丹尼斯·约翰逊','乔·杜马斯','阿蒂斯·吉尔摩',
  '康尼·霍金斯','戴夫·宾','内特·阿奇博尔德','比尔·沙曼','兰尼·威尔肯斯',
  '切特·沃克','杰克·西克马','阿德里安·丹特利','克里斯·波什','德雷蒙德·格林'
];

function calculateLegacyHistoricalRank(score, goat) {
  score = Math.max(0, Number(score) || 0);
  if (goat) return 1;
  if (score >= 220) return 2;
  if (score >= 180) return 3 + Math.round((219 - Math.min(219, score)) / 39 * 7);
  if (score >= 155) return 11 + Math.round((179 - score) / 24 * 9);
  if (score >= 140) return 21 + Math.round((154 - score) / 14 * 79);
  return 101 + Math.round((139 - Math.min(139, score)) / 139 * 49);
}

function buildLegacyScoreBreakdown(r) {
  var c = STATE.career || {};
  var teamYears = Number(r.longestYears || r.teamYears) || 0;
  var flags = c.flags || {};
  return {
    championships: (Number(r.championships) || 0) * 18,
    fmvp: (Number(r.fmvp) || 0) * 14,
    mvp: (Number(r.mvp) || 0) * 16,
    dpoy: (Number(r.dpoy) || 0) * 10,
    allNBA: (Number(r.allNBA) || 0) * 5,
    allStar: (Number(r.allStar) || 0) * 3,
    points: Math.min(35, Math.floor((Number(r.points) || 0) / 2500)),
    games: Math.min(18, Math.floor((Number(r.games) || 0) / 120)),
    loyalty: teamYears >= 8 ? 10 : 0,
    peak: STATE.finalOVR >= 94 ? 8 : 0,
    farewell: (flags.finalShow ? 2 : 0) - (flags.finalHurt ? 1 : 0) + (flags.farewellHomeTeam ? 3 : 0) + (flags.countdownLegend ? 2 : 0)
  };
}

function ensureLegacyRankingDetails(r) {
  if (!r) return r;
  r.historicalRank = calculateLegacyHistoricalRank(r.score, r.goat);
  r.top100 = r.historicalRank <= 100;
  r.rankStart = 150;
  r.rankClimbed = Math.max(0, r.rankStart - r.historicalRank);
  r.rankGapToTop100 = Math.max(0, r.historicalRank - 100);
  r.scoreBreakdown = r.scoreBreakdown || buildLegacyScoreBreakdown(r);
  return r;
}

function escapeLegacyHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
  });
}

function renderLegacyTop100Ranking(r) {
  ensureLegacyRankingDetails(r);
  var rank = Math.max(1, Number(r.historicalRank) || 101);
  var playerName = escapeLegacyHtml(typeof getHupuDisplayName === 'function' ? getHupuDisplayName() : '我的球员');
  var avatar = escapeLegacyHtml(typeof getHupuAvatarUrl === 'function' ? getHupuAvatarUrl() : '');
  var baseline = LEGACY_TOP100_BASELINE.slice();
  var entries = [];
  for (var bi = 0; bi < baseline.length; bi++) {
    if (entries.length + 1 === rank) entries.push({ isPlayer: true, name: playerName });
    entries.push({ isPlayer: false, name: baseline[bi] });
  }
  if (rank > entries.length) {
    while (entries.length < rank - 1) entries.push({ isPlayer: false, name: '百大候选球星' });
    entries.push({ isPlayer: true, name: playerName });
  }
  var rows = '';
  for (var i = 0; i < entries.length; i++) {
    var isPlayer = !!entries[i].isPlayer;
    var name = entries[i].name;
    rows += '<div class="legacy-rank-row' + (isPlayer ? ' is-player' : '') + '" data-rank="' + (i + 1) + '">' +
      '<span class="legacy-rank-number">' + (i + 1) + '</span>' +
      (isPlayer ? '<img class="legacy-row-avatar" src="' + avatar + '" alt="主角头像">' : '<span class="legacy-rank-dot"></span>') +
      '<span class="legacy-rank-name">' + name + '</span>' +
      (isPlayer ? '<span class="legacy-rank-you">你的最终位置</span>' : '') +
      '</div>';
  }
  var rankLabel = rank <= 100 ? 'NBA历史百大第 ' + rank + ' 名' : '百大候选第 ' + rank + ' 名';
  var gapText = rank <= 100 ? '插入第 ' + rank + ' 名，其后名次依次顺延' : '距离历史百大还差 ' + r.rankGapToTop100 + ' 位';
  var b = r.scoreBreakdown || {};
  var honorScore = (b.championships || 0) + (b.fmvp || 0) + (b.mvp || 0) + (b.dpoy || 0) + (b.allNBA || 0) + (b.allStar || 0);
  var careerScore = (b.points || 0) + (b.games || 0);
  var bonusScore = (b.loyalty || 0) + (b.peak || 0) + (b.farewell || 0);
  return '<div class="legacy-top100-wrap" data-final-rank="' + rank + '">' +
    '<div class="legacy-rank-summary"><div><span class="legacy-rank-kicker">ALL-TIME TOP 100</span><strong>' + rankLabel + '</strong><small>' + gapText + '</small></div><div class="legacy-rank-score">' + r.score + '<small>历史分</small></div></div>' +
    '<div class="legacy-score-grid"><span>荣誉贡献<b>+' + honorScore + '</b></span><span>生涯数据<b>+' + careerScore + '</b></span><span>巅峰与忠诚<b>+' + bonusScore + '</b></span><span>历史档位<b>' + escapeLegacyHtml(r.tier) + '</b></span></div>' +
    '<div class="legacy-ranking-stage">' +
      '<div class="legacy-ranking-caption"><span>游戏历史百大完整榜</span></div>' +
      '<div class="legacy-ranking-list">' + rows + '</div>' +
      '<div class="legacy-rank-climber"><img src="' + avatar + '" alt="上升中的主角头像"><span>从第150名向上冲刺</span></div>' +
    '</div>' +
    '<div class="legacy-rank-settlement"><b>排名结算</b><span>最终插入第 ' + rank + ' 名 · 从第150名上升 ' + r.rankClimbed + ' 位</span><span>' + (rank <= 100 ? '正式入选NBA历史百大，其后名次顺延' : '未入选百大，' + gapText) + '</span><small>依据：总冠军、MVP、FMVP、DPOY、最佳阵容、全明星、生涯总得分、出场数、巅峰能力与球队忠诚。</small></div>' +
  '</div>';
}

function startLegacyRankClimb() {
  var wrap = document.querySelector('#legacy-modal .legacy-top100-wrap');
  if (!wrap || wrap.dataset.started === '1') return;
  wrap.dataset.started = '1';
  var list = wrap.querySelector('.legacy-ranking-list');
  var target = wrap.querySelector('.legacy-rank-row.is-player');
  var climber = wrap.querySelector('.legacy-rank-climber');
  var button = document.querySelector('#legacy-modal .legacy-rank-finish');
  if (!list || !target || !climber) return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  list.scrollTop = list.scrollHeight;
  if (button) { button.disabled = true; button.textContent = '排名揭晓中…'; }
  function settle() {
    target.classList.add('landed');
    climber.classList.add('landed');
    if (button) { button.disabled = false; button.textContent = '查看生涯总览'; }
    wrap.dataset.animationComplete = '1';
  }
  if (reduced) {
    list.scrollTop = Math.max(0, target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2);
    settle();
    return;
  }
  requestAnimationFrame(function() {
    climber.classList.add('climbing');
    list.scrollTo({ top: Math.max(0, target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2), behavior:'smooth' });
    window.setTimeout(settle, 2400);
  });
}

// ── GOAT 退役发布会：8 条专属文案 ──
var GOAT_COPY = [
    "你坐到话筒前，还没有开口，{longestTeam}的球馆已经先响了一遍掌声。{achievement}。记者问你想对历史说什么，你说：历史不用我说，它自己会记得。{seasonsCount} 个赛季、{games} 场比赛、{points} 分，今天终于可以交给后人去争论了。",
    "发布会第一句话，你说：我从不觉得自己在追赶谁。{achievement}。你停了一下：我只是把我能拿的都拿了。台下安静了两秒，然后欢呼声盖过了所有问题。{longestTeam}的{seasonsCount} 个赛季，成了这座城市最骄傲的注脚。",
    "有人问，GOAT 这个词重不重。你说：重，但我背了 {seasonsCount} 年。{achievement}。{teamCount} 支球队见证过你，{games} 场比赛衡量过你，{points} 分最终替你回答了所有质疑。",
    "你把话筒推到一边，说：该说的，比赛里都说完了。{achievement}。{mvp} 次MVP、{championships} 次总冠军、{fmvp} 次总决赛MVP，每一个数字背后，都是没人看见的清晨。今天退役不是结束，是把标准留在这里。",
    "记者问你职业生涯最满意的部分。你说：不是任何一座奖杯，是后来的人提起“那个时代”时，绕不开我。{achievement}。你笑了笑：{seasonsCount} 年，我没有辜负这段路。",
    "你举起{championships} 枚戒指，说：它们很重，但更重的是这 {seasonsCount} 年每一天的醒来。{achievement}。你说：MVP 会被人超越，冠军会被追平，但这段旅程，是我自己的历史。",
    "发布会结束时，有人喊：历史第一！你回头，没说话，只是把{lastTeam}的球衣叠好，放在桌上。{achievement}。{games} 场比赛之后，你终于可以说：剩下的，交给后来的人。",
    "你说自己不是为排名打球，但今天不妨认真一次：{mvp} 次MVP、{championships} 次总冠军、{fmvp} 次总决赛MVP，三项都站在历史的最前列。{achievement}。你顿了顿：这就是我交出的答案。",
];

;

// ── 退役发布会：100 条生涯长判词 ──
var RETIREMENT_COPY = [
    "发布会开始前，你一个人绕着球馆走了一圈。工作人员问你在找什么，你说没有找，只是想把这条路再走一遍。{achievement}。从{firstTeam}到{lastTeam}，{seasonsCount} 个赛季像一条很长的走廊，你终于走到尽头，却没有急着关灯。",
    "你坐到话筒前，先低头看了看自己的手。那双手投过很多球，也撑过很多次摔倒后的地板。{achievement}。{games} 场比赛、{points} 分，最后都安静地落在这一刻。你说：我没有赢下每一个夜晚，但我没有敷衍过任何一个夜晚。",
    "有记者问你，最想带走什么。你想了很久，说：带走不了吧，球馆带不走，更衣室带不走，队友也带不走。{achievement}。后来你停了一下，又说：但那些人看我的眼神，我会记得。",
    "你没有把退役说成结束。你说，篮球只是从每天的任务，变成以后偶尔会想念的地方。{achievement}。你感谢{teamList}，感谢那些给过你欢呼、质疑和等待的人。没有他们，这段生涯不会这么重。",
    "发布会快结束时，你忽然笑了。你说自己年轻时总觉得职业生涯会很长，长到可以慢慢浪费一点。后来才知道，每一场都不够用。{achievement}。{seasonsCount} 个赛季过去，你终于学会珍惜，却也到了告别的时候。",
    "你穿着便装走进发布厅，像换了一个人。有人问你会不会不习惯，你说：不习惯，但该换了。{achievement}。{teamCount} 支球队、{games} 场比赛，你穿过很多件球衣，今天终于把这件也脱下来。",
    "你说自己准备了一段话，结果坐到台上全忘了。{achievement}。台下笑了，你也笑了：那就说最想说的吧。然后你讲了很久，从{firstTeam}讲到最后一场，没人催你。",
    "记者问你生涯里最重的一场比赛，你说不是抢七，也不是总决赛，是{firstTeam}那场普通的常规赛。{achievement}。因为那天有人第一次喊你的名字，你才第一次相信自己真的属于这里。",
    "发布会开了一半，你忽然问工作人员能不能把灯调暗一点。你说以前赛前更衣室就是这个亮度。{achievement}。灯暗下来以后，你说话的声音反而更清楚：{seasonsCount} 年，我一直在这个亮度里找自己。",
    "你讲起自己的第一份合同，说签字那天手抖得不像话。{achievement}。后来你签过更大的合同，但你说，那份小合同才是你人生里最重的一张纸，因为它说：你可以留下来了。",
    "有记者问你，如果没有篮球会去做什么。你想了很久，说：大概会是一个很普通的上班族。{achievement}。你顿了顿：但我会在下班以后去球场投一会儿，像现在这样，不为什么。",
    "你把退役发布会开得像一场吐槽大会。你说自己的投篮曾经很丑，防守曾经很笨，连系鞋带都比别人慢。{achievement}。台下笑完，你说：可就是这样的我，也打完了 {seasonsCount} 个赛季。",
    "你举起话筒，半天没说话，最后只说了句：对不起，我有点舍不得。{achievement}。{games} 场比赛没有让你哭过，这句话说完，你反而低头擦了擦眼睛。台下没有起哄，只有掌声。",
    "你说自己不是天才，只是比别人多留了一会儿。{achievement}。{seasonsCount} 个赛季里，你见过很多次空无一人的训练馆，也见过清晨第一缕光落在中线上。今天你终于可以晚一点到。",
    "发布会中途，你的启蒙教练被人扶上台。他话不多，只说：这小子，我教他的时候他连球都拍不好。{achievement}。你站起来鞠了一躬，像回到第一天。",
    "你回答问题时总是先笑，说习惯了先看看情况再出手。{achievement}。最后你说：今天这场发布会，是我这辈子唯一一次不打算出手的场合，我只想站着听完大家说话。",
    "你说起自己的伤病，没有卖惨，只说每次躺下都想着要站起来。{achievement}。{games} 场比赛不是数字，是你一次次重新站起来的总和。你数到一半，发现数不完，台下已经开始鼓掌。",
    "记者问你退役后最想做什么，你说想睡一个没有闹钟的觉。{achievement}。说完你自己先笑了：以前训练营五点起，现在终于能睡到自然醒，反而有点怕错过什么。",
    "你讲起自己和老对手的故事，说两个人较劲了十几年，最后变成每年夏天一起吃饭。{achievement}。你说：他防不住我，我也甩不开他，后来我们都老了，就都承认了。",
    "发布会开始前，你在后台给家人发消息：我有点紧张。家人回：你打了 {games} 场都不紧张，怕这个？{achievement}。你上台后真的不紧张了，因为你知道，台下有人一直在替你骄傲。",
    "你说自己最怀念的不是胜利，是赛前更衣室里那种安静的紧张。{achievement}。那种紧张让你觉得自己还活着，还在战斗。你说：以后我会偶尔去训练馆，重温一下。",
    "有记者问，如果重来一次还会不会选篮球。你没有犹豫：会。{achievement}。{teamCount} 支球队见证过你的选择，{longestTeam}的 {longestYears} 年是其中最重的一部分。你说完这句话，低头笑了很久。",
    "你坐在台上，像刚打完一场加时，疲惫又平静。{achievement}。{seasonsCount} 个赛季太长，长到你能讲出每一个客场酒店的名字；{points} 分又太轻，轻到装不下那些没有进球的夜晚。",
    "你举起话筒，先说了句：我不是来哭的。结果台下先哭了。{achievement}。你看着{teamList}的方向，把每一座城市都谢了一遍，然后说：好了，我真的不是来哭的。",
    "你讲起自己的号码，说它没什么特别，只是当年没人选。{achievement}。后来这个号码出现在{teamCount} 座城市的看台上。你说：号码没有变，是穿它的人把它穿出了意义。",
    "记者问你，职业生涯里最骄傲的数字是什么。你说：不是{points} 分，是{games} 场。{achievement}。分数可以刷，但能站上球场那么多次，说明我一直被需要，也一直没放弃。",
    "你讲起自己的第一次首发，说教练念到你名字时，你愣了一下才站起来。{achievement}。你说：后来每一次登场，我都记得那一刻，好像有人第一次把你叫进这个世界的中心。",
    "发布会快结束时，你说想给年轻人留一句话。{achievement}。你看着镜头，慢慢地说：篮球不会辜负认真的人，哪怕你慢一点。{teamCount} 支球队、{games} 场比赛，就是我这句话的证明。",
    "你坐在话筒前，手里转着一颗旧篮球，那是你第一场比赛的球。{achievement}。你把它举起来，说：它比我还旧，但它陪我看过{teamList}。台下没有人催你，你讲完了才放下。",
    "你说起自己的客场之旅，说最熟的不是酒店，是机场和训练馆之间的路。{achievement}。{teamCount} 支球队、{seasonsCount} 个赛季，你把那些路都走熟了。以后不走了，你会想念的。",
    "有记者问你，退役当天在做什么。你说：早上还是去了训练馆，投了一组篮，然后坐在中圈，把球馆看了很久。{achievement}。你说：不是舍不得，是想认真告别。",
    "你讲起自己的第一个冠军，说那晚你没有失眠，反而睡得很沉。{achievement}。你说：因为终于证明了自己值得，心里那块石头放下了。后来你又拿过更多，但第一次的那种踏实，只有一次。",
    "发布会进行到一半，你忽然说：我想谢谢裁判。大家愣了一下。你笑着解释：没有他们，我不可能打满 {games} 场还这么生气勃勃。{achievement}。台下笑成一片，你又补了一句：也谢谢每一个让我生气的对手。",
    "你举起话筒，声音不大，但台下很安静。{achievement}。你说：我打过 {teamCount} 支球队，走过{teamList}，最重的行囊一直放在{longestTeam}。今天我把行囊放下了，但故事还在。",
    "你讲起自己被交易的那天，说在机场接到电话，然后一个人坐了很久。{achievement}。你说：后来我才明白，每次离开都是为了下一次更认真地留下。{teamList}，每一站你都认了。",
    "你坐在台上，身后是{lastTeam}的队徽。{achievement}。你回头看了一眼，说：从这里退役，我很幸运。然后你转回来，眼睛有点红：但我会一直记得{firstTeam}把我带上路的那天。",
    "你说自己曾经想过放弃，在连续输球的那个冬天。{achievement}。后来是一个小球迷举着牌子在场边喊你，你才又走进训练馆。你说：他可能不记得了，但我记得。",
    "发布会结束前，你从口袋里掏出一张旧球票。{achievement}。你说这是{firstTeam}第一场主场的票，一直留着。你把它放在桌上：今天，我把这段旅程的票根，交还给大家。",
    "你被问到会用什么样的姿态离开，你说：像平常训练完那样，擦擦汗，把球放回球架，然后回家。{achievement}。你说：篮球对我来说，从来不是舞台，是生活。",
    "你讲了一个笑话，说自己的投篮包在{teamCount} 支球队之间搬来搬去，最后留在了{longestTeam}。{achievement}。台下笑完，你说：不开玩笑，那是我放得最久的地方，{longestYears} 年。",
    "你坐在台上，忽然安静了很久，然后说：我想谢谢{firstTeam}的食堂阿姨，她总给我多打一勺。{achievement}。台下笑成一片，你认真说：那勺饭，陪我打了好几年。",
    "记者问你，如果只能用一个词形容生涯，你会选什么。你想了很久，说：值了。{achievement}。{teamCount} 次出发，{games} 场比赛，{points} 分，还有数不清的凌晨训练。这个词，你配得上。",
    "你说自己不喜欢“传奇”这个词，太重了。{achievement}。你说：我只是一个喜欢篮球、并且坚持了很久的人。{games} 场比赛，就是这种喜欢留下的脚印。",
    "你讲起最狼狈的一场比赛，说那场之后你连饭都吃不下。{achievement}。你说：但第二天训练，我还是第一个到。后来我才明白，狼狈和荣誉，是同一条路的两边。",
    "发布会开始前，你看到门口有个小孩举着你的号码牌。{achievement}。你走过去签了名，对他说：好好学习。后来你在台上说：那一刻我突然明白，我的职业生涯，也是很多人的童年。",
    "你回答“为什么退役”时，没有提伤病，只说：我想在还能笑着离开的时候离开。{achievement}。你说：{seasonsCount} 个赛季，我已经把最好的自己留给了球场。",
    "你坐在台上，说想给年轻球员一句忠告：别急着成为传奇，先成为一个可靠的队友。{achievement}。你说：{games} 场比赛教会我的，就是这一点。",
    "发布会中途，你让工作人员拿来自己第一双球鞋，鞋底已经磨穿。{achievement}。你举着它说：这双鞋带我走过{teamList}，走过{seasonsCount} 个赛季。今天，它和我一起退役。",
    "你讲起自己的篮板球，说自己不是跳得最高的，但总是第一个到位置。{achievement}。你说：生活也一样，不一定赢在天赋，但可以赢在提前一步。{games} 场比赛，我都是这样过来的。",
    "你举起话筒，全场安静，你只说了句：我回来了，来告别。{achievement}。你说：我从{firstTeam}出发，在{lastTeam}停下，中间是{teamCount} 支球队和{seasonsCount} 个赛季。今天，这场旅行到站了。",
    "你说起自己的第一场职业比赛，说紧张到把球传给了裁判。{achievement}。台下大笑，你认真说：后来我练了很久，终于不再传错人。{games} 场比赛，就是那一次次的“后来”。",
    "你坐在话筒前，开始讲一个很长的故事，关于{firstTeam}怎么签下你。{achievement}。讲到最后你才说：今天坐在这里，我要谢谢他们当年的信任，也谢谢{lastTeam}今天给我这场告别。",
    "有记者问你，生涯中最害怕什么。你说：害怕辜负。{achievement}。怕辜负{teamCount} 支球队，怕辜负{lastTeam}的球迷，也怕辜负那个从小就爱篮球的自己。你顿了顿：今天，我想我算是没有辜负。",
    "你讲起自己的体能训练，说教练要求每天多跑一圈，你跑了 {seasonsCount} 年。{achievement}。你说：很多事没有捷径，多跑一圈就是捷径。台下有人开始鼓掌。",
    "你坐在台上，回答了一个关于数据的问题，然后说：数据会过时，但{firstTeam}那年球迷塞给我的一颗糖，到现在还甜。{achievement}。你说：那才是我最想收藏的东西。",
    "发布会尾声，你从口袋里拿出一张纸条，念道：谢谢篮球。{achievement}。你说这是你早上写好的，本来想多写几句，但发现这两句就够了。然后你把纸条叠好，放回口袋。",
    "你说自己退役后第一件事是去理了个发，因为以前训练没时间。{achievement}。台下笑完，你说：第二件事，是去{lastTeam}看台坐了一次，从上面看球场，原来这么大。",
    "你讲起自己的失误，说有一场关键球传丢了，那晚你反复看录像到凌晨。{achievement}。你说：后来我再没犯过同样的错。{games} 场比赛就是这样，每一场都有人长大一点。",
    "记者问你，退役后第一周打算做什么。你说：睡觉、陪家人、看一场没有压力的比赛。{achievement}。你说：{seasonsCount} 个赛季，我把这些事都欠下了，现在开始还。",
    "你讲起自己的最后一次全明星，说那晚你故意多传了几个球。{achievement}。你说：因为我想把舞台留给年轻人，就像当年有人把舞台留给我一样。篮球就是这样，一代接一代。",
    "你坐在台上，把话筒放下，又拿起来，最后说：谢谢你们，让我把篮球这件事，做成了人生里最好的事。{achievement}。你站起来，鞠躬，很久没有直起身。",
    "你说自己不是没有遗憾，而是学会了和遗憾一起走。{achievement}。你讲起那场输掉的系列赛，说如果时间倒流，你还是会投那一球。你说：我不后悔，我只是想知道结果会不会不一样。",
    "发布会开始前，你在更衣室坐了很久。工作人员说外面都准备好了，你说再等一会儿。{achievement}。后来你走出去的时候，像走进自己的最后一个主场。",
    "你讲起自己曾经坐过板凳，坐了很久。{achievement}。你说：那些年没人认识我，我也没放弃。后来每一次站上首发，我都会回头看一眼板凳席，告诉自己：别辜负那个等过的自己。",
    "你被问到巅峰期是什么时候。你说：不是某一年，是{seasonsCount} 个赛季里，我每一次摔倒后都站起来的那个瞬间。{achievement}。台下安静了很久。",
    "你说起自己的粉丝，说他们从学生变成上班族，从孩子变成父母。{achievement}。你说：我打了一辈子球，他们也看了一辈子。今天这场发布会，就当是我给他们交的作业。",
    "你举起话筒，说：我这辈子只认真做过一件事，就是打球。{achievement}。你停了一下：现在这件事告一段落了，但认真这个习惯，我会带到下一段人生里。",
    "你讲起自己的第一场胜利，说那晚整支球队去吃烧烤，你抢着买单。{achievement}。你说：后来赢过很多场，但我一直记得那顿烧烤的味道，那是“我们开始赢了”的味道。",
    "你坐在台上，回答问题时总是先想很久。记者问为什么，你说：因为我习惯先看一遍录像。{achievement}。台下笑了，你也笑了：生活和比赛一样，多想一步，总是好的。",
    "你说自己的职业生涯不是一条直线，而是很多个转弯。{achievement}。从{firstTeam}到{lastTeam}，中间有伤病、有质疑、有低谷。你说：但每个转弯之后，我都还站在球场上。",
    "发布会最后，你让镜头对准自己，认认真真说了句：谢谢大家。{achievement}。你说：这句话我想说很久了，从{firstTeam}的第一场比赛，说到{lastTeam}的最后一场，终于说完了。",
    "你讲起自己的助教，说他教会你看录像。{achievement}。你说：以前我觉得比赛是打出来的，后来发现也是看出来的。{games} 场比赛，我看过的录像，比我自己打的还多。",
    "有记者问，退役后最怀念什么。你说：不是欢呼，是赛前更衣室那种安静的紧张。{achievement}。你说：那种紧张让我觉得，自己还活着，还在战斗。以后我会偶尔去训练馆，重温一下。",
    "你坐在台上，面前摆着话筒，旁边放着一瓶水。{achievement}。你说：这瓶水没有牌子，但和{lastTeam}更衣室里的味道一样。说完你喝了一口，笑了：味道也一样。",
    "你讲起自己的盖帽，说有一个球盖到了篮板上，被球迷传了很多年。{achievement}。你说：那球其实是我跳早了，运气好。台下笑了，你补了一句：但运气，也是{seasonsCount} 年训练攒出来的。",
    "你被问到职业生涯里最骄傲的数字。你说：不是{points} 分，是{games} 场。{achievement}。你说：分数可以刷，但能站上球场那么多次，说明我一直被需要，也一直没放弃。",
    "你讲起自己在{teamCount} 支球队的更衣室故事，说每间更衣室都有一把椅子是你的。{achievement}。你说：现在这些椅子都空出来了，但每把椅子都记得我的重量。",
    "你举起话筒，说：篮球给了我很多东西，最贵的是时间。{achievement}。{seasonsCount} 个赛季，我把时间都交给了球场，现在我想把它拿回来，陪陪家人，也陪陪自己。",
    "记者问你，退役后会不会关注比赛。你说：会，而且会更放松地看。{achievement}。你说：以前看比赛是工作，以后看比赛是享受。但看到关键球，我还是会站起来喊，这个改不了。",
    "你讲起自己的队友，说有的人已经不在联盟，但每年还会收到他们的消息。{achievement}。你说：{teamCount} 支球队给了我很多队友，也给了我很多家人。今天这场发布会，他们都在我手机里。",
    "发布会中途，你让助手拿来了自己第一双球鞋，鞋底已经磨穿。{achievement}。你举着它说：这双鞋带我走过{teamList}，走过{seasonsCount} 个赛季。今天，它和我一起退役。",
    "你讲起客场旅途，说最熟的不是酒店，是机场和训练馆之间的路。{achievement}。你说：{teamCount} 支球队，{seasonsCount} 个赛季，我把这些路都走熟了。以后不走了，我会想念的。",
    "你被问到最想收回哪一句话。你说：没有。{achievement}。你说：不管是说错的话、输掉的比赛，还是走错的路线，它们一起把我带到了今天。我全都收下。",
    "你举起话筒，忽然问：我可以说得慢一点吗？台下说可以。然后你真的很慢地讲完了整个生涯，从{firstTeam}讲到{lastTeam}。{achievement}。你说：有些故事，值得慢慢讲。",
    "你讲起自己最后一次训练，说那天你投到球馆只剩你一个人。{achievement}。你说：我不是难过，是想记住球馆只有我一个人时的声音。那声音很安静，但我很喜欢。",
    "你坐在台上，说：我不算最有天赋的球员，但我可能是最晚离开训练馆的人之一。{achievement}。{games} 场比赛、{points} 分，就是那些晚归的夜晚换来的。",
    "记者问你，退役后还会不会打球。你说：会，但可能是在小区球场。{achievement}。你说：那里没有裁判，没有录像，也没有合同，只有一群为了一球能争半天的人，和从前的我一样。",
    "你讲起自己第一次入选全明星，说在更衣室里看见自己偶像的名字，愣了很久。{achievement}。你说：后来我告诉自己，别给他丢人。结果那场你拿了全场最佳，你也没敢告诉他。",
    "发布会开始前，你把手机交给了工作人员，说今天不想看消息。{achievement}。你说：我想好好听大家说话，也好好跟自己说再见。{seasonsCount} 年了，该有的仪式感，一次都不能少。",
    "你坐在台上，忽然问记者：你们知道我最喜欢什么时刻吗？没人回答。你说：不是冠军，是{firstTeam}那年第一次首发，教练喊我名字的那一刻。{achievement}。后来每一次登场，我都记得那一刻。",
    "你讲起自己的伤病，说每一次躺下，都想着要站起来。{achievement}。{games} 场比赛，不是数字，是{seasonsCount} 个赛季里一次次重新站起来的总和。你说完，全场起立鼓掌。",
    "你举起话筒，先说了句：我今天想笑。{achievement}。然后你真的笑了很久，把大家逗得前仰后合。最后你说：好了，笑完了，说正事。谢谢你们，让我打了这么久。",
    "你讲起自己在新秀赛季被老将欺负的事，说当时觉得天都要塌了。{achievement}。你说：后来我也成了老将，才发现那也是一种欢迎。现在回想起来，那件小事，比很多荣誉都生动。",
    "你说自己退役后要做的第一件事，是把这些年没看完的剧补完。{achievement}。台下笑了，你认真说：第二件事，是把{teamList}都再走一遍，这次不赶飞机。",
    "你坐在台上，说：我今天没有准备稿子。{achievement}。台下愣了一下，你说：因为想说的太多，写下来反而少。然后你从{firstTeam}开始讲，讲到{lastTeam}，讲了很久。",
    "有记者问你，退役这天天气怎么样。你说：很好，太阳很大。{achievement}。你停了一下：其实我记不清了，只记得进来的时候，门口很多人喊我的名字。别的都不重要了。",
    "你讲起自己第一次扣篮，说那球把全场吓到了，也把自己吓到了。{achievement}。你说：后来我扣过更难的，但第一次的那种惊喜，再也没有出现过。就像{firstTeam}那年一样。",
    "你举起话筒，说：我要谢谢一个人。台下都以为你要说家人。你说：谢谢那个在新秀赛季坐冷板凳的自己。{achievement}。如果没有他，今天坐在这里的不会是现在的我。",
    "你坐在台上，讲起自己最爱的一场比赛，不是赢球的那场。{achievement}。你说：是那年我们输了，但赛后全队一起坐大巴，谁都没说话。那一刻我知道，我们是一支真正的球队。",
    "发布会结束，你站起来，把话筒放回原位，像把球放回球架。{achievement}。你走到门口，回头看了一眼，说：{teamList}，谢谢。然后你走出去，脚步没有停。",
    "你讲起自己的球衣号码，说选它是因为偶像穿过。{achievement}。后来你穿出了自己的味道。你说：号码是借来的，但名字是我自己的。今天，我把这个号码还给球场，也把它留给自己。",
    "记者问你，退役以后还会不会早起。你说：可能会，但不会为了训练。{achievement}。你说：我会早起去买菜，给家人做早饭，然后看一会儿球赛。以前我把时间给了篮球，以后我想给它一点生活。",
    "你坐在台上，说：我打过很多场重要的比赛，但今天这场，我不想输。{achievement}。你说：我不想输给眼泪，也不想输给遗憾。我想笑着走出去，像走进来的时候一样。",
    "你讲起自己在新球队的第一天，说一个人都不认识，连更衣室都找不到。{achievement}。你说：后来我认识了很多人，也把每间更衣室都记住了。{teamList}，每一站都教会我一点。",
    "发布会进行到一半，你忽然让工作人员放了一段录像。画面里是你第一次训练时的样子，动作笨拙，但很认真。{achievement}。你看完以后说：这些年，我大概只学会了认真这件事。",
    "你举起话筒，说：我不是来公布什么决定的，我是来谢谢大家的。{achievement}。你说：决定早就做好了，在{lastTeam}最后一场比赛结束的时候。只是今天，才有勇气说出来。",
    "你坐在台上，被问到最遗憾的事。你想了很久，说：没能让{firstTeam}的球迷看到我最好的一年。{achievement}。你说：后来我在别的地方拿到了荣誉，但每次想起他们，还是会有一点抱歉。",
    "你说自己最骄傲的，不是总冠军戒指，是伤病名单上待了那么久，还能回来。{achievement}。你说：每一次回来，都像重新打一次职业生涯。{games} 场，就是这些重新开始加在一起。",
    "有记者问你，退役之后会不会想念更衣室的味道。你说：会，尤其是赢球以后的。{achievement}。你说：那个味道说不清楚，但一闻到，你就知道这支球队今晚很开心。",
    "你坐在话筒前，说：我这人嘴笨，不太会说漂亮话。{achievement}。台下笑了，你接着说：所以我就说三件事：谢谢{firstTeam}，谢谢{teamList}，谢谢所有看过我打球的人。",
    "你讲起自己第一次坐飞机去打客场，说整个人都贴在窗户上看云。{achievement}。你说：后来我飞了几百次，再也不看窗了。但今天退役了，我决定以后每一次坐飞机，都再看一眼云。",
    "记者问你，如果时间能倒流，你会改变什么。你说：什么都不改。{achievement}。你说：输过的比赛、受过的伤、错过的人，都是我的。改了，我就不是我了。",
    "你坐在台上，说：我想给年轻时候的自己道个歉。{achievement}。台下安静了。你说：那时候我对自己太狠了，总觉得不够好。现在我想告诉他，你已经很努力了。",
    "你讲起自己最安静的一场胜利，说那场没人看好你们，赢完以后更衣室里没人说话。{achievement}。你说：每个人都只是坐在那里，不敢相信。那种安静，比欢呼更难忘。",
    "你举起话筒，说：今天我退役了，但篮球没有退役。{achievement}。你说：它会继续在每一个球场响起，在每一个孩子的手里弹跳。我只是先下车了，它还会一直开下去。",
    "你讲起自己的队友，说有人教你投篮，有人教你说话，有人教你笑。{achievement}。你说：{teamCount} 支球队，我最大的收获不是荣誉，是这些把我拼起来的人。",
    "你坐在台上，说：我本来想写一篇很长的退役宣言，后来发现写不出来。{achievement}。你说：因为所有话都太轻了，不够形容这{seasonsCount} 年。所以我决定，就坐在这里，跟你们聊天。",
    "有记者问你，退役之后会不会去当教练。你说：可能会。{achievement}。你说：我想把我会的都教给年轻人，也想告诉他们，不会的也没关系，慢慢来。",
    "你讲起自己第一次夺冠后的夜晚，说没有去庆祝，一个人在球馆练到凌晨。{achievement}。你说：我不是不兴奋，是想把那一刻的感觉记住，多练一会儿，它就慢一点消失。",
    "发布会开始前，你在后台遇见一个老球迷，他手里拿着一张你新秀年的照片。{achievement}。你给他签完名，问他照片里那个人是谁。他说：是你啊。你说：我知道，我只是想确认一下，这些年我是不是还是他。",
    "你坐在台上，说：我今天没有哭，是因为我把眼泪都留给了训练馆。{achievement}。你说：每一次受伤回来，我都在那里哭过。今天，我总算可以笑着离开了。",
    "你讲起自己最艰难的一个赛季，说球队输了很多场，但你从来没有缺席训练。{achievement}。你说：因为我答应过自己，不管多难，都要先把该做的事做完。",
    "有记者问你，退役以后最想见谁。你说：想见见{firstTeam}时期的老队友。{achievement}。你说：我们好久没见了，我想告诉他们，当年那些一起扛过的夜晚，我都记得。",
    "你举起话筒，说：谢谢篮球。{achievement}。台下安静。你说：这三个字，我在心里说了{seasonsCount} 年。今天终于说出口了。它给了我一切，我只还给了它一段认真的时光。",
    "你讲起自己的第一次全明星，说在球员通道里深呼吸了很多次。{achievement}。你说：那时候我以为自己会很紧张，结果一上场，反而整个人都安静了。后来每次重要比赛，我都那样深呼吸。",
    "你坐在台上，说：我这个人没什么天赋，就是记性比较好。{achievement}。你说：我记得{firstTeam}的每一次输球，记得{lastTeam}的每一场胜利，也记得{teamList}里每一张脸。",
    "记者问你，退役之后会怎么介绍自己。你说：就说是打过篮球的。{achievement}。你说：不用加太多头衔。篮球是我做过的事，不是我的全部。但我会一直为它骄傲。",
    "你讲起自己的第一次绝杀，说球进的那一刻，你第一反应不是欢呼，是看裁判。{achievement}。你说：确认有效以后，你才敢笑。后来你每一次投关键球，都会先想：球进了，裁判呢？",
    "你坐在话筒前，说：今天我想讲一个很短的故事。{achievement}。你说：有个孩子，在{firstTeam}的球馆门口站了很久，不敢进去。后来他进去了，一待就是{seasonsCount} 年。",
    "你被问到职业生涯里最感谢的人。你说：太多了，说不完。{achievement}。你说：但如果一定要选一个，我想选那个在我最低谷时，愿意坐在我身边陪我吃饭的人。",
    "发布会快结束，你忽然站起来，对着镜头比了个投篮的动作。{achievement}。你说：这个动作，我做了{seasonsCount} 年。今天做完这一次，它就变成回忆了。但回忆，也可以一直做下去。",
    "你坐在台上，说：我从来没想过自己会打这么久。{achievement}。你说：刚进联盟的时候，我以为三五年就会被淘汰。结果一不小心，就打了{seasonsCount} 个赛季。谢谢你们没有让我被淘汰。",
    "你讲起自己最喜欢的客场，说不是大城市，是一个小城。{achievement}。你说：那里的球迷不多，但每一场都来。他们让我知道，篮球可以不需要太多人，只需要真正喜欢它的人。",
    "有记者问你，退役以后会不会想念比赛日。你说：会。{achievement}。你说：比赛日有一种特别的节奏，早上训练，下午休息，晚上走进球馆。那种节奏我走了{seasonsCount} 年，现在要重新学了。",
    "你举起话筒，说：我一直觉得自己是个普通球员。{achievement}。台下有人喊：你不是！你笑了：谢谢。然后你说：但我知道，我打球的时候，真的很认真。",
    "你讲起自己的老对手，说两个人从新秀赛季就开始较劲。{achievement}。你说：他比我快，我比他壮，我们谁也压不住谁。后来我们都退役了，他发消息说：来吃饭，我请客。",
    "你坐在台上，说：我想谢谢每一个教练。{achievement}。你说：有人教我技术，有人教我做人，有人骂过我，也有人拉过我。没有他们，我可能早就走丢了。",
    "记者问你，如果给年轻的自己寄一封信，会写什么。你说：会写：别怕。{achievement}。你说：那些你担心的夜晚，都会过去的。你会打到{lastTeam}，你会打完{games} 场比赛，然后你会很舍不得。",
    "你讲起自己的第一次交易，说在飞机上听到消息，整个人都愣住了。{achievement}。你说：后来我明白了，职业球员就是这样，篮球会带着你走。你只需要在每一站，都认真打球。",
    "你坐在话筒前，说：我今天想谢谢{lastTeam}的球迷。{achievement}。你说：你们在最后一场比赛结束的时候，没有走，一直喊我的名字。那一刻我就知道，我可以放心退役了。",
    "你讲起自己曾经连续投丢很多球，被媒体批评。{achievement}。你说：那段时间我连训练都不太敢看篮筐。后来是一个队友说：你投，进了是我们的，不进也是我们的。我才重新抬起头。",
    "有记者问你，退役以后会不会写书。你说：不会。{achievement}。你说：我的故事都在比赛里了，想看的人，自己去看录像。写下来反而少了味道。",
    "你举起话筒，说：我今天想笑，也想哭，但我决定先笑。{achievement}。你说：因为哭的日子已经够多了。今天，我想让大家记住我笑的样子。",
    "你讲起自己的最后一个主场，说比赛结束后，你在中圈站了很久。{achievement}。你说：我听见球迷在喊我的名字，听见队友在笑，听见球馆空调嗡嗡响。我想把那些声音都记住。",
    "你坐在台上，说：我这辈子做过最长的梦，就是打篮球。{achievement}。你说：现在梦醒了，但醒来的地方，刚好是我最想留下的地方。{lastTeam}，谢谢。",
    "记者问你，退役之后会不会偶尔回球馆看看。你说：会，但不会进去太久。{achievement}。你说：我怕自己一进去，就又想打一场。还是站在门口看看就好，像看一个老朋友。",
    "你讲起自己第一次被选中，说听到名字的那一刻，脑子一片空白。{achievement}。你说：后来记者问我想说什么，我说：我妈妈会很高兴。今天我也想对她说：你高兴吗？",
    "你坐在话筒前，说：我想谢谢那些骂过我的人。{achievement}。台下安静了。你说：他们让我知道，我不是每个人都会喜欢。但我打球，不是为了让他们喜欢，是为了对得起喜欢我的人。",
    "你举起话筒，说：我今天正式退役。{achievement}。台下安静。你说：这句话我练习了很多遍，以为自己会说得很快。结果说出口，才发现它比我想象的重。",
    "你讲起自己第一次夺冠后把奖杯举过头顶，说那一下，感觉整个人的骨头都在响。{achievement}。你说：后来每次想起，都觉得那一下，值得我用{seasonsCount} 年去换。",
    "你坐在台上，说：我以前总想把每一场比赛都打好，后来才发现，人生不是每场都要赢。{achievement}。你说：输过的那些比赛，教会我的比赢的更多。今天，我也想谢谢那些输。",
    "有记者问你，退役之后最想去哪。你说：想回{firstTeam}看看。{achievement}。你说：不是去看比赛，是去看看那条街、那间球馆、那些认识我的人。想告诉他们，我回来了，以球迷的身份。",
    "你讲起自己的新秀赛季，说那时候每天都很怕，怕自己不够好。{achievement}。你说：后来我才明白，那种怕，说明我很在乎。一个人在乎一件事的时候，就会一直往前走。",
    "你举起话筒，说：我今天想许一个愿。{achievement}。台下安静。你说：希望以后每一个孩子打篮球的时候，都能像我一样，遇到一群愿意陪他打球的人。",
    "你坐在台上，说：我讲一个秘密。{achievement}。你说：其实我每次罚球前，都会跟自己说一句话：投出去，别想。这句话，我用了{seasonsCount} 年。",
    "记者问你，退役之后会不会想念被媒体包围的感觉。你说：不会。{achievement}。你说：我喜欢的是打球，不是被采访。以后你们想我了，就放我以前比赛的录像。",
    "你讲起自己第一次摸到总冠军奖杯，说第一反应是好冷。{achievement}。台下笑了。你说：后来才知道，它冷，是因为等了很多年。今天，它也等到了自己该回的地方。",
    "你坐在话筒前，说：我今天不打算长篇大论。{achievement}。你说：因为该说的，都在比赛里说完了。今天我只想说一句：我尽力了，我真的很尽力了。",
    "你讲起自己最想念的一个瞬间，说不是夺冠，是有一年季后赛输了以后，全队坐在更衣室里，没有人说话。{achievement}。你说：那一刻，我知道我们都不是为了自己打球。",
    "你举起话筒，说：谢谢每一个看过我打球的人。{achievement}。你说：你们的欢呼、掌声、甚至批评，都是我这{seasonsCount} 年里最好的背景音。今天，背景音结束了，但你们的声音，我会一直记住。",
    "你坐在台上，说：有人问我，退役以后会不会失落。{achievement}。你说：会有一点。毕竟打了这么多年，突然不用训练了，身体会不习惯。但我知道，这是对的。",
    "有记者问你，最想对年轻球员说什么。你说：多训练，少说话。{achievement}。台下笑了。你说：认真的。你的比赛，会替你把所有的话说完。",
    "你讲起自己的最后一次罚球，说那球罚进以后，你抬头看了一眼计时器。{achievement}。你说：那一刻，我突然意识到，属于我的时间，真的走完了。但我很庆幸，最后一球，是进了的。",
    "你坐在话筒前，说：我今天带了一样东西。{achievement}。你从口袋里掏出一枚旧哨子：这是{firstTeam}助教送我的。他说，等我不打球了，可以吹着玩。今天我试试。",
    "你举起话筒，说：我的职业生涯，像一场很长的比赛。{achievement}。你说：有领先，有落后，有暂停，也有绝杀。今天，终场哨响了。我是笑着走出球场的。",
    "你讲起自己第一次在全明星赛上见到偶像，说紧张得不敢说话。{achievement}。你说：后来他先开口了，问我：你叫什么？我说了我的名字。他说：我知道，你打得不错。",
    "你坐在台上，说：我想谢谢我的家人。{achievement}。你说：他们陪我走过很多个赛季，没有抱怨过。今天这场发布会，我想让他们知道，我打球的动力，一直都是他们。",
    "记者问你，退役之后会不会偶尔手痒。你说：会。{achievement}。你说：有时候路过球场，看到有人在打，就想上去投两个。但我会忍住，因为我现在是观众了。",
    "你讲起自己最难的一个夏天，说那时候差点就放弃了。{achievement}。你说：是{firstTeam}的一个老教练，把我拉回训练馆。他说：你还有路要走。后来我信了。",
    "你举起话筒，说：我今天想谢谢伤病。{achievement}。台下安静。你说：不是谢谢它让我痛苦，是谢谢它教会我，能打球的日子，每一场都值得珍惜。",
    "你坐在台上，说：我打球的时候，不喜欢说话，只喜欢用行动。{achievement}。你说：今天退役了，我决定多说几句。因为以后，我大概没有机会再用比赛说话了。",
    "你讲起自己的第一个签名球衣，说签的时候手都在抖。{achievement}。你说：后来我签了无数次，但每一次，我都会认真写自己的名字。因为那是我留给这个世界的记号。",
    "有记者问你，退役之后会不会回球队工作。你说：会考虑。{achievement}。你说：不是当教练，是当那种坐在场边，偶尔给年轻人递瓶水的人。我想用另一种方式，继续陪着篮球。",
    "你坐在话筒前，说：我今天想讲一个关于等待的故事。{achievement}。你说：一个孩子，等了{seasonsCount} 年，终于等到自己可以笑着说再见的这一天。这个故事不长，但我讲了很久。",
    "你举起话筒，说：谢谢{teamList}。{achievement}。你说：你们每一个主场，我都认真打过。每一个客场，我都认真对待过。今天，我把这些认真，都还给篮球。",
    "你讲起自己第一次入选最佳阵容，说看到名单的那一刻，反复看了三遍。{achievement}。你说：确认没有看错以后，你才敢给家里打电话。你说：妈，我做到了。",
    "你坐在台上，说：我以前总觉得自己是个配角。{achievement}。你说：后来才明白，每个人的生涯，都是自己的主角。我打了{games} 场比赛，每一场，我都是自己故事里的第一男主角。",
    "记者问你，退役以后会不会忘记怎么打球。你说：不会。{achievement}。你说：就像学会骑自行车一样，身体会记得。但我会慢慢让它忘记，因为我已经不需要用它去比赛了。",
    "你举起话筒，说：我今天想做一个约定。{achievement}。你说：以后我来看比赛，你们不要喊我名字，就让我当一个普通球迷。我想试试，站在看台上看篮球，是什么感觉。",
    "你讲起自己最疯狂的一场比赛，说那晚你得了很多分，但球队输了。{achievement}。你说：那一场教会我，数据救不了比赛，只有团队能。从那以后，我学会了传球。",
    "你坐在台上，说：我想谢谢那些年陪我熬夜看录像的人。{achievement}。你说：他们可能只是工作人员，可能只是队友，但那些凌晨的灯光，我都记得。",
    "有记者问你，退役之后最想念什么味道。你说：更衣室赢球后的味道。{achievement}。你说：说不清是什么，但就是让人安心。以后闻不到了，我会很怀念。",
    "你举起话筒，说：我今天不哭了。{achievement}。台下安静。你说：不是不难过，是眼泪已经替我哭完了。今天，我想笑着把话说完，然后笑着离开。",
    "你讲起自己的第一次伤愈复出，说站在场边等换人的时候，心跳得比总决赛还快。{achievement}。你说：那场比赛你打得不好，但你终于明白，能重新站在这里，已经是赢了。",
    "你坐在话筒前，说：我想讲一个很小的故事。{achievement}。你说：有个孩子，在{firstTeam}的看台上看了一场比赛，从此决定要打篮球。后来他真的打了，而且打了很久。",
    "你讲起自己最骄傲的一次助攻，说不是绝杀，是传给一个从没投进过球的年轻队友。{achievement}。你说：他投进以后，比我自己的绝杀还开心。篮球最美好的部分，就是让身边的人发光。",
    "你举起话筒，说：我退役了，但请你们继续支持篮球。{achievement}。你说：支持那些正在打球的年轻人，支持那些还在路上的球队。篮球不会因为我退役而停止，它会继续生长。",
    "你坐在台上，说：我没什么大道理，只想说一句：坚持很难，但很值得。{achievement}。你说：我坚持了{seasonsCount} 年，今天站在这里，就是最好的证明。",
    "记者问你，退役之后最想做什么。你说：想教小孩打球。{achievement}。你说：不是教他们怎么赢，是教他们怎么喜欢篮球。喜欢这件事，比赢更重要。",
    "你讲起自己的第一个客场胜利，说那晚全队都很兴奋，在酒店大堂里跳了半天。{achievement}。你说：后来我们赢过很多客场，但那种像孩子一样的开心，只有第一次才有。",
    "你举起话筒，说：我今天想谢谢{lastTeam}。{achievement}。你说：你们给了我最后一段旅程，让我可以体面地告别。这段日子，我会一直记得。",
    "你坐在台上，说：我打球的时候，最怕的不是输，是让队友失望。{achievement}。你说：所以我总是很努力。今天退役了，我想对每一个队友说：我尽力了。",
    "你讲起自己第一次摸到季后赛地板，说紧张得前一天晚上没睡好。{achievement}。你说：那场比赛你打得一般，但你永远不会忘记那种感觉。后来你打了无数次季后赛，第一次的感觉，只有一次。",
    "有记者问你，退役之后会不会写一首歌。你说：不会。{achievement}。你说：但我会常常听。因为打球的时候，我们更衣室里总是放着歌，那些歌，都是我的青春。",
    "你举起话筒，说：谢谢你们。{achievement}。你说：这三个字，我在心里排练了很久，但真正说出口的时候，还是觉得不够。因为你们给我的，比这三个字多得多。",
    "你坐在台上，说：我讲一个关于勇气的事。{achievement}。你说：不是投绝杀的勇气，是承认自己老了、该退役了的勇气。今天，我有这个勇气了。",
    "你讲起自己最想念的一个客场，说那里很小，但球迷很热情。{achievement}。你说：他们会在赛后围在球员通道门口，跟我们每一个人击掌。那种热情，大城市反而没有。",
    "你坐在话筒前，说：我今天想正式说一次再见。{achievement}。你说：再见，球场。再见，更衣室。再见，每一个跟我并肩过的队友。再见，那段我用{seasonsCount} 年走完的路。",
    "你举起话筒，说：我想谢谢我自己。{achievement}。台下安静。你说：谢谢那个在低谷里没有放弃的自己，谢谢那个在凌晨爬起来训练的自己。今天，你可以休息了。",
    "你讲起自己的最后一个夏天，说没有训练，没有比赛，只是陪家人待了很久。{achievement}。你说：那是我{seasonsCount} 年来最安静的夏天。安静到，我终于听清了自己心里想说的话。",
    "你坐在台上，说：我想谢谢{firstTeam}。{achievement}。你说：他们给了我第一份合同，也给了我第一个机会。没有他们，就没有后来的我。这份恩情，我会一直记着。",
    "有记者问你，退役之后最想见谁。你说：想见见那些老队友。{achievement}。你说：我们约好了，退役以后每年聚一次。今天，我先履约了。",
    "你举起话筒，说：篮球教会我的第一件事，是输。{achievement}。你说：小时候第一次打比赛输了，我哭了一整晚。后来输得多了，我才学会怎么赢。今天，我想谢谢那些输。",
    "你讲起自己第一次参加训练营，说被老球员教训了一整场。{achievement}。你说：当时觉得很丢脸，现在想起来，那是最有用的课。他教我的不是技术，是职业球员该怎么活着。",
    "你坐在话筒前，说：我今天想讲一个关于鞋子的故事。{achievement}。你说：有一双鞋，陪我走过{seasonsCount} 个赛季，鞋底磨穿了，我也没舍得扔。今天，它和我一起退役了。",
    "记者问你，退役之后会不会想念更衣室的柜子。你说：会。{achievement}。你说：我的柜子里总是贴着一张家人的照片。每次比赛前，我都会看一眼。以后，我可以天天看了。",
    "你举起话筒，说：我想谢谢每一个给我传球的人。{achievement}。你说：没有你们，我拿不到那么多分。篮球是五个人的运动，我的数据里，有你们的功劳。",
    "你坐在台上，说：我这个人不太会煽情。{achievement}。你说：所以我就直说了：我爱篮球，爱了{seasonsCount} 年。今天，这份爱没有结束，只是换了一种方式。",
    "你讲起自己第一次夺冠后的游行，说坐在花车上，看见很多人举着你的牌子。{achievement}。你说：那一刻你突然明白，你赢的不只是一场比赛，是很多人的一整年。",
    "你坐在话筒前，说：我今天想做一个总结。{achievement}。你说：{teamCount} 支球队，{games} 场比赛，{points} 分，还有无数个没有记录的夜晚。这些加起来，就是我的职业生涯。",
    "你举起话筒，说：谢谢{lastTeam}给我这个机会。{achievement}。你说：能在主场退役，是一件很奢侈的事。我知道，这是很多人求都求不来的。我会好好珍惜。",
    "你讲起自己的第一个季后赛，说第一场就输了，而且输得很惨。{achievement}。你说：那晚你在酒店里哭了。后来你才知道，那只是开始。真正的成长，都在那些输球之后。",
    "你坐在台上，说：我打球的时候，最喜欢听的声音是球进网的声音。{achievement}。你说：那声音很轻，但很真实。今天退役了，我还是会去球场，投几个球，听那个声音。",
    "有记者问你，退役之后会不会看自己以前的比赛录像。你说：会。{achievement}。你说：但会快进着看，因为有些球，我自己都看不下去了。台下笑了。你说：不过那些赢球的部分，我会多看几遍。",
    "你举起话筒，说：我今天想谢谢我的对手。{achievement}。你说：是他们逼着我变得更好。没有他们，我不会打到{lastTeam}，也不会打完{games} 场比赛。",
    "你坐在台上，说：我讲一个关于号码的故事。{achievement}。你说：我的号码是{firstTeam}时期选的，后来走到哪，都穿着它。它跟着我，也陪着那些城市。今天，它该歇歇了。",
    "你讲起自己第一次被交易，说在飞机上听到消息，整个人都懵了。{achievement}。你说：后来你学会了一件事：职业球员的行李，永远要轻一点，因为随时可能搬家。",
    "你坐在话筒前，说：我想谢谢那些年给我买球票的人。{achievement}。你说：你们花钱来看我打球，就是对我最大的信任。我没有办法一个一个谢你们，但我今天，想对所有人说一声谢谢。",
    "你举起话筒，说：我退役了，但请你们不要难过。{achievement}。你说：我只是换了一个位置，从场上走到了看台。以后，我会和你们一起，为别人欢呼。",
    "你讲起自己第一次看到总冠军奖杯，说它在陈列室里闪着光。{achievement}。你说：当时你告诉自己，总有一天要摸到它。后来你不仅摸到了，还把它举过了头顶。",
    "你坐在台上，说：我这个人有个习惯，每次比赛前都会把球鞋系得很紧。{achievement}。你说：因为我知道，脚下的路，只有自己走得稳，才能走远。今天，我的路走到头了，但我的习惯还在。",
    "有记者问你，退役之后最想吃什么。你说：想吃妈妈做的饭。{achievement}。你说：打了这么多年球，很少回家吃饭。以后，我要把那些年欠下的饭，一顿一顿补回来。",
    "你举起话筒，说：谢谢我的启蒙教练。{achievement}。你说：是他把一颗篮球塞到我手里，告诉我：这球，能带你走很远。他说的没错。",
    "你讲起自己最紧张的一次罚球，说那是决定比赛的一球。{achievement}。你说：球出手的时候，你脑子里一片空白。球进了以后，你才敢呼吸。那种感觉，你一辈子都不会忘。",
    "你坐在话筒前，说：我今天想讲一个关于“最后”的故事。{achievement}。你说：最后一堂训练课，最后一场比赛，最后一次走进更衣室。这些“最后”，拼成了今天的“开始”。",
    "你举起话筒，说：谢谢{teamList}的球迷。{achievement}。你说：你们的支持，是我坚持下来的原因。没有你们，我可能早就放弃了。今天，我想把这句话说出来。",
    "你讲起自己的第一次全明星首发，说站在球员通道里，听见自己的名字被念出来，眼眶就红了。{achievement}。你说：那不是紧张，是感动。那么多年的努力，终于被看见。",
    "你坐在台上，说：我想谢谢那些没有放弃过我的人。{achievement}。你说：在我低迷的时候，他们选择相信我。这份信任，比任何奖杯都重。",
    "有记者问你，退役之后会不会教孩子打球。你说：会。{achievement}。你说：我想把我会的都教给他们，包括怎么输。因为输，也是篮球的一部分。",
    "你举起话筒，说：我今天想正式告别。{achievement}。你说：告别我的球员生涯，告别那些并肩作战的日子。但篮球，我会一直爱下去。",
    "你讲起自己最难忘的一次绝杀，说球进的那一刻，全场都炸了。{achievement}。你说：但你最难忘的不是那个球，是赛后队友们把你围住，使劲拍你头的画面。那种感觉，比绝杀还爽。",
    "你坐在台上，说：我打球的时候，总是想着赢。{achievement}。你说：今天退役了，我才发现，我怀念的不是赢，是和一群人一起为了赢拼命的样子。",
    "你举起话筒，说：谢谢{lastTeam}的球迷。{achievement}。你说：你们在最后一场比赛里，一直喊我的名字。那声音，我会记一辈子。",
    "你讲起自己第一次参加选秀，说坐在台下，手心全是汗。{achievement}。你说：听到名字的那一刻，你站起来，差点被椅子绊倒。后来你才知道，那只是开始，后面还有更多的“差点”。",
    "你坐在话筒前，说：我想谢谢那些年给我传球的队友。{achievement}。你说：有人给我传了十几年球，从没抱怨过。我的每一分，都有他们的一半。",
    "有记者问你，退役之后会不会去现场看球。你说：会。{achievement}。你说：但我会买最便宜的票，坐在角落里，安安静静地看。我想用普通球迷的身份，重新认识篮球。",
    "你举起话筒，说：我今天不想说太多。{achievement}。你说：因为所有的话，都在我的比赛里。我只想说：谢谢，谢谢你们陪我走过这{seasonsCount} 年。",
    "你讲起自己第一次受伤，说躺在球场上，看着天花板，心想：完了，我的生涯要结束了。{achievement}。你说：后来你回来了，而且打了很久。那次受伤，让你学会珍惜。",
    "你坐在台上，说：我想谢谢那些熬夜看我比赛的球迷。{achievement}。你说：你们的时差，可能比我的客场还多。你们用睡眠，换来了我的每一场胜利。这份情，我记下了。",
    "你举起话筒，说：我今天想讲一个关于梦想的故事。{achievement}。你说：有个孩子，梦想着打NBA。后来他打了，而且打了{seasonsCount} 年。今天，他退役了，但他想告诉所有孩子：梦想，是可以实现的。",
    "你讲起自己的第一场全明星，说在球员通道里，看见了自己的偶像。{achievement}。你说：你紧张得不知道说什么，结果他先开口了：你打得不错。那五个字，你记了一辈子。",
    "你坐在话筒前，说：我今天想谢谢我的队友们。{achievement}。你说：他们有人陪我拿过冠军，有人陪我熬过低谷，有人只陪我打过一场比赛。但每一个，我都记得。",
    "你举起话筒，说：退役不是终点，是新的起点。{achievement}。你说：我会带着篮球教会我的东西，继续往前走。只是以后，我不再用球说话了。",
    "你讲起自己最难忘的一次训练，说那天下着大雨，你一个人在球馆里练到很晚。{achievement}。你说：外面雨声很大，但你听不见，因为你心里只有一个声音：再投一个。",
    "你坐在台上，说：我想谢谢那些给我机会的人。{achievement}。你说：{firstTeam}给了我第一份合同，{lastTeam}给了我最后一份合同。中间的每一站，都有人在背后推我。",
    "有记者问你，退役之后会不会偶尔梦见打球。你说：会。{achievement}。你说：梦里我还在场上，还在投球。醒过来以后，我会愣一会儿，然后笑一笑：原来我退役了。",
    "你举起话筒，说：我今天想讲一个关于时间的笑话。{achievement}。你说：我总觉得自己还是新秀，结果一眨眼，{seasonsCount} 个赛季就过去了。时间这个裁判，从来不吹暂停。",
    "你坐在台上，说：我打球的时候，最喜欢看的是球迷的脸。{achievement}。你说：他们哭，他们笑，他们喊我的名字。那些表情，是我坚持下来的理由。",
    "你讲起自己第一次夺冠后的更衣室，说大家都在喷香槟，你也喷了，然后被呛得直咳嗽。{achievement}。你说：那是我最狼狈也最开心的一天。今天，我想起那天，还是想笑。",
    "你举起话筒，说：谢谢你们，让我打了一场好球。{achievement}。你说：这{seasonsCount} 年，是我人生里最好的一场比赛。现在，终场哨响了，我该下场了。",
    "你讲起自己最想念的一个客场，说那里有一家小餐馆，每次去都会吃同样的菜。{achievement}。你说：后来老板认出你了，每次都会多给你加一个蛋。今天退役了，你突然很想念那个蛋。",
    "你坐在台上，说：我想谢谢那些年给我递毛巾的人。{achievement}。你说：他们可能没有名字，但每一场比赛，他们都站在场边。没有他们，球员连汗都没地方擦。",
    "有记者问你，退役之后最想做什么。你说：想当一个普通的球迷。{achievement}。你说：买票进场，为喜欢的球队加油，比赛结束以后，跟朋友讨论谁打得好。那种纯粹的快乐，我想重新体会一次。",
    "你举起话筒，说：我今天想讲一个关于“回家”的故事。{achievement}。你说：打了{seasonsCount} 年球，去了很多城市，但每次回家，我都会去小时候练球的球场看看。今天，我终于可以一直待在那里了。",
    "你讲起自己第一次面对老东家，说赛前在球员通道里，不知道该不该跟他们打招呼。{achievement}。你说：后来他们先开口了：欢迎回家。那四个字，让你鼻子一酸。",
    "你坐在台上，说：我这个人不太会说话，所以总是用行动表达。{achievement}。你说：今天，我想用这个鞠躬，谢谢你们。然后你站起来，深深地鞠了一躬。",
    "你举起话筒，说：谢谢我的家人，谢谢我的朋友，谢谢所有支持我的人。{achievement}。你说：这{seasonsCount} 年，我不是一个人走过来的。你们每一个人，都是我路上的灯。",
    "你讲起自己的第一次得分，说那是一个上篮，球在篮筐上转了两圈才掉进去。{achievement}。你说：当时你紧张得忘了庆祝，只顾着往后退防。现在想起来，那两圈，像你整个生涯的预演。",
    "你坐在话筒前，说：我今天想讲一个关于“等待”的故事。{achievement}。你说：我等过很多年，等一个机会，等一个冠军，等一个答案。今天，我终于等到可以坦然说再见的时候了。",
    "有记者问你，退役之后会不会觉得生活突然空了。你说：会有一点。{achievement}。你说：但空的地方，正好可以放新的东西。我想放进去旅行、家人，还有那些我错过很久的生活。",
    "你举起话筒，说：我今天想谢谢那些批评我的人。{achievement}。你说：他们让我时刻保持清醒。我从来没有恨过他们，因为我知道，他们只是希望我更好。",
    "你讲起自己最骄傲的一次复出，说伤停了很久，所有人都说你不行了。{achievement}。你说：复出第一场，你打得一般，但你在场上待了整整四十八分钟。你想告诉他们：我还在。",
    "你坐在台上，说：我想谢谢{lastTeam}的球迷。{achievement}。你说：你们接纳了一个不再年轻的球员，让他可以在主场退役。这份温柔，我会一直记着。",
    "你举起话筒，说：我今天想讲一个关于“第一次”的故事。{achievement}。你说：第一次摸到篮球，第一次进球，第一次进NBA，第一次夺冠。今天，我第一次退役。每一个第一次，我都记得。",
    "你讲起自己最遗憾的一场比赛，说那场你发挥失常，球队输掉了系列赛。{achievement}。你说：赛后你一个人在更衣室坐了很久。后来你明白了，遗憾也是生涯的一部分，它会让你更珍惜下一次。",
    "你坐在话筒前，说：我想谢谢那些年给我支持的人。{achievement}。你说：你们的欢呼，是我在场上奔跑的理由。今天，我想把这份感激，还给你们。",
    "有记者问你，退役之后会不会想念比赛的压力。你说：会。{achievement}。你说：那种压力，让你知道自己还活着。但现在，我想换一种压力：比如，怎么给家人做一顿好吃的饭。",
    "你举起话筒，说：我今天想讲一个关于“选择”的故事。{achievement}。你说：我选择过篮球，选择过坚持，选择过相信。今天，我选择退役。每一个选择，我都认真过。",
    "你讲起自己的最后一个赛季，说很多人劝你再多打一年。{achievement}。你说：你犹豫过，但最后还是决定离开。因为你不想让球迷看到你跑不动的样子。你想让他们记住最好的你。",
    "你坐在台上，说：我想谢谢我的身体。{achievement}。你说：它陪我打了{seasonsCount} 年，受过很多伤，但从来没有背叛过我。今天，我想让它好好休息。",
    "你举起话筒，说：谢谢你们的掌声。{achievement}。你说：这{seasonsCount} 年里，我听过很多掌声，但今天这一次，是我最珍惜的一次。因为它是送给“告别”的。",
    "你讲起自己第一次参加季后赛，说第一场就紧张得失眠。{achievement}。你说：后来你学会了一个方法：比赛前，给自己泡一杯茶，慢慢喝完，就不紧张了。这个方法，你用到了最后一场。",
    "你坐在话筒前，说：我今天想讲一个关于“回家”的故事。{achievement}。你说：打了这么多年球，我终于可以回家了。回到那个有家人、有朋友、有生活的地方。那里，才是我的主场。",
    "有记者问你，退役之后会不会继续穿篮球鞋。你说：会。{achievement}。你说：但我会穿那种舒服的，不磨脚的。以前打球，鞋要新，要抓地，现在，只要舒服就好。",
    "你举起话筒，说：我想谢谢每一个陪我走过低谷的人。{achievement}。你说：在我最黯淡的时候，你们没有离开。这份情谊，我会用一辈子去还。",
    "你讲起自己最难忘的一次全明星，说那晚你投进了几个漂亮的球，但最开心的，是看到老朋友们都还在。{achievement}。你说：那场全明星，像一场同学会，只是我们都在场上打球。",
    "你坐在台上，说：我想谢谢{firstTeam}。{achievement}。你说：他们给了我第一份合同，也给了我第一个家。虽然我只在那里待了几年，但那里永远是我的起点。",
    "你举起话筒，说：我今天想讲一个关于“坚持”的故事。{achievement}。你说：有一个人，坚持了{seasonsCount} 年，每天训练，每天比赛，每天跟自己的身体较劲。今天，他终于可以停下来，好好休息了。",
    "你讲起自己第一次拿到大合同，说签完字以后，在车里坐了很久。{achievement}。你说：你没有高兴地跳起来，只是长舒了一口气。因为你知道，这只是开始，你还要证明自己值得。",
    "你坐在话筒前，说：我想谢谢那些年给我传球的队友。{achievement}。你说：你们的传球，是我的信心。你们的信任，是我奔跑的动力。我的每一个进球，都有你们的影子。",
    "有记者问你，退役之后会不会偶尔梦见比赛。你说：会。{achievement}。你说：梦里的比赛，总是赢的。醒过来以后，你会笑着想：原来在我心里，我从来没输过。",
    "你举起话筒，说：我今天想讲一个关于“告别”的故事。{achievement}。你说：告别不是结束，是另一种开始。今天，我告别球员的身份，开始人生的下半场。",
    "你讲起自己最想念的一个队友，说他已经不在联盟了。{achievement}。你说：但每年夏天，你们还会一起吃饭，聊起当年的事。他总说：你还在打啊。你说：是啊，替你打。",
    "你坐在台上，说：我想谢谢那些年给我机会的教练。{achievement}。你说：有人让我打首发，有人让我坐板凳，有人骂过我，也有人夸过我。但每一个，都教会了我一些东西。",
    "你举起话筒，说：谢谢你们，让我的职业生涯没有遗憾。{achievement}。你说：如果一定要说遗憾，那就是：我再也听不到你们喊我名字了。但那些声音，我会一直记在心里。",
    "你讲起自己的第一个签名，说签在一件白色的球衣上。{achievement}。你说：那个球迷拿着球衣，激动得手都在抖。你问他叫什么名字，他说了，但你没有听清，因为他太激动了。后来你每次签名，都会先问名字，再慢慢签。",
    "你坐在话筒前，说：我今天想讲一个关于“成长”的故事。{achievement}。你说：从{firstTeam}到{lastTeam}，从新秀到老将，从青涩到成熟。这{seasonsCount} 年，我长大了，也变老了，但篮球教会我的东西，永远不会变。",
    "有记者问你，退役之后会不会觉得自己失去了什么。你说：会。{achievement}。你说：失去的是每天比赛的习惯，失去的是更衣室的喧闹。但得到的，是新的生活。有失有得，才是人生。",
    "你举起话筒，说：我今天想谢谢{teamList}。{achievement}。你说：你们每一个主场，我都认真打过。你们每一个球迷，我都记得。今天，我想把这份感谢，说给每一座城市听。",
    "你讲起自己第一次参加总决赛，说赛前紧张得胃疼。{achievement}。你说：后来你发现，所有的紧张，都会在跳球那一刻消失。因为那一刻，你只想赢。",
    "你坐在台上，说：我想谢谢那些年给我鼓掌的人。{achievement}。你说：你们可能不知道，你们的掌声，是我在低谷时最大的力量。今天，我想把这份力量，还给你们。",
    "你举起话筒，说：我今天想讲一个关于“热爱”的故事。{achievement}。你说：有一个人，热爱篮球，热爱了{seasonsCount} 年。今天，他没有失去这份热爱，只是换了一种方式继续爱。",
    "你讲起自己最难忘的一次更衣室演讲，说那是总决赛前，队长说的。{achievement}。你说：他说，我们可能不是最有天赋的球队，但我们一定是最努力的。那场，你们赢了。",
    "你坐在话筒前，说：我想谢谢我的家人。{achievement}。你说：他们陪我走了很远的路，从来没有抱怨过。今天，我终于可以多陪陪他们了。",
    "有记者问你，退役之后会不会想念客场。你说：会。{achievement}。你说：那些凌晨的飞机，那些陌生的城市，那些酒店的房间，都成了我生活的一部分。以后，我可能会想念它们。",
    "你举起话筒，说：我今天想讲一个关于“感谢”的故事。{achievement}。你说：谢谢{firstTeam}，谢谢{lastTeam}，谢谢{teamList}，谢谢每一个看过我打球的人。这{seasonsCount} 年，谢谢你们。",
    "你讲起自己最骄傲的一场比赛，说那场你得了很多分，但最骄傲的不是数据，是你让一个年轻队友投进了生涯第一球。{achievement}。你说：篮球的意义，从来不只是赢，是让身边的人变得更好。",
    "你坐在台上，说：我想谢谢那些年陪我看录像的人。{achievement}。你说：他们可能是教练，可能是队友，可能只是深夜还在球馆的保安。但那些灯光，我都记得。",
    "你举起话筒，说：我今天想正式退役了。{achievement}。你说：这句话，我说了很多遍，但今天，它是真的了。谢谢你们，陪我走完这段路。",
    "你讲起自己的最后一场比赛，说终场哨响的时候，你没有哭，只是站在那里，听完了整场欢呼。{achievement}。你说：那是{seasonsCount} 年篮球生涯里，你最想记住的三分钟。今天，它永远属于你了。",
    "你坐在台上，说：我以前总以为退役是很远的事。{achievement}。你说：结果它来得比想象中快。但没关系，我已经把该打的比赛都打完了，该记得的人都记住了。",
    "有记者问你，退役以后会不会想回{firstTeam}。你说：会，而且会常回去。{achievement}。你说：那里有我最开始的样子。我想偶尔回去看看，提醒自己是怎么走过来的。",
    "你举起话筒，说：我今天想讲一个关于“最后一球”的故事。{achievement}。你说：我投进过很多球，但最后一球，我没有出手。我把它传给了队友。因为那一刻，我想把机会留给未来。",
    "你讲起自己第一次受伤，说躺在球场上，看见天花板在转。{achievement}。你说：那时候我想，完了，我的生涯要结束了。后来你回来了。那一次，让你学会了珍惜每一场。",
    "你坐在话筒前，说：我想谢谢那些年给我传球的人。{achievement}。你说：没有他们，我拿不到那么多分。篮球是五个人的运动，我的荣誉里，有他们每一个人。",
    "有记者问你，退役之后最想做什么。你说：想当一个普通观众。{achievement}。你说：买票进场，为球队加油，比赛结束以后跟朋友聊天。那种简单的快乐，我很久没有体会过了。",
    "你举起话筒，说：我今天不想煽情。{achievement}。台下笑了。你说：但我想说一句认真的：这{seasonsCount} 年，我没有一天后悔过选择篮球。",
    "你讲起自己的第一个全明星，说在球员通道里看见了很多传奇。{achievement}。你说：那时候你紧张得手心全是汗。后来你上场了，投进了第一个球，才敢相信自己属于这里。",
    "你坐在台上，说：我打球的时候，总觉得自己还年轻。{achievement}。你说：直到有一天，队里新来的孩子喊我“老将”，我才发现，时间真的过去了。但我不难过，因为每一段都有它自己的好。",
    "有记者问你，退役以后会不会觉得心里空了一块。你说：会。{achievement}。你说：但空出来的地方，正好可以装下新的东西。我想装进生活，装进那些我错过很久的日常。",
    "你举起话筒，说：谢谢{firstTeam}。{achievement}。你说：他们给了我第一份合同，也给了我第一个相信我的机会。没有他们，我可能不会走到这里。",
    "你讲起自己最难忘的一次客场，说那晚球队输了，但球迷在酒店门口等了一夜。{achievement}。你说：他们没说什么，只是递给你一瓶水，说：辛苦了。那瓶水，你记到现在。",
    "你坐在话筒前，说：我想谢谢我的家人。{achievement}。你说：他们陪我从选秀走到退役，从来没有缺席过。今天这场发布会，我想让他们知道，我的每一分，都有他们的功劳。",
    "有记者问你，如果回到新秀赛季，你会对自己说什么。你说：别紧张。{achievement}。你说：那些你以为会毁掉你的失误，其实都会变成你后来的谈资。放轻松，慢慢来。",
    "你举起话筒，说：我今天正式退役了。{achievement}。台下安静。你说：但请你们不要觉得可惜。因为我已经把最好的自己，都留在了球场上。",
    "你讲起自己最骄傲的一次防守，说那球你从三分线追到篮下，把球拍出界外。{achievement}。你说：那不是一个漂亮的数据，但那是我想让所有人看到的我：认真，不放弃。",
    "你坐在台上，说：我这一生，大部分时间都在打球。{achievement}。你说：现在我退役了，终于可以回答那个问题：如果不打球，我会做什么。答案是：我会很想打球。",
    "有记者问你，退役以后会不会看以前的比赛。你说：会。{achievement}。你说：但会挑着看。输球的不看，太可惜的也不看。只看那些我真正打好的夜晚。",
    "你举起话筒，说：我想谢谢每一个对手。{achievement}。你说：他们让我知道，篮球不是一个人的游戏。每一次交手，都让我变得更强。",
    "你讲起自己第一次夺冠，说那天你哭了。{achievement}。你说：不是因为赢，是因为想到很多年前，那个在{firstTeam}练球的小孩，终于等到了这一天。",
    "你坐在话筒前，说：我今天想讲一个关于“名字”的故事。{achievement}。你说：我的名字，在{firstTeam}被第一次喊响，在{teamList}被越来越多的人记住，最后在{lastTeam}被送进了历史。",
    "有记者问你，退役之后最想念什么。你说：想念比赛前那种紧张。{achievement}。你说：那种紧张让你觉得，自己还活着。以后没有了，我会有点不习惯。",
    "你举起话筒，说：谢谢你们来听我说话。{achievement}。你说：也谢谢你们看我打球。这{seasonsCount} 年，你们是最忠实的观众，我是最幸运的球员。",
    "你讲起自己最安静的一次庆祝，说那场赢了以后，你一个人坐在更衣室，什么都没做。{achievement}。你说：不是不开心，是太累了。但那种累，是甜的。",
    "你坐在台上，说：我这个人不太会表达，所以总是用行动说话。{achievement}。你说：今天也一样。我站起来，鞠一躬，就是我想说的全部。",
    "有记者问你，退役之后会不会继续打野球。你说：会。{achievement}。你说：但会挑那种没有摄像机的球场，投几个，跑几步，然后回家吃饭。",
    "你举起话筒，说：我想谢谢{lastTeam}。{achievement}。你说：你们让我可以在主场退役，这是我职业生涯最后的礼物。我会一直记得。",
    "你讲起自己最后一次训练，说那天你投到球馆熄灯。{achievement}。你说：保安没有催你，只是在门口等着。你投完最后一球，把球放回球架，然后说：好了，走吧。",
    "你坐在话筒前，说：我这一生，做对过很多事，也做错过很多事。{achievement}。你说：但有一件事，我从来没有做错：选择篮球。",
    "有记者问你，退役以后有什么计划。你说：没有计划。{achievement}。你说：我想先休息，睡够，然后慢慢想。打了这么多年球，我终于可以不用按日程表活着了。",
    "你举起话筒，说：谢谢{teamList}。{achievement}。你说：你们是我的第二故乡。每一座城，都有我的一段故事。今天，我把这些故事都带走了。",
    "你讲起自己第一次穿国家队球衣，说那一刻你觉得自己代表的不是自己。{achievement}。你说：那种感觉，和打NBA不一样，但同样重。今天退役了，那份重量还在。",
    "你坐在台上，说：我想谢谢那些年给我写信的球迷。{achievement}。你说：你们的信，我很多都留着。在低谷的时候，我会翻出来看，告诉自己：有人在等我。",
    "有记者问你，退役之后会不会想念客场。你说：会。{achievement}。你说：那些凌晨的飞机，陌生的城市，酒店的房间，都成了我生活的一部分。以后，我可能会想念它们。",
    "你举起话筒，说：我今天想讲一个关于“坚持”的故事。{achievement}。你说：有一个人，坚持了{seasonsCount} 年，从{firstTeam}打到{lastTeam}。今天，他退役了，但他希望你们记住的，不是退役，是坚持。",
    "你讲起自己最难过的一场比赛，说那场你输了，而且输得很不甘心。{achievement}。你说：赛后你在更衣室坐了很久，想了很多。后来你明白了，篮球就是这样，会有输，会有赢，重要的是你没有逃避。",
    "你坐在话筒前，说：我想谢谢我的启蒙教练。{achievement}。你说：是他告诉我，篮球可以改变人生。今天，我想告诉他，他说得对。",
    "有记者问你，退役之后会不会觉得自己失去了一部分。你说：会。{achievement}。你说：但失去的那部分，会变成回忆。回忆不会疼，只会让我笑。",
    "你举起话筒，说：我最后想说一句。{achievement}。台下安静。你说：篮球，谢谢。然后你放下话筒，走下了台，像打完最后一场比赛一样平静。",
    "你讲起自己第一次走进{firstTeam}的球馆，说那时候你连更衣室都找不到。{achievement}。你说：今天最后一次走出{lastTeam}的球馆，你也没有回头。因为你知道，你已经把该留下的，都留下了。",
];

;

// ── 结局媒体时代回声：8 种版式 × 32 个报道角度 ──
// 每次生涯固定抽取两条，避免在同一结局流程中刷新变文案；新生涯重新抽取。
var ENDING_MEDIA_FORMATS = [
  { id:'newspaper', icon:'📰', source:'篮坛纪事报', kicker:'退役特刊', stamp:'清晨头版' },
  { id:'broadcast', icon:'📺', source:'全场紧逼 TV', kicker:'突发新闻', stamp:'晚间直播' },
  { id:'magazine', icon:'📕', source:'终场哨声', kicker:'封面人物', stamp:'收藏特刊' },
  { id:'teamwire', icon:'🏟️', source:'球队官方通讯', kicker:'官方公告', stamp:'球队档案' },
  { id:'fanzine', icon:'📣', source:'第六人看台报', kicker:'球迷自印刊', stamp:'主场门口派发' },
  { id:'podcast', icon:'🎙️', source:'加时赛播客', kicker:'特别节目', stamp:'第 4 节录音室' },
  { id:'documentary', icon:'🎬', source:'最后一舞纪录片', kicker:'未公开片段', stamp:'镜头之外' },
  { id:'wire', icon:'📠', source:'联盟新闻社', kicker:'新闻快讯', stamp:'即时电讯' }
];

var ENDING_MEDIA_STORIES = [
  { id:'empty_locker', tag:'general', headline:'更衣柜已经清空，名字还留在门上', body:'工作人员把最后一双球鞋装进纸箱。第二天训练开始时，队友仍下意识望向那个位置。', quote:'离开的是球员，留下的是所有人已经习惯的标准。' },
  { id:'last_bus', tag:'general', headline:'球队大巴少了一个永远提前到的人', body:'司机记得你总坐同一个位置，也记得客场输球后你常常最后一个下车。漫长赛季结束了，那张座位第一次一直空着。', quote:'有些生涯写在奖杯上，有些写在每天准时出发的大巴里。' },
  { id:'kids_court', tag:'general', headline:'城市球场突然多了很多同样的号码', body:'退役消息公布后的周末，社区球馆里到处是模仿你动作的孩子。动作还不标准，庆祝姿势却学得一模一样。', quote:'一个球员真正留下来，是孩子开始假装自己就是他。' },
  { id:'old_tape', tag:'general', headline:'录像室把你的比赛单独留了一块硬盘', body:'助教说新人以后还会反复看这些片段：怎样跑位、怎样回应低谷、怎样在最后两分钟保持安静。', quote:'数据告诉后来者你做到了什么，录像告诉他们你是怎么做到的。' },
  { id:'schedule_gap', tag:'general', headline:'新赛季赛程公布，人们先找不见的那个名字', body:'联盟照常向前，新的明星登上揭幕战海报。球迷翻到最后，才真正意识到你的职业生涯已经结束。', quote:'时代结束时没有哨声，只有下一张赛程表上少了一个熟悉的人。' },
  { id:'opponent_salute', tag:'general', headline:'老对手发来一句：终于不用防你了', body:'那条消息后面跟着一个笑脸。几分钟后，他又补了一句：说真的，和你打球让我变得更好。', quote:'最诚实的致敬，常常来自那些曾经最想击败你的人。' },
  { id:'trainer_room', tag:'general', headline:'训练师收起那份用了多年的身体报告', body:'纸页上记着每一次扭伤、每一次恢复和每一次坚持出场。最后一页只有一行字：任务完成。', quote:'伟大不仅是高光，也是把身体一次次带回球场。' },
  { id:'one_ticket', tag:'general', headline:'一张旧球票，讲完了整段生涯', body:'一位球迷晒出你新秀首战的票根，又放上最后一战的照片。两张纸之间，是他和你一起长大的岁月。', quote:'球员计算赛季，球迷计算青春。' },
  { id:'quiet_morning', tag:'general', headline:'退役后的第一个清晨，没有训练提醒', body:'你还是在熟悉的时间醒来。窗外很安静，身体却已经准备好去球馆。多年形成的节奏，不会在一夜之间消失。', quote:'告别比赛很快，学会不再比赛需要更久。' },
  { id:'locker_story', tag:'general', headline:'年轻队友开始讲“他以前会怎么做”', body:'战术暂停遇到混乱时，有人重复你说过的话。你已经不在名单里，却依然参与着这支球队的决定。', quote:'传承不是雕像，是你的习惯变成了别人的本能。' },
  { id:'ring_case', tag:'champion', headline:'戒指陈列柜合上，冠军故事仍在继续', body:'你赢得的 {championships} 座总冠军被摆进同一束灯光里。每一枚戒指背后，都是一支完全不同却同样相信你的球队。', quote:'冠军不是生涯的全部，但它证明你曾把一个赛季带到最后。' },
  { id:'parade_route', tag:'champion', headline:'夺冠游行路线再次挂起你的照片', body:'城市没有重新封路，只是在熟悉的街角放上那年夏天的画面。人们路过时，仍会指认自己当年站的位置。', quote:'奖杯属于球队，游行属于整座城市的记忆。' },
  { id:'clutch_archive', tag:'champion', headline:'联盟重播你最关键的第四节', body:'节目没有只剪进球，也保留了暂停时的眼神和最后一次防守。那是冠军真正形成的几分钟。', quote:'关键时刻不是一个投篮，而是所有人都知道球该交给谁。' },
  { id:'banner_shadow', tag:'champion', headline:'冠军旗帜下，多出一个不能被跳过的名字', body:'新球员第一次走进主场时抬头看见那些年份。教练告诉他们，{player}曾经把这里的标准推到那么高。', quote:'王朝会结束，冠军建立的尺度不会。' },
  { id:'goat_debate', tag:'goat', headline:'历史第一的争论，从你退役这天重新开始', body:'每档节目都列出自己的标准，但 {mvp} 座MVP、{championships} 座冠军和 {fmvp} 座FMVP让任何榜单都无法绕开你。', quote:'争论不会给出终点，却已经说明你站在最前面。' },
  { id:'goat_museum', tag:'goat', headline:'联盟博物馆为你的时代腾出整面墙', body:'球衣、球鞋、比赛用球和手写战术被放在一起。策展人说，单独一件都讲不完这段生涯。', quote:'有人进入历史，有人迫使历史重新布置展厅。' },
  { id:'goat_standard', tag:'goat', headline:'后来者不再追一个纪录，而是追你的整段生涯', body:'得分、奖杯、持续时间和关键比赛被放在同一张表里。比较变得近乎苛刻，因为你的答案太完整。', quote:'纪录可以被拆开超越，完整的时代很难复制。' },
  { id:'one_city_map', tag:'one_team', headline:'一座城市，用 {seasonsCount} 年把你变成自己人', body:'从新秀公寓到最后一场比赛，你的路线几乎可以画成城市地图。每个街区都有人拥有一段与你有关的记忆。', quote:'忠诚不是从未想过离开，而是一次次选择留下。' },
  { id:'one_city_store', tag:'one_team', headline:'主场商店决定永久保留你的球衣', body:'新赛季球衣已经上架，你的号码仍放在最醒目的位置。店员说，那不是旧款，是城市的常备款。', quote:'有些号码不会过季。' },
  { id:'one_city_key', tag:'one_team', headline:'市长把城市钥匙交给最熟悉的球员', body:'仪式不长，你却在台上认出了很多老面孔。他们从新秀年就在看台上，今天头发已经白了。', quote:'你守住一支球队，城市也会替你守住名字。' },
  { id:'many_passports', tag:'journeyman', headline:'多座城市同时刊出同一句：谢谢你来过', body:'从{firstTeam}到{lastTeam}，每一站记住你的方式不同。有人记得绝杀，有人记得更衣室，也有人只记得你从不敷衍。', quote:'辗转不是漂泊，是把同一种认真带到更多地方。' },
  { id:'many_jerseys', tag:'journeyman', headline:'衣柜里每件球衣，都是一段没有被抹掉的关系', body:'你把效力过的球队球衣按时间排好。颜色彼此冲突，放在一起却正好拼成完整的职业生涯。', quote:'换队会改变地址，不会取消在那里认真生活过的年份。' },
  { id:'airport_map', tag:'journeyman', headline:'机场航线图，意外成了你的生涯地图', body:'你曾无数次拖着行李去往新城市。退役后回看，那些转机、酒店和陌生球馆都成了故事的一部分。', quote:'不是每条传奇之路都笔直。' },
  { id:'scoring_book', tag:'scorer', headline:'技术台封存那支写下 {points} 分的笔', body:'记分员说，很多夜晚只要你开始连续得分，他就知道自己的工作会变得很忙。', quote:'篮筐不会记住每一球，观众会记住比赛被你点燃的声音。' },
  { id:'shot_chart', tag:'scorer', headline:'一张投篮热区图，几乎没有冷色', body:'数据节目把你整个生涯的出手叠在一张图上。密密麻麻的落点像一座只属于得分手的城市。', quote:'你把球场每一块地板，都变成过自己的位置。' },
  { id:'defense_tape', tag:'defender', headline:'最好的致敬片里，主角很少碰球', body:'剪辑全是换防、协防和把对手逼向错误方向。没有华丽数字，教练们却看得比任何人都认真。', quote:'防守的伟大，是让本来会发生的事情没有发生。' },
  { id:'opponent_relief', tag:'defender', headline:'得分手们公开承认：今晚终于能睡好了', body:'他们讲起被你缠住的夜晚，语气像抱怨，脸上却全是尊敬。', quote:'最好的防守奖杯，有时写在对手的噩梦里。' },
  { id:'assist_tree', tag:'playmaker', headline:'联盟画出一棵由你传球长成的得分树', body:'每条枝杈连接一位曾接到你助攻的队友。图越画越大，最后几乎装下了一个时代。', quote:'组织者最伟大的统计，是让多少人的高光成为可能。' },
  { id:'teammate_contracts', tag:'playmaker', headline:'多位队友说，他们的下一份合同里有你一份功劳', body:'你的传球让年轻人被看见，也让老将重新找到位置。助攻表只记一次，职业生涯却因此延长很多年。', quote:'真正的控卫不只传出得分，也传出队友的未来。' },
  { id:'no_ring_respect', tag:'no_ring', headline:'没有戒指，同行投票仍把你列入最难对付的人', body:'冠军栏保持空白，但对手没有用它否定你。他们记得每轮系列赛前，教练都必须先写下你的名字。', quote:'遗憾会留在履历里，尊重留在真正交过手的人心里。' },
  { id:'no_ring_city', tag:'no_ring', headline:'城市没有等到冠军，仍为你站到最后', body:'最后一场结束后，看台迟迟没有清空。球迷知道故事不够圆满，也知道认真不该只由奖杯证明。', quote:'无冕不是无名，有些爱不需要冠军游行。' },
  { id:'no_ring_letter', tag:'no_ring', headline:'一封公开信写道：谢谢你让等待也有意义', body:'球迷没有假装那些失利不疼。他们只是说，在最难的年份里，你从来没有先放弃这座城市。', quote:'结局可以遗憾，陪伴不会因此作废。' }
];

function endingMediaStoryEligible(story, r) {
  if (story.tag === 'general') return true;
  if (story.tag === 'champion') return (r.championships || 0) > 0;
  if (story.tag === 'goat') return !!r.goat;
  if (story.tag === 'one_team') return (r.teamCount || 0) === 1 && (r.seasonsCount || 0) >= 4;
  if (story.tag === 'journeyman') return (r.teamCount || 0) >= 3;
  if (story.tag === 'scorer') return (r.games || 0) > 0 && (r.points || 0) / r.games >= 24;
  if (story.tag === 'defender') return (r.dpoy || 0) > 0;
  if (story.tag === 'playmaker') return !!(STATE.career && STATE.career.totalStats && (STATE.career.totalStats.ast || 0) / Math.max(1, STATE.career.totalStats.games || 0) >= 7);
  if (story.tag === 'no_ring') return (r.championships || 0) === 0 && (r.score || 0) >= 60;
  return true;
}

function pickEndingMediaMoments(r, count) {
  count = count || 2;
  var eligible = ENDING_MEDIA_STORIES.filter(function(story) { return endingMediaStoryEligible(story, r); });
  var special = eligible.filter(function(story) { return story.tag !== 'general'; });
  var general = eligible.filter(function(story) { return story.tag === 'general'; });
  function shuffled(list) { return list.slice().sort(function() { return Math.random() - .5; }); }
  var ordered = shuffled(special).concat(shuffled(general));
  var formats = shuffled(ENDING_MEDIA_FORMATS);
  var moments = [];
  for (var i = 0; i < ordered.length && moments.length < count; i++) {
    moments.push({ storyId: ordered[i].id, formatId: formats[moments.length % formats.length].id });
  }
  return moments;
}

function ensureEndingMediaMoments(r) {
  if (!Array.isArray(r.endingMediaMoments) || r.endingMediaMoments.length < 2) {
    r.endingMediaMoments = pickEndingMediaMoments(r, 2);
  }
  return r.endingMediaMoments;
}

function fillEndingMediaText(text, r) {
  var vars = {
    player: (typeof getHupuDisplayName === 'function') ? getHupuDisplayName() : '你的名字',
    seasonsCount: r.seasonsCount || 0, games: r.games || 0, points: Math.round(r.points || 0),
    championships: r.championships || 0, mvp: r.mvp || 0, fmvp: r.fmvp || 0,
    firstTeam: r.firstTeam || '', lastTeam: r.lastTeam || '', teamList: r.teamList || ''
  };
  return String(text || '').replace(/\{(\w+)\}/g, function(m, key) { return key in vars ? String(vars[key]) : m; });
}

function renderEndingMediaMoment(moment, r, index, total) {
  var story = ENDING_MEDIA_STORIES.find(function(item) { return item.id === moment.storyId; }) || ENDING_MEDIA_STORIES[0];
  var format = ENDING_MEDIA_FORMATS.find(function(item) { return item.id === moment.formatId; }) || ENDING_MEDIA_FORMATS[0];
  return '<div class="legacy-media-card ' + format.id + '" data-media-story="' + story.id + '" data-media-format="' + format.id + '">' +
    '<div class="legacy-media-kicker">' + format.kicker + ' · 时代回声 ' + (index + 1) + '/' + total + '</div>' +
    '<div class="legacy-media-source"><span>' + format.icon + ' ' + format.source + '</span><small>' + format.stamp + '</small></div>' +
    '<div class="legacy-media-headline">' + fillEndingMediaText(story.headline, r) + '</div>' +
    '<div class="legacy-media-body">' + fillEndingMediaText(story.body, r) + '</div>' +
    '<div class="legacy-media-quote">“' + fillEndingMediaText(story.quote, r) + '”</div>' +
    '</div>';
}

function buildRetirementCopy(r) {
  var pool = r.goat ? GOAT_COPY : RETIREMENT_COPY;
  var variant = (r.goat && typeof r.goatCopyVariant === 'number') ? r.goatCopyVariant : r.retirementCopyVariant;
  var idx = typeof variant === 'number' ? (variant % pool.length) : Math.floor(Math.random() * pool.length);
  var tpl = pool[idx] || pool[0];
  var vars = {
    achievement: buildCareerAchievement(r),
    tier: r.tier || '',
    score: r.score || 0,
    games: r.games || 0,
    points: Math.round(r.points || 0),
    championships: r.championships || 0,
    mvp: r.mvp || 0,
    fmvp: r.fmvp || 0,
    dpoy: r.dpoy || 0,
    allNBA: r.allNBA || 0,
    allStar: r.allStar || 0,
    teamCount: r.teamCount || 0,
    longestTeam: getTeamName(r.longestTeam || r.team || ''),
    longestYears: r.longestYears || 0,
    firstTeam: r.firstTeam || '',
    lastTeam: r.lastTeam || '',
    teamList: r.teamList || '',
    seasonsCount: r.seasonsCount || 0,
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

function calculateLegacyResult() {
  var c = STATE.career || {};
  var seasons = c.seasons || [];
  var honors = c.honors || [];
  function cnt(key) { return honors.filter(function(h) { return (h.label || '').indexOf(key) >= 0 && !isRookieHonorForLaterSeason(h); }).length; }
  var championships = cnt('总冠军');
  var seasonChampTotal = 0;
  seasons.forEach(function(s) { if ((s.playoffResult || '').indexOf('总冠军') >= 0) seasonChampTotal++; });
  if (seasonChampTotal > championships) championships = seasonChampTotal;
  var fmvp = cnt('总决赛MVP') + cnt('FMVP');
  var mvp = honors.filter(function(h) { return (h.label || '') === 'MVP'; }).length;
  var dpoy = cnt('DPOY');
  var allNBA = cnt('最佳阵容');
  var allStar = cnt('全明星');
  var games = (c.totalStats && c.totalStats.games) || 0;
  var points = (c.totalStats && c.totalStats.pts) || 0;
  var longestTeam = '';
  var teamYears = {};
  seasons.forEach(function(s) { teamYears[s.team] = (teamYears[s.team] || 0) + 1; });
  Object.keys(teamYears).forEach(function(t) { if (!longestTeam || teamYears[t] > teamYears[longestTeam]) longestTeam = t; });
  var seenTeams = [];
  seasons.forEach(function(s) { if (seenTeams.indexOf(s.team) < 0) seenTeams.push(s.team); });
  var teamCount = seenTeams.length;
  var teamList = seenTeams.map(getTeamName).join('、');
  var firstTeam = seenTeams.length ? getTeamName(seenTeams[0]) : '';
  var lastTeam = seasons.length ? getTeamName(seasons[seasons.length - 1].team) : '';
  var score = championships * 18 + fmvp * 14 + mvp * 16 + dpoy * 10 + allNBA * 5 + allStar * 3;
  score += Math.min(35, Math.floor(points / 2500));
  score += Math.min(18, Math.floor(games / 120));
  if (teamYears[longestTeam] >= 8) score += 10;
  if (STATE.finalOVR >= 94) score += 8;
  var profileEffects = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : { legacyScoreContribution:0 };
  var legacyScoreContribution = profileEffects.legacyScoreContribution || 0;
  score += legacyScoreContribution;
  var cd = c.flags || {};
  if (cd.finalShow) score += 2;
  if (cd.finalHurt) score -= 1;
  if (cd.farewellHomeTeam) score += 3;
  if (cd.countdownLegend) score += 2;
  var goat = mvp >= 5 && championships >= 6 && fmvp >= 6 && (mvp + championships + fmvp) >= 18;
  var tier = '优秀职业球员';
  if (goat) tier = 'GOAT级别';
  else if (score >= 180) tier = '历史前十级别';
  else if (score >= 155) tier = '历史前二十级别';
  else if (score >= 140) tier = 'NBA历史百大';
  else if (score >= 100) tier = '名人堂稳进';
  else if (score >= 75) tier = '名人堂边缘';
  else if (score >= 60) tier = '队史传奇';
  var hof = score >= 100 || (score >= 75 && Math.random() < (0.25 + (score - 75) * 0.025));
  var top100 = score >= 140;
  var hofCopyVariant = Math.floor(Math.random() * (hof ? HOF_COPY : HOF_FAIL_COPY).length);
  var top100CopyVariant = Math.floor(Math.random() * (top100 ? TOP100_COPY : TOP100_FAIL_COPY).length);
  var retirementCopyVariant = Math.floor(Math.random() * RETIREMENT_COPY.length);
  var goatCopyVariant = Math.floor(Math.random() * GOAT_COPY.length);
  // 每支效力过的球队独立结算，所有达标的球队都会退役球衣，按生涯先后展示
  var seasonTeam = {};
  seasons.forEach(function(s) { seasonTeam[s.seasonNum] = s.team; });
  var seasonChampByTeam = {};
  seasons.forEach(function(s) {
    if ((s.playoffResult || '').indexOf('总冠军') >= 0) {
      seasonChampByTeam[s.team] = (seasonChampByTeam[s.team] || 0) + 1;
    }
  });
  var teamData = {};
  Object.keys(teamYears).forEach(function(t) {
    teamData[t] = { team: t, years: teamYears[t] || 0, championships: seasonChampByTeam[t] || 0, fmvp: 0, mvp: 0, dpoy: 0, allNBA: 0, allStar: 0, firstSeason: 9999 };
  });
  seasons.forEach(function(s) {
    var td = teamData[s.team];
    if (td && s.seasonNum < td.firstSeason) td.firstSeason = s.seasonNum;
  });
  honors.forEach(function(h) {
    if (isRookieHonorForLaterSeason(h)) return;
    var td = teamData[seasonTeam[h.seasonNum]];
    if (!td) return;
    var label = h.label || '';
    if (label.indexOf('总冠军') >= 0) return; // 冠军归属以赛季战绩为准，防止存档错位
    if (label.indexOf('总决赛MVP') >= 0 || label.indexOf('FMVP') >= 0) td.fmvp++;
    if (label === 'MVP') td.mvp++;
    if (label.indexOf('DPOY') >= 0) td.dpoy++;
    if (label.indexOf('最佳阵容') >= 0) td.allNBA++;
    if (label.indexOf('全明星') >= 0) td.allStar++;
  });
  var jerseyTeams = [];
  Object.keys(teamData).forEach(function(t) {
    var td = teamData[t];
    td.teamLegacy = td.years * 7 + td.championships * 12 + td.mvp * 10 + td.fmvp * 8 + td.allStar * 2;
    if (td.teamLegacy >= 80 || (td.championships > 0 && td.years >= 5) || (td.mvp > 0 && td.years >= 4)) {
      var pool = JERSEY_TEAM_COPY[td.team] || JERSEY_TEAM_COPY_FALLBACK;
      td.copyVariant = Math.floor(Math.random() * (Array.isArray(pool) ? pool.length : 1));
      jerseyTeams.push(td);
    }
  });
  jerseyTeams.sort(function(a, b) { return (a.firstSeason - b.firstSeason) || (b.teamLegacy - a.teamLegacy); });
  var jersey = jerseyTeams.length > 0;
  var result = { score: score, legacyScoreContribution: legacyScoreContribution, tier: tier, hof: hof, hofCopyVariant: hofCopyVariant, top100: top100, top100CopyVariant: top100CopyVariant, retirementCopyVariant: retirementCopyVariant, goat: goat, goatCopyVariant: goatCopyVariant, seasonsCount: seasons.length, jersey: jersey, jerseyTeams: jerseyTeams, team: longestTeam, longestTeam: longestTeam, longestYears: teamYears[longestTeam] || 0, teamCount: teamCount, teamList: teamList, firstTeam: firstTeam, lastTeam: lastTeam, teamYears: teamYears[longestTeam] || 0, championships: championships, fmvp: fmvp, mvp: mvp, dpoy: dpoy, allNBA: allNBA, allStar: allStar, points: points, games: games };
  ensureLegacyRankingDetails(result);
  result.endingMediaMoments = pickEndingMediaMoments(result, 2);
  return result;
}

function showLegacyModal(step, jerseyIdx) {
  var r = STATE.career.legacy || calculateLegacyResult();
  ensureLegacyRankingDetails(r);
  var mediaMoments = ensureEndingMediaMoments(r);
  var title = '退役发布会';
  var body = '';
  var next = step + 1;
  var nextJersey = 0;
  if (step === 0) {
    var legacyContributionText = r.legacyScoreContribution ? '（传奇声望' + (r.legacyScoreContribution > 0 ? '+' : '') + r.legacyScoreContribution + '）' : '';
    body = buildRetirementCopy(r) + '<br><br>生涯总结：' + r.games + '场，' + Math.round(r.points) + '分，' + r.mvp + '次MVP，' + r.championships + '次总冠军，' + r.allNBA + '次最佳阵容。<br><br>历史分：' + r.score + legacyContributionText + ' · ' + r.tier + ' · 历史排名第 ' + r.historicalRank + ' 名。';
  } else if (step === 1 || step === 2) {
    var mediaIdx = step - 1;
    var moment = mediaMoments[mediaIdx];
    var mediaFormat = ENDING_MEDIA_FORMATS.find(function(item) { return item.id === moment.formatId; }) || ENDING_MEDIA_FORMATS[0];
    title = mediaFormat.icon + ' 退役后的媒体回声';
    body = renderEndingMediaMoment(moment, r, mediaIdx, mediaMoments.length);
  } else if (step === 3) {
    var jerseyTeams = r.jerseyTeams || [];
    if (jerseyTeams.length > 0) {
      var idx = jerseyIdx || 0;
      if (idx >= jerseyTeams.length) idx = 0;
      var info = jerseyTeams[idx];
      title = '退役球衣' + (jerseyTeams.length > 1 ? ' · ' + (idx + 1) + '/' + jerseyTeams.length : '');
      var lead = (jerseyTeams.length > 1 && idx === 0) ? '你的名字，同时被 ' + jerseyTeams.length + ' 座城市记住。<br><br>' : '';
      body = lead + buildJerseyCeremonyCopy(info) + '<br><br>结果：' + getTeamName(info.team) + ' 退役你的球衣。';
      if (idx + 1 < jerseyTeams.length) {
        next = 3;
        nextJersey = idx + 1;
      }
    } else {
      title = '退役球衣';
      body = '你的老东家为你准备了致敬短片，但球衣没有升上球馆上空。管理层给出的说法很体面：你属于很多城市，也属于这个时代。<br><br>结果：未触发退役球衣。';
    }
  } else if (step === 4) {
    title = '名人堂投票';
    if (r.hof) body = buildHofCopy(r) + '<br><br>结果：入选名人堂。';
    else body = buildHofCopy(r) + '<br><br>结果：暂未入选名人堂。';
  } else {
    title = 'NBA历史百大榜';
    body = renderLegacyTop100Ranking(r);
    next = -1;
  }
  var html = '<div class="team-picker-overlay" id="legacy-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + body + '</div>';
  html += '<button class="btn btn-primary btn-sm' + (next < 0 ? ' legacy-rank-finish' : '') + '" style="width:100%;" onclick="' + (next >= 0 ? 'closeLegacyAndShow(' + next + ',' + nextJersey + ')' : 'finishLegacyStory()') + '"' + (next < 0 ? ' disabled' : '') + '>' + (next >= 0 ? '继续' : '排名揭晓中…') + '</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  if (next < 0) requestAnimationFrame(startLegacyRankClimb);
}

function closeLegacyAndShow(next, jerseyIdx) {
  var modal = document.getElementById('legacy-modal');
  if (modal) modal.remove();
  showLegacyModal(next, jerseyIdx || 0);
}

function finishLegacyStory() {
  var modal = document.getElementById('legacy-modal');
  if (modal) modal.remove();
  archiveCompletedCareer();
  generateCareerPoster();
}

// ==================== 玩家流动性（被交易/被裁/不被续约） ====================
function getMobility() {
  var c = STATE.career;
  if (!c) return null;
  c.mobility = c.mobility || {};
  var m = c.mobility;
  m.trades = m.trades || 0;
  m.teamInitiatedTrades = m.teamInitiatedTrades || m.trades || 0;
  m.waived = m.waived || 0;
  m.nonRenewals = m.nonRenewals || 0;
  if (m.lastMove == null) m.lastMove = null;
  if (m.lastMoveSeason == null) m.lastMoveSeason = 0;
  if (m.lastTeam == null) m.lastTeam = null;
  return m;
}

function getTeamInitiatedTradeCount() {
  var m = getMobility();
  return m ? (m.teamInitiatedTrades || m.trades || 0) : 0;
}

function getLastSeasonWinRate() {
  var st = STATE._prevStandings;
  if (!st || !STATE.careerTeam) return 0.5;
  var s = st[STATE.careerTeam];
  if (!s) return 0.5;
  var w = s.wins || 0, l = s.losses || 0;
  return (w + l) > 0 ? w / (w + l) : 0.5;
}

function isUserRookieProtected() {
  var c = STATE.career;
  if (!c || !c.draft) return false;
  if (c.draft.type === 'undrafted') return false;
  return (c.seasonCount || 0) <= 1;
}

function isUserStarProtected() {
  return (STATE.finalOVR || 0) >= 88
    || hasCareerHonor('全明星')
    || hasCareerHonor('最佳阵容')
    || hasCareerHonor('MVP');
}

function getUserTradeChance() {
  if (getTeamInitiatedTradeCount() >= 1) return 0;
  var ovr = STATE.finalOVR || 70;
  var age = (STATE.career && STATE.career.currentAge) || 22;
  var bench = !STATE.season.isUserStarter;
  var rate = getLastSeasonWinRate();
  var score = 0;
  if (ovr < 75) score += 12;
  else if (ovr < 80) score += 7;
  else if (ovr < 85) score += 3;
  if (age >= 33) score += 6;
  else if (age >= 30) score += 3;
  if (bench) score += 5;
  if (rate < 0.4) score += 6;
  else if (rate > 0.6) score -= 5;
  if (typeof getCareerProfileEffects === 'function') score += getCareerProfileEffects().tradeChanceDelta;
  return Math.max(1, Math.min(18, score));
}

function getUserWaiveChance() {
  var ovr = STATE.finalOVR || 70;
  var age = (STATE.career && STATE.career.currentAge) || 22;
  var bench = !STATE.season.isUserStarter;
  var rate = getLastSeasonWinRate();
  var score = 0;
  if (ovr < 70) score += 30;
  else if (ovr < 75) score += 18;
  else if (ovr < 80) score += 6;
  if (age >= 35) score += 14;
  else if (age >= 33) score += 6;
  if (bench) score += 8;
  if (rate < 0.4) score += 8;
  if (typeof getCareerProfileEffects === 'function') score += getCareerProfileEffects().waiveChanceDelta;
  return Math.max(1, Math.min(35, score));
}

function getTeamRenewalWillingness() {
  var c = STATE.career;
  if (!c) return false;
  if (c.flags && c.flags.waived) return false;
  var mobility = getMobility();
  if (mobility && (mobility.nonRenewals || 0) >= 1) return true;
  var ovr = STATE.finalOVR || 70;
  var age = c.currentAge || 22;
  var bench = !STATE.season.isUserStarter;
  // 保留原有续约基线：明星球员近乎必续，低总评新秀在无额外因素时仍约 35%。
  var p = ovr >= 85 ? 1.0 : (ovr < 72 ? 0.47 : 0.86);
  if (age >= 33) p -= 0.16;
  if (bench) p -= 0.12;
  if (ovr < 78) p -= 0.12;
  if (getLastSeasonWinRate() < 0.45) p -= 0.08;
  if (typeof getCareerProfileEffects === 'function') p += getCareerProfileEffects().renewalChanceBonus;
  return Math.random() < Math.max(0.20, Math.min(0.99, p));
}

function pickTradeDestination() {
  var myPos = STATE.position;
  var candidates = [];
  NBA2K_TEAMS.forEach(function(t) {
    if (t === STATE.careerTeam) return;
    var lineup = calcTeamLineup(t);
    var weak = null, weakOvr = 999;
    ['PG','SG','SF','PF','C'].forEach(function(pos) {
      var p = lineup.starters[pos];
      if (p && !p._isUser && p.ovr < weakOvr) { weakOvr = p.ovr; weak = pos; }
    });
    var score = 0;
    if (weak === myPos) score += 30;
    else if (weak && canPlayPosition(weak, myPos)) score += 18;
    if (weakOvr < (STATE.finalOVR || 70)) score += 20;
    var st = STATE._prevStandings && STATE._prevStandings[t];
    if (st) {
      var w = st.wins || 0, l = st.losses || 0;
      var rate = (w + l) > 0 ? w / (w + l) : 0.5;
      if (rate < 0.45) score += 12;
    }
    if (score > 0) candidates.push({ team: t, score: score });
  });
  if (candidates.length === 0) {
    NBA2K_TEAMS.forEach(function(t) {
      if (t !== STATE.careerTeam) candidates.push({ team: t, score: 1 });
    });
  }
  candidates.sort(function(a, b) { return b.score - a.score; });
  var top = candidates.slice(0, 6);
  return top[Math.floor(Math.random() * top.length)].team;
}

function recordMobilityHistory(moveType, title, detail) {
  var c = STATE.career;
  if (!c) return;
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: c.seasonCount,
    phase: 'offseason',
    branch: 'transfer',
    eventId: 'user_' + moveType,
    event: title,
    choice: moveType,
    result: detail || ''
  });
}

function showMobilityChoiceModal(title, scene, choices, onDone) {
  var old = document.getElementById('mobility-modal');
  if (old) old.remove();
  var html = '<div class="team-picker-overlay" id="mobility-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + sanitizePlayerFacingText(scene) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  choices.forEach(function(ch, ci) {
    html += '<button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;" onclick="chooseMobilityChoice(' + ci + ')">' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(getEventChoicePrediction(ch, { title:title, phase:'mobility' }, ci)) + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  STATE._mobilityChoice = { title: title, choices: choices, onDone: onDone };
}

function chooseMobilityChoice(idx) {
  var modal = STATE._mobilityChoice;
  if (!modal) return;
  var ch = modal.choices[idx];
  if (!ch) return;
  var beforeAttributes = captureEventAttributeSnapshot();
  var msg = '';
  try { msg = ch.apply ? ch.apply() : ''; } catch(e) { msg = ''; }
  msg = sanitizePlayerFacingText(msg || '');
  var done = modal.onDone;
  var overlay = document.getElementById('mobility-modal');
  if (overlay) overlay.remove();
  STATE._mobilityChoice = null;
  var attributeChanges = diffEventAttributeSnapshot(beforeAttributes);
  if (msg || attributeChanges.length) showOffseasonResultModal(modal.title, msg, done, attributeChanges);
  else if (done) done();
}

function doTradeUser(destTeam, done) {
  var beforeAttributes = captureEventAttributeSnapshot();
  var old = STATE.careerTeam;
  var displayName = getHupuDisplayName();
  var m = getMobility();
  if ((m.teamInitiatedTrades || 0) >= 1) {
    if (done) done();
    return;
  }
  STATE.careerTeam = destTeam;
  m.teamInitiatedTrades = (m.teamInitiatedTrades || 0) + 1;
  m.trades = m.teamInitiatedTrades;
  m.lastMove = 'trade';
  m.lastMoveSeason = STATE.career.seasonCount;
  m.lastTeam = old;
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.traded = true;
  addProfileDelta('fanSupport', -2);
  addProfileDelta('loyalty', -1);
  addSeasonMod('mediaPressure', 1, -10, 10);
  setBranchNode('transfer', 'transfer_start');
  if (STATE._leagueChanges) {
    STATE._leagueChanges.trades = STATE._leagueChanges.trades || [];
    STATE._leagueChanges.trades.push({ from: old, to: destTeam, playerA: displayName, playerB: '选秀权' });
  }
  var oldTn = getTeamName ? getTeamName(old) : old;
  var newTn = getTeamName ? getTeamName(destTeam) : destTeam;
  var msg = '休赛期的最后一天，交易官宣：' + oldTn + '把' + displayName + '送到' + newTn + '。新闻标题很短：换未来资产。<br><br>效果：球迷支持-2；忠诚-1；媒体压力+1。';
  recordMobilityHistory('trade', '交易官宣', msg);
  showOffseasonResultModal('交易官宣', msg, function() {
    showMobilityChoiceModal('交易官宣',
      '你在新球队的新闻发布会上坐定。记者问的第一个问题是：你对这笔交易怎么看？',
      [
        { label: '接受并表态', hint: '向前看，尽快融入', apply: function() {
          addProfileDelta('mediaTrust', 1);
          addProfileDelta('fanSupport', 1);
          return '你说：我感谢老东家，也准备好为这里打球。新球迷愿意相信你，媒体也喜欢这句话。<br><br>效果：媒体好感+1；球迷支持+1。';
        }},
        { label: '沉默', hint: '用表现回应一切', apply: function() {
          addSeasonMod('formVariance', -1, -10, 10);
          return '你只回答了一个字：好。剩下的问题，你打算留到球场上回答。<br><br>效果：状态波动-1。';
        }},
        { label: '公开表达不满', hint: '情绪会放大，关注度也会升高', apply: function() {
          setBranchNode('transfer', 'transfer_resentment');
          addProfileDelta('controversy', 1);
          addSeasonMod('mediaPressure', 1, -10, 10);
          return '你说：我没有要求离开。这句话被反复播放，交易流言变成了新闻连续剧。<br><br>效果：争议+1；媒体压力+1。';
        }}
      ],
      done);
  }, diffEventAttributeSnapshot(beforeAttributes));
}

function doWaiveUser(done) {
  var beforeAttributes = captureEventAttributeSnapshot();
  var old = STATE.careerTeam;
  var displayName = getHupuDisplayName();
  var m = getMobility();
  m.waived = (m.waived || 0) + 1;
  m.lastMove = 'waive';
  m.lastMoveSeason = STATE.career.seasonCount;
  m.lastTeam = old;
  STATE.career.contract = 0;
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.waived = true;
  addProfileDelta('fanSupport', -1);
  addSeasonMod('mediaPressure', 1, -10, 10);
  setBranchNode('transfer', 'transfer_start');
  var oldTn = getTeamName ? getTeamName(old) : old;
  var msg = oldTn + '宣布裁掉' + displayName + '。管理层没有多解释，新闻稿只有一行：感谢为球队所做的一切。<br><br>效果：球迷支持-1；媒体压力+1；你将进入自由市场。';
  recordMobilityHistory('waive', '裁员官宣', msg);
  showOffseasonResultModal('裁员官宣', msg, done, diffEventAttributeSnapshot(beforeAttributes));
}

function maybeMoveUserInOffseason(done) {
  if (typeof done !== 'function') done = function() {};
  var c = STATE.career;
  if (!c || c.retired) return done();
  if (isUserRookieProtected() || isUserStarProtected()) return done();
  if ((c.contract || 0) <= 0) return done();
  var m = getMobility();
  if (m.lastMoveSeason === (c.seasonCount || 0)) return done();
  if (getTeamInitiatedTradeCount() >= 1) {
    var waiveOnlyChance = getUserWaiveChance();
    if (Math.random() * 100 < waiveOnlyChance) {
      doWaiveUser(done);
      return;
    }
    done();
    return;
  }
  var tradeChance = getUserTradeChance();
  var waiveChance = getUserWaiveChance();
  var roll = Math.random() * 100;
  if (roll < tradeChance) {
    var dest = pickTradeDestination();
    if (dest) { doTradeUser(dest, done); return; }
  } else if (roll < tradeChance + waiveChance) {
    doWaiveUser(done);
    return;
  }
  done();
}

// ==================== 合同到期选队 ====================
function isSuperstarRecruitOfferTeam(team) {
  var flags = STATE.career && STATE.career.flags ? STATE.career.flags : {};
  var interest = flags.superstarRecruitInterest;
  return !!(team && flags.superstarRecruitTargetTeam === team && (interest === 'serious' || interest === 'public'));
}

function getTeamPowerScore(team) {
  if (typeof calcTeamPowerWithPlayer !== 'function') return 0;
  var p = calcTeamPowerWithPlayer(team);
  if (!p || typeof p === 'number') return p || 0;
  return ((p.offense || 0) * 0.35 + (p.defense || 0) * 0.35 + (p.depth || 0) * 0.3);
}

function getMaxCareerContractYears(age) {
  return Math.max(0, PLAYER_CAREER_MAX_AGE - (Number(age) || 22) + 1);
}

function clampCareerContractYears(years, age) {
  var maxYears = getMaxCareerContractYears(age);
  if (maxYears <= 0) return 0;
  return Math.max(1, Math.min(Math.max(1, Number(years) || 1), maxYears));
}

function generateContractOffers() {
  var offers = [];
  var usedTeams = {};
  var myPos = STATE.position;
  var myOvr = STATE.finalOVR;
  var myAge = STATE.career.currentAge;
  if (myAge > PLAYER_CAREER_MAX_AGE) return [];
  var choice = STATE.career.flags && STATE.career.flags.freeAgentChoice;
  var profileEffects = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : { contractOfferBonus:0 };
  var bigMarket = ['LAL', 'NYK', 'GSW', 'MIA', 'CHI', 'BOS', 'DAL', 'HOU', 'PHI', 'TOR'];

  NBA2K_TEAMS.forEach(function(t) {
    if (t === STATE.careerTeam) return;
    var lineup = calcTeamLineup(t);
    var currentStarter = lineup.starters[myPos];
    var need = currentStarter ? (myOvr > currentStarter.ovr) : true;
    if (!need) return;
    usedTeams[t] = true;

    var roster = NBA2K_DATA[t] || [];
    var sorted = roster.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
    var topTwo = sorted.slice(0, 2);

    var years = (function(a) {
      if (a <= 23) return 3 + Math.floor(Math.random() * 2);
      if (a <= 26) return 2 + Math.floor(Math.random() * 2);
      if (a <= 30) return 1 + Math.floor(Math.random() * 3);
      return 1;
    })(myAge);
    if (choice === 'short') years = 2;
    years = clampCareerContractYears(Math.max(2, years), myAge);

    var role = currentStarter ? (myOvr > currentStarter.ovr + 3 ? '立即首发' : '竞争上岗') : '立即首发';
    var teamOvr = choice === 'contender' ? getTeamPowerScore(t) : 0;
    var isBig = bigMarket.indexOf(t) >= 0;
    var score = currentStarter ? myOvr - currentStarter.ovr : 99;
    if (choice === 'contender') score += teamOvr * 2.2;
    if (choice === 'market') score += isBig ? 60 : -20;
    var recruited = isSuperstarRecruitOfferTeam(t);
    if (recruited) score += 90;
    offers.push({ team: t, topTwo: topTwo, years: years, role: role, needStrength: currentStarter ? myOvr - currentStarter.ovr : 99, score: score, teamOvr: Math.round(teamOvr), bigMarket: isBig, superstarRecruit: recruited });
  });

  var recruitTarget = STATE.career && STATE.career.flags ? STATE.career.flags.superstarRecruitTargetTeam : '';
  if (isSuperstarRecruitOfferTeam(recruitTarget) && recruitTarget !== STATE.careerTeam && !usedTeams[recruitTarget]) {
    var rr = NBA2K_DATA[recruitTarget] || [];
    var rsortedTop = rr.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
    var rYears = myAge <= 30 ? 2 : 1;
    if (choice === 'short') rYears = 2;
    rYears = clampCareerContractYears(Math.max(2, rYears), myAge);
    offers.push({
      team: recruitTarget,
      topTwo: rsortedTop.slice(0, 2),
      years: rYears,
      role: '巨星联手',
      needStrength: 0,
      score: 88,
      teamOvr: 0,
      bigMarket: bigMarket.indexOf(recruitTarget) >= 0,
      superstarRecruit: true
    });
    usedTeams[recruitTarget] = true;
  }

  // 替补/轮换/底薪档：只有没有首发报价时才给，且最多 2 家
  if (offers.length === 0) {
    var benchCandidates = [];
    NBA2K_TEAMS.forEach(function(t) {
      if (t === STATE.careerTeam || usedTeams[t]) return;
      var lineup = calcTeamLineup(t);
      var currentStarter = lineup.starters[myPos];
      if (!currentStarter) return;
      var diff = myOvr - currentStarter.ovr;
      if (diff > 0) return;
      var benchSpot = 0;
      (lineup.bench || []).forEach(function(bp) { if (bp && bp.ovr < myOvr) benchSpot++; });
      if (benchSpot === 0 && diff < -8) return;
      var st = STATE._prevStandings && STATE._prevStandings[t];
      var winRate = st ? (function(s) { var w = s.wins || 0, l = s.losses || 0; return (w + l) > 0 ? w / (w + l) : 0.5; })(st) : 0.5;
      if (winRate > 0.65) return;
      var score = benchSpot * 12 + (0.5 - winRate) * 40 + Math.max(-6, diff);
      if (isSuperstarRecruitOfferTeam(t)) score += 90;
      benchCandidates.push({ team: t, diff: diff, benchSpot: benchSpot, score: score });
    });
    benchCandidates.sort(function(a, b) { return b.score - a.score; });
    var benchCount = Math.min(2, benchCandidates.length);
    for (var bi = 0; bi < benchCount; bi++) {
      var bt = benchCandidates[bi].team;
      usedTeams[bt] = true;
      var blineup = calcTeamLineup(bt);
      var bStarter = blineup.starters[myPos];
      var broster = NBA2K_DATA[bt] || [];
      var bsorted = broster.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
      var byears = myAge <= 26 ? 2 : 1;
      if (choice === 'short') byears = 2;
      byears = clampCareerContractYears(Math.max(2, byears), myAge);
      var bRecruit = isSuperstarRecruitOfferTeam(bt);
      offers.push({ team: bt, topTwo: bsorted.slice(0, 2), years: byears, role: '替补/轮换', needStrength: bStarter ? myOvr - bStarter.ovr : 0, score: -20 - (bStarter ? Math.abs(myOvr - bStarter.ovr) : 0) + (bRecruit ? 90 : 0), teamOvr: 0, bigMarket: false, superstarRecruit: bRecruit });
    }
  }

  offers.sort(function(a, b) { return (b.score || b.needStrength) - (a.score || a.needStrength); });
  var offerLimit = (choice === 'short' ? 6 : 4) + (profileEffects.contractOfferBonus || 0);
  offerLimit = Math.max(3, Math.min(6, offerLimit));
  var result = offers.slice(0, offerLimit);
  if (result.length === 0) {
    // 兜底：保证永远有下家
    NBA2K_TEAMS.forEach(function(t) {
      if (t === STATE.careerTeam || usedTeams[t]) return;
      if (result.length >= 2) return;
      var r = NBA2K_DATA[t] || [];
      var lineup2 = calcTeamLineup(t);
      var s2 = lineup2.starters[myPos];
      if (s2 && (myOvr - s2.ovr) > 3) return;
      var st2 = STATE._prevStandings && STATE._prevStandings[t];
      var winRate2 = st2 ? (function(s) { var w = s.wins || 0, l = s.losses || 0; return (w + l) > 0 ? w / (w + l) : 0.5; })(st2) : 0.5;
      if (winRate2 > 0.65) return;
      var sr2 = r.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 2);
      var rRecruit = isSuperstarRecruitOfferTeam(t);
      result.push({ team: t, topTwo: sr2, years: clampCareerContractYears(2, myAge), role: '底薪/替补', needStrength: s2 ? myOvr - s2.ovr : -5, score: -50 + (rRecruit ? 90 : 0), teamOvr: 0, bigMarket: false, superstarRecruit: rRecruit });
      usedTeams[t] = true;
    });
    if (result.length === 0) {
      // 极端情况兜底：保证永远有下家
      NBA2K_TEAMS.forEach(function(t) {
        if (result.length >= 2) return;
        if (t === STATE.careerTeam || usedTeams[t]) return;
        var r3 = NBA2K_DATA[t] || [];
        var sr3 = r3.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 2);
        var eRecruit = isSuperstarRecruitOfferTeam(t);
        result.push({ team: t, topTwo: sr3, years: clampCareerContractYears(2, myAge), role: '底薪/替补', needStrength: -10, score: -80 + (eRecruit ? 90 : 0), teamOvr: 0, bigMarket: false, superstarRecruit: eRecruit });
        usedTeams[t] = true;
      });
    }
  }
  return result;
}

function showContractOffers() {
  if (STATE.career && STATE.career.retired) {
    showCareerStats(1);
    return;
  }
  if ((STATE.career.currentAge || 22) > PLAYER_CAREER_MAX_AGE) {
    STATE._retirementOfferPhase = 'post-training';
    showPlayerRetirementChoice();
    return;
  }
  // 合同弹窗叠在阵容页上；转会汇总已在 finishOffseasonPipeline 先弹过
  showRosterReview();
  var c = STATE.career;
  var myOvr = STATE.finalOVR;
  var myAge = STATE.career.currentAge;
  var offers = generateContractOffers();
  var profileEffects = typeof getCareerProfileEffects === 'function' ? getCareerProfileEffects() : { contractOfferBonus:0 };
  var currTeam = getTeamName ? getTeamName(STATE.careerTeam) : STATE.careerTeam;
  var choice = STATE.career.flags && STATE.career.flags.freeAgentChoice;
  var choiceText = { stay: '留守母队，要求补强', contender: '加盟争冠球队', market: '选择大市场球队', short: '签短约保持自由' }[choice] || '';
  var stayYears = clampCareerContractYears(choice === 'stay' ? 3 : 2, myAge);
  var canRenew = !(c.flags && c.flags.waived) && getTeamRenewalWillingness();
  if (!canRenew && c.flags && !c.flags.waived && !c.flags.nonRenewed) {
    c.flags.nonRenewed = true;
    var m = getMobility();
    m.nonRenewals = (m.nonRenewals || 0) + 1;
    m.lastMove = 'non_renew';
    m.lastMoveSeason = c.seasonCount;
    setBranchNode('transfer', 'transfer_start');
  }
  var headerText = c.flags && c.flags.waived ? '📋 你被裁了，自由市场在等你' : '📋 你的合同到期了';

  var html = '<div class="team-picker-overlay" id="contract-modal">';
  html += '<div class="team-picker-modal" style="max-width:420px;">';
  html += '<div class="team-picker-header"><span>' + headerText + '</span><button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 8px;min-height:26px;border-color:var(--red);color:var(--red);background:var(--bg-card);" onclick="showContractRetirementChoice()">退役</button></div>';
  html += '<div style="padding:6px 12px;font-size:13px;color:var(--text-dim);border-bottom:1px solid var(--border-light);">' + currTeam + ' · ' + STATE.finalPosition + ' · OVR ' + myOvr + ' · ' + myAge + '岁</div>';
  if (choiceText) {
    html += '<div style="padding:6px 12px;font-size:12px;color:var(--orange);border-bottom:1px solid var(--border-light);">自由市场前夜的决定：' + choiceText + '</div>';
  }
  if (profileEffects.contractOfferBonus) {
    var marketText = profileEffects.contractOfferBonus > 0
      ? '场外影响力带来额外 ' + profileEffects.contractOfferBonus + ' 份报价'
      : '场外形象使可选报价减少 1 份';
    html += '<div style="padding:6px 12px;font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border-light);">📣 ' + marketText + '</div>';
  }
  html += '<div style="padding:8px 12px;max-height:55vh;overflow-y:auto;">';

  // 续约母队选项
  if (canRenew) {
    html += '<div class="team-pick-card" style="cursor:pointer;margin-bottom:6px;border-color:' + (choice === 'stay' ? '#ffd700' : 'var(--orange)') + ';" onclick="selectContractOption(\'' + STATE.careerTeam + '\', -1)">';
    html += '<div style="font-size:14px;font-weight:700;color:var(--orange);">📝 续约 ' + currTeam + '</div>';
    html += '<div style="font-size:11px;color:var(--text-dim);">继续留在 ' + currTeam + ' · ' + stayYears + ' 年</div>';
    html += '</div>';
  } else {
    html += '<div class="team-pick-card" style="margin-bottom:6px;opacity:.75;border-style:dashed;">';
    html += '<div style="font-size:14px;font-weight:700;color:var(--text-dim);">📝 ' + currTeam + ' 没有提出续约</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">你需要在其他球队里找一份新合同</div>';
    html += '</div>';
  }

  offers.forEach(function(o, idx) {
    var tn = getTeamName ? getTeamName(o.team) : o.team;
    var tp1 = o.topTwo[0];
    var tp2 = o.topTwo[1];
    var tp1Name = tp1 ? (tp1.cname || tp1.name) : '—';
    var tp1Ovr = tp1 ? (tp1.ovr || '—') : '—';
    var tp2Name = tp2 ? (tp2.cname || tp2.name) : '—';
    var tp2Ovr = tp2 ? (tp2.ovr || '—') : '—';

    html += '<div class="team-pick-card" style="cursor:pointer;margin-bottom:6px;text-align:left;padding:10px;" onclick="selectContractOption(\'' + o.team + '\', ' + o.years + ')">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
    html += getTeamLogo(o.team, 28);
    html += '<span style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text);">' + tn + '</span>';
    html += '<span style="font-size:11px;color:var(--orange);margin-left:auto;">' + o.role + '</span>';
    if (o.superstarRecruit) html += '<span style="font-size:10px;color:var(--gold);">⭐ 巨星招募目标</span>';
    if (choice === 'market' && o.bigMarket) html += '<span style="font-size:10px;color:var(--gold);">大市场</span>';
    html += '</div>';
    if (o.superstarRecruit && STATE.career.flags && STATE.career.flags.superstarRecruiterName) {
      html += '<div style="font-size:11px;color:var(--gold);margin-bottom:3px;">' + STATE.career.flags.superstarRecruiterName + ' 希望与你联手</div>';
    }
    html += '<div style="display:flex;gap:8px;padding:4px 0;">';
    html += '<span style="font-size:11px;color:var(--text-dim);">' + tp1Name + ' ' + tp1Ovr + '</span>';
    html += '<span style="font-size:11px;color:var(--text-muted);">|</span>';
    html += '<span style="font-size:11px;color:var(--text-dim);">' + tp2Name + ' ' + tp2Ovr + '</span>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--gold);">🖊️ ' + o.years + ' 年合同</div>';
    html += '</div>';
  });

  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function showContractRetirementChoice() {
  var contractModal = document.getElementById('contract-modal');
  if (contractModal) contractModal.remove();
  var old = document.getElementById('contract-retirement-choice');
  if (old) old.remove();
  var c = STATE.career || {};
  var html = '<div class="team-picker-overlay" id="contract-retirement-choice">';
  html += '<div class="team-picker-modal" style="max-width:390px;">';
  html += '<div class="team-picker-header"><span>合同节点 · 退役决定</span></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px;">不再接受新合同？</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + (c.currentAge || 0) + '岁，OVR ' + (STATE.finalOVR || 0) + '。你可以在自由市场开启下一章，也可以把职业生涯停在这里。</div>';
  html += '<button class="btn btn-primary btn-sm" style="width:100%;margin-bottom:8px;" onclick="announcePlayerRetirement()">确认退役</button>';
  html += '<button class="btn btn-secondary btn-sm" style="width:100%;" onclick="closeContractRetirementChoice()">返回合同选择</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeContractRetirementChoice() {
  var modal = document.getElementById('contract-retirement-choice');
  if (modal) modal.remove();
  showContractOffers();
}

function buildTeamCareerReviewData(team) {
  var c = STATE.career || {};
  var seasons = (c.seasons || []).filter(function(s) { return s && s.team === team; });
  var hasUsefulSeason = seasons.some(function(s) {
    return s && s.playerStats && ((s.playerStats.games || 0) > 0 || (s.playerStats.pts || 0) > 0);
  });
  if (!hasUsefulSeason && c.lastCompletedSeasonSnapshot && c.lastCompletedSeasonSnapshot.team === team) {
    seasons = [c.lastCompletedSeasonSnapshot];
  }
  var seasonNums = {};
  seasons.forEach(function(s) { seasonNums[s.seasonNum] = true; });
  var totals = { pts:0, reb:0, ast:0, stl:0, blk:0, games:0, mins:0 };
  seasons.forEach(function(s) {
    var ps = s.playerStats || {};
    ['pts','reb','ast','stl','blk','games','mins'].forEach(function(k) {
      totals[k] += ps[k] || 0;
    });
  });
  var honors = (c.honors || []).filter(function(h) {
    return h && seasonNums[h.seasonNum] && !isRookieHonorForLaterSeason(h);
  });
  if (!honors.length) {
    seasons.forEach(function(s) {
      (s.awards || []).forEach(function(a) {
        if (a && !isRookieHonorForLaterSeason(a)) honors.push(a);
      });
    });
  }
  return { seasons: seasons, totals: totals, honors: honors };
}

function showFreeAgencyTeamChangeModal(oldTeam, newTeam, done) {
  var oldName = getTeamName ? getTeamName(oldTeam) : oldTeam;
  var newName = getTeamName ? getTeamName(newTeam) : newTeam;
  var data = buildTeamCareerReviewData(oldTeam);
  var totals = data.totals;
  var gp = totals.games || 0;
  var avgPts = gp ? Math.round(totals.pts / gp * 10) / 10 : 0;
  var avgReb = gp ? Math.round(totals.reb / gp * 10) / 10 : 0;
  var avgAst = gp ? Math.round(totals.ast / gp * 10) / 10 : 0;
  var totalWins = 0, totalLosses = 0;
  data.seasons.forEach(function(s) { totalWins += s.wins || 0; totalLosses += s.losses || 0; });

  var honorHtml = '';
  if (data.honors.length) {
    data.honors.forEach(function(h) {
      var cls = 'ch-badge';
      var label = h.label || '';
      if (label.indexOf('总冠军') >= 0 || label.indexOf('MVP') >= 0 || label.indexOf('FMVP') >= 0) cls += ' gold';
      honorHtml += renderHonorBadge(label, h.emoji || '🏅', cls);
    });
  } else {
    honorHtml = '<span style="font-size:12px;color:var(--text-muted);">暂无队内荣誉</span>';
  }

  var seasonsHtml = '';
  if (data.seasons.length) {
    data.seasons.forEach(function(s) {
      seasonsHtml += '<div class="sr-info-row"><span>' + getSeasonLabel(s.seasonNum) + '</span><span>' + (s.wins || 0) + '-' + (s.losses || 0) + ' · ' + (s.playoffResult || '未晋级') + '</span></div>';
    });
  } else {
    seasonsHtml = '<div style="font-size:12px;color:var(--text-muted);">还没有完整赛季记录</div>';
  }

  var old = document.getElementById('fa-team-change-modal');
  if (old) old.remove();
  var html = '<div class="team-picker-overlay" id="fa-team-change-modal">';
  html += '<div class="team-picker-modal" style="max-width:430px;">';
  html += '<div class="team-picker-header"><span>🧳 生涯新篇章</span></div>';
  html += '<div style="padding:14px 14px 8px;text-align:center;">';
  html += '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px;">' + getTeamLogo(oldTeam, 34) + '<span style="font-size:18px;color:var(--text-dim);">→</span>' + getTeamLogo(newTeam, 34) + '</div>';
  html += '<div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--orange);line-height:1.3;">您选择在' + newName + '开启自己的生涯新篇章！</div>';
  html += '<div style="font-size:12px;color:var(--text-dim);margin-top:6px;line-height:1.55;">离开' + oldName + '之前，这座城市把你的这一站生涯收进档案。</div>';
  html += '</div>';
  html += '<div style="padding:0 12px 12px;max-height:58vh;overflow-y:auto;">';
  html += '<div class="sr-section" style="text-align:left;margin-bottom:8px;"><div class="sr-section-title">📊 ' + oldName + '生涯总数据</div>';
  html += '<div class="sr-stats-grid"><div class="sr-stat"><div class="sr-stat-val">' + gp + '</div><div class="sr-stat-lbl">场次</div></div><div class="sr-stat"><div class="sr-stat-val">' + Math.round(totals.pts) + '</div><div class="sr-stat-lbl">总分</div></div><div class="sr-stat"><div class="sr-stat-val">' + (totalWins + '-' + totalLosses) + '</div><div class="sr-stat-lbl">战绩</div></div></div>';
  html += '<div class="sr-pct-line">场均 ' + avgPts + '分 ' + avgReb + '板 ' + avgAst + '助</div></div>';
  html += '<div class="sr-section" style="text-align:left;margin-bottom:8px;"><div class="sr-section-title">🏅 在队荣誉</div><div class="sr-awards">' + honorHtml + '</div></div>';
  html += '<div class="sr-section" style="text-align:left;margin-bottom:8px;"><div class="sr-section-title">📅 各赛季战绩</div>' + seasonsHtml + '</div>';
  html += '<button class="btn btn-primary btn-sm" id="faTeamChangeContinue" style="width:100%;">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('faTeamChangeContinue').onclick = function() {
    var modal = document.getElementById('fa-team-change-modal');
    if (modal) modal.remove();
    if (typeof done === 'function') done();
  };
}

function selectContractOption(team, years) {
  var modal = document.getElementById('contract-modal');
  if (modal) modal.remove();

  var oldTeam = STATE.careerTeam;
  var changedTeam = years > 0 && team !== oldTeam;
  if (years > 0) {
    STATE.careerTeam = team;
    STATE.career.contract = clampCareerContractYears(years, STATE.career.currentAge);
  } else {
    STATE.career.contract = clampCareerContractYears((STATE.career.flags && STATE.career.flags.freeAgentChoice === 'stay') ? 3 : 2, STATE.career.currentAge);
  }
  if (STATE.career && STATE.career.flags) STATE.career.flags.waived = false;
  if (STATE.career && STATE.career.flags && STATE.career.flags.superstarRecruitInterest) {
    STATE.career.flags.lastSuperstarRecruitChoiceTeam = team;
    delete STATE.career.flags.superstarRecruitInterest;
    delete STATE.career.flags.superstarRecruitTargetTeam;
    delete STATE.career.flags.superstarRecruiterName;
    delete STATE.career.flags.superstarRecruiterEN;
  }

  if (changedTeam && STATE.season) {
    clearLineupCache();
    STATE.season.games = [];
    STATE.season.wins = 0;
    STATE.season.losses = 0;
    STATE.season._leagueGameLog = [];
    STATE.season._processedDays = new Set();
    syncUserStarterStatus();
    initStandings();
    buildRealSchedule();
  }
  refreshSeasonTeamHeader();
  var continueAfterContract = function() {
    if (!maybeShowCityFarewell(showOffSeasonModals)) showOffSeasonModals();
  };
  if (changedTeam) showFreeAgencyTeamChangeModal(oldTeam, team, continueAfterContract);
  else continueAfterContract();
}

function refreshSeasonTeamHeader() {
  var el = document.getElementById('season-header');
  if (!el) return;
  var teamHtml = '<div class="sh-top" style="margin-top:8px;">' +
    '<div class="sh-team"><div class="sh-team-name">' + getTeamLogo(STATE.careerTeam, 24) + ' ' + getTeamName(STATE.careerTeam) + '</div><div class="sh-team-full">' + ((window.TEAM_CITY && window.TEAM_CITY[STATE.careerTeam]) || '') + '</div></div>' +
    '<div class="sh-season">' + getCurrentSeasonLabel() + '</div>' +
    '<div class="sh-record" id="simRecord"><span class="sh-wins">' + (STATE.season.wins || 0) + '</span><span class="sh-dash">-</span><span class="sh-losses">' + (STATE.season.losses || 0) + '</span><div class="sh-pct">—</div></div>' +
    '</div>';
  var top = el.querySelector('.sh-top');
  if (top) top.outerHTML = teamHtml;
  else el.innerHTML = teamHtml + el.innerHTML;
}

// ==================== 休赛期弹窗（退役→交易→阵容预览）====================
function isHiddenRetiredPlayer(r) {
  return !!(r && (r.nameEN === 'Kyle Lowry' || r.name === '凯尔-洛瑞'));
}

function isHiddenRetiredPlayerName(n) {
  return n === 'Kyle Lowry' || n === '凯尔-洛瑞';
}

function showOffSeasonModals(done) {
  var next = typeof done === 'function' ? done : function () { showRosterReview(); };
  var digest = typeof getTopTransferDigest === 'function' ? getTopTransferDigest() : [];
  if (digest && digest.length) {
    showTransferDigestModal(next);
    return;
  }
  next();
}

function showRetirementModal(callback) {
  var changes = STATE._leagueChanges || { retired: [] };
  var retired = (changes.retired || []).filter(function(r) { return !isHiddenRetiredPlayer(r); });
  var html = '<div class="team-picker-overlay" id="retirement-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>📢 退役球员</span></div>';
  html += '<div style="padding:8px 12px;max-height:60vh;overflow-y:auto;">';
  retired.forEach(function(r) {
    var teamCn = (typeof TEAM_NAMES_EV !== 'undefined' && TEAM_NAMES_EV[r.team]) ? TEAM_NAMES_EV[r.team] : r.team;
    var hs = getPlayerHeadshotStyle(r.nameEN || r.playerName || r.name, 30);
    var avatarHtml = hs
      ? '<div class="bp-headshot" style="' + hs + ';width:30px;height:30px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;"></div>'
      : '<span style="color:var(--red);font-size:16px;">🔴</span>';
    html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 2px;border-bottom:1px solid var(--border-light);font-size:13px;">';
    html += avatarHtml;
    html += '<span style="flex:1;font-weight:600;">' + r.name + '</span>';
    html += '<span style="color:var(--text-dim);font-size:11px;">' + teamCn + ' · ' + r.ovr + ' OVR</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="padding:10px 12px 14px;text-align:center;border-top:1px solid var(--border-light);">';
  html += '<button class="btn btn-primary btn-sm" onclick="closeRetirementModal(event, function(){})" style="max-width:180px;">下一步</button>';
  html += '</div></div></div>';
  var el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('retirement-modal').querySelector('.btn-primary').onclick = function() {
    document.getElementById('retirement-modal').remove();
    if (callback) callback();
  };
}

function showFAModal(callback) {
  var changes = STATE._leagueChanges || {};
  var allSignings = changes.freeSignings || [];
  var signings = allSignings.filter(function(s) { return s.ovr >= 86; });
  var html = '<div class="team-picker-overlay" id="fa-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>📋 自由球员市场</span></div>';
  html += '<div style="padding:8px 12px;max-height:60vh;overflow-y:auto;">';
  if (signings.length > 0) {
    html += '<div style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:4px;">➡️ 自由球员转会</div>';
    signings.forEach(function(s) {
      var fromTn = getTeamName ? getTeamName(s.from) : s.from;
      var toTn = getTeamName ? getTeamName(s.to) : s.to;
      var hs = getPlayerHeadshotStyle(s.nameEN || s.playerName || s.name, 30);
      var avatarHtml = hs
        ? '<div class="bp-headshot" style="' + hs + ';width:30px;height:30px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;"></div>'
        : '<span style="color:var(--orange);font-size:14px;">➡️</span>';
      html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 2px;border-bottom:1px solid var(--border-light);font-size:13px;">';
      html += avatarHtml;
      html += '<span style="flex:1;"><strong>' + s.name + '</strong> ' + fromTn + ' → ' + toTn + '</span>';
      html += '<span style="color:var(--text-dim);font-size:11px;">OVR ' + s.ovr + '</span>';
      html += '</div>';
    });
  } else {
    html += '<div style="text-align:center;padding:20px;font-size:13px;color:var(--text-muted);">无自由球员变动</div>';
  }
  html += '</div>';
  html += '<div style="padding:10px 12px 14px;text-align:center;border-top:1px solid var(--border-light);">';
  html += '<button class="btn btn-primary btn-sm" style="max-width:180px;">下一步</button>';
  html += '</div></div></div>';
  var el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('fa-modal').querySelector('.btn-primary').onclick = function() {
    document.getElementById('fa-modal').remove();
    if (callback) callback();
  };
}

function showTransferDigestModal(callback) {
  var changes = STATE._leagueChanges || {};
  var digest = getTopTransferDigest();
  var total = changes.transferDigestTotal || digest.length;
  var html = '<div class="team-picker-overlay" id="trades-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>⭐ 转会动向 · 总评最高</span></div>';
  html += '<div style="padding:8px 12px 4px;font-size:11px;color:var(--text-dim);line-height:1.5;">本休赛期共 ' + total + ' 笔球员变动，按总评展示前 ' + digest.length + ' 笔。</div>';
  html += '<div style="padding:4px 12px 8px;max-height:60vh;overflow-y:auto;">';
  if (!digest.length) {
    html += '<div style="text-align:center;padding:20px;font-size:13px;color:var(--text-muted);">本休赛期暂无转会动向</div>';
  }
  digest.forEach(function(m, idx) {
    var fromTn = getTeamName ? getTeamName(m.from) : m.from;
    var toTn = getTeamName ? getTeamName(m.to) : m.to;
    var kindLabel = m.kind === 'fa' ? '自由球员' : '交易';
    var hs = getPlayerHeadshotStyle(m.nameEN || m.name, 30);
    var avatarHtml = hs
      ? '<div class="bp-headshot" style="' + hs + ';width:30px;height:30px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;"></div>'
      : '<span style="width:30px;text-align:center;color:var(--orange);font-size:12px;font-weight:700;flex-shrink:0;">' + (idx + 1) + '</span>';
    html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--border-light);font-size:13px;">';
    html += avatarHtml;
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-weight:700;color:var(--text);">' + m.name + ' <span style="font-weight:600;color:var(--orange);font-size:11px;">OVR ' + m.ovr + '</span></div>';
    html += '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">' + fromTn + ' → ' + toTn + ' · ' + kindLabel + '</div>';
    html += '</div></div>';
  });
  html += '</div>';
  html += '<div style="padding:10px 12px 14px;text-align:center;border-top:1px solid var(--border-light);">';
  html += '<button class="btn btn-primary btn-sm" style="max-width:180px;">查看阵容</button>';
  html += '</div></div></div>';
  var el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('trades-modal').querySelector('.btn-primary').onclick = function() {
    document.getElementById('trades-modal').remove();
    if (callback) callback();
  };
}
function showRosterReview() {
  showScreen('screen-roster-review');
  clearLineupCache();
  var c = STATE.career;
  var changes = STATE._leagueChanges || { retired: [], rookies: [], teamChanges: {} };
  var teamName = getTeamName ? getTeamName(STATE.careerTeam) : STATE.careerTeam;
  var prevRecord = (c.seasons.length > 0) ? (c.seasons[c.seasons.length - 1].wins + '-' + c.seasons[c.seasons.length - 1].losses) : '新赛季';
  var displayName = getHupuDisplayName();

  var lineup = calcTeamLineup(STATE.careerTeam);
  if (STATE.season) {
    var rosterStarter = !!lineup.isUserStarter;
    if (STATE.career && STATE.career.flags && STATE.career.flags.startBench) rosterStarter = false;
    STATE.season.isUserStarter = rosterStarter;
  }
  var teamChanges = changes.teamChanges[STATE.careerTeam] || { retired: [], rookies: [] };

  var avatarUrl = getHupuAvatarUrl() || 'https://i3.hoopchina.com.cn/newsPost/de00f9a83014c2b3196d831d4be1adb9_w_300_h_300_.png';
  var defaultAvatar = 'https://i3.hoopchina.com.cn/newsPost/de00f9a83014c2b3196d831d4be1adb9_w_300_h_300_.png';

  function renderPlayer(p, isUser) {
    var pOvr = parseInt(p.ovr) || 0;
    var pPos = p.posCn || p.pos || '—';
    var pName = p.cname || p.name;
    var imgHtml;
    if (isUser) {
      imgHtml = '<img style="border-radius:50%;border:2px solid var(--border);width:28px;height:28px;object-fit:cover;flex-shrink:0;" src="' + avatarUrl + '" onerror="this.onerror=null;this.src=\'' + defaultAvatar + '\'">';
    } else {
      var hs = getPlayerHeadshotStyle(p.name, 28);
      imgHtml = hs ? '<div style="' + hs + ';border-radius:50%;border:2px solid var(--border);width:28px;height:28px;flex-shrink:0;"></div>' : '<div style="width:28px;height:28px;border-radius:50%;background:var(--border);flex-shrink:0;"></div>';
    }
    var starBadge = isUser ? '<span style="font-size:10px;margin-left:2px;">⭐</span>' : '';
    return '<div style="display:flex;align-items:center;gap:5px;padding:4px 6px;border-bottom:1px solid var(--border-light);font-size:12px;' + (isUser ? 'background:var(--orange-bg);border-radius:6px;margin:1px 0;border:1.5px solid var(--orange);' : '') + '">'
      + imgHtml
      + '<span style="width:40px;font-size:10px;color:var(--text-dim);flex-shrink:0;">' + pPos + '</span>'
      + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:' + (isUser ? '700' : '400') + ';color:' + (isUser ? 'var(--orange)' : 'var(--text)') + ';">' + pName + starBadge + '</span>'
      + '<span style="font-family:var(--font-display);font-weight:700;font-size:13px;color:' + (isUser ? 'var(--orange)' : 'var(--text)') + ';flex-shrink:0;">' + pOvr + '</span>'
      + '</div>';
  }

  var html = '<div id="career-scroll">';

  // 主卡片
  html += '<div class="reveal-card" style="position:relative;">';
  html += '<div style="position:absolute;top:8px;left:8px;">' + getTeamLogo(STATE.careerTeam, 32) + '</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);">' + getCurrentSeasonLabel() + '</div>';
  html += '<div style="font-size:24px;font-weight:800;margin:6px 0;font-family:var(--font-display);letter-spacing:2px;">' + teamName + '</div>';
  html += '<div style="font-size:12px;color:var(--text-dim);">' + STATE.finalPosition + ' · OVR ' + STATE.finalOVR + ' · ' + c.currentAge + '岁</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">上赛季 ' + prevRecord + '</div>';
  html += '<div style="margin-top:10px;"><button class="btn btn-primary" onclick="startNewSeason()" style="max-width:240px;">🏀 开始新赛季</button></div>';
  html += '</div>';

  // 阵容列表
  html += '<div style="margin-top:8px;background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius-sm);padding:8px 4px;">';
  html += '<div style="font-family:var(--font-display);font-size:11px;color:var(--orange);padding:2px 4px 4px;letter-spacing:0.5px;">🏀 首发阵容</div>';
  var posOrder = ['PG','SG','SF','PF','C'];
  posOrder.forEach(function(pos) {
    var p = lineup.starters[pos];
    if (p) html += renderPlayer(p, p._isUser);
  });
  if (lineup.bench && lineup.bench.length > 0) {
    html += '<div style="font-family:var(--font-display);font-size:11px;color:var(--text-dim);padding:6px 4px 4px;letter-spacing:0.5px;border-top:1px solid var(--border);margin-top:2px;">🔄 替补阵容</div>';
    lineup.bench.forEach(function(p) {
      html += renderPlayer(p, p._isUser);
    });
  }
  html += '</div>';

  html += '</div>';
  document.getElementById('roster-review-content').innerHTML = html;
}

function startNewSeason() {
  if (STATE.career && !STATE.career.retired && STATE._autoSaveSeason !== STATE.career.seasonCount) {
    STATE._autoSaveSeason = STATE.career.seasonCount;
    autoSaveGame();
  }
  showScreen('screen-season');
  if (typeof renderSeasonScreenDOM === 'function') renderSeasonScreenDOM();
  if (typeof quickSimAllGames === 'function') {
    quickSimAllGames();
  }
}

function resetForNewSeason() {
  saveCurrentSeasonToCareer();
  var oldTeam = STATE.careerTeam;
  STATE._careerSaved = false;
  STATE.season = {
    wins: 0, losses: 0,
    games: [],
    playerStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, games:0, mins:0 },
    playoffStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, games:0, mins:0 },
    awards: [], playoffResult: null, playoffEliminated: false,
    standings: {}, statLeaders: {}, schedule: [], day: 0,
    isPlayoffs: false, isChampion: false,
    playoffBracket: null, otherBracket: null,
    _viewConf: null, _gamesPlayed: {}, _leagueGameLog: [], rankings: null,
    events: { suspensionGamesLeft:0, suspensionReason:'', injuryGamesLeft:0, injuryReason:'', triggeredIds:[], storyTimeline:[], lastTriggerGameNum:null, playoffEventCount:0, injuryRiskBonus: getNextSeasonMods().injuryRiskBonus || 0, majorInjuryThisSeason:false, playThroughPrompted:{}, regularPlayThroughPromptCount:0 },
  };
  STATE.careerTeam = oldTeam;
  if (STATE.career && STATE.career.flags) delete STATE.career.flags.startBench;
  // 不在这里清空：休赛期获得的全部状态就是新赛季的有效状态。
  getNextSeasonMods();
  syncUserStarterStatus();
  initStandings();
  buildRealSchedule();

  renderSeasonScreenDOM();
}

function renderSeasonScreenDOM() {
  clearSimSeasonFooter();
  var confName = getConference(STATE.careerTeam) === 'EAST' ? '东部' : '西部';
  html('season-header').innerHTML =
    '<div class="sh-top" style="margin-top:8px;">' +
      '<div class="sh-team"><div class="sh-team-name">' + getTeamLogo(STATE.careerTeam, 24) + ' ' + getTeamName(STATE.careerTeam) + '</div><div class="sh-team-full">' + ((window.TEAM_CITY && window.TEAM_CITY[STATE.careerTeam]) || '') + '</div></div>' +
      '<div class="sh-season">' + getCurrentSeasonLabel() + '</div>' +
      '<div class="sh-record" id="simRecord"><span class="sh-wins">0</span><span class="sh-dash">-</span><span class="sh-losses">0</span><div class="sh-pct">—</div></div>' +
    '</div>' +
    '<div class="sh-info" id="simInfo">' +
      '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
      '<span>场均 0分 0板 0助</span>' +
      '<span id="simStreak"></span>' +
    '</div>' +
    (typeof renderPlayerStateStrip === 'function' ? renderPlayerStateStrip() : '') +
    renderEventStatus() +
    '<div class="dot-grid" id="simDotGrid">' +
      '<div style="display:flex;align-items:center;justify-content:center;width:100%;min-height:120px;">' +
        '<div class="loading-balls"><span class="loading-ball"></span><span class="loading-ball"></span><span class="loading-ball"></span></div>' +
      '</div>' +
    '</div>' +
    '<div style="text-align:center;padding:4px 0 8px;font-size:12px;color:var(--text-dim);" id="simStatus"></div>';
  try { ensurePulseBoard(); refreshPulseBoard(true); } catch (e) { console.error('[Pulse]', e); }
}

// ==================== 选秀系统 ====================
var DRAFT_CLASS_2026 = [
  { pick: 1, team: 'WAS', cn: 'A-J-迪班萨', pos: '前锋', height: '2.06米' },
  { pick: 2, team: 'UTA', cn: '达林-彼得森', pos: '后卫', height: '1.98米' },
  { pick: 3, team: 'MEM', cn: '卡梅隆-布泽尔', pos: '前锋', height: '2.06米' },
  { pick: 4, team: 'CHI', cn: '凯莱布-威尔逊', pos: '前锋', height: '2.08米' },
  { pick: 5, team: 'LAC', cn: '基顿-瓦格勒', pos: '后卫', height: '1.98米' },
  { pick: 6, team: 'BKN', cn: '米克尔-布朗-二世', pos: '后卫', height: '1.96米' },
  { pick: 7, team: 'SAC', cn: '达里乌斯-阿库夫-二世', pos: '后卫', height: '1.91米' },
  { pick: 8, team: 'ATL', cn: '金斯顿-弗莱明斯', pos: '后卫', height: '1.93米' },
  { pick: 9, team: 'DAL', cn: '莫雷兹-约翰逊-二世', pos: '前锋', height: '2.06米' },
  { pick: 10, team: 'MIL', cn: '布雷登-伯里斯', pos: '后卫', height: '1.93米' },
  { pick: 11, team: 'GSW', cn: '雅克塞尔-兰德伯格', pos: '前锋', height: '2.06米' },
  { pick: 12, team: 'OKC', cn: '阿戴-马拉', pos: '中锋', height: '2.21米' },
  { pick: 13, team: 'MIL', cn: '内特-阿门特', pos: '前锋', height: '2.08米' },
  { pick: 14, team: 'CHA', cn: '汉内斯-斯坦巴赫', pos: '前锋', height: '2.11米' },
  { pick: 15, team: 'CHI', cn: '戴林-斯温', pos: '后卫', height: '2.03米' },
  { pick: 16, team: 'OKC', cn: '班尼特-斯蒂尔茨', pos: '后卫', height: '1.93米' },
  { pick: 17, team: 'DET', cn: '埃布卡-奥科里', pos: '后卫', height: '1.88米' },
  { pick: 18, team: 'CHA', cn: '克里斯蒂安-安德森', pos: '后卫', height: '1.91米' },
  { pick: 19, team: 'TOR', cn: '艾伦-格雷夫斯', pos: '前锋', height: '2.06米' },
  { pick: 20, team: 'SAS', cn: '杰登-昆坦斯', pos: '前锋', height: '2.08米' },
  { pick: 21, team: 'MEM', cn: '卡里姆-洛佩兹', pos: '前锋', height: '2.03米' },
  { pick: 22, team: 'PHI', cn: '拉巴伦-菲隆-二世', pos: '后卫', height: '1.93米' },
  { pick: 23, team: 'ATL', cn: '祖比-埃吉奥福', pos: '前锋', height: '2.06米' },
  { pick: 24, team: 'LAL', cn: '卡梅隆-卡尔', pos: '后卫', height: '1.96米' },
  { pick: 25, team: 'DAL', cn: '塞尔希奥-德-拉雷亚', pos: '前锋', height: '1.98米' },
  { pick: 26, team: 'SAS', cn: '塔里斯-里德-二世', pos: '中锋', height: '2.11米' },
  { pick: 27, team: 'BOS', cn: '克里斯-塞纳克-二世', pos: '前锋', height: '2.11米' },
  { pick: 28, team: 'BKN', cn: '约书亚-杰斐逊', pos: '前锋', height: '2.06米' },
  { pick: 29, team: 'SAC', cn: '亚历克斯-卡拉班', pos: '前锋', height: '2.03米' },
  { pick: 30, team: 'PHX', cn: '科亚-皮特', pos: '前锋', height: '2.03米' },
  { pick: 31, team: 'HOU', cn: '布鲁斯-桑顿-二世', pos: '后卫', height: '1.88米' },
  { pick: 32, team: 'MEM', cn: '里奇-桑德斯', pos: '后卫', height: '1.96米' },
  { pick: 33, team: 'MIN', cn: '赛亚-埃文斯', pos: '后卫', height: '1.98米' },
  { pick: 34, team: 'CLE', cn: '米里克-托马斯', pos: '后卫', height: '1.96米' },
  { pick: 35, team: 'DEN', cn: '特雷文-布拉齐尔', pos: '前锋', height: '2.08米' },
  { pick: 36, team: 'LAC', cn: '巴巴-米勒', pos: '前锋', height: '2.11米' },
  { pick: 37, team: 'MIA', cn: '赖安-康威尔', pos: '后卫', height: '1.93米' },
  { pick: 38, team: 'IND', cn: '布雷登-史密斯', pos: '后卫', height: '1.83米' },
  { pick: 39, team: 'NYK', cn: '杰克-卡伊尔', pos: '后卫', height: '1.91米' },
  { pick: 40, team: 'BOS', cn: '狄龙-米切尔', pos: '前锋', height: '2.03米' },
  { pick: 41, team: 'OKC', cn: '奥特加-奥韦', pos: '后卫', height: '1.93米' },
  { pick: 42, team: 'SAS', cn: '贾科比-吉莱斯皮', pos: '后卫', height: '1.85米' },
  { pick: 43, team: 'BKN', cn: '泰勒-比洛多', pos: '前锋', height: '2.06米' },
  { pick: 44, team: 'SAS', cn: '马利克-布朗', pos: '前锋', height: '2.06米' },
  { pick: 45, team: 'SAC', cn: '伊曼纽尔-夏普', pos: '后卫', height: '1.91米' },
  { pick: 46, team: 'WAS', cn: '菲利克斯-奥帕拉', pos: '前锋', height: '2.11米' },
  { pick: 47, team: 'NYK', cn: '泰勒-尼克尔', pos: '前锋', height: '2.01米' },
  { pick: 48, team: 'DAL', cn: '托比-拉瓦尔', pos: '前锋', height: '2.03米' },
  { pick: 49, team: 'DEN', cn: '布莱斯-霍普金斯', pos: '前锋', height: '2.01米' },
  { pick: 50, team: 'TOR', cn: '贾登-布拉德利', pos: '后卫', height: '1.91米' },
  { pick: 51, team: 'ORL', cn: '伊赛亚-尼尔森', pos: '前锋', height: '2.08米' },
  { pick: 52, team: 'ATL', cn: '亨利-维萨尔', pos: '中锋', height: '2.13米' },
  { pick: 53, team: 'DET', cn: '乌戈纳-奥尼恩索', pos: '中锋', height: '2.13米' },
  { pick: 54, team: 'GSW', cn: '拉杰-琼斯', pos: '后卫', height: '2.01米' },
  { pick: 55, team: 'LAC', cn: '尼克-马蒂内利', pos: '前锋', height: '2.01米' },
  { pick: 56, team: 'DAL', cn: '弗谢沃洛德-伊什琴科', pos: '后卫', height: '1.91米' },
  { pick: 57, team: 'LAC', cn: '纳西斯-恩戈伊', pos: '中锋', height: '2.13米' },
  { pick: 58, team: 'NOP', cn: '贾伦-皮埃尔-二世', pos: '后卫', height: '1.96米' },
  { pick: 59, team: 'MIN', cn: '特雷-考夫曼-雷恩', pos: '前锋', height: '2.06米' },
  { pick: 60, team: 'MIL', cn: '马利克-刘易斯', pos: '前锋', height: '2.03米' },
];

function draftOvrByPick(pick) {
  if (pick <= 3) return 81;
  if (pick <= 8) return 80;
  if (pick <= 15) return 79;
  if (pick <= 22) return 78;
  if (pick <= 30) return 77;
  if (pick <= 40) return 75;
  if (pick <= 50) return 73;
  if (pick <= 60) return 71;
  if (pick <= 80) return 70;
  if (pick <= 110) return 69;
  return 68;
}

function draftPosToCode(pos) {
  if (pos === '后卫') return Math.random() < 0.5 ? 'PG' : 'SG';
  if (pos === '前锋') return Math.random() < 0.5 ? 'SF' : 'PF';
  return 'C';
}

function applyDraftClass2026() {
  if (!NBA2K_DATA || NBA2K_DATA._draftClass2026Applied) return;
  NBA2K_DATA._draftClass2026Applied = true;
  var attrKeys = SIM_CONFIG.ATTR_LIST || ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU'];
  var byTeam = {};
  DRAFT_CLASS_2026.forEach(function(p) {
    byTeam[p.team] = byTeam[p.team] || [];
    byTeam[p.team].push(p);
  });
  Object.keys(byTeam).forEach(function(t) {
    var roster = NBA2K_DATA[t];
    if (!roster) return;
    var picks = byTeam[t];
    picks.forEach(function(pk) {
      var pad = String(pk.pick);
      while (pad.length < 2) pad = '0' + pad;
      var ovr = draftOvrByPick(pk.pick);
      var rookieId = Number(pk.nbaId || PERFECT_PLAYER_HEADSHOT_DRAFT_2026_IDS[pk.pick - 1] || 0);
      var rookie = {
        name: 'Draft2026_' + pad,
        cname: pk.cn,
        nbaId: rookieId,
        nameEn: pk.en || '',
        photoUrl: rookieId ? 'https://cdn.nba.com/headshots/nba/latest/260x190/' + rookieId + '.png' : '',
        photoLocal: rookieId ? 'assets/images/Player/rookies-2026/rookie-' + pad + '.jpg' : '',
        photoSource: rookieId ? 'nba-official-draft-profile' : '',
        photoStatus: rookieId ? 'cached' : 'missing',
        pos: draftPosToCode(pk.pos),
        height: pk.height,
        type: '新秀',
        ovr: ovr,
        _age: 19 + Math.floor(Math.random() * 3),
        _enterYear: 2026,
        contract: pk.pick <= 14 ? 3 : (pk.pick <= 30 ? 2 : 1),
        _awardStreak: {},
      };
      attrKeys.forEach(function(k) {
        rookie[k] = Math.max(25, Math.min(99, ovr + Math.floor(Math.random() * 16) - 8));
      });
      roster.push(rookie);
    });
  });
}

function saveStandings() {
  STATE._prevStandings = STATE.season.standings ? JSON.parse(JSON.stringify(STATE.season.standings)) : null;
  if (STATE._prevStandings) {
    if (!STATE._teamHistory) STATE._teamHistory = {};
    NBA2K_TEAMS.forEach(function(t) {
      var st = STATE._prevStandings[t];
      if (!st) return;
      var pct = (st.wins + st.losses) > 0 ? st.wins / (st.wins + st.losses) : 0.5;
      if (!STATE._teamHistory[t]) STATE._teamHistory[t] = [];
      STATE._teamHistory[t].unshift(pct);
      if (STATE._teamHistory[t].length > 4) STATE._teamHistory[t].pop();
    });
  }
}

function processDraft() {
  if (!STATE._prevStandings) return;
  var st = STATE._prevStandings;
  // 按胜率排（差在前）
  var teams = NBA2K_TEAMS.slice().sort(function(a, b) {
    var aw = (st[a] && st[a].wins) || 0, al = (st[a] && st[a].losses) || 0;
    var bw = (st[b] && st[b].wins) || 0, bl = (st[b] && st[b].losses) || 0;
    var ap = aw + al > 0 ? aw / (aw + al) : 0.5;
    var bp = bw + bl > 0 ? bw / (bw + bl) : 0.5;
    return ap - bp;
  });
  var attrKeys = SIM_CONFIG.ATTR_LIST || ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU'];

  teams.forEach(function(t, idx) {
    var ovrRange;
    if (idx === 0) ovrRange = { min: 75, max: 82 };
    else if (idx === 1) ovrRange = { min: 73, max: 80 };
    else if (idx === 2) ovrRange = { min: 72, max: 78 };
    else if (idx < 10) ovrRange = { min: 68, max: 75 };
    else ovrRange = { min: 60, max: 70 };

    var rookie = generateRookie();
    var targetOvr = ovrRange.min + Math.floor(rngNext() * (ovrRange.max - ovrRange.min + 1));
    rookie.ovr = targetOvr;
    attrKeys.forEach(function(k) { rookie[k] = Math.max(25, Math.min(99, targetOvr + Math.floor(rngNext() * 16) - 8)); });
    // 新秀合同
    if (idx < 5) rookie.contract = 3 + Math.floor(rngNext() * 2);
    else if (idx < 14) rookie.contract = 2 + Math.floor(rngNext() * 3);
    else rookie.contract = 1 + Math.floor(rngNext() * 3);

    var roster = NBA2K_DATA[t];
    if (!roster) return;
    var lowestIdx = -1, lowestOvr = 999;
    roster.forEach(function(p, pi) {
      if (p.name && p.name.indexOf('Rookie_') >= 0 && p.ovr < lowestOvr) {
        lowestOvr = p.ovr; lowestIdx = pi;
      }
    });
    if (lowestIdx >= 0) roster[lowestIdx] = rookie;
  });
}

// ==================== 自由球员系统 ====================
function randomContractByAge(age) {
  if (age <= 23) return 2 + Math.floor(rngNext() * 3);
  if (age <= 26) return 2 + Math.floor(rngNext() * 2);
  if (age <= 30) return 1 + Math.floor(rngNext() * 3);
  if (age <= 33) return 1 + Math.floor(rngNext() * 2);
  return 1;
}

function assignFreeAgents() {
  var pool = STATE._freeAgentPool || [];
  if (pool.length === 0) return;

  if (!STATE._leagueChanges) STATE._leagueChanges = {};
  if (!STATE._leagueChanges.freeSignings) STATE._leagueChanges.freeSignings = [];

  console.log('[FA] 自由球员分配:', pool.length, '人');

  pool.sort(function(a, b) { return b.ovr - a.ovr; });
  var st = STATE._prevStandings;
  var teams = NBA2K_TEAMS.slice().sort(function(a, b) {
    var aw = (st && st[a] && st[a].wins) || 0, al = (st && st[a] && st[a].losses) || 0;
    var bw = (st && st[b] && st[b].wins) || 0, bl = (st && st[b] && st[b].losses) || 0;
    return (aw + al > 0 ? aw / (aw + al) : 0.5) - (bw + bl > 0 ? bw / (bw + bl) : 0.5);
  });

  // 本轮自由市场已签约 OVR ≥ 86 的球队（防扎堆）
  var starSignedTeams = {};

  pool.forEach(function(fa) {
    if (!fa._origTeam) console.log('[FA] 无_origTeam:', (fa.cname||fa.name), 'ovr:', fa.ovr);
    var pos = (fa.pos || 'SF').split('/')[0].trim();
    for (var ti = 0; ti < teams.length; ti++) {
      var t = teams[ti];
      if (t === fa._origTeam) { console.log('[FA] 跳过回原队:', (fa.cname||fa.name), fa._origTeam); continue; }
      if (fa.ovr > 86) {
        if (starSignedTeams[t]) { console.log('[FA] 该队已签球星，跳过:', (fa.cname||fa.name), t); continue; }
        var hasStar = false;
        (NBA2K_DATA[t] || []).forEach(function(p) {
          if (p !== fa && !p._isUser && canPlayPosition(p.pos || '', pos) && p.ovr >= 84) hasStar = true;
        });
        if (hasStar) continue;
      }
      var roster = NBA2K_DATA[t];
      if (!roster || roster.length >= 18) continue;
      var posCount = 0;
      roster.forEach(function(p) {
        if (canPlayPosition(p.pos || '', pos)) posCount++;
      });
      if (posCount < 2) {
        roster.push(fa);
        fa._justSigned = true;
        if (fa.ovr > 86) starSignedTeams[t] = true;
        STATE._leagueChanges.freeSignings.push({ name: fa.cname || fa.name, nameEN: fa.name, from: fa._origTeam, to: t, ovr: fa.ovr });
        if (t === STATE.careerTeam) {
          if (!STATE._leagueChanges.teamChanges) STATE._leagueChanges.teamChanges = {};
          STATE._leagueChanges.teamChanges[t] = STATE._leagueChanges.teamChanges[t] || { retired: [], rookies: [] };
          STATE._leagueChanges.teamChanges[t].rookies.push(fa.cname || fa.name);
        }
        return;
      }
    }
    // fallback
    for (var fi = 0; fi < teams.length; fi++) {
      var fb = teams[fi];
      if (fb === fa._origTeam) { console.log('[FA] fallback跳过回原队:', (fa.cname||fa.name), fa._origTeam); continue; }
      if (fa.ovr > 86) {
        if (starSignedTeams[fb]) continue;
        var hasStarFB = false;
        (NBA2K_DATA[fb] || []).forEach(function(p) {
          if (p !== fa && !p._isUser && p.ovr >= 84) hasStarFB = true;
        });
        if (hasStarFB) continue;
      }
      var fbRoster = NBA2K_DATA[fb];
      if (fbRoster && fbRoster.length < 18) {
        fbRoster.push(fa);
        fa._justSigned = true;
        if (fa.ovr > 86) starSignedTeams[fb] = true;
        STATE._leagueChanges.freeSignings.push({ name: fa.cname || fa.name, nameEN: fa.name, from: fa._origTeam, to: fb, ovr: fa.ovr });
        break;
      }
    }
  });

  STATE._freeAgentPool = [];
}

// ==================== 交易系统 ====================
function findTradeCandidate(roster, pos, excludeOvr, tradedSet) {
  var best = null;
  for (var i = 0; i < roster.length; i++) {
    var p = roster[i];
    if (p._isUser) continue;
    if (p._justSigned) continue;
    if (p.name && p.name.indexOf('Rookie_') >= 0) continue;
    if (p.ovr > 92) continue;
    if (tradedSet && tradedSet.has(p)) continue;
    if (excludeOvr != null && Math.abs(p.ovr - excludeOvr) > 10) continue;
    if (canPlayPosition(p.pos || '', pos)) {
      if (!best || Math.abs(p.ovr - (excludeOvr || 75)) < Math.abs(best.ovr - (excludeOvr || 75))) best = p;
    }
  }
  return best;
}

function swapRosterPlayers(teamA, teamB, playerA, playerB) {
  var rosterA = NBA2K_DATA[teamA];
  var rosterB = NBA2K_DATA[teamB];
  var idxA = -1, idxB = -1;
  for (var i = 0; i < rosterA.length; i++) { if (rosterA[i] === playerB) { idxA = i; break; } }
  for (var j = 0; j < rosterB.length; j++) { if (rosterB[j] === playerA) { idxB = j; break; } }
  if (idxA < 0 || idxB < 0) return false;
  rosterA[idxA] = playerA;
  rosterB[idxB] = playerB;
  STATE._leagueChanges.trades.push({
    from: teamA, to: teamB,
    playerA: playerA.cname || playerA.name,
    playerB: playerB.cname || playerB.name,
    nameENA: playerA.name || '',
    nameENB: playerB.name || '',
    ovrA: parseInt(playerA.ovr, 10) || 0,
    ovrB: parseInt(playerB.ovr, 10) || 0
  });
  return true;
}

/**
 * 从本休赛期全部转会（交易双方 + 自由球员签约）里，按总评从高到低取出最多 20 笔动向。
 * 不是「专门做前20球星交易」，而是「转会池里总评最高的那些」。
 */
function buildTopTransferDigest() {
  if (!STATE._leagueChanges) STATE._leagueChanges = {};
  var moves = [];
  var seen = {};

  function pushMove(entry) {
    if (!entry || !entry.name) return;
    var ovr = parseInt(entry.ovr, 10) || 0;
    if (ovr <= 0) return;
    var key = (entry.nameEN || entry.name) + '|' + (entry.from || '') + '|' + (entry.to || '');
    if (seen[key]) return;
    seen[key] = true;
    moves.push({
      name: entry.name,
      nameEN: entry.nameEN || '',
      from: entry.from || '',
      to: entry.to || '',
      ovr: ovr,
      kind: entry.kind || 'trade'
    });
  }

  (STATE._leagueChanges.freeSignings || []).forEach(function(s) {
    pushMove({
      name: s.name,
      nameEN: s.nameEN || s.playerName || '',
      from: s.from,
      to: s.to,
      ovr: s.ovr,
      kind: 'fa'
    });
  });

  (STATE._leagueChanges.trades || []).forEach(function(tr) {
    var isPickDeal = tr.playerB === '选秀权';
    // 换人交易：playerB from→to，playerA to→from；选秀权交易：playerA from→to
    if (tr.playerB && !isPickDeal) {
      pushMove({
        name: tr.playerB,
        nameEN: tr.nameENB || '',
        from: tr.from,
        to: tr.to,
        ovr: tr.ovrB,
        kind: 'trade'
      });
    }
    if (tr.playerA && tr.playerA !== '选秀权') {
      pushMove({
        name: tr.playerA,
        nameEN: tr.nameENA || '',
        from: isPickDeal ? tr.from : tr.to,
        to: isPickDeal ? tr.to : tr.from,
        ovr: tr.ovrA || (isPickDeal ? (STATE.finalOVR || 0) : 0),
        kind: 'trade'
      });
    }
  });

  moves.sort(function(a, b) { return b.ovr - a.ovr; });
  STATE._leagueChanges.transferDigest = moves.slice(0, 20);
  STATE._leagueChanges.transferDigestTotal = moves.length;
  return STATE._leagueChanges.transferDigest;
}

function getTopTransferDigest() {
  var changes = STATE._leagueChanges || {};
  if (changes.transferDigest && changes.transferDigest.length) return changes.transferDigest;
  return buildTopTransferDigest();
}

function processTrades() {
  if (!NBA2K_DATA) return;
  if (!STATE._leagueChanges) STATE._leagueChanges = { retired: [], rookies: [], teamChanges: {}, trades: [] };
  if (!STATE._leagueChanges.trades) STATE._leagueChanges.trades = [];

  // 算每队需求位置
  var needs = {};
  NBA2K_TEAMS.forEach(function(t) {
    var lineup = calcTeamLineup(t);
    var weakest = null, weakOvr = 999;
    ['PG','SG','SF','PF','C'].forEach(function(pos) {
      var p = lineup.starters[pos];
      if (p && !p._isUser && p.ovr < weakOvr) {
        weakOvr = p.ovr; weakest = pos;
      }
    });
    needs[t] = weakest;
  });

  console.log('[Trade] 需求:', JSON.stringify(needs));

  var tradedPlayers = new Set();
  var tradedTeams = new Set();

  // 打乱球队顺序，让交易分布更随机
  var shuffled = NBA2K_TEAMS.slice().sort(function() { return rngNext() - 0.5; });

  // 多撮合一些，方便休赛期能筛出「转会里总评最高的 20 笔」
  var tradeCount = 0;
  for (var ti = 0; ti < shuffled.length && tradeCount < 16; ti++) {
    var a = shuffled[ti];
    if (tradedTeams.has(a)) continue;

    var needA = needs[a];
    if (!needA) continue;

    // 找一支和 A 互补的球队
    for (var tj = ti + 1; tj < shuffled.length && tradeCount < 16; tj++) {
      var b = shuffled[tj];
      if (b === a || tradedTeams.has(b)) continue;

      var needB = needs[b];
      if (!needB) continue;
      if (needA === needB) continue;

      var rosterA = NBA2K_DATA[a];
      var rosterB = NBA2K_DATA[b];
      if (!rosterA || !rosterB) continue;

      var playerForB = findTradeCandidate(rosterA, needB, null, tradedPlayers);
      var playerForA = findTradeCandidate(rosterB, needA, null, tradedPlayers);

      if (playerForA && playerForB) {
        var diff = Math.abs(playerForA.ovr - playerForB.ovr);
        console.log('[Trade] 配对:', a, needA, 'vs', b, needB, '候选人:', (playerForA.cname||playerForA.name), playerForA.ovr, (playerForB.cname||playerForB.name), playerForB.ovr, 'diff:', diff);
        if (diff <= 8) {
          tradedPlayers.add(playerForA);
          tradedPlayers.add(playerForB);
          tradedTeams.add(a);
          tradedTeams.add(b);
          swapRosterPlayers(a, b, playerForA, playerForB);
          tradeCount++;
          // 重新算两队需求
          lineup = calcTeamLineup(a);
          var w2 = null, wo2 = 999;
          ['PG','SG','SF','PF','C'].forEach(function(pos) {
            var p2 = lineup.starters[pos];
            if (p2 && !p2._isUser && p2.ovr < wo2) { wo2 = p2.ovr; w2 = pos; }
          });
          needs[a] = w2;
          lineup = calcTeamLineup(b);
          w2 = null; wo2 = 999;
          ['PG','SG','SF','PF','C'].forEach(function(pos) {
            var p2 = lineup.starters[pos];
            if (p2 && !p2._isUser && p2.ovr < wo2) { wo2 = p2.ovr; w2 = pos; }
          });
          needs[b] = w2;
          break;
        }
      }
    }
  }

  buildTopTransferDigest();
  if (typeof clearLineupCache === 'function') clearLineupCache();
}

function calcOVR(attrs, pos) {
  var weights = SIM_CONFIG && SIM_CONFIG.OVR_WEIGHTS ? SIM_CONFIG.OVR_WEIGHTS[pos || STATE.position] : null;
  if (weights) {
    var weighted = 0;
    ATTR_KEYS.forEach(function(k) {
      weighted += softCap99((attrs && attrs[k] != null) ? attrs[k] : 50) * (weights[k] || 0.07);
    });
    return Math.round(weighted);
  }
  var sum = 0, count = 0;
  ATTR_KEYS.forEach(function(k) {
    if (attrs && attrs[k] != null) { sum += softCap99(attrs[k]); count++; }
  });
  return count > 0 ? Math.round(sum / count) : 50;
}

// ==================== 联盟演变 ====================
var _playerAges = null;
var _playerGenes = null;

function loadPlayerAges() {
  if (_playerAges) return;
  _playerAges = {};
  _playerGenes = {};
  try {
    var rows = window.__PLAYER_AGE_ROWS__;
    if (!rows) {
      var data = document.getElementById('player-age-data');
      if (data && data.textContent) rows = JSON.parse(data.textContent);
    }
    if (!rows || !rows.length) return;
    rows.forEach(function(r) {
      _playerAges[r.n] = r.a;
      _playerGenes[r.n] = { v: r.v || (1 + Math.floor(rngNext() * 4)), l: r.l || (1 + Math.floor(rngNext() * 4)) };
    });
  } catch(e) {}
}

function getPlayerAge(playerName) {
  loadPlayerAges();
  if (isLeBronJamesPlayer(playerName)) return LEBRON_JAMES_SPECIAL_RULE.initialAge;
  return _playerAges && _playerAges[playerName] ? _playerAges[playerName] : null;
}

function getPlayerGene(playerName) {
  loadPlayerAges();
  if (_playerGenes && _playerGenes[playerName]) return _playerGenes[playerName];
  var g = { v: 1 + Math.floor(rngNext() * 4), l: 1 + Math.floor(rngNext() * 4) };
  if (_playerGenes) _playerGenes[playerName] = g;
  return g;
}

function inferAge(playerName, ovr) {
  if (isLeBronJamesPlayer(playerName)) return LEBRON_JAMES_SPECIAL_RULE.initialAge;
  if (ovr >= 90) return 28;
  if (ovr >= 80) return 26;
  if (ovr >= 70) return 24;
  return 22;
}

var LEBRON_JAMES_SPECIAL_RULE = {
  initialAge: 41,
  maxRetirementAge: 42
};

function normalizePlayerIdentityKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isLeBronJamesPlayer(player) {
  var names = [];
  if (typeof player === 'string') {
    names.push(player);
  } else if (player) {
    names.push(player.name, player.nameEN, player.slug, player.id, player.playerId, player.cname);
  }
  for (var i = 0; i < names.length; i++) {
    var key = normalizePlayerIdentityKey(names[i]);
    if (key === 'lebron-james' || key === 'lebron') return true;
  }
  return false;
}

function getLeaguePlayerAge(player) {
  if (player && typeof player._age === 'number') return player._age;
  var age = isLeBronJamesPlayer(player)
    ? LEBRON_JAMES_SPECIAL_RULE.initialAge
    : (getPlayerAge(player && player.name) || inferAge(player && player.name, player && player.ovr));
  if (player) player._age = age;
  return age;
}

function getLeaguePlayerLongevityScore(player) {
  player = player || {};
  var ovr = Number(player.ovr) || 70;
  var physical = averageCareerAttributes(player, ['ATH', 'STR', 'FIN', 'DNK', 'REB'], ovr);
  var skill = averageCareerAttributes(player, ['threePT', 'MID', 'HAN', 'PAS', 'CLU'], ovr);
  return Math.max(25, Math.min(99, ovr * 0.55 + physical * 0.27 + skill * 0.18));
}

function getLeagueRetirementChance(player, age) {
  age = Number(age) || 22;
  if (age >= LEBRON_JAMES_SPECIAL_RULE.maxRetirementAge) return 100;
  if (age < 34) return 0;
  var baseByAge = { 34:2, 35:4, 36:8, 37:14, 38:23, 39:34, 40:48, 41:68 };
  var base = baseByAge[age] == null ? 0 : baseByAge[age];
  var longevity = getLeaguePlayerLongevityScore(player);
  return Math.max(0, Math.min(96, base + (80 - longevity) * 1.4));
}

function evolveLeague() {
  STATE._leagueChanges = { retired: [], rookies: [], teamChanges: {}, trades: [] };
  var teams = typeof NBA2K_TEAMS !== 'undefined' ? NBA2K_TEAMS : [];
  var incomingSeasonStart = 2026 + ((STATE.career && STATE.career.seasonCount) || 0);
  teams.forEach(function(t) {
    var roster = NBA2K_DATA[t];
    if (!roster || !roster.length) return;
    STATE._leagueChanges.teamChanges[t] = { before: roster.length, retired: [], rookies: [] };
    var newRoster = [];
    roster.forEach(function(p) {
      var age = getLeaguePlayerAge(p);
      var gene = getPlayerGene(p.name);
      var volatility = gene.v;
      var ageFactor = 0;
      if (age <= 22) ageFactor = 1 + rngNext() * 1.5;
      else if (age <= 28) ageFactor = (rngNext() - 0.5) * 1.5;
      else if (age <= 33) ageFactor = -1 - rngNext() * 1.5;
      else ageFactor = -2 - rngNext() * 2;
      var volFactor = (rngNext() - 0.5) * volatility * 0.6;
      var randFactor = (rngNext() - 0.5) * 1.5;
      var change = ageFactor * 0.5 + volFactor * 0.3 + randFactor * 0.2;
      if (isMvpStar(p) && age <= 26) change += 0.6 + rngNext() * 0.8; // 重点新秀成长加速
      change = Math.round(change * 2) / 2;
      var newOvr = Math.max(55, Math.min(99, p.ovr + change));
      if (newOvr !== p.ovr) {
        var ratio = Math.round(newOvr) / p.ovr;
        SIM_CONFIG.ATTR_LIST.forEach(function(attrKey) {
          if (p[attrKey] != null) p[attrKey] = Math.max(25, Math.min(99, Math.round(p[attrKey] * ratio)));
        });
        p.ovr = Math.round(newOvr);
      }
      // 联盟球员同样按“年龄 × 当前能力”双判定；42 岁赛季结束后统一退役。
      var retireChance = getLeagueRetirementChance(p, age);
      if (rngNext() * 100 < retireChance) {
        STATE._leagueChanges.retired.push({ name: p.cname || p.name, nameEN: p.name, ovr: p.ovr, team: t, age: age });
        if (t === STATE.careerTeam && STATE._leagueChanges.teamChanges[t]) {
          STATE._leagueChanges.teamChanges[t].retired.push(p.cname || p.name);
        }
        return;
      }
      p._age = age + 1; // 临时实验：球员年龄真实上涨，每年 +1
      if (p.type === '新秀') p.type = '球员';
      newRoster.push(p);
    });
    while (newRoster.length < 18) { // 休赛期名单补齐到 18 人
      var rk = generateRookie();
      rk._enterYear = incomingSeasonStart;
      newRoster.push(rk);
      STATE._leagueChanges.rookies.push({ name: rk.cname || rk.name, team: t });
      if (t === STATE.careerTeam && STATE._leagueChanges.teamChanges[t]) {
        STATE._leagueChanges.teamChanges[t].rookies.push(rk.cname || rk.name);
      }
    }
    NBA2K_DATA[t] = newRoster;
  });

  // ── 合同初始化（一次性）──
  if (!STATE._contractsInited) {
    NBA2K_TEAMS.forEach(function(t) {
      (NBA2K_DATA[t] || []).forEach(function(p) {
        if (p.contract === undefined) {
          var age = getLeaguePlayerAge(p);
          if (age <= 23) p.contract = 2 + Math.floor(rngNext() * 3);
          else if (age <= 26) p.contract = 2 + Math.floor(rngNext() * 2);
          else if (age <= 30) p.contract = 1 + Math.floor(rngNext() * 3);
          else if (age <= 33) p.contract = 1 + Math.floor(rngNext() * 2);
          else p.contract = 1;
        }
      });
    });
    STATE._contractsInited = true;
  }

  // ── 合同扣减 + 留队判定 + 到期剥离 ──
  var freeAgents = [];
  NBA2K_TEAMS.forEach(function(t) {
    var roster = NBA2K_DATA[t];
    if (!roster) return;
    var newRoster = [];
    roster.forEach(function(p) {
      if (p.contract === undefined) p.contract = 4;
      p.contract--;
      if (p.contract <= 0) {
        // 留队判定
        var age = getLeaguePlayerAge(p);
        var hist = STATE._teamHistory ? STATE._teamHistory[t] : null;
        var avgPct = 0.5;
        if (hist && hist.length > 0) {
          var sum = 0;
          hist.forEach(function(h) { sum += h; });
          avgPct = sum / hist.length;
        }
        var teamFactor = avgPct >= 0.65 ? 1.1 : avgPct >= 0.55 ? 1.0 : avgPct >= 0.45 ? 0.9 : avgPct >= 0.35 ? 0.75 : 0.6;
        var starFactor = p.ovr >= 88 ? 0.9 : 1.0;
        var trendFactor = 1.0;
        if (hist && hist.length >= 3) {
          if (hist[0] - hist[1] < -0.02 && hist[1] - hist[2] < -0.02) trendFactor = 0.85;
          else if (hist[0] - hist[1] > 0.02 && hist[1] - hist[2] > 0.02) trendFactor = 1.1;
        }
        var stayRate = Math.max(0.1, Math.min(0.95, 0.80 * teamFactor * starFactor * trendFactor));

        if (rngNext() < stayRate) {
          // 留队续约
          p.contract = randomContractByAge(age);
          p._justSigned = true;
          newRoster.push(p);
          STATE._leagueChanges.stayed = STATE._leagueChanges.stayed || [];
          STATE._leagueChanges.stayed.push({ name: p.cname || p.name, team: t, years: p.contract });
        } else {
          // 离队进自由池
          p._origTeam = t;
          freeAgents.push(p);
          STATE._leagueChanges.freeAgents = STATE._leagueChanges.freeAgents || [];
          STATE._leagueChanges.freeAgents.push({ name: p.cname || p.name, ovr: p.ovr, team: t, age: age });
        }
      } else {
        newRoster.push(p);
      }
    });
    NBA2K_DATA[t] = newRoster;
  });
  STATE._leagueChanges.freeAgentCount = freeAgents.length;
  STATE._freeAgentPool = freeAgents;
}

var ROOKIE_NAMES = [
  { en: "Joaquim Boumtje Boumtje", cn: "若阿金-布姆杰-布姆杰" },
  { en: "Nikola Kusturica", cn: "尼古拉-库斯图里卡" },
  { en: "Marcus Spears Jr.", cn: "马库斯-斯皮尔斯二世" },
  { en: "CJ Rosser", cn: "C.J.-罗瑟" },
  { en: "Beckham Black", cn: "贝克汉姆-布莱克" },
  { en: "Adan Diggs", cn: "亚当-迪格斯" },
  { en: "Nathan Soliman", cn: "内森-索利曼" },
  { en: "Paul Osaruyi", cn: "保罗-奥萨鲁伊" },
  { en: "Obinna Ekezie", cn: "奥宾纳-埃克济" },
  { en: "Lewis Uvwo", cn: "刘易斯-乌沃" },
  { en: "Demarcus Henry", cn: "德马库斯-亨利" },
  { en: "Messi Yangala", cn: "梅西-扬加拉" },
  { en: "Jason Crowe Jr.", cn: "杰森-克劳二世" },
  { en: "Jordan Page", cn: "乔丹-佩奇" },
  { en: "Stefan Vaaks", cn: "斯特凡-瓦克斯" },
  { en: "Fabian Kayser", cn: "法比安-凯泽" },
  { en: "Nasir (Rudy) Anderson", cn: "纳西尔-安德森（鲁迪）" },
  { en: "Luke Paul", cn: "卢克-保罗" },
  { en: "Caleb Gaskins", cn: "卡莱布-加斯金斯" },
  { en: "Malachi Jordan", cn: "玛拉基-乔丹" },
  { en: "Ryan Hampton", cn: "瑞安-汉普顿" },
  { en: "Egor Amosov", cn: "叶戈尔-阿莫索夫" },
  { en: "King Gibson", cn: "金-吉布森" },
  { en: "Tajh Ariza", cn: "塔伊-阿里扎" },
  { en: "Kager Knueppel", cn: "凯格-克努佩尔" },
  { en: "Austin Goosby", cn: "奥斯汀-古斯比" },
  { en: "Gabe Nesmith", cn: "加布-内史密斯" },
  { en: "Deron Rippey Jr.", cn: "德隆-里皮二世" },
  { en: "Killyan Toure", cn: "基利安-图雷" },
  { en: "Bryson Howard", cn: "布莱森-霍华德" },
  { en: "Petar Bjelica", cn: "佩塔尔-别利察" },
  { en: "Lincoln Cosby", cn: "林肯-科斯比" },
  { en: "Sebastian Williams-Adams", cn: "塞巴斯蒂安-威廉姆斯-亚当斯" },
  { en: "Colben Landrew", cn: "科尔本-兰德鲁" },
  { en: "Jake Wilkins", cn: "杰克-威尔金斯" },
  { en: "Tony Bryant", cn: "托尼-布莱恩特" },
  { en: "Davis Fogle", cn: "戴维斯-福格尔" },
  { en: "Mathias Vazquez", cn: "马蒂亚斯-巴斯克斯" },
  { en: "Josh Leonard", cn: "乔什-伦纳德" },
  { en: "Adonis Ratliff", cn: "阿多尼斯-拉特利夫" },
  { en: "L.J. Smith", cn: "L.J.-史密斯" },
  { en: "Jasper Johnson", cn: "贾斯珀-约翰逊" },
  { en: "Abdramane Siby", cn: "阿卜杜拉马内-西比" },
  { en: "CJ Ingram", cn: "C.J.-英格拉姆" },
  { en: "Godson Okokoh", cn: "戈德森-奥科科" },
  { en: "Moustapha Diop", cn: "穆斯塔法-迪奥普" },
  { en: "Sinan Huan", cn: "西南-胡安" },
  { en: "Isaiah Johnson", cn: "以赛亚-约翰逊" },
  { en: "Darrius Wabbington", cn: "达里厄斯-沃宾顿" },
  { en: "Alex Constanza", cn: "亚历克斯-康斯坦萨" },
  { en: "Tyrone Jamison", cn: "泰龙-贾米森" },
  { en: "Jamier Jones", cn: "贾米尔-琼斯" },
  { en: "Jordan Scott", cn: "乔丹-斯科特" },
  { en: "Hugo Facorat", cn: "雨果-法科拉特" },
  { en: "Ethan Taylor", cn: "伊森-泰勒" },
  { en: "Elijah Williams", cn: "以利亚-威廉姆斯" },
  { en: "Jacob Webber", cn: "雅各布-韦伯" },
  { en: "Kohl Rosario", cn: "科尔-罗萨里奥" },
  { en: "Dooney Johnson", cn: "杜尼-约翰逊" },
  { en: "Darius Ratliff", cn: "达里乌斯-拉特利夫" },
  { en: "Bukky Oboye", cn: "布基-奥博耶" },
  { en: "Junior County", cn: "朱尼尔-康蒂" },
  { en: "Chase McCarty", cn: "蔡斯-麦卡蒂" },
  { en: "Jordan Ellerbee", cn: "乔丹-埃勒比" },
  { en: "Zion Green", cn: "锡安-格林" },
  { en: "Acaden Lewis", cn: "阿卡登-刘易斯" },
  { en: "J.P. Estrella", cn: "J.P.-埃斯特雷拉" },
  { en: "Elzie Harrington", cn: "埃尔齐-哈灵顿" },
  { en: "Adam Oumiddoch", cn: "亚当-乌米多赫" },
  { en: "Chris Washington Jr.", cn: "克里斯-华盛顿二世" },
  { en: "Cameron Holmes", cn: "卡梅伦-霍姆斯" },
  { en: "David Punch", cn: "大卫-潘奇" },
  { en: "Jeremy Jenkins", cn: "杰里米-詹金斯" },
  { en: "Mahamadou Landoure", cn: "马哈马杜-兰杜雷" },
  { en: "Martay Barnes", cn: "马泰-巴恩斯" },
  { en: "Sananda Fru", cn: "萨南达-弗鲁" },
  { en: "TJ Crumble", cn: "T.J.-克朗布尔" },
  { en: "Sam Funches", cn: "萨姆-芬奇斯" },
  { en: "Melih Tunca", cn: "梅利赫-通卡" },
  { en: "Niko Bundalo", cn: "尼科-本达洛" },
  { en: "Ismaila Diagne", cn: "伊斯梅拉-迪亚涅" },
  { en: "Josh Irving", cn: "乔什-欧文" },
  { en: "Jamari Phillips", cn: "贾马里-菲利普斯" },
  { en: "Dylan Grant", cn: "迪伦-格兰特" },
  { en: "Sebastian Wilkins", cn: "塞巴斯蒂安-威尔金斯" },
  { en: "Marcus Ponder", cn: "马库斯-庞德" },
  { en: "Larry Johnson", cn: "拉里-约翰逊" },
  { en: "Xavion Staton", cn: "泽维恩-斯塔顿" },
  { en: "Derrion Reid", cn: "德里恩-里德" },
  { en: "Dante Allen", cn: "但丁-艾伦" },
  { en: "Oswin Erhunmwunse", cn: "奥斯温-埃尔胡姆文塞" },
  { en: "Arturas Butajevas", cn: "阿尔图拉斯-布塔耶瓦斯" },
  { en: "Latrell Almond", cn: "拉特雷尔-阿尔蒙德" },
  { en: "Cam Scott", cn: "卡姆-斯科特" },
  { en: "Darrion Sutton", cn: "达里恩-萨顿" },
  { en: "Francis Chukwudebelu", cn: "弗朗西斯-丘克武德贝卢" },
  { en: "Jermaine O'Neal Jr.", cn: "杰梅因-奥尼尔二世" },
  { en: "Cam Ward", cn: "卡姆-沃德" },
  { en: "Mercy Miller", cn: "梅西-米勒" },
  { en: "Ace Glass", cn: "艾斯-格拉斯" },
  { en: "John Bol", cn: "约翰-博尔" },
  { en: "Qayden Samuels", cn: "凯登-塞缪尔斯" },
  { en: "Annor Boateng", cn: "安诺-博阿滕" },
  { en: "Darren Harris", cn: "达伦-哈里斯" },
  { en: "Fedor Zugic", cn: "费多尔-祖吉奇" },
  { en: "Sir Mohammed", cn: "西尔-穆罕默德" },
  { en: "Aaron Rowe Jr.", cn: "阿龙-罗二世" },
  { en: "Ahmad Nowell", cn: "艾哈迈德-诺维尔" },
  { en: "Badara Diakite", cn: "巴达拉-迪亚基特" },
  { en: "Jovani Ruff", cn: "约瓦尼-拉夫" },
  { en: "Henry Robinson Jr.", cn: "亨利-鲁宾逊二世" },
  { en: "Chidi Nwigwe", cn: "奇迪-恩维格韦" },
  { en: "Felipe Quinones", cn: "费利佩-基尼奥内斯" },
  { en: "Jaden Toombs", cn: "杰登-图姆斯" },
  { en: "Jacob Furphy", cn: "雅各布-弗菲" },
  { en: "JJ Mandaquit", cn: "J.J.-曼达基特" },
  { en: "Bryce James", cn: "布莱斯-詹姆斯" },
  { en: "Julius Halaifonua", cn: "朱利叶斯-哈莱福努阿" },
  { en: "RJ Jones", cn: "R.J.-琼斯" },
  { en: "Samis Calderon", cn: "萨米斯-卡尔德隆" },
  { en: "Jahki Howard", cn: "贾基-霍华德" },
  { en: "Naasir Cunningham", cn: "纳西尔-坎宁安" },
  { en: "James Brown", cn: "詹姆斯-布朗" },
  { en: "Bryce Heard", cn: "布莱斯-赫德" },
  { en: "BJ Davis-Ray", cn: "B.J.-戴维斯-雷" },
  { en: "Alier Maluk", cn: "阿利尔-马卢克" },
  { en: "Chris Nwuli", cn: "克里斯-恩武利" },
  { en: "Jayden Williams", cn: "杰登-威廉姆斯" },
  { en: "Jalen Montonati", cn: "杰伦-蒙托纳蒂" },
  { en: "Kur Teng", cn: "库尔-滕" },
  { en: "Ace Flagg", cn: "艾斯-弗拉格" },
  { en: "Efeosa Oliogu", cn: "埃费奥萨-奥利奥古" },
  { en: "Eli Ellis", cn: "伊莱-埃利斯" },
  { en: "Rakease Passmore", cn: "拉基斯-帕斯莫尔" },
  { en: "Robert Hinton", cn: "罗伯特-欣顿" },
  { en: "Josiah Moseley", cn: "约西亚-莫斯利" },
  { en: "Andrej Kostic", cn: "安德烈-科斯蒂奇" },
  { en: "Taison Chatman", cn: "泰森-查特曼" },
  { en: "Jason Asemota", cn: "杰森-阿塞莫塔" },
];

var DRAFT_CLASS_2027 = [
  { pick: 1, en: "Jordan Smith Jr.", cn: "乔丹-史密斯二世" },
  { pick: 2, en: "Tyran Stokes", cn: "泰兰-斯托克斯" },
  { pick: 3, en: "Stefan Joksimovic", cn: "斯特凡-约克西莫维奇" },
  { pick: 4, en: "Bruce Branch", cn: "布鲁斯-布兰奇" },
  { pick: 5, en: "Caleb Holt", cn: "卡莱布-霍尔特" },
  { pick: 6, en: "Braylon Mullins", cn: "布雷隆-穆林斯" },
  { pick: 7, en: "Thomas Haugh", cn: "托马斯-霍" },
  { pick: 8, en: "Luigi Suigo", cn: "路易吉-苏伊戈" },
  { pick: 9, en: "Hugo Yimga Moukouri", cn: "雨果-伊姆加-穆库里" },
  { pick: 10, en: "Cameron Williams", cn: "卡梅伦-威廉姆斯" },
  { pick: 11, en: "Alijah Arenas", cn: "阿利贾-阿雷纳斯" },
  { pick: 12, en: "Motiejus Krivas", cn: "莫蒂耶乌斯-克里瓦斯" },
  { pick: 13, en: "Sayon Keita", cn: "萨永-凯塔" },
  { pick: 14, en: "Cameron Houindo", cn: "卡梅伦-乌因多" },
  { pick: 15, en: "Abdou Toure", cn: "阿卜杜-图雷" },
  { pick: 16, en: "Christian Collins", cn: "克里斯蒂安-科林斯" },
  { pick: 17, en: "Dylan Mingo", cn: "迪伦-明戈" },
  { pick: 18, en: "Cheickh Niang", cn: "谢赫-尼昂" },
  { pick: 19, en: "Amari Allen", cn: "阿马里-艾伦" },
  { pick: 20, en: "Malachi Moreno", cn: "玛拉基-莫雷诺" },
  { pick: 21, en: "Rueben Chinyelu", cn: "鲁本-奇涅卢" },
  { pick: 22, en: "Pavle Backo", cn: "帕夫莱-巴科" },
  { pick: 23, en: "Anthony Thompson", cn: "安东尼-汤普森" },
  { pick: 24, en: "Tounde Yessoufou", cn: "通德-耶苏富" },
  { pick: 25, en: "Dame Sarr", cn: "达梅-萨尔" },
  { pick: 26, en: "Moustapha Thiam", cn: "穆斯塔法-蒂亚姆" },
  { pick: 27, en: "Baba Oladotun", cn: "巴巴-奥拉多顿" },
  { pick: 28, en: "Mor Massamba Diop", cn: "莫尔-马桑巴-迪奥普" },
  { pick: 29, en: "Trey McKenney", cn: "特雷-麦肯尼" },
  { pick: 30, en: "Shelton Henderson", cn: "谢尔顿-亨德森" },
  { pick: 31, en: "Klark Riethauser", cn: "克拉克-里特豪泽" },
  { pick: 32, en: "Paul Mbiya", cn: "保罗-姆比亚" },
  { pick: 33, en: "Quentin Coleman", cn: "昆廷-科尔曼" },
  { pick: 34, en: "Milon Momcilovic", cn: "米隆-莫姆契洛维奇" },
  { pick: 35, en: "Brandon McCoy Jr.", cn: "布兰登-麦科伊二世" },
  { pick: 36, en: "Arafan Diane", cn: "阿拉凡-迪亚内" },
  { pick: 37, en: "David Mirkovic", cn: "大卫-米尔科维奇" },
  { pick: 38, en: "Matas Vokietaitis", cn: "马塔斯-沃基耶塔蒂斯" },
  { pick: 39, en: "Neoklis Avdalas", cn: "内奥克利斯-阿夫达拉斯" },
  { pick: 40, en: "Ivan Kharchenkov", cn: "伊万-哈尔琴科夫" },
  { pick: 41, en: "Alex Condon", cn: "亚历克斯-康登" },
  { pick: 42, en: "Miikka Muurinen", cn: "米卡-穆里宁" },
  { pick: 43, en: "Daniel Jacobsen", cn: "丹尼尔-雅各布森" },
  { pick: 44, en: "Billy Richmond", cn: "比利-里士满" },
  { pick: 45, en: "Matt Able", cn: "马特-阿布尔" },
  { pick: 46, en: "Coen Carr", cn: "科恩-卡尔" },
  { pick: 47, en: "John Blackwell", cn: "约翰-布莱克威尔" },
  { pick: 48, en: "Adam Atamna", cn: "亚当-阿塔姆纳" },
  { pick: 49, en: "Andrej Stojakovic", cn: "安德烈-斯托亚科维奇" },
  { pick: 50, en: "Paul McNeil Jr.", cn: "保罗-麦克尼尔二世" },
  { pick: 51, en: "Jacob Cofie", cn: "雅各布-科菲" },
  { pick: 52, en: "Tyler Tanner", cn: "泰勒-坦纳" },
  { pick: 53, en: "Juke Harris", cn: "朱克-哈里斯" },
  { pick: 54, en: "Flory Bidunga", cn: "弗洛里-比东加" },
  { pick: 55, en: "Cayden Boozer", cn: "凯登-布泽尔" },
  { pick: 56, en: "Matthys Mahop", cn: "马蒂斯-马霍普" },
  { pick: 57, en: "Oscar Wembanyama", cn: "奥斯卡-文班亚马" },
  { pick: 58, en: "JJ Andrews", cn: "J.J.-安德鲁斯" },
  { pick: 59, en: "Tomislav Ivisic", cn: "托米斯拉夫-伊维西奇" },
  { pick: 60, en: "Patrick Ngongba II", cn: "帕特里克-恩贡巴二世" },
  { pick: 61, en: "JT Toppin", cn: "J.T.-托平" },
  { pick: 62, en: "Alex Wilkins", cn: "亚历克斯-威尔金斯" },
  { pick: 63, en: "Pryce Sandfort", cn: "普赖斯-桑德福特" },
  { pick: 64, en: "Bryson Tiller", cn: "布莱森-蒂勒" },
  { pick: 65, en: "Anton Bonke", cn: "安东-邦克" },
  { pick: 66, en: "Jeremy Fears Jr.", cn: "杰里米-菲尔斯二世" },
  { pick: 67, en: "Michael Ruzic", cn: "迈克尔-鲁日奇" },
  { pick: 68, en: "Lucas Morillo", cn: "卢卡斯-莫里略" },
  { pick: 69, en: "Johann Grunloh", cn: "约翰-格伦洛" },
  { pick: 70, en: "Dash Daniels", cn: "达什-丹尼尔斯" },
  { pick: 71, en: "Solo Ball", cn: "索洛-鲍尔" },
  { pick: 72, en: "Omer Mayer", cn: "奥梅尔-迈耶" },
  { pick: 73, en: "Collin Chandler", cn: "科林-钱德勒" },
  { pick: 74, en: "Ian Jackson", cn: "伊恩-杰克逊" },
  { pick: 75, en: "Thijs De Ridder", cn: "泰斯-德里德尔" },
  { pick: 76, en: "Eric Reibe", cn: "埃里克-赖贝" },
  { pick: 77, en: "Nikolas Khamenia", cn: "尼古拉斯-哈梅尼亚" },
  { pick: 78, en: "Mario Saint-Supery", cn: "马里奥-圣叙佩里" },
  { pick: 79, en: "Jalen Haralson", cn: "杰伦-哈拉尔森" },
  { pick: 80, en: "Tay Kinney", cn: "泰-金尼" },
  { pick: 81, en: "Kanon Catchings", cn: "卡农-卡钦斯" },
  { pick: 82, en: "Silas Demary Jr.", cn: "赛拉斯-德马利二世" },
  { pick: 83, en: "Ognjen Srzentic", cn: "奥格年-斯尔珍蒂奇" },
  { pick: 84, en: "PJ Haggerty", cn: "P.J.-哈格蒂" },
  { pick: 85, en: "Amaël L'Etang", cn: "阿马埃尔-莱唐" },
  { pick: 86, en: "Braden Huff", cn: "布雷登-赫夫" },
  { pick: 87, en: "Nolan Winter", cn: "诺兰-温特" },
  { pick: 88, en: "Somto Cyril", cn: "索姆托-西里尔" },
  { pick: 89, en: "Elliott Cadeau", cn: "埃利奥特-卡多" },
  { pick: 90, en: "Kiyan Anthony", cn: "基扬-安东尼" },
  { pick: 91, en: "Bassala Bagayoka", cn: "巴萨拉-巴加约卡" },
  { pick: 92, en: "Mouhamed Faye", cn: "穆罕默德-法耶" },
  { pick: 93, en: "Robert Wright III", cn: "罗伯特-赖特三世" },
  { pick: 94, en: "Isiah Harwell", cn: "以赛亚-哈威尔" },
  { pick: 95, en: "Sadiq White", cn: "萨迪克-怀特" },
  { pick: 96, en: "London Jemison", cn: "伦敦-杰米森" },
  { pick: 97, en: "Dwayne Aristode", cn: "德韦恩-阿里斯托德" },
  { pick: 98, en: "Tahaad Pettiford", cn: "塔哈德-佩蒂福德" },
  { pick: 99, en: "Joseph Tugler", cn: "约瑟夫-塔格勒" },
  { pick: 100, en: "Jackson McAndrew", cn: "杰克逊-麦克安德鲁" },
];

var STAR_ROOKIES = [
  { en: "Jordan Smith Jr.", cn: "乔丹-史密斯二世", pick: 1, ovr: 85 },
  { en: "Tyran Stokes", cn: "泰兰-斯托克斯", pick: 2, ovr: 85 },
  { en: "Stefan Joksimovic", cn: "斯特凡-约克西莫维奇", pick: 3, ovr: 85 },
  { en: "Joaquim Boumtje Boumtje", cn: "若阿金-布姆杰-布姆杰", pick: 1, ovr: 85 },
  { en: "Nikola Kusturica", cn: "尼古拉-库斯图里卡", pick: 2, ovr: 85 },
  { en: "Marcus Spears Jr.", cn: "马库斯-斯皮尔斯二世", pick: 3, ovr: 85 },
];

var _starRookieQueue = STAR_ROOKIES.slice();
var _usedRookieCandidateNames = {};
var _rngState = null;
var _rookieNameSeq = 0;
var _starRookieKeys = {};
var _rookiePortraitQueue = [];

function rngReset() {
  var seed = 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues && typeof Uint32Array !== 'undefined') {
    var a = new Uint32Array(1);
    crypto.getRandomValues(a);
    seed = a[0];
  } else {
    seed = (Date.now() & 0xffffffff) >>> 0;
  }
  _rngState = { s: seed, c: 0 };
}

function rngNext() {
  if (!_rngState) rngReset();
  var s = (_rngState.s + 0x6D2B79F5) >>> 0;
  var t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  _rngState.s = s;
  _rngState.c++;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function nextGeneratedRookiePortrait() {
  if (_rookiePortraitQueue.length === 0) {
    for (var i = 1; i <= 100; i++) _rookiePortraitQueue.push(i);
    for (var j = _rookiePortraitQueue.length - 1; j > 0; j--) {
      var swapIndex = Math.floor(rngNext() * (j + 1));
      var temp = _rookiePortraitQueue[j];
      _rookiePortraitQueue[j] = _rookiePortraitQueue[swapIndex];
      _rookiePortraitQueue[swapIndex] = temp;
    }
  }
  var portraitId = _rookiePortraitQueue.pop();
  return 'assets/images/Player/generated-rookies/generated-rookie-' + String(portraitId).padStart(3, '0') + '.png';
}

Math.random = rngNext;
STAR_ROOKIES.forEach(function(s) { _starRookieKeys[s.en] = true; });
var ROOKIE_CANDIDATES = DRAFT_CLASS_2027
  .concat(ROOKIE_NAMES.map(function(x, i) { return { en: x.en, cn: x.cn, pick: i + 1 }; }))
  .filter(function(x) { return !_starRookieKeys[x.en]; });

function generateRookie() {
  var allPos = ['PG','SG','SF','PF','C'];
  var pos = allPos[Math.floor(rngNext() * allPos.length)];
  var available = ROOKIE_CANDIDATES.filter(function(x) { return !_usedRookieCandidateNames[x.en]; });
  if (available.length === 0) available = ROOKIE_CANDIDATES;
  var pick = _starRookieQueue.length > 0
    ? _starRookieQueue.shift()
    : available[Math.floor(rngNext() * available.length)];
  if (pick && pick.en) _usedRookieCandidateNames[pick.en] = true;
  var ovr = pick.ovr || draftOvrByPick(pick.pick || 99); // 六位明星新秀先被抽出且 85 总评，其余按顺位分层
  var p = {
    name: 'Rookie_' + (++_rookieNameSeq),
    nameEN: pick.en,
    cname: pick.cn,
    pos: pos, height: '6\'7"', type: '新秀', ovr: ovr,
    _age: 19 + Math.floor(rngNext() * 3),
    _enterYear: 2026 + ((STATE.career && STATE.career.seasonCount) || 0),
    photoLocal: nextGeneratedRookiePortrait(),
    photoStatus: 'cached',
    photoSource: 'generated-rookie-pool',
  };
  var attrKeys = SIM_CONFIG.ATTR_LIST || ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU'];
  attrKeys.forEach(function(k) { p[k] = Math.max(25, Math.min(99, ovr + Math.floor(rngNext() * 16) - 8)); });
  return p;
}

// ==================== 启动 ====================
window.__PP_bootStart = function () {
  if (window.__PP_booted) return;
  window.__PP_booted = true;
  renderModeSelect();
  renderPositionSelect();
  initGame();
};
