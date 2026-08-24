#!/usr/bin/env python3
"""Download Hupu era player headshots for local offline use."""
from __future__ import annotations

import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(r"C:\Users\whf97\Downloads\temp")
OUT = ROOT / "assets" / "images" / "Player" / "hupu-era"
LOG = ROOT / "hupu-era-photos-download.log"
PHOTOS_JS = ROOT / "assets" / "js" / "hupu" / "legend-era" / "hupu-player-photos.js"
ERA_FILES = [
    ROOT / "assets" / "js" / "hupu" / "legend-era" / "legend-era-1984-static.js",
    ROOT / "assets" / "js" / "hupu" / "legend-era" / "legend-era-1996-static.js",
    ROOT / "assets" / "js" / "hupu" / "legend-era" / "legend-era-2003-static.js",
]
WORKERS = 6


def compact(s: str) -> str:
    s = s.lower()
    try:
        import unicodedata
        s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    except Exception:
        pass
    return re.sub(r"[^a-z0-9]", "", s)


def to_https(url: str) -> str:
    url = (url or "").strip()
    if url.startswith("http://"):
        return "https://" + url[7:]
    return url


def parse_photo_lookup() -> dict[str, str]:
    text = PHOTOS_JS.read_text(encoding="utf-8", errors="ignore")
    lookup: dict[str, str] = {}
    for m in re.finditer(r'"([^"]+)"\s*:\s*\{([^{}]{0,1200})\}', text):
        key = m.group(1)
        body = m.group(2)
        bm = re.search(r'"b"\s*:\s*"([^"]+)"', body)
        pm = re.search(r'"p"\s*:\s*"([^"]+)"', body)
        em = re.search(r'"e"\s*:\s*"([^"]+)"', body)
        url = to_https((bm.group(1) if bm else "") or (pm.group(1) if pm else ""))
        if not url:
            continue
        # strip image processing query for fuller image when possible
        url = url.split("?")[0]
        for k in (key, em.group(1) if em else ""):
            if not k:
                continue
            lookup[k.lower()] = url
            lookup[compact(k)] = url
    return lookup


def collect_era_english_names() -> set[str]:
    names: set[str] = set()
    for path in ERA_FILES:
        text = path.read_text(encoding="utf-8", errors="ignore")
        for key in ("nameEN", "nameEn"):
            for m in re.finditer(rf'"{key}"\s*:\s*"([^"]+)"', text):
                n = m.group(1).strip()
                if not n:
                    continue
                if re.match(r"^Era(Role)?\d", n, re.I):
                    continue
                names.add(n)
        # also plain ascii "name" values that look like English full names
        for m in re.finditer(r'"name"\s*:\s*"([^"]+)"', text):
            n = m.group(1).strip()
            if re.match(r"^[A-Za-z][A-Za-z .'\-]+$", n) and " " in n and not re.match(r"^Era", n):
                names.add(n)
    return names


def ext_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    suf = Path(path).suffix.lower()
    if suf in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        return ".jpg" if suf == ".jpeg" else suf
    return ".jpg"


def resolve_jobs(lookup: dict[str, str], names: set[str]) -> list[tuple[str, str, Path]]:
    jobs = []
    seen_dest: set[str] = set()
    for name in sorted(names):
        url = lookup.get(name.lower()) or lookup.get(compact(name))
        if not url:
            continue
        key = compact(name)
        if not key:
            continue
        dest = OUT / f"{key}{ext_from_url(url)}"
        if str(dest) in seen_dest:
            continue
        seen_dest.add(str(dest))
        jobs.append((name, url, dest))
    return jobs


def download_one(name: str, url: str, dest: Path) -> tuple[str, str]:
    if dest.exists() and dest.stat().st_size > 800:
        return name, "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    if tmp.exists():
        tmp.unlink(missing_ok=True)
    cmd = [
        "curl.exe", "--noproxy", "*", "-L", "--fail", "--silent", "--show-error",
        "--retry", "3", "--connect-timeout", "20", "--max-time", "90",
        "-A", "Mozilla/5.0",
        "-o", str(tmp), url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode == 0 and tmp.exists() and tmp.stat().st_size > 500:
        tmp.replace(dest)
        return name, "ok"
    err = (proc.stderr or "").strip() or f"curl {proc.returncode}"
    if tmp.exists():
        tmp.unlink(missing_ok=True)
    return name, f"fail:{err[:140]}"


def main() -> int:
    lookup = parse_photo_lookup()
    names = collect_era_english_names()
    jobs = resolve_jobs(lookup, names)
    OUT.mkdir(parents=True, exist_ok=True)
    LOG.write_text(f"names={len(names)} jobs={len(jobs)} lookup={len(lookup)}\n", encoding="utf-8")
    print(f"names={len(names)} jobs={len(jobs)}", flush=True)

    ok = skip = fail = 0
    failed = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = [pool.submit(download_one, n, u, d) for n, u, d in jobs]
        for i, fut in enumerate(as_completed(futs), 1):
            name, status = fut.result()
            if status == "ok":
                ok += 1
            elif status == "skip":
                skip += 1
            else:
                fail += 1
                failed.append((name, status))
            if i % 40 == 0 or i == len(futs):
                line = f"progress {i}/{len(futs)} ok={ok} skip={skip} fail={fail}"
                print(line, flush=True)
                with LOG.open("a", encoding="utf-8") as fh:
                    fh.write(line + "\n")

    if failed:
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write("FAILED\n")
            for name, status in failed:
                fh.write(f"  {name}\t{status}\n")
        print(f"failed {len(failed)}", flush=True)
        for name, status in failed[:15]:
            print(f"  {name} {status}", flush=True)

    print(f"done ok={ok} skip={skip} fail={fail} out={OUT}", flush=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"done ok={ok} skip={skip} fail={fail}\n")
    return 0 if fail < len(jobs) else 2


if __name__ == "__main__":
    sys.exit(main())
