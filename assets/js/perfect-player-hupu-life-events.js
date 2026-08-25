/* Perfect Player — 虎扑读书/品牌/暴力冲突支线（通用模式） */
(function () {
  'use strict';

// ==================== 读书疗愈：书池与抽书 ====================
const READING_BOOKS = [
  { key: 'godfather', title: '《教父》', weight: 5, scene: '你翻开第一页，看见那句“一个人只有一个命运”。窗外新闻还在吵，你忽然想明白：舆论只负责制造声音，不负责替你决定人生。', effects: ['领导力+1', '媒体压力-1'], apply: function() { addProfileDelta('leadership', 1); addSeasonMod('mediaPressure', -1, -10, 10); } },
  { key: 'public_opinion', title: '《舆论的力量》', weight: 14, scene: '这本书把“被所有人注视”写得比球场更累。读到一半，你关掉了手机推送，第一次觉得那些解说词只是背景音。', effects: ['媒体好感+1', '媒体压力-2'], apply: function() { addProfileDelta('mediaTrust', 1); addSeasonMod('mediaPressure', -2, -10, 10); } },
  { key: 'alive', title: '《活着》', weight: 9, scene: '福贵的一生比任何一场失利都沉。合上书时你愣了很久，然后给家里打了个电话：我很好，只是突然想听听你的声音。', effects: ['媒体压力-2', '忠诚+1', '状态波动-1'], apply: function() { addSeasonMod('mediaPressure', -2, -10, 10); addProfileDelta('loyalty', 1); addSeasonMod('formVariance', -1, -10, 10); } },
  { key: 'old_man_and_sea', title: '《老人与海》', weight: 9, scene: '圣地亚哥和那条大鱼搏斗了三天三夜。你想起自己上一次加时赛，也是这样一个人扛着，没有放弃。', effects: ['关键球+1', '状态波动-1'], apply: function() { addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs); addSeasonMod('formVariance', -1, -10, 10); } },
  { key: 'thinking_fast_slow', title: '《思考，快与慢》', weight: 13, scene: '书里说，人在疲惫时更容易相信第一个跳出来的答案。你开始复盘自己的每一次勉强出手，发现很多球根本不该投。', effects: ['状态波动-1', '媒体好感+1'], apply: function() { addSeasonMod('formVariance', -1, -10, 10); addProfileDelta('mediaTrust', 1); } },
  { key: 'silent_majority', title: '《沉默的大多数》', weight: 13, scene: '王小波说，沉默不是没有态度，是不想和噪音共用一套语言。你合上书，把发布会要说的话删到只剩两句。', effects: ['媒体压力-2', '媒体好感+1'], apply: function() { addSeasonMod('mediaPressure', -2, -10, 10); addProfileDelta('mediaTrust', 1); } },
  { key: 'three_body', title: '《三体》', weight: 5, scene: '你读到“降维打击”时笑了。第二天训练，你把对手的战术想象成二维平面，忽然觉得一切都没那么可怕。', effects: ['关键球+1', '人气+1'], apply: function() { addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs); addProfileDelta('fame', 1); } },
  { key: 'dragon_hero', title: '《天龙八部》', weight: 8, scene: '你最喜欢扫地僧。他不出手，不是因为不会，而是因为没必要。你决定下一场也试着少说、多做、深藏不露。', effects: ['状态波动-1', '更衣室信任+1', '媒体压力-1'], apply: function() { addSeasonMod('formVariance', -1, -10, 10); addProfileDelta('lockerRoomTrust', 1); addSeasonMod('mediaPressure', -1, -10, 10); } }
];

function isReadingPressureEligible() {
  var mods = STATE.career.nextSeasonMods || {};
  var profile = STATE.career.profile || {};
  if ((mods.mediaPressure || 0) >= 2) return true;
  if ((profile.controversy || 0) >= 2) return true;
  if ((mods.formVariance || 0) >= 2) return true;
  try { return getMentalPressure() >= 5; } catch(e) { return false; }
}

