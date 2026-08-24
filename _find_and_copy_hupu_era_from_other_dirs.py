#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import unicodedata
from pathlib import Path


def hs_norm_key(s: str) -> str:
    s = "" if s is None else str(s)
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = s.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9]", "", s)


def main() -> None:
    root = Path(r"C:/Users/whf97/Downloads/temp")
    hupu_dir = root / "assets/images/Player/hupu-era"
    keys_path = root / "_missing_hupu_era_keys.txt"
    if not keys_path.exists():
        raise SystemExit("missing keys file not found: " + str(keys_path))

    keys = [x.strip() for x in keys_path.read_text(encoding="utf-8", errors="ignore").splitlines() if x.strip()]
    keys_set = set(keys)

    # dirs to search for existing images
    search_dirs = [
        root / "assets/images/Player/historical-nba",
        root / "assets/images/Player/historical",
        root / "assets/images/Player/overseas-era",
        root / "assets/images/Player/nba-official",
    ]
    exts = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

    # Build a lookup: normStem -> file path
    stem_to_path: dict[str, Path] = {}
    for d in search_dirs:
        if not d.exists():
            continue
        for p in d.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix.lower() not in exts:
                continue
            stem_norm = hs_norm_key(p.stem)
            if stem_norm and stem_norm not in stem_to_path:
                stem_to_path[stem_norm] = p

    hupu_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    missing = []
    for k in sorted(keys_set):
        src = stem_to_path.get(k)
        if not src:
            missing.append(k)
            continue
        # choose extension of src; copy only if target doesn't exist
        tgt = hupu_dir / (k + src.suffix.lower())
        if not tgt.exists():
            shutil.copy2(src, tgt)
            copied += 1

    print("copied:", copied, "still missing:", len(missing))
    if missing:
        print("missing sample:", missing[:30])


if __name__ == "__main__":
    main()

