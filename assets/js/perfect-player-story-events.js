(function () {
  'use strict';

  if (typeof STAGED_BRANCH_EVENTS === 'undefined') return;

  var MOD_BOUNDS = {
    injuryRiskBonus: [-4, 8], formVariance: [-10, 10], teamChemistry: [-10, 10],
    moraleBonus: [-10, 10], mediaPressure: [-10, 10], staminaLoad: [-10, 10]
  };

  var DERBY_MAP = {
    LAL: 'LAC', LAC: 'LAL',
    NYK: 'BKN', BKN: 'NYK',
    GSW: 'SAC', SAC: 'GSW',
    BOS: 'PHI', PHI: 'BOS',
    MIA: 'ORL', ORL: 'MIA',
    CHI: 'MIL', MIL: 'CHI',
    DAL: 'HOU', HOU: 'DAL',
    DEN: 'UTA', UTA: 'DEN',
    SAS: 'MEM', MEM: 'SAS',
    PHX: 'LAC',
    OKC: 'MIN', MIN: 'OKC',
    POR: 'GSW',
    ATL: 'CHA', CHA: 'ATL',
    CLE: 'DET', DET: 'CLE',
    IND: 'MIL',
    TOR: 'BOS',
    WAS: 'PHI',
    NOP: 'HOU'
  };

  var HOMETOWN_POOL = ['东莞', '上海', '北京', '辽宁', '浙江', '新疆', '佛山', '吉林', '山东', '泉州', '深圳', '南京'];

  var LEGEND_POOL = {
    PG: [
      { id: 'nash', name: '史蒂夫·纳什', city: '凤凰城', teams: ['PHX', 'DAL'], line: '跑轰节奏和传球角度', quote: '别先看筐，先看弱侧那个人会跑去哪。', attr: 'PAS', attr2: 'HAN' },
      { id: 'kidd', name: '杰森·基德', city: '新泽西', teams: ['BKN', 'DAL'], line: '推进、篮板和把所有人带进快攻', quote: '控卫的第一任务不是自己进，是让比赛先流动起来。', attr: 'PAS', attr2: 'REB' },
      { id: 'stockton', name: '约翰·斯托克顿', city: '盐湖城', teams: ['UTA'], line: '挡拆停顿和精准出球', quote: '最好的传球，是让防守人以为你还会再停一秒。', attr: 'PAS', attr2: 'HAN' },
      { id: 'thomas', name: '伊赛亚·托马斯', city: '底特律', teams: ['DET'], line: '关键时刻的强硬', quote: '最后两分钟不要找手感，找对方最怕的点。', attr: 'CLU', attr2: 'HAN' },
      { id: 'payton', name: '加里·佩顿', city: '西雅图', teams: ['OKC'], line: '手套式外线压迫', quote: '垃圾话只是配菜，让他运球不舒服才是正餐。', attr: 'PDEF', attr2: 'HAN' }
    ],
    SG: [
      { id: 'kobe', name: '科比·布莱恩特', city: '洛杉矶', teams: ['LAL'], line: '曼巴式中距离和凌晨加练', quote: '别人睡觉的时候，你得先把明天的投篮投完。', attr: 'MID', attr2: 'CLU', china: true },
      { id: 'jordan', name: '迈克尔·乔丹', city: '芝加哥', teams: ['CHI'], line: '必胜之心和中距离杀招', quote: '你要让对面知道，今晚没有第二种结局。', attr: 'CLU', attr2: 'MID' },
      { id: 'iverson', name: '艾伦·艾弗森', city: '费城', teams: ['PHI'], line: '答案式变向和心脏', quote: '个子不是借口。你怕疼，就别想让任何人怕你。', attr: 'HAN', attr2: 'ATH' },
      { id: 'wade', name: '德怀恩·韦德', city: '迈阿密', teams: ['MIA'], line: '闪电侠式终结和节奏变化', quote: '第一步可以骗人，最后一步必须能扛住人。', attr: 'FIN', attr2: 'HAN' },
      { id: 'miller', name: '雷吉·米勒', city: '印第安纳', teams: ['IND'], line: '冷血三分和嘴炮', quote: '看台越吵，你越该把球举起来。', attr: 'threePT', attr2: 'CLU' }
    ],
    SF: [
      { id: 'bird', name: '拉里·伯德', city: '波士顿', teams: ['BOS'], line: '预判、传球和垃圾话', quote: '你可以告诉他下一球进哪儿，然后再进那儿。', attr: 'PAS', attr2: 'threePT' },
      { id: 'pippen', name: '斯科蒂·皮蓬', city: '芝加哥', teams: ['CHI'], line: '侧翼防守和串联', quote: '防守不是赌抢断，是让他从接球开始就不舒服。', attr: 'PDEF', attr2: 'PAS' },
      { id: 'tmac', name: '特雷西·麦克格雷迪', city: '奥兰多', teams: ['ORL', 'HOU'], line: '持球得分和中国缘分', quote: '别急着证明全能，先让一个区域变成你的。', attr: 'MID', attr2: 'ATH', china: true },
      { id: 'pierce', name: '保罗·皮尔斯', city: '波士顿', teams: ['BOS'], line: '关键时刻的冷静', quote: '真相很简单：球到你手里时，别先想帅。', attr: 'CLU', attr2: 'MID' },
      { id: 'melo', name: '卡梅罗·安东尼', city: '纽约', teams: ['NYK', 'DEN'], line: '单打脚步和中距离', quote: '清一侧，不代表蛮干。你要让防守围过来，再惩罚他们。', attr: 'MID', attr2: 'FIN' }
    ],
    PF: [
      { id: 'duncan', name: '蒂姆·邓肯', city: '圣安东尼奥', teams: ['SAS'], line: '基本功、护筐和无声领袖', quote: '赢球的动作往往不好看，但每晚都能做出来。', attr: 'IDEF', attr2: 'REB' },
      { id: 'dirk', name: '德克·诺维茨基', city: '达拉斯', teams: ['DAL'], line: '金鸡独立和空间型四号位', quote: '你要有一个别人学不像的终结动作。', attr: 'MID', attr2: 'threePT' },
      { id: 'kg', name: '凯文·加内特', city: '明尼苏达', teams: ['MIN', 'BOS'], line: '强度、沟通和篮板', quote: '你不大声，对面就会当这片油漆区没人。', attr: 'REB', attr2: 'PDEF' },
      { id: 'barkley', name: '查尔斯·巴克利', city: '凤凰城', teams: ['PHX', 'PHI', 'HOU'], line: '卡位和二次进攻', quote: '篮板不是跳得高，是先把人挡住。', attr: 'REB', attr2: 'STR' },
      { id: 'gasol', name: '保罗·加索尔', city: '孟菲斯', teams: ['MEM', 'LAL'], line: '高位策应和内线手感', quote: '大个能传球，禁区就会自己打开。', attr: 'PAS', attr2: 'FIN' }
    ],
    C: [
      { id: 'yao', name: '姚明', city: '休斯顿', teams: ['HOU'], line: '低位脚步、策应和中国球员的体面', quote: '你代表的不只是自己。脚步可以慢，选择不能乱。', attr: 'FIN', attr2: 'PAS', china: true },
      { id: 'hakeem', name: '哈基姆·奥拉朱旺', city: '休斯顿', teams: ['HOU'], line: '梦幻脚步和护筐', quote: '脚先骗人，球只是最后的证明。', attr: 'FIN', attr2: 'BLK' },
      { id: 'shaq', name: '沙奎尔·奥尼尔', city: '洛杉矶', teams: ['ORL', 'LAL', 'MIA'], line: '绝对力量和内线威慑', quote: '有些球不需要漂亮，往里坐就完了。', attr: 'STR', attr2: 'DNK' },
      { id: 'robinson', name: '大卫·罗宾逊', city: '圣安东尼奥', teams: ['SAS'], line: '机动护筐和纪律', quote: '天赋让你进联盟，习惯决定你能待多久。', attr: 'BLK', attr2: 'ATH' },
      { id: 'ewing', name: '帕特里克·尤因', city: '纽约', teams: ['NYK'], line: '要位、盖帽和硬仗', quote: '主场要你扛的时候，别把球让出去。', attr: 'REB', attr2: 'BLK' }
    ]
  };

  // 退役球衣升空用本队队史人物，不跟生涯绑定的跨队名宿混用。
  var TEAM_RAFTER_EXTRAS = {
    ATL: [{ id: 'wilkins', name: '多米尼克·威尔金斯', city: '亚特兰大' }, { id: 'mutombo', name: '迪肯贝·穆托姆博', city: '亚特兰大' }],
    BKN: [{ id: 'erving_nets', name: '朱利叶斯·欧文', city: '布鲁克林' }, { id: 'carter', name: '文斯·卡特', city: '布鲁克林' }],
    BOS: [{ id: 'russell', name: '比尔·拉塞尔', city: '波士顿' }],
    CHA: [{ id: 'bogues', name: '穆基·布拉洛克', city: '夏洛特' }, { id: 'rice', name: '格伦·莱斯', city: '夏洛特' }],
    CHI: [{ id: 'rodman', name: '丹尼斯·罗德曼', city: '芝加哥' }],
    CLE: [{ id: 'price', name: '马克·普莱斯', city: '克里夫兰' }, { id: 'ilgauskas', name: '扎德鲁纳斯·伊尔戈斯卡斯', city: '克里夫兰' }],
    DAL: [{ id: 'blackman', name: '罗兰多·布莱克曼', city: '达拉斯' }],
    DEN: [{ id: 'english', name: '亚历克斯·英格利什', city: '丹佛' }],
    DET: [{ id: 'dumars', name: '乔·杜马斯', city: '底特律' }, { id: 'wallace', name: '本·华莱士', city: '底特律' }],
    GSW: [{ id: 'barry', name: '里克·巴里', city: '金州' }, { id: 'mullin', name: '克里斯·穆林', city: '金州' }],
    HOU: [{ id: 'drexler_hou', name: '克莱德·德雷克斯勒', city: '休斯顿' }],
    IND: [{ id: 'mcdaniels', name: '梅尔·丹尼尔斯', city: '印第安纳' }],
    LAC: [{ id: 'mcadoo', name: '鲍勃·麦卡杜', city: '洛杉矶' }, { id: 'brand', name: '埃尔顿·布兰德', city: '洛杉矶' }],
    LAL: [{ id: 'magic', name: '魔术师约翰逊', city: '洛杉矶' }, { id: 'kareem', name: '卡里姆·阿卜杜勒-贾巴尔', city: '洛杉矶' }],
    MEM: [{ id: 'randolph', name: '扎克·兰多夫', city: '孟菲斯' }],
    MIA: [{ id: 'mourning', name: '阿朗佐·莫宁', city: '迈阿密' }, { id: 'hardaway', name: '蒂姆·哈达威', city: '迈阿密' }, { id: 'haslem', name: '尤多尼斯·哈斯勒姆', city: '迈阿密' }],
    MIL: [{ id: 'moncrief', name: '悉尼·蒙克里夫', city: '密尔沃基' }, { id: 'kareem_mil', name: '卡里姆·阿卜杜勒-贾巴尔', city: '密尔沃基' }],
    MIN: [{ id: 'love', name: '凯文·乐福', city: '明尼苏达' }],
    NOP: [{ id: 'maravich', name: '皮特·马拉维奇', city: '新奥尔良' }, { id: 'cp3', name: '克里斯·保罗', city: '新奥尔良' }],
    NYK: [{ id: 'frazier', name: '沃尔特·弗雷泽', city: '纽约' }, { id: 'reed', name: '威利斯·里德', city: '纽约' }],
    OKC: [{ id: 'kemp', name: '肖恩·坎普', city: '俄克拉荷马城' }, { id: 'collison', name: '尼克·科里森', city: '俄克拉荷马城' }],
    ORL: [{ id: 'penny', name: '安芬尼·哈达威', city: '奥兰多' }],
    PHI: [{ id: 'erving', name: '朱利叶斯·欧文', city: '费城' }],
    PHX: [{ id: 'kj', name: '凯文·约翰逊', city: '凤凰城' }],
    POR: [{ id: 'drexler', name: '克莱德·德雷克斯勒', city: '波特兰' }, { id: 'walton', name: '比尔·沃顿', city: '波特兰' }],
    SAC: [{ id: 'webber', name: '克里斯·韦伯', city: '萨克拉门托' }, { id: 'stojakovic', name: '佩贾·斯托贾科维奇', city: '萨克拉门托' }],
    SAS: [{ id: 'parker', name: '托尼·帕克', city: '圣安东尼奥' }, { id: 'ginobili', name: '马努·吉诺比利', city: '圣安东尼奥' }],
    TOR: [{ id: 'vince', name: '文斯·卡特', city: '多伦多' }, { id: 'lowry', name: '凯尔·洛瑞', city: '多伦多' }],
    UTA: [{ id: 'malone', name: '卡尔·马龙', city: '盐湖城' }],
    WAS: [{ id: 'unseld', name: '韦斯·昂塞尔德', city: '华盛顿' }, { id: 'hayes', name: '埃尔文·海耶斯', city: '华盛顿' }]
  };

  function ensureFlags() {
    if (!STATE.career) return {};
    STATE.career.flags = STATE.career.flags || {};
    return STATE.career.flags;
  }

  function playerPos() {
    return STATE.position || STATE.finalPosition || 'SF';
  }

  function posGroup(pos) {
    if (pos === 'PG' || pos === 'SG') return ['PG', 'SG'];
    if (pos === 'SG' || pos === 'SF') return ['SG', 'SF'];
    if (pos === 'SF') return ['SF', 'PF'];
    if (pos === 'PF') return ['PF', 'C', 'SF'];
    return ['C', 'PF'];
  }

  function playerNameOf(p) {
    return (p && (p.cname || p.name)) || '那位球星';
  }

  function applyStoryFx(fx) {
    fx = fx || {};
    if (fx.attrs) {
      Object.keys(fx.attrs).forEach(function (k) { addAttrDelta(k, fx.attrs[k]); });
      if (typeof calcOVR === 'function') STATE.finalOVR = calcOVR(STATE.attrs);
    }
    if (fx.profile) {
      Object.keys(fx.profile).forEach(function (k) { addProfileDelta(k, fx.profile[k]); });
    }
    if (fx.mods) {
      Object.keys(fx.mods).forEach(function (k) {
        var b = MOD_BOUNDS[k] || [-10, 10];
        addSeasonMod(k, fx.mods[k], b[0], b[1]);
      });
    }
    var text = fx.result || '';
    if (fx.tp && typeof applyEventTrainingGrant === 'function') {
      text = applyEventTrainingGrant(text, fx.tp);
    }
    return text;
  }

  function choiceApply(fx) {
    return function () { return applyStoryFx(fx); };
  }

  function findRosterStar(team, preferPos) {
    if (!team || typeof NBA2K_DATA === 'undefined') return null;
    var roster = NBA2K_DATA[team] || [];
    var group = posGroup(preferPos || playerPos());
    var best = null;
    roster.forEach(function (p) {
      if (!p || p._isUser) return;
      var ovr = parseInt(p.ovr, 10) || 0;
      if (ovr < 80) return;
      var pos = (typeof getPlayerMainPos === 'function') ? getPlayerMainPos(p) : (p.pos || 'SF');
      var bonus = group.indexOf(pos) >= 0 ? 6 : 0;
      var score = ovr + bonus;
      if (!best || score > best.score) {
        best = { name: p.name, cname: p.cname || p.name, team: team, pos: pos, ovr: ovr, score: score };
      }
    });
    return best;
  }

  function collectRivalCandidates() {
    var me = STATE.careerTeam;
    var myConf = typeof getConference === 'function' ? getConference(me) : '';
    var derby = DERBY_MAP[me];
    var group = posGroup(playerPos());
    var pool = [];
    if (typeof NBA2K_TEAMS === 'undefined' || typeof NBA2K_DATA === 'undefined') return pool;
    NBA2K_TEAMS.forEach(function (t) {
      if (t === me) return;
      var roster = NBA2K_DATA[t] || [];
      var confBonus = (myConf && typeof getConference === 'function' && getConference(t) === myConf) ? 4 : 0;
      var derbyBonus = t === derby ? 3 : 0;
      roster.forEach(function (p) {
        if (!p || p._isUser) return;
        var ovr = parseInt(p.ovr, 10) || 0;
        if (ovr < 82) return;
        var pos = (typeof getPlayerMainPos === 'function') ? getPlayerMainPos(p) : (p.pos || 'SF');
        var posMatch = group.indexOf(pos) >= 0;
        pool.push({
          name: p.name,
          cname: p.cname || p.name,
          team: t,
          pos: pos,
          ovr: ovr,
          score: ovr + (posMatch ? 8 : 0) + confBonus + derbyBonus
        });
      });
    });
    pool.sort(function (a, b) { return b.score - a.score; });
    return pool;
  }

  function pickWeightedRival(pool) {
    if (!pool || !pool.length) return null;
    var top = pool.slice(0, Math.min(14, pool.length));
    var floor = top[top.length - 1].score;
    var total = 0;
    var weights = [];
    var i, w, roll;
    for (i = 0; i < top.length; i++) {
      w = Math.pow(Math.max(1.6, top[i].score - floor + 2), 1.2);
      weights.push(w);
      total += w;
    }
    roll = Math.random() * total;
    for (i = 0; i < top.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return top[i];
    }
    return top[0];
  }

  function bindStoryRival() {
    var flags = ensureFlags();
    if (flags.storyRival && flags.storyRival.name) return flags.storyRival;
    var picked = pickWeightedRival(collectRivalCandidates());
    if (!picked) {
      picked = { name: 'Opposing Star', cname: '对面当家', team: 'BOS', pos: playerPos(), ovr: 88 };
    }
    flags.storyRival = {
      name: picked.name,
      cname: picked.cname,
      team: picked.team,
      pos: picked.pos,
      ovr: picked.ovr
    };
    return flags.storyRival;
  }

  function getStoryRival() {
    var flags = ensureFlags();
    return flags.storyRival || bindStoryRival();
  }

  function rivalName() {
    var r = getStoryRival();
    return (r && (r.cname || r.name)) || '对面当家';
  }

  function rivalTeamName() {
    var r = getStoryRival();
    return (r && r.team && typeof getTeamName === 'function') ? getTeamName(r.team) : '对面';
  }

  function divisionMate(team) {
    var divisions = (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.DIVISIONS) || {};
    var keys = Object.keys(divisions);
    for (var i = 0; i < keys.length; i++) {
      var list = divisions[keys[i]] || [];
      if (list.indexOf(team) < 0) continue;
      for (var j = 0; j < list.length; j++) {
        if (list[j] !== team) return list[j];
      }
    }
    return null;
  }

  function bindStoryDerby() {
    var flags = ensureFlags();
    if (flags.storyDerby && flags.storyDerby.team) return flags.storyDerby;
    var team = STATE.careerTeam;
    var opp = DERBY_MAP[team] || divisionMate(team) || 'BOS';
    if (opp === team) opp = divisionMate(team) || 'NYK';
    var star = findRosterStar(opp, playerPos());
    flags.storyDerby = {
      team: opp,
      teamName: typeof getTeamName === 'function' ? getTeamName(opp) : opp,
      starName: star ? (star.cname || star.name) : '对方当家',
      city: typeof getTeamName === 'function' ? getTeamName(team) : team
    };
    return flags.storyDerby;
  }

  function getStoryDerby() {
    return ensureFlags().storyDerby || bindStoryDerby();
  }

  function bindStoryLegend() {
    var flags = ensureFlags();
    if (flags.storyLegend && flags.storyLegend.name) return flags.storyLegend;
    var pos = playerPos();
    var pool = (LEGEND_POOL[pos] || LEGEND_POOL.SF).slice();
    var chinaPool = pool.filter(function (item) { return item.china; });
    var pick;
    if (chinaPool.length && Math.random() < 0.55) pick = chinaPool[Math.floor(Math.random() * chinaPool.length)];
    else pick = pool[Math.floor(Math.random() * pool.length)];
    flags.storyLegend = pick;
    return pick;
  }

  function getStoryLegend() {
    return ensureFlags().storyLegend || bindStoryLegend();
  }

  function currentCareerTeam() {
    return STATE.careerTeam || '';
  }

  function legendOnTeam(legend, team) {
    return !!(legend && team && legend.teams && legend.teams.indexOf(team) >= 0);
  }

  function rafterPoolForTeam(team) {
    var pool = [];
    var seen = {};
    function add(star) {
      if (!star || !star.name || seen[star.id || star.name]) return;
      seen[star.id || star.name] = true;
      pool.push(star);
    }
    Object.keys(LEGEND_POOL).forEach(function (pos) {
      LEGEND_POOL[pos].forEach(function (legend) {
        if (legendOnTeam(legend, team)) add(legend);
      });
    });
    (TEAM_RAFTER_EXTRAS[team] || []).forEach(add);
    return pool;
  }

  function bindTeamRafterStar() {
    var flags = ensureFlags();
    var team = currentCareerTeam();
    flags.storyRafterByTeam = flags.storyRafterByTeam || {};
    if (team && flags.storyRafterByTeam[team] && flags.storyRafterByTeam[team].name) {
      flags.storyRafterStar = flags.storyRafterByTeam[team];
      return flags.storyRafterStar;
    }
    var pool = rafterPoolForTeam(team);
    var pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : {
      id: 'franchise',
      name: '本队名宿',
      city: (typeof getTeamName === 'function' && team) ? getTeamName(team) : '这座城市'
    };
    if (team) flags.storyRafterByTeam[team] = pick;
    flags.storyRafterStar = pick;
    return pick;
  }

  function getTeamRafterStar() {
    return bindTeamRafterStar();
  }

  function bindHometown() {
    var flags = ensureFlags();
    if (flags.storyHometown) return flags.storyHometown;
    flags.storyHometown = HOMETOWN_POOL[Math.floor(Math.random() * HOMETOWN_POOL.length)];
    return flags.storyHometown;
  }

  function bindStoryRookie() {
    var flags = ensureFlags();
    if (flags.storyRookie && flags.storyRookie.name) return flags.storyRookie;
    var roster = (typeof NBA2K_DATA !== 'undefined' && STATE.careerTeam) ? (NBA2K_DATA[STATE.careerTeam] || []) : [];
    var bonded = flags.bondedTeammate && flags.bondedTeammate.name;
    var young = null;
    roster.forEach(function (p) {
      if (!p || p._isUser) return;
      if (bonded && p.name === bonded) return;
      var ovr = parseInt(p.ovr, 10) || 99;
      if (!young || ovr < young.ovr) young = { name: p.name, cname: p.cname || p.name, pos: p.pos, ovr: ovr };
    });
    flags.storyRookie = young || { name: 'young teammate', cname: '那位二年级后卫', ovr: 76 };
    return flags.storyRookie;
  }

  function rookieName() {
    var r = bindStoryRookie();
    return (r && (r.cname || r.name)) || '那位新秀';
  }

  function fillStoryPlaceholders(str) {
    var flags = ensureFlags();
    var rival = flags.storyRival;
    var derby = flags.storyDerby;
    var legend = flags.storyLegend;
    var rafter = bindTeamRafterStar();
    var rookie = flags.storyRookie;
    return String(str || '')
      .replace(/\{宿敌\}/g, rival ? (rival.cname || rival.name) : '对面当家')
      .replace(/\{宿敌球队\}/g, rival && rival.team && typeof getTeamName === 'function' ? getTeamName(rival.team) : '对面')
      .replace(/\{德比球队\}/g, derby ? (derby.teamName || '死敌') : '死敌')
      .replace(/\{德比对手\}/g, derby ? (derby.starName || '对方当家') : '对方当家')
      .replace(/\{名宿\}/g, legend ? legend.name : '那位名宿')
      .replace(/\{名宿城市\}/g, legend ? legend.city : '那座城市')
      .replace(/\{名宿风格\}/g, legend ? legend.line : '那些被写进教材的细节')
      .replace(/\{名宿原话\}/g, legend ? legend.quote : '把简单的动作做到每晚都能用。')
      .replace(/\{队史名宿\}/g, rafter ? rafter.name : '本队名宿')
      .replace(/\{队史名宿城市\}/g, rafter ? rafter.city : '这座城市')
      .replace(/\{故乡\}/g, flags.storyHometown || '故乡')
      .replace(/\{新秀\}/g, rookie ? (rookie.cname || rookie.name) : '那位新秀');
  }

  if (typeof fillBranchEventText === 'function') {
    var _origFill = fillBranchEventText;
    window.fillBranchEventText = function (str) {
      return fillStoryPlaceholders(_origFill(str));
    };
  }
  if (typeof getPlayerFacingBranchTitle === 'function') {
    var _origTitle = getPlayerFacingBranchTitle;
    window.getPlayerFacingBranchTitle = function (title) {
      return fillStoryPlaceholders(_origTitle(title));
    };
  }

  function isPlayingTeam(ctx, team) {
    return !!(ctx && ctx.game && team && ctx.game.opponent === team);
  }

  function seasonCount() {
    return (STATE.career && STATE.career.seasonCount) || 0;
  }

  function playerOvr() {
    return STATE.finalOVR || 75;
  }

  function gamesPlayed() {
    return (STATE.season && STATE.season.games && STATE.season.games.length) || 0;
  }

  function pushEvent(ev) {
    if (!ev || !ev.id) return;
    if (STAGED_BRANCH_EVENTS.some(function (item) { return item.id === ev.id; })) return;
    STAGED_BRANCH_EVENTS.push(ev);
  }

  function momentEvent(def) {
    var extra = def.extra || {};
    return {
      id: 'pp_season_' + def.id,
      branch: extra.branch || ('pp_moment_' + def.id),
      phase: extra.phase || 'season',
      phases: extra.phases,
      slot: 'main',
      weight: def.weight || 10,
      topicId: def.id,
      contextId: extra.contextId || null,
      stateContext: extra.stateContext || null,
      title: def.title,
      scenes: def.scenes || [def.scene],
      body: def.body,
      requires: def.requires,
      choices: (def.choices || []).map(function (ch) {
        return {
          label: ch.label,
          hint: ch.hint,
          apply: ch.apply || choiceApply(ch)
        };
      })
    };
  }

  // ——— 宿敌线 ———
  pushEvent({
    id: 'story_rival_first',
    branch: 'rival', phase: 'season', slot: 'main', weight: 15, topicId: 'rival_first',
    title: '宿敌：第一次被点名',
    scenes: [
      '客场灯光比主场更白。一次上篮后，{宿敌}落地回头看你，声音不大，全场却像听见了：这就是新秀？',
      '你的队友已经在拉你球衣。镜头对准你们中间那两米空地。'
    ],
    body: '{宿敌球队}的当家{宿敌}当着全国转播把你点名了。回嘴、用防守回答，或当没听见，都会把这条线写进你的生涯。',
    requires: function (ctx) {
      if (getBranchNode('rival') !== 'start') return false;
      if (seasonCount() < 1 && playerOvr() < 80) return false;
      if (gamesPlayed() < 8) return false;
      var rival = bindStoryRival();
      var opp = ctx && ctx.game && ctx.game.opponent;
      if (rival && rival.team && opp && opp !== rival.team && gamesPlayed() < 36) return false;
      return true;
    },
    choices: [
      { label: '当场回嘴', hint: '关键球提升，争议和媒体压力上升', apply: function () {
        bindStoryRival();
        setBranchNode('rival', 'rival_talk', { heat: 'hot', style: 'mouth' });
        return applyStoryFx({ attrs: { CLU: 1 }, profile: { controversy: 1 }, mods: { mediaPressure: 1 }, result: '{宿敌}笑了一下，像终于等到人接招。回防时你听见他用英文补了一句：下回合见。<br><br>效果：关键球+1；争议+1；媒体压力+1。' });
      }},
      { label: '用下一次防守回答', hint: '外防和教练信任提升', apply: function () {
        bindStoryRival();
        setBranchNode('rival', 'rival_talk', { heat: 'cool', style: 'defense' });
        return applyStoryFx({ attrs: { PDEF: 1 }, profile: { coachTrust: 1 }, result: '你没有开口。下一回合你把他挤出习惯的启动区，教练在场边拍了两下手。<br><br>效果：外防+1；教练信任+1。' });
      }},
      { label: '当没听见', hint: '更衣室更稳，士气略降', apply: function () {
        bindStoryRival();
        setBranchNode('rival', 'rival_talk', { heat: 'cold', style: 'ignore' });
        return applyStoryFx({ profile: { lockerRoomTrust: 1 }, mods: { moraleBonus: -1 }, result: '你走向发球线，像什么都没发生。队友后来告诉你：有人觉得你稳，也有人觉得你软。<br><br>效果：更衣室信任+1；士气-1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_rival_media',
    branch: 'rival', phase: 'season', slot: 'main', weight: 18, topicId: 'rival_media',
    title: '宿敌：采访被拱火',
    scenes: [
      '节目把你和{宿敌}的对位剪成「世纪骂战」。你只说了半句“下一场会做好防守”，字幕却写成“他点名了”。',
      '经纪人把三份通稿放在桌上：接招、降温、消失。'
    ],
    body: '媒体需要一条宿敌线。你要决定自己成不成全它。',
    requires: function () { return getBranchNode('rival') === 'rival_talk'; },
    choices: [
      { label: '公开点名下次见', hint: '人气和关键球提升，争议上升', apply: function () {
        setBranchNode('rival', 'rival_media', { heat: 'hot' });
        return applyStoryFx({ attrs: { CLU: 1 }, profile: { fame: 2, controversy: 1 }, result: '你对着镜头说：下次交手，我守他。{宿敌}转发了那段视频，只配了一个微笑表情。<br><br>效果：关键球+1；人气+2；争议+1。' });
      }},
      { label: '只谈比赛不谈人', hint: '媒体信任和领导力提升', apply: function () {
        setBranchNode('rival', 'rival_media', { heat: 'cool' });
        return applyStoryFx({ attrs: { PAS: 1 }, profile: { mediaTrust: 2, leadership: 1 }, result: '你把问题掰回挡拆和轮转。主持人不满意，更衣室却松了一口气。<br><br>效果：传球+1；媒体信任+2；领导力+1。' });
      }},
      { label: '让公关冷处理', hint: '媒体压力下降，人气下降', apply: function () {
        setBranchNode('rival', 'rival_media', { heat: 'cold' });
        return applyStoryFx({ profile: { fame: -1 }, mods: { mediaPressure: -1 }, result: '你的团队发出一份无趣声明。热搜退了，话题也退了。<br><br>效果：人气-1；媒体压力-1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_rival_christmas',
    branch: 'rival', phase: 'season', slot: 'main', weight: 16, topicId: 'rival_christmas',
    contextId: 'national',
    title: '宿敌：全国直播重赛',
    scenes: [
      '全国镜头都在等握手。{宿敌}站在中圈，手没有伸出来。',
      '摄影师已经蹲好了。你还有三秒决定怎么走进这个画面。'
    ],
    body: '这不是普通客场。你和{宿敌}的每一次呼吸都会被剪进周末专题。',
    requires: function () {
      return getBranchNode('rival') === 'rival_media' && gamesPlayed() >= 18;
    },
    choices: [
      { label: '伸手等三秒', hint: '媒体、球迷和关键球都提升', apply: function () {
        setBranchNode('rival', 'rival_christmas', { gesture: 'wait' });
        return applyStoryFx({ attrs: { CLU: 1 }, profile: { mediaTrust: 1, fanSupport: 1 }, result: '你把手当成战术的一部分。三秒后他不得不碰了一下。解说把这叫做尊重。<br><br>效果：关键球+1；媒体信任+1；球迷支持+1。' });
      }},
      { label: '直接走过', hint: '力量和士气提升，争议上升', apply: function () {
        setBranchNode('rival', 'rival_christmas', { gesture: 'snub' });
        return applyStoryFx({ attrs: { STR: 1 }, profile: { controversy: 2 }, mods: { moraleBonus: 1 }, result: '你擦肩而过。替补席有人喊你的名字。这晚的对抗从跳球前就开始了。<br><br>效果：力量+1；争议+2；士气+1。' });
      }},
      { label: '赛后单独找他', hint: '传球提升，宿敌线更克制', apply: function () {
        setBranchNode('rival', 'rival_christmas', { gesture: 'private' });
        return applyStoryFx({ attrs: { PAS: 1 }, profile: { lockerRoomTrust: 1 }, result: '通道里只有你们两个。{宿敌}说：场上的话不必带回酒店。你点头，把球衣换了。<br><br>效果：传球+1；更衣室信任+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_rival_finale',
    branch: 'rival', phase: 'season', slot: 'main', weight: 17, topicId: 'rival_finale',
    title: '宿敌：通道里的终章',
    scenes: [
      '又一次交手结束。{宿敌}在球员通道等你，像把一整季的垃圾话都收进了口袋。',
      '他问得很短：我们以后是对手，还是只是对手？'
    ],
    body: '这条线可以变成尊敬，也可以继续当你生涯的燃料。选完就定了。',
    requires: function () {
      return getBranchNode('rival') === 'rival_christmas' && seasonCount() >= 2;
    },
    choices: [
      { label: '拥抱并承认彼此', hint: '传奇声望、领导力和关键球提升，宿敌转为尊敬', apply: function () {
        setBranchNode('rival', 'rival_respect', { ending: 'respect' });
        ensureFlags().storyRivalEnding = 'respect';
        return applyStoryFx({ attrs: { CLU: 1 }, profile: { leadership: 1, legacyBonus: 2 }, result: '你们拍了拍对方后背。第二天有人写“和解”，有人写“终于长大了”。你只记得他说：下次还是会防你。<br><br>效果：关键球+1；领导力+1；传奇声望+2。' });
      }},
      { label: '继续当燃料', hint: '关键球再升，争议和波动上升', apply: function () {
        setBranchNode('rival', 'rival_fuel', { ending: 'fuel' });
        ensureFlags().storyRivalEnding = 'fuel';
        return applyStoryFx({ attrs: { CLU: 2 }, profile: { controversy: 1 }, mods: { formVariance: 1 }, result: '你说：别拥抱，留到你打不过我的那天。{宿敌}咧嘴：那还早。<br><br>效果：关键球+2；争议+1；状态波动+1。' });
      }},
      { label: '只点头分开', hint: '忠诚提升，媒体压力下降', apply: function () {
        setBranchNode('rival', 'rival_quiet', { ending: 'quiet' });
        ensureFlags().storyRivalEnding = 'quiet';
        return applyStoryFx({ profile: { loyalty: 1 }, mods: { mediaPressure: -1 }, result: '你们点了下头，各自上了大巴。没有声明，没有合影，故事却写完了。<br><br>效果：忠诚+1；媒体压力-1。' });
      }}
    ]
  });

  // ——— 德比线 ———
  pushEvent({
    id: 'story_derby_week',
    branch: 'derby', phase: 'season', slot: 'main', weight: 14, topicId: 'derby_week',
    title: '德比：城市开始选边',
    scenes: [
      '咖啡馆、出租车、看台——这周到处都是{德比球队}的颜色。',
      '有人问你敢不敢穿对方城市的衣服出门。摄影师就在街角。'
    ],
    body: '同城/分区死敌周。这不是普通的两场里的一场。',
    requires: function () {
      if (getBranchNode('derby') !== 'start') return false;
      if (gamesPlayed() < 6) return false;
      bindStoryDerby();
      return true;
    },
    choices: [
      { label: '穿对方颜色出门被拍', hint: '人气上升，争议上升', apply: function () {
        bindStoryDerby();
        setBranchNode('derby', 'derby_week', { vibe: 'troll' });
        return applyStoryFx({ profile: { fame: 1, controversy: 1 }, result: '照片比比赛先上热搜。主场球迷笑了，也有人骂你不懂规矩。<br><br>效果：人气+1；争议+1。' });
      }},
      { label: '只穿自家训练服', hint: '球迷支持和忠诚提升', apply: function () {
        bindStoryDerby();
        setBranchNode('derby', 'derby_week', { vibe: 'loyal' });
        return applyStoryFx({ profile: { fanSupport: 2, loyalty: 1 }, result: '你把帽檐压得很低。本地电台把这解释成：他知道这周该站哪边。<br><br>效果：球迷支持+2；忠诚+1。' });
      }},
      { label: '发视频向双方球迷致意', hint: '媒体信任和人气提升', apply: function () {
        bindStoryDerby();
        setBranchNode('derby', 'derby_week', { vibe: 'peace' });
        return applyStoryFx({ profile: { mediaTrust: 1, fame: 1 }, result: '你说德比让城市活着。两边都有人转发，两边也都有人不买账。<br><br>效果：媒体信任+1；人气+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_derby_object',
    branch: 'derby', phase: 'season', slot: 'main', weight: 16, topicId: 'derby_object',
    contextId: 'road',
    title: '德比：看台砸来的东西',
    scenes: [
      '客场德比，一只纸杯擦过你耳朵，冰水溅在球鞋上。',
      '{德比对手}在对面罚球，看台却在等你回头。'
    ],
    body: '安保已经在走过来。你可以把它交给裁判，也可以让全场再兴奋一点。',
    requires: function () { return getBranchNode('derby') === 'derby_week'; },
    choices: [
      { label: '捡起来交给裁判', hint: '媒体信任和领导力提升', apply: function () {
        setBranchNode('derby', 'derby_object', { response: 'ref' });
        return applyStoryFx({ profile: { mediaTrust: 2, leadership: 1 }, result: '你把杯子放进裁判手里，转身回防。嘘声更大了，联盟后来发了谴责声明。<br><br>效果：媒体信任+2；领导力+1。' });
      }},
      { label: '对着看台比划', hint: '外防和士气提升，争议上升', apply: function () {
        setBranchNode('derby', 'derby_object', { response: 'crowd' });
        return applyStoryFx({ attrs: { PDEF: 1 }, profile: { controversy: 2 }, mods: { moraleBonus: 1 }, result: '你比了个“再来”的手势。下一回合你把{德比对手}挤出三分线，客场更响了。<br><br>效果：外防+1；争议+2；士气+1。' });
      }},
      { label: '让保安处理，自己上场', hint: '教练信任提升，体能负荷上升', apply: function () {
        setBranchNode('derby', 'derby_object', { response: 'play' });
        return applyStoryFx({ profile: { coachTrust: 1 }, mods: { staminaLoad: 1 }, result: '你把毛巾扔给训练师，说：打球。教练后来夸你没把夜搅黄。<br><br>效果：教练信任+1；体能负荷+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_derby_revenge',
    branch: 'derby', phase: 'season', slot: 'main', weight: 16, topicId: 'derby_revenge',
    contextId: 'home',
    title: '德比：复仇夜',
    scenes: [
      '主场旗帜铺满。上次没赢，这周标语只写两个字：还回去。',
      '教练问你：今晚要对{德比对手}，还是按战术打？'
    ],
    body: '德比的第二回合往往比第一回合更像私人比赛。',
    requires: function () { return getBranchNode('derby') === 'derby_object'; },
    choices: [
      { label: '要求首发对位死敌核心', hint: '外防和关键球提升，体能负荷上升', apply: function () {
        setBranchNode('derby', 'derby_done', { close: 'duel' });
        return applyStoryFx({ attrs: { PDEF: 1, CLU: 1 }, mods: { staminaLoad: 1 }, result: '你把{德比对手}从第一节跟到加时。数据不好看的回合里，主场还是在喊你的名字。<br><br>效果：外防+1；关键球+1；体能负荷+1。' });
      }},
      { label: '按战术打团队', hint: '传球和球队默契提升', apply: function () {
        setBranchNode('derby', 'derby_done', { close: 'team' });
        return applyStoryFx({ attrs: { PAS: 1 }, mods: { teamChemistry: 2 }, result: '你没有去追私人对位。球到谁手里舒服，就到谁手里。德比夜也能赢得像普通胜利。<br><br>效果：传球+1；球队默契+2。' });
      }},
      { label: '赛前探访双方社区球迷', hint: '球迷支持和中国人气提升', apply: function () {
        setBranchNode('derby', 'derby_done', { close: 'fans' });
        return applyStoryFx({ profile: { fanSupport: 2, chinaPopularity: 1 }, result: '你在社区球馆待了一个小时。有人穿{德比球队}球衣，也有人穿你的。你都签了。<br><br>效果：球迷支持+2；中国人气+1。' });
      }}
    ]
  });

  // ——— 名宿线 ———
  pushEvent({
    id: 'story_legend_dinner',
    branch: 'legend', phase: 'offseason', slot: 'main', weight: 13,
    title: '名宿：{名宿}请客',
    scenes: [
      '休赛期你收到一条短信，署名是{名宿}。地点不在训练馆，在一家没有招牌的餐厅。',
      '桌上只有水和一块战术板。他说今晚不谈合同，只谈{名宿风格}。'
    ],
    body: '{名宿}从{名宿城市}飞过来。这不是商业活动，是一次一对一的交代。',
    requires: function () {
      if (getBranchNode('legend') !== 'start') return false;
      if (seasonCount() < 1 || playerOvr() < 80) return false;
      bindStoryLegend();
      return true;
    },
    choices: [
      { label: '全程请教他的杀招', hint: '主技术明显提升，体能负荷上升', apply: function () {
        var legend = bindStoryLegend();
        var attrs = {};
        attrs[legend.attr] = 2;
        if (legend.attr2) attrs[legend.attr2] = 1;
        setBranchNode('legend', 'legend_dinner', { focus: 'craft', legendId: legend.id, legendName: legend.name });
        applyStoryFx({ attrs: attrs, mods: { staminaLoad: 1 } });
        return '{名宿}把动作拆到脚尖。他说：{名宿原话}你练到关门，他才点头。<br><br>效果：' + (typeof attrCN === 'function' ? attrCN(legend.attr) : legend.attr) + '+2' + (legend.attr2 ? '，' + (typeof attrCN === 'function' ? attrCN(legend.attr2) : legend.attr2) + '+1' : '') + '；体能负荷+1。';
      }},
      { label: '请教如何带队', hint: '传球和领导力提升', apply: function () {
        var legend = bindStoryLegend();
        setBranchNode('legend', 'legend_dinner', { focus: 'lead', legendId: legend.id, legendName: legend.name });
        return applyStoryFx({ attrs: { PAS: 1 }, profile: { leadership: 2 }, result: '{名宿}没画战术，只问你更衣室里谁不敢说话。你答完，他把那个人的名字写在板子最上面。<br><br>效果：传球+1；领导力+2。' });
      }},
      { label: '聊生涯以外的事', hint: '关键球提升，状态更稳', apply: function () {
        var legend = bindStoryLegend();
        setBranchNode('legend', 'legend_dinner', { focus: 'life', legendId: legend.id, legendName: legend.name });
        return applyStoryFx({ attrs: { CLU: 1 }, mods: { formVariance: -1 }, result: '后来你们几乎没碰篮球。{名宿}说退役后最难的不是没人防守，是没人每天逼你诚实。<br><br>效果：关键球+1；状态波动-1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_legend_night',
    branch: 'legend', phase: 'season', slot: 'main', weight: 16, topicId: 'legend_night',
    title: '名宿：{名宿}来主场',
    scenes: [
      '球队请{名宿}来主场观战。大屏幕放他的集锦，请你致辞并合影。这是一次跨队致敬，不是退役球衣。',
      '主持人把话筒递过来时，全场在等一句漂亮话。'
    ],
    body: '你可以认真，可以抢镜，也可以把时间还给{名宿}的家人。',
    requires: function () { return getBranchNode('legend') === 'legend_dinner'; },
    choices: [
      { label: '认真致辞：我配不上这件', hint: '传奇声望和球迷支持提升', apply: function () {
        setBranchNode('legend', 'legend_night', { speech: 'humble' });
        return applyStoryFx({ profile: { legacyBonus: 2, fanSupport: 2 }, result: '你说自己配不上把这件衣服穿出馆。{名宿}在旁边摇头笑：那就配得上，再去赢。<br><br>效果：传奇声望+2；球迷支持+2。' });
      }},
      { label: '开玩笑抢镜', hint: '人气上升，媒体信任下降', apply: function () {
        setBranchNode('legend', 'legend_night', { speech: 'joke' });
        return applyStoryFx({ profile: { fame: 2, mediaTrust: -1, controversy: 1 }, result: '你说这件衣服肩太宽。笑声有了，短视频也有了。{名宿}拍了拍你：下次把笑话留到赢了再说。<br><br>效果：人气+2；媒体信任-1；争议+1。' });
      }},
      { label: '把时间让给名宿家人', hint: '忠诚和领导力提升', apply: function () {
        setBranchNode('legend', 'legend_night', { speech: 'family' });
        return applyStoryFx({ profile: { loyalty: 2, leadership: 1 }, result: '你把话筒转给第一排。致敬夜最后变成一个家庭的夜晚，你站在侧幕没有再说话。<br><br>效果：忠诚+2；领导力+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_legend_gym',
    branch: 'legend', phase: 'season', slot: 'main', weight: 15, topicId: 'legend_gym',
    title: '名宿：{名宿}来训练馆',
    scenes: [
      '晨练门开了一条缝。{名宿}坐在最后一排，只看不说话。',
      '助教小声说：他飞过来不是为了合影。'
    ],
    body: '{名宿}还在等你把上次餐桌上的东西练出来。',
    requires: function () { return getBranchNode('legend') === 'legend_night'; },
    choices: [
      { label: '加练到他点头', hint: '主技术再升，体能负荷明显上升', apply: function () {
        var legend = getStoryLegend();
        var attrs = {};
        attrs[legend.attr] = 2;
        setBranchNode('legend', 'legend_done', { close: 'extra' });
        applyStoryFx({ attrs: attrs, mods: { staminaLoad: 2 } });
        return '你把原定的投篮组翻倍。{名宿}终于站起来，只说了一句：{名宿原话}<br><br>效果：' + (typeof attrCN === 'function' ? attrCN(legend.attr) : legend.attr) + '+2；体能负荷+2。';
      }},
      { label: '按原计划练', hint: '教练信任提升，状态更稳', apply: function () {
        setBranchNode('legend', 'legend_done', { close: 'plan' });
        return applyStoryFx({ profile: { coachTrust: 1 }, mods: { formVariance: -1 }, result: '你没有为观众改计划。{名宿}离开前对教练说：这样才对。<br><br>效果：教练信任+1；状态波动-1。' });
      }},
      { label: '请他上场示范', hint: '护球和传球提升，人气上升', apply: function () {
        setBranchNode('legend', 'legend_done', { close: 'demo' });
        return applyStoryFx({ attrs: { HAN: 1, PAS: 1 }, profile: { fame: 1 }, result: '{名宿}脱了外套，做了三个你整个夏天都没做干净的动作。训练馆的人把手机都收了起来。<br><br>效果：护球+1；传球+1；人气+1。' });
      }}
    ]
  });

  // ——— 故乡线 ———
  pushEvent({
    id: 'story_hometown_court',
    branch: 'hometown', phase: 'offseason', slot: 'main', weight: 12,
    title: '故乡：{故乡}的球场要拆',
    scenes: [
      '{故乡}的旧球场要改停车场。有人把照片发到你的工作室：篮板已经歪了，可还有小孩在投。',
      '县里等你一句话，也等你一笔钱。'
    ],
    body: '这是你学会打球的地方。你可以买下它，也可以只出声。',
    requires: function () {
      if (getBranchNode('hometown') !== 'start') return false;
      if (seasonCount() < 1) return false;
      bindHometown();
      return true;
    },
    choices: [
      { label: '出资保留并冠名', hint: '球迷、中国人气和传奇声望提升，商业价值下降', apply: function () {
        bindHometown();
        setBranchNode('hometown', 'hometown_saved', { gift: 'named' });
        return applyStoryFx({ profile: { businessValue: -1, fanSupport: 2, chinaPopularity: 2, legacyBonus: 1 }, result: '球场留了下来，新篮架上有你的名字。你让他们不要把小孩赶出去。<br><br>效果：球迷支持+2；中国人气+2；传奇声望+1；商业价值-1。' });
      }},
      { label: '只捐器材', hint: '球迷支持和商业价值都略升', apply: function () {
        bindHometown();
        setBranchNode('hometown', 'hometown_saved', { gift: 'gear' });
        return applyStoryFx({ profile: { fanSupport: 1, businessValue: 1 }, result: '新球和新鞋先到了。球场还在，只是名字仍叫原来的小学。<br><br>效果：球迷支持+1；商业价值+1。' });
      }},
      { label: '发声但不出钱', hint: '媒体信任提升，争议上升', apply: function () {
        bindHometown();
        setBranchNode('hometown', 'hometown_saved', { gift: 'voice' });
        return applyStoryFx({ profile: { mediaTrust: 1, controversy: 1 }, result: '你的声明让拆除推迟。有人说你该掏钱，有人说你已经比很多人都大声。<br><br>效果：媒体信任+1；争议+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_hometown_clinic',
    branch: 'hometown', phase: 'offseason', slot: 'main', weight: 14,
    title: '故乡：雨里的公开课',
    scenes: [
      '{故乡}的公开课改到室外。雨没有停，几百个小孩还是站着。',
      '训练师看表：你的恢复课在两小时后。'
    ],
    body: '他们等的不是技巧，是你真的出现。',
    requires: function () { return getBranchNode('hometown') === 'hometown_saved'; },
    choices: [
      { label: '加练到天黑', hint: '耐力提升，负荷和球迷支持上升', apply: function () {
        setBranchNode('hometown', 'hometown_clinic', { length: 'long' });
        return applyStoryFx({ attrs: { STA: 1 }, profile: { fanSupport: 2 }, mods: { staminaLoad: 1 }, result: '雨停的时候，最后一个小孩才把球交给你。你的鞋沉得像打完加时。<br><br>效果：耐力+1；球迷支持+2；体能负荷+1。' });
      }},
      { label: '按一小时结束', hint: '负荷下降，仍有球迷支持', apply: function () {
        setBranchNode('hometown', 'hometown_clinic', { length: 'short' });
        return applyStoryFx({ profile: { fanSupport: 1 }, mods: { staminaLoad: -1 }, result: '你把承诺做满，没有超支身体。离开时有人失望，也有人理解。<br><br>效果：球迷支持+1；体能负荷-1。' });
      }},
      { label: '带两名小孩去职业试训', hint: '领导力和传奇声望提升', apply: function () {
        setBranchNode('hometown', 'hometown_clinic', { length: 'scout' });
        return applyStoryFx({ profile: { leadership: 1, legacyBonus: 1 }, result: '你留下两个最认真的孩子的联系方式。一个月后，他们站进了职业俱乐部的试训名单。<br><br>效果：领导力+1；传奇声望+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_hometown_alumni',
    branch: 'hometown', phases: ['offseason', 'season'], slot: 'main', weight: 13, topicId: 'hometown_alumni',
    title: '故乡：高中死敌表演赛',
    scenes: [
      '{故乡}那所当年把你防到哭的中学请你回去打表演赛。对方教练还是当年那个人。',
      '门票卖完了。有人来看你扣篮，有人来看你会不会认真。'
    ],
    body: '这是一场没有数据的比赛，却会被写成你的来处。',
    requires: function () { return getBranchNode('hometown') === 'hometown_clinic'; },
    choices: [
      { label: '认真打并致敬对手', hint: '关键球和球迷支持提升', apply: function () {
        setBranchNode('hometown', 'hometown_done', { close: 'play' });
        return applyStoryFx({ attrs: { CLU: 1 }, profile: { fanSupport: 2 }, result: '你没有扣空筐。最后一攻你把球传给了对方的学生代表。全场先静，再响。<br><br>效果：关键球+1；球迷支持+2。' });
      }},
      { label: '只露脸不打球', hint: '商业价值上升，球迷支持下降', apply: function () {
        setBranchNode('hometown', 'hometown_done', { close: 'appear' });
        return applyStoryFx({ profile: { businessValue: 1, fanSupport: -1 }, result: '你致辞、合影、提前离场。品牌满意，看台有人吹口哨。<br><br>效果：商业价值+1；球迷支持-1。' });
      }},
      { label: '让当地年轻球员首发，你替补', hint: '传球和领导力提升', apply: function () {
        setBranchNode('hometown', 'hometown_done', { close: 'bench' });
        return applyStoryFx({ attrs: { PAS: 1 }, profile: { leadership: 1 }, result: '你把上场时间让出去，只在第二节上来组织。小孩后来把你的助攻写成日记。<br><br>效果：传球+1；领导力+1。' });
      }}
    ]
  });

  // ——— 更衣室火炬 ———
  pushEvent({
    id: 'story_torch_minutes',
    branch: 'torch', phase: 'season', slot: 'main', weight: 13, topicId: 'torch_minutes',
    title: '火炬：新秀抢你的回合',
    scenes: [
      '教练把你的挡拆回合分给了{新秀}。训练白板擦掉你的名字时，更衣室很安静。',
      '{新秀}没有看你，只是把鞋带系得更紧。'
    ],
    body: '你已经站稳了。现在轮到你决定，怎么对待下一个人。',
    requires: function () {
      if (getBranchNode('torch') !== 'start') return false;
      if (seasonCount() < 3 || playerOvr() < 80) return false;
      bindStoryRookie();
      return true;
    },
    choices: [
      { label: '主动教他读防守', hint: '传球、更衣室和教练信任提升', apply: function () {
        bindStoryRookie();
        setBranchNode('torch', 'torch_minutes', { style: 'teach' });
        return applyStoryFx({ attrs: { PAS: 1 }, profile: { lockerRoomTrust: 2, coachTrust: 1 }, result: '你把弱侧两人的站位写在他手腕上。{新秀}第一次叫对挡拆时，回头看了你一眼。<br><br>效果：传球+1；更衣室信任+2；教练信任+1。' });
      }},
      { label: '要求拿回球权', hint: '终结和领导力提升，教练信任下降', apply: function () {
        bindStoryRookie();
        setBranchNode('torch', 'torch_minutes', { style: 'keep' });
        return applyStoryFx({ attrs: { FIN: 1 }, profile: { leadership: 1, coachTrust: -1 }, result: '你对教练说：我还没打完。下组训练赛，球又回到你手里。<br><br>效果：终结+1；领导力+1；教练信任-1。' });
      }},
      { label: '训练里把他防到崩溃', hint: '外防提升，更衣室信任下降', apply: function () {
        bindStoryRookie();
        setBranchNode('torch', 'torch_minutes', { style: 'harsh' });
        return applyStoryFx({ attrs: { PDEF: 1 }, profile: { lockerRoomTrust: -2, controversy: 1 }, result: '你没有手下留情。{新秀}坐在地板上喘气时，有人说你过分，有人说联盟就是这样。<br><br>效果：外防+1；更衣室信任-2；争议+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_torch_clash',
    branch: 'torch', phase: 'season', slot: 'main', weight: 15, topicId: 'torch_clash',
    title: '火炬：他当众顶撞你',
    scenes: [
      '训练赛{新秀}把球摔在地上：你的时代过了。',
      '全队停下来。这不是一次普通的对抗，是他在试探你还管不管这间屋子。'
    ],
    body: '你可以当晚约饭，可以继续强硬，也可以交给教练。',
    requires: function () { return getBranchNode('torch') === 'torch_minutes'; },
    choices: [
      { label: '当晚约饭', hint: '领导力和球队默契提升', apply: function () {
        setBranchNode('torch', 'torch_clash', { response: 'dinner' });
        return applyStoryFx({ profile: { leadership: 2 }, mods: { teamChemistry: 1 }, result: '火锅比训练赛更安静。{新秀}先道歉，你只问他：想赢，还是想赢我。<br><br>效果：领导力+2；球队默契+1。' });
      }},
      { label: '训练继续强硬', hint: '力量提升，默契下降', apply: function () {
        setBranchNode('torch', 'torch_clash', { response: 'hard' });
        return applyStoryFx({ attrs: { STR: 1 }, mods: { teamChemistry: -1 }, result: '下一组你还是顶着他打。没有人再摔球，也没有人笑。<br><br>效果：力量+1；球队默契-1。' });
      }},
      { label: '交给教练', hint: '教练信任提升，领导力下降', apply: function () {
        setBranchNode('torch', 'torch_clash', { response: 'coach' });
        return applyStoryFx({ profile: { coachTrust: 1, leadership: -1 }, result: '你把门关上，让教练处理。屋子安静了，但有人觉得你把火递了出去。<br><br>效果：教练信任+1；领导力-1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_torch_shoutout',
    branch: 'torch', phase: 'season', slot: 'main', weight: 14, topicId: 'torch_shoutout',
    title: '火炬：他把你送上热搜',
    scenes: [
      '{新秀}在采访里说：我从他身上学到怎么赢。',
      '剪辑把你们从对峙放到这句话，评论区开始写“交接”。'
    ],
    body: '公开认他、低调点赞，或提醒他还早，都会成为你领袖形象的一部分。',
    requires: function () { return getBranchNode('torch') === 'torch_clash'; },
    choices: [
      { label: '公开认他做接班', hint: '传奇声望和传球提升', apply: function () {
        setBranchNode('torch', 'torch_done', { close: 'pass' });
        return applyStoryFx({ attrs: { PAS: 1 }, profile: { legacyBonus: 2 }, result: '你发了一句：球衣会旧，方法可以留下。{新秀}把那段话设成了封面。<br><br>效果：传球+1；传奇声望+2。' });
      }},
      { label: '低调点赞不评论', hint: '更衣室信任提升', apply: function () {
        setBranchNode('torch', 'torch_done', { close: 'quiet' });
        return applyStoryFx({ profile: { lockerRoomTrust: 1 }, result: '你点了个赞。更衣室里有人懂，评论区不懂，正好。<br><br>效果：更衣室信任+1。' });
      }},
      { label: '提醒他还早', hint: '关键球提升，争议上升', apply: function () {
        setBranchNode('torch', 'torch_done', { close: 'notyet' });
        return applyStoryFx({ attrs: { CLU: 1 }, profile: { controversy: 1 }, result: '你说：学到怎么赢，和已经能赢，中间还有很多场。有人说你小气，有人说你诚实。<br><br>效果：关键球+1；争议+1。' });
      }}
    ]
  });

  // ——— 全明星周末 ———
  pushEvent({
    id: 'story_allstar_skills',
    branch: 'allstar_story', phase: 'season', slot: 'main', weight: 14, topicId: 'allstar_skills',
    title: '全明星：技巧挑战赛搭档',
    scenes: [
      '官方把你和一个完全不同风格的球星绑成搭档。新闻稿写“碰撞”，训练师写“小心膝盖”。',
      '他问你：按我的节奏玩，还是你来？'
    ],
    body: '全明星周末的第一夜往往比正赛更像表演，也更像一次被全世界看见的合作。',
    requires: function () {
      return getBranchNode('allstar_story') === 'start' && hasCareerHonor('全明星') && gamesPlayed() >= 28 && gamesPlayed() <= 58;
    },
    choices: [
      { label: '按他的节奏玩', hint: '护球和人气提升', apply: function () {
        setBranchNode('allstar_story', 'allstar_skills', { style: 'follow' });
        return applyStoryFx({ attrs: { HAN: 1 }, profile: { fame: 2 }, result: '你跟着他做那些平时不会做的花活。镜头喜欢，教练组只要求你周一回来忘掉一半。<br><br>效果：护球+1；人气+2。' });
      }},
      { label: '坚持自己的项目', hint: '投射或扣篮提升，争议上升', apply: function () {
        var shooty = ['PG', 'SG', 'SF'].indexOf(playerPos()) >= 0;
        var attrs = shooty ? { threePT: 1 } : { DNK: 1 };
        setBranchNode('allstar_story', 'allstar_skills', { style: 'own' });
        applyStoryFx({ attrs: attrs, profile: { controversy: 1 } });
        return '搭档有点尴尬，观众却看见了你平时的样子。<br><br>效果：' + (shooty ? '三分+1' : '扣篮+1') + '；争议+1。';
      }},
      { label: '赛前加练默契', hint: '传球提升，体能负荷上升', apply: function () {
        setBranchNode('allstar_story', 'allstar_skills', { style: 'prep' });
        return applyStoryFx({ attrs: { PAS: 1 }, mods: { staminaLoad: 1 }, result: '你们在空馆把传球路线走了两遍。周六晚上那些配合看起来像碰巧，其实不是。<br><br>效果：传球+1；体能负荷+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_allstar_dunk',
    branch: 'allstar_story', phase: 'season', slot: 'main', weight: 15, topicId: 'allstar_dunk',
    title: '全明星：灌篮大赛还是休息',
    scenes: [
      '主办方希望你参加灌篮大赛，最好做一个致敬动作。队医把伤病表转了过来。',
      '{名宿}的名字出现在候选致敬名单上，即使他今晚不在现场。'
    ],
    body: '这是流量，也是一次没有必要的起跳。',
    requires: function () {
      bindStoryLegend();
      return getBranchNode('allstar_story') === 'allstar_skills';
    },
    choices: [
      { label: '参加并自编致敬动作', hint: '扣篮和人气提升，伤病风险上升', apply: function () {
        bindStoryLegend();
        setBranchNode('allstar_story', 'allstar_dunk', { choice: 'dunk' });
        return applyStoryFx({ attrs: { DNK: 2 }, profile: { fame: 2 }, mods: { injuryRiskBonus: 1 }, result: '你把致敬做成一次真正的起跳。落地时膝盖过了一下电，观众已经站起来了。<br><br>效果：扣篮+2；人气+2；伤病风险+1。' });
      }},
      { label: '拒绝，保护赛季', hint: '伤病风险下降，球迷支持下降', apply: function () {
        setBranchNode('allstar_story', 'allstar_dunk', { choice: 'rest' });
        return applyStoryFx({ profile: { fanSupport: -1 }, mods: { injuryRiskBonus: -1 }, result: '你发了一句：我来是打球的。灌篮大赛少了一个名字，季后赛可能多一具膝盖。<br><br>效果：伤病风险-1；球迷支持-1。' });
      }},
      { label: '当评委不参赛', hint: '媒体信任和人气提升', apply: function () {
        setBranchNode('allstar_story', 'allstar_dunk', { choice: 'judge' });
        return applyStoryFx({ profile: { mediaTrust: 1, fame: 1 }, result: '你举牌举得很严。有新秀过来问你要怎么改最后一步，你把{名宿}教过的那一下讲给了他。<br><br>效果：媒体信任+1；人气+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_allstar_game',
    branch: 'allstar_story', phase: 'season', slot: 'main', weight: 15, topicId: 'allstar_game',
    title: '全明星：周日正赛最后一节',
    scenes: [
      '教练问你：最后一节是抢眼，还是服从娱乐节奏？',
      '对面坐着你平时见不到的防守人。看台已经开始唱歌。'
    ],
    body: '全明星正赛的最后一节，会决定人们把你记得成竞争者还是表演者。',
    requires: function () { return getBranchNode('allstar_story') === 'allstar_dunk'; },
    choices: [
      { label: '认真防守对面明星', hint: '外防和盖帽提升，人气下降', apply: function () {
        setBranchNode('allstar_story', 'allstar_done', { close: 'd' });
        return applyStoryFx({ attrs: { PDEF: 1, BLK: 1 }, profile: { fame: -1 }, result: '你让一次表演上篮变成一次盖帽。嘘声和掌声同时响起。<br><br>效果：外防+1；盖帽+1；人气-1。' });
      }},
      { label: '配合表演', hint: '人气大涨，教练信任下降', apply: function () {
        setBranchNode('allstar_story', 'allstar_done', { close: 'show' });
        return applyStoryFx({ profile: { fame: 2, coachTrust: -1 }, result: '你把球抛到空中，让对面完成名场面。周一训练，教练只问了你一句：过瘾了吗。<br><br>效果：人气+2；教练信任-1。' });
      }},
      { label: '组织让大家都参与', hint: '传球和领导力提升', apply: function () {
        setBranchNode('allstar_story', 'allstar_done', { close: 'share' });
        return applyStoryFx({ attrs: { PAS: 2 }, profile: { leadership: 1 }, result: '最后四分钟你几乎不投。每个人都摸到了球，包括那个第一次入选的新秀。<br><br>效果：传球+2；领导力+1。' });
      }}
    ]
  });

  function currentAge() {
    return (STATE.career && STATE.career.currentAge) || 22;
  }

  function grantStoryStylePoint(flagKey) {
    var flags = ensureFlags();
    if (!flagKey || flags[flagKey]) return '';
    if (typeof PP_SKILLS === 'undefined' || typeof PP_SKILLS.ensureSkillState !== 'function') return '';
    flags[flagKey] = true;
    var st = PP_SKILLS.ensureSkillState();
    st.points += 1;
    st.earned += 1;
    return '球风点+1。';
  }

  // ——— 招牌动作线：赛季发现 → 夏天打磨 → 比赛验证 → 收束给球风点 ———
  pushEvent({
    id: 'story_craft_notice',
    branch: 'craft', phase: 'season', slot: 'main', weight: 12, topicId: 'craft_notice',
    title: '招牌动作：助教定格这一帧',
    scenes: [
      '录像室里，助教把你连续十一次终结停在同一帧：习惯脚、习惯肩、习惯出手点。',
      '他说：联盟已经开始按这张图防你。你要不要给自己留一个别人学不像的终结动作。'
    ],
    body: '这不是一次加练邀请，而是在问你要不要练出一眼能认出是你的打法。',
    requires: function () {
      if (getBranchNode('craft') !== 'start') return false;
      if (gamesPlayed() < 14) return false;
      if (playerOvr() < 74) return false;
      return true;
    },
    choices: [
      { label: '留下来把动作拆开', hint: '开启招牌动作线，中投提升', apply: function () {
        setBranchNode('craft', 'craft_notice', { path: 'lab' });
        return applyStoryFx({ attrs: { MID: 1 }, profile: { coachTrust: 1 }, result: '你把那一帧看了二十遍。助教没有教新招，只让你先承认自己有多可预测。<br><br>效果：中投+1；教练信任+1。' });
      }},
      { label: '先靠身体解决问题', hint: '力量提升，不开启这条线', apply: function () {
        setBranchNode('craft', 'craft_skip', { path: 'skip' });
        return applyStoryFx({ attrs: { STR: 1 }, result: '你说：他们知道又怎样。下一场你把人扛进去打成了。助教把那叠纸收了起来。<br><br>效果：力量+1。这条线到此结束。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_craft_lab',
    branch: 'craft', phase: 'offseason', slot: 'training', weight: 16,
    title: '招牌动作：夏天加练馆',
    scenes: [
      '空馆只开了半排灯。助教在地板上用胶带标出三只脚的位置，说这个夏天只练你会在十月用到的东西。'
    ],
    body: '把可预测的习惯，改成你自己才能稳定做出来的终结动作。',
    requires: function () { return getBranchNode('craft') === 'craft_notice'; },
    choices: [
      { label: '打磨中距离脚步', hint: '中投和控球提升，训练点+1', apply: function () {
        setBranchNode('craft', 'craft_lab', { tool: 'mid' });
        return applyStoryFx({ attrs: { MID: 1, HAN: 1 }, tp: 1, result: '你把第一步的长度改短了十厘米。看起来更丑，防守却更难提前站位。<br><br>效果：中投+1；控球+1。' });
      }},
      { label: '打磨篮下反脚', hint: '终结和力量提升，训练点+1', apply: function () {
        setBranchNode('craft', 'craft_lab', { tool: 'fin' });
        return applyStoryFx({ attrs: { FIN: 1, STR: 1 }, tp: 1, result: '反脚上篮练到肩膀发木。你终于能在习惯侧被堵住时，还有第二答案。<br><br>效果：终结+1；力量+1。' });
      }},
      { label: '打磨假动作节奏', hint: '控球和传球提升，训练点+1', apply: function () {
        setBranchNode('craft', 'craft_lab', { tool: 'tempo' });
        return applyStoryFx({ attrs: { HAN: 1, PAS: 1 }, tp: 1, result: '你学会在肩已经骗起之后再把球送走。助教说：这才叫阅读，不是表演。<br><br>效果：控球+1；传球+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_craft_test',
    branch: 'craft', phase: 'season', slot: 'main', weight: 15, topicId: 'craft_test',
    title: '招牌动作：被点名的一晚',
    scenes: [
      '全国转播里，对面把你的新动作写进了战术板。第一节你还在犹豫该不该用夏天那一下。'
    ],
    body: '夏天练出来的东西，只有在被针对时才算真正学成。',
    requires: function () { return getBranchNode('craft') === 'craft_lab' && gamesPlayed() >= 8; },
    choices: [
      { label: '在包夹里用新动作', hint: '关键球提升，状态更不稳', apply: function () {
        setBranchNode('craft', 'craft_test', { test: 'clutch' });
        return applyStoryFx({ attrs: { CLU: 1 }, mods: { formVariance: 1 }, result: '你没有退回旧习惯。进了两球，也丢了一球，但对面再也不能按去年的图防你。<br><br>效果：关键球+1；状态更不稳。' });
      }},
      { label: '先把新动作给队友创造', hint: '传球提升，更衣室更稳', apply: function () {
        setBranchNode('craft', 'craft_test', { test: 'pass' });
        return applyStoryFx({ attrs: { PAS: 1 }, profile: { lockerRoomTrust: 1 }, result: '假动作骗起后你把球送到弱侧。新动作第一次出现在助攻栏，而不是集锦栏。<br><br>效果：传球+1；更衣室信任+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_craft_master',
    branch: 'craft', phases: ['season', 'offseason'], slot: 'main', weight: 18,
    title: '招牌动作：有人开始学你',
    scenes: [
      '一名更年轻的球员在训练馆模仿你的终结动作，模仿得并不像。助教在旁边看你：行了，这招算你的了。'
    ],
    body: '技术被人学着练，才算真正留下来。收束这一条线，会留下一个球风点。',
    requires: function () { return getBranchNode('craft') === 'craft_test' && seasonCount() >= 1; },
    choices: [
      { label: '把细节教给他', hint: '领导力提升，并获得球风点', apply: function () {
        setBranchNode('craft', 'craft_master', { ending: 'teach' });
        var point = grantStoryStylePoint('craftStylePoint');
        return applyStoryFx({ profile: { leadership: 1, lockerRoomTrust: 1 }, result: '你把脚尖朝向和肩回正的顺序讲了一遍。他听懂了一半，你自己却更懂了。<br><br>效果：领导力+1；更衣室信任+1。' + (point ? '<br><br>' + point : '') });
      }},
      { label: '留下自己的版本', hint: '关键球提升，并获得球风点', apply: function () {
        setBranchNode('craft', 'craft_master', { ending: 'own' });
        var point = grantStoryStylePoint('craftStylePoint');
        return applyStoryFx({ attrs: { CLU: 1 }, result: '你让他去找自己的终结动作。属于你的那一下，不必被复制得一模一样。<br><br>效果：关键球+1。' + (point ? '<br><br>' + point : '') });
      }}
    ]
  });

  // ——— 更衣室声音线：二年级以后，不与退役倒计时抢戏 ———
  pushEvent({
    id: 'story_voice_quiet',
    branch: 'voice', phase: 'season', slot: 'main', weight: 11, topicId: 'voice_quiet',
    title: '更衣室声音：没人先开口',
    scenes: [
      '连输之后的球员会议，队长把门关上。十秒钟里没有人说话，所有人的视线在你和地板之间来回。'
    ],
    body: '有人需要先开口。开口的人会承担责任，不开口的人会把裂缝留给明天。',
    requires: function () {
      if (getBranchNode('voice') !== 'start') return false;
      if (seasonCount() < 1) return false;
      if (getBranchNode('retirement_countdown') !== 'start') return false;
      if (gamesPlayed() < 16) return false;
      return true;
    },
    choices: [
      { label: '先把问题说出来', hint: '开启更衣室声音线', apply: function () {
        setBranchNode('voice', 'voice_quiet', { style: 'speak' });
        return applyStoryFx({ profile: { leadership: 1, controversy: 1 }, result: '你把防守轮转和情绪都放在了桌面上。有人不舒服，但会议终于开始了。<br><br>效果：领导力+1；争议+1。' });
      }},
      { label: '先听完再总结', hint: '用倾听开线', apply: function () {
        setBranchNode('voice', 'voice_quiet', { style: 'listen' });
        return applyStoryFx({ profile: { lockerRoomTrust: 2 }, result: '你让每个人说完。最后你只重复了被提到三次的那件事。房间安静，却不再空洞。<br><br>效果：更衣室信任+2。' });
      }},
      { label: '把会议交回给队长', hint: '不开启这条线', apply: function () {
        setBranchNode('voice', 'voice_skip', { style: 'defer' });
        return applyStoryFx({ profile: { lockerRoomTrust: 1 }, result: '你看向队长。他点头，会议按旧秩序进行。你没有抢声音，这条线也就没有开始。<br><br>效果：更衣室信任+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_voice_split',
    branch: 'voice', phase: 'season', slot: 'main', weight: 14, topicId: 'voice_split',
    title: '更衣室声音：两派人',
    scenes: [
      '训练馆分成了两种声音：一种要提速硬打，一种要按教练的半场。两边都在等你站哪边。'
    ],
    body: '你已经开过口了。下一次站边，会决定更衣室听不听你。',
    requires: function () { return getBranchNode('voice') === 'voice_quiet'; },
    choices: [
      { label: '把两边拉回同一张战术板', hint: '教练信任和默契提升', apply: function () {
        setBranchNode('voice', 'voice_split', { side: 'board' });
        return applyStoryFx({ profile: { coachTrust: 1, lockerRoomTrust: 1 }, mods: { teamChemistry: 1 }, result: '你让两派人把各自的回合画在同一块板上。争论还在，跑位开始对齐。<br><br>效果：教练信任+1；更衣室信任+1；球队默契+1。' });
      }},
      { label: '支持场上更有效的一方', hint: '领导力提升，默契下降', apply: function () {
        setBranchNode('voice', 'voice_split', { side: 'pick' });
        return applyStoryFx({ profile: { leadership: 1 }, mods: { teamChemistry: -1 }, result: '你选了最近能赢球的那一边。有人跟你走，有人把柜子摔得更响。<br><br>效果：领导力+1；球队默契-1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_voice_table',
    branch: 'voice', phase: 'offseason', slot: 'main', weight: 13,
    title: '更衣室声音：夏天的饭桌',
    scenes: [
      '核心层约在一家没有记者的餐厅。没有战术板，只有一句：下赛季更衣室听谁的？'
    ],
    body: '常规赛里说出口的话，到了休赛期会被重新掂量。',
    requires: function () { return getBranchNode('voice') === 'voice_split'; },
    choices: [
      { label: '答应做沟通的人', hint: '领导力提升', apply: function () {
        setBranchNode('voice', 'voice_table', { role: 'bridge' });
        return applyStoryFx({ profile: { leadership: 2 }, result: '你没有要袖标，只要在两边吵架时有人能打电话找你。<br><br>效果：领导力+2。' });
      }},
      { label: '把最终决定留给教练', hint: '教练信任提升', apply: function () {
        setBranchNode('voice', 'voice_table', { role: 'coach' });
        return applyStoryFx({ profile: { coachTrust: 2 }, result: '你说球员可以吵，但轮换和体系必须有一个源头。教练后来把这句话写进了训练营手册。<br><br>效果：教练信任+2。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_voice_settle',
    branch: 'voice', phase: 'season', slot: 'main', weight: 17, topicId: 'voice_settle',
    title: '更衣室声音：投票之前',
    scenes: [
      '队长因伤缺席两周。教练让球员决定谁来主持暂停。纸条就在你面前。'
    ],
    body: '这条线可以变成责任，也可以交回去。真正承担的人会得到一个球风点。',
    requires: function () { return getBranchNode('voice') === 'voice_table' && gamesPlayed() >= 10; },
    choices: [
      { label: '接下暂停里的声音', hint: '领导力提升，并获得球风点', apply: function () {
        setBranchNode('voice', 'voice_settle', { ending: 'lead' });
        var point = grantStoryStylePoint('voiceStylePoint');
        return applyStoryFx({ profile: { leadership: 1, lockerRoomTrust: 1 }, result: '你把战术讲完，也把责任留下。两周后队长回来，第一句话是：位置还是你的，直到我跟上。<br><br>效果：领导力+1；更衣室信任+1。' + (point ? '<br><br>' + point : '') });
      }},
      { label: '提名更合适的人', hint: '更衣室信任提升，并获得球风点', apply: function () {
        setBranchNode('voice', 'voice_settle', { ending: 'pass' });
        var point = grantStoryStylePoint('voiceStylePoint');
        return applyStoryFx({ profile: { lockerRoomTrust: 2 }, result: '你写下了另一个名字。被提名的人看了你一眼，那一眼比袖标更清楚。<br><br>效果：更衣室信任+2。' + (point ? '<br><br>' + point : '') });
      }}
    ]
  });

  // ——— 板凳崛起线：低使用、早期生涯，不与火炬/分钟线并行 ———
  pushEvent({
    id: 'story_bench_cut',
    branch: 'bench', phase: 'season', slot: 'main', weight: 12, topicId: 'bench_cut',
    title: '板凳：你的名字被往下移',
    scenes: [
      '赛前投篮结束后，教练把轮换表往下折了一行。你的名字还在，只是更靠近第二波。'
    ],
    body: '这不是被放弃，是被重新评估。你要决定怎么把上场时间要回来。',
    requires: function () {
      if (getBranchNode('bench') !== 'start') return false;
      if (getBranchNode('torch') !== 'start') return false;
      if (seasonCount() > 2) return false;
      if (playerOvr() >= 86) return false;
      if (gamesPlayed() < 12) return false;
      return true;
    },
    choices: [
      { label: '问清楚自己缺什么', hint: '开启板凳线，教练信任提升', apply: function () {
        setBranchNode('bench', 'bench_cut', { ask: true });
        return applyStoryFx({ profile: { coachTrust: 1 }, result: '教练说得很具体：防守轮转和少失误。没有安慰，但有一张能执行的清单。<br><br>效果：教练信任+1。' });
      }},
      { label: '不问，只用下场证明', hint: '开启板凳线，波动上升', apply: function () {
        setBranchNode('bench', 'bench_cut', { ask: false });
        return applyStoryFx({ profile: { leadership: 1 }, mods: { formVariance: 1 }, result: '你把清单留给自己。下一场你坐得更久，眼神也更亮。<br><br>效果：领导力+1；状态更不稳。' });
      }},
      { label: '接受这就是角色', hint: '不开启此线', apply: function () {
        setBranchNode('bench', 'bench_skip', { ask: 'accept' });
        return applyStoryFx({ mods: { staminaLoad: -1 }, result: '你点头，把能量留在该上场的那几分钟。这条崛起线没有开始。<br><br>效果：体能负荷-1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_bench_window',
    branch: 'bench', phase: 'season', slot: 'main', weight: 15, topicId: 'bench_window',
    title: '板凳：伤病打开的窗口',
    scenes: [
      '一名轮换球员在热身时侧身，队医摇头。教练看向你：今晚你顶他的分钟。'
    ],
    body: '窗口通常很短。打法会决定窗口会不会变成位置。',
    requires: function () { return getBranchNode('bench') === 'bench_cut'; },
    choices: [
      { label: '先把防守和篮板做满', hint: '篮板和教练信任提升', apply: function () {
        setBranchNode('bench', 'bench_window', { way: 'dirty' });
        return applyStoryFx({ attrs: { REB: 1 }, profile: { coachTrust: 1 }, result: '你没有急着出手。篮板、轮转、端线发球，这些不会上热搜的事让你留在了场上。<br><br>效果：篮板+1；教练信任+1。' });
      }},
      { label: '用得分把窗口撑开', hint: '人气提升，波动上升', apply: function () {
        setBranchNode('bench', 'bench_window', { way: 'score' });
        return applyStoryFx({ profile: { fame: 1 }, mods: { formVariance: 1, moraleBonus: 1 }, result: '你连进两球，看台第一次为替补席上的你起身。教练既高兴，也开始盯你的选择。<br><br>效果：人气+1；士气+1；状态更不稳。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_bench_summer',
    branch: 'bench', phase: 'offseason', slot: 'training', weight: 14,
    title: '板凳：夏天把位置练实',
    scenes: [
      '训练师问你：这个夏天是把夏联当成证明场，还是跟着一队补你被点名的那些细节。'
    ],
    body: '板凳上的人，夏天没有中立选项。',
    requires: function () { return getBranchNode('bench') === 'bench_window'; },
    choices: [
      { label: '夏联打满证明场', hint: '关键球提升，负荷上升，训练点+1', apply: function () {
        setBranchNode('bench', 'bench_summer', { plan: 'prove' });
        return applyStoryFx({ attrs: { CLU: 1 }, mods: { staminaLoad: 1 }, tp: 1, result: '你把夏联每一场都当成轮换谈判。数据很好看，膝盖也提醒你这不是免费的。<br><br>效果：关键球+1；体能负荷+1。' });
      }},
      { label: '跟一队补防守细节', hint: '外防提升，教练更放心，训练点+1', apply: function () {
        setBranchNode('bench', 'bench_summer', { plan: 'detail' });
        return applyStoryFx({ attrs: { PDEF: 1 }, profile: { coachTrust: 1 }, tp: 1, result: '助教把你留下来加防掩护。没有集锦，只有一份能让你在十月被叫到名字的笔记。<br><br>效果：外防+1；教练信任+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_bench_role',
    branch: 'bench', phase: 'season', slot: 'main', weight: 16, topicId: 'bench_role',
    title: '板凳：位置被重新写上',
    scenes: [
      '训练营名单公布，你的名字回到了固定轮换。教练说：不是因为夏天热闹，是因为我们能把你放进某几分钟并且放心。'
    ],
    body: '把板凳打成角色，会留下一个球风点。把它当成跳板，同样可以。',
    requires: function () { return getBranchNode('bench') === 'bench_summer' && gamesPlayed() >= 6; },
    choices: [
      { label: '把这几分钟当成职责', hint: '默契提升，并获得球风点', apply: function () {
        setBranchNode('bench', 'bench_role', { ending: 'role' });
        var point = grantStoryStylePoint('benchStylePoint');
        return applyStoryFx({ profile: { coachTrust: 1 }, mods: { teamChemistry: 1 }, result: '你不再问为什么不是首发。你问的是：这六分钟要完成什么。<br><br>效果：教练信任+1；球队默契+1。' + (point ? '<br><br>' + point : '') });
      }},
      { label: '继续把窗口往上推', hint: '领导力提升，并获得球风点', apply: function () {
        setBranchNode('bench', 'bench_role', { ending: 'climb' });
        var point = grantStoryStylePoint('benchStylePoint');
        return applyStoryFx({ profile: { leadership: 1 }, result: '你接受轮换，但不接受天花板。教练听懂了，也没有被冒犯。<br><br>效果：领导力+1。' + (point ? '<br><br>' + point : '') });
      }}
    ]
  });

  // ——— 身体管理线：年龄或年资到位，不与退役倒计时并行 ———
  pushEvent({
    id: 'story_load_plan',
    branch: 'load', phase: 'offseason', slot: 'training', weight: 12,
    title: '身体管理：队医的夏天计划',
    scenes: [
      '体检报告没有大伤，却有一排黄灯。队医把背靠背和夏联场次摊开，问你要不要从今年夏天开始管身体。'
    ],
    body: '这是保养，不是认输。可媒体不一定这么写。',
    requires: function () {
      if (getBranchNode('load') !== 'start') return false;
      if (getBranchNode('retirement_countdown') !== 'start') return false;
      if (currentAge() < 28 && seasonCount() < 5) return false;
      return true;
    },
    choices: [
      { label: '接受科学恢复计划', hint: '开启身体管理线，伤病风险下降，训练点+1', apply: function () {
        setBranchNode('load', 'load_plan', { plan: 'science' });
        return applyStoryFx({ mods: { injuryRiskBonus: -1, staminaLoad: -1 }, tp: 1, result: '你把夏联场次砍掉两场，把恢复写进日历。训练师第一次没和你争论。<br><br>效果：伤病风险-1；体能负荷-1。' });
      }},
      { label: '仍按硬汉方式练', hint: '不开启此线，力量提升，训练点+1', apply: function () {
        setBranchNode('load', 'load_skip', { plan: 'old' });
        return applyStoryFx({ attrs: { STR: 1 }, mods: { injuryRiskBonus: 1 }, tp: 1, result: '你把报告折起来。你说自己还认得自己的身体。队医点头，也在档案上加了一笔。<br><br>效果：力量+1；伤病风险+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_load_b2b',
    branch: 'load', phase: 'season', slot: 'main', weight: 15, topicId: 'load_b2b',
    title: '身体管理：背靠背被写成态度',
    scenes: [
      '背靠背第二场你轮休。本地电台把这说成“他开始躲比赛”。队友已经在更衣室里听到了。'
    ],
    body: '保护身体的决定，一旦公开，就会变成性格讨论。',
    requires: function () { return getBranchNode('load') === 'load_plan' && gamesPlayed() >= 20; },
    choices: [
      { label: '公开解释这是计划的一部分', hint: '媒体信任提升，压力也上升', apply: function () {
        setBranchNode('load', 'load_b2b', { talk: 'open' });
        return applyStoryFx({ profile: { mediaTrust: 1 }, mods: { mediaPressure: 1 }, result: '你把队医的逻辑讲清楚。有人理解，有人说你矫情。至少更衣室知道这不是临阵脱逃。<br><br>效果：媒体信任+1；媒体压力+1。' });
      }},
      { label: '让球队发布医疗说明', hint: '争议下降，人气下降', apply: function () {
        setBranchNode('load', 'load_b2b', { talk: 'team' });
        return applyStoryFx({ profile: { controversy: -1, fame: -1 }, result: '声明很短，热度也短。你少了一场辩论，也少了一点存在感。<br><br>效果：争议-1；人气-1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_load_habit',
    branch: 'load', phase: 'offseason', slot: 'training', weight: 13,
    title: '身体管理：把保养写成习惯',
    scenes: [
      '第二个夏天，体能组不再问你“要不要管”，只问你“管到什么程度”。'
    ],
    body: '保养要变成习惯，才会在赛季里不被情绪冲掉。',
    requires: function () { return getBranchNode('load') === 'load_b2b'; },
    choices: [
      { label: '把恢复课设成不可取消', hint: '伤病风险再降，训练点+1', apply: function () {
        setBranchNode('load', 'load_habit', { habit: 'fixed' });
        ensureFlags().bodyManagement = true;
        return applyStoryFx({ mods: { injuryRiskBonus: -1, formVariance: -1 }, tp: 1, result: '商业拍摄要改时间。恢复课不再给任何人让路。<br><br>效果：伤病风险-1；状态更稳。' });
      }},
      { label: '保留少量硬仗日', hint: '关键球提升，风险折中，训练点+1', apply: function () {
        setBranchNode('load', 'load_habit', { habit: 'flex' });
        return applyStoryFx({ attrs: { CLU: 1 }, mods: { injuryRiskBonus: 1 }, tp: 1, result: '你允许自己在少数窗口打满。队医皱眉，更衣室却更买账。<br><br>效果：关键球+1；伤病风险+1。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_load_model',
    branch: 'load', phase: 'season', slot: 'main', weight: 16, topicId: 'load_model',
    title: '身体管理：年轻队友来问你',
    scenes: [
      '一名两年级球员在训练后拦住你：他们也开始让我轮休。我该听队医，还是听那些说我不够拼的人？'
    ],
    body: '当你开始被当成样板，这条线就可以收束，并留下一个球风点。',
    requires: function () { return getBranchNode('load') === 'load_habit' && seasonCount() >= 1; },
    choices: [
      { label: '把你的计划原样告诉他', hint: '领导力提升，并获得球风点', apply: function () {
        setBranchNode('load', 'load_model', { ending: 'teach' });
        var point = grantStoryStylePoint('loadStylePoint');
        return applyStoryFx({ profile: { leadership: 1, lockerRoomTrust: 1 }, result: '你没有讲情怀，只把睡眠、力量和出场对照表摊开。他拍了照。<br><br>效果：领导力+1；更衣室信任+1。' + (point ? '<br><br>' + point : '') });
      }},
      { label: '让他自己跟队医谈', hint: '信任提升，并获得球风点', apply: function () {
        setBranchNode('load', 'load_model', { ending: 'defer' });
        var point = grantStoryStylePoint('loadStylePoint');
        return applyStoryFx({ profile: { coachTrust: 1 }, result: '你说：我的计划只适合我。你去问给你做体检的那个人。他后来真的去了。<br><br>效果：教练信任+1。' + (point ? '<br><br>' + point : '') });
      }}
    ]
  });

  pushEvent({
    id: 'story_off_rookie_bridge',
    branch: 'pp_off_rookie', phase: 'offseason', slot: 'training', weight: 11,
    title: '休赛期：新秀夏天的空白',
    scenes: [
      '常规赛结束一周，训练馆忽然空了。没有球探，没有每天的对手，只剩你和一份还没写完的夏天计划。'
    ],
    body: '第一年夏天很容易被商业和回家填满。真正能带走的，往往是作息。',
    requires: function () { return seasonCount() <= 1 && getBranchNode('pp_off_rookie') === 'start'; },
    choices: [
      { label: '跟球队体能组报到', hint: '教练信任提升，负荷可控，训练点+2', apply: function () {
        setBranchNode('pp_off_rookie', 'done', { plan: 'staff' });
        return applyStoryFx({ profile: { coachTrust: 1 }, mods: { staminaLoad: -1 }, tp: 2, result: '你每天到得比规定早十五分钟。没有人拍，助教却把这写进了下赛季的第一印象。<br><br>效果：教练信任+1；体能负荷-1。' });
      }},
      { label: '回家练，但每周回传录像', hint: '忠诚提升，波动略降，训练点+1', apply: function () {
        setBranchNode('pp_off_rookie', 'done', { plan: 'home' });
        return applyStoryFx({ profile: { loyalty: 1, chinaPopularity: 1 }, mods: { formVariance: -1 }, tp: 1, result: '你在熟悉的球馆出汗，也按约定把录像发回。两边都觉得你还在线上。<br><br>效果：忠诚+1；中国人气+1；状态更稳。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_off_euro',
    branch: 'pp_off_euro', phase: 'offseason', slot: 'main', weight: 9,
    title: '休赛期：欧洲巡回邀请',
    scenes: [
      '经纪团队放下一叠行程：三国五场表演赛，酬劳可观，落地时间紧挨着训练营。'
    ],
    body: '巡演能换钱和曝光，也会把夏天切碎。国家队或深度训练已经占满的夏天，不该再叠这一层。',
    requires: function () {
      if (getBranchNode('pp_off_euro') !== 'start') return false;
      if (playerOvr() < 82 || seasonCount() < 2) return false;
      var nt = getBranchNode('china_team');
      if (nt === 'first_camp' || nt === 'return_under_pressure' || (nt && nt.indexOf('role_fight') === 0)) return false;
      if (getBranchNode('load') === 'load_plan' || getBranchNode('load') === 'load_habit') return false;
      return true;
    },
    choices: [
      { label: '只去其中两站', hint: '商业价值提升，负荷上升', apply: function () {
        setBranchNode('pp_off_euro', 'done', { tour: 'two' });
        return applyStoryFx({ profile: { businessValue: 2, fame: 1 }, mods: { staminaLoad: 1 }, result: '你砍掉了最赶的两段航班。钱少一点，人还在训练营前回到主队城市。<br><br>效果：商业价值+2；人气+1；体能负荷+1。' });
      }},
      { label: '全部推掉，留给训练', hint: '教练信任提升，训练点+2', apply: function () {
        setBranchNode('pp_off_euro', 'done', { tour: 'none' });
        return applyStoryFx({ profile: { coachTrust: 1, businessValue: -1 }, mods: { formVariance: -1 }, tp: 2, result: '品牌不高兴。助教把你的名字写进了第一周加练名单。<br><br>效果：教练信任+1；商业价值-1；状态更稳。' });
      }}
    ]
  });

  pushEvent({
    id: 'story_off_july_home',
    branch: 'pp_off_july', phase: 'offseason', slot: 'main', weight: 8,
    title: '休赛期：七月的家庭时间',
    scenes: [
      '家人把七月标成“不许训练馆”。你的体能教练把七月标成“力量窗口”。两张日历在同一张桌子上。'
    ],
    body: '成家或即将成家的夏天，训练和家庭会抢同一段时间。',
    requires: function () {
      if (getBranchNode('pp_off_july') !== 'start') return false;
      if (currentAge() < 26) return false;
      var rel = getBranchNode('relationship');
      if (rel === 'crisis' || rel === 'declined') return false;
      return true;
    },
    choices: [
      { label: '把早晨留给训练，下午留给家', hint: '两边都在，两边都不满，训练点+1', apply: function () {
        setBranchNode('pp_off_july', 'done', { split: true });
        return applyStoryFx({ profile: { loyalty: 1 }, mods: { staminaLoad: 1, formVariance: -1 }, tp: 1, result: '你两边都顾。家人说你还是心不在，训练师说你还是练不够。但七月没有崩。<br><br>效果：忠诚+1；状态更稳；体能负荷+1。' });
      }},
      { label: '真正休七天，再进入力量期', hint: '关系更稳，短期状态更松', apply: function () {
        setBranchNode('pp_off_july', 'done', { split: false });
        return applyStoryFx({ profile: { loyalty: 2 }, mods: { staminaLoad: -1, moraleBonus: 1 }, result: '七天里你几乎没摸球。第八天回馆，动作生疏，人却轻了。<br><br>效果：忠诚+2；体能负荷-1；士气+1。' });
      }}
    ]
  });

  // ——— 独立赛季事件 20-50 ———
  var standalones = [
    momentEvent({
      id: 'posterized', weight: 11, title: '赛季事件：被海报',
      scene: '你成了今晚的背景板。回放在大屏幕上播了三遍，客场把笑声拉得很长。',
      body: '被扣翻的人有三种活法：再对位、躲开镜头，或自己剪一条回击。',
      extra: { contextId: 'road' },
      choices: [
        { label: '下场继续对位他', hint: '内防和力量提升，士气上升', attrs: { IDEF: 1, STR: 1 }, mods: { moraleBonus: 1 }, result: '你把下一组防守当成私人加时。没有新的海报，只有更重的身体接触。<br><br>效果：内防+1；力量+1；士气+1。' },
        { label: '换防避开镜头', hint: '负荷下降，领导力下降', profile: { leadership: -1 }, mods: { staminaLoad: -1 }, result: '教练理解，看台不理解。你保住了膝盖，也把一个笑话留给了互联网。<br><br>效果：体能负荷-1；领导力-1。' },
        { label: '赛后发自己的回击扣篮', hint: '扣篮和人气提升，争议上升', attrs: { DNK: 1 }, profile: { fame: 1, controversy: 1 }, result: '你把训练馆那记补上。评论区开始投票：谁的海报更狠。<br><br>效果：扣篮+1；人气+1；争议+1。' }
      ]
    }),
    momentEvent({
      id: 'you_poster', weight: 10, title: '赛季事件：你把别人海报',
      scene: '擂台夜，你把一名全明星扣翻。他坐在地板上，镜头已经对准你的嘴。',
      body: '怒吼、拉他起来，或无表情走回防守，会变成三种完全不同的名场面。',
      extra: { stateContext: null },
      choices: [
        { label: '怒吼庆祝', hint: '人气和士气大涨，争议上升', profile: { fame: 2, controversy: 1 }, mods: { moraleBonus: 2 }, result: '你对着镜头拍胸口。这晚的集锦不需要再剪。<br><br>效果：人气+2；争议+1；士气+2。' },
        { label: '拉他起来', hint: '球迷支持和媒体信任提升', profile: { fanSupport: 1, mediaTrust: 1, lockerRoomTrust: 1 }, result: '你把他拉起来，拍了拍他的背。回放里这比扣篮更像你。<br><br>效果：球迷支持+1；媒体信任+1；更衣室信任+1。' },
        { label: '无表情走回防守', hint: '关键球和领导力提升', attrs: { CLU: 1 }, profile: { leadership: 1 }, result: '你像做了一次常规上篮。对面更火，你的队友却更安静。<br><br>效果：关键球+1；领导力+1。' }
      ]
    }),
    momentEvent({
      id: 'last_shot_right', weight: 12, title: '赛季事件：绝杀权',
      scene: '最后 8 秒，教练画的是你。控卫想自己来，他已经把球拍得很响。',
      body: '要球、做诱饵，或把夜晚让出去——这会改写更衣室对你的记忆。',
      extra: { contextId: 'national' },
      choices: [
        { label: '要球', hint: '关键球大涨；失手则波动上升', apply: function () {
          var miss = Math.random() < 0.42;
          var fx = { attrs: { CLU: 2 }, profile: { coachTrust: 1 }, result: '球到了你手里。你没有看控卫。<br><br>效果：关键球+2；教练信任+1。' };
          if (miss) {
            fx.mods = { formVariance: 1 };
            fx.result = '你出手了，球在筐上走了一圈。回酒店的路上没人说话。<br><br>效果：关键球+2；教练信任+1；状态波动+1。';
          }
          return applyStoryFx(fx);
        }},
        { label: '做诱饵', hint: '传球和关键球提升，领导力上升', attrs: { PAS: 2, CLU: 1 }, profile: { leadership: 1 }, result: '你把防守带走，空位出现在弱侧。绝杀不是你投的，却是你撕开的。<br><br>效果：传球+2；关键球+1；领导力+1。' },
        { label: '让控卫投', hint: '更衣室信任大涨', profile: { lockerRoomTrust: 2 }, result: '你点了点头。球离开他指尖时，你已经在准备卡位。<br><br>效果：更衣室信任+2。' }
      ]
    }),
    momentEvent({
      id: 'and_one_or_foul', weight: 10, title: '赛季事件：2+1 还是造犯规',
      scene: '连续被吹进攻犯规后，队友在暂停里让你改打法：别再往人堆里钻。',
      body: '冲击、改中投或拉开三分，会把你的进攻形状扳向不同方向。',
      choices: [
        { label: '继续冲击', hint: '终结和力量提升，伤病风险上升', attrs: { FIN: 2, STR: 1 }, mods: { injuryRiskBonus: 1 }, result: '你还是往里打。裁判开始给你吹到 2+1，膝盖也开始抗议。<br><br>效果：终结+2；力量+1；伤病风险+1。' },
        { label: '改中投', hint: '中投提升，教练更放心', attrs: { MID: 2 }, profile: { coachTrust: 1 }, result: '你把终结动作提前到肘区。助教说：这才像能打到五月的人。<br><br>效果：中投+2；教练信任+1。' },
        { label: '拉开投三分', hint: '三分提升，负荷略降', attrs: { threePT: 1 }, mods: { staminaLoad: -1 }, result: '你站到线外，让内线去打架。出手变轻了，责任没有。<br><br>效果：三分+1；体能负荷-1。' }
      ]
    }),
    momentEvent({
      id: 'fifth_foul', weight: 9, title: '赛季事件：最后一次犯规',
      scene: '你五犯，对面核心立刻点名。教练看了看你，又看了看替补席。',
      extra: { stateContext: 'loss_press' },
      body: '贴身、放投还是主动弱侧，决定这节你还值不值得留在场上。',
      choices: [
        { label: '继续贴身', hint: '外防和关键球提升，伤病风险上升', attrs: { PDEF: 1, CLU: 1 }, mods: { injuryRiskBonus: 1 }, result: '你还是贴上去。没有第六次犯规，却有一次险些翻车的对抗。<br><br>效果：外防+1；关键球+1；伤病风险+1。' },
        { label: '放投防突破', hint: '内防和教练信任提升', attrs: { IDEF: 1 }, profile: { coachTrust: 1 }, result: '你让出中距离，守住禁区。教练把战术板上的换防划掉了。<br><br>效果：内防+1；教练信任+1。' },
        { label: '主动换到弱侧', hint: '负荷下降，领导力下降', profile: { leadership: -1 }, mods: { staminaLoad: -1 }, result: '你自己要求去弱侧。比赛还在，你的气场薄了一点。<br><br>效果：体能负荷-1；领导力-1。' }
      ]
    }),
    momentEvent({
      id: 'coach_challenge', weight: 9, title: '赛季事件：超时挑战',
      scene: '一次明显的出界，教练要挑战。你们只剩一次暂停。',
      body: '支持挑战、留暂停，或自己去和裁判讲，都会被写进今晚的胜负里。',
      choices: [
        { label: '支持挑战', hint: '领导力提升，媒体压力上升', profile: { leadership: 1 }, mods: { mediaPressure: 1 }, result: '回放证明你是对的。下一回合同样的球，裁判看了你一眼。<br><br>效果：领导力+1；媒体压力+1。' },
        { label: '建议留暂停', hint: '教练信任和关键球提升', attrs: { CLU: 1 }, profile: { coachTrust: 1 }, result: '你说把暂停留给最后两分钟。教练听了。<br><br>效果：关键球+1；教练信任+1。' },
        { label: '自己去和裁判讲', hint: '关键球提升，争议上升', attrs: { CLU: 1 }, profile: { controversy: 1 }, result: '你把那一球的角度讲完。裁判没有改判，却开始多看你一眼。<br><br>效果：关键球+1；争议+1。' }
      ]
    }),
    momentEvent({
      id: 'jersey_toss', weight: 10, title: '赛季事件：球衣扔看台',
      extra: { contextId: 'home' },
      scene: '你把湿球衣扔给第一排小孩。联盟官员随后走过来，说这不符合规定。',
      body: '交罚款继续扔、改到通道送，或道歉保证不再，会决定球迷怎么记住今晚。',
      choices: [
        { label: '交罚款继续做', hint: '球迷支持大涨，商业价值下降', profile: { fanSupport: 2, controversy: 1, businessValue: -1 }, result: '你把罚单塞进包里。小孩把球衣举过头顶，像赢了总决赛。<br><br>效果：球迷支持+2；争议+1；商业价值-1。' },
        { label: '改成赛后通道送', hint: '球迷支持和媒体信任提升', profile: { fanSupport: 1, mediaTrust: 1 }, result: '你让工作人员记下座位号。通道里的合影比扔出去更长。<br><br>效果：球迷支持+1；媒体信任+1。' },
        { label: '道歉并保证不再', hint: '教练信任提升，球迷支持下降', profile: { coachTrust: 1, fanSupport: -1 }, result: '声明很体面。看台下一场举的是别的名字。<br><br>效果：教练信任+1；球迷支持-1。' }
      ]
    }),
    momentEvent({
      id: 'proposal_board', weight: 9, title: '赛季事件：球迷求婚直播',
      extra: { contextId: 'home' },
      scene: '主场暂停，大屏幕是求婚。他举着你的球衣，全场在等你入画。',
      body: '留下当见证人会打断布置，挥手离开则像冷漠。',
      choices: [
        { label: '留下当见证人', hint: '人气和球迷支持大涨，负荷上升', profile: { fame: 2, fanSupport: 2 }, mods: { staminaLoad: 1 }, result: '你把球夹在腋下，站在他们旁边拍了三张。回来时战术已经讲完一半。<br><br>效果：人气+2；球迷支持+2；体能负荷+1。' },
        { label: '挥手后立刻布置战术', hint: '教练信任提升，人气下降', profile: { coachTrust: 1, fame: -1 }, result: '你点了点头，把人拉回圈里。有人说你职业，有人说你扫兴。<br><br>效果：教练信任+1；人气-1。' },
        { label: '赛后补拍祝福', hint: '媒体信任和球迷支持提升', profile: { mediaTrust: 1, fanSupport: 1 }, result: '你在通道补了一段视频。热度还在，比赛也没断。<br><br>效果：媒体信任+1；球迷支持+1。' }
      ]
    }),
    momentEvent({
      id: 'road_chant', weight: 10, title: '赛季事件：客场合唱嘘声',
      extra: { contextId: 'road' },
      scene: '整节都在喊你的黑称。罚球时声音整齐得像排练过。',
      body: '举手回击、塞耳塞，或赛后致谢，会把嘘声变成不同的燃料。',
      choices: [
        { label: '三分后对看台举手', hint: '三分和士气提升，争议上升', attrs: { threePT: 1 }, profile: { controversy: 1 }, mods: { moraleBonus: 1 }, result: '球进的时候你把手指压在嘴上。嘘声变成了更响的嘘声。<br><br>效果：三分+1；争议+1；士气+1。' },
        { label: '塞耳塞比赛', hint: '状态更稳，人气下降', profile: { fame: -1 }, mods: { formVariance: -1 }, result: '世界安静了一点。你把比赛打得很素，也很少看镜头。<br><br>效果：状态波动-1；人气-1。' },
        { label: '赛后发客场致谢', hint: '媒体信任和球迷支持提升', profile: { mediaTrust: 2, fanSupport: 1 }, result: '你说这是你听过最好的防守。对面球迷把这句话截了下来。<br><br>效果：媒体信任+2；球迷支持+1。' }
      ]
    }),
    momentEvent({
      id: 'kid_midnight', weight: 10, title: '赛季事件：小孩守到凌晨',
      extra: { contextId: 'road' },
      scene: '客场大巴外，一个孩子举着自制海报，保安已经劝过两次。',
      body: '下车、隔窗挥手，或把比赛用球送出去，都是你和球迷之间的一次私人合同。',
      choices: [
        { label: '下车签名合影', hint: '耐力与球迷支持提升，负荷上升', attrs: { STA: 1 }, profile: { fanSupport: 2 }, mods: { staminaLoad: 1 }, result: '司机看了两次表。孩子跑开时，你才感觉到小腿在抖。<br><br>效果：耐力+1；球迷支持+2；体能负荷+1。' },
        { label: '隔窗挥手', hint: '优先恢复', mods: { staminaLoad: -1 }, result: '你把灯打开，挥了挥手。大巴开走时，海报还举着。<br><br>效果：体能负荷-1。' },
        { label: '把比赛用球送出', hint: '传奇声望和球迷支持提升', profile: { legacyBonus: 1, fanSupport: 2 }, result: '装备经理瞪你，孩子把球抱在胸口。那只球以后不会再出现在统计里。<br><br>效果：传奇声望+1；球迷支持+2。' }
      ]
    }),
    momentEvent({
      id: 'shoe_scalper', weight: 9, title: '赛季事件：签名鞋被炒到天价',
      scene: '你的签名鞋在{故乡}卖到普通月薪的三倍。工作室把截图转给你，问要不要回应。',
      body: '限量平价、沉默或谴责黄牛，会同时打动故乡和财务表。',
      requires: function () { bindHometown(); return true; },
      extra: { phases: ['season', 'offseason'] },
      choices: [
        { label: '故乡限量平价投放', hint: '中国人气和球迷支持提升，商业价值下降', profile: { chinaPopularity: 2, fanSupport: 2, businessValue: -1 }, result: '你让他们在{故乡}按原价放了一小批。黄牛骂你，小孩排到了。<br><br>效果：中国人气+2；球迷支持+2；商业价值-1。' },
        { label: '不回应', hint: '商业价值提升', profile: { businessValue: 1 }, result: '你把截图划掉。市场继续按市场的逻辑走。<br><br>效果：商业价值+1。' },
        { label: '谴责黄牛', hint: '媒体信任提升，争议上升', profile: { mediaTrust: 1, controversy: 1 }, result: '声明很硬。有人转发，有人说你自己也靠这个赚钱。<br><br>效果：媒体信任+1；争议+1。' }
      ]
    }),
    momentEvent({
      id: 'ft_whisper', weight: 10, title: '赛季事件：罚球线耳语',
      scene: '对面在你耳边说：你上次季后赛手软。裁判还没把球给你。',
      body: '回一句、用罚球回答，或告诉裁判，会改变你今晚的心跳。',
      choices: [
        { label: '回一句更狠的', hint: '关键球提升，争议和波动上升', attrs: { CLU: 1 }, profile: { controversy: 1 }, mods: { formVariance: 1 }, result: '你把话还回去。罚球进了，呼吸却乱了一拍。<br><br>效果：关键球+1；争议+1；状态波动+1。' },
        { label: '不说话，连罚全中练习', hint: '关键球再升，负荷上升', attrs: { CLU: 2 }, mods: { staminaLoad: 1 }, result: '你把世界缩小到篮筐。两罚全中后，他不再说话。<br><br>效果：关键球+2；体能负荷+1。' },
        { label: '告诉裁判', hint: '媒体信任提升，士气下降', profile: { mediaTrust: 1 }, mods: { moraleBonus: -1 }, result: '裁判把双方拉开。你保住了规则，也把一点火交给了别人。<br><br>效果：媒体信任+1；士气-1。' }
      ]
    }),
    momentEvent({
      id: 'handshake_snub', weight: 9, title: '赛季事件：握手环节冷落',
      scene: '跳球前他对你收手。镜头已经对准你们中间的空隙。',
      body: '拍胸口、当没看见，或赛后发和解照，会决定这张图怎么流传。',
      choices: [
        { label: '拍他胸口', hint: '力量提升，争议上升', attrs: { STR: 1 }, profile: { controversy: 1 }, result: '你拍过去，他瞪回来。这张图会活过今晚的比分。<br><br>效果：力量+1；争议+1。' },
        { label: '当没看见', hint: '领导力提升', profile: { leadership: 1 }, result: '你走向自己的位置。解说把这叫做职业。<br><br>效果：领导力+1。' },
        { label: '赛后发握手照和解', hint: '媒体信任和人气提升', profile: { mediaTrust: 1, fame: 1 }, result: '通道里补拍的那张照片比对抗更像公关，却让热搜降温。<br><br>效果：媒体信任+1；人气+1。' }
      ]
    }),
    momentEvent({
      id: 'bench_mock', weight: 9, title: '赛季事件：替补席模仿你的庆祝',
      extra: { contextId: 'road' },
      scene: '对面板凳区跳起你的招牌动作，动作还夸张了两分。',
      body: '扣篮回敬、对着他们笑，或让队友别理会。',
      choices: [
        { label: '下回合扣篮回敬', hint: '扣篮和人气提升，伤病风险上升', attrs: { DNK: 1 }, profile: { fame: 1 }, mods: { injuryRiskBonus: 1 }, result: '你把回敬做完。落地时训练师已经站起来了。<br><br>效果：扣篮+1；人气+1；伤病风险+1。' },
        { label: '对着他们笑', hint: '领导力和士气提升', profile: { leadership: 1 }, mods: { moraleBonus: 1 }, result: '你指了指自己的脑袋。他们的动作突然不那么好笑了。<br><br>效果：领导力+1；士气+1。' },
        { label: '让队友别理会', hint: '教练信任和默契提升', profile: { coachTrust: 1 }, mods: { teamChemistry: 1 }, result: '你把庆祝收回来。比赛重新变得像比赛。<br><br>效果：教练信任+1；球队默契+1。' }
      ]
    }),
    momentEvent({
      id: 'poor_mans_legend', weight: 10, title: '赛季事件：采访对比',
      scene: '主持人说你是「穷版的{名宿}」。现场有人笑，摄像机没有关。',
      body: '接受致敬、反驳“我是我”，或幽默接梗，都会改写你和名宿的关系。',
      requires: function () { bindStoryLegend(); return getBranchNode('legend') !== 'start' || playerOvr() >= 82; },
      choices: [
        { label: '接受并致敬', hint: '传奇声望提升，并偷一点他的技术', apply: function () {
          bindStoryLegend();
          var legend = getStoryLegend();
          var attrs = {};
          attrs[legend.attr] = 1;
          applyStoryFx({ attrs: attrs, profile: { legacyBonus: 1 } });
          return '你说能被拿去和{名宿}比，已经是今晚最漂亮的错。然后你把那一下又练进了比赛。<br><br>效果：传奇声望+1；' + (typeof attrCN === 'function' ? attrCN(legend.attr) : legend.attr) + '+1。';
        }},
        { label: '反驳：我是我', hint: '关键球提升，争议上升', attrs: { CLU: 1 }, profile: { controversy: 1 }, result: '你说别给活人盖章。弹幕分成两派，你的下一次出手更硬。<br><br>效果：关键球+1；争议+1。' },
        { label: '幽默接梗', hint: '人气和媒体信任提升', profile: { fame: 2, mediaTrust: 1 }, result: '你问主持人：那富版什么时候到账。笑声盖过了比较。<br><br>效果：人气+2；媒体信任+1。' }
      ]
    }),
    momentEvent({
      id: 'load_manage_leak', weight: 11, title: '赛季事件：负荷管理传闻',
      extra: { stateContext: null },
      scene: '名记爆料你下一场背靠背要轮休。你本人是从社交媒体知道的。',
      body: '要求打满、接受轮休，或公开澄清，会同时打动教练、球迷和膝盖。',
      choices: [
        { label: '要求打满', hint: '耐力与球迷支持提升，伤病和教练关系变差', attrs: { STA: 1 }, profile: { coachTrust: -1, fanSupport: 1 }, mods: { injuryRiskBonus: 1 }, result: '你走进教练办公室：我能打。名单上你的名字没有被划掉。<br><br>效果：耐力+1；球迷支持+1；教练信任-1；伤病风险+1。' },
        { label: '接受轮休', hint: '伤病和负荷下降，球迷支持下降', profile: { fanSupport: -1 }, mods: { injuryRiskBonus: -2, staminaLoad: -2 }, result: '你坐在西装里看完一场。膝盖感谢你，主场不感谢。<br><br>效果：伤病风险-2；体能负荷-2；球迷支持-1。' },
        { label: '公开澄清是误报', hint: '媒体信任和教练信任提升', profile: { mediaTrust: 2, coachTrust: 1 }, result: '你把训练照片发上去。名记删了帖，教练拍了拍你的肩。<br><br>效果：媒体信任+2；教练信任+1。' }
      ]
    }),
    momentEvent({
      id: 'trade_whiteboard', weight: 12, title: '赛季事件：交易流言白板',
      extra: { contextId: 'deadline' },
      scene: '训练馆出现你和对方球星的交换图，画工很差，传播很快。',
      body: '问总经理、发“我哪也不去”，或沉默加练，会改写忠诚和谈判。',
      choices: [
        { label: '问总经理', hint: '忠诚提升，状态波动上升', profile: { loyalty: 1 }, mods: { formVariance: 1 }, result: '办公室的门关上了。你得到的不是保证，是一段比流言更复杂的解释。<br><br>效果：忠诚+1；状态波动+1。' },
        { label: '发「我哪也不去」', hint: '球迷和忠诚大涨，商业谈判变差', profile: { fanSupport: 2, loyalty: 2, businessValue: -1 }, result: '声明比经纪人更快。球迷爱你，谈判桌少了一张牌。<br><br>效果：球迷支持+2；忠诚+2；商业价值-1。' },
        { label: '沉默加练', hint: '补一块短板，媒体压力上升', apply: function () {
          var pos = playerPos();
          var key = pos === 'C' || pos === 'PF' ? 'REB' : (pos === 'PG' ? 'PAS' : 'MID');
          var attrs = {};
          attrs[key] = 1;
          applyStoryFx({ attrs: attrs, mods: { mediaPressure: 1 } });
          return '你把手机交给训练师。加练不会让流言消失，但能让你明天还像自己。<br><br>效果：' + (typeof attrCN === 'function' ? attrCN(key) : key) + '+1；媒体压力+1。';
        }}
      ]
    }),
    momentEvent({
      id: 'gleague_callup', weight: 9, title: '赛季事件：G 联赛队友上来',
      scene: '十年前的训练营对手以双向合同上来，教练要把你的替补分钟分给他。',
      body: '帮他熟悉体系、纯竞争，或请教练明确轮换。',
      choices: [
        { label: '帮他熟悉体系', hint: '传球和更衣室信任提升', attrs: { PAS: 1 }, profile: { lockerRoomTrust: 2 }, result: '你把防守轮转画在纸巾上。他第一次没站错位置时，冲你竖了拇指。<br><br>效果：传球+1；更衣室信任+2。' },
        { label: '纯竞争', hint: '运动能力提升，更衣室信任下降', attrs: { ATH: 1 }, profile: { lockerRoomTrust: -1 }, result: '你没有让分钟。训练赛你们谁也不说话。<br><br>效果：运动+1；更衣室信任-1。' },
        { label: '请教练明确轮换', hint: '教练信任提升，波动下降', profile: { coachTrust: 1 }, mods: { formVariance: -1 }, result: '白板被写清楚了。两个人都知道自己哪天打。<br><br>效果：教练信任+1；状态波动-1。' }
      ]
    }),
    momentEvent({
      id: 'superteam_rumor', weight: 11, title: '赛季事件：超级球队传闻',
      extra: { contextId: 'deadline' },
      scene: '经纪人说有第三条巨头想拉你组队。消息还没写进专栏，更衣室已经在传。',
      body: '拒绝并告诉现队、吊胃口，或只听不表态。',
      requires: function () { return playerOvr() >= 86 || hasCareerHonor('全明星'); },
      choices: [
        { label: '拒绝并告诉现队', hint: '忠诚和教练信任大涨，人气下降', profile: { loyalty: 3, coachTrust: 2, fame: -1 }, result: '你把电话内容告诉了总经理。他没有立刻许诺冠军，只说：谢谢你先告诉我们。<br><br>效果：忠诚+3；教练信任+2；人气-1。' },
        { label: '不否认，吊胃口', hint: '商业价值上升，更衣室信任下降', profile: { businessValue: 2, lockerRoomTrust: -2, controversy: 1 }, result: '你说“什么都有可能”。股票和猜疑一起涨。<br><br>效果：商业价值+2；更衣室信任-2；争议+1。' },
        { label: '只听不表态', hint: '领导力提升', profile: { leadership: 1 }, result: '你把信息收进口袋。这个赛季还没打完。<br><br>效果：领导力+1。' }
      ]
    }),
    momentEvent({
      id: 'playbook_leak', weight: 10, title: '赛季事件：战术板被偷拍',
      scene: '你的个人暗号本出现在社交媒体。下一场对手已经在评论区做填空题。',
      body: '连夜改手势、将计就计，或走法律程序。',
      choices: [
        { label: '连夜改全套手势', hint: '护球提升，负荷和媒体压力上升', attrs: { HAN: 1 }, mods: { staminaLoad: 1, mediaPressure: 1 }, result: '凌晨的会议室像在重新发明语言。你们用新的错误换旧的暴露。<br><br>效果：护球+1；体能负荷+1；媒体压力+1。' },
        { label: '将计就计做假暗号', hint: '传球和关键球提升', attrs: { PAS: 1, CLU: 1 }, result: '你把那一套留给对手去防。真的进攻从另一侧开始。<br><br>效果：传球+1；关键球+1。' },
        { label: '报警并起诉', hint: '媒体信任和争议上升', profile: { controversy: 1, mediaTrust: 1 }, result: '律师比助教更早到达。这件事离开了篮球，进入了另一个联盟。<br><br>效果：媒体信任+1；争议+1。' }
      ]
    }),
    momentEvent({
      id: 'veteran_speech', weight: 10, title: '赛季事件：老将退役你致辞',
      scene: '更衣室大哥退役，请你代表现役发言。话筒比你想的重。',
      body: '讲防守细节、讲段子，或把话筒给新秀。',
      requires: function () { return seasonCount() >= 2; },
      choices: [
        { label: '讲他教你的防守细节', hint: '内防、传奇和球迷支持提升', attrs: { IDEF: 1 }, profile: { legacyBonus: 1, fanSupport: 2 }, result: '你把一次补位讲得很慢。他在台下抹眼睛，假装在看手机。<br><br>效果：内防+1；传奇声望+1；球迷支持+2。' },
        { label: '讲段子活跃气氛', hint: '人气上升，领导力略降', profile: { fame: 1, leadership: -1 }, result: '大家笑了。有人觉得这不像告别，更像热身。<br><br>效果：人气+1；领导力-1。' },
        { label: '把话筒给新秀', hint: '更衣室信任和领导力提升', profile: { lockerRoomTrust: 2, leadership: 1 }, result: '新秀的声音在发抖。更衣室因此更像一支还要继续打的队。<br><br>效果：更衣室信任+2；领导力+1。' }
      ]
    }),
    momentEvent({
      id: '2k_rating', weight: 10, title: '赛季事件：游戏评分发布',
      extra: { phases: ['offseason', 'season'] },
      scene: '你的三分被打低了两档，队友群开始刷你的绿光失败集锦。',
      body: '自嘲、发训练数据回击，或不看评分。',
      choices: [
        { label: '拍打铁集锦自嘲', hint: '人气提升，状态更稳', profile: { fame: 2 }, mods: { formVariance: -1 }, result: '你把最丑的那几记剪进去。评论说这人还有点意思。<br><br>效果：人气+2；状态波动-1。' },
        { label: '发训练数据回击', hint: '三分提升，负荷上升', attrs: { threePT: 1 }, mods: { staminaLoad: 1 }, result: '你较真了。空馆多出来的那一百球，是给一个数字看的。<br><br>效果：三分+1；体能负荷+1。' },
        { label: '不看评分', hint: '教练信任提升', profile: { coachTrust: 1 }, result: '你把游戏卸了。训练师说这是本周最聪明的决定。<br><br>效果：教练信任+1。' }
      ]
    }),
    momentEvent({
      id: 'streetball', weight: 11, title: '休赛期：街头局被点名',
      extra: { phase: 'offseason', phases: ['offseason'] },
      scene: '你回{故乡}，公园里有人点名 1v1。手机已经围上来。',
      body: '打满、只打一场，或拒绝保护身体。',
      requires: function () { bindHometown(); return getBranchNode('hometown') !== 'start' || seasonCount() >= 1; },
      choices: [
        { label: '打满到天黑', hint: '运动、护球和人气提升，伤病风险上升', attrs: { ATH: 1, HAN: 1 }, profile: { fame: 2 }, mods: { injuryRiskBonus: 1 }, result: '水泥地比木地板更硬。你把人留下，也把脚踝留在了极限上。<br><br>效果：运动+1；护球+1；人气+2；伤病风险+1。' },
        { label: '只打一场就走', hint: '人气略升', profile: { fame: 1 }, result: '你赢了第一个，把球抛回去。人群还想看第二个。<br><br>效果：人气+1。' },
        { label: '拒绝', hint: '负荷下降，球迷支持下降', profile: { fanSupport: -1 }, mods: { staminaLoad: -1 }, result: '你说膝盖比热闹重要。有人理解，有人拍了你上车的背影。<br><br>效果：体能负荷-1；球迷支持-1。' }
      ]
    }),
    momentEvent({
      id: 'movie_cameo', weight: 8, title: '赛季事件：电影镜头',
      extra: { phases: ['offseason', 'season'] },
      scene: '导演要你在电影里被新秀过掉，作为笑点。片酬不错，剧本把你写成背景板。',
      body: '接戏、改成你防下他，或拒演。',
      requires: function () { return (STATE.career.profile && STATE.career.profile.fame || 0) >= 4 || playerOvr() >= 84; },
      choices: [
        { label: '接戏', hint: '人气和商业价值大涨，争议上升', profile: { fame: 2, businessValue: 2, controversy: 1 }, result: '你被过掉的那一段进了预告片。朋友开始用那一招笑你。<br><br>效果：人气+2；商业价值+2；争议+1。' },
        { label: '改成你防下他', hint: '商业价值略升，人气下降', profile: { businessValue: 1, fame: -1 }, result: '导演不太高兴。你保住了面子，也让电影少了一个梗。<br><br>效果：商业价值+1；人气-1。' },
        { label: '拒演', hint: '媒体信任提升', profile: { mediaTrust: 1 }, result: '你说自己的工作不是被写成笑话。经纪团队叹了口气，又给你点了个赞。<br><br>效果：媒体信任+1。' }
      ]
    }),
    momentEvent({
      id: 'closeout_ball', weight: 11, title: '赛季事件：淘汰夜的那颗球',
      extra: { contextId: 'national' },
      scene: '淘汰夜，球滚到你脚边，对面已经在庆祝。摄像机等你决定这颗球的归属。',
      body: '交给对方核心、自己抱走，或放在中圈离开。',
      requires: function () { return gamesPlayed() >= 70 || (STATE.season && STATE.season.isPlayoffs); },
      choices: [
        { label: '把球交给对方核心', hint: '传奇声望和领导力提升', profile: { legacyBonus: 2, leadership: 1 }, result: '你把球递过去。他点了下头。这张图会比比分活得更久。<br><br>效果：传奇声望+2；领导力+1。' },
        { label: '自己抱走', hint: '争议上升，关键球提升', attrs: { CLU: 1 }, profile: { controversy: 2 }, result: '你把球夹在腋下走进通道。有人说小气，有人说这才像还没认输。<br><br>效果：关键球+1；争议+2。' },
        { label: '放在中圈离开', hint: '媒体信任提升', profile: { mediaTrust: 1 }, result: '球停在中圈，像这场比赛自己的句号。你没有回头。<br><br>效果：媒体信任+1。' }
      ]
    }),
    momentEvent({
      id: 'santa_assist', weight: 8, title: '赛季事件：圣诞老人发球',
      extra: { contextId: 'home' },
      scene: '圣诞大战中场，联盟安排你扮助演，给小孩发球。化妆间里有一顶帽子。',
      body: '认真演完、推给队友，或加码掏出签名鞋。',
      requires: function () { return gamesPlayed() >= 22 && gamesPlayed() <= 40; },
      choices: [
        { label: '认真演完', hint: '球迷支持提升，负荷上升', profile: { fanSupport: 2 }, mods: { staminaLoad: 1 }, result: '帽子有点痒。小孩把球投进时，你比他还高兴。<br><br>效果：球迷支持+2；体能负荷+1。' },
        { label: '推给队友', hint: '更衣室信任提升', profile: { lockerRoomTrust: 1 }, result: '你把帽子扣到{队友}头上。他后来把这段当成了年度糗事。<br><br>效果：更衣室信任+1。' },
        { label: '加码掏出签名鞋', hint: '球迷和人气提升，商业价值下降', profile: { businessValue: -1, fanSupport: 2, fame: 1 }, result: '帽子、球鞋、尖叫。品牌后来问你能不能提前说一声。<br><br>效果：球迷支持+2；人气+1；商业价值-1。' }
      ]
    }),
    momentEvent({
      id: 'jetlag_london', weight: 9, title: '赛季事件：海外赛时差',
      scene: '伦敦的早晨，你的投篮全打铁。时差把你的手腕变成了别人的。',
      body: '补手感课、补觉，或逛街拍片。',
      requires: function () { return gamesPlayed() >= 10 && gamesPlayed() <= 28; },
      choices: [
        { label: '改投篮手感课', hint: '中投或三分提升，负荷上升', apply: function () {
          var key = ['PG', 'SG', 'SF'].indexOf(playerPos()) >= 0 ? 'threePT' : 'MID';
          var attrs = {};
          attrs[key] = 1;
          applyStoryFx({ attrs: attrs, mods: { staminaLoad: 1 } });
          return '你在空馆把时差汗出来。第一记空心出现时，窗外还是阴的。<br><br>效果：' + (typeof attrCN === 'function' ? attrCN(key) : key) + '+1；体能负荷+1。';
        }},
        { label: '补觉', hint: '负荷和波动下降', mods: { staminaLoad: -2, formVariance: -1 }, result: '你把窗帘拉死。比赛日的腿终于像自己的。<br><br>效果：体能负荷-2；状态波动-1。' },
        { label: '逛城市拍片', hint: '人气和中国人气提升，波动上升', profile: { fame: 1, chinaPopularity: 1 }, mods: { formVariance: 1 }, result: '大本钟比手感先上热搜。你知道今晚可能还要找投篮。<br><br>效果：人气+1；中国人气+1；状态波动+1。' }
      ]
    }),
    momentEvent({
      id: 'rafter_night', weight: 10, title: '赛季事件：退役球衣升空',
      extra: { contextId: 'home' },
      scene: '球馆升起{队史名宿}的球衣。聚光灯先打在屋顶，再擦过你的肩。',
      body: '穿致敬配色、赛后看他的防守录像，或只聊商业。',
      requires: function () { bindTeamRafterStar(); return gamesPlayed() >= 12; },
      choices: [
        { label: '整场只穿致敬配色', hint: '传奇声望和球迷支持提升', profile: { legacyBonus: 1, fanSupport: 1 }, result: '你把颜色穿成一句没有说出口的谢谢。屋顶上是{队史名宿}，看台上是这座城。<br><br>效果：传奇声望+1；球迷支持+1。' },
        { label: '赛后反复看他的防守录像', hint: '外防或内防提升', apply: function () {
          var key = playerPos() === 'C' || playerPos() === 'PF' ? 'IDEF' : 'PDEF';
          var attrs = {};
          attrs[key] = 1;
          applyStoryFx({ attrs: attrs });
          return '你把{队史名宿}那一处站位看了二十遍。第二天训练你改掉了自己的。<br><br>效果：' + (typeof attrCN === 'function' ? attrCN(key) : key) + '+1。';
        }},
        { label: '聊商业不聊球', hint: '商业价值上升，教练信任下降', profile: { businessValue: 2, coachTrust: -1 }, result: '赞助商很高兴。更衣室有人嘀咕：今晚本该是{队史名宿}的。<br><br>效果：商业价值+2；教练信任-1。' }
      ]
    }),
    momentEvent({
      id: 'iso_clearout', weight: 11, title: '赛季事件：最后两分钟改 ISO',
      scene: '教练突然改成你单打，弱侧全清。控卫看了你一眼，又看了看战术板。',
      body: '执行、仍传空位，或叫暂停自己重画。',
      extra: { contextId: 'national' },
      choices: [
        { label: '执行单打', hint: '关键球和终结提升，默契下降', attrs: { CLU: 2, FIN: 1 }, mods: { teamChemistry: -1 }, result: '你把空间用完。球进了，弱侧有人举手却没等到。<br><br>效果：关键球+2；终结+1；球队默契-1。' },
        { label: '仍传空位', hint: '传球和关键球提升，教练信任下降', attrs: { PAS: 2, CLU: 1 }, profile: { coachTrust: -1 }, result: '你看见了角落。教练的战术被你改成了正确的球。<br><br>效果：传球+2；关键球+1；教练信任-1。' },
        { label: '叫暂停自己重画', hint: '领导力提升，负荷上升', profile: { leadership: 2 }, mods: { staminaLoad: 1 }, result: '你把战术板转过来。所有人第一次在最后两分钟听你讲。<br><br>效果：领导力+2；体能负荷+1。' }
      ]
    }),
    momentEvent({
      id: 'return_from_injury', weight: 12, title: '赛季事件：伤愈归来的第一声哨',
      extra: { stateContext: null },
      scene: '你复出，对面第一下就试你的膝盖。队医在场边站起来。',
      body: '硬造犯规、拉开投篮，或告诉裁判和队长。',
      requires: function (ctx) {
        var mods = STATE.career && STATE.career.nextSeasonMods || {};
        var injured = STATE.season && STATE.season.events && STATE.season.events.injuryGamesLeft > 0;
        return (Number(mods.injuryRiskBonus) || 0) >= 1 || injured || (ctx && ctx.state && ctx.state.injuryConcern);
      },
      choices: [
        { label: '下一回合硬造犯规', hint: '力量和终结提升，伤病风险再升', attrs: { STR: 1, FIN: 1 }, mods: { injuryRiskBonus: 1 }, result: '你把试探还回去。哨响了，膝盖也响了一下。<br><br>效果：力量+1；终结+1；伤病风险+1。' },
        { label: '拉开投篮', hint: '投射提升，伤病风险下降', apply: function () {
          var key = ['PG', 'SG', 'SF'].indexOf(playerPos()) >= 0 ? 'threePT' : 'MID';
          var attrs = {};
          attrs[key] = 1;
          applyStoryFx({ attrs: attrs, mods: { injuryRiskBonus: -1 } });
          return '你不往人堆里走。今晚的胜利不必用同一侧膝盖去换。<br><br>效果：' + (typeof attrCN === 'function' ? attrCN(key) : key) + '+1；伤病风险-1。';
        }},
        { label: '告诉裁判和队长', hint: '媒体信任提升，士气下降', profile: { mediaTrust: 1 }, mods: { moraleBonus: -1 }, result: '保护程序启动。你保住了规则，更衣室有人觉得这不像硬汉。<br><br>效果：媒体信任+1；士气-1。' }
      ]
    }),
    momentEvent({
      id: 'bow_to_hoop', weight: 9, title: '赛季事件：空馆鞠躬',
      scene: '有人拍到你在空馆加练后对篮筐鞠躬，像退役宣言。其实你只是累了。',
      body: '发视频说还早、承认情绪低落，或删除让它发酵。',
      requires: function () { return seasonCount() >= 2; },
      choices: [
        { label: '发视频说「还早」', hint: '球迷、关键球和人气提升', attrs: { CLU: 1 }, profile: { fanSupport: 2, fame: 1 }, result: '你把加练片段配上一句还早。评论区从退役改成催下赛季。<br><br>效果：关键球+1；球迷支持+2；人气+1。' },
        { label: '承认那天情绪低落', hint: '媒体信任提升，波动下降', profile: { mediaTrust: 2 }, mods: { formVariance: -1 }, result: '你说那不是告别，是感谢自己还站得住。有人说这比任何庆祝都像大人。<br><br>效果：媒体信任+2；状态波动-1。' },
        { label: '删除，让它发酵', hint: '争议和人气上升，传奇声望微升', profile: { controversy: 1, fame: 1, legacyBonus: 1 }, result: '视频越传越像神话。你没有解释，于是每个人都有自己的解释。<br><br>效果：争议+1；人气+1；传奇声望+1。' }
      ]
    })
  ];

  standalones.forEach(pushEvent);

  // 宿敌热战期：降低一次性垃圾话事件，避免和宿敌线抢同一张嘴
  function isRivalHot() {
    if (typeof getBranchNode !== 'function') return false;
    var n = getBranchNode('rival');
    return n === 'rival_talk' || n === 'rival_media' || n === 'rival_christmas' || n === 'rival_fuel';
  }
  if (typeof EVENT_REGISTRY !== 'undefined' && Array.isArray(EVENT_REGISTRY)) {
    EVENT_REGISTRY.forEach(function (ev) {
      if (!ev || !ev.id || ev.id.indexOf('trash_') !== 0) return;
      var prev = ev.condition;
      ev.condition = function (ctx) {
        if (isRivalHot()) return false;
        return typeof prev === 'function' ? prev(ctx) : true;
      };
    });
  }

  var seasonTotal = STAGED_BRANCH_EVENTS.filter(function (event) {
    var phases = event.phases || [event.phase || 'offseason'];
    return phases.indexOf('season') >= 0;
  }).length;
  window.PERFECT_PLAYER_STORY_EVENT_REPORT = {
    added: 70,
    seasonTotal: seasonTotal,
    legends: Object.keys(LEGEND_POOL).reduce(function (sum, key) { return sum + LEGEND_POOL[key].length; }, 0)
  };
})();
