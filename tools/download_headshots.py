#!/usr/bin/env python3
"""Download Perfect Player headshots in the background. Does not overwrite avatar-01.png."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(r"C:\Users\whf97\Downloads\temp")
BASES = [
    "https://zyz9408.github.io/perfect-player/",
    "https://raw.githubusercontent.com/zyz9408/perfect-player/main/",
]
KEEP = {"assets/images/Player/ai-avatars/avatar-01.png"}
WORKERS = 4
LOG = ROOT / "headshot-download.log"


def collect_paths() -> list[str]:
    paths: set[str] = set()

    def walk(obj) -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key == "photoLocal" and isinstance(value, str) and value.startswith("assets/"):
                    paths.add(value.split("?")[0].replace("\\", "/"))
                else:
                    walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    pool = ROOT / "assets/data/perfect-player-pool.json"
    if pool.exists():
        payload = json.loads(pool.read_text(encoding="utf-8"))
        walk(payload)
        import re
        blob = json.dumps(payload)
        for pid in re.findall(r"cdn\.nba\.com/headshots/nba/latest/\d+x\d+/(\d+)\.png", blob):
            paths.add(f"assets/images/Player/nba-official/{pid}.png")

    generated = ROOT / "assets/data/generated-rookie-headshots.json"
    if generated.exists():
        walk(json.loads(generated.read_text(encoding="utf-8")))

    for i in range(1, 61):
        paths.add(f"assets/images/Player/rookies-2026/rookie-{i:02d}.jpg")

    html = ROOT / "nba-perfect-player.html"
    if html.exists():
        text = html.read_text(encoding="utf-8", errors="ignore")
        import re
        for match in re.finditer(r"assets/images/Player/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp)", text):
            paths.add(match.group(0))
        for match in re.finditer(r"assets/images/Player/nba-official/(\d+)\.png", text):
            paths.add(match.group(0))

    # Character avatars 02-18; 01 is the custom cat and must stay.
    for i in range(1, 19):
        paths.add(f"assets/images/Player/ai-avatars/avatar-{i:02d}.png")

    return sorted(paths)


def download_one(rel: str) -> tuple[str, str]:
    rel = rel.replace("\\", "/")
    dest = ROOT / rel.replace("/", os.sep)
    if rel in KEEP:
        return rel, "keep"
    if dest.exists() and dest.stat().st_size > 1024:
        return rel, "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    last_err = "no-url"
    for base in BASES:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        cmd = [
            "curl.exe", "--noproxy", "*", "-L", "--fail", "--silent", "--show-error",
            "--retry", "3", "--connect-timeout", "20", "--max-time", "120",
            "-o", str(tmp), base + rel,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode == 0 and tmp.exists() and tmp.stat().st_size > 500:
            tmp.replace(dest)
            return rel, "ok"
        last_err = (proc.stderr or "").strip() or f"curl {proc.returncode}"
        if tmp.exists():
            tmp.unlink(missing_ok=True)
    return rel, f"fail:{last_err[:120]}"


def main() -> int:
    paths = collect_paths()
    LOG.write_text(f"start files={len(paths)}\n", encoding="utf-8")
    print(f"files={len(paths)}", flush=True)
    ok = skip = keep = fail = 0
    failed = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = [pool.submit(download_one, path) for path in paths]
        for i, fut in enumerate(as_completed(futs), 1):
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
            if i % 25 == 0 or i == len(futs):
                line = f"progress {i}/{len(futs)} ok={ok} skip={skip} keep={keep} fail={fail}"
                print(line, flush=True)
                with LOG.open("a", encoding="utf-8") as fh:
                    fh.write(line + "\n")
    if failed:
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write("FAILED\n")
            for rel, status in failed:
                fh.write(f"  {rel} {status}\n")
        print(f"failed {len(failed)}", flush=True)
        for rel, status in failed[:20]:
            print(f"  {rel} {status}", flush=True)
    print(f"done ok={ok} skip={skip} keep={keep} fail={fail}", flush=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"done ok={ok} skip={skip} keep={keep} fail={fail}\n")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
