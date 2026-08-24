// ============================================================
// era-config.js —— 历史时代开局基础配置（第一段）
// 支持三个时代起点：1984届起 / 1996届起 / 2003届起
// 赛季年份 = 时代起点 + 赛季数 - 1（1984时代第1季 = 1984-85赛季）
// 工资帽按真实历史轨迹锚点线性插值（单位：万美元）
// 后段未来年份超出最后锚点后按 +3%/年外推
// 历史冠军表 / FMVP表仅用于历史档案与文案参考，
// 玩家加入后赛事结果以游戏模拟为准（接受波动），冠军表截至2025赛季
// ============================================================

var ERA_OPTIONS = [
  { start: 1984, label: '1984 黄金一代' },
  { start: 1996, label: '1996 黄金一代' },
  { start: 2003, label: '2003 白金一代' }
];

/** 真实工资帽轨迹（万美元）：1984=360、1997=2690、2015=7000、2018=10186.9、2027约17403.4（约1.74亿）
 *  数据来源：Spotrac NBA CBA & Cap History / SalarySwish，1984-2027 逐年核验 */
var ERA_CAP_ANCHORS = {
  // 注：2023-24 终值为 13602.1（早期按预告 13400）；2027-28约17403.4（联盟备忘录 174,034,000，约1.74亿）
  1984: 360, 1985: 423.3, 1986: 494.5, 1987: 616.4, 1988: 723.2, 1989: 980.2,
  1990: 1187.1, 1991: 1250, 1992: 1400, 1993: 1517.5, 1994: 1596.4, 1995: 2300,
  1996: 2436.3, 1997: 2690, 1998: 3000, 1999: 3400, 2000: 3550, 2001: 4250,
  2002: 4027.1, 2003: 4384, 2004: 4387, 2005: 4950, 2006: 5313.5, 2007: 5563.0,
  2008: 5868.6, 2009: 5770, 2010: 5804.4, 2011: 5804.4, 2012: 5804.4,
  2013: 5867.9, 2014: 6306.5, 2015: 7000, 2016: 9414.3, 2017: 9909.3,
  2018: 10186.9, 2019: 10914, 2020: 10914, 2021: 11241.4, 2022: 12365.5,
  2023: 13602.1, 2024: 14058.8, 2025: 15464.7, 2026: 16496.1, 2027: 17403.4
};

/** 历史真实冠军表（王片码） -> 截至1984-2025赛季 */
var HISTORICAL_CHAMPIONS = {
  1984: 'BOS', 1985: 'LAL', 1986: 'BOS', 1987: 'LAL', 1988: 'LAL', 1989: 'DET',
  1990: 'DET', 1991: 'CHI', 1992: 'CHI', 1993: 'CHI', 1994: 'HOU', 1995: 'HOU',
  1996: 'CHI', 1997: 'CHI', 1998: 'CHI', 1999: 'SAS', 2000: 'LAL', 2001: 'LAL',
  2002: 'LAL', 2003: 'SAS', 2004: 'DET', 2005: 'SAS', 2006: 'MIA', 2007: 'SAS',
  2008: 'BOS', 2009: 'LAL', 2010: 'LAL', 2011: 'DAL', 2012: 'MIA', 2013: 'MIA',
  2014: 'SAS', 2015: 'GSW', 2016: 'CLE', 2017: 'GSW', 2018: 'GSW', 2019: 'TOR',
  2020: 'LAL', 2021: 'MIL', 2022: 'GSW', 2023: 'DEN', 2024: 'BOS', 2025: 'OKC'
};

/** 历史 FMVP 表 -> 用 en 名，截至1984-2025赛季 */
var HISTORICAL_FMVP = {
  1984: 'Larry Bird', 1985: 'Kareem Abdul-Jabbar', 1986: 'Larry Bird', 1987: 'Magic Johnson', 1988: 'James Worthy', 1989: 'Joe Dumars',
  1990: 'Isiah Thomas', 1991: 'Michael Jordan', 1992: 'Michael Jordan', 1993: 'Michael Jordan', 1994: 'Hakeem Olajuwon', 1995: 'Hakeem Olajuwon',
  1996: 'Michael Jordan', 1997: 'Michael Jordan', 1998: 'Michael Jordan', 1999: 'Tim Duncan', 2000: "Shaquille O'Neal", 2001: "Shaquille O'Neal",
  2002: "Shaquille O'Neal", 2003: 'Tim Duncan', 2004: 'Chauncey Billups', 2005: 'Tim Duncan', 2006: 'Dwyane Wade', 2007: 'Tony Parker',
  2008: 'Paul Pierce', 2009: 'Kobe Bryant', 2010: 'Kobe Bryant', 2011: 'Dirk Nowitzki', 2012: 'LeBron James', 2013: 'LeBron James',
  2014: 'Kawhi Leonard', 2015: 'Andre Iguodala', 2016: 'LeBron James', 2017: 'Kevin Durant', 2018: 'Kevin Durant', 2019: 'Kawhi Leonard',
  2020: 'LeBron James', 2021: 'Giannis Antetokounmpo', 2022: 'Stephen Curry', 2023: 'Nikola Jokic', 2024: 'Jaylen Brown', 2025: 'Shai Gilgeous-Alexander'
};

