/* ============================================================
 * Perfect Player — Enhancements
 * 成就系统 + SVG 动画 + 粒子特效
 * 独立模块：不改动主引擎的核心逻辑，仅通过包裹(monkey-patch)
 * 现有全局函数在关键时刻注入特效与成就检测。
 * All user-facing strings are Simplified Chinese by project convention.
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 小工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function ce(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // 成就数据独立持久化（与主存档解耦），localStorage 直存。
  // 已经合法解锁的成就是跨生涯保留的；但“3 座 MVP / 3 座总冠军”这类
  // 累计条件必须先在同一次生涯中达成，不能把多个新存档的次数相加。
  var ACH_KEY = 'pp_achievements_v1';

  var PP_FX = window.PP_FX = {};

  /* ==================== 样式注入 ==================== */
  function injectStyle() {
    if (document.getElementById('pp-fx-style')) return;
    var css = PP_FX_CSS;
    var s = ce('style'); s.id = 'pp-fx-style'; s.textContent = css;
    document.head.appendChild(s);
  }
  // 成就面板样式（单独数组，拼接进主样式）
  var PP_FX_CSS_PANEL = [
'.pp-ach-panel-overlay{position:fixed;inset:0;z-index:9100;display:flex;align-items:flex-end;justify-content:center;',
'  background:rgba(20,12,4,.55);backdrop-filter:blur(3px);opacity:0;transition:opacity .3s ease}',
'.pp-ach-panel-overlay.show{opacity:1}',
'.pp-ach-panel{width:min(560px,100%);max-height:86vh;display:flex;flex-direction:column;',
'  background:var(--bg,#faf5eb);border-radius:22px 22px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.3);',
'  transform:translateY(100%);transition:transform .36s cubic-bezier(.16,.9,.3,1);padding-bottom:env(safe-area-inset-bottom,0px)}',
'.pp-ach-panel-overlay.show .pp-ach-panel{transform:translateY(0)}',
'.pp-ach-panel-head{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 10px}',
'.pp-ach-panel-title{font-family:var(--font-display,sans-serif);font-size:20px;font-weight:800;color:#2d1f0e}',
'.pp-ach-close{width:32px;height:32px;border-radius:50%;border:none;background:rgba(45,31,14,.08);',
'  color:#2d1f0e;font-size:15px;cursor:pointer;transition:transform .12s}.pp-ach-close:active{transform:scale(.88)}',
'.pp-ach-progress{padding:0 18px 12px}',
'.pp-ach-progress-bar{height:9px;border-radius:6px;background:rgba(45,31,14,.1);overflow:hidden}',
'.pp-ach-progress-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#ff6b35,#f7a600);',
'  transition:width .6s cubic-bezier(.2,.8,.3,1)}',
'.pp-ach-progress-txt{margin-top:6px;font-size:12px;color:#8a7a66;font-weight:600;font-family:var(--font-display,sans-serif)}',
'.pp-ach-grid{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 14px 18px;display:flex;flex-direction:column;gap:8px}',
'.pp-ach-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;',
'  background:var(--bg-card,#fffaf2);border:1.5px solid var(--border,#f0e0cc);transition:transform .12s}',
'.pp-ach-item.locked{opacity:.62;filter:grayscale(.4)}',
'.pp-ach-item.got.rarity-legend{border-color:var(--gold,#f7a600);background:linear-gradient(120deg,#fffaf2,#fff3d9)}',
'.pp-ach-item.got.rarity-epic{border-color:#c9b8f0}.pp-ach-item.got.rarity-rare{border-color:#9fe0d6}',
'.pp-ach-badge{position:relative;width:46px;height:46px;flex:0 0 46px}',
'.pp-ach-badge-ring{position:absolute;inset:0}',
'.pp-ach-badge-ic{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:21px}',
'.pp-ach-item.got .pp-ach-badge-ring .pp-ring-arc{animation:ppRingSpin 4s linear infinite;transform-origin:50% 50%}',
'.pp-ach-meta{flex:1;min-width:0}',
'.pp-ach-name{font-family:var(--font-display,sans-serif);font-size:14.5px;font-weight:800;color:#2d1f0e;',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.pp-ach-desc{font-size:11.5px;color:#8a7a66;line-height:1.35;margin-top:1px}',
'.pp-ach-rarity{font-size:10px;font-weight:800;font-family:var(--font-display,sans-serif);padding:3px 8px;border-radius:20px;',
'  background:rgba(45,31,14,.06);color:#8a7a66;flex:0 0 auto}',
'.pp-ach-item.got.rarity-legend .pp-ach-rarity{background:rgba(247,166,0,.16);color:#c48a00}',
'.pp-ach-item.got.rarity-epic .pp-ach-rarity{background:rgba(183,164,232,.2);color:#7d5fd0}',
'.pp-ach-item.got.rarity-rare .pp-ach-rarity{background:rgba(46,196,182,.16);color:#1f9e91}',
'@media(prefers-reduced-motion:reduce){.pp-ring-arc,.pp-ach-fab::after,.pp-skill-fab::after{animation:none!important}}',
// —— 传承祭坛 ——
'.pp-lg-open-btn{border:none;cursor:pointer;background:linear-gradient(135deg,#b7a4e8,#ff6b35);color:#fff;',
'  font-family:var(--font-display,sans-serif);font-weight:700;font-size:12px;padding:7px 12px;border-radius:20px;',
'  box-shadow:0 3px 10px rgba(183,164,232,.35)}.pp-lg-open-btn:active{transform:scale(.94)}',
'.pp-lg-lp{padding:2px 18px 4px;font-size:13px;color:#8a7a66;font-family:var(--font-display,sans-serif)}',
'.pp-lg-lp b{color:var(--orange,#ff6b35);font-size:17px}',
'.pp-lg-hint{padding:0 18px 10px;font-size:11.5px;color:#9a8a76;line-height:1.5}',
'.pp-lg-grid{gap:10px}',
'.pp-lg-perk{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:14px;background:var(--bg-card,#fffaf2);',
'  border:1.5px solid var(--border,#f0e0cc)}',
'.pp-lg-perk.maxed{border-color:#c9b8f0;background:linear-gradient(120deg,#fffaf2,#f4eeff)}',
'.pp-lg-perk-ic{width:40px;height:40px;flex:0 0 40px;border-radius:12px;background:var(--orange-dim,rgba(255,107,53,.1));',
'  display:flex;align-items:center;justify-content:center;font-size:20px}',
'.pp-lg-perk-body{flex:1;min-width:0}',
'.pp-lg-perk-name{font-family:var(--font-display,sans-serif);font-size:14px;font-weight:800;color:#2d1f0e}',
'.pp-lg-lvl{font-size:11px;color:#8a7a66;font-weight:600}',
'.pp-lg-perk-desc{font-size:11.5px;color:#8a7a66;margin:1px 0 4px;line-height:1.4}',
'.pp-lg-pips{display:flex;gap:4px}',
'.pp-lg-pip{width:14px;height:6px;border-radius:3px;background:rgba(45,31,14,.12)}',
'.pp-lg-pip.on{background:linear-gradient(90deg,#ff6b35,#f7a600)}',
'.pp-lg-buy{flex:0 0 auto;border:none;cursor:pointer;background:var(--orange,#ff6b35);color:#fff;font-weight:800;',
'  font-family:var(--font-display,sans-serif);font-size:13px;padding:9px 12px;border-radius:11px;min-width:56px;',
'  box-shadow:0 3px 0 #c94d1e}.pp-lg-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #c94d1e}',
'.pp-lg-buy:disabled{opacity:.4;box-shadow:none;cursor:not-allowed}',
'.pp-lg-foot{padding:10px 18px 18px}',
'.pp-lg-respec{width:100%;border:1.5px dashed var(--border,#f0e0cc);background:transparent;color:#8a7a66;',
'  font-size:12px;padding:9px;border-radius:11px;cursor:pointer}.pp-lg-respec:active{transform:scale(.98)}',
'.pp-skill-item{align-items:flex-start}',
'.pp-skill-item.ready{border-color:#ff6b35;background:linear-gradient(120deg,#fffaf2,#fff4ea)}',
'.pp-skill-item.active{border-color:#ff8a5c;background:linear-gradient(120deg,#fffaf2,#fff1e6)}',
'.pp-skill-item.maxed{border-color:#c9b8f0;background:linear-gradient(120deg,#fffaf2,#f4eeff)}',
'.pp-skill-item.down{border-color:#e8a87c;background:linear-gradient(120deg,#fffaf2,#fff6ea)}',
'.pp-skill-conds{margin-top:6px;display:flex;flex-direction:column;gap:3px}',
'.pp-skill-cond{font-size:11px;color:#8a7a66;line-height:1.35}',
'.pp-skill-cond.on{color:#1f9e91;font-weight:700}',
'.pp-skill-effect{margin-top:5px;font-size:11.5px;color:#2d1f0e;line-height:1.4;font-weight:600}',
'.pp-skill-group{font-size:10px;color:#c48a00;font-weight:700;letter-spacing:.4px;margin-bottom:1px}',
'.pp-lg-pip.owned{background:rgba(255,107,53,.38)}',
'.pp-skill-fab-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;',
'  border-radius:9px;background:#f7a600;color:#2d1f0e;font-size:10px;font-weight:800;',
'  display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.2)}',
''
];

  var PP_FX_CSS = [
'.pp-fx-layer{position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden}',
'.pp-spark{position:fixed;border-radius:50%;pointer-events:none;will-change:transform,opacity;',
'  animation:ppSpark .95s cubic-bezier(.18,.7,.35,1) forwards}',
'@keyframes ppSpark{0%{transform:translate(-50%,-50%) scale(.4) rotate(0);opacity:1}',
'  70%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.9) rotate(var(--rot));opacity:0}}',
'.pp-confetti{position:fixed;top:-18px;pointer-events:none;will-change:transform,opacity;',
'  animation:ppConfetti linear forwards}',
'@keyframes ppConfetti{0%{transform:translateY(-10px) translateX(0) rotate(0);opacity:1}',
'  100%{transform:translateY(105vh) translateX(var(--sway)) rotate(var(--spin));opacity:.9}}',
'.pp-floattext{position:fixed;transform:translate(-50%,-50%);font-family:var(--font-display,sans-serif);',
'  font-weight:800;font-size:15px;color:var(--orange,#ff6b35);text-shadow:0 1px 3px rgba(0,0,0,.25);',
'  pointer-events:none;animation:ppFloat 1.3s ease-out forwards}',
'@keyframes ppFloat{0%{opacity:0;transform:translate(-50%,-40%) scale(.7)}20%{opacity:1}',
'  100%{opacity:0;transform:translate(-50%,-160%) scale(1.05)}}',
'.pp-toast-wrap{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));',
'  transform:translateX(-50%);z-index:9200;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}',
'.pp-toast{display:flex;align-items:center;gap:8px;max-width:86vw;padding:11px 16px;border-radius:14px;',
'  background:rgba(45,31,14,.92);color:#fff7ec;font-family:var(--font-body,sans-serif);font-size:13.5px;font-weight:600;',
'  box-shadow:0 8px 26px rgba(0,0,0,.3);backdrop-filter:blur(6px);opacity:0;transform:translateY(14px) scale(.96);',
'  transition:opacity .28s ease,transform .28s cubic-bezier(.2,.8,.3,1);border:1.5px solid rgba(255,107,53,.35)}',
'.pp-toast.show{opacity:1;transform:translateY(0) scale(1)}',
'.pp-toast.gold{border-color:var(--gold,#f7a600);background:linear-gradient(135deg,rgba(80,55,10,.95),rgba(45,31,14,.95))}',
'.pp-toast-ic{font-size:17px;line-height:1}.pp-toast-msg{line-height:1.4}',
// —— 成就入口悬浮按钮 ——
'.pp-ach-fab{position:fixed;right:calc(12px + env(safe-area-inset-right,0px));',
'  bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:8800;width:50px;height:50px;border-radius:50%;',
'  border:none;cursor:pointer;background:linear-gradient(145deg,#ff8a5c,#ff6b35);color:#fff;font-size:22px;',
'  box-shadow:0 6px 18px rgba(255,107,53,.42),inset 0 2px 4px rgba(255,255,255,.35);',
'  display:none;align-items:center;justify-content:center;transition:transform .15s ease;animation:ppFabIn .5s ease}',
'.pp-ach-fab.is-on{display:flex}',
'.pp-ach-fab:active{transform:scale(.9)}',
'.pp-ach-fab::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(255,107,53,.5);',
'  animation:ppFabPulse 2.4s ease-out infinite}',
'@keyframes ppFabPulse{0%{transform:scale(.85);opacity:.7}100%{transform:scale(1.4);opacity:0}}',
'@keyframes ppFabIn{from{transform:scale(0) rotate(-40deg);opacity:0}to{transform:scale(1);opacity:1}}',
'.pp-ach-fab-ic{filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))}',
'.pp-skill-fab{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));',
'  bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:8800;width:50px;height:50px;border-radius:50%;',
'  border:none;cursor:pointer;background:linear-gradient(145deg,#ff8a5c,#ff6b35);color:#fff;font-size:22px;',
'  box-shadow:0 6px 18px rgba(255,107,53,.42),inset 0 2px 4px rgba(255,255,255,.35);',
'  display:none;align-items:center;justify-content:center;transition:transform .15s ease;animation:ppFabIn .5s ease}',
'.pp-skill-fab.is-on{display:flex}',
'.pp-skill-fab:active{transform:scale(.9)}',
'.pp-skill-fab::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(255,107,53,.5);',
'  animation:ppFabPulse 2.4s ease-out infinite}',
'.pp-skill-fab-ic{filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))}',
// —— 解锁弹窗 ——
'.pp-ach-pop{position:fixed;top:calc(14px + env(safe-area-inset-top,0px));left:50%;',
'  transform:translate(-50%,-140%);z-index:9300;display:flex;align-items:center;gap:12px;width:min(360px,92vw);',
'  padding:12px 16px 12px 12px;border-radius:16px;background:linear-gradient(135deg,#fffaf2,#fff2d9);',
'  box-shadow:0 14px 40px rgba(45,31,14,.28);border:2px solid var(--gold,#f7a600);',
'  transition:transform .5s cubic-bezier(.16,.9,.3,1.1),opacity .4s ease;opacity:0;pointer-events:none}',
'.pp-ach-pop.show{transform:translate(-50%,0);opacity:1}',
'.pp-ach-pop.rarity-common{border-color:#9fb0bf}.pp-ach-pop.rarity-rare{border-color:#2ec4b6}',
'.pp-ach-pop.rarity-epic{border-color:#b7a4e8}.pp-ach-pop.rarity-legend{border-color:var(--gold,#f7a600);',
'  background:linear-gradient(135deg,#fff7e6,#ffe9c2)}',
'.pp-ach-pop-ring{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:52px;height:52px;pointer-events:none}',
'.pp-ach-pop-ic{width:52px;height:52px;flex:0 0 52px;display:flex;align-items:center;justify-content:center;',
'  font-size:26px;position:relative;z-index:1}',
'.pp-ach-pop-body{flex:1;min-width:0}',
'.pp-ach-pop-tag{font-family:var(--font-display,sans-serif);font-size:10px;font-weight:800;letter-spacing:1px;',
'  color:var(--orange,#ff6b35);text-transform:uppercase}',
'.pp-ach-pop-name{font-family:var(--font-display,sans-serif);font-size:17px;font-weight:800;color:#2d1f0e;margin:1px 0 2px}',
'.pp-ach-pop-desc{font-size:12px;color:#8a7a66;line-height:1.35}',
'.pp-ring-arc{animation:ppRingSpin 3.4s linear infinite;transform-origin:50% 50%}',
'@keyframes ppRingSpin{to{transform:rotate(270deg)}}',
''
].concat(PP_FX_CSS_PANEL).join('\n');
  injectStyle();

  /* ==================== 粒子特效引擎 ==================== */
  var fxLayer = null;
  function ensureLayer() {
    if (fxLayer && document.body.contains(fxLayer)) return fxLayer;
    fxLayer = ce('div'); fxLayer.className = 'pp-fx-layer';
    document.body.appendChild(fxLayer);
    return fxLayer;
  }

  // 尊重"减少动态效果"无障碍偏好
  function reduceMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  var FX_COLORS = ['#ff6b35', '#f7a600', '#2ec4b6', '#ff8a5c', '#ffd23f', '#e63946'];

  // 从某个屏幕坐标向外炸开的火花/彩带
  PP_FX.burst = function (x, y, opts) {
    if (reduceMotion()) return;
    opts = opts || {};
    var layer = ensureLayer();
    var count = opts.count || 26;
    var colors = opts.colors || FX_COLORS;
    var spread = opts.spread || 150;
    for (var i = 0; i < count; i++) {
      var p = ce('span', 'pp-spark');
      var ang = rand(0, Math.PI * 2);
      var dist = rand(spread * 0.35, spread);
      var dx = Math.cos(ang) * dist;
      var dy = Math.sin(ang) * dist - rand(10, 50); // 略微上飘
      var sz = rand(6, 12);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.width = sz + 'px'; p.style.height = sz + 'px';
      p.style.background = colors[(Math.random() * colors.length) | 0];
      p.style.setProperty('--dx', dx.toFixed(1) + 'px');
      p.style.setProperty('--dy', dy.toFixed(1) + 'px');
      p.style.setProperty('--rot', (rand(-360, 360)).toFixed(0) + 'deg');
      p.style.animationDelay = rand(0, 0.08).toFixed(2) + 's';
      if (Math.random() < 0.5) p.style.borderRadius = '2px';
      layer.appendChild(p);
      (function (el) { setTimeout(function () { el.remove(); }, 1200); })(p);
    }
  };

  // 从元素中心炸开
  PP_FX.burstFrom = function (el, opts) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    PP_FX.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
  };

  // 全屏彩带雨（用于重大时刻）
  PP_FX.confetti = function (opts) {
    if (reduceMotion()) return;
    opts = opts || {};
    var layer = ensureLayer();
    var count = opts.count || 90;
    var colors = opts.colors || FX_COLORS;
    var dur = opts.duration || 3200;
    for (var i = 0; i < count; i++) {
      var c = ce('span', 'pp-confetti');
      c.style.left = rand(0, 100).toFixed(2) + '%';
      c.style.background = colors[(Math.random() * colors.length) | 0];
      var w = rand(6, 11);
      c.style.width = w + 'px';
      c.style.height = rand(9, 16) + 'px';
      c.style.animationDelay = rand(0, 1.6).toFixed(2) + 's';
      c.style.animationDuration = rand(2.2, 3.6).toFixed(2) + 's';
      c.style.setProperty('--sway', rand(-70, 70).toFixed(0) + 'px');
      c.style.setProperty('--spin', rand(-720, 720).toFixed(0) + 'deg');
      if (Math.random() < 0.4) c.style.borderRadius = '50%';
      layer.appendChild(c);
      (function (el) { setTimeout(function () { el.remove(); }, dur + 1200); })(c);
    }
  };

  // 屏幕点击涟漪 + 小火花（轻量的全局手感提升）
  PP_FX.tapSpark = function (x, y) {
    if (reduceMotion()) return;
    PP_FX.burst(x, y, { count: 7, spread: 46 });
  };

  // 数字上扬的漂浮文字（如"+2 三分"）
  PP_FX.floatText = function (x, y, text, color) {
    var layer = ensureLayer();
    var t = ce('div', 'pp-floattext');
    t.textContent = text;
    t.style.left = x + 'px'; t.style.top = y + 'px';
    if (color) t.style.color = color;
    layer.appendChild(t);
    setTimeout(function () { t.remove(); }, 1400);
  };

  // 华丽 toast（主引擎的 showToast 是空实现，这里补上一个带 SVG 光环的提示）
  var toastWrap = null;
  PP_FX.toast = function (msg, opts) {
    opts = opts || {};
    if (!toastWrap || !document.body.contains(toastWrap)) {
      toastWrap = ce('div', 'pp-toast-wrap');
      document.body.appendChild(toastWrap);
    }
    var t = ce('div', 'pp-toast' + (opts.gold ? ' gold' : ''));
    t.innerHTML = (opts.icon ? '<span class="pp-toast-ic">' + opts.icon + '</span>' : '') +
      '<span class="pp-toast-msg">' + msg + '</span>';
    toastWrap.appendChild(t);
    // 触发进入动画
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, opts.duration || 2600);
  };

  /* ==================== 成就系统 ==================== */
  // 每个成就：id / 图标 / 名称 / 描述 / 稀有度(common|rare|epic|legend)
  // 稀有度只影响解锁弹窗与徽章配色。
  var ACHIEVEMENTS = [
    // — 起步 —
    { id: 'create_player', icon: '🏀', name: '梦开始的地方', desc: '创建你的第一位球员', rarity: 'common' },
    { id: 'ovr_80', icon: '📈', name: '天赋兑现', desc: '揭晓时综合能力达到 80', rarity: 'rare' },
    { id: 'ovr_90', icon: '💎', name: '天选之子', desc: '揭晓时综合能力达到 90', rarity: 'epic' },
    { id: 'ovr_95', icon: '👑', name: '降维打击', desc: '揭晓时综合能力达到 95', rarity: 'legend' },
    // — 选秀 —
    { id: 'lottery_pick', icon: '🎯', name: '乐透秀', desc: '在选秀乐透区(前14顺位)被选中', rarity: 'rare' },
    { id: 'first_pick', icon: '🥇', name: '状元登基', desc: '成为选秀状元(第1顺位)', rarity: 'epic' },
    { id: 'undrafted', icon: '🔥', name: '落选逆袭', desc: '落选后依然踏上 NBA 赛场', rarity: 'rare' },
    // — 个人荣誉 —
    { id: 'all_star', icon: '⭐', name: '全明星首秀', desc: '首次入选全明星', rarity: 'rare' },
    { id: 'all_nba', icon: '🌟', name: '最佳阵容', desc: '入选一届最佳阵容', rarity: 'epic' },
    { id: 'roty', icon: '🌱', name: '年度最佳新秀', desc: '拿下最佳新秀', rarity: 'epic' },
    { id: 'dpoy', icon: '🔒', name: '防守中枢', desc: '当选最佳防守球员', rarity: 'epic' },
    { id: 'sixth_man', icon: '🛋️', name: '超级第六人', desc: '当选最佳第六人', rarity: 'rare' },
    { id: 'mvp', icon: '🏆', name: '联盟 MVP', desc: '荣膺常规赛最有价值球员', rarity: 'legend' },
    { id: 'fmvp', icon: '👑', name: '总决赛 MVP', desc: '荣膺总决赛最有价值球员', rarity: 'legend' },
    { id: 'mvp_x3', icon: '🐐', name: 'MVP 王朝', desc: '同一生涯累计 3 座常规赛 MVP', rarity: 'legend' },
    // — 球队战绩 —
    { id: 'playoffs', icon: '🎟️', name: '季后赛门票', desc: '首次带队打进季后赛', rarity: 'common' },
    { id: 'win_60', icon: '🎊', name: '60 胜赛季', desc: '单赛季常规赛拿下 60 胜', rarity: 'epic' },
    { id: 'champion', icon: '🏆', name: '总冠军', desc: '夺得总冠军', rarity: 'legend' },
    { id: 'champion_x3', icon: '💍', name: '三连话题', desc: '同一生涯累计 3 座总冠军', rarity: 'legend' },
    // — 数据里程碑（单场） —
    { id: 'game_40', icon: '🔥', name: '40 分之夜', desc: '单场砍下 40+ 得分', rarity: 'rare' },
    { id: 'game_50', icon: '💥', name: '50 分神迹', desc: '单场砍下 50+ 得分', rarity: 'epic' },
    { id: 'triple_double', icon: '🎰', name: '三双', desc: '单场砍下三双', rarity: 'rare' },
    // — 数据里程碑（赛季场均） —
    { id: 'avg_30', icon: '📊', name: '得分机器', desc: '赛季场均 30+ 得分', rarity: 'epic' },
    { id: 'season_25_10', icon: '🧱', name: '两双基石', desc: '赛季场均 25 分 10 板', rarity: 'epic' },
    // — 生涯长度 —
    { id: 'season_5', icon: '📅', name: '中生代', desc: '效力满 5 个赛季', rarity: 'common' },
    { id: 'season_10', icon: '🏛️', name: '一朝元老', desc: '效力满 10 个赛季', rarity: 'rare' },
    { id: 'retire', icon: '🎓', name: '功成身退', desc: '完成一段完整生涯并退役', rarity: 'epic' },
    // — 彩蛋 —
    { id: 'explorer', icon: '🧭', name: '成就猎人', desc: '解锁 10 个成就', rarity: 'rare' },
    { id: 'collector', icon: '🗂️', name: '收藏家', desc: '解锁 20 个成就', rarity: 'legend' }
  ];
  PP_FX.ACHIEVEMENTS = ACHIEVEMENTS;
  var ACH_MAP = {};
  ACHIEVEMENTS.forEach(function (a) { ACH_MAP[a.id] = a; });

  var RARITY_CN = { common: '普通', rare: '稀有', epic: '史诗', legend: '传奇' };

  function loadUnlocked() {
    try {
      var raw = localStorage.getItem(ACH_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }
  function saveUnlocked(map) {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(map)); } catch (e) {}
  }

  var unlocked = loadUnlocked();
  PP_FX.getUnlocked = function () { return unlocked; };

  // 一次性补发：防守中枢(DPOY) + 超级第六人。传承点由稀有度自动计入（史诗4 + 稀有2）。
  (function grantMissingAwardAchievements() {
    var GRANT_KEY = 'pp_grant_dpoy_sixth_v1';
    try { if (localStorage.getItem(GRANT_KEY) === '1') return; } catch (e) {}
    var now = Date.now();
    var added = false;
    [
      { id: 'dpoy', fact: 'dpoy' },
      { id: 'sixth_man', fact: 'sixthman' }
    ].forEach(function (item) {
      if (unlocked[item.id]) return;
      unlocked[item.id] = {
        at: now,
        factEvidence: { version: 1, gameId: 'manual-grant', fact: item.fact, count: 1 }
      };
      added = true;
    });
    if (added) saveUnlocked(unlocked);
    try { localStorage.setItem(GRANT_KEY, '1'); } catch (e) {}
  })();

  // 已解锁的"真实成就"数量：只统计存在于 ACH_MAP 的键，
  // 排除 __counters 等内部记账键（否则会把进度算多，甚至 29/28 > 100%）。
  function unlockedCount() {
    var n = 0;
    for (var k in unlocked) { if (Object.prototype.hasOwnProperty.call(unlocked, k) && ACH_MAP[k]) n++; }
    return n;
  }
  PP_FX.unlockedCount = unlockedCount;

  // 解锁一个成就；已解锁则忽略。返回是否为新解锁。
  PP_FX.unlock = function (id, evidence) {
    var def = ACH_MAP[id];
    if (!def) return false;
    if (unlocked[id]) {
      // 旧版累计成就只有解锁时间，没有“同一生涯达成”的凭证。当前生涯
      // 确实达到门槛时补写凭证，之后换新生涯也可正常永久保留。
      if (evidence && !unlocked[id].singleCareer) {
        unlocked[id].singleCareer = evidence;
        saveUnlocked(unlocked);
      }
      return false;
    }
    unlocked[id] = { at: Date.now() };
    if (evidence) unlocked[id].singleCareer = evidence;
    saveUnlocked(unlocked);
    if (!PP_FX._suppressAchievementPopups) showUnlockPopup(def);
    // 元成就：解锁数量里程碑（延迟以免与当前弹窗叠加）
    var n = unlockedCount();
    if (!PP_FX._suppressAchievementPopups) {
      if (n >= 10 && !unlocked['explorer']) setTimeout(function () { PP_FX.unlock('explorer'); }, 2600);
      if (n >= 20 && !unlocked['collector']) setTimeout(function () { PP_FX.unlock('collector'); }, 2600);
    }
    return true;
  };

  // Deterministic reconciliation used after migrations/tests; normal gameplay
  // keeps the delayed popup cadence above.
  PP_FX.syncMetaAchievements = function () {
    var n = unlockedCount();
    if (n >= 10 && !unlocked.explorer) PP_FX.unlock('explorer');
    n = unlockedCount();
    if (n >= 20 && !unlocked.collector) PP_FX.unlock('collector');
    return unlockedCount();
  };

  // 解锁弹窗（右上滑入的徽章卡片 + 粒子）
  var unlockQueue = [];
  var unlockBusy = false;
  function showUnlockPopup(def) {
    unlockQueue.push(def);
    if (!unlockBusy) drainUnlockQueue();
  }
  function drainUnlockQueue() {
    if (unlockQueue.length === 0) { unlockBusy = false; return; }
    unlockBusy = true;
    var def = unlockQueue.shift();
    var card = ce('div', 'pp-ach-pop rarity-' + def.rarity);
    card.innerHTML =
      '<div class="pp-ach-pop-ring">' + achRingSVG(def.rarity) + '</div>' +
      '<div class="pp-ach-pop-ic">' + def.icon + '</div>' +
      '<div class="pp-ach-pop-body">' +
        '<div class="pp-ach-pop-tag">成就解锁 · ' + (RARITY_CN[def.rarity] || '') + '</div>' +
        '<div class="pp-ach-pop-name">' + def.name + '</div>' +
        '<div class="pp-ach-pop-desc">' + def.desc + '</div>' +
      '</div>';
    document.body.appendChild(card);
    requestAnimationFrame(function () { card.classList.add('show'); });
    // 粒子庆祝
    setTimeout(function () { PP_FX.burstFrom(card, { count: def.rarity === 'legend' ? 34 : 20 }); }, 260);
    try {
      if (window.navigator && navigator.vibrate) navigator.vibrate(def.rarity === 'legend' ? [30, 40, 60] : 25);
    } catch (e) {}
    var hold = def.rarity === 'legend' ? 4200 : 3200;
    setTimeout(function () {
      card.classList.remove('show');
      setTimeout(function () { card.remove(); drainUnlockQueue(); }, 420);
    }, hold);
  }

  // 徽章旋转光环 SVG（按稀有度换配色）
  function achRingSVG(rarity) {
    var stops = {
      common: ['#b8c4cf', '#7f92a2'],
      rare: ['#5db9d6', '#2ec4b6'],
      epic: ['#b7a4e8', '#ff6b35'],
      legend: ['#f7a600', '#ff6b35']
    }[rarity] || ['#ff6b35', '#f7a600'];
    var gid = 'ppg_' + rarity;
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' + stops[0] + '"/><stop offset="100%" stop-color="' + stops[1] + '"/>' +
      '</linearGradient></defs>' +
      '<circle class="pp-ring-track" cx="50" cy="50" r="44" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="5"/>' +
      '<circle class="pp-ring-arc" cx="50" cy="50" r="44" fill="none" stroke="url(#' + gid + ')" stroke-width="5" ' +
      'stroke-linecap="round" stroke-dasharray="210 300" transform="rotate(-90 50 50)"/>' +
      '</svg>';
  }
  PP_FX.achRingSVG = achRingSVG;

  /* ==================== 成就面板 ==================== */
  PP_FX.openPanel = function () {
    // 读档后先按当前生涯事实重新校验，及时撤回旧版重复计数造成的误解锁。
    syncAchievementState();
    var existing = $('pp-ach-panel');
    if (existing) existing.remove();
    var total = ACHIEVEMENTS.length;
    var got = unlockedCount();
    var pct = Math.round(got / total * 100);
    var cards = ACHIEVEMENTS.map(function (a) {
      var has = !!unlocked[a.id];
      return '<div class="pp-ach-item rarity-' + a.rarity + (has ? ' got' : ' locked') + '">' +
        '<div class="pp-ach-badge">' +
          '<div class="pp-ach-badge-ring">' + achRingSVG(a.rarity) + '</div>' +
          '<div class="pp-ach-badge-ic">' + (has ? a.icon : '🔒') + '</div>' +
        '</div>' +
        '<div class="pp-ach-meta">' +
          '<div class="pp-ach-name">' + (has ? a.name : '？？？') + '</div>' +
          '<div class="pp-ach-desc">' + a.desc + '</div>' +
        '</div>' +
        '<div class="pp-ach-rarity">' + (RARITY_CN[a.rarity] || '') + '</div>' +
      '</div>';
    }).join('');
    var overlay = ce('div'); overlay.id = 'pp-ach-panel'; overlay.className = 'pp-ach-panel-overlay';
    overlay.innerHTML =
      '<div class="pp-ach-panel">' +
        '<div class="pp-ach-panel-head">' +
          '<div class="pp-ach-panel-title">🏅 成就殿堂</div>' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
            '<button class="pp-lg-open-btn" id="pp-ach-to-legacy">🧬 传承祭坛</button>' +
            '<button class="pp-ach-close" id="pp-ach-close" aria-label="关闭">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="pp-ach-progress">' +
          '<div class="pp-ach-progress-bar"><div class="pp-ach-progress-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="pp-ach-progress-txt">已解锁 ' + got + ' / ' + total + '（' + pct + '%）</div>' +
        '</div>' +
        '<div class="pp-ach-grid">' + cards + '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    function close() { overlay.classList.remove('show'); setTimeout(function () { overlay.remove(); }, 300); }
    $('pp-ach-close').onclick = close;
    var toLg = $('pp-ach-to-legacy');
    if (toLg) toLg.onclick = function () { close(); setTimeout(PP_FX.openLegacyPanel, 260); };
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  };

  // 测试/调试：全部清空
  PP_FX.resetAchievements = function () { unlocked = {}; saveUnlocked(unlocked); };

  /* ==================== 技能手册 ==================== */
  // 球风技由 PP_SKILLS 记账；老将保养仍是条件技，不花球风点。
  function currentCareerAge() {
    try {
      var s = (typeof STATE !== 'undefined') ? STATE : window.STATE;
      return Number(s && s.career && s.career.currentAge) || 0;
    } catch (e) { return 0; }
  }

  function inspectVeteranMaintenance() {
    var age = currentCareerAge();
    var level = 0;
    try {
      if (typeof getVeteranMaintenanceLevel === 'function') level = Number(getVeteranMaintenanceLevel(age)) || 0;
    } catch (e) {}
    var mods = {};
    var profile = {};
    try { if (typeof getNextSeasonMods === 'function') mods = getNextSeasonMods() || {}; } catch (e) {}
    try { if (typeof getCareerProfile === 'function') profile = getCareerProfile() || {}; } catch (e) {}
    var stamina = 0;
    try {
      if (typeof getStaminaAttr === 'function') stamina = Number(getStaminaAttr()) || 0;
      else {
        var st = (typeof STATE !== 'undefined') ? STATE : window.STATE;
        stamina = Math.max(0, Number(st && st.attrs && st.attrs.STA) || 0);
      }
    } catch (e) {}
    var conds = [
      { ok: (Number(mods.staminaLoad) || 0) <= -2, text: '体能负荷 ≤ -2' },
      { ok: (Number(mods.injuryRiskBonus) || 0) <= -2, text: '伤病风险 ≤ -2' },
      { ok: (Number(profile.coachTrust) || 0) >= 10, text: '教练信任 ≥ 10' },
      { ok: stamina >= 3, text: '耐力 ' + stamina + ' / 3（满后额外 +1 级）' }
    ];
    var eligible = age >= 31;
    if (!eligible) level = 0;
    var activated = eligible && level > 0;
    var canUpgrade = eligible && level < 3;
    var effect = !eligible
      ? '31 岁后，满足保养条件即可激活。耐力攒满后还能再升一级。'
      : (level >= 3
        ? '老化掉点经常能扛住；34 岁后再掉，也还会留一点底。'
        : (level >= 2
          ? '老化掉点多半能扛住一次；34 岁后再掉，也还会留一点底。'
          : (level === 1
            ? '老化掉点偶尔能扛住一次；34 岁后再掉，也还会留一点底。'
            : '已满 31 岁，达成下方任意一条即可激活。')));
    var status = !eligible ? '未解锁' : (level >= 3 ? '满级' : (activated ? '可升级' : '可激活'));
    return {
      id: 'veteran_maintenance',
      icon: '🛡️',
      name: '老将保养',
      group: '条件',
      desc: '31 岁起根据体能负荷、伤病风险和教练信任判定等级；耐力 ≥ 3 时额外 +1 级，最高 Lv.3。',
      max: 3,
      purchased: level,
      level: level,
      effective: level,
      age: age,
      eligible: eligible,
      activated: activated,
      canUpgrade: canUpgrade,
      canBuy: false,
      tokenSkill: false,
      status: status,
      effect: effect,
      conds: conds
    };
  }

  function listSkills() {
    var style = (typeof PP_SKILLS !== 'undefined' && PP_SKILLS.listStyleSkills)
      ? PP_SKILLS.listStyleSkills()
      : [];
    return style.concat([inspectVeteranMaintenance()]);
  }

  function skillPipsHtml(skill) {
    var html = '';
    var purchased = Number(skill.purchased != null ? skill.purchased : skill.level) || 0;
    var effective = Number(skill.effective != null ? skill.effective : skill.level) || 0;
    for (var i = 0; i < (skill.max || 1); i++) {
      var cls = 'pp-lg-pip';
      if (i < effective) cls += ' on';
      else if (i < purchased) cls += ' owned';
      html += '<span class="' + cls + '"></span>';
    }
    return html;
  }

  function skillCardHtml(skill) {
    var active = !!skill.activated;
    var maxed = skill.tokenSkill ? (skill.purchased >= skill.max) : (skill.level >= (skill.max || 1));
    var down = !!(skill.tokenSkill && skill.purchased > skill.effective);
    var cls = 'pp-ach-item pp-skill-item' + (down ? ' down' : (maxed ? ' maxed' : (active ? ' active' : (skill.canBuy ? ' ready' : ' locked'))));
    var condHtml = (skill.conds || []).map(function (c) {
      return '<div class="pp-skill-cond' + (c.ok ? ' on' : '') + '">' + (c.ok ? '✓ ' : '○ ') + c.text + '</div>';
    }).join('');
    var lvlLabel;
    if (skill.tokenSkill && skill.purchased !== skill.effective) {
      lvlLabel = '已购 Lv.' + skill.purchased + ' / 生效 Lv.' + skill.effective;
    } else {
      lvlLabel = 'Lv.' + (skill.tokenSkill ? skill.purchased : skill.level) + '/' + skill.max;
    }
    var btn = '';
    if (skill.tokenSkill) {
      var label = maxed ? '满级' : ((skill.purchased <= 0 ? '激活 ' : '升级 ') + skill.cost);
      if (!skill.canBuy && !maxed) {
        if (down) label = '降效中';
        else if (skill.status.indexOf('互斥') >= 0) label = '互斥';
        else if (skill.status === '属性未达标' || skill.status === '未点亮') label = '未达标';
        else if (skill.status === '球风点不足') label = '⚡ ' + skill.cost;
      }
      btn = '<button class="pp-lg-buy pp-skill-buy" data-skill="' + skill.id + '"' + (skill.canBuy ? '' : ' disabled') + '>' +
        label + '</button>';
    }
    return '<div class="' + cls + '">' +
      '<div class="pp-ach-badge">' +
        '<div class="pp-ach-badge-ring">' + achRingSVG(maxed ? 'epic' : (active ? 'rare' : 'common')) + '</div>' +
        '<div class="pp-ach-badge-ic">' + (active || maxed || down || skill.canBuy ? skill.icon : '🔒') + '</div>' +
      '</div>' +
      '<div class="pp-ach-meta">' +
        (skill.group ? '<div class="pp-skill-group">' + skill.group + '</div>' : '') +
        '<div class="pp-ach-name">' + skill.name + ' <span class="pp-lg-lvl">' + lvlLabel + '</span></div>' +
        '<div class="pp-ach-desc">' + skill.desc + '</div>' +
        '<div class="pp-lg-pips" style="margin-top:5px;">' + skillPipsHtml(skill) + '</div>' +
        '<div class="pp-skill-effect">' + skill.effect + '</div>' +
        (condHtml ? '<div class="pp-skill-conds">' + condHtml + '</div>' : '') +
      '</div>' +
      (btn || '<div class="pp-ach-rarity">' + skill.status + '</div>') +
    '</div>';
  }

  function refreshSkillFabBadge() {
    var btn = $('pp-skill-fab');
    if (!btn) return;
    var pts = 0;
    try {
      if (typeof PP_SKILLS !== 'undefined') pts = PP_SKILLS.availableStylePoints();
    } catch (e) {}
    var badge = btn.querySelector('.pp-skill-fab-badge');
    if (!badge) {
      badge = ce('span', 'pp-skill-fab-badge');
      btn.appendChild(badge);
    }
    if (pts > 0) {
      badge.textContent = pts > 99 ? '99+' : String(pts);
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
  PP_FX.refreshSkillFabBadge = refreshSkillFabBadge;

  function isCareerActivityScreen() {
    var menu = $('screen-menu');
    if (menu && menu.classList.contains('active')) return false;
    var screens = document.querySelectorAll('.screen.active');
    return screens.length > 0;
  }

  function isCharacterCreateScreen() {
    var ids = ['screen-character', 'screen-build', 'screen-position'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el && el.classList.contains('active')) return true;
    }
    return false;
  }

  function closeLegacyUi() {
    ['pp-ach-panel', 'pp-legacy-panel'].forEach(function (id) {
      var panel = $(id);
      if (panel) panel.remove();
    });
  }

  function syncAchFabVisibility() {
    var btn = $('pp-ach-fab');
    if (!btn) return;
    var show = isCharacterCreateScreen();
    if (show) btn.classList.add('is-on');
    else {
      btn.classList.remove('is-on');
      closeLegacyUi();
    }
  }
  PP_FX.syncAchFabVisibility = syncAchFabVisibility;

  function syncSkillFabVisibility() {
    var btn = $('pp-skill-fab');
    if (!btn) return;
    var show = isCareerActivityScreen() && !isCharacterCreateScreen();
    if (show) btn.classList.add('is-on');
    else {
      btn.classList.remove('is-on');
      var panel = $('pp-skill-panel');
      if (panel) panel.remove();
    }
    if (show) refreshSkillFabBadge();
  }
  PP_FX.syncSkillFabVisibility = syncSkillFabVisibility;

  function syncHudFabs() {
    syncAchFabVisibility();
    syncSkillFabVisibility();
  }
  PP_FX.syncHudFabs = syncHudFabs;

  PP_FX.buyStyleSkill = function (id) {
    if (typeof PP_SKILLS === 'undefined') return false;
    var r = PP_SKILLS.buyStyleSkill(id);
    if (!r || !r.ok) {
      if (r && r.reason) PP_FX.toast(r.reason, { icon: '⚡' });
      return false;
    }
    try { if (typeof autoSaveGame === 'function') autoSaveGame(); } catch (e) {}
    refreshSkillFabBadge();
    return r;
  };

  function renderSkillBody(root) {
    if (!root) return;
    var skills = listSkills();
    var pts = 0;
    var earned = 0;
    var grantLine = '';
    if (typeof PP_SKILLS !== 'undefined') {
      var st = PP_SKILLS.ensureSkillState();
      pts = st.points;
      earned = st.earned;
      grantLine = PP_SKILLS.formatGrantLine(st.lastGrant);
    }
    var activeCount = skills.filter(function (s) { return s.activated || s.effective > 0; }).length;
    var lp = root.querySelector('.pp-lg-lp');
    if (lp) {
      lp.innerHTML = '可用球风点 <b>' + pts + '</b> · 生涯累计 ' + earned +
        (grantLine ? '<div style="margin-top:4px;font-size:12px;font-weight:600;opacity:.78;">' + grantLine + '</div>' : '');
    }
    var progress = root.querySelector('.pp-ach-progress-txt');
    if (progress) progress.textContent = '已生效 ' + activeCount + ' / ' + skills.length;
    var grid = root.querySelector('.pp-ach-grid');
    if (grid) grid.innerHTML = skills.map(skillCardHtml).join('');
    root.querySelectorAll('.pp-skill-buy').forEach(function (b) {
      b.onclick = function () {
        var bought = PP_FX.buyStyleSkill(b.getAttribute('data-skill'));
        if (bought) {
          PP_FX.burstFrom(b, { count: 14 });
          var name = '';
          try {
            var def = PP_SKILLS.STYLE_SKILLS.filter(function (s) { return s.id === b.getAttribute('data-skill'); })[0];
            name = def ? def.name : '';
          } catch (e) {}
          PP_FX.toast((name || '技能') + ' 升至 Lv.' + bought.level, { gold: true, icon: '⚡' });
          renderSkillBody(root);
        }
      };
    });
  }

  PP_FX.openSkillPanel = function () {
    var existing = $('pp-skill-panel');
    if (existing) existing.remove();
    var overlay = ce('div'); overlay.id = 'pp-skill-panel'; overlay.className = 'pp-ach-panel-overlay';
    overlay.innerHTML =
      '<div class="pp-ach-panel">' +
        '<div class="pp-ach-panel-head">' +
          '<div class="pp-ach-panel-title">⚡ 技能</div>' +
          '<button class="pp-ach-close" id="pp-skill-close" aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="pp-lg-lp"></div>' +
        '<div class="pp-ach-progress"><div class="pp-ach-progress-txt"></div></div>' +
        '<div class="pp-lg-hint">17 条球风技激活即生效。属性回落会降效但不退点。少量互斥：冷箭/快攻推进 ↔ 背身肉搏，外线锁 ↔ 杀伤。球风点本生涯有效，退役清零。</div>' +
        '<div class="pp-ach-grid"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    renderSkillBody(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    function close() { overlay.classList.remove('show'); setTimeout(function () { overlay.remove(); }, 300); }
    $('pp-skill-close').onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  };

  /* ==================== 传承系统（Roguelike 重生） ==================== */
  // 玩法：解锁成就累计"传承点(LP)"，在传承祭坛把 LP 投入永久强化。
  // 每次开启新生涯(揭晓球员时)按已购强化，给初始属性/OVR 永久加成——即"重生奖励"。
  // 设计要点：LP 由成就稀有度决定，跨生涯保留；强化可叠加但有上限，避免破坏平衡。
  var LEGACY_KEY = 'pp_legacy_v1';
  var LEGACY_SCHEMA_VERSION = 2;
  var LP_BY_RARITY = { common: 1, rare: 2, epic: 4, legend: 8 };
  var LP_PER_ARCHIVE_RECORD = 5;

  // 强化项：costs 为购买 Lv.1 → 满级的逐级消耗。高阶成本明显增加，
  // 全路线总成本高于全部成就可获得的 LP，玩家必须做专精取舍。
  // attrs 用主引擎 13 项属性键（threePT/MID/FIN/DNK/HAN/PAS/PDEF/IDEF/BLK/REB/ATH/STR/CLU）。
  var LEGACY_PERKS = [
    { id: 'scorer',    icon: '🎯', name: '得分天赋', desc: '每级 三分/中投/终结 +1', max: 5, costs: [3, 4, 5, 7, 9], attrs: ['threePT', 'MID', 'FIN'] },
    { id: 'playmaker', icon: '🎩', name: '组织视野', desc: '每级 传球/控球 +1', max: 5, costs: [3, 4, 5, 7, 9], attrs: ['PAS', 'HAN'] },
    { id: 'defender',  icon: '🛡️', name: '防守本能', desc: '每级 外防/内防/盖帽 +1', max: 5, costs: [3, 4, 5, 7, 9], attrs: ['PDEF', 'IDEF', 'BLK'] },
    { id: 'athlete',   icon: '💪', name: '身体天赋', desc: '每级 运动/力量/篮板 +1', max: 5, costs: [3, 4, 5, 7, 9], attrs: ['ATH', 'STR', 'REB'] },
    { id: 'clutch',    icon: '❄️', name: '大心脏',   desc: '每级 关键 +2', max: 4, costs: [4, 6, 8, 10], attrs: ['CLU'], step: 2 },
    { id: 'prodigy',   icon: '🌟', name: '天选之才', desc: '每级 全属性 +1（最贵）', max: 3, costs: [10, 14, 20],
      attrs: ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'] }
  ];
  PP_FX.LEGACY_PERKS = LEGACY_PERKS;
  var PERK_MAP = {};
  LEGACY_PERKS.forEach(function (p) { PERK_MAP[p.id] = p; });

  function saveLegacy(o) { try { localStorage.setItem(LEGACY_KEY, JSON.stringify(o)); } catch (e) {} }
  function getPerkLevelCost(p, currentLevel) {
    if (!p) return Infinity;
    var costs = p.costs || [];
    return Number(costs[Math.max(0, currentLevel || 0)]) || Infinity;
  }
  function legacySpentForLevels(levels) {
    var spent = 0;
    levels = levels || {};
    LEGACY_PERKS.forEach(function(p) {
      var level = Math.max(0, Math.min(p.max, Number(levels[p.id]) || 0));
      for (var i = 0; i < level; i++) spent += getPerkLevelCost(p, i);
    });
    return spent;
  }
  function legacyTreeCost() {
    return LEGACY_PERKS.reduce(function(sum, p) {
      return sum + p.costs.reduce(function(costSum, cost) { return costSum + cost; }, 0);
    }, 0);
  }

  function loadLegacy() {
    try {
      var o = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
      if (!o || typeof o !== 'object') o = {};
      if (Number(o.version) !== LEGACY_SCHEMA_VERSION) {
        var hadOldProgress = !!(o.levels && Object.keys(o.levels).some(function(k) { return Number(o.levels[k]) > 0; }));
        // 旧版使用固定低价。直接保留等级会绕过新成本，因此一次性重置等级；
        // LP 来自成就而非 spent，所有点数会自动完整返还，不损失任何已解锁成就。
        o = { version: LEGACY_SCHEMA_VERSION, levels: {}, spent: 0, rebalanceNoticePending: hadOldProgress };
        saveLegacy(o);
      }
      return o;
    } catch (e) { return {}; }
  }
  var legacy = loadLegacy();          // { levels:{perkId:lvl}, spent:number }
  legacy.version = LEGACY_SCHEMA_VERSION;
  legacy.levels = legacy.levels || {};
  legacy.spent = legacySpentForLevels(legacy.levels);
  saveLegacy(legacy);

  // 总 LP = 已解锁成就按稀有度求和 + 生涯档案馆每条记录 5 点
  function achievementLP() {
    var sum = 0;
    for (var k in unlocked) {
      if (!Object.prototype.hasOwnProperty.call(unlocked, k)) continue;
      var def = ACH_MAP[k];
      if (def) sum += (LP_BY_RARITY[def.rarity] || 0);
    }
    return sum;
  }
  function archiveRecordCount() {
    try {
      if (typeof CAREER_ARCHIVE_CACHE !== 'undefined' && Array.isArray(CAREER_ARCHIVE_CACHE)) {
        return CAREER_ARCHIVE_CACHE.length;
      }
    } catch (e) {}
    return 0;
  }
  function archiveLP() {
    return archiveRecordCount() * LP_PER_ARCHIVE_RECORD;
  }
  function totalLP() {
    return achievementLP() + archiveLP();
  }
  function maxAchievementLP() {
    return ACHIEVEMENTS.reduce(function(sum, achievement) {
      return sum + (LP_BY_RARITY[achievement.rarity] || 0);
    }, 0);
  }
  function maxLegacyLP() {
    return maxAchievementLP() + archiveLP();
  }
  function availableLP() { return Math.max(0, totalLP() - (legacy.spent || 0)); }
  PP_FX.totalLP = totalLP;
  PP_FX.maxLegacyLP = maxLegacyLP;
  PP_FX.availableLP = availableLP;
  PP_FX.achievementLP = achievementLP;
  PP_FX.archiveLP = archiveLP;
  PP_FX.getLegacy = function () { return legacy; };
  PP_FX.getLegacyTreeCost = legacyTreeCost;
  PP_FX.getPerkLevelCost = function(id, level) { return getPerkLevelCost(PERK_MAP[id], level); };

  // 计算某强化当前等级带来的属性增量表 {attrKey: delta}
  function legacyAttrBonuses() {
    var bon = {};
    LEGACY_PERKS.forEach(function (p) {
      var lvl = legacy.levels[p.id] || 0;
      if (!lvl) return;
      var per = p.step || 1;
      p.attrs.forEach(function (a) { bon[a] = (bon[a] || 0) + per * lvl; });
    });
    return bon;
  }
  PP_FX.legacyAttrBonuses = legacyAttrBonuses;

  // 购买一级强化
  PP_FX.buyPerk = function (id) {
    var p = PERK_MAP[id];
    if (!p) return false;
    var lvl = legacy.levels[id] || 0;
    if (lvl >= p.max) return false;
    var cost = getPerkLevelCost(p, lvl);
    if (availableLP() < cost) return false;
    legacy.levels[id] = lvl + 1;
    legacy.spent = (legacy.spent || 0) + cost;
    saveLegacy(legacy);
    return true;
  };

  // 重置所有强化（返还 LP）——用于玩家重新分配
  PP_FX.respecLegacy = function () {
    legacy.levels = {};
    legacy.spent = 0;
    legacy.version = LEGACY_SCHEMA_VERSION;
    saveLegacy(legacy);
  };

  // 传承祭坛面板
  function legacyPerkCardHtml(p) {
    var lvl = legacy.levels[p.id] || 0;
    var maxed = lvl >= p.max;
    var nextCost = maxed ? 0 : getPerkLevelCost(p, lvl);
    var canBuy = !maxed && availableLP() >= nextCost;
    var pips = '';
    for (var i = 0; i < p.max; i++) {
      pips += '<span class="pp-lg-pip' + (i < lvl ? ' on' : '') + '"></span>';
    }
    return '<div class="pp-lg-perk' + (maxed ? ' maxed' : '') + '">' +
      '<div class="pp-lg-perk-ic">' + p.icon + '</div>' +
      '<div class="pp-lg-perk-body">' +
        '<div class="pp-lg-perk-name">' + p.name + ' <span class="pp-lg-lvl">Lv.' + lvl + '/' + p.max + '</span></div>' +
        '<div class="pp-lg-perk-desc">' + p.desc + '</div>' +
        '<div class="pp-lg-pips">' + pips + '</div>' +
      '</div>' +
      '<button class="pp-lg-buy" data-perk="' + p.id + '"' + (canBuy ? '' : ' disabled') + '>' +
        (maxed ? '满级' : ('🧬 ' + nextCost)) + '</button>' +
    '</div>';
  }

  function renderLegacyBody(root) {
    var avail = availableLP(), total = totalLP();
    var ach = achievementLP();
    var archives = archiveRecordCount();
    var fromArchive = archiveLP();
    root.querySelector('.pp-lg-lp').innerHTML =
      '可用传承点 <b>' + avail + '</b> · 累计 ' + total +
      '<div style="margin-top:4px;font-size:12px;font-weight:600;opacity:.78;">成就 ' + ach + ' · 档案 ' + archives + '×' + LP_PER_ARCHIVE_RECORD + '=' + fromArchive + '</div>';
    var hint = root.querySelector('.pp-lg-hint');
    if (hint) {
      hint.textContent = '解锁成就积累传承点；生涯档案馆每多一条退役记录再加 ' + LP_PER_ARCHIVE_RECORD + ' 点。投入永久强化。每条路线越往后越贵；全部成就最多提供 ' + maxAchievementLP() + ' 点，当前档案加成 ' + fromArchive + ' 点，而全路线共需 ' + legacyTreeCost() + ' 点，无法同时点满，请选择自己的长期专精。';
    }
    root.querySelector('.pp-lg-grid').innerHTML =
      LEGACY_PERKS.map(legacyPerkCardHtml).join('');
    root.querySelectorAll('.pp-lg-buy').forEach(function (b) {
      b.onclick = function () {
        if (PP_FX.buyPerk(b.getAttribute('data-perk'))) {
          PP_FX.burstFrom(b, { count: 14 });
          renderLegacyBody(root);
        }
      };
    });
  }

  PP_FX.openLegacyPanel = function () {
    var ex = $('pp-legacy-panel'); if (ex) ex.remove();
    var overlay = ce('div'); overlay.id = 'pp-legacy-panel'; overlay.className = 'pp-ach-panel-overlay';
    overlay.innerHTML =
      '<div class="pp-ach-panel pp-legacy">' +
        '<div class="pp-ach-panel-head">' +
          '<div class="pp-ach-panel-title">🧬 传承祭坛</div>' +
          '<button class="pp-ach-close" id="pp-lg-close" aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="pp-lg-lp"></div>' +
        '<div class="pp-lg-hint"></div>' +
        '<div class="pp-ach-grid pp-lg-grid"></div>' +
        '<div class="pp-lg-foot"><button class="pp-lg-respec" id="pp-lg-respec">重置强化并返还全部传承点</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    function close() { overlay.classList.remove('show'); setTimeout(function () { overlay.remove(); }, 300); }
    $('pp-lg-close').onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    $('pp-lg-respec').onclick = function () {
      PP_FX.respecLegacy(); renderLegacyBody(overlay);
    };
    renderLegacyBody(overlay);
    if (typeof loadCareerArchive === 'function') {
      loadCareerArchive(false).then(function () {
        if (document.getElementById('pp-legacy-panel')) renderLegacyBody(overlay);
      });
    }
    if (legacy.rebalanceNoticePending) {
      delete legacy.rebalanceNoticePending;
      saveLegacy(legacy);
      setTimeout(function() {
        PP_FX.toast('传承系统已重新平衡：旧强化已重置，全部传承点已返还', { gold: true, icon: '🧬', duration: 4200 });
      }, 260);
    }
  };

  /* ==================== 与主引擎的接线(hooks) ==================== */
  // 策略：不改核心逻辑，只在已有全局函数前后"包裹"我们的检测与特效。
  // 若某个目标函数不存在（引擎改版），wrap 会安全跳过。
  function wrap(name, before, after) {
    var orig = window[name];
    if (typeof orig !== 'function') return false;
    window[name] = function () {
      if (before) { try { before.apply(this, arguments); } catch (e) {} }
      var r = orig.apply(this, arguments);
      if (after) { try { after.call(this, r, arguments); } catch (e) {} }
      return r;
    };
    return true;
  }

  // 主页面的 STATE 是顶层 const，不会自动成为 window.STATE；跨脚本仍可
  // 通过全局词法绑定访问，旧写法会让所有成就钩子拿到 null。
  function G() {
    try { return (typeof STATE !== 'undefined') ? STATE : ((typeof window.STATE !== 'undefined') ? window.STATE : null); }
    catch (e) { return null; }
  }
  function displayName() { try { return window.getHupuDisplayName ? getHupuDisplayName() : ''; } catch (e) { return ''; } }

  function repairMetaAchievementsAfterRemoval() {
    var changed = false;
    var realCount = unlockedCount();
    if (unlocked.collector && realCount - 1 < 20) {
      delete unlocked.collector;
      changed = true;
    }
    realCount = unlockedCount();
    if (unlocked.explorer && realCount - 1 < 10) {
      delete unlocked.explorer;
      changed = true;
    }
    return changed;
  }

  function currentCareerStartedAt(s) {
    var token = String((s && s.gameId) || '').split('-')[0];
    if (!/^[0-9a-z]+$/i.test(token)) return 0;
    var startedAt = parseInt(token, 36);
    // generateGameId() starts with Date.now(). Ignore test/legacy IDs that do
    // not decode to a plausible millisecond timestamp.
    if (!isFinite(startedAt) || startedAt < 1500000000000 || startedAt > Date.now() + 86400000) return 0;
    return startedAt;
  }

  function unlockedInCurrentCareer(record, s) {
    var startedAt = currentCareerStartedAt(s);
    return !!(startedAt && record && Number(record.at) >= startedAt);
  }

  function unlockWithFactEvidence(id, s, fact, count) {
    PP_FX.unlock(id);
    var record = unlocked[id];
    if (!record || record.factEvidence) return;
    record.factEvidence = {
      version: 1,
      gameId: String((s && s.gameId) || 'current-career'),
      fact: fact || id,
      count: count == null ? 1 : count
    };
    saveUnlocked(unlocked);
  }

  // 只有这两项是“同一生涯内多次达成”的累计成就。成就解锁后仍永久保留，
  // 但首次解锁必须附带当前 gameId 和当前生涯计数，杜绝跨存档拼次数。
  var SINGLE_CAREER_CUMULATIVE = {
    mvp_x3: { fact: 'mvp', threshold: 3 },
    // v2 凭证表示冠军数经过“已归档赛季 / 当前赛季”去重校验。
    champion_x3: { fact: 'champion', threshold: 3, proofVersion: 2 }
  };

  function singleCareerEvidence(s, count, version) {
    return { version: version || 1, gameId: String((s && s.gameId) || 'current-career'), count: count };
  }

  function hasSingleCareerEvidence(record, rule, s) {
    var proof = record && record.singleCareer;
    if (!proof || !proof.gameId || Number(proof.count) < rule.threshold) return false;
    if (!rule.proofVersion || Number(proof.version) >= rule.proofVersion) return true;
    // 旧生涯已经永久保存的 v1 凭证无法再还原现场，继续保留；当前生涯的
    // v1 冠军凭证必须按新去重逻辑重新验证，修复“两冠误算三冠”。
    return String(proof.gameId) !== String((s && s.gameId) || 'current-career');
  }

  function repairCumulativeAchievements(s, facts) {
    var changed = false;
    Object.keys(SINGLE_CAREER_CUMULATIVE).forEach(function (id) {
      var rule = SINGLE_CAREER_CUMULATIVE[id];
      var count = Number(facts[rule.fact]) || 0;
      if (!unlocked[id] || hasSingleCareerEvidence(unlocked[id], rule, s)) return;
      if (count >= rule.threshold) {
        unlocked[id].singleCareer = singleCareerEvidence(s, count, rule.proofVersion);
      } else {
        // 旧版本可能通过跨生涯隐藏计数误解锁。无法证明来自同一生涯时撤回。
        delete unlocked[id];
      }
      changed = true;
    });
    // 清掉旧版跨生涯计数，避免以后任何逻辑再次把不同生涯相加。
    if (unlocked.__counters) { delete unlocked.__counters; changed = true; }
    if (changed) {
      repairMetaAchievementsAfterRemoval();
      saveUnlocked(unlocked);
    }
  }

  // 0) 传承加成：在揭晓(计算OVR)之前，把已购强化加到初始属性上。每个生涯只应用一次。
  function applyLegacyBeforeReveal() {
    var s = G(); if (!s || !s.attrs) return;
    // 用属性对象自身打标记，避免重复揭晓时叠加；换新生涯会得到全新 attrs。
    if (s.attrs.__legacyApplied) return;
    var bon = legacyAttrBonuses();
    var keys = Object.keys(bon);
    if (!keys.length) { s.attrs.__legacyApplied = true; return; }
    keys.forEach(function (k) {
      if (typeof s.attrs[k] === 'number') {
        s.attrs[k] = Math.max(25, Math.min(130, s.attrs[k] + bon[k]));
      }
    });
    s.attrs.__legacyApplied = true;
    PP_FX._legacyAppliedThisCareer = bon;  // 供揭晓后提示
  }

  // 1) 创建/揭晓球员 → 创建成就 + OVR 里程碑
  function afterReveal() {
    var s = G(); if (!s) return;
    PP_FX.unlock('create_player');
    var ovr = s.finalOVR || 0;
    if (ovr >= 80) PP_FX.unlock('ovr_80');
    if (ovr >= 90) PP_FX.unlock('ovr_90');
    if (ovr >= 95) PP_FX.unlock('ovr_95');
    // 揭晓页放一束小粒子
    setTimeout(function () {
      var el = document.querySelector('#screen-reveal .reveal-card') || document.querySelector('.big-ovr');
      if (el) PP_FX.burstFrom(el, { count: 22, colors: ['#ff6b35', '#f7a600', '#ffd23f'] });
    }, 700);
    // 若本次生涯吃到了传承加成，给出重生奖励提示
    var lb = PP_FX._legacyAppliedThisCareer;
    if (lb && Object.keys(lb).length) {
      var totalPlus = 0; for (var kk in lb) totalPlus += lb[kk];
      PP_FX._legacyAppliedThisCareer = null;
      setTimeout(function () {
        PP_FX.toast('传承加成已注入：初始属性共 +' + totalPlus, { gold: true, icon: '🧬', duration: 3200 });
      }, 900);
    }
    syncAchievementState();
  }

  // 2) 选秀定型 → 顺位相关成就
  function afterFinalizeDraft() {
    var s = G(); if (!s || !s.career || !s.career.draft) return;
    var d = s.career.draft;
    if (d.type === 'undrafted') PP_FX.unlock('undrafted');
    if (Number(d.round) === 1 && Number(d.pick) >= 1 && Number(d.pick) <= 14) PP_FX.unlock('lottery_pick');
    if (Number(d.round) === 1 && Number(d.pick) === 1) PP_FX.unlock('first_pick');
    syncAchievementState();
  }

  // 3) 赛季奖项结算 → 荣誉成就
  // 奖项在不同阶段会经历“当前赛季 awards → career.honors → seasons.awards”
  // 三种形态，且最佳阵容/新秀阵容是列表奖项。统一收集后再判断，避免
  // 只看 winner 字符串导致全明星和最佳新秀明明显示了却没有成就。
  function compactAwardLabel(label) {
    return String(label || '')
      .replace(/\s+/g, '')
      .replace(/[🏆👑⭐🌟🌱🔒🔥🎊📈🛡🥇🥈🥉·\uFE0F]/g, '')
      .toUpperCase();
  }

  function classifyAward(a, label) {
    var act = String(a && a.act || '').replace(/[^a-z]/gi, '').toLowerCase();
    var actKinds = {
      mvp: 'mvp', fmvp: 'fmvp', allstarmvp: 'allStarMvp',
      dpoy: 'dpoy', roty: 'roty', roy: 'roty', sixthman: 'sixthman',
      allstar: 'allStar', allnba: 'allNBA', allrookie: 'allRookie',
      alldefensive: 'allDefense', champion: 'champion'
    };
    if (actKinds[act]) return actKinds[act];

    // Legacy saves may only contain a display label. Match complete canonical
    // labels instead of substrings: “最佳新秀阵容” is not “最佳新秀”, and
    // “MVP 候选” is not an MVP award.
    var clean = compactAwardLabel(label);
    if (clean === 'MVP' || clean === '常规赛MVP' || clean === '最有价值球员' || clean === '常规赛最有价值球员') return 'mvp';
    if (clean === 'FMVP' || clean === '总决赛MVP' || clean === '总决赛最有价值球员') return 'fmvp';
    if (clean === '全明星MVP' || clean === 'ALL-STARMVP') return 'allStarMvp';
    if (clean === 'DPOY' || clean === '最佳防守球员') return 'dpoy';
    if (clean === 'ROTY' || clean === 'ROY' || clean === '年度最佳新秀' || clean === '最佳新秀') return 'roty';
    if (clean === '最佳第六人' || clean === '第六人') return 'sixthman';
    if (clean === '全明星' || clean === '全明星入选') return 'allStar';
    if (clean === '最佳阵容' || clean === 'NBA最佳阵容' || clean === '最佳阵容一阵' || clean === '最佳阵容二阵' || clean === '最佳阵容三阵' || clean === '一阵' || clean === '二阵' || clean === '三阵' || clean === 'ALL-NBA') return 'allNBA';
    if (clean === '最佳新秀阵容' || clean === '最佳新秀一阵' || clean === '最佳新秀二阵' || clean === '新秀一阵' || clean === '新秀二阵' || clean === 'ALL-ROOKIE') return 'allRookie';
    if (clean === '最佳防守阵容' || clean === '最佳防守一阵' || clean === '最佳防守二阵' || clean === '一防' || clean === '二防' || clean === 'ALL-DEFENSIVE') return 'allDefense';
    if (clean === '总冠军' || clean === 'NBA总冠军') return 'champion';
    return '';
  }
  PP_FX.classifyAchievementAward = classifyAward;

  function collectLegacyFalsePositiveTargets(kind, label, targets) {
    var clean = compactAwardLabel(label);
    if (kind === 'fmvp') targets.mvp = true; // old “contains MVP” bug
    if (kind === 'allRookie') targets.roty = true;
    if (kind === 'allDefense') targets.dpoy = true;
    if ((clean.indexOf('候选') >= 0 || clean.indexOf('评选') >= 0) && clean.indexOf('MVP') >= 0) targets.mvp = true;
    if (clean.indexOf('最佳新秀候选') >= 0) targets.roty = true;
    if (clean.indexOf('全明星级别') >= 0 || clean.indexOf('全明星候选') >= 0) targets.all_star = true;
    if (clean.indexOf('最佳阵容候选') >= 0) targets.all_nba = true;
    if (clean.indexOf('最佳第六人候选') >= 0) targets.sixth_man = true;
    if (clean.indexOf('总冠军候选') >= 0) targets.champion = true;
  }

  function repairAmbiguousAwardAchievements(s, facts) {
    var satisfied = {
      mvp: facts.mvp > 0,
      roty: !!facts.roty,
      dpoy: !!facts.dpoy,
      all_star: !!facts.allStar,
      all_nba: !!facts.allNBA,
      sixth_man: !!facts.sixthman,
      champion: facts.champion > 0
    };
    var changed = false;
    Object.keys(facts.falsePositiveTargets || {}).forEach(function(id) {
      var record = unlocked[id];
      if (!record || record.factEvidence || satisfied[id] || !unlockedInCurrentCareer(record, s)) return;
      delete unlocked[id];
      changed = true;
    });
    if (changed) {
      repairMetaAchievementsAfterRemoval();
      saveUnlocked(unlocked);
    }
  }

  function isPlayoffResult(result) {
    var text = String(result || '').trim();
    return !!(text && text.indexOf('未晋级') < 0 && text.indexOf('无缘') < 0);
  }

  function unlockSeasonStatMilestones(stats) {
    var games = Number(stats && stats.games) || 0;
    if (games < 40) return;
    var ppg = (Number(stats.pts) || 0) / games;
    var rpg = (Number(stats.reb) || 0) / games;
    if (ppg >= 30) PP_FX.unlock('avg_30');
    if (ppg >= 25 && rpg >= 10) PP_FX.unlock('season_25_10');
  }

  function unlockGameStatMilestones(stats) {
    if (!stats) return;
    var points = Number(stats.pts) || 0;
    // 50+ also satisfies the stated 40+ condition.
    if (points >= 40) PP_FX.unlock('game_40');
    if (points >= 50) PP_FX.unlock('game_50');
    var doubleDigits = 0;
    ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(function(k) {
      if ((Number(stats[k]) || 0) >= 10) doubleDigits++;
    });
    if (doubleDigits >= 3) PP_FX.unlock('triple_double');
  }

  function syncStateMilestones(s) {
    var career = s.career || {};
    var currentSeason = s.season || {};
    var finalOvr = Number(s.finalOVR) || 0;
    if (finalOvr > 0) {
      PP_FX.unlock('create_player');
      if (finalOvr >= 80) PP_FX.unlock('ovr_80');
      if (finalOvr >= 90) PP_FX.unlock('ovr_90');
      if (finalOvr >= 95) PP_FX.unlock('ovr_95');
    }

    var draft = career.draft;
    if (draft) {
      var draftType = String(draft.type || '').toLowerCase();
      var round = Number(draft.round);
      var pick = Number(draft.pick);
      if (draftType === 'undrafted') PP_FX.unlock('undrafted');
      if (round === 1 && pick >= 1 && pick <= 14) PP_FX.unlock('lottery_pick');
      if (round === 1 && pick === 1) PP_FX.unlock('first_pick');
    }

    var archivedSeasons = Array.isArray(career.seasons) ? career.seasons : [];
    var played = Math.max(Number(career.seasonCount) || 0, archivedSeasons.length);
    if (played >= 5) PP_FX.unlock('season_5');
    if (played >= 10) PP_FX.unlock('season_10');
    if (career.retired) PP_FX.unlock('retire');

    archivedSeasons.forEach(function(season) {
      if ((Number(season && season.wins) || 0) >= 60) PP_FX.unlock('win_60');
      if (isPlayoffResult(season && season.playoffResult)) PP_FX.unlock('playoffs');
      unlockSeasonStatMilestones(season && season.playerStats);
    });
    if ((Number(currentSeason.wins) || 0) >= 60) PP_FX.unlock('win_60');
    if (currentSeason.isPlayoffs || currentSeason.playoffBracket || isPlayoffResult(currentSeason.playoffResult)) PP_FX.unlock('playoffs');
    unlockSeasonStatMilestones(currentSeason.playerStats);
    (currentSeason.games || []).forEach(function(game) { unlockGameStatMilestones(game && game.stats); });
  }

  function syncAchievementState() {
    var s = G(); if (!s) return {};
    var me = displayName();
    var facts = {
      mvp:0, fmvp:0, dpoy:false, roty:false, sixthman:false,
      allStar:false, allNBA:false, allRookie:false, allDefense:false,
      champion:0, falsePositiveTargets:{}
    };
    var seen = {};
    function keyFor(a, scope) {
      var act = a && a.act ? a.act : '';
      var label = a && a.label ? a.label : (typeof a === 'string' ? a : '');
      var season = a && a.seasonNum != null ? a.seasonNum : '';
      if (!season && scope.indexOf('season') === 0) season = scope.slice(6);
      if (!season && scope === 'current' && s.career) season = (s.career.seasonCount || 0) + 1;
      return season + '|' + act + '|' + label + '|' + (a && a.winner ? a.winner : '');
    }
    function take(a, scope, index, trustedUser) {
      if (!a) return;
      var label = typeof a === 'string' ? a : String(a.label || '');
      if (!label && !(a && a.act)) return;
      if (typeof a === 'object' && a.isUser === false) return;
      var mine = !!trustedUser || !!(a && a.isUser === true) ||
        !!(typeof a === 'string' && scope === 'current') ||
        !!(me && a && (a.winner === me || String(a.winner || '').split('、').indexOf(me) >= 0));
      if (!mine) return;
      var key = keyFor(a, scope);
      if (seen[key]) return;
      seen[key] = true;
      var kind = classifyAward(a, label);
      collectLegacyFalsePositiveTargets(kind, label, facts.falsePositiveTargets);
      if (kind === 'fmvp') facts.fmvp++;
      else if (kind === 'mvp') facts.mvp++;
      if (kind === 'dpoy') facts.dpoy = true;
      if (kind === 'roty') facts.roty = true;
      if (kind === 'sixthman') facts.sixthman = true;
      if (kind === 'allStar' || kind === 'allStarMvp') facts.allStar = true;
      if (kind === 'allNBA') facts.allNBA = true;
      if (kind === 'allRookie') facts.allRookie = true;
      if (kind === 'allDefense') facts.allDefense = true;
      if (kind === 'champion') facts.champion++;
    }
    // saveCurrentSeasonToCareer() 归档后不会立刻清空 season.awards；此时同一座
    // 冠军已存在于 career.honors / career.seasons，继续扫描 current 会重复计数。
    if (!s._careerSaved) {
      (s.season && s.season.awards || []).forEach(function(a, i) { take(a, 'current', i, false); });
    }
    (s.career && s.career.honors || []).forEach(function(a, i) { take(a, 'career', i, true); });
    (s.career && s.career.seasons || []).forEach(function(season) {
      // Archived season awards are already filtered to the user's honors.
      (season && season.awards || []).forEach(function(a, i) { take(a, 'season' + (season.seasonNum || ''), i, true); });
    });
    var draft = s.career && s.career.draft;
    if (draft) {
      var draftRound = Number(draft.round);
      var draftPick = Number(draft.pick);
      if (draft.type === 'undrafted') PP_FX.unlock('undrafted');
      if (draftRound === 1 && draftPick >= 1 && draftPick <= 14) PP_FX.unlock('lottery_pick');
      if (draftRound === 1 && draftPick === 1) PP_FX.unlock('first_pick');
    }
    syncStateMilestones(s);
    // 先修复旧版模糊文字匹配与跨生涯累计造成的误解锁，再按本次
    // 生涯的精确事实判定成就。
    repairAmbiguousAwardAchievements(s, facts);
    repairCumulativeAchievements(s, facts);
    if (facts.mvp > 0) unlockWithFactEvidence('mvp', s, 'mvp', facts.mvp);
    if (facts.fmvp > 0) unlockWithFactEvidence('fmvp', s, 'fmvp', facts.fmvp);
    if (facts.mvp >= 3) PP_FX.unlock('mvp_x3', singleCareerEvidence(s, facts.mvp));
    if (facts.dpoy) unlockWithFactEvidence('dpoy', s, 'dpoy');
    if (facts.roty) unlockWithFactEvidence('roty', s, 'roty');
    if (facts.sixthman) unlockWithFactEvidence('sixth_man', s, 'sixthman');
    if (facts.allStar) unlockWithFactEvidence('all_star', s, 'allStar');
    if (facts.allNBA) unlockWithFactEvidence('all_nba', s, 'allNBA');
    if (facts.champion > 0) {
      unlockWithFactEvidence('champion', s, 'champion', facts.champion);
      PP_FX.unlock('playoffs');
    }
    if (facts.champion >= 3) PP_FX.unlock('champion_x3', singleCareerEvidence(s, facts.champion, 2));
    PP_FX._achievementFacts = facts;
    return facts;
  }

  PP_FX.syncAchievements = syncAchievementState;

  function afterAwards() { syncAchievementState(); }

  // 4) 赛季结束 → 战绩/季后赛/生涯长度成就
  function afterEndOfSeason() {
    var s = G(); if (!s || !s.season) return;
    if ((s.season.wins || 0) >= 60) PP_FX.unlock('win_60');
    var seed = null;
    try { seed = window.getConferenceSeed ? getConferenceSeed(s.careerTeam) : null; } catch (e) {}
    if (seed != null && seed <= 8) PP_FX.unlock('playoffs');
    var sc = (s.career && s.career.seasonCount) || 0;
    // seasonCount 在结算时通常尚未自增，用已完成赛季数 +1 估计
    var played = sc + 1;
    if (played >= 5) PP_FX.unlock('season_5');
    if (played >= 10) PP_FX.unlock('season_10');
    syncAchievementState();
  }

  // 5) 夺冠庆祝 → 追加彩带并解锁（防止 awards 未覆盖）
  function afterChampion() {
    PP_FX.unlock('champion');
    syncAchievementState();
    PP_FX.confetti({ count: 120, colors: ['#f7a600', '#ffd23f', '#ff6b35', '#fff4de'] });
  }

  // 6) 退役
  function afterRetire() {
    var s = G();
    if (s && s.career && s.career.retired) syncAchievementState();
  }

  // 7) 单场比赛数据里程碑
  // 关键修复：主引擎的 renderGameCastNew 只定义未调用（快速模拟用点阵图），
  // 所以旧的 game_40/game_50/triple_double 永远无法触发。改为在每场比赛推入
  // STATE.season.games 后（simDayLeagueGames 在所有路径都会被调用）检查最新一场的 stats。
  var _lastCheckedGameKey = '';
  function checkLatestGameMilestones() {
    var s = G(); if (!s || !s.season || !s.season.games) return;
    var games = s.season.games;
    var idx = games.length - 1;
    if (idx < 0) return;
    var game = games[idx] || {};
    var gameKey = [s.gameId || '', (s.career && s.career.seasonCount) || 0, s.season.isPlayoffs ? 1 : 0, idx, (game.game && game.game.day) || ''].join('|');
    if (gameKey === _lastCheckedGameKey) return;
    _lastCheckedGameKey = gameKey;
    unlockGameStatMilestones(game.stats); // 禁赛场次 stats 为 null
  }
  PP_FX.checkLatestGameMilestones = checkLatestGameMilestones;

  /* ---------- 安装 hooks（DOM 就绪后，确保主引擎已定义这些函数） ---------- */
  function install() {
    wrap('revealPlayer', applyLegacyBeforeReveal, afterReveal);
    wrap('finalizeDraft', null, afterFinalizeDraft);
    wrap('showAwardsScreen', null, afterAwards);
    wrap('calcSeasonAwards', null, afterAwards);
    wrap('showEndOfSeason', null, afterEndOfSeason);
    wrap('showChampionshipCelebration', afterChampion, null);
    wrap('saveCurrentSeasonToCareer', null, function () { syncAchievementState(); });
    wrap('renderAfterSaveLoad', null, function () {
      syncAchievementState();
      try { if (typeof PP_SKILLS !== 'undefined') PP_SKILLS.ensureSkillState(); } catch (e) {}
      syncHudFabs();
    });
    wrap('beginOffseason', null, syncHudFabs);
    wrap('renderTrainingCamp', null, syncHudFabs);
    wrap('showScreen', null, syncHudFabs);
    // 退役实际走 announcePlayerRetirement()，showRetirementModal 定义了却从未被调用，
    // 旧 hook 挂在后者上导致 retire 成就永远无法解锁。
    wrap('announcePlayerRetirement', null, afterRetire);
    wrap('refreshCareerArchiveButton', null, function () {
      var panel = document.getElementById('pp-legacy-panel');
      if (panel) renderLegacyBody(panel);
    });

    // 单场里程碑：simDayLeagueGames 在每场比赛推入 games 后都会被调用（含季后赛）
    wrap('simDayLeagueGames', null, function () { checkLatestGameMilestones(); });

    // 把主引擎里空实现的 showToast 接到我们的华丽 toast 上
    var origToast = window.showToast;
    window.showToast = function (msg) {
      try { if (msg) PP_FX.toast(String(msg)); } catch (e) {}
      // 保留原实现（若之后被重新赋值）
      if (typeof origToast === 'function' && origToast !== window.showToast) {
        try { origToast(msg); } catch (e) {}
      }
    };
  }

  /* ---------- 成就入口按钮 + 全局点击火花 ---------- */
  function mountEntryButton() {
    if ($('pp-ach-fab')) return;
    var btn = ce('button', 'pp-ach-fab');
    btn.id = 'pp-ach-fab';
    btn.title = '传承点';
    btn.setAttribute('aria-label', '打开传承祭坛');
    btn.innerHTML = '<span class="pp-ach-fab-ic">🏅</span>';
    btn.onclick = function (e) { e.stopPropagation(); PP_FX.openLegacyPanel(); };
    document.body.appendChild(btn);
    syncAchFabVisibility();
  }

  function mountSkillButton() {
    if ($('pp-skill-fab')) return;
    var btn = ce('button', 'pp-skill-fab');
    btn.id = 'pp-skill-fab';
    btn.title = '技能';
    btn.setAttribute('aria-label', '打开技能');
    btn.innerHTML = '<span class="pp-skill-fab-ic">⚡</span>';
    btn.onclick = function (e) { e.stopPropagation(); PP_FX.openSkillPanel(); };
    document.body.appendChild(btn);
    syncSkillFabVisibility();
  }

  function mountTapSpark() {
    // 仅在按钮/可点击元素上迸发轻量火花，避免全屏乱溅
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      var hit = t.closest && t.closest('button, .btn, .feature-card, .pos-card, .event-choice, .slot-btn, .awards-next');
      if (hit && !hit.classList.contains('pp-ach-close')) {
        PP_FX.tapSpark(e.clientX, e.clientY);
      }
    }, true);
  }

  function boot() {
    install();
    mountEntryButton();
    mountSkillButton();
    mountTapSpark();
    setTimeout(function () { syncAchievementState(); }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
