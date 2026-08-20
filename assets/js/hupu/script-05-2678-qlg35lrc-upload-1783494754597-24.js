/**
 * ============================================================
 *  BuildPlayer 模拟配置模块
 *  所有可调参数集中在此，方便你以后调整游戏平衡
 * ============================================================
 */
const SIM_CONFIG = {

  // ============================================================
  // 1. 建球员阶段参数
  // ============================================================
  BUILD: {
    /** 总属性数 */
    TOTAL_ATTRS: 13,

    /** Classic 模式重roll次数 */
    CLASSIC_REROLLS: 3,

    /** 每支球队 roster 展示上限（不够的用实际人数） */
    ROSTER_SHOW_MAX: 15,

    /** 属性值范围 */
    ATTR_MIN: 25,
    ATTR_MAX: 99,
  },

  // ============================================================
  // 1.5 各位置属性平均值（从真实NBA2K数据计算，用于跨位置衰减）
  // 公式: 衰减系数 = min(1.0, 你的位置该属性平均值 / 来源位置该属性平均值)
  // ============================================================
  POS_AVG: {
    PG: { threePT: 79.2, MID: 79.5, FIN: 82.5, DNK: 57.9, HAN: 85.2, PAS: 79.4, PDEF: 69.5, IDEF: 42.0, BLK: 44.6, REB: 52.2, ATH: 82.1, STR: 50.7, CLU: 73.6 },
    SG: { threePT: 79.8, MID: 77.2, FIN: 82.5, DNK: 71.3, HAN: 83.0, PAS: 71.7, PDEF: 69.6, IDEF: 48.3, BLK: 45.5, REB: 51.9, ATH: 79.6, STR: 53.7, CLU: 70.5 },
    SF: { threePT: 78.4, MID: 75.6, FIN: 82.5, DNK: 73.5, HAN: 82.8, PAS: 65.2, PDEF: 71.1, IDEF: 58.7, BLK: 50.5, REB: 57.3, ATH: 77.3, STR: 58.2, CLU: 62.5 },
    PF: { threePT: 76.2, MID: 71.4, FIN: 83.4, DNK: 75.8, HAN: 83.4, PAS: 62.4, PDEF: 67.6, IDEF: 68.1, BLK: 59.7, REB: 66.4, ATH: 73.7, STR: 66.4, CLU: 71.1 },
    C:  { threePT: 62.4, MID: 70.7, FIN: 86.4, DNK: 73.2, HAN: 80.3, PAS: 53.0, PDEF: 50.8, IDEF: 72.8, BLK: 72.7, REB: 77.0, ATH: 59.4, STR: 74.7, CLU: 64.9 },
  },

  // ============================================================
  // 2. 属性中文名映射
  // ============================================================
  ATTR_CN: {
    threePT: '三分',
    MID:     '中投',
    FIN:     '终结',
    DNK:     '扣篮',
    HAN:     '手感',
    PAS:     '传球',
    PDEF:    '外防',
    IDEF:    '内防',
    BLK:     '盖帽',
    REB:     '篮板',
    ATH:     '运动',
    STR:     '力量',
    CLU:     '关键',
  },

  /** 属性简短说明（hover 时显示） */
  ATTR_DESC: {
    threePT: '三分投篮能力',
    MID:     '中距离投篮能力',
    FIN:     '篮下终结能力',
    DNK:     '扣篮能力',
    HAN:     '控球与接球手感',
    PAS:     '传球精准度',
    PDEF:    '外线防守能力',
    IDEF:    '内线防守能力',
    BLK:     '盖帽能力',
    REB:     '篮板能力',
    ATH:     '运动能力（速度/敏捷）',
    STR:     '力量对抗能力',
    CLU:     '关键球能力',
  },

  /** 属性列表（顺序决定 UI 排列） */
  ATTR_LIST: [
    'threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS',
    'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'
  ],

  /** 数字→字母等级转换 */
  GRADE: {
    /** 根据数值返回 { letter, color } */
    getGrade(val) {
      if (val >= 95) return { letter: 'A+', color: '#ff6b6b' };
      if (val >= 90) return { letter: 'A',  color: '#ff8787' };
      if (val >= 85) return { letter: 'A-', color: '#ffa07a' };
      if (val >= 80) return { letter: 'B+', color: '#ffd43b' };
      if (val >= 75) return { letter: 'B',  color: '#ffd43b' };
      if (val >= 70) return { letter: 'B-', color: '#ffd43b' };
      if (val >= 65) return { letter: 'C+', color: '#69db7c' };
      if (val >= 60) return { letter: 'C',  color: '#69db7c' };
      if (val >= 55) return { letter: 'C-', color: '#69db7c' };
      if (val >= 50) return { letter: 'D+', color: '#74c0fc' };
      if (val >= 45) return { letter: 'D',  color: '#74c0fc' };
      if (val >= 40) return { letter: 'D-', color: '#74c0fc' };
      return { letter: 'F', color: '#868e96' };
    },
    /** OVR 等级 */
    getOvrGrade(ovr) {
      if (ovr >= 95) return '超级巨星';
      if (ovr >= 85) return '全明星';
      if (ovr >= 75) return '首发';
      if (ovr >= 65) return '轮换';
      return '边缘';
    },
  },

  // ============================================================
  // 3. 位置与 Archetype 判定
  // ============================================================
  POSITIONS: {
    PG: '控球后卫',
    SG: '得分后卫',
    SF: '小前锋',
    PF: '大前锋',
    C:  '中锋',
  },

  POS_LIST: ['PG', 'SG', 'SF', 'PF', 'C'],

  /** OVR 计算公式：各属性对每个位置的权重 */
  OVR_WEIGHTS: {
    PG: { threePT: 0.10, MID: 0.10, FIN: 0.08, DNK: 0.04, HAN: 0.14, PAS: 0.14, PDEF: 0.10, IDEF: 0.04, BLK: 0.02, REB: 0.04, ATH: 0.08, STR: 0.04, CLU: 0.08 },
    SG: { threePT: 0.12, MID: 0.12, FIN: 0.10, DNK: 0.06, HAN: 0.10, PAS: 0.08, PDEF: 0.10, IDEF: 0.04, BLK: 0.02, REB: 0.04, ATH: 0.08, STR: 0.04, CLU: 0.10 },
    SF: { threePT: 0.10, MID: 0.10, FIN: 0.10, DNK: 0.08, HAN: 0.08, PAS: 0.06, PDEF: 0.10, IDEF: 0.08, BLK: 0.04, REB: 0.06, ATH: 0.08, STR: 0.06, CLU: 0.06 },
    PF: { threePT: 0.08, MID: 0.06, FIN: 0.12, DNK: 0.06, HAN: 0.06, PAS: 0.04, PDEF: 0.10, IDEF: 0.12, BLK: 0.08, REB: 0.10, ATH: 0.06, STR: 0.08, CLU: 0.04 },
    C:  { threePT: 0.04, MID: 0.04, FIN: 0.14, DNK: 0.06, HAN: 0.04, PAS: 0.04, PDEF: 0.08, IDEF: 0.14, BLK: 0.12, REB: 0.12, ATH: 0.04, STR: 0.10, CLU: 0.04 },
  },

  // ============================================================
  // 4. 赛季模拟参数 — 你可以随意调整
  // ============================================================
  SEASON: {
    /** 常规赛总场次 */
    GAMES: 82,

    /** 单节分钟数（用于统计） */
    QUARTER_MINUTES: 12,

    /** 模拟速度（毫秒/场） */
    SIM_SPEED_FAST: 50,
    SIM_SPEED_NORMAL: 800,
    SIM_SPEED_DETAIL: 2500,

    /** 季后赛晋级条件（胜场数） */
    PLAYOFF_WIN_REQUIRED: 4,
  },

  /** 球队实力维度权重 */
  TEAM_POWER: {
    offense:  { threePT: 0.20, MID: 0.15, FIN: 0.20, PAS: 0.15, HAN: 0.10, DNK: 0.10, ATH: 0.10 },
    defense:  { PDEF: 0.25, IDEF: 0.25, BLK: 0.15, REB: 0.15, ATH: 0.10, STR: 0.10 },
    athletic: { ATH: 0.30, DNK: 0.20, STR: 0.20, FIN: 0.15, threePT: 0.15 },
    clutch:   { CLU: 0.40, threePT: 0.20, MID: 0.20, PAS: 0.20 },
    depth:    {},  // 板凳平均 OVR，特殊处理
  },

  /** 单节分数计算基础值 */
  QUARTER_BASE_PTS: 24,

  /** 各维度对得分的影响系数 */
  QUARTER_FACTORS: {
    offense:  1.0,
    defense:  -0.7,
    athletic: 0.3,
    clutch:   0.2,
    home:     0.05,  // 主场加成
  },

  /** 随机事件概率（每节） */
  EVENTS: {
    /** 球员爆发概率 */
    HOT_STREAK_CHANCE: 0.08,
    /** 爆发时单节得分加成 */
    HOT_STREAK_BONUS: { min: 4, max: 12 },
    
    /** 主力受伤概率（每场） */
    INJURY_CHANCE: 0.03,
    /** 受伤缺席场次 */
    INJURY_GAMES: { min: 3, max: 15 },
    
    /** 交易概率（每10场检测一次） */
    TRADE_CHANCE: 0.02,
    
    /** 冷门概率（弱队赢强队） */
    UPSET_CHANCE: 0.10,
    /** 冷门时弱队加成 */
    UPSET_BONUS: 0.15,

    /** 绝杀概率 */
    BUZZER_BEATER_CHANCE: 0.05,
  },

  /** 你的球员数据生成系数 */
  PLAYER_STATS: {
    /** 各位置球权占比 */
    USAGE: { PG: 0.18, SG: 0.17, SF: 0.16, PF: 0.14, C: 0.15 },

    /** 各位置的数据缩放（pts基准=1.0，其他数据相对pts的比例） */
    POS_SCALE: {
      PG: { pts: 1.0, reb: 0.35, ast: 0.90, stl: 0.18, blk: 0.04, tov: 1.0 },
      SG: { pts: 1.0, reb: 0.35, ast: 0.60, stl: 0.18, blk: 0.06, tov: 1.0 },
      SF: { pts: 1.0, reb: 0.60, ast: 0.55, stl: 0.16, blk: 0.08, tov: 1.0 },
      PF: { pts: 1.0, reb: 0.85, ast: 0.55, stl: 0.12, blk: 0.12, tov: 1.0 },
      C:  { pts: 1.0, reb: 1.00, ast: 0.55, stl: 0.08, blk: 0.15, tov: 1.0 },
    },

    /** 按位置的属性→数据映射（不同位置权重不同） */
    FACTORS: {
      PG: {
        pts: { FIN: 0.25, threePT: 0.20, MID: 0.20, DNK: 0.10, ATH: 0.10, PAS: 0.15 },
        reb: { REB: 0.40, STR: 0.20, ATH: 0.20 },
        ast: { PAS: 0.45, HAN: 0.25, ATH: 0.15, threePT: 0.15 },
        stl: { PDEF: 0.40, ATH: 0.25, HAN: 0.20 },
        blk: { BLK: 0.30, IDEF: 0.20, ATH: 0.10 },
        tov: { HAN: -0.35, PAS: -0.30, ATH: -0.15 },
      },
      SG: {
        pts: { FIN: 0.28, threePT: 0.22, MID: 0.20, DNK: 0.12, ATH: 0.10, PAS: 0.08 },
        reb: { REB: 0.40, STR: 0.20, ATH: 0.20 },
        ast: { PAS: 0.35, HAN: 0.20, ATH: 0.15, threePT: 0.10 },
        stl: { PDEF: 0.40, ATH: 0.25, HAN: 0.15 },
        blk: { BLK: 0.30, IDEF: 0.20, ATH: 0.10 },
        tov: { HAN: -0.35, PAS: -0.30, ATH: -0.15 },
      },
      SF: {
        pts: { FIN: 0.28, threePT: 0.18, MID: 0.18, DNK: 0.15, ATH: 0.12, STR: 0.09 },
        reb: { REB: 0.45, STR: 0.25, ATH: 0.15 },
        ast: { PAS: 0.25, HAN: 0.15, ATH: 0.10 },
        stl: { PDEF: 0.40, ATH: 0.20, HAN: 0.15 },
        blk: { BLK: 0.35, IDEF: 0.25, ATH: 0.10 },
        tov: { HAN: -0.30, PAS: -0.25, ATH: -0.15 },
      },
      PF: {
        pts: { FIN: 0.32, DNK: 0.18, MID: 0.15, threePT: 0.12, STR: 0.13, ATH: 0.10 },
        reb: { REB: 0.45, STR: 0.25, ATH: 0.15, IDEF: 0.15 },
        ast: { PAS: 0.15, HAN: 0.08, ATH: 0.05 },
        stl: { PDEF: 0.30, ATH: 0.15, HAN: 0.10 },
        blk: { BLK: 0.40, IDEF: 0.30, ATH: 0.10 },
        tov: { STR: -0.20, HAN: -0.20, PAS: -0.15 },
      },
      C: {
        pts: { FIN: 0.35, DNK: 0.20, MID: 0.12, STR: 0.15, threePT: 0.08, ATH: 0.10 },
        reb: { REB: 0.50, STR: 0.25, ATH: 0.10, IDEF: 0.15 },
        ast: { PAS: 0.15, HAN: 0.08, ATH: 0.05 },
        stl: { PDEF: 0.20, ATH: 0.10, HAN: 0.08 },
        blk: { BLK: 0.45, IDEF: 0.30, ATH: 0.08 },
        tov: { STR: -0.20, HAN: -0.15, PAS: -0.10 },
      },
    },

    /** 数据随机浮动范围 */
    RANDOM_RANGE: 0.20,
  },

  /** 奖项判定阈值 */
  AWARDS: {
    MVP:       { stat: 'pts', weight: 0.6, teamWeight: 0.4 },
    DPOY:      { stat: 'blk', weight: 0.4, teamWeight: 0.3, secondary: 'stl', weight2: 0.3 },
    SCORING:   { stat: 'pts', weight: 1.0 },
    CLUTCH:    { stat: 'clutch_pct', weight: 1.0 },
    ROOKIE:    { stat: 'pts', weight: 0.6, teamWeight: 0.4 },
  },

  // ============================================================
  // 5. 联盟结构 — NBA东西部+分区
  // ============================================================
  CONFERENCE: {
    EAST: ['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS'],
    WEST: ['DAL','DEN','GSW','HOU','LAC','LAL','MEM','MIN','NOP','OKC','PHX','POR','SAC','SAS','UTA'],
  },

  DIVISIONS: {
    Atlantic:    ['BOS','NYK','PHI','TOR','BKN'],
    Central:     ['CHI','CLE','DET','IND','MIL'],
    Southeast:   ['ATL','CHA','MIA','ORL','WAS'],
    Northwest:   ['DEN','MIN','OKC','POR','UTA'],
    Pacific:     ['GSW','LAC','LAL','PHX','SAC'],
    Southwest:   ['DAL','HOU','MEM','NOP','SAS'],
  },

  /** 各球队缩写→全名 */
  TEAM_NAMES: {
    ATL:'老鹰', BOS:'凯尔特人', BKN:'篮网', CHA:'黄蜂', CHI:'公牛',
    CLE:'骑士', DAL:'独行侠', DEN:'掘金', DET:'活塞', GSW:'勇士',
    HOU:'火箭', IND:'步行者', LAC:'快船', LAL:'湖人', MEM:'灰熊',
    MIA:'热火', MIL:'雄鹿', MIN:'森林狼', NOP:'鹈鹕', NYK:'尼克斯',
    OKC:'雷霆', ORL:'魔术', PHI:'76人', PHX:'太阳', POR:'开拓者',
    SAC:'国王', SAS:'马刺', TOR:'猛龙', UTA:'爵士', WAS:'奇才',
  },

  // ============================================================
  // 6. 新模拟引擎参数
  // ============================================================
  /** 比赛节奏 — 决定每队场均回合数 */
  PACE: {
    base: 100,          // 联盟平均节奏
    teamRange: 8,       // 各队节奏差异 ±8
  },

  /** 命中率基准（基于属性） */
  SHOOTING: {
    threePT: { base: 0.36, attrFactor: 0.0025, max: 0.45, min: 0.28 },
    MID:     { base: 0.42, attrFactor: 0.0025, max: 0.52, min: 0.32 },
    FIN:     { base: 0.58, attrFactor: 0.0025, max: 0.70, min: 0.45 },
    FT:      { base: 0.75, attrFactor: 0.0020, max: 0.90, min: 0.55 },
  },

  /** 投篮分布（各位置出手占比） */
  SHOT_DIST: {
    PG: { threePT: 0.35, MID: 0.25, FIN: 0.25, FT: 0.15 },
    SG: { threePT: 0.38, MID: 0.22, FIN: 0.22, FT: 0.18 },
    SF: { threePT: 0.30, MID: 0.20, FIN: 0.30, FT: 0.20 },
    PF: { threePT: 0.20, MID: 0.18, FIN: 0.38, FT: 0.24 },
    C:  { threePT: 0.08, MID: 0.18, FIN: 0.48, FT: 0.25 },
  },

  /** 每节时长（秒）*/
  QUARTER_SECONDS: 720,

  /** 节奏事件 */
  MOMENTUM: {
    /** 最大 momentum 加成 */
    maxBonus: 1.15,
    /** 每节 momentum 衰减 */
    decayPerQuarter: 0.3,
    /** 大比分领先时的松懈 */
    complacencyThreshold: 15,
    complacencyFactor: 0.92,
  },
};

// 确保 SIM_CONFIG 全局可用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SIM_CONFIG;
}
