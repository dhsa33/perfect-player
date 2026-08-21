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
    if (tactic === 'post') return [pS, sS, cS, cW, sW];
    if (tactic === 'iso_clear') return [wS, dW, cW, cS, sW];
    if (tactic === 'iso_mid') return [eS, cW, sW, cS, sS];
    if (tactic === 'floppy' || tactic === 'hammer' || tactic === 'elevator') {
      return [tactic === 'hammer' ? cS : lerp(cS, Z.shortL, 0.35), Z.top, eS, cW, sW];
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

  function poseOff(r, input, t) {
    var tactic = input.tactic || 'pnr_side';
    var strong = input.strong || 'R';
    var action = input.action || '';
    var off = placeOff(r, tactic, strong);
    var ball = r.ball && r.ball.id;
    if (!ball || !off[ball]) return off;
    var start = clone(off[ball]);
    var zone = shotZone(input);
    if (action === 'coast' || tactic === 'trans_coast') zone = clone(Z.rim);
    if (action === 'lob') zone = clone(Z.rim);
    var u, ctrl, rollTo, popTo;

    if (tactic === 'trans_coast' || tactic === 'steal' || action === 'coast') {
      u = ease(clamp(t, 0, 1));
      off[ball] = lerp(Z.back, zone, u);
      r.offOrder.forEach(function (p, i) {
        if (!p || p.id === ball || !off[p.id]) return;
        off[p.id] = lerp(off[p.id], lerp(off[p.id], [70 + i * 3, 8 + i * 9], 0.7), u);
      });
      return off;
    }

    if (isDrive(action) || input.branch === 'turn' || input.branch === 'drive') {
      u = ease(clamp((t - 0.12) / 0.72, 0, 1));
      ctrl = [(start[0] + zone[0]) / 2 + 1.5, (start[1] + 25) / 2];
      off[ball] = quad(start, ctrl, zone, u);
      if (r.big && off[r.big.id] && (tactic.indexOf('pnr') === 0 || tactic === 'horns')) {
        rollTo = clone(sid(strong, 'dunkerL', 'dunkerR'));
        off[r.big.id] = lerp(off[r.big.id], rollTo, ease(clamp((t - 0.18) / 0.55, 0, 1)));
      }
      return off;
    }

    if (action === 'cut' || action === 'backdoor' || input.branch === 'cut') {
      u = ease(clamp(t / 0.85, 0, 1));
      ctrl = [sid(strong, 'slotL', 'slotR')[0], sid(strong, 'cornerL', 'cornerR')[1]];
      off[ball] = quad(start, ctrl, zone, u);
      return off;
    }

    if (action === 'spot' || action === 'flare' || input.branch === 'corner') {
      u = ease(clamp(t / 0.7, 0, 1));
      off[ball] = lerp(start, zone, u);
      return off;
    }

    if (action === 'stepback' || action === 'snatch' || input.branch === 'step') {
      u = ease(clamp((t - 0.15) / 0.5, 0, 1));
      off[ball] = lerp(start, toward(start, Z.logo, 5.5), u);
      return off;
    }

    if (action === 'fade' || action === 'hook' || action === 'skyhook' || action === 'postspin' || action === 'dropstep' || action === 'upunder') {
      u = ease(clamp(t / 0.65, 0, 1));
      off[ball] = lerp(start, zone, u);
      return off;
    }

    if (input.branch === 'pop' && r.big && off[r.big.id]) {
      popTo = clone(Z.top);
      off[r.big.id] = lerp(off[r.big.id], popTo, ease(clamp(t / 0.7, 0, 1)));
    }
    if (input.branch === 'roll' || input.branch === 'slip' || action === 'lob') {
      if (r.big && off[r.big.id]) {
        off[r.big.id] = lerp(off[r.big.id], clone(Z.rim), ease(clamp((t - 0.1) / 0.6, 0, 1)));
      }
      if (action === 'lob') off[ball] = lerp(start, Z.rim, ease(clamp((t - 0.25) / 0.5, 0, 1)));
    }

    u = ease(clamp((t - 0.2) / 0.55, 0, 1));
    if (dist(start, zone) > 1.2) off[ball] = lerp(start, zone, u);
    return off;
  }

  function placeDef(offPos, r, input, t) {
    var contest = input.contest || 'close';
    var def = {};
    var onGap = contest === 'open' ? 9.5 : (contest === 'close' ? 6.2 : 4.4);
    var sag = contest === 'open' ? 10 : (contest === 'close' ? 7.5 : 6.2);
    var id, op, gp, xy, gap;
    for (id in r.guardOf) {
      op = offPos[id];
      gp = r.guardOf[id];
      if (!op || !gp) continue;
      gap = (r.onBall && gp.id === r.onBall.id) ? onGap : sag;
      xy = toward(op, RIM, gap);
      if (r.onBall && gp.id === r.onBall.id && input.beat && t > 0.45) {
        xy = toward(op, Z.logo, 3.2);
        xy = lerp(toward(op, RIM, 4), xy, clamp((t - 0.45) / 0.4, 0, 1));
      }
      def[gp.id] = xy;
    }
    if ((contest === 'help' || contest === 'heavy') && r.help && t > 0.28) {
      var helpTo = contest === 'heavy' ? lerp(Z.nail, Z.rim, 0.35) : clone(Z.nail);
      if (r.ball && offPos[r.ball.id]) helpTo = toward(offPos[r.ball.id], RIM, contest === 'heavy' ? 3.2 : 6);
      var hu = ease(clamp((t - 0.28) / 0.45, 0, 1));
      if (def[r.help.id]) def[r.help.id] = lerp(def[r.help.id], helpTo, hu);
      else def[r.help.id] = helpTo;
    }
    if (input.outcome === 'blk' && r.blocker && t > 0.55) {
      def[r.blocker.id] = lerp(def[r.blocker.id] || clone(Z.rim), Z.rim, ease(clamp((t - 0.55) / 0.3, 0, 1)));
    }
    if (input.kind === 'stl' && r.stealer && r.ball && offPos[r.ball.id]) {
      def[r.stealer.id] = lerp(def[r.stealer.id] || offPos[r.ball.id], offPos[r.ball.id], ease(t));
    }
    return def;
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

  function packDots(offPos, defPos, input, ballId) {
    var dots = [], id, p;
    for (id in offPos) {
      p = findP(input.off, id);
      if (p) dots.push({ id: p.id, x: offPos[id][0], y: offPos[id][1], kind: homeAway(p, input), ball: ballId === p.id });
    }
    for (id in defPos) {
      p = findP(input.def, id);
      if (p) dots.push({ id: p.id, x: defPos[id][0], y: defPos[id][1], kind: homeAway(p, input), ball: ballId === p.id });
    }
    return dots;
  }

  function ballAt(r, input, t) {
    var pass = r.passer && /catch|spot|cut|lob|flare|pin|dho|extra|kick/.test(String(input.action || '') + String(input.branch || ''));
    if (input.kind === 'stl' && r.stealer) {
      return t < 0.4 ? (r.ball && r.ball.id) : r.stealer.id;
    }
    if (input.kind === 'tov') return t < 0.7 ? (r.ball && r.ball.id) : null;
    if (pass) return t < 0.38 ? r.passer.id : (r.ball && r.ball.id);
    return r.ball && r.ball.id;
  }

  PP_COURT.compose = function (input) {
    input = input || {};
    var r = assign(input);
    var tactic = input.tactic || 'pnr_side';
    var camera = 'half';
    if (tactic === 'trans_coast' || tactic === 'steal' || input.action === 'coast') camera = 'full';
    var times = [0, 0.22, 0.48, 0.74, 1];
    var frames = times.map(function (t) {
      var off = poseOff(r, input, t);
      var def = placeDef(off, r, input, t);
      separate([off, def], 3.4);
      return { t: t, dots: packDots(off, def, input, ballAt(r, input, t)) };
    });
    return { camera: camera, tactic: tactic, branch: input.branch, zone: input.zone, frames: frames };
  };

  /* ---------- SVG 球场（NBA 94×50） ---------- */
  var svg, dotsG, ballEl, wrap, raf, enabled = true, dotMap = {};

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
    if (document.getElementById('pp-court-style')) return;
    var s = document.createElement('style');
    s.id = 'pp-court-style';
    s.textContent =
      '.pp-live-court-wrap{height:220px;background:var(--bg-card);border-bottom:1px solid var(--border);flex-shrink:0;position:relative}' +
      '.pp-live-court-wrap.is-off{display:none}' +
      '.pp-live-court{width:100%;height:100%;display:block}' +
      '.pp-court-line{stroke:var(--text-dim);stroke-width:0.22;fill:none}' +
      '.pp-court-dash{stroke:var(--text-dim);stroke-width:0.18;fill:none;stroke-dasharray:0.9 0.7;opacity:.75}' +
      '.pp-court-board{stroke:var(--text);stroke-width:0.45}' +
      '.pp-court-rim{stroke:var(--orange);stroke-width:0.28}' +
      '.pp-dot-home{fill:#f4f4f4;stroke:#1c1c1c;stroke-width:0.28}' +
      '.pp-dot-away{fill:#161616;stroke:#e8e8e8;stroke-width:0.28}' +
      '.pp-dot-hero{fill:#d4a017;stroke:#fff4c2;stroke-width:0.42}' +
      '.pp-dot-hero-ring{fill:none;stroke:#ffe38a;stroke-width:0.32;opacity:.95}' +
      '.pp-court-ball{fill:var(--orange);stroke:#fff;stroke-width:0.18}';
    document.head.appendChild(s);
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
    svg.setAttribute('viewBox', '46.5 -0.8 48.3 51.6');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(courtLines());
    dotsG = nsEl('g');
    dotsG.setAttribute('class', 'pp-court-dots');
    svg.appendChild(dotsG);
    ballEl = nsEl('circle');
    ballEl.setAttribute('r', '0.72');
    ballEl.setAttribute('class', 'pp-court-ball');
    svg.appendChild(ballEl);
    wrap.appendChild(svg);
    dotMap = {};
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
    if (camera === 'full') svg.setAttribute('viewBox', '-1 -0.8 96 51.6');
    else svg.setAttribute('viewBox', '46.5 -0.8 48.3 51.6');
  }

  function drawDots(dots) {
    if (!dotsG) return;
    var seen = {}, i, d, node, ring, c, ball = null;
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
      node.c.setAttribute('cx', d.x.toFixed(3));
      node.c.setAttribute('cy', d.y.toFixed(3));
      node.c.setAttribute('r', d.kind === 'hero' ? '1.35' : '1.12');
      node.c.setAttribute('class', d.kind === 'hero' ? 'pp-dot-hero' : (d.kind === 'home' ? 'pp-dot-home' : 'pp-dot-away'));
      if (d.kind === 'hero') {
        node.ring.style.display = '';
        node.ring.setAttribute('cx', d.x.toFixed(3));
        node.ring.setAttribute('cy', d.y.toFixed(3));
      } else {
        node.ring.style.display = 'none';
      }
      if (d.ball) ball = d;
    }
    for (i in dotMap) {
      if (!seen[i]) {
        if (dotMap[i].c.parentNode) dotMap[i].c.parentNode.removeChild(dotMap[i].c);
        if (dotMap[i].ring.parentNode) dotMap[i].ring.parentNode.removeChild(dotMap[i].ring);
        delete dotMap[i];
      }
    }
    if (ballEl) {
      if (ball) {
        ballEl.setAttribute('cx', (ball.x + 1.15).toFixed(3));
        ballEl.setAttribute('cy', (ball.y - 0.95).toFixed(3));
        ballEl.style.display = '';
      } else ballEl.style.display = 'none';
    }
  }

  function mixDots(a, b, t) {
    var map = {}, i, d, o, u = ease(t), out = [];
    for (i = 0; i < (b || []).length; i++) map[b[i].id] = b[i];
    for (i = 0; i < (a || []).length; i++) {
      d = a[i];
      o = map[d.id];
      if (o) out.push({
        id: d.id, kind: d.kind, ball: u > 0.5 ? o.ball : d.ball,
        x: d.x + (o.x - d.x) * u,
        y: d.y + (o.y - d.y) * u
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
