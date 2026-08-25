/* Perfect Player — 虎扑传奇时代剧情（历史模式启用） */
function getLegendBranchNarrativePack(ev) {
  if (!isLegendStoryEnabled() || !ev || !ev.id) return null;
  var recruiter = (STATE.career && STATE.career.flags && STATE.career.flags.superstarRecruiterName) || '那位巨星';
  var recruitTeam = (STATE.career && STATE.career.flags && STATE.career.flags.superstarRecruitTargetTeam)
    ? (getTeamName ? getTeamName(STATE.career.flags.superstarRecruitTargetTeam) : STATE.career.flags.superstarRecruitTargetTeam)
    : '他的球队';
  var packs = {
    city_farewell: {
      title: '传奇时代：旧城告别',
      scenes: [
        '转会基本敲定那天，你又开车路过那家旧球馆。门口的灯没有变，只是你知道，下一次再来，这座城市会从主场变成记忆。',
        '地方电台还在讨论你。有人说该祝福，有人说无法原谅。2003 时代的告别没有热搜，只有报纸、电话和很多没说出口的沉默。'
      ],
      body: '离开不是背叛的同义词。但离开的方式，会决定多年后这座城市用什么语气念起你的名字。',
      choices: [
        { label: '写一封给城市的信', hint: '把告别留给球迷，也把这段关系写进历史' },
        { label: '承诺有一天会回来', hint: '给城市留门，也给未来留一个回声' },
        { label: '安静离开', hint: '不解释，不争辩，让时间替你回答' }
      ]
    },
    superstar_recruit_call: {
      title: '传奇时代：午夜电话',
      scenes: [
        '休赛期训练结束后，手机在储物柜里亮了很久。',
        '来电的人不是记者，也不是经纪人，而是' + recruiter + '。他说：我们已经对抗太久了，换一种方式试试吧。'
      ],
      body: recruiter + '所在的' + recruitTeam + '正在寻找另一个能改变系列赛的人。这不是一份合同邀约，而像联盟权力流向第一次悄悄改口。',
      choices: [
        { label: '认真考虑联手', hint: '把个人路径放进更大的争冠叙事' },
        { label: '保持距离', hint: '保留竞争关系，让历史继续把你们分开放在两边' },
        { label: '让消息传出去', hint: '把一次电话变成整个联盟都要回应的问题' }
      ]
    },
    team_practice_start: {
      title: '传奇时代：提前开灯的训练馆',
      scenes: ['休赛期刚过一半，你给队友发了一条消息：如果有人想提前回来，训练馆后天早上开门。2003 时代的领袖不是先喊出来的，是先出现在空馆里的。'],
      body: '你要把这个夏天变成一支球队共同的起点，还是先把身体修好，把答案留给开季？',
      choices: [
        { label: '把队友叫回训练馆', hint: '让更衣室先听见你的脚步声' },
        { label: '先完成身体修复', hint: '把长期生涯放在更前面' }
      ]
    },
    team_practice_response: {
      title: '传奇时代：更衣室开始看向你',
      scenes: ['第二年夏天，合练邀请变得安静而郑重。年轻球员等你开口，老队友也在观察你会不会把责任接过去。'],
      body: '你不再只是参加合练的人。你要不要把自己放到更衣室秩序的中心？',
      choices: [
        { label: '主动接过领袖责任', hint: '把战术和情绪一起接住' },
        { label: '保持低调，只做好自己', hint: '让每天到馆成为一种沉默的答案' },
        { label: '把舞台交给年轻队友', hint: '让下一批人也进入这段时代' }
      ]
    },
    team_practice_identity: {
      title: '传奇时代：队魂雏形',
      scenes: ['这一次，合练不再需要你发消息。年轻球员已经提前到了。教练站在门口看着你，像是在确认这支球队终于有了自己的秩序。'],
      body: '球队线收束。多年以后，队友会用哪一种方式记住你？',
      choices: [
        { label: '成为更衣室领袖', hint: '队友记住你如何托住困难夜晚' },
        { label: '成为训练馆标杆', hint: '让认真本身成为传统' },
        { label: '成为年轻球员导师', hint: '把时代交给下一批人' }
      ]
    }
  };
  return packs[ev.id] || null;
}

function getLegendBranchTitle(ev, fallback) {
  var pack = getLegendBranchNarrativePack(ev);
  return (pack && pack.title) || fallback;
}

function getLegendBranchScenes(ev, fallback) {
  var pack = getLegendBranchNarrativePack(ev);
  return (pack && pack.scenes) || fallback || [];
}

function hasLegendHistoryMatch(pattern) {
  if (!isLegendStoryEnabled()) return false;
  var history = getLegendStoryState().history || [];
  return history.some(function(h) {
    var hay = [h.eventId, h.event, h.choice, h.result].join(' ');
    return pattern.test(hay);
  });
}

function getLegendStoryEcho(topic, eventId) {
  if (!isLegendStoryEnabled()) return '';
  var st = getLegendStoryState();
  var scores = st.scores || {};
  var flags = st.flags || {};
  var id = String(eventId || '');
  if (!topic) {
    if (/city|farewell|old_team|community/.test(id)) topic = 'city';
    else if (/practice|franchise|veteran|front_office/.test(id)) topic = 'team';
    else if (/media|critic|forum|analytics/.test(id)) topic = 'media';
    else if (/superstar|recruit/.test(id)) topic = 'superteam';
    else if (/rookie|class|redraft|sophomore|wave/.test(id)) topic = 'class';
  }
  if (topic === 'class') {
    if (id === 'legend_2003_class_arrival' || id === 'legend_2003_rookie_table') return '';
    if (flags.class_claimed) return '媒体又翻出了你新秀年那句“我属于最前排”。这一次，他们不再只把它当成年轻人的狠话。';
    if (flags.class_quiet) return '你新秀年没有抢过标题，但那些安静的回答被教练组记了很久。';
    if (flags.legacy_rings) return '你早早说过冠军会比漂亮数据更久。现在，每一次比较都会绕回这句话。';
    if (flags.legacy_complete) return '从那场新秀圆桌开始，媒体就习惯把你的比赛拆开看：得分、组织、防守、关键球，每一项都像证词。';
  }
  if (topic === 'city') {
    if ((scores.cityBond || 0) >= 5) return '这座城市已经不再只用战绩认识你。它开始用街区、球馆和那些普通夜晚记住你。';
    if (hasLegendHistoryMatch(/legend_city_farewell|旧城告别|旧城/)) return '你离开过一座城市，但那段关系没有被交易流言完全带走。';
  }
  if (topic === 'team') {
    if (flags.franchise_core) return '自从球队把主攻权交到你手里，每一次胜负都更像是在回答同一个问题：你能不能长期承担这支球队。';
    if (flags.franchise_connector) return '你没有急着把所有灯光拿走，这让更衣室更愿意把沉默的责任交给你。';
    if ((scores.lockerRoom || 0) >= 5) return '更衣室已经开始用另一种方式听你说话：有时是一个眼神，有时是训练结束后多留下来的几分钟。';
  }
  if (topic === 'media') {
    if ((scores.mediaHeat || 0) >= 5) return '外面的声音越来越响，电视台和专栏作家都学会了用你的名字开题。';
    if ((scores.mediaTrust || 0) >= 5) return '记者们未必总是站在你这边，但他们知道你很少把话说轻。';
  }
  if (topic === 'superteam') {
    if (flags.superstar_recruit_anchor) return '那通电话之后，联盟开始意识到，球星之间的距离可能没有旧时代想象得那么远。';
    if (hasLegendHistoryMatch(/legend_superstar_recruit_call[\s\S]*保持距离|保持距离/)) return '你让那通电话停在了夜里，也让某些对抗继续保留原来的形状。';
  }
  if (topic === 'craft') {
    if ((scores.historyShift || 0) >= 3) return '时代正在变聪明，而你没有把学习新东西当成对过去的背叛。';
    if ((scores.craft || 0) >= 5) return '你的答案一直藏在训练馆里，藏在那些没有镜头的重复里。';
  }
  return '';
}

function getLegendBranchBody(ev, fallback) {
  var pack = getLegendBranchNarrativePack(ev);
  var body = (pack && pack.body) || fallback || '';
  var topic = (ev && ev.legendTopic) || '';
  var echo = getLegendStoryEcho(topic, ev && ev.id);
  return echo ? echo + '<br><br>' + body : body;
}

function getLegendBranchChoiceText(ev, ch, idx, field) {
  var pack = getLegendBranchNarrativePack(ev);
  if (pack && pack.choices && pack.choices[idx] && pack.choices[idx][field]) return pack.choices[idx][field];
  return ch && ch[field];
}

function getLegendOldTeamModalPack(title) {
  if (!isLegendStoryEnabled()) return null;
  var flow = STATE._oldTeamFlow || {};
  if (flow.step === 'arrival') {
    return {
      title: '传奇时代：回到那座城市',
      scenes: [
        '飞机落地时，你才发现自己记得这座城市的每一段路。酒店窗外能看到旧球馆的灯，楼下有人举着你的旧球衣，也有人只是沉默地站着。',
        '这不是普通客场。对这座城市来说，你回来了一次；对 2003 这段时代来说，历史终于有机会重新审视一次离开。'
      ],
      body: '回到前东家主场，你要先决定今晚怎么面对这座城市。不是为了讨好所有人，而是为了让这段关系有一个像样的落点。',
      choices: [
        { label: '提前去旧球馆加练', hint: '把情绪压进训练里，让身体先回家' },
        { label: '关掉手机休息', hint: '不让噪音决定这一夜' },
        { label: '赛前发布会放话', hint: '把回访变成一场公开宣言' }
      ]
    };
  }
  if (title === '致敬夜') {
    return {
      title: '传奇时代：致敬夜',
      scenes: [
        '灯光暗下来的那十秒，全场忽然安静。大屏幕开始播放你在这里的每一个夜晚：第一次首发、输掉后的长椅、赢球后的拥抱。',
        'DJ 念出你的名字，然后是整座球馆喊成一片。看台上到处都是你的旧球衣，有人举着“谢谢你”的标语。'
      ],
      body: '这座城市没有忘记你。你选择用什么方式收下这份敬意。',
      choices: [
        { label: '向全场致意', hint: '把这一刻还给球迷' },
        { label: '克制点头，专注比赛', hint: '把感动留给第四节' },
        { label: '赛后拥抱老队友', hint: '让情谊有个落点' }
      ]
    };
  }
  if (title === '反目夜') {
    return {
      title: '传奇时代：反目夜',
      scenes: [
        '从球员通道踏出去的第一秒，嘘声就砸了下来。大屏幕没有视频，只有计分牌。有人举着旧球衣，也有人把灯牌背过去。',
        '你听见自己的名字被念出来，然后被更大的声音淹没。队友拍了拍你的肩：别回头。'
      ],
      body: '这座城市把离开当成背叛。你决定今晚怎么回答它。',
      choices: [
        { label: '用表现回应', hint: '让比赛替你说话' },
        { label: '赛后回击', hint: '把恩怨放大' },
        { label: '沉默离场', hint: '不回应也是回应' }
      ]
    };
  }
  if (title === '情绪交织的夜') {
    return {
      title: '传奇时代：情绪交织的夜',
      scenes: [
        '球馆一半亮一半暗。老球迷举着你的海报，年轻球迷举着更锋利的灯牌。介绍你时，欢呼和嘘声同时响起，像一场没有判决的审判。'
      ],
      body: '这座城市还在犹豫。你当晚的选择，就是它给这段历史留下的注脚。',
      choices: [
        { label: '向全场致意', hint: '争取老球迷，也争取中间派' },
        { label: '赛后放话', hint: '把犹豫推向对立' },
        { label: '低头离场', hint: '不表态，让时间决定' }
      ]
    };
  }
  return null;
}

function isCurrentStoryEnabled() {
  return false;
}

function isLegendStoryEnabled() {
  return !!(STATE && STATE.draftMode === 'historical' && STATE.eraStart);
}

function getLegendEraStoryPack() {
  if (!isLegendStoryEnabled()) return null;
  var packs = (typeof LEGEND_ERA_STORY_PACKS !== 'undefined') ? LEGEND_ERA_STORY_PACKS : {};
  return packs[String(STATE.eraStart || '')] || null;
}

