"""Extract HISTORICAL_PLAYERS from cached hupu __ai_app.html into JSON."""
import json
import os
import re
import urllib.request

ATTR_KEYS = [
    "threePT", "MID", "FIN", "DNK", "HAN", "PAS", "PDEF", "IDEF", "BLK", "REB", "ATH", "STR", "CLU",
]
BASE = os.path.join(os.path.dirname(__file__), "..")
CACHE = os.path.join(os.path.dirname(__file__), "_hupu-ai-app.html")
OUT = os.path.join(BASE, "assets", "data", "historical", "hupu-historical-players.json")
APP_URL = (
    "https://activity-static.hupu.com/colorbox-activities/"
    "activity-project-ai-1783761934042/__ai_app.html"
)


def ensure_cache():
    if os.path.isfile(CACHE) and os.path.getsize(CACHE) > 1_000_000:
        return
    print("Fetching", APP_URL)
    data = urllib.request.urlopen(APP_URL, timeout=120).read()
    with open(CACHE, "wb") as f:
        f.write(data)
    print("Cached", len(data), "bytes")


def parse_attrs(blob):
    attrs = {}
    for am in re.finditer(
        r"(threePT|MID|FIN|DNK|HAN|PAS|PDEF|IDEF|BLK|REB|ATH|STR|CLU):\s*(\d+)",
        blob,
    ):
        attrs[am.group(1)] = int(am.group(2))
    return attrs


def main():
    ensure_cache()
    html = open(CACHE, encoding="utf-8").read()
    m = re.search(r"var HISTORICAL_PLAYERS\s*=\s*\[(.*?)\];", html, re.DOTALL)
    if not m:
        raise SystemExit("HISTORICAL_PLAYERS block not found")
    block = m.group(1)
    players = []
    pat = re.compile(
        r"\{\s*en:\s*\"([^\"]+)\"\s*,\s*cn:\s*\"([^\"]+)\"\s*,\s*pos:\s*'([^']+)'\s*,\s*ovr:\s*(\d+)\s*,\s*attrs:\s*\{([^}]+)\}"
    )
    for em in pat.finditer(block):
        en, cn, pos, ovr, attr_blob = em.groups()
        attrs = parse_attrs(attr_blob)
        missing = [k for k in ATTR_KEYS if k not in attrs]
        if missing:
            raise SystemExit(f"{en} missing attrs: {missing}")
        players.append(
            {
                "nameEn": en,
                "nameCn": cn.replace("-", "·"),
                "pos": pos,
                "ovr": int(ovr),
                "attrs": attrs,
            }
        )
    out = {
        "version": 1,
        "source": "hupu project-ai-1783761934042 / historical-players.js",
        "description": "虎扑完美球员历史球星巅峰模板",
        "players": players,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Wrote", OUT, "players", len(players))


if __name__ == "__main__":
    main()
