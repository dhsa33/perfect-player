/*
 * 真实球星历史分基准表
 *
 * 口径：currentworking.html 中 calculateLegacyResult() 的基础公式。
 * 由于真实球星没有游戏内退役剧情字段，本表不加入最长效力球队、finalShow、
 * farewellHomeTeam、countdownLegend、finalHurt 与退役时 OVR 加成。
 * estimatedCareerPoints = st.pts * st.g，来自参考数据的场均分与出场数，作为基础分估算输入。
 * sourceRank 保留参考百大榜单名次；historicalScore 才是按 current 口径计算的分数。
 */
var HISTORICAL_LEGACY_SCORE_META = {
  version: 'current-legacy-base-v1',
  source: 'pasted-text.txt / 百大球员数据',
  scoreMode: 'base',
  weights: { championships: 18, fmvp: 14, mvp: 16, dpoy: 10, allNBA: 5, allStar: 3, pointsBonusCap: 35, gamesBonusCap: 18 },
  excludedGameOnlyBonuses: ['longestTeam8Years', 'finalOVR94', 'finalShow', 'finalHurt', 'farewellHomeTeam', 'countdownLegend']
};

var HISTORICAL_LEGACY_SCORE_DATA = [
  {
    "rank": 1,
    "name": "迈克尔-乔丹",
    "nameEN": "Michael Jordan",
    "historicalScore": 399,
    "breakdown": {
      "championships": 6,
      "fmvp": 6,
      "mvp": 5,
      "dpoy": 1,
      "allNBA": 11,
      "allStar": 14,
      "pointsBonus": 12,
      "gamesBonus": 8
    },
    "careerGames": 1072,
    "estimatedCareerPoints": 31565
  },
  {
    "rank": 2,
    "name": "勒布朗-詹姆斯",
    "nameEN": "LeBron James",
    "historicalScore": 393,
    "breakdown": {
      "championships": 4,
      "fmvp": 4,
      "mvp": 4,
      "dpoy": 0,
      "allNBA": 21,
      "allStar": 22,
      "pointsBonus": 17,
      "gamesBonus": 13
    },
    "careerGames": 1622,
    "estimatedCareerPoints": 43377
  },
  {
    "rank": 3,
    "name": "卡里姆-阿卜杜尔-贾巴尔",
    "nameEN": "Kareem Abdul-Jabbar",
    "historicalScore": 392,
    "breakdown": {
      "championships": 6,
      "fmvp": 2,
      "mvp": 6,
      "dpoy": 0,
      "allNBA": 15,
      "allStar": 19,
      "pointsBonus": 15,
      "gamesBonus": 13
    },
    "careerGames": 1560,
    "estimatedCareerPoints": 38357
  },
  {
    "rank": 4,
    "name": "比尔-拉塞尔",
    "nameEN": "Bill Russell",
    "historicalScore": 382,
    "breakdown": {
      "championships": 11,
      "fmvp": 0,
      "mvp": 5,
      "dpoy": 0,
      "allNBA": 11,
      "allStar": 12,
      "pointsBonus": 5,
      "gamesBonus": 8
    },
    "careerGames": 963,
    "estimatedCareerPoints": 14556
  },
  {
    "rank": 5,
    "name": "魔术师约翰逊",
    "nameEN": "Magic Johnson",
    "historicalScore": 276,
    "breakdown": {
      "championships": 5,
      "fmvp": 3,
      "mvp": 3,
      "dpoy": 0,
      "allNBA": 10,
      "allStar": 12,
      "pointsBonus": 5,
      "gamesBonus": 5
    },
    "careerGames": 691,
    "estimatedCareerPoints": 13384
  },
  {
    "rank": 6,
    "name": "威尔特-张伯伦",
    "nameEN": "Wilt Chamberlain",
    "historicalScore": 223,
    "breakdown": {
      "championships": 2,
      "fmvp": 1,
      "mvp": 4,
      "dpoy": 0,
      "allNBA": 10,
      "allStar": 13,
      "pointsBonus": 12,
      "gamesBonus": 8
    },
    "careerGames": 1045,
    "estimatedCareerPoints": 31446
  },
  {
    "rank": 7,
    "name": "蒂姆-邓肯",
    "nameEN": "Tim Duncan",
    "historicalScore": 305,
    "breakdown": {
      "championships": 5,
      "fmvp": 3,
      "mvp": 2,
      "dpoy": 0,
      "allNBA": 15,
      "allStar": 15,
      "pointsBonus": 10,
      "gamesBonus": 11
    },
    "careerGames": 1392,
    "estimatedCareerPoints": 26292
  },
  {
    "rank": 8,
    "name": "拉里-伯德",
    "nameEN": "Larry Bird",
    "historicalScore": 231,
    "breakdown": {
      "championships": 3,
      "fmvp": 2,
      "mvp": 3,
      "dpoy": 0,
      "allNBA": 10,
      "allStar": 12,
      "pointsBonus": 8,
      "gamesBonus": 7
    },
    "careerGames": 897,
    "estimatedCareerPoints": 21308
  },
  {
    "rank": 9,
    "name": "沙奎尔-奥尼尔",
    "nameEN": "Shaquille O'Neal",
    "historicalScore": 266,
    "breakdown": {
      "championships": 4,
      "fmvp": 3,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 14,
      "allStar": 15,
      "pointsBonus": 11,
      "gamesBonus": 10
    },
    "careerGames": 1207,
    "estimatedCareerPoints": 27779
  },
  {
    "rank": 10,
    "name": "科比-布莱恩特",
    "nameEN": "Kobe Bryant",
    "historicalScore": 287,
    "breakdown": {
      "championships": 5,
      "fmvp": 2,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 15,
      "allStar": 18,
      "pointsBonus": 13,
      "gamesBonus": 11
    },
    "careerGames": 1346,
    "estimatedCareerPoints": 32583
  },
  {
    "rank": 11,
    "name": "斯蒂芬-库里",
    "nameEN": "Stephen Curry",
    "historicalScore": 227,
    "breakdown": {
      "championships": 4,
      "fmvp": 1,
      "mvp": 2,
      "dpoy": 0,
      "allNBA": 11,
      "allStar": 12,
      "pointsBonus": 10,
      "gamesBonus": 8
    },
    "careerGames": 1069,
    "estimatedCareerPoints": 26140
  },
  {
    "rank": 12,
    "name": "哈基姆-奥拉朱旺",
    "nameEN": "Hakeem Olajuwon",
    "historicalScore": 216,
    "breakdown": {
      "championships": 2,
      "fmvp": 2,
      "mvp": 1,
      "dpoy": 2,
      "allNBA": 12,
      "allStar": 12,
      "pointsBonus": 10,
      "gamesBonus": 10
    },
    "careerGames": 1238,
    "estimatedCareerPoints": 26018
  },
  {
    "rank": 13,
    "name": "凯文-杜兰特",
    "nameEN": "Kevin Durant",
    "historicalScore": 210,
    "breakdown": {
      "championships": 2,
      "fmvp": 2,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 12,
      "allStar": 16,
      "pointsBonus": 12,
      "gamesBonus": 10
    },
    "careerGames": 1201,
    "estimatedCareerPoints": 30904
  },
  {
    "rank": 14,
    "name": "尼古拉-约基奇",
    "nameEN": "Nikola Jokic",
    "historicalScore": 155,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 3,
      "dpoy": 0,
      "allNBA": 8,
      "allStar": 8,
      "pointsBonus": 6,
      "gamesBonus": 5
    },
    "careerGames": 712,
    "estimatedCareerPoints": 15978
  },
  {
    "rank": 15,
    "name": "摩西-马龙",
    "nameEN": "Moses Malone",
    "historicalScore": 178,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 3,
      "dpoy": 0,
      "allNBA": 8,
      "allStar": 12,
      "pointsBonus": 10,
      "gamesBonus": 12
    },
    "careerGames": 1455,
    "estimatedCareerPoints": 26561
  },
  {
    "rank": 16,
    "name": "鲍勃-佩蒂特",
    "nameEN": "Bob Pettit",
    "historicalScore": 152,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 2,
      "dpoy": 0,
      "allNBA": 11,
      "allStar": 11,
      "pointsBonus": 8,
      "gamesBonus": 6
    },
    "careerGames": 792,
    "estimatedCareerPoints": 20732
  },
  {
    "rank": 17,
    "name": "鲍勃-库西",
    "nameEN": "Bob Cousy",
    "historicalScore": 236,
    "breakdown": {
      "championships": 6,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 12,
      "allStar": 13,
      "pointsBonus": 6,
      "gamesBonus": 7
    },
    "careerGames": 924,
    "estimatedCareerPoints": 15972
  },
  {
    "rank": 18,
    "name": "卡尔-马龙",
    "nameEN": "Karl Malone",
    "historicalScore": 170,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 2,
      "dpoy": 0,
      "allNBA": 14,
      "allStar": 14,
      "pointsBonus": 14,
      "gamesBonus": 12
    },
    "careerGames": 1476,
    "estimatedCareerPoints": 36432
  },
  {
    "rank": 19,
    "name": "朱利叶斯-欧文",
    "nameEN": "Julius Erving",
    "historicalScore": 122,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 11,
      "pointsBonus": 10,
      "gamesBonus": 10
    },
    "careerGames": 1243,
    "estimatedCareerPoints": 27111
  },
  {
    "rank": 20,
    "name": "杰里-韦斯特",
    "nameEN": "Jerry West",
    "historicalScore": 150,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 12,
      "allStar": 14,
      "pointsBonus": 9,
      "gamesBonus": 7
    },
    "careerGames": 932,
    "estimatedCareerPoints": 24923
  },
  {
    "rank": 21,
    "name": "德克-诺维茨基",
    "nameEN": "Dirk Nowitzki",
    "historicalScore": 174,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 12,
      "allStar": 14,
      "pointsBonus": 12,
      "gamesBonus": 12
    },
    "careerGames": 1522,
    "estimatedCareerPoints": 30601
  },
  {
    "rank": 22,
    "name": "乔治-麦肯",
    "nameEN": "George Mikan",
    "historicalScore": 120,
    "breakdown": {
      "championships": 4,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 6,
      "allStar": 4,
      "pointsBonus": 3,
      "gamesBonus": 3
    },
    "careerGames": 439,
    "estimatedCareerPoints": 9860
  },
  {
    "rank": 23,
    "name": "约翰-哈夫里切克",
    "nameEN": "John Havlicek",
    "historicalScore": 272,
    "breakdown": {
      "championships": 8,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 11,
      "allStar": 13,
      "pointsBonus": 10,
      "gamesBonus": 10
    },
    "careerGames": 1270,
    "estimatedCareerPoints": 26340
  },
  {
    "rank": 24,
    "name": "扬尼斯-阿德托昆博",
    "nameEN": "Giannis Antetokounmpo",
    "historicalScore": 164,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 2,
      "dpoy": 1,
      "allNBA": 9,
      "allStar": 10,
      "pointsBonus": 8,
      "gamesBonus": 7
    },
    "careerGames": 895,
    "estimatedCareerPoints": 22093
  },
  {
    "rank": 25,
    "name": "大卫-罗宾逊",
    "nameEN": "David Robinson",
    "historicalScore": 158,
    "breakdown": {
      "championships": 2,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 1,
      "allNBA": 10,
      "allStar": 10,
      "pointsBonus": 8,
      "gamesBonus": 8
    },
    "careerGames": 987,
    "estimatedCareerPoints": 20228
  },
  {
    "rank": 26,
    "name": "德维恩-韦德",
    "nameEN": "Dwyane Wade",
    "historicalScore": 164,
    "breakdown": {
      "championships": 3,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 8,
      "allStar": 13,
      "pointsBonus": 9,
      "gamesBonus": 8
    },
    "careerGames": 1054,
    "estimatedCareerPoints": 22999
  },
  {
    "rank": 27,
    "name": "奥斯卡-罗伯特森",
    "nameEN": "Oscar Robertson",
    "historicalScore": 137,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 11,
      "allStar": 10,
      "pointsBonus": 10,
      "gamesBonus": 8
    },
    "careerGames": 1040,
    "estimatedCareerPoints": 26547
  },
  {
    "rank": 28,
    "name": "谢伊-吉尔杰斯-亚历山大",
    "nameEN": "Shai Gilgeous-Alexander",
    "historicalScore": 107,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 2,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 4,
      "pointsBonus": 6,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 15248
  },
  {
    "rank": 29,
    "name": "凯文-加内特",
    "nameEN": "Kevin Garnett",
    "historicalScore": 155,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 1,
      "allNBA": 9,
      "allStar": 15,
      "pointsBonus": 9,
      "gamesBonus": 12
    },
    "careerGames": 1462,
    "estimatedCareerPoints": 24874
  },
  {
    "rank": 30,
    "name": "埃尔金-贝勒",
    "nameEN": "Elgin Baylor",
    "historicalScore": 116,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 10,
      "allStar": 11,
      "pointsBonus": 8,
      "gamesBonus": 7
    },
    "careerGames": 846,
    "estimatedCareerPoints": 21383
  },
  {
    "rank": 31,
    "name": "斯科蒂-皮蓬",
    "nameEN": "Scottie Pippen",
    "historicalScore": 180,
    "breakdown": {
      "championships": 6,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 7,
      "pointsBonus": 7,
      "gamesBonus": 9
    },
    "careerGames": 1178,
    "estimatedCareerPoints": 18288
  },
  {
    "rank": 32,
    "name": "詹姆斯-哈登",
    "nameEN": "James Harden",
    "historicalScore": 110,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 8,
      "allStar": 11,
      "pointsBonus": 11,
      "gamesBonus": 10
    },
    "careerGames": 1221,
    "estimatedCareerPoints": 28223
  },
  {
    "rank": 33,
    "name": "查尔斯-巴克利",
    "nameEN": "Charles Barkley",
    "historicalScore": 121,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 11,
      "allStar": 11,
      "pointsBonus": 9,
      "gamesBonus": 8
    },
    "careerGames": 1073,
    "estimatedCareerPoints": 23153
  },
  {
    "rank": 34,
    "name": "科怀-伦纳德",
    "nameEN": "Kawhi Leonard",
    "historicalScore": 152,
    "breakdown": {
      "championships": 2,
      "fmvp": 2,
      "mvp": 0,
      "dpoy": 2,
      "allNBA": 7,
      "allStar": 7,
      "pointsBonus": 6,
      "gamesBonus": 6
    },
    "careerGames": 798,
    "estimatedCareerPoints": 15287
  },
  {
    "rank": 35,
    "name": "拉塞尔-威斯布鲁克",
    "nameEN": "Russell Westbrook",
    "historicalScore": 108,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 9,
      "allStar": 9,
      "pointsBonus": 10,
      "gamesBonus": 10
    },
    "careerGames": 1301,
    "estimatedCareerPoints": 27236
  },
  {
    "rank": 36,
    "name": "史蒂夫-纳什",
    "nameEN": "Steve Nash",
    "historicalScore": 107,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 2,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 8,
      "pointsBonus": 6,
      "gamesBonus": 10
    },
    "careerGames": 1217,
    "estimatedCareerPoints": 16447
  },
  {
    "rank": 37,
    "name": "克里斯-保罗",
    "nameEN": "Chris Paul",
    "historicalScore": 110,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 11,
      "allStar": 12,
      "pointsBonus": 8,
      "gamesBonus": 11
    },
    "careerGames": 1370,
    "estimatedCareerPoints": 22317
  },
  {
    "rank": 38,
    "name": "伊赛亚-托马斯",
    "nameEN": "Isiah Thomas",
    "historicalScore": 126,
    "breakdown": {
      "championships": 2,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 12,
      "pointsBonus": 7,
      "gamesBonus": 8
    },
    "careerGames": 979,
    "estimatedCareerPoints": 18613
  },
  {
    "rank": 39,
    "name": "阿伦-艾弗森",
    "nameEN": "Allen Iverson",
    "historicalScore": 100,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 11,
      "pointsBonus": 9,
      "gamesBonus": 7
    },
    "careerGames": 914,
    "estimatedCareerPoints": 24115
  },
  {
    "rank": 40,
    "name": "多尔夫-谢伊斯",
    "nameEN": "Dolph Schayes",
    "historicalScore": 129,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 12,
      "allStar": 12,
      "pointsBonus": 7,
      "gamesBonus": 8
    },
    "careerGames": 996,
    "estimatedCareerPoints": 17654
  },
  {
    "rank": 41,
    "name": "约翰-斯托克顿",
    "nameEN": "John Stockton",
    "historicalScore": 104,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 11,
      "allStar": 10,
      "pointsBonus": 7,
      "gamesBonus": 12
    },
    "careerGames": 1504,
    "estimatedCareerPoints": 19645
  },
  {
    "rank": 42,
    "name": "埃尔文-海耶斯",
    "nameEN": "Elvin Hayes",
    "historicalScore": 104,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 6,
      "allStar": 12,
      "pointsBonus": 10,
      "gamesBonus": 10
    },
    "careerGames": 1303,
    "estimatedCareerPoints": 27285
  },
  {
    "rank": 43,
    "name": "杰森-基德",
    "nameEN": "Jason Kidd",
    "historicalScore": 95,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 6,
      "allStar": 10,
      "pointsBonus": 6,
      "gamesBonus": 11
    },
    "careerGames": 1391,
    "estimatedCareerPoints": 17446
  },
  {
    "rank": 44,
    "name": "威利斯-里德",
    "nameEN": "Willis Reed",
    "historicalScore": 135,
    "breakdown": {
      "championships": 2,
      "fmvp": 2,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 7,
      "pointsBonus": 4,
      "gamesBonus": 5
    },
    "careerGames": 650,
    "estimatedCareerPoints": 11428
  },
  {
    "rank": 45,
    "name": "德怀特-霍华德",
    "nameEN": "Dwight Howard",
    "historicalScore": 129,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 3,
      "allNBA": 8,
      "allStar": 8,
      "pointsBonus": 7,
      "gamesBonus": 10
    },
    "careerGames": 1242,
    "estimatedCareerPoints": 19098
  },
  {
    "rank": 46,
    "name": "鲍勃-麦卡杜",
    "nameEN": "Bob McAdoo",
    "historicalScore": 90,
    "breakdown": {
      "championships": 2,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 5,
      "pointsBonus": 6,
      "gamesBonus": 7
    },
    "careerGames": 852,
    "estimatedCareerPoints": 17099
  },
  {
    "rank": 47,
    "name": "克莱德-德雷克斯勒",
    "nameEN": "Clyde Drexler",
    "historicalScore": 90,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 10,
      "pointsBonus": 8,
      "gamesBonus": 9
    },
    "careerGames": 1086,
    "estimatedCareerPoints": 22158
  },
  {
    "rank": 48,
    "name": "保罗-阿里金",
    "nameEN": "Paul Arizin",
    "historicalScore": 79,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 10,
      "pointsBonus": 6,
      "gamesBonus": 5
    },
    "careerGames": 713,
    "estimatedCareerPoints": 16247
  },
  {
    "rank": 49,
    "name": "萨姆-琼斯",
    "nameEN": "Sam Jones",
    "historicalScore": 223,
    "breakdown": {
      "championships": 10,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 3,
      "allStar": 5,
      "pointsBonus": 6,
      "gamesBonus": 7
    },
    "careerGames": 871,
    "estimatedCareerPoints": 15159
  },
  {
    "rank": 50,
    "name": "安东尼-戴维斯",
    "nameEN": "Anthony Davis",
    "historicalScore": 86,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 10,
      "pointsBonus": 7,
      "gamesBonus": 6
    },
    "careerGames": 807,
    "estimatedCareerPoints": 19182
  },
  {
    "rank": 51,
    "name": "沃尔特-弗雷泽",
    "nameEN": "Walt Frazier",
    "historicalScore": 98,
    "breakdown": {
      "championships": 2,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 6,
      "allStar": 7,
      "pointsBonus": 5,
      "gamesBonus": 6
    },
    "careerGames": 825,
    "estimatedCareerPoints": 14104
  },
  {
    "rank": 52,
    "name": "乔治-格文",
    "nameEN": "George Gervin",
    "historicalScore": 81,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 9,
      "pointsBonus": 11,
      "gamesBonus": 8
    },
    "careerGames": 1060,
    "estimatedCareerPoints": 27752
  },
  {
    "rank": 53,
    "name": "帕特里克-尤因",
    "nameEN": "Patrick Ewing",
    "historicalScore": 86,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 11,
      "pointsBonus": 9,
      "gamesBonus": 9
    },
    "careerGames": 1183,
    "estimatedCareerPoints": 24341
  },
  {
    "rank": 54,
    "name": "保罗-皮尔斯",
    "nameEN": "Paul Pierce",
    "historicalScore": 103,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 10,
      "pointsBonus": 10,
      "gamesBonus": 11
    },
    "careerGames": 1343,
    "estimatedCareerPoints": 25410
  },
  {
    "rank": 55,
    "name": "托尼-帕克",
    "nameEN": "Tony Parker",
    "historicalScore": 141,
    "breakdown": {
      "championships": 4,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 6,
      "pointsBonus": 7,
      "gamesBonus": 10
    },
    "careerGames": 1254,
    "estimatedCareerPoints": 19255
  },
  {
    "rank": 56,
    "name": "达米安-利拉德",
    "nameEN": "Damian Lillard",
    "historicalScore": 77,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 9,
      "pointsBonus": 8,
      "gamesBonus": 7
    },
    "careerGames": 900,
    "estimatedCareerPoints": 21191
  },
  {
    "rank": 57,
    "name": "内特-瑟蒙德",
    "nameEN": "Nate Thurmond",
    "historicalScore": 29,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 0,
      "allStar": 7,
      "pointsBonus": 3,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 9076
  },
  {
    "rank": 58,
    "name": "里克-巴里",
    "nameEN": "Rick Barry",
    "historicalScore": 94,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 8,
      "pointsBonus": 7,
      "gamesBonus": 6
    },
    "careerGames": 794,
    "estimatedCareerPoints": 19691
  },
  {
    "rank": 59,
    "name": "戴夫-考恩斯",
    "nameEN": "Dave Cowens",
    "historicalScore": 102,
    "breakdown": {
      "championships": 2,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 3,
      "allStar": 8,
      "pointsBonus": 5,
      "gamesBonus": 6
    },
    "careerGames": 766,
    "estimatedCareerPoints": 13135
  },
  {
    "rank": 60,
    "name": "乔尔-恩比德",
    "nameEN": "Joel Embiid",
    "historicalScore": 73,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 7,
      "pointsBonus": 6,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 16272
  },
  {
    "rank": 61,
    "name": "加里-佩顿",
    "nameEN": "Gary Payton Sr.",
    "historicalScore": 119,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 1,
      "allNBA": 9,
      "allStar": 9,
      "pointsBonus": 8,
      "gamesBonus": 11
    },
    "careerGames": 1335,
    "estimatedCareerPoints": 21853
  },
  {
    "rank": 62,
    "name": "卢卡-东契奇",
    "nameEN": "Luka Doncic",
    "historicalScore": 58,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 6,
      "allStar": 6,
      "pointsBonus": 6,
      "gamesBonus": 4
    },
    "careerGames": 520,
    "estimatedCareerPoints": 15210
  },
  {
    "rank": 63,
    "name": "比尔-沃顿",
    "nameEN": "Bill Walton",
    "historicalScore": 87,
    "breakdown": {
      "championships": 2,
      "fmvp": 1,
      "mvp": 1,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 2,
      "pointsBonus": 2,
      "gamesBonus": 3
    },
    "careerGames": 468,
    "estimatedCareerPoints": 5945
  },
  {
    "rank": 64,
    "name": "比尔-沙曼",
    "nameEN": "Bill Sharman",
    "historicalScore": 140,
    "breakdown": {
      "championships": 4,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 8,
      "pointsBonus": 4,
      "gamesBonus": 5
    },
    "careerGames": 711,
    "estimatedCareerPoints": 12435
  },
  {
    "rank": 65,
    "name": "凯文-麦克海尔",
    "nameEN": "Kevin McHale",
    "historicalScore": 94,
    "breakdown": {
      "championships": 3,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 1,
      "allStar": 7,
      "pointsBonus": 6,
      "gamesBonus": 8
    },
    "careerGames": 971,
    "estimatedCareerPoints": 17360
  },
  {
    "rank": 66,
    "name": "罗伯特-帕里什",
    "nameEN": "Robert Parish",
    "historicalScore": 131,
    "breakdown": {
      "championships": 4,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 9,
      "pointsBonus": 9,
      "gamesBonus": 13
    },
    "careerGames": 1611,
    "estimatedCareerPoints": 22904
  },
  {
    "rank": 67,
    "name": "雷-阿伦",
    "nameEN": "Ray Allen",
    "historicalScore": 95,
    "breakdown": {
      "championships": 2,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 10,
      "pointsBonus": 9,
      "gamesBonus": 10
    },
    "careerGames": 1300,
    "estimatedCareerPoints": 24475
  },
  {
    "rank": 68,
    "name": "特雷西-麦克格雷迪",
    "nameEN": "Tracy McGrady",
    "historicalScore": 69,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 7,
      "pointsBonus": 6,
      "gamesBonus": 7
    },
    "careerGames": 938,
    "estimatedCareerPoints": 17046
  },
  {
    "rank": 69,
    "name": "多米尼克-威尔金斯",
    "nameEN": "Dominique Wilkins",
    "historicalScore": 80,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 9,
      "pointsBonus": 10,
      "gamesBonus": 8
    },
    "careerGames": 1074,
    "estimatedCareerPoints": 25687
  },
  {
    "rank": 70,
    "name": "雷吉-米勒",
    "nameEN": "Reggie Miller",
    "historicalScore": 51,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 3,
      "allStar": 5,
      "pointsBonus": 10,
      "gamesBonus": 11
    },
    "careerGames": 1389,
    "estimatedCareerPoints": 25160
  },
  {
    "rank": 71,
    "name": "杰森-塔图姆",
    "nameEN": "Jayson Tatum",
    "historicalScore": 72,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 6,
      "pointsBonus": 6,
      "gamesBonus": 5
    },
    "careerGames": 650,
    "estimatedCareerPoints": 15304
  },
  {
    "rank": 72,
    "name": "卡梅罗-安东尼",
    "nameEN": "Carmelo Anthony",
    "historicalScore": 81,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 6,
      "allStar": 10,
      "pointsBonus": 11,
      "gamesBonus": 10
    },
    "careerGames": 1260,
    "estimatedCareerPoints": 27714
  },
  {
    "rank": 73,
    "name": "汤姆-海因索恩",
    "nameEN": "Tom Heinsohn",
    "historicalScore": 191,
    "breakdown": {
      "championships": 8,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 6,
      "pointsBonus": 4,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 11134
  },
  {
    "rank": 74,
    "name": "詹姆斯-沃西",
    "nameEN": "James Worthy",
    "historicalScore": 112,
    "breakdown": {
      "championships": 3,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 7,
      "pointsBonus": 6,
      "gamesBonus": 7
    },
    "careerGames": 926,
    "estimatedCareerPoints": 16298
  },
  {
    "rank": 75,
    "name": "丹尼斯-约翰逊",
    "nameEN": "Dennis Johnson",
    "historicalScore": 93,
    "breakdown": {
      "championships": 3,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 5,
      "pointsBonus": 0,
      "gamesBonus": 0
    },
    "careerGames": 5,
    "estimatedCareerPoints": 70
  },
  {
    "rank": 76,
    "name": "吉米-巴特勒",
    "nameEN": "Jimmy Butler",
    "historicalScore": 52,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 6,
      "pointsBonus": 4,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 11044
  },
  {
    "rank": 77,
    "name": "保罗-加索尔",
    "nameEN": "Pau Gasol",
    "historicalScore": 91,
    "breakdown": {
      "championships": 2,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 6,
      "pointsBonus": 7,
      "gamesBonus": 10
    },
    "careerGames": 1226,
    "estimatedCareerPoints": 19245
  },
  {
    "rank": 78,
    "name": "昌西-比卢普斯",
    "nameEN": "Chauncey Billups",
    "historicalScore": 75,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 3,
      "allStar": 5,
      "pointsBonus": 5,
      "gamesBonus": 8
    },
    "careerGames": 1043,
    "estimatedCareerPoints": 14293
  },
  {
    "rank": 79,
    "name": "内特-阿奇博尔德",
    "nameEN": "Nate Archibald",
    "historicalScore": 61,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 6,
      "pointsBonus": 0,
      "gamesBonus": 0
    },
    "careerGames": 0,
    "estimatedCareerPoints": 0
  },
  {
    "rank": 80,
    "name": "杰里-卢卡斯",
    "nameEN": "Jerry Lucas",
    "historicalScore": 75,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 7,
      "pointsBonus": 5,
      "gamesBonus": 6
    },
    "careerGames": 829,
    "estimatedCareerPoints": 13961
  },
  {
    "rank": 81,
    "name": "凯里-欧文",
    "nameEN": "Kyrie Irving",
    "historicalScore": 72,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 3,
      "allStar": 9,
      "pointsBonus": 6,
      "gamesBonus": 6
    },
    "careerGames": 779,
    "estimatedCareerPoints": 17431
  },
  {
    "rank": 82,
    "name": "比利-坎宁安",
    "nameEN": "Billy Cunningham",
    "historicalScore": 59,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 4,
      "pointsBonus": 4,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 12134
  },
  {
    "rank": 83,
    "name": "丹尼斯-罗德曼",
    "nameEN": "Dennis Rodman",
    "historicalScore": 135,
    "breakdown": {
      "championships": 5,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 2,
      "allNBA": 2,
      "allStar": 2,
      "pointsBonus": 2,
      "gamesBonus": 7
    },
    "careerGames": 911,
    "estimatedCareerPoints": 6111
  },
  {
    "rank": 84,
    "name": "阿尔提斯-吉尔摩尔",
    "nameEN": "Artis Gilmore",
    "historicalScore": 38,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 0,
      "allStar": 6,
      "pointsBonus": 9,
      "gamesBonus": 11
    },
    "careerGames": 1329,
    "estimatedCareerPoints": 22561
  },
  {
    "rank": 85,
    "name": "阿隆佐-莫宁",
    "nameEN": "Alonzo Mourning",
    "historicalScore": 80,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 2,
      "allNBA": 2,
      "allStar": 7,
      "pointsBonus": 5,
      "gamesBonus": 6
    },
    "careerGames": 838,
    "estimatedCareerPoints": 13295
  },
  {
    "rank": 86,
    "name": "德雷蒙德-格林",
    "nameEN": "Draymond Green",
    "historicalScore": 111,
    "breakdown": {
      "championships": 4,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 1,
      "allNBA": 2,
      "allStar": 4,
      "pointsBonus": 2,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 5157
  },
  {
    "rank": 87,
    "name": "本-华莱士",
    "nameEN": "Ben Wallace",
    "historicalScore": 101,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 4,
      "allNBA": 5,
      "allStar": 4,
      "pointsBonus": 1,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 3252
  },
  {
    "rank": 88,
    "name": "马努-吉诺比利",
    "nameEN": "Manu Ginobili",
    "historicalScore": 101,
    "breakdown": {
      "championships": 4,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 2,
      "pointsBonus": 5,
      "gamesBonus": 8
    },
    "careerGames": 1057,
    "estimatedCareerPoints": 13908
  },
  {
    "rank": 89,
    "name": "哈尔-格里尔",
    "nameEN": "Hal Greer",
    "historicalScore": 100,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 7,
      "allStar": 10,
      "pointsBonus": 8,
      "gamesBonus": 9
    },
    "careerGames": 1122,
    "estimatedCareerPoints": 20934
  },
  {
    "rank": 90,
    "name": "克莱-汤普森",
    "nameEN": "Klay Thompson",
    "historicalScore": 110,
    "breakdown": {
      "championships": 4,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 5,
      "pointsBonus": 6,
      "gamesBonus": 7
    },
    "careerGames": 934,
    "estimatedCareerPoints": 15004
  },
  {
    "rank": 91,
    "name": "凯文-约翰逊",
    "nameEN": "Kevin Johnson",
    "historicalScore": 42,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 3,
      "pointsBonus": 3,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 9939
  },
  {
    "rank": 92,
    "name": "伯纳德-金",
    "nameEN": "Bernard King",
    "historicalScore": 46,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 4,
      "pointsBonus": 7,
      "gamesBonus": 7
    },
    "careerGames": 874,
    "estimatedCareerPoints": 18694
  },
  {
    "rank": 93,
    "name": "保罗-乔治",
    "nameEN": "Paul George",
    "historicalScore": 71,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 6,
      "allStar": 9,
      "pointsBonus": 7,
      "gamesBonus": 7
    },
    "careerGames": 945,
    "estimatedCareerPoints": 18522
  },
  {
    "rank": 94,
    "name": "杰伦-布伦森",
    "nameEN": "Jalen Brunson",
    "historicalScore": 64,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 3,
      "allStar": 3,
      "pointsBonus": 4,
      "gamesBonus": 4
    },
    "careerGames": 570,
    "estimatedCareerPoints": 10766
  },
  {
    "rank": 95,
    "name": "杰伦-布朗",
    "nameEN": "Jaylen Brown",
    "historicalScore": 67,
    "breakdown": {
      "championships": 1,
      "fmvp": 1,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 2,
      "allStar": 5,
      "pointsBonus": 5,
      "gamesBonus": 5
    },
    "careerGames": 700,
    "estimatedCareerPoints": 14224
  },
  {
    "rank": 96,
    "name": "乔-福尔克斯",
    "nameEN": "Joe Fulks",
    "historicalScore": 53,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 2,
      "pointsBonus": 4,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 10020
  },
  {
    "rank": 97,
    "name": "艾德-麦考利",
    "nameEN": "Ed Macauley",
    "historicalScore": 67,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 7,
      "pointsBonus": 3,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 9913
  },
  {
    "rank": 98,
    "name": "阿马雷-斯塔德迈尔",
    "nameEN": "Amar\\",
    "historicalScore": 52,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 5,
      "allStar": 6,
      "pointsBonus": 4,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 10521
  },
  {
    "rank": 99,
    "name": "维克托-文班亚马",
    "nameEN": "Victor Wembanyama",
    "historicalScore": 24,
    "breakdown": {
      "championships": 0,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 1,
      "allNBA": 1,
      "allStar": 2,
      "pointsBonus": 2,
      "gamesBonus": 1
    },
    "careerGames": 230,
    "estimatedCareerPoints": 5420
  },
  {
    "rank": 100,
    "name": "尼尔-约翰斯顿",
    "nameEN": "Neil Johnston",
    "historicalScore": 63,
    "breakdown": {
      "championships": 1,
      "fmvp": 0,
      "mvp": 0,
      "dpoy": 0,
      "allNBA": 4,
      "allStar": 6,
      "pointsBonus": 2,
      "gamesBonus": 5
    },
    "careerGames": 600,
    "estimatedCareerPoints": 7200
  }
];

