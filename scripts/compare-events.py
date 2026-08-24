import re
import pathlib
from collections import Counter

ROOT = pathlib.Path(r'C:\Users\whf97\Downloads\temp')

LOCAL_FILES = [
    ROOT / 'assets/js/perfect-player-event-runtime.js',
    ROOT / 'assets/js/perfect-player-story-events.js',
    ROOT / 'assets/js/perfect-player-event-library.js',
    ROOT / 'assets/js/perfect-player-hupu-extensions.js',
    ROOT / 'assets/js/perfect-player-hupu-life-events.js',
    ROOT / 'assets/js/perfect-player-legend-story.js',
    ROOT / 'assets/js/perfect-player-core.js',
    ROOT / 'assets/js/perfect-player-allstar.js',
]
HUPU = ROOT / '_hupu_ai_app.html'

ID_PATS = [
    re.compile(r"""id:\s*['"]([^'"]+)['"]"""),
    re.compile(r"""topicId:\s*['"]([^'"]+)['"]"""),
    re.compile(r"""['"]id['"]:\s*['"]([^'"]+)['"]"""),
]

NOISE_PREFIX = ('screen-', 'btn-', 'http', 'assets/', './', 'legend-era', 'perfect-player')
EVENT_PREFIXES = (
    'story_', 'pp_season_', 'unique_', 'injury_', 'fight_', 'trash_', 'susp_',
    'allstar', 'era_', 'china_', 'relationship', 'training', 'transfer', 'media',
    'retirement', 'family', 'charity', 'network', 'mental', 'fan_', 'city_',
    'teammate', 'post_career', 'crossover', 'bench', 'rival', 'derby', 'legend',
    'hometown', 'torch', 'craft', 'voice', 'load', 'off_', 'countdown',
)


def extract_ids(path: pathlib.Path) -> set[str]:
    text = path.read_text(encoding='utf-8', errors='replace')
    ids: set[str] = set()
    for pat in ID_PATS:
        ids.update(pat.findall(text))
    return ids


def is_eventish(s: str) -> bool:
    if len(s) < 3 or len(s) > 100:
        return False
    if any(s.startswith(p) for p in NOISE_PREFIX):
        return False
    if s.isdigit():
        return False
    low = s.lower()
    if any(p in low for p in EVENT_PREFIXES):
        return True
    if '_' in s and not s.startswith('Era'):
        return True
    return False


def main():
    local_ids: set[str] = set()
    for f in LOCAL_FILES:
        if f.exists():
            local_ids |= extract_ids(f)

    hupu_ids = extract_ids(HUPU)
    local_e = {x for x in local_ids if is_eventish(x)}
    hupu_e = {x for x in hupu_ids if is_eventish(x)}

    only_hupu = sorted(hupu_e - local_e)
    only_local = sorted(local_e - hupu_e)

    print('local eventish:', len(local_e))
    print('hupu eventish:', len(hupu_e))
    print('only hupu:', len(only_hupu))
    print('only local:', len(only_local))

    # group hupu-only by first segment
    c = Counter(x.split('_')[0] for x in only_hupu)
    print('\n--- hupu-only prefix counts ---')
    for k, v in c.most_common(40):
        print(f'  {k}: {v}')

    # story / era / allstar specific
    for prefix in ['story_', 'era_', 'allstar', 'pp_season_unique', 'LEGEND', 'legend_era']:
        items = [x for x in only_hupu if prefix.lower() in x.lower()]
        if items:
            print(f'\n--- hupu-only {prefix} ({len(items)}) sample ---')
            for x in items[:25]:
                print(' ', x)

    out = ROOT / '_event_diff_only_hupu.txt'
    out.write_text('\n'.join(only_hupu), encoding='utf-8')
    print(f'\nWrote {out}')


if __name__ == '__main__':
    main()
