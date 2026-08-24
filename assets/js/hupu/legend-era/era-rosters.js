// ============================================================
// era-rosters.js —— 历史时代名单与联盟演化（阶段 2）
// 三套时代名单：1984 / 1996 / 2003
// 名单组成：真实核心球员（历史模板 + 新秀库 + 本文件补充）
//        + 各队角色球员（按时代水平生成）+ 当届真实新秀（预载）
// 联盟演化：1984时代 23 队起，1988 加入黄蜂/热火，1989 加入森林狼/魔术，
//   1995 加入猛龙/灰熊，2002 加入新奥尔良，2004 加入山猫拉满 30 队；
//   1996/年代开局 29 队，2003 时代开局 29 队（山猫 2004 加入）
// ============================================================

/** 各时代角色球员 OVR 范围 */
var ERA_ROLE_RANGES = { 1984: [58, 74], 1996: [60, 76], 2003: [63, 79] };
var ERA_ROSTER_SIZE = 14;

/** 时代球员属性模板：位置 × OVR 85 基准（13 项，风格参考原版 NBA2K 数据）
 *  生成公式：attr = clamp(30, 99, base + (ovr - 85) * 0.65 + 位置特色 ± 随机)
 *  高 OVR 球星各属性更全面，位置特色（中锋篮板/盖帽、控卫组织等）始终保留。
 */
var ERA_ATTR_TEMPLATES = {
  PG: { threePT: 80, MID: 84, FIN: 84, DNK: 60, HAN: 92, PAS: 94, PDEF: 78, IDEF: 64, BLK: 42, REB: 55, ATH: 84, STR: 55, CLU: 86 },
  SG: { threePT: 86, MID: 86, FIN: 86, DNK: 72, HAN: 86, PAS: 78, PDEF: 76, IDEF: 62, BLK: 44, REB: 52, ATH: 84, STR: 58, CLU: 86 },
  SF: { threePT: 76, MID: 82, FIN: 88, DNK: 86, HAN: 82, PAS: 76, PDEF: 80, IDEF: 76, BLK: 62, REB: 72, ATH: 88, STR: 74, CLU: 80 },
  PF: { threePT: 55, MID: 74, FIN: 88, DNK: 82, HAN: 70, PAS: 62, PDEF: 80, IDEF: 84, BLK: 82, REB: 88, ATH: 80, STR: 90, CLU: 74 },
  C:  { threePT: 42, MID: 72, FIN: 90, DNK: 84, HAN: 60, PAS: 58, PDEF: 80, IDEF: 88, BLK: 88, REB: 92, ATH: 72, STR: 94, CLU: 72 }
};

/**
 * 时代真实角色球员池（避免假人填充历史阵容）。
 * 格式：[en, cn, pos, height, ovr, teamHint?]
 * 来源：各时代真实 NBA 轮换/边缘球员；teamHint 为该球员当季真实主队（可空）。
 * 生成时优先按位置、其次按 teamHint 取用，同一次建联盟不重复。
 */