function pickReadingBook() {
  var mods = STATE.career.nextSeasonMods || {};
  var profile = STATE.career.profile || {};
  var pool = READING_BOOKS.map(function(b) {
    var w = b.weight || 10;
    if ((b.key === 'public_opinion' || b.key === 'silent_majority' || b.key === 'alive') && ((mods.mediaPressure || 0) >= 2 || (profile.controversy || 0) >= 3)) w += 4;
    if ((b.key === 'alive' || b.key === 'dragon_hero' || b.key === 'old_man_and_sea') && (mods.formVariance || 0) >= 2) w += 3;
    return { book: b, weight: w };
  });
  var total = 0;
  pool.forEach(function(p) { total += p.weight; });
  var roll = Math.random() * total;
  for (var i = 0; i < pool.length; i++) {
    roll -= pool[i].weight;
    if (roll <= 0) return pool[i].book;
  }
  return pool[pool.length - 1].book;
}

function applyReadingBookEffects(book) {
  if (!book || !book.apply) return;
  try { book.apply(); } catch(e) {}
}

// ==================== 暴力冲突：对手与文案 ====================
function getViolenceOpponentNameFor(team) {
  if (!team) return '他';
  var top = null;
  try { top = getTeamTopPlayer(team); } catch(e) {}
  return (top && (top.cname || top.name)) || '那个刺头';
}

function fillViolenceText(str) {
  var opp = STATE._violenceOpponent || {};
  var pName = opp.name || '他';
  var tName = opp.team ? (getTeamName ? getTeamName(opp.team) : opp.team) : '对手球队';
  return String(str || '')
    .replace(/\{对手球员\}/g, pName)
    .replace(/\{对手球队\}/g, tName);
}

function getViolenceInsultText() {
  var c = STATE.career;
  if (c && c.relationships && c.relationships.partner) return '你的老婆比我们家的沙发还软';
  if (c && c.branches && c.branches.family && c.branches.family.node && c.branches.family.node !== 'start') return '你的家人连训练馆的灯都不如';
  return '你在这座城市一无所有';
}

