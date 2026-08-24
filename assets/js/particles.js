(function () {
  "use strict";

  var field = document.querySelector(".particle-field");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!field || reduceMotion) return;

  var colors = [
    "rgba(55, 111, 181, .55)",
    "rgba(92, 157, 183, .48)",
    "rgba(91, 169, 153, .42)"
  ];

  var particleCount = window.innerWidth < 768 ? 28 : 58;
  var createdCount = 0;

  function createParticles(limit) {
    for (var i = createdCount; i < limit; i += 1) {
      var particle = document.createElement("span");
      var isSoft = i % 4 === 0;
      var size = isSoft ? 9 + Math.random() * 11 : 2.5 + Math.random() * 5;

      particle.className = "particle" + (isSoft ? " particle--soft" : "");
      particle.style.setProperty("--x", (Math.random() * 100).toFixed(2) + "%");
      particle.style.setProperty("--size", size.toFixed(2) + "px");
      particle.style.setProperty("--duration", (20 + Math.random() * 30).toFixed(2) + "s");
      particle.style.setProperty("--delay", (-Math.random() * 48).toFixed(2) + "s");
      particle.style.setProperty("--drift", (-70 + Math.random() * 140).toFixed(2) + "px");
      particle.style.setProperty("--opacity", (isSoft ? .14 + Math.random() * .14 : .3 + Math.random() * .38).toFixed(2));
      particle.style.setProperty("--color", colors[i % colors.length]);
      field.appendChild(particle);
    }
    createdCount = Math.max(createdCount, limit);
  }

  function initialParticles() {
    createParticles(document.documentElement.dataset.world === "dream" ? particleCount : Math.min(12, particleCount));
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(initialParticles, { timeout: 650 });
  } else {
    window.setTimeout(initialParticles, 0);
  }

  window.addEventListener("portfolio:worldchange", function (event) {
    if (event.detail && event.detail.world === "dream" && createdCount < particleCount) createParticles(particleCount);
  });
}());
