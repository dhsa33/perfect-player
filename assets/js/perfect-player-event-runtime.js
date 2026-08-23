var EVENT_REGISTRY = [];

function applyHooks(hookName, arg) {
  for (var i = 0; i < EVENT_REGISTRY.length; i++) {
    var e = EVENT_REGISTRY[i];
    if (e.hooks && e.hooks[hookName]) {
      arg = e.hooks[hookName](arg);
    }
  }
  return arg;
}

function showEventModal(data, callback) {
  var overlay = document.createElement('div');
  overlay.className = 'awards-overlay';
  overlay.id = 'eventOverlay';
  overlay.innerHTML =
    '<div class="awards-card" style="animation:flyInRight .45s ease">' +
      '<div class="awards-card-header" style="padding:32px 24px 24px;">' +
        '<span style="font-size:44px;display:block;margin-bottom:8px;">' + (data.emoji || '📌') + '</span>' +
        '<div class="awards-badge">' + data.title + '</div>' +
      '</div>' +
      '<div class="awards-card-body" style="padding:20px 24px 24px;">' +
        '<div style="font-size:14px;color:var(--text);line-height:1.7;margin-bottom:6px;">' + data.body.replace(/\n/g, '<br>') + '</div>' +
        (data.detail ? '<div class="awards-divider"></div><div style="font-size:13px;color:var(--text-muted);margin:6px 0 8px;">' + data.detail + '</div>' : '') +
        '<div class="awards-divider" style="margin-bottom:12px;"></div>' +
        '<button class="awards-next" id="eventCloseBtn">' + (data.btnText || '我知道了') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  document.getElementById('eventCloseBtn').onclick = function() {
    overlay.remove();
    if (callback) callback();
  };
}

function getInjuryPlaySeverity(ev) {
  var left = ev && ev.injuryGamesLeft ? ev.injuryGamesLeft : 0;
  if ((ev && ev.majorInjuryThisSeason && left >= 12) || left >= 20) return 'major';
  if (left >= 8) return 'medium';
  return 'minor';
}

function getInjuryPlayLabel(severity) {
  if (severity === 'major') return '重伤';
  if (severity === 'medium') return '明显伤病';
  return '轻伤';
}

function getInjuryPlayStatFactor(severity) {
  if (severity === 'major') return 0.66;
  if (severity === 'medium') return 0.78;
  return 0.86;
}

function getInjuryPlayWinMultiplier(severity) {
  if (severity === 'major') return 0.86;
  if (severity === 'medium') return 0.92;
  return 0.96;
}

function buildHurtAttrs(attrs, severity) {
  var factor = severity === 'major' ? 0.72 : (severity === 'medium' ? 0.82 : 0.9);
  var hurt = {};
  for (var k in attrs) {
    if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
    var v = parseInt(attrs[k]);
    hurt[k] = isNaN(v) ? attrs[k] : Math.max(35, Math.round(50 + (v - 50) * factor));
  }
  return hurt;
}

function scaleHurtStats(stats, severity) {
  var factor = getInjuryPlayStatFactor(severity);
  var minsFactor = severity === 'major' ? 0.58 : (severity === 'medium' ? 0.68 : 0.78);
  var out = {};
  for (var k in stats) out[k] = stats[k];
  ['pts','reb','ast','stl','blk','tov','fgm','fga','ftm','fta','threeM','threeA'].forEach(function(k) {
    out[k] = Math.max(0, Math.round((out[k] || 0) * factor));
  });
  out.fga = Math.max(1, out.fga || 1);
  out.fgm = Math.min(out.fgm || 0, out.fga);
  out.threeA = Math.min(out.threeA || 0, out.fga);
  out.threeM = Math.min(out.threeM || 0, out.threeA);
  out.fta = Math.max(0, out.fta || 0);
  out.ftm = Math.min(out.ftm || 0, out.fta);
  out.mins = Math.max(8, Math.round((stats.mins || 28) * minsFactor));
  out.playedThroughInjury = true;
  out.injurySeverity = severity;
  return out;
}

function maybeWorsenInjuryAfterPlaying(ev, severity) {
  if (!ev) return '';
  var risk = severity === 'major' ? 0.28 : (severity === 'medium' ? 0.18 : 0.1);
  if (Math.random() >= risk) return '';
  var extra = severity === 'major'
    ? (5 + Math.floor(Math.random() * 9))
    : (2 + Math.floor(Math.random() * 5));
  if (severity === 'major' && Math.random() < 0.08) {
    extra = Math.max(extra, getSeasonEndingInjuryGamesLeft());
    ev.majorInjuryThisSeason = true;
  }
  ev.injuryGamesLeft = Math.max(ev.injuryGamesLeft || 0, 0) + extra;
  ev.injuryReason = (ev.injuryReason || '伤病') + '（带伤出战后加重）';
  if (ev.storyTimeline) {
    ev.storyTimeline.push({ gameNum: STATE.season.games.length, title: '带伤出战后伤情加重', desc: '追加休战 ' + extra + ' 场', emoji: '🏥' });
  }
  return '伤情赛后出现反应，追加休战 ' + extra + ' 场。';
}

function isKeyInjuredRegularGame(game, gameIndex, totalGames) {
  if (!STATE.season || !STATE.careerTeam) return false;
  var ev = STATE.season.events || {};
  if ((ev.regularPlayThroughPromptCount || 0) >= 1) return false;
  var leftIncludingToday = Math.max(0, totalGames - gameIndex);
  if (leftIncludingToday > 12) return false;
  var seed = getConferenceSeed(STATE.careerTeam);
  if (seed >= 7 && seed <= 11) return true;
  if (leftIncludingToday <= 5 && seed >= 5 && seed <= 12) return true;
  return false;
}

function isKeyInjuredPlayoffGame(round, gameNum, winsA, winsB) {
  var nextGame = gameNum + 1;
  if (round === 3) return true;
  if (nextGame >= 7) return true;
  if (winsA === 3 || winsB === 3) return true;
  return nextGame >= 5;
}

function shouldOfferPlayThroughInjury(key, isRegular) {
  var ev = STATE.season && STATE.season.events;
  if (!ev || ev.injuryGamesLeft <= 0 || ev.suspensionGamesLeft > 0) return false;
  ev.playThroughPrompted = ev.playThroughPrompted || {};
  if (ev.playThroughPrompted[key]) return false;
  ev.playThroughPrompted[key] = true;
  if (isRegular) ev.regularPlayThroughPromptCount = (ev.regularPlayThroughPromptCount || 0) + 1;
  return true;
}

function showPlayThroughInjuryModal(ctx, onRest, onPlay) {
  var ev = STATE.season && STATE.season.events ? STATE.season.events : {};
  var severity = getInjuryPlaySeverity(ev);
  var label = getInjuryPlayLabel(severity);
  var statDrop = Math.round((1 - getInjuryPlayStatFactor(severity)) * 100);
  var riskText = severity === 'major' ? '恶化风险较高' : (severity === 'medium' ? '存在恶化风险' : '小概率加重');
  var overlay = document.createElement('div');
  overlay.className = 'awards-overlay';
  overlay.id = 'playThroughInjuryOverlay';
  overlay.innerHTML =
    '<div class="awards-card" style="animation:flyInRight .45s ease">' +
      '<div class="awards-card-header" style="padding:30px 24px 20px;">' +
        '<span style="font-size:42px;display:block;margin-bottom:8px;">🏥</span>' +
        '<div class="awards-badge">关键场次 · 带伤出战？</div>' +
      '</div>' +
      '<div class="awards-card-body" style="padding:18px 24px 24px;">' +
        '<div style="font-size:14px;color:var(--text);line-height:1.7;margin-bottom:10px;">' +
          (ctx && ctx.desc ? ctx.desc : '球队马上要打一场关键比赛。') +
          '<br><br>当前伤情：' + label + '，预计还需休战 ' + (ev.injuryGamesLeft || 0) + ' 场。带伤出战会让本场表现下降约 ' + statDrop + '%，并且' + riskText + '。' +
        '</div>' +
        '<div class="awards-divider" style="margin-bottom:12px;"></div>' +
        '<button class="awards-next" id="playInjuryBtn" style="margin-bottom:8px;background:var(--red);">带伤出战</button>' +
        '<button class="awards-next" id="restInjuryBtn" style="background:var(--bg-card);color:var(--text);border:1px solid var(--border);">休战养伤</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  document.getElementById('restInjuryBtn').onclick = function() {
    overlay.remove();
    if (onRest) onRest();
  };
  document.getElementById('playInjuryBtn').onclick = function() {
    overlay.remove();
    if (onPlay) onPlay(severity);
  };
}

function renderEventStatus() {
  var ev = STATE.season.events;
  if (!ev) return '';
  var parts = [];
  if (ev.suspensionGamesLeft > 0) parts.push('<span style="color:var(--red);font-weight:600;">🔇 禁赛 ' + ev.suspensionGamesLeft + ' 场</span>');
  if (ev.injuryGamesLeft > 0) parts.push('<span style="color:var(--red);font-weight:600;">🏥 伤病 ' + ev.injuryGamesLeft + ' 场</span>');
  if (parts.length === 0) return '';
  return '<div id="eventStatusBar" style="text-align:center;padding:2px 10px 4px;font-size:11px;background:var(--bg-card);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;display:flex;gap:12px;justify-content:center;">' + parts.join('') + '</div>';
}

var _lastGameCtx = null;

