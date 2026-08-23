"""Compare legend-team-rosters draft vs pool / era_top100 / hupu scripts."""
import json
import os
import glob
import re

base = os.path.join(os.path.dirname(__file__), "..")

LEGEND_PATH = os.path.join(base, "assets", "data", "historical", "legend-team-rosters.json")
ATTR_KEYS = [
    "threePT", "MID", "FIN", "DNK", "HAN", "PAS", "PDEF", "IDEF", "BLK", "REB", "ATH", "STR", "CLU",
]

teams = {}
if os.path.isfile(LEGEND_PATH):
    with open(LEGEND_PATH, encoding="utf-8") as f:
        legend = json.load(f)
    for t in legend.get("teams", []):
        label = t.get("label") or t.get("season")
        teams[label] = [p.get("nameEn") for p in t.get("players", [])]
else:
    teams = {
        "1995-96 芝加哥公牛": [
            "Michael Jordan", "Scottie Pippen", "Dennis Rodman", "Ron Harper", "Luc Longley",
            "Toni Kukoc", "Steve Kerr", "Bill Wennington", "Jud Buechler", "Dickey Simpkins",
        ],
        "2016-17 金州勇士": [
            "Stephen Curry", "Kevin Durant", "Klay Thompson", "Draymond Green", "Zaza Pachulia",
            "Andre Iguodala", "Shaun Livingston", "David West", "JaVale McGee", "Patrick McCaw",
        ],
        "1985-86 波士顿凯尔特人": [
            "Larry Bird", "Kevin McHale", "Robert Parish", "Dennis Johnson", "Danny Ainge",
            "Bill Walton", "Scott Wedman", "Jerry Sichting", "Rick Carlisle", "Sam Vincent",
        ],
        "2000-01 洛杉矶湖人": [
            "Shaquille O'Neal", "Kobe Bryant", "Derek Fisher", "Horace Grant", "Rick Fox",
            "Robert Horry", "Brian Shaw", "Tyronn Lue", "Mike Penberthy", "Devean George",
        ],
        "1986-87 洛杉矶湖人": [
            "Magic Johnson", "Kareem Abdul-Jabbar", "James Worthy", "Byron Scott", "A.C. Green",
            "Michael Cooper", "Mychal Thompson", "Kurt Rambis", "Wes Matthews", "Adrian Branch",
        ],
    }


def norm(s):
    return "".join(ch for ch in (s or "").lower() if ch.isalnum() or ch == " ").strip()


targets = {}
for team, names in teams.items():
    for name in names:
        targets[norm(name)] = {
            "en": name,
            "team": team,
            "pool": False,
            "era": False,
            "legend": False,
            "current": False,
            "cname": "",
            "rating": None,
        }

if os.path.isfile(LEGEND_PATH):
    with open(LEGEND_PATH, encoding="utf-8") as f:
        legend = json.load(f)
    for t in legend.get("teams", []):
        for p in t.get("players", []):
            n = norm(p.get("nameEn"))
            if n in targets:
                targets[n]["legend"] = True
                if not targets[n]["rating"]:
                    targets[n]["rating"] = p.get("ovr") or p.get("rating")
                if not targets[n]["cname"]:
                    targets[n]["cname"] = p.get("nameCn") or ""
                attrs = p.get("attrs") or {}
                missing = [k for k in ATTR_KEYS if k not in attrs]
                if missing:
                    targets[n]["attrsMissing"] = missing

with open(os.path.join(base, "assets/data/perfect-player-pool.json"), encoding="utf-8") as f:
    pool = json.load(f)

for team_data in (pool.get("teams") or {}).values():
    cards = list(team_data.get("players", []) or [])
    cards.extend(team_data.get("historicalPlayers", []) or [])
    for card in cards:
        for field in ["nameEn", "altName", "displayName", "name"]:
            v = card.get(field)
            if not v:
                continue
            n = norm(v)
            if n in targets:
                targets[n]["pool"] = True
                targets[n]["cname"] = card.get("name") or card.get("nameCn") or card.get("displayName") or v
                targets[n]["rating"] = card.get("rating") or card.get("peakRating")

with open(os.path.join(base, "assets/data/historical/era_top100.json"), encoding="utf-8") as f:
    era = json.load(f)


def walk(obj):
    if isinstance(obj, dict):
        for k in ["nameEn", "name", "displayName"]:
            v = obj.get(k)
            if v and norm(v) in targets:
                targets[norm(v)]["era"] = True
        for v in obj.values():
            walk(v)
    elif isinstance(obj, list):
        for x in obj:
            walk(x)


walk(era)

hupu_players = set()
for path in glob.glob(os.path.join(base, "assets/js/hupu/script-*.js")):
    with open(path, encoding="utf-8", errors="ignore") as f:
        text = f.read()
    for m in re.finditer(r'"nameEN"\s*:\s*"([^"]+)"', text):
        hupu_players.add(norm(m.group(1)))
    for m in re.finditer(r'"name"\s*:\s*"([^"]+)"', text):
        v = m.group(1)
        if re.match(r"^[A-Za-z .'-]+$", v):
            hupu_players.add(norm(v))

for info in targets.values():
    if norm(info["en"]) in hupu_players:
        info["current"] = True

total = len(targets)
pool_n = sum(1 for t in targets.values() if t["pool"])
era_n = sum(1 for t in targets.values() if t["era"])
legend_n = sum(1 for t in targets.values() if t["legend"])
cur_n = sum(1 for t in targets.values() if t["current"])
any_n = sum(1 for t in targets.values() if t["pool"] or t["era"] or t["current"] or t["legend"])

print(f"传奇队草案: {legend_n}/{total}")
print(f"建球员卡池: {pool_n}/{total}")
print(f"历史 era_top100: {era_n}/{total}")
print(f"现役30队(NBA2K/hupu): {cur_n}/{total}")
print(f"至少一处有数据: {any_n}/{total}")
print()

for team, names in teams.items():
    print(team)
    for name in names:
        info = targets[norm(name)]
        src = []
        if info["legend"]:
            src.append("传奇队草案")
        if info["pool"]:
            src.append("建球员卡池")
        if info["era"]:
            src.append("历史Top100")
        if info["current"]:
            src.append("现役30队")
        rating = info["rating"]
        rat = f" OVR{rating}" if rating else ""
        miss = info.get("attrsMissing")
        miss_s = f" 缺属性:{','.join(miss)}" if miss else ""
        print(f"  {info['en']}{rat}{miss_s} | {info['cname'] or '-'} | {', '.join(src) if src else '无'}")
