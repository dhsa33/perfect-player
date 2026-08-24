import re
import unicodedata
from pathlib import Path


def hs_norm_key(s: str) -> str:
    s = "" if s is None else str(s)
    # remove diacritics
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = s.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9]", "", s)


def main() -> None:
    root = Path(r"C:/Users/whf97/Downloads/temp")
    out = root / "assets/images/Player/hupu-era"
    era_root = root / "assets/js/hupu/legend-era"

    for era, fn in [
        ("1984", "legend-era-1984-static.js"),
        ("1996", "legend-era-1996-static.js"),
        ("2003", "legend-era-2003-static.js"),
    ]:
        text = (era_root / fn).read_text(encoding="utf-8", errors="ignore")
        # JS object literal, extract "nameEN": "..."
        names = set(re.findall(r'"nameEN"\s*:\s*"([^"]+)"', text))
        missing = []
        for n in sorted(names):
            key = hs_norm_key(n)
            if not ((out / f"{key}.jpg").exists() or (out / f"{key}.png").exists()):
                missing.append((n, key))
        print(era, "unique nameEN", len(names), "missing", len(missing))
        print("  sample missing:", missing[:15])


if __name__ == "__main__":
    main()

