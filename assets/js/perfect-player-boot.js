/* Perfect Player — 开场只进主菜单，其余模块进去后再加载 */
(function () {
  'use strict';

  var POOL = 'assets/data/perfect-player-pool.json?v=20260809-static-peak-table';

  var GROUPS = {
    create: [
      ['assets/js/perfect-player-hupu-extensions.js?v=20260821-boot-v1', '角色扩展']
    ],
    career: [
      ['assets/js/perfect-player-skills.js?v=20260820-skill-no-slot', '球风技能'],
      ['assets/js/perfect-player-enhancements.js?v=20260820-legacy-create', '成就特效']
    ],
    story: [
      ['assets/js/perfect-player-event-library.js', '赛季事件'],
      ['assets/js/perfect-player-story-events.js?v=20260820-rival-pool', '生涯剧情'],
      ['assets/js/perfect-player-awards.js?v=20260813-real-ballot-v1', '荣誉评选']
    ],
    live: [
      ['assets/js/perfect-player-live-court.js?v=20260821-court-v10', '俯瞰球场'],
      ['assets/js/perfect-player-live-sim.js?v=20260821-live-sim-v27', '文字直播']
    ]
  };

  var loaded = {};
  var inflight = {};
  var groupWork = {};

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
    if (name === 'career') {
      groupWork[name] = files.reduce(function (p, item) {
        return p.then(function () { return loadScript(item[0]); });
      }, Promise.resolve());
    } else {
      groupWork[name] = Promise.all(files.map(function (item) { return loadScript(item[0]); }));
    }
    return groupWork[name];
  }

  window.__PP_ensure = function (names) {
    if (!Array.isArray(names)) names = [names];
    return Promise.all(names.map(ensureGroup));
  };

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
      return window.__PP_ensure(groups).then(function () {
        wrapped._ppInside = true;
        try {
          var current = window[name];
          var fn = orig;
          if (typeof current === 'function' && current !== wrapped) fn = current;
          return fn.apply(self, args);
        } finally {
          wrapped._ppInside = false;
        }
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
    setTimeout(function () { window.__PP_ensure(['create', 'career']); }, 0);
    setTimeout(function () { window.__PP_ensure('story'); }, 280);
    setTimeout(function () { window.__PP_ensure('live'); }, 900);
  }

  function run() {
    set(90, '打开主菜单');
    try { startBootGame(); } catch (err) { console.error(err); }
    if (boot() && typeof boot().done === 'function') boot().done();
    hookAll();
    warmPool();
    idleLoad();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
