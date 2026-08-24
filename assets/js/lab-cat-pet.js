/* ==========================================================================
   LCT Pig-Turtle — an interactive portfolio mascot rendered on <canvas>.

   No sprite sheets, no external assets: the whole cat (head / ears / eyes /
   pupils / nose / whiskers / paws / tail) is drawn every frame, so it can
   breathe, blink, swish its tail, twitch its ears and track the cursor with
   its eyes. On top of that it runs a small mood state machine
   (idle / curious / happy / sleepy / sleeping) with spring physics, a
   particle system (hearts / stars / sparkles / Zzz) and a persisted
   "affection" meter in localStorage.

   Mounted from portfolio-motion.js into the existing .hero-cat-stage wrapper,
   so the GSAP parallax and the reality/dream world-switch keep working.
   ========================================================================== */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var AFF_KEY = "lct-pet-affection";

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function loadAffection() {
    try {
      var v = parseInt(window.localStorage.getItem(AFF_KEY), 10);
      return isNaN(v) ? 35 : clamp(v, 0, 100);
    } catch (e) { return 35; }
  }
  function saveAffection(v) {
    try { window.localStorage.setItem(AFF_KEY, String(Math.round(v))); } catch (e) {}
  }

  // Two palettes selected by the current world (reality = bright editorial,
  // dream = glowing biolab). Re-read every frame so switching is instant.
  function palette() {
    var dream = document.documentElement.dataset.world === "dream";
    if (dream) {
      return {
        fur: "#cdeee9", furShade: "#9fd9d2", outline: "#0c3533",
        ear: "#7fd8cb", earInner: "#f6c9d6",
        sclera: "#0a2a2c", eye: "#f0c674", eyeGlow: "rgba(233,196,106,.95)",
        nose: "#ff9bb6", blush: "rgba(255,150,180,.5)",
        collar: "#f2c879", tag: "#fff3c4", whisker: "rgba(230,255,250,.85)",
          glow: "rgba(103,176,255,.58)", dream: true, bodyAlpha: 1
      };
    }
    return {
      fur: "#f6efe4", furShade: "#e7dccb", outline: "#5b4d3f",
      ear: "#f0d9c8", earInner: "#f6b7c4",
      sclera: "#ffffff", eye: "#2c3a4a", eyeGlow: "rgba(120,200,255,.0)",
      nose: "#e98aa0", blush: "rgba(233,138,160,.45)",
      collar: "#3aa6a0", tag: "#dff3f1", whisker: "rgba(91,77,63,.55)",
      glow: "rgba(68,224,205,.22)", dream: false, bodyAlpha: 1
    };
  }

  function mount(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var W = 0, H = 0;
    var mascot = new Image();
    mascot.src = "/images/lct-pig-turtle-q.png";
    mascot.onload = function () { if (REDUCED) draw(); };

    var aff = loadAffection();
    var lastAffSave = 0;
    var lastInteract = performance.now();

    var state = {
      t: 0,
      mood: "idle",          // idle | curious | happy | sleepy | sleeping
      moodUntil: 0,
      blink: 1,              // 1 open, 0 closed
      nextBlink: rand(1.2, 3.5),
      blinkTimer: 0,
      tailPhase: rand(0, 6.28),
      earPhase: 0,
      earTwitch: 0,
      earTimer: rand(2, 6),
      gazeX: 0, gazeY: 0,    // smoothed pupil offset (-1..1)
      targetGazeX: 0, targetGazeY: 0,
      bounce: 0, bounceVel: 0,
      wander: 0, wanderTarget: 0, wanderTimer: rand(3, 7),
      yaw: 0,                // head tilt
      smile: 0,              // 0..1 mouth openness
      reaction: null
    };

    var particles = [];
    var trail = [];
    var pointer = { x: -9999, y: -9999, inside: false, down: false };

    function resize() {
      var r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(type, n, opts2) {
      opts2 = opts2 || {};
      for (var i = 0; i < n; i++) {
        var a = rand(0, Math.PI * 2);
        var sp = rand(opts2.speedMin || 14, opts2.speedMax || 46);
        particles.push({
          type: type,
          x: opts2.x != null ? opts2.x + rand(-6, 6) : W * 0.5,
          y: opts2.y != null ? opts2.y + rand(-6, 6) : H * 0.32,
          vx: Math.cos(a) * sp * (opts2.vx || 1),
          vy: Math.sin(a) * sp - (opts2.lift || 20),
          life: 0,
          max: opts2.max || rand(0.9, 1.6),
          rot: rand(0, 6.28),
          vr: rand(-3, 3),
          size: opts2.size || rand(7, 13),
          text: opts2.text || ""
        });
      }
    }

    function setMood(mood, ms) {
      state.mood = mood;
      state.moodUntil = performance.now() + (ms || 0);
      if (mood === "happy") {
        var DREAM = document.documentElement.dataset.world === "dream";
        state.bounceVel -= DREAM ? 13.5 : 9.5;
        state.smile = 1;
      }
    }

    function pet(x, y) {
      lastInteract = performance.now();
      setMood("happy", 1100);
      aff = clamp(aff + 4.5, 0, 100);
      spawn("heart", 3, { x: x, y: y, lift: 36, speedMax: 40 });
      spawn("star", 2, { x: x, y: y, lift: 30 });
      stage.classList.remove("is-pet-happy");
      void stage.offsetWidth;
      stage.classList.add("is-pet-happy");
      window.setTimeout(function () { stage.classList.remove("is-pet-happy"); }, 720);
    }

    /* ----------------------------- update ------------------------------ */
    function update(dt) {
      state.t += dt;
      var now = performance.now();
      var DREAM = document.documentElement.dataset.world === "dream";

      // mood transitions from idle timers
      var idleFor = now - lastInteract;
      if (state.mood !== "happy") {
        if (idleFor > 52000) setMood("sleeping", 1e9);
        else if (idleFor > 24000 && state.mood !== "sleeping") setMood("sleepy", 1e9);
        else if (state.mood === "sleepy" && idleFor < 24000) setMood("idle", 0);
      }
      if (state.mood === "happy" && now > state.moodUntil) {
        setMood(pointer.inside ? "curious" : "idle", 0);
      }

      // blink
      state.blinkTimer += dt;
      if (state.mood === "sleeping") {
        state.blink = lerp(state.blink, 0.04, dt * 8);
      } else if (state.mood === "sleepy") {
        // long slow blinks
        if (state.blinkTimer > state.nextBlink) {
          state.blink = lerp(state.blink, 0.12, dt * 14);
          if (state.blink < 0.2) { state.blinkTimer = 0; state.nextBlink = rand(3.5, 6); }
        } else {
          state.blink = lerp(state.blink, 1, dt * 10);
        }
      } else {
        if (state.blinkTimer > state.nextBlink) {
          state.blink = lerp(state.blink, 0, dt * 26);
          if (state.blink < 0.06) { state.blinkTimer = 0; state.nextBlink = rand(2.2, 5.2); }
        } else {
          state.blink = lerp(state.blink, 1, dt * 16);
        }
      }

      // tail + ear idle motion (dream = larger, livelier)
      state.tailPhase += dt * 1.25 * (DREAM ? 1.5 : 1);
      state.earTimer -= dt;
      if (state.earTimer <= 0) { state.earTwitch = 1; state.earTimer = rand(2.5, 6.5); }
      state.earTwitch = Math.max(0, state.earTwitch - dt * 3.2);
      state.earPhase = Math.sin(state.t * 0.8) * 0.04;

      // gaze toward pointer (canvas-local), eased
      var ex = W * 0.5, ey = H * 0.34;
      if (pointer.inside || pointer.x > -9000) {
        var dx = pointer.x - ex, dy = pointer.y - ey;
        var d = Math.hypot(dx, dy) || 1;
        state.targetGazeX = clamp(dx / (W * 0.6), -1, 1);
        state.targetGazeY = clamp(dy / (H * 0.6), -0.8, 1);
      } else {
        // glance around when alone
        state.targetGazeX = Math.sin(state.t * 0.5) * 0.5;
        state.targetGazeY = Math.sin(state.t * 0.27) * 0.25;
      }
      var gk = state.mood === "sleeping" ? dt * 1.5 : dt * 9;
      state.gazeX = lerp(state.gazeX, state.targetGazeX, gk);
      state.gazeY = lerp(state.gazeY, state.targetGazeY, gk);

      // wander (shift weight)
      state.wanderTimer -= dt;
      if (state.wanderTimer <= 0) { state.wanderTarget = rand(-1, 1); state.wanderTimer = rand(3, 7); }
      state.wander = lerp(state.wander, state.wanderTarget, dt * 1.2);

      // bounce spring
      var acc = -90 * state.bounce - 13 * state.bounceVel;
      state.bounceVel += acc * dt;
      state.bounce += state.bounceVel * dt;

      // smile easing
      state.smile = lerp(state.smile, state.mood === "happy" ? 1 : 0, dt * 8);

      // yaw: curious leans toward gaze
      var tYaw = state.mood === "curious" ? state.gazeX * 0.18 : state.wander * 0.06;
      state.yaw = lerp(state.yaw, tYaw, dt * 6);

      // particles
      if (state.mood === "sleeping" && Math.random() < dt * 0.5) {
        spawn("z", 1, { x: W * 0.66, y: H * 0.2, lift: 14, speedMax: 10, vx: 0.4, size: rand(10, 16) });
      }
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life += dt;
        p.vy += 26 * dt; // gravity-ish drift
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.life > p.max) particles.splice(i, 1);
      }

      // affection slow decay + occasional save
      aff = clamp(aff - dt * 0.06, 0, 100);
      if (now - lastAffSave > 2500) { saveAffection(aff); lastAffSave = now; }

      // toggle curious class for the CSS glow halo
      if (opts.stage) {
        if (state.mood === "curious" || state.mood === "happy") opts.stage.classList.add("is-curious");
        else opts.stage.classList.remove("is-curious");
      }
    }

    /* ------------------------------ draw ------------------------------- */
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawCat(p) {
      var breath = Math.sin(state.t * 1.7) * 0.5 + 0.5;
      var breathe = 1 + Math.sin(state.t * 1.7) * 0.028;
      var groundY = H * 0.90 + state.bounce * H * 0.05;

      var cx = W * 0.5 + state.wander * W * 0.02;
      var bodyW = W * 0.40;
      var bodyH = H * 0.30 * breathe;
      var headR = W * 0.285;
      var headCY = groundY - bodyH * 0.62 - headR * 0.78 + Math.sin(state.t * 1.7) * 1.2;
      var headCX = cx + Math.sin(state.yaw) * headR * 0.18;

      // dream: faint motion afterimage (trail of the head)
      if (p.dream) {
        trail.push({ x: headCX, y: headCY, r: headR });
        if (trail.length > 6) trail.shift();
        for (var ti = 0; ti < trail.length - 2; ti++) {
          var g = trail[ti];
          ctx.save();
          ctx.globalAlpha = 0.14 * (1 - ti / trail.length);
          ctx.fillStyle = p.glow;
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.r * 0.92, 0, 6.2832);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(0, 0);
      ctx.globalAlpha = 1;

      // soft contact shadow
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = p.outline;
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.92, bodyW * 0.62, H * 0.022, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();

      // glow aura (dream)
      if (p.glow && p.glow.indexOf("0.55") > -1) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        var g = ctx.createRadialGradient(headCX, headCY, headR * 0.2, headCX, headCY, headR * 2.4);
        g.addColorStop(0, p.glow);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(headCX, headCY, headR * 2.4, 0, 6.2832);
        ctx.fill();
        ctx.restore();
      }

      // ----- tail (behind body) -----
      var tailSway = Math.sin(state.tailPhase) * 0.32 + (state.mood === "happy" ? 0.25 : 0);
      ctx.save();
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = W * 0.055;
      ctx.lineCap = "round";
      var tbx = cx + bodyW * 0.5, tby = groundY - bodyH * 0.2;
      ctx.beginPath();
      ctx.moveTo(tbx, tby);
      var c1x = tbx + W * 0.12, c1y = tby - H * 0.06 + tailSway * H * 0.1;
      var c2x = tbx + W * 0.20, c2y = tby - H * 0.18 + tailSway * H * 0.18;
      var endx = tbx + W * 0.16, endy = tby - H * 0.30 + tailSway * H * 0.22;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, endx, endy);
      ctx.stroke();
      ctx.restore();

      // dream: star-points trailing the tail tip
      if (p.dream) {
        var starN = 5;
        for (var si = 0; si < starN; si++) {
          var st = si / starN;
          var sx = endx - tailSway * 30 - st * 26 + Math.sin(state.t * 2 + si) * 4;
          var sy = endy + st * 18 + Math.cos(state.t * 1.7 + si) * 4;
          ctx.save();
          ctx.globalAlpha = (1 - st) * 0.8;
          ctx.fillStyle = si % 2 ? p.eye : p.collar;
          drawStar(sx, sy, 4, 2.4 + st * 1.4, 1);
          ctx.fill();
          ctx.restore();
        }
      }

      // ----- body -----
      ctx.save();
      ctx.fillStyle = p.fur;
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = Math.max(1.5, W * 0.012);
      ctx.beginPath();
      ctx.ellipse(cx, groundY - bodyH * 0.5, bodyW * 0.5, bodyH * 0.5, 0, 0, 6.2832);
      ctx.fill();
      ctx.stroke();
      // belly shade
      ctx.fillStyle = p.furShade;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, groundY - bodyH * 0.42, bodyW * 0.30, bodyH * 0.34, 0, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      // ----- front paws -----
      ctx.fillStyle = p.fur;
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = Math.max(1.2, W * 0.01);
      for (var s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.ellipse(cx + s * bodyW * 0.22, groundY - bodyH * 0.02, bodyW * 0.13, bodyH * 0.12, 0, 0, 6.2832);
        ctx.fill();
        ctx.stroke();
      }

      // ----- collar -----
      ctx.save();
      ctx.strokeStyle = p.collar;
      ctx.lineWidth = W * 0.03;
      ctx.beginPath();
      ctx.arc(headCX, headCY + headR * 0.86, headR * 0.78, 0.18 * Math.PI, 0.82 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = p.tag;
      ctx.beginPath();
      ctx.arc(headCX, headCY + headR * 1.02, headR * 0.12, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = Math.max(1, W * 0.008);
      ctx.stroke();
      ctx.restore();

      // ----- head group (tilt) -----
      ctx.save();
      ctx.translate(headCX, headCY);
      ctx.rotate(state.yaw * 0.5);

      // ears
      for (var e = -1; e <= 1; e += 2) {
        var twitch = e * state.earTwitch * 0.18 + state.earPhase * e;
        ctx.save();
        ctx.translate(e * headR * 0.62, -headR * 0.55);
        ctx.rotate(twitch);
        ctx.fillStyle = p.ear;
        ctx.strokeStyle = p.outline;
        ctx.lineWidth = Math.max(1.2, W * 0.01);
        ctx.beginPath();
        ctx.moveTo(-headR * 0.36, headR * 0.34);
        ctx.lineTo(0, -headR * 0.42);
        ctx.lineTo(headR * 0.36, headR * 0.34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = p.earInner;
        ctx.beginPath();
        ctx.moveTo(-headR * 0.18, headR * 0.22);
        ctx.lineTo(0, -headR * 0.18);
        ctx.lineTo(headR * 0.18, headR * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // head
      ctx.fillStyle = p.fur;
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = Math.max(1.5, W * 0.014);
      ctx.beginPath();
      ctx.arc(0, 0, headR, 0, 6.2832);
      ctx.fill();
      ctx.stroke();

      // blush when happy/curious
      if (state.mood === "happy" || state.mood === "curious") {
        ctx.fillStyle = p.blush;
        ctx.beginPath();
        ctx.ellipse(-headR * 0.5, headR * 0.22, headR * 0.16, headR * 0.1, 0, 0, 6.2832);
        ctx.ellipse(headR * 0.5, headR * 0.22, headR * 0.16, headR * 0.1, 0, 0, 6.2832);
        ctx.fill();
      }

      // eyes
      var eyeY = -headR * 0.02;
      var eyeDX = headR * 0.40;
      var eyeR = headR * 0.26;
      for (var k = -1; k <= 1; k += 2) {
        var exx = k * eyeDX;
        // sclera
        if (p.sclera !== "#ffffff" || state.mood !== "sleeping") {
          ctx.fillStyle = p.sclera;
          ctx.beginPath();
          ctx.ellipse(exx, eyeY, eyeR, eyeR * (0.25 + 0.75 * state.blink), 0, 0, 6.2832);
          ctx.fill();
        }
        if (state.blink > 0.18) {
          // iris + pupil follow gaze
          var px = exx + state.gazeX * eyeR * 0.42;
          var py = eyeY + state.gazeY * eyeR * 0.42;
          ctx.fillStyle = p.eye;
          ctx.beginPath();
          ctx.arc(px, py, eyeR * 0.62 * state.blink, 0, 6.2832);
          ctx.fill();
          // pupil
          ctx.fillStyle = p.outline;
          ctx.beginPath();
          ctx.arc(px, py, eyeR * 0.30 * state.blink, 0, 6.2832);
          ctx.fill();
          // glow + highlight
          if (p.eyeGlow && p.eyeGlow.indexOf("0)") === -1) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.shadowColor = p.eyeGlow;
            ctx.shadowBlur = 12;
            ctx.fillStyle = p.eyeGlow;
            ctx.beginPath();
            ctx.arc(px, py, eyeR * 0.62 * state.blink, 0, 6.2832);
            ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.beginPath();
          ctx.arc(px - eyeR * 0.18, py - eyeR * 0.2, eyeR * 0.16 * state.blink, 0, 6.2832);
          ctx.fill();
        } else {
          // closed eye = curved line
          ctx.strokeStyle = p.outline;
          ctx.lineWidth = Math.max(1.5, W * 0.012);
          ctx.beginPath();
          ctx.arc(exx, eyeY, eyeR * 0.7, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
      }

      // nose
      ctx.fillStyle = p.nose;
      ctx.beginPath();
      ctx.moveTo(0, headR * 0.16);
      ctx.lineTo(-headR * 0.07, headR * 0.10);
      ctx.lineTo(headR * 0.07, headR * 0.10);
      ctx.closePath();
      ctx.fill();

      // mouth (smile grows with happy)
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = Math.max(1.2, W * 0.01);
      var mo = 0.18 + state.smile * 0.22;
      ctx.beginPath();
      ctx.moveTo(0, headR * 0.18);
      ctx.quadraticCurveTo(-headR * 0.12, headR * (0.18 + mo), -headR * 0.22, headR * 0.20);
      ctx.moveTo(0, headR * 0.18);
      ctx.quadraticCurveTo(headR * 0.12, headR * (0.18 + mo), headR * 0.22, headR * 0.20);
      ctx.stroke();
      if (state.smile > 0.4) {
        // little tongue
        ctx.fillStyle = p.nose;
        ctx.beginPath();
        ctx.ellipse(0, headR * 0.30, headR * 0.07, headR * 0.06 * state.smile, 0, 0, 6.2832);
        ctx.fill();
      }

      // whiskers
      ctx.strokeStyle = p.whisker;
      ctx.lineWidth = Math.max(1, W * 0.006);
      for (var wside = -1; wside <= 1; wside += 2) {
        for (var wl = 0; wl < 3; wl++) {
          var wy = headR * (0.10 + wl * 0.06);
          ctx.beginPath();
          ctx.moveTo(wside * headR * 0.10, wy);
          ctx.quadraticCurveTo(wside * headR * 0.5, wy - headR * 0.04, wside * headR * 0.86, wy - headR * 0.02 + wl * headR * 0.02);
          ctx.stroke();
        }
      }

      ctx.restore(); // head group
      ctx.globalAlpha = 1;
      ctx.restore(); // cat
    }

    function drawPigTurtle(p) {
      if (!mascot.complete || !mascot.naturalWidth) {
        drawCat(p);
        return;
      }
      var sleeping = state.mood === "sleeping";
      var breathe = 1 + Math.sin(state.t * 1.7) * 0.018;
      var w = Math.min(W * .96, H * .96);
      var h = w * mascot.naturalHeight / mascot.naturalWidth;
      if (h > H * .96) { h = H * .96; w = h * mascot.naturalWidth / mascot.naturalHeight; }
      ctx.save();
      ctx.translate(
        W * .5 + state.wander * W * .012 + state.gazeX * W * .018,
        H * .52 + state.bounce * H * .045 + state.gazeY * H * .008 + (sleeping ? H * .025 : 0)
      );
      ctx.rotate(state.yaw * .12 + Math.sin(state.t * 1.2) * .008);
      ctx.transform(1, state.gazeX * .018, state.gazeX * -.025, sleeping ? .94 : 1, 0, 0);
      ctx.scale(breathe, breathe);
      ctx.globalAlpha = p.bodyAlpha;
      if (p.dream) {
        ctx.shadowColor = p.glow;
        ctx.shadowBlur = Math.max(14, W * .075);
      }
      ctx.drawImage(mascot, -w * .5, -h * .5, w, h);
      ctx.restore();
    }

    function drawParticles(p) {
      for (var i = 0; i < particles.length; i++) {
        var pt = particles[i];
        var a = 1 - pt.life / pt.max;
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        if (pt.type === "z") {
          ctx.fillStyle = p.outline;
          ctx.font = "bold " + pt.size + "px Georgia, serif";
          ctx.fillText("Z", -pt.size * 0.3, pt.size * 0.3);
        } else if (pt.type === "star") {
          ctx.fillStyle = p.collar;
          drawStar(0, 0, 5, pt.size * 0.5, pt.size * 0.22);
          ctx.fill();
        } else {
          // heart
          ctx.fillStyle = p.nose;
          drawHeart(0, 0, pt.size * 0.5);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function drawHeart(x, y, r) {
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.3);
      ctx.bezierCurveTo(x, y - r * 0.2, x - r, y - r * 0.2, x - r, y + r * 0.25);
      ctx.bezierCurveTo(x - r, y + r * 0.7, x, y + r * 0.9, x, y + r * 1.1);
      ctx.bezierCurveTo(x, y + r * 0.9, x + r, y + r * 0.7, x + r, y + r * 0.25);
      ctx.bezierCurveTo(x + r, y - r * 0.2, x, y - r * 0.2, x, y + r * 0.3);
      ctx.closePath();
    }

    function drawStar(x, y, spikes, outer, inner) {
      var rot = -Math.PI / 2;
      var step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
      for (var i = 0; i < spikes; i++) {
        rot += step;
        ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
        rot += step;
        ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
      }
      ctx.closePath();
    }

    function drawAffection(p) {
      // 5 little hearts, top-left, filled by affection
      var filled = Math.round(aff / 20);
      var hx = W * 0.06, hy = H * 0.07, r = Math.max(3, W * 0.022);
      ctx.save();
      for (var i = 0; i < 5; i++) {
        ctx.globalAlpha = i < filled ? 0.95 : 0.22;
        ctx.fillStyle = i < filled ? p.nose : p.outline;
        drawHeart(hx + i * r * 2.4, hy, r);
        ctx.fill();
      }
      ctx.restore();
    }

    function draw() {
      var p = palette();
      ctx.clearRect(0, 0, W, H);
      drawPigTurtle(p);
      drawParticles(p);
      drawAffection(p);
    }

    /* --------------------------- animation ----------------------------- */
    var raf = null, last = performance.now();
    function frame(ts) {
      var dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    // event wiring
    function localPoint(ev) {
      var r = canvas.getBoundingClientRect();
      pointer.x = ev.clientX - r.left;
      pointer.y = ev.clientY - r.top;
    }
    var stage = opts.stage || canvas;
    var hitTarget = canvas;
    var holdTimer = 0;
    hitTarget.addEventListener("pointermove", function (ev) {
      localPoint(ev); pointer.inside = true;
      if (state.mood === "idle" || state.mood === "sleeping") setMood("curious", 0);
      stage.classList.add("is-pet-curious");
    });
    hitTarget.addEventListener("pointerleave", function () {
      pointer.inside = false;
      stage.classList.remove("is-pet-curious");
      window.clearTimeout(holdTimer);
    });
    hitTarget.addEventListener("pointerdown", function (ev) {
      localPoint(ev); pointer.down = true;
      pet(pointer.x, pointer.y);
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(function () {
        setMood("sleeping", 1800);
        stage.classList.add("is-pet-sleeping");
      }, 650);
    });
    hitTarget.addEventListener("pointerup", function () {
      pointer.down = false;
      window.clearTimeout(holdTimer);
      window.setTimeout(function () { stage.classList.remove("is-pet-sleeping"); }, 900);
    });
    // global gaze tracking (eyes follow cursor anywhere over the hero)
    document.addEventListener("pointermove", function (ev) {
      var r = canvas.getBoundingClientRect();
      pointer.x = ev.clientX - r.left;
      pointer.y = ev.clientY - r.top;
    });
    // keyboard petting for accessibility
    hitTarget.setAttribute("tabindex", "0");
    hitTarget.setAttribute("role", "button");
    hitTarget.setAttribute("aria-label", "LCT 科研猪龟电子宠物，点击互动，长按让它睡觉");
    hitTarget.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        pet(W * 0.5, H * 0.4);
      }
    });

    // react to world switch so palette refreshes immediately
    document.addEventListener("portfolio:worldchange", function () { /* palette read live */ });

    // close eyes briefly while the worlds iris-transition runs
    document.addEventListener("pet:sleep", function () { setMood("sleeping", 750); });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (!REDUCED) start();
    });
    window.addEventListener("resize", resize);

    resize();
    if (REDUCED) { draw(); }
    else { start(); }
  }

  window.LabCatPet = { mount: mount };
})();
