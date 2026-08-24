/* ============================================================
   BuildPlayer — 模块化成就系统 (Hot-Pluggable)
   ============================================================
   设计思路：
   - 通过 ACHIEVEMENT_FEATURES 开关控制各模块启用/禁用
   - 所有 CSS 在初始化时注入（移除 script 标签即完全卸载）
   - 通过 window.CONQUEST_API 向主游戏暴露接口
   - 目前仅实现「征服联盟 - 替30队夺冠」模块
   ============================================================ */

// ============================================================
// ① 功能开关 —— 设为 false 即可禁用对应模块
// ============================================================
const ACHIEVEMENT_FEATURES = {
  conquest: true,   // 🏆 征服联盟 — 带领30支不同球队夺冠
  // build: false,  // 🔓 建球员成就（未来上线）
  // ovr: false,    // ⭐ 总评成就（未来上线）
  // game: false,   // 🎮 比赛成就（未来上线）
  // season: false, // 🏅 赛季成就（未来上线）
};

// 没有启用任何模块 → 直接退出
if (!Object.values(ACHIEVEMENT_FEATURES).some(v => v)) {
  console.log('🏆 成就系统: 所有模块已禁用，跳过加载');
} else {

// ============================================================
// ② 东西部 + 6 分区数据定义
// ============================================================
const CONQUEST_CONFERENCES = {
  East: {
    name: '东部联盟',
    icon: '🏀',
    divisions: [
      { name: '大西洋组', icon: '🗽', teams: ['BOS','NYK','PHI','TOR','BKN'] },
      { name: '中央组',   icon: '🏭', teams: ['CHI','CLE','DET','IND','MIL'] },
      { name: '东南组',   icon: '🌴', teams: ['ATL','CHA','MIA','ORL','WAS'] },
    ],
  },
  West: {
    name: '西部联盟',
    icon: '🏀',
    divisions: [
      { name: '西北组',   icon: '🌲', teams: ['DEN','MIN','OKC','POR','UTA'] },
      { name: '太平洋组', icon: '🌊', teams: ['GSW','LAL','LAC','PHX','SAC'] },
      { name: '西南组',   icon: '🤠', teams: ['DAL','HOU','MEM','NOP','SAS'] },
    ],
  },
};

/** 获取球队所属联盟 */
function getTeamConference(team) {
  for (const confKey in CONQUEST_CONFERENCES) {
    const conf = CONQUEST_CONFERENCES[confKey];
    for (const div of conf.divisions) {
      if (div.teams.includes(team)) return confKey;
    }
  }
  return null;
}

/** 获取球队所属分区 */
function getTeamDivision(team) {
  for (const confKey in CONQUEST_CONFERENCES) {
    const conf = CONQUEST_CONFERENCES[confKey];
    for (const div of conf.divisions) {
      if (div.teams.includes(team)) return div.name;
    }
  }
  return null;
}

/** 获取按分区顺序排列的 30 队列表（替代字母排序） */
function getSortedTeamsByDivision() {
  const result = [];
  for (const confKey in CONQUEST_CONFERENCES) {
    const conf = CONQUEST_CONFERENCES[confKey];
    for (const div of conf.divisions) {
      result.push(...div.teams);
    }
  }
  return result;
}

// ============================================================
// ③ 数据持久化层（带版本迁移 + GameID 关联）
// ============================================================
const STORAGE_KEY = 'achievements';
const STORAGE_VERSION = '1.1';  // 递增此版本号以触发向下迁移

let _cache = null;

/** 默认数据结构（新用户首次写入时使用） */
function getDefaultData() {
  return {
    meta: {
      version: STORAGE_VERSION,
      updatedAt: null,
    },
    championTeams: [],            // ['LAL', 'BOS', ...] 已夺冠球队代码列表
    championships: [],             // 每次夺冠的详细记录
  };
}

/**
 * 读取数据
 * 优先内存缓存，其次 ColorboxAI.storage
 */
function loadData(cb) {
  if (_cache) { cb(_cache); return; }
  if (typeof ColorboxAI !== 'undefined' && ColorboxAI.storage) {
    ColorboxAI.storage.getValue(STORAGE_KEY).then(function(raw) {
      var data = safeParse(raw);
      data = migrateData(data);
      _cache = data;
      cb(data);
    }).catch(function() {
      _cache = getDefaultData();
      cb(_cache);
    });
  } else {
    _cache = getDefaultData();
    cb(_cache);
  }
}

/**
 * 写入数据
 * 自动更新 meta.version + meta.updatedAt
 */
function saveData(data, cb) {
  data.meta = data.meta || {};
  data.meta.version = STORAGE_VERSION;
  data.meta.updatedAt = Date.now();
  _cache = data;
  if (typeof ColorboxAI !== 'undefined' && ColorboxAI.storage) {
    ColorboxAI.storage.setValue({ [STORAGE_KEY]: data }).then(function() {
      if (cb) cb();
    }).catch(function() {
      if (cb) cb();
    });
  } else {
    if (cb) cb();
  }
}

/**
 * 安全解析原始数据
 * 兼容：null / 对象 / JSON 字符串 / 旧版无 meta 结构
 */
function safeParse(raw) {
  if (!raw) return getDefaultData();
  var data;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    data = raw;
  } else {
    try { data = JSON.parse(raw); } catch(e) { return getDefaultData(); }
  }
  // 确保必填字段存在
  if (!data.championTeams) data.championTeams = [];
  if (!data.championships) data.championships = [];
  if (!data.meta) data.meta = {};
  return data;
}

/**
 * 版本迁移：从旧版结构平移到新版
 * 如需新增字段或变更结构，在这里追加迁移分支
 */
