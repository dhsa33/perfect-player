/* Perfect Player — 开场只进主菜单，其余模块进去后再加载 */
(function () {
  'use strict';

  var POOL = 'assets/data/perfect-player-pool.json?v=20260809-static-peak-table';

  var GROUPS = {
    create: [
      ['assets/js/perfect-player-hupu-extensions.js?v=20260823-boot-v17', '角色扩展']
    ],
    career: [
      ['assets/js/perfect-player-skills.js?v=20260823-skill-grant', '球风技能'],
      ['assets/js/perfect-player-enhancements.js?v=20260823-legacy-ui-v2', '成就特效']
    ],
    story: [
      ['assets/js/perfect-player-event-library.js?v=20260821-events-v3', '赛季事件'],
      ['assets/js/perfect-player-story-events.js?v=20260823-story-v8', '生涯剧情'],
      ['assets/js/perfect-player-awards.js?v=20260823-allstar-v3', '荣誉评选'],
      ['assets/js/perfect-player-allstar.js?v=20260823-allstar-v12', '全明星周末']
    ],
    live: [
      ['assets/js/perfect-player-live-court.js?v=20260823-court-v36', '俯瞰球场'],
      ['assets/js/perfect-player-live-sim.js?v=20260823-live-sim-v63', '文字直播']
    ]
  };

  var GATE_MSG = {
    startGame: '正在准备创建角色…',
    manualLoadGame: '正在读取生涯存档…',
    showAwardsScreen: '正在准备奖项…',
    calcSeasonAwards: '正在统计选票…',
    liveOrSkipUserPack: '正在加载球场直播…'
  };

  var loaded = {};
  var inflight = {};
  var groupWork = {};
  var groupReady = {};
  var gateCount = 0;

  function boot() {
    return window.__PP_BOOT;
  }

  function set(p, msg) {
    if (boot() && typeof boot().set === 'function') boot().set(p, msg);
  }

  function loadScript(src) {
    if (loaded[src]) return Promise.resolve(true);
    if (inflight[src]) return inflight[src];
    inflight[src] = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { loaded[src] = true; resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
    return inflight[src];
  }

  function ensureGroup(name) {
    var files = GROUPS[name];
    if (!files) return Promise.resolve();
    if (groupWork[name]) return groupWork[name];
    var work;
    if (name === 'career') {
      work = files.reduce(function (p, item) {
        return p.then(function () { return loadScript(item[0]); });
      }, Promise.resolve());
    } else {
      work = Promise.all(files.map(function (item) { return loadScript(item[0]); }));
    }
    groupWork[name] = work.then(function () {
      groupReady[name] = true;
    });
    return groupWork[name];
  }

  function namesList(names) {
    return Array.isArray(names) ? names : [names];
  }

  window.__PP_ensure = function (names) {
    return Promise.all(namesList(names).map(ensureGroup));
  };

  window.__PP_groupsReady = function (names) {
    return namesList(names).every(function (n) { return !!groupReady[n]; });
  };

  function gateEl() {
    var el = document.getElementById('pp-mod-gate');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pp-mod-gate';
    el.innerHTML = '<div id="pp-mod-gate-card"><div class="loading-balls"><span class="loading-ball"></span><span class="loading-ball"></span><span class="loading-ball"></span></div><div id="pp-mod-gate-msg">正在加载…</div></div>';
    document.body.appendChild(el);
    return el;
  }

  function showGate(msg) {
    gateCount++;
    var el = gateEl();
    var text = el.querySelector('#pp-mod-gate-msg');
    if (text) text.textContent = msg || '正在加载…';
    el.classList.add('is-on');
  }

  function hideGate() {
    gateCount = Math.max(0, gateCount - 1);
    if (gateCount > 0) return;
    var el = document.getElementById('pp-mod-gate');
    if (el) el.classList.remove('is-on');
  }

  function startBootGame() {
    if (typeof window.__PP_bootStart === 'function') {
      window.__PP_bootStart();
      return;
    }
    if (typeof renderModeSelect === 'function') renderModeSelect();
    if (typeof renderPositionSelect === 'function') renderPositionSelect();
    if (typeof initGame === 'function') initGame();
  }

  function hookFn(name, groups, skip) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._ppDeferred) return;
    var wrapped = function () {
      var self = this;
      var args = arguments;
      // 成就等模块会再包一层；若这里再去调 window[name] 会和自己套死，按钮就像没反应。
      if (wrapped._ppInside) return orig.apply(self, args);
      if (typeof skip === 'function' && skip.apply(self, args)) {
        return orig.apply(self, args);
      }
      var run = function () {
        return orig.apply(self, args);
      };
      if (window.__PP_groupsReady(groups)) return run();
      showGate(GATE_MSG[name] || '正在加载…');
      return window.__PP_ensure(groups).then(function () {
        hideGate();
        return run();
      }, function () {
        hideGate();
        return run();
      });
    };
    wrapped._ppDeferred = true;
    window[name] = wrapped;
  }

  function hookAll() {
    hookFn('startGame', ['create']);
    hookFn('manualLoadGame', ['create', 'career', 'story']);
    hookFn('liveOrSkipUserPack', ['live'], function (_opp, options) {
      return !!(options && options.forceSkip);
    });
    hookFn('calcSeasonAwards', ['story']);
    hookFn('showAwardsScreen', ['story']);
  }

  function warmPool() {
    try {
      fetch(POOL, { credentials: 'same-origin' }).catch(function () {});
    } catch (e) {}
  }

  function idleLoad() {
    setTimeout(function () { window.__PP_ensure(['create', 'career', 'story']); }, 0);
    setTimeout(function () { window.__PP_ensure('live'); }, 900);
  }

  function run() {
    set(90, '打开主菜单');
    try { startBootGame(); } catch (err) { console.error(err); }
    if (boot() && typeof boot().done === 'function') boot().done();
    hookAll();
    warmPool();
    idleLoad();
    if (typeof refreshContinueActivityButton === 'function') {
      try { refreshContinueActivityButton(); } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
