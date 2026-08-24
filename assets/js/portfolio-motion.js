/* ==========================================================================
   TWIN PORTFOLIO — world controller
   - reads ?mode= / sessionStorage, defaults to REALITY
   - top-right switcher (睁眼 REALITY ━━━━ 闭眼 DREAM)
   - ~800ms iris transition: cat closes eyes → pupil → bloom → swap → reopen
   - dream particle field (bioluminescent, mobile -50%)
   - publications horizontal gallery with dream "current/fog" focus + pet pager
   ========================================================================== */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  function getWorld() { return root.dataset.world === "dream" ? "dream" : "reality"; }

  function setWorld(w, persist) {
    root.dataset.world = w;
    if (persist !== false) {
      try { sessionStorage.setItem("twin-world", w); } catch (e) {}
      try {
        var url = new URL(location.href);
        url.searchParams.set("mode", w);
        history.replaceState(null, "", url.pathname + url.search);
      } catch (e) {}
    }
    document.dispatchEvent(new CustomEvent("portfolio:worldchange", { detail: { world: w } }));
  }

  function initWorld() {
    setWorld("dream", false);
    root.dataset.experience = "unified";
  }

  /* ---------------- switcher ---------------- */
  function buildSwitcher() {
    var btn = document.createElement("button");
    btn.className = "world-switcher";
    btn.type = "button";
    btn.setAttribute("aria-label", "切换 现实 / 梦境 世界");
    btn.innerHTML =
      '<span class="ws-eye ws-eye--r is-on"></span>' +
      '<span class="ws-label ws-label--r">睁眼 REALITY</span>' +
      '<span class="ws-track"><span class="ws-knob"></span></span>' +
      '<span class="ws-label ws-label--d">闭眼 DREAM</span>' +
      '<span class="ws-eye ws-eye--d"></span>';
    document.body.appendChild(btn);
    btn.addEventListener("click", function () {
      transitionTo(getWorld() === "dream" ? "reality" : "dream");
    });
    document.addEventListener("portfolio:worldchange", function (e) {
      var d = e.detail.world === "dream";
      btn.querySelector(".ws-eye--r").classList.toggle("is-on", !d);
      btn.querySelector(".ws-eye--d").classList.toggle("is-on", d);
    });
  }

  /* ---------------- iris transition ---------------- */
  var switching = false;
  function transitionTo(world) {
    if (switching || getWorld() === world) return;
    switching = true;
    document.dispatchEvent(new CustomEvent("twin:switching"));

    var iris = document.querySelector(".world-iris");
    if (!iris) {
      iris = document.createElement("div");
      iris.className = "world-iris";
      iris.innerHTML = '<span class="iris-pupil"></span>';
      document.body.appendChild(iris);
    }
    if (REDUCED) { setWorld(world); switching = false; return; }

    requestAnimationFrame(function () { iris.classList.add("is-active"); });
    setTimeout(function () { iris.classList.add("is-bloom"); }, 130);
    setTimeout(function () { setWorld(world); }, 430);            // swap under full cover
    setTimeout(function () {
      iris.classList.remove("is-bloom");
      iris.classList.remove("is-active");
      switching = false;
    }, 840);
  }

  /* ---------------- dream particle field ---------------- */
  function buildDreamField() {
    var cv = document.createElement("canvas");
    cv.className = "dream-field";
    document.body.appendChild(cv);
    var ctx = cv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var parts = [];
    var raf = null;
    var mobile = window.innerWidth < 768;
    var density = mobile ? 0.5 : 1;     // mobile: 50% fewer particles
    root.style.setProperty("--dream-density", String(density));

    function seed() {
      var n = Math.round((mobile ? 70 : 150) * density);
      parts = [];
      for (var i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          r: Math.random() * 1.8 + 0.4,
          vy: -(Math.random() * 0.25 + 0.05),
          vx: (Math.random() - 0.5) * 0.16,
          gold: Math.random() < 0.12,
          a: Math.random() * 0.5 + 0.2
        });
      }
    }
    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + "px"; cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    function frame() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y += p.vy; p.x += p.vx;
        if (p.y < -6) { p.y = window.innerHeight + 6; p.x = Math.random() * window.innerWidth; }
        var c = p.gold ? "rgba(190,218,255," : "rgba(103,176,255,";
        ctx.beginPath();
        ctx.fillStyle = c + p.a + ")";
        ctx.shadowColor = p.gold ? "rgba(190,218,255,.8)" : "rgba(103,176,255,.82)";
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (getWorld() === "dream" && !REDUCED && !document.hidden) raf = requestAnimationFrame(frame);
      else raf = null;
    }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }

    window.addEventListener("resize", resize);
    resize();
    document.addEventListener("portfolio:worldchange", function (e) {
      if (e.detail.world === "dream") start(); else stop();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (getWorld() === "dream") start();
    });
    if (getWorld() === "dream") start();
  }

  /* ---------------- publications gallery ---------------- */
  function buildPublications() {
    var sec = document.querySelector('[data-world-section="publications"]');
    if (!sec) return;
    var pubs = sec.querySelectorAll(".publication");
    if (!pubs.length) return;

    var gallery = document.createElement("div");
    gallery.className = "pub-gallery";
    pubs.forEach(function (p) { gallery.appendChild(p); });
    sec.appendChild(gallery);

    var total = ("0" + pubs.length).slice(-2);
    var prog = document.createElement("div");
    prog.className = "pub-progress";
    prog.innerHTML = '<span class="now">01</span><span class="bar"><i></i></span><span class="tot">' + total + "</span>";
    sec.appendChild(prog);

    // dream "current / fog" focus
    function updateCurrent() {
      if (getWorld() !== "dream") {
        pubs.forEach(function (p) { p.classList.remove("is-current"); });
        return;
      }
      var best = 0, bestD = 1e9;
      pubs.forEach(function (p, i) {
        var r = p.getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - window.innerWidth / 2);
        if (d < bestD) { bestD = d; best = i; }
        p.classList.toggle("is-current", i === best);
      });
      prog.querySelector(".now").textContent = ("0" + (best + 1)).slice(-2);
      prog.querySelector(".bar i").style.width = ((best + 1) / pubs.length * 100) + "%";
    }
    gallery.addEventListener("scroll", updateCurrent, { passive: true });
    window.addEventListener("resize", updateCurrent);
    window.addEventListener("scroll", updateCurrent, { passive: true });
    updateCurrent();

    // pet pager (dream only)
    var cat = document.createElement("div");
    cat.className = "pub-cat";
    cat.innerHTML = '<span class="hero-cat-motion"><canvas class="hero-lab-cat"></canvas></span>';
    sec.appendChild(cat);
    var ccanvas = cat.querySelector("canvas");
    if (window.LabCatPet && window.LabCatPet.mount) {
      window.LabCatPet.mount(ccanvas, { stage: cat });
    }
    cat.addEventListener("click", function () {
      gallery.scrollBy({ left: gallery.clientWidth * 0.82, behavior: "smooth" });
    });
    document.addEventListener("portfolio:worldchange", function (e) {
      cat.style.display = e.detail.world === "dream" ? "block" : "none";
    });
    cat.style.display = getWorld() === "dream" ? "block" : "none";
  }

  /* ---------------- section dock (reality nav) ---------------- */
  function buildSectionDock() {
    var secs = document.querySelectorAll(".world-section[id]");
    if (!secs.length) return;
    var dock = document.createElement("nav");
    dock.className = "section-dock";
    dock.setAttribute("aria-label", "章节导航");
    secs.forEach(function (s) {
      var a = document.createElement("a");
      a.href = "#" + s.id;
      a.setAttribute("aria-label", s.id);
      dock.appendChild(a);
    });
    document.body.appendChild(dock);
    function sync() {
      var mid = window.innerHeight * 0.4, on = null;
      secs.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) on = s.id;
      });
      dock.querySelectorAll("a").forEach(function (a) {
        a.classList.toggle("is-active", a.getAttribute("href") === "#" + on);
      });
    }
    window.addEventListener("scroll", sync, { passive: true });
    sync();
    document.addEventListener("portfolio:worldchange", function (e) {
      dock.style.display = e.detail.world === "reality" ? "block" : "none";
    });
    dock.style.display = getWorld() === "reality" ? "block" : "none";
  }

  /* ---------------- mount cover cats ---------------- */
  function mountCoverCats() {
    document.querySelectorAll(".world-cover .hero-cat-motion").forEach(function (m) {
      var cv = m.querySelector("canvas");
      var cover = m.closest(".world-cover");
      if (cv && window.LabCatPet && window.LabCatPet.mount) {
        window.LabCatPet.mount(cv, { stage: cover });
      }
    });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    initWorld();
    buildDreamField();
    buildPublications();
    buildSectionDock();
    mountCoverCats();

    // cat closes eyes during switch
    document.addEventListener("twin:switching", function () {
      document.querySelectorAll("canvas.hero-lab-cat").forEach(function (cv) {
        cv.dispatchEvent(new CustomEvent("pet:sleep"));
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