function migrateData(data) {
  var v = data.meta && data.meta.version;
  if (v === STORAGE_VERSION) return data; // 已是最新

  // v1.0 → v1.1: 添加 meta 字段
  if (!v || v === '1.0') {
    if (!data.meta) data.meta = {};
    // v1.0 的 championships 可能没有 gameId 字段，这是可选的，不阻塞
    data.meta.migratedFrom = v || 'unknown';
  }

  // 后续版本迁移在此追加 else if 链
  // if (v === '1.1') { ... } → v1.2

  data.meta.version = STORAGE_VERSION;
  return data;
}

// ============================================================
// ④ 征服联盟模块
// ============================================================
const CONQUEST = {
  /** 检测当前是否新夺冠，是则记录 */
  check: function() {
    // 依赖主游戏的 STATE
    if (typeof STATE === 'undefined') return;
    if (!STATE.season || !STATE.season.isChampion) return;
    if (!STATE.careerTeam) return;

    var team = STATE.careerTeam;
    loadData(function(data) {
      var po = STATE.season.playoffStats || {};
      var gp = po.games || 1;
      var ps = STATE.season.playerStats || {};
      var pg = ps.games || 1;
      
      // ★ championships 永远追加（记录每一次夺冠详情）
      var isFirst = data.championTeams.indexOf(team) === -1;
      if (isFirst) data.championTeams.push(team);

      function calcAvg(src, field, games) {
        return Math.round((src[field] || 0) / games * 10) / 10;
      }
      function calcPct(src, made, att) {
        var m = src[made] || 0, a = src[att] || 0;
        return a > 0 ? Math.round(m / a * 1000) / 10 : 0;
      }

      var attrsCopy = {};
      if (STATE.attrs) {
        for (var k in STATE.attrs) {
          if (STATE.attrs.hasOwnProperty(k)) attrsCopy[k] = STATE.attrs[k];
        }
      }

      data.championships.push({
        gameId: STATE.gameId || null,
        team: team,
        wonAt: Date.now(),
        ovr: STATE.finalOVR || 0,
        position: STATE.position || null,
        record: (STATE.season.wins || 0) + '-' + (STATE.season.losses || 0),
        archetype: STATE.finalArchetype || null,
        attrs: attrsCopy,
        avgStats: {
          pts: calcAvg(ps, 'pts', pg),
          reb: calcAvg(ps, 'reb', pg),
          ast: calcAvg(ps, 'ast', pg),
          stl: calcAvg(ps, 'stl', pg),
          blk: calcAvg(ps, 'blk', pg),
          tov: calcAvg(ps, 'tov', pg),
          fgm: calcAvg(ps, 'fgm', pg),
          fga: calcAvg(ps, 'fga', pg),
          threeM: calcAvg(ps, 'threeM', pg),
          threeA: calcAvg(ps, 'threeA', pg),
          ftm: calcAvg(ps, 'ftm', pg),
          fta: calcAvg(ps, 'fta', pg),
        },
        playoffAvg: {
          pts: calcAvg(po, 'pts', gp),
          reb: calcAvg(po, 'reb', gp),
          ast: calcAvg(po, 'ast', gp),
          stl: calcAvg(po, 'stl', gp),
          blk: calcAvg(po, 'blk', gp),
          tov: calcAvg(po, 'tov', gp),
          fgm: calcAvg(po, 'fgm', gp),
          fga: calcAvg(po, 'fga', gp),
          threeM: calcAvg(po, 'threeM', gp),
          threeA: calcAvg(po, 'threeA', gp),
          ftm: calcAvg(po, 'ftm', gp),
          fta: calcAvg(po, 'fta', gp),
        },
      });

      saveData(data, function() {
        var total = data.championTeams.length;
        var cn = getTeamCN(team);
        if (isFirst) {
          showToast('🏆 首次带领 ' + cn + ' 夺冠！(' + total + '/30)');
          // 里程碑检测
          var milestones = {1:'征途开始',5:'联盟震动',10:'势力扩张',15:'半壁江山',20:'所向披靡',25:'仅剩5队',30:'联盟征服者！'};
          if (milestones[total]) {
            setTimeout(function() {
              var msg = '🎉 ' + milestones[total];
              if (total === 30) msg += ' 🏆🏆🏆';
              showToast(msg);
            }, 1200);
          }
        } else {
          showToast('🏆 ' + cn + ' 再夺冠！(第 ' + data.championTeams.length + ' 队)');
        }
      });
    });
  },

  /** 打开征服联盟荣誉墙 */
  show: function() {
    if (typeof showScreen === 'function') {
      showScreen('screen-achievements');
    }
    renderConquestWall();
  },
};

/** 获取球队中文名 */
function getTeamCN(team) {
  if (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.TEAM_NAMES && SIM_CONFIG.TEAM_NAMES[team]) {
    return SIM_CONFIG.TEAM_NAMES[team];
  }
  return team;
}

/** 获取球队 logo HTML */
function getTeamLogoHTML(team, size) {
  size = size || 28;
  if (typeof TEAM_LOGOS !== 'undefined' && TEAM_LOGOS[team]) {
    return '<img class="cq-logo" src="' + TEAM_LOGOS[team] + '" style="width:' + size + 'px;height:' + size + 'px;" alt="' + team + '">';
  }
  return '<span style="width:' + size + 'px;height:' + size + 'px;display:inline-block;border-radius:4px;background:var(--border);"></span>';
}

// ============================================================
// ⑤ UI 渲染
// ============================================================

