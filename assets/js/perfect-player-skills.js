/* Perfect Player — 球风技能
 * 本生涯球风点 + 属性门槛技能。存档只记已购等级，生效等级每次用 STATE.attrs 现场算。
 */
(function (global) {
  'use strict';

  var SKILL_COSTS = [0, 3, 5, 10];
  var SKILL_MULT = {
    1: { mu: 1.05, sigma: 0.04, lo: 0.97, hi: 1.13 },
    2: { mu: 1.09, sigma: 0.055, lo: 0.98, hi: 1.20 },
    3: { mu: 1.13, sigma: 0.07, lo: 0.99, hi: 1.28 },
    4: { mu: 1.21, sigma: 0.085, lo: 1.00, hi: 1.36 }
  };
  var SEASON_POINT_CAP = 12;

  /** 梦境挑战击败传奇队后可解锁第四级的球风技能 */
  var LEGEND_TIER_SKILL_IDS = {
    cold_arrow: true,
    off_ball: true,
    tempo_master: true,
    pnr_maestro: true,
    post_bully: true,
    dunk_threat: true,
    ice_ft: true,
    clutch_heart: true,
    mid_craftsman: true,
    steal_instinct: true
  };

  var STYLE_SKILLS = [
    {
      id: 'cold_arrow', icon: '🎯', name: '冷箭', group: '投射', max: 3,
      desc: '更多三分出手，投得更准，每晚仍有起伏。',
      reqs: [
        null,
        [{ key: 'threePT', min: 80 }],
        [{ key: 'threePT', min: 88 }],
        [{ key: 'threePT', min: 93 }],
        [{ key: 'threePT', min: 96 }]
      ]
    },
    {
      id: 'mid_craftsman', icon: '🎯', name: '中距离工匠', group: '投射', max: 3,
      desc: '提高中投占比与命中，并减轻内线防守对中投的压制。',
      reqs: [
        null,
        [{ key: 'MID', min: 80 }],
        [{ key: 'MID', min: 86 }],
        [{ key: 'MID', min: 92 }],
        [{ key: 'MID', min: 96 }]
      ]
    },
    {
      id: 'off_ball', icon: '🏃', name: '无球跑动', group: '投射', max: 3,
      desc: '略降球权占用，提高投篮命中。适合侧翼接球就投。',
      reqs: [
        null,
        [{ key: 'threePT', min: 75 }, { key: 'CLU', min: 70 }],
        [{ key: 'threePT', min: 82 }, { key: 'CLU', min: 76 }],
        [{ key: 'threePT', min: 88 }, { key: 'CLU', min: 82 }],
        [{ key: 'threePT', min: 90 }, { key: 'CLU', min: 86 }]
      ]
    },
    {
      id: 'finisher', icon: '💥', name: '杀伤', group: '终结', max: 3,
      desc: '更容易造犯规走上罚球线，每晚仍有起伏。',
      reqs: [
        null,
        [{ key: 'FIN', min: 80 }, { key: 'STR', min: 70 }],
        [{ key: 'FIN', min: 86 }, { key: 'STR', min: 76 }],
        [{ key: 'FIN', min: 92 }, { key: 'STR', min: 82 }]
      ]
    },
    {
      id: 'dunk_threat', icon: '🚀', name: '爆扣威慑', group: '终结', max: 3,
      desc: '提高禁区出手与终结，并略微增加护框存在感。',
      reqs: [
        null,
        [{ key: 'DNK', min: 80 }, { key: 'ATH', min: 76 }],
        [{ key: 'DNK', min: 86 }, { key: 'ATH', min: 82 }],
        [{ key: 'DNK', min: 92 }, { key: 'ATH', min: 88 }],
        [{ key: 'DNK', min: 96 }, { key: 'ATH', min: 92 }]
      ]
    },
    {
      id: 'post_bully', icon: '🏔️', name: '背身肉搏', group: '终结', max: 3,
      desc: '提高内线出手，略微放慢回合。',
      reqs: [
        null,
        [{ key: 'STR', min: 80 }, { key: 'IDEF', min: 70 }],
        [{ key: 'STR', min: 86 }, { key: 'IDEF', min: 76 }],
        [{ key: 'STR', min: 92 }, { key: 'IDEF', min: 82 }],
        [{ key: 'STR', min: 96 }, { key: 'IDEF', min: 88 }]
      ]
    },
    {
      id: 'tempo_master', icon: '🎩', name: '节奏大师', group: '组织', max: 3,
      desc: '提高助攻、降低失误，并略微加快回合。',
      reqs: [
        null,
        [{ key: 'PAS', min: 80 }, { key: 'HAN', min: 76 }],
        [{ key: 'PAS', min: 86 }, { key: 'HAN', min: 82 }],
        [{ key: 'PAS', min: 92 }, { key: 'HAN', min: 88 }],
        [{ key: 'PAS', min: 96 }, { key: 'HAN', min: 92 }]
      ]
    },
    {
      id: 'pnr_maestro', icon: '🔀', name: '挡拆指挥', group: '组织', max: 3,
      desc: '略微提高球队进攻效率，把挡拆变成稳定得分来源。',
      reqs: [
        null,
        [{ key: 'PAS', min: 78 }, { key: 'CLU', min: 75 }],
        [{ key: 'PAS', min: 84 }, { key: 'CLU', min: 81 }],
        [{ key: 'PAS', min: 90 }, { key: 'CLU', min: 87 }],
        [{ key: 'PAS', min: 94 }, { key: 'CLU', min: 90 }]
      ]
    },
    {
      id: 'fast_break', icon: '⚡', name: '快攻推进', group: '组织', max: 3,
      desc: '回合更快，更爱转换冲击篮下。',
      reqs: [
        null,
        [{ key: 'HAN', min: 80 }, { key: 'ATH', min: 76 }],
        [{ key: 'HAN', min: 86 }, { key: 'ATH', min: 82 }],
        [{ key: 'HAN', min: 92 }, { key: 'ATH', min: 88 }]
      ]
    },
    {
      id: 'perimeter_lock', icon: '🔒', name: '外线锁', group: '防守', max: 3,
      desc: '提高抢断，并略微增强对位压迫。',
      reqs: [
        null,
        [{ key: 'PDEF', min: 80 }],
        [{ key: 'PDEF', min: 86 }],
        [{ key: 'PDEF', min: 92 }]
      ]
    },
    {
      id: 'rim_protector', icon: '🪵', name: '护框', group: '防守', max: 3,
      desc: '提高盖帽，并略微增强球队内线防守。',
      reqs: [
        null,
        [{ key: 'BLK', min: 80 }, { key: 'IDEF', min: 76 }],
        [{ key: 'BLK', min: 86 }, { key: 'IDEF', min: 82 }],
        [{ key: 'BLK', min: 92 }, { key: 'IDEF', min: 88 }]
      ]
    },
    {
      id: 'steal_instinct', icon: '👁️', name: '抢断预感', group: '防守', max: 3,
      desc: '提高抢断；赌博式抄截会略微增加失误。',
      reqs: [
        null,
        [{ key: 'PDEF', min: 78 }, { key: 'ATH', min: 75 }],
        [{ key: 'PDEF', min: 84 }, { key: 'ATH', min: 81 }],
        [{ key: 'PDEF', min: 90 }, { key: 'ATH', min: 87 }],
        [{ key: 'PDEF', min: 94 }, { key: 'ATH', min: 90 }]
      ]
    },
    {
      id: 'box_out', icon: '🧱', name: '卡位野兽', group: '蓝领', max: 3,
      desc: '提高篮板，并略微增加出场时间。',
      reqs: [
        null,
        [{ key: 'REB', min: 80 }, { key: 'STR', min: 72 }],
        [{ key: 'REB', min: 86 }, { key: 'STR', min: 78 }],
        [{ key: 'REB', min: 92 }, { key: 'STR', min: 84 }]
      ]
    },
    {
      id: 'iron_man', icon: '💪', name: '铁人', group: '蓝领', max: 3,
      desc: '降低伤病概率，并减轻背靠背疲劳。',
      reqs: [
        null,
        [{ key: 'ATH', min: 75 }],
        [{ key: 'ATH', min: 82 }],
        [{ key: 'ATH', min: 88 }]
      ]
    },
    {
      id: 'clutch_heart', icon: '❄️', name: '大心脏', group: '精神', max: 3,
      desc: '胶着时刻投篮和罚球更稳。',
      reqs: [
        null,
        [{ key: 'CLU', min: 80 }],
        [{ key: 'CLU', min: 86 }],
        [{ key: 'CLU', min: 92 }],
        [{ key: 'CLU', min: 96 }]
      ]
    },
    {
      id: 'leader_aura', icon: '👑', name: '领袖光环', group: '精神', max: 3,
      desc: '降低状态波动对球队和手感的伤害，比赛更稳。',
      reqs: [
        null,
        [{ key: 'CLU', min: 70 }, { key: 'PAS', min: 70 }, { key: 'leadership', min: 3, from: 'profile' }],
        [{ key: 'CLU', min: 78 }, { key: 'PAS', min: 76 }, { key: 'leadership', min: 7, from: 'profile' }],
        [{ key: 'CLU', min: 86 }, { key: 'PAS', min: 82 }, { key: 'leadership', min: 12, from: 'profile' }]
      ]
    },
    {
      id: 'ice_ft', icon: '🧊', name: '冷血罚球', group: '精神', max: 3,
      desc: '罚球更稳，每晚仍有起伏。',
      reqs: [
        null,
        [{ key: 'CLU', min: 78 }],
        [{ key: 'CLU', min: 84 }],
        [{ key: 'CLU', min: 90 }],
        [{ key: 'CLU', min: 94 }]
      ]
    }
  ];
  var SKILL_MAP = {};
  STYLE_SKILLS.forEach(function (s) { SKILL_MAP[s.id] = s; });

  var PROFILE_LABELS = {
    leadership: '领导力',
    lockerRoomTrust: '更衣室信任',
    coachTrust: '教练信任'
  };

  function attrLabel(key) {
    if (PROFILE_LABELS[key]) return PROFILE_LABELS[key];
    try { if (typeof attrCN === 'function') return attrCN(key); } catch (e) {}
    try {
      if (typeof EVENT_ATTRIBUTE_LABELS !== 'undefined' && EVENT_ATTRIBUTE_LABELS[key]) {
        return EVENT_ATTRIBUTE_LABELS[key];
      }
    } catch (e) {}
    return key;
  }

  function liveAttrs() {
    try {
      var s = (typeof STATE !== 'undefined') ? STATE : global.STATE;
      return (s && s.attrs) || {};
    } catch (e) { return {}; }
  }

  function liveCareer() {
    try {
      var s = (typeof STATE !== 'undefined') ? STATE : global.STATE;
      return s && s.career;
    } catch (e) { return null; }
  }

  function liveProfile() {
    try {
      var c = liveCareer();
      return (c && c.profile) || {};
    } catch (e) { return {}; }
  }

  function reqCurrent(req, attrs) {
    if (!req) return 0;
    if (req.from === 'profile') {
      var profile = liveProfile();
      return Number(profile[req.key]) || 0;
    }
    attrs = attrs || liveAttrs();
    return Number(attrs[req.key]) || 0;
  }

  function ensureSkillState() {
    var c = liveCareer();
    if (!c) return { points: 0, earned: 0, purchased: {}, lastGrant: null };
    if (!c.skills || typeof c.skills !== 'object') {
      c.skills = { points: 0, earned: 0, purchased: {}, lastGrant: null };
    }
    c.skills.points = Number(c.skills.points) || 0;
    c.skills.earned = Number(c.skills.earned) || 0;
    c.skills.purchased = c.skills.purchased || {};
    return c.skills;
  }

  function meetsReqs(reqs, attrs) {
    if (!reqs || !reqs.length) return true;
    for (var i = 0; i < reqs.length; i++) {
      var req = reqs[i];
      if (reqCurrent(req, attrs) < req.min) return false;
    }
    return true;
  }

  function legendChallengeFlags() {
    var c = liveCareer();
    if (!c || !c.flags || !c.flags.legendChallenge) return null;
    return c.flags.legendChallenge;
  }

  function isLegendTierUnlocked(id) {
    if (!LEGEND_TIER_SKILL_IDS[id]) return false;
    var f = legendChallengeFlags();
    return !!(f && f.skillUnlocks && f.skillUnlocks[id]);
  }

  function getSkillMax(id) {
    var def = SKILL_MAP[id];
    if (!def) return 0;
    if (isLegendTierUnlocked(id)) return 4;
    return def.max || 3;
  }

  function syncLegendPurchasedFromUnlocks() {
    var st = ensureSkillState();
    Object.keys(LEGEND_TIER_SKILL_IDS).forEach(function (id) {
      if (!isLegendTierUnlocked(id)) return;
      if ((Number(st.purchased[id]) || 0) >= 3) st.purchased[id] = 4;
    });
  }

  function grantLegendTierUnlock(id) {
    if (!LEGEND_TIER_SKILL_IDS[id]) return false;
    var c = liveCareer();
    if (!c) return false;
    c.flags = c.flags || {};
    c.flags.legendChallenge = c.flags.legendChallenge || {};
    c.flags.legendChallenge.skillUnlocks = c.flags.legendChallenge.skillUnlocks || {};
    c.flags.legendChallenge.skillUnlocks[id] = true;
    var st = ensureSkillState();
    if ((Number(st.purchased[id]) || 0) >= 3) st.purchased[id] = 4;
    return true;
  }

  function getSkillDisplayName(id) {
    var def = SKILL_MAP[id];
    return (def && def.name) || id;
  }

  function maxAffordableByAttrs(def, attrs) {
    def = def || {};
    var cap = getSkillMax(def.id);
    var max = 0;
    for (var lv = 1; lv <= cap; lv++) {
      if (!meetsReqs(def.reqs && def.reqs[lv], attrs)) break;
      max = lv;
    }
    return max;
  }

  function getPurchasedLevel(id) {
    var st = ensureSkillState();
    var cap = getSkillMax(id);
    return Math.max(0, Math.min(cap, Number(st.purchased[id]) || 0));
  }

  function getEffectiveSkillLevel(id) {
    var def = SKILL_MAP[id];
    if (!def) return 0;
    var purchased = Number(ensureSkillState().purchased[id]) || 0;
    if (purchased >= 4) return purchased;
    return Math.min(purchased, maxAffordableByAttrs(def, liveAttrs()));
  }

  function skillCost(nextLevel) {
    return SKILL_COSTS[nextLevel] || Infinity;
  }

  function availableStylePoints() {
    return Math.max(0, ensureSkillState().points);
  }

  function inspectStyleSkill(def) {
    var attrs = liveAttrs();
    var skillMax = getSkillMax(def.id);
    var purchased = Number(ensureSkillState().purchased[def.id]) || 0;
    var effective = getEffectiveSkillLevel(def.id);
    var next = purchased + 1;
    var retired = false;
    try { retired = !!(liveCareer() && liveCareer().retired); } catch (e) {}
    var legendFreeFour = next === 4 && isLegendTierUnlocked(def.id);
    var nextReqs = def.reqs[next] || [];
    var canAffordAttrs = !retired && next <= skillMax && (legendFreeFour || meetsReqs(nextReqs, attrs));
    var cost = next <= skillMax ? (legendFreeFour ? 0 : skillCost(next)) : 0;
    var canBuy = canAffordAttrs && (legendFreeFour || availableStylePoints() >= cost);
    var conds = [];
    var showLv;
    if (purchased >= 4) showLv = 4;
    else if (purchased > effective && purchased > 0) showLv = purchased;
    else showLv = Math.min(skillMax, Math.max(1, next <= skillMax ? next : skillMax));
    (def.reqs[showLv] || []).forEach(function (req) {
      var cur = reqCurrent(req, attrs);
      conds.push({
        ok: cur >= req.min,
        text: attrLabel(req.key) + ' ' + cur + ' / ' + req.min
      });
    });
    var status;
    if (purchased <= 0 && effective <= 0) status = canBuy ? '可激活' : (canAffordAttrs ? '球风点不足' : '未点亮');
    else if (purchased >= 4) status = '满级';
    else if (effective < purchased) status = '降效 Lv.' + effective;
    else if (purchased >= skillMax) status = '满级';
    else if (canBuy) status = '可升级';
    else if (canAffordAttrs) status = '球风点不足';
    else status = '属性未达标';
    var EFFECT_TONE = {
      1: '这套打法开始起作用，变化还不夸张。',
      2: '这套打法已经明显更强，每晚仍有起伏。',
      3: '这套打法已经很稳，偶尔还能爆发。',
      4: '这套打法已登峰造极，不再受属性波动影响。'
    };
    var effect;
    if (effective >= 4) effect = EFFECT_TONE[4];
    else if (effective > 0) effect = EFFECT_TONE[effective] || EFFECT_TONE[1];
    else if (purchased > 0) effect = '已购买，但当前条件不够，这套打法暂时休眠。';
    else effect = '激活后立即生效。';
    return {
      id: def.id,
      icon: def.icon,
      name: def.name,
      group: def.group,
      desc: def.desc,
      max: skillMax,
      purchased: purchased,
      level: effective,
      effective: effective,
      eligible: maxAffordableByAttrs(def, attrs) > purchased || purchased > 0,
      activated: effective > 0,
      canUpgrade: canBuy,
      canBuy: canBuy,
      cost: cost,
      next: next,
      status: status,
      effect: effect,
      conds: conds,
      tokenSkill: true
    };
  }

  function listStyleSkills() {
    return STYLE_SKILLS.map(inspectStyleSkill);
  }

  function buyStyleSkill(id) {
    var def = SKILL_MAP[id];
    if (!def) return { ok: false, reason: '未知技能' };
    var st = ensureSkillState();
    var skillMax = getSkillMax(id);
    var purchased = Number(st.purchased[id]) || 0;
    if (purchased >= skillMax) return { ok: false, reason: '已满级' };
    if (liveCareer() && liveCareer().retired) return { ok: false, reason: '生涯已结束' };
    var next = purchased + 1;
    var legendFreeFour = next === 4 && isLegendTierUnlocked(id);
    if (!legendFreeFour && !meetsReqs(def.reqs[next], liveAttrs())) return { ok: false, reason: '属性未达标' };
    var cost = legendFreeFour ? 0 : skillCost(next);
    if (!legendFreeFour && st.points < cost) return { ok: false, reason: '球风点不足' };
    if (cost > 0) st.points -= cost;
    st.purchased[id] = next;
    return { ok: true, level: next, cost: cost, points: st.points };
  }

  function rollSkillMultiplier(level) {
    var spec = SKILL_MULT[level];
    if (!spec) return 1;
    var sample = (typeof simGaussian === 'function') ? simGaussian(spec.mu, spec.sigma) : spec.mu;
    return Math.max(spec.lo, Math.min(spec.hi, sample));
  }

  function getStyleSkillMu(id) {
    var lv = getEffectiveSkillLevel(id);
    return (SKILL_MULT[lv] && SKILL_MULT[lv].mu) || 1;
  }

  function getStyleSkillRoll(id) {
    return rollSkillMultiplier(getEffectiveSkillLevel(id));
  }

  function snapshotEffectiveLevels() {
    var map = {};
    STYLE_SKILLS.forEach(function (s) { map[s.id] = getEffectiveSkillLevel(s.id); });
    return map;
  }

  function skillLevelChangeNotes(before) {
    var notes = [];
    if (!before) return notes;
    STYLE_SKILLS.forEach(function (s) {
      var purchased = Number(ensureSkillState().purchased[s.id]) || 0;
      if (purchased >= 4) return;
      var prev = Number(before[s.id]) || 0;
      var after = getEffectiveSkillLevel(s.id);
      if (after < prev) notes.push(s.name + ' Lv.' + prev + ' → Lv.' + after + '（属性回落，已购等级保留）');
      else if (after > prev && purchased >= after) notes.push(s.name + ' 恢复为 Lv.' + after);
    });
    return notes;
  }

  function userAwardLabels() {
    var s = (typeof STATE !== 'undefined') ? STATE : global.STATE;
    var awards = (s && s.season && s.season.awards) || [];
    var labels = [];
    awards.forEach(function (a) {
      if (typeof a === 'string') labels.push(a);
      else if (a && a.isUser) labels.push(a.userHonorLabel || a.label || '');
    });
    return labels.join(' ');
  }

  function scoringTier(ppg) {
    if (ppg >= 24) return 3;
    if (ppg >= 18) return 2;
    if (ppg >= 12) return 1;
    return 0;
  }
  function playmakingTier(apg) {
    if (apg >= 8) return 3;
    if (apg >= 6) return 2;
    if (apg >= 4) return 1;
    return 0;
  }
  function blueCollarTier(rpg, spg, bpg) {
    if (rpg >= 12 || spg >= 2.0 || bpg >= 1.6) return 3;
    if (rpg >= 10 || spg >= 1.6 || bpg >= 1.2) return 2;
    if (rpg >= 7 || spg >= 1.2 || bpg >= 0.8) return 1;
    return 0;
  }

  function playoffHighlightPoints() {
    var s = (typeof STATE !== 'undefined') ? STATE : global.STATE;
    if (!s || !s.season || !s.season.playoffBracket || !s.season.playoffBracket.results) return 0;
    var myResults = s.season.playoffBracket.results.filter(function (r) { return r.isMySeries; });
    if (!myResults.length) return 0;
    var wins = 0;
    var maxRound = 0;
    var champion = !!s.season.isChampion;
    myResults.forEach(function (r) {
      maxRound = Math.max(maxRound, Number(r.round) || 0);
      var userWon = r.teamA === s.careerTeam ? r.aWon : !r.aWon;
      if (userWon) wins++;
      if (r.round === 3 && userWon) champion = true;
    });
    var pts = 0;
    if (wins >= 1) pts += 1;
    if (maxRound >= 2) pts += 1;
    if (champion) pts += 1;
    return Math.min(3, pts);
  }

  function computeSeasonStyleGrant() {
    var s = (typeof STATE !== 'undefined') ? STATE : global.STATE;
    if (!s || !s.season) return { total: 0, parts: [] };
    if (typeof calcSeasonAwards === 'function' && (!s.season.awards || !s.season.awards.length)) {
      try { calcSeasonAwards(); } catch (e) {}
    }
    var ps = s.season.playerStats || {};
    var gp = Number(ps.games) || 0;
    var ppg = gp ? (Number(ps.pts) || 0) / gp : 0;
    var rpg = gp ? (Number(ps.reb) || 0) / gp : 0;
    var apg = gp ? (Number(ps.ast) || 0) / gp : 0;
    var spg = gp ? (Number(ps.stl) || 0) / gp : 0;
    var bpg = gp ? (Number(ps.blk) || 0) / gp : 0;

    var appear = 0;
    if (gp >= 20) appear += 1;
    if (gp >= 40) appear += 1;
    if (gp >= 60) appear += 1;
    if (gp >= 72) appear += 1;

    var play = Math.min(3, scoringTier(ppg) + playmakingTier(apg) + blueCollarTier(rpg, spg, bpg));

    var labels = userAwardLabels();
    var highlight = 0;
    var honor = 0;
    if (labels.indexOf('全明星') >= 0) honor = Math.max(honor, 1);
    if (labels.indexOf('最佳阵容') >= 0 || labels.indexOf('最佳防守阵容') >= 0) honor = Math.max(honor, 2);
    if (labels.indexOf('MVP') >= 0 || labels.indexOf('DPOY') >= 0 || labels.indexOf('最佳第六人') >= 0 || labels.indexOf('最佳新秀') >= 0) {
      honor = Math.max(honor, 3);
    }
    highlight += honor;
    highlight += playoffHighlightPoints();
    highlight = Math.min(5, highlight);

    var raw = appear + play + highlight;
    var total = Math.min(SEASON_POINT_CAP, raw);
    return {
      total: total,
      parts: [
        { key: 'appear', label: '出场', amount: appear },
        { key: 'play', label: '表现', amount: play },
        { key: 'highlight', label: '高光', amount: highlight }
      ],
      capped: raw > SEASON_POINT_CAP
    };
  }

  function grantSeasonStylePoints() {
    var s = (typeof STATE !== 'undefined') ? STATE : global.STATE;
    if (!s || !s.season || !s.career) return null;
    if (s.season._stylePointsGranted) return s.career.skills && s.career.skills.lastGrant;
    var grant = computeSeasonStyleGrant();
    var st = ensureSkillState();
    st.points += grant.total;
    st.earned += grant.total;
    st.lastGrant = grant;
    s.season._stylePointsGranted = true;
    return grant;
  }

  function formatGrantLine(grant) {
    grant = grant || (ensureSkillState().lastGrant);
    if (!grant) return '';
    var bits = (grant.parts || []).map(function (p) { return p.label + '+' + p.amount; });
    return '本季球风点 +' + grant.total + (bits.length ? '（' + bits.join(' · ') + '）' : '');
  }

  global.PP_SKILLS = {
    STYLE_SKILLS: STYLE_SKILLS,
    SKILL_COSTS: SKILL_COSTS,
    SKILL_MULT: SKILL_MULT,
    ensureSkillState: ensureSkillState,
    getPurchasedLevel: getPurchasedLevel,
    getEffectiveSkillLevel: getEffectiveSkillLevel,
    getStyleSkillMu: getStyleSkillMu,
    getStyleSkillRoll: getStyleSkillRoll,
    availableStylePoints: availableStylePoints,
    buyStyleSkill: buyStyleSkill,
    listStyleSkills: listStyleSkills,
    inspectStyleSkill: inspectStyleSkill,
    snapshotEffectiveLevels: snapshotEffectiveLevels,
    skillLevelChangeNotes: skillLevelChangeNotes,
    grantSeasonStylePoints: grantSeasonStylePoints,
    computeSeasonStyleGrant: computeSeasonStyleGrant,
    formatGrantLine: formatGrantLine,
    skillCost: skillCost,
    getSkillMax: getSkillMax,
    isLegendTierUnlocked: isLegendTierUnlocked,
    grantLegendTierUnlock: grantLegendTierUnlock,
    syncLegendPurchasedFromUnlocks: syncLegendPurchasedFromUnlocks,
    getSkillDisplayName: getSkillDisplayName,
    LEGEND_TIER_SKILL_IDS: LEGEND_TIER_SKILL_IDS
  };
  global.getEffectiveSkillLevel = getEffectiveSkillLevel;
  global.getStyleSkillMu = getStyleSkillMu;
  global.getStyleSkillRoll = getStyleSkillRoll;
  global.grantSeasonStylePoints = grantSeasonStylePoints;
})(typeof window !== 'undefined' ? window : this);
