"""Generate hidden-challenge legend rosters from hupu peak data (draft only)."""
import json
import os
import re

ATTR_KEYS = [
    "threePT", "MID", "FIN", "DNK", "HAN", "PAS", "PDEF", "IDEF", "BLK", "REB", "ATH", "STR", "CLU",
]
OVR_WEIGHTS = {
    "PG": {"threePT": 0.10, "MID": 0.10, "FIN": 0.08, "DNK": 0.04, "HAN": 0.14, "PAS": 0.14,
           "PDEF": 0.10, "IDEF": 0.04, "BLK": 0.02, "REB": 0.04, "ATH": 0.08, "STR": 0.04, "CLU": 0.08},
    "SG": {"threePT": 0.12, "MID": 0.12, "FIN": 0.10, "DNK": 0.06, "HAN": 0.10, "PAS": 0.08,
           "PDEF": 0.10, "IDEF": 0.04, "BLK": 0.02, "REB": 0.04, "ATH": 0.08, "STR": 0.04, "CLU": 0.10},
    "SF": {"threePT": 0.10, "MID": 0.10, "FIN": 0.10, "DNK": 0.08, "HAN": 0.08, "PAS": 0.06,
           "PDEF": 0.10, "IDEF": 0.08, "BLK": 0.04, "REB": 0.06, "ATH": 0.08, "STR": 0.06, "CLU": 0.06},
    "PF": {"threePT": 0.08, "MID": 0.06, "FIN": 0.12, "DNK": 0.06, "HAN": 0.06, "PAS": 0.04,
           "PDEF": 0.10, "IDEF": 0.12, "BLK": 0.08, "REB": 0.10, "ATH": 0.06, "STR": 0.08, "CLU": 0.04},
    "C":  {"threePT": 0.04, "MID": 0.04, "FIN": 0.14, "DNK": 0.06, "HAN": 0.04, "PAS": 0.04,
           "PDEF": 0.08, "IDEF": 0.14, "BLK": 0.12, "REB": 0.12, "ATH": 0.04, "STR": 0.10, "CLU": 0.04},
}
POS_AVG = {
    "PG": {"threePT": 79.2, "MID": 79.5, "FIN": 82.5, "DNK": 57.9, "HAN": 85.2, "PAS": 79.4,
           "PDEF": 69.5, "IDEF": 42.0, "BLK": 44.6, "REB": 52.2, "ATH": 82.1, "STR": 50.7, "CLU": 73.6},
    "SG": {"threePT": 79.8, "MID": 77.2, "FIN": 82.5, "DNK": 71.3, "HAN": 83.0, "PAS": 71.7,
           "PDEF": 69.6, "IDEF": 48.3, "BLK": 45.5, "REB": 51.9, "ATH": 79.6, "STR": 53.7, "CLU": 70.5},
    "SF": {"threePT": 78.4, "MID": 75.6, "FIN": 82.5, "DNK": 73.5, "HAN": 82.8, "PAS": 65.2,
           "PDEF": 71.1, "IDEF": 58.7, "BLK": 50.5, "REB": 57.3, "ATH": 77.3, "STR": 58.2, "CLU": 62.5},
    "PF": {"threePT": 76.2, "MID": 71.4, "FIN": 83.4, "DNK": 75.8, "HAN": 83.4, "PAS": 62.4,
           "PDEF": 67.6, "IDEF": 68.1, "BLK": 59.7, "REB": 66.4, "ATH": 73.7, "STR": 66.4, "CLU": 71.1},
    "C":  {"threePT": 62.4, "MID": 70.7, "FIN": 86.4, "DNK": 73.2, "HAN": 80.3, "PAS": 53.0,
           "PDEF": 50.8, "IDEF": 72.8, "BLK": 72.7, "REB": 77.0, "ATH": 59.4, "STR": 74.7, "CLU": 64.9},
}
POS_CODE = {1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C"}
NAME_ALIASES = {
    "Magic Johnson": ["Magic Johnson", "Earvin Johnson"],
}

ROOT = os.path.join(os.path.dirname(__file__), "..")
HUPU_HIST = os.path.join(ROOT, "assets", "data", "historical", "hupu-historical-players.json")
HUPU_CACHE = os.path.join(os.path.dirname(__file__), "_hupu-ai-app.html")
POOL_PATH = os.path.join(ROOT, "assets", "data", "perfect-player-pool.json")
NBA2K_PATH = os.path.join(ROOT, "assets", "js", "hupu", "script-01-2678-5hu3djrc-upload-1783494754597-12.js")


def norm(s):
    return "".join(ch for ch in (s or "").lower() if ch.isalnum() or ch == " ").strip()


def soft_cap99(value):
    v = float(value)
    if v <= 99:
        return v
    return 99 + (v - 99) * 0.5


def calc_ovr(attrs, pos):
    weights = OVR_WEIGHTS.get(pos) or OVR_WEIGHTS["SF"]
    total = 0.0
    for key in ATTR_KEYS:
        w = weights.get(key, 0.07)
        total += soft_cap99(attrs.get(key, 50)) * w
    return int(round(total))


def primary_pos(pos_label):
    return (pos_label or "SF").split("/")[0].strip()


def parse_attrs_blob(blob):
    attrs = {}
    for am in re.finditer(
        r"(threePT|MID|FIN|DNK|HAN|PAS|PDEF|IDEF|BLK|REB|ATH|STR|CLU):\s*(\d+)",
        blob,
    ):
        attrs[am.group(1)] = int(am.group(2))
    return attrs


def attrs_from_pos_profile(pos, target_ovr):
    pos = pos if pos in POS_AVG else "SF"
    profile = POS_AVG[pos]
    base_attrs = {k: int(round(profile[k])) for k in ATTR_KEYS}
    base_ovr = calc_ovr(base_attrs, pos)
    if base_ovr <= 0:
        scale = 1.0
    else:
        scale = target_ovr / base_ovr
    attrs = {}
    for k in ATTR_KEYS:
        attrs[k] = int(max(25, min(99, round(profile[k] * scale))))
    attrs["CLU"] = int(max(25, min(99, target_ovr)))
    return attrs


def average(a, b):
    return round(((float(a or 50) + float(b or 50)) / 2))


def clamp(v, lo, hi):
    return max(lo, min(hi, int(round(v))))


def convert_pool(card):
    raw = card.get("attrs") or {}
    rating = int(card.get("rating") or 70)
    star = float(card.get("starScore") or 0)
    clutch = min(8, round(star / 35))
    return {
        "threePT": clamp(raw.get("shotExt"), 35, 99),
        "MID": clamp(raw.get("shotInt"), 35, 99),
        "FIN": clamp(average(raw.get("shotInt"), raw.get("physique")), 35, 99),
        "DNK": clamp(average(raw.get("shotInt"), raw.get("strength")), 35, 99),
        "HAN": clamp(average(raw.get("pass"), raw.get("speed")), 35, 99),
        "PAS": clamp(raw.get("pass"), 35, 99),
        "PDEF": clamp(average(raw.get("stl"), raw.get("speed")), 35, 99),
        "IDEF": clamp(average(raw.get("blk"), raw.get("reb")), 35, 99),
        "BLK": clamp(raw.get("blk"), 35, 99),
        "REB": clamp(raw.get("reb"), 35, 99),
        "ATH": clamp(average(raw.get("speed"), raw.get("physique")), 35, 99),
        "STR": clamp(raw.get("strength"), 35, 99),
        "CLU": clamp(rating + clutch, 35, 99),
    }, rating


class DataIndex:
    def __init__(self):
        self.best = {}

    def offer(self, name_en, attrs, ovr, source, name_cn=None, pos=None, score=0):
        key = norm(name_en)
        if not key:
            return
        if not attrs or len(attrs) < 13:
            return
        prev = self.best.get(key)
        if prev and prev["score"] >= score:
            return
        self.best[key] = {
            "score": score,
            "nameEn": name_en,
            "nameCn": name_cn,
            "pos": pos,
            "attrs": {k: int(attrs[k]) for k in ATTR_KEYS},
            "ovr": int(ovr),
            "source": source,
        }

    def lookup(self, name_en):
        names = NAME_ALIASES.get(name_en, [name_en])
        for n in names:
            hit = self.best.get(norm(n))
            if hit:
                return hit
        return self.best.get(norm(name_en))


def draft_ovr_from_chunk(chunk):
    pot = re.search(r"_potential:\s*(\d+)", chunk)
    if pot:
        return int(pot.group(1))
    ovr_m = re.search(r"ovr:\s*(\d+)", chunk)
    if ovr_m:
        return int(ovr_m.group(1))
    pick_m = re.search(r"pick:\s*(\d+)", chunk)
    if pick_m:
        pick = int(pick_m.group(1))
        if pick <= 3:
            return 81
        if pick <= 8:
            return 80
        if pick <= 15:
            return 79
        if pick <= 22:
            return 78
        if pick <= 30:
            return 77
        if pick <= 40:
            return 75
        if pick <= 50:
            return 73
        if pick <= 60:
            return 71
        if pick <= 80:
            return 70
        if pick <= 110:
            return 69
        return 68
    return 0


# 虎扑选秀/历史表未收录的阵容成员：按巅峰赛季估计展示 OVR（属性仍按位置模板缩放）
MANUAL_PEAK_OVR = {
    "Luc Longley": 76,
    "Toni Kukoc": 80,
    "Steve Kerr": 82,
    "Bill Wennington": 70,
    "Jud Buechler": 68,
    "Dickey Simpkins": 66,
    "Zaza Pachulia": 70,
    "Shaun Livingston": 78,
    "JaVale McGee": 74,
    "Patrick McCaw": 72,
    "Robert Parish": 88,
    "Dennis Johnson": 86,
    "Danny Ainge": 78,
    "Scott Wedman": 76,
    "Jerry Sichting": 70,
    "Rick Carlisle": 74,
    "Sam Vincent": 72,
    "Rick Fox": 78,
    "Brian Shaw": 76,
    "Tyronn Lue": 74,
    "Mike Penberthy": 70,
    "Devean George": 72,
    "James Worthy": 90,
    "Byron Scott": 80,
    "A.C. Green": 78,
    "Michael Cooper": 82,
    "Mychal Thompson": 76,
    "Kurt Rambis": 72,
    "Wes Matthews": 74,
    "Adrian Branch": 68,
}

# 人工校正展示 OVR（保留原属性结构，按比例微调属性）
OVR_OVERRIDE = {
    "Zaza Pachulia": 85,
    "Klay Thompson": 91,
    "Draymond Green": 88,
    "David West": 85,
    "Andre Iguodala": 86,
    "Bill Walton": 85,
}


def scale_attrs_toward_ovr(attrs, pos, target_ovr):
    current = calc_ovr(attrs, pos)
    if current <= 0:
        return attrs_from_pos_profile(pos, target_ovr)
    scale = target_ovr / current
    out = {}
    for key in ATTR_KEYS:
        out[key] = int(max(25, min(99, round(attrs.get(key, 50) * scale))))
    out["CLU"] = int(max(25, min(99, target_ovr)))
    return out


def build_index():
    idx = DataIndex()

    if os.path.isfile(HUPU_HIST):
        data = json.load(open(HUPU_HIST, encoding="utf-8"))
        for p in data.get("players", []):
            idx.offer(
                p["nameEn"],
                p.get("attrs"),
                p.get("ovr"),
                "hupu_historical_players",
                p.get("nameCn"),
                p.get("pos"),
                10000 + int(p.get("ovr") or 0),
            )

    if os.path.isfile(HUPU_CACHE):
        html = open(HUPU_CACHE, encoding="utf-8").read()
        for line in html.splitlines():
            if "en:" not in line or "pick:" not in line:
                continue
            en_m = re.search(r"en:\s*'([^']+)'", line)
            cn_m = re.search(r"cn:\s*'([^']+)'", line)
            pos_m = re.search(r"pos:\s*'([^']+)'", line)
            if not en_m:
                continue
            en = en_m.group(1)
            cn = cn_m.group(1) if cn_m else en
            pos = pos_m.group(1) if pos_m else "SF"
            if "attrs:" in line:
                blob_m = re.search(r"attrs:\s*\{([^}]+)\}", line)
                if not blob_m:
                    continue
                attrs = parse_attrs_blob(blob_m.group(1))
                if len(attrs) != 13:
                    continue
                ovr = draft_ovr_from_chunk(line)
                idx.offer(en, attrs, ovr, "hupu_draft_attrs", cn.replace("-", "·"), pos, 7000 + ovr)
            else:
                ovr = draft_ovr_from_chunk(line)
                if ovr < 60:
                    continue
                ppos = primary_pos(pos)
                attrs = attrs_from_pos_profile(ppos, ovr)
                idx.offer(en, attrs, ovr, "hupu_draft_potential", cn.replace("-", "·"), pos, 4000 + ovr)

    if os.path.isfile(POOL_PATH):
        pool = json.load(open(POOL_PATH, encoding="utf-8"))
        pool_best = {}
        for team in pool.get("teams", {}).values():
            for card in list(team.get("players", [])) + list(team.get("historicalPlayers", [])):
                for field in ["nameEn", "altName"]:
                    n = norm(card.get(field))
                    if not n:
                        continue
                    src = card.get("source") or {}
                    is_hist = src.get("kind") != "current" or card.get("historicalPeak")
                    rating = int(card.get("rating") or 0)
                    if card.get("historicalPeak"):
                        score = 6000 + rating
                    elif is_hist:
                        score = 4500 + rating
                    else:
                        score = 1000 + rating
                    prev = pool_best.get(n)
                    if not prev or score > prev["score"]:
                        pool_best[n] = {"score": score, "card": card}
        for n, pb in pool_best.items():
            card = pb["card"]
            attrs, rating = convert_pool(card)
            pos = POS_CODE.get(card.get("pos"), "SF")
            pos2 = POS_CODE.get(card.get("pos2"))
            pos_str = pos + (f" / {pos2}" if pos2 and pos2 != pos else "")
            idx.offer(
                card.get("nameEn") or card.get("altName"),
                attrs,
                rating,
                "pool_peak",
                (card.get("nameCn") or card.get("name") or "").replace("-", "·"),
                pos_str,
                pb["score"],
            )

    if os.path.isfile(NBA2K_PATH):
        text = open(NBA2K_PATH, encoding="utf-8").read()
        for em in re.finditer(
            r'"name":\s*"([^"]+)"[^}]*?"ovr":\s*(\d+)(.*?)\}',
            text,
            re.DOTALL,
        ):
            en = em.group(1)
            ovr = int(em.group(2))
            blob = em.group(3)
            attrs = {}
            for am in re.finditer(
                r'"(threePT|MID|FIN|DNK|HAN|PAS|PDEF|IDEF|BLK|REB|ATH|STR|CLU)":\s*(\d+)',
                blob,
            ):
                attrs[am.group(1)] = int(am.group(2))
            if len(attrs) != 13:
                continue
            cname_m = re.search(r'"cname":\s*"([^"]+)"', blob)
            pos_m = re.search(r'"pos":\s*"([^"]+)"', blob)
            idx.offer(
                en,
                attrs,
                ovr,
                "nba2k_current",
                (cname_m.group(1) if cname_m else "").replace("-", "·"),
                pos_m.group(1) if pos_m else None,
                1000 + ovr,
            )

    for name_en, ovr in MANUAL_PEAK_OVR.items():
        attrs = attrs_from_pos_profile("SF", ovr)
        idx.offer(name_en, attrs, ovr, "manual_peak_estimate", None, "SF", 500 + ovr)

    return idx


ROSTER_META = [
    {
        "id": "chi-1995-96",
        "label": "1995-96 芝加哥公牛",
        "teamId": 6,
        "players": [
            ("local:michaeljordan", "迈克尔·乔丹", "Michael Jordan", 2, 3),
            ("local:scottiepippen", "斯科蒂·皮蓬", "Scottie Pippen", 3, 4),
            ("local:dennisrodman", "丹尼斯·罗德曼", "Dennis Rodman", 4, 0),
            ("local:ronharper", "罗恩·哈珀", "Ron Harper", 2, 1),
            ("local:luclongley", "卢克·朗利", "Luc Longley", 5, 0),
            ("local:tonikukoc", "托尼·库科奇", "Toni Kukoc", 3, 1),
            ("local:stevekerr", "史蒂夫·科尔", "Steve Kerr", 1, 0),
            ("local:billwennington", "比尔·温宁顿", "Bill Wennington", 5, 0),
            ("local:judbuechler", "贾德·布伊奇勒", "Jud Buechler", 3, 0),
            ("local:dickeysimpkins", "迪基·辛普金斯", "Dickey Simpkins", 4, 5),
        ],
    },
    {
        "id": "gsw-2016-17",
        "label": "2016-17 金州勇士",
        "teamId": 21,
        "players": [
            ("local:stephencurry", "斯蒂芬·库里", "Stephen Curry", 1, 0),
            ("local:kevindurant", "凯文·杜兰特", "Kevin Durant", 3, 4),
            ("local:klaythompson", "克莱·汤普森", "Klay Thompson", 2, 0),
            ("local:draymondgreen", "德雷蒙德·格林", "Draymond Green", 4, 0),
            ("local:zazapachulia", "扎扎·帕楚里亚", "Zaza Pachulia", 5, 0),
            ("local:andreiguodala", "安德烈·伊戈达拉", "Andre Iguodala", 3, 2),
            ("local:shaunlivingston", "肖恩·利文斯顿", "Shaun Livingston", 1, 0),
            ("local:davidwest", "大卫·韦斯特", "David West", 4, 5),
            ("local:javalemcgee", "贾维尔·麦基", "JaVale McGee", 5, 0),
            ("local:patrickmcaw", "帕特里克·麦考", "Patrick McCaw", 2, 3),
        ],
    },
    {
        "id": "bos-1985-86",
        "label": "1985-86 波士顿凯尔特人",
        "teamId": 1,
        "players": [
            ("local:larrybird", "拉里·伯德", "Larry Bird", 3, 4),
            ("local:kevinmchale", "凯文·麦克海尔", "Kevin McHale", 4, 5),
            ("local:robertparish", "罗伯特·帕里什", "Robert Parish", 5, 0),
            ("local:dennisjohnson", "丹尼斯·约翰逊", "Dennis Johnson", 2, 1),
            ("local:dannyainge", "丹尼·安吉", "Danny Ainge", 2, 1),
            ("local:billwalton", "比尔·沃顿", "Bill Walton", 5, 0),
            ("local:scottwedman", "斯科特·韦德曼", "Scott Wedman", 3, 2),
            ("local:jerrysichting", "杰里·希廷", "Jerry Sichting", 1, 0),
            ("local:rickcarlisle", "里克·卡莱尔", "Rick Carlisle", 1, 2),
            ("local:samvincent", "萨姆·文森特", "Sam Vincent", 1, 0),
        ],
    },
    {
        "id": "lal-2000-01",
        "label": "2000-01 洛杉矶湖人",
        "teamId": 23,
        "players": [
            ("local:shaquilleoneal", "沙奎尔·奥尼尔", "Shaquille O'Neal", 5, 0),
            ("local:kobebryant", "科比·布莱恩特", "Kobe Bryant", 2, 1),
            ("local:derekfisher", "德里克·费舍尔", "Derek Fisher", 1, 0),
            ("local:horacegrant", "霍雷斯·格兰特", "Horace Grant", 4, 0),
            ("local:rickfox", "里克·福克斯", "Rick Fox", 3, 0),
            ("local:roberthorry", "罗伯特·霍里", "Robert Horry", 4, 3),
            ("local:brianshaw", "布莱恩·肖", "Brian Shaw", 1, 2),
            ("local:tyronnlue", "泰伦·卢", "Tyronn Lue", 1, 0),
            ("local:mikepenberthy", "迈克·彭伯西", "Mike Penberthy", 2, 0),
            ("local:deveangeorge", "德维恩·乔治", "Devean George", 3, 0),
        ],
    },
    {
        "id": "lal-1986-87",
        "label": "1986-87 洛杉矶湖人",
        "teamId": 23,
        "players": [
            ("local:earvinjohnson", "魔术师约翰逊", "Magic Johnson", 1, 0),
            ("local:kareemabduljabbar", "卡里姆·阿卜杜尔-贾巴尔", "Kareem Abdul-Jabbar", 5, 0),
            ("local:jamesworthy", "詹姆斯·沃西", "James Worthy", 3, 0),
            ("local:byronscott", "拜伦·斯科特", "Byron Scott", 2, 1),
            ("local:acgreen", "A.C.格林", "A.C. Green", 4, 0),
            ("local:michaelcooper", "迈克尔·库珀", "Michael Cooper", 2, 1),
            ("local:mychalthompson", "迈克尔·汤普森", "Mychal Thompson", 4, 5),
            ("local:kurtrambis", "库尔特·兰比斯", "Kurt Rambis", 4, 0),
            ("local:wesmatthews", "韦斯·马修斯", "Wes Matthews", 2, 1),
            ("local:adrianbranch", "阿德里安·布兰奇", "Adrian Branch", 3, 0),
        ],
    },
]


def build_player(identity, name_cn, name_en, pos_code, pos2_code, idx):
    pos_str = POS_CODE[pos_code]
    hit = idx.lookup(name_en)
    if not hit:
        raise ValueError(f"No hupu/pool data for {name_en}")
    if hit["source"] == "manual_peak_estimate":
        attrs = attrs_from_pos_profile(pos_str, hit["ovr"])
    else:
        attrs = hit["attrs"]
    ovr = hit["ovr"]
    note = f"attrs:{hit['source']}"
    if name_en in OVR_OVERRIDE:
        target = OVR_OVERRIDE[name_en]
        attrs = scale_attrs_toward_ovr(attrs, pos_str, target)
        ovr = target
        note = f"ovr_override:{target}; {note}"
    return {
        "identity": identity,
        "nameCn": name_cn or hit.get("nameCn") or name_en,
        "nameEn": name_en,
        "pos": pos_str,
        "posCode": pos_code,
        "pos2Code": pos2_code or 0,
        "attrs": attrs,
        "ovr": ovr,
        "calcOvr": calc_ovr(attrs, pos_str),
        "attrSource": hit["source"],
        "note": note,
    }


def main():
    idx = build_index()
    teams = []
    errors = []
    for meta in ROSTER_META:
        players = []
        for identity, cn, en, pos, pos2 in meta["players"]:
            try:
                players.append(build_player(identity, cn, en, pos, pos2, idx))
            except ValueError as e:
                errors.append(str(e))
        teams.append(
            {
                "id": meta["id"],
                "label": meta["label"],
                "teamId": meta["teamId"],
                "players": players,
            }
        )
    if errors:
        raise SystemExit("Missing data:\n" + "\n".join(errors))

    out = {
        "version": 3,
        "status": "draft",
        "wiredToGame": False,
        "purpose": "hidden_challenge",
        "description": (
            "隐藏挑战专用传奇阵容。属性与展示 OVR 来自虎扑完美球员 HISTORICAL_PLAYERS / "
            "选秀巅峰数据，辅以 pool 巅峰与 NBA2K 现役卡；不参与生涯模式。"
        ),
        "schema": {
            "attrs": ATTR_KEYS,
            "ovr": "虎扑历史模板展示 OVR（与游戏内 calcOVR 可能略有差异）",
            "calcOvr": "由 attrs 按 SIM_CONFIG.OVR_WEIGHTS 重算，供对照",
            "attrSource": "hupu_historical_players | hupu_draft_attrs | hupu_draft_potential | pool_peak | nba2k_current",
        },
        "teams": teams,
    }
    path = os.path.join(ROOT, "assets", "data", "historical", "legend-team-rosters.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Wrote", path)
    stars = [p for t in teams for p in t["players"] if p["ovr"] >= 94]
    print("teams", len(teams), "players", sum(len(t["players"]) for t in teams))
    print("stars 94+:", ", ".join(f"{p['nameEn']} {p['ovr']}" for p in stars))


if __name__ == "__main__":
    main()
