#!/usr/bin/env python3
"""Download zyz9408/perfect-player files through a local HTTP proxy."""
from __future__ import annotations

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(r"C:\Users\whf97\Downloads\temp")
PROXY = "http://127.0.0.1:7897"
TREE_URL = "https://api.github.com/repos/zyz9408/perfect-player/git/trees/main?recursive=1"
PAGES = "https://zyz9408.github.io/perfect-player/"
RAW = "https://raw.githubusercontent.com/zyz9408/perfect-player/main/"
SKIP_PREFIXES = (".git/",)
KEEP_LOCAL = {"assets/images/Player/ai-avatars/avatar-01.png"}
WORKERS = 24

handlers = [
    urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}),
    urllib.request.HTTPSHandler(),
]
opener = urllib.request.build_opener(*handlers)
opener.addheaders = [
    ("User-Agent", "Mozilla/5.0 perfect-player-localizer"),
    ("Accept", "*/*"),
]


def fetch(url: str, dest: Path, timeout: int = 45) -> None:
    import subprocess

    tmp = dest.with_suffix(dest.suffix + ".part")
    cmd = [
        "curl.exe",
        "-x",
        PROXY,
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "--retry",
        "3",
        "--retry-delay",
        "1",
        "--connect-timeout",
        "20",
        "--max-time",
        str(timeout),
        "-o",
        str(tmp),
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not tmp.exists() or tmp.stat().st_size <= 0:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise RuntimeError(proc.stderr.strip() or f"curl {proc.returncode}")
    tmp.replace(dest)


def should_skip(path: str) -> bool:
    return path.startswith(SKIP_PREFIXES) or path.endswith(".zip")


def already_ok(dest: Path, size: int | None) -> bool:
    if not dest.exists() or not dest.is_file():
        return False
    if not size:
        return dest.stat().st_size > 0
    return dest.stat().st_size == size


def download_one(path: str, size: int | None) -> tuple[str, str]:
    dest = ROOT / path.replace("/", os.sep)
    if path in KEEP_LOCAL and dest.exists() and dest.stat().st_size > 0:
        return path, "keep"
    if already_ok(dest, size):
        return path, "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    urls = [PAGES + path, RAW + path]
    last_err = None
    for url in urls:
        try:
            fetch(url, dest, timeout=90)
            return path, "ok"
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    return path, f"fail:{last_err}"


def main() -> int:
    print(f"proxy={PROXY}", flush=True)
    tree_path = ROOT / "github-tree.json"
    try:
        fetch(TREE_URL, tree_path, timeout=90)
        raw = tree_path.read_bytes()
        print(f"tree bytes={len(raw)}", flush=True)
    except Exception as exc:  # noqa: BLE001
        if tree_path.exists():
            raw = tree_path.read_bytes()
            print(f"tree cache fallback: {exc}", flush=True)
        else:
            print(f"tree fetch failed: {exc}", flush=True)
            return 1

    text = raw.decode("utf-8", errors="replace")
    start = text.find("{")
    end = text.rfind("}") + 1
    data = json.loads(text[start:end])
    blobs = [
        (item["path"], item.get("size"))
        for item in data.get("tree", [])
        if item.get("type") == "blob" and not should_skip(item["path"])
    ]
    print(f"files={len(blobs)}", flush=True)

    ok = skip = fail = keep = 0
    failed = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = [pool.submit(download_one, path, size) for path, size in blobs]
        for i, fut in enumerate(as_completed(futs), 1):
            path, status = fut.result()
            if status == "ok":
                ok += 1
            elif status == "skip":
                skip += 1
            elif status == "keep":
                keep += 1
            else:
                fail += 1
                failed.append((path, status))
            if i % 50 == 0 or i == len(futs):
                print(f"progress {i}/{len(futs)} ok={ok} skip={skip} keep={keep} fail={fail}", flush=True)

    if failed:
        print("FAILED:", flush=True)
        for path, status in failed[:30]:
            print(f"  {path} {status}", flush=True)
        if len(failed) > 30:
            print(f"  ... {len(failed) - 30} more", flush=True)
    print(f"done ok={ok} skip={skip} keep={keep} fail={fail}", flush=True)
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
