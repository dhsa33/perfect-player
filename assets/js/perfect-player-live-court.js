/* ============================================================
 * Perfect Player — 俯瞰球场跑位
 * 普通速度观看才播。加快 / 跳过不播。
 * 坐标：全场 x 0–100，y 0–50，进攻篮默认在右侧 (94, 25)。
 * ============================================================ */
(function () {
  'use strict';
  var PP_COURT = window.PP_COURT = window.PP_COURT || {};

  var Z = {
    rim: [92, 25], paint: [86, 25], ft: [80, 25], nail: [76, 25],
    elbowL: [80, 17], elbowR: [80, 33],
    slotL: [74, 11], slotR: [74, 39],
    wingL: [70, 7], wingR: [70, 43],
    cornerL: [91, 3.6], cornerR: [91, 46.4],
    top: [66, 25], logo: [57, 25],
    postL: [88, 17], postR: [88, 33],
    dunkerL: [90, 14], dunkerR: [90, 36],
    shortL: [92, 10], shortR: [92, 40],
    hashL: [60, 10], hashR: [60, 40],
    trail: [54, 22],
    back: [18, 25], midc: [50, 25],
    inbound: [96, 8],
    ftShooter: [80, 25]
  };

  var TACTIC_META = {
    pnr_side: { camera: 'half', branches: ['reject', 'turn', 'roll', 'pop', 'extra', 'slip'] },
    pnr_high: { camera: 'half', branches: ['reject', 'turn', 'roll', 'pop', 'split'] },
    horns: { camera: 'half', branches: ['dho', 'flash', 'slip', 'spain'] },
    spain: { camera: 'half', branches: ['back', 'extra', 'reject'] },
    floppy: { camera: 'half', branches: ['corner', 'cut', 'flare'] },
    elevator: { camera: 'half', branches: ['catch', 'reject'] },
    hammer: { camera: 'half', branches: ['corner', 'trail'] },
    dho: { camera: 'half', branches: ['pull', 'turn', 'keep'] },
    iso_clear: { camera: 'half', branches: ['drive', 'step', 'fade', 'pull'] },
    iso_mid: { camera: 'half', branches: ['jumper', 'fade', 'drive'] },
    post: { camera: 'half', branches: ['fade', 'hook', 'upunder', 'kick'] },
    five_out: { camera: 'half', branches: ['drivekick', 'extra', 'reject'] },
    delay: { camera: 'half', branches: ['dribble', 'late'] },
    trans_coast: { camera: 'full', branches: ['coast', 'lay'] },
    trans_num: { camera: 'full', branches: ['ahead', 'trail', 'pull'] },
    putback: { camera: 'half', branches: ['tip', 'kick'] },
    steal: { camera: 'full', branches: ['strip', 'lane'] },
    ft: { camera: 'half', branches: ['line'] },
    inbound: { camera: 'half', branches: ['home', 'sideline'] },
    zone: { camera: 'half', branches: ['overload', 'short'] }
  };

  function clone(xy) { return [xy[0], xy[1]]; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function shade(xy, amt) {
    var b = Z.rim;
    return [xy[0] + (b[0] - xy[0]) * amt, xy[1] + (b[1] - xy[1]) * amt];
  }
  function jitter(xy, k) {
    k = k || 0.6;
    return [xy[0] + (Math.random() - 0.5) * k, xy[1] + (Math.random() - 0.5) * k];
  }
  function flipY(xy) { return [xy[0], 50 - xy[1]]; }
  function findP(list, id) {
    if (!id || !list) return null;
    var i;
    for (i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function others(list, ids) {
    var map = {}, i, out = [];
    for (i = 0; i < ids.length; i++) if (ids[i]) map[ids[i]] = true;
    for (i = 0; i < (list || []).length; i++) if (list[i] && !map[list[i].id]) out.push(list[i]);
    return out;
  }
  function byPos(list, pos) {
    var i;
    for (i = 0; i < (list || []).length; i++) if (list[i] && list[i].pos === pos) return list[i];
    return (list && list[0]) || null;
  }

  function strongSide(strong, keyL, keyR) {
    return strong === 'L' ? Z[keyL] : Z[keyR];
  }
  function weakSide(strong, keyL, keyR) {
    return strong === 'L' ? Z[keyR] : Z[keyL];
  }

  function homeAway(p, input) {
    if (!p) return 'away';
    if (p.hero) return 'hero';
    var offIsHome = (input.side === 'A') === !!input.teamAHome;
    if (p.team === 'off') return offIsHome ? 'home' : 'away';
    return offIsHome ? 'away' : 'home';
  }

  function dot(p, xy, input, ballId) {
    return {
      id: p.id,
      x: xy[0], y: xy[1],
      kind: homeAway(p, input),
      ball: !!(ballId && p.id === ballId)
    };
  }

  function packDots(offPos, defPos, input, ballId) {
    var dots = [], id;
    for (id in offPos) if (offPos[id] && findP(input.off, id)) dots.push(dot(findP(input.off, id), offPos[id], input, ballId));
    for (id in defPos) if (defPos[id] && findP(input.def, id)) dots.push(dot(findP(input.def, id), defPos[id], input, ballId));
    return dots;
  }

  function assign(input) {
    var off = (input.off || []).slice();
    var def = (input.def || []).slice();
    var ball = findP(off, input.shooter) || findP(off, input.loser) || off[0];
    var passer = findP(off, input.passer);
    var rest = others(off, [ball && ball.id, passer && passer.id]);
    rest.sort(function (a, b) {
      var r = { C: 0, PF: 1, SF: 2, SG: 3, PG: 4 };
      return (r[a.pos] || 3) - (r[b.pos] || 3);
    });
    var big = rest.filter(function (p) { return p.pos === 'C' || p.pos === 'PF'; })[0] || rest[0];
    var wing = rest.filter(function (p) { return p.pos === 'SG' || p.pos === 'SF'; })[0] || rest[1] || rest[0];
    var corner = rest.filter(function (p) { return p !== big && p !== wing; })[0] || rest[2] || wing;
    var extra = rest.filter(function (p) { return p !== big && p !== wing && p !== corner; })[0] || rest[3];
    var onBall = findP(def, input.matchup) || def[0];
    var help = findP(def, input.help);
    var dRest = others(def, [onBall && onBall.id, help && help.id]);
    return {
      ball: ball, passer: passer, big: big, wing: wing, corner: corner, extra: extra,
      onBall: onBall, help: help,
      d2: dRest[0], d3: dRest[1], d4: dRest[2], d5: dRest[3],
      blocker: findP(def, input.blocker),
      stealer: findP(def, input.stealer)
    };
  }

  function baseFive(strong) {
    return {
      top: clone(Z.top),
      slotS: clone(strongSide(strong, 'slotL', 'slotR')),
      slotW: clone(weakSide(strong, 'slotL', 'slotR')),
      cornerS: clone(strongSide(strong, 'cornerL', 'cornerR')),
      cornerW: clone(weakSide(strong, 'cornerL', 'cornerR')),
      elbowS: clone(strongSide(strong, 'elbowL', 'elbowR')),
      postS: clone(strongSide(strong, 'postL', 'postR')),
      dunkerW: clone(weakSide(strong, 'dunkerL', 'dunkerR')),
      wingS: clone(strongSide(strong, 'wingL', 'wingR'))
    };
  }

  function placeOff(r, strong, tactic) {
    var f = baseFive(strong);
    var off = {};
    if (!r.ball) return off;
    if (tactic === 'post') {
      off[r.ball.id] = f.postS;
      if (r.passer) off[r.passer.id] = f.slotS;
      if (r.wing) off[r.wing.id] = f.cornerS;
      if (r.corner) off[r.corner.id] = f.cornerW;
      if (r.big && r.big !== r.ball) off[r.big.id] = f.dunkerW;
      if (r.extra) off[r.extra.id] = f.slotW;
    } else if (tactic === 'iso_clear' || tactic === 'iso_mid') {
      off[r.ball.id] = tactic === 'iso_mid' ? f.elbowS : f.wingS;
      if (r.passer) off[r.passer.id] = f.cornerW;
      if (r.wing) off[r.wing.id] = f.slotW;
      if (r.corner) off[r.corner.id] = f.cornerS;
      if (r.big) off[r.big.id] = [78, 25];
      if (r.extra) off[r.extra.id] = f.slotS;
    } else if (tactic === 'floppy' || tactic === 'hammer' || tactic === 'elevator') {
      if (r.passer) off[r.passer.id] = f.top;
      off[r.ball.id] = tactic === 'hammer' ? f.cornerS : [82, strong === 'L' ? 8 : 42];
      if (r.big) off[r.big.id] = f.elbowS;
      if (r.wing) off[r.wing.id] = f.slotW;
      if (r.corner) off[r.corner.id] = f.cornerW;
      if (r.extra) off[r.extra.id] = f.dunkerW;
    } else if (tactic === 'trans_coast' || tactic === 'trans_num' || tactic === 'steal') {
      off[r.ball.id] = clone(Z.back);
      if (r.wing) off[r.wing.id] = [28, 12];
      if (r.big) off[r.big.id] = [26, 32];
      if (r.corner) off[r.corner.id] = [34, 8];
      if (r.extra) off[r.extra.id] = [32, 40];
      if (r.passer) off[r.passer.id] = [22, 28];
    } else if (tactic === 'ft') {
      off[r.ball.id] = clone(Z.ftShooter);
      if (r.big) off[r.big.id] = [88, 18];
      if (r.wing) off[r.wing.id] = [88, 32];
      if (r.corner) off[r.corner.id] = [70, 10];
      if (r.extra) off[r.extra.id] = [70, 40];
      if (r.passer) off[r.passer.id] = [62, 25];
    } else if (tactic === 'horns' || tactic === 'spain') {
      off[r.ball.id] = f.top;
      if (r.big) off[r.big.id] = Z.elbowL;
      if (r.wing) off[r.wing.id] = Z.elbowR;
      if (r.corner) off[r.corner.id] = f.cornerS;
      if (r.extra) off[r.extra.id] = f.cornerW;
      if (r.passer) off[r.passer.id] = r.big ? Z.elbowL : f.slotS;
    } else if (tactic === 'putback') {
      off[r.ball.id] = clone(Z.paint);
      if (r.passer) off[r.passer.id] = f.slotS;
      if (r.wing) off[r.wing.id] = f.cornerS;
      if (r.corner) off[r.corner.id] = f.cornerW;
      if (r.big && r.big !== r.ball) off[r.big.id] = f.dunkerW;
      if (r.extra) off[r.extra.id] = f.top;
    } else {
      off[r.ball.id] = tactic === 'pnr_high' ? f.top : f.slotS;
      if (r.big) off[r.big.id] = tactic === 'pnr_high' ? [72, 25] : f.elbowS;
      if (r.passer && r.passer !== r.big) off[r.passer.id] = f.top;
      if (r.wing) off[r.wing.id] = f.cornerS;
      if (r.corner) off[r.corner.id] = f.cornerW;
      if (r.extra) off[r.extra.id] = f.slotW;
    }
    return off;
  }

  function placeDef(offPos, r, contest) {
    var def = {}, id, xy, man;
    var sag = contest === 'open' ? 0.28 : (contest === 'close' ? 0.14 : 0.10);
    if (r.onBall && offPos[r.ball && r.ball.id]) {
      def[r.onBall.id] = shade(offPos[r.ball.id], contest === 'open' ? 0.34 : 0.12);
    }
    function cover(pl, fallback) {
      if (!pl) return;
      man = offPos[pl.id];
      def[pl.id] = man ? shade(man, sag) : clone(fallback || Z.nail);
    }
    cover(r.d2, Z.slotR);
    cover(r.d3, Z.slotL);
    cover(r.d4, Z.cornerR);
    cover(r.d5, Z.paint);
    if (r.help) {
      xy = contest === 'heavy' ? lerp(Z.nail, Z.rim, 0.4) : clone(Z.nail);
      if (contest === 'help' || contest === 'heavy') def[r.help.id] = xy;
      else if (r.help && offPos[(r.corner || r.extra || r.wing || {}).id]) {
        cover(r.help, Z.nail);
      }
    }
    if (r.blocker && (contest === 'help' || contest === 'heavy')) def[r.blocker.id] = clone(Z.rim);
    for (id in def) def[id] = jitter(def[id], 0.45);
    return def;
  }

  function applyBranch(off, r, input) {
    var next = {}, id, z;
    for (id in off) next[id] = clone(off[id]);
    var ball = r.ball && r.ball.id;
    var branch = input.branch;
    var action = input.action;
    var strong = input.strong || 'R';
    if (!ball) return next;
    if (branch === 'turn' || action === 'euro' || action === 'slash' || action === 'hop' || action === 'cross' || action === 'hesi' || action === 'faceup' || action === 'reverse') {
      next[ball] = lerp(off[ball], Z.rim, 0.55);
    } else if (branch === 'roll' || action === 'lob' || branch === 'slip') {
      if (r.big) next[r.big.id] = clone(strongSide(strong, 'dunkerL', 'dunkerR'));
      if (action === 'lob' && r.ball) next[ball] = clone(Z.rim);
    } else if (branch === 'pop') {
      if (r.big) next[r.big.id] = clone(Z.top);
    } else if (branch === 'extra' || branch === 'kick' || action === 'spot' || branch === 'corner') {
      z = strongSide(strong, 'cornerL', 'cornerR');
      next[ball] = clone(z);
      if (r.passer) next[r.passer.id] = clone(Z.slotR);
    } else if (action === 'cut' || action === 'backdoor' || branch === 'cut') {
      next[ball] = lerp(strongSide(strong, 'cornerL', 'cornerR'), Z.slotR, 0.4);
    } else if (action === 'stepback' || action === 'snatch' || branch === 'step') {
      next[ball] = lerp(off[ball], Z.logo, 0.35);
    } else if (action === 'fade' || action === 'hook' || action === 'skyhook' || action === 'dropstep' || action === 'upunder' || action === 'postspin') {
      next[ball] = clone(strongSide(strong, 'postL', 'postR'));
    } else if (action === 'coast' || branch === 'coast') {
      next[ball] = clone(Z.midc);
    } else if (action === 'catch' || action === 'flare' || action === 'pin' || action === 'dho') {
      next[ball] = clone(strongSide(strong, 'slotL', 'slotR'));
    } else if (action === 'pull3' || action === 'trail') {
      next[ball] = clone(action === 'trail' ? Z.trail : Z.top);
    } else if (action === 'putback' || action === 'tip') {
      next[ball] = clone(Z.rim);
    }
    return next;
  }

  function applyFinish(off, r, input) {
    var next = {}, id;
    for (id in off) next[id] = clone(off[id]);
    var ball = r.ball && r.ball.id;
    if (!ball) return next;
    var action = input.action;
    var zmap = {
      rim: Z.rim, paint: Z.paint, ft: Z.ft, elbow: Z.elbowR, slot: Z.slotR,
      wing: Z.wingR, corner: Z.cornerR, top: Z.top, post: Z.postR,
      dunker: Z.dunkerR, short: Z.shortR, logo: Z.logo, mid: Z.ft, nail: Z.nail
    };
    var zone = zmap[input.zone] || off[ball];
    if (input.strong === 'L') {
      if (input.zone === 'elbow') zone = Z.elbowL;
      if (input.zone === 'slot') zone = Z.slotL;
      if (input.zone === 'wing') zone = Z.wingL;
      if (input.zone === 'corner') zone = Z.cornerL;
      if (input.zone === 'post') zone = Z.postL;
      if (input.zone === 'dunker') zone = Z.dunkerL;
      if (input.zone === 'short') zone = Z.shortL;
    }
    if (action === 'coast') zone = Z.rim;
    if (action === 'lob') zone = Z.rim;
    next[ball] = clone(zone);
    if (input.beat && r.onBall) { /* defender beaten: stay behind */ }
    return next;
  }

  function applyOutcome(off, def, r, input) {
    var o2 = {}, d2 = {}, id;
    for (id in off) o2[id] = clone(off[id]);
    for (id in def) d2[id] = clone(def[id]);
    var ball = r.ball && r.ball.id;
    if (input.contest === 'open' && r.onBall && ball && o2[ball]) {
      d2[r.onBall.id] = shade(o2[ball], 0.42);
    }
    if ((input.contest === 'help' || input.contest === 'heavy') && r.help) {
      d2[r.help.id] = lerp(Z.nail, o2[ball] || Z.rim, 0.55);
    }
    if (input.contest === 'heavy' && r.onBall && r.help && ball) {
      d2[r.onBall.id] = lerp(o2[ball] || Z.top, Z.rim, 0.15);
    }
    if (input.outcome === 'blk' && r.blocker) d2[r.blocker.id] = clone(Z.rim);
    if (input.kind === 'stl' && r.stealer) {
      d2[r.stealer.id] = o2[ball] ? clone(o2[ball]) : clone(Z.midc);
    }
    if (input.outcome === 'make' && /layup|dunk|euro|hop|slash|reverse|coast|lob|putback/.test(input.action || '')) {
      if (ball) o2[ball] = clone(Z.rim);
    }
    return { off: o2, def: d2 };
  }

  PP_COURT.TACTICS = TACTIC_META;

  PP_COURT.compose = function (input) {
    input = input || {};
    var r = assign(input);
    var tactic = input.tactic || 'pnr_side';
    var strong = input.strong || 'R';
    var camera = (TACTIC_META[tactic] && TACTIC_META[tactic].camera) || 'half';
    if (input.camera) camera = input.camera;
    var off0 = placeOff(r, strong, tactic);
    var def0 = placeDef(off0, r, input.contest);
    var off1 = applyBranch(off0, r, input);
    var def1 = placeDef(off1, r, input.contest);
    var off2 = applyFinish(off1, r, input);
    var def2 = placeDef(off2, r, input.contest);
    var end = applyOutcome(off2, def2, r, input);
    var ball0 = r.passer ? r.passer.id : (r.ball && r.ball.id);
    var ball1 = r.passer && /catch|spot|cut|lob|flare|pin|dho|extra|kick/.test(String(input.action) + String(input.branch))
      ? (r.ball && r.ball.id) : ball0;
    var ball2 = r.ball && r.ball.id;
    if (input.kind === 'stl' && r.stealer) { ball0 = r.ball && r.ball.id; ball1 = r.stealer.id; ball2 = r.stealer.id; }
    if (input.kind === 'tov') { ball2 = null; }
    return {
      camera: camera,
      tactic: tactic,
      branch: input.branch,
      zone: input.zone,
      frames: [
        { t: 0, dots: packDots(off0, def0, input, ball0) },
        { t: 0.32, dots: packDots(off1, def1, input, ball1) },
        { t: 0.68, dots: packDots(off2, def2, input, ball2) },
        { t: 1, dots: packDots(end.off, end.def, input, input.outcome === 'make' || input.outcome === 'andone' ? ball2 : ball2) }
      ]
    };
  };

  /* ---------- SVG ---------- */
  var svg, dotsG, ballEl, wrap, raf, enabled = true;

  function courtLines() {
    var ns = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(ns, 'g');
    function line(x1, y1, x2, y2) {
      var e = document.createElementNS(ns, 'line');
      e.setAttribute('x1', x1); e.setAttribute('y1', y1); e.setAttribute('x2', x2); e.setAttribute('y2', y2);
      e.setAttribute('class', 'pp-court-line');
      g.appendChild(e);
    }
    function rect(x, y, w, h) {
      var e = document.createElementNS(ns, 'rect');
      e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('width', w); e.setAttribute('height', h);
      e.setAttribute('class', 'pp-court-line'); e.setAttribute('fill', 'none');
      g.appendChild(e);
    }
    function arc(d) {
      var e = document.createElementNS(ns, 'path');
      e.setAttribute('d', d); e.setAttribute('class', 'pp-court-line'); e.setAttribute('fill', 'none');
      g.appendChild(e);
    }
    rect(2, 2, 96, 46);
    line(50, 2, 50, 48);
    rect(2, 17, 14, 16);
    rect(84, 17, 14, 16);
    arc('M 2 10 A 22 22 0 0 1 2 40');
    arc('M 98 10 A 22 22 0 0 0 98 40');
    var c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '50'); c.setAttribute('cy', '25'); c.setAttribute('r', '6');
    c.setAttribute('class', 'pp-court-line'); c.setAttribute('fill', 'none');
    g.appendChild(c);
    return g;
  }

  function injectCourtStyle() {
    if (document.getElementById('pp-court-style')) return;
    var s = document.createElement('style');
    s.id = 'pp-court-style';
    s.textContent =
      '.pp-live-court-wrap{height:158px;background:var(--bg-card);border-bottom:1px solid var(--border);flex-shrink:0;position:relative}' +
      '.pp-live-court-wrap.is-off{display:none}' +
      '.pp-live-court{width:100%;height:100%;display:block}' +
      '.pp-court-line{stroke:var(--border);stroke-width:0.45}' +
      '.pp-dot-home{fill:#f4f4f4;stroke:#2a2a2a;stroke-width:0.35}' +
      '.pp-dot-away{fill:#1a1a1a;stroke:#d8d8d8;stroke-width:0.35}' +
      '.pp-dot-hero{fill:#d4a017;stroke:#fff4c2;stroke-width:0.7}' +
      '.pp-dot-hero-ring{fill:none;stroke:#ffe38a;stroke-width:0.55;opacity:.9}' +
      '.pp-court-ball{fill:var(--orange);stroke:#fff;stroke-width:0.2}';
    document.head.appendChild(s);
  }

  PP_COURT.mount = function (host) {
    injectCourtStyle();
    wrap = typeof host === 'string' ? document.getElementById(host) : (host || document.getElementById('pp-live-court-wrap'));
    if (!wrap) return null;
    wrap.innerHTML = '';
    wrap.className = 'pp-live-court-wrap';
    wrap.id = 'pp-live-court-wrap';
    var ns = 'http://www.w3.org/2000/svg';
    svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'pp-live-court');
    svg.setAttribute('viewBox', '48 0 52 50');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(courtLines());
    dotsG = document.createElementNS(ns, 'g');
    svg.appendChild(dotsG);
    ballEl = document.createElementNS(ns, 'circle');
    ballEl.setAttribute('r', '1.05');
    ballEl.setAttribute('class', 'pp-court-ball');
    svg.appendChild(ballEl);
    wrap.appendChild(svg);
    enabled = true;
    return wrap;
  };

  PP_COURT.setEnabled = function (on) {
    enabled = !!on;
    if (wrap) wrap.classList.toggle('is-off', !enabled);
    if (!enabled && raf) { cancelAnimationFrame(raf); raf = 0; }
  };

  function setCamera(camera) {
    if (!svg) return;
    if (camera === 'full') svg.setAttribute('viewBox', '0 0 100 50');
    else svg.setAttribute('viewBox', '48 0 52 50');
  }

  function drawDots(dots) {
    if (!dotsG) return;
    var ns = 'http://www.w3.org/2000/svg';
    while (dotsG.firstChild) dotsG.removeChild(dotsG.firstChild);
    var i, d, ring, c, ball = null;
    for (i = 0; i < (dots || []).length; i++) {
      d = dots[i];
      if (d.kind === 'hero') {
        ring = document.createElementNS(ns, 'circle');
        ring.setAttribute('cx', d.x); ring.setAttribute('cy', d.y); ring.setAttribute('r', '2.35');
        ring.setAttribute('class', 'pp-dot-hero-ring');
        dotsG.appendChild(ring);
      }
      c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', d.x); c.setAttribute('cy', d.y);
      c.setAttribute('r', d.kind === 'hero' ? '1.7' : '1.45');
      c.setAttribute('class', d.kind === 'hero' ? 'pp-dot-hero' : (d.kind === 'home' ? 'pp-dot-home' : 'pp-dot-away'));
      dotsG.appendChild(c);
      if (d.ball) ball = d;
    }
    if (ballEl) {
      if (ball) {
        ballEl.setAttribute('cx', ball.x + 1.6);
        ballEl.setAttribute('cy', ball.y - 1.2);
        ballEl.style.display = '';
      } else ballEl.style.display = 'none';
    }
  }

  function mixDots(a, b, t) {
    var map = {}, i, d, out = [];
    for (i = 0; i < (b || []).length; i++) map[b[i].id] = b[i];
    for (i = 0; i < (a || []).length; i++) {
      d = a[i];
      if (map[d.id]) out.push({
        id: d.id, kind: d.kind, ball: t > 0.5 ? map[d.id].ball : d.ball,
        x: d.x + (map[d.id].x - d.x) * t,
        y: d.y + (map[d.id].y - d.y) * t
      });
      else out.push(d);
    }
    return out;
  }

  PP_COURT.play = function (clip, duration) {
    if (!enabled || !clip || !clip.frames || !svg) return;
    if (raf) cancelAnimationFrame(raf);
    setCamera(clip.camera || 'half');
    duration = Math.max(400, duration || 1400);
    var frames = clip.frames;
    var t0 = performance.now();
    function tick(now) {
      var u = Math.min(1, (now - t0) / duration);
      var i, a, b, local;
      for (i = 0; i < frames.length - 1; i++) {
        if (u >= frames[i].t && u <= frames[i + 1].t) {
          a = frames[i]; b = frames[i + 1];
          local = (u - a.t) / Math.max(0.0001, b.t - a.t);
          drawDots(mixDots(a.dots, b.dots, local));
          raf = requestAnimationFrame(tick);
          return;
        }
      }
      drawDots(frames[frames.length - 1].dots);
      raf = 0;
    }
    drawDots(frames[0].dots);
    raf = requestAnimationFrame(tick);
  };

  PP_COURT.snap = function (clip) {
    if (!clip || !clip.frames) return;
    setCamera(clip.camera || 'half');
    drawDots(clip.frames[clip.frames.length - 1].dots);
  };
})();