// ━━━ Variable resolution for events ━━━
var TEAM_NAMES_EV = {
  ATL:'老鹰', BOS:'凯尔特人', BKN:'篮网', CHA:'黄蜂', CHI:'公牛',
  CLE:'骑士', DAL:'独行侠', DEN:'掘金', DET:'活塞', GSW:'勇士',
  HOU:'火箭', IND:'步行者', LAC:'快船', LAL:'湖人', MEM:'灰熊',
  MIA:'热火', MIL:'雄鹿', MIN:'森林狼', NOP:'鹈鹕', NYK:'尼克斯',
  OKC:'雷霆', ORL:'魔术', PHI:'76人', PHX:'太阳', POR:'开拓者',
  SAC:'国王', SAS:'马刺', TOR:'猛龙', UTA:'爵士', WAS:'奇才',
};

function getTeamTopPlayer(teamAbbr) {
  var players = (typeof NBA2K_DATA !== 'undefined' && NBA2K_DATA[teamAbbr]) || 
                (typeof NBA2K_ALLTIME_DATA !== 'undefined' && NBA2K_ALLTIME_DATA[teamAbbr + '_HIST']);
  if (!players || !players.length) return null;
  var top = players[0];
  for (var i = 1; i < players.length; i++) {
    if ((players[i].ovr || 0) > (top.ovr || 0)) top = players[i];
  }
  return top;
}

function resolveEventVars(str, ctx, evData) {
  if (!str) return str;
  var teamAbbr = ctx && ctx.game && ctx.game.opponent;
  var topPlayer = teamAbbr ? getTeamTopPlayer(teamAbbr) : null;
  var playerName = topPlayer ? (topPlayer.cname || topPlayer.name) : '对手球员';
  var teamName = teamAbbr ? (TEAM_NAMES_EV[teamAbbr] || teamAbbr) : '对手球队';
  return str
    .replace(/\{对手球员\}/g, playerName)
    .replace(/\{对手球队\}/g, teamName)
    .replace(/\{队友\}/g, playerName)
    .replace(/\{n\}/g, (evData && evData._games) || '');
}

function getAgeBasedInjuryRate() {
  var age = (STATE.career && STATE.career.currentAge) ? STATE.career.currentAge : 22;
  if (age <= 25) return 0;
  if (age <= 28) return 0.4;
  if (age <= 31) return 0.8;
  if (age <= 34) return 1.4;
  if (age <= 37) return 2.2;
  if (age <= 40) return 3.2;
  return 4.5;
}

function getSeasonInjuryEventRate() {
  var ev = STATE.season && STATE.season.events;
  var bonus = ev && ev.injuryRiskBonus ? ev.injuryRiskBonus : 0;
  var rate = Math.max(0, Math.min(12, getAgeBasedInjuryRate() + bonus));
  if (typeof getStyleSkillMu === 'function') {
    var ironMu = getStyleSkillMu('iron_man');
    if (ironMu > 1) rate *= Math.max(0.55, 1 - (ironMu - 1) * 2.2);
  }
  return rate;
}

function getMajorInjuryEventRate() {
  var age = (STATE.career && STATE.career.currentAge) ? STATE.career.currentAge : 22;
  var base = 0.4;
  if (age >= 40) base = 2.2;
  else if (age >= 36) base = 1.6;
  else if (age >= 32) base = 1.1;
  else if (age >= 26) base = 0.7;
  var ev = STATE.season && STATE.season.events;
  var bonus = ev && ev.injuryRiskBonus ? ev.injuryRiskBonus : 0;
  var rate = Math.max(0.15, Math.min(3, base + bonus * 0.08));
  if (typeof getStyleSkillMu === 'function') {
    var ironMu = getStyleSkillMu('iron_man');
    if (ironMu > 1) rate *= Math.max(0.55, 1 - (ironMu - 1) * 2.2);
  }
  return rate;
}

function isInjuryEventDef(e) {
  return !!(e && e.id && e.id.indexOf('injury_') === 0);
}

function isMajorInjuryEventDef(e) {
  return !!(e && e.majorInjury);
}

function getSeasonEndingInjuryGamesLeft() {
  if (STATE.season && STATE.season.isPlayoffs) return 28;
  var schedule = STATE.season && STATE.season.schedule ? STATE.season.schedule : [];
  var remaining = 0;
  for (var i = 0; i < schedule.length; i++) {
    if (!schedule[i].simulated) remaining++;
  }
  return Math.max(1, remaining);
}

function isSuspensionEventDef(e) {
  return !!(e && e.id && e.id.indexOf('susp_') === 0);
}

function pickWeightedEvent(candidates) {
  if (!candidates || candidates.length === 0) return null;
  var totalWeight = 0;
  for (var ci = 0; ci < candidates.length; ci++) {
    totalWeight += candidates[ci].weight || 1;
  }
  var roll = Math.random() * totalWeight;
  var cum = 0;
  for (var cj = 0; cj < candidates.length; cj++) {
    cum += candidates[cj].weight || 1;
    if (roll < cum) return candidates[cj];
  }
  return candidates[candidates.length - 1];
}

function checkRandomEvents(game, result, stats) {
  if (typeof isLegendChallengeSeriesActive === 'function' && isLegendChallengeSeriesActive()) return null;
  var ev = STATE.season.events;
  if (!ev) return null;
  ev.triggeredIds = Array.isArray(ev.triggeredIds) ? ev.triggeredIds : [];
  if (ev.suspensionGamesLeft > 0 || ev.injuryGamesLeft > 0) return null;

  // 常规赛最多触发 3 个伤病/冲突事件（原 2，配合 10 场冷却保持分散）
  if (!STATE.season.isPlayoffs && ev.storyTimeline.length >= 3) return null;
  // 季后赛最多触发 2 个伤病事件
  if (STATE.season.isPlayoffs && ev.playoffEventCount >= 2) return null;

  // 冷却检查：距上次事件至少间隔 10 场
  if (ev.lastTriggerGameNum != null) {
    var gamesSince = STATE.season.games.length - ev.lastTriggerGameNum;
    if (gamesSince < 10) return null;
  }

  _lastGameCtx = { game: game, result: result, stats: stats };
  var ctx = _lastGameCtx;

  var candidates = [];
  var majorCandidates = [];
  for (var i = 0; i < EVENT_REGISTRY.length; i++) {
    var e = EVENT_REGISTRY[i];
    try {
      if (!isInjuryEventDef(e)) continue;
      if (ev.triggeredIds.indexOf(e.id) >= 0 || hasCareerEventBeenSeen(e, STATE.career)) continue;
      if (!e.condition(ctx)) continue;
      if (isMajorInjuryEventDef(e)) majorCandidates.push(e);
      else candidates.push(e);
    } catch(ex) {}
  }
  if (candidates.length === 0 && majorCandidates.length === 0) return null;

  // 伤病事件单独调控：年轻期基础为 0，随年龄增加；休赛期选项只影响这颗伤病骰子。
  var injuryRate = getSeasonInjuryEventRate();
  if (Math.random() * 100 >= injuryRate) return null;
  var canMajor = majorCandidates.length > 0 && !ev.majorInjuryThisSeason;
  var majorRate = canMajor ? getMajorInjuryEventRate() : 0;
  var picked = null;
  if (canMajor && Math.random() * 100 < majorRate) {
    picked = pickWeightedEvent(majorCandidates);
  } else {
    picked = pickWeightedEvent(candidates);
  }

  if (picked) {
      var d = picked.execute(ctx);
      if (d) {
        if (ev.triggeredIds.indexOf(picked.id) < 0) ev.triggeredIds.push(picked.id);
        markCareerEventSeen(picked, STATE.career);
        // Resolve event variables
        d.title = resolveEventVars(d.title, ctx, d);
        d.body = resolveEventVars(d.body, ctx, d);
        d.desc = resolveEventVars(d.desc, ctx, d);
        STATE.season.events.storyTimeline.push({ eventId: picked.id, gameNum: STATE.season.games.length, title: d.title, desc: d.desc, emoji: d.emoji });
        // 记录触发场次（冷却用）
        STATE.season.events.lastTriggerGameNum = STATE.season.games.length;
        // 季后赛事件计数
        if (STATE.season.isPlayoffs) STATE.season.events.playoffEventCount++;
        // 处理后果
        if (d._consequence === 'injury' && d._games) {
          STATE.season.events.injuryGamesLeft += d._games;
          if (d._majorInjury) STATE.season.events.majorInjuryThisSeason = true;
        }
        return d;
      }
  }
  return null;
}


// ━━━ 类别 1：🥊 斗殴冲突 ━━━

// ── 1. 恶意犯规爆发冲突 ──
EVENT_REGISTRY.push({
  id: 'fight_hard_foul',
  name: '恶意犯规爆发冲突',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'💢', title:'恶意犯规爆发冲突', body:'对手在一次快攻中从侧面狠狠撞向正在上篮的你，你整个人横着摔出了场外，背部重重砸在地板上。你躺在地上缓了两秒，然后爬起来直接冲向了那个球员。两人头顶头对峙，口水几乎喷到对方脸上，队友和裁判飞扑过来把你们隔开。裁判回看录像后给了对方一个一级恶意犯规，也给了你一个技术犯规。赛后联盟追加处罚，你被禁赛1场。赛后采访你说："我接受他的犯规，不接受他的态度。"', desc:'恶意犯规冲突', _consequence:'suspension', _games:1 };
  },
});