function getHistoricalLegacyScore(playerOrRank) {
  var key = typeof playerOrRank === 'object' ? playerOrRank : null;
  var rank = key ? key.rank : parseInt(playerOrRank, 10);
  var name = key ? (key.name || key.n) : String(playerOrRank || '');
  return HISTORICAL_LEGACY_SCORE_DATA.find(function (p) {
    return (rank && p.rank === rank) || p.name === name || p.nameEN === name;
  }) || null;
}

function getHistoricalLegacyTargets(score, limit) {
  var current = Number(score) || 0;
  var count = Math.max(1, Number(limit) || 3);
  return HISTORICAL_LEGACY_SCORE_DATA
    .filter(function (p) { return p.historicalScore > current; })
    .sort(function (a, b) { return a.historicalScore - b.historicalScore || a.rank - b.rank; })
    .slice(0, count)
    .map(function (p) { return { rank: p.rank, name: p.name, historicalScore: p.historicalScore, gap: p.historicalScore - current }; });
}

if (typeof window !== 'undefined') {
  window.HISTORICAL_LEGACY_SCORE_META = HISTORICAL_LEGACY_SCORE_META;
  window.HISTORICAL_LEGACY_SCORE_DATA = HISTORICAL_LEGACY_SCORE_DATA;
  window.getHistoricalLegacyScore = getHistoricalLegacyScore;
  window.getHistoricalLegacyTargets = getHistoricalLegacyTargets;
}
