import re
import unicodedata
from pathlib import Path


def hs_norm_key(s: str) -> str:
    s = "" if s is None else str(s)
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = s.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9]", "", s)


def main() -> None:
    root = Path(r"C:/Users/whf97/Downloads/temp")
    out = root / "assets/images/Player/hupu-era"
    era_root = root / "assets/js/hupu/legend-era"

    missing_keys: set[str] = set()
    for era, fn in [
        ("1984", "legend-era-1984-static.js"),
        ("1996", "legend-era-1996-static.js"),
        ("2003", "legend-era-2003-static.js"),
    ]:
        text = (era_root / fn).read_text(encoding="utf-8", errors="ignore")
        names = set(re.findall(r'"nameEN"\s*:\s*"([^"]+)"', text))
        for n in names:
            key = hs_norm_key(n)
            if not ((out / f"{key}.jpg").exists() or (out / f"{key}.png").exists()):
                missing_keys.add(key)

    keys = sorted(missing_keys)
    print("missing keys count:", len(keys))
    for k in keys:
        print(k)

    (root / "_missing_hupu_era_keys.txt").write_text("\n".join(keys) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