// ── 5. 板凳清空 ──
EVENT_REGISTRY.push({
  id: 'fight_bench_clearing',
  name: '板凳清空',
  weight: 10,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🌪️', title:'板凳清空', body:'一次快攻中对手从背后将你一把拉下，你的身体失控后撞翻了场边的技术台。你的队友立刻冲上去推了对方一把，对方替补席所有人站了起来冲上场。十多个人挤在中圈互相推搡，场面一度完全失控。教练们冲进球场把自家球员往回拉，安保人员组成人墙把两队隔开。混乱持续了整整五分钟。赛后联盟开出了总额超过500万美元的罚单，你被禁赛5场。', desc:'板凳清空禁赛', _consequence:'suspension', _games:5 };
  },
});







// ── 9. 累积技犯被驱逐 ──
EVENT_REGISTRY.push({
  id: 'fight_tech_escalation',
  name: '累积技犯被驱逐',
  weight: 12,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🔥', title:'累积技犯被驱逐', body:'你第一节吃到了一个技术犯规，心里一直憋着一股火。第三节你被吹了一个进攻犯规后终于爆发了——你把球狠狠砸在地板上，球弹起来飞上了观众席。裁判立刻吹了你第二个技术犯规，举起右手做出驱逐手势。你愣住了，然后开始朝裁判走去，队友赶紧抱住你。"别！别！他把你驱逐了！你再过去又要追加禁赛！"你被队友们架着走向更衣室，全场响起了震天的嘘声。赛后联盟果然追加处罚，你被禁赛多场。', desc:'技犯被驱逐', _consequence:'suspension', _games:(1 + Math.floor(Math.random() * 2)) };
  },
});





// ── 12. 和裁判争论被驱逐 ──
EVENT_REGISTRY.push({
  id: 'fight_ref_dispute',
  name: '和裁判争论被驱逐',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👨‍⚖️', title:'和裁判争论被驱逐', body:'裁判在比赛最后时刻吹了你一次进攻犯规，这直接葬送了你们反超的机会。你疯了，你追着裁判从后场一路说到前场。"那个球我根本没有动！是他自己倒的！"裁判没有理你，但你一直在说。裁判终于忍无可忍，转身给了你一个技术犯规。你的队友赶紧把你拉开，但你还在回头喊："你今晚的吹罚简直是犯罪！"赛后联盟对你处以25,000美元罚款，你认了。', desc:'和裁判争论' };
  },
});

// ── 13. 报复性恶犯 ──
EVENT_REGISTRY.push({
  id: 'fight_dirty_play',
  name: '报复性恶犯',
  weight: 12,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🪚', title:'报复性恶犯', body:'你的队友在一次上篮中被对手从空中硬生生拉了下来，摔在地上半天没起来。裁判只吹了一个普通犯规。你火了。下一回合防守中，你直接一肩膀撞向了持球的对方球员——动作不大，但足够狠。他摔倒在地，球丢了。裁判给了你一个一级恶意犯规。你走下球场时，你的队友拍了拍你的肩膀："兄弟，够意思。"你回头看了一眼对面愤怒的教练席，觉得值了。赛后联盟回看录像，认为动作具有明显报复性，对你追加禁赛。', desc:'报复恶犯', _consequence:'suspension', _games:(1 + Math.floor(Math.random() * 2)) };
  },
});





// ━━━ 类别 2：💬 垃圾话/心理战 ━━━



// ── 17. 罚球线念咒语 ──
EVENT_REGISTRY.push({
  id: 'trash_free_throw',
  name: '罚球线念咒语',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🗣️', title:'罚球线念咒语', body:'对方的罚球手站在线上，你站在罚球区旁边用刚好能让他听到的声音碎碎念："你妈妈在观众席看着你呢——她希望你罚进——但我知道你罚不进——你每次都罚不进——"他用一个深呼吸打断了你的节奏，球在篮筐上弹了两下——进了。他转头对你说："谢谢你的鼓励，我一般罚球时脑子空空的，你给了我一个分心的理由——我在想我妈。"你决定下次换个策略。', desc:'罚球念咒语' };
  },
});

// ── 18. 替补席跳舞嘲讽 ──
EVENT_REGISTRY.push({
  id: 'trash_bench_dance',
  name: '替补席跳舞嘲讽',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'💃', title:'替补席跳舞嘲讽', body:'你命中了一记反超三分后，在回防的路上突然即兴跳了一段舞——你甚至不知道自己跳的是什么，大概是TikTok上最近流行的那个扭胯动作。对面的替补席有人站起来为你打分："6/10，创意不错，执行一般。"你愣了一下，然后对他抱拳致谢。赛后这段视频在推特上被转了十万次，标题："这可能NBA史上最尴尬的庆祝。"', desc:'跳舞嘲讽' };
  },
});





// ── 21. "你打得像我的早餐" ──
EVENT_REGISTRY.push({
  id: 'trash_baby',
  name: '"你打得像我的早餐"',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🍼', title:'"你打得像我的早餐"', body:'你在防守端成功限制住了对手后心血来潮地喷了一句："你打得像我的早餐——又软又冷。"对手沉默了两秒，然后问："你的早餐吃什么？"你说："麦片。"对手说："麦片是泡牛奶吃的——你甚至不会吃麦片。你的垃圾话就像你的防守一样，漏洞百出。"你发现自己被反杀了。', desc:'早餐垃圾话' };
  },
});

// ── 22. "你的鞋好丑" ──
EVENT_REGISTRY.push({
  id: 'trash_sneaker',
  name: '"你的鞋好丑"',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👟', title:'"你的鞋好丑"', body:'你低头看了一眼对手的球鞋——那是一双荧光绿配亮粉色的配色，丑到令人发指。你忍不住说："你这鞋是哪家赞助商给你配的？他们是不是恨你？"对手低头看了一眼自己的鞋，然后抬头说："这是我自己的签名鞋。你要不要来一双？我送你。"你的脸涨得通红。赛后更衣室里果然出现了一个鞋盒，里面装着一双同款丑鞋，附着一张纸条："穿上试试。签名版。"', desc:'吐槽球鞋' };
  },
});

// ── 23. "你会说中文吗？" ──
EVENT_REGISTRY.push({
  id: 'trash_korean',
  name: '"你会说中文吗？"',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🌏', title:'"你会说中文吗？"', body:'你对着对面的亚洲球员喷了一句中文垃圾话——然后他用同样流利的中文回了一句："我姥姥是上海人，你还有什么想说的？"你愣在原地，他用上海话又说了一遍，你一个字都没听懂。替补席的队友们笑到岔气。赛后他在IG上发了一段用上海话接受采访的视频，配文："今晚学了一句新的中文脏话，谢谢哥们。"', desc:'中文被反杀' };
  },
});

// ── 24. "发型不错" ──
EVENT_REGISTRY.push({
  id: 'trash_bald',
  name: '"发型不错"',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🧑‍🦲', title:'"发型不错"', body:'你在一次对抗后对光头队友说："你的发型真不错。"他没有接话。比赛结束后他在更衣室门口拦住你，递给你一瓶生发液："送你的，我感觉你发际线也不太行了。"你接过生发液不知道该说什么。第二天训练你戴了帽子。', desc:'发型调侃' };
  },
});



// ── 26. 偷听战术 ──
EVENT_REGISTRY.push({
  id: 'trash_timeout',
  name: '偷听战术',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'⏸️', title:'偷听战术', body:'对方叫了一个暂停，你假装漫不经心地往他们的替补席方向走了几步——你听到对方主教练正在布置针对你的防守战术。你还没听到关键部分就被安保人员发现了。"你在干什么？""呃...我在喝水。"你被礼貌但坚定地请回了自己的半场。下半场你发现他们的防守确实变了——你把偷听到的那半截战术结合自己的判断，找到了破解方法。赛后教练问你："你怎么知道他们会包夹你？"你神秘地笑了一下。', desc:'偷听战术' };
  },
});





// ── 29. 和裁判拉家常 ──
EVENT_REGISTRY.push({
  id: 'trash_referee_chat',
  name: '和裁判拉家常',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎙️', title:'和裁判拉家常', body:'等待罚球的时候你闲着没事和旁边的裁判聊了起来："你这赛季吹了多少场了？"裁判没想到你会跟他聊天，愣了一下说："大概五六十场吧。"你说："辛苦啊，飞来飞去的。"裁判说："还行，比你们轻松——你们还要打球。"你觉得这个裁判人不错，直到他在下一个回合吹了你一个走步。', desc:'和裁判聊天' };
  },
});



// ━━━ 类别 3：🤣 搞笑/囧事 ━━━



// ── 32. 鞋掉了继续打 ──
EVENT_REGISTRY.push({
  id: 'shoe_off',
  name: '鞋掉了继续打',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👟', title:'鞋掉了继续打', body:'你在一次快攻中突然感觉脚下一轻——左脚的鞋被踩掉了！你犹豫了不到半秒，然后光着一只脚继续运球推进，一个变向过掉防守人，上篮命中！替补席全部站起来笑疯了。回放镜头反复播放你的"独脚上篮"，解说员笑得上气不接下气。', desc:'鞋掉了上篮' };
  },
});

// ── 33. 球砸裁判后脑 ──
EVENT_REGISTRY.push({
  id: 'ball_hit_ref',
  name: '球砸裁判后脑',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎾', title:'球砸裁判后脑', body:'你奋力将球传向底角的队友，结果用力过猛轨迹偏高——球直接旋转着砸在了裁判的后脑勺上，发出了一声沉闷的"咚"！裁判的哨子飞了出去，他转过头来一脸懵逼地看着你。全场陷入了两秒钟的沉默，然后爆发出震天的笑声。你赶紧举起双手："对不起！对不起！我不是故意的！"', desc:'砸裁判后脑' };
  },
});