function isHennessyEligible() {
  var p = STATE.career.profile || {};
  return (p.fame || 0) >= 60 && (p.businessValue || 0) >= 40 && (p.mediaTrust || 0) >= 35 && (p.controversy || 0) <= 25;
}


  var HUPU_LIFE_BRANCH_EVENTS = [
{
    id: 'reading_open',
    branch: 'reading',
    phase: 'season',
    slot: 'main',
    weight: 12,
    title: '读书：把手机放下',
    scenes: [
      '近一段时间，你身陷媒体营造的舆论漩涡之中，状态起伏不定，心态也极易受影响。',
      '身边那个人把手机从你手里拿走，放下一摞书：选一本，看完之前，别碰手机。'
    ],
    body: '把噪音关在书外，是你先要完成的一次对抗。',
    requires: function() {
      var c = STATE.career;
      if (!c || (c.seasonCount || 0) < 1) return false;
      if (c.flags && c.flags.readingDone) return false;
      return isReadingPressureEligible();
    },
    choices: [
      { label: '随手抽出一本', hint: '看看今晚会读到什么', apply: function() {
        var book = pickReadingBook();
        applyReadingBookEffects(book);
        var c = STATE.career;
        c.flags = c.flags || {};
        c.flags.readingBook = book.key;
        c.flags.readingBookTitle = book.title;
        c.flags.readingDone = true;
        c.flags.readingDoneSeason = c.seasonCount || 0;
        c.flags.readingDoneGameNum = STATE.season && STATE.season.games ? STATE.season.games.length : 0;
        c.flags.readingEchoAt = c.flags.readingDoneGameNum + 10 + Math.floor(Math.random() * 11);
        return book.scene + '<br><br>效果：' + book.effects.join('；') + '。';
      }}
    ]
  },
  {
    id: 'reading_echo',
    branch: 'reading',
    phase: 'season',
    slot: 'main',
    weight: 12,
    title: '读书回响',
    scenes: [
      '那一晚你输了一场不该输的比赛。更衣室安静时，书里那句话突然回到你脑子里，像有人替你按下了暂停键。'
    ],
    body: '书读过了，话也留下了。这一刻，你要怎么回应它？',
    requires: function() {
      var c = STATE.career;
      if (!c || !c.flags) return false;
      if (!c.flags.readingDone || c.flags.readingEchoDone) return false;
      var gamesPlayed = STATE.season && STATE.season.games ? STATE.season.games.length : 0;
      if ((c.seasonCount || 0) > (c.flags.readingDoneSeason || 0)) return true;
      return gamesPlayed >= (c.flags.readingEchoAt || 0);
    },
    choices: [
      { label: '想起书里的话，把手机交给队友', hint: '让身边的人替你保管一晚', apply: function() {
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('mediaTrust', 1);
        return '你第一次没有在深夜刷评论，睡了最近最完整的一觉。<br><br>效果：状态波动-1；媒体好感+1。';
      }},
      { label: '合上书，回训练馆加练', hint: '把情绪变成汗水（若读过《老人与海》或《三体》，则改为状态收敛）', apply: function() {
        var f = STATE.career.flags || {};
        var already = f.readingBook === 'old_man_and_sea' || f.readingBook === 'three_body';
        if (already) {
          addSeasonMod('formVariance', -1, -10, 10);
          return '你回到训练馆，投到保洁阿姨来关灯。那句书里的话已经被你忘在篮筐后面。<br><br>效果：状态波动-1。';
        }
        addAttrDelta('CLU', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回到训练馆，投到保洁阿姨来关灯。那句书里的话已经被你忘在篮筐后面。<br><br>效果：关键球+1。';
      }},
      { label: '把书收起来，当什么都没发生', hint: '今晚不处理情绪', apply: function() {
        return '你把它放回书架，继续刷手机。书还在那里，等你下一次想起它。<br><br>效果：无额外效果，回响线收束。';
      }}
    ]
  },
  {
    id: 'violence_open',
    branch: 'violence_conflict',
    phase: 'season',
    slot: 'main',
    weight: 10,
    title: '暴力冲突：那一拳',
    scenes: [
      '这一晚，你被对方的刺头搞得心烦意乱。他不停地用垃圾话和小动作挑逗你的神经，你的怒火急剧攀升。',
      '终于，他的一句垃圾话彻底攻破了你的心理防线——“{挑衅词}。”',
      '你愤怒地将他撞倒，攥紧的拳头扬在了空中。'
    ],
    body: '这一拳落不落下去，决定今晚之后所有故事。',
    requires: function(ctx) {
      var c = STATE.career;
      if (!c || (c.seasonCount || 0) < 1) return false;
      if (c.flags && c.flags.violenceConflict && c.flags.violenceConflict.done) return false;
      var team = ctx && ctx.game && ctx.game.opponent;
      if (team) {
        STATE._violenceOpponent = { team: team, name: getViolenceOpponentNameFor(team) };
      }
      return true;
    },
    choices: [
      { label: '一拳砸下去', hint: '彻底失控，把怒火交给拳头', _chain: { level: 3, startStep: 'league' }, apply: function() {
        var games = 3 + Math.floor(Math.random() * 3);
        STATE.season.events.suspensionGamesLeft = (STATE.season.events.suspensionGamesLeft || 0) + games;
        STATE.season.events.suspensionReason = '球场斗殴冲突';
        addProfileDelta('controversy', 3);
        addProfileDelta('fame', 1);
        addSeasonMod('mediaPressure', 3, -10, 10);
        addSeasonMod('formVariance', 2, -10, 10);
        return fillViolenceText('你把他撞倒，拳头停在半空后还是落了下去。全场混乱，裁判直接把你罚出场。{对手球员}被队友扶起来时还在笑，你第一次想让他闭嘴。<br><br>效果：禁赛' + games + '场；争议+3；媒体压力+3；人气+1；状态波动+2。');
      }},
      { label: '收住拳头，狠狠撞开他', hint: '失控一半，但还留着底线', _chain: { level: 2, startStep: 'locker', feudLevel: 1 }, apply: function() {
        addAttrDelta('CLU', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        addProfileDelta('controversy', 1);
        addProfileDelta('mediaTrust', -1);
        return '你没有挥拳，但用肩膀把他撞出两步。技术犯规，比赛继续，你的火气全烧进下一个回合。<br><br>效果：关键球+1；争议+1；媒体好感-1。';
      }},
      { label: '转身走开，不给他反应', hint: '让垃圾话掉在地上', _chain: { level: 1, startStep: 'locker' }, apply: function() {
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('fanSupport', 1);
        addProfileDelta('coachTrust', 1);
        addProfileDelta('lockerRoomTrust', -1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你看了他一眼，转身走开。全场嘘你，但他那句脏话也没能进入回放。媒体开始讨论：这是成熟，还是软弱？<br><br>效果：媒体好感+1；球迷支持+1；状态波动-1；教练信任+1；更衣室信任-1。';
      }},
      { label: '用篮球回答他', hint: '把怒火放进进攻', _chain: { level: 2, startStep: 'locker', feudLevel: 1 }, apply: function() {
        addAttrDelta('CLU', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        var last = STATE.season && STATE.season.games ? STATE.season.games[STATE.season.games.length - 1] : null;
        var won = !!(last && last.result && last.result.won);
        if (won) addProfileDelta('fame', 1);
        return '你没有说话，下一回合在他头上打成二加一，然后指了指地板。他安静了三分钟，又开始说话。<br><br>效果：关键球+1' + (won ? '；人气+1（赢球）。' : '。');
      }}
    ]
  },
  {
    id: 'brand_offer',
    branch: 'brand',
    phase: 'offseason',
    slot: 'main',
    weight: 12,
    title: '品牌邀约：轩尼诗',
    scenes: [
      '晚宴订在市中心的私人包间，品牌方没有先谈钱，先聊你小时候看比赛的故事。',
      '最后他们把合同推过来：轩尼诗想请你做新一季广告。'
    ],
    body: '这杯酒端不端起来，不只是钱的问题。',
    requires: function() {
      var c = STATE.career;
      if (!c) return false;
      if (getBranchNode('brand') !== 'start') return false;
      if (c.flags && c.flags.hennessyDone) return false;
      return isHennessyEligible();
    },
    choices: [
      { label: '接下广告', hint: '进入广告拍摄', apply: function() {
        setBranchNode('brand', 'offer_accepted', { status: 'accepted' });
        return '你在合同上签下名字。品牌方说：接下来三个月，镜头会跟着你。<br><br>效果：进入广告拍摄。';
      }},
      { label: '先看创意再决定', hint: '更谨慎，媒体好感上升', apply: function() {
        setBranchNode('brand', 'offer_creative', { status: 'creative' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('businessValue', 1);
        return '你要求先看创意脚本。品牌方欣赏你的认真，改了两稿后才签。<br><br>效果：媒体好感+1；商业价值+1；进入广告拍摄。';
      }},
      { label: '婉拒', hint: '不为钱低头', apply: function() {
        setBranchNode('brand', 'declined', { status: 'declined' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.hennessyDone = true;
        addProfileDelta('businessValue', -1);
        addProfileDelta('mediaTrust', 1);
        return '你说：酒很好，但我只接自己相信的东西。品牌方没有生气，反而约了下次。<br><br>效果：商业价值-1；媒体好感+1。';
      }}
    ]
  },
  {
    id: 'brand_shoot',
    branch: 'brand',
    phase: 'offseason',
    slot: 'main',
    weight: 14,
    title: '广告拍摄',
    scenes: ['拍摄棚里，导演要求你对着镜头说一句“敬所有赢下自己的人”。现场围了十几个人，灯光很烫，你忽然觉得自己像在打总决赛罚球。'],
    body: '广告怎么拍，会影响广告播出后别人怎么看你。',
    requires: function() {
      var n = getBranchNode('brand');
      return n === 'offer_accepted' || n === 'offer_creative';
    },
    choices: [
      { label: '完全按剧本配合', hint: '专业、稳妥', apply: function() {
        setBranchNode('brand', 'shoot_script', { shoot: 'script' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.hennessyShoot = 'script';
        addProfileDelta('businessValue', 2);
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你每个镜头都做到位，导演提前收工。品牌方很满意，新闻稿里的形容词是“专业”。<br><br>效果：商业价值+2；媒体好感+1；争议-1。';
      }},
      { label: '加入自己的创意', hint: '有概率出圈，也有概率翻车', apply: function() {
        setBranchNode('brand', 'shoot_creative', { shoot: 'creative' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.hennessyShoot = 'creative';
        var good = Math.random() < 0.6;
        STATE.career.flags.hennessyCreativeGood = good;
        if (good) {
          addProfileDelta('fame', 2);
          addProfileDelta('businessValue', 2);
          addProfileDelta('controversy', 1);
          return '你在最后一镜加了一句自己的台词。导演愣了一下，然后笑了。<br><br>效果：人气+2；商业价值+2；争议+1。';
        }
        addProfileDelta('mediaTrust', -1);
        addProfileDelta('businessValue', -1);
        return '你在最后一镜加了一句自己的台词。导演没接话，重拍了三遍才通过，品牌方对"不可控"三个字很敏感。<br><br>效果：媒体好感-1；商业价值-1。';
      }},
      { label: '低调一条过', hint: '效率最高，话题度低', apply: function() {
        setBranchNode('brand', 'shoot_efficient', { shoot: 'efficient' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.hennessyShoot = 'efficient';
        addProfileDelta('businessValue', 1);
        return '你状态很好，一条拍完，效率最高。团队说：没见过这么省胶卷的代言人。<br><br>效果：商业价值+1。';
      }}
    ]
  },
  {
    id: 'brand_launch',
    branch: 'brand',
    phase: 'offseason',
    slot: 'main',
    weight: 14,
    title: '广告上线',
    scenes: ['广告首播那天，你在客队酒店里刷到自己的镜头。评论区一半在夸质感，一半在玩梗。'],
    body: '广告已经不属于你了，它属于所有看见它的人。',
    requires: function() {
      var n = getBranchNode('brand');
      return n === 'shoot_script' || n === 'shoot_creative' || n === 'shoot_efficient';
    },
    choices: [
      { label: '看评论区', hint: '直面反馈', apply: function() {
        var c = STATE.career;
        c.flags = c.flags || {};
        c.flags.hennessyAd = true;
        c.flags.hennessyEchoSeason = (c.seasonCount || 0) + 1;
        c.flags.hennessyEchoAt = 10 + Math.floor(Math.random() * 11);
        if (c.profile && (c.profile.chinaPopularity || 0) >= 50) c.flags.hennessyChina = true;
        setBranchNode('brand', 'launched', { launched: true });
        var shoot = c.flags.hennessyShoot;
        if (shoot === 'creative') {
          addProfileDelta('fame', 1);
          addProfileDelta('mediaTrust', 1);
          return '广告上线后，你的创意镜头被剪成无数版本。评论从玩梗变成讨论：他是真的会拍。<br><br>效果：人气+1；媒体好感+1。';
        }
        if (shoot === 'script') {
          addProfileDelta('mediaTrust', 1);
          addProfileDelta('controversy', -1);
          return '广告质感被夸得体面，连平时挑刺的评论都只说了句：可以。<br><br>效果：媒体好感+1；争议-1。';
        }
        addProfileDelta('businessValue', 1);
        return '广告没怎么出圈，但品牌方的续约意向已经提前到桌面上。<br><br>效果：商业价值+1。';
      }}
    ]
  },
  {
    id: 'brand_echo',
    branch: 'brand',
    phase: 'season',
    slot: 'main',
    weight: 14,
    title: '广告回响',
    scenes: ['一个月后，有人把广告截图配文做成段子。品牌方问你要不要下场回应。'],
    body: '热度没有消失，它只是在等你接住。',
    requires: function() {
      var c = STATE.career;
      if (!c || !c.flags) return false;
      return !!c.flags.hennessyAd && !c.flags.hennessyEchoDone && getBranchNode('brand') === 'launched';
    },
    choices: [
      { label: '幽默自嘲', hint: '和球迷一起玩', apply: function() {
        addProfileDelta('fame', 1);
        addProfileDelta('mediaTrust', 1);
        return '你转发了那条段子，配文：导演说这条不能删。<br><br>效果：人气+1；媒体好感+1。';
      }},
      { label: '不回应', hint: '让热度自己散', apply: function() {
        addProfileDelta('businessValue', 1);
        return '你没有下场，几天后热度自己散了。品牌方觉得你稳。<br><br>效果：商业价值+1。';
      }},
      { label: '认真回应创作理念', hint: '把广告当作品解释', apply: function() {
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('controversy', -1);
        return '你发了一段长文，讲这条广告想表达什么。评论从段子变成了讨论。<br><br>效果：媒体好感+2；争议-1。';
      }}
    ]
  }
  ];

// ==================== 暴力冲突：后续链式弹窗 ====================
var _violenceScenePage = 0;
var _violenceChainChoices = [];
var _violenceModalData = null;
var _violenceChainDone = null;

function renderViolenceChainModal() {
  var data = _violenceModalData;
  if (!data) return;
  var old = document.getElementById('violence-chain-modal');
  if (old) old.remove();
  var page = _violenceScenePage || 0;
  var html = '<div class="team-picker-overlay" id="violence-chain-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + data.title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  var scenes = data.scenes || [];
  if (scenes.length && page < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillViolenceText(scenes[page]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueViolenceChainScene()">继续</button>';
  } else {
    if (data.body) {
      html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
      html += '<div style="font-size:13px;color:var(--text);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillViolenceText(data.body)) + '</div>';
    }
    var choices = data.choices || [];
    if (choices.length) {
      html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
      _violenceChainChoices = choices;
      choices.forEach(function(ch, ci) {
        html += '<button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;" onclick="chooseViolenceChainChoice(' + ci + ')">' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(ch.hint || '') + '</span></button>';
      });
    } else if (data.btnLabel) {
      html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="nextViolenceChainStep()">' + data.btnLabel + '</button>';
    }
  }
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function showViolenceChainModal(title, scenes, body, choices, btnLabel) {
  _violenceModalData = { title: title, scenes: scenes || [], body: body || '', choices: choices || [], btnLabel: btnLabel || '' };
  _violenceScenePage = 0;
  _violenceChainChoices = [];
  renderViolenceChainModal();
}

function continueViolenceChainScene() {
  _violenceScenePage = (_violenceScenePage || 0) + 1;
  renderViolenceChainModal();
}

function showViolenceChainStep() {
  var chain = STATE._violenceChain;
  if (!chain) { finishViolenceChain(); return; }
  var step = chain.step;
  _violenceScenePage = 0;
  _violenceChainChoices = [];
  if (step === 'league') {
    chain.step = 'locker';
    showViolenceChainModal('联盟办公室', [
      '第二天早上，联盟办公室的电话比训练师更早到。发言人说：回放已经看完了，处罚决定已经做出。',
      '你被禁赛数场。球队没有公开骂你，但训练计划里你的名字被暂时划掉。'
    ], '', [], '继续');
  } else if (step === 'locker') {
    chain.step = 'family';
    var lockerText = '';
    if (chain.level === 3) {
      addProfileDelta('lockerRoomTrust', -1);
      addProfileDelta('coachTrust', -1);
      lockerText = '老将把你叫到一边：我理解你，但这种事不能成为习惯。';
    } else if (chain.level === 2) {
      addProfileDelta('lockerRoomTrust', 1);
      lockerText = '有人递水，有人拍肩。更衣室没有公开站队，但训练时球传得比以前多了一点。';
    } else {
      lockerText = '赢球时大家觉得你成熟，输球时有人觉得你太软。';
    }
    showViolenceChainModal('更衣室反应', [lockerText], '', [], '继续');
  } else if (step === 'family') {
    chain.step = 'family_choice';
    showViolenceFamilyModal();
  } else {
    finishViolenceChain();
  }
}

function showViolenceFamilyModal() {
  var rel = STATE.career && STATE.career.relationships && STATE.career.relationships.partner;
  if (!rel) {
    showViolenceChainModal('家人反应', [
      '家人和经纪人都打来电话。他们没有骂你，只问你下一场还能不能上场。'
    ], '这件事过去之后，他们希望你把注意力放回比赛。', [], '继续');
    return;
  }
  showViolenceChainModal('家人/女友反应', [
    '她第二天来训练馆等你。手机里全是那段回放，她没有问发生了什么，先问你：手疼吗？'
  ], '你决定怎么回答她？', [
    { label: '道歉解释', hint: '承认那句垃圾话伤到了你', apply: function() {
      if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'stable';
      addSeasonMod('formVariance', -1, -10, 10);
      addProfileDelta('mediaTrust', 1);
      return '你当着她的面承认，那句垃圾话确实伤到了你。她听完没有再提，只把带来的饭盒放在你手边。<br><br>效果：关系稳定；状态波动-1；媒体好感+1。';
    }},
    { label: '说自己没做错', hint: '坚持你的立场', apply: function() {
      addSeasonMod('formVariance', 1, -10, 10);
      addProfileDelta('controversy', 1);
      return '你说：换谁都会那样。她沉默了一会儿：那你以后打算一直这样回应吗？<br><br>效果：关系波动；状态波动+1；争议+1。';
    }},
    { label: '冷处理', hint: '先把这件事放一边', apply: function() {
      if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'distant';
      addSeasonMod('mediaPressure', 1, -10, 10);
      addSeasonMod('formVariance', 1, -10, 10);
      return '你说训练很忙，先走了。她没拦你，但之后几天消息回得很慢。<br><br>效果：关系疏远；媒体压力+1；状态波动+1。';
    }}
  ], '');
}

function nextViolenceChainStep() {
  var modal = document.getElementById('violence-chain-modal');
  if (modal) modal.remove();
  _violenceModalData = null;
  _violenceScenePage = 0;
  _violenceChainChoices = [];
  showViolenceChainStep();
}

function chooseViolenceChainChoice(idx) {
  var ch = _violenceChainChoices[idx];
  if (!ch) return;
  var msg = ch.apply ? ch.apply() : '';
  msg = sanitizePlayerFacingText(msg || '');
  recordBranchChoice({ id: 'violence_family', branch: 'violence_conflict', title: '家人/女友反应', phase: 'season' }, { label: ch.label }, msg, 'season');
  var modal = document.getElementById('violence-chain-modal');
  if (modal) modal.remove();
  _violenceModalData = null;
  _violenceScenePage = 0;
  _violenceChainChoices = [];
  if (msg) showViolenceChainResultModal(msg);
  else finishViolenceChain();
}

function showViolenceChainResultModal(msg) {
  var existing = document.getElementById('violence-chain-result-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="violence-chain-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>家人/女友反应</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += formatBranchResultText(fillViolenceText(msg));
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="finishViolenceChain()">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function finishViolenceChain() {
  var modal = document.getElementById('violence-chain-result-modal');
  if (modal) modal.remove();
  var chain = STATE._violenceChain;
  var flags = STATE.career.flags || {};
  flags.violenceConflict = flags.violenceConflict || {};
  flags.violenceConflict.done = true;
  flags.violenceConflict.settled = true;
  flags.violenceConflict.level = chain ? chain.level : 0;
  flags.violenceConflict.feudLevel = chain ? (chain.feudLevel || 0) : 0;
  var opp = STATE._violenceOpponent || {};
  flags.violenceConflict.opponent = opp.name || '';
  flags.violenceConflict.opponentTeam = opp.team || '';
  STATE._violenceChain = null;
  _violenceScenePage = 0;
  _violenceModalData = null;
  _violenceChainChoices = [];
  var done = _violenceChainDone;
  _violenceChainDone = null;
  if (typeof done === 'function') done();
}


  function registerHupuLifeEvents() {
    if (typeof STAGED_BRANCH_EVENTS === 'undefined') return;
    HUPU_LIFE_BRANCH_EVENTS.forEach(function (ev) {
      if (!ev || !ev.id) return;
      if (STAGED_BRANCH_EVENTS.some(function (e) { return e.id === ev.id; })) return;
      STAGED_BRANCH_EVENTS.push(ev);
    });
  }

  registerHupuLifeEvents();
})();