/** 渲染征服联盟荣誉墙 */
function renderConquestWall() {
  loadData(function(data) {
    var championTeams = data.championTeams || [];
    var total = championTeams.length;
    var container = document.getElementById('ach-wall-content');
    if (!container) return;

    var teamChampsMap = {};
    (data.championships || []).forEach(function(c) {
      if (!teamChampsMap[c.team]) teamChampsMap[c.team] = [];
      teamChampsMap[c.team].push(c);
    });

    var pct = Math.round(total / 30 * 100);
    var html = '';
    function ad(i) { return (i * 0.1).toFixed(2) + 's'; }

    // ── 顶部王冠 ──
    html += '<div class="cq-hero" style="animation-delay:' + ad(0) + '">';
    html += '  <div class="cq-hero-crown">👑</div>';
    html += '  <div class="cq-hero-title">征服联盟</div>';
    html += '  <div class="cq-hero-sub">Conquer the League</div>';
    html += '</div>';

    // ── 进度勋章区 ──
    html += '<div class="cq-trophy-case" style="animation-delay:' + ad(1) + '">';
    html += '  <div class="cq-trophy-stat">';
    html += '    <span class="cq-trophy-num">' + total + '</span>';
    html += '    <span class="cq-trophy-lbl">已征服</span>';
    html += '  </div>';
    html += '  <div class="cq-trophy-divider">✦</div>';
    html += '  <div class="cq-trophy-stat">';
    html += '    <span class="cq-trophy-num">30</span>';
    html += '    <span class="cq-trophy-lbl">总目标</span>';
    html += '  </div>';
    html += '  <div class="cq-trophy-divider">✦</div>';
    html += '  <div class="cq-trophy-stat">';
    html += '    <span class="cq-trophy-num">' + (30 - total) + '</span>';
    html += '    <span class="cq-trophy-lbl">剩余</span>';
    html += '  </div>';
    html += '</div>';

    // ── 进度条 ──
    html += '<div class="cq-progress-section" style="animation-delay:' + ad(2) + '">';
    html += '  <div class="cq-progress-track">';
    html += '    <div class="cq-progress-fill" style="width:' + pct + '%"></div>';
    html += '    <div class="cq-progress-marker" style="left:' + pct + '%">' + pct + '%</div>';
    html += '  </div>';
    html += '</div>';

    // ── 联盟面板 ──
    var confIdx = 0;
    for (var confKey in CONQUEST_CONFERENCES) {
      var conf = CONQUEST_CONFERENCES[confKey];
      var confTeams = [];
      var confWon = 0;
      conf.divisions.forEach(function(d) {
        d.teams.forEach(function(t) {
          confTeams.push(t);
          if (championTeams.indexOf(t) !== -1) confWon++;
        });
      });

      html += '<div class="cq-conf-panel" style="animation-delay:' + ad(confIdx + 3) + '">';
      html += '  <div class="cq-conf-ribbon">';
      html += '    <span class="cq-conf-name">' + conf.name + '</span>';
      html += '    <span class="cq-conf-progress">' + confWon + '/' + confTeams.length + '</span>';
      html += '  </div>';
      html += '  <div class="cq-conf-teams-wrap">';
      html += '    <div class="cq-div-teams">';

      for (var t = 0; t < confTeams.length; t++) {
        var team = confTeams[t];
        var hasWon = championTeams.indexOf(team) !== -1;
        var champs = teamChampsMap[team];
        var teamCN = getTeamCN(team);

        html += '    <div class="cq-tile' + (hasWon ? ' cq-tile-won' : ' cq-tile-empty') + '"';
        if (hasWon && champs) {
          html += ' onclick="showConquestDetail(\'' + team + '\')" title="点击查看详情"';
        }
        html += '>';
        html += '      <div class="cq-tile-bg"></div>';
        html += '      <div class="cq-tile-logo">' + getTeamLogoHTML(team, hasWon ? 34 : 24) + '</div>';
        html += '      <div class="cq-tile-code">' + team + '</div>';
        if (hasWon) {
          html += '      <div class="cq-tile-name">' + teamCN + '</div>';
        }
        html += '    </div>';
      }

      html += '    </div>'; // cq-div-teams
      html += '  </div>'; // cq-conf-teams-wrap
      html += '</div>'; // cq-conf-panel
      confIdx++;
    }

    // ── 底部 ──
    html += '<div class="cq-footer" style="animation-delay:' + ad(5) + '">';
    html += '  <div class="cq-footer-row">';
    html += '    <button class="cq-back-btn" onclick="closeAchievements()"><span class="cq-back-arrow">◀</span> 返回</button>';
    html += '  </div>';
    html += '</div>';

    container.innerHTML = html;
  });
}

/** 展示某队的夺冠详情 — 列表 → 点击展开 */
function showConquestDetail(teamCode) {
  loadData(function(data) {
    var champs = (data.championships || []).filter(function(c) { return c.team === teamCode; });
    if (champs.length === 0) return;

    var container = document.getElementById('ach-wall-content');
    if (!container) return;

    var cn = getTeamCN(teamCode);
    var logoHtml = getTeamLogoHTML(teamCode, 40);
    var html = '';

    // 返回
    html += '<div class="cq-detail-back" style="animation-delay:0s">';
    html += '  <button class="cq-back-btn" onclick="renderConquestWall()"><span class="cq-back-arrow">◀</span> 荣誉墙</button>';
    html += '</div>';

    // 球队头部
    html += '<div class="cq-list-header" style="animation-delay:0.05s">';
    html += '  <div class="cq-list-header-logo">' + logoHtml + '</div>';
    html += '  <div class="cq-list-header-info">';
    html += '    <div class="cq-list-header-name">' + cn + '</div>';
    html += '    <div class="cq-list-header-sub">' + teamCode + ' · 共 ' + champs.length + ' 次夺冠</div>';
    html += '  </div>';
    html += '</div>';

    // 列表
    champs.forEach(function(c, i) {
      var dateStr = new Date(c.wonAt).toLocaleDateString();
      var ovrGrade = getOvrGrade ? getOvrGrade(c.ovr) : '';

      html += '<div class="cq-list-item" style="animation-delay:' + (0.1 + i * 0.06) + 's" onclick="showConquestDetailExpanded(\'' + teamCode + '\', ' + i + ')">';
      html += '  <div class="cq-list-item-badge">第' + (i + 1) + '冠</div>';
      html += '  <div class="cq-list-item-main">';
      html += '    <div class="cq-list-item-row">';
      html += '      <span class="cq-li-ovr">OVR ' + (c.ovr || '?') + '</span>';
      if (c.position) html += '      <span class="cq-li-pos">' + c.position + '</span>';
      html += '      <span class="cq-li-rec">' + (c.record || '?') + '</span>';
      html += '    </div>';
      html += '    <div class="cq-list-item-row cq-li-sub">';
      html += '      <span>📊 ' + c.avgStats.pts + '分 ' + c.avgStats.reb + '板 ' + c.avgStats.ast + '助</span>';
      html += '      <span class="cq-li-date">' + dateStr + '</span>';
      html += '    </div>';
      html += '  </div>';
      html += '  <div class="cq-list-item-arrow">›</div>';
      html += '</div>';
    });

    container.innerHTML = html;
  });
}