// ── 34. 球衣穿反上场 ──
EVENT_REGISTRY.push({
  id: 'jersey_wrong',
  name: '球衣穿反上场',
  weight: 1,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👕', title:'球衣穿反上场', body:'你从更衣室冲出来准备上场，总觉得哪里不对劲。直到你看到对面的球员在偷笑，你低头一看——你的球衣穿反了！全场球迷爆笑，你的队友笑到蹲在地上拍地板。你红着脸跑回更衣室，更衣室里传来了你队友们更加肆无忌惮的笑声。', desc:'球衣穿反' };
  },
});

// ── 35. 替补席睡着被拍 ──
EVENT_REGISTRY.push({
  id: 'sleep_on_bench',
  name: '替补席睡着被拍',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'💤', title:'替补席睡着被拍', body:'比赛早早进入垃圾时间，你坐在替补席的末端百无聊赖。第三节结束时你打了一个哈欠，然后闭上了眼睛——等醒来时发现摄像机正对着你，你的打瞌睡画面正在球馆大屏幕上循环播放。全场一阵哄笑。队友捅了捅你的肩膀："哥们，你火了。"', desc:'替补睡觉' };
  },
});

// ── 36. 洗澡滑倒扭伤 ──
EVENT_REGISTRY.push({
  id: 'shower_slip',
  name: '洗澡滑倒扭伤',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🚿', title:'洗澡滑倒扭伤', body:'赛后你哼着小曲走进淋浴间，刚迈出一步脚底一滑——你以极其狼狈的姿势四脚朝天摔倒在地！队友们听到巨响冲进来，看到你赤身裸体躺在地上呻吟，笑得差点背过气去。队医检查后确认只是轻微扭伤，但这事在更衣室被笑了整整一个赛季。', desc:'洗澡滑倒' };
  },
});



// ── 39. 吃坏肚子 ──
EVENT_REGISTRY.push({
  id: 'food_poisoning',
  name: '吃坏肚子',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🤢', title:'吃坏肚子', body:'赛前你在客场城市尝试了一家当地特色餐厅——然后你就后悔了。第一节中段你的肚子开始咕噜咕噜叫，第二节你已经往卫生间跑了三趟。每次回到场上你的脸色都苍白得像一张纸。教练不得不减少你的上场时间。赛后你发誓以后客场只吃赛前营养餐。', desc:'吃坏肚子' };
  },
});

// ── 40. 热身扣飞 ──
EVENT_REGISTRY.push({
  id: 'warmup_dunk_fail',
  name: '热身扣飞',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'😅', title:'热身扣飞', body:'赛前热身时你打算用一个360度转身扣篮点燃全场气氛。你助跑、起跳、转体——然后球直接砸在了篮筐后沿弹飞了，你以一个尴尬的姿势摔倒在地。现场观众发出了善意的笑声，你的队友们假装不认识你。你爬起来拍了拍球衣，假装什么都没发生。', desc:'热身扣飞' };
  },
});

// ── 41. 砸到自己教练 ──
EVENT_REGISTRY.push({
  id: 'pass_hit_coach',
  name: '砸到自己教练',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎯', title:'砸到自己教练', body:'你试图用一个背后传球找到底角的队友，结果球飞向了替补席——不偏不倚正中正在指挥的主教练的后脑勺。战术板飞了出去，笔在空中画了一道完美的弧线。教练转过头来，表情复杂地看着你。你缩了缩脖子："呃...我在找底角的射手？"', desc:'砸教练' };
  },
});


// ── 43. 传球砸到摄影师 ──
EVENT_REGISTRY.push({
  id: 'hit_photographer',
  name: '传球砸到摄影师',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'📸', title:'传球砸到摄影师', body:'你奋力追一个快要出界的球，鱼跃飞身把球捞回场内——然后整个人砸在了底线旁边的摄影师身上。价值五万美金的摄影器材哗啦啦倒了一地。摄影师从设备下面探出头来，给你竖了一个大拇指："好球！"', desc:'砸摄影师' };
  },
});

// ── 44. 踩到毛巾滑倒 ──
EVENT_REGISTRY.push({
  id: 'towel_slip',
  name: '踩到毛巾滑倒',
  weight: 1,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🧹', title:'踩到毛巾滑倒', body:'你在底线跑位时一脚踩到了保洁人员刚刚拖地留下的湿毛巾——你双脚向前劈叉滑出两米远，以一个标准的"一字马"姿势停在界外。观众们笑得前仰后合，你感觉自己的腹股沟在发出抗议。你扶着腰站起来，听到解说员说："他可能需要去练练瑜伽了。"', desc:'踩毛巾滑倒' };
  },
});




// ── 47. 庆祝过度撞倒教练 ──
EVENT_REGISTRY.push({
  id: 'celebrate_coach',
  name: '庆祝过度撞倒教练',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎉', title:'庆祝过度撞倒教练', body:'你命中了压哨绝杀！兴奋过度的你张开双臂在场上狂奔，在冲向替补席的庆祝中你直接撞翻了正在激动鼓掌的主教练。六十多岁的老教练被你撞得在地上滚了一圈，战术板飞出老远。你赶紧把他拉起来，他一边笑一边骂："臭小子，我这把老骨头差点被你拆了！"', desc:'撞倒教练' };
  },
});

// ── 48. 赛后采访翻车 ──
EVENT_REGISTRY.push({
  id: 'reporter_interview',
  name: '赛后采访翻车',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎤', title:'赛后采访翻车', body:'赛后一位漂亮的女记者把麦克风伸到你面前："今晚的表现太棒了！你有什么想对球迷说的吗？"你本想回答"我们会继续努力"，但从嘴里蹦出来的却是——"今晚的披萨很好吃。"记者愣住了，你愣住了，摄影师在镜头后面憋笑憋到发抖。这段采访在NBA官方账号上被反复播放。', desc:'采访翻车' };
  },
});

// ━━━ 类别 4：📱 社交媒体 ━━━

// ── 49. 手滑点赞争议帖 ──
EVENT_REGISTRY.push({
  id: 'like_controversy',
  name: '手滑点赞争议帖',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'❤️', title:'手滑点赞争议帖', body:'深夜刷手机的你手滑点赞了一条"XXX是史上最被高估的球员"的推特——更糟的是，这条推说的正是你现在球队的当家球星。第二天训练时队内的气氛微妙得像是在走钢丝。你赶紧取消了赞，但截图已经传遍全网。你花了整整一周才重新赢得队友的信任。', desc:'手滑点赞' };
  },
});

// ── 50. IG直播泄露队友吐槽教练 ──
EVENT_REGISTRY.push({
  id: 'ig_live_leak',
  name: 'IG直播泄露队友吐槽教练',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'📱', title:'IG直播泄露队友吐槽教练', body:'你和队友在更衣室闲聊时打开了IG直播，你忘了跟粉丝们打招呼就把手机放在了储物柜上。然后你的队友大声抱怨道："那个老头的战术简直是狗屎！"——而"那个老头"正是50米外正在接受采访的主教练。球队公关火速冲进来关掉了直播。罚款25,000美元。', desc:'直播泄露' };
  },
});

// ── 51. 吐槽2K评分 ──
EVENT_REGISTRY.push({
  id: 'tweet_2k',
  name: '吐槽2K评分',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎮', title:'吐槽2K评分', body:'你在推特上发了一条："2K给我这个评分是在开玩笑吗？"配上一个笑哭的表情。两分钟后2K官方账号回复："打出来再说话。"这条互动迅速获得了10万点赞，球迷们分成两派疯狂争论你究竟值多少分。2K的市场部高兴坏了——免费的流量啊。', desc:'吐槽2K' };
  },
});

// ── 52. ESPN专访说"我奶奶" ──
EVENT_REGISTRY.push({
  id: 'espn_grandma',
  name: 'ESPN专访说"我奶奶"',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎙️', title:'ESPN专访说"我奶奶"', body:'ESPN记者在专访中问你："谁是你遇到过最难防的球员？"你本来想回答勒布朗或者杜兰特，但嘴一快蹦出来一句——"我奶奶。她年轻的时候打街球可厉害了。"这段采访播出后，你奶奶的旧照片被网友翻了出来，她还真的接到了电视台的电话邀请做节目。你奶奶比你还出名了。', desc:'我奶奶梗' };
  },
});

// ── 53. 被Shaq点名五大囧 ──
EVENT_REGISTRY.push({
  id: 'shaq_five',
  name: '被Shaq点名五大囧',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎬', title:'被Shaq点名五大囧', body:'沙奎尔·奥尼尔在TNT的《五大囧》节目中播放了你的"精彩"镜头——你在无人防守的情况下试图来一个大风车扣篮，结果球直接飞出了场外。Shaq笑得从椅子上摔了下来，全美观众都在看你的笑话。你的电话被朋友的短信塞爆了。不过——黑红也是红，对吧？', desc:'五大囧' };
  },
});

// ── 54. 和网红约会曝光 ──
EVENT_REGISTRY.push({
  id: 'date_netcelebrity',
  name: '和网红约会曝光',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🌹', title:'和网红约会曝光', body:'八卦媒体TMZ拍到你和一位拥有500万粉丝的知名网红在洛杉矶的高档餐厅共进晚餐。你们相谈甚欢的照片瞬间引爆社交媒体。你的IG粉丝一夜之间暴涨50万，评论区充满了羡慕嫉妒恨。第二天训练你迟到了——因为太多人@你看评论。', desc:'网红约会' };
  },
});