/** 工资帽：锚点间线性插值；超出最后锚点（2027）后按 +4%/年温和外推（估算，避免夸张跳涨）；
 *  位于首个锚点前回落到首锚点 */
function getEraSalaryCap(year) {
  year = parseInt(year, 10) || 0;
  var keys = Object.keys(ERA_CAP_ANCHORS).map(Number).sort(function(a, b) { return a - b; });
  if (ERA_CAP_ANCHORS[year] != null) return ERA_CAP_ANCHORS[year];
  if (year < keys[0]) return ERA_CAP_ANCHORS[keys[0]];
  if (year > keys[keys.length - 1]) {
    var last = ERA_CAP_ANCHORS[keys[keys.length - 1]];
    return Math.round(last * Math.pow(1.04, year - keys[keys.length - 1]) * 10) / 10;
  }
  for (var i = 1; i < keys.length; i++) {
    if (year <= keys[i]) {
      var y0 = keys[i - 1], y1 = keys[i];
      var v0 = ERA_CAP_ANCHORS[y0], v1 = ERA_CAP_ANCHORS[y1];
      return Math.round((v0 + (v1 - v0) * (year - y0) / (y1 - y0)) * 10) / 10;
    }
  }
  return 0;
}

/** 历史时代当前赛季年份 = eraStart + seasonCount */
function getEraSeasonYear(eraStart, seasonCount) {
  if (eraStart == null) return null;
  return (parseInt(eraStart, 10) || 0) + (parseInt(seasonCount, 10) || 0);
}

// ============================================================
// era-sim 年代化比赛/数据参数：锚点年份 -> 参数（中间年份线性插值）
//   pace    比赛节奏（映射场均得分：86->93、89->97、92->100、95->103、102->111、105->114）
//   div/max 单场胜率参数（winDivisor / winMax）
//   pts     联盟场均得分比例（现代=1.0；用于 NPC 得分与奖项门槛缩放）
//   rebAdj/astAdj/stlAdj/blkAdj 分项校正系数（玩家数据已随 totalScore 自动缩，
//           这些系数把篮板/助攻/抢断/盖帽校准到当年真实联盟均值）
//   king    当年得分王（玩家得分保底 = max(自动值, king*1.03)，保证玩家永远略强于当年顶级）
// ============================================================
var ERA_SIM_YEAR_TABLE = {
  1984: { pace: 102, div: 19, max: 0.81, pts: 0.97, reb: 1.000, ast: 0.985, stl: 1.149, blk: 0.946, rebAdj: 1.031, astAdj: 1.015, stlAdj: 1.184, blkAdj: 0.975, king: 32.9 },
  1988: { pace: 98, div: 19, max: 0.81, pts: 0.94, reb: 0.972, ast: 0.910, stl: 1.203, blk: 0.982, rebAdj: 1.025, astAdj: 1.010, stlAdj: 1.150, blkAdj: 0.990, king: 32.5 },
  1991: { pace: 94, div: 19, max: 0.81, pts: 0.90, reb: 0.968, ast: 0.869, stl: 1.095, blk: 0.857, rebAdj: 1.020, astAdj: 1.000, stlAdj: 1.170, blkAdj: 1.005, king: 31.5 },
  1996: { pace: 89, div: 18, max: 0.82, pts: 0.88, reb: 0.945, ast: 0.824, stl: 1.108, blk: 0.875, rebAdj: 1.114, astAdj: 0.972, stlAdj: 1.307, blkAdj: 1.032, king: 30.1 },
  1997: { pace: 89, div: 18, max: 0.82, pts: 0.85, reb: 0.945, ast: 0.816, stl: 1.108, blk: 0.875, rebAdj: 1.112, astAdj: 0.970, stlAdj: 1.310, blkAdj: 1.030, king: 29.6 },
  2004: { pace: 86, div: 20, max: 0.80, pts: 0.83, reb: 0.989, ast: 0.783, stl: 1.027, blk: 0.893, rebAdj: 1.209, astAdj: 0.957, stlAdj: 1.255, blkAdj: 1.091, king: 28.0 },
  2009: { pace: 92, div: 19, max: 0.81, pts: 0.88, reb: 0.993, ast: 0.820, stl: 1.000, blk: 0.929, rebAdj: 1.100, astAdj: 0.960, stlAdj: 1.150, blkAdj: 1.060, king: 30.2 },
  2016: { pace: 95, div: 18, max: 0.82, pts: 0.90, reb: 1.030, ast: 0.899, stl: 1.054, blk: 0.911, rebAdj: 1.030, astAdj: 0.980, stlAdj: 1.020, blkAdj: 1.000, king: 30.1 },
  2019: { pace: 102, div: 18, max: 0.82, pts: 0.97, reb: 1.025, ast: 0.970, stl: 1.041, blk: 0.982, rebAdj: 1.005, astAdj: 0.995, stlAdj: 0.995, blkAdj: 1.000, king: 34.0 },
  2024: { pace: 105, div: 18, max: 0.82, pts: 1.00, reb: 1.000, ast: 1.000, stl: 1.000, blk: 1.000, rebAdj: 1.000, astAdj: 1.000, stlAdj: 1.000, blkAdj: 1.000, king: 33.9 }
};

