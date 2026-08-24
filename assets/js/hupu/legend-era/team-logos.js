// ============================================================
// team-logos.js —— 历史时代球队图标（按年份变化去重，1984 起）
// 现代名单用 assets/team_logos/<code>.png（每队最新年代图标，2026-07 由 sportslogos.net 高清版替换）；
// 历史模式按时代年份取当年队标：每队保留“1984 时在用的版本”+1984 后所有换标版（sportslogos.net 高清版，v=3）。
// ============================================================

var HIST_LOGO_CHANGES = {
  'ATL': { 1973: './assets/team_logos/hist/ATL_1973.png?v=3', 1996: './assets/team_logos/hist/ATL_1996.png?v=3', 2008: './assets/team_logos/hist/ATL_2008.png?v=3', 2016: './assets/team_logos/hist/ATL_2016.png?v=3', 2021: './assets/team_logos/hist/ATL_2021.png?v=3' },
  'BOS': { 1970: './assets/team_logos/hist/BOS_1970.png?v=3', 1997: './assets/team_logos/hist/BOS_1997.png?v=3' },
  'BRK': { 2013: './assets/team_logos/hist/BRK_2013.png?v=3', 2025: './assets/team_logos/hist/BRK_2025.png?v=3' },
  'CHA': { 2005: './assets/team_logos/hist/CHA_2005.png?v=3', 2008: './assets/team_logos/hist/CHA_2008.png?v=3', 2013: './assets/team_logos/hist/CHA_2013.png?v=3' },
  'CHH': { 1989: './assets/team_logos/hist/CHH_1989.png?v=3' },
  'CHI': { 1967: './assets/team_logos/hist/CHI_1967.png?v=3' },
  'CHO': { 2015: './assets/team_logos/hist/CHO_2015.png?v=3' },
  'CLE': { 1984: './assets/team_logos/hist/CLE_1984.png?v=3', 1995: './assets/team_logos/hist/CLE_1995.png?v=3', 2004: './assets/team_logos/hist/CLE_2004.png?v=3', 2011: './assets/team_logos/hist/CLE_2011.png?v=3', 2018: './assets/team_logos/hist/CLE_2018.png?v=3', 2023: './assets/team_logos/hist/CLE_2023.png?v=3' },
  'DAL': { 1981: './assets/team_logos/hist/DAL_1981.png?v=3', 1994: './assets/team_logos/hist/DAL_1994.png?v=3', 2002: './assets/team_logos/hist/DAL_2002.png?v=3', 2018: './assets/team_logos/hist/DAL_2018.png?v=3' },
  'DEN': { 1982: './assets/team_logos/hist/DEN_1982.png?v=3', 1994: './assets/team_logos/hist/DEN_1994.png?v=3', 2004: './assets/team_logos/hist/DEN_2004.png?v=3', 2009: './assets/team_logos/hist/DEN_2009.png?v=3', 2019: './assets/team_logos/hist/DEN_2019.png?v=3' },
  'DET': { 1979: './assets/team_logos/hist/DET_1979.png?v=3', 1997: './assets/team_logos/hist/DET_1997.png?v=3', 2002: './assets/team_logos/hist/DET_2002.png?v=3', 2006: './assets/team_logos/hist/DET_2006.png?v=3', 2018: './assets/team_logos/hist/DET_2018.png?v=3' },
  'GSW': { 1976: './assets/team_logos/hist/GSW_1976.png?v=3', 1989: './assets/team_logos/hist/GSW_1989.png?v=3', 1998: './assets/team_logos/hist/GSW_1998.png?v=3', 2011: './assets/team_logos/hist/GSW_2011.png?v=3', 2020: './assets/team_logos/hist/GSW_2020.png?v=3' },
  'HOU': { 1973: './assets/team_logos/hist/HOU_1973.png?v=3', 1992: './assets/team_logos/hist/HOU_1992.png?v=3', 1996: './assets/team_logos/hist/HOU_1996.png?v=3', 2004: './assets/team_logos/hist/HOU_2004.png?v=3', 2020: './assets/team_logos/hist/HOU_2020.png?v=3', 2027: './assets/team_logos/hist/HOU_2027.png?v=3' },
  'IND': { 1977: './assets/team_logos/hist/IND_1977.png?v=3', 1991: './assets/team_logos/hist/IND_1991.png?v=3', 2006: './assets/team_logos/hist/IND_2006.png?v=3', 2018: './assets/team_logos/hist/IND_2018.png?v=3', 2026: './assets/team_logos/hist/IND_2026.png?v=3' },
  'KCK': { 1976: './assets/team_logos/hist/KCK_1976.png?v=3' },
  'LAC': { 1985: './assets/team_logos/hist/LAC_1985.png?v=3', 2011: './assets/team_logos/hist/LAC_2011.png?v=3', 2016: './assets/team_logos/hist/LAC_2016.png?v=3', 2019: './assets/team_logos/hist/LAC_2019.png?v=3', 2025: './assets/team_logos/hist/LAC_2025.png?v=3' },
  'LAL': { 1976: './assets/team_logos/hist/LAL_1976.png?v=3', 2000: './assets/team_logos/hist/LAL_2000.png?v=3', 2018: './assets/team_logos/hist/LAL_2018.png?v=3', 2024: './assets/team_logos/hist/LAL_2024.png?v=3' },
  'MEM': { 2002: './assets/team_logos/hist/MEM_2002.png?v=3', 2005: './assets/team_logos/hist/MEM_2005.png?v=3', 2019: './assets/team_logos/hist/MEM_2019.png?v=3' },
  'MIA': { 1989: './assets/team_logos/hist/MIA_1989.png?v=3', 2000: './assets/team_logos/hist/MIA_2000.png?v=3' },
  'MIL': { 1969: './assets/team_logos/hist/MIL_1969.png?v=3', 1994: './assets/team_logos/hist/MIL_1994.png?v=3', 2007: './assets/team_logos/hist/MIL_2007.png?v=3', 2016: './assets/team_logos/hist/MIL_2016.png?v=3' },
  'MIN': { 1990: './assets/team_logos/hist/MIN_1990.png?v=3', 1997: './assets/team_logos/hist/MIN_1997.png?v=3', 2009: './assets/team_logos/hist/MIN_2009.png?v=3', 2018: './assets/team_logos/hist/MIN_2018.png?v=3', 2027: './assets/team_logos/hist/MIN_2027.png?v=3' },
  'NJN': { 1979: './assets/team_logos/hist/NJN_1979.png?v=3', 1991: './assets/team_logos/hist/NJN_1991.png?v=3', 1998: './assets/team_logos/hist/NJN_1998.png?v=3' },
  'NOH': { 2003: './assets/team_logos/hist/NOH_2003.png?v=3', 2008: './assets/team_logos/hist/NOH_2008.png?v=3', 2009: './assets/team_logos/hist/NOH_2009.png?v=3' },
  'NOP': { 2014: './assets/team_logos/hist/NOP_2014.png?v=3', 2024: './assets/team_logos/hist/NOP_2024.png?v=3' },
  'NYK': { 1984: './assets/team_logos/hist/NYK_1984.png?v=3', 1990: './assets/team_logos/hist/NYK_1990.png?v=3', 1993: './assets/team_logos/hist/NYK_1993.png?v=3', 1996: './assets/team_logos/hist/NYK_1996.png?v=3', 2012: './assets/team_logos/hist/NYK_2012.png?v=3', 2023: './assets/team_logos/hist/NYK_2023.png?v=3', 2024: './assets/team_logos/hist/NYK_2024.png?v=3' },
  'OKC': { 2009: './assets/team_logos/hist/OKC_2009.png?v=3' },
  'ORL': { 1990: './assets/team_logos/hist/ORL_1990.png?v=3', 1999: './assets/team_logos/hist/ORL_1999.png?v=3', 2001: './assets/team_logos/hist/ORL_2001.png?v=3', 2011: './assets/team_logos/hist/ORL_2011.png?v=3', 2026: './assets/team_logos/hist/ORL_2026.png?v=3' },
  'PHI': { 1978: './assets/team_logos/hist/PHI_1978.png?v=3', 1998: './assets/team_logos/hist/PHI_1998.png?v=3', 2010: './assets/team_logos/hist/PHI_2010.png?v=3', 2016: './assets/team_logos/hist/PHI_2016.png?v=3' },
  'PHO': { 1969: './assets/team_logos/hist/PHO_1969.png?v=3', 1993: './assets/team_logos/hist/PHO_1993.png?v=3', 2001: './assets/team_logos/hist/PHO_2001.png?v=3', 2014: './assets/team_logos/hist/PHO_2014.png?v=3' },
  'POR': { 1971: './assets/team_logos/hist/POR_1971.png?v=3', 1991: './assets/team_logos/hist/POR_1991.png?v=3', 2003: './assets/team_logos/hist/POR_2003.png?v=3', 2004: './assets/team_logos/hist/POR_2004.png?v=3', 2005: './assets/team_logos/hist/POR_2005.png?v=3', 2018: './assets/team_logos/hist/POR_2018.png?v=3' },
  'SAC': { 1986: './assets/team_logos/hist/SAC_1986.png?v=3', 1995: './assets/team_logos/hist/SAC_1995.png?v=3', 2017: './assets/team_logos/hist/SAC_2017.png?v=3' },
  'SAS': { 1977: './assets/team_logos/hist/SAS_1977.png?v=3', 1990: './assets/team_logos/hist/SAS_1990.png?v=3', 2003: './assets/team_logos/hist/SAS_2003.png?v=3', 2018: './assets/team_logos/hist/SAS_2018.png?v=3' },
  'SDC': { 1983: './assets/team_logos/hist/SDC_1983.png?v=3' },
  'SEA': { 1976: './assets/team_logos/hist/SEA_1976.png?v=3', 1996: './assets/team_logos/hist/SEA_1996.png?v=3', 2002: './assets/team_logos/hist/SEA_2002.png?v=3' },
  'TOR': { 1996: './assets/team_logos/hist/TOR_1996.png?v=3', 2009: './assets/team_logos/hist/TOR_2009.png?v=3', 2016: './assets/team_logos/hist/TOR_2016.png?v=3', 2021: './assets/team_logos/hist/TOR_2021.png?v=3' },
  'UTA': { 1980: './assets/team_logos/hist/UTA_1980.png?v=3', 1997: './assets/team_logos/hist/UTA_1997.png?v=3', 2005: './assets/team_logos/hist/UTA_2005.png?v=3', 2011: './assets/team_logos/hist/UTA_2011.png?v=3', 2017: './assets/team_logos/hist/UTA_2017.png?v=3', 2023: './assets/team_logos/hist/UTA_2023.png?v=3', 2026: './assets/team_logos/hist/UTA_2026.png?v=3' },
  'VAN': { 1996: './assets/team_logos/hist/VAN_1996.png?v=3' },
  'WAS': { 1998: './assets/team_logos/hist/WAS_1998.png?v=3', 2008: './assets/team_logos/hist/WAS_2008.png?v=3', 2012: './assets/team_logos/hist/WAS_2012.png?v=3', 2016: './assets/team_logos/hist/WAS_2016.png?v=3' },
  'WSB': { 1975: './assets/team_logos/hist/WSB_1975.png?v=3', 1988: './assets/team_logos/hist/WSB_1988.png?v=3' },
};