// ── 56. 点赞球迷照片 ──
EVENT_REGISTRY.push({
  id: 'like_fan_photo',
  name: '点赞球迷照片',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'💕', title:'点赞球迷照片', body:'你闲着无聊翻IG时给一张美女粉丝的照片点了赞——结果那个粉丝是你队友的女朋友。队友在训练中用杀人的眼神看了你一整天。你赶紧解释这是个意外，然后请全队吃了顿和牛才平息了这件事。', desc:'点赞翻车' };
  },
});

// ── 57. 直播打游戏爆粗 ──
EVENT_REGISTRY.push({
  id: 'game_live_curse',
  name: '直播打游戏爆粗',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎮', title:'直播打游戏爆粗', body:'你在Twitch直播打《使命召唤》，被一个12岁的小孩连续杀了八次后你对着麦克风疯狂爆粗。你完全忘了你的直播间里有3000个观众。弹幕瞬间被"LMAO"和"录屏了"刷屏。联盟以"不当言论"为由对你罚款15,000美元。那个12岁的小孩后来成了你的固定游戏搭子。', desc:'直播爆粗' };
  },
});

// ── 58. 被做成表情包 ──
EVENT_REGISTRY.push({
  id: 'meme',
  name: '被做成表情包',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'😂', title:'被做成表情包', body:'你那尴尬瞬间的高清截图已经在互联网上病毒式传播了。朋友们把各种版本的表情包发到你的手机上——《还珠格格》版的、漫威版的、甚至还有猫猫版的。你决定坦然接受，把最好笑的一张设成了自己的推特头像。球迷们感动落泪："他懂梗！"', desc:'表情包' };
  },
});


// ── 60. TikTok跳舞爆火 ──
EVENT_REGISTRY.push({
  id: 'tiktok_dance',
  name: 'TikTok跳舞爆火',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'💃', title:'TikTok跳舞爆火', body:'你一时兴起在TikTok上发了一段自己跳"黑桃A"舞蹈的视频——第二天一看，播放量2000万。队友们在你背后模仿你的舞步，全队都学会了那个动作。你从一个职业篮球运动员变成了——一个会跳舞的职业篮球运动员。', desc:'TikTok爆火' };
  },
});

// ── 61. 被Kendrick Perkins怒批 ──
EVENT_REGISTRY.push({
  id: 'kendrick_perkins',
  name: '被Kendrick Perkins怒批',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎙️', title:'被Kendrick Perkins怒批', body:'ESPN名嘴肯德里克·帕金斯在节目中扯着嗓子喊："这个家伙根本就不配首发！我奶奶防他都比他自己防得好！"这段视频在更衣室里被队友们反复播放，所有人都在看你尴尬的表情。你决定用下一场比赛的表现来回应——或者至少让帕金斯闭嘴。', desc:'Perkins怒批' };
  },
});

// ── 62. Stephen A.Smith狂吹你 ──
EVENT_REGISTRY.push({
  id: 'stephen_a',
  name: 'Stephen A.Smith狂吹你',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🗣️', title:'Stephen A.Smith狂吹你', body:'Stephen A.Smith在《First Take》节目中用他标志性的咆哮风格大喊："我告诉过你们！我！早！就！说！过！这个年轻人是联盟的未来！如果你不同意——你就是个傻子！大傻子！"你坐在更衣室里看这段视频，嘴角忍不住上扬。这段视频被你的队友设为手机铃声。', desc:'Smith狂吹' };
  },
});

// ━━━ 类别 5：🏠 更衣室 ━━━



// ── 64. 飞机扑克输钱 ──
EVENT_REGISTRY.push({
  id: 'poker_on_plane',
  name: '飞机扑克输钱',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🃏', title:'飞机扑克输钱', body:'球队包机上，你和三个队友围在一起打德州扑克。今晚你的运气差到了极点——两对碰上葫芦，葫芦碰上四条，四条碰上同花顺。当你在最后一局连底裤都快输掉的时候，你意识到他们三个在串通出千。但你已经输了半个月的工资了。', desc:'扑克输钱' };
  },
});




// ── 67. 偷穿教练西装 ──
EVENT_REGISTRY.push({
  id: 'coach_suit',
  name: '偷穿教练西装',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👔', title:'偷穿教练西装', body:'更衣室里没人，你好奇地穿上了主教练挂在衣架上的定制西装。你正对着镜子摆pose的时候——教练推门进来了。你穿着他那件明显小了两号、腋下已经崩线了的西装，尴尬地站在原地。教练看了你三秒钟："训练加罚100趟折返跑。还有——西装干洗费从你工资里扣。"', desc:'偷穿西装' };
  },
});

// ── 68. 请全队吃大餐 ──
EVENT_REGISTRY.push({
  id: 'team_dinner',
  name: '请全队吃大餐',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🍖', title:'请全队吃大餐', body:'你宣布今晚请全队去全城最贵的牛排馆吃饭。队友们欢呼着把你抛了起来——字面意义上的那种。账单来了，六位数。你看着账单数字，强装镇定地刷了卡。回到公寓你打开银行App，默默更新了手机壁纸："我会赚钱的。"', desc:'请客吃饭' };
  },
});

// ── 69. 老将请你回家吃饭 ──
EVENT_REGISTRY.push({
  id: 'veteran_dinner',
  name: '老将请你回家吃饭',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🍳', title:'老将请你回家吃饭', body:'球队的老将今天邀请你去他家吃晚饭。他的妻子做了一桌丰盛的家常菜，你们边吃边聊他年轻时的故事。"你知道吗，我当年也像你一样，觉得自己无所不能。"他喝了一口红酒，眼神有些迷离，"好好享受你的新秀赛季吧，它比你想象的要短得多。"', desc:'老将请客' };
  },
});




// ── 72. 更衣室放歌被投诉 ──
EVENT_REGISTRY.push({
  id: 'music_war',
  name: '更衣室放歌被投诉',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎵', title:'更衣室放歌被投诉', body:'今天轮到你当更衣室DJ。你信心满满地播放了自己精心准备的歌单——结果第一首重低音EDM响起来的时候，一个队友直接拔掉了蓝牙音箱的插头。"第17遍了！你上周就放这首歌！"然后音箱主权被一个老将夺走，他开始播放2000年代的R&B，全场满意地点头。你默默收起了你的手机。', desc:'放歌被投诉' };
  },
});

// ── 73. 带队友玩新游戏 ──
EVENT_REGISTRY.push({
  id: 'game_night',
  name: '带队友玩新游戏',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎮', title:'带队友玩新游戏', body:'你带了一台Switch到客场，和队友们在酒店房间里玩了三个小时的《马里奥赛车》。竞争异常激烈——打赌输掉的人要在明天的训练中穿着粉红色袜子跑全场。目前战况胶着，情绪高涨。酒店隔壁房间的客人敲了两次门投诉噪音了。', desc:'玩游戏' };
  },
});

// ── 74. 更衣室消失的球鞋 ──
EVENT_REGISTRY.push({
  id: 'missing_shoes',
  name: '更衣室消失的球鞋',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👟', title:'更衣室消失的球鞋', body:'训练结束后你发现你新买的那双限量版球鞋不见了。你焦急地在更衣室里翻遍了每一个角落。最后你发现——球队的老将把它藏在了天花板的通风管道里，因为"新秀需要学会保护自己的东西"。你把鞋子拿出来的时候里面被塞了一双他脱下来的旧袜子。', desc:'球鞋失踪' };
  },
});

// ── 75. 和保安成为朋友 ──
EVENT_REGISTRY.push({
  id: 'friend_security',
  name: '和保安成为朋友',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🛡️', title:'和保安成为朋友', body:'球场的老保安迈克是个六十多岁的黑人老头，他在这个球馆工作了三十年。每次你来加练到深夜，他总会给你留门，然后给你讲他年轻时见过的那些传奇球星。"乔丹当年在这块场地上得了63分——我亲眼看到的。你也有那个范儿，小子。"', desc:'保安朋友' };
  },
});


// ━━━ 类别 6：🎯 名场面 ━━━

















// ── 92. 不看人背传绝杀助攻 ──
EVENT_REGISTRY.push({
  id: 'behind_the_back',
  name: '不看人背传绝杀助攻',
  weight: 1,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🙈', title:'不看人背传绝杀助攻', body:'比赛还剩5秒，比分打平。你持球单打，吸引了双人包夹。在即将被逼入死角的瞬间，你跳起来做了一个标准的投篮动作——防守球员全部起跳封盖——但你在空中把球收回腰间，用一个背后不看人传球把球送到了底角空位队友的手中。球在空中划出一道直线——队友接球、起跳、出手——红灯亮起——球进！绝杀！你被队友们压在身下疯狂庆祝。回放镜头里看到球在空中的时候，你的视线根本没有看向底角。队友赛后说："他怎么知道我在那里？他甚至没看我！"你说："我就是知道。"', desc:'背传绝杀' };
  },
});

// ── 93. 打电话庆祝 ──
EVENT_REGISTRY.push({
  id: 'gamemom_call',
  name: '打电话庆祝',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'📞', title:'打电话庆祝', body:'你命中了职业生涯的第一个绝杀球。全场欢呼声中，你没有像其他人一样疯狂奔跑庆祝。你冷静地走到场边，拿起工作人员的手机——给你妈妈打了一个微信电话。电话接通了，屏幕那边你妈正在家里尖叫，背景里你爸在沙发上跳来跳去。"妈，看到了吗？""看到了看到了！我儿子！绝杀！"全场观众通过大屏幕看到了这一幕，欢呼声变成了温暖的掌声。赛后这段视频在社交媒体上获得了一千万播放量。', desc:'打电话庆祝' };
  },
});