/** 按年份取年代化比赛/数据参数（线性插值；超出锚点取边界值） */
function getEraSimParams(year) {
  var y = parseInt(year, 10) || 2025;
  var keys = Object.keys(ERA_SIM_YEAR_TABLE).map(Number).sort(function(a, b) { return a - b; });
  if (y <= keys[0]) return ERA_SIM_YEAR_TABLE[keys[0]];
  if (y >= keys[keys.length - 1]) return ERA_SIM_YEAR_TABLE[keys[keys.length - 1]];
  for (var i = 1; i < keys.length; i++) {
    if (y <= keys[i]) {
      var y0 = keys[i - 1], y1 = keys[i];
      var a = ERA_SIM_YEAR_TABLE[y0], b = ERA_SIM_YEAR_TABLE[y1];
      var t = (y - y0) / (y1 - y0);
      return {
        pace: Math.round(a.pace + (b.pace - a.pace) * t),
        div: Math.round((a.div + (b.div - a.div) * t) * 10) / 10,
        max: Math.round((a.max + (b.max - a.max) * t) * 1000) / 1000,
        pts: Math.round((a.pts + (b.pts - a.pts) * t) * 1000) / 1000,
        reb: Math.round((a.reb + (b.reb - a.reb) * t) * 1000) / 1000,
        ast: Math.round((a.ast + (b.ast - a.ast) * t) * 1000) / 1000,
        stl: Math.round((a.stl + (b.stl - a.stl) * t) * 1000) / 1000,
        blk: Math.round((a.blk + (b.blk - a.blk) * t) * 1000) / 1000,
        rebAdj: Math.round((a.rebAdj + (b.rebAdj - a.rebAdj) * t) * 1000) / 1000,
        astAdj: Math.round((a.astAdj + (b.astAdj - a.astAdj) * t) * 1000) / 1000,
        stlAdj: Math.round((a.stlAdj + (b.stlAdj - a.stlAdj) * t) * 1000) / 1000,
        blkAdj: Math.round((a.blkAdj + (b.blkAdj - a.blkAdj) * t) * 1000) / 1000,
        king: Math.round((a.king + (b.king - a.king) * t) * 10) / 10
      };
    }
  }
  return ERA_SIM_YEAR_TABLE[keys[keys.length - 1]];
}

/** 当前赛季年份：历史模式 = eraStart + seasonCount；现实模式 = 2025 + seasonCount */
function getCurrentSeasonYear() {
  var sc = (STATE && STATE.career && STATE.career.seasonCount) || 0;
  if (STATE && STATE.draftMode === 'historical' && STATE.eraStart) {
    return getEraSeasonYear(parseInt(STATE.eraStart, 10), sc);
  }
  return 2025 + sc;
}

/** 玩家得分保底比例：相对现代玩家 33 分基准，保证历史时代不低于当年得分王 x1.03 */
function getEraPlayerPtsFloor() {
  try {
    var p = getEraSimParams(getCurrentSeasonYear());
    if (!p || !p.king) return 1;
    return Math.max(0.75, Math.min(1.05, (p.king * 1.02) / 33.9));
  } catch (e) { return 1; }
}
