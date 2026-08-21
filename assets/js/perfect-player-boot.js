/* Perfect Player — 开场分步加载 */
(function () {
  'use strict';

  var FILES = [
    ['assets/js/perfect-player-awards.js?v=20260813-real-ballot-v1', '荣誉评选'],
    ['assets/js/perfect-player-event-library.js', '赛季事件'],
    ['assets/js/perfect-player-hupu-extensions.js?v=20260821-boot-v1', '角色扩展'],
    ['assets/js/perfect-player-story-events.js?v=20260820-rival-pool', '生涯剧情'],
    ['assets/js/perfect-player-skills.js?v=20260820-skill-no-slot', '球风技能'],
    ['assets/js/perfect-player-live-court.js?v=20260821-court-v9', '俯瞰球场'],
    ['assets/js/perfect-player-live-sim.js?v=20260821-live-sim-v27', '文字直播'],
    ['assets/js/perfect-player-enhancements.js?v=20260820-legacy-create', '成就特效']
  ];

  function boot() {
    return window.__PP_BOOT;
  }

  function set(p, msg) {
    if (boot() && typeof boot().set === 'function') boot().set(p, msg);
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  function startGame() {
    if (typeof window.__PP_bootStart === 'function') {
      window.__PP_bootStart();
      return;
    }
    if (typeof renderModeSelect === 'function') renderModeSelect();
    if (typeof renderPositionSelect === 'function') renderPositionSelect();
    if (typeof initGame === 'function') initGame();
  }

  function run() {
    set(50, '准备游戏模块');
    var i = 0;
    function next() {
      if (i >= FILES.length) {
        set(94, '打开主菜单');
        try { startGame(); } catch (err) { console.error(err); }
        if (boot() && typeof boot().done === 'function') boot().done();
        return;
      }
      var item = FILES[i];
      var p = 50 + ((i + 1) / FILES.length) * 44;
      set(p, item[1]);
      i += 1;
      loadScript(item[0]).then(next);
    }
    next();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
