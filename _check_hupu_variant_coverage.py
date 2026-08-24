import re
import unicodedata
from pathlib import Path


def hs_norm_key(s: str) -> str:
    s = "" if s is None else str(s)
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = s.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9]", "", s)


def name_variants(n: str) -> list[str]:
    n = str(n or "").strip()
    if not n:
        return []
    vars_ = []

    def add(x: str):
        x = str(x or "").strip()
        if x and x not in vars_:
            vars_.append(x)

    add(n)
    parts = n.replace(",", "").split()

    def is_suffix(tok: str) -> bool:
        tok = tok.replace(".", "").lower()
        return tok in {"jr", "sr", "ii", "iii", "iv"}

    while parts and is_suffix(parts[-1]):
        parts.pop()
    base = " ".join(parts)
    if base and base != n:
        add(base)

    if len(parts) >= 3:
        filtered = []
        for p in parts:
            pp = p.replace(".", "")
            if len(pp) <= 1:
                continue
            filtered.append(p)
        if len(filtered) >= 2:
            mid_stripped = " ".join(filtered)
            if mid_stripped != n:
                add(mid_stripped)
    return vars_


def main() -> None:
    root = Path(r"C:/Users/whf97/Downloads/temp")
    local = root / "assets/images/Player/hupu-era"
    stems = set(p.stem for p in local.glob("*") if p.is_file())
    era_root = root / "assets/js/hupu/legend-era"

    for era, fn in [
        ("1984", "legend-era-1984-static.js"),
        ("1996", "legend-era-1996-static.js"),
        ("2003", "legend-era-2003-static.js"),
    ]:
        text = (era_root / fn).read_text(encoding="utf-8", errors="ignore")
        names = set(re.findall(r'"nameEN"\s*:\s*"([^"]+)"', text))
        missing = []
        for n in names:
            ok = False
            for v in name_variants(n):
                if hs_norm_key(v) in stems:
                    ok = True
                    break
            if not ok:
                missing.append(n)
        print(era, "nameEN", len(names), "missing after variants", len(missing))
        print("  sample:", sorted(missing)[:12])


if __name__ == "__main__":
    main()