function getLegendCareerClosingEvents() {
  if (!isLegendStoryEnabled()) return [];
  var era = String(STATE.eraStart || '2003');
  var closingTitle = era === '1984' ? '传奇时代：最后一版体育专栏' : (era === '1996' ? '传奇时代：最后一张封面' : '传奇时代：最后一个长帖');
  var openingTitle = era === '1984' ? '退役后：旧报纸之外' : (era === '1996' ? '退役后：聚光灯慢慢暗下' : '退役后：论坛停止刷新之后');
  var mapTitle = era === '1984' ? '退役后：把经验留给谁' : (era === '1996' ? '退役后：封面之外的身份' : '退役后：下一种留在联盟里的方式');
  return [
    {
      id: 'legend_farewell_tour_question',
      branch: 'legend_career_closing',
      phase: 'countdown',
      slot: 'main',
      weight: 99,
      legendStory: true,
      legendTopic: 'legacy',
      title: closingTitle,
      scenes: [
        era === '1984'
          ? '赛季结束后，地方报纸的老记者没有急着问数据。他把录音机放在桌上，说：如果这是最后一次，我们想认真写完。'
          : (era === '1996'
            ? '摄影棚的灯比你记忆里柔和。编辑说，这也许不是最大的一期封面，但会是最像你的那一张。'
            : '赛季结束后，论坛里那个关于你的长帖还在刷新。有人争论排名，有人贴旧视频，也有人只写了一句：谢谢你把这些年打完。'),
        '你忽然明白，退役不是把故事关掉，而是把它交给后来的人慢慢复述。你还有一次机会决定，自己想怎样离开这段喧闹。'
      ],
      body: '这是职业生涯的收束提问。它不会改变你是否退役，但会决定传奇档案里如何记住最后一段背影。',
      requires: function() { return STATE.career && !STATE.career.retired; },
      choices: [
        { label: '把告别说给球迷听', hint: '让城市和看台成为最后的见证', apply: function() {
          setLegendStoryFlag('farewell_tour_public', true);
          addLegendStoryScore('cityBond', 2);
          addLegendStoryScore('mediaTrust', 1);
          addProfileDelta('fanSupport', 2);
          addProfileDelta('mediaTrust', 1);
          return '你没有把告别藏起来。你说，谢谢你们陪我从年轻打到老去，也谢谢那些在我低谷时还愿意买票进场的人。掌声没有立刻停，它像一座城市在替很多年补上一句再见。<br><br>效果：球迷支持+2，媒体信任+1；传奇剧情分数：城市羁绊+2，媒体信任+1。';
        }},
        { label: '把最后一课留给队友', hint: '让更衣室记住你的离开方式', apply: function() {
          setLegendStoryFlag('farewell_tour_locker_room', true);
          addLegendStoryScore('lockerRoom', 2);
          addLegendStoryScore('dynasty', 1);
          addProfileDelta('lockerRoomTrust', 2);
          addProfileDelta('leadership', 1);
          return '你没有准备长篇演讲，只在更衣室白板上写下几个名字：那些陪你赢过、输过、沉默过的人。你说，球队不是一个人的传记。年轻队友低着头听完，后来很多年都记得这一句。<br><br>效果：更衣室信任+2，领导力+1；传奇剧情分数：更衣室+2，王朝线+1。';
        }},
        { label: '安静收好自己的球鞋', hint: '把结尾留给自己和时间', apply: function() {
          setLegendStoryFlag('farewell_tour_private', true);
          addLegendStoryScore('individualLegend', 2);
          addLegendStoryScore('craft', 1);
          addProfileDelta('legacyBonus', 1);
          return '你没有办太大的仪式。最后一次离开训练馆时，你把旧球鞋放进盒子，拍了拍柜门。伟大有时不需要被宣布，它只需要一个人认真知道：我真的把能给的都给了。<br><br>效果：历史评价+1；传奇剧情分数：个人传奇+2，技艺路线+1。';
        }}
      ]
    },
    {
      id: 'post_career_opening',
      branch: 'post_career',
      phase: 'post_career',
      slot: 'main',
      weight: 12,
      legendStory: true,
      legendTopic: 'legacy',
      title: openingTitle,
      scenes: [
        era === '1984'
          ? '退役后的第一个夏天，你在家门口捡到一份旧报纸。标题已经有些褪色，但照片里的你还年轻，正把护膝拉到膝盖上方。'
          : (era === '1996'
            ? '退役后的第一个夏天，球鞋公司寄来一整箱纪念样品。你没有急着拆，只是看着盒面上的年份，发现它们比很多奖杯更像时间。'
            : '退役后的第一个夏天，你偶尔会打开论坛。帖子还在吵你的历史排名，可你第一次能很平静地看完，然后关掉屏幕去吃晚饭。'),
        '手机还是会响。解说台、教练组、品牌方、旧队友和年轻球员都在问你同一件事：你还想怎样留在篮球里？'
      ],
      body: '退役不是消失。它只是让赛程不再每天叫醒你，然后把选择权慢慢交回你手里。',
      requires: function() { return STATE.career && STATE.career.retired; },
      choices: [
        { label: '先回到篮球旁边', hint: '进入退役后身份选择', apply: function() {
          setBranchNode('post_career', 'post_career_map', { stage: 'map' });
          setLegendStoryFlag('post_career_returned_to_game', true);
          addLegendStoryScore('legacyCare', 1);
          return '你答应了几场采访，也去看了年轻人的训练。你没有急着定义自己，只是确认一件事：你离开了比赛，但没有离开篮球。<br><br>影响：下一步进入退役后身份选择。';
        }},
        { label: '先把生活还给自己', hint: '留白一年，再决定是否回来', apply: function() {
          setBranchNode('post_career', 'gap_year', { stage: 'gap' });
          setLegendStoryFlag('post_career_gap_year', true);
          addLegendStoryScore('individualLegend', 1);
          addProfileDelta('mediaTrust', 1);
          return '你推掉了大部分邀约，第一次完整地陪家人过完一个夏天。没有训练表，没有客场航班，也没有赛后发布会。你发现安静不是空白，它也是一种慢慢恢复。<br><br>效果：媒体信任+1；传奇剧情分数：个人传奇+1。';
        }}
      ]
    },
    {
      id: 'post_career_gap_return',
      branch: 'post_career',
      phase: 'post_career',
      slot: 'main',
      weight: 8,
      legendStory: true,
      legendTopic: 'legacy',
      title: '退役后：空白年之后',
      scenes: [
        '一年过去，你发现自己还是会在比赛日看向电视。不是想再上场，而是某些暂停、某些年轻人的犹豫，仍然会让你想开口。'
      ],
      body: '空白年没有浪费。它让你确认，篮球已经不再需要你每天奔跑，但你仍然可以把经验留给别人。',
      requires: function() { return getBranchNode('post_career') === 'gap_year'; },
      choices: [
        { label: '主动推开那扇门', hint: '回到身份选择', apply: function() {
          setBranchNode('post_career', 'post_career_map', { stage: 'map' });
          setLegendStoryFlag('post_career_gap_returned', true);
          addLegendStoryScore('legacyCare', 1);
          return '你给经纪人回了电话，也给一位年轻球员发了消息：下周训练，我可以来看看。对方很快回复，像一直在等这句话。<br><br>影响：下一步进入退役后身份选择。';
        }},
        { label: '继续低调生活', hint: '把篮球留成生活的一部分', apply: function() {
          setBranchNode('post_career', 'low_key', { finalIdentity: 'low_key' });
          STATE.career.flags.postCareerIdentity = 'low_key';
          setLegendStoryFlag('post_career_low_key', true);
          addLegendStoryScore('cityBond', 1);
          addProfileDelta('fanSupport', 1);
          return '你没有回到聚光灯里。偶尔去社区球馆，偶尔给旧队友打电话，偶尔在电视前笑着摇头。篮球没有离开你，只是不再要求你证明什么。<br><br>效果：球迷支持+1；传奇剧情分数：城市羁绊+1。';
        }}
      ]
    },
    {
      id: 'post_career_map',
      branch: 'post_career',
      phase: 'post_career',
      slot: 'main',
      weight: 14,
      legendStory: true,
      legendTopic: 'legacy',
      title: mapTitle,
      scenes: [
        '几条退役后的路摆在你面前。它们不再用场均数据评价你，而是问你愿意把这段生涯变成什么样的回声。',
        '你看见自己的旧球衣、旧报道、旧鞋盒和年轻球员发来的训练视频。原来一个球员退役后，仍然可以用很多方式继续传球。'
      ],
      body: '选择一种退役后的身份。这里的选项只依赖 Legend 生涯里的分数和选择，不读取现役通用剧情。',
      requires: function() { return getBranchNode('post_career') === 'post_career_map'; },
      choices: [
        { label: '球队顾问', hint: '把经验交回更衣室', lockHint: '需要更衣室或王朝线积累', requires: function() {
          return getLegendStoryScore('lockerRoom') >= 3 || getLegendStoryScore('dynasty') >= 3 || hasLegendStoryFlag('farewell_tour_locker_room');
        }, apply: function() {
          setBranchNode('post_career', 'assistant_coach', { identity: 'team_advisor' });
          STATE.career.flags.postCareerIdentity = 'team_advisor';
          addLegendStoryScore('lockerRoom', 1);
          addProfileDelta('lockerRoomTrust', 2);
          return '你没有急着坐到主教练的位置，只是先站在训练馆角落，看年轻人怎么跑第一个回合。有人投丢后看向你，你点点头：没事，再来一次。<br><br>效果：更衣室信任+2；传奇剧情分数：更衣室+1。';
        }},
        { label: '时代解说员', hint: '用自己的语言解释这个时代', lockHint: '需要媒体线或同代竞争积累', requires: function() {
          return getLegendStoryScore('mediaTrust') >= 3 || getLegendStoryScore('mediaHeat') >= 3 || getLegendStoryScore('classRivalry') >= 3;
        }, apply: function() {
          setBranchNode('post_career', 'commentator', { identity: 'era_commentator' });
          STATE.career.flags.postCareerIdentity = 'era_commentator';
          addLegendStoryScore('mediaTrust', 1);
          addProfileDelta('mediaTrust', 2);
          addProfileDelta('fame', 1);
          return '你第一次坐上解说台时，还是习惯性地看防守站位。导播提醒你看镜头，你笑了一下，说：抱歉，我还是先看比赛。观众喜欢这句话，因为它像你整个生涯。<br><br>效果：媒体信任+2，人气+1；传奇剧情分数：媒体信任+1。';
        }},
        { label: '社区球场发起人', hint: '把影响力留给更年轻的人', lockHint: '需要城市羁绊积累', requires: function() {
          return getLegendStoryScore('cityBond') >= 3 || hasLegendStoryFlag('community_court_supported') || hasLegendStoryFlag('farewell_tour_public');
        }, apply: function() {
          setBranchNode('post_career', 'youth_academy', { identity: 'community_founder' });
          STATE.career.flags.postCareerIdentity = 'community_founder';
          addLegendStoryScore('cityBond', 1);
          addProfileDelta('fanSupport', 2);
          addProfileDelta('legacyBonus', 1);
          return '你把第一笔退役后项目投进社区球场。没有盛大的发布会，只有新的篮网、亮起来的灯和一群孩子抢着第一个投篮。你站在场边，忽然觉得这也是一种冠军。<br><br>效果：球迷支持+2，历史评价+1；传奇剧情分数：城市羁绊+1。';
        }},
        { label: '自由篮球人', hint: '不绑定身份，按自己的节奏留下', apply: function() {
          setBranchNode('post_career', 'freelancer', { identity: 'free_basketball_lifer' });
          STATE.career.flags.postCareerIdentity = 'free_basketball_lifer';
          addLegendStoryScore('individualLegend', 1);
          addProfileDelta('mediaTrust', 1);
          addProfileDelta('fanSupport', 1);
          return '你没有签下任何长期职位。偶尔解说，偶尔探营，偶尔出现在旧球馆二层。你不再属于一张赛程表，却仍然属于篮球。<br><br>效果：媒体信任+1，球迷支持+1；传奇剧情分数：个人传奇+1。';
        }}
      ]
    },
    {
      id: 'post_career_first_year',
      branch: 'post_career',
      phase: 'post_career',
      slot: 'main',
      weight: 10,
      legendStory: true,
      legendTopic: 'legacy',
      title: '退役后：新身份的第一年',
      scenes: [
        '第一年很快，快到像又打了一个赛季。你学会了新身份的语言，也学会了不再把每个夜晚都当成胜负。',
        '有一天，年轻球员问你：退役以后最难的是什么？你想了很久，说，是承认自己还能继续重要，但不必再用上场时间证明。'
      ],
      body: '新身份不是职业生涯的附录。它会决定这段传奇最后怎样落在人群里。',
      requires: function() {
        var node = getBranchNode('post_career');
        return node === 'commentator' || node === 'assistant_coach' || node === 'head_coach' || node === 'team_owner' || node === 'youth_academy' || node === 'china_consultant' || node === 'agency_partner' || node === 'freelancer';
      },
      choices: [
        { label: '安静站稳脚跟', hint: '让退役后的路慢慢成型', apply: function() {
          setBranchNode('post_career', 'identity_settled', { finalIdentity: STATE.career.flags.postCareerIdentity || 'free_basketball_lifer' });
          setLegendStoryFlag('post_career_identity_settled', true);
          applyPostCareerIdentityDelta(2);
          addLegendStoryScore('legacyCare', 1);
          return '第二年，你已经不需要别人介绍你是谁。新身份开始自己说话，而你终于不再急着证明每件事。<br><br>效果：对应身份主属性+2；传奇剧情分数：生涯照护+1。';
        }},
        { label: '把年轻人推到前面', hint: '让传承成为最后的重音', apply: function() {
          setBranchNode('post_career', 'identity_settled', { finalIdentity: STATE.career.flags.postCareerIdentity || 'mentor' });
          setLegendStoryFlag('post_career_mentor_ending', true);
          addLegendStoryScore('lockerRoom', 1);
          addLegendStoryScore('cityBond', 1);
          addProfileDelta('legacyBonus', 1);
          return '镜头想拍你，你却把身边的年轻人往前推了一步。你说，故事到最后总要交给下一双手。那一刻，你没有变小，只是把传奇变得更宽了。<br><br>效果：历史评价+1；传奇剧情分数：更衣室+1，城市羁绊+1。';
        }},
        { label: '保留自己的声音', hint: '继续影响联盟，但接受争议', apply: function() {
          setBranchNode('post_career', 'identity_voice', { finalIdentity: STATE.career.flags.postCareerIdentity || 'voice' });
          setLegendStoryFlag('post_career_kept_voice', true);
          addLegendStoryScore('mediaHeat', 1);
          addProfileDelta('fame', 1);
          addProfileDelta('controversy', 1);
          return '你没有因为退役就变得圆滑。你仍然会指出糟糕的战术、仓促的交易和被忽视的年轻人。有人说你太直，有人说正因为如此才像你。<br><br>效果：人气+1，争议+1；传奇剧情分数：媒体热度+1。';
        }}
      ]
    }
  ];
}

function getLegendStoryEvents() {
  var pack = getLegendEraStoryPack();
  var events = (pack && pack.events) ? pack.events.slice() : [];
  return events.concat(buildLegendDagRouteEvents()).concat(getLegendCareerClosingEvents());
}

var LEGEND_DAG_ROUTES = [
  {
    id: 'late_night_film_room',
    group: 'craft',
    priority: 76,
    eras: ['1984', '1996', '2003'],
    phase: 'season',
    topic: 'craft',
    weight: 68,
    minSeason: 2
  },
  {
    id: 'first_playoff_nerves',
    group: 'playoff',
    priority: 86,
    eras: ['1984', '1996', '2003'],
    phase: 'season',
    topic: 'playoff',
    weight: 82,
    minSeason: 1
  },
  {
    id: 'old_city_first_return',
    group: 'mobility',
    priority: 90,
    eras: ['1984', '1996', '2003'],
    phase: 'season',
    topic: 'city',
    weight: 90,
    existingFlow: 'old_team_return'
  },
  {
    id: 'free_agency_crossroad',
    group: 'mobility',
    priority: 84,
    eras: ['1984', '1996', '2003'],
    phase: 'offseason',
    topic: 'mobility',
    weight: 72,
    minSeason: 3
  },
  {
    id: 'front_office_window',
    group: 'team',
    priority: 82,
    eras: ['1984', '1996', '2003'],
    phase: 'offseason',
    topic: 'team',
    weight: 78,
    minSeason: 2
  },
  {
    id: 'community_court_visit',
    group: 'city',
    priority: 70,
    eras: ['1984', '1996', '2003'],
    phase: 'offseason',
    topic: 'city',
    weight: 64,
    minSeason: 2
  },
  {
    id: 'same_class_duel_first',
    group: 'class',
    priority: 86,
    eras: ['1996', '2003'],
    phase: 'season',
    topic: 'class',
    weight: 76,
    minSeason: 2
  },
  {
    id: 'allstar_weekend_recruit',
    group: 'superteam',
    priority: 82,
    eras: ['1996', '2003'],
    phase: 'offseason',
    topic: 'superteam',
    weight: 70,
    minSeason: 3
  },
  {
    id: 'midnight_superstar_call',
    group: 'superteam',
    priority: 88,
    eras: ['1984', '2003'],
    phase: 'offseason',
    topic: 'superteam',
    weight: 74,
    minSeason: 4
  }
];

function getLegendDagRoutes() {
  if (!isLegendStoryEnabled()) return [];
  var era = String(STATE.eraStart || '');
  return LEGEND_DAG_ROUTES.filter(function(route) {
    return route.eras.indexOf(era) >= 0;
  });
}