var HIST_TEAM_CHAIN = {
  'BKN': [ {from:0,to:2012,code:'NJN'}, {from:2013,to:9999,code:'BRK'} ],
  'CHA': [ {from:0,to:2002,code:'CHH'}, {from:2003,to:2014,code:'CHA'}, {from:2015,to:9999,code:'CHO'} ],
  'LAC': [ {from:0,to:1984,code:'SDC'}, {from:1985,to:9999,code:'LAC'} ],
  'MEM': [ {from:0,to:2001,code:'VAN'}, {from:2002,to:9999,code:'MEM'} ],
  'NOP': [ {from:0,to:2013,code:'NOH'}, {from:2014,to:9999,code:'NOP'} ],
  'OKC': [ {from:0,to:2008,code:'SEA'}, {from:2009,to:9999,code:'OKC'} ],
  'PHX': [ {from:0,to:9999,code:'PHO'} ],
  'SAC': [ {from:0,to:1985,code:'KCK'}, {from:1986,to:9999,code:'SAC'} ],
  'WAS': [ {from:1964,to:1973,code:'BAL'}, {from:1974,to:1997,code:'WSB'}, {from:1998,to:9999,code:'WAS'} ],
};

/** 历史时代年份对应的球队图标路径（yearOverride 用于档案等按“指定年份”解析；无则返回 null 交给现代图标兜底） */
function getEraTeamLogo(team, yearOverride) {
  try {
    var yr = yearOverride != null ? parseInt(yearOverride, 10)
      : ((typeof getEraSeasonYear === 'function')
        ? getEraSeasonYear(parseInt((STATE && STATE.eraStart) || 1984, 10), ((STATE && STATE.career && STATE.career.seasonCount) || 0))
        : 1984);
    var chain = HIST_TEAM_CHAIN[team] || [{ from: 0, to: 9999, code: team }];
    var code = null, bestFrom = -1;
    for (var i = 0; i < chain.length; i++) {
      if (yr >= chain[i].from && yr <= chain[i].to) { code = chain[i].code; break; }
      if (chain[i].from <= yr && chain[i].from > bestFrom) { code = chain[i].code; bestFrom = chain[i].from; }
    }
    if (!code && chain.length) code = chain[0].code;
    var years = HIST_LOGO_CHANGES[code];
    if (!years) return null;
    var keys = Object.keys(years).map(Number).sort(function(a, b) { return a - b; });
    var pick = keys[0];
    for (var k = 0; k < keys.length; k++) { if (keys[k] <= yr) pick = keys[k]; else break; }
    return years[pick];
  } catch(e) { return null; }
}
