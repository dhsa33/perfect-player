#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, Tuple, Optional
from urllib.parse import urlparse, unquote


def hs_norm_key(s: str) -> str:
    s = "" if s is None else str(s)
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = s.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9]", "", s)


def ext_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    suf = Path(path).suffix.lower()
    if suf in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        if suf in (".jpeg", ".jpg"):
            return ".jpg"
        return suf
    return ".jpg"


def compact_photo_index_from_hupu_photos(js_path: Path) -> Dict[str, str]:
    """
    Build compactKey -> photoUrl index from assets/js/hupu/legend-era/hupu-player-photos.js.
    We only need a URL for each compact key.
    """
    text = js_path.read_text(encoding="utf-8", errors="ignore")

    # Match entries in lookup: "some key": { ... "p":"..." ... "b":"..." ... }
    # Increase body length because file is large.
    entry_re = re.compile(r'"([^"]+)"\s*:\s*\{([^{}]{0,12000})\}', re.S)

    idx: Dict[str, str] = {}
    for m in entry_re.finditer(text):
        key = m.group(1)
        body = m.group(2)
        bp = None
        m_p = re.search(r'"p"\s*:\s*"([^"]+)"', body)
        m_b = re.search(r'"b"\s*:\s*"([^"]+)"', body)
        if m_p:
            bp = m_p.group(1)
        if not bp and m_b:
            bp = m_b.group(1)
        if not bp:
            continue

        if bp.startswith("http://"):
            bp = "https://" + bp[7:]
        # remove query so it is more stable for extension detection
        bp_clean = bp.split("?")[0]

        # index by the raw lookup key and also by the english field "e"
        keys_to_try = [key]
        m_e = re.search(r'"e"\s*:\s*"([^"]+)"', body)
        if m_e:
            keys_to_try.append(m_e.group(1))

        for k in keys_to_try:
            ck = hs_norm_key(k)
            if ck and ck not in idx:
                idx[ck] = bp_clean

    return idx


def collect_missing_names(static_dir: Path, local_dir: Path) -> Dict[str, list[Tuple[str, str]]]:
    """
    Return {era: [(nameEN, compactKey), ...]} for missing local jpg/png.
    """
    result: Dict[str, list[Tuple[str, str]]] = {}
    for era, fn in [
        ("1984", "legend-era-1984-static.js"),
        ("1996", "legend-era-1996-static.js"),
        ("2003", "legend-era-2003-static.js"),
    ]:
        text = (static_dir / fn).read_text(encoding="utf-8", errors="ignore")
        names = set(re.findall(r'"nameEN"\s*:\s*"([^"]+)"', text))
        missing: list[Tuple[str, str]] = []
        for n in sorted(names):
            key = hs_norm_key(n)
            if not ((local_dir / f"{key}.jpg").exists() or (local_dir / f"{key}.png").exists()):
                missing.append((n, key))
        result[era] = missing
    return result


def download_one(url: str, dest: Path, max_time: int = 120) -> Tuple[str, str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    if tmp.exists():
        tmp.unlink(missing_ok=True)
    cmd = [
        "curl.exe",
        "--noproxy",
        "*",
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "--retry",
        "4",
        "--connect-timeout",
        "20",
        "--max-time",
        str(max_time),
        "-o",
        str(tmp),
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode == 0 and tmp.exists() and tmp.stat().st_size > 500:
        tmp.replace(dest)
        return dest.name, "ok"
    if tmp.exists():
        tmp.unlink(missing_ok=True)
    return dest.name, f"fail:{(proc.stderr or '').strip()[:120] or proc.returncode}"


def main() -> int:
    root = Path(r"C:/Users/whf97/Downloads/temp")
    static_dir = root / "assets/js/hupu/legend-era"
    local_dir = root / "assets/images/Player/hupu-era"
    photos_js = static_dir / "hupu-player-photos.js"
    log = root / "hupu-era-missing-download.log"

    missing_map = collect_missing_names(static_dir, local_dir)
    total_missing = sum(len(v) for v in missing_map.values())
    if total_missing == 0:
        print("No missing local photos.")
        return 0

    print("Missing total:", total_missing)
    for era, items in missing_map.items():
        print(" ", era, "missing", len(items))
    log.write_text(f"missing_total={total_missing}\n", encoding="utf-8")

    idx = compact_photo_index_from_hupu_photos(photos_js)
    print("lookup index size:", len(idx))

    jobs = []
    for era, items in missing_map.items():
        for name, key in items:
            url: Optional[str] = idx.get(key)
            if not url:
                # last resort: try also name with accents removed (hs_norm_key already)
                continue
            ext = ext_from_url(url)
            dest = local_dir / f"{key}{ext}"
            if dest.exists() and dest.stat().st_size > 500:
                continue
            jobs.append((name, key, url, dest))

    print("jobs to download:", len(jobs))
    log.write_text(log.read_text(encoding="utf-8") + f"jobs={len(jobs)}\n", encoding="utf-8")
    if not jobs:
        print("No jobs matched lookup. Need to improve lookup parsing.")
        return 2

    ok = fail = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = [pool.submit(download_one, url, dest) for _, _, url, dest in jobs]
        for i, fut in enumerate(as_completed(futs), 1):
            fname, status = fut.result()
            if status == "ok":
                ok += 1
            else:
                fail += 1
            if i % 10 == 0 or i == len(jobs):
                line = f"progress {i}/{len(jobs)} ok={ok} fail={fail}"
                print(line, flush=True)
                with log.open("a", encoding="utf-8") as fh:
                    fh.write(line + "\n")

    print("done ok=", ok, "fail=", fail)
    with log.open("a", encoding="utf-8") as fh:
        fh.write(f"done ok={ok} fail={fail}\n")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())