var ERA_ROLE_POOLS = {
  1984: [
    ['Eddie Johnson', '埃迪-约翰逊', 'SG', '1.91米', 78, 'ATL'],
    ['Antoine Carr', '安托万-卡尔', 'PF', '2.06米', 76, 'ATL'],
    ['Cliff Levingston', '克利夫-莱文斯顿', 'PF', '2.03米', 74, 'ATL'],
    ['Johnny Davis', '约翰尼-戴维斯', 'PG', '1.88米', 75, 'ATL'],
    ['Spud Webb', '斯普德-韦布', 'PG', '1.68米', 78, 'ATL'],
    ['Kevin Willis', '凯文-威利斯', 'PF', '2.13米', 76, 'ATL'],
    ['Cedric Maxwell', '塞德里克-麦克斯韦', 'SF', '2.03米', 80, 'BOS'],
    ['M.L. Carr', 'M.L.-卡尔', 'SF', '1.98米', 72, 'BOS'],
    ['Scott Wedman', '斯科特-韦德曼', 'SF', '2.01米', 78, 'BOS'],
    ['Jerry Sichting', '杰里-西奇廷', 'PG', '1.85米', 76, 'BOS'],
    ['Carlos Clark', '卡洛斯-克拉克', 'SG', '1.96米', 70, 'BOS'],
    ['Rick Carlisle', '里克-卡莱尔', 'PG', '1.96米', 72, 'BOS'],
    ['Albert King', '阿尔伯特-金', 'SF', '1.98米', 78, 'BKN'],
    ['Mike Gminski', '迈克-格明斯基', 'C', '2.11米', 76, 'BKN'],
    ['Kelvin Ransey', '凯尔文-兰西', 'PG', '1.85米', 74, 'BKN'],
    ['Darwin Cook', '达尔文-库克', 'PG', '1.91米', 72, 'BKN'],
    ['Len Elmore', '伦-埃尔莫尔', 'C', '2.06米', 72, 'BKN'],
    ['Jeff Turner', '杰夫-特纳', 'PF', '2.06米', 70, 'BKN'],
    ['Steve Johnson', '史蒂夫-约翰逊', 'PF', '2.08米', 76, 'CHI'],
    ['Wes Matthews', '韦斯-马修斯', 'PG', '1.85米', 74, 'CHI'],
    ['Jawann Oldham', '贾万-奥尔德姆', 'C', '2.13米', 72, 'CHI'],
    ['Gene Banks', '吉恩-班克斯', 'SF', '2.01米', 74, 'CHI'],
    ['Sidney Green', '西德尼-格林', 'PF', '2.06米', 76, 'CHI'],
    ['Ennis Whatley', '恩尼斯-惠特利', 'PG', '1.91米', 72, 'CHI'],
    ['John Bagley', '约翰-巴格利', 'PG', '1.83米', 76, 'CLE'],
    ['Phil Hubbard', '菲尔-哈伯德', 'SF', '2.03米', 74, 'CLE'],
    ['Lonnie Shelton', '朗尼-谢尔顿', 'PF', '2.03米', 76, 'CLE'],
    ['Mel Turpin', '梅尔-特平', 'C', '2.11米', 74, 'CLE'],
    ['Dirk Minniefield', '德克-明尼菲尔德', 'PG', '1.91米', 72, 'CLE'],
    ['Kevin Williams', '凯文-威廉姆斯', 'SG', '1.88米', 70, 'CLE'],
    ['Ben Poquette', '本-波凯特', 'PF', '2.06米', 72, 'CLE'],
    ['Sam Perkins', '萨姆-珀金斯', 'PF', '2.06米', 78, 'DAL'],
    ['Kurt Nimphius', '库尔特-尼姆菲斯', 'C', '2.11米', 74, 'DAL'],
    ['Brad Davis', '布拉德-戴维斯', 'PG', '1.91米', 76, 'DAL'],
    ['Dale Ellis', '戴尔-埃利斯', 'SG', '2.01米', 78, 'DAL'],
    ['Pat Cummings', '帕特-卡明斯', 'PF', '2.06米', 74, 'DAL'],
    ['Bill Wennington', '比尔-温宁顿', 'C', '2.13米', 72, 'DAL'],
    ['Wayne Cooper', '韦恩-库珀', 'C', '2.08米', 76, 'DEN'],
    ['Mike Evans', '迈克-埃文斯', 'PG', '1.85米', 74, 'DEN'],
    ['T.R. Dunn', 'T.R.-邓恩', 'SG', '1.93米', 74, 'DEN'],
    ['Bill Hanzlik', '比尔-汉兹利克', 'SG', '1.98米', 76, 'DEN'],
    ['Elston Turner', '埃尔顿-特纳', 'SG', '1.96米', 72, 'DEN'],
    ['Willie White', '威利-怀特', 'SG', '1.91米', 72, 'DEN'],
    ['John Long', '约翰-朗', 'SG', '1.96米', 76, 'DET'],
    ['Joe Dumars', '乔-杜马斯', 'SG', '1.91米', 80, 'DET'],
    ['Earl Cureton', '厄尔-库雷顿', 'PF', '2.06米', 74, 'DET'],
    ['Tony Campbell', '托尼-坎贝尔', 'SG', '2.01米', 74, 'DET'],
    ['David Thirdkill', '大卫-瑟德基尔', 'SF', '2.01米', 70, 'DET'],
    ['Chuck Nevitt', '查克-内维特', 'C', '2.26米', 68, 'DET'],
    ['Joe Barry Carroll', '乔-巴里-卡罗尔', 'C', '2.16米', 78, 'GSW'],
    ['Larry Smith', '拉里-史密斯', 'PF', '2.03米', 76, 'GSW'],
    ['Mickey Johnson', '米奇-约翰逊', 'PF', '2.08米', 74, 'GSW'],
    ['Lester Conner', '莱斯特-康纳', 'PG', '1.93米', 74, 'GSW'],
    ['Steve Burtt', '史蒂夫-伯特', 'SG', '1.85米', 72, 'GSW'],
    ['Chris Mullin', '克里斯-穆林', 'SF', '2.01米', 76, 'GSW'],
    ['John Lucas', '约翰-卢卡斯', 'PG', '1.91米', 76, 'HOU'],
    ['Allen Leavell', '艾伦-利维尔', 'PG', '1.85米', 74, 'HOU'],
    ['Mitchell Wiggins', '米切尔-威金斯', 'SG', '1.93米', 76, 'HOU'],
    ['Jim Petersen', '吉姆-彼得森', 'PF', '2.08米', 72, 'HOU'],
    ['Hank McDowell', '汉克-麦克道尔', 'PF', '2.06米', 72, 'HOU'],
    ['Steve Stipanovich', '史蒂夫-斯蒂帕诺维奇', 'C', '2.11米', 78, 'IND'],
    ['Vern Fleming', '弗恩-弗莱明', 'PG', '1.96米', 78, 'IND'],
    ['George Johnson', '乔治-约翰逊', 'C', '2.11米', 70, 'IND'],
    ['Terence Stansbury', '特伦斯-斯坦斯伯里', 'SG', '1.96米', 72, 'IND'],
    ['Devin Durrant', '德文-杜兰特', 'SF', '2.01米', 70, 'IND'],
    ['Bill Garnett', '比尔-加内特', 'PF', '2.06米', 72, 'IND'],
    ['Jim Thomas', '吉姆-托马斯', 'SG', '1.91米', 70, 'IND'],
    ['Derek Smith', '德里克-史密斯', 'SF', '1.98米', 76, 'LAC'],
    ['James Donaldson', '詹姆斯-唐纳森', 'C', '2.18米', 76, 'LAC'],
    ['Junior Bridgeman', '朱尼尔-布里奇曼', 'SF', '1.96米', 74, 'LAC'],
    ['Michael Brooks', '迈克尔-布鲁克斯', 'SF', '2.01米', 74, 'LAC'],
    ['Roy White', '罗伊-怀特', 'SF', '2.03米', 72, 'LAC'],
    ['Lancaster Gordon', '兰开斯特-戈登', 'SG', '1.91米', 70, 'LAC'],
    ['Bob McAdoo', '鲍勃-麦卡杜', 'PF', '2.06米', 78, 'LAL'],
    ['Kurt Rambis', '库尔特-兰比斯', 'PF', '2.03米', 76, 'LAL'],
    ['Mitch Kupchak', '米奇-库普切克', 'PF', '2.06米', 74, 'LAL'],
    ['Mike McGee', '迈克-麦基', 'SG', '1.96米', 72, 'LAL'],
    ['Larry Spriggs', '拉里-斯普里格斯', 'SF', '2.01米', 72, 'LAL'],
    ['Earl Jones', '厄尔-琼斯', 'C', '2.13米', 70, 'LAL'],
    ['Alton Lister', '阿尔顿-利斯特', 'C', '2.13米', 76, 'MIL'],
    ['Craig Hodges', '克雷格-霍奇斯', 'PG', '1.91米', 74, 'MIL'],
    ['Randy Breuer', '兰迪-布罗伊尔', 'C', '2.21米', 74, 'MIL'],
    ['Kevin Grevey', '凯文-格雷维', 'SG', '1.96米', 74, 'MIL'],
    ['Kenny Fields', '肯尼-菲尔兹', 'SF', '2.01米', 72, 'MIL'],
    ['Paul Mokeski', '保罗-莫克斯基', 'C', '2.13米', 72, 'MIL'],
    ['Trent Tucker', '特伦特-塔克', 'SG', '1.96米', 74, 'NYK'],
    ['Louis Orr', '路易斯-奥尔', 'SF', '2.03米', 74, 'NYK'],
    ['Darrell Walker', '达雷尔-沃克', 'PG', '1.93米', 74, 'NYK'],
    ['Ernie Grunfeld', '厄尼-格伦菲尔德', 'SG', '1.98米', 72, 'NYK'],
    ['James Bailey', '詹姆斯-贝利', 'PF', '2.06米', 72, 'NYK'],
    ['Ken Bannister', '肯-班尼斯特', 'PF', '2.06米', 70, 'NYK'],
    ['Marvin Webster', '马文-韦伯斯特', 'C', '2.16米', 74, 'NYK'],
    ['Al Wood', '阿尔-伍德', 'SG', '1.98米', 74, 'OKC'],
    ['Danny Vranes', '丹尼-弗雷恩斯', 'SF', '2.01米', 74, 'OKC'],
    ['Frank Brickowski', '弗兰克-布里科夫斯基', 'PF', '2.06米', 74, 'OKC'],
    ['Sedale Threatt', '塞达莱-思雷特', 'PG', '1.88米', 76, 'OKC'],
    ['Tim McCormick', '蒂姆-麦考密克', 'C', '2.16米', 74, 'OKC'],
    ['John Greig', '约翰-格雷格', 'SF', '2.01米', 70, 'OKC'],
    ['Bobby Jones', '博比-琼斯', 'PF', '2.06米', 80, 'PHI'],
    ['Clint Richardson', '克林特-理查森', 'PG', '1.91米', 74, 'PHI'],
    ['Leon Wood', '莱昂-伍德', 'PG', '1.91米', 72, 'PHI'],
    ['Sam Williams', '萨姆-威廉姆斯', 'SF', '2.03米', 72, 'PHI'],
    ['Clemon Johnson', '克莱蒙-约翰逊', 'C', '2.08米', 72, 'PHI'],
    ['Kyle Macy', '凯尔-梅西', 'PG', '1.91米', 76, 'PHX'],
    ['Jay Humphries', '杰伊-汉弗莱斯', 'PG', '1.91米', 74, 'PHX'],
    ['James Edwards', '詹姆斯-爱德华兹', 'C', '2.13米', 78, 'PHX'],
    ['Charles Jones', '查尔斯-琼斯', 'PF', '2.06米', 74, 'PHX'],
    ['Rod Foster', '罗德-福斯特', 'PG', '1.85米', 74, 'PHX'],
    ['Mike Sanders', '迈克-桑德斯', 'SF', '1.98米', 72, 'PHX'],
    ['Mychal Thompson', '迈克尔-汤普森', 'PF', '2.08米', 80, 'POR'],
    ['Steve Colter', '史蒂夫-科尔特', 'PG', '1.91米', 74, 'POR'],
    ['Kenny Carr', '肯尼-卡尔', 'PF', '2.01米', 76, 'POR'],
    ['Darnell Valentine', '达内尔-瓦伦丁', 'PG', '1.85米', 74, 'POR'],
    ['Sam Bowie', '萨姆-鲍伊', 'C', '2.16米', 78, 'POR'],
    ['Otis Thorpe', '奥蒂斯-索普', 'PF', '2.06米', 78, 'SAC'],
    ['Mike Woodson', '迈克-伍德森', 'SG', '1.96米', 76, 'SAC'],
    ['Mark Olberding', '马克-奥尔伯丁', 'PF', '2.03米', 74, 'SAC'],
    ['Larry Drew', '拉里-德鲁', 'PG', '1.85米', 74, 'SAC'],
    ['Carl Henry', '卡尔-亨利', 'SF', '1.98米', 70, 'SAC'],
    ['Joe Meriweather', '乔-梅里韦瑟', 'C', '2.08米', 72, 'SAC'],
    ['Johnny Moore', '约翰尼-摩尔', 'PG', '1.85米', 76, 'SAS'],
    ['Alvin Robertson', '阿尔文-罗伯特森', 'SG', '1.91米', 80, 'SAS'],
    ['Jeff Cook', '杰夫-库克', 'PF', '2.08米', 74, 'SAS'],
    ['Marc Iavaroni', '马克-伊瓦罗尼', 'PF', '2.03米', 74, 'SAS'],
    ['Ed Nealy', '埃德-尼利', 'PF', '2.01米', 72, 'SAS'],
    ['Ozell Jones', '奥泽尔-琼斯', 'PF', '2.11米', 70, 'SAS'],
    ['John Stockton', '约翰-斯托克顿', 'PG', '1.85米', 80, 'UTA'],
    ['Rickey Green', '里基-格林', 'PG', '1.85米', 76, 'UTA'],
    ['Bob Hansen', '鲍勃-汉森', 'SG', '1.96米', 74, 'UTA'],
    ['Jeff Wilkins', '杰夫-威尔金斯', 'PF', '2.11米', 72, 'UTA'],
    ['Pace Mannion', '佩斯-曼尼恩', 'SG', '2.01米', 70, 'UTA'],
    ['Dan Roundfield', '丹-朗德菲尔德', 'PF', '2.03米', 78, 'WAS'],
    ['Dudley Bradley', '达德利-布拉德利', 'SG', '1.98米', 74, 'WAS'],
    ['Greg Ballard', '格雷格-巴拉德', 'SF', '2.01米', 74, 'WAS'],
    ['Tom McMillen', '汤姆-麦克米伦', 'PF', '2.11米', 74, 'WAS'],
    ['Darren Daye', '达伦-达耶', 'SF', '2.03米', 72, 'WAS'],
    ['Jerome Kersey', '杰罗姆-科西', 'SF', '2.01米', 76, 'POR'],
    ['Dan Schayes', '丹-谢伊斯', 'PF', '2.11米', 74, 'DEN'],
    ['Larry Micheaux', '拉里-米肖', 'PF', '2.06米', 70, 'LAC'],
    ['Eddie Lee Wilkins', '埃迪-李-威尔金斯', 'PF', '2.08米', 72, 'NYK'],
    ['Mark West', '马克-韦斯特', 'PF', '2.08米', 74, 'CLE'],
    ['Terry Teagle', '特里-蒂格尔', 'SF', '1.96米', 72, 'HOU'],
    ['Craig Ehlo', '克雷格-埃洛', 'SF', '1.98米', 74, 'HOU'],
  ],
  1996: [
    ['Mookie Blaylock', '穆基-布莱洛克', 'PG', '1.85米', 78, 'ATL'],
    ['Christian Laettner', '克里斯蒂安-莱特纳', 'PF', '2.11米', 78, 'ATL'],
    ['Alan Henderson', '阿兰-亨德森', 'PF', '2.06米', 76, 'ATL'],
    ['Tyrone Corbin', '泰龙-科尔宾', 'SF', '1.98米', 74, 'ATL'],
    ['Anthony Miller', '安东尼-米勒', 'PF', '2.06米', 74, 'ATL'],
    ['Eldridge Recasner', '埃尔德里奇-里卡斯纳', 'PG', '1.85米', 74, 'ATL'],
    ['Ed Gray', '埃德-格雷', 'SG', '1.91米', 72, 'ATL'],
    ['Donnie Boyce', '唐尼-博伊斯', 'SG', '1.96米', 72, 'ATL'],
    ['Dwayne Schintzius', '德韦恩-辛齐乌斯', 'C', '2.16米', 70, 'ATL'],
    ['Antoine Walker', '安托万-沃克', 'PF', '2.06米', 80, 'BOS'],
    ['Todd Day', '托德-戴', 'SG', '1.98米', 76, 'BOS'],
    ['Eric Williams', '埃里克-威廉姆斯', 'SF', '2.03米', 74, 'BOS'],
    ['Greg Minor', '格雷格-迈纳', 'SG', '1.98米', 74, 'BOS'],
    ['Dee Brown', '迪-布朗', 'PG', '1.85米', 76, 'BOS'],
    ['Brett Szabo', '布雷特-萨博', 'C', '2.11米', 70, 'BOS'],
    ['Marty Conlon', '马蒂-康伦', 'PF', '2.08米', 74, 'BOS'],
    ['Tyus Edney', '泰厄斯-埃德尼', 'PG', '1.78米', 72, 'BOS'],
    ['Muggsy Bogues', '马格斯-博格斯', 'PG', '1.60米', 76, 'CHA'],
    ['J.R. Reid', 'J.R.-里德', 'PF', '2.06米', 76, 'CHA'],
    ['Malik Rose', '马利克-罗斯', 'PF', '2.01米', 72, 'CHA'],
    ['Scott Burrell', '斯科特-布雷尔', 'SF', '2.01米', 74, 'CHA'],
    ['George Zidek', '乔治-齐德克', 'C', '2.13米', 70, 'CHA'],
    ['Tony Delk', '托尼-德尔克', 'SG', '1.93米', 74, 'CHA'],
    ['Matt Geiger', '马特-盖格', 'C', '2.13米', 76, 'CHA'],
    ['Luc Longley', '卢克-朗利', 'C', '2.18米', 76, 'CHI'],
    ['Jud Buechler', '贾德-布奇勒', 'SF', '1.98米', 74, 'CHI'],
    ['Randy Brown', '兰迪-布朗', 'PG', '1.88米', 72, 'CHI'],
    ['Jason Caffey', '杰森-卡菲', 'PF', '2.03米', 72, 'CHI'],
    ['Dickey Simpkins', '迪基-辛普金斯', 'PF', '2.06米', 72, 'CHI'],
    ['Robert Parish', '罗伯特-帕里什', 'C', '2.16米', 76, 'CHI'],
    ['Chris Mills', '克里斯-米尔斯', 'SF', '2.01米', 76, 'CLE'],
    ['Tyrone Hill', '泰龙-希尔', 'PF', '2.06米', 76, 'CLE'],
    ['Vitaly Potapenko', '维塔利-波塔潘科', 'C', '2.08米', 74, 'CLE'],
    ['Danny Ferry', '丹尼-费里', 'PF', '2.08米', 74, 'CLE'],
    ['Bob Sura', '鲍勃-苏拉', 'SG', '1.96米', 74, 'CLE'],
    ['Carl Thomas', '卡尔-托马斯', 'SG', '1.93米', 72, 'CLE'],
    ['Mitchell Butler', '米切尔-巴特勒', 'SG', '1.96米', 72, 'CLE'],
    ['Reggie Geary', '雷吉-吉尔里', 'PG', '1.88米', 72, 'CLE'],
    ['A.C. Green', 'A.C.-格林', 'PF', '2.06米', 76, 'DAL'],
    ['George McCloud', '乔治-麦克劳德', 'SF', '2.03米', 76, 'DAL'],
    ['Lorenzo Williams', '洛伦佐-威廉姆斯', 'PF', '2.06米', 72, 'DAL'],
    ['Eric Montross', '埃里克-蒙特罗斯', 'C', '2.13米', 72, 'DAL'],
    ['Erick Strickland', '埃里克-斯特里克兰', 'PG', '1.91米', 72, 'DAL'],
    ['Chris Anstey', '克里斯-安斯蒂', 'C', '2.13米', 74, 'DAL'],
    ['Samaki Walker', '萨马基-沃克', 'PF', '2.06米', 72, 'DAL'],
    ['Bubba Wells', '布巴-威尔斯', 'SF', '1.96米', 70, 'DAL'],
    ['Mark Jackson', '马克-杰克逊', 'PG', '1.85米', 78, 'DEN'],
    ['Dale Ellis', '戴尔-埃利斯', 'SG', '2.01米', 76, 'DEN'],
    ['Ernest Johnson', '欧内斯特-约翰逊', 'PG', '1.83米', 72, 'DEN'],
    ['Anthony Goldwire', '安东尼-戈德怀尔', 'PG', '1.88米', 72, 'DEN'],
    ['Sarunas Marciulionis', '萨鲁纳斯-马修利奥尼斯', 'SG', '1.96米', 74, 'DEN'],
    ['Tom Hammonds', '汤姆-哈蒙兹', 'PF', '2.06米', 74, 'DEN'],
    ['Brooks Thompson', '布鲁克斯-汤普森', 'PG', '1.93米', 72, 'DEN'],
    ['Steve Hamer', '史蒂夫-哈默', 'C', '2.13米', 72, 'DEN'],
    ['Lindsey Hunter', '林赛-亨特', 'PG', '1.88米', 76, 'DET'],
    ['Theo Ratliff', '西奥-拉特利夫', 'C', '2.08米', 76, 'DET'],
    ['Don Reid', '唐-里德', 'PF', '2.03米', 72, 'DET'],
    ['Michael Curry', '迈克尔-库里', 'SF', '1.96米', 74, 'DET'],
    ['Stacey Augmon', '斯泰西-奥格蒙', 'SF', '2.03米', 74, 'DET'],
    ['Jerome Williams', '杰罗姆-威廉姆斯', 'PF', '2.06米', 74, 'DET'],
    ['Mark West', '马克-韦斯特', 'C', '2.08米', 72, 'DET'],
    ['Donyell Marshall', '多尼尔-马歇尔', 'PF', '2.06米', 78, 'GSW'],
    ['Todd Fuller', '托德-富勒', 'C', '2.11米', 72, 'GSW'],
    ['Joe Wolf', '乔-沃尔夫', 'PF', '2.11米', 72, 'GSW'],
    ['Bimbo Coles', '宾博-科尔斯', 'PG', '1.85米', 74, 'GSW'],
    ['Ray Owes', '雷-欧文斯', 'PF', '2.06米', 70, 'GSW'],
    ['Felton Spencer', '费尔顿-斯宾塞', 'C', '2.13米', 72, 'GSW'],
    ['Mark Price', '马克-普莱斯', 'PG', '1.83米', 76, 'GSW'],
    ['Kevin Willis', '凯文-威利斯', 'PF', '2.13米', 76, 'HOU'],
    ['Matt Bullard', '马特-布拉德', 'PF', '2.08米', 74, 'HOU'],
    ['Mario Elie', '马里奥-埃利', 'SG', '1.96米', 76, 'HOU'],
    ['Othella Harrington', '奥塞拉-哈林顿', 'PF', '2.06米', 74, 'HOU'],
    ['Charles Jones', '查尔斯-琼斯', 'C', '2.06米', 72, 'HOU'],
    ['Tracy Moore', '特雷西-摩尔', 'SG', '1.93米', 72, 'HOU'],
    ['Emanual Davis', '伊曼纽尔-戴维斯', 'PG', '1.93米', 72, 'HOU'],
    ['Sedale Threatt', '塞达莱-思雷特', 'PG', '1.88米', 74, 'HOU'],
    ['Derrick McKey', '德里克-麦凯', 'SF', '2.06米', 76, 'IND'],
    ['Travis Best', '特拉维斯-贝斯特', 'PG', '1.80米', 74, 'IND'],
    ['Fred Hoiberg', '弗雷德-霍伊博格', 'SG', '1.93米', 74, 'IND'],
    ['Duane Ferrell', '杜安-费雷尔', 'SF', '2.01米', 74, 'IND'],
    ['Eddie Johnson', '埃迪-约翰逊', 'SG', '1.91米', 74, 'IND'],
    ['Zan Tabak', '赞-塔巴克', 'C', '2.13米', 72, 'IND'],
    ['Darrick Martin', '达里克-马丁', 'PG', '1.80米', 74, 'LAC'],
    ['Malik Sealy', '马利克-西利', 'SG', '2.01米', 76, 'LAC'],
    ['Terry Dehere', '特里-德希尔', 'PG', '1.93米', 72, 'LAC'],
    ['Rodney Rogers', '罗德尼-罗杰斯', 'PF', '2.01米', 76, 'LAC'],
    ['Bo Outlaw', '博-奥特洛', 'PF', '2.03米', 74, 'LAC'],
    ['Kevin Duckworth', '凯文-达克沃思', 'C', '2.13米', 74, 'LAC'],
    ['Eric Piatkowski', '埃里克-皮亚考斯基', 'SG', '2.01米', 74, 'LAC'],
    ['Kobe Bryant', '科比-布莱恩特', 'SG', '1.98米', 80, 'LAL'],
    ['Robert Horry', '罗伯特-霍里', 'PF', '2.06米', 78, 'LAL'],
    ['Rick Fox', '里克-福克斯', 'SF', '2.01米', 76, 'LAL'],
    ['Derek Fisher', '德里克-费舍尔', 'PG', '1.85米', 76, 'LAL'],
    ['Travis Knight', '特拉维斯-奈特', 'C', '2.13米', 74, 'LAL'],
    ['Jerome Kersey', '杰罗姆-科西', 'SF', '2.01米', 74, 'LAL'],
    ['Byron Scott', '拜伦-斯科特', 'SG', '1.91米', 76, 'LAL'],
    ['Sean Rooks', '肖恩-鲁克斯', 'C', '2.08米', 74, 'LAL'],
    ['Corie Blount', '科里-布朗特', 'PF', '2.06米', 72, 'LAL'],
    ['Voshon Lenard', '沃尚-伦纳德', 'SG', '1.93米', 76, 'MIA'],
    ['Keith Askins', '基思-阿斯金斯', 'SF', '2.01米', 74, 'MIA'],
    ['Isaac Austin', '艾萨克-奥斯汀', 'C', '2.08米', 76, 'MIA'],
    ['Dan Majerle', '丹-马尔利', 'SG', '1.98米', 76, 'MIA'],
    ['Walt Williams', '沃尔特-威廉姆斯', 'SF', '2.03米', 76, 'MIA'],
    ['Kevin Gamble', '凯文-甘布尔', 'SF', '1.96米', 74, 'MIA'],
    ['Ed Pinckney', '埃德-平克尼', 'PF', '2.06米', 74, 'MIA'],
    ['Duane Causwell', '杜安-考斯韦尔', 'C', '2.16米', 72, 'MIA'],
    ['Sherman Douglas', '谢尔曼-道格拉斯', 'PG', '1.85米', 76, 'MIL'],
    ['Armon Gilliam', '阿蒙-吉列姆', 'PF', '2.06米', 76, 'MIL'],
    ['Johnny Newman', '约翰尼-纽曼', 'SF', '2.01米', 76, 'MIL'],
    ['Ray Allen', '雷-阿伦', 'SG', '1.96米', 80, 'MIL'],
    ['Jeff Nordgaard', '杰夫-诺德加德', 'SF', '2.01米', 70, 'MIL'],
    ['Jerald Honeycutt', '杰拉德-霍尼卡特', 'SF', '2.06米', 70, 'MIL'],
    ['Stephon Marbury', '斯蒂芬-马布里', 'PG', '1.88米', 80, 'MIN'],
    ['Sam Mitchell', '萨姆-米切尔', 'SF', '1.98米', 74, 'MIN'],
    ['Cherokee Parks', '切罗基-帕克斯', 'C', '2.11米', 74, 'MIN'],
    ['Reggie Jordan', '雷吉-乔丹', 'SG', '1.93米', 72, 'MIN'],
    ['Chris Carr', '克里斯-卡尔', 'SG', '1.96米', 74, 'MIN'],
    ['Shane Heal', '肖恩-希尔', 'PG', '1.83米', 70, 'MIN'],
    ['Doug West', '道格-韦斯特', 'SG', '1.98米', 74, 'MIN'],
    ['Chris Childs', '克里斯-柴尔兹', 'PG', '1.91米', 76, 'NYK'],
    ['Charlie Ward', '查理-沃德', 'PG', '1.88米', 74, 'NYK'],
    ['Buck Williams', '巴克-威廉姆斯', 'PF', '2.03米', 78, 'NYK'],
    ['John Wallace', '约翰-华莱士', 'SF', '2.03米', 74, 'NYK'],
    ['Walter McCarty', '沃尔特-麦卡蒂', 'PF', '2.08米', 74, 'NYK'],
    ['Terry Cummings', '特里-卡明斯', 'PF', '2.06米', 76, 'NYK'],
    ['Herb Williams', '赫布-威廉姆斯', 'C', '2.11米', 72, 'NYK'],
    ['Sam Perkins', '萨姆-珀金斯', 'PF', '2.06米', 76, 'OKC'],
    ['Jim McIlvaine', '吉姆-麦克伊尔文', 'C', '2.16米', 72, 'OKC'],
    ['Craig Ehlo', '克雷格-埃洛', 'SG', '1.98米', 74, 'OKC'],
    ['David Wingate', '大卫-温盖特', 'SG', '1.96米', 72, 'OKC'],
    ['Nate McMillan', '内特-麦克米兰', 'SG', '1.96米', 76, 'OKC'],
    ['Eric Snow', '埃里克-斯诺', 'PG', '1.91米', 74, 'OKC'],
    ['Frank Brickowski', '弗兰克-布里科夫斯基', 'PF', '2.06米', 74, 'OKC'],
    ['Horace Grant', '霍勒斯-格兰特', 'PF', '2.08米', 78, 'ORL'],
    ['Darrell Armstrong', '达雷尔-阿姆斯特朗', 'PG', '1.85米', 76, 'ORL'],
    ['Brian Shaw', '布莱恩-肖', 'SG', '1.98米', 74, 'ORL'],
    ['Gerald Wilkins', '杰拉德-威尔金斯', 'SG', '1.98米', 74, 'ORL'],
    ['Derek Strong', '德里克-斯特朗', 'PF', '2.03米', 74, 'ORL'],
    ['Danny Schayes', '丹尼-沙耶斯', 'C', '2.11米', 72, 'ORL'],
    ['Donald Royal', '唐纳德-罗亚尔', 'SF', '2.03米', 72, 'ORL'],
    ['Allen Iverson', '阿伦-艾弗森', 'PG', '1.83米', 84, 'PHI'],
    ['Clarence Weatherspoon', '克拉伦斯-韦瑟斯庞', 'PF', '1.98米', 76, 'PHI'],
    ['Michael Cage', '迈克尔-凯奇', 'PF', '2.06米', 74, 'PHI'],
    ['Mark Davis', '马克-戴维斯', 'SF', '2.01米', 72, 'PHI'],
    ['Don MacLean', '唐-麦克莱恩', 'PF', '2.08米', 74, 'PHI'],
    ['Rex Walters', '雷克斯-沃尔特斯', 'SG', '1.93米', 72, 'PHI'],
    ['Mark Hendrickson', '马克-亨德里克森', 'PF', '2.06米', 70, 'PHI'],
    ['Johnny Dawkins', '约翰尼-道金斯', 'PG', '1.88米', 74, 'PHI'],
    ['Hot Rod Williams', '霍特-罗德-威廉姆斯', 'PF', '2.11米', 76, 'PHX'],
    ['Rex Chapman', '雷克斯-查普曼', 'SG', '1.93米', 76, 'PHX'],
    ['Wesley Person', '韦斯利-珀森', 'SG', '1.98米', 76, 'PHX'],
    ['Mario Bennett', '马里奥-贝内特', 'PF', '2.06米', 72, 'PHX'],
    ['Mark Bryant', '马克-布莱恩特', 'C', '2.06米', 74, 'PHX'],
    ['Wayman Tisdale', '韦曼-蒂斯代尔', 'PF', '2.06米', 76, 'PHX'],
    ['Elliot Perry', '埃利奥特-佩里', 'PG', '1.83米', 74, 'PHX'],
    ['Rasheed Wallace', '拉希德-华莱士', 'PF', '2.11米', 78, 'POR'],
    ['Gary Trent', '加里-特伦特', 'PF', '2.03米', 74, 'POR'],
    ['Jermaine O\'Neal', '杰梅因-奥尼尔', 'PF', '2.11米', 76, 'POR'],
    ['Randolph Childress', '兰道夫-柴尔德里', 'PG', '1.88米', 72, 'POR'],
    ['Dontonio Wingfield', '东托尼奥-温菲尔德', 'SF', '2.03米', 72, 'POR'],
    ['Alton Lister', '阿尔顿-利斯特', 'C', '2.13米', 72, 'POR'],
    ['James Robinson', '詹姆斯-罗宾逊', 'SG', '1.91米', 72, 'POR'],
    ['Corliss Williamson', '科利斯-威廉姆森', 'PF', '2.01米', 76, 'SAC'],
    ['Billy Owens', '比利-欧文斯', 'SF', '2.03米', 76, 'SAC'],
    ['Michael Smith', '迈克尔-史密斯', 'PF', '2.03米', 74, 'SAC'],
    ['Lionel Simmons', '莱昂内尔-西蒙斯', 'SF', '2.01米', 74, 'SAC'],
    ['Bobby Hurley', '博比-赫尔利', 'PG', '1.83米', 72, 'SAC'],
    ['Brian Grant', '布莱恩-格兰特', 'PF', '2.06米', 76, 'SAC'],
    ['Charles Smith', '查尔斯-史密斯', 'PF', '2.08米', 76, 'SAS'],
    ['Will Perdue', '威尔-珀杜', 'C', '2.13米', 74, 'SAS'],
    ['Monty Williams', '蒙蒂-威廉姆斯', 'SF', '2.03米', 74, 'SAS'],
    ['Chuck Person', '查克-珀森', 'SF', '2.03米', 76, 'SAS'],
    ['Cory Alexander', '科里-亚历山大', 'PG', '1.85米', 74, 'SAS'],
    ['Carl Herrera', '卡尔-埃雷拉', 'PF', '2.06米', 72, 'SAS'],
    ['Doc Rivers', '道格-里弗斯', 'PG', '1.93米', 76, 'SAS'],
    ['Marcus Camby', '马库斯-坎比', 'C', '2.11米', 78, 'TOR'],
    ['Popeye Jones', '波普伊-琼斯', 'PF', '2.03米', 74, 'TOR'],
    ['Carlos Rogers', '卡洛斯-罗杰斯', 'C', '2.11米', 74, 'TOR'],
    ['Sharone Wright', '沙隆-赖特', 'C', '2.11米', 74, 'TOR'],
    ['Tony Massenburg', '托尼-马森伯格', 'PF', '2.06米', 74, 'TOR'],
    ['Damon Jones', '达蒙-琼斯', 'PG', '1.91米', 72, 'TOR'],
    ['Zan Tabak', '赞-塔巴克', 'C', '2.13米', 72, 'TOR'],
    ['Bryon Russell', '布莱恩-拉塞尔', 'SF', '2.01米', 76, 'UTA'],
    ['Shandon Anderson', '尚登-安德森', 'SG', '1.98米', 74, 'UTA'],
    ['Antoine Carr', '安托万-卡尔', 'PF', '2.06米', 76, 'UTA'],
    ['Howard Eisley', '霍华德-埃斯利', 'PG', '1.88米', 74, 'UTA'],
    ['Chris Morris', '克里斯-莫里斯', 'SF', '2.03米', 74, 'UTA'],
    ['Greg Foster', '格雷格-福斯特', 'C', '2.11米', 74, 'UTA'],
    ['Troy Hudson', '特洛伊-哈德森', 'PG', '1.85米', 72, 'UTA'],
    ['Adam Keefe', '亚当-基夫', 'PF', '2.06米', 74, 'UTA'],
    ['Tracy Murray', '特雷西-穆雷', 'SF', '2.01米', 76, 'WAS'],
    ['Harvey Grant', '哈维-格兰特', 'PF', '2.03米', 76, 'WAS'],
    ['Chris Whitney', '克里斯-惠特尼', 'PG', '1.83米', 74, 'WAS'],
    ['Ledell Eackles', '莱德尔-伊克尔斯', 'SG', '1.96米', 72, 'WAS'],
    ['Ben Wallace', '本-华莱士', 'PF', '2.06米', 72, 'WAS'],
    ['Tim Legler', '蒂姆-莱格勒', 'SG', '1.93米', 72, 'WAS'],
    ['Ashraf Amaya', '阿什拉夫-阿马亚', 'PF', '2.03米', 70, 'WAS'],
    ['Bob McCann', '鲍勃-麦卡恩', 'SF', '1.98米', 70, 'WAS'],
    ['Sam Cassell', '萨姆-卡塞尔', 'PG', '1.91米', 78, 'BKN'],
    ['Chris Gatling', '克里斯-加特林', 'PF', '2.08米', 76, 'BKN'],
    ['Yinka Dare', '因卡-达尔', 'C', '2.13米', 72, 'BKN'],
    ["Ed O'Bannon", '埃德-奥班农', 'SF', '2.03米', 72, 'BKN'],
    ['Tony Massenburg', '托尼-马森伯格', 'PF', '2.06米', 74, 'BKN'],
    ['David Benoit', '大卫-贝努瓦', 'SF', '2.03米', 74, 'BKN'],
    ['Rumeal Robinson', '鲁梅尔-罗宾逊', 'PG', '1.88米', 72, 'BKN'],
    ['Adrian Caldwell', '阿德里安-考德威尔', 'PF', '2.03米', 70, 'BKN'],
    ['George Lynch', '乔治-林奇', 'SF', '2.03米', 74, 'MEM'],
    ['Pooh Richardson', '普-理查森', 'PG', '1.85米', 74, 'MEM'],
    ['Lee Mayberry', '李-梅伯里', 'PG', '1.85米', 72, 'MEM'],
    ['Lawrence Moten', '劳伦斯-莫滕', 'SG', '1.96米', 72, 'MEM'],
    ['Pete Chilcutt', '皮特-奇尔卡特', 'PF', '2.08米', 72, 'MEM'],
    ['Anthony Avent', '安东尼-阿文特', 'PF', '2.06米', 72, 'MEM'],
    ['Roy Rogers', '罗伊-罗杰斯', 'PF', '2.06米', 74, 'MEM'],
    ['Kevin Edwards', '凯文-爱德华兹', 'SG', '1.91米', 74, 'MEM'],
    ['Andrew Lang', '安德鲁-朗', 'C', '2.11米', 74, 'MIL'],
    ['Chucky Brown', '查基-布朗', 'SF', '2.01米', 72, 'HOU'],
    ['John Salley', '约翰-萨利', 'SF', '2.11米', 74, 'MIA'],
    ['Vincent Askew', '文森特-阿斯丘', 'SF', '1.98米', 72, 'MIL'],
    ['Vernon Maxwell', '弗农-麦克斯韦', 'SF', '1.93米', 74, 'HOU'],
    ['Bill Wennington', '比尔-温宁顿', 'C', '2.13米', 72, 'CHI'],
  ],
  2003: [
    ['Alan Henderson', '阿兰-亨德森', 'PF', '2.06米', 74, 'ATL'],
    ['Dion Glover', '迪翁-格洛弗', 'SG', '1.96米', 74, 'ATL'],
    ['Chris Crawford', '克里斯-克劳福德', 'SF', '2.06米', 72, 'ATL'],
    ['Travis Hansen', '特拉维斯-汉森', 'SG', '1.98米', 72, 'ATL'],
    ['Lee Nailon', '李-奈伦', 'SF', '2.01米', 74, 'ATL'],
    ['Mike James', '迈克-詹姆斯', 'PG', '1.88米', 76, 'BOS'],
    ['Jiri Welsch', '吉里-韦尔什', 'SG', '2.01米', 74, 'BOS'],
    ['Marcus Banks', '马库斯-班克斯', 'PG', '1.85米', 74, 'BOS'],
    ['Walter McCarty', '沃尔特-麦卡蒂', 'PF', '2.08米', 74, 'BOS'],
    ['Mark Blount', '马克-布隆特', 'C', '2.13米', 74, 'BOS'],
    ['Kedrick Brown', '凯德里克-布朗', 'SF', '2.01米', 72, 'BOS'],
    ['Brandon Hunter', '布兰登-亨特', 'PF', '2.01米', 72, 'BOS'],
    ['Rodney Rogers', '罗德尼-罗杰斯', 'PF', '2.01米', 74, 'BKN'],
    ['Aaron Williams', '阿隆-威廉姆斯', 'PF', '2.06米', 74, 'BKN'],
    ['Brian Scalabrine', '布莱恩-斯卡拉布莱恩', 'PF', '2.06米', 72, 'BKN'],
    ['Zoran Planinic', '佐兰-普拉尼尼奇', 'PG', '2.01米', 72, 'BKN'],
    ['Lucious Harris', '卢修斯-哈里斯', 'SG', '1.96米', 74, 'BKN'],
    ['Brandon Armstrong', '布兰登-阿姆斯特朗', 'SG', '1.96米', 70, 'BKN'],
    ['Kendall Gill', '肯德尔-吉尔', 'SG', '1.96米', 74, 'CHI'],
    ['Antonio Davis', '安东尼奥-戴维斯', 'PF', '2.06米', 76, 'CHI'],
    ['Jerome Williams', '杰罗姆-威廉姆斯', 'PF', '2.06米', 74, 'CHI'],
    ['Corie Blount', '科里-布朗特', 'PF', '2.06米', 72, 'CHI'],
    ['Trenton Hassell', '特伦顿-哈塞尔', 'SF', '1.96米', 74, 'CHI'],
    ['Eddie Robinson', '埃迪-罗宾逊', 'SF', '2.03米', 72, 'CHI'],
    ['Ronald Dupree', '罗纳德-杜普里', 'SF', '2.01米', 72, 'CHI'],
    ['Dajuan Wagner', '德胡安-瓦格纳', 'SG', '1.88米', 74, 'CLE'],
    ['Eric Williams', '埃里克-威廉姆斯', 'SF', '2.03米', 74, 'CLE'],
    ['Ira Newble', '伊拉-纽布尔', 'SF', '2.01米', 74, 'CLE'],
    ['Kevin Ollie', '凯文-奥利', 'PG', '1.93米', 74, 'CLE'],
    ['Jeff McInnis', '杰夫-麦金尼斯', 'PG', '1.93米', 74, 'CLE'],
    ['Jason Kapono', '杰森-卡波诺', 'SF', '2.03米', 72, 'CLE'],
    ['DeSagana Diop', '德萨加纳-迪奥普', 'C', '2.13米', 72, 'CLE'],
    ['Josh Howard', '约什-霍华德', 'SF', '2.01米', 76, 'DAL'],
    ['Marquis Daniels', '马奎斯-丹尼尔斯', 'SG', '1.98米', 74, 'DAL'],
    ['Shawn Bradley', '肖恩-布拉德利', 'C', '2.29米', 74, 'DAL'],
    ['Danny Fortson', '丹尼-福特森', 'PF', '2.01米', 74, 'DAL'],
    ['Tony Delk', '托尼-德尔克', 'SG', '1.93米', 74, 'DAL'],
    ['Travis Best', '特拉维斯-贝斯特', 'PG', '1.80米', 74, 'DAL'],
    ['Voshon Lenard', '沃尚-伦纳德', 'SG', '1.93米', 76, 'DEN'],
    ['Earl Boykins', '厄尔-博伊金斯', 'PG', '1.65米', 74, 'DEN'],
    ['Rodney White', '罗德尼-怀特', 'SF', '2.06米', 74, 'DEN'],
    ['Chris Andersen', '克里斯-安德森', 'PF', '2.08米', 74, 'DEN'],
    ['Ryan Bowen', '瑞安-鲍恩', 'SF', '2.01米', 72, 'DEN'],
    ['Francisco Elson', '弗朗西斯科-埃尔森', 'C', '2.13米', 72, 'DEN'],
    ['Michael Doleac', '迈克尔-多利亚克', 'C', '2.11米', 72, 'DEN'],
    ['Mehmet Okur', '梅米特-奥库', 'C', '2.11米', 76, 'DET'],
    ['Corliss Williamson', '科利斯-威廉姆森', 'PF', '2.01米', 74, 'DET'],
    ['Elden Campbell', '埃尔登-坎贝尔', 'C', '2.11米', 74, 'DET'],
    ['Lindsey Hunter', '林赛-亨特', 'PG', '1.88米', 74, 'DET'],
    ['Darko Milicic', '达科-米利西奇', 'C', '2.13米', 72, 'DET'],
    ['Bob Sura', '鲍勃-苏拉', 'SG', '1.96米', 74, 'DET'],
    ['Zeljko Rebraca', '泽利科-雷布拉卡', 'C', '2.13米', 72, 'DET'],
    ['Clifford Robinson', '克利福德-罗宾逊', 'PF', '2.08米', 76, 'GSW'],
    ['Adonal Foyle', '阿多纳尔-福伊尔', 'C', '2.08米', 74, 'GSW'],
    ['Speedy Claxton', '斯皮迪-克拉克斯顿', 'PG', '1.80米', 74, 'GSW'],
    ['Avery Johnson', '埃弗里-约翰逊', 'PG', '1.78米', 74, 'GSW'],
    ['Mickael Pietrus', '米凯尔-皮特鲁斯', 'SG', '1.98米', 74, 'GSW'],
    ['Evan Eschmeyer', '埃文-埃施迈尔', 'C', '2.11米', 72, 'GSW'],
    ['Brian Cardinal', '布莱恩-卡迪纳尔', 'PF', '2.03米', 72, 'GSW'],
    ['Kelvin Cato', '凯尔文-卡托', 'C', '2.11米', 74, 'HOU'],
    ['Maurice Taylor', '莫里斯-泰勒', 'PF', '2.06米', 74, 'HOU'],
    ['Eric Piatkowski', '埃里克-皮亚考斯基', 'SG', '2.01米', 74, 'HOU'],
    ['Bostjan Nachbar', '波斯蒂安-纳赫巴尔', 'SF', '2.06米', 72, 'HOU'],
    ['Scott Padgett', '斯科特-帕吉特', 'PF', '2.06米', 72, 'HOU'],
    ['Clarence Weatherspoon', '克拉伦斯-韦瑟斯庞', 'PF', '1.98米', 74, 'HOU'],
    ['Mark Jackson', '马克-杰克逊', 'PG', '1.85米', 76, 'HOU'],
    ['Jeff Foster', '杰夫-福斯特', 'C', '2.11米', 74, 'IND'],
    ['Austin Croshere', '奥斯汀-克罗希尔', 'PF', '2.08米', 74, 'IND'],
    ['Fred Jones', '弗雷德-琼斯', 'SG', '1.88米', 74, 'IND'],
    ['Anthony Johnson', '安东尼-约翰逊', 'PG', '1.91米', 74, 'IND'],
    ['Jonathan Bender', '乔纳森-本德', 'PF', '2.11米', 74, 'IND'],
    ['Scot Pollard', '斯科特-波拉德', 'C', '2.11米', 72, 'IND'],
    ['Chris Wilcox', '克里斯-威尔科克斯', 'PF', '2.08米', 76, 'LAC'],
    ['Predrag Drobnjak', '普雷德拉格-德罗布尼亚克', 'C', '2.11米', 74, 'LAC'],
    ['Bobby Simmons', '博比-西蒙斯', 'SF', '2.01米', 74, 'LAC'],
    ['Keyon Dooling', '基翁-杜林', 'PG', '1.91米', 74, 'LAC'],
    ['Doug Overton', '道格-奥弗顿', 'PG', '1.91米', 72, 'LAC'],
    ['Melvin Ely', '梅尔文-伊利', 'PF', '2.08米', 74, 'LAC'],
    ['Wang Zhizhi', '王治郅', 'C', '2.16米', 72, 'LAC'],
    ['Eddie House', '埃迪-豪斯', 'PG', '1.85米', 74, 'LAC'],
    ['Devean George', '德文-乔治', 'SG', '2.03米', 74, 'LAL'],
    ['Rick Fox', '里克-福克斯', 'SF', '2.01米', 74, 'LAL'],
    ['Slava Medvedenko', '斯拉瓦-梅德维登科', 'PF', '2.08米', 74, 'LAL'],
    ['Kareem Rush', '卡里姆-拉什', 'SG', '1.98米', 74, 'LAL'],
    ['Luke Walton', '卢克-沃顿', 'SF', '2.03米', 72, 'LAL'],
    ['Brian Cook', '布莱恩-库克', 'PF', '2.06米', 72, 'LAL'],
    ['Jamal Sampson', '贾马尔-桑普森', 'C', '2.11米', 70, 'LAL'],
    ['Rafer Alston', '拉夫-阿尔斯通', 'PG', '1.88米', 74, 'MIA'],
    ['Caron Butler', '卡隆-巴特勒', 'SF', '2.01米', 78, 'MIA'],
    ['Malik Allen', '马利克-艾伦', 'PF', '2.08米', 74, 'MIA'],
    ['Rasual Butler', '拉苏尔-巴特勒', 'SF', '2.01米', 74, 'MIA'],
    ['John Wallace', '约翰-华莱士', 'SF', '2.03米', 72, 'MIA'],
    ['Loren Woods', '洛伦-伍兹', 'C', '2.18米', 72, 'MIA'],
    ['Bimbo Coles', '宾博-科尔斯', 'PG', '1.85米', 74, 'MIA'],
    ['Brian Skinner', '布莱恩-斯金纳', 'PF', '2.06米', 74, 'MIL'],
    ['Dan Gadzuric', '丹-加祖里奇', 'C', '2.11米', 74, 'MIL'],
    ['Erick Strickland', '埃里克-斯特里克兰', 'PG', '1.91米', 72, 'MIL'],
    ['Toni Kukoc', '托尼-库科奇', 'SF', '2.08米', 76, 'MIL'],
    ['Marcus Haislip', '马库斯-海斯利普', 'PF', '2.08米', 72, 'MIL'],
    ['Brevin Knight', '布雷文-奈特', 'PG', '1.78米', 74, 'MIL'],
    ['Mark Madsen', '马克-马德森', 'PF', '2.06米', 74, 'MIN'],
    ['Gary Trent', '加里-特伦特', 'PF', '2.03米', 74, 'MIN'],
    ['Michael Olowokandi', '迈克尔-奥洛沃坎迪', 'C', '2.13米', 74, 'MIN'],
    ['Troy Hudson', '特洛伊-哈德森', 'PG', '1.85米', 74, 'MIN'],
    ['Ervin Johnson', '埃尔文-约翰逊', 'C', '2.11米', 72, 'MIN'],
    ['Fred Hoiberg', '弗雷德-霍伊博格', 'SG', '1.93米', 74, 'MIN'],
    ['Ndudi Ebi', '恩杜迪-埃比', 'SF', '2.06米', 72, 'MIN'],
    ['Jamaal Magloire', '贾马尔-马格洛伊尔', 'C', '2.11米', 78, 'NOP'],
    ['David West', '大卫-韦斯特', 'PF', '2.06米', 76, 'NOP'],
    ['George Lynch', '乔治-林奇', 'SF', '2.03米', 74, 'NOP'],
    ['Stacey Augmon', '斯泰西-奥格蒙', 'SF', '2.03米', 74, 'NOP'],
    ['Darrell Armstrong', '达雷尔-阿姆斯特朗', 'PG', '1.85米', 74, 'NOP'],
    ['Shammond Williams', '沙蒙德-威廉姆斯', 'PG', '1.85米', 72, 'NOP'],
    ['Steve Smith', '史蒂夫-史密斯', 'SG', '1.98米', 74, 'NOP'],
    ['Nazr Mohammed', '纳兹尔-穆罕默德', 'C', '2.08米', 76, 'NYK'],
    ['Michael Sweetney', '迈克尔-斯威特尼', 'PF', '2.03米', 74, 'NYK'],
    ['Shandon Anderson', '尚登-安德森', 'SG', '1.98米', 74, 'NYK'],
    ['Othella Harrington', '奥塞拉-哈林顿', 'PF', '2.06米', 74, 'NYK'],
    ['Moochie Norris', '穆奇-诺里斯', 'PG', '1.85米', 72, 'NYK'],
    ['Dikembe Mutombo', '迪肯贝-穆托姆博', 'C', '2.18米', 76, 'NYK'],
    ['Jerome James', '杰罗姆-詹姆斯', 'C', '2.16米', 74, 'OKC'],
    ['Reggie Evans', '雷吉-埃文斯', 'PF', '2.03米', 74, 'OKC'],
    ['Vladimir Radmanovic', '弗拉基米尔-拉德马诺维奇', 'PF', '2.08米', 76, 'OKC'],
    ['Antonio Daniels', '安东尼奥-丹尼尔斯', 'PG', '1.93米', 76, 'OKC'],
    ['Luke Ridnour', '卢克-里德诺', 'PG', '1.85米', 74, 'OKC'],
    ['Vitaly Potapenko', '维塔利-波塔潘科', 'C', '2.08米', 72, 'OKC'],
    ['Ansu Sesay', '安苏-塞塞', 'SF', '2.06米', 72, 'OKC'],
    ['Gordan Giricek', '戈登-吉里切克', 'SG', '1.98米', 76, 'ORL'],
    ['Pat Garrity', '帕特-加里蒂', 'PF', '2.06米', 76, 'ORL'],
    ['Keith Bogans', '基思-博甘斯', 'SG', '1.96米', 74, 'ORL'],
    ['Steven Hunter', '史蒂文-亨特', 'C', '2.11米', 74, 'ORL'],
    ['Zaza Pachulia', '扎扎-帕楚利亚', 'C', '2.11米', 74, 'ORL'],
    ['Andrew DeClercq', '安德鲁-德克勒克', 'C', '2.08米', 74, 'ORL'],
    ['Reece Gaines', '里斯-盖恩斯', 'PG', '1.98米', 72, 'ORL'],
    ['Britton Johnsen', '布里顿-约翰森', 'SF', '2.08米', 72, 'ORL'],
    ['Deshawn Stevenson', '德肖恩-史蒂文森', 'SG', '1.96米', 76, 'ORL'],
    ['Glenn Robinson', '格伦-罗宾逊', 'SF', '2.01米', 78, 'PHI'],
    ['Kenny Thomas', '肯尼-托马斯', 'PF', '2.01米', 76, 'PHI'],
    ['John Salmons', '约翰-萨尔蒙斯', 'SG', '1.98米', 74, 'PHI'],
    ['Marc Jackson', '马科-杰克逊', 'C', '2.08米', 74, 'PHI'],
    ['Kyle Korver', '凯尔-科沃尔', 'SF', '2.01米', 74, 'PHI'],
    ['Willie Green', '威利-格林', 'SG', '1.93米', 74, 'PHI'],
    ['Zendon Hamilton', '曾顿-汉密尔顿', 'C', '2.11米', 72, 'PHI'],
    ['Jake Voskuhl', '杰克-沃斯库尔', 'C', '2.11米', 74, 'PHX'],
    ['Casey Jacobsen', '凯西-雅各布森', 'SG', '1.98米', 74, 'PHX'],
    ['Jahidi White', '贾希迪-怀特', 'C', '2.06米', 74, 'PHX'],
    ['Leandro Barbosa', '莱昂德罗-巴博萨', 'PG', '1.91米', 74, 'PHX'],
    ['Zarko Cabarkapa', '扎尔科-卡巴卡帕', 'SF', '2.11米', 74, 'PHX'],
    ['Antonio McDyess', '安东尼奥-麦克戴斯', 'PF', '2.06米', 76, 'PHX'],
    ['Theo Ratliff', '西奥-拉特利夫', 'C', '2.08米', 76, 'POR'],
    ['Ruben Patterson', '鲁本-帕特森', 'SF', '1.98米', 76, 'POR'],
    ['Dale Davis', '戴尔-戴维斯', 'PF', '2.11米', 76, 'POR'],
    ['Derek Anderson', '德里克-安德森', 'SG', '1.96米', 74, 'POR'],
    ['Vladimir Stepania', '弗拉基米尔-斯特帕尼亚', 'C', '2.13米', 72, 'POR'],
    ['Travis Outlaw', '特拉维斯-奥特洛', 'SF', '2.06米', 72, 'POR'],
    ['Bobby Jackson', '博比-杰克逊', 'PG', '1.85米', 76, 'SAC'],
    ['Darius Songaila', '达柳斯-桑盖拉', 'PF', '2.06米', 74, 'SAC'],
    ['Anthony Peeler', '安东尼-皮勒', 'SG', '1.93米', 74, 'SAC'],
    ['Tony Massenburg', '托尼-马森伯格', 'PF', '2.06米', 74, 'SAC'],
    ['Gerald Wallace', '杰拉德-华莱士', 'SF', '2.01米', 74, 'SAC'],
    ['Kevin Martin', '凯文-马丁', 'SG', '2.01米', 72, 'SAC'],
    ['Robert Horry', '罗伯特-霍里', 'PF', '2.06米', 76, 'SAS'],
    ['Malik Rose', '马利克-罗斯', 'PF', '2.01米', 76, 'SAS'],
    ['Devin Brown', '德文-布朗', 'SG', '1.96米', 74, 'SAS'],
    ['Hedo Turkoglu', '希度-特科格鲁', 'SF', '2.08米', 76, 'SAS'],
    ['Ron Mercer', '罗恩-默瑟', 'SG', '2.01米', 74, 'SAS'],
    ['Alex Garcia', '亚历克斯-加西亚', 'PG', '1.91米', 72, 'SAS'],
    ['Jason Hart', '杰森-哈特', 'PG', '1.91米', 72, 'SAS'],
    ['Donyell Marshall', '多尼尔-马歇尔', 'PF', '2.06米', 76, 'TOR'],
    ['Alvin Williams', '阿尔文-威廉姆斯', 'PG', '1.96米', 76, 'TOR'],
    ['Chris Bosh', '克里斯-波什', 'PF', '2.11米', 80, 'TOR'],
    ['Lamond Murray', '拉蒙德-穆雷', 'SF', '2.01米', 74, 'TOR'],
    ['Michael Curry', '迈克尔-库里', 'SF', '1.96米', 72, 'TOR'],
    ['Milt Palacio', '米尔特-帕拉西奥', 'PG', '1.91米', 72, 'TOR'],
    ['Robert Archibald', '罗伯特-阿奇博尔德', 'PF', '2.11米', 72, 'TOR'],
    ['Jerome Moiso', '杰罗姆-莫伊索', 'PF', '2.08米', 72, 'TOR'],
    ['Carlos Arroyo', '卡洛斯-阿罗约', 'PG', '1.88米', 76, 'UTA'],
    ['Jarron Collins', '杰伦-科林斯', 'C', '2.11米', 74, 'UTA'],
    ['Raja Bell', '拉加-贝尔', 'SG', '1.96米', 76, 'UTA'],
    ['Raul Lopez', '劳尔-洛佩斯', 'PG', '1.83米', 74, 'UTA'],
    ['Greg Ostertag', '格雷格-奥斯特塔格', 'C', '2.18米', 74, 'UTA'],
    ['Sasha Pavlovic', '萨沙-帕夫洛维奇', 'SG', '2.01米', 74, 'UTA'],
    ['Mo Williams', '莫-威廉姆斯', 'PG', '1.85米', 74, 'UTA'],
    ['Brendan Haywood', '布伦丹-海伍德', 'C', '2.13米', 76, 'WAS'],
    ['Jarvis Hayes', '贾维斯-海耶斯', 'SF', '2.01米', 76, 'WAS'],
    ['Juan Dixon', '胡安-迪克森', 'SG', '1.91米', 74, 'WAS'],
    ['Christian Laettner', '克里斯蒂安-莱特纳', 'PF', '2.11米', 76, 'WAS'],
    ['Etan Thomas', '伊坦-托马斯', 'PF', '2.06米', 74, 'WAS'],
    ['Mitchell Butler', '米切尔-巴特勒', 'SG', '1.96米', 72, 'WAS'],
    ['Steve Blake', '史蒂夫-布莱克', 'PG', '1.91米', 74, 'WAS'],
    ['Jared Jeffries', '贾里德-杰弗里斯', 'PF', '2.11米', 74, 'WAS'],
    ['Scottie Pippen', '斯科蒂-皮蓬', 'SF', '2.01米', 76, 'CHI'],
    ['Stromile Swift', '斯特罗迈尔-斯威夫特', 'PF', '2.06米', 76, 'MEM'],
    ['Lorenzen Wright', '洛伦岑-赖特', 'C', '2.11米', 76, 'MEM'],
    ['Earl Watson', '厄尔-沃特森', 'PG', '1.85米', 74, 'MEM'],
    ['Dahntay Jones', '丹泰-琼斯', 'SF', '1.98米', 74, 'MEM'],
    ['Ryan Humphrey', '瑞安-汉弗莱', 'PF', '2.03米', 72, 'MEM'],
    ['Jannero Pargo', '扬内罗-帕戈', 'PG', '1.85米', 72, 'TOR'],
    ['Dan Dickau', '丹-迪考', 'PG', '1.83米', 72, 'ATL'],
    ['Tyronn Lue', '泰伦-卢', 'PG', '1.83米', 74, 'ORL'],
    ['Primoz Brezec', '普里莫兹-布雷泽克', 'C', '2.16米', 74, 'IND'],
    ['Lonny Baxter', '隆尼-巴克斯特', 'C', '2.03米', 70, 'TOR'],
    ['Jelani McCoy', '杰拉尼-麦考伊', 'C', '2.13米', 72, 'TOR'],
    ['Matt Harpring', '马特-哈普林', 'SF', '2.01米', 76, 'UTA'],
    ['Rashard Lewis', '拉沙德-刘易斯', 'SF', '2.08米', 82, 'OKC'],
    ['Keon Clark', '基翁-克拉克', 'PF', '2.11米', 76, 'UTA'],
    ['Popeye Jones', '波普耶-琼斯', 'PF', '2.03米', 74, 'DAL'],
    ['Michael Ruffin', '迈克尔-鲁芬', 'PF', '2.06米', 72, 'CHI'],
  ]
};
var _eraPoolUsed = {};