// ── 94. 毛巾盖头绝杀 ──
EVENT_REGISTRY.push({
  id: 'towel_celebration',
  name: '毛巾盖头绝杀',
  weight: 1,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🧣', title:'毛巾盖头绝杀', body:'终场哨响，你的绝杀球在空中划过一道弧线——球还在空中的时候，你已经转身从替补席队友手里抓了一条毛巾盖在了头上，然后背对着篮筐举起了双手。球进的瞬间，你头上盖着毛巾，双臂张开，像一个即将登台的拳击冠军。这张照片毫无悬念地登上了第二天所有体育媒体的封面。标题赫然写着："Ice in his veins." 赛后记者问你怎么敢在球进之前就开始庆祝，你说："我投出去的那个瞬间就知道了。"', desc:'毛巾绝杀' };
  },
});

// ── 95. 拿走比赛用球 ──
EVENT_REGISTRY.push({
  id: 'record_milestone_ball',
  name: '拿走比赛用球',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🏀', title:'拿走比赛用球', body:'比赛结束后你发现技术台的工作人员正在用一个标记笔在比赛用球上写字。他们走到你面前，把球递给你——"这是你的比赛用球，今晚你创造了职业生涯新高。"你接过球，感受着它熟悉的纹理。这颗球见证了你的某一个巅峰夜晚。你把它夹在腋下，就像抱着一颗宝石。回到更衣室后，你找了一支笔，在球上写下了日期和你的数据。未来有一天，它会出现在你书房最显眼的位置。', desc:'拿走比赛球' };
  },
});

// ── 96. 三分命中后摇头 ──
EVENT_REGISTRY.push({
  id: 'three_point_celebration',
  name: '三分命中后摇头',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🔥', title:'三分命中后摇头', body:'你命中了连续第三记三分。退防的过程中你一边摇头一边面无表情地看着对手的替补席。你的表情在说："太简单了。太他妈简单了。"你的冷漠庆祝比任何怒吼都更具杀伤力。对手叫了暂停，你走下球场时队友拍了拍你的胸口，你依然面无表情——直到你坐回替补席，才终于忍不住笑出来。', desc:'三分摇头' };
  },
});

// ━━━ 类别 7：🍀 场外生活 ━━━


// ── 98. 参加社区慈善活动 ──
EVENT_REGISTRY.push({
  id: 'charity',
  name: '参加社区慈善活动',
  weight: 1,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'❤️', title:'参加社区慈善活动', body:'球队组织了一次社区服务活动，你去了一所小学和孩子们一起打篮球、发午餐。一个黑人小女孩拉住你的手说："我以后也要打篮球，像你一样。"你蹲下来告诉她："你会比我更好的。"活动结束时校长送了你一筐孩子们手绘的感谢卡。你把它们全部带回了家，贴在书房的墙上。', desc:'慈善活动' };
  },
});


// ── 100. 投资加密货币亏钱 ──
EVENT_REGISTRY.push({
  id: 'crypto_loss',
  name: '投资加密货币亏钱',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'📉', title:'投资加密货币亏钱', body:'你的理财顾问推荐了一个"稳赚不赔"的加密货币项目。你把半个月的薪水投了进去——然后第二天那个币跌了80%。你盯着手机屏幕上血红色的数字，感觉心脏停跳了一拍。你的队友在更衣室里安慰你："没事兄弟，大家都亏过。"你默默决定以后只买国债。', desc:'加密币亏钱' };
  },
});

// ── 101. 开超跑被交警拦下 ──
EVENT_REGISTRY.push({
  id: 'lambo_ticket',
  name: '开超跑被交警拦下',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🚗', title:'开超跑被交警拦下', body:'你开着新买的荧光绿兰博基尼在高速上被交警拦了下来。"知道为什么拦你吗？""呃...开太快了？"交警面无表情地说："你的车牌过期三个月了。"你尴尬地挠了挠头。你收到了两张罚单：逾期未注册 + 不按规定悬挂号牌。第二天你把车开去做了全车贴膜——换成了哑光黑，低调一点。', desc:'超跑被拦' };
  },
});


// ── 103. 赞助商送豪车 ──
EVENT_REGISTRY.push({
  id: 'sponsor_car',
  name: '赞助商送豪车',
  weight: 1,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🏎️', title:'赞助商送豪车', body:'一家知名运动品牌在你连续爆发的第三场比赛后联系了你的经纪人——他们想送一辆定制版的保时捷Taycan作为"合作关系的第一步"。车送到公寓楼下的时候你掐了自己一下确认不是在做梦。你在车里坐了一个小时，捣鼓着那个巨大的中控屏幕，像个小孩子一样兴奋。', desc:'赞助商送车' };
  },
});

// ── 104. 老家亲戚来要票 ──
EVENT_REGISTRY.push({
  id: 'relatives_tickets',
  name: '老家亲戚来要票',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎫', title:'老家亲戚来要票', body:'你的电话响了——是你十几年没联系过的表舅。寒暄了几句之后他终于说出了目的："那个...下周六的比赛能搞到几张票吗？你表弟想去看。"你无奈地订了四张票放在前台。赛后你的亲戚们围着你拍了一百张合影，你表舅的儿子说："你是我们家最出名的人了！"', desc:'亲戚要票' };
  },
});


// ── 106. 养了一只宠物 ──
EVENT_REGISTRY.push({
  id: 'pet_dog',
  name: '养了一只宠物',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🐕', title:'养了一只宠物', body:'你在宠物店看到了一只金毛幼犬，它用那双湿漉漉的眼睛看了你一眼——你沦陷了。十五分钟后你抱着一个毛茸茸的小家伙走出了宠物店，后座上多了一堆狗粮和玩具。从此你家多了一个在你训练回家后会疯狂摇尾巴迎接你的小生命。', desc:'养宠物' };
  },
});

// ── 107. 学吉他/开演唱会 ──
EVENT_REGISTRY.push({
  id: 'learn_guitar',
  name: '学吉他/开演唱会',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎸', title:'学吉他/开演唱会', body:'休赛期你迷上了吉他。你报了一个月的速成班，每天苦练四个小时。赛季开始后的球队年会上，你抱着吉他为全队弹唱了一首《Wonderwall》。虽然有几个音跑了，但你的勇气赢得了全队的掌声。主教练拍了拍你的肩膀说："球打得好，歌嘛——还有进步空间。"', desc:'学吉他' };
  },
});

// ── 108. 参与电影客串 ──
EVENT_REGISTRY.push({
  id: 'movie_cameo',
  name: '参与电影客串',
  weight: 1,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎬', title:'参与电影客串', body:'一部好莱坞大片正在你的城市取景拍摄，导演是你的球迷。他在IG上私信你邀请你客串一个角色——"只需要你走过镜头，说一句台词。"你在片场待了三个小时就完成了戏份。电影上映那天你包场请全队去看。当你在荧幕上出现说出那句"把球给我"时，你的队友们在电影院里发出了震天的欢呼声。', desc:'电影客串' };
  },
});

// ━━━ 类别 8：👻 玄学/奇闻 ━━━


// ── 110. 幸运袜子不能洗 ──
EVENT_REGISTRY.push({
  id: 'lucky_socks',
  name: '幸运袜子不能洗',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🧦', title:'幸运袜子不能洗', body:'那场你拿到赛季新高的时候穿的是什么袜子你还记得。那之后的每一场比赛你都要找出同一双袜子——即使它已经穿了整整两周没洗了。它的气味已经成了一个独立的存在。你的队友拒绝和你坐同一排座椅。但你不在乎——只要它能带来好运，它臭它的，你赢你的。', desc:'幸运袜' };
  },
});





// ── 114. 球队包机延误 ──
EVENT_REGISTRY.push({
  id: 'flight_delay',
  name: '球队包机延误',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'✈️', title:'球队包机延误', body:'打完客场比赛后你们赶往机场，发现包机因为机械故障需要延迟五个小时。全队被困在机场VIP候机室里——有人在打牌，有人在睡觉，有人在反复刷着凌晨两点的航班信息。你们在凌晨四点才到达下一个客场城市。明天的比赛所有人都在揉眼睛打哈欠。背靠背本来就难，这下更难了。', desc:'包机延误' };
  },
});



// ── 116. 幸运手链丢了 ──
EVENT_REGISTRY.push({
  id: 'lucky_bracelet',
  name: '幸运手链丢了',
  weight: 2,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'📿', title:'幸运手链丢了', body:'你突然发现一直戴着的那条外婆送的幸运手链不见了！你在更衣室里翻了个底朝天——训练包、衣柜、昨天穿的衣服——都没有。你打电话问保洁，翻遍了昨天的球场区域。最终你发现它卡在了你的车座缝隙里。你如释重负地把它重新戴在手上，拍拍它："别再乱跑了。"', desc:'手链丢了' };
  },
});


// ── 118. 球场停电 ──
EVENT_REGISTRY.push({
  id: 'power_outage',
  name: '球场停电',
  weight: 1,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'⚡', title:'球场停电', body:'第三节打到一半，球馆的灯光突然熄灭——全部。包括应急灯。球馆陷入了一片彻底的黑暗。观众们先是惊呼，然后纷纷打开了手机手电筒，球馆里出现了数千支像萤火虫一样的光点。球员们站在原地不知所措。裁判宣布比赛暂停。15分钟后电力恢复，但节奏已经完全被打断了。', desc:'球场停电' };
  },
});

// ━━━ 类别 9：🦠 伤病 ━━━




