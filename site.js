/**
 * KTL Tech Hub – Phase 3 site interactions.
 * Reveal, count-up, FAQ polish, reduced-motion / mobile hero strategy.
 * Loads hub-scene.js (→ three.min.js) only on desktop when motion is allowed.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  var preferStaticHero = reduceMotion || isMobile;

  /* ——— Hero: static image vs WebGL ——— */
  function setupStaticHero() {
    var hero = document.querySelector('.hero');
    var canvas = document.getElementById('hub-canvas');
    if (!hero) return;

    document.documentElement.classList.add('no-webgl', 'hero-static-mode');
    document.documentElement.classList.remove('has-webgl');

    if (canvas) {
      canvas.style.display = 'none';
      canvas.setAttribute('aria-hidden', 'true');
    }

    if (!hero.querySelector('.hero-static')) {
      var img = document.createElement('img');
      img.className = 'hero-static';
      img.src = 'img/hero-static.webp';
      img.width = 1265;
      img.height = 792;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.decoding = 'async';
      img.fetchPriority = 'high';
      // Insert before fallback orbs / grid so CSS can layer it
      var anchor = hero.querySelector('.hero-fallback') || hero.firstChild;
      hero.insertBefore(img, anchor);
    }

    var fallback = hero.querySelector('.hero-fallback');
    if (fallback) fallback.style.display = 'none';
  }

  function loadHubScene() {
    if (window.__ktlHubSceneLoading) return;
    window.__ktlHubSceneLoading = true;
    var s = document.createElement('script');
    s.src = 'hub-scene.js';
    s.defer = true;
    s.onerror = function () {
      console.warn('hub-scene.js failed to load');
      setupStaticHero();
    };
    document.head.appendChild(s);
  }

  if (preferStaticHero) {
    setupStaticHero();
  } else {
    loadHubScene();
  }

  /* ——— Scroll reveal: 24px / 600ms / 80ms stagger ——— */
  function initReveal() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!nodes.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    // Stagger within each parent section for siblings
    var groups = new Map();
    nodes.forEach(function (el) {
      var parent = el.parentElement || document.body;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    groups.forEach(function (list) {
      list.forEach(function (el, i) {
        el.style.transitionDelay = (i * 80) + 'ms';
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    nodes.forEach(function (el) { io.observe(el); });
  }

  /* ——— Stats count-up (only real numbers; keep placeholders as text) ——— */
  function parseCountTarget(text) {
    if (!text) return null;
    var t = String(text).trim();
    if (/[\[\]]/.test(t)) return null; // placeholder like [TESTERS]
    if (!/^\d[\d,]*(?:\.\d+)?[kKmMbB+]?%?$/.test(t) && !/^\d[\d,]*$/.test(t.replace(/[+,]/g, ''))) {
      // allow forms like 1,200+ or 12k
      if (!/^\d[\d,]*(?:\.\d+)?\s*[kKmMbB+]*%?$/.test(t)) return null;
    }
    var suffix = '';
    var m = t.match(/^([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return null;
    var num = parseFloat(m[1].replace(/,/g, ''));
    if (!isFinite(num)) return null;
    suffix = m[2] || '';
    return { value: num, suffix: suffix, decimals: (m[1].split('.')[1] || '').length };
  }

  function animateCount(el, target) {
    var start = performance.now();
    var duration = reduceMotion ? 0 : 1200;
    function frame(now) {
      var p = duration ? Math.min(1, (now - start) / duration) : 1;
      var eased = 1 - Math.pow(1 - p, 3);
      var current = target.value * eased;
      var display = target.decimals
        ? current.toFixed(target.decimals)
        : String(Math.round(current));
      if (!target.decimals && target.value >= 1000) {
        display = Math.round(current).toLocaleString('en-IN');
      }
      el.textContent = display + target.suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function initCounters() {
    var els = document.querySelectorAll('.stat-value, [data-count]');
    if (!els.length) return;

    var targets = [];
    els.forEach(function (el) {
      var raw = el.getAttribute('data-count') || el.textContent;
      var parsed = parseCountTarget(raw);
      if (!parsed) return; // leave placeholders untouched
      el.setAttribute('data-count-final', String(parsed.value) + parsed.suffix);
      targets.push({ el: el, parsed: parsed });
    });
    if (!targets.length) return;

    function run(item) {
      if (item.el.getAttribute('data-counted') === '1') return;
      item.el.setAttribute('data-counted', '1');
      animateCount(item.el, item.parsed);
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var match = targets.find(function (t) { return t.el === entry.target; });
        if (match) run(match);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.35 });

    targets.forEach(function (t) { io.observe(t.el); });
  }

  /* ——— FAQ accordion polish ——— */
  function initFaq() {
    var items = document.querySelectorAll('.faq details');
    if (!items.length) return;

    items.forEach(function (details) {
      var summary = details.querySelector('summary');
      if (!summary) return;

      summary.setAttribute('role', 'button');
      summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');

      details.addEventListener('toggle', function () {
        summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
        if (details.open) {
          // Close siblings for cleaner accordion (optional polish)
          items.forEach(function (other) {
            if (other !== details && other.open) other.open = false;
          });
        }
      });

      // Keyboard: native details already handles Enter/Space on summary;
      // ensure focus styles + Home/End between items
      summary.addEventListener('keydown', function (e) {
        var list = Array.prototype.slice.call(items);
        var idx = list.indexOf(details);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          var next = list[Math.min(list.length - 1, idx + 1)];
          if (next) next.querySelector('summary').focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          var prev = list[Math.max(0, idx - 1)];
          if (prev) prev.querySelector('summary').focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          list[0].querySelector('summary').focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          list[list.length - 1].querySelector('summary').focus();
        }
      });
    });
  }

  function boot() {
    initReveal();
    initCounters();
    initFaq();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
