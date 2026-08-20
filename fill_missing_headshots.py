#!/usr/bin/env python3
"""Fill missing player headshots from NBA CDN / ESPN / GitHub Pages.

Previous GitHub-only download 404'd many nba-official/{id}.png files.
This script collects IDs used by the current roster + player pool,
then downloads only the missing local files. Does not overwrite avatar-01.png.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(r"C:\Users\whf97\Downloads\temp")
OFFICIAL = ROOT / "assets" / "images" / "Player" / "nba-official"
KEEP = {"assets/images/Player/ai-avatars/avatar-01.png"}
WORKERS = 8
LOG = ROOT / "headshot-fill.log"
PAGES = "https://zyz9408.github.io/perfect-player/"
NBA = "https://cdn.nba.com/headshots/nba/latest/260x190/{id}.png"
NBA_HI = "https://cdn.nba.com/headshots/nba/latest/1040x760/{id}.png"


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm(s: str) -> str:
    s = strip_accents(s).lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9]", "", s)


def parse_js_map(text: str) -> dict[str, int]:
    return {k: int(v) for k, v in re.findall(r"'([^']+)':(\d+)", text)}


def image_index(pairs: dict[str, int]) -> dict[str, int]:
    idx: dict[str, int] = {}
    for name, pid in pairs.items():
        idx.setdefault(norm(name), pid)
        if "," in name:
            last, first = [x.strip() for x in name.split(",", 1)]
            idx.setdefault(norm(first + last), pid)
            idx.setdefault(norm(last + first), pid)
        parts = name.replace(",", " ").split()
        if len(parts) >= 2:
            idx.setdefault(norm(parts[-1] + "".join(parts[:-1])), pid)
            idx.setdefault(norm("".join(parts)), pid)
    return idx


def lookup_pid(name: str, idx: dict[str, int]) -> int | None:
    nk = norm(name)
    if nk in idx:
        return idx[nk]
    if "," in name:
        last, first = [x.strip() for x in name.split(",", 1)]
        return idx.get(norm(first + last)) or idx.get(norm(last + first))
    parts = name.split()
    if len(parts) >= 2:
        return idx.get(norm(parts[-1] + "".join(parts[:-1])))
    return None


def collect_ids() -> set[str]:
    ids: set[str] = set()
    html = (ROOT / "nba-perfect-player.html").read_text(encoding="utf-8", errors="ignore")
    for m in re.finditer(r"nba-official/(\d+)\.png", html):
        ids.add(m.group(1))
    for m in re.finditer(r"cdn\.nba\.com/headshots/nba/latest/\d+x\d+/(\d+)\.png", html):
        ids.add(m.group(1))
    for m in re.finditer(r"PERFECT_PLAYER_HEADSHOT_ID_FIX[\s\S]*?\n\};", html):
        for pid in re.findall(r":\s*(\d+)", m.group(0)):
            ids.add(pid)

    pool_path = ROOT / "assets/data/perfect-player-pool.json"
    if pool_path.exists():
        blob = pool_path.read_text(encoding="utf-8")
        for pid in re.findall(r"cdn\.nba\.com/headshots/nba/latest/\d+x\d+/(\d+)\.png", blob):
            ids.add(pid)

    img_js = ROOT / "assets/js/hupu/script-00-2678-58zyeprc-upload-1783508428855-12.js"
    data_js = ROOT / "assets/js/hupu/script-01-2678-5hu3djrc-upload-1783494754597-12.js"
    if img_js.exists() and data_js.exists():
        idx = image_index(parse_js_map(img_js.read_text(encoding="utf-8", errors="ignore")))
        names = set(re.findall(r"name:\s*'([^']+)'", data_js.read_text(encoding="utf-8", errors="ignore")))
        for name in names:
            pid = lookup_pid(name, idx)
            if pid:
                ids.add(str(pid))

    # HTML name→id fixes
    for m in re.finditer(r"'([^']+)':\s*(\d{3,})", html):
        if "HEADSHOT" in html[max(0, m.start() - 80) : m.start()]:
            ids.add(m.group(2))
    return ids


def collect_pool_locals() -> list[str]:
    paths: set[str] = set()
    pool_path = ROOT / "assets/data/perfect-player-pool.json"
    if not pool_path.exists():
        return []

    def walk(obj) -> None:
        if isinstance(obj, dict):
            val = obj.get("photoLocal")
            if isinstance(val, str) and val.startswith("assets/"):
                paths.add(val.split("?")[0].replace("\\", "/"))
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(json.loads(pool_path.read_text(encoding="utf-8")))
    for i in range(1, 19):
        paths.add(f"assets/images/Player/ai-avatars/avatar-{i:02d}.png")
    for i in range(1, 61):
        paths.add(f"assets/images/Player/rookies-2026/rookie-{i:02d}.jpg")
    return sorted(paths)


def curl(url: str, dest: Path) -> bool:
    tmp = dest.with_suffix(dest.suffix + ".part")
    if tmp.exists():
        tmp.unlink(missing_ok=True)
    cmd = [
        "curl.exe", "--noproxy", "*", "-L", "--fail", "--silent", "--show-error",
        "--retry", "2", "--connect-timeout", "15", "--max-time", "60",
        "-A", "Mozilla/5.0",
        "-o", str(tmp), url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode == 0 and tmp.exists() and tmp.stat().st_size > 800:
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp.replace(dest)
        return True
    if tmp.exists():
        tmp.unlink(missing_ok=True)
    return False


def espn_url_fixes() -> dict[str, str]:
    html = (ROOT / "nba-perfect-player.html").read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"PERFECT_PLAYER_HEADSHOT_URL_FIX\s*=\s*\{([\s\S]*?)\n\};", html)
    if not m:
        return {}
    return dict(re.findall(r"(\d+):\s*'([^']+)'", m.group(1)))


def download_official(pid: str, espn: dict[str, str]) -> tuple[str, str]:
    dest = OFFICIAL / f"{pid}.png"
    rel = f"assets/images/Player/nba-official/{pid}.png"
    if dest.exists() and dest.stat().st_size > 800:
        return rel, "skip"
    urls = [
        PAGES + rel,
        NBA.format(id=pid),
        NBA_HI.format(id=pid),
    ]
    if pid in espn:
        urls.append(espn[pid])
    for url in urls:
        if curl(url, dest):
            return rel, "ok"
    return rel, "fail"


def download_pages(rel: str) -> tuple[str, str]:
    rel = rel.replace("\\", "/")
    dest = ROOT / rel.replace("/", os.sep)
    if rel in KEEP:
        return rel, "keep"
    if dest.exists() and dest.stat().st_size > 800:
        return rel, "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if curl(PAGES + rel, dest):
        return rel, "ok"
    return rel, "fail"


def main() -> int:
    ids = collect_ids()
    locals_ = collect_pool_locals()
    espn = espn_url_fixes()
    missing_official = [pid for pid in sorted(ids, key=lambda x: int(x) if x.isdigit() else 0) if not ((OFFICIAL / f"{pid}.png").exists() and (OFFICIAL / f"{pid}.png").stat().st_size > 800)]
    missing_local = [p for p in locals_ if p not in KEEP and not ((ROOT / p.replace("/", os.sep)).exists() and (ROOT / p.replace("/", os.sep)).stat().st_size > 800)]
    LOG.write_text(
        f"ids={len(ids)} missing_official={len(missing_official)} pool_local={len(locals_)} missing_local={len(missing_local)}\n",
        encoding="utf-8",
    )
    print(f"ids={len(ids)} missing_official={len(missing_official)} missing_local={len(missing_local)}", flush=True)

    ok = skip = keep = fail = 0
    failed: list[tuple[str, str]] = []
    jobs = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for pid in missing_official:
            jobs.append(pool.submit(download_official, pid, espn))
        for rel in missing_local:
            jobs.append(pool.submit(download_pages, rel))
        total = max(1, len(jobs))
        for i, fut in enumerate(as_completed(jobs), 1):
            rel, status = fut.result()
            if status == "ok":
                ok += 1
            elif status == "skip":
                skip += 1
            elif status == "keep":
                keep += 1
            else:
                fail += 1
                failed.append((rel, status))
            if i % 20 == 0 or i == total:
                line = f"progress {i}/{total} ok={ok} skip={skip} keep={keep} fail={fail}"
                print(line, flush=True)
                with LOG.open("a", encoding="utf-8") as fh:
                    fh.write(line + "\n")

    if failed:
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write("FAILED\n")
            for rel, status in failed:
                fh.write(f"  {rel} {status}\n")
        print(f"failed {len(failed)}", flush=True)
        for rel, status in failed[:30]:
            print(f"  {rel} {status}", flush=True)
    print(f"done ok={ok} skip={skip} keep={keep} fail={fail}", flush=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"done ok={ok} skip={skip} keep={keep} fail={fail}\n")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