// ── 122. 背部痉挛 ──
EVENT_REGISTRY.push({
  id: 'injury_back',
  name: '背部痉挛',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'💆', title:'背部痉挛', body:'你刚做了一个变向动作，突然感觉下背部像被电击了一样——肌肉完全锁死了。你僵在原地动弹不得，连呼吸都小心翼翼。队医把你扶到训练室，你趴在按摩床上发出了痛苦的呻吟。队医说："背部痉挛，至少休息几天。我知道你不愿意，但你的身体替你做了决定。"你没法反驳。', desc:'背部痉挛', _consequence:'injury', _games:(1 + Math.floor(Math.random() * 2)) };
  },
});

// ── 123. 脑震荡 ──
EVENT_REGISTRY.push({
  id: 'injury_concussion',
  name: '脑震荡',
  weight: 10,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'😵', title:'脑震荡', body:'你在争抢篮板时和对手的脑袋撞在了一起——一声闷响后你眼前一黑。你摔倒在地上，看什么都是双层的。队友的脸在你面前晃来晃去，但你听不清他们在说什么。队医用手电筒照了照你的瞳孔："可能脑震荡，必须离场。"你被送去医院做CT检查，头上缠着纱布的照片很快出现在了新闻上。', desc:'脑震荡', _consequence:'injury', _games:(5 + Math.floor(Math.random() * 6)) };
  },
});

// ===== 新增禁赛/伤病事件（来自 新增禁赛伤病事件_30条_v1.md） =====

// ── S1. 赛后停车场冲突 ──
EVENT_REGISTRY.push({
  id: 'susp_parking_fight',
  name: '赛后停车场冲突',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🚗', title:'赛后停车场冲突', body:'赛后你在球员停车场被对方球员的言语激怒，两人从互喷升级为肢体冲突。你一拳挥过去正中对方下巴，保安和队友飞扑过来把你们拉开。这一幕被球迷用手机全程录下上传到社交平台。联盟以"损害联盟形象"为由对你处以禁赛{n}场的处罚。你在发布会上道了歉，但那一拳的视频已经被做成了GIF。', desc:'停车场斗殴禁赛', _consequence:'suspension', _games:(3 + Math.floor(Math.random() * 3)) };
  },
});

// ── S2. 脚踢替补席椅子 ──
EVENT_REGISTRY.push({
  id: 'susp_kick_chair',
  name: '脚踢替补席椅子',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🪑', title:'脚踢替补席椅子', body:'你在一次争议吹罚后被换下场，怒火中烧的你一脚踢飞了替补席的折叠椅。椅子飞出去砸到了场边一位球迷的膝盖。虽然你立刻上前道歉，但联盟以"危险行为危害观众安全"为由对你处以禁赛{n}场的处罚。球队内部也对你进行了罚款。', desc:'怒踢椅子禁赛', _consequence:'suspension', _games:(1 + Math.floor(Math.random() * 2)) };
  },
});

// ── S3. 赛后发布会嘲讽对手 ──
EVENT_REGISTRY.push({
  id: 'susp_press_taunt',
  name: '赛后发布会嘲讽对手',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🎙️', title:'赛后发布会嘲讽对手', body:'赛后发布会上，记者问你对今晚对位球员的表现有什么看法。你对着麦克风不屑地说："他？他就不该在这个联盟打球。"这句话迅速引爆了社交媒体。联盟第二天宣布，因"公开贬低其他球员"对你处以禁赛{n}场的处罚。你后悔已经来不及了。', desc:'发布会不当言论禁赛', _consequence:'suspension', _games:1 };
  },
});

// ── S4. 比赛中推搡裁判 ──
EVENT_REGISTRY.push({
  id: 'susp_push_ref',
  name: '比赛中推搡裁判',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👨‍⚖️', title:'比赛中推搡裁判', body:'裁判的一次误判让你彻底失控。你冲到裁判面前，用手指着他的鼻子怒吼，在他转身离开时你伸手推了他一把——虽然力度不大，但裁判立刻转身给你一个二级恶意犯规外加驱逐出场。联盟对"肢体接触裁判"零容忍，宣布对你禁赛{n}场并罚款50,000美元。', desc:'推搡裁判禁赛', _consequence:'suspension', _games:(3 + Math.floor(Math.random() * 3)) };
  },
});

// ── S5. 药检阳性 ──
EVENT_REGISTRY.push({
  id: 'susp_doping',
  name: '药检阳性',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'💊', title:'药检阳性', body:'联盟随机药检的结果出来了——你的样本中含有违禁物质。你在社交媒体上声明是"误服了含有违禁成分的补剂"，但联盟依然按照规定对你处以禁赛{n}场的处罚。你的名声受到了严重打击，赞助商也在观望。', desc:'药检阳性禁赛', _consequence:'suspension', _games:(5 + Math.floor(Math.random() * 6)) };
  },
});

// ── S6. 与队友训练中斗殴 ──
EVENT_REGISTRY.push({
  id: 'susp_teammate_fight',
  name: '与队友训练中斗殴',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👊', title:'与队友训练中斗殴', body:'训练赛中你和队友因为一个犯规动作爆发了冲突。两人从互骂升级到互相推搡，最后你一拳打在了他的颧骨上。教练和助教把你们拉开，队友捂着脸去了医务室。球队管理层震怒，内部处罚你禁赛{n}场。更衣室的气氛降到了冰点。', desc:'内讧斗殴禁赛', _consequence:'suspension', _games:(2 + Math.floor(Math.random() * 3)) };
  },
});

// ── S8. 赛后拒绝接受采访 ──
EVENT_REGISTRY.push({
  id: 'susp_refuse_interview',
  name: '赛后拒绝接受采访',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🚫', title:'赛后拒绝接受采访', body:'输掉关键比赛后你心情糟糕透顶。场边记者拦住你要求赛后采访，你一把推开麦克风冷冷地说了一句"没什么好说的"然后径直走回更衣室。联盟规定球员必须接受赛后采访，你因此被罚款25,000美元并禁赛{n}场。', desc:'罢采禁赛', _consequence:'suspension', _games:1 };
  },
});

// ── S9. 与球迷发生冲突 ──
EVENT_REGISTRY.push({
  id: 'susp_fan_conflict',
  name: '与球迷发生冲突',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'😡', title:'与球迷发生冲突', body:'客队球迷在你走出球员通道时朝你泼了一杯饮料。你瞬间暴怒，翻过围栏冲向那名球迷——安保人员及时拦住了你，但这一幕已经被摄像机全程记录。联盟决定对你处以禁赛{n}场的处罚。你在社交媒体上道了歉，但那个翻围栏的画面已经传遍了全网。', desc:'球迷冲突禁赛', _consequence:'suspension', _games:(2 + Math.floor(Math.random() * 3)) };
  },
});

// ── S10. 赛后与对手更衣室对峙 ──
EVENT_REGISTRY.push({
  id: 'susp_locker_confront',
  name: '赛后与对手更衣室对峙',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🚪', title:'赛后与对手更衣室对峙', body:'终场哨响后你依然对对方球员的一个脏动作耿耿于怀。你穿过球员通道直接冲进了对方的更衣室——你踹开门，指着那个球员大喊："你有种当面做一次！"双方球员和教练组乱成一团。联盟以"闯入对方更衣室"为由对你禁赛{n}场。', desc:'更衣室对峙禁赛', _consequence:'suspension', _games:(3 + Math.floor(Math.random() * 3)) };
  },
});

// ── S11. 社交媒体发布不当言论 ──
EVENT_REGISTRY.push({
  id: 'susp_social_media',
  name: '社交媒体发布不当言论',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🐦', title:'社交媒体发布不当言论', body:'深夜你在推特上发了一条吐槽联盟裁判的推文——"这个联盟的裁判水平连高中联赛都不如"。第二天这条推文引爆了舆论。联盟办公室迅速做出反应，以"公开诋毁联盟官员"为由对你处以禁赛{n}场的处罚。你删掉了推文，但截图已经被所有人看过了。', desc:'社媒不当言论禁赛', _consequence:'suspension', _games:(1 + Math.floor(Math.random() * 2)) };
  },
});

// ── S15. 危险动作锁喉对手 ──
EVENT_REGISTRY.push({
  id: 'susp_choke',
  name: '危险动作锁喉对手',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🫀', title:'危险动作锁喉对手', body:'在一次争抢中你和对方球员纠缠在一起。情绪失控的你伸手卡住了对手的脖子——虽然只持续了两秒钟，但这个画面看起来极其恶劣。裁判和队友立刻把你拉开，对方球员倒地咳嗽。联盟回看录像后认定这是"暴力行为"，对你处以禁赛{n}场的重罚。', desc:'锁喉禁赛', _consequence:'suspension', _games:(4 + Math.floor(Math.random() * 4)) };
  },
});

// ── I1. 训练中膝盖扭伤 ──
EVENT_REGISTRY.push({
  id: 'injury_knee_sprain',
  name: '训练中膝盖扭伤',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🦵', title:'训练中膝盖扭伤', body:'队内训练赛中你在做变向动作时突然感觉右膝传来一声闷响——你的膝盖在无对抗的情况下扭了一下。你痛苦地倒在地上，双手捂着膝盖。队医和教练冲了上来。MRI检查结果显示内侧副韧带拉伤，队医宣布你需要休养{n}场。', desc:'膝盖扭伤', _consequence:'injury', _games:(5 + Math.floor(Math.random() * 6)) };
  },
});

