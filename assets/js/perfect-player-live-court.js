/* ============================================================
 * Perfect Player — 俯瞰球场跑位
 * 坐标单位：英尺。NBA 全场 94 × 50。进攻篮默认在右侧。
 * ============================================================ */
(function () {
  'use strict';
  var PP_COURT = window.PP_COURT = window.PP_COURT || {};

  var COURT_L = 94;
  var COURT_W = 50;
  var HOOP_IN = 5.25;
  var PAINT_L = 19;
  var PAINT_W = 16;
  var FT_R = 6;
  var THREE_R = 23.75;
  var CORNER_3 = 22;
  var SIDELINE_3 = 3;
  var RIM_R = 0.75;
  var RESTRICT_R = 4;
  var BACKBOARD_IN = 4;
  var BACKBOARD_W = 6;

  var RIM = [COURT_L - HOOP_IN, COURT_W / 2];
  var FT = [COURT_L - PAINT_L, COURT_W / 2];
  var MID = [COURT_L / 2, COURT_W / 2];

  var cornerInset = Math.sqrt(THREE_R * THREE_R - (COURT_W / 2 - SIDELINE_3) * (COURT_W / 2 - SIDELINE_3));
  var THREE_CORNER_X = RIM[0] - cornerInset;

  var Z = {
    rim: [RIM[0] - 2.2, 25],
    paint: [RIM[0] - 7.5, 25],
    ft: [FT[0], 25],
    nail: [FT[0] - 5.5, 25],
    elbowL: [FT[0], 17],
    elbowR: [FT[0], 33],
    slotL: [RIM[0] - 18, 11],
    slotR: [RIM[0] - 18, 39],
    wingL: [RIM[0] - 16.8, 8.2],
    wingR: [RIM[0] - 16.8, 41.8],
    cornerL: [RIM[0] + 2.4, SIDELINE_3 + 0.6],
    cornerR: [RIM[0] + 2.4, COURT_W - SIDELINE_3 - 0.6],
    top: [RIM[0] - THREE_R, 25],
    logo: [RIM[0] - THREE_R - 8, 25],
    postL: [RIM[0] - 5.5, 18.5],
    postR: [RIM[0] - 5.5, 31.5],
    dunkerL: [RIM[0] - 2.5, 13.5],
    dunkerR: [RIM[0] - 2.5, 36.5],
    shortL: [RIM[0] + 1.2, 10],
    shortR: [RIM[0] + 1.2, 40],
    hashL: [MID[0] + 8, 10],
    hashR: [MID[0] + 8, 40],
    trail: [MID[0] + 6, 22],
    back: [18, 25],
    midc: [MID[0], 25],
    inbound: [COURT_L - 1.2, 8]
  };

  function clone(xy) { return [xy[0], xy[1]]; }
  function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function dist(a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }
  function toward(from, to, feet) {
    var dx = to[0] - from[0], dy = to[1] - from[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var t = feet / len;
    if (t > 0.92) t = 0.92;
    return [from[0] + dx * t, from[1] + dy * t];
  }
  function away(from, origin, feet) {
    var dx = from[0] - origin[0], dy = from[1] - origin[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [from[0] + dx / len * feet, from[1] + dy / len * feet];
  }
  function cloneMap(m) {
    var o = {}, id;
    for (id in m) o[id] = clone(m[id]);
    return o;
  }
  function lerpMap(a, b, t) {
    var o = {}, id;
    for (id in a) o[id] = b[id] ? lerp(a[id], b[id], t) : clone(a[id]);
    for (id in b) if (!o[id]) o[id] = clone(b[id]);
    return o;
  }
  function sampleMaps(maps, t) {
    var n = maps.length - 1;
    var u, i, local;
    if (n <= 0) return cloneMap(maps[0]);
    u = clamp(t, 0, 1) * n;
    i = Math.min(n - 1, Math.floor(u));
    local = u - i;
    return catmullMap(
      maps[Math.max(0, i - 1)],
      maps[i],
      maps[i + 1] || maps[i],
      maps[Math.min(maps.length - 1, i + 2)],
      local
    );
  }
  function put(map, p, xy) {
    if (p && xy) map[p.id] = clone(xy);
  }
  function quad(a, c, b, t) {
    var u = 1 - t;
    return [
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]
    ];
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function catmull1(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  function catmullMap(p0, p1, p2, p3, t) {
    var o = {}, id, a, b, c, d;
    for (id in p1) {
      a = p0[id] || p1[id];
      b = p1[id];
      c = (p2 && p2[id]) || b;
      d = (p3 && p3[id]) || c;
      o[id] = [
        clamp(catmull1(a[0], b[0], c[0], d[0], t), 1.3, COURT_L - 1.3),
        clamp(catmull1(a[1], b[1], c[1], d[1], t), 1.3, COURT_W - 1.3)
      ];
    }
    if (p2) for (id in p2) if (!o[id]) o[id] = clone(p2[id]);
    return o;
  }
  function idHash(id) {
    var s = String(id || ''), h = 0, i;
    for (i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
    return (h >>> 0) / 4294967296;
  }
  function sid(strong, L, R) { return strong === 'L' ? Z[L] : Z[R]; }
  function wid(strong, L, R) { return strong === 'L' ? Z[R] : Z[L]; }

  function findP(list, id) {
    if (!id || !list) return null;
    var i;
    for (i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function unique(list) {
    var seen = {}, out = [], i, p;
    for (i = 0; i < (list || []).length; i++) {
      p = list[i];
      if (!p || seen[p.id]) continue;
      seen[p.id] = true;
      out.push(p);
    }
    return out;
  }
  var POS_N = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  function posN(p) { return POS_N[(p && p.pos) || 'SF'] != null ? POS_N[p.pos] : 2; }

  function homeAway(p, input) {
    if (!p) return 'away';
    if (p.hero) return 'hero';
    var offIsHome = (input.side === 'A') === !!input.teamAHome;
    if (p.team === 'off') return offIsHome ? 'home' : 'away';
    return offIsHome ? 'away' : 'home';
  }

  function assign(input) {
    var off = unique(input.off).slice(0, 5);
    var def = unique(input.def).slice(0, 5);
    var ball = findP(off, input.shooter) || findP(off, input.loser) || off[0];
    var passer = findP(off, input.passer);
    var rest = off.filter(function (p) { return p && ball && p.id !== ball.id; });
    rest.sort(function (a, b) { return posN(a) - posN(b); });
    var big = rest.filter(function (p) { return p.pos === 'C' || p.pos === 'PF'; })[0] || rest[0];
    if (passer && (passer.pos === 'C' || passer.pos === 'PF')) big = passer;
    var wing = rest.filter(function (p) { return p !== big && (p.pos === 'SG' || p.pos === 'SF'); })[0] || rest.filter(function (p) { return p !== big; })[0];
    var corner = rest.filter(function (p) { return p !== big && p !== wing; })[0];
    var extra = rest.filter(function (p) { return p !== big && p !== wing && p !== corner; })[0];
    var offOrder = [];
    function add(p) { if (p && offOrder.indexOf(p) < 0) offOrder.push(p); }
    add(ball); add(passer); add(big); add(wing); add(corner); add(extra);
    off.forEach(add);

    var used = {};
    var guardOf = {};
    function takeDef(id) {
      var p = findP(def, id);
      if (p && !used[p.id]) { used[p.id] = true; return p; }
      return null;
    }
    var onBall = takeDef(input.matchup);
    if (!onBall && def[0]) { onBall = def[0]; used[onBall.id] = true; }
    if (onBall && ball) guardOf[ball.id] = onBall;
    var leftover = def.filter(function (p) { return p && !used[p.id]; });
    leftover.sort(function (a, b) { return posN(a) - posN(b); });
    offOrder.forEach(function (op) {
      if (!op || guardOf[op.id]) return;
      var best = -1, bi = 0, i, s;
      for (i = 0; i < leftover.length; i++) {
        s = 6 - Math.abs(posN(leftover[i]) - posN(op));
        if (s > best) { best = s; bi = i; }
      }
      if (leftover.length) guardOf[op.id] = leftover.splice(bi, 1)[0];
    });
    var help = findP(def, input.help);
    if (help && onBall && help.id === onBall.id) help = null;
    return {
      ball: ball, passer: passer, big: big, wing: wing, corner: corner, extra: extra,
      offOrder: offOrder, guardOf: guardOf, onBall: onBall, help: help,
      blocker: findP(def, input.blocker), stealer: findP(def, input.stealer)
    };
  }

  function slotsFor(tactic, strong) {
    var cS = sid(strong, 'cornerL', 'cornerR');
    var cW = wid(strong, 'cornerL', 'cornerR');
    var sS = sid(strong, 'slotL', 'slotR');
    var sW = wid(strong, 'slotL', 'slotR');
    var wS = sid(strong, 'wingL', 'wingR');
    var eS = sid(strong, 'elbowL', 'elbowR');
    var pS = sid(strong, 'postL', 'postR');
    var dW = wid(strong, 'dunkerL', 'dunkerR');
    if (tactic === 'post') return [lerp(pS, eS, 0.55), sS, cS, cW, sW];
    if (tactic === 'iso_clear') return [wS, dW, cW, cS, sW];
    if (tactic === 'iso_mid') return [eS, cW, sW, cS, sS];
    if (tactic === 'floppy' || tactic === 'hammer' || tactic === 'elevator') {
      return [lerp(cS, [RIM[0] - 7, (cS[1] + 25) / 2], 0.5), Z.top, eS, cW, sW];
    }
    if (tactic === 'horns' || tactic === 'spain') return [Z.top, Z.elbowL, Z.elbowR, cS, cW];
    if (tactic === 'dho') return [sS, eS, cS, cW, sW];
    if (tactic === 'five_out' || tactic === 'zone') return [Z.top, sS, sW, cS, cW];
    if (tactic === 'delay') return [Z.top, sS, cS, cW, sW];
    if (tactic === 'putback') return [Z.paint, sS, cS, cW, Z.top];
    if (tactic === 'ft') return [Z.ft, [RIM[0] - 3, 18], [RIM[0] - 3, 32], [68, 10], [68, 40]];
    if (tactic === 'trans_num') return [Z.top, sS, sW, cS, cW];
    if (tactic === 'trans_coast' || tactic === 'steal') {
      return [Z.back, [28, 12], [28, 38], [38, 8], [36, 42]];
    }
    if (tactic === 'pnr_high') return [Z.top, [FT[0] - 4, 25], cS, cW, sW];
    return [sS, eS, cS, cW, sW];
  }

  function placeOff(r, tactic, strong) {
    var slots = slotsFor(tactic, strong);
    var off = {}, i, p;
    for (i = 0; i < r.offOrder.length && i < slots.length; i++) {
      p = r.offOrder[i];
      if (p) off[p.id] = clone(slots[i]);
    }
    return off;
  }

  function matesOf(r) {
    var ball = r.ball;
    var used = {};
    if (ball) used[ball.id] = true;
    function next(prefer) {
      if (prefer && !used[prefer.id]) { used[prefer.id] = true; return prefer; }
      var i, p;
      for (i = 0; i < r.offOrder.length; i++) {
        p = r.offOrder[i];
        if (p && !used[p.id]) { used[p.id] = true; return p; }
      }
      return null;
    }
    return {
      ball: ball,
      passer: next(r.passer),
      big: next(r.big),
      wing: next(r.wing),
      extra: next(r.corner) || next(r.extra) || next(null)
    };
  }

  function offensePlan(r, input) {
    var strong = input.strong || 'R';
    var tactic = input.tactic || 'pnr_side';
    var action = input.action || '';
    var branch = input.branch || '';
    var zone = shotZone(input);
    if (action === 'coast' || tactic === 'trans_coast') zone = clone(Z.rim);
    if (action === 'lob') zone = clone(Z.rim);
    var set = placeOff(r, tactic, strong);
    var act = cloneMap(set);
    var shot = cloneMap(set);
    var m = matesOf(r);
    var cS = sid(strong, 'cornerL', 'cornerR');
    var cW = wid(strong, 'cornerL', 'cornerR');
    var sS = sid(strong, 'slotL', 'slotR');
    var sW = wid(strong, 'slotL', 'slotR');
    var wS = sid(strong, 'wingL', 'wingR');
    var wW = wid(strong, 'wingL', 'wingR');
    var eS = sid(strong, 'elbowL', 'elbowR');
    var dS = sid(strong, 'dunkerL', 'dunkerR');
    var dW = wid(strong, 'dunkerL', 'dunkerR');
    var pS = sid(strong, 'postL', 'postR');
    var start = m.ball && set[m.ball.id] ? clone(set[m.ball.id]) : clone(sS);
    var drive = isDrive(action) || branch === 'turn' || branch === 'drive';
    var ballCurve = null;

    function relocate(p, dest, maxFeet) {
      if (!p || !set[p.id] || !dest) return;
      var here = set[p.id];
      var cap = maxFeet == null ? 11 : maxFeet;
      var there = dist(here, dest) > cap ? toward(here, dest, cap) : clone(dest);
      put(act, p, lerp(here, there, 0.62));
      put(shot, p, there);
    }
    function spaceOut(p) {
      if (!p || !set[p.id]) return;
      put(act, p, away(set[p.id], RIM, 3.2));
      put(shot, p, away(set[p.id], RIM, 5.4));
    }
    function dummyCut(p) {
      if (!p || !set[p.id]) return;
      var here = set[p.id];
      put(act, p, toward(here, Z.paint, 9));
      put(shot, p, toward(here, here[1] < 25 ? cS : cW, 6));
    }

    if (tactic === 'trans_coast' || tactic === 'steal' || action === 'coast') {
      put(act, m.ball, clone(Z.midc));
      put(shot, m.ball, clone(Z.rim));
      relocate(m.wing, cS, 22);
      relocate(m.big, dW, 22);
      relocate(m.passer, sW, 20);
      relocate(m.extra, cW, 22);
      return { set: set, act: act, shot: shot, ballId: m.ball && m.ball.id, ballCurve: null };
    }

    if (drive) {
      ballCurve = { a: start, c: [(start[0] + zone[0]) / 2 + 1.4, (start[1] + 25) / 2], b: zone };
      put(act, m.ball, quad(start, ballCurve.c, zone, 0.45));
      put(shot, m.ball, zone);
    } else if (action === 'cut' || action === 'backdoor' || branch === 'cut') {
      put(act, m.ball, [sS[0], (start[1] + zone[1]) / 2]);
      put(shot, m.ball, zone);
    } else if (action === 'stepback' || action === 'snatch' || branch === 'step') {
      put(act, m.ball, toward(start, zone, 2.2));
      put(shot, m.ball, toward(start, Z.logo, 5.5));
    } else {
      put(act, m.ball, toward(start, zone, 5));
      put(shot, m.ball, zone);
    }

    if (tactic === 'post') {
      relocate(m.passer, sW, 10);
      spaceOut(m.wing);
      dummyCut(m.extra);
      relocate(m.big, dW, 10);
    } else if (tactic === 'iso_clear' || tactic === 'iso_mid' || tactic === 'delay') {
      relocate(m.big, dW, 10);
      spaceOut(m.wing);
      dummyCut(m.extra);
      spaceOut(m.passer);
    } else if (tactic === 'floppy' || tactic === 'hammer' || tactic === 'elevator') {
      relocate(m.passer, sW, 10);
      relocate(m.big, branch === 'roll' ? dS : Z.top, 12);
      relocate(m.wing, wW, 10);
      spaceOut(m.extra);
    } else if (tactic === 'five_out' || tactic === 'zone') {
      relocate(m.passer, sW, 10);
      relocate(m.wing, cS, 10);
      dummyCut(m.big);
      spaceOut(m.extra);
    } else {
      if (branch === 'pop') relocate(m.big, Z.top, 12);
      else if (branch === 'roll' || branch === 'slip' || action === 'lob') relocate(m.big, action === 'lob' ? Z.rim : dS, 12);
      else relocate(m.big, drive ? dS : eS, 11);
      spaceOut(m.wing);
      relocate(m.passer, sW, 10);
      dummyCut(m.extra);
    }

    r.offOrder.forEach(function (p, i) {
      if (!p || !set[p.id]) return;
      if (dist(set[p.id], act[p.id] || set[p.id]) > 0.8) return;
      if (i % 2) dummyCut(p);
      else spaceOut(p);
    });

    return { set: set, act: act, shot: shot, ballId: m.ball && m.ball.id, ballCurve: ballCurve };
  }

  function poseDef(offNow, offSet, r, input, t) {
    var contest = input.contest || 'close';
    var ballId = r.ball && r.ball.id;
    var ballXy = (ballId && offNow[ballId]) || clone(Z.ft);
    var def = {};
    var id, manNow, manSet, gp, isOn, isHelp, shell, cover, stunt, endGap, coverNow, stuntW;
    t = clamp(t, 0, 1);
    for (id in r.guardOf) {
      manNow = offNow[id];
      manSet = offSet[id];
      gp = r.guardOf[id];
      if (!manNow || !gp) continue;
      isOn = !!(r.onBall && gp.id === r.onBall.id);
      isHelp = !!(r.help && gp.id === r.help.id && (contest === 'help' || contest === 'heavy') && !isOn);
      shell = lerp(toward(manSet || manNow, RIM, isOn ? 6.5 : 9.5), toward(manSet || manNow, [FT[0] - 8, 25], isOn ? 3 : 5.5), 0.55);
      endGap = isOn ? (contest === 'open' ? 8.2 : (contest === 'close' ? 5.6 : 4.1)) : (id === ballId ? (contest === 'open' ? 8.5 : 5.2) : 6.8);
      cover = toward(manNow, RIM, endGap);
      if (isHelp) cover = toward(ballXy, RIM, contest === 'heavy' ? 3.1 : 5.4);
      stunt = toward(shell, ballXy, 4.2);
      if (isOn) {
        def[gp.id] = lerp(shell, cover, t);
        if (input.beat) {
          def[gp.id] = lerp(def[gp.id], away(manNow, RIM, 2.4), clamp((t - 0.35) / 0.65, 0, 1));
        }
      } else if (isHelp) {
        def[gp.id] = lerp(shell, cover, clamp((t - 0.06) / 0.72, 0, 1));
      } else {
        coverNow = lerp(shell, cover, t);
        stuntW = Math.sin(Math.PI * clamp(t / 0.82, 0, 1)) * 0.5;
        def[gp.id] = lerp(coverNow, stunt, stuntW);
      }
    }
    if (input.outcome === 'blk' && r.blocker) {
      def[r.blocker.id] = lerp(def[r.blocker.id] || clone(Z.rim), clone(Z.rim), clamp((t - 0.45) / 0.4, 0, 1));
    }
    if (input.kind === 'stl' && r.stealer && ballId && offNow[ballId]) {
      def[r.stealer.id] = lerp(def[r.stealer.id] || clone(offNow[ballId]), clone(offNow[ballId]), t);
    }
    return def;
  }

  function shotZone(input) {
    var strong = input.strong || 'R';
    var z = input.zone;
    var map = {
      rim: Z.rim, paint: Z.paint, ft: Z.ft, nail: Z.nail, top: Z.top, logo: Z.logo, mid: Z.ft
    };
    if (map[z]) return clone(map[z]);
    if (z === 'elbow') return clone(sid(strong, 'elbowL', 'elbowR'));
    if (z === 'slot') return clone(sid(strong, 'slotL', 'slotR'));
    if (z === 'wing') return clone(sid(strong, 'wingL', 'wingR'));
    if (z === 'corner') return clone(sid(strong, 'cornerL', 'cornerR'));
    if (z === 'post') return clone(sid(strong, 'postL', 'postR'));
    if (z === 'dunker') return clone(sid(strong, 'dunkerL', 'dunkerR'));
    if (z === 'short') return clone(sid(strong, 'shortL', 'shortR'));
    return clone(Z.wingR);
  }

  function isDrive(action) {
    return /^(euro|hop|upunder|slash|layup|dunk|cross|hesi|reverse|faceup|backdoor|dropstep|putback)$/.test(action || '');
  }

  function separate(maps, minD) {
    var pts = [], i, j, a, b, dx, dy, d, ux, uy, push, k, id;
    for (k = 0; k < maps.length; k++) {
      for (id in maps[k]) pts.push(maps[k][id]);
    }
    for (k = 0; k < 3; k++) {
      for (i = 0; i < pts.length; i++) {
        for (j = i + 1; j < pts.length; j++) {
          a = pts[i]; b = pts[j];
          dx = a[0] - b[0]; dy = a[1] - b[1];
          d = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (d < minD) {
            ux = dx / d; uy = dy / d;
            push = (minD - d) / 2;
            a[0] += ux * push; a[1] += uy * push;
            b[0] -= ux * push; b[1] -= uy * push;
          }
        }
      }
    }
    pts.forEach(function (p) {
      p[0] = clamp(p[0], 1.6, COURT_L - 1.6);
      p[1] = clamp(p[1], 1.6, COURT_W - 1.6);
    });
  }

  function packDots(offPos, defPos, input) {
    var dots = [], id, p;
    for (id in offPos) {
      p = findP(input.off, id);
      if (p) dots.push({ id: p.id, x: offPos[id][0], y: offPos[id][1], kind: homeAway(p, input) });
    }
    for (id in defPos) {
      p = findP(input.def, id);
      if (p) dots.push({ id: p.id, x: defPos[id][0], y: defPos[id][1], kind: homeAway(p, input) });
    }
    return dots;
  }

  function hoopAt(attackRight) {
    return attackRight === false ? [HOOP_IN, COURT_W / 2] : [COURT_L - HOOP_IN, COURT_W / 2];
  }

  function holdBall(xy, attackRight) {
    if (!xy) return null;
    var hoop = hoopAt(attackRight);
    var dx = hoop[0] - xy[0], dy = hoop[1] - xy[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: xy[0] + dx / len * 1.32,
      y: xy[1] + dy / len * 1.08,
      z: 0.38
    };
  }

  function flyAt(seg, u) {
    u = clamp(u, 0, 1);
    var a = seg.a, b = seg.b;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = -dy / len, py = dx / len;
    var h = seg.h || 4;
    var curve = seg.curve || 0;
    if (seg.blockU != null && u > seg.blockU && seg.blockTo) {
      var hit = flyAt({ a: a, b: b, h: h, curve: curve }, seg.blockU);
      var v = (u - seg.blockU) / Math.max(0.0001, 1 - seg.blockU);
      var fall = (1 - v) * (1 - v);
      return {
        x: hit.x + (seg.blockTo[0] - hit.x) * v,
        y: hit.y + (seg.blockTo[1] - hit.y) * v,
        z: hit.z * fall
      };
    }
    return {
      x: a[0] + dx * u + px * curve * Math.sin(Math.PI * u),
      y: a[1] + dy * u + py * curve * Math.sin(Math.PI * u),
      z: h * 4 * u * (1 - u)
    };
  }

  function missTarget(from, rim, input) {
    var dx = rim[0] - from[0], dy = rim[1] - from[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    var px = -uy, py = ux;
    var h = idHash(String(input.shooter || '') + '|' + String(input.zone || '') + '|' + String(input.action || '') + '|' + String(input.kind || ''));
    if (h < 0.3) return [from[0] + ux * len * 0.8, from[1] + uy * len * 0.8];
    if (h < 0.56) return [rim[0] + ux * 3.6, clamp(rim[1] + uy * 1.8, 3, 47)];
    var side = h < 0.78 ? 2.7 : -2.7;
    return [rim[0] + px * side + ux * 0.6, clamp(rim[1] + py * side, 3, 47)];
  }

  function posMapFrom(off, def) {
    var m = {}, id;
    for (id in off) m[id] = off[id];
    for (id in def) m[id] = def[id];
    return m;
  }

  function evalBall(script, t, posMap, attackRight) {
    if (!script || !script.length) return null;
    var seg = script[0], i;
    t = clamp(t, 0, 1);
    for (i = 0; i < script.length; i++) {
      if (t <= script[i].t1) { seg = script[i]; break; }
      seg = script[i];
    }
    if (seg.type === 'hold') {
      return posMap && posMap[seg.who] ? holdBall(posMap[seg.who], attackRight) : null;
    }
    if (seg.type === 'rest') return { x: seg.x, y: seg.y, z: seg.z || 0 };
    if (seg.type === 'fly') {
      return flyAt(seg, (t - seg.t0) / Math.max(0.0001, seg.t1 - seg.t0));
    }
    return null;
  }

  function buildBallScript(r, input, mapAt) {
    var segs = [];
    var kind = input.kind || '';
    var action = String(input.action || '');
    var shooterId = r.ball && r.ball.id;
    var passerId = r.passer && r.passer.id;
    var stealerId = r.stealer && r.stealer.id;
    var three = input.shot === 'threePT' || /^(spot|catch|cut|pull3|stepback|snatch|flare|pin|dho|trail)$/.test(action);
    var drive = isDrive(action);
    var dunk = !!input.dunk || action === 'dunk' || action === 'lob' || action === 'putback';
    var lob = action === 'lob';
    var dho = action === 'dho';
    var rim = clone(RIM);
    var wantPass = !!(passerId && shooterId && passerId !== shooterId && kind !== 'stl' && kind !== 'hack' && kind !== 'tech');

    function xyHold(t, id) {
      var h = holdBall(mapAt(t)[id], true);
      return h ? [h.x, h.y] : null;
    }
    function pushHold(t0, t1, who) {
      if (!who || t1 <= t0 + 0.01) return;
      segs.push({ type: 'hold', t0: t0, t1: t1, who: who });
    }
    function pushFly(t0, t1, a, b, h, curve, extra) {
      if (!a || !b || t1 <= t0 + 0.01) return;
      var seg = { type: 'fly', t0: t0, t1: t1, a: [a[0], a[1]], b: [b[0], b[1]], h: h, curve: curve || 0 };
      if (extra) {
        if (extra.blockU != null) seg.blockU = extra.blockU;
        if (extra.blockTo) seg.blockTo = [extra.blockTo[0], extra.blockTo[1]];
      }
      segs.push(seg);
    }
    function pushRest(t0, t1, p, z) {
      if (!p || t1 <= t0) return;
      segs.push({ type: 'rest', t0: t0, t1: t1, x: p[0], y: p[1], z: z || 0 });
    }

    if (kind === 'stl') {
      pushHold(0, 0.36, shooterId);
      pushFly(0.36, 0.64, xyHold(0.36, shooterId), xyHold(0.64, stealerId) || xyHold(0.64, shooterId), 2.4, 1.5);
      if (stealerId) pushHold(0.64, 1, stealerId);
      return segs;
    }
    if (kind === 'tov') {
      if (wantPass) {
        pushHold(0, 0.26, passerId);
        var out = xyHold(0.26, passerId) || [70, 25];
        pushFly(0.26, 0.82, out, [clamp(out[0] - 6, 2, 92), out[1] < 25 ? 1.2 : 48.8], 4.2, 2.2);
      } else {
        pushHold(0, 0.4, shooterId);
        out = xyHold(0.4, shooterId) || [70, 25];
        pushFly(0.4, 0.86, out, [clamp(out[0] - 4, 2, 92), out[1] < 25 ? 1.2 : 48.8], 3.4, 1.6);
      }
      return segs;
    }
    if (kind === 'hack' || action === 'ft' || input.tactic === 'ft') {
      pushHold(0, 0.42, shooterId);
      pushFly(0.42, 0.92, xyHold(0.42, shooterId) || clone(Z.ft), rim, 7.4, 0.4);
      pushRest(0.92, 1, rim, 0.85);
      return segs;
    }

    var passH = lob ? 8.8 : (dho ? 2.15 : 4.5);
    var passCurve = lob ? 3.3 : (dho ? 0.65 : 2.25);
    var shotH = dunk ? 2.3 : (drive ? 3.7 : (three ? 10.6 : 7.3));
    var shotCurve = dunk ? 0.35 : (drive ? 0.7 : (three ? 1.15 : 0.85));
    var shotDur = dunk ? 0.16 : (drive ? 0.26 : (three ? 0.40 : 0.34));
    var tShot1 = 0.98;
    var tShot0 = tShot1 - shotDur;
    var tPass1 = 0, tPass0 = 0;
    if (wantPass) {
      var pa = xyHold(0.28, passerId);
      var pb = xyHold(0.48, shooterId);
      var passDur = clamp(0.18 + (pa && pb ? dist(pa, pb) : 18) / 85, 0.2, 0.36);
      tPass1 = Math.max(0.12, tShot0 - (dho ? 0.06 : 0.12));
      tPass0 = Math.max(0.1, tPass1 - passDur);
      if (tPass0 < 0.1) { tPass0 = 0.1; tPass1 = tPass0 + passDur; if (tPass1 > tShot0 - 0.06) tShot0 = Math.min(0.78, tPass1 + 0.08); }
      pushHold(0, tPass0, passerId);
      pushFly(tPass0, tPass1, xyHold(tPass0, passerId), xyHold(tPass1, shooterId), passH, passCurve);
      pushHold(tPass1, tShot0, shooterId);
    } else {
      pushHold(0, tShot0, shooterId);
    }

    var isShot = kind === 'make' || kind === 'miss' || kind === 'blk' || kind === 'andone' || kind === 'foul';
    if (isShot && shooterId) {
      var from = xyHold(tShot0, shooterId);
      if (from) {
        var dest = clone(rim);
        var extra = null;
        if (kind === 'miss' || kind === 'foul') dest = missTarget(from, rim, input);
        if (kind === 'blk') {
          dest = lerp(from, rim, 0.62);
          extra = { blockU: 0.55, blockTo: missTarget(from, rim, input) };
          extra.blockTo[0] = clamp(extra.blockTo[0] - 5.5, 4, 90);
        }
        pushFly(tShot0, tShot1, from, dest, shotH, shotCurve, extra);
        pushRest(tShot1, 1, extra && extra.blockTo ? extra.blockTo : dest, kind === 'make' || kind === 'andone' ? 0.9 : 0.22);
      }
    } else {
      pushHold(tShot0, 1, shooterId);
    }
    if (!segs.length && shooterId) pushHold(0, 1, shooterId);
    return segs;
  }

  PP_COURT.compose = function (input) {
    input = input || {};
    var r = assign(input);
    var tactic = input.tactic || 'pnr_side';
    var camera = 'half';
    if (tactic === 'trans_coast' || tactic === 'steal' || input.action === 'coast') camera = 'full';
    var plan = offensePlan(r, input);
    var def0 = poseDef(plan.set, plan.set, r, input, 0);
    var defA = poseDef(plan.act, plan.set, r, input, 0.42);
    var def1 = poseDef(plan.shot, plan.set, r, input, 1);
    separate([plan.set, def0], 3.15);
    separate([plan.act, defA], 3.15);
    separate([plan.shot, def1], 3.15);
    var offCtrl = [
      plan.set,
      lerpMap(plan.set, plan.act, 0.34),
      lerpMap(plan.set, plan.act, 0.67),
      plan.act,
      lerpMap(plan.act, plan.shot, 0.25),
      lerpMap(plan.act, plan.shot, 0.5),
      lerpMap(plan.act, plan.shot, 0.78),
      plan.shot
    ];
    function sampleOD(t) {
      var off = sampleMaps(offCtrl, t);
      var def;
      if (plan.ballCurve && plan.ballId) {
        off[plan.ballId] = quad(plan.ballCurve.a, plan.ballCurve.c, plan.ballCurve.b, t);
      }
      def = poseDef(off, plan.set, r, input, t);
      return { off: off, def: def };
    }
    function mapAt(t) {
      var s = sampleOD(t);
      return posMapFrom(s.off, s.def);
    }
    var ballScript = buildBallScript(r, input, mapAt);
    var frames = [];
    var i, t, pair, n = 10;
    for (i = 0; i < n; i++) {
      t = i / (n - 1);
      pair = sampleOD(t);
      frames.push({
        t: t,
        dots: packDots(pair.off, pair.def, input),
        ball: evalBall(ballScript, t, mapAt(t), true)
      });
    }
    return { camera: camera, tactic: tactic, branch: input.branch, zone: input.zone, attackRight: input.attackRight !== false, frames: frames, ballScript: ballScript };
  };

  /* ---------- SVG 球场（NBA 94×50） ---------- */
  var svg, dotsG, ballEl, ballShadow, trailEls, wrap, raf, idleRaf, enabled = true, dotMap = {};
  var pose = null;
  var poseBall = null;
  var camBox = null;
  var svgSize = null;
  var flight = null;

  function nsEl(name) { return document.createElementNS('http://www.w3.org/2000/svg', name); }

  function worldDots(dots, attackRight) {
    return (dots || []).map(function (d) {
      return {
        id: d.id,
        x: attackRight ? d.x : COURT_L - d.x,
        y: d.y,
        kind: d.kind
      };
    });
  }

  function worldBall(b, attackRight) {
    if (!b) return null;
    return { x: attackRight ? b.x : COURT_L - b.x, y: b.y, z: b.z || 0 };
  }

  function cloneScript(script) {
    return (script || []).map(function (seg) {
      var s = { type: seg.type, t0: seg.t0, t1: seg.t1, h: seg.h, curve: seg.curve, who: seg.who };
      if (seg.a) s.a = [seg.a[0], seg.a[1]];
      if (seg.b) s.b = [seg.b[0], seg.b[1]];
      if (seg.blockTo) s.blockTo = [seg.blockTo[0], seg.blockTo[1]];
      if (seg.blockU != null) s.blockU = seg.blockU;
      if (seg.x != null) { s.x = seg.x; s.y = seg.y; s.z = seg.z; }
      return s;
    });
  }

  function worldScript(script, attackRight) {
    var out = cloneScript(script);
    if (attackRight !== false) return out;
    var i, s;
    for (i = 0; i < out.length; i++) {
      s = out[i];
      if (s.a) s.a[0] = COURT_L - s.a[0];
      if (s.b) s.b[0] = COURT_L - s.b[0];
      if (s.blockTo) s.blockTo[0] = COURT_L - s.blockTo[0];
      if (s.x != null) s.x = COURT_L - s.x;
    }
    return out;
  }

  function remapScript(script, split, fromBall, toBall) {
    var out = cloneScript(script);
    var i, gap;
    for (i = 0; i < out.length; i++) {
      out[i].t0 = split + out[i].t0 * (1 - split);
      out[i].t1 = split + out[i].t1 * (1 - split);
    }
    if (split > 0.02 && fromBall && toBall) {
      gap = dist([fromBall.x, fromBall.y], [toBall.x, toBall.y]);
      if (gap > 0.8) {
        out.unshift({
          type: 'fly', t0: 0, t1: split,
          a: [fromBall.x, fromBall.y], b: [toBall.x, toBall.y],
          h: Math.min(3.8, 0.5 + gap * 0.12), curve: 0.75
        });
      }
    }
    return out;
  }

  var FULL_BOX = [-1, -0.532, 96, 51.064];

  function viewBoxFor() {
    return FULL_BOX.slice();
  }

  function lerpBox(a, b, t) {
    if (!a) return b.slice();
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  }

  function applyBox(box) {
    if (!svg || !box) return;
    svg.setAttribute('viewBox', box[0] + ' ' + box[1] + ' ' + box[2] + ' ' + box[3]);
  }

  function maxTravel(a, b) {
    var map = {}, i, m = 0, dx, dy, dd;
    for (i = 0; i < (b || []).length; i++) map[b[i].id] = b[i];
    for (i = 0; i < (a || []).length; i++) {
      if (!map[a[i].id]) continue;
      dx = a[i].x - map[a[i].id].x;
      dy = a[i].y - map[a[i].id].y;
      dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > m) m = dd;
    }
    return m;
  }

  function carryDots(prev, dest) {
    var map = {}, i, d, p, out = [];
    for (i = 0; i < (prev || []).length; i++) map[prev[i].id] = prev[i];
    for (i = 0; i < (dest || []).length; i++) {
      d = dest[i];
      p = map[d.id];
      out.push(p ? { id: d.id, x: p.x, y: p.y, kind: d.kind, ball: !!p.ball } : { id: d.id, x: d.x, y: d.y, kind: d.kind, ball: d.ball });
    }
    return out;
  }

  function stitch(prevDots, worldFrames, live) {
    if (!prevDots || !worldFrames || !worldFrames.length) return { frames: worldFrames, split: 0 };
    var dest0 = worldFrames[0].dots;
    var start = carryDots(prevDots, dest0);
    var travel = maxTravel(start, dest0);
    var copy, i, fr, split;
    if (travel < 0.55) {
      copy = worldFrames.slice();
      copy[0] = { t: 0, dots: start, ball: worldFrames[0].ball };
      return { frames: copy, split: 0 };
    }
    split = live ? Math.min(0.26, 0.06 + travel / 140) : Math.min(0.2, 0.08 + travel / 160);
    copy = [{ t: 0, dots: start, ball: poseBall || worldFrames[0].ball }];
    for (i = 0; i < worldFrames.length; i++) {
      fr = worldFrames[i];
      copy.push({ t: split + fr.t * (1 - split), dots: fr.dots, ball: fr.ball });
    }
    return { frames: copy, split: split };
  }

  function indexDots(dots) {
    var m = {}, i;
    for (i = 0; i < (dots || []).length; i++) m[dots[i].id] = dots[i];
    return m;
  }

  function mixDotsCR(d0, d1, d2, d3, t) {
    var m0 = indexDots(d0), m1 = indexDots(d1), m2 = indexDots(d2), m3 = indexDots(d3);
    var ids = {}, id, a, b, c, d, out = [];
    for (id in m1) ids[id] = true;
    for (id in m2) ids[id] = true;
    for (id in ids) {
      b = m1[id] || m2[id];
      c = m2[id] || b;
      if (!b) continue;
      a = m0[id] || b;
      d = m3[id] || c;
      out.push({
        id: id,
        kind: (c && c.kind) || b.kind,
        x: clamp(catmull1(a.x, b.x, c.x, d.x, t), 1.2, COURT_L - 1.2),
        y: clamp(catmull1(a.y, b.y, c.y, d.y, t), 1.2, COURT_W - 1.2)
      });
    }
    return out;
  }

  function posMapFromDots(dots) {
    var m = {}, i;
    for (i = 0; i < (dots || []).length; i++) m[dots[i].id] = [dots[i].x, dots[i].y];
    return m;
  }

  function lerpBall(a, b, t) {
    if (!a && !b) return null;
    if (!a) return { x: b.x, y: b.y, z: b.z || 0 };
    if (!b) return { x: a.x, y: a.y, z: a.z || 0 };
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * t
    };
  }

  function lerpSize(a, b, t) {
    if (!a) return b ? b.slice() : null;
    if (!b) return a.slice();
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  function sampleFlight(u) {
    if (!flight || !flight.frames || !flight.frames.length) return null;
    var frames = flight.frames;
    var i, local, dots, ball;
    u = clamp(u, 0, 1);
    if (u <= frames[0].t) dots = frames[0].dots;
    else if (u >= frames[frames.length - 1].t) dots = frames[frames.length - 1].dots;
    else {
      for (i = 0; i < frames.length - 1; i++) {
        if (u >= frames[i].t && u <= frames[i + 1].t) {
          local = (u - frames[i].t) / Math.max(0.0001, frames[i + 1].t - frames[i].t);
          dots = mixDotsCR(
            frames[Math.max(0, i - 1)].dots,
            frames[i].dots,
            frames[i + 1].dots,
            frames[Math.min(frames.length - 1, i + 2)].dots,
            local
          );
          break;
        }
      }
    }
    dots = dots || frames[frames.length - 1].dots;
    if (flight.script && flight.script.length) {
      ball = evalBall(flight.script, u, posMapFromDots(dots), flight.attackRight);
    } else {
      ball = null;
      if (u <= frames[0].t) ball = frames[0].ball;
      else if (u >= frames[frames.length - 1].t) ball = frames[frames.length - 1].ball;
      else {
        for (i = 0; i < frames.length - 1; i++) {
          if (u >= frames[i].t && u <= frames[i + 1].t) {
            local = (u - frames[i].t) / Math.max(0.0001, frames[i + 1].t - frames[i].t);
            ball = lerpBall(frames[i].ball, frames[i + 1].ball, local);
            break;
          }
        }
      }
    }
    return {
      dots: dots,
      ball: ball,
      trail: (flight.script && flight.script.length) ? ballTrail(flight.script, u, posMapFromDots(dots), flight.attackRight) : null,
      box: FULL_BOX.slice(),
      size: null
    };
  }

  function ballTrail(script, t, posMap, attackRight) {
    var n = 8, out = [], i, b;
    for (i = n; i >= 1; i--) {
      b = evalBall(script, t - i * 0.015, posMap, attackRight);
      if (b && b.z > 0.55) out.push(b);
    }
    return out;
  }

  function capturePose() {
    if (flight) {
      var u = Math.min(1, (performance.now() - flight.t0) / Math.max(1, flight.duration));
      var cur = sampleFlight(u);
      if (cur) {
        pose = cur.dots;
        poseBall = cur.ball;
        camBox = cur.box;
      }
    }
  }

  function nsEl(name) { return document.createElementNS('http://www.w3.org/2000/svg', name); }

  function stroke(el, extra) {
    el.setAttribute('fill', 'none');
    el.setAttribute('class', extra || 'pp-court-line');
    return el;
  }

  function courtLines() {
    var g = nsEl('g');
    g.setAttribute('class', 'pp-court-lines');
    function add(el) { g.appendChild(el); return el; }

    var outline = stroke(nsEl('rect'));
    outline.setAttribute('x', '0'); outline.setAttribute('y', '0');
    outline.setAttribute('width', String(COURT_L)); outline.setAttribute('height', String(COURT_W));
    add(outline);

    var mid = stroke(nsEl('line'));
    mid.setAttribute('x1', '47'); mid.setAttribute('y1', '0');
    mid.setAttribute('x2', '47'); mid.setAttribute('y2', '50');
    add(mid);

    var cc = stroke(nsEl('circle'));
    cc.setAttribute('cx', '47'); cc.setAttribute('cy', '25'); cc.setAttribute('r', '6');
    add(cc);

    function hoop(left) {
      var hx = left ? HOOP_IN : COURT_L - HOOP_IN;
      var bb = left ? BACKBOARD_IN : COURT_L - BACKBOARD_IN;
      var paintX = left ? 0 : COURT_L - PAINT_L;
      var ftX = left ? PAINT_L : COURT_L - PAINT_L;
      var y0 = (COURT_W - PAINT_W) / 2;

      var paint = stroke(nsEl('rect'));
      paint.setAttribute('x', String(paintX));
      paint.setAttribute('y', String(y0));
      paint.setAttribute('width', String(PAINT_L));
      paint.setAttribute('height', String(PAINT_W));
      add(paint);

      var ftC = stroke(nsEl('path'));
      if (left) ftC.setAttribute('d', 'M ' + ftX + ' ' + (25 - FT_R) + ' A ' + FT_R + ' ' + FT_R + ' 0 0 1 ' + ftX + ' ' + (25 + FT_R));
      else ftC.setAttribute('d', 'M ' + ftX + ' ' + (25 - FT_R) + ' A ' + FT_R + ' ' + FT_R + ' 0 0 0 ' + ftX + ' ' + (25 + FT_R));
      add(ftC);

      var ftDash = stroke(nsEl('path'));
      ftDash.setAttribute('class', 'pp-court-dash');
      if (left) ftDash.setAttribute('d', 'M ' + ftX + ' ' + (25 - FT_R) + ' A ' + FT_R + ' ' + FT_R + ' 0 0 0 ' + ftX + ' ' + (25 + FT_R));
      else ftDash.setAttribute('d', 'M ' + ftX + ' ' + (25 - FT_R) + ' A ' + FT_R + ' ' + FT_R + ' 0 0 1 ' + ftX + ' ' + (25 + FT_R));
      add(ftDash);

      var c3x = left ? HOOP_IN + cornerInset : COURT_L - HOOP_IN - cornerInset;
      var apex = left ? HOOP_IN + THREE_R : COURT_L - HOOP_IN - THREE_R;
      var sweepOut = left ? 1 : 0;
      var three = stroke(nsEl('path'));
      if (left) {
        three.setAttribute('d',
          'M 0 ' + SIDELINE_3 +
          ' L ' + c3x + ' ' + SIDELINE_3 +
          ' A ' + THREE_R + ' ' + THREE_R + ' 0 0 ' + sweepOut + ' ' + apex + ' 25' +
          ' A ' + THREE_R + ' ' + THREE_R + ' 0 0 ' + sweepOut + ' ' + c3x + ' ' + (COURT_W - SIDELINE_3) +
          ' L 0 ' + (COURT_W - SIDELINE_3));
      } else {
        three.setAttribute('d',
          'M ' + COURT_L + ' ' + SIDELINE_3 +
          ' L ' + c3x + ' ' + SIDELINE_3 +
          ' A ' + THREE_R + ' ' + THREE_R + ' 0 0 ' + sweepOut + ' ' + apex + ' 25' +
          ' A ' + THREE_R + ' ' + THREE_R + ' 0 0 ' + sweepOut + ' ' + c3x + ' ' + (COURT_W - SIDELINE_3) +
          ' L ' + COURT_L + ' ' + (COURT_W - SIDELINE_3));
      }
      add(three);

      var ra = stroke(nsEl('path'));
      if (left) ra.setAttribute('d', 'M ' + hx + ' ' + (25 - RESTRICT_R) + ' A ' + RESTRICT_R + ' ' + RESTRICT_R + ' 0 0 1 ' + hx + ' ' + (25 + RESTRICT_R));
      else ra.setAttribute('d', 'M ' + hx + ' ' + (25 - RESTRICT_R) + ' A ' + RESTRICT_R + ' ' + RESTRICT_R + ' 0 0 0 ' + hx + ' ' + (25 + RESTRICT_R));
      add(ra);

      var board = stroke(nsEl('line'));
      board.setAttribute('class', 'pp-court-board');
      board.setAttribute('x1', String(bb)); board.setAttribute('x2', String(bb));
      board.setAttribute('y1', String(25 - BACKBOARD_W / 2)); board.setAttribute('y2', String(25 + BACKBOARD_W / 2));
      add(board);

      var rim = stroke(nsEl('circle'));
      rim.setAttribute('class', 'pp-court-rim');
      rim.setAttribute('cx', String(hx)); rim.setAttribute('cy', '25'); rim.setAttribute('r', String(RIM_R));
      add(rim);

      var neck = stroke(nsEl('line'));
      neck.setAttribute('x1', String(bb)); neck.setAttribute('y1', '25');
      neck.setAttribute('x2', String(hx - (left ? -RIM_R : RIM_R))); neck.setAttribute('y2', '25');
      add(neck);

      var ticks = [7, 8, 11, 14];
      ticks.forEach(function (ft) {
        var x = left ? ft : COURT_L - ft;
        var t1 = stroke(nsEl('line'));
        t1.setAttribute('x1', String(x)); t1.setAttribute('x2', String(x));
        t1.setAttribute('y1', String(y0 - 0.8)); t1.setAttribute('y2', String(y0));
        add(t1);
        var t2 = stroke(nsEl('line'));
        t2.setAttribute('x1', String(x)); t2.setAttribute('x2', String(x));
        t2.setAttribute('y1', String(y0 + PAINT_W)); t2.setAttribute('y2', String(y0 + PAINT_W + 0.8));
        add(t2);
      });
    }
    hoop(true);
    hoop(false);
    return g;
  }

  function injectCourtStyle() {
    var s = document.getElementById('pp-court-style');
    if (!s) {
      s = document.createElement('style');
      s.id = 'pp-court-style';
      document.head.appendChild(s);
    }
    s.textContent =
      '.pp-live-court-wrap{height:220px;background:var(--bg-card);border-bottom:1px solid var(--border);flex-shrink:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
      '.pp-live-court-wrap.is-off{display:none}' +
      '.pp-live-court{display:block;flex:0 0 auto;width:calc(100% - 24px);max-width:100%;height:auto;max-height:200px;aspect-ratio:94/50;margin:0 auto}' +
      '.pp-court-line{stroke:var(--text-dim);stroke-width:0.22;fill:none}' +
      '.pp-court-dash{stroke:var(--text-dim);stroke-width:0.18;fill:none;stroke-dasharray:0.9 0.7;opacity:.75}' +
      '.pp-court-board{stroke:var(--text);stroke-width:0.45}' +
      '.pp-court-rim{stroke:var(--orange);stroke-width:0.28}' +
      '.pp-dot-home{fill:#f4f4f4;stroke:#1c1c1c;stroke-width:0.28}' +
      '.pp-dot-away{fill:#161616;stroke:#e8e8e8;stroke-width:0.28}' +
      '.pp-dot-hero{fill:#d4a017;stroke:#fff4c2;stroke-width:0.42}' +
      '.pp-dot-hero-ring{fill:none;stroke:#ffe38a;stroke-width:0.32;opacity:.95}' +
      '.pp-court-ball{fill:var(--orange);stroke:#fff;stroke-width:0.16}' +
      '.pp-court-ball-shadow{fill:#000;stroke:none}' +
      '.pp-court-ball-trail{fill:var(--orange);stroke:none}';
  }

  function courtSize() {
    var maxW = Math.max(120, (wrap && wrap.clientWidth ? wrap.clientWidth : 520) - 24);
    var maxH = Math.max(80, (wrap && wrap.clientHeight ? wrap.clientHeight : 220) - 20);
    var aspect = COURT_L / COURT_W;
    var w = maxW;
    var h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    return [w, h];
  }

  function applySize(sz) {
    if (!svg || !sz) return;
    svg.style.width = sz[0] + 'px';
    svg.style.height = sz[1] + 'px';
    svgSize = sz.slice();
  }

  function layoutSvg() {
    if (!wrap || !svg) return;
    svg.setAttribute('viewBox', FULL_BOX[0] + ' ' + FULL_BOX[1] + ' ' + FULL_BOX[2] + ' ' + FULL_BOX[3]);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    applySize(courtSize());
  }

  function stopIdle() {
    if (idleRaf) { cancelAnimationFrame(idleRaf); idleRaf = 0; }
  }

  function startIdle() {
    if (!enabled || !svg || flight) return;
    if (idleRaf) return;
    function loop() {
      idleRaf = 0;
      if (!enabled || !svg || flight) return;
      if (pose) {
        drawDots(pose);
        paintBall(poseBall, null);
      }
      idleRaf = requestAnimationFrame(loop);
    }
    idleRaf = requestAnimationFrame(loop);
  }

  PP_COURT.mount = function (host) {
    injectCourtStyle();
    wrap = typeof host === 'string' ? document.getElementById(host) : (host || document.getElementById('pp-live-court-wrap'));
    if (!wrap) return null;
    wrap.innerHTML = '';
    wrap.className = 'pp-live-court-wrap';
    wrap.id = 'pp-live-court-wrap';
    svg = nsEl('svg');
    svg.setAttribute('class', 'pp-live-court');
    svg.setAttribute('viewBox', FULL_BOX[0] + ' ' + FULL_BOX[1] + ' ' + FULL_BOX[2] + ' ' + FULL_BOX[3]);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(courtLines());
    ballShadow = nsEl('ellipse');
    ballShadow.setAttribute('class', 'pp-court-ball-shadow');
    ballShadow.style.display = 'none';
    svg.appendChild(ballShadow);
    dotsG = nsEl('g');
    dotsG.setAttribute('class', 'pp-court-dots');
    svg.appendChild(dotsG);
    trailEls = [];
    var tg = nsEl('g');
    var ti, tc;
    tg.setAttribute('class', 'pp-court-ball-trails');
    for (ti = 0; ti < 8; ti++) {
      tc = nsEl('circle');
      tc.setAttribute('class', 'pp-court-ball-trail');
      tc.style.display = 'none';
      tg.appendChild(tc);
      trailEls.push(tc);
    }
    svg.appendChild(tg);
    ballEl = nsEl('circle');
    ballEl.setAttribute('r', '0.72');
    ballEl.setAttribute('class', 'pp-court-ball');
    svg.appendChild(ballEl);
    wrap.appendChild(svg);
    dotMap = {};
    pose = null;
    poseBall = null;
    camBox = null;
    flight = null;
    enabled = true;
    camBox = FULL_BOX.slice();
    layoutSvg();
    requestAnimationFrame(function () {
      layoutSvg();
      startIdle();
    });
    if (!wrap._ppCourtResize) {
      wrap._ppCourtResize = true;
      window.addEventListener('resize', function () {
        if (svg && wrap) layoutSvg();
      });
    }
    return wrap;
  };

  PP_COURT.setEnabled = function (on) {
    enabled = !!on;
    if (wrap) wrap.classList.toggle('is-off', !enabled);
    if (!on) {
      capturePose();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      stopIdle();
      flight = null;
      pose = null;
      poseBall = null;
      camBox = null;
    } else {
      startIdle();
    }
  };

  function paintBall(b, trail) {
    var i, g, op, rr;
    if (!ballEl) return;
    if (!b) {
      ballEl.style.display = 'none';
      if (ballShadow) ballShadow.style.display = 'none';
      for (i = 0; i < (trailEls || []).length; i++) trailEls[i].style.display = 'none';
      return;
    }
    if (ballShadow) {
      ballShadow.style.display = '';
      ballShadow.setAttribute('cx', b.x.toFixed(3));
      ballShadow.setAttribute('cy', b.y.toFixed(3));
      ballShadow.setAttribute('rx', (0.4 + (b.z || 0) * 0.05).toFixed(3));
      ballShadow.setAttribute('ry', (0.28 + (b.z || 0) * 0.028).toFixed(3));
      ballShadow.setAttribute('opacity', String(0.15 + Math.min(0.2, (b.z || 0) * 0.016)));
    }
    for (i = 0; i < (trailEls || []).length; i++) {
      g = trail && trail[i];
      if (!g || g.z < 0.55) {
        trailEls[i].style.display = 'none';
        continue;
      }
      op = 0.07 + 0.24 * ((i + 1) / trailEls.length);
      rr = 0.26 + g.z * 0.032;
      trailEls[i].style.display = '';
      trailEls[i].setAttribute('cx', g.x.toFixed(3));
      trailEls[i].setAttribute('cy', (g.y - g.z * 0.26).toFixed(3));
      trailEls[i].setAttribute('r', rr.toFixed(3));
      trailEls[i].setAttribute('opacity', op.toFixed(3));
    }
    ballEl.style.display = '';
    ballEl.setAttribute('cx', b.x.toFixed(3));
    ballEl.setAttribute('cy', (b.y - (b.z || 0) * 0.28).toFixed(3));
    ballEl.setAttribute('r', (0.56 + Math.min(0.7, (b.z || 0) * 0.07)).toFixed(3));
  }

  function drawDots(dots) {
    if (!dotsG) return;
    var seen = {}, i, d, node, ring, c;
    var now = performance.now() * 0.001;
    var amp = flight ? 0.045 : 0.15;
    var h, x, y;
    for (i = 0; i < (dots || []).length; i++) {
      d = dots[i];
      seen[d.id] = true;
      node = dotMap[d.id];
      if (!node) {
        ring = nsEl('circle');
        ring.setAttribute('class', 'pp-dot-hero-ring');
        ring.setAttribute('r', '2.05');
        c = nsEl('circle');
        dotsG.appendChild(ring);
        dotsG.appendChild(c);
        node = dotMap[d.id] = { c: c, ring: ring };
      }
      h = idHash(d.id) * Math.PI * 2;
      x = d.x + Math.sin(now * 1.65 + h) * amp;
      y = d.y + Math.cos(now * 1.28 + h * 1.7) * amp * 0.85;
      node.c.setAttribute('cx', x.toFixed(3));
      node.c.setAttribute('cy', y.toFixed(3));
      node.c.setAttribute('r', d.kind === 'hero' ? '1.35' : '1.12');
      node.c.setAttribute('class', d.kind === 'hero' ? 'pp-dot-hero' : (d.kind === 'home' ? 'pp-dot-home' : 'pp-dot-away'));
      if (d.kind === 'hero') {
        node.ring.style.display = '';
        node.ring.setAttribute('cx', x.toFixed(3));
        node.ring.setAttribute('cy', y.toFixed(3));
      } else {
        node.ring.style.display = 'none';
      }
    }
    for (i in dotMap) {
      if (!seen[i]) {
        if (dotMap[i].c.parentNode) dotMap[i].c.parentNode.removeChild(dotMap[i].c);
        if (dotMap[i].ring.parentNode) dotMap[i].ring.parentNode.removeChild(dotMap[i].ring);
        delete dotMap[i];
      }
    }
  }

  PP_COURT.play = function (clip, duration) {
    if (!enabled || !clip || !clip.frames || !svg) return;
    capturePose();
    stopIdle();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    duration = Math.max(400, duration || 1400);
    var attackRight = clip.attackRight !== false;
    var world = clip.frames.map(function (fr) {
      return { t: fr.t, dots: worldDots(fr.dots, attackRight), ball: worldBall(fr.ball, attackRight) };
    });
    var live = !!clip.chain;
    var stitched = pose ? stitch(pose, world, live) : { frames: world, split: 0 };
    var frames = stitched.frames;
    var script = worldScript(clip.ballScript, attackRight);
    if (stitched.split > 0.02) {
      script = remapScript(script, stitched.split, poseBall, world[0] && world[0].ball);
    }
    var travel = pose ? maxTravel(frames[0].dots, frames[frames.length - 1].dots) : 0;
    flight = {
      frames: frames, t0: performance.now(), duration: duration,
      box0: FULL_BOX.slice(), box1: FULL_BOX.slice(),
      script: script, attackRight: attackRight
    };
    applyBox(FULL_BOX);
    drawDots(frames[0].dots);
    paintBall(evalBall(script, 0, posMapFromDots(frames[0].dots), attackRight), null);
    function tick(now) {
      if (!flight) return;
      var u = Math.min(1, (now - flight.t0) / flight.duration);
      var cur = sampleFlight(u);
      if (cur) {
        drawDots(cur.dots);
        paintBall(cur.ball, cur.trail);
      }
      if (u >= 1) {
        pose = frames[frames.length - 1].dots;
        poseBall = cur && cur.ball ? cur.ball : (frames[frames.length - 1].ball || poseBall);
        camBox = FULL_BOX.slice();
        flight = null;
        raf = 0;
        startIdle();
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  };

  PP_COURT.snap = function (clip) {
    if (!clip || !clip.frames) return;
    capturePose();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    flight = null;
    var attackRight = clip.attackRight !== false;
    var last = clip.frames[clip.frames.length - 1];
    var dots = worldDots(last.dots, attackRight);
    pose = dots;
    poseBall = worldBall(last.ball, attackRight);
    camBox = FULL_BOX.slice();
    layoutSvg();
    applyBox(FULL_BOX);
    drawDots(dots);
    paintBall(poseBall, null);
    startIdle();
  };

  PP_COURT.resetPose = function () {
    capturePose();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    stopIdle();
    flight = null;
    pose = null;
    poseBall = null;
    camBox = null;
  };
})();
