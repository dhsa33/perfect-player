(function () {
  'use strict';

  // Every row below is a standalone incident. Do not rebuild this file from a
  // topic x context matrix: that made nominally different IDs feel identical.
  // Fields: id, title, scene, first decision, second decision, effect family.
  var catalog = [
    ['broken_clock','计时器误响','决胜回合的进攻计时器提前响起，裁判准备按原判继续比赛。','要求查看回放','让全队立刻回防','lead'],
    ['wrong_scout','球探报告拿错','赛前会议发下来的报告属于另一支球队，而真正对手已经开始热身。','现场重做重点','沿用熟悉原则','coach'],
    ['zone_surprise','突然联防','对手整季没用过联防，今晚却从第一回合就把禁区封死。','主动站上罚球线','把节奏交给控卫','skill'],
    ['decoy_assignment','诱饵任务','球队连胜期间，教练要你整节只做牵制，让状态火热的队友接管出手。','接受无球诱饵','申请保留终结回合','team','streak'],
    ['last_foul','最后一次犯规','你只剩一次犯规，对方核心正不断点名攻击你。','继续贴身防守','主动请求换防','risk'],
    ['wet_floor','底线积水','场边饮料洒进底线区域，工作人员坚持已经擦干。','要求暂停复查','提醒队友后继续','risk'],
    ['silent_signal','手势被识破','对手替补席已经能读懂你们的边线球手势。','临场设计假信号','建议改用口头战术','lead'],
    ['center_mismatch','临时顶中锋','两名内线同时犯规困扰，教练让你在小阵容里防守中锋。','接受错位硬扛','建议使用区域夹击','team'],
    ['shoe_color_penalty','球鞋颜色警告','联盟官员在开赛前认定你的球鞋配色不符合规定。','马上更换备用鞋','请球队提出申诉','media'],
    ['bench_technical','替补席技术犯规','裁判把一次替补席抱怨记在你名下，球队因此被罚一球。','冷静询问记录台','不再纠缠专注比赛','lead'],
    ['lost_lens','隐形眼镜丢失','暂停时你的隐形眼镜掉在地板上，装备组只有不同度数的备用品。','更换备用镜片','短时间裸眼坚持','risk'],
    ['double_team_read','包夹暗号','助教发现对手只在你向左运球时启动包夹，但样本只有三个回合。','立即利用规律','再观察一节确认','skill'],
    ['inbound_delay','发球人迟到','边线球暂停结束，指定发球的队友仍在治疗脚踝。','临时接管发球','请求更换整套战术','coach'],
    ['rim_tilt','篮筐疑似倾斜','主场热身中队友发现一侧篮筐回弹异常，球馆人员认为无需测量。','坚持重新校准','先用投篮调整适应','media','home'],
    ['crowd_whistle','看台假哨','客场观众不断用口哨干扰，你已经两次误以为裁判吹停。','和队友约定手势','要求现场广播制止','lead','road'],
    ['screen_angle','掩护角度争执','你和内线对同一个掩护该平还是该斜产生分歧，暂停只剩二十秒。','采纳内线习惯','坚持录像方案','team'],
    ['pace_conflict','快慢节奏分歧','控卫想持续推快，教练却要求你每次接球都压到半场阵地。','服从教练控速','支持控卫提速','coach'],
    ['weak_hand_test','弱手挑战','对手公开放空你的弱手突破路线，场边解说也在等你回应。','连续攻击弱侧','用传球惩罚协防','skill'],
    ['timeout_none','暂停已经用完','最后四十秒球队才发现记录台少算了一次暂停，裁判拒绝更改。','场上直接布置','让控卫自由阅读','lead'],
    ['starter_late','首发迟到','一名首发因交通问题未到球馆，你在开赛前五分钟被临时推入全新阵容。','快速确认每套走位','只记住前三个回合','coach'],
    ['ball_pressure','比赛用球过滑','全队都觉得新球过滑，但更换必须得到双方队长同意。','找对方队长协商','调整握球继续比赛','media'],
    ['elbow_play','肘区新战术','教练临场画出一套从未训练过的肘区战术，并让你担任唯一决策点。','按战术大胆执行','改成熟悉的挡拆','skill'],
    ['foul_to_give','是否提前犯规','球队还有一次可送犯规，队友对何时下手意见完全相反。','立即破坏节奏','留到最后三秒','lead'],
    ['switch_refusal','队友拒绝换防','连败期间又连续失分，搭档仍拒绝执行教练安排的无限换防。','暂停时公开说清','先替他补位再沟通','team','slump'],
    ['buzzer_review','压哨球归属','你的压哨补篮被算给队友，技术台询问是否需要正式更正。','要求更正数据','把得分留给队友','team'],

    ['blood_test_delay','赛前血检延误','联盟抽检迟迟没有结束，你可能错过正常热身时间。','配合完成全部流程','让球队申请延后','risk'],
    ['new_orthotics','新鞋垫适配','医疗组送来定制鞋垫，测试数据更好，但脚底已经出现轻微摩擦。','比赛中启用新品','继续使用旧鞋垫','risk'],
    ['ice_bath_fault','冰疗设备故障','客场冰疗池温控失灵，只剩热水浴和手动冰袋可选。','使用分区冰袋','改做主动恢复','recovery'],
    ['trainer_dispute','两名训练师意见相反','一名训练师建议减量，另一名认为你的身体完全适合加练。','选择保守负荷','接受完整训练','risk'],
    ['ankle_tape_style','脚踝绑法冲突','新训练师改变了你多年使用的脚踝绑法，热身时支撑感很陌生。','要求恢复旧绑法','给新方案一场机会','risk'],
    ['sleep_room','睡眠舱名额','球队唯一的睡眠舱被安排给刚结束背靠背的队友。','把名额留给队友','说明自己也需恢复','team'],
    ['altitude_mask','高原训练面罩','体能组建议在高原客场使用呼吸面罩做激活，部分队友出现头晕。','降低强度试用','拒绝临场实验','risk'],
    ['diet_allergy','食谱过敏原','客场餐单里出现你明确登记过的过敏原，营养师认为少量不会有事。','要求重新备餐','选择密封替代食品','recovery'],
    ['massage_leak','治疗记录外泄','一张包含你肌肉紧张部位的治疗表被拍进球队幕后视频。','要求删除并调查','公开说明只是保养','media'],
    ['painkiller_choice','止痛方案选择','队医提供快速起效的止痛方案，也提醒它可能掩盖身体警告。','拒绝掩盖疼痛','在监控下使用','risk'],
    ['weight_check','体重数据异常','晨间称重显示你一夜增加三公斤，设备和身体至少有一方出了问题。','先复测全部指标','按超重计划训练','recovery'],
    ['cold_symptom','流感症状','你起床后喉咙疼痛，同屋队友即将迎来复出首战。','主动申请隔离','戴口罩随队出发','team'],
    ['finger_splint','手指护具限制','新护具能保护受伤手指，却会明显影响投篮触感。','带护具调整出手','申请继续休养','risk'],
    ['rehab_video','康复视频请求','球队希望公开你的康复训练片段安抚球迷，但其中记录了脆弱时刻。','同意剪辑发布','保留康复隐私','media'],
    ['body_data_sale','身体数据授权','可穿戴设备公司希望购买你的匿名运动数据，合同写得并不透明。','拒绝商业授权','要求限定用途','business'],
    ['stretch_partner','拉伸搭档缺席','固定帮助你拉伸的治疗师临时请假，新人并不了解你的旧伤。','自己完成熟悉流程','让新人按标准操作','recovery'],
    ['pool_closed','恢复泳池关闭','酒店泳池临时维修，你原定的水中恢复无法进行。','改为自行车恢复','把时间用于睡眠','recovery'],
    ['jetlag_plan','时差药物建议','跨洲飞行前，医生给出药物调时差方案，但你从未使用过。','采用药物计划','坚持自然调整','risk'],
    ['scan_second_look','影像报告疑点','核磁报告写着没有结构损伤，你却在某个动作中持续感到刺痛。','寻求独立复核','相信报告继续训练','risk'],
    ['hydration_sensor','补水传感器报警','比赛中传感器持续提示脱水，而你主观感觉完全正常。','主动缩短轮换','继续并增加补水','recovery'],
    ['recovery_sponsor','恢复品牌试用','赞助商要求你赛后立即试用新设备，医疗组尚未完成安全评估。','等待医疗批准','履行拍摄安排','business'],
    ['dental_emergency','赛前牙齿裂伤','午餐时一颗牙突然裂开，牙医能马上处理但会占用赛前会议。','先完成治疗','用临时护齿参赛','risk'],
    ['skin_reaction','胶布皮肤反应','新运动胶布让肩部出现大片红疹，固定效果却比旧产品更好。','换回低敏胶布','忍受刺激保留支撑','risk'],
    ['sauna_lock','桑拿房门故障','恢复结束时桑拿房电子门短暂失灵，队友因此对设备安全产生担忧。','要求全面停用检查','确认修复后继续使用','lead'],
    ['morning_readiness','晨间状态评分','系统给你打出赛季最低状态分，但今天恰好是全国直播。','接受限时安排','申请按正常时间出场','risk'],

    ['rookie_prank','新秀恶作剧越界','队友准备对新秀做传统恶作剧，其中包含公开他的私人照片。','当场叫停计划','改成无伤害玩笑','lead'],
    ['captain_vote','临时队长投票','原队长受伤后，教练让球员匿名投票决定代理队长。','公开支持资深队友','接受队友提名','lead'],
    ['locker_theft','更衣室物品失窃','一名双向合同球员的贵重物品消失，怀疑开始在队内扩散。','建议统一交安保','私下帮助寻找','team'],
    ['film_credit','战术建议归属','你提出的防守调整被助教当作自己的想法汇报，随后得到主教练表扬。','私下说明事实','把功劳留给团队','coach'],
    ['birthday_game','队友生日安排','球队在背靠背中途为队友准备庆祝，他本人却只想早点休息。','帮他取消聚会','组织简短祝福','team'],
    ['rookie_debt','新秀陷入债务','一名新秀向你借钱填补高息贷款，并要求不要告诉球队。','联系球员工会顾问','只提供一次周转','lead'],
    ['veteran_minutes','老将时间被削','老将因你的崛起失去轮换时间，他开始在训练里拒绝给你传球。','主动约他单谈','让教练处理竞争','team'],
    ['team_chat_leak','群聊截图泄露','球队群聊中的战术抱怨被匿名账号公开，只有少数人能看到原消息。','推动内部调查','先统一对外口径','media'],
    ['music_volume','更衣室音量冲突','年轻球员想放大音乐庆祝，刚输掉对位的老将要求保持安静。','分区使用耳机','请全队尊重老将','team'],
    ['seat_hierarchy','大巴座位规矩','你无意坐到球队核心长期固定的位置，车内气氛瞬间安静。','主动换回后排','用玩笑打破规矩','team'],
    ['practice_bet','训练赌注升级','队友间的小额投篮赌注不断加码，已经有人输掉半个月薪水。','要求停止金钱赌局','改成公益惩罚','lead'],
    ['coach_favorite','偏爱质疑','替补球员认为教练明显偏爱你，要求你在球员会议中表态。','承认机会差异','强调竞争结果','team'],
    ['trade_goodbye','截止日突然告别','交易截止日前夕，好友突然被交易，管理层要求所有人照常参加下午训练。','先陪他收拾离开','按要求准时训练','loyalty','deadline'],
    ['assistant_departure','助教挖角','长期指导你的助教收到竞争球队报价，并私下询问你是否支持他离开。','鼓励他接受机会','劝他完成本赛季','loyalty'],
    ['playbook_blame','战术本泄密责任','一本旧战术手册出现在二手市场，装备组怀疑是球员遗失。','主动检查自己的物品','反对公开追责','lead'],
    ['locker_renovation','更衣柜重新分配','球馆翻修后核心球员获得更大空间，底薪队友被安排到走廊尽头。','提议平均分配','接受球队等级安排','team'],
    ['family_day_conflict','球队家庭日冲突','球队家庭日与一名队友的宗教节日重叠，他不敢向管理层提出。','替他一起说明','建议他自行请假','loyalty'],
    ['captain_fine','队长私设罚款','队长对迟到球员设立内部罚款，但金额对底薪球员并不公平。','提出按薪资分级','支持统一标准','lead'],
    ['rookie_translation','新秀翻译困难','外籍新秀在战术会议中频繁点头，训练时却明显没听懂。','每天帮他复盘','请球队聘请翻译','team'],
    ['injured_presence','伤员是否随队','长期伤停队友不想参加客场旅行，教练认为他必须留在团队中。','支持留队康复','邀请他继续随队','team'],
    ['bonus_pool','奖金分配争议','季中锦标奖金到账，双向合同球员是否参与分配引发争论。','主张全员平分','按出场贡献分配','lead'],
    ['practice_camera','训练摄像头','教练组新增全天候训练摄像头，部分队友认为私人交流也被记录。','要求划定禁拍区','接受完整录像分析','coach'],
    ['meal_rookie_rule','新秀买单传统','老将要求新秀承担昂贵聚餐账单，而那名新秀刚在供养全家。','替新秀拒绝传统','帮他承担一部分','lead'],
    ['agent_in_locker','经纪人进入更衣室','你的经纪人未经允许进入更衣室递合同文件，引起队友不满。','立即请他离开','向全队解释原因','team'],
    ['starter_announcement','首发消息提前泄露','你刚得知自己将进入首发，原首发却从记者那里先听到了消息。','先找到他沟通','等待教练正式说明','team'],

    ['headline_stat','标题只写失误','你打出生涯最高助攻，报道标题却只强调最后一次失误。','接受专访还原比赛','不回应继续准备','media'],
    ['podcast_clip','播客旧话翻红','三年前一段玩笑被重新剪辑传播，语境已经完全消失。','发布完整片段','承认表达不成熟','media'],
    ['reporter_source','记者索要消息','长期友好的记者希望你确认一名队友的伤情，以换取未来善意报道。','拒绝泄露队友情报','让球队公关回应','loyalty'],
    ['mic_left_on','麦克风忘关','发布会结束后麦克风仍开着，你对裁判的私下抱怨被直播出去。','立即公开道歉','解释是情绪发泄','media'],
    ['fake_account','冒名账号','一个认证风格极像你的账号发布攻击性言论，已经有媒体引用。','报警并公开澄清','让平台静默处理','media'],
    ['documentary_cut','纪录片剪辑权','纪录片导演希望保留你和教练争吵的片段，认为这是全片最真实部分。','同意完整呈现','要求删除争吵','business'],
    ['photo_caption','照片说明错误','官方照片把你与家人的合影误写成商业活动，并标错了亲属身份。','要求正式更正','私下联系编辑','media'],
    ['anonymous_poll','匿名投票垫底','球员匿名调查把你评为最难相处的队友，节目组邀请你回应。','正面询问队内反馈','公开质疑调查可信度','lead'],
    ['charity_audit','慈善账目质疑','媒体发现你支持的基金会行政成本偏高，项目方保证一切合法。','暂停合作并审计','继续支持等待报告','business'],
    ['foreign_interview','翻译曲解回答','海外采访的翻译把“保持耐心”译成了“队友拖后腿”。','录制双语澄清','让主办方书面更正','media'],
    ['press_blackout','球队媒体封锁','连败后管理层要求全队拒绝采访，但联盟规定核心球员必须出席。','代表球队简短回应','坚持执行封锁','coach'],
    ['fan_video','球迷偷拍视频','餐厅里的私人谈话被邻桌偷拍视频记录，其中提到下一场对手。','要求视频下架','公开淡化内容','media'],
    ['stat_correction','数据统计更正','联盟准备取消你上一场的一次盖帽，纪录将因此中断。','提交录像申诉','接受官方修订','skill'],
    ['cover_rival','杂志双人封面','杂志邀请你与宿敌拍摄友好封面，宣传语却刻意制造虚假和解。','要求改掉宣传语','接受商业叙事','business'],
    ['hot_take_show','焦点赛争议节目','全国焦点赛前，高收视节目承诺给你完整发言时间，但主持人以制造冲突闻名。','亲自上节目辩论','拒绝成为话题素材','media','national'],
    ['family_question','记者追问家事','记者连续追问与你比赛无关的家庭问题，公关示意你可以离场。','明确边界后继续','直接结束采访','lead'],
    ['award_ballot','奖项选票公开','一名投票记者提前公布不会选你，并引用了错误数据。','用数据公开回应','保持沉默尊重投票','media'],
    ['camera_tunnel','球员通道直播','联盟测试通道直播，镜头会记录比赛前最后十分钟。','接受全程跟拍','要求赛前关闭','business'],
    ['teammate_quote','队友发言被误读','队友一句普通评价被标题写成对你不满，他不知该如何澄清。','和他共同接受采访','让球队发布声明','team'],
    ['sponsor_scandal','赞助品牌危机','你的长期赞助品牌卷入劳动争议，合同团队建议暂时不要表态。','暂停公开合作','要求品牌先整改','business'],
    ['old_post','少年时期旧动态','你高中时期发布的一条幼稚动态被翻出，内容并不违法却很冒犯。','承认错误并删除','解释年龄背景','media'],
    ['interview_embargo','提前发布专访','媒体违反约定提前发布专访，打乱球队当天的重大官宣。','终止后续合作','接受道歉继续合作','business'],
    ['rating_debate','游戏评分争议','新赛季游戏评分把你一项强项大幅调低，品牌希望你拍视频吐槽。','幽默参与讨论','不让评分影响形象','media'],
    ['press_language','发布会用词提醒','公关要求你以后回答必须使用准备好的安全措辞。','坚持自然表达','接受媒体训练','media'],
    ['leaked_contract','合同数字泄露','一份不准确的薪资数字在网络流传，队友已经据此开起玩笑。','公开真实条款','只否认错误部分','business'],

    ['equity_offer','初创公司股权','一家运动科技公司用股权代替代言费，但产品还没有通过完整测试。','要求产品验证后再投','小额接受早期股权','business'],
    ['shoe_signature','签名鞋设计争执','设计师坚持使用你不喜欢的家乡符号，认为市场故事比审美重要。','要求重做设计','保留符号修改配色','business'],
    ['restaurant_name','餐厅使用姓名','朋友开的餐厅未经许可使用你的名字招牌，并承诺事后分红。','要求立即撤下','补签正式授权','business'],
    ['crypto_pitch','加密项目邀约','经纪团队收到高额数字资产推广报价，项目白皮书充满模糊承诺。','直接拒绝推广','聘请团队深入审查','business'],
    ['house_neighbor','邻居噪音投诉','邻居投诉你的深夜恢复设备太吵，物业发来最后警告。','更换静音设备','协调新的使用时段','loyalty'],
    ['family_job','亲属求职请求','亲属希望你安排他进入球队工作，并强调自己值得信任。','推荐公开应聘','拒绝介入球队招聘','loyalty'],
    ['agent_fee','经纪费调整','经纪人要求提高分成，理由是你的商业事务已经翻倍。','按新增收入阶梯提成','开始接触其他经纪人','business'],
    ['tax_notice','跨州税务通知','会计发现上一季客场收入申报有遗漏，补报会产生不小罚款。','立即主动补报','先申请专业复核','business'],
    ['memorabilia_fake','假签名球衣','大量仿冒签名球衣流入市场，真正收藏者也开始质疑你的认证。','建立官方认证计划','授权平台集中维权','business'],
    ['gaming_stream','直播失言风险','直播平台邀请你边打游戏边与陌生人连麦，合同不允许剪辑。','改为录播节目','接受真实直播','media'],
    ['personal_coach','私人教练冲突','私人教练的训练理念与球队体能组完全相反，双方都要求你选边。','统一开会制定方案','停止私人训练合作','coach'],
    ['brand_exclusive','品类排他条款','饮料赞助合同禁止你在任何公开画面出现竞争品牌，连队友递水都可能违约。','要求缩小排他范围','接受高额补偿条款','business'],
    ['car_gift','豪车赠送','经销商把一辆车送到训练馆，条件只在一封模糊邮件里提到。','原车退回','签清合同后接受','business'],
    ['book_ghostwriter','自传代笔分歧','代笔作者把队友冲突写得极具戏剧性，并坚持这是销售重点。','删掉未经证实细节','推迟整本书出版','loyalty'],
    ['school_endowment','母校捐款用途','母校希望把你的捐款用于豪华球馆，而你原本想资助普通学生。','限定奖学金用途','支持球馆冠名计划','loyalty'],
    ['friend_investment','朋友创业借款','童年好友希望你投资他的训练馆，却拿不出完整财务计划。','提供小额无息借款','要求商业计划后再谈','loyalty'],
    ['insurance_exam','保险体检争议','巨额合同保险要求额外基因筛查，律师认为涉及隐私边界。','拒绝基因检测','限定数据保存期限','business'],
    ['appearance_overlap','两场活动撞期','联盟公益晚宴和个人品牌发布会被安排在同一晚。','出席联盟公益晚宴','优先个人品牌发布','business'],
    ['nickname_trademark','绰号商标抢注','陌生公司抢先注册了球迷给你的绰号，并提出高价转让。','通过法律程序异议','支付费用买回商标','business'],
    ['home_security','住宅安保升级','近期骚扰让安保建议封闭住宅周边道路，但邻居会因此受到影响。','采用低调安保方案','申请全面道路管制','loyalty'],
    ['family_business','家族生意代言','家人希望你免费为家族生意代言，品牌团队担心形象和质量风险。','先做产品审查','婉拒公开代言','loyalty'],
    ['private_plane','私人飞机分摊','几名球星邀请你共同包机参加休赛期活动，费用与球队保险都很复杂。','选择联盟商业航班','签订分摊与保险协议','business'],
    ['foundation_name','基金会冠名','大企业愿意捐出巨款，但要求基金会永久加入品牌名称。','拒绝永久冠名','接受限期联合名称','business'],
    ['wardrobe_clause','着装赞助限制','服装品牌要求你在球队非正式活动也只能穿指定系列。','要求保留私人场合','接受全场景合约','business'],
    ['mentor_fund','前辈投资基金','退役前辈邀请你加入球员投资基金，但不公开具体项目名单。','先做独立尽调','信任前辈小额加入','business'],

    ['bus_breakdown','球队大巴抛锚','客场去球馆途中大巴熄火，距离热身只剩四十分钟。','分乘出租车先走','全队等待备用车','lead'],
    ['luggage_lost','比赛装备箱丢失','航空公司弄丢了你的专属装备箱，球馆只能提供通用尺码。','借用队友备用装备','让品牌紧急同城调货','risk'],
    ['hotel_alarm','酒店凌晨误报','消防警报在凌晨两点连续响了三次，球队第二天中午就要比赛。','要求全队换酒店','留下并调整晨训','recovery'],
    ['snow_route','暴雪改道','航班取消后球队可选择连夜乘车八小时，或第二天早上再出发。','连夜坐车赶路','等待早班航班','recovery'],
    ['passport_issue','护照签注问题','海外赛出发前，你的签注页被发现存在录入错误。','独自晚一天出发','放弃海外商业活动','business'],
    ['arena_power','球馆局部停电','热身时球馆一半灯光熄灭，维修预计可能持续到开赛后。','建议延期比赛','在现有灯光下适应','risk'],
    ['wrong_hotel','预订酒店错误','工作人员把球队订到远离球馆的同名酒店，通勤时间增加一小时。','取消晨间投篮训练','提前两小时出发','coach'],
    ['food_delivery','赛后餐食未到','背靠背出发前，球队餐食供应商迟到，机场登机时间不能改变。','先去机场自行解决','全队等待餐食','recovery'],
    ['customs_delay','海关抽查','海外行程中你的器材箱被单独扣留，品牌人员催你先离开拍摄。','留下处理器材','让工作人员代办','business'],
    ['elevator_stuck','酒店电梯停运','全队住在高层，电梯故障而赛前大巴即将出发。','走楼梯按时集合','请求推迟出发','risk'],
    ['practice_court','训练馆被占','预订的客场训练馆临时举办活动，只剩一块尺寸偏小的社区球场。','去社区球场训练','改成酒店录像课','coach'],
    ['uniform_truck','球衣运输车迟到','整队比赛服还在高速公路上，联盟规定的开赛时间不会轻易改变。','申请穿训练服热身','推动比赛延后','lead'],
    ['turbulence','航班强烈颠簸','长途飞行持续颠簸，多名队友出现不适，落地后原定训练仍未取消。','建议取消训练恢复','按计划完成激活','team'],
    ['road_construction','球馆道路封闭','城市临时封路，大巴被堵在距离球馆两公里的位置。','下车步行前往','等待警车开道','risk'],
    ['laundry_mixup','洗衣房混装','客场洗衣房把你的比赛内衬和对手球队装备混在一起。','使用全新备用内衬','要求找回熟悉装备','risk'],
    ['time_zone_error','赛程时间写错','团队日历把当地开赛时间换算错了一小时，部分球员刚刚开始午睡。','紧急叫醒全队','请求联盟调整热身','lead'],
    ['security_route','安保路线冲突','球馆安保要求走封闭通道，但那里聚集着正在抗议的球迷。','改走公开正门','等待抗议人群散开','media'],
    ['rental_bus','临时司机迷路','替班大巴司机错过高速出口，球队已经能看到球馆却无法掉头。','联系警方引导','就近下车换车','lead'],
    ['locker_temperature','客队更衣室过热','客队更衣室空调失灵，温度持续升高，主队说维修需要两小时。','转移到走廊准备','留在房间适应高温','risk'],
    ['noise_construction','酒店清晨施工','酒店未告知楼层装修，钻机在早上六点准时启动。','集体投诉更换房间','提前起床安排恢复','recovery'],

    ['drug_test_chain','药检样本流程','你发现药检人员没有在样本离开视线前完成封签。','要求重新采样','在记录上注明异议','lead'],
    ['fine_appeal','联盟罚款申诉','联盟因一个庆祝动作罚款，你认为录像能证明动作没有针对观众。','正式提交申诉','接受罚款结束争议','media'],
    ['schedule_vote','赛程改革表决','球员工会就是否减少背靠背征求投票，但方案会延长整个赛季。','支持减少背靠背','反对延长赛季','lead'],
    ['equipment_rule','新护具规则','联盟季中突然限制你长期使用的护臂厚度，下场比赛就开始执行。','申请医疗豁免','立刻适应新护具','risk'],
    ['tampering_question','招募言论调查','联盟询问你在公开节目中称赞其他球队球星是否属于违规招募。','完整配合调查','交由律师书面回应','media'],
    ['referee_meeting','裁判圆桌会','联盟邀请你参加球员裁判沟通会，队友希望你提出长期积累的不满。','带录像具体讨论','只谈规则不谈个案','lead'],
    ['allstar_rest','全明星活动安排','联盟要求你参加全部全明星商业活动，医疗组建议至少取消一项。','申请退出技巧活动','完成所有联盟安排','risk'],
    ['jersey_number','号码使用争议','球队准备退役一位名宿的号码，而你目前正穿着同一个号码。','主动提前更换号码','等赛季结束再更换','loyalty'],
    ['arena_banner','冠军旗帜错误','客场球馆展示的历史冠军旗帜年份明显错误，记者问你是否注意到。','礼貌指出错误','避免评价对手历史','media'],
    ['union_rep','球员工会代表','队友希望你担任球队工会代表，这会增加大量会议和沟通工作。','接受代表职责','推荐更资深队友','lead'],
    ['rule_experiment','新规则试验','联盟邀请球队在季前赛试验四分线，教练让核心球员决定是否参加。','支持战术实验','坚持标准规则准备','skill'],
    ['award_eligibility','奖项场次门槛','轮休一场可能让你失去赛季奖项评选资格，但医疗组明确建议休息。','接受轮休保护身体','坚持出场满足门槛','risk'],
    ['court_logo','地板广告过滑','新地板广告区域被多名球员投诉打滑，联盟现场代表尚未判定。','联合对手要求移除','避开区域继续比赛','lead'],
    ['roster_error','报名名单错误','球队提交的激活名单漏掉一名轮换队友，修正可能导致罚款。','支持球队立即修正','按现名单完成比赛','team'],
    ['replay_test','自动回放试验','联盟测试自动判罚系统，你的一次关键防守被机器建议改判犯规。','要求人工最终裁定','接受试验系统结果','media'],

    ['hospital_visit','儿童病房临时邀请','客场医院临时邀请你探望无法到场看球的孩子，但球队大巴很快离开。','改签车辆亲自前往','安排赛后视频连线','loyalty'],
    ['court_repair','社区球场损坏','你捐建的社区球场因施工问题开裂，承包方希望悄悄修补。','公开停用全面返工','先封场内部维修','business'],
    ['fan_sign','争议标语合影','球迷递来一块带有攻击对手内容的标语要求合影。','拒绝并解释原因','请他遮住文字合影','media'],
    ['ticket_scam','假票受害者','数十名球迷购买了冒充你基金会发售的假票，组织者已经失联。','基金会补发真票','报警并公开防骗','loyalty'],
    ['youth_coach','青训教练投诉','青训营家长投诉教练过度羞辱孩子，而教练是你的多年朋友。','暂停教练接受调查','亲自旁听下一堂课','lead'],
    ['wheelchair_access','无障碍座位被占','赛后活动把无障碍座位临时改成媒体区，一名轮椅球迷无法入场。','推迟活动重新布置','邀请球迷进入内场','loyalty'],
    ['language_fan','听障球迷请求','听障球迷希望你的公开视频增加手语版本，团队担心制作周期。','承诺全部增加手语','先为重要视频添加','loyalty'],
    ['memorial_game','纪念赛邀请','家乡邀请你参加一场纪念已故教练的比赛，时间紧邻球队体检。','亲自回乡参加','录制致辞并捐款','loyalty'],
    ['school_uniform','校队装备争议','受捐学校只给男队发放新装备，女队仍在使用旧球衣。','要求两队同等配置','追加资金补齐装备','lead'],
    ['fan_argument','看台球迷冲突','一名穿你球衣的球迷与客队球迷发生冲突，偷拍视频开始传播。','公开反对攻击行为','邀请双方参与公益活动','media'],
    ['charity_weather','公益活动遇暴雨','露天公益赛遭遇暴雨，现场仍有数百名孩子等待。','转入室内缩短流程','取消活动择日重办','risk'],
    ['signature_queue','签名规则争执','球迷活动规定每人只能签一件，有人带着病重亲人的两件纪念品请求例外。','破例签下两件','请基金会事后补签','loyalty'],
    ['local_business','小店联名请求','主场附近经营多年的小店希望推出你的联名商品，却付不起标准授权费。','提供限量公益授权','拒绝商业使用姓名','business'],
    ['fan_tattoo','球迷纹身请求','球迷希望你在他的皮肤上签名并立刻纹下，工作人员担心安全责任。','只在纪念卡上签名','完成签名但明确风险','media'],
    ['lost_child','活动现场走失儿童','公开训练结束时，一名孩子与家长走散，安保正准备清场。','留下陪他等待家长','交给安保继续行程','loyalty'],
    ['old_coach_help','启蒙教练求助','启蒙教练的球馆面临关闭，他希望你直接承担全部欠款。','资助重建运营计划','先联系社区共同筹款','loyalty'],
    ['fan_translation','海外球迷来信','海外球迷寄来长信，现有翻译只给出几句粗略摘要。','聘请翻译完整回复','录制通用感谢视频','media'],
    ['charity_rival','与宿敌联合公益','联盟希望你与场上宿敌共同主持反暴力活动，双方团队担心形象混淆。','共同出席公开对话','分别录制同一主题','lead'],
    ['retired_worker','球馆老员工退休','为球队工作四十年的设备管理员退休，仪式却被安排在无观众的训练日。','推动赛前公开致敬','组织球员私人送别','loyalty']
  ];

  var effects = {
    lead: [
      { profile:{ leadership:2, mediaTrust:1 }, mods:{ mediaPressure:1 } },
      { profile:{ coachTrust:1 }, mods:{ formVariance:-1 } }
    ],
    coach: [
      { profile:{ coachTrust:2 }, mods:{ staminaLoad:1 } },
      { profile:{ leadership:1 }, mods:{ formVariance:1 } }
    ],
    skill: [
      { profile:{ coachTrust:1, leadership:1 }, mods:{ formVariance:-1 } },
      { profile:{ lockerRoomTrust:1 }, mods:{ teamChemistry:1 } }
    ],
    team: [
      { profile:{ lockerRoomTrust:2 }, mods:{ teamChemistry:1 } },
      { profile:{ leadership:1, coachTrust:1 }, mods:{ teamChemistry:-1 } }
    ],
    risk: [
      { profile:{ coachTrust:1 }, mods:{ injuryRiskBonus:-1, staminaLoad:-1 } },
      { profile:{ leadership:1 }, mods:{ injuryRiskBonus:1, formVariance:1 } }
    ],
    recovery: [
      { profile:{ coachTrust:1 }, mods:{ staminaLoad:-2 } },
      { profile:{ leadership:1 }, mods:{ formVariance:-1 } }
    ],
    media: [
      { profile:{ mediaTrust:2 }, mods:{ mediaPressure:1 } },
      { profile:{ fame:1 }, mods:{ mediaPressure:-1 } }
    ],
    business: [
      { profile:{ businessValue:2 }, mods:{ mediaPressure:1 } },
      { profile:{ mediaTrust:1, controversy:-1 }, mods:{ formVariance:-1 } }
    ],
    loyalty: [
      { profile:{ loyalty:2, fanSupport:1 }, mods:{ staminaLoad:1 } },
      { profile:{ mediaTrust:1 }, mods:{ mediaPressure:-1 } }
    ]
  };

  var effectLabels = {
    leadership:'领导力', mediaTrust:'媒体信任', mediaPressure:'媒体压力',
    coachTrust:'教练信任', staminaLoad:'体能负荷', formVariance:'状态波动',
    lockerRoomTrust:'更衣室信任', teamChemistry:'球队默契',
    injuryRiskBonus:'伤病风险', fame:'人气', businessValue:'商业价值',
    controversy:'争议', loyalty:'忠诚', fanSupport:'球迷支持'
  };
  var badWhenRaised = {
    mediaPressure:true, staminaLoad:true, formVariance:true,
    injuryRiskBonus:true, controversy:true
  };

  function naturalEffect(key, value) {
    var amount = Number(value) || 0;
    var strong = Math.abs(amount) >= 2 ? '明显' : '';
    if (key === 'formVariance') return amount < 0 ? '状态' + strong + '更稳定' : '状态波动' + strong + '增加';
    var label = effectLabels[key] || key;
    if (badWhenRaised[key]) return label + strong + (amount > 0 ? '增加' : '下降');
    return label + strong + (amount > 0 ? '提升' : '下降');
  }

  function choiceForecast(effect) {
    var gains = [];
    var costs = [];
    ['profile', 'mods'].forEach(function (group) {
      Object.keys(effect[group] || {}).forEach(function (key) {
        var value = Number(effect[group][key]) || 0;
        if (!value) return;
        var beneficial = badWhenRaised[key] ? value < 0 : value > 0;
        (beneficial ? gains : costs).push(naturalEffect(key, value));
      });
    });
    if (gains.length && costs.length) return gains.join('、') + '，但' + costs.join('、');
    return (gains.length ? gains : costs).join('、') || '后续剧情与人物评价将发生变化';
  }

  function decisionResult(label, family, side) {
    var endings = {
      lead:['你把决定说清楚，混乱很快有了执行标准。','你压住情绪，让比赛和团队重新回到正轨。'],
      coach:['教练组记录了你的投入，也重新调整了后续安排。','方案保留了临场弹性，但你需要用表现证明判断。'],
      skill:['执行后的录像给出了明确反馈，你对这个回合有了新答案。','球队换了一种解法，代价和收益都立刻显现。'],
      team:['队友感受到你愿意共同承担，关系因此发生变化。','你守住自己的判断，也承担了更衣室里的余波。'],
      risk:['医疗组重新评估了负荷，身体风险得到更谨慎的处理。','你选择继续推进，状态波动成为必须接受的代价。'],
      recovery:['恢复团队按新方案重排时间，你的疲劳得到控制。','你保留熟悉节奏，接下来需要更仔细观察身体反应。'],
      media:['完整信息逐渐压过猜测，外界开始理解你的立场。','话题热度降了下来，但公众留下了自己的解释。'],
      business:['团队重新核算合同与风险，商业价值被更清楚地保护。','你没有追逐眼前报价，长期信用因此更加稳定。'],
      loyalty:['当事人记住了你在关键时刻的选择，这段关系更牢固。','你划清责任边界，也避免承诺超出自己能做到的范围。']
    };
    return label + '。' + (endings[family] || endings.lead)[side];
  }

  var definitions = catalog.map(function (row) {
    var family = row[5] || 'lead';
    var pair = effects[family] || effects.lead;
    return {
      id: 'unique_' + row[0],
      topicId: 'unique_' + row[0],
      contextId: row[6] || null,
      title: '赛季事件：' + row[1],
      scene: row[2],
      body: '“' + row[1] + '”没有标准答案，两种处理都会留下不同影响。',
      choices: [
        { label:row[3], hint:choiceForecast(pair[0]), profile:pair[0].profile, mods:pair[0].mods, result:decisionResult(row[3], family, 0) },
        { label:row[4], hint:choiceForecast(pair[1]), profile:pair[1].profile, mods:pair[1].mods, result:decisionResult(row[4], family, 1) }
      ]
    };
  });

  if (definitions.length !== 179) {
    throw new Error('独立赛季事件数量错误：期望 179，实际 ' + definitions.length);
  }

  window.PERFECT_PLAYER_EXTRA_SEASON_EVENT_DEFINITIONS = definitions;
  window.PERFECT_PLAYER_EVENT_LIBRARY_REPORT = {
    generated: definitions.length,
    uniqueStories: new Set(definitions.map(function (event) { return event.scene; })).size,
    uniqueDecisionPairs: new Set(definitions.map(function (event) { return event.choices.map(function (choice) { return choice.label; }).join('|'); })).size,
    uniqueChoiceHints: new Set(definitions.reduce(function (all, event) { return all.concat(event.choices.map(function (choice) { return choice.hint; })); }, [])).size,
    templateMatrix: false
  };
})();