/** 从真实池取一名球员：优先（同队+位置）→ 同队 → 位置匹配 → 任意；排除当届新秀与已占用 */
function takeEraRoleFromPool(era, pos, teamHint, strictHint) {
  var pool = (ERA_ROLE_POOLS && ERA_ROLE_POOLS[era]) || [];
  var used = _eraPoolUsed[era] || (_eraPoolUsed[era] = {});
  function nameTaken(en) {
    if (used[en]) return true;
    // 当届新秀由 applyEraDraftClass 负责入盟，池中同名一律跳过
    if (typeof HISTORICAL_DRAFT_CLASSES !== 'undefined' && HISTORICAL_DRAFT_CLASSES[era]) {
      var _cls = HISTORICAL_DRAFT_CLASSES[era];
      var _enN = en.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (var _c = 0; _c < _cls.length; _c++) {
        if (_cls[_c] && _cls[_c].en && _cls[_c].en.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === _enN) return true;
      }
    }
    if (typeof NBA2K_DATA === 'undefined') return false;
    var _enN = String(en || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    for (var _t in NBA2K_DATA) {
      var _r = NBA2K_DATA[_t];
      if (!Array.isArray(_r)) continue;
      for (var _i = 0; _i < _r.length; _i++) {
        var _p = _r[_i];
        if (!_p) continue;
        var _pn = String(_p.nameEN || _p.name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        if (_pn === _enN) return true;
      }
    }
    return false;
  }
  var candidates = pool.filter(function(x) { return !nameTaken(x[0]); });
  if (strictHint) candidates = candidates.filter(function(x) { return x[5] === teamHint; });
  if (!candidates.length) return null;
  var hit = null;
  candidates.forEach(function(x) {
    if (!hit && x[5] === teamHint && String(x[2]).toUpperCase() === pos) hit = x;
  });
  if (!hit) candidates.forEach(function(x) { if (!hit && x[5] === teamHint) hit = x; });
  if (!hit) candidates.forEach(function(x) {
    if (!hit && String(x[2]).toUpperCase() === pos) hit = x;
  });
  if (!hit) hit = candidates[0];
  used[hit[0]] = true;
  return hit;
}
/** 按位置 + 综评生成 13 项能力值（无精确属性的核心/角色/新秀球员使用） */
/** 从独立替补池取一名真实替补：优先（同队+位置）→ 同队 → 位置匹配 → 任意；同次建联盟不重复。
 *  替补池（ERA_BENCH_POOLS）条目与核心名单/当届新秀不重叠，赛季初名单口径每名球员只归属一队。 */
var _eraBenchUsed = {};
function takeEraBenchPlayer(era, pos, teamHint, strictHint) {
  var pool = (typeof ERA_BENCH_POOLS !== 'undefined' && ERA_BENCH_POOLS[era]) ? ERA_BENCH_POOLS[era] : [];
  if (!pool || !pool.length) return null;
  var used = _eraBenchUsed[era] || (_eraBenchUsed[era] = {});
  function _bn(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function _takenByLeague(en) {
    if (typeof NBA2K_DATA === 'undefined') return false;
    var _k = _bn(en);
    for (var _t2 in NBA2K_DATA) {
      var _r2 = NBA2K_DATA[_t2];
      if (!Array.isArray(_r2)) continue;
      for (var _i2 = 0; _i2 < _r2.length; _i2++) {
        var _p2 = _r2[_i2];
        if (_p2 && _bn(_p2.nameEN || _p2.name || '') === _k) return true;
      }
    }
    return false;
  }
  var candidates = pool.filter(function(x) { return x && x[0] && !used[_bn(x[0])] && !_takenByLeague(x[0]); });
  if (strictHint) candidates = candidates.filter(function(x) { return x[5] === teamHint; });
  if (!candidates.length) return null;
  var hit = null;
  candidates.forEach(function(x) {
    if (!hit && x[5] === teamHint && String(x[2]).toUpperCase() === pos) hit = x;
  });
  if (!hit) candidates.forEach(function(x) { if (!hit && x[5] === teamHint) hit = x; });
  if (!hit) candidates.forEach(function(x) {
    if (!hit && String(x[2]).toUpperCase() === pos) hit = x;
  });
  if (!hit) hit = candidates[0];
  used[_bn(hit[0])] = true;
  return hit;
}

function getEraPlayerAttrs(pos, ovr) {
  var p = String(pos || 'SF').split('/')[0].trim().toUpperCase();
  var tpl = ERA_ATTR_TEMPLATES[p] || ERA_ATTR_TEMPLATES.SF;
  var base = ERA_ATTR_TEMPLATES.SF; // 兜底
  var out = {};
  var keys = ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU'];
  var ovrN = parseInt(ovr, 10) || 75;
  keys.forEach(function(k) {
    var v = (tpl[k] != null ? tpl[k] : base[k]) + (ovrN - 85) * 0.65 + (Math.random() * (ovrN >= 88 ? 4 : 6) - (ovrN >= 88 ? 2 : 3)); // ★ P1：模板噪声收敛，避免角色球员属性离谱
    out[k] = Math.max(30, Math.min(99, Math.round(v)));
  });
  // 高 OVR 球星专项加成：主属性（该位置最突出的一两项）随档位再提升，体现“球星强项”
  var starBoost = { PG: ['PAS','HAN'], SG: ['threePT','FIN'], SF: ['DNK','FIN'], PF: ['REB','STR'], C: ['REB','BLK','STR'] };
  if (ovrN >= 88) {
    var boostCap = ovrN >= 95 ? 99 : 98;
    var boosted = 0;
    (starBoost[p] || []).forEach(function(k) {
      if (boosted >= 2) return;
      out[k] = Math.min(boostCap, out[k] + (ovrN >= 93 ? 4 : 2));
      boosted++;
    });
  }
  return out;
}

/** 历史模板/新秀库未覆盖的真实球员：en -> [cn, pos, ovr] */
var ERA_EXTRA_PLAYERS = {
  // ===== 1980s =====
  'Kevin McHale': ['凯文-麦克海尔', 'PF', 92, { threePT: 38, MID: 96, FIN: 99, DNK: 75, HAN: 97, PAS: 62, PDEF: 97, IDEF: 97, BLK: 97, REB: 97, ATH: 71, STR: 97, CLU: 95 }],
  'Robert Parish': ['罗伯特-帕里什', 'C', 88, { threePT: 31, MID: 83, FIN: 98, DNK: 73, HAN: 75, PAS: 59, PDEF: 78, IDEF: 87, BLK: 84, REB: 97, ATH: 71, STR: 94, CLU: 88 }],
  'Dennis Johnson': ['丹尼斯-约翰逊', 'PG', 85, { threePT: 58, MID: 78, FIN: 82, DNK: 60, HAN: 86, PAS: 84, PDEF: 99, IDEF: 91, BLK: 62, REB: 67, ATH: 84, STR: 64, CLU: 97 }],
  'Danny Ainge': ['丹尼-安吉', 'SG', 80],
  'James Worthy': ['詹姆斯-沃斯', 'SF', 88, { threePT: 45, MID: 98, FIN: 99, DNK: 98, HAN: 90, PAS: 74, PDEF: 82, IDEF: 79, BLK: 64, REB: 81, ATH: 97, STR: 78, CLU: 98 }],
  'Byron Scott': ['拜伦-史科特', 'SG', 82],
  'Michael Cooper': ['迈克尔-库普', 'SG', 80],
  'Julius Erving': ['朱利业斯-欧文', 'SF', 92, { threePT: 53, MID: 80, FIN: 98, DNK: 99, HAN: 97, PAS: 78, PDEF: 98, IDEF: 89, BLK: 94, REB: 88, ATH: 98, STR: 76, CLU: 98 }],
  'Moses Malone': ['摩西-马龙', 'C', 90, { threePT: 30, MID: 62, FIN: 98, DNK: 82, HAN: 72, PAS: 52, PDEF: 81, IDEF: 97, BLK: 86, REB: 99, ATH: 80, STR: 97, CLU: 93 }],
  'Maurice Cheeks': ['莫里斯-奇克斯', 'PG', 82],
  'Andrew Toney': ['安德鲁-汤尼', 'SG', 80],
  'Isiah Thomas': ['伊塞亚-托马斯', 'PG', 93, { threePT: 75, MID: 97, FIN: 98, DNK: 60, HAN: 98, PAS: 99, PDEF: 98, IDEF: 72, BLK: 40, REB: 57, ATH: 96, STR: 60, CLU: 98 }],
  'Bill Laimbeer': ['比尔-兰比尔', 'C', 84],
  'Vinnie Johnson': ['文尼-约翰逊', 'SG', 82],
  'Rick Mahorn': ['里克-马洪', 'PF', 80],
  'Kelly Tripucka': ['凯利-特里普卡', 'SF', 82],
  'Orlando Woolridge': ['奥兰多-伍尔里奇', 'SF', 82],
  'Quintin Dailey': ['昆廷-戴利', 'SG', 78],
  'Dave Greenwood': ['戴夫-格林伍德', 'PF', 76],
  'Ralph Sampson': ['拉尔夫-桑普森', 'C', 88, { threePT: 31, MID: 73, FIN: 96, DNK: 79, HAN: 71, PAS: 56, PDEF: 80, IDEF: 87, BLK: 95, REB: 97, ATH: 83, STR: 84, CLU: 83 }],
  'Rodney McCray': ['罗德尼-麦克雷', 'SF', 80],
  'Lewis Lloyd': ['刘易斯-劳埃德', 'SG', 76],
  'Adrian Dantley': ['阿德里安-丹特利', 'SF', 88, { threePT: 56, MID: 97, FIN: 99, DNK: 83, HAN: 97, PAS: 72, PDEF: 81, IDEF: 76, BLK: 51, REB: 76, ATH: 97, STR: 88, CLU: 97 }],
  'Darrell Griffith': ['达雷尔-格里菲什', 'SG', 80],
  'Thurl Bailey': ['瑟尔-贝利', 'PF', 78],
  'Mark Eaton': ['马克-伊顿', 'C', 80],
  'Mark Aguirre': ['马克-阿吉雷', 'SF', 88, { threePT: 64, MID: 98, FIN: 99, DNK: 81, HAN: 97, PAS: 76, PDEF: 74, IDEF: 71, BLK: 50, REB: 79, ATH: 98, STR: 81, CLU: 98 }],
  'Rolando Blackman': ['罗兰多-布莱克曼', 'SG', 85, { threePT: 64, MID: 99, FIN: 97, DNK: 59, HAN: 97, PAS: 68, PDEF: 78, IDEF: 66, BLK: 41, REB: 59, ATH: 84, STR: 59, CLU: 97 }],
  'Derek Harper': ['德里克-哈普', 'PG', 80],
  'Jay Vincent': ['杰伊-文森', 'PF', 76],
  'Dominique Wilkins': ['多米尼克-威尔金斯', 'SF', 92, { threePT: 69, MID: 97, FIN: 98, DNK: 99, HAN: 98, PAS: 70, PDEF: 84, IDEF: 79, BLK: 67, REB: 83, ATH: 98, STR: 80, CLU: 98 }],
  'Doc Rivers': ['道格-里弗斯', 'PG', 80],
  'Tree Rollins': ['特里-罗林斯', 'C', 78],
  'Randy Wittman': ['兰迪-惠特曼', 'SG', 74],
  'Clyde Drexler': ['克莱德-德雷克斯勒', 'SG', 88, { threePT: 62, MID: 80, FIN: 98, DNK: 99, HAN: 84, PAS: 82, PDEF: 84, IDEF: 79, BLK: 62, REB: 79, ATH: 98, STR: 69, CLU: 96 }],
  'Jim Paxson': ['吉姆-帕克森', 'SG', 80],
  'Kiki Vandeweghe': ['基基-范德维格', 'SF', 84],
  'Bernard King': ['伯纳德-金', 'SF', 90, { threePT: 69, MID: 97, FIN: 99, DNK: 98, HAN: 97, PAS: 68, PDEF: 79, IDEF: 73, BLK: 50, REB: 83, ATH: 97, STR: 83, CLU: 98 }],
  'Bill Cartwright': ['比尔-卡特赖特', 'C', 78],
  'Rory Sparrow': ['罗里-斯帕罗', 'PG', 76],
  'Sidney Moncrief': ['西德尼-蒙克利夫', 'SG', 90, { threePT: 66, MID: 97, FIN: 97, DNK: 68, HAN: 91, PAS: 78, PDEF: 99, IDEF: 95, BLK: 56, REB: 72, ATH: 95, STR: 67, CLU: 97 }],
  'Terry Cummings': ['特里-卡明斯', 'PF', 84],
  'Paul Pressey': ['保罗-普雷西', 'SF', 80],
  'Marques Johnson': ['马克斯-约翰逊', 'SF', 84],
  'Larry Nance': ['拉里-南斯', 'PF', 86, { threePT: 32, MID: 71, FIN: 96, DNK: 94, HAN: 73, PAS: 56, PDEF: 84, IDEF: 94, BLK: 90, REB: 92, ATH: 96, STR: 80, CLU: 83 }],
  'Walter Davis': ['沃尔特-戴维斯', 'SG', 84],
  'Maurice Lucas': ['莫里斯-卢卡斯', 'PF', 76],
  'Alvan Adams': ['阿尔文-亚当斯', 'C', 74],
  'Tom Chambers': ['汤姆-钟斯', 'PF', 86, { threePT: 54, MID: 97, FIN: 97, DNK: 99, HAN: 79, PAS: 60, PDEF: 67, IDEF: 75, BLK: 67, REB: 90, ATH: 98, STR: 81, CLU: 98 }],
  'Jack Sikma': ['杰克-西克马', 'C', 84],
  'Gus Williams': ['格斯-威廉斯', 'PG', 84],
  'Alex English': ['亚历克斯-英格利什', 'SF', 88, { threePT: 61, MID: 99, FIN: 97, DNK: 80, HAN: 97, PAS: 78, PDEF: 76, IDEF: 70, BLK: 55, REB: 81, ATH: 97, STR: 78, CLU: 98 }],
  'Dan Issel': ['丹-伊塞尔', 'C', 84],
  'Fat Lever': ['法特-利弗', 'PG', 82],
  'Calvin Natt': ['卡尔文-纳特', 'SF', 80],
  'George Gervin': ['乔治-格文', 'SG', 90, { threePT: 82, MID: 99, FIN: 98, DNK: 70, HAN: 97, PAS: 73, PDEF: 76, IDEF: 62, BLK: 60, REB: 69, ATH: 97, STR: 67, CLU: 98 }],
  'Artis Gilmore': ['阿蒂斯-吉尔摩', 'C', 84],
  'Mike Mitchell': ['迈克-米切尔', 'PF', 78],
  'Purvis Short': ['泊维斯-肖特', 'SF', 82],
  'Sleepy Floyd': ['斯里皮-弗洛伊德', 'PG', 80],
  'Buck Williams': ['巴克-威廉斯', 'PF', 84],
  'Micheal Ray Richardson': ['米歇尔-雷-理查德森', 'PG', 82],
  'Otis Birdsong': ['奥蒂斯-伯德松', 'SG', 80],
  'Jeff Malone': ['杰夫-马龙', 'SG', 82],
  'Jeff Ruland': ['杰夫-鲁兰', 'C', 80],
  'Frank Johnson': ['弗兰克-约翰逊', 'PG', 74],
  'World B. Free': ['沃尔德-弗里', 'SG', 80],
  'Roy Hinson': ['罗伊-欣森', 'PF', 76],
  'Mark West': ['马克-韦斯特', 'C', 74],
  'Bill Walton': ['比尔-沃顿', 'C', 80],
  'Norm Nixon': ['诺姆-尼克松', 'PG', 78],
  'Reggie Theus': ['雷吉-休斯', 'SG', 82],
  'LaSalle Thompson': ['拉塞尔-汤普森', 'C', 74],
  'Clark Kellogg': ['克拉克-凯洛格', 'PF', 82],
  'Herb Williams': ['赫伯-威廉斯', 'C', 76],
  // ===== 1990s =====
  'Karl Malone': ['卡尔-马龙', 'PF', 96, { threePT: 45, MID: 94, FIN: 99, DNK: 86, HAN: 92, PAS: 88, PDEF: 92, IDEF: 86, BLK: 76, REB: 97, ATH: 94, STR: 99, CLU: 95 }],
  'David Robinson': ['大卫-罗宾逊', 'C', 96, { threePT: 30, MID: 86, FIN: 96, DNK: 95, HAN: 82, PAS: 82, PDEF: 95, IDEF: 97, BLK: 99, REB: 97, ATH: 96, STR: 90, CLU: 92 }],
  'Scottie Pippen': ['斯科蒂-皮蓬', 'SF', 97, { threePT: 78, MID: 88, FIN: 97, DNK: 95, HAN: 96, PAS: 94, PDEF: 99, IDEF: 98, BLK: 85, REB: 90, ATH: 98, STR: 84, CLU: 96 }],
  'Toni Kukoc': ['托尼-库科奇', 'SF', 88, { threePT: 84, MID: 88, FIN: 90, DNK: 78, HAN: 92, PAS: 86, PDEF: 82, IDEF: 80, BLK: 64, REB: 76, ATH: 86, STR: 74, CLU: 90 }],
  'Ron Harper': ['罗恩-哈珀', 'SG', 83, { threePT: 64, MID: 78, FIN: 84, DNK: 72, HAN: 80, PAS: 74, PDEF: 93, IDEF: 84, BLK: 58, REB: 64, ATH: 86, STR: 72, CLU: 86 }],
  'Jeff Hornacek': ['杰夫-霍纳塞克', 'SG', 86, { threePT: 92, MID: 92, FIN: 88, DNK: 62, HAN: 92, PAS: 92, PDEF: 88, IDEF: 78, BLK: 48, REB: 62, ATH: 82, STR: 66, CLU: 92 }],

  'Dennis Rodman': ['丹尼斯-罗德曼', 'PF', 88, { threePT: 44, MID: 45, FIN: 94, DNK: 75, HAN: 60, PAS: 56, PDEF: 99, IDEF: 97, BLK: 79, REB: 99, ATH: 90, STR: 93, CLU: 87 }],
  'Steve Kerr': ['史蒂夫-科尔', 'PG', 76],
  'Greg Ostertag': ['格雷格-奥斯特塔格', 'C', 76],
  'Sean Elliott': ['肖恩-埃利奥特', 'SF', 82],
  'Avery Johnson': ['埃弗里-约翰逊', 'PG', 78],
  'Vinny Del Negro': ['文尼-德尔-内格罗', 'SG', 74],
  'Sam Cassell': ['萨姆-卡塞尔', 'PG', 82],
  'Matt Maloney': ['马特-马龙尼', 'PG', 72],
  'Nick Van Exel': ['尼克-范埃克塞尔', 'PG', 82],
  'Eddie Jones': ['埃迪-琼斯', 'SG', 82],
  'Elden Campbell': ['埃尔登-坎伯尔', 'C', 78],
  'Shawn Kemp': ['肖恩-坎普', 'PF', 90, { threePT: 38, MID: 60, FIN: 98, DNK: 99, HAN: 73, PAS: 66, PDEF: 90, IDEF: 97, BLK: 88, REB: 97, ATH: 98, STR: 96, CLU: 84 }],
  'Hersey Hawkins': ['赫尔西-霍金斯', 'SG', 78],
  'Rik Smits': ['里克-史米茨', 'C', 82],
  'Mark Jackson': ['马克-杰克逊', 'PG', 80],
  'Dale Davis': ['戴尔-戴维斯', 'PF', 76],
  'Antonio Davis': ['安东尼奥-戴维斯', 'PF', 76],
  'Allan Houston': ['阿兰-休斯顿', 'SG', 82],
  'John Starks': ['约翰-斯坦克斯', 'SG', 80],
  'Larry Johnson': ['拉里-约翰逊', 'PF', 82],
  'Tim Hardaway': ['蒂姆-哈达威', 'PG', 86, { threePT: 76, MID: 89, FIN: 88, DNK: 56, HAN: 99, PAS: 97, PDEF: 79, IDEF: 63, BLK: 40, REB: 53, ATH: 88, STR: 53, CLU: 95 }],
  'P.J. Brown': ['P.J.-布朗', 'PF', 76],
  'Nick Anderson': ['尼克-安德森', 'SG', 80],
  'Dennis Scott': ['丹尼斯-史科特', 'SF', 78],
  'Rony Seikaly': ['罗尼-塞卡利', 'C', 76],
  'Terry Mills': ['特里-米尔斯', 'PF', 76],
  'Kevin Johnson': ['凯文-约翰逊', 'PG', 84],
  'Danny Manning': ['丹尼-曼宁', 'PF', 78],
  'Terrell Brandon': ['特雷尔-布兰登', 'PG', 80],
  'Bobby Phills': ['博比-菲尔斯', 'SG', 76],
  'Tom Gugliotta': ['汤姆-古格里奥塔', 'PF', 78],
  'Arvydas Sabonis': ['阿维达斯-萨博尼斯', 'C', 84],
  'Isaiah Rider': ['伊塞亚-莱德', 'SG', 78],
  'Cliff Robinson': ['克利夫-罗宾逊', 'SF', 78],
  'Kenny Anderson': ['肯尼-安德森', 'PG', 76],
  'Latrell Sprewell': ['拉特里尔-斯普雷维尔', 'SG', 84],
  'Joe Smith': ['乔-史密斯', 'PF', 82],
  'B.J. Armstrong': ['B.J.-阿姆斯特那', 'PG', 74],
  'Rod Strickland': ['罗德-斯特里克兰', 'PG', 82],
  'Gheorghe Muresan': ['乔治-穆雷森', 'C', 74],
  'Mitch Richmond': ['米奇-里奇蒙德', 'SG', 84],
  'Mahmoud Abdul-Rauf': ['马哈譬德-阿卜杜尔-拉乌夫', 'PG', 78],
  'Olden Polynice': ['奥尔登-波利尼斯', 'C', 74],
  'Antonio McDyess': ['安东尼奥-麦克戴斯', 'PF', 82],
  'LaPhonso Ellis': ['拉芬索-埃利斯', 'PF', 76],
  'Dikembe Mutombo': ['迪肯贝-穆托姆博', 'C', 88, { threePT: 31, MID: 46, FIN: 85, DNK: 65, HAN: 46, PAS: 46, PDEF: 97, IDEF: 99, BLK: 99, REB: 98, ATH: 61, STR: 96, CLU: 81 }],
  'Steve Smith': ['史蒂夫-史密斯', 'SG', 80],
  'Kendall Gill': ['肯达尔-吉尔', 'SG', 76],
  'Jayson Williams': ['捷森-威廉斯', 'PF', 78],
  'Doug Christie': ['道格-克里斯蒂', 'SG', 76],
  'Bryant Reeves': ['布莱恩特-里弗斯', 'C', 74],
  'Blue Edwards': ['布卢-伊东威德斯', 'SG', 72],
  'Dana Barros': ['达纳-巴罗斯', 'PG', 76],
  'Rick Fox': ['里克-福克斯', 'SF', 74],
  'Dino Radja': ['迪诺-拉德加', 'PF', 76],
  'Glen Rice': ['格伦-莱斯', 'SF', 84],
  'Vlade Divac': ['弗拉德-迪瓦茨', 'C', 78],
  'Anthony Mason': ['安东尼-梅森', 'PF', 76],
  'Dell Curry': ['戴尔-库里', 'SG', 76],
  'Vin Baker': ['文-贝克', 'PF', 82],
  'Jim Jackson': ['吉姆-杰克逊', 'SG', 80],
  'Michael Finley': ['迈克尔-芬利', 'SF', 82],
  'Loy Vaught': ['洛伊-沃特', 'PF', 74],
  'Brent Barry': ['布伦特-巴里', 'SG', 76],
  // ===== 2000s =====
  'Reggie Miller': ['雷吉-米勒', 'SG', 93, { threePT: 99, MID: 96, FIN: 93, DNK: 62, HAN: 94, PAS: 84, PDEF: 86, IDEF: 74, BLK: 50, REB: 66, ATH: 84, STR: 64, CLU: 99 }],

  "Jermaine O'Neal": ['杰梅因-奥尼尔', 'PF', 96, { threePT: 58, MID: 90, FIN: 96, DNK: 89, HAN: 85, PAS: 74, PDEF: 95, IDEF: 97, BLK: 98, REB: 98, ATH: 87, STR: 94, CLU: 90 }],
  'Ron Artest': ['罗恩-阿泰斯特', 'SF', 93, { threePT: 80, MID: 82, FIN: 89, DNK: 75, HAN: 87, PAS: 82, PDEF: 99, IDEF: 97, BLK: 78, REB: 85, ATH: 93, STR: 95, CLU: 93 }],
  'Jamaal Tinsley': ['贾马尔-廷斯利', 'PG', 80, { threePT: 70, MID: 80, FIN: 82, DNK: 66, HAN: 90, PAS: 90, PDEF: 80, IDEF: 72, BLK: 45, REB: 62, ATH: 88, STR: 68, CLU: 80 }],
  'Rasheed Wallace': ['拉希德-华莱士', 'PF', 92, { threePT: 85, MID: 93, FIN: 92, DNK: 84, HAN: 87, PAS: 82, PDEF: 95, IDEF: 95, BLK: 92, REB: 94, ATH: 87, STR: 90, CLU: 90 }],
  'Chauncey Billups': ['昌西-比卢普斯', 'PG', 92, { threePT: 95, MID: 97, FIN: 90, DNK: 70, HAN: 96, PAS: 96, PDEF: 92, IDEF: 82, BLK: 58, REB: 70, ATH: 90, STR: 82, CLU: 99 }],
  'Tayshaun Prince': ['泰肖恩-普林斯', 'SF', 84, { threePT: 82, MID: 85, FIN: 88, DNK: 80, HAN: 85, PAS: 80, PDEF: 94, IDEF: 90, BLK: 78, REB: 76, ATH: 86, STR: 72, CLU: 82 }],
  'Tony Parker': ['托尼-帕克', 'PG', 88, { threePT: 82, MID: 92, FIN: 92, DNK: 85, HAN: 96, PAS: 92, PDEF: 85, IDEF: 78, BLK: 50, REB: 65, ATH: 95, STR: 75, CLU: 94 }],
  'Derek Fisher': ['德里克-费舍尔', 'PG', 78, { threePT: 92, MID: 85, FIN: 75, DNK: 58, HAN: 85, PAS: 82, PDEF: 80, IDEF: 70, BLK: 45, REB: 55, ATH: 80, STR: 70, CLU: 95 }],
  'Manu Ginobili': ['马努-吉诺比利', 'SG', 87, { threePT: 88, MID: 86, FIN: 92, DNK: 78, HAN: 96, PAS: 90, PDEF: 90, IDEF: 80, BLK: 55, REB: 70, ATH: 90, STR: 70, CLU: 97 }],

  'Bruce Bowen': ['布鲁斯-鲑文', 'SF', 78],
  'Rasho Nesterovic': ['拉索-内斯特洛维奇', 'C', 74],
  'Wally Szczerbiak': ['沃利-斯泽比亚克', 'SF', 78],
  'Brad Miller': ['布拉德-米勒', 'C', 78],
  'Richard Hamilton': ['理查德-汉密顿', 'SG', 88, { threePT: 82, MID: 97, FIN: 92, DNK: 72, HAN: 90, PAS: 80, PDEF: 86, IDEF: 78, BLK: 50, REB: 66, ATH: 90, STR: 66, CLU: 95 }],
  'Ben Wallace': ['本-华莱士', 'C', 90, { threePT: 30, MID: 32, FIN: 72, DNK: 80, HAN: 38, PAS: 38, PDEF: 99, IDEF: 99, BLK: 99, REB: 99, ATH: 88, STR: 99, CLU: 90 }],
  'Al Harrington': ['阿尔-哈灵顿', 'PF', 76],
  'Kenyon Martin': ['肯扬-马丁', 'PF', 80],
  'Jason Collins': ['杰森-科林斯', 'C', 72],
  'Eric Snow': ['埃里克-斯诺', 'PG', 72],
  'Aaron McKie': ['阿伦-麦基', 'SG', 74],
  'Tyronn Lue': ['泰伦-卢', 'PG', 72],
  'Steve Francis': ['史蒂夫-弗兰西斯', 'PG', 82],
  'Cuttino Mobley': ['卡蒂诺-莫布利', 'SG', 78],
  'Ricky Davis': ['里基-戴维斯', 'SG', 76],
  'Lamar Odom': ['拉马尔-奥多姆', 'SF', 80],
  'Udonis Haslem': ['尤杜尼斯-哈斯勒姆', 'PF', 76],
  'Brian Grant': ['布莱恩-格兰特', 'PF', 74],
  'Andre Miller': ['安德烈-米勒', 'PG', 80],
  'Shawn Marion': ['肖恩-马里奥', 'SF', 82],
  'Rashard Lewis': ['拉沙德-刘易斯', 'SF', 80],
  'Ronald Murray': ['罗纳德-穆雷', 'SG', 74],
  'Darius Miles': ['达里乌斯-迈尔斯', 'SF', 72],
  'Gilbert Arenas': ['吉尔伯特-阿里纳斯', 'PG', 84],
  'Larry Hughes': ['拉里-休斯', 'SG', 76],
  'Michael Redd': ['迈克尔-雷德', 'SG', 82],
  'Desmond Mason': ['德斯蒙德-梅森', 'SF', 74],
  'James Posey': ['詹姆斯-波赛', 'SF', 74],
  'Jason Williams': ['贾森-威廉斯', 'PG', 76],
  'Raef LaFrentz': ['拉夫-拉弗伦茨', 'PF', 74],
  'Jason Terry': ['杰森-特里', 'SG', 80],
  'Theo Ratliff': ['西奥-拉特利夫', 'C', 76],
  'Baron Davis': ['拜伦-戴维斯', 'PG', 84],
  'David Wesley': ['大卫-韦斯利', 'PG', 74],
  'Morris Peterson': ['莫里斯-皮特森', 'SG', 74],
  'Jamal Crawford': ['贾马尔-克劳弗德', 'SG', 76],
  'Marcus Fizer': ['马库斯-费泽', 'PF', 72],
  'Lamond Murray': ['拉蒙德-穆雷', 'SF', 74, { threePT: 74, MID: 76, FIN: 80, DNK: 76, HAN: 72, PAS: 54, PDEF: 66, IDEF: 66, BLK: 52, REB: 64, ATH: 80, STR: 62, CLU: 67 }],
  'Samuel Dalembert': ['萨缪尔-戴勒姆波特', 'C', 76, { threePT: 30, MID: 40, FIN: 72, DNK: 72, HAN: 42, PAS: 35, PDEF: 78, IDEF: 86, BLK: 88, REB: 86, ATH: 70, STR: 82, CLU: 62 }],
  'Kurt Thomas': ['科特-汤姆斯', 'PF', 74],
  'Elton Brand': ['埃尔顿-布兰德', 'PF', 82],
  'Corey Maggette': ['科里-马盖蒂', 'SF', 76],
  'Quentin Richardson': ['昆廷-理查德森', 'SG', 76],
  'Marko Jaric': ['马尔科-亚里奇', 'PG', 72],
  'Andrei Kirilenko': ['安德烈-基里连科', 'SF', 80],
  'Matt Harpring': ['马特-哈普林', 'SF', 74],
  'Mehmet Okur': ['梅米特-奥库', 'C', 74],
  'Nene': ['内内', 'PF', 76],
  'Drew Gooden': ['德鲁-古登', 'PF', 76],
};

/** 时代开局预载新秀的真实落队修正（选秀顺位后被交易/到期后正式加盟的球员） */
var ERA_ROOKIE_TEAM_OVERRIDES = {
  'Kobe Bryant': 'LAL',
  'Ray Allen': 'MIL'
};

/** 各时代各队真实核心球员（仅收当年活跃者；当届新秀由预载机制加入，这里不重复） */
var ERA_ROSTERS = {
  1984: {
    ATL: ['Dominique Wilkins', 'Doc Rivers', 'Tree Rollins', 'Randy Wittman', 'Johnny Davis', 'Eddie Johnson', 'Antoine Carr', 'Cliff Levingston', 'Spud Webb', 'Kevin Willis'],
    BKN: ['Buck Williams', 'Micheal Ray Richardson', 'Otis Birdsong', 'Kelvin Ransey', 'Albert King', 'Mike Gminski', 'Darwin Cook', 'Len Elmore', 'Jeff Turner'],
    BOS: ['Larry Bird', 'Kevin McHale', 'Robert Parish', 'Dennis Johnson', 'Danny Ainge', 'Jerry Sichting', 'Carlos Clark', 'Cedric Maxwell', 'M.L. Carr', 'Scott Wedman'],
    CHI: ['Orlando Woolridge', 'Quintin Dailey', 'Dave Greenwood', 'Wes Matthews', 'Steve Johnson', 'Jawann Oldham', 'Gene Banks', 'Sidney Green', 'Ennis Whatley'],
    CLE: ['World B. Free', 'Roy Hinson', 'Mark West', 'John Bagley', 'Kevin Williams', 'Lonnie Shelton', 'Mel Turpin', 'Dirk Minniefield', 'Phil Hubbard', 'Ben Poquette'],
    DAL: ['Mark Aguirre', 'Rolando Blackman', 'Derek Harper', 'Jay Vincent', 'Brad Davis', 'Dale Ellis', 'Sam Perkins', 'Kurt Nimphius', 'Pat Cummings', 'Bill Wennington'],
    DEN: ['Alex English', 'Dan Issel', 'Fat Lever', 'Calvin Natt', 'Mike Evans', 'T.R. Dunn', 'Wayne Cooper', 'Bill Hanzlik', 'Elston Turner', 'Willie White'],
    DET: ['Isiah Thomas', 'Bill Laimbeer', 'Vinnie Johnson', 'Kelly Tripucka', 'John Long', 'Joe Dumars', 'Earl Cureton', 'Tony Campbell', 'David Thirdkill'], // ★ 修复：马洪 84-85 在奇才
    GSW: ['Purvis Short', 'Sleepy Floyd', 'Lester Conner', 'Steve Burtt', 'Larry Smith', 'Joe Barry Carroll', 'Mickey Johnson', 'Chris Mullin'],
    HOU: ['Ralph Sampson', 'Rodney McCray', 'Lewis Lloyd', 'John Lucas', 'Mitchell Wiggins', 'Jim Petersen', 'Allen Leavell', 'Hank McDowell'],
    IND: ['Clark Kellogg', 'Herb Williams', 'Vern Fleming', 'Terence Stansbury', 'Bill Garnett', 'Steve Stipanovich', 'Devin Durrant', 'Jim Thomas'], // ★ 修复：乔治-约翰逊 84-85 在 76 人
    LAC: ['Bill Walton', 'Norm Nixon', 'Derek Smith', 'James Donaldson', 'Junior Bridgeman', 'Michael Brooks', 'Roy White', 'Lancaster Gordon'],
    LAL: ['Magic Johnson', 'Kareem Abdul-Jabbar', 'James Worthy', 'Byron Scott', 'Michael Cooper', 'Bob McAdoo', 'Kurt Rambis', 'Mitch Kupchak', 'Mike McGee', 'Larry Spriggs'],
    MIL: ['Sidney Moncrief', 'Terry Cummings', 'Paul Pressey', 'Marques Johnson', 'Craig Hodges', 'Kevin Grevey', 'Alton Lister', 'Randy Breuer', 'Kenny Fields', 'Paul Mokeski'],
    NYK: ['Bernard King', 'Bill Cartwright', 'Rory Sparrow', 'Darrell Walker', 'Trent Tucker', 'James Bailey', 'Marvin Webster', 'Louis Orr', 'Ernie Grunfeld', 'Ken Bannister'],
    OKC: ['Tom Chambers', 'Jack Sikma', 'Al Wood', 'Frank Brickowski', 'Tim McCormick', 'Danny Vranes', 'John Greig'], // ★ 修复 84-85 超音速实际名单：威廉姆斯/斯瑞特当年在 76 人与奇才
    PHI: ['Julius Erving', 'Moses Malone', 'Maurice Cheeks', 'Andrew Toney', 'Clint Richardson', 'Bobby Jones', 'Leon Wood', 'Sam Williams', 'Clemon Johnson', 'Sedale Threatt', 'George Johnson'], // ★ 修复：补回 84-85 76 人真实成员
    PHX: ['Larry Nance', 'Walter Davis', 'Maurice Lucas', 'Alvan Adams', 'Kyle Macy', 'Jay Humphries', 'James Edwards', 'Charles Jones', 'Rod Foster', 'Mike Sanders'],
    POR: ['Clyde Drexler', 'Jim Paxson', 'Kiki Vandeweghe', 'Steve Colter', 'Mychal Thompson', 'Kenny Carr', 'Darnell Valentine', 'Sam Bowie', 'Jerome Kersey'],
    SAC: ['Reggie Theus', 'LaSalle Thompson', 'Larry Drew', 'Mike Woodson', 'Otis Thorpe', 'Joe Meriweather', 'Mark Olberding', 'Carl Henry'],
    SAS: ['George Gervin', 'Artis Gilmore', 'Mike Mitchell', 'Johnny Moore', 'Alvin Robertson', 'Jeff Cook', 'Marc Iavaroni', 'Ed Nealy', 'Ozell Jones'],
    UTA: ['Adrian Dantley', 'Darrell Griffith', 'Thurl Bailey', 'Mark Eaton', 'John Stockton', 'Bob Hansen', 'Jeff Wilkins', 'Rickey Green', 'Pace Mannion'],
    WAS: ['Jeff Malone', 'Jeff Ruland', 'Frank Johnson', 'Dan Roundfield', 'Dudley Bradley', 'Greg Ballard', 'Tom McMillen', 'Darren Daye', 'Gus Williams', 'Rick Mahorn'], // ★ 修复：补回 84-85 奇才真实成员
  },
  1996: {
    ATL: ['Dikembe Mutombo', 'Steve Smith', 'Mookie Blaylock', 'Ed Gray', 'Christian Laettner', 'Dwayne Schintzius', 'Eldridge Recasner', 'Donnie Boyce', 'Alan Henderson', 'Tyrone Corbin'],
    BKN: ['Kendall Gill', 'Jayson Williams', 'Sam Cassell', 'Chris Gatling', 'Yinka Dare', "Ed O'Bannon", 'David Benoit', 'Rumeal Robinson', 'Adrian Caldwell'],
    BOS: ['Dana Barros', 'Rick Fox', 'Dino Radja', 'Dee Brown', 'Todd Day', 'Antoine Walker', 'Brett Szabo', 'Tyus Edney', 'Greg Minor', 'Marty Conlon', 'David Wesley'],
    CHA: ['Glen Rice', 'Vlade Divac', 'Anthony Mason', 'Dell Curry', 'Muggsy Bogues', 'Tony Delk', 'J.R. Reid', 'George Zidek', 'Malik Rose', 'Scott Burrell'],
    CHI: ['Michael Jordan', 'Scottie Pippen', 'Dennis Rodman', 'Toni Kukoc', 'Ron Harper', 'Steve Kerr', 'Randy Brown', 'Luc Longley', 'Jud Buechler', 'Jason Caffey'],
    CLE: ['Terrell Brandon', 'Bobby Phills', 'Reggie Geary', 'Bob Sura', 'Tyrone Hill', 'Vitaly Potapenko', 'Chris Mills', 'Danny Ferry', 'Carl Thomas', 'Mitchell Butler'],
    DAL: ['Jim Jackson', 'Michael Finley', 'Derek Harper', 'Erick Strickland', 'A.C. Green', 'George McCloud', 'Lorenzo Williams', 'Eric Montross', 'Chris Anstey', 'Samaki Walker'],
    DEN: ['Antonio McDyess', 'LaPhonso Ellis', 'Mark Jackson', 'Dale Ellis', 'Tom Hammonds', 'Steve Hamer', 'Ervin Johnson', 'Sarunas Marciulionis', 'Anthony Goldwire', 'Brooks Thompson'],
    DET: ['Grant Hill', 'Joe Dumars', 'Otis Thorpe', 'Terry Mills', 'Lindsey Hunter', 'Theo Ratliff', 'Don Reid', 'Michael Curry', 'Stacey Augmon', 'Jerome Williams'],
    GSW: ['Latrell Sprewell', 'Chris Mullin', 'Joe Smith', 'B.J. Armstrong', 'Bimbo Coles', 'Donyell Marshall', 'Todd Fuller', 'Joe Wolf', 'Ray Owes', 'Felton Spencer'],
    HOU: ['Hakeem Olajuwon', 'Charles Barkley', 'Clyde Drexler', 'Matt Maloney', 'Kevin Willis', 'Emanual Davis', 'Mario Elie', 'Charles Jones', 'Sedale Threatt', 'Tracy Moore'],
    IND: ['Reggie Miller', 'Rik Smits', 'Dale Davis', 'Antonio Davis', 'Derrick McKey', 'Travis Best', 'Fred Hoiberg', 'Duane Ferrell', 'Eddie Johnson'],
    LAC: ['Loy Vaught', 'Lamond Murray', 'Brent Barry', 'Darrick Martin', 'Malik Sealy', 'Rodney Rogers', 'Kevin Duckworth', 'Terry Dehere', 'Eric Piatkowski', 'Bo Outlaw'],
    LAL: ["Shaquille O'Neal", 'Nick Van Exel', 'Eddie Jones', 'Elden Campbell', 'Derek Fisher', 'Kobe Bryant', 'Robert Horry', 'Travis Knight', 'Jerome Kersey'],
    MEM: ['Bryant Reeves', 'Blue Edwards', 'Pooh Richardson', 'Lawrence Moten', 'Pete Chilcutt', 'George Lynch', 'Lee Mayberry', 'Anthony Avent', 'Roy Rogers', 'Kevin Edwards'],
    MIA: ['Tim Hardaway', 'Alonzo Mourning', 'Jamal Mashburn', 'P.J. Brown', 'Voshon Lenard', 'Keith Askins', 'Isaac Austin', 'Dan Majerle', 'Walt Williams', 'Kevin Gamble'],
    MIL: ['Vin Baker', 'Glenn Robinson', 'Sherman Douglas', 'Ray Allen', 'Armon Gilliam', 'Andrew Lang', 'Johnny Newman', 'Jeff Nordgaard', 'Jerald Honeycutt'],
    MIN: ['Kevin Garnett', 'Tom Gugliotta', 'Terry Porter', 'Stephon Marbury', 'Reggie Jordan', 'Sam Mitchell', 'Cherokee Parks', 'Chris Carr', 'Shane Heal', 'Doug West'],
    NYK: ['Patrick Ewing', 'Allan Houston', 'John Starks', 'Larry Johnson', 'Charles Oakley', 'Chris Childs', 'Charlie Ward', 'Buck Williams', 'John Wallace', 'Walter McCarty'],
    OKC: ['Gary Payton', 'Shawn Kemp', 'Detlef Schrempf', 'Hersey Hawkins', 'Eric Snow', 'Craig Ehlo', 'Sam Perkins', 'Jim McIlvaine', 'David Wingate', 'Nate McMillan'],
    ORL: ['Anfernee Hardaway', 'Nick Anderson', 'Dennis Scott', 'Rony Seikaly', 'Darrell Armstrong', 'Brian Shaw', 'Horace Grant', 'Danny Schayes', 'Gerald Wilkins', 'Derek Strong'],
    PHI: ['Jerry Stackhouse', 'Derrick Coleman', 'Allen Iverson', 'Rex Walters', 'Clarence Weatherspoon', 'Michael Cage', 'Mark Davis', 'Don MacLean', 'Mark Hendrickson', 'Johnny Dawkins'],
    PHX: ['Kevin Johnson', 'Jason Kidd', 'Danny Manning', 'Rex Chapman', 'Elliot Perry', 'Hot Rod Williams', 'Mark Bryant', 'Wesley Person', 'Mario Bennett', 'Wayman Tisdale'],
    POR: ['Arvydas Sabonis', 'Isaiah Rider', 'Cliff Robinson', 'Kenny Anderson', 'Randolph Childress', 'James Robinson', 'Rasheed Wallace', 'Alton Lister', 'Gary Trent', "Jermaine O\'Neal"],
    SAC: ['Mitch Richmond', 'Mahmoud Abdul-Rauf', 'Olden Polynice', 'Bobby Hurley', 'Corliss Williamson', 'Billy Owens', 'Michael Smith', 'Lionel Simmons', 'Brian Grant'],
    SAS: ['David Robinson', 'Sean Elliott', 'Avery Johnson', 'Vinny Del Negro', 'Cory Alexander', 'Charles Smith', 'Will Perdue', 'Monty Williams', 'Chuck Person', 'Carl Herrera'],
    TOR: ['Damon Stoudamire', 'Doug Christie', 'Damon Jones', 'Marcus Camby', 'Popeye Jones', 'Carlos Rogers', 'Sharone Wright', 'Tony Massenburg', 'Zan Tabak'],
    UTA: ['Karl Malone', 'John Stockton', 'Jeff Hornacek', 'Greg Ostertag', 'Howard Eisley', 'Shandon Anderson', 'Antoine Carr', 'Greg Foster', 'Troy Hudson', 'Bryon Russell'],
    WAS: ['Chris Webber', 'Juwan Howard', 'Rod Strickland', 'Gheorghe Muresan', 'Chris Whitney', 'Ledell Eackles', 'Harvey Grant', 'Tracy Murray', 'Ben Wallace', 'Tim Legler'],
  },
  2003: {
    ATL: ['Jason Terry', 'Stephen Jackson', 'Theo Ratliff', 'Alan Henderson', 'Dion Glover', 'Chris Crawford', 'Travis Hansen', 'Lee Nailon'],
    BKN: ['Jason Kidd', 'Kenyon Martin', 'Richard Jefferson', 'Kerry Kittles', 'Jason Collins', 'Zoran Planinic', 'Lucious Harris', 'Rodney Rogers', 'Aaron Williams', 'Brian Scalabrine'],
    BOS: ['Paul Pierce', 'Raef LaFrentz', 'Tony Battie', 'Mike James', 'Jiri Welsch', 'Walter McCarty', 'Mark Blount', 'Marcus Banks', 'Kedrick Brown', 'Brandon Hunter'],
    CHI: ['Eddy Curry', 'Jamal Crawford', 'Marcus Fizer', 'Kendall Gill', 'Antonio Davis', 'Jerome Williams', 'Corie Blount', 'Trenton Hassell', 'Eddie Robinson', 'Ronald Dupree'],
    CLE: ['Zydrunas Ilgauskas', 'Carlos Boozer', 'Ricky Davis', 'Kevin Ollie', 'Dajuan Wagner', 'Eric Williams', 'Ira Newble', 'Jeff McInnis', 'Jason Kapono', 'DeSagana Diop'],
    DAL: ['Dirk Nowitzki', 'Steve Nash', 'Michael Finley', 'Antoine Walker', 'Travis Best', 'Marquis Daniels', 'Danny Fortson', 'Shawn Bradley', 'Josh Howard', 'Tony Delk'],
    DEN: ['Marcus Camby', 'Nene', 'Andre Miller', 'Earl Boykins', 'Voshon Lenard', 'Chris Andersen', 'Francisco Elson', 'Rodney White', 'Ryan Bowen', 'Michael Doleac'],
    DET: ['Chauncey Billups', 'Richard Hamilton', 'Ben Wallace', 'Rasheed Wallace', 'Tayshaun Prince', 'Lindsey Hunter', 'Bob Sura', 'Corliss Williamson', 'Mehmet Okur', 'Elden Campbell'],
    GSW: ['Jason Richardson', 'Mike Dunleavy', 'Erick Dampier', 'Nick Van Exel', 'Speedy Claxton', 'Mickael Pietrus', 'Clifford Robinson', 'Adonal Foyle', 'Avery Johnson', 'Evan Eschmeyer'],
    HOU: ['Yao Ming', 'Steve Francis', 'Cuttino Mobley', 'Jim Jackson', 'Mark Jackson', 'Eric Piatkowski', 'Maurice Taylor', 'Kelvin Cato', 'Bostjan Nachbar', 'Scott Padgett'],
    IND: ['Reggie Miller', "Jermaine O'Neal", 'Ron Artest', 'Jamaal Tinsley', 'Al Harrington', 'Anthony Johnson', 'Fred Jones', 'Austin Croshere', 'Jeff Foster', 'Jonathan Bender'],
    LAC: ['Elton Brand', 'Corey Maggette', 'Quentin Richardson', 'Marko Jaric', 'Keyon Dooling', 'Chris Wilcox', 'Predrag Drobnjak', 'Bobby Simmons', 'Doug Overton', 'Melvin Ely'],
    LAL: ['Kobe Bryant', "Shaquille O'Neal", 'Karl Malone', 'Gary Payton', 'Derek Fisher', 'Devean George', 'Rick Fox', 'Slava Medvedenko', 'Kareem Rush', 'Luke Walton'],
    MEM: ['Pau Gasol', 'Mike Miller', 'James Posey', 'Jason Williams', 'Earl Watson', 'Stromile Swift', 'Lorenzen Wright', 'Dahntay Jones', 'Ryan Humphrey'],
    MIA: ['Lamar Odom', 'Eddie Jones', 'Udonis Haslem', 'Brian Grant', 'Rafer Alston', 'Caron Butler', 'Malik Allen', 'Rasual Butler', 'John Wallace', 'Loren Woods'],
    MIL: ['Michael Redd', 'Desmond Mason', 'Joe Smith', 'Erick Strickland', 'Brian Skinner', 'Dan Gadzuric', 'Toni Kukoc', 'Marcus Haislip', 'Brevin Knight'],
    MIN: ['Kevin Garnett', 'Sam Cassell', 'Latrell Sprewell', 'Wally Szczerbiak', 'Troy Hudson', 'Fred Hoiberg', 'Mark Madsen', 'Michael Olowokandi', 'Gary Trent', 'Ervin Johnson'],
    NOP: ['Baron Davis', 'Jamal Mashburn', 'David Wesley', 'P.J. Brown', 'Darrell Armstrong', 'Steve Smith', 'David West', 'Jamaal Magloire', 'Shammond Williams', 'George Lynch'],
    NYK: ['Allan Houston', 'Stephon Marbury', 'Kurt Thomas', 'Keith Van Horn', 'Moochie Norris', 'Shandon Anderson', 'Michael Sweetney', 'Nazr Mohammed', 'Othella Harrington', 'Dikembe Mutombo'],
    OKC: ['Ray Allen', 'Rashard Lewis', 'Ronald Murray', 'Antonio Daniels', 'Jerome James', 'Reggie Evans', 'Vladimir Radmanovic', 'Luke Ridnour', 'Vitaly Potapenko', 'Ansu Sesay'],
    ORL: ['Tracy McGrady', 'Tyronn Lue', 'Juwan Howard', 'Drew Gooden', 'Reece Gaines', 'Gordan Giricek', 'Pat Garrity', 'Steven Hunter', 'Keith Bogans', 'Zaza Pachulia'],
    PHI: ['Allen Iverson', 'Eric Snow', 'Aaron McKie', 'Samuel Dalembert', 'Glenn Robinson', 'Kenny Thomas', 'John Salmons', 'Marc Jackson', 'Kyle Korver', 'Willie Green'],
    PHX: ['Shawn Marion', 'Amare Stoudemire', 'Joe Johnson', 'Anfernee Hardaway', 'Antonio McDyess', 'Leandro Barbosa', 'Casey Jacobsen', 'Jake Voskuhl', 'Jahidi White', 'Zarko Cabarkapa'],
    POR: ['Zach Randolph', 'Darius Miles', 'Damon Stoudamire', 'Shareef Abdur-Rahim', 'Ruben Patterson', 'Dale Davis', 'Derek Anderson', 'Vladimir Stepania', 'Travis Outlaw'],
    SAC: ['Chris Webber', 'Mike Bibby', 'Peja Stojakovic', 'Brad Miller', 'Doug Christie', 'Bobby Jackson', 'Anthony Peeler', 'Darius Songaila', 'Tony Massenburg', 'Gerald Wallace'],
    SAS: ['Tim Duncan', 'Tony Parker', 'Manu Ginobili', 'Bruce Bowen', 'Rasho Nesterovic', 'Alex Garcia', 'Devin Brown', 'Robert Horry', 'Malik Rose', 'Hedo Turkoglu'],
    TOR: ['Vince Carter', 'Jalen Rose', 'Morris Peterson', 'Alvin Williams', 'Donyell Marshall', 'Chris Bosh', 'Lamond Murray', 'Michael Curry', 'Milt Palacio', 'Robert Archibald'],
    UTA: ['Andrei Kirilenko', 'Matt Harpring', 'Carlos Arroyo', 'Raja Bell', 'Jarron Collins', 'Raul Lopez', 'Greg Ostertag', 'Sasha Pavlovic', 'Mo Williams'],
    WAS: ['Gilbert Arenas', 'Antawn Jamison', 'Larry Hughes', 'Kwame Brown', 'Steve Blake', 'Juan Dixon', 'Christian Laettner', 'Brendan Haywood', 'Jarvis Hayes', 'Etan Thomas'],
  },

};

/** 联盟演化：各时代初始活跃队 + 扩军年份（向当前季赛年 = eraStart + seasonCount 对比） */
var ERA_TEAM_EVOLUTION = {
  1984: {
    startActive: ['ATL','BKN','BOS','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MIL','NYK','OKC','PHI','PHX','POR','SAC','SAS','UTA','WAS'],
    expansions: {
      1988: ['CHA','MIA'], 1989: ['ORL','MIN'], 1995: ['TOR','MEM'],
      2002: { add: ['NOP'], remove: ['CHA'] },   // ★ 黄蜂迁至新奥尔良（夏洛特 02-04 无球队）
      2004: ['CHA']                               // ★ 山猫入盟（30 队）
    }
  },
  1996: {
    startActive: ['ATL','BKN','BOS','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'],
    expansions: { 2002: { add: ['NOP'], remove: ['CHA'] }, 2004: ['CHA'] }
  },
  2003: {
    startActive: ['ATL','BKN','BOS','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'],
    expansions: { 2004: ['CHA'] }
  }
};

/** 当前（即将开始的）赛季的活跃球队列表（现实模式返回全部） */
function getEraActiveTeams(era, seasonCount) {
  if (typeof ERA_TEAM_EVOLUTION === 'undefined') return (typeof NBA2K_TEAMS !== 'undefined') ? NBA2K_TEAMS.slice() : [];
  var ev = ERA_TEAM_EVOLUTION[era];
  if (!ev || !ev.startActive) return (typeof NBA2K_TEAMS !== 'undefined') ? NBA2K_TEAMS.slice() : [];
  var active = ev.startActive.slice();
  var yr = (parseInt(era, 10) || 0) + (parseInt(seasonCount, 10) || 0);
  Object.keys(ev.expansions || {}).forEach(function(y) {
    if (parseInt(y, 10) <= yr) {
      var entry = ev.expansions[y] || [];
      var adds = Array.isArray(entry) ? entry : (entry.add || []);
      var rems = Array.isArray(entry) ? [] : (entry.remove || []);
      adds.forEach(function(t) { if (active.indexOf(t) < 0) active.push(t); });
      rems.forEach(function(t) { var ix = active.indexOf(t); if (ix >= 0) active.splice(ix, 1); });
    }
  });
  return active;
}

/** 当前赛季该队是否已加入联盟 */
function isEraTeamActive(team) {
  if (!STATE || STATE.draftMode !== 'historical' || !STATE.eraStart) return true;
  var sc = (STATE.career && STATE.career.seasonCount) || 0;
  return getEraActiveTeams(String(STATE.eraStart), sc).indexOf(team) >= 0;
}

/** 建球员/自由市场等场景的可选球队池 */
function getEraTeamPool() {
  if (!STATE || STATE.draftMode !== 'historical' || !STATE.eraStart) return (typeof NBA2K_TEAMS !== 'undefined') ? NBA2K_TEAMS.slice() : [];
  var sc = (STATE.career && STATE.career.seasonCount) || 0;
  return getEraActiveTeams(String(STATE.eraStart), sc);
}

/** 该队在当前时代的加盟年份（无：原创队） */
function getEraTeamFoundedYear(team) {
  if (!STATE || STATE.draftMode !== 'historical' || !STATE.eraStart) return null;
  var ev = ERA_TEAM_EVOLUTION[STATE.eraStart];
  if (!ev) return null;
  if (ev.startActive.indexOf(team) >= 0) return null;
  var yr = null;
  Object.keys(ev.expansions || {}).forEach(function(y) {
    if ((ev.expansions[y] || []).indexOf(team) >= 0) yr = parseInt(y, 10);
  });
  return yr;
}

// ==================== 时代名单构建 ====================
// ★ 1984 时代之前（1979-1983 届）核心球星的选秀年份补充表：
//   HISTORICAL_DRAFT_CLASSES 从 1984 届才开始，1984 时代开局里的年轻球星
//   （沃西/滑翔机/威尔金斯/伊塞亚/萨姆森等）需要靠此表推算“入盟第几年”，
//   从而走年轻成长曲线（并在 eraPlayerAgeByDraft 中修正真实年龄）。
var ERA_PRE_DRAFT_YEARS = {
  'James Worthy': 1982, 'Byron Scott': 1983, 'Mike McGee': 1981, 'Larry Spriggs': 1981,
  'Dominique Wilkins': 1982, 'Doc Rivers': 1983, 'Randy Wittman': 1983, 'Eddie Johnson': 1981,
  'Antoine Carr': 1983, 'Cliff Levingston': 1982,
  'Clyde Drexler': 1983, 'Darnell Valentine': 1981,
  'Ralph Sampson': 1983, 'Rodney McCray': 1983, 'Mitchell Wiggins': 1983,
  'Isiah Thomas': 1981, 'Kelly Tripucka': 1981, 'David Thirdkill': 1982,
  'Mark Aguirre': 1981, 'Rolando Blackman': 1981, 'Derek Harper': 1983, 'Jay Vincent': 1981,
  'Dale Ellis': 1983, 'Kurt Nimphius': 1981,
  'Clark Kellogg': 1982, 'Herb Williams': 1981, 'Bill Garnett': 1982, 'Steve Stipanovich': 1983, 'Jim Thomas': 1983,
  'Terry Cummings': 1982, 'Paul Pressey': 1982, 'Craig Hodges': 1982, 'Alton Lister': 1981, 'Randy Breuer': 1983,
  'Buck Williams': 1981, 'Albert King': 1981,
  'Orlando Woolridge': 1981, 'Quintin Dailey': 1982, 'Steve Johnson': 1981, 'Sidney Green': 1983,
  'Ennis Whatley': 1983, 'Gene Banks': 1981,
  'Roy Hinson': 1983, 'Mark West': 1983, 'John Bagley': 1982, 'Kevin Williams': 1983, 'Dirk Minniefield': 1983,
  'Fat Lever': 1982, 'Elston Turner': 1981,
  'Sleepy Floyd': 1982, 'Lester Conner': 1982,
  'Derek Smith': 1982, 'Roy White': 1982,
  'Tom Chambers': 1981, 'Sedale Threatt': 1983, 'Al Wood': 1981, 'Frank Brickowski': 1981,
  'Danny Vranes': 1981, 'John Greig': 1982,
  'Larry Nance': 1981, 'Charles Jones': 1983, 'Rod Foster': 1982, 'Mike Sanders': 1982,
  'LaSalle Thompson': 1982,
  'Sam Williams': 1981, 'Marc Iavaroni': 1982, 'Ed Nealy': 1982,
  'Thurl Bailey': 1983, 'Mark Eaton': 1982, 'Bob Hansen': 1983, 'Pace Mannion': 1983,
  'Jeff Malone': 1983, 'Jeff Ruland': 1981, 'Frank Johnson': 1981, 'Darren Daye': 1983,
  'Darrell Walker': 1983, 'Trent Tucker': 1982, 'Danny Ainge': 1981, 'Carlos Clark': 1983
};

// ★ 特定球星的巅峰曲线：peakPro = 入盟第几年到达巅峰（1 = 新秀季）。
//   现实 NBA 球员普遍 4-5 季进巅峰（巅峰 26-28 岁），此处登记“大器晚成”的慢热球星，
//   evolveLeague 会按他们的真实巅峰年放宽成长窗口并放缓前期成长（如纳什 9 年、约基奇 7 年）。
var ERA_STAR_CURVES = {
  'Steve Nash': { peakPro: 9 },
  'Chauncey Billups': { peakPro: 6 },
  'Tracy McGrady': { peakPro: 6 },
  'Dirk Nowitzki': { peakPro: 5 },
  'Stephen Curry': { peakPro: 6 },
  'James Harden': { peakPro: 5 },
  'Jimmy Butler': { peakPro: 5 },
  'Kawhi Leonard': { peakPro: 5 },
  'Paul George': { peakPro: 5 },
  'Giannis Antetokounmpo': { peakPro: 6 },
  'Nikola Jokic': { peakPro: 7 },
  'Victor Wembanyama': { peakPro: 5 }
};

var ERA_STAR_ATTRS = {
  // ===== 1984 时代 =====
  'Doc Rivers': ['道格-里弗斯','PG',80,{threePT:55,MID:75,FIN:82,DNK:65,HAN:86,PAS:88,PDEF:88,IDEF:80,BLK:55,REB:62,ATH:85,STR:62,CLU:88}],
  'Michael Cooper': ['迈克尔-库珀','SG',80,{threePT:62,MID:78,FIN:78,DNK:68,HAN:84,PAS:74,PDEF:99,IDEF:90,BLK:62,REB:60,ATH:88,STR:60,CLU:90}],
  'Byron Scott': ['拜伦-斯科特','SG',82,{threePT:70,MID:88,FIN:88,DNK:78,HAN:84,PAS:72,PDEF:82,IDEF:78,BLK:55,REB:62,ATH:88,STR:64,CLU:90}],
  'Bill Laimbeer': ['比尔-兰比尔','C',84,{threePT:42,MID:88,FIN:90,DNK:55,HAN:74,PAS:62,PDEF:74,IDEF:88,BLK:88,REB:96,ATH:55,STR:96,CLU:90}],
  'Terry Cummings': ['特里-卡明斯','PF',84,{threePT:40,MID:84,FIN:92,DNK:88,HAN:78,PAS:64,PDEF:78,IDEF:82,BLK:80,REB:94,ATH:90,STR:94,CLU:88}],
  'Jack Sikma': ['杰克-西克马','C',84,{threePT:55,MID:90,FIN:90,DNK:62,HAN:76,PAS:68,PDEF:78,IDEF:88,BLK:86,REB:94,ATH:58,STR:95,CLU:90}],
  'Walter Davis': ['沃尔特-戴维斯','SG',84,{threePT:62,MID:95,FIN:95,DNK:82,HAN:90,PAS:76,PDEF:80,IDEF:76,BLK:55,REB:62,ATH:93,STR:62,CLU:95}],
  'Kiki Vandeweghe': ['奇奇-范德维奇','SF',84,{threePT:88,MID:97,FIN:95,DNK:66,HAN:84,PAS:70,PDEF:60,IDEF:62,BLK:48,REB:62,ATH:76,STR:58,CLU:92}],
  'Fat Lever': ['拉法叶-利弗','PG',82,{threePT:55,MID:82,FIN:86,DNK:70,HAN:90,PAS:92,PDEF:88,IDEF:84,BLK:55,REB:78,ATH:86,STR:62,CLU:90}],
  'Dan Issel': ['丹-伊塞尔','C',84,{threePT:45,MID:96,FIN:96,DNK:62,HAN:78,PAS:64,PDEF:66,IDEF:80,BLK:78,REB:94,ATH:58,STR:95,CLU:93}],
  'Artis Gilmore': ['阿蒂斯-吉尔摩','C',84,{threePT:30,MID:82,FIN:96,DNK:88,HAN:74,PAS:58,PDEF:88,IDEF:94,BLK:96,REB:97,ATH:72,STR:98,CLU:90}],
  'Buck Williams': ['巴克-威廉姆斯','PF',84,{threePT:30,MID:68,FIN:92,DNK:82,HAN:72,PAS:54,PDEF:94,IDEF:92,BLK:88,REB:98,ATH:86,STR:97,CLU:90}],
  'Maurice Cheeks': ['莫里斯-奇克斯','PG',82,{threePT:66,MID:80,FIN:84,DNK:58,HAN:94,PAS:94,PDEF:96,IDEF:92,BLK:48,REB:62,ATH:82,STR:54,CLU:92}],
  'Andrew Toney': ['安德鲁-托尼','SG',80,{threePT:60,MID:88,FIN:92,DNK:78,HAN:86,PAS:70,PDEF:76,IDEF:72,BLK:50,REB:58,ATH:88,STR:62,CLU:92}],
  'Bill Walton': ['比尔-沃顿','C',80,{threePT:32,MID:74,FIN:88,DNK:62,HAN:82,PAS:82,PDEF:90,IDEF:92,BLK:92,REB:94,ATH:58,STR:92,CLU:92}],
  'Otis Birdsong': ['奥蒂斯-伯德森','SG',80,{threePT:55,MID:90,FIN:92,DNK:82,HAN:84,PAS:68,PDEF:74,IDEF:70,BLK:50,REB:58,ATH:92,STR:60,CLU:90}],
  'Purvis Short': ['珀维斯-肖特','SF',82,{threePT:60,MID:94,FIN:94,DNK:76,HAN:84,PAS:64,PDEF:70,IDEF:68,BLK:52,REB:66,ATH:88,STR:64,CLU:92}],
  'Sleepy Floyd': ['斯里皮-弗洛伊德','PG',80,{threePT:66,MID:86,FIN:88,DNK:70,HAN:88,PAS:88,PDEF:78,IDEF:74,BLK:50,REB:60,ATH:90,STR:58,CLU:90}],
  'Jeff Malone': ['杰夫-马龙','SG',82,{threePT:58,MID:92,FIN:92,DNK:70,HAN:82,PAS:62,PDEF:72,IDEF:68,BLK:48,REB:58,ATH:84,STR:60,CLU:90}],
  'Jeff Ruland': ['杰夫-鲁兰','C',80,{threePT:30,MID:70,FIN:88,DNK:66,HAN:72,PAS:62,PDEF:80,IDEF:84,BLK:82,REB:92,ATH:62,STR:96,CLU:86}],
  'Darrell Griffith': ['达雷尔-格里菲斯','SG',80,{threePT:72,MID:82,FIN:88,DNK:92,HAN:78,PAS:58,PDEF:76,IDEF:70,BLK:55,REB:56,ATH:96,STR:58,CLU:88}],
  'Thurl Bailey': ['瑟尔-贝利','PF',78,{threePT:45,MID:84,FIN:88,DNK:78,HAN:76,PAS:60,PDEF:80,IDEF:84,BLK:84,REB:88,ATH:84,STR:88,CLU:86}],
  'Mark Eaton': ['马克-伊顿','C',80,{threePT:30,MID:55,FIN:72,DNK:62,HAN:60,PAS:48,PDEF:96,IDEF:99,BLK:99,REB:92,ATH:55,STR:97,CLU:84}],
  'Reggie Theus': ['雷吉-瑟斯','SG',82,{threePT:62,MID:90,FIN:90,DNK:76,HAN:86,PAS:84,PDEF:76,IDEF:72,BLK:52,REB:60,ATH:90,STR:62,CLU:90}],
  'Michael Ray Richardson': ['迈克尔-雷-理查德森','PG',82,{threePT:52,MID:80,FIN:86,DNK:74,HAN:90,PAS:94,PDEF:92,IDEF:84,BLK:58,REB:78,ATH:90,STR:62,CLU:92}],
  'Marques Johnson': ['马奎斯-约翰逊','SF',84,{threePT:48,MID:90,FIN:94,DNK:84,HAN:84,PAS:72,PDEF:78,IDEF:82,BLK:72,REB:84,ATH:90,STR:86,CLU:92}],
  'Paul Pressey': ['保罗-普雷西','SG',80,{threePT:42,MID:72,FIN:84,DNK:74,HAN:88,PAS:90,PDEF:94,IDEF:84,BLK:74,REB:74,ATH:88,STR:66,CLU:90}],
  'Alvin Robertson': ['阿尔文-罗伯特森','SG',83,{threePT:55,MID:78,FIN:84,DNK:72,HAN:88,PAS:84,PDEF:99,IDEF:92,BLK:70,REB:76,ATH:92,STR:62,CLU:90}],
  // ===== 1996 时代 =====
  'Jason Kidd': ['贾森-基德','PG',88,{threePT:66,MID:82,FIN:88,DNK:64,HAN:98,PAS:99,PDEF:94,IDEF:86,BLK:55,REB:92,ATH:90,STR:70,CLU:96}],
  'Chris Webber': ['克里斯-韦伯','PF',88,{threePT:58,MID:90,FIN:95,DNK:90,HAN:92,PAS:90,PDEF:86,IDEF:88,BLK:92,REB:98,ATH:92,STR:96,CLU:94}],
  'Mookie Blaylock': ['穆奇-布莱洛克','PG',81,{threePT:72,MID:82,FIN:86,DNK:62,HAN:90,PAS:92,PDEF:96,IDEF:84,BLK:55,REB:62,ATH:90,STR:58,CLU:90}],
  'Christian Laettner': ['克里斯蒂安-莱特纳','PF',85,{threePT:62,MID:92,FIN:92,DNK:80,HAN:84,PAS:72,PDEF:80,IDEF:84,BLK:84,REB:90,ATH:84,STR:90,CLU:90}],
  'Marcus Camby': ['马库斯-坎比','C',85,{threePT:30,MID:66,FIN:84,DNK:84,HAN:72,PAS:58,PDEF:94,IDEF:96,BLK:99,REB:96,ATH:90,STR:86,CLU:90}],
  'Shareef Abdur-Rahim': ['谢里夫-阿卜杜-拉希姆','PF',85,{threePT:50,MID:92,FIN:94,DNK:84,HAN:86,PAS:76,PDEF:78,IDEF:80,BLK:82,REB:92,ATH:90,STR:90,CLU:92}],
  'Stephon Marbury': ['史蒂芬-马布里','PG',83,{threePT:78,MID:88,FIN:92,DNK:78,HAN:96,PAS:96,PDEF:78,IDEF:70,BLK:48,REB:60,ATH:94,STR:60,CLU:92}],
  'Keith Van Horn': ['基斯-范霍恩','PF',85,{threePT:72,MID:92,FIN:92,DNK:80,HAN:80,PAS:68,PDEF:74,IDEF:78,BLK:80,REB:92,ATH:84,STR:88,CLU:90}],
  'Juwan Howard': ['朱万-霍华德','PF',83,{threePT:40,MID:88,FIN:92,DNK:80,HAN:78,PAS:66,PDEF:76,IDEF:80,BLK:78,REB:92,ATH:86,STR:92,CLU:88}],
  'Glenn Robinson': ['格伦-罗宾逊','SF',85,{threePT:76,MID:90,FIN:92,DNK:80,HAN:84,PAS:66,PDEF:70,IDEF:70,BLK:62,REB:76,ATH:88,STR:72,CLU:90}],
  'Antoine Walker': ['安托万-沃克','PF',83,{threePT:72,MID:82,FIN:88,DNK:76,HAN:82,PAS:72,PDEF:74,IDEF:76,BLK:72,REB:90,ATH:86,STR:88,CLU:86}],
  'Kerry Kittles': ['凯瑞-基特尔斯','SG',83,{threePT:78,MID:86,FIN:90,DNK:82,HAN:84,PAS:72,PDEF:84,IDEF:76,BLK:58,REB:66,ATH:90,STR:62,CLU:88}],
  'Damon Stoudamire': ['达蒙-斯塔德迈尔','PG',83,{threePT:80,MID:86,FIN:90,DNK:66,HAN:94,PAS:92,PDEF:74,IDEF:66,BLK:45,REB:56,ATH:90,STR:56,CLU:90}],
  'Joe Smith': ['乔-史密斯','PF',82,{threePT:42,MID:82,FIN:88,DNK:82,HAN:76,PAS:62,PDEF:80,IDEF:84,BLK:86,REB:90,ATH:88,STR:90,CLU:86}],
  'Antonio McDyess': ['安东尼奥-麦克戴斯','PF',82,{threePT:38,MID:80,FIN:90,DNK:88,HAN:76,PAS:60,PDEF:82,IDEF:86,BLK:92,REB:94,ATH:94,STR:90,CLU:86}],
  'Sam Cassell': ['萨姆-卡塞尔','PG',82,{threePT:74,MID:92,FIN:92,DNK:62,HAN:92,PAS:94,PDEF:80,IDEF:70,BLK:48,REB:62,ATH:80,STR:64,CLU:94}],
  'Mark Jackson': ['马克-杰克逊','PG',80,{threePT:60,MID:82,FIN:84,DNK:56,HAN:96,PAS:98,PDEF:74,IDEF:66,BLK:45,REB:72,ATH:72,STR:70,CLU:92}],
  'Glen Rice': ['格伦-莱斯','SF',84,{threePT:88,MID:94,FIN:92,DNK:74,HAN:82,PAS:64,PDEF:72,IDEF:70,BLK:55,REB:70,ATH:82,STR:66,CLU:92}],
  'Vlade Divac': ['弗拉德-迪瓦茨','C',78,{threePT:52,MID:78,FIN:86,DNK:62,HAN:80,PAS:78,PDEF:72,IDEF:82,BLK:86,REB:90,ATH:62,STR:90,CLU:88}],
  'Rod Strickland': ['罗德-斯特里克兰','PG',82,{threePT:52,MID:84,FIN:88,DNK:64,HAN:96,PAS:96,PDEF:82,IDEF:72,BLK:48,REB:60,ATH:86,STR:60,CLU:90}],
  'Kendall Gill': ['肯达尔-吉尔','SG',76,{threePT:62,MID:80,FIN:86,DNK:84,HAN:82,PAS:70,PDEF:88,IDEF:78,BLK:60,REB:62,ATH:94,STR:60,CLU:84}],
  // ===== 2003 时代 =====
  'Vince Carter': ['文斯-卡特','SG',86,{threePT:78,MID:88,FIN:96,DNK:99,HAN:94,PAS:82,PDEF:82,IDEF:74,BLK:68,REB:72,ATH:99,STR:72,CLU:94}],
  'Jason Richardson': ['杰森-理查德森','SG',83,{threePT:80,MID:84,FIN:92,DNK:98,HAN:86,PAS:72,PDEF:72,IDEF:66,BLK:55,REB:68,ATH:98,STR:64,CLU:86}],
  'Quentin Richardson': ['昆廷-理查德森','SG',76,{threePT:82,MID:82,FIN:86,DNK:90,HAN:80,PAS:62,PDEF:70,IDEF:64,BLK:52,REB:66,ATH:92,STR:64,CLU:84}],
  'Pau Gasol': ['保罗-加索尔','PF',87,{threePT:55,MID:88,FIN:94,DNK:82,HAN:88,PAS:82,PDEF:82,IDEF:88,BLK:92,REB:94,ATH:78,STR:88,CLU:92}],
  'Mike Bibby': ['迈克-毕比','PG',85,{threePT:86,MID:90,FIN:90,DNK:62,HAN:94,PAS:94,PDEF:76,IDEF:66,BLK:45,REB:58,ATH:82,STR:56,CLU:94}],
  'Peja Stojakovic': ['佩贾-斯托亚科维奇','SF',81,{threePT:95,MID:92,FIN:90,DNK:72,HAN:84,PAS:68,PDEF:70,IDEF:68,BLK:55,REB:70,ATH:78,STR:64,CLU:92}],
  'Shawn Marion': ['肖恩-马里昂','SF',82,{threePT:74,MID:82,FIN:90,DNK:92,HAN:78,PAS:66,PDEF:94,IDEF:88,BLK:88,REB:96,ATH:96,STR:82,CLU:90}],
  'Amare Stoudemire': ['阿玛雷-斯塔德迈尔','PF',85,{threePT:42,MID:80,FIN:94,DNK:96,HAN:76,PAS:58,PDEF:72,IDEF:76,BLK:90,REB:92,ATH:97,STR:94,CLU:88}],
  'Joe Johnson': ['乔-约翰逊','SG',83,{threePT:84,MID:90,FIN:92,DNK:80,HAN:88,PAS:80,PDEF:80,IDEF:74,BLK:58,REB:72,ATH:84,STR:68,CLU:92}],
  'Zach Randolph': ['扎克-兰多夫','PF',81,{threePT:55,MID:90,FIN:92,DNK:72,HAN:82,PAS:66,PDEF:60,IDEF:66,BLK:66,REB:94,ATH:66,STR:94,CLU:88}],
  'Zydrunas Ilgauskas': ['扎伊德鲁纳斯-伊尔戈斯卡斯','C',81,{threePT:50,MID:88,FIN:90,DNK:66,HAN:76,PAS:62,PDEF:74,IDEF:84,BLK:90,REB:92,ATH:60,STR:90,CLU:86}],
  'Carlos Boozer': ['卡洛斯-布泽尔','PF',80,{threePT:40,MID:88,FIN:92,DNK:78,HAN:78,PAS:64,PDEF:66,IDEF:72,BLK:70,REB:94,ATH:78,STR:94,CLU:88}],
  'Jalen Rose': ['杰伦-罗斯','SF',81,{threePT:74,MID:88,FIN:90,DNK:78,HAN:88,PAS:78,PDEF:70,IDEF:66,BLK:55,REB:64,ATH:86,STR:66,CLU:88}],
  'Donyell Marshall': ['唐耶尔-马歇尔','PF',83,{threePT:78,MID:86,FIN:88,DNK:76,HAN:78,PAS:60,PDEF:74,IDEF:80,BLK:84,REB:90,ATH:82,STR:88,CLU:86}],
  'Antawn Jamison': ['安托万-贾米森','PF',83,{threePT:66,MID:88,FIN:92,DNK:82,HAN:80,PAS:64,PDEF:66,IDEF:70,BLK:72,REB:90,ATH:84,STR:84,CLU:88}],
  'Gilbert Arenas': ['吉尔伯特-阿里纳斯','PG',84,{threePT:82,MID:92,FIN:94,DNK:80,HAN:92,PAS:86,PDEF:76,IDEF:66,BLK:48,REB:62,ATH:90,STR:66,CLU:96}],
  'Latrell Sprewell': ['拉特里尔-斯普雷维尔','SG',84,{threePT:72,MID:88,FIN:92,DNK:90,HAN:86,PAS:74,PDEF:90,IDEF:78,BLK:60,REB:68,ATH:95,STR:70,CLU:92}],
  'Steve Francis': ['史蒂夫-弗朗西斯','PG',82,{threePT:70,MID:84,FIN:90,DNK:84,HAN:96,PAS:94,PDEF:78,IDEF:66,BLK:52,REB:66,ATH:96,STR:60,CLU:90}],
  'Baron Davis': ['拜伦-戴维斯','PG',84,{threePT:74,MID:84,FIN:92,DNK:84,HAN:94,PAS:92,PDEF:88,IDEF:78,BLK:62,REB:72,ATH:94,STR:70,CLU:92}],
  'Michael Finley': ['迈克尔-芬利','SG',82,{threePT:80,MID:90,FIN:90,DNK:84,HAN:86,PAS:74,PDEF:82,IDEF:74,BLK:55,REB:68,ATH:90,STR:66,CLU:90}],
  'Rashard Lewis': ['拉沙德-刘易斯','SF',80,{threePT:88,MID:88,FIN:88,DNK:78,HAN:80,PAS:64,PDEF:70,IDEF:72,BLK:72,REB:78,ATH:82,STR:70,CLU:86}],
  'Elton Brand': ['埃尔顿-布兰德','PF',82,{threePT:38,MID:82,FIN:92,DNK:84,HAN:80,PAS:66,PDEF:88,IDEF:90,BLK:92,REB:96,ATH:82,STR:94,CLU:88}],
  'Andre Miller': ['安德烈-米勒','PG',80,{threePT:55,MID:82,FIN:88,DNK:66,HAN:94,PAS:96,PDEF:82,IDEF:70,BLK:50,REB:68,ATH:82,STR:66,CLU:88}],
  'Eddie Jones': ['埃迪-琼斯','SG',82,{threePT:80,MID:86,FIN:88,DNK:80,HAN:84,PAS:72,PDEF:92,IDEF:84,BLK:66,REB:66,ATH:90,STR:62,CLU:88}],
  'Lamar Odom': ['拉马尔-奥多姆','SF',80,{threePT:62,MID:80,FIN:88,DNK:82,HAN:88,PAS:84,PDEF:78,IDEF:78,BLK:76,REB:84,ATH:86,STR:80,CLU:86}],
  'Jamal Mashburn': ['贾马尔-马什本','SF',83,{threePT:78,MID:90,FIN:92,DNK:74,HAN:84,PAS:72,PDEF:74,IDEF:70,BLK:55,REB:72,ATH:82,STR:72,CLU:90}],
  'Brad Miller': ['布拉德-米勒','C',78,{threePT:62,MID:86,FIN:88,DNK:62,HAN:78,PAS:76,PDEF:72,IDEF:80,BLK:78,REB:88,ATH:58,STR:88,CLU:88}],
  // ★ 全名单补全（确定性生成，覆盖 1984/1996/2003 全名单）
  'A.C. Green': ['A.C.-格林','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Aaron McKie': ['阿隆-麦基','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Aaron Williams': ['阿隆-威廉姆斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Adonal Foyle': ['阿多纳尔-福伊尔','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Adrian Caldwell': ['阿德里安-考德威尔','PF',70,{threePT:45,MID:64,FIN:78,DNK:72,HAN:60,PAS:52,PDEF:70,IDEF:74,BLK:72,REB:78,ATH:70,STR:80,CLU:64}],
  'Al Harrington': ['阿尔-哈林顿','PF',79,{threePT:51,MID:70,FIN:84,DNK:78,HAN:66,PAS:58,PDEF:76,IDEF:80,BLK:78,REB:84,ATH:76,STR:86,CLU:70}],
  'Al Wood': ['阿尔-伍德','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Alan Henderson': ['阿兰-亨德森','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Albert King': ['阿尔伯特-金','SF',78,{threePT:71,MID:77,FIN:83,DNK:81,HAN:77,PAS:71,PDEF:75,IDEF:71,BLK:57,REB:67,ATH:83,STR:69,CLU:75}],
  'Alex Garcia': ['亚历克斯-加西亚','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Allan Houston': ['阿兰-休斯顿','SG',81,{threePT:83,MID:83,FIN:83,DNK:69,HAN:83,PAS:75,PDEF:73,IDEF:59,BLK:41,REB:49,ATH:81,STR:55,CLU:83}],
  'Allen Leavell': ['艾伦-利维尔','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Alonzo Mourning': ['阿朗佐-莫宁','C',88,{threePT:44,MID:74,FIN:92,DNK:86,HAN:62,PAS:60,PDEF:82,IDEF:90,BLK:92,REB:96,ATH:74,STR:96,CLU:74}],
  'Alton Lister': ['阿尔顿-利斯特','C',76,{threePT:36,MID:66,FIN:84,DNK:78,HAN:54,PAS:52,PDEF:74,IDEF:82,BLK:82,REB:86,ATH:66,STR:88,CLU:66}],
  'Alvan Adams': ['阿尔万-亚当斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Alvin Williams': ['阿尔文-威廉姆斯','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Andrei Kirilenko': ['安德烈-基里连科','SF',82,{threePT:74,MID:80,FIN:86,DNK:84,HAN:80,PAS:74,PDEF:78,IDEF:74,BLK:60,REB:70,ATH:86,STR:72,CLU:78}],
  'Andrew Lang': ['安德鲁-朗','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Anfernee Hardaway': ['安芬尼-哈达威','SG',87,{threePT:87,MID:87,FIN:87,DNK:73,HAN:87,PAS:79,PDEF:77,IDEF:63,BLK:45,REB:53,ATH:85,STR:59,CLU:87}],
  'Ansu Sesay': ['安苏-塞塞','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Anthony Avent': ['安东尼-阿文特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Anthony Goldwire': ['安东尼-戈德怀尔','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Anthony Johnson': ['安东尼-约翰逊','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Anthony Mason': ['安东尼-梅森','PF',76,{threePT:40,MID:76,FIN:88,DNK:78,HAN:82,PAS:72,PDEF:90,IDEF:90,BLK:80,REB:92,ATH:80,STR:96,CLU:88}],
  'Anthony Peeler': ['安东尼-皮勒','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Antoine Carr': ['安托万-卡尔','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Antonio Daniels': ['安东尼奥-丹尼尔斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Antonio Davis': ['安东尼奥-戴维斯','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Armon Gilliam': ['阿蒙-吉列姆','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Arvydas Sabonis': ['阿维达斯-萨博尼斯','C',84,{threePT:41,MID:71,FIN:89,DNK:83,HAN:59,PAS:57,PDEF:79,IDEF:87,BLK:87,REB:91,ATH:71,STR:93,CLU:71}],
  'Austin Croshere': ['奥斯汀-克罗希尔','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Avery Johnson': ['埃弗里-约翰逊','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'B.J. Armstrong': ['B.J.-阿姆斯特朗','PG',76,{threePT:84,MID:86,FIN:84,DNK:55,HAN:88,PAS:84,PDEF:76,IDEF:62,BLK:42,REB:52,ATH:82,STR:52,CLU:86}],
  'Ben Poquette': ['本-波凯特','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Bill Cartwright': ['比尔-卡特莱特','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Bill Garnett': ['比尔-加内特','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Bill Hanzlik': ['比尔-汉兹利克','SG',76,{threePT:80,MID:80,FIN:80,DNK:66,HAN:80,PAS:72,PDEF:70,IDEF:56,BLK:38,REB:46,ATH:78,STR:52,CLU:80}],
  'Bill Wennington': ['比尔-温宁顿','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Billy Owens': ['比利-欧文斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Bimbo Coles': ['宾博-科尔斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Blue Edwards': ['布鲁-爱德华兹','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Bo Outlaw': ['博-奥特洛','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Bob Hansen': ['鲍勃-汉森','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Bob McAdoo': ['鲍勃-麦卡杜','PF',78,{threePT:50,MID:69,FIN:83,DNK:77,HAN:65,PAS:57,PDEF:75,IDEF:79,BLK:77,REB:83,ATH:75,STR:85,CLU:69}],
  'Bob Sura': ['鲍勃-苏拉','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Bobby Hurley': ['鲍比-赫尔利','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Bobby Jackson': ['博比-杰克逊','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Bobby Jones': ['博比-琼斯','PF',80,{threePT:52,MID:71,FIN:85,DNK:79,HAN:67,PAS:59,PDEF:77,IDEF:81,BLK:79,REB:85,ATH:77,STR:87,CLU:71}],
  'Bobby Phills': ['博比-菲尔斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Bobby Simmons': ['博比-西蒙斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Bostjan Nachbar': ['波斯蒂安-纳赫巴尔','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Brad Davis': ['布拉德-戴维斯','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Brandon Hunter': ['布兰登-亨特','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Brendan Haywood': ['布伦丹-海伍德','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Brent Barry': ['布伦特-巴里','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Brett Szabo': ['布雷特-萨博','C',70,{threePT:32,MID:62,FIN:80,DNK:74,HAN:50,PAS:48,PDEF:70,IDEF:78,BLK:78,REB:82,ATH:62,STR:84,CLU:62}],
  'Brevin Knight': ['布雷文-奈特','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Brian Grant': ['布赖恩-格兰特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Brian Shaw': ['布莱恩-肖','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Brian Skinner': ['布赖恩-斯金纳','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Brooks Thompson': ['布鲁克斯-汤普森','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Bruce Bowen': ['布鲁斯-鲍文','SF',74,{threePT:86,MID:70,FIN:70,DNK:46,HAN:66,PAS:56,PDEF:99,IDEF:97,BLK:64,REB:62,ATH:66,STR:62,CLU:90}],
  'Bryant Reeves': ['布莱恩特-里夫斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Bryon Russell': ['布莱恩-拉塞尔','SF',76,{threePT:70,MID:76,FIN:82,DNK:80,HAN:76,PAS:70,PDEF:74,IDEF:70,BLK:56,REB:66,ATH:82,STR:68,CLU:74}],
  'Calvin Natt': ['卡尔文-奈特','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Carl Henry': ['卡尔-亨利','SF',70,{threePT:66,MID:72,FIN:78,DNK:76,HAN:72,PAS:66,PDEF:70,IDEF:66,BLK:52,REB:62,ATH:78,STR:64,CLU:70}],
  'Carl Herrera': ['卡尔-埃雷拉','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Carl Thomas': ['卡尔-托马斯','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Carlos Arroyo': ['卡洛斯-阿罗约','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Carlos Clark': ['卡洛斯-克拉克','SG',70,{threePT:76,MID:76,FIN:76,DNK:62,HAN:76,PAS:68,PDEF:66,IDEF:52,BLK:34,REB:42,ATH:74,STR:48,CLU:76}],
  'Carlos Rogers': ['卡洛斯-罗杰斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Caron Butler': ['卡隆-巴特勒','SF',83,{threePT:75,MID:81,FIN:87,DNK:85,HAN:81,PAS:75,PDEF:79,IDEF:75,BLK:61,REB:71,ATH:87,STR:73,CLU:79}],
  'Casey Jacobsen': ['凯西-雅各布森','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Cedric Maxwell': ['塞德里克-马克斯韦尔','SF',80,{threePT:40,MID:78,FIN:90,DNK:80,HAN:80,PAS:66,PDEF:84,IDEF:88,BLK:78,REB:88,ATH:78,STR:90,CLU:88}],
  'Charles Jones': ['查尔斯-琼斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Charles Oakley': ['查尔斯-奥克利','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Charles Smith': ['查尔斯-史密斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Charlie Ward': ['查理-沃德','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Cherokee Parks': ['切罗基-帕克斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Chris Andersen': ['克里斯-安德森','PF',74,{threePT:40,MID:56,FIN:74,DNK:90,HAN:48,PAS:44,PDEF:82,IDEF:88,BLK:94,REB:86,ATH:90,STR:70,CLU:76}],
  'Chris Anstey': ['克里斯-安斯蒂','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Chris Bosh': ['克里斯-波什','PF',85,{threePT:55,MID:74,FIN:88,DNK:82,HAN:70,PAS:62,PDEF:80,IDEF:84,BLK:82,REB:88,ATH:80,STR:90,CLU:74}],
  'Chris Carr': ['克里斯-卡尔','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Chris Childs': ['克里斯-柴尔兹','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Chris Crawford': ['克里斯-克劳福德','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Chris Gatling': ['克里斯-加特林','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Chris Mills': ['克里斯-米尔斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Chris Mullin': ['克里斯-穆林','SF',83,{threePT:92,MID:94,FIN:90,DNK:64,HAN:90,PAS:84,PDEF:76,IDEF:70,BLK:50,REB:66,ATH:74,STR:64,CLU:92}],
  'Chris Whitney': ['克里斯-惠特尼','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Chris Wilcox': ['克里斯-威尔科克斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Chuck Person': ['查克-珀森','SF',83,{threePT:75,MID:81,FIN:87,DNK:85,HAN:81,PAS:75,PDEF:79,IDEF:75,BLK:61,REB:71,ATH:87,STR:73,CLU:79}],
  'Clarence Weatherspoon': ['克拉伦斯-韦瑟斯庞','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Clark Kellogg': ['克拉克-凯洛格','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Clemon Johnson': ['克莱蒙-约翰逊','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Cliff Levingston': ['克利夫-莱文斯顿','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Cliff Robinson': ['克利夫-罗宾逊','PF',80,{threePT:68,MID:86,FIN:90,DNK:82,HAN:82,PAS:66,PDEF:80,IDEF:86,BLK:88,REB:90,ATH:84,STR:88,CLU:86}],
  'Clifford Robinson': ['克利福德-罗宾逊','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Clint Richardson': ['克林特-理查森','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Corey Maggette': ['科里-马盖蒂','SF',81,{threePT:73,MID:79,FIN:85,DNK:83,HAN:79,PAS:73,PDEF:77,IDEF:73,BLK:59,REB:69,ATH:85,STR:71,CLU:77}],
  'Corie Blount': ['科里-布朗特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Corliss Williamson': ['科利斯-威廉森','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Cory Alexander': ['科里-亚历山大','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Craig Ehlo': ['克雷格-埃洛','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Craig Hodges': ['克雷格-霍奇斯','PG',74,{threePT:95,MID:82,FIN:74,DNK:44,HAN:80,PAS:72,PDEF:62,IDEF:48,BLK:30,REB:40,ATH:64,STR:40,CLU:84}],
  'Cuttino Mobley': ['卡蒂诺-莫布里','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Dahntay Jones': ['丹泰-琼斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Dajuan Wagner': ['德胡安-瓦格纳','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Dale Davis': ['戴尔-戴维斯','PF',81,{threePT:52,MID:71,FIN:85,DNK:79,HAN:67,PAS:59,PDEF:77,IDEF:81,BLK:79,REB:85,ATH:77,STR:87,CLU:71}],
  'Dale Ellis': ['戴尔-埃利斯','SF',80,{threePT:90,MID:94,FIN:92,DNK:76,HAN:84,PAS:64,PDEF:70,IDEF:68,BLK:52,REB:70,ATH:88,STR:64,CLU:90}],
  'Damon Jones': ['达蒙-琼斯','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Dan Gadzuric': ['丹-加祖里奇','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Dan Majerle': ['丹-马尔利','SG',81,{threePT:90,MID:84,FIN:82,DNK:66,HAN:78,PAS:74,PDEF:80,IDEF:72,BLK:48,REB:66,ATH:76,STR:64,CLU:88}],
  'Dan Roundfield': ['丹-朗德菲尔德','PF',78,{threePT:50,MID:69,FIN:83,DNK:77,HAN:65,PAS:57,PDEF:75,IDEF:79,BLK:77,REB:83,ATH:75,STR:85,CLU:69}],
  'Dana Barros': ['达纳-巴罗斯','PG',74,{threePT:90,MID:88,FIN:84,DNK:56,HAN:84,PAS:84,PDEF:68,IDEF:52,BLK:32,REB:46,ATH:76,STR:46,CLU:86}],
  'Danny Ainge': ['丹尼-安吉','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Danny Ferry': ['丹尼-费里','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Danny Fortson': ['丹尼-福森','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Danny Manning': ['丹尼-曼宁','PF',86,{threePT:56,MID:75,FIN:89,DNK:83,HAN:71,PAS:63,PDEF:81,IDEF:85,BLK:83,REB:89,ATH:81,STR:91,CLU:75}],
  'Danny Schayes': ['丹尼-沙耶斯','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Danny Vranes': ['丹尼-弗雷恩斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Darius Miles': ['达柳斯-迈尔斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Darius Songaila': ['达柳斯-桑盖拉','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Darnell Valentine': ['达内尔-瓦伦丁','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Darrell Armstrong': ['达雷尔-阿姆斯特朗','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Darrell Walker': ['达雷尔-沃克','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Darren Daye': ['达伦-达耶','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Darrick Martin': ['达里克-马丁','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Darwin Cook': ['达尔文-库克','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Dave Greenwood': ['戴夫-格林伍德','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'David Benoit': ['大卫-贝努瓦','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'David Thirdkill': ['大卫-瑟德基尔','SF',70,{threePT:66,MID:72,FIN:78,DNK:76,HAN:72,PAS:66,PDEF:70,IDEF:66,BLK:52,REB:62,ATH:78,STR:64,CLU:70}],
  'David Wesley': ['大卫-韦斯利','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'David West': ['大卫-韦斯特','PF',81,{threePT:52,MID:71,FIN:85,DNK:79,HAN:67,PAS:59,PDEF:77,IDEF:81,BLK:79,REB:85,ATH:77,STR:87,CLU:71}],
  'David Wingate': ['大卫-温盖特','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'DeSagana Diop': ['德萨加纳-迪奥普','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Dee Brown': ['迪-布朗','PG',74,{threePT:80,MID:80,FIN:84,DNK:78,HAN:86,PAS:78,PDEF:78,IDEF:64,BLK:46,REB:54,ATH:95,STR:52,CLU:84}],
  'Dell Curry': ['戴尔-库里','SG',76,{threePT:92,MID:88,FIN:86,DNK:66,HAN:84,PAS:64,PDEF:70,IDEF:62,BLK:48,REB:56,ATH:82,STR:54,CLU:88}],
  'Dennis Scott': ['丹尼斯-斯科特','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Derek Anderson': ['德里克-安德森','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Derek Harper': ['德里克-哈珀','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Derek Smith': ['德里克-史密斯','SF',76,{threePT:70,MID:76,FIN:82,DNK:80,HAN:76,PAS:70,PDEF:74,IDEF:70,BLK:56,REB:66,ATH:82,STR:68,CLU:74}],
  'Derek Strong': ['德里克-斯特朗','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Derrick Coleman': ['德里克-科尔曼','PF',85,{threePT:55,MID:74,FIN:88,DNK:82,HAN:70,PAS:62,PDEF:80,IDEF:84,BLK:82,REB:88,ATH:80,STR:90,CLU:74}],
  'Derrick McKey': ['德里克-麦凯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Desmond Mason': ['德斯蒙德-梅森','SF',74,{threePT:60,MID:74,FIN:88,DNK:95,HAN:70,PAS:56,PDEF:76,IDEF:70,BLK:60,REB:66,ATH:94,STR:66,CLU:80}],
  'Detlef Schrempf': ['德特勒夫-施伦普夫','PF',83,{threePT:54,MID:73,FIN:87,DNK:81,HAN:69,PAS:61,PDEF:79,IDEF:83,BLK:81,REB:87,ATH:79,STR:89,CLU:73}],
  'Devean George': ['德文-乔治','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Devin Brown': ['德文-布朗','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Devin Durrant': ['德文-杜兰特','SF',70,{threePT:66,MID:72,FIN:78,DNK:76,HAN:72,PAS:66,PDEF:70,IDEF:66,BLK:52,REB:62,ATH:78,STR:64,CLU:70}],
  'Dino Radja': ['迪诺-拉德加','PF',76,{threePT:42,MID:82,FIN:90,DNK:76,HAN:76,PAS:62,PDEF:74,IDEF:82,BLK:82,REB:90,ATH:76,STR:92,CLU:84}],
  'Dion Glover': ['迪昂-格洛弗','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Dirk Minniefield': ['德克-明尼菲尔德','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Don MacLean': ['唐-麦克莱恩','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Don Reid': ['唐-里德','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Donnie Boyce': ['唐尼-博伊斯','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Doug Christie': ['道格-克里斯蒂','SG',74,{threePT:82,MID:86,FIN:86,DNK:70,HAN:86,PAS:84,PDEF:94,IDEF:92,BLK:70,REB:70,ATH:82,STR:66,CLU:90}],
  'Doug Overton': ['道格-奥弗顿','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Doug West': ['道格-韦斯特','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Drew Gooden': ['德鲁-古登','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Duane Ferrell': ['杜安-费雷尔','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Dudley Bradley': ['达德利-布拉德利','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Dwayne Schintzius': ['德韦恩-申茨乌斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Earl Boykins': ['厄尔-博伊金斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Earl Cureton': ['厄尔-库雷顿','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Earl Watson': ['厄尔-沃特森','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Ed Gray': ['埃德-格雷','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Ed Nealy': ['埃德-尼利','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Ed O\'Bannon': ['埃德-奥班农','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Eddie Johnson': ['埃迪-约翰逊','SG',80,{threePT:84,MID:94,FIN:92,DNK:74,HAN:84,PAS:66,PDEF:66,IDEF:62,BLK:48,REB:60,ATH:86,STR:60,CLU:90}],
  'Eddie Robinson': ['埃迪-罗宾逊','SF',74,{threePT:55,MID:78,FIN:86,DNK:92,HAN:76,PAS:56,PDEF:78,IDEF:74,BLK:70,REB:68,ATH:94,STR:64,CLU:80}],
  'Eddy Curry': ['埃迪-库里','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Elden Campbell': ['埃尔登-坎贝尔','C',79,{threePT:38,MID:68,FIN:86,DNK:80,HAN:56,PAS:54,PDEF:76,IDEF:84,BLK:84,REB:88,ATH:68,STR:90,CLU:68}],
  'Eldridge Recasner': ['埃尔德里奇-里卡斯纳','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Elliot Perry': ['埃利奥特-佩里','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Elston Turner': ['埃尔顿-特纳','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Emanual Davis': ['伊曼纽尔-戴维斯','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Ennis Whatley': ['恩尼斯-惠特利','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Eric Montross': ['埃里克-蒙特罗斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Eric Piatkowski': ['埃里克-皮亚特考斯基','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Eric Snow': ['埃里克-斯诺','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Eric Williams': ['埃里克-威廉姆斯','SF',74,{threePT:72,MID:80,FIN:82,DNK:74,HAN:76,PAS:60,PDEF:80,IDEF:76,BLK:60,REB:66,ATH:82,STR:70,CLU:80}],
  'Erick Dampier': ['埃里克-丹皮尔','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Erick Strickland': ['埃里克-斯特里克兰','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Ernest Johnson': ['欧内斯特-约翰逊','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Ernie Grunfeld': ['厄尼-格伦菲尔德','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Ervin Johnson': ['埃尔文-约翰逊','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Etan Thomas': ['伊坦-托马斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Evan Eschmeyer': ['埃文-埃施迈尔','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Felton Spencer': ['费尔顿-斯宾塞','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Francisco Elson': ['弗朗西斯科-埃尔森','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Frank Brickowski': ['弗兰克-布里科夫斯基','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Frank Johnson': ['弗兰克-约翰逊','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Fred Hoiberg': ['弗雷德-霍伊博格','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Fred Jones': ['弗雷德-琼斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Gary Trent': ['加里-特伦特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Gene Banks': ['吉恩-班克斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'George Johnson': ['乔治-约翰逊','C',70,{threePT:32,MID:62,FIN:80,DNK:74,HAN:50,PAS:48,PDEF:70,IDEF:78,BLK:78,REB:82,ATH:62,STR:84,CLU:62}],
  'George Lynch': ['乔治-林奇','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'George McCloud': ['乔治-麦克劳德','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'George Zidek': ['乔治-齐德克','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Gerald Wallace': ['杰拉德-华莱士','SF',79,{threePT:70,MID:74,FIN:86,DNK:94,HAN:64,PAS:62,PDEF:88,IDEF:86,BLK:82,REB:80,ATH:95,STR:72,CLU:82}],
  'Gerald Wilkins': ['杰拉德-威尔金斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Gheorghe Muresan': ['乔治-穆雷桑','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Gordan Giricek': ['戈登-吉里切克','SG',76,{threePT:80,MID:80,FIN:80,DNK:66,HAN:80,PAS:72,PDEF:70,IDEF:56,BLK:38,REB:46,ATH:78,STR:52,CLU:80}],
  'Grant Hill': ['格兰特-希尔','SF',87,{threePT:77,MID:83,FIN:89,DNK:87,HAN:83,PAS:77,PDEF:81,IDEF:77,BLK:63,REB:73,ATH:89,STR:75,CLU:81}],
  'Greg Ballard': ['格雷格-巴拉德','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Greg Foster': ['格雷格-福斯特','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Greg Minor': ['格雷格-迈纳','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Greg Ostertag': ['格雷格-奥斯特塔格','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Gus Williams': ['格斯-威廉姆斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Hank McDowell': ['汉克-麦克道尔','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Harvey Grant': ['哈维-格兰特','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Hedo Turkoglu': ['希度-特科格鲁','SF',81,{threePT:73,MID:79,FIN:85,DNK:83,HAN:79,PAS:73,PDEF:77,IDEF:73,BLK:59,REB:69,ATH:85,STR:71,CLU:77}],
  'Herb Williams': ['赫布-威廉姆斯','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Hersey Hawkins': ['赫西-霍金斯','SG',83,{threePT:85,MID:85,FIN:85,DNK:71,HAN:85,PAS:77,PDEF:75,IDEF:61,BLK:43,REB:51,ATH:83,STR:57,CLU:85}],
  'Horace Grant': ['霍勒斯-格兰特','PF',83,{threePT:54,MID:73,FIN:87,DNK:81,HAN:69,PAS:61,PDEF:79,IDEF:83,BLK:81,REB:87,ATH:79,STR:89,CLU:73}],
  'Hot Rod Williams': ['霍特-罗德-威廉姆斯','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Howard Eisley': ['霍华德-埃斯利','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Ira Newble': ['伊拉-纽布尔','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Isaac Austin': ['艾萨克-奥斯汀','C',76,{threePT:36,MID:66,FIN:84,DNK:78,HAN:54,PAS:52,PDEF:74,IDEF:82,BLK:82,REB:86,ATH:66,STR:88,CLU:66}],
  'Isaiah Rider': ['伊塞亚-莱德','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'J.R. Reid': ['J.R.-里德','PF',76,{threePT:40,MID:80,FIN:88,DNK:80,HAN:76,PAS:58,PDEF:78,IDEF:84,BLK:80,REB:90,ATH:82,STR:92,CLU:82}],
  'Jahidi White': ['贾希迪-怀特','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Jake Voskuhl': ['杰克-沃斯库尔','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Jamaal Magloire': ['贾马尔-马格洛伊尔','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Jamal Crawford': ['贾马尔-克劳福德','SG',83,{threePT:85,MID:85,FIN:85,DNK:71,HAN:85,PAS:77,PDEF:75,IDEF:61,BLK:43,REB:51,ATH:83,STR:57,CLU:85}],
  'James Bailey': ['詹姆斯-贝利','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'James Donaldson': ['詹姆斯-唐纳森','C',76,{threePT:36,MID:66,FIN:84,DNK:78,HAN:54,PAS:52,PDEF:74,IDEF:82,BLK:82,REB:86,ATH:66,STR:88,CLU:66}],
  'James Edwards': ['詹姆斯-爱德华兹','C',78,{threePT:37,MID:67,FIN:85,DNK:79,HAN:55,PAS:53,PDEF:75,IDEF:83,BLK:83,REB:87,ATH:67,STR:89,CLU:67}],
  'James Posey': ['詹姆斯-波西','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'James Robinson': ['詹姆斯-罗宾逊','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Jarron Collins': ['杰伦-科林斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Jarvis Hayes': ['贾维斯-海耶斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Jason Caffey': ['杰森-卡菲','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Jason Collins': ['杰森-科林斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Jason Kapono': ['杰森-卡波诺','SF',72,{threePT:92,MID:90,FIN:82,DNK:50,HAN:78,PAS:62,PDEF:60,IDEF:50,BLK:30,REB:42,ATH:58,STR:44,CLU:84}],
  'Jason Williams': ['贾森-威廉姆斯','PG',83,{threePT:79,MID:83,FIN:83,DNK:59,HAN:91,PAS:93,PDEF:77,IDEF:63,BLK:41,REB:54,ATH:83,STR:54,CLU:85}],
  'Jawann Oldham': ['贾万-奥尔德姆','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Jay Humphries': ['杰伊-汉弗莱斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Jay Vincent': ['杰伊-文森特','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Jayson Williams': ['杰森-威廉姆斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Jeff Cook': ['杰夫-库克','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Jeff Foster': ['杰夫-福斯特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Jeff McInnis': ['杰夫-麦金尼斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Jeff Nordgaard': ['杰夫-诺德加德','SF',70,{threePT:66,MID:72,FIN:78,DNK:76,HAN:72,PAS:66,PDEF:70,IDEF:66,BLK:52,REB:62,ATH:78,STR:64,CLU:70}],
  'Jeff Turner': ['杰夫-特纳','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Jeff Wilkins': ['杰夫-威尔金斯','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Jerald Honeycutt': ['杰拉德-霍尼卡特','SF',70,{threePT:66,MID:72,FIN:78,DNK:76,HAN:72,PAS:66,PDEF:70,IDEF:66,BLK:52,REB:62,ATH:78,STR:64,CLU:70}],
  'Jerome James': ['杰罗姆-詹姆斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Jerome Kersey': ['杰罗姆-科西','SF',76,{threePT:70,MID:76,FIN:82,DNK:80,HAN:76,PAS:70,PDEF:74,IDEF:70,BLK:56,REB:66,ATH:82,STR:68,CLU:74}],
  'Jerome Williams': ['杰罗姆-威廉姆斯','PF',74,{threePT:35,MID:70,FIN:84,DNK:80,HAN:70,PAS:52,PDEF:86,IDEF:86,BLK:78,REB:94,ATH:84,STR:92,CLU:80}],
  'Jerry Sichting': ['杰里-西奇廷','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Jerry Stackhouse': ['杰里-斯塔克豪斯','SG',85,{threePT:86,MID:86,FIN:86,DNK:72,HAN:86,PAS:78,PDEF:76,IDEF:62,BLK:44,REB:52,ATH:84,STR:58,CLU:86}],
  'Jim Jackson': ['吉姆-杰克逊','SG',83,{threePT:85,MID:85,FIN:85,DNK:71,HAN:85,PAS:77,PDEF:75,IDEF:61,BLK:43,REB:51,ATH:83,STR:57,CLU:85}],
  'Jim McIlvaine': ['吉姆-麦克伊尔文','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Jim Paxson': ['吉姆-帕克森','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Jim Petersen': ['吉姆-彼得森','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Jim Thomas': ['吉姆-托马斯','SG',70,{threePT:76,MID:76,FIN:76,DNK:62,HAN:76,PAS:68,PDEF:66,IDEF:52,BLK:34,REB:42,ATH:74,STR:48,CLU:76}],
  'Jiri Welsch': ['吉里-韦尔什','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Joe Barry Carroll': ['乔-巴里-卡罗尔','C',78,{threePT:37,MID:67,FIN:85,DNK:79,HAN:55,PAS:53,PDEF:75,IDEF:83,BLK:83,REB:87,ATH:67,STR:89,CLU:67}],
  'Joe Dumars': ['乔-杜马斯','SG',84,{threePT:85,MID:85,FIN:85,DNK:71,HAN:85,PAS:77,PDEF:75,IDEF:61,BLK:43,REB:51,ATH:83,STR:57,CLU:85}],
  'Joe Meriweather': ['乔-梅里韦瑟','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Joe Wolf': ['乔-沃尔夫','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'John Bagley': ['约翰-巴格利','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'John Greig': ['约翰-格雷格','SF',70,{threePT:66,MID:72,FIN:78,DNK:76,HAN:72,PAS:66,PDEF:70,IDEF:66,BLK:52,REB:62,ATH:78,STR:64,CLU:70}],
  'John Long': ['约翰-朗','SG',76,{threePT:80,MID:80,FIN:80,DNK:66,HAN:80,PAS:72,PDEF:70,IDEF:56,BLK:38,REB:46,ATH:78,STR:52,CLU:80}],
  'John Lucas': ['约翰-卢卡斯','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'John Salmons': ['约翰-萨尔蒙斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'John Starks': ['约翰-斯塔克斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'John Wallace': ['约翰-华莱士','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Johnny Davis': ['约翰尼-戴维斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Johnny Dawkins': ['约翰尼-道金斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Johnny Moore': ['约翰尼-摩尔','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Johnny Newman': ['约翰尼-纽曼','SF',76,{threePT:70,MID:76,FIN:82,DNK:80,HAN:76,PAS:70,PDEF:74,IDEF:70,BLK:56,REB:66,ATH:82,STR:68,CLU:74}],
  'Jonathan Bender': ['乔纳森-本德','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Josh Howard': ['约什-霍华德','SF',79,{threePT:72,MID:78,FIN:84,DNK:82,HAN:78,PAS:72,PDEF:76,IDEF:72,BLK:58,REB:68,ATH:84,STR:70,CLU:76}],
  'Juan Dixon': ['胡安-迪克森','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Jud Buechler': ['贾德-布奇勒','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Junior Bridgeman': ['朱尼尔-布里奇曼','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Kareem Rush': ['卡里姆-拉什','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Kedrick Brown': ['凯德里克-布朗','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Keith Askins': ['基思-阿斯金斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Keith Bogans': ['基思-博甘斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Kelly Tripucka': ['凯利-特里普卡','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Kelvin Cato': ['凯尔文-卡托','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Kelvin Ransey': ['凯尔文-兰西','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Ken Bannister': ['肯-班尼斯特','PF',70,{threePT:45,MID:64,FIN:78,DNK:72,HAN:60,PAS:52,PDEF:70,IDEF:74,BLK:72,REB:78,ATH:70,STR:80,CLU:64}],
  'Kenny Anderson': ['肯尼-安德森','PG',78,{threePT:66,MID:86,FIN:88,DNK:66,HAN:94,PAS:94,PDEF:82,IDEF:68,BLK:46,REB:56,ATH:86,STR:56,CLU:88}],
  'Kenny Carr': ['肯尼-卡尔','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Kenny Fields': ['肯尼-菲尔兹','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Kenny Thomas': ['肯尼-托马斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Kenyon Martin': ['肯扬-马丁','PF',85,{threePT:55,MID:74,FIN:88,DNK:82,HAN:70,PAS:62,PDEF:80,IDEF:84,BLK:82,REB:88,ATH:80,STR:90,CLU:74}],
  'Kevin Duckworth': ['凯文-达克沃思','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Kevin Edwards': ['凯文-爱德华兹','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Kevin Gamble': ['凯文-甘布尔','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Kevin Grevey': ['凯文-格雷维','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Kevin Johnson': ['凯文-约翰逊','PG',83,{threePT:79,MID:83,FIN:83,DNK:59,HAN:91,PAS:93,PDEF:77,IDEF:63,BLK:41,REB:54,ATH:83,STR:54,CLU:85}],
  'Kevin Ollie': ['凯文-奥利','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Kevin Williams': ['凯文-威廉姆斯','SG',70,{threePT:76,MID:76,FIN:76,DNK:62,HAN:76,PAS:68,PDEF:66,IDEF:52,BLK:34,REB:42,ATH:74,STR:48,CLU:76}],
  'Kevin Willis': ['凯文-威利斯','PF',78,{threePT:40,MID:82,FIN:92,DNK:86,HAN:78,PAS:58,PDEF:78,IDEF:84,BLK:84,REB:98,ATH:84,STR:96,CLU:86}],
  'Keyon Dooling': ['基翁-杜林','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Kurt Nimphius': ['库尔特-尼姆菲斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Kurt Rambis': ['库尔特-兰比斯','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Kurt Thomas': ['库尔特-托马斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Kwame Brown': ['夸梅-布朗','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Kyle Macy': ['凯尔-梅西','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'LaPhonso Ellis': ['拉方索-埃利斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'LaSalle Thompson': ['拉萨尔-汤普森','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Lancaster Gordon': ['兰开斯特-戈登','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Larry Drew': ['拉里-德鲁','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Larry Hughes': ['拉里-休斯','SG',83,{threePT:85,MID:85,FIN:85,DNK:71,HAN:85,PAS:77,PDEF:75,IDEF:61,BLK:43,REB:51,ATH:83,STR:57,CLU:85}],
  'Larry Johnson': ['拉里-约翰逊','PF',87,{threePT:56,MID:75,FIN:89,DNK:83,HAN:71,PAS:63,PDEF:81,IDEF:85,BLK:83,REB:89,ATH:81,STR:91,CLU:75}],
  'Larry Smith': ['拉里-史密斯','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Larry Spriggs': ['拉里-斯普里格斯','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Lawrence Moten': ['劳伦斯-莫滕','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Leandro Barbosa': ['莱昂德罗-巴博萨','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Ledell Eackles': ['莱德尔-伊克尔斯','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Lee Mayberry': ['李-梅伯里','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Lee Nailon': ['李-奈伦','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Len Elmore': ['伦-埃尔莫尔','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Leon Wood': ['莱昂-伍德','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Lester Conner': ['莱斯特-康纳','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Lewis Lloyd': ['刘易斯-劳埃德','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Lindsey Hunter': ['林赛-亨特','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Lionel Simmons': ['莱昂内尔-西蒙斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Lonnie Shelton': ['朗尼-谢尔顿','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Loren Woods': ['洛伦-伍兹','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Lorenzen Wright': ['洛伦岑-赖特','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Lorenzo Williams': ['洛伦佐-威廉姆斯','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Louis Orr': ['路易斯-奥尔','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Loy Vaught': ['洛伊-沃特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Luc Longley': ['卢克-朗利','C',76,{threePT:32,MID:72,FIN:82,DNK:66,HAN:68,PAS:58,PDEF:72,IDEF:84,BLK:88,REB:88,ATH:56,STR:90,CLU:78}],
  'Lucious Harris': ['卢修斯-哈里斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Luke Ridnour': ['卢克-里德诺','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Luke Walton': ['卢克-沃顿','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'M.L. Carr': ['M.L.-卡尔','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Mahmoud Abdul-Rauf': ['穆罕默德-阿布杜尔-拉乌夫','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Malik Allen': ['马利克-艾伦','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Malik Rose': ['马利克-罗斯','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Malik Sealy': ['马利克-西利','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Marc Iavaroni': ['马克-伊瓦罗尼','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Marc Jackson': ['马科-杰克逊','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Marcus Banks': ['马库斯-班克斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Marcus Fizer': ['马库斯-费泽','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Marcus Haislip': ['马库斯-海斯利普','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Mario Bennett': ['马里奥-贝内特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Mario Elie': ['马里奥-埃利','SG',76,{threePT:88,MID:82,FIN:80,DNK:58,HAN:74,PAS:72,PDEF:72,IDEF:60,BLK:38,REB:52,ATH:70,STR:54,CLU:84}],
  'Mark Blount': ['马克-布隆特','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Mark Bryant': ['马克-布莱恩特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Mark Davis': ['马克-戴维斯','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Mark Hendrickson': ['马克-亨德里克森','PF',70,{threePT:45,MID:64,FIN:78,DNK:72,HAN:60,PAS:52,PDEF:70,IDEF:74,BLK:72,REB:78,ATH:70,STR:80,CLU:64}],
  'Mark Madsen': ['马克-马德森','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Mark Olberding': ['马克-奥尔伯丁','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Mark West': ['马克-韦斯特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Marko Jaric': ['马尔科-雅里奇','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Marquis Daniels': ['马奎斯-丹尼尔斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Marty Conlon': ['马蒂-康伦','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Marvin Webster': ['马文-韦伯斯特','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Matt Harpring': ['马特-哈普林','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Matt Maloney': ['马特-马洛尼','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Maurice Lucas': ['莫里斯-卢卡斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Maurice Taylor': ['莫里斯-泰勒','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Mehmet Okur': ['梅米特-奥库尔','C',76,{threePT:36,MID:66,FIN:84,DNK:78,HAN:54,PAS:52,PDEF:74,IDEF:82,BLK:82,REB:86,ATH:66,STR:88,CLU:66}],
  'Mel Turpin': ['梅尔-特平','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Melvin Ely': ['梅尔文-伊莱','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Michael Brooks': ['迈克尔-布鲁克斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Michael Cage': ['迈克尔-凯奇','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Michael Curry': ['迈克尔-库里','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Michael Doleac': ['迈克尔-多利亚克','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Michael Olowokandi': ['迈克尔-奥洛沃坎迪','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Michael Redd': ['迈克尔-里德','SG',83,{threePT:85,MID:85,FIN:85,DNK:71,HAN:85,PAS:77,PDEF:75,IDEF:61,BLK:43,REB:51,ATH:83,STR:57,CLU:85}],
  'Michael Smith': ['迈克尔-史密斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Michael Sweetney': ['迈克尔-斯威特尼','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Micheal Ray Richardson': ['迈克尔-雷-理查德森','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Mickael Pietrus': ['迈克尔-皮特鲁斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Mickey Johnson': ['米奇-约翰逊','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Mike Dunleavy': ['迈克-邓利维','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Mike Evans': ['迈克-埃文斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Mike Gminski': ['迈克-格明斯基','C',76,{threePT:36,MID:66,FIN:84,DNK:78,HAN:54,PAS:52,PDEF:74,IDEF:82,BLK:82,REB:86,ATH:66,STR:88,CLU:66}],
  'Mike James': ['迈克-詹姆斯','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Mike McGee': ['迈克-麦基','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Mike Mitchell': ['迈克-米切尔','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Mike Sanders': ['迈克-桑德斯','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Mike Woodson': ['迈克-伍德森','SG',76,{threePT:80,MID:80,FIN:80,DNK:66,HAN:80,PAS:72,PDEF:70,IDEF:56,BLK:38,REB:46,ATH:78,STR:52,CLU:80}],
  'Milt Palacio': ['米尔特-帕拉西奥','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Mitch Kupchak': ['米奇-库普切克','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Mitch Richmond': ['米奇-里奇蒙','SG',86,{threePT:87,MID:87,FIN:87,DNK:73,HAN:87,PAS:79,PDEF:77,IDEF:63,BLK:45,REB:53,ATH:85,STR:59,CLU:87}],
  'Mitchell Butler': ['米切尔-巴特勒','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Mitchell Wiggins': ['米切尔-威金斯','SG',76,{threePT:80,MID:80,FIN:80,DNK:66,HAN:80,PAS:72,PDEF:70,IDEF:56,BLK:38,REB:46,ATH:78,STR:52,CLU:80}],
  'Mo Williams': ['莫-威廉姆斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Monty Williams': ['蒙蒂-威廉姆斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Moochie Norris': ['穆奇-诺里斯','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Morris Peterson': ['莫里斯-彼得森','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Muggsy Bogues': ['马格西-博格斯','PG',76,{threePT:72,MID:82,FIN:84,DNK:50,HAN:96,PAS:96,PDEF:88,IDEF:70,BLK:42,REB:50,ATH:94,STR:42,CLU:90}],
  'Mychal Thompson': ['迈克尔-汤普森','PF',80,{threePT:52,MID:71,FIN:85,DNK:79,HAN:67,PAS:59,PDEF:77,IDEF:81,BLK:79,REB:85,ATH:77,STR:87,CLU:71}],
  'Nate McMillan': ['内特-麦克米兰','SG',76,{threePT:70,MID:78,FIN:78,DNK:60,HAN:90,PAS:94,PDEF:96,IDEF:90,BLK:56,REB:76,ATH:78,STR:60,CLU:90}],
  'Nazr Mohammed': ['纳兹尔-穆罕默德','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Nene': ['内内','C',83,{threePT:41,MID:71,FIN:89,DNK:83,HAN:59,PAS:57,PDEF:79,IDEF:87,BLK:87,REB:91,ATH:71,STR:93,CLU:71}],
  'Nick Anderson': ['尼克-安德森','SG',81,{threePT:83,MID:83,FIN:83,DNK:69,HAN:83,PAS:75,PDEF:73,IDEF:59,BLK:41,REB:49,ATH:81,STR:55,CLU:83}],
  'Nick Van Exel': ['尼克-范埃克塞尔','PG',79,{threePT:76,MID:80,FIN:80,DNK:56,HAN:88,PAS:90,PDEF:74,IDEF:60,BLK:38,REB:51,ATH:80,STR:51,CLU:82}],
  'Norm Nixon': ['诺姆-尼克松','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Olden Polynice': ['奥尔登-波利尼斯','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Orlando Woolridge': ['奥兰多-乌尔里奇','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Othella Harrington': ['奥塞拉-哈林顿','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Otis Thorpe': ['奥蒂斯-索普','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Ozell Jones': ['奥泽尔-琼斯','PF',70,{threePT:45,MID:64,FIN:78,DNK:72,HAN:60,PAS:52,PDEF:70,IDEF:74,BLK:72,REB:78,ATH:70,STR:80,CLU:64}],
  'P.J. Brown': ['P.J.-布朗','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Pace Mannion': ['佩斯-曼尼恩','SG',70,{threePT:76,MID:76,FIN:76,DNK:62,HAN:76,PAS:68,PDEF:66,IDEF:52,BLK:34,REB:42,ATH:74,STR:48,CLU:76}],
  'Pat Cummings': ['帕特-卡明斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Pat Garrity': ['帕特-加里蒂','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Paul Mokeski': ['保罗-莫克斯基','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Pete Chilcutt': ['皮特-奇尔卡特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Phil Hubbard': ['菲尔-哈伯德','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Pooh Richardson': ['普-理查森','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Popeye Jones': ['波普艾-琼斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Predrag Drobnjak': ['普雷德拉格-德罗布尼亚克','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Quintin Dailey': ['昆汀-戴利','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Raef LaFrentz': ['拉夫-拉弗伦茨','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Rafer Alston': ['拉夫-阿尔斯通','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Randolph Childress': ['兰多夫-奇尔德雷斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Randy Breuer': ['兰迪-布罗伊尔','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Randy Brown': ['兰迪-布朗','PG',72,{threePT:55,MID:74,FIN:82,DNK:72,HAN:82,PAS:74,PDEF:86,IDEF:70,BLK:50,REB:52,ATH:90,STR:54,CLU:78}],
  'Randy Wittman': ['兰迪-惠特曼','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Rasho Nesterovic': ['拉索-内斯特洛维奇','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Rasual Butler': ['拉苏尔-巴特勒','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Raul Lopez': ['劳尔-洛佩斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Ray Owes': ['雷-欧文斯','PF',70,{threePT:45,MID:64,FIN:78,DNK:72,HAN:60,PAS:52,PDEF:70,IDEF:74,BLK:72,REB:78,ATH:70,STR:80,CLU:64}],
  'Reece Gaines': ['里斯-盖恩斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Reggie Evans': ['雷吉-埃文斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Reggie Geary': ['雷吉-吉尔里','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Reggie Jordan': ['雷吉-乔丹','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Rex Chapman': ['雷克斯-查普曼','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Rex Walters': ['雷克斯-沃尔特斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Rick Fox': ['里克-福克斯','SF',74,{threePT:76,MID:80,FIN:82,DNK:72,HAN:78,PAS:68,PDEF:78,IDEF:72,BLK:56,REB:68,ATH:80,STR:66,CLU:80}],
  'Rick Mahorn': ['里克-马洪','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Rickey Green': ['里基-格林','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Ricky Davis': ['里基-戴维斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Rik Smits': ['里克-斯米茨','C',85,{threePT:42,MID:72,FIN:90,DNK:84,HAN:60,PAS:58,PDEF:80,IDEF:88,BLK:88,REB:92,ATH:72,STR:94,CLU:72}],
  'Robert Archibald': ['罗伯特-阿奇博尔德','PF',72,{threePT:47,MID:66,FIN:80,DNK:74,HAN:62,PAS:54,PDEF:72,IDEF:76,BLK:74,REB:80,ATH:72,STR:82,CLU:66}],
  'Robert Horry': ['罗伯特-霍里','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Rod Foster': ['罗德-福斯特','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Rodney McCray': ['罗德尼-麦克雷','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Rodney Rogers': ['罗德尼-罗杰斯','PF',76,{threePT:74,MID:82,FIN:86,DNK:78,HAN:76,PAS:64,PDEF:70,IDEF:76,BLK:76,REB:86,ATH:82,STR:86,CLU:82}],
  'Rodney White': ['罗德尼-怀特','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Ronald Dupree': ['罗纳德-杜普里','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Ronald Murray': ['罗纳德-穆雷','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Rony Seikaly': ['罗尼-塞卡利','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Rory Sparrow': ['罗里-斯帕罗','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Roy Hinson': ['罗伊-欣森','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Roy Rogers': ['罗伊-罗杰斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Roy White': ['罗伊-怀特','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Ruben Patterson': ['鲁本-帕特森','SF',76,{threePT:70,MID:76,FIN:82,DNK:80,HAN:76,PAS:70,PDEF:74,IDEF:70,BLK:56,REB:66,ATH:82,STR:68,CLU:74}],
  'Rumeal Robinson': ['鲁米尔-罗宾逊','PG',74,{threePT:66,MID:80,FIN:84,DNK:72,HAN:86,PAS:86,PDEF:80,IDEF:66,BLK:46,REB:56,ATH:90,STR:58,CLU:82}],
  'Ryan Bowen': ['瑞安-鲍恩','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Ryan Humphrey': ['瑞安-汉弗莱','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Sam Bowie': ['萨姆-鲍伊','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Sam Mitchell': ['萨姆-米切尔','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Sam Perkins': ['萨姆-珀金斯','PF',76,{threePT:72,MID:84,FIN:86,DNK:70,HAN:76,PAS:62,PDEF:72,IDEF:80,BLK:78,REB:88,ATH:72,STR:88,CLU:84}],
  'Sam Williams': ['萨姆-威廉姆斯','SF',72,{threePT:68,MID:74,FIN:80,DNK:78,HAN:74,PAS:68,PDEF:72,IDEF:68,BLK:54,REB:64,ATH:80,STR:66,CLU:72}],
  'Samaki Walker': ['萨马基-沃克','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Sarunas Marciulionis': ['萨鲁纳斯-马修利奥尼斯','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Sasha Pavlovic': ['萨沙-帕夫洛维奇','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Scott Burrell': ['斯科特-伯勒尔','SF',76,{threePT:72,MID:80,FIN:84,DNK:80,HAN:78,PAS:64,PDEF:82,IDEF:78,BLK:66,REB:74,ATH:90,STR:66,CLU:82}],
  'Scott Padgett': ['斯科特-帕吉特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Scott Wedman': ['斯科特-韦德曼','SF',78,{threePT:71,MID:77,FIN:83,DNK:81,HAN:77,PAS:71,PDEF:75,IDEF:71,BLK:57,REB:67,ATH:83,STR:69,CLU:75}],
  'Sean Elliott': ['肖恩-埃利奥特','SF',85,{threePT:76,MID:82,FIN:88,DNK:86,HAN:82,PAS:76,PDEF:80,IDEF:76,BLK:62,REB:72,ATH:88,STR:74,CLU:80}],
  'Sedale Threatt': ['塞达莱-思雷特','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Shammond Williams': ['沙蒙德-威廉姆斯','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Shandon Anderson': ['尚登-安德森','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Shane Heal': ['肖恩-希尔','PG',70,{threePT:70,MID:74,FIN:74,DNK:50,HAN:82,PAS:84,PDEF:68,IDEF:54,BLK:32,REB:45,ATH:74,STR:45,CLU:76}],
  'Sharone Wright': ['沙隆-赖特','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Shawn Bradley': ['肖恩-布拉德利','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Sherman Douglas': ['谢尔曼-道格拉斯','PG',76,{threePT:74,MID:78,FIN:78,DNK:54,HAN:86,PAS:88,PDEF:72,IDEF:58,BLK:36,REB:49,ATH:78,STR:49,CLU:80}],
  'Sidney Green': ['西德尼-格林','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Slava Medvedenko': ['斯拉瓦-梅德维登科','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Speedy Claxton': ['斯皮迪-克拉克斯顿','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Spud Webb': ['斯伯特-韦伯','PG',78,{threePT:70,MID:84,FIN:88,DNK:82,HAN:92,PAS:90,PDEF:82,IDEF:68,BLK:42,REB:54,ATH:99,STR:48,CLU:90}],
  'Stacey Augmon': ['斯泰西-奥格蒙','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Stephen Jackson': ['斯蒂芬-杰克逊','SG',76,{threePT:80,MID:80,FIN:80,DNK:66,HAN:80,PAS:72,PDEF:70,IDEF:56,BLK:38,REB:46,ATH:78,STR:52,CLU:80}],
  'Steve Blake': ['史蒂夫-布莱克','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Steve Burtt': ['史蒂夫-伯特','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Steve Colter': ['史蒂夫-科尔特','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Steve Hamer': ['史蒂夫-哈默','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Steve Johnson': ['史蒂夫-约翰逊','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Steve Kerr': ['史蒂夫-科尔','PG',76,{threePT:95,MID:90,FIN:82,DNK:45,HAN:90,PAS:84,PDEF:62,IDEF:56,BLK:40,REB:50,ATH:55,STR:50,CLU:92}],
  'Steve Smith': ['史蒂夫-史密斯','SG',83,{threePT:85,MID:85,FIN:85,DNK:71,HAN:85,PAS:77,PDEF:75,IDEF:61,BLK:43,REB:51,ATH:83,STR:57,CLU:85}],
  'Steve Stipanovich': ['史蒂夫-斯蒂帕诺维奇','C',78,{threePT:37,MID:67,FIN:85,DNK:79,HAN:55,PAS:53,PDEF:75,IDEF:83,BLK:83,REB:87,ATH:67,STR:89,CLU:67}],
  'Steven Hunter': ['史蒂文-亨特','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Stromile Swift': ['斯特罗迈尔-斯威夫特','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'T.R. Dunn': ['T.R.-邓恩','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Terence Stansbury': ['特伦斯-斯坦斯伯里','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Terrell Brandon': ['特雷尔-布兰登','PG',83,{threePT:79,MID:83,FIN:83,DNK:59,HAN:91,PAS:93,PDEF:77,IDEF:63,BLK:41,REB:54,ATH:83,STR:54,CLU:85}],
  'Terry Dehere': ['特里-德赫雷','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Terry Mills': ['特里-米尔斯','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Terry Porter': ['特里-波特','PG',79,{threePT:76,MID:80,FIN:80,DNK:56,HAN:88,PAS:90,PDEF:74,IDEF:60,BLK:38,REB:51,ATH:80,STR:51,CLU:82}],
  'Theo Ratliff': ['西奥-拉特利夫','C',76,{threePT:36,MID:66,FIN:84,DNK:78,HAN:54,PAS:52,PDEF:74,IDEF:82,BLK:82,REB:86,ATH:66,STR:88,CLU:66}],
  'Tim Legler': ['蒂姆-莱格勒','SG',72,{threePT:90,MID:88,FIN:78,DNK:48,HAN:76,PAS:64,PDEF:58,IDEF:48,BLK:30,REB:40,ATH:56,STR:42,CLU:82}],
  'Tim McCormick': ['蒂姆-麦考密克','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Todd Day': ['托德-戴','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Todd Fuller': ['托德-富勒','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Tom Gugliotta': ['汤姆-古格里奥塔','PF',83,{threePT:54,MID:73,FIN:87,DNK:81,HAN:69,PAS:61,PDEF:79,IDEF:83,BLK:81,REB:87,ATH:79,STR:89,CLU:73}],
  'Tom Hammonds': ['汤姆-哈蒙兹','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Tom McMillen': ['汤姆-麦克米伦','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Tony Battie': ['托尼-巴蒂','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Tony Campbell': ['托尼-坎贝尔','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Tony Delk': ['托尼-德尔克','PG',74,{threePT:86,MID:84,FIN:84,DNK:62,HAN:84,PAS:76,PDEF:76,IDEF:64,BLK:45,REB:54,ATH:84,STR:56,CLU:82}],
  'Tony Massenburg': ['托尼-马森伯格','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Tracy Moore': ['特雷西-摩尔','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Tracy Murray': ['特雷西-默里','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Travis Best': ['特拉维斯-贝斯特','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Travis Hansen': ['特拉维斯-汉森','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'Travis Knight': ['特拉维斯-奈特','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Travis Outlaw': ['特拉维斯-奥特洛','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Tree Rollins': ['特里-罗林斯','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Trent Tucker': ['特伦特-塔克','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Trenton Hassell': ['特伦顿-哈塞尔','SF',74,{threePT:62,MID:76,FIN:80,DNK:70,HAN:76,PAS:60,PDEF:92,IDEF:84,BLK:62,REB:66,ATH:80,STR:64,CLU:78}],
  'Troy Hudson': ['特洛伊-哈德森','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Tyrone Corbin': ['泰龙-科尔宾','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Tyrone Hill': ['蒂龙-希尔','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Tyronn Lue': ['泰伦-卢','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Tyus Edney': ['泰厄斯-埃德尼','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
  'Udonis Haslem': ['乌杜尼斯-哈斯勒姆','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Vern Fleming': ['弗恩-弗莱明','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Vin Baker': ['文-贝克','PF',83,{threePT:54,MID:73,FIN:87,DNK:81,HAN:69,PAS:61,PDEF:79,IDEF:83,BLK:81,REB:87,ATH:79,STR:89,CLU:73}],
  'Vinnie Johnson': ['文尼-约翰逊','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Vinny Del Negro': ['维尼-德尔内格罗','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Vitaly Potapenko': ['维塔利-波塔潘科','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Vladimir Radmanovic': ['弗拉基米尔-拉德马诺维奇','PF',76,{threePT:49,MID:68,FIN:82,DNK:76,HAN:64,PAS:56,PDEF:74,IDEF:78,BLK:76,REB:82,ATH:74,STR:84,CLU:68}],
  'Vladimir Stepania': ['弗拉基米尔-斯特帕尼亚','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Voshon Lenard': ['沃尚-伦纳德','SG',76,{threePT:88,MID:84,FIN:82,DNK:62,HAN:78,PAS:66,PDEF:68,IDEF:52,BLK:34,REB:44,ATH:76,STR:50,CLU:82}],
  'Wally Szczerbiak': ['沃利-斯泽比亚克','SF',83,{threePT:88,MID:92,FIN:86,DNK:60,HAN:82,PAS:68,PDEF:68,IDEF:58,BLK:42,REB:58,ATH:68,STR:56,CLU:84}],
  'Walt Williams': ['沃尔特-威廉姆斯','SF',74,{threePT:88,MID:86,FIN:82,DNK:72,HAN:76,PAS:70,PDEF:66,IDEF:56,BLK:44,REB:56,ATH:80,STR:60,CLU:80}],
  'Walter McCarty': ['沃尔特-麦卡蒂','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Wayman Tisdale': ['韦曼-蒂斯代尔','PF',74,{threePT:48,MID:67,FIN:81,DNK:75,HAN:63,PAS:55,PDEF:73,IDEF:77,BLK:75,REB:81,ATH:73,STR:83,CLU:67}],
  'Wayne Cooper': ['韦恩-库珀','C',76,{threePT:36,MID:66,FIN:84,DNK:78,HAN:54,PAS:52,PDEF:74,IDEF:82,BLK:82,REB:86,ATH:66,STR:88,CLU:66}],
  'Wes Matthews': ['韦斯-马修斯','PG',74,{threePT:73,MID:77,FIN:77,DNK:53,HAN:85,PAS:87,PDEF:71,IDEF:57,BLK:35,REB:48,ATH:77,STR:48,CLU:79}],
  'Wesley Person': ['韦斯利-佩尔森','SG',74,{threePT:90,MID:84,FIN:78,DNK:56,HAN:76,PAS:64,PDEF:64,IDEF:48,BLK:32,REB:42,ATH:72,STR:46,CLU:82}],
  'Will Perdue': ['威尔-珀杜','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Willie Green': ['威利-格林','SG',74,{threePT:79,MID:79,FIN:79,DNK:65,HAN:79,PAS:71,PDEF:69,IDEF:55,BLK:37,REB:45,ATH:77,STR:51,CLU:79}],
  'Willie White': ['威利-怀特','SG',72,{threePT:78,MID:78,FIN:78,DNK:64,HAN:78,PAS:70,PDEF:68,IDEF:54,BLK:36,REB:44,ATH:76,STR:50,CLU:78}],
  'World B. Free': ['沃尔德-B-弗里','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Yinka Dare': ['因卡-达雷','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Zan Tabak': ['赞-塔巴克','C',72,{threePT:34,MID:64,FIN:82,DNK:76,HAN:52,PAS:50,PDEF:72,IDEF:80,BLK:80,REB:84,ATH:64,STR:86,CLU:64}],
  'Zarko Cabarkapa': ['扎尔科-卡巴卡帕','SF',74,{threePT:69,MID:75,FIN:81,DNK:79,HAN:75,PAS:69,PDEF:73,IDEF:69,BLK:55,REB:65,ATH:81,STR:67,CLU:73}],
  'Zaza Pachulia': ['扎扎-帕楚利亚','C',74,{threePT:35,MID:65,FIN:83,DNK:77,HAN:53,PAS:51,PDEF:73,IDEF:81,BLK:81,REB:85,ATH:65,STR:87,CLU:65}],
  'Zoran Planinic': ['佐兰-普拉尼尼奇','PG',72,{threePT:72,MID:76,FIN:76,DNK:52,HAN:84,PAS:86,PDEF:70,IDEF:56,BLK:34,REB:47,ATH:76,STR:47,CLU:78}],
};
/** 查找球员基础信息：优先历史模板，其次新秀库，最后补充表 */
function lookupEraPlayer(en) {
  if (typeof ERA_EXTRA_PLAYERS !== 'undefined' && ERA_EXTRA_PLAYERS[en]) {
    var e0 = ERA_EXTRA_PLAYERS[en];
    // ★ P1 修复：补充表无硬编码属性时继续向下查找（防止挡住 ERA_STAR_ATTRS）
    if (e0[3]) return { src: 'extra', data: { en: en, cn: e0[0], pos: e0[1], ovr: e0[2], attrs: e0[3] } };
  }
  if (typeof ERA_STAR_ATTRS !== 'undefined' && ERA_STAR_ATTRS[en]) {
    var s0 = ERA_STAR_ATTRS[en];
    return { src: 'star', data: { en: en, cn: s0[0], pos: s0[1], ovr: s0[2], attrs: s0[3] } };
  }
  if (typeof HISTORICAL_PLAYERS !== 'undefined') {
    for (var i = 0; i < HISTORICAL_PLAYERS.length; i++) {
      if (HISTORICAL_PLAYERS[i].en === en) return { src: 'template', data: HISTORICAL_PLAYERS[i] };
    }
  }
  if (typeof HISTORICAL_DRAFT_CLASSES !== 'undefined') {
    var years = Object.keys(HISTORICAL_DRAFT_CLASSES);
    for (var y = 0; y < years.length; y++) {
      var list = HISTORICAL_DRAFT_CLASSES[years[y]] || [];
      for (var j = 0; j < list.length; j++) {
        if (list[j].en === en) return { src: 'draft', data: list[j] };
      }
    }
  }
  // 角色池：ERA_ROLE_POOLS 真实球员（显式名单锚点用）
  if (typeof ERA_ROLE_POOLS !== 'undefined') {
    var eraKeys = Object.keys(ERA_ROLE_POOLS);
    for (var ek = 0; ek < eraKeys.length; ek++) {
      var poolList = ERA_ROLE_POOLS[eraKeys[ek]] || [];
      for (var pi = 0; pi < poolList.length; pi++) {
        if (poolList[pi] && poolList[pi][0] === en) {
          return { src: 'pool', data: { en: en, cn: poolList[pi][1], pos: poolList[pi][2], ovr: parseInt(poolList[pi][4], 10) || 75, attrs: null } };
        }
      }
    }
  }
  return null;
}

/** 时代核心球员 -> 游戏球员对象 */
function buildEraCorePlayer(era, team, en, capRatio) {
  var info = lookupEraPlayer(en);
  if (!info) return null;
  var d = info.data;
  var ovr = parseInt(d.ovr, 10) || (info.src === 'template' ? 85 : 75);
  var _peakOvr = ovr; // 模板/补充表的“巅峰”综评：年轻球员成长曲线的目标值
  var pos = d.pos || 'SF';
  var height = d.height || '';
  var cn = d.cn || en;
  var attrs = {};
  var attrKeys = (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.ATTR_LIST) || ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU'];
  if (d.attrs) {
    attrs = JSON.parse(JSON.stringify(d.attrs));
  }
  if (!d.attrs && typeof getEraPlayerAttrs === 'function') {
    attrs = getEraPlayerAttrs(pos, ovr);
  }
  attrKeys.forEach(function(k) {
    if (attrs[k] == null) attrs[k] = Math.max(30, Math.min(99, ovr + Math.floor(Math.random() * 14) - 7));
  });
  // ★ 年龄修复：优先按真实选秀年份算（加内特 1995 届 → 1996 时代 20 岁、2003 时代 27 岁），
  //   避免历史核心球员被 OVR 档位误判为 27-30 岁导致提前退役；无选秀数据退回 OVR 档位
  var _age0 = (typeof eraPlayerAgeByDraft === 'function') ? eraPlayerAgeByDraft(era, en) : null;
  if (_age0 == null) _age0 = ovr >= 95 ? 27 + Math.floor(Math.random() * 4) : ovr >= 90 ? 24 + Math.floor(Math.random() * 5) : ovr >= 84 ? 23 + Math.floor(Math.random() * 5) : 22 + Math.floor(Math.random() * 8);
  // ★ 选秀年份：优先 HISTORICAL_DRAFT_CLASSES，其次 ERA_PRE_DRAFT_YEARS（1984 时代之前的 79-83 届球星）
  var _draftY = null;
  try { _draftY = (typeof getEraPlayerDraftYear === 'function') ? getEraPlayerDraftYear(en) : null; } catch(e) {}
  if (_draftY == null && typeof ERA_PRE_DRAFT_YEARS !== 'undefined' && ERA_PRE_DRAFT_YEARS[en] != null) _draftY = ERA_PRE_DRAFT_YEARS[en];
  var _isEraRookie = (_draftY != null && String(_draftY) === String(era));
  var _proYear = (_draftY != null) ? (parseInt(era, 10) - parseInt(_draftY, 10) + 1) : null; // 入盟第 N 年（1=新秀季）
  // ★ 特定球星巅峰曲线：慢热球星按真实巅峰年放缓成长
  var _curve = (typeof ERA_STAR_CURVES !== 'undefined' && ERA_STAR_CURVES[en]) ? ERA_STAR_CURVES[en] : null;
  var _peakPro = (_curve && _curve.peakPro) ? parseInt(_curve.peakPro, 10) : 4;
  // ★ 新秀/年轻球星的“新秀 OVR + 潜力”来源：本人真实选秀届条目（KG 1995 届 87/98、詹姆斯 2003 届 91/99）
  var _rookOvr = null;   // 该球员新秀赛季综评
  var _rookPot = null;   // 该球员巅峰潜力（选秀类，通常即真实巅峰）
  var _rookClsAttrs = false;
  if (_draftY != null && typeof HISTORICAL_DRAFT_CLASSES !== 'undefined' && HISTORICAL_DRAFT_CLASSES[String(_draftY)]) {
    try {
      var _clsS = HISTORICAL_DRAFT_CLASSES[String(_draftY)] || [];
      var _enN2 = String(en).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (var _cS = 0; _cS < _clsS.length; _cS++) {
        var _ceS = _clsS[_cS];
        if (!_ceS || !_ceS.en) continue;
        var _ceN2 = String(_ceS.en).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (_ceN2 !== _enN2) continue;
        if (_ceS.ovr != null) _rookOvr = parseInt(_ceS.ovr, 10) || null;
        if (_ceS._potential != null) _rookPot = parseInt(_ceS._potential, 10);
        if (_ceS.attrs) _rookClsAttrs = true;
        break;
      }
    } catch(e) {}
  }
  // ★ 当季新秀：用选秀类“新秀 OVR/潜力”覆盖巅峰模板 OVR（否则科比 96 时代直接 97，18 岁新秀比巅峰还强），
  //   并打 _rookieSeason 标记，使其被 MVP/DPOY 等评选按“新秀赛季不参与”规则排除。
  var _rookiePot = null;
  if (_isEraRookie && typeof HISTORICAL_DRAFT_CLASSES !== 'undefined' && HISTORICAL_DRAFT_CLASSES[String(era)]) {
    try {
      var _cls2 = HISTORICAL_DRAFT_CLASSES[String(era)] || [];
      var _enN = String(en).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (var _c2 = 0; _c2 < _cls2.length; _c2++) {
        var _ce = _cls2[_c2];
        if (!_ce || !_ce.en) continue;
        var _ceN = String(_ce.en).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (_ceN !== _enN) continue;
        if (_ce.ovr != null) { ovr = parseInt(_ce.ovr, 10) || ovr; }
        if (_ce.pos) pos = String(_ce.pos).split('/')[0].trim();
        if (_ce.height) height = _ce.height;
        if (_ce._potential != null) { var _pot = parseInt(_ce._potential, 10); if (_pot > ovr) { _rookiePot = _pot; } }
        if (_ce.attrs) { attrs = JSON.parse(JSON.stringify(_ce.attrs)); _rookClsAttrs = true; }
        break;
      }
    } catch(e) {}
  }
  // ★ 年轻非新秀球星成长曲线：入盟第 2-4 年、年龄 ≤ 28 的球星，
  //   从本人“新秀 OVR”向“巅峰潜力”按现实“4-5 赛季进巅峰”曲线插值
  //   （加内特 96 时代 ≈ 91、97 时代 ≈ 95；麦迪/姚明/帕克等同理），
  //   之后每赛季由 evolveLeague 沿 _potential 继续逼近巅峰。
  var _inYoungWindow = (!_isEraRookie && _draftY != null && _proYear != null && _proYear >= 2 && _proYear <= 4 && _age0 <= 28);
  var _isYoungStar = false;
  if (_inYoungWindow) {
    var _rookStart = (_rookOvr != null && _rookOvr > 0) ? _rookOvr : Math.max(60, _peakOvr - 6); // 无选秀条目兜底：巅峰-6
    var _targetPeak = (_rookPot != null) ? _rookPot : _peakOvr;
    var _tRamp = Math.min(1, (_proYear - 1) / Math.max(1, (_peakPro - 1)));
    var _newOvr = Math.round(_rookStart + (_targetPeak - _rookStart) * _tRamp) + (Math.random() < 0.6 ? 0 : 1);
    _newOvr = Math.max(_rookStart, Math.min(_targetPeak, _newOvr));
    if (_newOvr !== ovr) { ovr = _newOvr; _isYoungStar = true; }
  }
  // ★ 属性同步：新秀/年轻球星的 OVR 被调低后，13 项属性按比例同步下调，
  //   避免“86 OVR 却带着 99 巅峰属性”的数据失真（如新秀科比、1996 时代加内特）。
  if ((_isEraRookie || _isYoungStar) && ovr < _peakOvr && !_rookClsAttrs) {
    var _ratioA = ovr / _peakOvr;
    attrKeys.forEach(function(k) { attrs[k] = Math.max(25, Math.min(99, Math.round(attrs[k] * _ratioA))); });
  }
  var p = {
    name: 'Era' + era + '_' + en.replace(/[^A-Za-z0-9]+/g, ''),
    nameEN: en,
    cname: cn,
    pos: pos,
    height: height,
    type: ovr >= 90 ? '超级星星' : ovr >= 85 ? '球星' : ovr >= 80 ? '主力' : '角色球员',
    ovr: ovr,
    _eraRoster: true,
    _tier: ovr >= 90 ? 'star' : (ovr >= 82 ? 'allstar' : 'role'),
    _age: _age0,
  };
  if (_isEraRookie) p._rookieSeason = 0; // 当季新秀：不参与首季 MVP/DPOY 等评选
  if (_draftY != null) { p._draftYear = _draftY; p._proYear = _proYear; }
  if (_peakPro > 4) p._peakPro = _peakPro; // 慢热球星标记：evolveLeague 按真实巅峰年成长
  attrKeys.forEach(function(k) { p[k] = attrs[k]; });
  if (_isEraRookie && _rookiePot != null) p._potential = _rookiePot;
  else if (_inYoungWindow && _rookPot != null) p._potential = _rookPot;
  else if (_inYoungWindow) p._potential = Math.min(99, _peakOvr + (Math.random() < 0.5 ? 0 : 1));
  else if (_rookPot != null && _age0 <= 28) p._potential = _rookPot; // 已过成长窗口但仍年轻的球星（24-28岁）继续沿真实潜力升到巅峰
  else if (ovr >= 88) p._potential = Math.min(99, ovr + 1 + Math.floor(Math.random() * 3));
  // ★ 历史真实合同：核心球星优先使用真实年薪/年限（无锚点回退时代公式）
  var realC = (typeof getHistoricalRealContract === 'function') ? getHistoricalRealContract(era, en) : null;
  if (realC && (realC.salary != null || realC.years != null)) {
    p.contract = (realC.years != null) ? realC.years : ((typeof eraNpcContractYears === 'function') ? eraNpcContractYears(era, ovr, _age0, true) : (ovr >= 88 ? 3 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3)));
    p.salary = (realC.salary != null) ? realC.salary : ((typeof eraSalaryByOvr === 'function') ? eraSalaryByOvr(era, ovr, _age0) : Math.max(30, Math.round(1200 * capRatio / 50) * 50));
  } else {
    p.contract = (typeof eraNpcContractYears === 'function') ? eraNpcContractYears(era, ovr, _age0, true) : (ovr >= 88 ? 3 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3));
    // ★ 时代经济：NPC 年薪按当年帽 × 时代比例（回退：旧版 现代基准 × 帽比例）
    p.salary = (typeof eraSalaryByOvr === 'function')
      ? eraSalaryByOvr(era, ovr, _age0)
      : Math.max(30, Math.round((ovr >= 92 ? 4500 : ovr >= 88 ? 3200 : ovr >= 82 ? 2000 : ovr >= 75 ? 1200 : 600) * capRatio / 50) * 50);
  }
  p.contractType = 'veteran';
  p._awardStreak = {};
  return p;
}

/** 历史球员成长元数据：选秀年 / 入盟第几年 / 新秀OVR / 潜力 / 慢热巅峰年（核心、角色、补位球员共用） */
// ★ 性能：成长元数据缓存（补位/选秀频繁调用，避免每次线性遍历届名单）
var _eraGrowthMetaCache = {};
function getEraPlayerGrowthMeta(en, era) {
  var _ck = String(en || "") + "|" + String(era || "");
  if (_eraGrowthMetaCache[_ck]) return _eraGrowthMetaCache[_ck];
  var draftY = null;
  try { draftY = (typeof getEraPlayerDraftYear === 'function') ? getEraPlayerDraftYear(en) : null; } catch(e) {}
  if (draftY == null && typeof ERA_PRE_DRAFT_YEARS !== 'undefined' && ERA_PRE_DRAFT_YEARS[en] != null) draftY = ERA_PRE_DRAFT_YEARS[en];
  var meta = { draftY: draftY, proYear: (draftY != null) ? (parseInt(era, 10) - parseInt(draftY, 10) + 1) : null, rookOvr: null, pot: null, tier: null, peakPro: 4 };
  if (draftY != null && typeof HISTORICAL_DRAFT_CLASSES !== 'undefined' && HISTORICAL_DRAFT_CLASSES[String(draftY)]) {
    try {
      var cls = HISTORICAL_DRAFT_CLASSES[String(draftY)] || [];
      var enN = String(en).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (var i = 0; i < cls.length; i++) {
        var ce = cls[i];
        if (!ce || !ce.en) continue;
        if (String(ce.en).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() !== enN) continue;
        if (ce.ovr != null) meta.rookOvr = parseInt(ce.ovr, 10) || null;
        if (ce._potential != null) meta.pot = parseInt(ce._potential, 10);
        if (ce.tier) meta.tier = ce.tier;
        break;
      }
    } catch(e) {}
  }
  var curve = (typeof ERA_STAR_CURVES !== 'undefined' && ERA_STAR_CURVES[en]) ? ERA_STAR_CURVES[en] : null;
  if (curve && curve.peakPro) meta.peakPro = parseInt(curve.peakPro, 10);
  _eraGrowthMetaCache[_ck] = meta;
  return meta;
}

/** 角色球员生成（假人名，按时代水平） */
function buildEraRolePlayer(era, team, usedPos, capRatio, activeTeams, preReal) {
  var posPool = ['PG','SG','SF','PF','C'];
  var pos = posPool[Math.floor(Math.random() * posPool.length)];
  if (usedPos) {
    var minPos = posPool[0], minCount = 99;
    posPool.forEach(function(pp) {
      var c = usedPos[pp] || 0;
      if (c < minCount) { minCount = c; minPos = pp; }
    });
    pos = minPos;
  }
  if (usedPos) usedPos[pos] = (usedPos[pos] || 0) + 1;
  var range = ERA_ROLE_RANGES[era] || [60, 76];
  // ★ 修复：先从池取真实球员（替补池/角色池条目自带 OVR），再决定初始 OVR；修复原先 ovr 在 _real 赋值前引用的顺序 bug
  var _real = preReal || takeEraRoleFromPool(era, pos, team);
  if (!_real) return null;
  var ovr = (_real && _real[4] != null) ? parseInt(_real[4], 10) : (range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1)));
  // ★ 修复：池子条目带真实位置/身高，必须覆盖之前随机/按队内最少位置算出的 pos，
  //   否则会出现“补的 PF 进队变成 SG”导致球队仍缺位置（阵容只有 4 个首发）
  if (_real[2]) {
    var _rp = String(_real[2]).toUpperCase().split('/')[0].trim();
    if (['PG', 'SG', 'SF', 'PF', 'C'].indexOf(_rp) >= 0) pos = _rp;
  }
  var en = _real[0], cn = _real[1], height = _real[3] || '';
  var attrKeys = (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.ATTR_LIST) || ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU'];
  // ★ 成长曲线：真实选秀届/补充表有数据的球员同样按“新秀→巅峰”成长（含 1984 时代之前的 79-83 届）
  var _gm = (typeof getEraPlayerGrowthMeta === 'function') ? getEraPlayerGrowthMeta(en, era) : null;
  var _eraY = (parseInt(era, 10) || 1984) + ((STATE && STATE.career && STATE.career.seasonCount) || 0);
  // 年龄：优先用替补池条目自带的出生年（第 7 字段），其次按选秀年推导，再次随机 22-31
  var _ageR = 22 + Math.floor(Math.random() * 10);
  if (_real && _real[6] != null) {
    var _byR = parseInt(_real[6], 10);
    if (_byR >= 1930 && _byR <= _eraY) _ageR = Math.max(18, Math.min(45, _eraY - _byR));
  }
  if (_gm && _gm.draftY != null) {
    _ageR = _eraY - _gm.draftY + 19 + Math.floor(Math.random() * 3);
    _ageR = Math.max(21, Math.min(40, _ageR));
  }
  // ★ 有名角色/轮换/第六人/二轮秀同样走成长曲线：有潜力数据的年轻球员从新秀值向巅峰成长
  var _rolePot = (_gm && _gm.pot != null) ? _gm.pot : null;
  if (_gm && _gm.draftY != null && _gm.proYear != null && _gm.proYear >= 2 && _gm.proYear <= 4 && _ageR <= 28) {
    if (_gm.pot != null && _gm.rookOvr != null) {
      var _tR3 = Math.min(1, (_gm.proYear - 1) / Math.max(1, (_gm.peakPro - 1)));
      var _cv3 = Math.round(_gm.rookOvr + (Math.max(_gm.rookOvr, Math.min(99, _gm.pot)) - _gm.rookOvr) * _tR3);
      _cv3 = Math.max(_gm.rookOvr, Math.min(99, _cv3));
      if (_cv3 !== ovr) ovr = _cv3;
    } else if (_rolePot == null) {
      // 无选秀潜力数据的年轻轮换：给温和上限，避免一直停在 70 出头
      _rolePot = Math.min(86, Math.max(ovr + 3, 82));
    }
  }
  // ★ 替补/角色球员当前 OVR 按时代合理封顶（保留 _potential，让年轻球员在赛季演化中逐步打出来）
  var _roleCap = { '1984': 78, '1996': 80, '2003': 82 }[String(era)] || 82;
  if (ovr > _roleCap) ovr = _roleCap;
  // ★ F2 修复：替补/角色球员潜力按时代封顶（当前 OVR 上限 +4~5），
  //   避免年轻替补沿真实球星潜力（88-98）长成 90+ 全明星；核心球星走核心名单不走此路径
  var _rolePotCap = { '1984': 82, '1996': 84, '2003': 86 }[String(era)] || 86;
  if (_rolePot != null && _rolePot > _rolePotCap) _rolePot = _rolePotCap;
  var p = {
    name: 'EraRole_' + era + '_' + team + '_' + (usedPos ? Object.keys(usedPos).length : 0) + '_' + Math.floor(Math.random() * 9999),
    nameEN: en, cname: cn, pos: pos, height: height,
    type: ovr >= 80 ? '主力' : '角色球员',
    ovr: ovr, _eraRoster: true, _tier: 'role',
    _age: _ageR,
    _draftYear: (_gm && _gm.draftY != null) ? _gm.draftY : undefined,
    _proYear: (_gm && _gm.draftY != null) ? _gm.proYear : undefined,
    _potential: (_rolePot != null) ? _rolePot : undefined,
    _peakPro: (_gm && _gm.peakPro > 4) ? _gm.peakPro : undefined,
    contract: (typeof eraNpcContractYears === 'function') ? eraNpcContractYears(era, ovr, _ageR, false) : (1 + Math.floor(Math.random() * 3)),
    salary: (typeof eraSalaryByOvr === 'function') ? eraSalaryByOvr(era, ovr, _ageR) : Math.max(25, Math.round(600 * capRatio / 50) * 50),
    contractType: 'veteran', _awardStreak: {},
  };
  var genAttrs = (typeof getEraPlayerAttrs === 'function') ? getEraPlayerAttrs(pos, ovr) : null;
  attrKeys.forEach(function(k) { p[k] = genAttrs && genAttrs[k] != null ? genAttrs[k] : Math.max(30, Math.min(99, ovr + Math.floor(Math.random() * 14) - 7)); });
  return p;
}

/** 替换整个联盟为时代名单 + 生成时代赛程 */
function buildEraRosters(era) {
  if (typeof NBA2K_DATA === 'undefined' || typeof NBA2K_TEAMS === 'undefined') return;
  era = String(era || 1984);
  _eraPoolUsed = {}; // 每次建联盟重置真实池占用
  var active = getEraActiveTeams(era, 0);
  var capRatio = (typeof getEraSalaryCap === 'function') ? getEraSalaryCap(era) / 15464.7 : 1;
  function neededPos(roster) {
    var usedPos = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    roster.forEach(function(p) {
      var main = String(p.pos || 'SF').split('/')[0].trim();
      if (usedPos[main] != null) usedPos[main]++;
    });
    var order = ['PG', 'SG', 'SF', 'PF', 'C'];
    var minPos = order[0], minCount = 99;
    order.forEach(function(pp) { if ((usedPos[pp] || 0) < minCount) { minCount = usedPos[pp]; minPos = pp; } });
    return minPos;
  }
  function addRole(t, roster, strict) {
    if (roster.length >= ERA_ROSTER_SIZE) return true;
    var pos = neededPos(roster);
    var cand = takeEraRoleFromPool(era, pos, t, strict);
    if (!cand) return false;
    var p = buildEraRolePlayer(era, t, null, capRatio, active, cand);
    if (!p) return false;
    roster.push(p);
    return true;
  }
  // 活跃队优先，非活跃队（该时代尚未成立的队）用剩余真实球员兜底建名单，避免残留现役名单
  var allTeams = active.concat(NBA2K_TEAMS.filter(function(t) { return active.indexOf(t) < 0; }));
  // 第一遍：仅核心名单（不在此处用池补人）；非活跃队先清空，避免残留现役名单
  allTeams.forEach(function(t) {
    if (active.indexOf(t) < 0) { NBA2K_DATA[t] = []; return; }
    var roster = [];
    var core = (ERA_ROSTERS[era] && ERA_ROSTERS[era][t]) || [];
    core.forEach(function(en) {
      var p = buildEraCorePlayer(era, t, en, capRatio);
      if (p) roster.push(p);
    });
    NBA2K_DATA[t] = roster;
  });
  // ★ 位置覆盖优先：先确保每支活跃队五个位置（PG/SG/SF/PF/C）都至少 1 人，
  //   再批量补人，避免先处理的球队把某位置池耗尽导致后续球队“缺一个队友”（阵容只有 4 个位置）。
    // bench-pool fill: per-team real bench (no overlap with core / current draft class)
  allTeams.forEach(function(t) {
    if (active.indexOf(t) < 0) return;
    var roster = NBA2K_DATA[t] || [];
    var _guardBch = 0;
    while (roster.length < ERA_ROSTER_SIZE && _guardBch++ < 40) {
      var _bch = takeEraBenchPlayer(era, neededPos(roster), t, true);
      if (!_bch) break;
      var _bp = buildEraRolePlayer(era, t, null, capRatio, active, _bch);
      if (!_bp) break;
      roster.push(_bp);
    }
  });
  function teamMissingPos(roster) {
    var used = {};
    roster.forEach(function(p) { var m = String(p.pos || 'SF').split('/')[0].trim(); used[m] = true; });
    var miss = [];
    ['PG', 'SG', 'SF', 'PF', 'C'].forEach(function(pp) { if (!used[pp]) miss.push(pp); });
    return miss;
  }
  active.forEach(function(t) {
    var roster = NBA2K_DATA[t] || [];
    var _guardC = 0;
    while (_guardC++ < 30) {
      if (roster.length >= ERA_ROSTER_SIZE) break; // 已达目标人数则不再加人，避免挤占兜底池
      var miss = teamMissingPos(roster);
      if (!miss.length) break;
      var pos = miss[0];
      var cand = takeEraBenchPlayer(era, pos, t, false) || takeEraRoleFromPool(era, pos, t, false);
      if (!cand) break;
      var p = buildEraRolePlayer(era, t, null, capRatio, active, cand);
      if (!p) break;
      roster.push(p);
    }
  });
  // 第二遍（原第一遍）：同队真实球员补足（先确保每队拿到自己人）
  allTeams.forEach(function(t) {
    var roster = NBA2K_DATA[t] || [];
    var _guardA = 0;
    while (roster.length < ERA_ROSTER_SIZE && _guardA++ < 40) {
      if (!addRole(t, roster, true)) break;
    }
  });
  // 第二遍：剩余位置用池内任意未用真实球员补齐（活跃队优先，非活跃队拿剩余）
  allTeams.forEach(function(t) {
    var roster = NBA2K_DATA[t] || [];
    var _guardB = 0;
    while (roster.length < ERA_ROSTER_SIZE && _guardB++ < 40) {
      if (!addRole(t, roster, false)) break;
    }
  });
  // ★ 兜底去重：同队归一化同名（写法差异如 Amare/Amar'e）只保留最高 OVR 一个，防止替补池/选秀重复入队
  var _normN = function(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim(); };
  allTeams.forEach(function(t) {
    var _r3 = NBA2K_DATA[t] || [];
    if (!_r3.length) return;
    var _seen = {};
    var _kept = [];
    _r3.slice().sort(function(a, b) { return (parseInt(b.ovr) || 0) - (parseInt(a.ovr) || 0); }).forEach(function(p) {
      if (!p || !p.name) { _kept.push(p); return; }
      var _k3 = _normN(p.nameEN || p.name);
      if (!_k3 || _seen[_k3]) return;
      _seen[_k3] = true;
      _kept.push(p);
    });
    NBA2K_DATA[t] = _kept;
  });
  NBA2K_DATA._eraRostersBuilt = true;
  if (typeof generateEraSchedule === 'function') generateEraSchedule(era, active, 0);
}

/** 30 队时代（2004-05 起）真实六分区布局（用于赛程排布） */
var ERA_SCHEDULE_DIVISIONS_30 = {
  ATLANTIC: ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'],
  CENTRAL: ['CHI', 'CLE', 'DET', 'IND', 'MIL'],
  SOUTHEAST: ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'],
  NORTHWEST: ['DEN', 'MIN', 'OKC', 'POR', 'UTA'],
  PACIFIC: ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'],
  SOUTHWEST: ['DAL', 'HOU', 'MEM', 'NOP', 'SAS']
};

/** 各时代真实分区（按赛季区间划分；yr = eraStart + seasonCount）。
    1984 时代：23→25（1988）→27（1989）→29（1995）→29（2002 黄蜂迁新奥尔良）→30（2004）；
    1996 时代：29→29（2002 迁移）→30（2004）；2003 时代：29→30（2004）。
    2004 起的六分区为真实重组（猛龙回大西洋、黄蜂入西南、山猫入东南等）。 */
var ERA_SCHEDULE_SEASONS = {
  '1984': [
    { from: 1984, to: 1987, divs: {
      ATLANTIC: ['BOS', 'NYK', 'PHI', 'WAS', 'BKN'],
      CENTRAL: ['ATL', 'DET', 'IND', 'MIL', 'CHI', 'CLE'],
      MIDWEST: ['DAL', 'HOU', 'DEN', 'SAS', 'UTA', 'SAC'],
      PACIFIC: ['LAL', 'PHX', 'OKC', 'POR', 'GSW', 'LAC']
    } },
    { from: 1988, to: 1988, divs: {
      ATLANTIC: ['BOS', 'NYK', 'PHI', 'WAS', 'BKN', 'MIA'],
      CENTRAL: ['ATL', 'DET', 'IND', 'MIL', 'CHI', 'CLE'],
      MIDWEST: ['DAL', 'HOU', 'DEN', 'SAS', 'UTA', 'SAC', 'CHA'],
      PACIFIC: ['LAL', 'PHX', 'OKC', 'POR', 'GSW', 'LAC']
    } },
    { from: 1989, to: 1994, divs: {
      ATLANTIC: ['BOS', 'NYK', 'PHI', 'WAS', 'BKN', 'MIA'],
      CENTRAL: ['ATL', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'ORL'],
      MIDWEST: ['DAL', 'HOU', 'DEN', 'SAS', 'UTA', 'MIN'],
      PACIFIC: ['LAL', 'PHX', 'OKC', 'POR', 'GSW', 'LAC', 'SAC']
    } },
    { from: 1995, to: 2001, divs: {
      ATLANTIC: ['BOS', 'MIA', 'BKN', 'NYK', 'ORL', 'PHI', 'WAS'],
      CENTRAL: ['ATL', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'TOR'],
      MIDWEST: ['DAL', 'DEN', 'HOU', 'MIN', 'SAS', 'UTA', 'MEM'],
      PACIFIC: ['GSW', 'LAC', 'LAL', 'PHX', 'POR', 'SAC', 'OKC']
    } },
    { from: 2002, to: 2003, divs: {
      ATLANTIC: ['BOS', 'MIA', 'BKN', 'NYK', 'ORL', 'PHI', 'WAS'],
      CENTRAL: ['ATL', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'TOR', 'NOP'],
      MIDWEST: ['DAL', 'DEN', 'HOU', 'MIN', 'SAS', 'UTA', 'MEM'],
      PACIFIC: ['GSW', 'LAC', 'LAL', 'PHX', 'POR', 'SAC', 'OKC']
    } },
    { from: 2004, divs: ERA_SCHEDULE_DIVISIONS_30 }
  ],
  '1996': [
    { from: 1996, to: 2001, divs: {
      ATLANTIC: ['BOS', 'MIA', 'BKN', 'NYK', 'ORL', 'PHI', 'WAS'],
      CENTRAL: ['ATL', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'TOR'],
      MIDWEST: ['DAL', 'DEN', 'HOU', 'MIN', 'SAS', 'UTA', 'MEM'],
      PACIFIC: ['GSW', 'LAC', 'LAL', 'PHX', 'POR', 'SAC', 'OKC']
    } },
    { from: 2002, to: 2003, divs: {
      ATLANTIC: ['BOS', 'MIA', 'BKN', 'NYK', 'ORL', 'PHI', 'WAS'],
      CENTRAL: ['ATL', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'TOR', 'NOP'],
      MIDWEST: ['DAL', 'DEN', 'HOU', 'MIN', 'SAS', 'UTA', 'MEM'],
      PACIFIC: ['GSW', 'LAC', 'LAL', 'PHX', 'POR', 'SAC', 'OKC']
    } },
    { from: 2004, divs: ERA_SCHEDULE_DIVISIONS_30 }
  ],
  '2003': [
    { from: 2003, to: 2003, divs: {
      ATLANTIC: ['BOS', 'MIA', 'BKN', 'NYK', 'ORL', 'PHI', 'WAS'],
      CENTRAL: ['ATL', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 'NOP', 'TOR'],
      MIDWEST: ['DAL', 'DEN', 'HOU', 'MIN', 'SAS', 'UTA', 'MEM'],
      PACIFIC: ['GSW', 'LAC', 'LAL', 'PHX', 'POR', 'SAC', 'OKC']
    } },
    { from: 2004, divs: ERA_SCHEDULE_DIVISIONS_30 }
  ]
};

var ERA_EAST_DIVISIONS = ['ATLANTIC', 'CENTRAL', 'SOUTHEAST'];

/** 获取当前时代各队分区归属表（按赛季年份自动切换布局） */
function getEraDivisionMap(era, seasonCount) {
  var map = {};
  var yr = (parseInt(era, 10) || 0) + (parseInt(seasonCount, 10) || 0);
  var seasons = ERA_SCHEDULE_SEASONS[String(era)] || [];
  var layout = null;
  for (var i = 0; i < seasons.length; i++) {
    if (yr >= (seasons[i].from || 0)) layout = seasons[i].divs;
  }
  if (!layout) layout = ERA_SCHEDULE_DIVISIONS_30;
  Object.keys(layout || {}).forEach(function(d) {
    (layout[d] || []).forEach(function(t) { map[t] = d; });
  });
  return map;
}

/** 时代球队所属联盟（由分区布局推导；2004 起黄蜂自动转西部） */
function getEraConferenceOf(era, team, seasonCount) {
  var sc = (seasonCount != null) ? seasonCount : ((STATE && STATE.career && STATE.career.seasonCount) || 0);
  if (typeof getEraDivisionMap === 'function') {
    var map = getEraDivisionMap(String(era), sc);
    var d = map[team];
    if (d) return ERA_EAST_DIVISIONS.indexOf(d) >= 0 ? 'EAST' : 'WEST';
  }
  if (SIM_CONFIG && SIM_CONFIG.CONFERENCE && SIM_CONFIG.CONFERENCE.EAST && SIM_CONFIG.CONFERENCE.EAST.indexOf(team) >= 0) return 'EAST';
  return 'WEST';
}

/** 生成时代 82 场常规赛赛程（按年代真实对阵结构 + 贪心排日）
 * 规则来源（真实 NBA 历史赛程结构）：
 *  - 跨联盟一律 2 场（各年代通用）；
 *  - 1984-87（23 队）：同联盟以 5-6 场为主，分区对手优先补到 6 场（真实例：1984-85 凯尔特人 同组 6×4 + 非组 6/6/6/6/5/5）；
 *  - 1988-89（25 队）/ 1989-94（27 队）：同联盟 4-6 场，按分区优先补场；
 *  - 1995-2003（29 队，东 15 西 14）：西部 13 队互打 4 场 + 东部 15 队各 2 场；
 *    东部 12 队互打 4 场 + 2 队互打 3 场 + 西部 14 队各 2 场（真实例：1996-97 公牛 12×4+2×3+14×2）；
 *  - 2004+（30 队）：同分区 4 场、同联盟非分区 6 队×4+4 队×3、跨联盟 2 场。
 * 算法：先按“每队 82 场 - 跨联盟 2×N”计算同联盟基础场次，再用对称贪心补场
 *（优先补同分区对手），保证两两对阵次数对称、每队恰好 82 场。
 */
function generateEraSchedule(era, activeTeams, seasonCount) {
  var teams = activeTeams.slice().sort();
  var N = teams.length;
  if (N < 2) return null;
  var sc = (seasonCount != null) ? seasonCount : ((STATE && STATE.career && STATE.career.seasonCount) || 0);
  var divMap = getEraDivisionMap(era, sc);
  var confOf = {}, divOf = {};
  teams.forEach(function(t) {
    divOf[t] = divMap[t] || '';
    confOf[t] = getEraConferenceOf(era, t, sc);
  });

  var counts = {};
  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function addCount(a, b, n) { var k = pairKey(a, b); counts[k] = (counts[k] || 0) + n; }
  function getCount(a, b) { return counts[pairKey(a, b)] || 0; }

  // ── 1) 跨联盟：一律 2 场 ──
  for (var i = 0; i < N; i++) {
    for (var j = i + 1; j < N; j++) {
      if (confOf[teams[i]] !== confOf[teams[j]]) addCount(teams[i], teams[j], 2);
    }
  }

  // ── 2) 同联盟：基础场次 + 对称补场（分区优先） ──
  var confGroups = {};
  teams.forEach(function(t) { (confGroups[confOf[t]] = confGroups[confOf[t]] || []).push(t); });
  Object.keys(confGroups).forEach(function(c) {
    var list = confGroups[c].slice().sort();
    var M = list.length;
    if (M < 2) return;
    var crossCount = N - M;
    var sameTotal = 82 - 2 * crossCount;
    var K = M - 1;
    var base = Math.floor(sameTotal / K);
    var extra = sameTotal - base * K; // 每队需补的场次
    for (var x = 0; x < M; x++) {
      for (var y = x + 1; y < M; y++) addCount(list[x], list[y], base);
    }
    if (extra === 0) return;

    // 对称补场：每队恰好 extra 个对手各 +1 场
    var need = {};
    list.forEach(function(t) { need[t] = extra; });
    var up = {}; // 已补场的配对
    function upKey(a, b) { return pairKey(a, b); }
    function eligible(a, b) { return !up[upKey(a, b)] && need[a] > 0 && need[b] > 0; }

    // 距离（环上索引距离）用于打破平局，优先补同分区
    function distIdx(ia, ib) {
      var d = Math.abs(ia - ib);
      return Math.min(d, M - d);
    }
    // 选择器：返回 [主队, 伙伴]；divOnly=true 时只考虑同分区配对
    function pickMove(divOnly) {
      var pick = null, pickScore = null;
      for (var a = 0; a < M; a++) {
        if (need[list[a]] <= 0) continue;
        var avail = 0, hasAny = false;
        for (var b = 0; b < M; b++) {
          if (b === a || !eligible(list[a], list[b])) continue;
          if (divOnly && divOf[list[a]] !== divOf[list[b]]) continue;
          avail++; hasAny = true;
        }
        if (!hasAny) continue;
        var score = need[list[a]] * 1000 - avail;
        if (pickScore === null || score > pickScore) { pickScore = score; pick = a; }
      }
      if (pick === null) return null;
      var bestB = -1, bestScore = null;
      for (var b2 = 0; b2 < M; b2++) {
        if (b2 === pick || !eligible(list[pick], list[b2])) continue;
        if (divOnly && divOf[list[pick]] !== divOf[list[b2]]) continue;
        var s = (divOf[list[pick]] === divOf[list[b2]] ? 0 : 1) * 100 - distIdx(pick, b2);
        if (bestScore === null || s < bestScore) { bestScore = s; bestB = b2; }
      }
      if (bestB < 0) return null;
      return [pick, bestB];
    }
    // 第一阶段：全局优先补同分区配对（保证分区对手场次数不低于非分区）
    var guard = 0;
    while (guard++ < 500) {
      var mv = pickMove(true);
      if (!mv) break;
      up[upKey(list[mv[0]], list[mv[1]])] = true;
      need[list[mv[0]]]--;
      need[list[mv[1]]]--;
    }
    // 第二阶段：补剩余非分区配对
    guard = 0;
    while (guard++ < 500) {
      var mv2 = pickMove(false);
      if (!mv2) break;
      up[upKey(list[mv2[0]], list[mv2[1]])] = true;
      need[list[mv2[0]]]--;
      need[list[mv2[1]]]--;
    }
    // 换边修复：贪心偶发卡死（个别队伍仍有需求、伙伴已满）时，把一条已补的边 (X,Y) 换成 (A,X)+(A,Y)
    // 保持 X/Y 度数不变，A 补 2 场；不破坏对称性
    var repairGuard = 0;
    while (repairGuard++ < 200) {
      var needA = -1;
      for (var a2 = 0; a2 < M; a2++) { if (need[list[a2]] > 0) { needA = a2; break; } }
      if (needA < 0) break;
      if (need[list[needA]] === 1) {
        // 单点残差：先找另一个仍有需求的伙伴补一条（残差和为偶数，必然成对出现）
        var done1 = false;
        for (var b9 = 0; b9 < M; b9++) {
          if (b9 === needA || need[list[b9]] <= 0) continue;
          if (up[upKey(list[needA], list[b9])]) continue;
          up[upKey(list[needA], list[b9])] = true;
          need[list[needA]]--;
          need[list[b9]]--;
          done1 = true;
          break;
        }
        if (done1) continue;
        // 若唯一的成对伙伴 (A,B) 已被补过：删一条已补边 (X,Y)，加 (A,X)+(B,Y)（度数守恒）
        var b9b = -1;
        for (var b0 = 0; b0 < M; b0++) {
          if (b0 !== needA && need[list[b0]] > 0) { b9b = b0; break; }
        }
        if (b9b >= 0) {
          var swapped2 = false;
          var keys2 = Object.keys(up).filter(function(k) {
            var pp = k.split('|');
            return divOf[pp[0]] !== divOf[pp[1]];
          });
          if (!keys2.length) keys2 = Object.keys(up);
          for (var ki2 = 0; ki2 < keys2.length && !swapped2; ki2++) {
            var pp2 = keys2[ki2].split('|');
            var X2 = pp2[0], Y2 = pp2[1];
            if (X2 === list[needA] || X2 === list[b9b] || Y2 === list[needA] || Y2 === list[b9b]) continue;
            if (up[upKey(list[needA], X2)] || up[upKey(list[b9b], Y2)]) continue;
            delete up[upKey(X2, Y2)];
            up[upKey(list[needA], X2)] = true;
            up[upKey(list[b9b], Y2)] = true;
            need[list[needA]]--;
            need[list[b9b]]--;
            swapped2 = true;
          }
          if (swapped2) continue;
        }
        break; // 无法直接补，交给距离兜底
      }
      var swapped = false;
      // 优先找“非分区”的已补配对来换边，避免破坏分区优先
      var keys = Object.keys(up).filter(function(k) {
        var pp = k.split('|');
        return divOf[pp[0]] !== divOf[pp[1]];
      });
      if (!keys.length) keys = Object.keys(up);
      for (var ki = 0; ki < keys.length && !swapped; ki++) {
        var pp = keys[ki].split('|');
        var X = pp[0], Y = pp[1];
        if (X === list[needA] || Y === list[needA]) continue;
        if (up[upKey(list[needA], X)] || up[upKey(list[needA], Y)]) continue;
        delete up[upKey(X, Y)];
        up[upKey(list[needA], X)] = true;
        up[upKey(list[needA], Y)] = true;
        need[list[needA]] -= 2;
        swapped = true;
      }
      if (!swapped) break;
    }
    // 兜底：贪心/修复仍偶发未收敛时，改用环距离对称构造（放弃分区优先，保证每队恰好补满且对称）
    if (list.some(function(t) { return need[t] > 0; })) {
      var fbUp = {};
      var dUsed = 0, dCur = 1;
      var target = Math.floor(extra / 2);
      while (dUsed < target) {
        for (var z = 0; z < M; z++) {
          var pz = list[(z + dCur) % M];
          if (pz !== list[z]) fbUp[pairKey(list[z], pz)] = true;
        }
        dUsed++; dCur++;
      }
      if (extra % 2 === 1) {
        for (var z2 = 0; z2 < M; z2++) {
          var pz2 = list[(z2 + Math.floor(M / 2)) % M];
          if (pz2 !== list[z2]) fbUp[pairKey(list[z2], pz2)] = true;
        }
      }
      up = fbUp;
      if (typeof console !== 'undefined' && console.warn) console.warn('[EraSched] 补场走兜底对称构造', era, c, 'extra=' + extra);
    }
    Object.keys(up).forEach(function(k) {
      var parts = k.split('|');
      counts[k] = (counts[k] || 0) + 1;
    });
  });

  // ── 3) 汇总为比赛列表（主客场交替、奇数场次尽量均摊主客场） ──
  var allGames = [];
  var homeCount = {};
  var awayCount = {};
  teams.forEach(function(t) { homeCount[t] = 0; awayCount[t] = 0; });
  Object.keys(counts).forEach(function(k) {
    var parts = k.split('|');
    var a = parts[0], b = parts[1];
    var c = counts[k];
    for (var g = 0; g < c; g++) {
      // 偶数场：交替主客；奇数场：按累计主客场差，主场少的一队多打一个主场
      var isHomeA;
      if (c % 2 === 0) {
        isHomeA = (g % 2 === 0);
      } else {
        var diffA = homeCount[a] - awayCount[a];
        var diffB = homeCount[b] - awayCount[b];
        isHomeA = (diffA <= diffB);
      }
      var home, away;
      if (isHomeA) { home = a; away = b; } else { home = b; away = a; }
      homeCount[home]++;
      awayCount[away]++;
      allGames.push({ home: home, away: away });
    }
  });

  // ── 4) 贪心排日：每队每天最多 1 场，分布在 day 0..177 ──
  var shuffled = allGames.slice().sort(function() { return Math.random() - 0.5; });
  var dayTaken = {};
  var assigned = [];
  for (var s = 0; s < shuffled.length; s++) {
    var gm = shuffled[s];
    var day = -1;
    for (var dd = 0; dd <= 177 && day < 0; dd++) {
      var hT = dayTaken[gm.home] || [], aT = dayTaken[gm.away] || [];
      if (hT.indexOf(dd) < 0 && aT.indexOf(dd) < 0) day = dd;
    }
    if (day < 0) day = s % 178;
    (dayTaken[gm.home] = dayTaken[gm.home] || []).push(day);
    (dayTaken[gm.away] = dayTaken[gm.away] || []).push(day);
    assigned.push({ home: gm.home, away: gm.away, day: day });
  }

  var schedule = {};
  teams.forEach(function(t) { schedule[t] = []; });
  assigned.forEach(function(g) {
    schedule[g.home].push({ opponent: g.away, home: true, day: g.day });
    schedule[g.away].push({ opponent: g.home, home: false, day: g.day });
  });
  teams.forEach(function(t) {
    schedule[t].sort(function(a, b) { return a.day - b.day; });
    schedule[t].forEach(function(g, idx) { g.gameNum = idx + 1; });
  });
  if (STATE) STATE._eraSchedule = schedule;
  return schedule;
}

/** 给某一支新扩军球队生成时代名单（核心 + 角色球员） */
function buildEraTeamRoster(era, team) {
  if (typeof NBA2K_DATA === 'undefined') return;
  var capRatio = (typeof getEraSalaryCap === 'function') ? getEraSalaryCap(era) / 15464.7 : 1;
  var roster = [];
  // ★ 修复：建队初始就把队伍挂回联盟（先保留原队伍），让补位防重能看到本队已加入的球员，避免同一人反复入队
  if (NBA2K_DATA[team]) roster = NBA2K_DATA[team];
  else NBA2K_DATA[team] = roster;
  var core = (ERA_ROSTERS[era] && ERA_ROSTERS[era][team]) || [];
  core.forEach(function(en) {
    var p = buildEraCorePlayer(era, team, en, capRatio);
    if (p) roster.push(p);
  });
  var usedPos = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  roster.forEach(function(p) {
    var main = String(p.pos || 'SF').split('/')[0].trim();
    if (usedPos[main] != null) usedPos[main]++;
  });
  // 扩张队同样先用独立替补池按队补足；本队无替补时可跨队取用未使用的真实替补（类似扩张选秀，不影响已确定的赛季初名单）
  var _guardF1 = 0;
  while (roster.length < ERA_ROSTER_SIZE && _guardF1++ < 40) {
    var _mnPos = (function() { var _mn='PG',_mc=99; ['PG','SG','SF','PF','C'].forEach(function(pp){ var c=usedPos[pp]||0; if(c<_mc){_mc=c;_mn=pp;} }); return _mn; })();
    var _bch2 = takeEraBenchPlayer(era, _mnPos, team, true) || takeEraBenchPlayer(era, _mnPos, team, false);
    if (!_bch2) break;
    var _bp2 = buildEraRolePlayer(era, team, usedPos, capRatio, null, _bch2);
    if (!_bp2) break;
    roster.push(_bp2);
  }
  var _localSeen = {};
  function _lsSeen(en) {
    var _k = String(en || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (_localSeen[_k]) return true;
    _localSeen[_k] = true;
    return false;
  }
  var _guardF2 = 0;
  while (roster.length < ERA_ROSTER_SIZE && _guardF2++ < 40) {
    var _rp2 = buildEraRolePlayer(era, team, usedPos, capRatio, null);
    if (!_rp2) {
      // ★ 全真实：时代角色池耗尽时，从历史真实球员池补位（绝不产出假人）
      if (typeof generateEraRoleRefill === 'function') {
        var _rf2 = generateEraRoleRefill();
        if (_rf2) {
          // 本地去重：构建中阵容未写回 NBA2K_DATA，防重检查看不到本队，需单独记录已用名字
          if (_lsSeen(_rf2.nameEN)) continue;
          roster.push(_rf2); continue;
        }
      }
      break;
    }
    if (_lsSeen(_rp2.nameEN)) { continue; }
    roster.push(_rp2);
  }
  NBA2K_DATA[team] = roster;
}

/** 历史时代休赛期检查联盟演化：新队加入/球队迁址时生成名单、随队迁移玩家并重建赛程 */
var ERA_RELOCATIONS = { '1984': { CHA: 'NOP' }, '1996': { CHA: 'NOP' }, '2003': {} };
function checkEraExpansion() {
  if (!STATE || STATE.draftMode !== 'historical' || !STATE.eraStart) return;
  var sc = (STATE.career && STATE.career.seasonCount) || 0;
  var now = getEraActiveTeams(String(STATE.eraStart), sc);
  var prev = getEraActiveTeams(String(STATE.eraStart), sc - 1);
  var newcomers = now.filter(function(t) { return prev.indexOf(t) < 0; });
  var removedTeams = prev.filter(function(t) { return now.indexOf(t) < 0; });
  var era = String(STATE.eraStart);
  var yr = (parseInt(STATE.eraStart, 10) || 0) + sc;
  if (!STATE._leagueChanges) STATE._leagueChanges = {};
  // ★ 只保留本年度的新军/迁址记录（防止历史条目累积，导致休赛期公告重复显示往年联盟演变）
  STATE._leagueChanges.expansion = (STATE._leagueChanges.expansion || []).filter(function(e) { return e && e.year === yr; });
  STATE._leagueChanges.relocations = (STATE._leagueChanges.relocations || []).filter(function(r) { return r && r.year === yr; });

  // 先建新入盟球队名单（避免后续覆盖掉迁移过来的玩家对象）
  newcomers.forEach(function(t) {
    buildEraTeamRoster(era, t);
    if (!STATE._leagueChanges.expansion) STATE._leagueChanges.expansion = [];
    // ★ 防重：同一球队同一年不重复登记（避免重复调用 checkEraExpansion 时公告出现重复行）
    var _dupExp = STATE._leagueChanges.expansion.some(function(e) { return e && e.team === t && e.year === yr; });
    if (!_dupExp) STATE._leagueChanges.expansion.push({ team: t, year: yr });
  });

  // ★ 玩家所在球队被移出（如 2002 夏洛特迁至新奥尔良）：随队迁往新队，避免困在无赛程球队
  if (removedTeams.indexOf(STATE.careerTeam) >= 0) {
    var relocMap = ERA_RELOCATIONS[era] || {};
    var replacement = relocMap[STATE.careerTeam] || newcomers[0] || null;
    if (replacement && NBA2K_DATA) {
      var oldRoster = NBA2K_DATA[STATE.careerTeam] || [];
      var userObj = null, ui = -1;
      oldRoster.forEach(function(p, idx) { if (p && p._isUser) { userObj = p; ui = idx; } });
      if (userObj) {
        oldRoster.splice(ui, 1);
        (NBA2K_DATA[replacement] || []).push(userObj);
      }
      if (!STATE._leagueChanges.relocations) STATE._leagueChanges.relocations = [];
      STATE._leagueChanges.relocations.push({ from: STATE.careerTeam, to: replacement, year: yr, userInvolved: true });
      STATE.careerTeam = replacement;
      if (typeof clearLineupCache === 'function') { try { clearLineupCache(); } catch(e) {} }
    }
  }

  // 扩军/迁址后优先接静态赛程；缺静态包时才由下一赛季入口动态重建
  STATE._eraSchedule = null;
  STATE._legendScheduleKey = null;
  if (typeof applyLegendEraStaticSchedule === 'function') {
    try { applyLegendEraStaticSchedule(era, sc); } catch(e) {}
  }

  // 普通移出（如 2002 夏洛特）记录公告（无玩家随队时）
  if (removedTeams.length) {
    removedTeams.forEach(function(rt) {
      if (ERA_RELOCATIONS[era] && ERA_RELOCATIONS[era][rt] && !(STATE._leagueChanges.relocations || []).some(function(r) { return r.from === rt && r.year === yr; })) {
        if (!STATE._leagueChanges.relocations) STATE._leagueChanges.relocations = [];
        STATE._leagueChanges.relocations.push({ from: rt, to: ERA_RELOCATIONS[era][rt], year: yr, userInvolved: false });
      }
    });
  }
}