function getLegendDagRouteCopy(routeId) {
  var era = String(STATE.eraStart || '2003');
  var copy = {
    late_night_film_room: {
      all: {
        title: '传奇时代：深夜录像室',
        body: '输球之后，训练馆的灯没有完全关掉。你走进录像室，屏幕停在一个并不漂亮的回合：站位慢了半步，传球晚了一秒，整场比赛的重量忽然落在这个小细节上。',
        scenes: [
          '队友们陆续离开，走廊一点点安静下来。助教原本准备关灯，看见你又坐回屏幕前，只把遥控器放在桌上。',
          '录像没有责备任何人，它只是诚实地重复。你看着那个回合一遍遍倒回去，忽然明白低谷有时不是轰然塌下来的，而是从几个小选择开始松动。'
        ]
      },
      '1984': {
        body: '输球之后，助教把录像带重新塞进机器。画面有点糊，声音也不清楚，但那个防守回合仍然像钉子一样扎在屏幕中央。这个年代不会给你热搜审判，只会让你在深夜和自己的脚步声对坐。',
        scenes: [
          '客场大巴已经准备发动，老队友却把录像室钥匙放到你面前。他没说安慰，只说：如果你真想知道为什么输，就把第三节再看一遍。',
          '录像带倒回去时发出很轻的噪声。你看见自己慢了半步，也看见队友在弱侧等过你一次。那一秒没有上报纸，却足够改变一个夏天。'
        ]
      },
      '1996': {
        body: '输球之后，电视台还在剪你的表情。你没有打开新闻，而是坐进录像室。广告牌可以把人放大，录像却会把人放回真实比例：一个脚步、一个选择、一次没有传出去的球。',
        scenes: [
          '训练馆外还有记者，里面却只剩录像机的蓝光。助教问你要不要明天再看，你摇摇头，因为今晚的失误还热着。',
          '你把一个回合看了六遍。第七遍时，你终于看见队友为什么摊手。那不是抱怨，是他真的空了。'
        ]
      },
      '2003': {
        body: '输球之后，论坛已经开始给你打分。队友把手机递过来，你没有接，只是走进录像室。屏幕上的回合比任何帖子都安静，也比任何帖子都诚实。',
        scenes: [
          '电视节目还在争论你是不是这一届最该被期待的人。录像室里没有嘉宾，只有一段你慢了半拍的弱侧轮转。',
          '你把那个回合反复暂停。不是为了惩罚自己，而是为了在下一次同样的夜晚，比今晚多看见半秒。'
        ]
      }
    },
    first_playoff_nerves: {
      all: {
        title: '传奇时代：第一次四月的重量',
        body: '常规赛进入最后阶段，季后赛的影子提前落到训练馆里。教练组开始缩短轮换，记者开始追问经验，队友们的玩笑也少了一点。你第一次意识到，四月不是更大的常规赛，它会让每个人重新认识自己。',
        scenes: [
          '训练结束后，助教把季后赛对手的第一份剪辑交给你。里面没有配乐，只有对手一次次把年轻球员逼到边线。',
          '你看着那些回合，手心慢慢发热。不是害怕，而是知道自己再也不能只用天赋回答问题。'
        ]
      },
      '1984': {
        body: '常规赛进入最后阶段，老将们开始谈起季后赛尺度。那些话听起来很轻，却都带着旧伤：别等裁判救你，别把疼写在脸上，别让客场球迷看见你慌。',
        scenes: [
          '训练馆里，老队友把护具一件件塞进包里。他看见你盯着录像，笑了一下：四月以后，很多犯规不会被叫出来。',
          '你没有立刻回答，只把下一场对手的低位回合多看了一遍。这个年代的季后赛，会先问你站不站得住。'
        ]
      },
      '1996': {
        body: '常规赛进入最后阶段，转播宣传片已经开始播放你的背影。年轻、天赋、接班人，这些词被剪进同一段音乐里。可训练馆里的教练只问一个问题：对手包夹你时，你能不能把球传出去？',
        scenes: [
          '广告牌上的你看起来很镇定，录像室里的你却反复按暂停。季后赛不会在意海报，它只会拆开每个习惯。',
          '队友坐到你旁边，没说大话，只问：如果他们第一节就夹你，我们怎么打？'
        ]
      },
      '2003': {
        body: '常规赛进入最后阶段，论坛已经提前开了季后赛楼。有人说你会证明自己，有人说年轻人到四月都会变小。你关掉那些声音，第一次认真看完了对手整轮防守录像。',
        scenes: [
          '电视台把你和同届几个人放在一张图里，标题写着：谁先在季后赛留下名字？',
          '你没有把图存下来，只把对手弱侧协防的时间点记进本子。四月会很吵，但比赛本身仍然很具体。'
        ]
      }
    },
    free_agency_crossroad: {
      all: {
        title: '传奇时代：几条路摆在桌上',
        body: '休赛期的房间里，几条路被安静地摊开。留下，离开，去争冠军，或者把未来再留一点空白。没有一条路只通向胜利，每一条路都会带走一点东西，也留下某种关系。',
        scenes: [
          '经纪团队没有急着催你签字，只把球队名单和未来几年窗口放在桌上。你看着那些名字，忽然意识到选择球队也是选择一种人生节奏。',
          '窗外的夏天很安静，安静到你能听见自己真正害怕的东西：不是选错球队，而是多年后想起这一天时，不知道自己为什么做了这个决定。'
        ]
      },
      '1984': {
        body: '休赛期，总经理的电话、报纸的猜测和老队友的沉默一起摆在你面前。这个年代的选择不会立刻变成滚动新闻，却会在地方电台和球迷酒馆里被讲很多年。',
        scenes: [
          '经纪人把几支球队的承诺写在纸上。没有复杂的发布会，只有电话线那头不同城市的声音。',
          '你想起旧球馆门口那些穿着你球衣的孩子。职业生涯当然要往前走，但有些地方不是说离开就能轻轻放下。'
        ]
      },
      '1996': {
        body: '休赛期，球队、广告商和电视台都在等待你的选择。年轻球星的去留不再只是阵容问题，它也会改变城市海报、球鞋计划和一整代球迷的想象。',
        scenes: [
          '经纪团队把争冠窗口和商业曝光排成两列。纸面上每条路都很清楚，真正难的是哪条路还像你自己。',
          '你在训练馆门口看见自己的广告牌，忽然明白：离开一座城市，有时候也等于让很多年轻球迷重新理解喜欢。'
        ]
      },
      '2003': {
        body: '休赛期，电视节目已经开始替你选择未来。论坛里有人劝你坚守，有人催你去争冠，还有人把每支球队的空间和阵容算到小数点。可真正要签下名字的人，只有你。',
        scenes: [
          '经纪团队把几种方案投到墙上：留在原地，把路打到底；去更强的球队，把窗口变短也变亮；或者给自己保留下一次选择。',
          '你没有立刻说话。那些声音都很大，但你知道，历史以后问的不是论坛当晚谁赢了，而是你为什么要走那条路。'
        ]
      }
    },
    front_office_window: {
      all: {
        title: '传奇时代：管理层窗口',
        body: '休赛期，管理层把你请进会议室。他们没有让你决定交易，只是认真问了一句：如果这支球队想把你的巅峰变成真正的窗口，我们最该补上什么？',
        scenes: [
          '桌上摆着阵容名单、伤病报告和几张手写便签。你第一次这么清楚地看见，一支球队的未来不是抽象词，而是很多个需要被照顾的位置。',
          '总经理说，你不用替我们做决定，但我们想知道你在场上真正感觉缺什么。这个问题很轻，也很重。'
        ]
      },
      '1984': {
        body: '休赛期，管理层在一间不大的办公室里等你。桌上没有漂亮图表，只有球探报告、录像带标签和一份被翻旧的阵容表。他们问：如果要陪你走得更远，我们该先找哪种人？',
        scenes: [
          '老教练把烟灰缸推远，指着名单说：这个联盟到了五月会变得很硬。你知道他说的不只是身体，也是耐心。',
          '你看着那些空缺位置，第一次感觉自己不只是球员，也是这支球队未来秩序的一部分。'
        ]
      },
      '1996': {
        body: '休赛期，管理层会议里多了商业部门的人，也多了电视转播带来的期待。但篮球问题仍然很具体：你身边需要防守、投射、老将，还是继续相信这批一起长大的队友？',
        scenes: [
          '窗外广告牌还挂着你的照片，会议室里却没有人谈封面。教练只在白板上圈了几个回合：这里，我们还差一个答案。',
          '你忽然明白，门面不是要求球队围着自己转，而是在球队犹豫时，帮他们看清下一步。'
        ]
      },
      '2003': {
        body: '休赛期，管理层把阵容表、薪资空间之外的东西都摆给你看：谁愿意牺牲，谁需要成长，谁能在季后赛最后五分钟留在场上。他们不是要你当经理，只是想知道你的时代窗口还能怎样打开。',
        scenes: [
          '电视节目在外面讨论你该不该离开，会议室里却安静得多。总经理说：如果你愿意继续相信这里，我们也得让这里配得上你的相信。',
          '你看着名单上的年轻人和老将，忽然意识到争冠不是把最亮的名字放在一起，而是让正确的人在正确时刻站在一起。'
        ]
      }
    },
    community_court_visit: {
      all: {
        title: '传奇时代：社区球场的灯',
        body: '休赛期的一天，你被邀请去一片社区球场。那里没有完整的看台，也没有夸张的介绍，只有一群孩子把球抱在怀里，等你走近。',
        scenes: [
          '球场地面有几处裂痕，篮网也不算新。可孩子们看你的眼神，比很多大场面都认真。',
          '一个小孩问你，进 NBA 以后还会不会害怕。这个问题让现场安静了一秒，因为它不像采访，更像一封没有写完的信。'
        ]
      },
      '1984': {
        body: '休赛期，你来到一片旧社区球场。地方报纸只派了一个年轻记者，旁边还有几个骑车来的孩子。这里没有盛大仪式，却有一种很慢、很真诚的期待。',
        scenes: [
          '篮板边缘有些掉漆，孩子们却把它擦得很干净。有人拿着剪下来的报纸照片，问那是不是你。',
          '你看着那张照片，忽然觉得自己在这座城市留下的东西，也许不只发生在球馆里。'
        ]
      },
      '1996': {
        body: '休赛期，你来到城市边上的社区球场。几个孩子穿着宽大的球衣，模仿电视广告里的动作。可当你真正走近，他们问的不是球鞋，而是怎样才能不被教练放弃。',
        scenes: [
          '有人抱着你的海报，有人穿着并不合脚的球鞋。你突然意识到，影响力不是广告拍得多漂亮，而是孩子们会不会因此多打一会儿球。',
          '球场外的广告车经过时，孩子们没有回头。他们只盯着你手里的球。'
        ]
      },
      '2003': {
        body: '休赛期，你来到一片社区球场。地方电视台来了，论坛也有人提前发帖说你是不是作秀。可现场的孩子不知道这些争论，他们只想看你投一个球。',
        scenes: [
          '一个孩子拿着旧杂志让你签名，另一个孩子问你，网上那些人骂你时会不会难过。',
          '你蹲下来系紧他的鞋带，忽然觉得有些回答不该交给镜头，而该交给一个下午。'
        ]
      }
    },
    same_class_duel_first: {
      all: {
        title: '传奇时代：同代人的第一次正面照',
        body: '赛前通道里，你遇见了那个已经被反复拿来和你比较的同代人。你们没有说太多话，但都知道，这不只是普通常规赛。很多年后，人们会从这样的夜晚开始翻起。',
        scenes: [
          '球员通道不长，却像被拉成了一段未来。摄影师在远处等着，队友们故意放慢脚步，把这一秒留给你们。',
          '他向你点头，你也点头。没有挑衅，没有拥抱，只有一种很年轻、也很清楚的确认：你们会在彼此的故事里出现很多次。'
        ]
      },
      '1996': {
        body: '赛前通道里，你遇见另一位 1996 一代的年轻明星。电视台已经把你们剪进同一段宣传片，球鞋公司也乐于看见这种比较。可你们真正面对面时，声音反而变小了。',
        scenes: [
          '他穿着还没正式发售的新鞋，你的鞋带刚刚系紧。镜头在远处找角度，像是害怕错过未来十年的一张照片。',
          '你们只是短短点头。这个年代会把年轻人推到封面上，但真正的竞争，仍然要从今晚的第一回合开始。'
        ]
      },
      '2003': {
        body: '赛前通道里，你遇见另一位 2003 届核心。论坛已经提前开帖，电视台也把你们的数据摆成两列。可真正见面时，你们都没有提排名，只是看了看彼此身后的球馆灯光。',
        scenes: [
          '有人在远处喊你们的名字，像是在催一段历史早点开始。你听见了，却没有回头。',
          '他笑着说：他们又开始比了。你也笑了笑，因为你知道，这些比较会烦人，也会把你们推到更远的地方。'
        ]
      }
    },
    allstar_weekend_recruit: {
      all: {
        title: '传奇时代：全明星周末的走廊',
        body: '全明星周末的酒店走廊比球场更安静。那里没有战术板，也没有主客场，只有巨星之间很短的寒暄和很长的意味。有人在电梯口停下，问你有没有想过换一种方式赢。',
        scenes: [
          '白天你们在镜头前互相开玩笑，晚上走廊灯光暗下来，很多话才变得真实。',
          '他说，你已经证明自己够强了。问题是，如果强的人站到一起，联盟会不会被迫重新学习怎么追赶？'
        ]
      },
      '1996': {
        body: '全明星周末，酒店大堂里到处是球鞋代表、电视工作人员和年轻明星。有人在走廊里叫住你，语气像玩笑，又不像玩笑：以后有机会，我们可以把票房和胜利放到同一支球队里。',
        scenes: [
          '你们白天还一起拍了宣传照。灯光下每个人都笑得很熟，真正关上门以后，竞争和合作的界线才变得模糊。',
          '他说，这个年代会记住会赢的人，也会记住能让孩子们抬头看广告牌的人。你听懂了，那不只是商业邀请。'
        ]
      },
      '2003': {
        body: '全明星周末，酒店走廊里有人压低声音谈未来。论坛还在讨论你们谁更强，电视台还在剪你们并肩热身的画面。可这一次，对方问的是：如果我们不只在全明星当队友呢？',
        scenes: [
          '白天的合照被传得到处都是，晚上你们在走廊尽头停下。没有经纪人，没有记者，只有一句很轻的试探。',
          '他说，联盟迟早会变成球星自己决定方向。你没有马上回答，因为你知道，这句话会改变的不只是你们两个。'
        ]
      }
    },
    midnight_superstar_call: {
      all: {
        title: '传奇时代：午夜电话',
        body: '休赛期训练结束后，手机在储物柜里亮了很久。来电的人不是记者，也不是经纪人，而是一位足够改变系列赛重量的巨星。他没有绕弯，只问：我们要不要换一种方式试试？',
        scenes: [
          '你坐在训练馆地板上，汗还没干。电话那头很安静，安静到你能听出这不是临时起意。',
          '他说，对抗已经证明了彼此。现在的问题是，你们愿不愿意让联盟重新计算距离。'
        ]
      },
      '1984': {
        title: '传奇时代：老牌巨星的深夜电话',
        body: '休赛期深夜，电话铃声在房间里响了很久。来电的是一位老牌巨星。他没有用现代人的方式谈联手，只说：这个联盟正在变，我们也许能一起把门推开。',
        scenes: [
          '电话线那头有一点杂音。他说话很慢，像是在确认这句话真的该说出口。',
          '他说，对抗当然值得被保留，但有些年代的门太重，一个人推会很累。你听着，没有立刻回答。'
        ]
      },
      '2003': {
        title: '传奇时代：午夜电话',
        body: '休赛期训练结束后，手机在储物柜里亮了很久。来电的人不是记者，也不是经纪人，而是那个你在电视节目、论坛长帖和季后赛假想里见过无数次的巨星。他说：我们已经对抗太久了，换一种方式试试吧。',
        scenes: [
          '你坐在训练馆地板上，屏幕光照着未读消息。电话那头没有寒暄，只有一句像战术板一样直接的问题。',
          '他说，如果我们站在一起，联盟会怎么回应？你知道这不是简单补强，而是一种时代判断。'
        ]
      }
    }
  };
  var routeCopy = copy[routeId] || {};
  return Object.assign({}, routeCopy.all || {}, routeCopy[era] || {});
}

function buildLegendDagRouteEvents() {
  if (!isLegendStoryEnabled()) return [];
  return getLegendDagRoutes().filter(function(route) {
    return !route.existingFlow;
  }).map(function(route) {
    var c = getLegendDagRouteCopy(route.id);
    return {
      id: 'legend_route_' + route.id,
      routeId: route.id,
      branch: 'legend_route_' + route.id,
      phase: route.phase || 'season',
      legendStory: true,
      legendRoute: true,
      legendTopic: route.topic || route.group || 'route',
      weight: route.weight || 60,
      title: c.title || '传奇时代',
      scenes: c.scenes || [],
      body: c.body || '',
      requires: function(ctx) {
        return canTriggerLegendDagRoute(route, ctx || {});
      },
      choices: buildLegendDagRouteChoices(route.id)
    };
  });
}

function canTriggerLegendDagRoute(route, ctx) {
  if (!route || !isLegendStoryEnabled()) return false;
  if (hasLegendStoryFlag('seen_legend_route_' + route.id)) return false;
  if (route.minSeason && getLegendStorySeasonNum() < route.minSeason) return false;
  var gamesPlayed = ctx.gamesPlayed || (STATE.season && STATE.season.games ? STATE.season.games.length : 0);
  if (route.id === 'late_night_film_room') {
    var result = ctx.result || {};
    var stats = ctx.stats || {};
    var recent = (STATE.season && STATE.season.games ? STATE.season.games.slice(-5) : []);
    var losses = recent.filter(function(g) { return g && g.result && !g.result.won; }).length;
    var lowScore = stats && stats.pts != null && stats.pts <= 18;
    return gamesPlayed >= 14 && gamesPlayed <= 70 && (!result.won || losses >= 3 || lowScore);
  }
  if (route.id === 'first_playoff_nerves') {
    var seed = 99;
    try { seed = getConferenceSeed(STATE.careerTeam); } catch(e) {}
    return gamesPlayed >= 56 && seed <= getDirectPlayoffSeedLimit() && !hasLegendStoryFlag('first_playoff_nerves_done');
  }
  if (route.id === 'free_agency_crossroad') {
    var cc = STATE.career || {};
    var profile = cc.profile || {};
    return getLegendStorySeasonNum() >= 3 && (cc.contract || 0) <= 2 && ((profile.fame || 0) >= 6 || (STATE.finalOVR || 0) >= 82 || getLegendStoryScore('cityBond') >= 3);
  }
  if (route.id === 'front_office_window') {
    var c2 = STATE.career || {};
    var lastSeason = (c2.seasons || [])[Math.max(0, (c2.seasons || []).length - 1)] || {};
    var wins = lastSeason.wins || (STATE.season && STATE.season.wins) || 0;
    if (String(STATE.eraStart || '') === '2003' && !hasLegendStoryFlag('seen_legend_2003_front_office_window')) return false;
    return getLegendStorySeasonNum() >= 2 && ((STATE.finalOVR || 0) >= 84 || wins >= 45 || getLegendStoryScore('dynasty') >= 2);
  }
  if (route.id === 'community_court_visit') {
    var p = (STATE.career && STATE.career.profile) || {};
    return getLegendStorySeasonNum() >= 2 && (getLegendStoryScore('cityBond') >= 2 || (p.fanSupport || 0) >= 6 || (p.fame || 0) >= 8);
  }
  if (route.id === 'same_class_duel_first') {
    var prof = (STATE.career && STATE.career.profile) || {};
    return gamesPlayed >= 18 && gamesPlayed <= 68 && (getLegendStoryScore('classRivalry') >= 1 || (prof.fame || 0) >= 6 || (STATE.finalOVR || 0) >= 82);
  }
  if (route.id === 'allstar_weekend_recruit') {
    var p2 = (STATE.career && STATE.career.profile) || {};
    return getLegendStorySeasonNum() >= 3 && ((p2.fame || 0) >= 10 || hasCareerHonor('全明星') || getLegendStoryScore('classRivalry') >= 4) && !hasLegendStoryFlag('superstar_recruit_anchor');
  }
  if (route.id === 'midnight_superstar_call') {
    if (String(STATE.eraStart || '') === '2003' && hasLegendStoryFlag('superstar_recruit_anchor')) return false;
    if (String(STATE.eraStart || '') === '2003' && getLegendStoryScore('superteam') >= 4) return false;
    return getLegendStorySeasonNum() >= 4 && ((STATE.finalOVR || 0) >= 86 || getLegendStoryScore('individualLegend') >= 4 || getLegendStoryScore('dynasty') >= 4);
  }
  return true;
}