/** 展开某次夺冠的完整详情 — 与赛季结果页风格完全一致 */
function showConquestDetailExpanded(teamCode, champIdx) {
  loadData(function(data) {
    var champs = (data.championships || []).filter(function(c) { return c.team === teamCode; });
    var c = champs[champIdx];
    if (!c) return;

    var container = document.getElementById('ach-wall-content');
    if (!container) return;

    var cn = getTeamCN(teamCode);
    var posName = (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.POSITIONS) ? (SIM_CONFIG.POSITIONS[c.position] || c.position) : c.position;
    var html = '';

    // ── 返回 ──
    html += '<div class="cq-detail-back" style="animation-delay:0s">';
    html += '  <button class="cq-back-btn" onclick="showConquestDetail(\'' + teamCode + '\')"><span class="cq-back-arrow">◀</span> 回到列表</button>';
    html += '</div>';

    // ── sr-page ──
    html += '<div class="sr-page" style="padding:0;">';

    // header
    html += '  <div class="sr-header" style="animation-delay:0.05s">';
    html += '    <div class="sr-team">' + getTeamLogoHTML(teamCode, 28) + ' ' + cn + '</div>';
    html += '    <div class="sr-record">' + (c.record || '?') + '</div>';
    html += '    <div class="sr-result">第 ' + (champIdx + 1) + ' 座冠军 · ' + new Date(c.wonAt).toLocaleDateString() + '</div>';
    html += '  </div>';

    // 球员信息
    html += '  <div class="sr-section" style="animation-delay:0.1s">';
    html += '    <div class="sr-section-title">👤 球员信息</div>';
    html += '    <div class="sr-info-row"><span>位置</span><span>' + posName + '</span></div>';
    html += '    <div class="sr-info-row"><span>总评</span><span class="sr-ovr">' + (c.ovr || '?') + '</span></div>';
    if (c.archetype) {
      var archCn = (typeof NBA2K_ARCHETYPES !== 'undefined' && NBA2K_ARCHETYPES[c.archetype]) ? NBA2K_ARCHETYPES[c.archetype].cn : c.archetype;
      html += '    <div class="sr-info-row"><span>模板</span><span>' + archCn + '</span></div>';
    }
    html += '    <div class="sr-info-row"><span>球队</span><span>' + getTeamLogoHTML(teamCode, 20) + ' ' + cn + '</span></div>';
    html += '  </div>';

    // 常规赛
    html += '  <div class="sr-section" style="animation-delay:0.15s">';
    html += '    <div class="sr-section-title">📊 常规赛</div>';
    html += '    <div class="sr-stats-grid">';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.avgStats.pts || 0) + '</span><span class="sr-stat-lbl">得分</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.avgStats.reb || 0) + '</span><span class="sr-stat-lbl">篮板</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.avgStats.ast || 0) + '</span><span class="sr-stat-lbl">助攻</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.avgStats.stl || 0) + '</span><span class="sr-stat-lbl">抢断</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.avgStats.blk || 0) + '</span><span class="sr-stat-lbl">盖帽</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.avgStats.tov || 0) + '</span><span class="sr-stat-lbl">失误</span></div>';
    html += '    </div>';
    var rsPct = c.avgStats.fga > 0 ? Math.round(c.avgStats.fgm / c.avgStats.fga * 1000) / 10 : 0;
    var rs3Pct = c.avgStats.threeA > 0 ? Math.round(c.avgStats.threeM / c.avgStats.threeA * 1000) / 10 : 0;
    var rsFtPct = c.avgStats.fta > 0 ? Math.round(c.avgStats.ftm / c.avgStats.fta * 1000) / 10 : 0;
    html += '    <div class="sr-pct-line">投篮 ' + (c.avgStats.fgm || 0) + '-' + (c.avgStats.fga || 0) + ' (' + rsPct + '%) · 三分 ' + (c.avgStats.threeM || 0) + '-' + (c.avgStats.threeA || 0) + ' (' + rs3Pct + '%) · 罚球 ' + (c.avgStats.ftm || 0) + '-' + (c.avgStats.fta || 0) + ' (' + rsFtPct + '%)</div>';
    html += '  </div>';

    // 季后赛
    html += '  <div class="sr-section" style="animation-delay:0.2s">';
    html += '    <div class="sr-section-title">🔥 季后赛</div>';
    html += '    <div class="sr-stats-grid">';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.playoffAvg.pts || 0) + '</span><span class="sr-stat-lbl">得分</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.playoffAvg.reb || 0) + '</span><span class="sr-stat-lbl">篮板</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.playoffAvg.ast || 0) + '</span><span class="sr-stat-lbl">助攻</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.playoffAvg.stl || 0) + '</span><span class="sr-stat-lbl">抢断</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.playoffAvg.blk || 0) + '</span><span class="sr-stat-lbl">盖帽</span></div>';
    html += '      <div class="sr-stat"><span class="sr-stat-val">' + (c.playoffAvg.tov || 0) + '</span><span class="sr-stat-lbl">失误</span></div>';
    html += '    </div>';
    var poPct = c.playoffAvg.fga > 0 ? Math.round(c.playoffAvg.fgm / c.playoffAvg.fga * 1000) / 10 : 0;
    var po3Pct = c.playoffAvg.threeA > 0 ? Math.round(c.playoffAvg.threeM / c.playoffAvg.threeA * 1000) / 10 : 0;
    var poFtPct = c.playoffAvg.fta > 0 ? Math.round(c.playoffAvg.ftm / c.playoffAvg.fta * 1000) / 10 : 0;
    html += '    <div class="sr-pct-line">投篮 ' + (c.playoffAvg.fgm || 0) + '-' + (c.playoffAvg.fga || 0) + ' (' + poPct + '%) · 三分 ' + (c.playoffAvg.threeM || 0) + '-' + (c.playoffAvg.threeA || 0) + ' (' + po3Pct + '%)</div>';
    html += '  </div>';

    // 最终属性
    if (c.attrs && typeof ATTR_KEYS !== 'undefined') {
      html += '  <div class="sr-section" style="animation-delay:0.25s">';
      html += '    <div class="sr-section-title">🏷️ 最终属性</div>';
      html += '    <div class="mc-attrs">';
      ATTR_KEYS.forEach(function(k) {
        var val = c.attrs[k] || 50;
        var g = typeof getGrade === 'function' ? getGrade(val) : { letter: Math.round(val / 10), color: '#d4af37' };
        html += '      <div class="mc-attr"><span class="mc-alabel">' + attrCN(k) + '</span><span class="mc-aval" style="color:' + g.color + '">' + g.letter + '</span></div>';
      });
      html += '    </div>';
      html += '  </div>';
    }

    html += '</div>'; // sr-page

    container.innerHTML = html;
  });
}