// ── I2. 肩膀脱臼 ──
EVENT_REGISTRY.push({
  id: 'injury_shoulder',
  name: '肩膀脱臼',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🦴', title:'肩膀脱臼', body:'你在一次凶狠的拼抢中重重摔倒在地，左肩先着地——一阵剧痛从肩膀传来，你发现自己的左臂完全使不上力了。你试图活动肩膀，但每动一下都疼得龇牙咧嘴。队医检查后说肩膀脱臼了，需要休养{n}场。', desc:'肩膀脱臼', _consequence:'injury', _games:(4 + Math.floor(Math.random() * 5)) };
  },
});

// ── I3. 流感缺席 ──
EVENT_REGISTRY.push({
  id: 'injury_flu',
  name: '流感缺席',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🤒', title:'流感缺席', body:'早上醒来你感觉浑身发冷、肌肉酸痛，体温计显示39.5度。队医检查后说你得了季节性流感，不建议你参加比赛。你躺在公寓的床上裹着被子瑟瑟发抖，手机屏幕上不断弹出队友们发来的"早日康复"。你至少需要休养{n}场。', desc:'流感缺阵', _consequence:'injury', _games:(1 + Math.floor(Math.random() * 3)) };
  },
});

// ── I4. 足底筋膜炎 ──
EVENT_REGISTRY.push({
  id: 'injury_fasciitis',
  name: '足底筋膜炎',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🦶', title:'足底筋膜炎', body:'最近你的脚后跟在每天早上起床时都痛得像踩在钉子上。热身之后疼痛会减轻，但比赛后又会加重。队医诊断你患上了足底筋膜炎，建议你休息一段时间以免恶化。你不得不接受休养{n}场的康复计划。', desc:'足底筋膜炎', _consequence:'injury', _games:(3 + Math.floor(Math.random() * 4)) };
  },
});

// ── I6. 大腿肌肉拉伤 ──
EVENT_REGISTRY.push({
  id: 'injury_quad',
  name: '大腿肌肉拉伤',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🦵', title:'大腿肌肉拉伤', body:'你在一次全力冲刺中突然感觉大腿前侧像被撕裂了一样——你立刻慢下来一瘸一拐地走向场边。你试图在边线上拉伸后继续比赛，但每发力一步都钻心地疼。队医宣布大腿肌肉二级拉伤，需要休养{n}场。', desc:'大腿拉伤', _consequence:'injury', _games:(5 + Math.floor(Math.random() * 6)) };
  },
});

// ── I7. 手腕扭伤 ──
EVENT_REGISTRY.push({
  id: 'injury_wrist',
  name: '手腕扭伤',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'✋', title:'手腕扭伤', body:'你在一次摔倒时本能地用手撑地——手腕传来一阵剧痛。你甩了甩手想继续打，但每次投篮发力时手腕都会剧烈疼痛。你的命中率明显下降，教练最终决定让你轮休。队医给你缠上了护腕，建议休养{n}场。', desc:'手腕扭伤', _consequence:'injury', _games:(2 + Math.floor(Math.random() * 3)) };
  },
});

// ── I8. 食物中毒住院 ──
EVENT_REGISTRY.push({
  id: 'injury_food_poison_hospital',
  name: '食物中毒住院',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🏥', title:'食物中毒住院', body:'深夜你被剧烈的胃痛和呕吐惊醒。你冲到卫生间吐了三次，整个人虚脱到站不稳。经纪人连夜把你送到急诊室，医生诊断为急性肠胃炎（食物中毒），需要住院观察。你至少缺席{n}场比赛。', desc:'食物中毒', _consequence:'injury', _games:(2 + Math.floor(Math.random() * 3)) };
  },
});

// ── I9. 腹股沟拉伤 ──
EVENT_REGISTRY.push({
  id: 'injury_groin',
  name: '腹股沟拉伤',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🤕', title:'腹股沟拉伤', body:'你在一次防守滑步中突然感觉大腿根部一阵撕裂感——你立刻停下来扶着腰，表情痛苦。腹股沟拉伤是运动员最烦人的伤病之一，虽然不算严重但非常容易复发。队医建议你休养{n}场以避免变成慢性伤病。', desc:'腹股沟拉伤', _consequence:'injury', _games:(3 + Math.floor(Math.random() * 4)) };
  },
});

// ── I10. 小腿肌肉痉挛 ──
EVENT_REGISTRY.push({
  id: 'injury_calf_cramp',
  name: '小腿肌肉痉挛',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🦵', title:'小腿肌肉痉挛', body:'第四节刚开始你的小腿突然抽筋了——肌肉硬得像一块石头，你痛得单膝跪地。队医上场给你拉伸，但每次你试图跑动时都会再次抽筋。教练无奈地把你换下。赛后队医说你严重脱水，需要休息{n}场来恢复。', desc:'小腿痉挛', _consequence:'injury', _games:(1 + Math.floor(Math.random() * 2)) };
  },
});

// ── I11. 眼角膜擦伤 ──
EVENT_REGISTRY.push({
  id: 'injury_eye',
  name: '眼角膜擦伤',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'👁️', title:'眼角膜擦伤', body:'争抢篮板时对方的手指直接戳进了你的眼睛——你惨叫一声捂着眼睛蹲在地上。泪水不停地流，你几乎睁不开那只眼睛。队医检查后发现你的眼角膜被划伤了，至少需要休养{n}场来恢复视力。', desc:'眼角膜擦伤', _consequence:'injury', _games:(2 + Math.floor(Math.random() * 3)) };
  },
});

// ── I12. 肋骨挫伤 ──
EVENT_REGISTRY.push({
  id: 'injury_rib',
  name: '肋骨挫伤',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🩻', title:'肋骨挫伤', body:'你被对方一肘重重击中了侧腹部——你当场感觉呼吸都困难了。你捂着肋骨弯着腰，每一次深呼吸都伴随着刺痛。队医检查后说肋骨骨膜挫伤，虽然没有骨折但非常疼。你被列入每日观察名单，最终决定休养{n}场。', desc:'肋骨挫伤', _consequence:'injury', _games:(3 + Math.floor(Math.random() * 4)) };
  },
});

// ── I13. 膝盖积液 ──
EVENT_REGISTRY.push({
  id: 'injury_knee_effusion',
  name: '膝盖积液',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🦵', title:'膝盖积液', body:'你的膝盖在最近几场比赛中越来越肿胀，每次弯曲都发出咯吱咯吱的声音。队医抽取了膝盖里的积液，足足抽出了20毫升黄色液体。他严肃地告诉你必须休息，否则会发展成慢性滑膜炎。你接受了休养{n}场的建议。', desc:'膝盖积液', _consequence:'injury', _games:(4 + Math.floor(Math.random() * 4)) };
  },
});

// ── I14. 牙槽骨折 ──
EVENT_REGISTRY.push({
  id: 'injury_tooth',
  name: '牙槽骨折',
  weight: 15,
  condition: (ctx) => true,
  execute: (ctx) => {
    return { emoji:'🦷', title:'牙槽骨折', body:'你在争抢中被对方肘部击中了嘴巴——你吐出了半颗牙齿和一嘴血。队医把你带到更衣室止血，牙医检查后发现牙槽骨有轻微骨折。你需要在休赛期做牙科手术，目前只能吃流食。你缺席{n}场比赛。', desc:'牙齿受伤', _consequence:'injury', _games:(1 + Math.floor(Math.random() * 3)) };
  },
});

// ── I15. 腿筋三级拉伤（重伤） ──
EVENT_REGISTRY.push({
  id: 'injury_major_hamstring',
  name: '腿筋三级拉伤',
  weight: 1,
  majorInjury: true,
  condition: (ctx) => true,
  execute: (ctx) => {
    var games = 22 + Math.floor(Math.random() * 12);
    return { emoji:'🏥', title:'腿筋三级拉伤', body:'你在一次反击冲刺中突然停住，右手立刻摸向大腿后侧。回放里没有对抗，只有你起速那一下身体明显一顿。MRI结果显示腿筋三级拉伤，队医给出的恢复周期接近两个月。球队宣布你将缺席{n}场比赛，所有训练计划都要重新排。', desc:'腿筋三级拉伤', _consequence:'injury', _games:games, _majorInjury:true };
  },
});

// ── I16. 足部应力性骨折（重伤） ──
EVENT_REGISTRY.push({
  id: 'injury_major_foot_fracture',
  name: '足部应力性骨折',
  weight: 1,
  majorInjury: true,
  condition: (ctx) => true,
  execute: (ctx) => {
    var games = 32 + Math.floor(Math.random() * 14);
    return { emoji:'🩼', title:'足部应力性骨折', body:'最近几周你的脚一直隐隐作痛，你以为只是疲劳，直到一次落地后疼痛直接钻到脚背。进一步检查显示足部出现应力性骨折，队医要求你立刻停止高强度训练。你至少要休养{n}场比赛，这段时间只能做低冲击康复。', desc:'足部应力性骨折', _consequence:'injury', _games:games, _majorInjury:true };
  },
});

// ── I17. 膝盖半月板手术（赛季级重伤） ──
EVENT_REGISTRY.push({
  id: 'injury_major_meniscus_surgery',
  name: '膝盖半月板手术',
  weight: 1,
  majorInjury: true,
  condition: (ctx) => true,
  execute: (ctx) => {
    var games = getSeasonEndingInjuryGamesLeft();
    return { emoji:'🚑', title:'膝盖半月板手术', body:'你在一次急停转身后坐在地上很久没有起来。队友围过来时，你只是摇头。检查结果出来后，更衣室安静得可怕：半月板撕裂，需要手术处理。球队随后宣布你将缺席本赛季剩余比赛，接下来的一切都从康复室重新开始。', desc:'膝盖半月板手术', _consequence:'injury', _games:games, _majorInjury:true };
  },
});