function buildLegendDagRouteChoices(routeId) {
  if (routeId === 'late_night_film_room') {
    return [
      { label: '自己承担这个回合', hint: '把问题先放回自己身上', apply: function() {
        setLegendStoryFlag('film_room_owned_mistake', true);
        addLegendStoryScore('craft', 2);
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有把暂停画面截给任何人，只在训练本上写下两个字：提前。第二天，队友发现你比平时更早到场，正在重复那个本该出现的位置。<br><br>效果：媒体信任+1；下赛季状态波动略降；传奇剧情分数：技艺路线+2。';
      }},
      { label: '拉队友一起看完', hint: '把低谷变成更衣室共同语言', apply: function() {
        setLegendStoryFlag('film_room_team_watch', true);
        addLegendStoryScore('lockerRoom', 2);
        addLegendStoryScore('dynasty', 1);
        addProfileDelta('lockerRoomTrust', 2);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '你没有把录像室留成一个人的惩罚。几个队友被你叫回来，大家一开始都很沉默，后来终于有人指着屏幕说：这里我也慢了。那晚之后，错误不再只属于一个人。<br><br>效果：更衣室信任+2；球队默契略升；传奇剧情分数：更衣室+2，王朝线+1。';
      }},
      { label: '找教练重新谈打法', hint: '用低谷换一次结构调整', apply: function() {
        setLegendStoryFlag('film_room_coach_talk', true);
        addLegendStoryScore('craft', 1);
        addLegendStoryScore('historyShift', 1);
        addProfileDelta('coachTrust', 2);
        addAttrDelta('PAS', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把那段录像带进教练办公室，没有要求更多球权，只问：如果他们下次还这样夹，我们能不能提前把弱侧放出来？教练沉默了一会儿，在战术板上画了第二条线。<br><br>效果：教练信任+2，传球+1；传奇剧情分数：技艺路线+1，历史偏移+1。';
      }}
    ];
  }
  if (routeId === 'first_playoff_nerves') {
    return [
      { label: '先求稳，把第一节打明白', hint: '降低波动，建立季后赛基础', apply: function() {
        setLegendStoryFlag('first_playoff_nerves_done', true);
        setLegendStoryFlag('first_playoff_safe_start', true);
        addLegendStoryScore('craft', 2);
        addLegendStoryScore('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有急着证明自己能统治四月。第一堂战术课，你只问了两个问题：什么时候该慢下来，什么时候该把球交出去。队友们听见这些问题，反而更放心了。<br><br>效果：下赛季状态波动略降；传奇剧情分数：技艺路线+2，媒体信任+1。';
      }},
      { label: '接住大场面，主动攻击', hint: '关键球和季后赛神话提升', apply: function() {
        setLegendStoryFlag('first_playoff_nerves_done', true);
        setLegendStoryFlag('first_playoff_attacker', true);
        addLegendStoryScore('playoffMyth', 3);
        addLegendStoryScore('mediaHeat', 1);
        addAttrDelta('CLU', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        return '你知道季后赛不会等人适应，所以训练结束后又加练了最后五分钟的持球。不是为了漂亮数据，而是为了当球真的回到你手里时，身体已经先回答过一遍。<br><br>效果：关键球+1；传奇剧情分数：季后赛神话+3，媒体热度+1。';
      }},
      { label: '把压力分给队友一起背', hint: '更衣室和王朝线提升', apply: function() {
        setLegendStoryFlag('first_playoff_nerves_done', true);
        setLegendStoryFlag('first_playoff_trusted_teammates', true);
        addLegendStoryScore('lockerRoom', 2);
        addLegendStoryScore('dynasty', 1);
        addProfileDelta('lockerRoomTrust', 2);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '你在录像课结束后没有说豪言，只把几个关键回合分给队友一起读。有人负责底角，有人负责掩护，有人负责保护篮板。季后赛还没开始，但更衣室已经不像一个人在等审判。<br><br>效果：更衣室信任+2；球队默契略升；传奇剧情分数：更衣室+2，王朝线+1。';
      }}
    ];
  }
  if (routeId === 'free_agency_crossroad') {
    return [
      { label: '把留守放在第一位', hint: '城市羁绊和王朝耐心提升', apply: function() {
        setLegendStoryFlag('free_agency_stay_value', true);
        addLegendStoryScore('cityBond', 3);
        addLegendStoryScore('dynasty', 1);
        addProfileDelta('loyalty', 2);
        addProfileDelta('fanSupport', 1);
        return '你没有急着把未来推向更亮的地方。你说，如果一座城市陪你熬过低谷，它就不该只在你变好时被留在身后。房间里安静了一会儿，经纪团队把“留守”两个字重新写到最上面。<br><br>效果：忠诚+2，球迷支持+1；传奇剧情分数：城市羁绊+3，王朝线+1。';
      }},
      { label: '把争冠窗口放在第一位', hint: '巨星合流和媒体热度提升', apply: function() {
        setLegendStoryFlag('free_agency_contender_value', true);
        addLegendStoryScore('superteam', 2);
        addLegendStoryScore('mediaHeat', 1);
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你没有假装自己不在意冠军。你说，巅峰不会等人，窗口也不会等人。这个答案很诚实，也注定会让一些人失望。可你知道，历史有时会追问一个球员有没有勇气承认自己的野心。<br><br>效果：人气+1，争议+1；传奇剧情分数：巨星同盟+2，媒体热度+1。';
      }},
      { label: '保留下一次选择', hint: '个人传奇和媒体关注提升', apply: function() {
        setLegendStoryFlag('free_agency_short_window_value', true);
        addLegendStoryScore('individualLegend', 2);
        addLegendStoryScore('mediaTrust', 1);
        addProfileDelta('mediaTrust', 1);
        return '你没有把所有门一次关死。你说，有些决定要等身体、球队和心都给出答案。外界可能觉得这不够浪漫，但你第一次认真保护了未来的自己。<br><br>效果：媒体信任+1；传奇剧情分数：个人传奇+2，媒体信任+1。';
      }}
    ];
  }
  if (routeId === 'front_office_window') {
    return [
      { label: '要求补防守和硬度', hint: '王朝线和季后赛抗性提升', apply: function() {
        setLegendStoryFlag('front_office_defense_request', true);
        addLegendStoryScore('dynasty', 2);
        addLegendStoryScore('playoffMyth', 1);
        addProfileDelta('leadership', 1);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '你没有要一个更响亮的名字，只说球队到了五月需要有人愿意撞墙。管理层把这句话记了下来，因为它不像抱怨，更像一个真正打过硬仗的人给出的答案。<br><br>效果：领导力+1；球队默契略升；传奇剧情分数：王朝线+2，季后赛神话+1。';
      }},
      { label: '要求更多空间和投射', hint: '历史偏移和技艺路线提升', apply: function() {
        setLegendStoryFlag('front_office_spacing_request', true);
        addLegendStoryScore('historyShift', 2);
        addLegendStoryScore('craft', 1);
        addAttrDelta('PAS', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        return '你指着几个被夹击的回合，说球队不只需要更强的人，也需要更宽的球场。教练听完没有立刻表态，只把底角两个位置圈了起来。<br><br>效果：传球+1；传奇剧情分数：历史偏移+2，技艺路线+1。';
      }},
      { label: '相信现有队友', hint: '更衣室信任和城市耐心提升', apply: function() {
        setLegendStoryFlag('front_office_trusted_roster', true);
        addLegendStoryScore('lockerRoom', 2);
        addLegendStoryScore('cityBond', 1);
        addProfileDelta('lockerRoomTrust', 2);
        addProfileDelta('mediaTrust', 1);
        return '你没有把队友当成筹码清单。你说，这支球队当然需要变好，但有些人已经和我一起输过，也应该有机会一起赢回来。那句话后来传进更衣室，很多人没有提，却都记住了。<br><br>效果：更衣室信任+2，媒体信任+1；传奇剧情分数：更衣室+2，城市羁绊+1。';
      }}
    ];
  }
  if (routeId === 'community_court_visit') {
    return [
      { label: '陪孩子们打一会儿', hint: '城市羁绊和媒体信任提升', apply: function() {
        setLegendStoryFlag('community_court_played', true);
        addLegendStoryScore('cityBond', 2);
        addLegendStoryScore('mediaTrust', 1);
        addProfileDelta('fanSupport', 2);
        return '你没有急着走流程，而是脱掉外套，和孩子们打了几回合。没有人记比分，但有个孩子在你离开时小声说：原来你真的会来。<br><br>效果：球迷支持+2；传奇剧情分数：城市羁绊+2，媒体信任+1。';
      }},
      { label: '把资源留给这片球场', hint: '全国偶像和城市长期回声提升', apply: function() {
        setLegendStoryFlag('community_court_supported', true);
        addLegendStoryScore('cityBond', 2);
        addLegendStoryScore('nationalIcon', 1);
        addProfileDelta('legacyBonus', 1);
        addProfileDelta('mediaTrust', 1);
        return '你没有把这次到访只留成照片。几周后，球场换了新的篮网和灯。地方新闻只播了几十秒，但那片灯会在很多个傍晚继续亮着。<br><br>效果：历史评价+1，媒体信任+1；传奇剧情分数：城市羁绊+2，全国偶像+1。';
      }},
      { label: '带队友一起来', hint: '更衣室和城市关系一起提升', apply: function() {
        setLegendStoryFlag('community_court_team_visit', true);
        addLegendStoryScore('lockerRoom', 1);
        addLegendStoryScore('cityBond', 2);
        addProfileDelta('lockerRoomTrust', 1);
        addProfileDelta('fanSupport', 1);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '下次你没有一个人来。几个队友站在孩子们中间，刚开始还有些拘谨，后来一起笑着抢篮板。那天以后，这片球场记住的不只是你，也记住了这支球队。<br><br>效果：更衣室信任+1，球迷支持+1；球队默契略升；传奇剧情分数：更衣室+1，城市羁绊+2。';
      }}
    ];
  }
  if (routeId === 'same_class_duel_first') {
    return [
      { label: '公开尊重这个对手', hint: '同代竞争升温，但口碑更温和', apply: function() {
        setLegendStoryFlag('same_class_public_respect', true);
        addLegendStoryScore('classRivalry', 2);
        addLegendStoryScore('mediaTrust', 1);
        addProfileDelta('mediaTrust', 1);
        return '你没有把比较说成敌意。赛后你认真提到他的名字，说这个年代会因为彼此都在而变得更好。那句话不够锋利，却让这段竞争有了更长的寿命。<br><br>效果：媒体信任+1；传奇剧情分数：同代竞争+2，媒体信任+1。';
      }},
      { label: '把竞争说出口', hint: '同代竞争和媒体热度大幅提升', apply: function() {
        setLegendStoryFlag('same_class_fire_declared', true);
        addLegendStoryScore('classRivalry', 3);
        addLegendStoryScore('mediaHeat', 1);
        addProfileDelta('fame', 1);
        return '你没有躲开镜头。你说，尊重归尊重，但我也想知道多年后人们会先念谁的名字。第二天，节目和报纸都把这句话放进标题里。<br><br>效果：人气+1；传奇剧情分数：同代竞争+3，媒体热度+1。';
      }},
      { label: '淡化个人比较，只谈球队', hint: '更衣室更稳，竞争温度保留', apply: function() {
        setLegendStoryFlag('same_class_team_first', true);
        addLegendStoryScore('lockerRoom', 1);
        addLegendStoryScore('classRivalry', 1);
        addProfileDelta('lockerRoomTrust', 1);
        addProfileDelta('mediaTrust', 1);
        return '你把问题带回球队：他很出色，但我们今晚要解决的是五个人的比赛。队友们听见这句话都笑了，因为他们知道你不是没有野心，只是没有把他们排除在野心之外。<br><br>效果：更衣室信任+1，媒体信任+1；传奇剧情分数：更衣室+1，同代竞争+1。';
      }}
    ];
  }
  if (routeId === 'allstar_weekend_recruit') {
    return [
      { label: '认真听完联手设想', hint: '巨星同盟和媒体热度提升', apply: function() {
        setLegendStoryFlag('allstar_recruit_listened', true);
        addLegendStoryScore('superteam', 2);
        addLegendStoryScore('mediaHeat', 1);
        addProfileDelta('fame', 1);
        return '你没有立刻答应，也没有把它当成玩笑。你只是听他说完阵容、窗口和未来。那一刻你意识到，巨星之间的几句话，有时会比一笔交易更早改变联盟。<br><br>效果：人气+1；传奇剧情分数：巨星同盟+2，媒体热度+1。';
      }},
      { label: '用玩笑把距离留住', hint: '保留竞争，媒体信任提升', apply: function() {
        setLegendStoryFlag('allstar_recruit_kept_distance', true);
        addLegendStoryScore('classRivalry', 2);
        addLegendStoryScore('mediaTrust', 1);
        addProfileDelta('mediaTrust', 1);
        return '你笑着说，全明星当队友已经够了，剩下的留给常规赛和季后赛。对方也笑了。那不是拒绝友情，而是把竞争最好的部分留在原地。<br><br>效果：媒体信任+1；传奇剧情分数：同代竞争+2，媒体信任+1。';
      }},
      { label: '把话题交给球队未来', hint: '王朝线和更衣室提升', apply: function() {
        setLegendStoryFlag('allstar_recruit_team_window', true);
        addLegendStoryScore('dynasty', 2);
        addLegendStoryScore('lockerRoom', 1);
        addProfileDelta('lockerRoomTrust', 1);
        return '你没有只问自己能不能赢，而是问：如果我走了，现在这批队友怎么办？那句话让走廊短暂安静下来。你知道，伟大有时候不是选择最亮的路，而是记得谁还站在你身后。<br><br>效果：更衣室信任+1；传奇剧情分数：王朝线+2，更衣室+1。';
      }}
    ];
  }
  if (routeId === 'midnight_superstar_call') {
    return [
      { label: '认真考虑联手', hint: '巨星同盟提升，争议随之上升', apply: function() {
        setLegendStoryFlag('midnight_superstar_call_considered', true);
        addLegendStoryScore('superteam', 3);
        addLegendStoryScore('mediaHeat', 1);
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你没有给出承诺，却也没有挂断。你们谈了很久，谈对手、谈窗口、谈那些一个人很难推开的门。电话结束后，训练馆重新安静下来，但你知道联盟的距离已经被悄悄量过一次。<br><br>效果：人气+1，争议+1；传奇剧情分数：巨星同盟+3，媒体热度+1。';
      }},
      { label: '保持距离，继续对抗', hint: '个人传奇和同代竞争提升', apply: function() {
        setLegendStoryFlag('midnight_superstar_call_refused', true);
        addLegendStoryScore('individualLegend', 2);
        addLegendStoryScore('classRivalry', 1);
        addProfileDelta('mediaTrust', 1);
        return '你感谢了那通电话，也把它放回该在的位置。不是所有伟大都需要合流，有些故事就是因为彼此站在对面，才会被记得更久。<br><br>效果：媒体信任+1；传奇剧情分数：个人传奇+2，同代竞争+1。';
      }},
      { label: '把决定留给球队窗口', hint: '王朝线和更衣室提升', apply: function() {
        setLegendStoryFlag('midnight_superstar_call_team_first', true);
        addLegendStoryScore('dynasty', 2);
        addLegendStoryScore('lockerRoom', 1);
        addProfileDelta('leadership', 1);
        return '你说，如果有一天真的要改变方向，也不能只因为两个巨星想赢。球队、队友、城市和那些已经一起输过的人，都该被认真计算进去。电话那头沉默了一会儿，说：我懂。<br><br>效果：领导力+1；传奇剧情分数：王朝线+2，更衣室+1。';
      }}
    ];
  }
  return [];
}

function getLegendStoryState() {
  var c = STATE.career;
  c.legendStory = c.legendStory || { era: String(STATE.eraStart || '2003'), scores: {}, flags: {}, history: [], yearbook: [] };
  c.legendStory.era = String(STATE.eraStart || c.legendStory.era || '2003');
  c.legendStory.scores = c.legendStory.scores || {};
  c.legendStory.flags = c.legendStory.flags || {};
  c.legendStory.history = c.legendStory.history || [];
  c.legendStory.yearbook = c.legendStory.yearbook || [];
  c.legendStory.topicCooldown = c.legendStory.topicCooldown || {};
  var defaults = {
    classRivalry: 0, dynasty: 0, individualLegend: 0, cityBond: 0,
    mediaHeat: 0, mediaTrust: 0, lockerRoom: 0, craft: 0,
    playoffMyth: 0, historyShift: 0, superteam: 0, nationalIcon: 0, legacyCare: 0,
    oldSchoolRespect: 0, commercialPull: 0
  };
  Object.keys(defaults).forEach(function(k) {
    if (c.legendStory.scores[k] == null) c.legendStory.scores[k] = defaults[k];
  });
  return c.legendStory;
}

function hasLegendStoryFlag(key) {
  if (!isLegendStoryEnabled()) return false;
  return !!getLegendStoryState().flags[key];
}

function setLegendStoryFlag(key, val) {
  if (!isLegendStoryEnabled()) return;
  getLegendStoryState().flags[key] = val == null ? true : val;
}

function addLegendStoryScore(key, delta) {
  if (!isLegendStoryEnabled()) return 0;
  var st = getLegendStoryState();
  st.scores[key] = Math.max(-20, Math.min(99, (st.scores[key] || 0) + (delta || 0)));
  return st.scores[key];
}

function getLegendStoryScore(key) {
  if (!isLegendStoryEnabled()) return 0;
  return getLegendStoryState().scores[key] || 0;
}

function getLegendStoryTopic(ev) {
  return (ev && ev.legendTopic) || 'main';
}

function isLegendTopicCooling(topic, seasonNum) {
  if (!isLegendStoryEnabled()) return false;
  var st = getLegendStoryState();
  var sn = seasonNum || getLegendStorySeasonNum();
  return st.topicCooldown && st.topicCooldown[topic] === sn;
}

function markLegendTopicUsed(topic, seasonNum) {
  if (!isLegendStoryEnabled() || !topic) return;
  var st = getLegendStoryState();
  st.topicCooldown = st.topicCooldown || {};
  st.topicCooldown[topic] = seasonNum || getLegendStorySeasonNum();
}

function getLegendSameTeamSeasons(team) {
  if (!STATE.career) return 0;
  var t = team || STATE.careerTeam;
  var seasons = STATE.career.seasons || [];
  var count = seasons.filter(function(s) { return s && s.team === t; }).length;
  if (STATE.careerTeam === t) count += 1;
  return count;
}

function getLegendStorySeasonNum() {
  return Math.max(1, ((STATE.career && STATE.career.seasonCount) || 0) + 1);
}

function getLegendStoryYear() {
  var start = parseInt(STATE.eraStart, 10) || 2003;
  return start + getLegendStorySeasonNum() - 1;
}

function getLegendStorySameClassStar() {
  var y = getLegendStoryYear();
  if (y <= 2003) return '勒布朗、韦德、安东尼和波什';
  if (y === 2004) return '德怀特·霍华德和本·戈登';
  if (y === 2005) return '克里斯·保罗和德隆·威廉姆斯';
  if (y === 2006) return '布兰登·罗伊和拉马库斯·阿尔德里奇';
  if (y === 2007) return '杜兰特、奥登和霍福德';
  return '新一届年轻人';
}

function markLegendStoryEvent(ev) {
  if (!ev || !ev.id || !isLegendStoryEnabled()) return;
  var st = getLegendStoryState();
  st.flags['seen_' + ev.id] = true;
  st.lastEventId = ev.id;
  st.lastSeasonNum = getLegendStorySeasonNum();
  markLegendTopicUsed(getLegendStoryTopic(ev));
}

function getSeasonStoryPopupCount() {
  if (!STATE || !STATE.season) return 0;
  STATE.season.events = STATE.season.events || {};
  return STATE.season.events.storyPopupCount || 0;
}

function canTriggerSeasonStoryPopup() {
  return getSeasonStoryPopupCount() < 2;
}

function markSeasonStoryPopupTriggered(kind, eventId) {
  if (!STATE || !STATE.season) return;
  STATE.season.events = STATE.season.events || {};
  STATE.season.events.storyPopupCount = getSeasonStoryPopupCount() + 1;
  STATE.season.events.storyPopupLog = STATE.season.events.storyPopupLog || [];
  STATE.season.events.storyPopupLog.push({
    gameNum: STATE.season.games ? STATE.season.games.length : 0,
    kind: kind || 'story',
    eventId: eventId || ''
  });
}

function chooseLegendSeasonStoryEvent(game, result, stats) {
  if (!isLegendStoryEnabled()) return null;
  if (!canTriggerSeasonStoryPopup()) return null;
  var c = STATE.career;
  var gamesPlayed = (STATE.season && STATE.season.games ? STATE.season.games.length : 0);
  var sinceLast = c._lastSeasonBranchGame == null ? 99 : gamesPlayed - c._lastSeasonBranchGame;
  if (sinceLast < 8) return null;
  var pool = getLegendStoryEvents().filter(function(ev) {
    if (!ev.legendStory || getEventPhases(ev).indexOf('season') < 0) return false;
    if (hasLegendStoryFlag('seen_' + ev.id)) return false;
    if (isLegendTopicCooling(getLegendStoryTopic(ev))) return false;
    try { return !ev.requires || ev.requires({ game: game, result: result, stats: stats, gamesPlayed: gamesPlayed }); } catch(e) { return false; }
  });
  if (!pool.length) return null;
  var picked = pickBranchEvent(pool, true);
  if (picked) {
    c._lastSeasonBranchGame = gamesPlayed;
    markLegendStoryEvent(picked);
    markSeasonStoryPopupTriggered('legend_season', picked.id);
  }
  return picked;
}
const LEGEND_STORY_EVENTS = [
  {
    id: 'legend_2003_class_arrival',
    branch: 'legend_story_2003',
    phase: 'season',
    legendStory: true,
    legendTopic: 'class',
    weight: 80,
    title: '传奇时代：白金一代入场',
    scenes: [
      '选秀夜的灯还没完全熄灭，联盟的宣传海报已经换成了新的面孔。球探、记者、球队老板都在说同一句话：2003 届可能会改写未来十年。',
      '你第一次走进客场球馆时，走廊电视正在循环播放勒布朗、韦德、安东尼和波什的集锦。镜头扫过你的名字，字幕很谨慎：另一个需要被认真观察的人。'
    ],
    body: '这是 2003 传奇时代的第一道分叉。你可以把自己写进这一届，也可以先把声音压低，把球交给比赛本身。这个选择会影响后续同届叙事、媒体评价和球队耐心。',
    requires: function(ctx) {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() === 1 && (ctx.gamesPlayed || 0) >= 2 && !hasLegendStoryFlag('seen_legend_2003_class_arrival');
    },
    choices: [
      { label: '公开说：我属于这一届的最前排', hint: '提高声望和同届竞争感，但媒体压力上升', apply: function() {
        setBranchNode('legend_story_2003', 'class_claimed', { era: '2003', identity: 'front_row' });
        setLegendStoryFlag('class_claimed', true);
        addLegendStoryScore('classRivalry', 3); addLegendStoryScore('mediaHeat', 2);
        addProfileDelta('fame', 3); addProfileDelta('controversy', 1); addSeasonMod('mediaPressure', 1, -10, 10);
        return '你没有绕开问题。采访席前的录音笔像一排小小的探照灯，你说：如果这一届注定要被记住，我希望人们记住我的名字也在最前面。<br><br>第二天，地方报纸把这句话放到体育版头条。支持者说你有胆，怀疑者说你还没有赢过任何东西。<br><br>效果：声望+3，争议+1；传奇剧情分数：同届竞争+3，媒体热度+2；下赛季媒体压力略升。';
      }},
      { label: '不接标签，只谈下一场比赛', hint: '降低争议，提升教练信任和更衣室稳定', apply: function() {
        setBranchNode('legend_story_2003', 'class_quiet', { era: '2003', identity: 'quiet_worker' });
        setLegendStoryFlag('class_quiet', true);
        addLegendStoryScore('craft', 2); addLegendStoryScore('lockerRoom', 2);
        addProfileDelta('coachTrust', 2); addProfileDelta('lockerRoomTrust', 2); addProfileDelta('mediaTrust', 1);
        return '你把问题推回到球场：这一届有很多伟大的名字，但我现在只想把下一场打明白。主教练在门口听见这句，点了点头。<br><br>队友们喜欢这种回答。它不够响亮，却像一块稳定的地板，让更衣室知道你不是只为了新闻标题来这里。<br><br>效果：教练信任+2，更衣室信任+2，媒体信任+1；传奇剧情分数：技艺路线+2，更衣室+2。';
      }}
    ]
  },
  {
    id: 'legend_2003_rookie_table',
    branch: 'legend_story_2003',
    phase: 'season',
    legendStory: true,
    legendTopic: 'class',
    weight: 70,
    title: '传奇时代：新秀圆桌',
    scenes: [
      '全明星周末前后，联盟安排了一场新秀圆桌。摄影棚不大，气氛却像一个提前搭好的历史展柜。',
      '主持人把话题抛给你：如果这一届十年后被拿出来比较，你希望自己留下什么？旁边有人笑，有人看着桌面，空气里全是年轻人的锋利。'
    ],
    body: '你必须给自己的传奇叙事定一个方向。它不会立刻决定胜负，但会影响后续历史评价的口径。',
    requires: function(ctx) {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() === 1 && (ctx.gamesPlayed || 0) >= 18 && !hasLegendStoryFlag('seen_legend_2003_rookie_table');
    },
    choices: [
      { label: '我要用冠军定义自己', hint: '王朝线加深，个人数据叙事略降温', apply: function() {
        setBranchNode('legend_story_2003', 'ring_chase', { legacy: 'rings' });
        setLegendStoryFlag('legacy_rings', true);
        addLegendStoryScore('dynasty', 4); addLegendStoryScore('classRivalry', 1);
        addProfileDelta('leadership', 2); addProfileDelta('fanSupport', 1); addSeasonMod('teamChemistry', 1, -10, 10);
        return '你看了一眼镜头，说自己不想只做一张漂亮的新秀卡。数据会被刷新，集锦会被剪短，但冠军旗帜会一直挂在屋顶。<br><br>这句话很快传回更衣室。老队友没有多说，只是在训练结束后多留你打了两组战术。<br><br>效果：领导力+2，球迷支持+1；下赛季化学反应略升；传奇剧情分数：王朝线+4，同届竞争+1。';
      }},
      { label: '我要证明自己是最完整的球员', hint: '个人传奇线加深，媒体会持续比较你和同届球星', apply: function() {
        setBranchNode('legend_story_2003', 'complete_player', { legacy: 'complete' });
        setLegendStoryFlag('legacy_complete', true);
        addLegendStoryScore('individualLegend', 4); addLegendStoryScore('mediaHeat', 1);
        addProfileDelta('fame', 2); addProfileDelta('businessValue', 1); addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有避开野心：我希望别人提到这一届时，不只问谁得分最多，也问谁能在任何阵容里解决最多问题。<br><br>节目播出后，电视台开始把你的回合拆成好几类：持球、无球、防守、关键球。比较变多了，关注也变得更锋利。<br><br>效果：声望+2，商业价值+1，关键球+1；传奇剧情分数：个人传奇+4，媒体热度+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_roty_shadow',
    branch: 'legend_story_2003',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'class',
    weight: 90,
    title: '传奇时代：最佳新秀之后',
    body: '赛季结束，最佳新秀讨论没有只停在奖杯上。2003 届的名字被反复摊开，记者问你：如果第一年没有赢下所有人的票，你会怎么消化？如果赢了，你又准备怎么承受第二年的目光？',
    requires: function() {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() === 2 && !hasLegendStoryFlag('rookie_verdict_done');
    },
    choices: [
      { label: '把最佳新秀当成起点', hint: '不论是否获奖，都转化为第二年进攻稳定性', apply: function() {
        setLegendStoryFlag('rookie_verdict_done', true);
        setBranchNode('legend_story_2003', 'sophomore_fire', { rookieResponse: 'fuel' });
        addLegendStoryScore('classRivalry', 2); addLegendStoryScore('craft', 2);
        addAttrDelta('MID', 1); addAttrDelta('HAN', 1); addSeasonMod('formVariance', -1, -10, 10); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把整整一个文件夹的报道带进训练馆。夸你的，质疑你的，漏掉你的，全都夹在一起。训练师问你要不要丢掉，你说不用，它们会提醒我第二年不能只靠新鲜感。<br><br>效果：中投+1，控球+1；下赛季状态波动略降；传奇剧情分数：同届竞争+2，技艺路线+2。';
      }},
      { label: '公开尊重同届，但拒绝排位游戏', hint: '媒体信任上升，竞争叙事降温', apply: function() {
        setLegendStoryFlag('rookie_verdict_done', true);
        setBranchNode('legend_story_2003', 'class_respect', { rookieResponse: 'respect' });
        addLegendStoryScore('mediaTrust', 3); addLegendStoryScore('classRivalry', -1);
        addProfileDelta('mediaTrust', 3); addProfileDelta('lockerRoomTrust', 1); addSeasonMod('mediaPressure', -1, -10, 10);
        return '你在采访里把同届几个名字认真念了一遍，然后说：如果我们真的足够好，历史会自己排队。现在我更关心球队下一步怎么赢。<br><br>这段回答被很多记者喜欢，因为它没有回避，也没有把年轻人的比较变成廉价口水。<br><br>效果：媒体信任+3，更衣室信任+1；下赛季媒体压力略降；传奇剧情分数：媒体信任+3，同届竞争-1。';
      }}
    ]
  },
  {
    id: 'legend_2003_old_media_grind',
    branch: 'legend_story_2003',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'media',
    weight: 65,
    title: '传奇时代：杂志封面和剪报箱',
    body: '这个时代的声望还会被纸质杂志、地方电台和报纸专栏慢慢塑形。经纪人给你看了两个邀约：一个是全国杂志封面，一个是球队城市的深度采访。',
    requires: function() {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() >= 2 && getLegendStorySeasonNum() <= 4 && !hasLegendStoryFlag('old_media_done') && ((STATE.career.profile && STATE.career.profile.fame) || 0) >= 8;
    },
    choices: [
      { label: '接全国封面', hint: '商业和声望提升，争议与媒体热度同步上升', apply: function() {
        setLegendStoryFlag('old_media_done', true);
        addLegendStoryScore('mediaHeat', 3); addLegendStoryScore('nationalIcon', 2);
        addProfileDelta('fame', 3); addProfileDelta('businessValue', 3); addProfileDelta('controversy', 1);
        return '拍摄那天，造型师把灯打得很亮。封面标题很大胆：下一个十年的答案？你知道这句话会被人喜欢，也会被人记仇。<br><br>杂志上市后，客场嘘声明显大了。可广告商也开始把你的名字放进更大的预算表里。<br><br>效果：声望+3，商业价值+3，争议+1；传奇剧情分数：媒体热度+3，全国偶像+2。';
      }},
      { label: '做城市深度采访', hint: '球队归属和球迷支持提升，商业爆发较慢', apply: function() {
        setLegendStoryFlag('old_media_done', true);
        addLegendStoryScore('cityBond', 3); addLegendStoryScore('lockerRoom', 1);
        addProfileDelta('fanSupport', 3); addProfileDelta('loyalty', 2); addProfileDelta('mediaTrust', 1);
        return '你没有选最亮的封面，而是坐进当地报社的旧采访间。记者问了很多球场外的问题：你住在哪里，常去哪家餐馆，输球后怎么回家。<br><br>报道出来后，球迷第一次感觉你不是短暂停靠在这座城市，而是真的把生活的一部分放在这里。<br><br>效果：球迷支持+3，忠诚+2，媒体信任+1；传奇剧情分数：城市羁绊+3，更衣室+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_franchise_claim',
    branch: 'legend_story_2003',
    phase: 'season',
    legendStory: true,
    legendTopic: 'team',
    weight: 75,
    title: '传奇时代：球队把钥匙递过来',
    scenes: [
      '赛季中段，教练组把一页新的战术纸放进你的柜子。上面没有太多花活，只有几个明确的终结点。',
      '助教说，管理层想知道你能不能承担真正的主攻结构。不是一两场爆发，而是每个夜晚都让球队有一个稳定答案。'
    ],
    body: '你已经不只是新秀。球队开始试探你的上限，也试探你的耐心。接下来的选择会决定你在传奇模式中的球队身份。',
    requires: function(ctx) {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() >= 2 && getLegendStorySeasonNum() <= 4 && (ctx.gamesPlayed || 0) >= 12 && !hasLegendStoryFlag('seen_legend_2003_franchise_claim') && ((STATE.finalOVR || 0) >= 80 || ((STATE.career.profile && STATE.career.profile.coachTrust) || 0) >= 6);
    },
    choices: [
      { label: '接过核心球权', hint: '个人能力和球队地位提升，体能压力增加', apply: function() {
        setLegendStoryFlag('franchise_core', true);
        setBranchNode('legend_story_2003', 'franchise_core', { teamRole: 'core' });
        addLegendStoryScore('dynasty', 2); addLegendStoryScore('individualLegend', 2);
        addAttrDelta('PAS', 1); addAttrDelta('CLU', 1); addProfileDelta('leadership', 2); addSeasonMod('staminaLoad', 1, -10, 10); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有把战术纸还回去。下一场开始，你主动要了更多高位发起和关键回合。失误也会变多，但每一次错误都像在把球队的方向盘往你手里推。<br><br>效果：传球+1，关键球+1，领导力+2；下赛季疲劳压力略升；传奇剧情分数：王朝线+2，个人传奇+2。';
      }},
      { label: '先把队友拉进体系', hint: '化学反应和更衣室提高，个人声望增长较慢', apply: function() {
        setLegendStoryFlag('franchise_connector', true);
        setBranchNode('legend_story_2003', 'franchise_connector', { teamRole: 'connector' });
        addLegendStoryScore('lockerRoom', 3); addLegendStoryScore('dynasty', 1);
        addAttrDelta('PAS', 1); addProfileDelta('lockerRoomTrust', 3); addProfileDelta('coachTrust', 1); addSeasonMod('teamChemistry', 2, -10, 10); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你告诉教练，可以给你更多球权，但第一步应该是让所有人知道自己会在哪里接到球。接下来几周，你训练后留下来和替补一起跑第二套战术。<br><br>效果：传球+1，更衣室信任+3，教练信任+1；下赛季化学反应提升；传奇剧情分数：更衣室+3，王朝线+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_next_wave',
    branch: 'legend_story_2003',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'class',
    weight: 75,
    title: '传奇时代：下一届人已经到了',
    body: '新的选秀名单进来了，联盟又开始寻找下一张脸。{同届球星}之外，年轻人也在往上涌。你第一次意识到，传奇时代不是一个静止展柜，而是一条每年都会有人冲进来的走廊。',
    requires: function() {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() >= 4 && !hasLegendStoryFlag('next_wave_done');
    },
    choices: [
      { label: '把年轻人当作压力', hint: '训练收益更直接，但争议和竞争感上升', apply: function() {
        setLegendStoryFlag('next_wave_done', true);
        setBranchNode('legend_story_2003', 'guard_the_gate', { nextWave: 'pressure' });
        addLegendStoryScore('classRivalry', 2); addLegendStoryScore('individualLegend', 2);
        addAttrDelta('ATH', 1); addAttrDelta('threePT', 1); addProfileDelta('controversy', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把新秀预测贴在力量房门口。不是为了记住他们，而是为了提醒自己：这个联盟不会等任何人成为雕像。<br><br>夏天结束时，你的脚步更轻，三分线外也多了一点狠劲。<br><br>效果：运动+1，三分+1，争议+1；传奇剧情分数：同届竞争+2，个人传奇+2。';
      }},
      { label: '把年轻人纳入自己的时代', hint: '领袖评价和历史叙事更稳', apply: function() {
        setLegendStoryFlag('next_wave_done', true);
        setBranchNode('legend_story_2003', 'era_builder', { nextWave: 'builder' });
        addLegendStoryScore('dynasty', 2); addLegendStoryScore('nationalIcon', 1);
        addProfileDelta('leadership', 3); addProfileDelta('mediaTrust', 2); addSeasonMod('teamChemistry', 1, -10, 10);
        return '你没有在采访里贬低年轻人。你说每一届都会带来新的问题，而伟大的球员应该学会回答更多问题。<br><br>这句话让媒体开始用另一种方式描述你：不只是 2003 届的一员，而是一个时代的组织者。<br><br>效果：领导力+3，媒体信任+2；下赛季化学反应略升；传奇剧情分数：王朝线+2，全国偶像+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_sophomore_wall',
    branch: 'legend_story_2003_class',
    phase: 'season',
    legendStory: true,
    legendTopic: 'class',
    weight: 78,
    title: '传奇时代：二年级墙',
    scenes: [
      '第二年，对手的球探报告终于不再把你写成“观察对象”。弱侧协防来得更早，挡拆后的第二个人也不再犹豫。',
      '助教把几段录像停在同一个位置，说：他们开始认真准备你了。某种意义上，这也是联盟第一次正式承认你。'
    ],
    body: '二年级墙不是联盟关上的门，而是它第一次真正把你当成需要上锁的人。你要从哪里把锁拆开？',
    requires: function(ctx) {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() === 2 && (ctx.gamesPlayed || 0) >= 10 && !hasLegendStoryFlag('seen_legend_2003_sophomore_wall');
    },
    choices: [
      { label: '增加中距离和背身', hint: '让防守人不能只等你冲筐', apply: function() {
        setLegendStoryFlag('sophomore_midpost', true);
        addLegendStoryScore('craft', 2);
        addAttrDelta('MID', 1); addSeasonMod('formVariance', -1, -10, 10); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你开始在肘区停下来，不再急着冲向篮筐。第一次用背身把防守人顶到身后时，助教没有喊好球，只把那段录像保存了下来。<br><br>效果：中投+1；下赛季状态波动略降；传奇剧情分数：技艺路线+2。';
      }},
      { label: '强化传球阅读', hint: '让包夹付出代价', apply: function() {
        setLegendStoryFlag('sophomore_playmaking', true);
        addLegendStoryScore('dynasty', 1); addLegendStoryScore('lockerRoom', 1);
        addAttrDelta('PAS', 1); addProfileDelta('lockerRoomTrust', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有和包夹硬碰硬，而是开始提前半拍把球送到弱侧。队友们一开始还没准备好，几周之后，他们已经学会在你的视线转过去前站到位置。<br><br>效果：传球+1，更衣室信任+1；传奇剧情分数：王朝线+1，更衣室+1。';
      }},
      { label: '提前增加三分产量', hint: '冒险把比赛拉向未来', apply: function() {
        setLegendStoryFlag('sophomore_three_path', true);
        addLegendStoryScore('historyShift', 1); addLegendStoryScore('mediaHeat', 1);
        addAttrDelta('threePT', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把训练的最后一组投篮挪到三分线外。老派评论员说你离篮筐太远，年轻助教却悄悄把命中分布画成一张热图。<br><br>效果：三分+1；传奇剧情分数：历史偏移+1，媒体热度+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_redraft_table',
    branch: 'legend_story_2003_class',
    phase: 'season',
    legendStory: true,
    legendTopic: 'class',
    weight: 74,
    title: '传奇时代：第三年重排',
    body: '第三年，媒体不再满足于“未来”。他们开始用更残酷的问题切开这一届：如果现在重排 2003 选秀，你会在第几顺位？',
    requires: function(ctx) {
      var p = STATE.career.profile || {};
      return isLegendStoryEnabled() && getLegendStorySeasonNum() === 3 && (ctx.gamesPlayed || 0) >= 20 && !hasLegendStoryFlag('seen_legend_2003_redraft_table') && ((STATE.finalOVR || 0) >= 80 || (p.fame || 0) >= 8);
    },
    choices: [
      { label: '我应该进入最前排讨论', hint: '主动把自己推上历史桌面', apply: function() {
        addLegendStoryScore('classRivalry', 3); addLegendStoryScore('mediaHeat', 2); addLegendStoryScore('individualLegend', 1);
        addProfileDelta('fame', 2); addProfileDelta('controversy', 1);
        return '你没有报具体顺位，只说：如果他们重排，我希望他们认真看完我的比赛再写答案。第二天，节目真的把你的回合剪成了十分钟专题。<br><br>效果：声望+2，争议+1；传奇剧情分数：同届竞争+3，媒体热度+2，个人传奇+1。';
      }},
      { label: '冠军比顺位重要', hint: '把讨论压回球队目标', apply: function() {
        addLegendStoryScore('dynasty', 2); addProfileDelta('leadership', 2); addProfileDelta('mediaTrust', 1);
        return '你笑了一下，说顺位是选秀夜的事，冠军才是职业生涯的事。更衣室里有人把这段采访放了两遍，没人起哄，但训练那天所有人都来得很早。<br><br>效果：领导力+2，媒体信任+1；传奇剧情分数：王朝线+2。';
      }},
      { label: '这届人的故事才刚开始', hint: '保持温和，但让历史继续发酵', apply: function() {
        addLegendStoryScore('mediaTrust', 2); addLegendStoryScore('craft', 1);
        addProfileDelta('mediaTrust', 2); addSeasonMod('mediaPressure', -1, -10, 10);
        return '你说这一届如果真的足够特别，就不该在第三年急着写结论。记者后来承认，这句话比任何狠话都更适合放进十年回看。<br><br>效果：媒体信任+2；下赛季媒体压力略降；传奇剧情分数：媒体信任+2，技艺路线+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_city_profile_echo',
    branch: 'legend_story_2003_city',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'city',
    weight: 64,
    title: '传奇时代：地方报纸的长稿',
    body: '地方报纸想给你做一篇长稿。他们不只问数据，也问你住在哪条街，输球后怎么回家，第一次意识到这座城市认得你是什么时候。',
    requires: function() {
      var p = STATE.career.profile || {};
      return isLegendStoryEnabled() && getLegendStorySeasonNum() >= 2 && getLegendSameTeamSeasons() >= 2 && !hasLegendStoryFlag('seen_legend_2003_city_profile_echo') && ((p.fanSupport || 0) >= 3 || getLegendStoryScore('cityBond') >= 2);
    },
    choices: [
      { label: '讲自己如何融入城市', hint: '城市羁绊提高', apply: function() {
        addLegendStoryScore('cityBond', 3); addProfileDelta('fanSupport', 2); addProfileDelta('loyalty', 1);
        return '那篇报道没有把你写成救世主。它写你训练后一个人坐在替补席，写你输球后绕远路回家，也写你慢慢学会这座城市的名字。<br><br>效果：球迷支持+2，忠诚+1；传奇剧情分数：城市羁绊+3。';
      }},
      { label: '把镜头留给队友和球迷', hint: '更衣室和城市同时受益', apply: function() {
        addLegendStoryScore('lockerRoom', 2); addLegendStoryScore('cityBond', 1);
        addProfileDelta('lockerRoomTrust', 2); addProfileDelta('fanSupport', 1);
        return '你让记者多写替补席和看台。文章出来后，队友们在群里转发了很久，因为他们第一次觉得自己也在这段时代里有名字。<br><br>效果：更衣室信任+2，球迷支持+1；传奇剧情分数：更衣室+2，城市羁绊+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_community_court_echo',
    branch: 'legend_story_2003_city',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'city',
    weight: 56,
    title: '传奇时代：那座社区球馆',
    body: '一座旧社区球馆重新开灯。也许它已经因你的帮助换过地板，也许这只是你第一次认真走进去。无论如何，孩子们记住的不是捐赠数字，而是你真的出现在那里。',
    requires: function() {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() >= 3 && getLegendStoryScore('cityBond') >= 4 && !hasLegendStoryFlag('seen_legend_2003_community_court_echo');
    },
    choices: [
      { label: '每年夏天回来办训练营', hint: '长期城市记忆', apply: function() {
        setLegendStoryFlag('city_summer_camp', true);
        addLegendStoryScore('cityBond', 3); addLegendStoryScore('lockerRoom', 1);
        addProfileDelta('fanSupport', 2); addProfileDelta('legacyBonus', 1);
        return '孩子们问你能不能扣篮，你笑着说，先把左手运球练好。后来他们记住的不是那句玩笑，而是你真的每年夏天都回来。<br><br>效果：球迷支持+2，历史评价+1；传奇剧情分数：城市羁绊+3，更衣室+1。';
      }},
      { label: '低调捐赠不公开', hint: '少一点热度，多一点安静的重量', apply: function() {
        addLegendStoryScore('cityBond', 2); addLegendStoryScore('mediaTrust', 1);
        addProfileDelta('mediaTrust', 2); addProfileDelta('loyalty', 2);
        return '你没有让品牌团队安排镜头。几个月后，有家长在采访里说，孩子们只知道地板变亮了，不知道是谁付的钱。你听完只是笑了笑。<br><br>效果：媒体信任+2，忠诚+2；传奇剧情分数：城市羁绊+2，媒体信任+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_veteran_locker_question',
    branch: 'legend_story_2003_team',
    phase: 'season',
    legendStory: true,
    legendTopic: 'team',
    weight: 66,
    title: '传奇时代：老将的问题',
    body: '训练结束后，一位老将在更衣室里拉住你。他没有质疑你的天赋，只问了一句：你想让大家看见你多强，还是想带我们一起多赢一点？',
    requires: function(ctx) {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() >= 2 && (ctx.gamesPlayed || 0) >= 24 && !hasLegendStoryFlag('seen_legend_2003_veteran_locker_question') && (hasLegendStoryFlag('franchise_core') || hasLegendStoryFlag('franchise_connector'));
    },
    choices: [
      { label: '承认自己还在学习带队', hint: '教练和更衣室更愿意托付你', apply: function() {
        addLegendStoryScore('lockerRoom', 2); addProfileDelta('coachTrust', 2); addProfileDelta('lockerRoomTrust', 1); addProfileDelta('mediaTrust', 1);
        return '你没有急着回答漂亮话，只说自己还在学。老将点点头，把护膝放回柜子，说：那就从明天开始。<br><br>效果：教练信任+2，更衣室信任+1，媒体信任+1；传奇剧情分数：更衣室+2。';
      }},
      { label: '主动请老将监督更衣室', hint: '把责任变成共同秩序', apply: function() {
        addLegendStoryScore('lockerRoom', 3); addLegendStoryScore('dynasty', 1);
        addProfileDelta('lockerRoomTrust', 3); addProfileDelta('leadership', 1);
        return '你请他继续提醒你，也提醒队里的年轻人。那天之后，更衣室里多了一种安静的秩序：你是核心，但不是一个人撑着屋顶。<br><br>效果：更衣室信任+3，领导力+1；传奇剧情分数：更衣室+3，王朝线+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_front_office_window',
    branch: 'legend_story_2003_team',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'team',
    weight: 62,
    title: '传奇时代：管理层的窗口',
    body: '总经理把门关上，说球队愿意围绕你赌一把。但他也把另一句话说得很清楚：如果我们把未来筹码推上桌，你也得告诉我们你会不会一起守住这段窗口。',
    requires: function() {
      return isLegendStoryEnabled() && getLegendStorySeasonNum() >= 3 && !hasLegendStoryFlag('seen_legend_2003_front_office_window') && (STATE.finalOVR || 0) >= 84 && getLegendStoryScore('dynasty') >= 3;
    },
    choices: [
      { label: '承诺留队建队', hint: '城市和王朝线提高', apply: function() {
        setLegendStoryFlag('front_office_commit', true);
        addLegendStoryScore('dynasty', 3); addLegendStoryScore('cityBond', 2);
        addProfileDelta('loyalty', 2); addProfileDelta('fanSupport', 1);
        return '那不是威胁，也不是讨好，更像一个人把未来摊在桌上，小心地问你：我们能不能一起把它守久一点？你点了头。<br><br>效果：忠诚+2，球迷支持+1；传奇剧情分数：王朝线+3，城市羁绊+2。';
      }},
      { label: '要求保留年轻队友', hint: '更衣室稳定，补强节奏更谨慎', apply: function() {
        setLegendStoryFlag('protect_young_core', true);
        addLegendStoryScore('lockerRoom', 2); addLegendStoryScore('dynasty', 1);
        addProfileDelta('lockerRoomTrust', 2); addSeasonMod('teamChemistry', 1, -10, 10);
        return '你没有只问谁会来，也问谁不能走。几个年轻队友后来听说这句话，训练时没有提，却把每个回合都跑得更认真。<br><br>效果：更衣室信任+2，下赛季化学反应略升；传奇剧情分数：更衣室+2，王朝线+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_tv_critic',
    branch: 'legend_story_2003_media',
    phase: 'season',
    legendStory: true,
    legendTopic: 'media',
    weight: 58,
    title: '传奇时代：电视评论员点名',
    body: '赛后你还没洗完澡，电视评论员已经在演播室里说你的打法不适合赢球。更衣室电视没有关，大家都听见了。',
    requires: function(ctx) {
      var p = STATE.career.profile || {};
      return isLegendStoryEnabled() && (ctx.gamesPlayed || 0) >= 20 && !hasLegendStoryFlag('seen_legend_2003_tv_critic') && (getLegendStoryScore('mediaHeat') >= 4 || (p.controversy || 0) >= 3);
    },
    choices: [
      { label: '用下一场比赛回应', hint: '把噪音压回球场', apply: function() {
        addLegendStoryScore('craft', 2); addAttrDelta('CLU', 1); addSeasonMod('mediaPressure', -1, -10, 10); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有回嘴，只在下一场赛前提前两个小时到馆。队友经过时没有打扰你。那晚之后，评论员的剪辑被球迷重新配上了你的关键球。<br><br>效果：关键球+1；下赛季媒体压力略降；传奇剧情分数：技艺路线+2。';
      }},
      { label: '让队友替你说话', hint: '更衣室站到你身边', apply: function() {
        addLegendStoryScore('lockerRoom', 2); addProfileDelta('lockerRoomTrust', 2); addProfileDelta('mediaTrust', 1);
        return '你还没说话，替补席末端有人轻轻骂了一句：他根本没看我们训练。第二天采访里，队友们一个接一个把话题接了过去。<br><br>效果：更衣室信任+2，媒体信任+1；传奇剧情分数：更衣室+2。';
      }}
    ]
  },
  {
    id: 'legend_2003_forum_war',
    branch: 'legend_story_2003_media',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'media',
    weight: 54,
    title: '传奇时代：论坛里的球迷战争',
    body: '球迷论坛开始用一整页数据比较你和同届球星。有人截你的失误，有人贴你的绝杀，有人把所有争论做成签名图。',
    requires: function() {
      return isLegendStoryEnabled() && getLegendStoryYear() >= 2007 && !hasLegendStoryFlag('seen_legend_2003_forum_war') && (getLegendStoryScore('classRivalry') >= 4 || getLegendStoryScore('mediaHeat') >= 4);
    },
    choices: [
      { label: '完全不看论坛', hint: '保持内心安静', apply: function() {
        addLegendStoryScore('craft', 2); addSeasonMod('formVariance', -1, -10, 10);
        return '你让经纪人别再把帖子转给你。吵到最后，那些人甚至翻出你新秀年的笨拙回合，说：你看，他就是这么一点点长出来的。<br><br>效果：下赛季状态波动略降；传奇剧情分数：技艺路线+2。';
      }},
      { label: '让团队整理舆论', hint: '把噪音变成职业信息', apply: function() {
        addLegendStoryScore('mediaTrust', 1); addProfileDelta('businessValue', 1); addProfileDelta('mediaTrust', 1);
        return '经纪团队每周给你一页摘要。你没有被每句话牵着走，却开始知道外界真正误解你的地方。后来你的采访变得更清楚，也更少被断章取义。<br><br>效果：商业价值+1，媒体信任+1；传奇剧情分数：媒体信任+1。';
      }}
    ]
  },
  {
    id: 'legend_2003_analytics_rise',
    branch: 'legend_story_2003_media',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'media',
    weight: 60,
    title: '传奇时代：数据分析开始抬头',
    body: '一个年轻助教给你看了一张投篮热图。他说未来的联盟会重新定义好出手。你盯着那些颜色，第一次意识到时代不只会变老，也会变聪明。',
    requires: function() {
      return isLegendStoryEnabled() && getLegendStoryYear() >= 2012 && !hasLegendStoryFlag('seen_legend_2003_analytics_rise');
    },
    choices: [
      { label: '接受空间化训练', hint: '提前适应新联盟', apply: function() {
        setLegendStoryFlag('analytics_rise_seen', true);
        addLegendStoryScore('historyShift', 2); addAttrDelta('threePT', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把几个旧甜点位让出来，开始练更远的接球投。这个改变一开始不舒服，但你知道真正难的，是时代变聪明时，你仍然愿意学习。<br><br>效果：三分+1；传奇剧情分数：历史偏移+2。';
      }},
      { label: '把数据和录像结合', hint: '不被数字绑架，也不拒绝未来', apply: function() {
        setLegendStoryFlag('analytics_rise_seen', true);
        addLegendStoryScore('craft', 2); addLegendStoryScore('historyShift', 1);
        addAttrDelta('PAS', 1); addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有把热图当圣经，而是把它和录像放在一起看。数字告诉你哪里值得去，录像提醒你为什么能去。<br><br>效果：传球+1，关键球+1；传奇剧情分数：技艺路线+2，历史偏移+1。';
      }}
    ]
  }
];

const LEGEND_STORY_1984_EVENTS = [
  {
    id: 'legend_1984_arrival_newspaper',
    branch: 'legend_story_1984',
    phase: 'season',
    legendStory: true,
    legendTopic: 'arrival',
    weight: 85,
    title: '传奇时代：报纸上的小栏',
    scenes: [
      '新秀赛季的第一周，地方报纸把你的名字放在体育版角落。标题很短，旁边是一张有些发糊的黑白照片。',
      '更衣室里有人把报纸折好放到你柜子前，说：别嫌小，能被写上去，说明他们开始看见你了。'
    ],
    body: '1984 的联盟没有每天刷新的热搜。很多认可来得慢，像报纸油墨一样，要等一晚才干。你要怎么面对这份迟到的注视？',
    requires: function(ctx) {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1984' && getLegendStorySeasonNum() === 1 && (ctx.gamesPlayed || 0) >= 2 && !hasLegendStoryFlag('seen_legend_1984_arrival_newspaper');
    },
    choices: [
      { label: '把报纸剪下来贴进柜子', hint: '城市羁绊和技艺路线提高', apply: function() {
        setBranchNode('legend_story_1984', 'newspaper_kept', { era: '1984' });
        addLegendStoryScore('cityBond', 2); addLegendStoryScore('craft', 1); addLegendStoryScore('oldSchoolRespect', 1);
        addProfileDelta('fanSupport', 1); addProfileDelta('loyalty', 1);
        return '你把那一小块报道剪下来，贴在柜门内侧。它不像奖杯，却像一个提醒：在这个年代，被看见本身就需要时间。<br><br>效果：球迷支持+1，忠诚+1；传奇剧情分数：城市羁绊+2，技艺路线+1，老派认可+1。';
      }},
      { label: '告诉记者我会让版面变大', hint: '声望提高，但压力上升', apply: function() {
        setBranchNode('legend_story_1984', 'newspaper_claim', { era: '1984' });
        addLegendStoryScore('mediaHeat', 2); addLegendStoryScore('individualLegend', 1);
        addProfileDelta('fame', 2); addSeasonMod('mediaPressure', 1, -10, 10);
        return '你没有夸张，只说希望有一天这座城市会给你留出更大的版面。第二天报纸没有立刻回应，但那位记者开始每场都来。<br><br>效果：人气+2；媒体压力略升；传奇剧情分数：媒体热度+2，个人传奇+1。';
      }}
    ]
  },
  {
    id: 'legend_1984_rookie_hard_foul',
    branch: 'legend_story_1984',
    phase: 'season',
    legendStory: true,
    legendTopic: 'pressure',
    weight: 80,
    title: '传奇时代：第一次硬犯规',
    body: '一次快攻里，对手没有让你轻松上篮。你摔到地板上，耳边是客场球迷的吼声。老队友伸手拉你，只说了一句：欢迎来到这个联盟。',
    requires: function(ctx) {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1984' && getLegendStorySeasonNum() === 1 && (ctx.gamesPlayed || 0) >= 12 && !hasLegendStoryFlag('seen_legend_1984_rookie_hard_foul');
    },
    choices: [
      { label: '站起来，下一回合继续冲筐', hint: '关键球和老派认可提高', apply: function() {
        addLegendStoryScore('oldSchoolRespect', 3); addLegendStoryScore('craft', 1);
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有拍掉身上的灰，只是把球要回来。下一回合你又冲进去，动作不漂亮，但替补席全站了起来。<br><br>效果：关键球+1；传奇剧情分数：老派认可+3，技艺路线+1。';
      }},
      { label: '用传球惩罚他们的收缩', hint: '球队关系提高', apply: function() {
        addLegendStoryScore('lockerRoom', 2); addLegendStoryScore('craft', 1);
        addAttrDelta('PAS', 1); addProfileDelta('lockerRoomTrust', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有硬撞第二次，而是在包夹来之前把球塞到底角。老队友投进后指了指你。那不是安慰，是认可。<br><br>效果：传球+1，更衣室信任+1；传奇剧情分数：更衣室+2，技艺路线+1。';
      }}
    ]
  },
  {
    id: 'legend_1984_veteran_bus',
    branch: 'legend_story_1984_team',
    phase: 'season',
    legendStory: true,
    legendTopic: 'team',
    weight: 72,
    title: '传奇时代：客场大巴最后一排',
    body: '客场背靠背之后，球队大巴安静得只剩发动机声。一个老将把你叫到最后一排，给你讲这个联盟的规矩：不要每晚都证明自己，先学会每晚都准备好。',
    requires: function(ctx) {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1984' && getLegendStorySeasonNum() >= 1 && (ctx.gamesPlayed || 0) >= 24 && !hasLegendStoryFlag('seen_legend_1984_veteran_bus');
    },
    choices: [
      { label: '听完，然后第二天第一个到馆', hint: '训练馆标杆路线', apply: function() {
        addLegendStoryScore('craft', 3); addLegendStoryScore('oldSchoolRespect', 2); addSeasonMod('formVariance', -1, -10, 10);
        return '第二天清晨，球馆管理员看见你已经在投篮。老将没有夸你，只把自己的热身位置让出半步。<br><br>效果：下赛季状态波动略降；传奇剧情分数：技艺路线+3，老派认可+2。';
      }},
      { label: '请他继续提醒我', hint: '更衣室关系提高', apply: function() {
        addLegendStoryScore('lockerRoom', 3); addLegendStoryScore('oldSchoolRespect', 1);
        addProfileDelta('lockerRoomTrust', 2);
        return '你说：如果我哪天忘了，请你直接告诉我。老将看了你一会儿，点点头。后来队里很多规矩，就是从这个点头开始传下去的。<br><br>效果：更衣室信任+2；传奇剧情分数：更衣室+3，老派认可+1。';
      }}
    ]
  },
  {
    id: 'legend_1984_tv_first_closeup',
    branch: 'legend_story_1984_media',
    phase: 'season',
    legendStory: true,
    legendTopic: 'media',
    weight: 62,
    title: '传奇时代：第一次全国转播特写',
    body: '全国转播的镜头第一次长时间停在你脸上。解说员不确定该怎么称呼你，只说：这个年轻人正在让比赛慢下来。',
    requires: function(ctx) {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1984' && getLegendStorySeasonNum() >= 2 && (ctx.gamesPlayed || 0) >= 18 && !hasLegendStoryFlag('seen_legend_1984_tv_first_closeup') && ((STATE.finalOVR || 0) >= 80 || getLegendStoryScore('oldSchoolRespect') >= 3);
    },
    choices: [
      { label: '赛后感谢球队和城市', hint: '城市关系更稳', apply: function() {
        addLegendStoryScore('cityBond', 2); addLegendStoryScore('mediaTrust', 1);
        addProfileDelta('fanSupport', 2); addProfileDelta('mediaTrust', 1);
        return '你没有把镜头据为己有。你提到训练师、替补席和那些一直买票的人。第二天，地方电台说：他懂这座城市。<br><br>效果：球迷支持+2，媒体信任+1；传奇剧情分数：城市羁绊+2，媒体信任+1。';
      }},
      { label: '少说话，让比赛继续说', hint: '技艺路线更强', apply: function() {
        addLegendStoryScore('craft', 2); addLegendStoryScore('mediaTrust', 1);
        addSeasonMod('mediaPressure', -1, -10, 10);
        return '你只回答了几个短句。那晚的集锦在电视台重播了很多次，人们发现你不需要太多话，动作本身就有重量。<br><br>效果：下赛季媒体压力略降；传奇剧情分数：技艺路线+2，媒体信任+1。';
      }}
    ]
  },
  {
    id: 'legend_1984_playoff_halfcourt',
    branch: 'legend_story_1984_playoff',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'playoff',
    weight: 68,
    title: '传奇时代：半场阵地的答案',
    body: '季后赛或者季后赛边缘的夜晚之后，教练把录像停在半场阵地。这个年代没有那么多轻松回合，到了五月，每一次接球都像要从人群里凿出来。',
    requires: function() {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1984' && getLegendStorySeasonNum() >= 2 && !hasLegendStoryFlag('seen_legend_1984_playoff_halfcourt') && getConferenceSeed(STATE.careerTeam) <= 8;
    },
    choices: [
      { label: '打磨低位和中距离', hint: '老派季后赛技能', apply: function() {
        addLegendStoryScore('craft', 3); addLegendStoryScore('playoffMyth', 1);
        addAttrDelta('MID', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你开始反复练那些不会出现在海报上的动作：卡位、转身、停顿、再出手。教练说，这些球在五月最值钱。<br><br>效果：中投+1；传奇剧情分数：技艺路线+3，季后赛神话+1。';
      }},
      { label: '把每次夹击变成队友机会', hint: '球队季后赛路线', apply: function() {
        addLegendStoryScore('dynasty', 2); addLegendStoryScore('lockerRoom', 2);
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把录像倒回去，一次次问队友：如果他们从这里来，你会站在哪？到最后，战术板上不只是你的名字。<br><br>效果：传球+1；传奇剧情分数：王朝线+2，更衣室+2。';
      }}
    ]
  },
  {
    id: 'legend_1984_old_clipping',
    branch: 'legend_story_1984_legacy',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'legacy',
    weight: 50,
    title: '传奇时代：旧剪报',
    body: '一个球迷寄来一封信，里面夹着你新秀年那篇小报道。纸已经发黄，边角很软。信里写：我们不是从你成名才开始看的。',
    requires: function() {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1984' && getLegendStorySeasonNum() >= 4 && !hasLegendStoryFlag('seen_legend_1984_old_clipping') && getLegendStoryScore('cityBond') >= 2;
    },
    choices: [
      { label: '回信感谢那位球迷', hint: '城市记忆提高', apply: function() {
        addLegendStoryScore('cityBond', 3); addLegendStoryScore('historyShift', 1);
        addProfileDelta('fanSupport', 2); addProfileDelta('legacyBonus', 1);
        return '你亲手写了一封回信。后来那位球迷把信裱起来，说那不是球星签名，是一段共同看球的年月。<br><br>效果：球迷支持+2，历史评价+1；传奇剧情分数：城市羁绊+3，历史偏移+1。';
      }},
      { label: '把剪报带回训练馆', hint: '把初心交给队友', apply: function() {
        addLegendStoryScore('lockerRoom', 2); addLegendStoryScore('craft', 2);
        addProfileDelta('leadership', 1);
        return '你把剪报贴在训练馆门口。年轻队友路过时笑你怀旧，但下一次训练，他们都来得早了一点。<br><br>效果：领导力+1；传奇剧情分数：更衣室+2，技艺路线+2。';
      }}
    ]
  }
];

const LEGEND_STORY_1996_EVENTS = [
  {
    id: 'legend_1996_arrival_flashbulbs',
    branch: 'legend_story_1996',
    phase: 'season',
    legendStory: true,
    legendTopic: 'arrival',
    weight: 85,
    title: '传奇时代：闪光灯里的新秀',
    scenes: [
      '选秀夜结束后，镁光灯没有立刻散去。这个年代开始相信年轻人可以一夜之间成为海报，也可以一夜之间背上太多期待。',
      '你走进训练馆时，墙上贴着联盟新一代的宣传照。有人说这是黄金一代，也有人说这只是商业机器的新燃料。'
    ],
    body: '1996 的问题来得很早：你想先成为球员，还是先成为名字？',
    requires: function(ctx) {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1996' && getLegendStorySeasonNum() === 1 && (ctx.gamesPlayed || 0) >= 2 && !hasLegendStoryFlag('seen_legend_1996_arrival_flashbulbs');
    },
    choices: [
      { label: '先把训练做好', hint: '降低压力，提升技艺路线', apply: function() {
        setBranchNode('legend_story_1996', 'craft_first', { era: '1996' });
        addLegendStoryScore('craft', 3); addLegendStoryScore('mediaTrust', 1);
        addSeasonMod('mediaPressure', -1, -10, 10);
        return '你把发布会问题留在身后，第二天照常第一个到训练馆。闪光灯会熄，投篮动作不会替你说谎。<br><br>效果：下赛季媒体压力略降；传奇剧情分数：技艺路线+3，媒体信任+1。';
      }},
      { label: '承认自己想站上时代封面', hint: '声望和商业拉力提高', apply: function() {
        setBranchNode('legend_story_1996', 'cover_claim', { era: '1996' });
        addLegendStoryScore('commercialPull', 2); addLegendStoryScore('nextFacePressure', 2);
        addProfileDelta('fame', 2); addProfileDelta('businessValue', 1); addSeasonMod('mediaPressure', 1, -10, 10);
        return '你说自己不怕封面，也不怕被比较。第二天，杂志编辑把你的名字放进了下一期选题会。<br><br>效果：人气+2，商业价值+1，媒体压力略升；传奇剧情分数：商业拉力+2，接班压力+2。';
      }}
    ]
  },
  {
    id: 'legend_1996_shoe_meeting',
    branch: 'legend_story_1996_brand',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'brand',
    weight: 78,
    title: '传奇时代：第一盒彩色球鞋样品',
    body: '品牌代表把一盒彩色球鞋样品推到你面前。鞋盒里有你的号码，也有一句很轻的提醒：年轻球员正在变成市场。',
    requires: function() {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1996' && getLegendStorySeasonNum() <= 3 && !hasLegendStoryFlag('seen_legend_1996_shoe_meeting') && ((STATE.finalOVR || 0) >= 78 || ((STATE.career.profile && STATE.career.profile.fame) || 0) >= 4);
    },
    choices: [
      { label: '签，但要求广告拍真实训练', hint: '商业和技艺兼顾', apply: function() {
        addLegendStoryScore('commercialPull', 2); addLegendStoryScore('craft', 2);
        addProfileDelta('businessValue', 2); addProfileDelta('mediaTrust', 1);
        return '你同意合作，但拒绝只拍跑车和灯牌。广告最后剪进了你凌晨投篮的背影，很多孩子第一次知道，酷也可以是汗水。<br><br>效果：商业价值+2，媒体信任+1；传奇剧情分数：商业拉力+2，技艺路线+2。';
      }},
      { label: '暂缓，把重点留给比赛', hint: '压力下降，忠诚提高', apply: function() {
        addLegendStoryScore('craft', 2); addLegendStoryScore('mediaTrust', 1);
        addProfileDelta('loyalty', 1); addSeasonMod('mediaPressure', -1, -10, 10);
        return '你把鞋盒推回去，说自己还没有准备好让标志走在比赛前面。品牌代表有点意外，但教练组松了一口气。<br><br>效果：忠诚+1，媒体压力略降；传奇剧情分数：技艺路线+2，媒体信任+1。';
      }}
    ]
  },
  {
    id: 'legend_1996_next_face_pressure',
    branch: 'legend_story_1996_media',
    phase: 'season',
    legendStory: true,
    legendTopic: 'media',
    weight: 78,
    title: '传奇时代：接班人的问题',
    body: '赛后采访里，记者终于问出那个所有人都想问的问题：你觉得自己会成为联盟下一个门面吗？更衣室门半开着，队友们都听见了。',
    requires: function(ctx) {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1996' && getLegendStorySeasonNum() >= 1 && (ctx.gamesPlayed || 0) >= 18 && !hasLegendStoryFlag('seen_legend_1996_next_face_pressure') && ((STATE.finalOVR || 0) >= 80 || getLegendStoryScore('commercialPull') >= 2);
    },
    choices: [
      { label: '说我只想成为这支球队的答案', hint: '球队关系提高', apply: function() {
        addLegendStoryScore('lockerRoom', 3); addLegendStoryScore('dynasty', 1);
        addProfileDelta('leadership', 1); addProfileDelta('lockerRoomTrust', 2);
        return '你没有接过“门面”这个词，只说更衣室里还有很多人等着赢球。队友们没有鼓掌，但有人把毛巾扔给你，笑着说：这答案还行。<br><br>效果：领导力+1，更衣室信任+2；传奇剧情分数：更衣室+3，王朝线+1。';
      }},
      { label: '说如果时代需要，我不会躲', hint: '声望提高，接班压力提高', apply: function() {
        addLegendStoryScore('nextFacePressure', 3); addLegendStoryScore('mediaHeat', 2);
        addProfileDelta('fame', 3); addSeasonMod('mediaPressure', 1, -10, 10);
        return '你没有低头，也没有笑场。你说如果时代真的把问题放到你面前，你不会躲。第二天，这句话被印在了体育版头条。<br><br>效果：人气+3，媒体压力略升；传奇剧情分数：接班压力+3，媒体热度+2。';
      }}
    ]
  },
  {
    id: 'legend_1996_class_rival_walkway',
    branch: 'legend_story_1996_class',
    phase: 'season',
    legendStory: true,
    legendTopic: 'class',
    weight: 72,
    title: '传奇时代：球员通道里的同代人',
    body: '客场赛前，你在球员通道里遇见另一位同代年轻球星。没有镜头，没有采访，只有两个人短短点头。你们都知道，未来几年会被反复放在同一张表里。',
    requires: function(ctx) {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1996' && getLegendStorySeasonNum() >= 2 && (ctx.gamesPlayed || 0) >= 14 && !hasLegendStoryFlag('seen_legend_1996_class_rival_walkway');
    },
    choices: [
      { label: '把竞争说出口', hint: '同代竞争提高', apply: function() {
        addLegendStoryScore('classRivalry', 3); addLegendStoryScore('nextFacePressure', 1);
        addProfileDelta('fame', 1);
        return '你说：我们会见很多次。他笑了笑，说：希望都是大场面。那一刻没有火药味，却像有人把未来几年轻轻点燃。<br><br>效果：人气+1；传奇剧情分数：同代竞争+3，接班压力+1。';
      }},
      { label: '只点头，把话留给比赛', hint: '温和但有重量', apply: function() {
        addLegendStoryScore('craft', 2); addLegendStoryScore('classRivalry', 1);
        addProfileDelta('mediaTrust', 1);
        return '你们只是点头。后来电视台把这个镜头截出来，说最好的竞争有时不需要台词，只需要几年好比赛。<br><br>效果：媒体信任+1；传奇剧情分数：技艺路线+2，同代竞争+1。';
      }}
    ]
  },
  {
    id: 'legend_1996_playoff_spotlight',
    branch: 'legend_story_1996_playoff',
    phase: 'season',
    legendStory: true,
    legendTopic: 'playoff',
    weight: 66,
    title: '传奇时代：聚光灯下的四月',
    body: '常规赛进入最后阶段，转播方开始提前包装季后赛。宣传片里有你的背影，也有一句旁白：年轻人能不能在四月留下来？',
    requires: function(ctx) {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1996' && getLegendStorySeasonNum() >= 2 && (ctx.gamesPlayed || 0) >= 50 && !hasLegendStoryFlag('seen_legend_1996_playoff_spotlight') && getConferenceSeed(STATE.careerTeam) <= 10;
    },
    choices: [
      { label: '把压力转成更衣室目标', hint: '季后赛和球队线提高', apply: function() {
        addLegendStoryScore('playoffMyth', 2); addLegendStoryScore('lockerRoom', 2);
        addProfileDelta('leadership', 1); addSeasonMod('teamChemistry', 1, -10, 10);
        return '你没有让宣传片在更衣室循环播放，只在白板上写下下一场对手。队友们知道，这比口号更像你的方式。<br><br>效果：领导力+1，球队默契略升；传奇剧情分数：季后赛神话+2，更衣室+2。';
      }},
      { label: '接受大场面，把自己推上去', hint: '个人传奇和媒体热度提高', apply: function() {
        addLegendStoryScore('playoffMyth', 2); addLegendStoryScore('mediaHeat', 2);
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有回避镜头。训练结束后你加练了最后一球，因为你知道聚光灯不会替你投进它。<br><br>效果：关键球+1；传奇剧情分数：季后赛神话+2，媒体热度+2。';
      }}
    ]
  },
  {
    id: 'legend_1996_billboard_or_locker',
    branch: 'legend_story_1996_legacy',
    phase: 'offseason',
    slot: 'main',
    legendStory: true,
    legendTopic: 'legacy',
    weight: 56,
    title: '传奇时代：广告牌和更衣室',
    body: '休赛期，城市中心挂起了你的广告牌。与此同时，训练馆里一个年轻队友问你：成名之后，还会不会记得我们这些一起练球的人？',
    requires: function() {
      return isLegendStoryEnabled() && String(STATE.eraStart) === '1996' && getLegendStorySeasonNum() >= 3 && !hasLegendStoryFlag('seen_legend_1996_billboard_or_locker') && (getLegendStoryScore('commercialPull') >= 2 || ((STATE.career.profile && STATE.career.profile.fame) || 0) >= 8);
    },
    choices: [
      { label: '带全队一起出现在广告里', hint: '商业不脱离球队', apply: function() {
        addLegendStoryScore('lockerRoom', 2); addLegendStoryScore('commercialPull', 1);
        addProfileDelta('lockerRoomTrust', 2); addProfileDelta('businessValue', 1);
        return '广告最终不是你一个人站在城市上空，而是全队挤在一间旧训练馆里。年轻队友笑得很僵，却把那张海报留了很多年。<br><br>效果：更衣室信任+2，商业价值+1；传奇剧情分数：更衣室+2，商业拉力+1。';
      }},
      { label: '把广告收益投入青训球馆', hint: '城市和历史评价提高', apply: function() {
        addLegendStoryScore('cityBond', 2); addLegendStoryScore('historyShift', 1);
        addProfileDelta('fanSupport', 2); addProfileDelta('legacyBonus', 1);
        return '你没有解释太多，只让一座青训球馆重新开灯。几年后，有孩子指着墙上的旧广告说：我就是从那年开始打球的。<br><br>效果：球迷支持+2，历史评价+1；传奇剧情分数：城市羁绊+2，历史偏移+1。';
      }}
    ]
  }
];

var LEGEND_ERA_STORY_PACKS = {
  '1984': { era: '1984', events: LEGEND_STORY_1984_EVENTS },
  '1996': { era: '1996', events: LEGEND_STORY_1996_EVENTS },
  '2003': { era: '2003', events: LEGEND_STORY_EVENTS }
};

// ==================== 传奇年鉴（休赛期报告） ====================
// 注意：休赛期弹窗时 seasonCount 已自增；年鉴年份应对「刚打完的那个赛季」。

var LEGEND_YEARBOOK_TAG_LABELS = {
  class: '同届',
  city: '城市',
  team: '球队',
  media: '媒体',
  craft: '技艺',
  superteam: '超级球队'
};

function pickTopLegendYearbookTags(scores, maxCount) {
  var rows = [
    { tag: 'class', value: scores.classRivalry || 0 },
    { tag: 'city', value: scores.cityBond || 0 },
    { tag: 'team', value: Math.max(scores.dynasty || 0, scores.lockerRoom || 0) },
    { tag: 'media', value: Math.max(scores.mediaHeat || 0, scores.mediaTrust || 0) },
    { tag: 'craft', value: Math.max(scores.craft || 0, scores.historyShift || 0) },
    { tag: 'superteam', value: scores.superteam || 0 }
  ].filter(function(x) { return x.value > 0; });
  rows.sort(function(a, b) { return b.value - a.value; });
  var tags = rows.slice(0, maxCount || 2).map(function(x) { return x.tag; });
  return tags.length ? tags : ['class'];
}

function buildLegendYearbookText(tags, year, era) {
  var key = (tags || []).slice().sort().join('+');
  era = String(era || (STATE && STATE.eraStart) || '2003');
  if (era === '1984') {
    var templates84 = {
      'city+craft': { headline: '旧报纸开始认真写你', text: '这一年，城市记住你的方式仍然很慢。报纸、客场大巴、训练馆灯光和那些硬碰硬的回合，一点点把你的名字压进这个年代。' },
      'craft+team': { headline: '球队相信那些不漂亮的动作', text: '你把答案放在卡位、停顿、传球和中距离里。这个年代不奖励轻松，但它会记住真正每天准备好的人。' },
      'media+team': { headline: '全国镜头第一次停得更久', text: '转播镜头开始学会寻找你，而更衣室也开始学会信任你。你的声音不大，却在队里慢慢有了重量。' },
      'city+team': { headline: '城市和更衣室一起认出你', text: '这一年，球迷不只是看见你得分，也看见你怎样被队友拉起，怎样把一场普通比赛打成可以保存的记忆。' }
    };
    var picked84 = templates84[key] || null;
    if (!picked84 && tags.indexOf('city') >= 0) picked84 = { headline: '城市把小栏写成长稿', text: '从体育版角落到更长的报道，这座城市没有突然拥抱你，却一步一步把你当成自己人。' };
    else if (!picked84 && tags.indexOf('team') >= 0) picked84 = { headline: '更衣室给你留出位置', text: '老将没有说太多漂亮话，但他们开始在关键回合看向你。那是这个年代更可靠的认可。' };
    else if (!picked84 && tags.indexOf('craft') >= 0) picked84 = { headline: '训练馆保存老派答案', text: '有些进步不会上头版，却会在五月的半场阵地里显形。你正在把这些东西练进身体。' };
    else if (!picked84) picked84 = { headline: '1984 时代继续往前走', text: '这一年没有喧闹的结论，只有更硬的对抗、更慢的认可，和一个正在被这座联盟认真记住的名字。' };
    return { headline: year + ' 年鉴：' + picked84.headline, text: picked84.text };
  }
  if (era === '1996') {
    var templates96 = {
      'class+media': { headline: '黄金一代的讨论继续升温', text: '这一年，关于年轻球星的比较越来越多。不同的是，你不再只是名单里被带过的名字，而是聚光灯愿意停下来的理由。' },
      'craft+team': { headline: '广告牌外还有训练馆', text: '外面的世界想给你贴上标签，训练馆却还在用最诚实的方式记录你。队友们知道，你没有被灯光带走。' },
      'city+team': { headline: '城市看见广告牌背后的人', text: '球迷当然会看见海报和球鞋，但他们也看见你怎样对待队友、训练和那些普通夜晚。成名没有把你从这里带走。' },
      'media+team': { headline: '接班人的问题没有吞掉球队', text: '媒体想让你一个人回答时代，球队却在你身后慢慢站稳。你开始明白，门面不是独自发光，而是让更多人相信。' }
    };
    var picked96 = templates96[key] || null;
    if (!picked96 && tags.indexOf('media') >= 0) picked96 = { headline: '聚光灯学会追着你走', text: '这个年代的声音更亮，也更急。你没有完全躲开它，而是在每一次采访后把自己带回球场。' };
    else if (!picked96 && tags.indexOf('team') >= 0) picked96 = { headline: '更衣室抵住了外面的热度', text: '当商业和比较涌进来时，更衣室成了你保住自己的地方。那些队友的玩笑，有时比头条更重要。' };
    else if (!picked96 && tags.indexOf('craft') >= 0) picked96 = { headline: '技术让封面有了底气', text: '封面可以很快印出来，动作却只能一遍遍磨。你正在让后者撑住前者。' };
    else if (!picked96) picked96 = { headline: '1996 时代继续往前走', text: '这一年，年轻、商业、期待和比赛挤在一起。你还在学习怎样被看见，也怎样不被看见吞没。' };
    return { headline: year + ' 年鉴：' + picked96.headline, text: picked96.text };
  }
  var templates = {
    'class+team': { headline: '联盟开始绕不开你的名字', text: '这一年，联盟开始不再只问你是不是 2003 届的一员。它开始问另一个问题：这支球队为什么越来越像你的球队。' },
    'city+craft': { headline: '城市用更慢的方式记住你', text: '城市记住你的方式变慢了：不是一场高分，而是每个夏天训练馆还亮着的灯。你的比赛也在变慢，慢到足够看清每一次选择。' },
    'media+superteam': { headline: '争议让夏天有了重量', text: '报纸和电视台都在讨论同一件事：球星之间的距离是不是被你们重新写短了。争议没有散去，但它让这个夏天有了重量。' },
    'craft+team': { headline: '球队开始相信重复的力量', text: '这个夏天没有太多漂亮标题，更多是录像室、力量房和训练馆里反复出现的脚步声。球队正在学会一件事：稳定也可以成为野心。' },
    'class+media': { headline: '白金一代的讨论继续升温', text: '关于 2003 届的比较还在继续。不同的是，媒体不再只是把你放进名单末尾，他们开始认真讨论：这一届的故事为什么总会绕回你。' },
    'city+team': { headline: '球队和城市站在同一侧', text: '这一年，球队的耐心和城市的感情慢慢合到一起。球迷不只是期待你赢，也开始在那些普通夜晚里认出你的认真。' }
  };
  var picked = templates[key] || null;
  if (!picked && tags.indexOf('superteam') >= 0) picked = { headline: '联盟重新计算球星距离', text: '球星之间的电话、传闻和选择，让这个夏天变得不再安静。人们未必喜欢这种变化，却都知道它可能会改写争冠的方向。' };
  else if (!picked && tags.indexOf('city') >= 0) picked = { headline: '城市把名字写得更长', text: '地方报纸开始用更长的篇幅写你。它们写比赛，也写你怎样走进这座城市，怎样让一件球衣慢慢有了家的意思。' };
  else if (!picked && tags.indexOf('team') >= 0) picked = { headline: '球队窗口正在形成', text: '管理层、教练组和更衣室都在靠近同一个问题：这支球队能不能把你的巅峰变成一段真正的窗口。' };
  else if (!picked && tags.indexOf('media') >= 0) picked = { headline: '媒体开始给你留位置', text: '电视台、专栏和电台节目都在寻找描述你的方式。声音有时刺耳，但它们共同说明一件事：这个时代已经不能轻易跳过你。' };
  else if (!picked && tags.indexOf('craft') >= 0) picked = { headline: '训练馆替你保存答案', text: '当外界忙着给生涯下定义时，你把答案放回训练馆。那些重复没有立刻变成标题，却会在未来某个夜晚变成历史证词。' };
  else if (!picked) picked = { headline: '2003 时代继续往前走', text: '这一年没有给出最终答案，却留下了足够多的线索。你的名字还在这个时代里移动，等待下一场比赛把它写得更清楚。' };
  return { headline: year + ' 年鉴：' + picked.headline, text: picked.text };
}

/** 刚打完赛季的年份（休赛期 seasonCount 已自增） */
function getLegendYearbookCompletedYear() {
  var start = parseInt(STATE.eraStart, 10) || 2003;
  var completed = Math.max(1, (STATE.career && STATE.career.seasonCount) || 1);
  return start + completed - 1;
}

function buildLegendYearbookEntry() {
  if (typeof isLegendStoryEnabled !== 'function' || !isLegendStoryEnabled()) return null;
  if (!STATE.career) return null;
  var st = getLegendStoryState();
  st.yearbook = st.yearbook || [];
  var seasonNum = STATE.career.seasonCount || 0;
  if (seasonNum < 1) return null;
  var existing = st.yearbook.filter(function(x) { return x && x.seasonNum === seasonNum; })[0];
  if (existing) return existing;
  var year = getLegendYearbookCompletedYear();
  var tags = pickTopLegendYearbookTags(st.scores || {}, 2);
  var copy = buildLegendYearbookText(tags, year, st.era || STATE.eraStart);
  var entry = {
    seasonNum: seasonNum,
    year: year,
    era: String(st.era || STATE.eraStart || ''),
    headline: copy.headline,
    text: copy.text,
    tags: tags
  };
  st.yearbook.push(entry);
  return entry;
}

function renderLegendYearbookHtml() {
  var entry = typeof buildLegendYearbookEntry === 'function' ? buildLegendYearbookEntry() : null;
  if (!entry) return '';
  var sanitize = (typeof sanitizePlayerFacingText === 'function') ? sanitizePlayerFacingText : function(t) { return t || ''; };
  var tagsHtml = (entry.tags || []).map(function(t) {
    var label = LEGEND_YEARBOOK_TAG_LABELS[t] || t;
    return '<span style="display:inline-block;padding:2px 8px;margin:0 4px 0 0;border-radius:999px;background:var(--orange-dim);color:var(--orange);font-size:10px;font-weight:700;">' + label + '</span>';
  }).join('');
  return '<div style="background:linear-gradient(135deg,var(--bg-card),var(--orange-bg));border:1.5px solid var(--orange);border-radius:10px;padding:12px;margin:0 0 4px;">'
    + '<div style="font-family:var(--font-display);font-size:13px;font-weight:700;color:var(--orange);margin-bottom:6px;line-height:1.4;">📜 ' + sanitize(entry.headline) + '</div>'
    + (tagsHtml ? '<div style="margin-bottom:6px;">' + tagsHtml + '</div>' : '')
    + '<div style="font-size:12px;color:var(--text-dim);line-height:1.65;">' + sanitize(entry.text) + '</div>'
    + '</div>';
}