/** Toast 通知 — 金牌弹出 */
function showToast(msg) {
  var existing = document.querySelector('.cq-toast');
  if (existing) {
    existing.remove();
    clearTimeout(existing._timer);
  }

  var el = document.createElement('div');
  el.className = 'cq-toast';
  el.innerHTML = msg;
  document.body.appendChild(el);

  el._timer = setTimeout(function() {
    el.classList.add('cq-toast-out');
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 400);
  }, 2800);
}

/** 关闭成就页 */
function closeAchievements() {
  if (typeof showScreen === 'function') {
    if (typeof STATE !== 'undefined' && STATE.season && STATE.season.isChampion) {
      if (typeof showSeasonResults === 'function') {
        showSeasonResults();
        return;
      }
    }
    showScreen('screen-menu');
  }
}

// ============================================================
// ⑦ 征服海报 — Canvas 渲染
// ============================================================
/** 生成征服联盟海报：我已经点亮 X/30 支球队 */
function generateConquestPoster() {
  loadData(function(data) {
    var championTeams = data.championTeams || [];
    var total = championTeams.length;
    var pct = Math.round(total / 30 * 100);

    // ── 颜色 ──
    var Cc = {
      bg: '#faf5eb', card: '#fffaf2', border: '#f0e0cc',
      text: '#2d1f0e', textDim: '#8a7a66', textMuted: '#baa992',
      gold: '#d4af37', goldLight: '#f5d060',
      green: '#2ec4b6',
      fd: '"Fredoka","Noto Sans SC",sans-serif',
      fb: '"Nunito","Noto Sans SC",sans-serif',
    };

    var W = 600;
    var PAD = 20;
    var cx = W / 2;

    // 计算高度（每个联盟 28px 标题 + 3行×48px）
    var gridH = 0;
    for (var confKey in CONQUEST_CONFERENCES) {
      gridH += 28 + 3 * 48;
    }
    var H = 40 + 44 + 32 + 20 + gridH + 30 + 20; // header + title + progress + gap + grid + footer + pad

    var canvas = document.getElementById('posterCanvas');
    if (!canvas) return;
    canvas.width = W * 2;
    canvas.height = H * 2;
    var ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // ── 背景 ──
    ctx.fillStyle = Cc.bg;
    ctx.fillRect(0, 0, W, H);

    // 噪点纹理叠加
    ctx.save();
    ctx.globalAlpha = 0.03;
    for (var i = 0; i < 200; i++) {
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    ctx.restore();

    // ── Header: 👑 征服联盟 ──
    var y = 24;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '32px ' + Cc.fd;
    ctx.fillStyle = Cc.gold;
    ctx.fillText('👑', cx, y);
    y += 40;

    // 渐变金字标题
    var grad = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0);
    grad.addColorStop(0, Cc.gold);
    grad.addColorStop(0.5, Cc.goldLight);
    grad.addColorStop(1, Cc.gold);
    ctx.fillStyle = grad;
    ctx.font = '800 26px ' + Cc.fd;
    ctx.fillText('征 服 联 盟', cx, y);
    y += 30;

    ctx.fillStyle = Cc.textDim;
    ctx.font = '500 11px ' + Cc.fd;
    ctx.fillText('CONQUER THE LEAGUE', cx, y);
    y += 22;

    // ── 分隔装饰线 ──
    ctx.strokeStyle = 'rgba(212,175,55,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 80, y);
    ctx.lineTo(cx + 80, y);
    ctx.stroke();
    y += 12;

    // ── 主标题: "我已经点亮" ──
    ctx.fillStyle = Cc.text;
    ctx.font = '600 18px ' + Cc.fb;
    ctx.fillText('我已经点亮', cx, y);
    y += 28;

    // 数字部分
    ctx.fillStyle = Cc.gold;
    ctx.font = '800 38px ' + Cc.fd;
    ctx.fillText(total + ' / 30', cx, y);
    y += 34;

    ctx.fillStyle = Cc.textDim;
    ctx.font = '500 12px ' + Cc.fd;
    ctx.fillText('支 球 队', cx, y);
    y += 14;

    // ── 进度条 ──
    var barW = 360, barH = 14, barX = cx - barW / 2;
    y += 4;
    ctx.fillStyle = Cc.border;
    roundRectC(ctx, barX, y, barW, barH, 7);
    ctx.fill();
    var gradBar = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    gradBar.addColorStop(0, Cc.gold);
    gradBar.addColorStop(0.5, Cc.goldLight);
    gradBar.addColorStop(1, Cc.gold);
    ctx.fillStyle = gradBar;
    var fillW = Math.max(4, barW * total / 30);
    roundRectC(ctx, barX, y, fillW, barH, 7);
    ctx.fill();
    // 百分比文字
    ctx.fillStyle = '#fff';
    ctx.font = '700 8px ' + Cc.fd;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pct + '%', barX + fillW / 2, y + barH / 2);
    ctx.textBaseline = 'top';
    y += barH + 16;

    // ── 球队网格 ──
    var cellW = Math.floor((W - PAD * 2) / 5);
    var logoSize = 32;
    var cellPad = Math.floor((cellW - logoSize) / 2);

    for (var confKey in CONQUEST_CONFERENCES) {
      var conf = CONQUEST_CONFERENCES[confKey];

      // 收集该联盟所有球队
      var confTeams = [];
      var confWon = 0;
      conf.divisions.forEach(function(d) {
        d.teams.forEach(function(t) {
          confTeams.push(t);
          if (championTeams.indexOf(t) !== -1) confWon++;
        });
      });

      // Conf 标题带
      ctx.fillStyle = 'rgba(212,175,55,0.06)';
      roundRectC(ctx, PAD, y, W - PAD * 2, 24, 6);
      ctx.fill();
      ctx.fillStyle = Cc.text;
      ctx.font = '700 12px ' + Cc.fd;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(conf.name, PAD + 10, y + 12);

      // 右边计数
      ctx.fillStyle = Cc.gold;
      ctx.textAlign = 'right';
      ctx.font = '600 11px ' + Cc.fd;
      ctx.fillText(confWon + '/' + confTeams.length, W - PAD - 10, y + 12);
      ctx.textBaseline = 'top';
      y += 28;

      // 15 队分 3 行，每行 5 队
      for (var row = 0; row < 3; row++) {
        for (var col = 0; col < 5; col++) {
          var idx = row * 5 + col;
          if (idx >= confTeams.length) break;
          var team = confTeams[idx];
          var hasWon = championTeams.indexOf(team) !== -1;
          var tx = PAD + col * cellW + cellPad;
          var ty = y;

          if (hasWon) {
            ctx.fillStyle = 'rgba(212,175,55,0.07)';
            roundRectC(ctx, PAD + col * cellW + 2, ty - 2, cellW - 4, logoSize + 8, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(212,175,55,0.35)';
            ctx.lineWidth = 1;
            roundRectC(ctx, PAD + col * cellW + 2, ty - 2, cellW - 4, logoSize + 8, 8);
            ctx.stroke();

            ctx.fillStyle = Cc.gold;
            ctx.beginPath();
            ctx.arc(tx + logoSize / 2, ty + logoSize / 2, logoSize / 2 + 1, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏆', tx + logoSize / 2, ty + logoSize / 2);
          } else {
            ctx.strokeStyle = Cc.border;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            roundRectC(ctx, PAD + col * cellW + 2, ty - 2, cellW - 4, logoSize + 8, 8);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = hasWon ? Cc.text : Cc.textMuted;
          ctx.font = (hasWon ? '700 ' : '500 ') + '8px ' + Cc.fd;
          ctx.fillText(team, tx + logoSize / 2, ty + logoSize + 4);
        }
        y += logoSize + 16;
      }
    }

    // ── Footer ──
    y += 4;
    ctx.strokeStyle = 'rgba(212,175,55,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 100, y);
    ctx.lineTo(cx + 100, y);
    ctx.stroke();
    y += 10;

    ctx.fillStyle = Cc.textMuted;
    ctx.font = '400 10px ' + Cc.fb;
    ctx.textAlign = 'center';
    ctx.fillText('BuildPlayer · 征服联盟', cx, y);

    // ── 显示海报 ──
    var dataURL = canvas.toDataURL('image/png');
    var imgEl = document.getElementById('posterPreviewImg');
    if (imgEl) {
      imgEl.src = dataURL;
      imgEl.onload = function() {
        var overlay = document.getElementById('posterOverlay');
        if (overlay) overlay.style.display = 'flex';
      };
    }
  });
}

/** Canvas 圆角矩形辅助 */
function roundRectC(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// ⑥ 注入 CSS — Trophy Room 视觉风格
// ============================================================
(function injectCSS() {
  var styleId = 'achievements-css';
  if (document.getElementById(styleId)) return;

  var css = `
/* ============================================================
   成就系统 — Trophy Room 视觉风格
   灵感：冠军奖杯陈列室 / NBA 荣誉墙
   ============================================================ */

/* ── 根变量 ── */
.cq-trophy-case,
.cq-progress-section,
.cq-conf-panel,
.cq-tile,
.cq-toast {
  --cq-gold: #d4af37;
  --cq-gold-light: #e8c84a;
  --cq-gold-dim: rgba(212,175,55,0.12);
  --cq-gold-bg: rgba(212,175,55,0.06);
  --cq-bg-elevated: #f5eee0;
  --cq-border-gold: rgba(212,175,55,0.3);
}

/* ── Hero 头 ── */
.cq-hero{text-align:center;padding:clamp(20px,4vh,32px) 16px 8px;opacity:0;animation:cqFadeSlide .35s ease forwards}
.cq-hero-crown{font-size:clamp(36px,10vw,52px);line-height:1;margin-bottom:4px;animation:cqBounce 2s ease-in-out infinite}
.cq-hero-title{font-family:var(--font-display);font-size:clamp(24px,6.5vw,36px);font-weight:800;background:linear-gradient(135deg,#d4af37,#f5d060,#d4af37);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:4px;line-height:1.2}
.cq-hero-sub{font-family:var(--font-display);font-size:clamp(10px,2.5vw,13px);color:var(--text-muted);letter-spacing:6px;text-transform:uppercase;margin-top:4px;font-weight:500}

/* ── 进度勋章区 ── */
.cq-trophy-case{display:flex;align-items:center;justify-content:center;gap:clamp(8px,2vw,16px);padding:12px 16px;margin:0 12px;background:linear-gradient(135deg,rgba(212,175,55,0.06),rgba(212,175,55,0.02));border:1.5px solid rgba(212,175,55,0.15);border-radius:16px;opacity:0;animation:cqFadeSlide .3s ease forwards}
.cq-trophy-stat{text-align:center;min-width:48px}
.cq-trophy-num{display:block;font-family:var(--font-display);font-size:clamp(22px,6vw,30px);font-weight:800;color:#d4af37;line-height:1;letter-spacing:1px}
.cq-trophy-lbl{display:block;font-size:clamp(9px,2vw,11px);color:var(--text-dim);margin-top:2px;font-weight:600}
.cq-trophy-divider{color:rgba(212,175,55,0.3);font-size:14px;padding:0 2px}

/* ── 进度条 ── */
.cq-progress-section{padding:8px 16px 4px;opacity:0;animation:cqFadeSlide .25s ease forwards}
.cq-progress-track{position:relative;height:20px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:10px;overflow:visible;box-shadow:inset 0 1px 4px rgba(0,0,0,0.04)}
.cq-progress-fill{height:100%;background:linear-gradient(90deg,#d4af37,#f5d060,#d4af37);border-radius:10px;transition:width .8s cubic-bezier(0.34,1.56,0.64,1);position:relative;min-width:4px}
.cq-progress-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);animation:cqShimmer 2s ease-in-out infinite}
.cq-progress-marker{position:absolute;top:-22px;font-family:var(--font-display);font-size:10px;font-weight:700;color:#d4af37;transform:translateX(-50%);white-space:nowrap;transition:left .8s cubic-bezier(0.34,1.56,0.64,1)}

/* ── 联盟面板 ── */
.cq-conf-panel{margin:8px 8px 12px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:16px;overflow:hidden;opacity:0;animation:cqFadeSlide .3s ease forwards;box-shadow:0 2px 12px rgba(45,31,14,0.06)}
.cq-conf-ribbon{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:linear-gradient(135deg,#f5eee0,#f0e6d4);border-bottom:1.5px solid var(--border)}
.cq-conf-name{font-family:var(--font-display);font-size:clamp(14px,3.5vw,17px);font-weight:700;color:var(--text);letter-spacing:2px}
.cq-conf-progress{font-family:var(--font-display);font-size:13px;font-weight:700;color:#d4af37;letter-spacing:1px}

/* ── 分区（简化版：直接并列）── */
.cq-conf-teams-wrap{padding:8px 10px 12px}

/* ── 球队网格 ── */
.cq-div-teams{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}

/* ── 球队磁贴 ── */
.cq-tile{position:relative;border-radius:12px;text-align:center;cursor:default;transition:all .25s cubic-bezier(0.34,1.56,0.64,1);min-height:clamp(72px,14vw,88px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;overflow:hidden;padding:6px 2px}
.cq-tile-bg{position:absolute;inset:0;border-radius:12px;pointer-events:none;transition:opacity .3s ease}
.cq-tile-won{background:linear-gradient(145deg,rgba(212,175,55,0.07),rgba(212,175,55,0.02));border:2px solid rgba(212,175,55,0.35);cursor:pointer;box-shadow:0 2px 8px rgba(212,175,55,0.08)}
.cq-tile-won:hover{transform:translateY(-4px) scale(1.03);border-color:#d4af37;box-shadow:0 8px 24px rgba(212,175,55,0.18),0 0 0 1px rgba(212,175,55,0.2)}
.cq-tile-won:active{transform:scale(0.96)}
.cq-tile-empty{background:var(--bg);border:1.5px dashed var(--border-light);opacity:.5}
.cq-tile-empty .cq-tile-logo{opacity:.35;filter:grayscale(.7)}
.cq-tile-empty .cq-tile-code{color:var(--text-muted)}
.cq-tile-logo{line-height:0;position:relative;z-index:1;transition:transform .3s ease}
.cq-tile-won:hover .cq-tile-logo{transform:scale(1.08)}
.cq-tile-logo img{display:block;margin:0 auto;border-radius:4px;transition:all .3s ease}
.cq-tile-code{font-family:var(--font-display);font-size:clamp(9px,2.2vw,11px);font-weight:700;color:var(--text);letter-spacing:.8px;position:relative;z-index:1}
.cq-tile-name{font-size:clamp(7px,1.6vw,8px);color:#d4af37;font-weight:600;position:relative;z-index:1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.3px}
.cq-tile-lock{font-size:11px;position:relative;z-index:1;filter:grayscale(.5)}
.cq-tile-won::before{content:'';position:absolute;inset:0;border-radius:12px;background:linear-gradient(135deg,transparent 60%,rgba(212,175,55,0.06) 100%);pointer-events:none}

/* ── 底部 ── */
.cq-footer{text-align:center;padding:12px 16px 24px;opacity:0;animation:cqFadeSlide .25s ease forwards}
.cq-footer-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.cq-back-btn,.cq-share-btn{display:inline-flex;align-items:center;gap:6px;padding:12px 24px;border-radius:12px;font-family:var(--font-display);font-size:14px;font-weight:600;cursor:pointer;transition:all .2s ease;min-height:44px}
.cq-back-btn{border:2px solid var(--border);background:var(--bg-card);color:var(--text-dim);box-shadow:0 2px 0 var(--border)}
.cq-back-btn:active{transform:translateY(2px);box-shadow:0 0 0 var(--border)}
.cq-back-btn:hover{border-color:var(--orange);color:var(--orange)}
.cq-share-btn{border:none;background:linear-gradient(135deg,#d4af37,#e8c84a);color:#2a2015;box-shadow:0 3px 0 #b8922a,0 4px 12px rgba(212,175,55,0.2)}
.cq-share-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #b8922a,0 2px 6px rgba(212,175,55,0.15)}
.cq-share-btn:hover{background:linear-gradient(135deg,#e8c84a,#f5d85a)}
.cq-back-arrow{font-size:12px}

/* ── 详情页 — 列表视图 ── */
.cq-detail-back{padding:8px 4px;opacity:0;animation:cqFadeSlide .2s ease forwards}

.cq-list-header{display:flex;align-items:center;gap:12px;padding:12px 10px 8px;opacity:0;animation:cqFadeSlide .3s ease forwards}
.cq-list-header-logo{line-height:0;flex-shrink:0}
.cq-list-header-logo img{border-radius:6px}
.cq-list-header-info{flex:1;min-width:0}
.cq-list-header-name{font-family:var(--font-display);font-size:clamp(18px,5vw,22px);font-weight:700;color:var(--text);letter-spacing:1px}
.cq-list-header-sub{font-size:12px;color:var(--text-dim);margin-top:2px}

.cq-list-item{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:0 4px 6px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:12px;cursor:pointer;transition:all .15s ease;opacity:0;animation:cqFadeSlide .3s ease forwards}
.cq-list-item:active{transform:scale(0.97);border-color:var(--orange);background:var(--orange-bg)}
.cq-list-item-badge{font-family:var(--font-display);font-size:11px;font-weight:700;color:#d4af37;background:rgba(212,175,55,0.1);border:1.5px solid rgba(212,175,55,0.25);border-radius:8px;padding:4px 8px;white-space:nowrap;flex-shrink:0}
.cq-list-item-main{flex:1;min-width:0}
.cq-list-item-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cq-li-ovr{font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text)}
.cq-li-pos{font-size:11px;color:var(--text-dim);background:var(--orange-bg);padding:1px 6px;border-radius:4px;font-weight:600}
.cq-li-rec{font-size:12px;color:var(--text-dim);font-weight:600;margin-left:auto}
.cq-li-sub{font-size:11px;color:var(--text-dim);margin-top:3px}
.cq-li-date{font-size:10px;color:var(--text-muted);margin-left:auto}
.cq-list-item-arrow{font-size:18px;color:var(--text-muted);flex-shrink:0}



/* ── Toast — 金牌弹出 ── */
.cq-toast{position:fixed;top:clamp(50px,8vh,70px);left:50%;transform:translateX(-50%);z-index:500;background:linear-gradient(145deg,#3a2a1a,#2a2015);border:2px solid #d4af37;border-radius:16px;padding:14px 28px;font-family:var(--font-display);font-size:15px;font-weight:600;color:#f5e6c8;box-shadow:0 8px 40px rgba(212,175,55,0.15),0 0 0 1px rgba(212,175,55,0.05);white-space:nowrap;max-width:88vw;text-align:center;animation:cqToastIn .45s cubic-bezier(0.34,1.56,0.64,1) forwards;letter-spacing:.5px}
.cq-toast-out{animation:cqToastOut .4s ease forwards!important}

/* ── Keyframes ── */
@keyframes cqFadeSlide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes cqBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes cqShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
@keyframes cqRibbonPop{0%{transform:scale(0) rotate(-20deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes cqToastIn{0%{opacity:0;transform:translateX(-50%) translateY(-24px) scale(0.92)}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes cqToastOut{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.92)}}

/* ── 响应式 ── */
@media(max-width:440px){
  .cq-div-teams{gap:4px}
  .cq-tile{min-height:64px;border-radius:10px;padding:4px 1px}
  .cq-conf-teams-wrap{padding:4px 6px 8px}
  .cq-conf-panel{margin:6px 4px 10px;border-radius:12px}
}
@media(max-width:370px){
  .cq-tile{min-height:56px}
  .cq-tile-code{font-size:8px}
  .cq-tile-name{display:none}
}
`;
  var style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
})();

// ============================================================
// ⑦ 对外暴露接口 (通过 window.CONQUEST_API)
// ============================================================
window.CONQUEST_API = {
  /** 夺冠时调用：检测并记录 */
  recordChampionship: function() {
    CONQUEST.check();
  },
  /** 打开荣誉墙 */
  show: function() {
    CONQUEST.show();
  },
  /** 重新渲染荣誉墙 */
  render: function() {
    renderConquestWall();
  },
  /** 同步读取内存缓存（仅供测试/调试用） */
  _getCache: function() {
    return _cache;
  },
  /** 获取已夺冠球队列表 */
  getChampionTeams: function(cb) {
    loadData(function(data) {
      cb((data.championTeams || []).slice());
    });
  },
  /** 获取按分区顺序排列的球队列表（供老虎机使用） */
  getSortedTeams: function() {
    return getSortedTeamsByDivision();
  },
  /** 获取球队所属分区 */
  getTeamDivision: function(team) {
    return getTeamDivision(team);
  },
  /** 获取球队所属联盟 */
  getTeamConference: function(team) {
    return getTeamConference(team);
  },
  /** 版本信息 */
  info: {
    version: '1.0',
    features: Object.keys(ACHIEVEMENT_FEATURES).filter(function(k) { return ACHIEVEMENT_FEATURES[k]; }),
    allFeatures: Object.keys(ACHIEVEMENT_FEATURES),
  },
};

// 标记已加载
console.log('🏆 成就系统已加载, 启用模块:', Object.keys(ACHIEVEMENT_FEATURES).filter(function(k){return ACHIEVEMENT_FEATURES[k];}).join(', '));

} // end of feature check
