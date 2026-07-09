/* ============================================================
   JETLINE UI — Behavior
   Zero dependencies. Auto-wires on DOMContentLoaded via data-jl-*.
   Also exposes window.Jetline { toast, openModal, closeModal }.
   ============================================================ */
(function () {
  'use strict';

  /* ---- Tabs: [data-jl-tabs] wraps .jl-tabs button[data-tab] + .jl-tabpanel[data-tab] */
  function initTabs(root) {
    root.querySelectorAll('[data-jl-tabs]').forEach(function (group) {
      var btns = group.querySelectorAll('.jl-tabs button[data-tab]');
      var panels = group.querySelectorAll('.jl-tabpanel[data-tab]');
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          btns.forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
          panels.forEach(function (p) {
            if (p.getAttribute('data-tab') === b.getAttribute('data-tab')) p.setAttribute('data-active', '');
            else p.removeAttribute('data-active');
          });
        });
      });
    });
  }

  /* ---- Segmented control: .jl-segment button */
  function initSegments(root) {
    root.querySelectorAll('.jl-segment').forEach(function (seg) {
      var btns = seg.querySelectorAll('button');
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          btns.forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        });
      });
    });
  }

  /* ---- Dropdown: .jl-dropdown > [data-jl-toggle] + .jl-menu */
  function initDropdowns(root) {
    root.querySelectorAll('.jl-dropdown').forEach(function (dd) {
      var toggle = dd.querySelector('[data-jl-toggle]');
      var menu = dd.querySelector('.jl-menu');
      if (!toggle || !menu) return;
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = menu.hasAttribute('data-open');
        closeAllMenus();
        if (!open) menu.setAttribute('data-open', '');
      });
      menu.querySelectorAll('.jl-menu__item').forEach(function (item) {
        item.addEventListener('click', function () { menu.removeAttribute('data-open'); });
      });
    });
  }
  function closeAllMenus() {
    document.querySelectorAll('.jl-menu[data-open]').forEach(function (m) { m.removeAttribute('data-open'); });
  }

  /* ---- Accordion: .jl-acc > .jl-acc__head */
  function initAccordion(root) {
    root.querySelectorAll('.jl-acc').forEach(function (acc) {
      var head = acc.querySelector('.jl-acc__head');
      if (!head) return;
      head.addEventListener('click', function () {
        var parent = acc.closest('[data-jl-accordion]');
        var open = acc.hasAttribute('data-open');
        if (parent && parent.hasAttribute('data-single')) {
          parent.querySelectorAll('.jl-acc[data-open]').forEach(function (a) { a.removeAttribute('data-open'); });
        }
        if (open) acc.removeAttribute('data-open'); else acc.setAttribute('data-open', '');
      });
    });
  }

  /* ---- Modal: [data-jl-open="id"] opens .jl-overlay#id; [data-jl-close] closes */
  function initModals(root) {
    root.querySelectorAll('[data-jl-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(btn.getAttribute('data-jl-open')); });
    });
    root.querySelectorAll('.jl-overlay').forEach(function (ov) {
      ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(ov.id); });
      ov.querySelectorAll('[data-jl-close]').forEach(function (c) {
        c.addEventListener('click', function () { closeModal(ov.id); });
      });
    });
  }
  function openModal(id) { var m = document.getElementById(id); if (m) m.setAttribute('data-open', ''); }
  function closeModal(id) { var m = document.getElementById(id); if (m) m.removeAttribute('data-open'); }

  /* ---- Range fill: .jl-range updates --jl-fill for the track gradient */
  function initRanges(root) {
    root.querySelectorAll('.jl-range').forEach(function (r) {
      var paint = function () {
        var min = +r.min || 0, max = +r.max || 100;
        var pct = ((r.value - min) / (max - min)) * 100;
        r.style.setProperty('--jl-fill', pct + '%');
        var out = r.parentElement && r.parentElement.querySelector('[data-jl-output]');
        if (out) out.textContent = r.value;
      };
      r.addEventListener('input', paint); paint();
    });
  }

  /* ---- Wizard: [data-jl-wizard] with .jl-steps .jl-step + [data-jl-next]/[data-jl-prev] */
  function initWizards(root) {
    root.querySelectorAll('[data-jl-wizard]').forEach(function (wz) {
      var steps = [].slice.call(wz.querySelectorAll('.jl-step'));
      var idx = steps.findIndex(function (s) { return s.getAttribute('data-state') === 'active'; });
      if (idx < 0) idx = 0;
      function render() {
        steps.forEach(function (s, i) {
          s.setAttribute('data-state', i < idx ? 'done' : i === idx ? 'active' : '');
        });
        var prev = wz.querySelector('[data-jl-prev]'), next = wz.querySelector('[data-jl-next]');
        if (prev) prev.toggleAttribute('disabled', idx === 0);
        if (next) next.textContent = idx === steps.length - 1 ? 'Finish' : 'Continue';
      }
      var n = wz.querySelector('[data-jl-next]'), p = wz.querySelector('[data-jl-prev]');
      if (n) n.addEventListener('click', function () { if (idx < steps.length - 1) { idx++; render(); } else { Jetline.toast('All steps complete', 'green'); } });
      if (p) p.addEventListener('click', function () { if (idx > 0) { idx--; render(); } });
      render();
    });
  }

  /* ---- Toast API ---- */
  function ensureHost() {
    var host = document.querySelector('.jl-toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'jl-toast-host'; document.body.appendChild(host); }
    return host;
  }
  var TOAST_ICON = {
    green: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>',
    red: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8h.01M11 12h1v4h1"/></svg>'
  };
  function toast(msg, kind) {
    kind = kind || 'info';
    var host = ensureHost();
    var el = document.createElement('div');
    el.className = 'jl-toast';
    el.innerHTML = '<span class="jl-chip">' + (TOAST_ICON[kind] || TOAST_ICON.info) + '</span><span class="jl-toast__text">' + msg + '</span>';
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', function () { el.remove(); });
    }, 2600);
  }

  /* ---- Copy buttons: [data-jl-copy="text"] ---- */
  function initCopy(root) {
    root.querySelectorAll('[data-jl-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-jl-copy');
        if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('Copied to clipboard', 'green'); });
      });
    });
  }

  document.addEventListener('click', function () { closeAllMenus(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAllMenus(); document.querySelectorAll('.jl-overlay[data-open]').forEach(function (o) { o.removeAttribute('data-open'); }); }
  });

  function initAll(root) {
    root = root || document;
    initTabs(root); initSegments(root); initDropdowns(root); initAccordion(root);
    initModals(root); initRanges(root); initWizards(root); initCopy(root);
  }

  window.Jetline = { toast: toast, openModal: openModal, closeModal: closeModal, init: initAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initAll(document); });
  else initAll(document);
})();
