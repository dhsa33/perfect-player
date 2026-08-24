"""Extract legend story + life events from _hupu_ai_app.html into standalone JS modules."""
import pathlib
import re

ROOT = pathlib.Path(r'C:\Users\whf97\Downloads\temp')
HUPU = ROOT / '_hupu_ai_app.html'
lines = HUPU.read_text(encoding='utf-8', errors='replace').splitlines(keepends=True)


def slice_lines(start: int, end: int) -> str:
    return ''.join(lines[start - 1:end])


LEGEND_HEADER = "/* Perfect Player — 虎扑传奇时代剧情（历史模式启用） */\n"
LEGEND_FOOTER = ""

legend_parts = [
    slice_lines(15762, 15968),
    """
function isCurrentStoryEnabled() {
  return false;
}

function isLegendStoryEnabled() {
  return !!(STATE && STATE.draftMode === 'historical' && STATE.eraStart);
}

""",
    slice_lines(16154, 17161),
    slice_lines(17860, 18622),
]

legend_body = ''.join(legend_parts)
legend_body = re.sub(
    r'function isLegendStoryEnabled\(\) \{[^}]+\}',
    '',
    legend_body,
    count=1,
)
legend_body = re.sub(
    r'function isCurrentStoryEnabled\(\) \{[^}]+\}',
    '',
    legend_body,
    count=1,
)

(ROOT / 'assets/js/perfect-player-legend-story.js').write_text(
    LEGEND_HEADER + legend_body + LEGEND_FOOTER,
    encoding='utf-8',
)

# Life events: reading/brand helpers + STAGED events + violence chain
life_helpers = slice_lines(17786, 17858)
life_events_src = slice_lines(22679, 22968)  # reading_open .. brand_echo block
life_violence = slice_lines(22971, 23146)

life_body = f"""/* Perfect Player — 虎扑读书/品牌/暴力冲突支线（通用模式） */

{life_helpers}

var HUPU_LIFE_BRANCH_EVENTS = [
{life_events_src.strip()}
];

{life_violence}

(function () {{
  'use strict';
  if (typeof STAGED_BRANCH_EVENTS === 'undefined') return;
  HUPU_LIFE_BRANCH_EVENTS.forEach(function (ev) {{
    if (!ev || !ev.id) return;
    if (STAGED_BRANCH_EVENTS.some(function (e) {{ return e.id === ev.id; }})) return;
    STAGED_BRANCH_EVENTS.push(ev);
  }});
}})();
"""

(ROOT / 'assets/js/perfect-player-hupu-life-events.js').write_text(life_body, encoding='utf-8')

print('Wrote perfect-player-legend-story.js and perfect-player-hupu-life-events.js')
