(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- Automatic overall-experience counter ----
     One centralized source of truth: the earliest documented professional start date (Mineski Infinity
     Franchise Corp., per the Experience section). This is NOT the MedWiz employment dates, which stay
     fixed. calculateExperience() returns completed full years only (no rounding), so "6 years 11 months"
     still reads "6+ years" and only becomes "7+ years" once a full 7th year is complete. Every element
     that displays overall experience reads from this single function, so nothing needs manual updates. */
  window.calculateExperience = function (startDate) {
    var now = new Date();
    var years = now.getFullYear() - startDate.getFullYear();
    var hadAnniversaryThisYear =
      now.getMonth() > startDate.getMonth() ||
      (now.getMonth() === startDate.getMonth() && now.getDate() >= startDate.getDate());
    if (!hadAnniversaryThisYear) years -= 1;
    if (years < 1) years = 1;
    return years + '+ years';
  };
  (function experienceCounter() {
    var CAREER_START_DATE = new Date('2019-06-01'); /* Mineski Infinity Franchise Corp. -- earliest documented role */
    var label = window.calculateExperience(CAREER_START_DATE);
    $$('[data-experience-years]').forEach(function (el) { el.textContent = label; });
  })();

  /* If the resume PDF is hosted next to this page, set its path here (for example
     'resume/Angelo-Bosito-Resume.pdf'). While empty, the copy embedded in this page is used. */
  var RESUME_URL = '';
  var RESUME_NAME = 'Angelo-Bosito-Resume.pdf';

  /* ---- Intro screen -> page ----
     Readiness logic is unchanged (window load + fonts, minimum wait, cap). The percentage is an
     eased progress curve that eases toward ~92%, creeps if assets are slow, then completes to 100%
     once the page is genuinely ready; only then does the screen hand over to the portfolio.
     The four category icons are drawn from that same value (see iconField below). The reveal delays and the
     start of the count were pulled together (LEAD, minWait) so the count is on screen from its first percent. */
  (function loader() {
    var el = $('#loader'), fill = $('#loaderFill'), pct = $('#loaderPct');
    var quick = reduce.matches;
    var minWait = quick ? 200 : 3300;
    var LEAD = quick ? 0 : 1100;         /* start counting as the category line, bar and % come into view */
    var FINISH = quick ? 0 : 520;        /* last stretch to 100% */
    var HOLD = quick ? 0 : 380;          /* rest on 100% before the hand-over */
    var t0 = performance.now(), shown = -1, from = 0, finishAt = 0, finishing = false, done = false;

    /* ---- Category icons: scrambled -> aligned, driven by the same progress value as the bar ----
       Four independent inline-SVG icons live in a layer on top of the category line. Every label reserves an
       empty slot under itself in CSS, and that slot is where its icon finishes. Destinations are measured from the
       live layout (any screen, any font), and motion is a pure function of (progress, time): at 0 the icons are
       shuffled and drift; as progress rises they glide to their own label, then straighten and settle; at 100
       the function returns the exact rest pose and nothing moves any more. */
    var field = (function () {
      var brand = $('.loader__brand', el), role = $('.loader__role', el), label = $('.loader__label', el);
      var words = $$('.loader__word', role), nodes = $$('.lic', role);
      if (!brand || !role || !label || words.length !== 4 || nodes.length !== 4) return null;

      /* One entry per icon, in label order: data, research, operations, automation.
         u4 / u2  where it starts along the field for the one-row / two-row layout (0 = left edge, 1 = right edge), shuffled on purpose
         s        start lane: -1 just under the words, +1 down in the free space below. Icons that must pass each other get opposite lanes.
         r, z, a  start tilt (deg), scale and opacity
         e        pacing (<1 arrives a touch earlier)
         f, ph    drift frequencies (rad/ms) and phases */
      var CFG = [
        { u4: .30, u2: .82, s:  1,   r: -18, z: .86, a: .55, e: 1.00, f: [.0031, .0024], ph: [0.0, 1.7] },
        { u4: .04, u2: .12, s: -1,   r:  26, z: .92, a: .70, e: .90,  f: [.0026, .0034], ph: [2.1, 0.4] },
        { u4: .80, u2: .84, s:  .85, r: -28, z: .84, a: .50, e: 1.10, f: [.0029, .0027], ph: [4.0, 3.1] },
        { u4: .52, u2: .14, s: -1,   r:  16, z: .90, a: .64, e: .95,  f: [.0024, .0031], ph: [5.2, 2.4] }
      ];
      /* Order-preserving start used only if the free space is too tight for the shuffle to pass without touching. */
      var CALM = [.16, .09, -.09, -.16];

      var geo = null, lastP = 0;
      function ss(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * x * (x * (x * 6 - 15) + 10); }   /* smootherstep */

      function pose(g, i, p, t) {
        var c = CFG[i], D = g.D[i], S = g.S[i], q = Math.pow(p, c.e);
        var gx = 1 - ss(q * 1.12);            /* slides along the row first ... */
        var gy = 1 - ss(Math.pow(q, 1.6));    /* ... then settles vertically and straightens */
        var ga = 1 - ss(q);                   /* opacity + scale ease in with the overall progress */
        var gd = 1 - ss(q / .85);             /* drift dies out by ~75% */
        var x = D.x + (S.x - D.x) * gx + g.ax * gd * Math.sin(c.f[0] * t + c.ph[0]);
        var y = D.y + (S.y - D.y) * gy + g.ay[i] * gd * Math.cos(c.f[1] * t + c.ph[1]);
        return {
          x: Math.max(g.xMin, Math.min(g.xMax, x)),
          y: Math.max(g.yMin[i], Math.min(g.yMax[i], y)),
          r: c.r * gy + 4 * gd * Math.sin(c.f[1] * t * 1.3 + c.ph[0]),
          z: 1 - (1 - c.z) * ga,
          a: Math.max(.3, Math.min(1, 1 - (1 - c.a) * ga + .1 * gd * Math.sin(c.f[0] * t * 1.1 + c.ph[1])))
        };
      }

      /* The shuffle is only kept if no two icons ever come closer than one icon-width on the way in. */
      function clear(g) {
        var p, t, i, j, a, b, worst = 1e9;
        for (p = 0; p <= 1.0001; p += .025) {
          for (t = 0; t < 2000; t += 700) {
            for (i = 0; i < 3; i++) {
              a = pose(g, i, Math.min(p, 1), t);
              for (j = i + 1; j < 4; j++) {
                b = pose(g, j, Math.min(p, 1), t);
                worst = Math.min(worst, Math.hypot(a.x - b.x, a.y - b.y));
              }
            }
          }
        }
        return worst >= g.ico * 1.05;
      }

      function measure() {
        var ico = nodes[0].offsetWidth, i, m = [], rows = [], rowOf = [];
        if (!ico || !role.offsetWidth) return;
        for (i = 0; i < 4; i++) {
          var w = words[i], cs = getComputedStyle(w);
          var ls = parseFloat(cs.letterSpacing) || 0, pb = parseFloat(cs.paddingBottom) || 0;
          m.push({
            x: w.offsetLeft + w.offsetWidth / 2 - ls / 2,        /* centre of the visible letters (the last letter carries trailing tracking) */
            y: w.offsetTop + w.offsetHeight - ico / 2,           /* the icon fills the bottom of the word's reserved slot */
            top: w.offsetTop, textBottom: w.offsetTop + w.offsetHeight - pb
          });
        }
        m.forEach(function (o, k) {
          var r = null;
          rows.forEach(function (q) { if (Math.abs(q.y - o.y) < 3) r = q; });
          if (!r) { r = { y: o.y, top: o.top, textBottom: o.textBottom }; rows.push(r); }
          r.top = Math.min(r.top, o.top); r.textBottom = Math.min(r.textBottom, o.textBottom);
          rowOf[k] = r;
        });
        rows.sort(function (a, b) { return a.y - b.y; });
        var below = Math.max(0, Math.min(30, label.offsetTop - (role.offsetTop + role.offsetHeight) - 12));
        rows.forEach(function (r, k) {
          var next = rows[k + 1];
          r.yMin = r.textBottom - 3 + ico / 2;                                   /* never up into the letters */
          r.yMax = (next ? next.top + 2 : role.offsetHeight + below) - ico / 2;  /* never into the next line / the status label */
          r.up = Math.max(0, r.y - r.yMin); r.down = Math.max(0, r.yMax - r.y);
        });
        var xa = Math.min.apply(null, m.map(function (o) { return o.x; })), xb = Math.max.apply(null, m.map(function (o) { return o.x; }));
        var ext = Math.max(12, Math.min(40, (xb - xa) * .1)), edge = 4 + ico / 2;
        var xMin = Math.min(xa, Math.max(edge - role.offsetLeft, xa - ext));
        var xMax = Math.max(xb, Math.min(brand.offsetWidth - role.offsetLeft - edge, xb + ext));
        var span = xMax - xMin, two = rows.length > 1;

        function build(calm) {
          var g = { ico: ico, D: [], S: [], yMin: [], yMax: [], ay: [], xMin: xMin, xMax: xMax, ax: Math.max(2.5, Math.min(6, span * .02)) };
          for (var k = 0; k < 4; k++) {
            var c = CFG[k], r = rowOf[k];
            var sx = calm ? m[k].x + CALM[k] * span : xMin + (two ? c.u2 : c.u4) * span;
            g.D.push({ x: m[k].x, y: m[k].y });
            g.S.push({ x: Math.max(xMin, Math.min(xMax, sx)), y: r.y + (c.s >= 0 ? c.s * r.down : c.s * r.up) });
            g.yMin.push(r.yMin); g.yMax.push(Math.max(r.yMax, r.y));
            g.ay.push(Math.min(3, (r.up + r.down) * .12));
          }
          return g;
        }
        geo = build(false);
        if (!clear(geo)) geo = build(true);
        draw(lastP);
      }

      function draw(p) {
        lastP = p;
        if (!geo) return;
        var calm = quick || p >= 1, t = performance.now(), k = window.devicePixelRatio || 1, half = geo.ico / 2, i, o, tx, ty;
        for (i = 0; i < 4; i++) {
          if (calm) {   /* the rest pose: exact, snapped to the device pixel grid, no tilt, full weight */
            tx = Math.round((geo.D[i].x - half) * k) / k; ty = Math.round((geo.D[i].y - half) * k) / k;
            nodes[i].style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
            nodes[i].style.opacity = '1';
          } else {
            o = pose(geo, i, p, t);
            nodes[i].style.transform = 'translate3d(' + (o.x - half).toFixed(2) + 'px,' + (o.y - half).toFixed(2) + 'px,0) rotate(' + o.r.toFixed(2) + 'deg) scale(' + o.z.toFixed(3) + ')';
            nodes[i].style.opacity = o.a.toFixed(3);
          }
        }
      }

      measure();
      draw(0);
      if ('ResizeObserver' in window) new ResizeObserver(measure).observe(role);
      window.addEventListener('resize', measure);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      return { measure: measure, draw: draw };
    })();

    function paint(v) {
      v = Math.min(100, Math.max(0, v));
      var n = Math.round(v);
      if (n !== shown) { shown = n; pct.textContent = n; }
      fill.style.transform = 'scaleX(' + (v / 100) + ')';
      if (field) field.draw(v / 100);
    }
    function tick(now) {
      if (done) return;
      var v, t = now - t0;
      if (finishing) {
        var k = FINISH ? Math.min((now - finishAt) / FINISH, 1) : 1;
        v = from + (100 - from) * (1 - Math.pow(1 - k, 3));
        paint(v);
        if (k >= 1) return;
      } else {
        var s = Math.min(Math.max((t - LEAD) / (minWait - LEAD), 0), 1);
        v = 92 * (1 - Math.pow(1 - s, 1.8));
        if (t > minWait) v = 92 + 4 * (1 - Math.exp(-(t - minWait) / 1400));   /* slow assets: keep creeping, never stall */
        from = v;
        paint(v);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function handOver() {
      if (done) return;
      done = true;
      if (field) field.measure();   /* fresh geometry so the rest pose is exact */
      paint(100);
      root.classList.remove('is-loading');
      root.classList.add('is-ready');
      setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 1500);
    }

    var wait = new Promise(function (r) { setTimeout(r, minWait); });
    var loaded = new Promise(function (r) { if (document.readyState === 'complete') r(); else window.addEventListener('load', r, { once: true }); });
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var cap = new Promise(function (r) { setTimeout(r, quick ? 3600 : 4500); });
    Promise.race([Promise.all([loaded, fonts]), cap]).then(function () { return wait; }).then(function () {
      finishing = true;
      finishAt = performance.now();
      if (quick) { paint(100); }
      setTimeout(handOver, FINISH + HOLD);   /* timer-based so a backgrounded tab still completes */
    });
  })();

  /* ---- Theme: one unified fade across the whole page ---- */
  (function theme() {
    var btns = $$('[data-theme-toggle]'), timer = null;
    if (!(window.CSS && CSS.registerProperty)) root.classList.add('no-prop');
    function cur() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
    function apply(t) {
      root.setAttribute('data-theme', t);
      try { localStorage.setItem('ab-theme', t); } catch (e) {}
      btns.forEach(function (b) { b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); });
    }
    apply(cur());
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var next = cur() === 'dark' ? 'light' : 'dark';
        if (reduce.matches) { apply(next); return; }
        root.classList.add('theme-changing');
        void root.offsetWidth;
        apply(next);
        clearTimeout(timer);
        timer = setTimeout(function () { root.classList.remove('theme-changing'); }, 800);
      });
    });
  })();

  /* ---- Views: one-page navigation (nothing scrolls; the center content changes) ---- */
  (function views() {
    var TITLE = document.title;
    var order = ['home', 'about', 'services', 'portfolio', 'experience', 'why', 'cta', 'contact'];
    var labels = { 'home': 'Home', 'about': 'About', 'services': 'Services', 'portfolio': 'Portfolio', 'experience': 'Experience', 'why': 'Why Work With Me', 'cta': 'Work With Me', 'contact': 'Contact' };
    var views = {};
    order.forEach(function (id) { views[id] = $('#' + id); });
    var links = $$('.nav__link, .nav__cta');
    var header = $('#nav'), menu = $('#site-menu'), toggle = $('#menu-toggle'), live = $('#view-live');
    var current = null;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    function idFromHash() { var h = location.hash.replace(/^#/, ''); return views[h] ? h : 'home'; }
    function show(id) {
      if (!views[id] || id === current) return;
      current = id;
      order.forEach(function (k) {
        var on = k === id, v = views[k];
        v.classList.toggle('is-active', on);
        v.inert = !on;
        v.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      links.forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      document.title = id === 'home' ? TITLE : labels[id] + ' | Angelo Bosito';
      live.textContent = labels[id] + ' view';
      var sc = $('.view__scroll', views[id]); if (sc) sc.scrollTop = 0;
    }
    function navigate(id) {
      if (id === current) return;
      show(id);
      try { history.pushState({ v: id }, '', '#' + id); } catch (e) {}
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      if (!views[id]) return;
      e.preventDefault();
      closeMenu(false);
      navigate(id);
    });
    window.addEventListener('popstate', function () { show(idFromHash()); });
    window.addEventListener('hashchange', function () { show(idFromHash()); });

    /* Mobile menu */
    function closeMenu(refocus) {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu');
      if (refocus) toggle.focus();
    }
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open); toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu(true); });
    document.addEventListener('click', function (e) { if (menu.classList.contains('is-open') && !header.contains(e.target)) closeMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1060) closeMenu(false); });

    show(idFromHash());
  })();

  /* ---- Experience: one role at a time ---- */
  (function tabs() {
    var tabs = $$('.tab'), panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
        if (on) { panels[j].classList.remove('is-in'); void panels[j].offsetWidth; panels[j].classList.add('is-in'); }
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var n = null, len = tabs.length;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % len;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + len) % len;
        else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = len - 1;
        if (n !== null) { e.preventDefault(); select(n, true); }
      });
    });
    select(0);
  })();

  /* ---- Dialogs: one shared open/close behavior (animation, focus return, scroll lock) ---- */
  var Dialogs = (function () {
    var last = null;
    function open(d, trigger) {
      last = trigger || document.activeElement;
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      root.classList.add('modal-open');
    }
    function close(d) {
      function done() {
        d.classList.remove('is-closing');
        if (d.close) d.close(); else d.removeAttribute('open');
        root.classList.remove('modal-open');
        if (last && last.focus) last.focus();
      }
      if (reduce.matches) { done(); return; }
      d.classList.add('is-closing');
      setTimeout(done, 200);
    }
    function wire(d) {
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) close(d); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); close(d); });
    }
    return { open: open, close: close, wire: wire };
  })();

  /* ---- Case studies: content ---- */
  var LABEL_MED = 'DEMO DATA \u2014 FICTIONAL / HIPAA-SAFE \u00B7 Portfolio simulation of my workflow \u2014 not a production pharmacy system';
  var LABEL_GEN = 'Portfolio Demonstration \u00B7 Sample Data \u00B7 Fictionalized Records';
  var CASES = {
    pharmacy: {
      cat: 'Professional experience \u00B7 MedWiz Pharmacy \u00B7 September 2023 \u2013 September 2026',
      kind: 'exp', viz: 'pharmacy', label: LABEL_MED,
      signal: 'Accurate healthcare data entry, order review, workflow coordination, billing awareness, and careful handling of sensitive information.',
      challenge: 'A U.S. long-term-care pharmacy receives orders through many channels: electronic prescriptions, fax, written and verbal orders, and facility portals. The work is not only typing prescriptions. Each order has to be reviewed, entered accurately, billed to patient insurance or the facility, and clarified with pharmacists or facility personnel when something is missing or unclear.',
      process: [
        'Receive the order (eRx, fax, telephone / verbal, written order, or facility portal).',
        'Verify the patient, facility, prescriber, and order details before entry.',
        'Enter prescription data: medication, strength, dosage form, directions, frequency, quantity, and days supply.',
        'Review billing: patient insurance or facility billing, depending on the order.',
        'For insurance billing, process around the submitted days supply (this demo uses a 30-day example of a coverage review I encountered \u2014 not a universal insurance rule).',
        'For facility billing, requested days supply may need authorization from a DON or other authorized facility personnel, depending on that facility\u2019s workflow.',
        'Escalate unclear or conflicting details instead of guessing. Pharmacist review follows; clinical decisions stay with licensed staff.',
        'Move the order into processing once data and billing checks are complete.'
      ],
      tools: ['PointClickCare', 'MatrixCare', 'eMAR systems', 'Facility portals', 'Pharmacy workflow systems'],
      outcome: 'Processed 1,000+ prescription-related records daily while maintaining 99.8%+ accuracy (from my resume), supporting timely, accurate order handling for long-term-care facilities.',
      note: 'Performed in a HIPAA-regulated environment, following the minimum-necessary principle. Names, dates of birth, facilities, prescribers, Rx numbers, insurance, and medication orders in the demonstration are entirely fictional. It is not a screenshot of any employer or vendor system.'
    },
    leads: {
      cat: 'Capability & focus area \u00B7 Not a previous job title',
      kind: 'cap', viz: 'leads', label: LABEL_GEN,
      defs: [['Lead Research', 'Researching relevant businesses or prospects and gathering the information needed to evaluate or contact them.'], ['List Building', 'Organizing, structuring, cleaning, enriching, and maintaining prospect information into usable lists.']],
      challenge: 'Outreach and sales teams need prospect lists that are relevant, verified, and organized, not a long spreadsheet of copied names. Good lead research and careful list building are what make that data usable.',
      process: [
        'Define who the list is for and which criteria a business should meet.',
        'Research businesses and confirm they exist and match the criteria.',
        'Collect the relevant fields, such as website, location, industry, and contact role, and note the source.',
        'Validate the details, and remove duplicates and records that do not qualify.',
        'Clean and standardize the fields, then organize the records into a filterable prospect list.'
      ],
      tools: ['Microsoft Excel', 'Google Workspace', 'Spreadsheet-based workflows'],
      outcome: 'The focus is research quality, structured information, and usable prospect data. No sales, lead-volume, or conversion results are claimed.',
      note: 'This is a capability I am developing on top of my data and research experience. I have not held a dedicated lead-generation or sales role, and all companies and contacts below are fictional.'
    },
    school: {
      cat: 'Professional experience \u00B7 Manuel V. Gallego Foundation Colleges Inc. \u00B7 April 2023 \u2013 September 2023',
      kind: 'exp', viz: 'school', label: LABEL_GEN + ' \u00B7 Excel inventory workflow',
      signal: 'Excel-based inventory management, filtering, lookup/search, Pivot Tables, data organization, and locating records efficiently.',
      challenge: 'School inventory lives in spreadsheets: many items, several departments, and more than one building. The work was to keep those records organized so a specific item could be found and inventory could be reviewed by department or building \u2014 not advanced analytics.',
      process: [
        'Maintained administrative databases and digital records with a focus on accuracy, organization, and completeness.',
        'Built Excel-based tracking systems to improve reporting and record monitoring.',
        'Used filters to narrow a large inventory list to one department or building.',
        'Used search and lookup functions to retrieve an item\u2019s name, department, building, and assigned area.',
        'Used Pivot Tables to summarize inventory by department, building, or category.'
      ],
      tools: ['Microsoft Excel', 'Filters', 'LOOKUP functions', 'Pivot Tables', 'Administrative databases'],
      outcome: 'I used Excel tools to organize, filter, locate, and summarize inventory records, making it easier to identify where specific items belonged and review inventory by department or building.',
      note: 'My role was administrative support. Item IDs, quantities, and locations below are fictional sample data. The interface demonstrates the Excel workflow; it is not executing Excel\u2019s formula engine, and it is not software I built for this employer.'
    },
    retail: {
      cat: 'Professional experience \u00B7 Tarlac Mac Enterprises, Inc. \u00B7 September 2020 \u2013 April 2023',
      kind: 'exp', viz: 'retail', label: LABEL_GEN + ' \u00B7 Physical stock \u2194 system records',
      signal: 'Physical inventory counting, system-vs-physical reconciliation, receiving, barcode-based item entry, and maintaining accurate inventory records.',
      challenge: 'Retail appliance inventory is not only a database. A system-generated list is printed, counted on the floor, tallied by hand, then compared with system quantity so differences can be reconciled. Incoming brand deliveries also have to be verified and entered so the system stays aligned with physical stock.',
      process: [
        'Generate and print the system item list.',
        'Count physical stock in the store against that printed list.',
        'Tally physical count vs system quantity (Difference = Physical Count \u2212 System Quantity).',
        'Flag mismatches for reconciliation. A zero difference is matched; any other difference requires follow-up.',
        'Receive deliveries (including TVs and air conditioners from brands such as Sharp, TCL, Samsung, Hisense, and Devant): scan barcode, verify brand/model, confirm the item in the system, and update branch quantity.'
      ],
      tools: ['Inventory system', 'Printed system lists', 'Physical tally', 'Barcode receiving', 'Microsoft Excel'],
      outcome: 'I handled both physical inventory verification and inventory system updates, keeping physical stock aligned with system records while processing incoming deliveries. No sales or revenue figures are claimed. Quantities in the demo are fictional.',
      note: 'Brand and model numbers are real, publicly listed catalog models. Quantities, barcodes, and branch counts are fictionalized portfolio records, not Tarlac Mac stock figures.'
    },
    accuracy: {
      cat: 'Professional experience \u00B7 Across roles',
      kind: 'exp', viz: 'accuracy', label: LABEL_GEN + ' \u00B7 Same fields in \u2192 same fields out',
      signal: 'Record validation, field mapping, duplicate checks, and structured maintenance so information stays complete and usable.',
      challenge: 'Information arrives inconsistent: mixed date formats, duplicates, missing required fields, and values in the wrong column. Records only help a team when every field maps to the same register it was entered into \u2014 nothing dropped, nothing swapped.',
      process: [
        'Collect: gather information from its sources (spreadsheet export, fax list, system list).',
        'Enter: put each value into the matching field: Record ID, Name, Category, Quantity, Date, Department.',
        'Validate: check completeness, consistency, and errors, and flag what cannot be resolved instead of guessing.',
        'Organize: keep records structured so they can be found and used.',
        'Maintain: keep records current and audit them for discrepancies.',
        'Coordinate: work with the people who depend on the data.'
      ],
      tools: ['Microsoft Excel', 'Administrative databases', 'Pharmacy and facility systems'],
      outcome: 'Improved workflow efficiency through organized record management and standardized documentation (from my resume). No accuracy or time-saving percentages are claimed beyond those on my resume.',
      note: 'The register below is fictional sample data. Edits you make update the same record object so fields stay mapped. It is not a live employer database.'
    }
  };

  /* ---- Case studies: interactive fictional visuals ---- */
  var VIZ = (function () {
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function pill(t, c) { return '<span class="pill' + (c ? ' pill--' + c : '') + '">' + esc(t) + '</span>'; }
    function stages(list, active) {
      return '<ol class="vstages">' + list.map(function (s, i) {
        return '<li><button type="button" class="vstage' + (i === active ? ' is-active' : '') + (i < active ? ' is-done' : '') + '" data-act="stage" data-i="' + i + '" aria-pressed="' + (i === active) + '"><span class="vstage__n">' + (i + 1) + '</span><span>' + esc(s) + '</span></button></li>';
      }).join('') + '</ol>';
    }
    function group(label, opts, cur, act) {
      return '<span class="vctrl__group"><span class="vctrl__label">' + esc(label) + '</span>' + opts.map(function (o) {
        var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
        return '<button type="button" class="vbtn' + (String(cur) === String(v) ? ' is-on' : '') + '" data-act="' + act + '" data-v="' + esc(v) + '" aria-pressed="' + (String(cur) === String(v)) + '">' + esc(t) + '</button>';
      }).join('') + '</span>';
    }
    function row(k, v) { return '<div class="vrow"><span>' + esc(k) + '</span><span>' + v + '</span></div>'; }
    function table(cols, rows, cap) { return '<div class="tablewrap"><table class="vt"><caption class="visually-hidden">' + esc(cap) + '</caption><thead><tr>' + cols.join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>'; }

    var M = {};

    /* 1. Pharmacy order workflow */
    var PO = [
      { id: 'RX-4821', patient: 'Elena V. Hart', dob: '1948-03-12', facility: 'Willowbrook Care Center (demo)', med: 'Lisinopril', str: '10 mg', form: 'Tablet', sig: 'Take 1 tablet by mouth once daily', freq: 'Once daily', qty: 30, days: 30, md: 'Dr. Priya N. Alden', src: 'eRx', bill: 'insurance', status: 'Ready for Processing', ins: 'Example Health Plan (fictional)', rxn: 'RX-DEMO-4821' },
      { id: 'RX-4822', patient: 'Marcus J. Hale', dob: '1955-11-02', facility: 'Northridge LTC (demo)', med: 'Metformin', str: '500 mg', form: 'Tablet', sig: 'Take 1 tablet by mouth twice daily', freq: 'Twice daily', qty: 60, days: 30, md: 'Dr. Owen T. Briggs', src: 'Fax', bill: 'facility', status: 'Authorization Pending', req: 14, auth: '', by: '', rxn: 'RX-DEMO-4822' },
      { id: 'RX-4823', patient: 'Ruth A. Kim', dob: '1939-07-21', facility: 'Harborview Residence (demo)', med: 'Amlodipine', str: '5 mg', form: 'Tablet', sig: 'Take 1 tablet by mouth once daily', freq: 'Once daily', qty: 30, days: 30, md: 'Dr. Lena C. Moreau', src: 'Facility Portal', bill: 'facility', status: 'DON Approved', req: 30, auth: 30, by: 'DON', rxn: 'RX-DEMO-4823' },
      { id: 'RX-4824', patient: 'Samuel P. Ortiz', dob: '1961-04-08', facility: 'Cedar Hill Manor (demo)', med: 'Atorvastatin', str: '20 mg', form: 'Tablet', sig: 'Directions not specified', freq: 'Not specified', qty: 30, days: 30, md: 'Dr. Helen R. Voss', src: 'Telephone / Verbal', bill: 'insurance', status: 'Needs Clarification', issue: 1, ins: 'Summit Rx (fictional)', rxn: 'RX-DEMO-4824' },
      { id: 'RX-4825', patient: 'Nora L. Quinn', dob: '1944-09-30', facility: 'Willowbrook Care Center (demo)', med: 'Levothyroxine', str: '75 mcg', form: 'Tablet', sig: 'Take 1 tablet by mouth every morning', freq: 'Once daily', qty: 30, days: 30, md: 'Dr. Priya N. Alden', src: 'Written Order', bill: 'facility', status: 'Ready for Processing', req: 7, auth: 7, by: 'Authorized Facility Personnel', rxn: 'RX-DEMO-4825' },
      { id: 'RX-4826', patient: 'James W. Pell', dob: '1936-12-14', facility: 'Northridge LTC (demo)', med: 'Furosemide', str: '40 mg', form: 'Tablet', sig: 'Take 1 tablet by mouth once daily', freq: 'Once daily', qty: 30, days: 30, md: 'Dr. Owen T. Briggs', src: 'eRx', bill: 'insurance', status: 'In Queue', ins: 'Example Health Plan (fictional)', rxn: 'RX-DEMO-4826' },
      { id: 'RX-4827', patient: 'Clara D. Nunez', dob: '1952-06-03', facility: 'Maple Court ALF (demo)', med: 'Omeprazole', str: '20 mg', form: 'Capsule', sig: 'Take 1 capsule by mouth once daily before meals', freq: 'Once daily', qty: 30, days: 30, md: 'Dr. Lena C. Moreau', src: 'Fax', bill: 'facility', status: 'Authorization Pending', req: 90, auth: '', by: '', rxn: 'RX-DEMO-4827' }
    ];
    var PST = ['Order Received', 'Patient / Order Verification', 'Prescription Data Entry', 'Billing Review', 'Insurance or Facility Billing', 'Clarification / Authorization if Required', 'Pharmacist Review', 'Processing'];
    var PDESC = [
      'The order arrives through one channel. Source and patient identity are noted \u2014 nothing is assumed complete yet.',
      'Match the order to the correct fictional patient profile. Check facility, prescriber, medication, strength, form, and directions.',
      'Enter verified order fields into the workflow: quantity, days supply, SIG, and order source.',
      'Determine whether this prescription bills to patient insurance or to the facility. The two paths are different.',
      'Insurance: a coverage review can depend on the submitted days supply. This demo uses a 30-day example from the workflow I encountered; it is not a universal insurance policy. Facility: requested days supply may need DON or other authorized facility personnel, depending on that facility.',
      'Missing SIG, conflicting details, or pending facility authorization are escalated. Do not guess clinical or billing information.',
      'Hand the entered order to the pharmacist. Clinical decisions stay with licensed staff.',
      'Once data, billing, and review checks are complete, the order moves to processing.'
    ];
    M.pharmacy = {
      init: function () {
        return { stage: 0, sel: 'RX-4821', orders: PO.map(function (r) { return Object.assign({}, r); }) };
      },
      act: function (s, a, d) {
        var cur = s.orders.filter(function (r) { return r.id === s.sel; })[0];
        if (a === 'stage') s.stage = +d.i;
        else if (a === 'select') { s.sel = d.id; }
        else if (a === 'approve') {
          cur.auth = cur.req;
          cur.by = d.v;
          cur.status = d.v === 'DON' ? 'DON Approved' : 'Approved';
          s.stage = 5;
        }
      },
      input: function (s, k, v, ds) {
        var cur = s.orders.filter(function (r) { return r.id === s.sel; })[0];
        if (k === 'req') { cur.req = Math.max(1, +v || 0); if (cur.auth !== '' && cur.auth != null) cur.auth = cur.req; }
      },
      render: function (s) {
        var g = s.stage, cur = s.orders.filter(function (r) { return r.id === s.sel; })[0], T = function (t) { return '<th scope="col">' + t + '</th>'; };
        var body = s.orders.map(function (r) {
          return '<tr tabindex="0" data-act="select" data-id="' + r.id + '"' + (r.id === s.sel ? ' class="is-sel"' : '') + '><td>' + esc(r.patient) + '</td><td>' + r.dob + '</td><td>' + esc(r.facility) + '</td><td>' + esc(r.med + ' ' + r.str) + '</td><td>' + esc(r.src) + '</td><td>' + (r.bill === 'insurance' ? pill('Patient Insurance', 'ok') : pill('Facility', 'stat')) + '</td><td>' + pill(r.status, r.issue || r.status.indexOf('Pending') >= 0 || r.status.indexOf('Clarif') >= 0 ? 'warn' : 'ok') + '</td></tr>';
        }).join('');
        var issue = !!cur.issue && g < 6;
        var billBox;
        if (cur.bill === 'insurance') {
          billBox = '<div class="vpanel bill--ins is-focus"><h5>Patient insurance workflow</h5>' +
            row('Billing Method', pill('Patient Insurance', 'ok')) +
            row('Insurance Billing', esc(cur.ins)) +
            row('Days Supply', '30') +
            row('Quantity', String(cur.qty)) +
            row('Coverage Review', 'Based on submitted days supply') +
            row('Coverage Check', pill('Reviewed for 30-day supply', 'ok')) +
            row('Billing Status', pill(cur.issue ? 'Hold \u2014 clarification needed' : 'Ready for Processing', cur.issue ? 'warn' : 'ok')) +
            '<p class="vnote">Demonstration of a coverage review around a 30-day supply in the workflow I encountered. Not a universal insurance policy.</p></div>';
        } else {
          billBox = '<div class="vpanel bill--fac is-focus"><h5>Facility billing workflow</h5>' +
            row('Billing Method', pill('Facility', 'stat')) +
            row('Requested Days Supply', '<input class="vfield vqty" id="viz-req" type="number" min="1" max="90" data-in="req" value="' + esc(cur.req) + '" aria-label="Requested days supply">') +
            row('Authorized Days Supply', cur.auth === '' || cur.auth == null ? 'Pending' : String(cur.auth)) +
            row('Approval Required', pill('Yes', 'warn')) +
            row('Approval Status', cur.by ? pill('Approved', 'ok') : pill('Pending', 'warn')) +
            row('Approved By', cur.by ? esc(cur.by) : '\u2014') +
            row('Authorization Role', cur.by ? esc(cur.by) : 'DON / Authorized Facility Personnel') +
            '<div class="vctrl" style="margin:.55rem 0 0"><button type="button" class="vbtn" data-act="approve" data-v="DON">Approve as DON</button><button type="button" class="vbtn" data-act="approve" data-v="Authorized Facility Personnel">Approve as authorized personnel</button></div>' +
            '<p class="vnote">Facility billing may require authorization from a DON or other authorized facility personnel, depending on the facility\u2019s workflow. Days supply is editable in this demo because approved supply can differ by authorization.</p></div>';
        }
        var detail = '<div class="vpanel"><h5>Order detail (fictional)</h5>' +
          row('Rx Number', esc(cur.rxn)) + row('Patient Name', esc(cur.patient)) + row('DOB', cur.dob) + row('Facility', esc(cur.facility)) +
          row('Medication', esc(cur.med)) + row('Strength', esc(cur.str)) + row('Dosage Form', esc(cur.form)) +
          row('Directions', issue ? pill('Not specified', 'warn') : esc(cur.sig)) + row('Frequency', issue ? pill('Not specified', 'warn') : esc(cur.freq)) +
          row('Quantity', String(cur.qty)) + row('Days Supply', String(cur.days)) + row('Prescriber', esc(cur.md)) +
          row('Order Source', esc(cur.src)) + row('Billing Type', cur.bill === 'insurance' ? 'Patient Insurance' : 'Facility Billing') +
          row('Status', pill(cur.status, issue || cur.status.indexOf('Pending') >= 0 ? 'warn' : 'ok')) + '</div>';
        var extra = issue ? ' This sample order is missing directions, so it is flagged for clarification with the pharmacist or facility \u2014 not guessed.' : '';
        return '<p class="viz__badges"><span class="pill pill--warn">DEMO DATA \u2014 FICTIONAL / HIPAA-SAFE</span><span class="pill">No real patient information</span></p>' +
          '<div class="kpis"><div class="kpi"><strong>' + s.orders.length + '</strong><span>Queue (demo)</span></div><div class="kpi"><strong>' + s.orders.filter(function (r) { return r.bill === 'insurance'; }).length + '</strong><span>Insurance billing</span></div><div class="kpi"><strong>' + s.orders.filter(function (r) { return r.bill === 'facility'; }).length + '</strong><span>Facility billing</span></div><div class="kpi"><strong>' + s.orders.filter(function (r) { return r.issue || r.status.indexOf('Pending') >= 0; }).length + '</strong><span>Needs follow-up</span></div></div>' +
          stages(PST, g) + '<p class="vdesc" aria-live="polite"><strong>' + esc(PST[g]) + '.</strong> ' + esc(PDESC[g]) + extra + '</p>' +
          '<div class="vpanel"><h5>Patient / order queue</h5><p class="vcount">Click a row to inspect details. All names, DOBs, facilities, prescribers, and Rx numbers are fictional.</p>' +
          table(['Patient Name', 'DOB', 'Facility', 'Medication', 'Order Source', 'Billing Type', 'Status'].map(T), body, 'Fictional pharmacy order queue') + '</div>' +
          '<div class="vgrid vgrid--2" style="margin-top:.8rem">' + detail + billBox + '</div>';
      }
    };

    /* 2. Lead research and list building */
    var LR = [
      { co: 'Brightline Freight', ind: 'Logistics', web: 'brightline-freight.example', loc: 'Austin, TX', role: 'Operations Manager', note: 'Regional carrier', ok: 1 },
      { co: 'Cedar & Pine Dental', ind: 'Healthcare', web: 'not found', loc: 'Portland, OR', role: 'Office Manager', note: 'Website could not be verified', ok: 0 },
      { co: 'Harbor Point Insurance', ind: 'Insurance', web: 'harborpoint-ins.example', loc: 'Tampa, FL', role: 'Agency Director', note: 'Independent agency', ok: 1 },
      { co: 'Summit Ridge HVAC', ind: 'Home services', web: 'summitridge-hvac.example', loc: 'Denver, CO', role: 'Owner', note: 'Residential and light commercial', ok: 1 },
      { co: 'Brightline Freight Inc.', ind: 'Logistics', web: 'brightline-freight.example', loc: 'Austin, TX', role: 'Ops Mgr.', note: 'Same company as row 1', ok: 1, dup: 1 },
      { co: 'Kestrel Analytics', ind: 'Software', web: 'kestrel-analytics.example', loc: 'Chicago, IL', role: 'Head of Operations', note: 'Small analytics firm', ok: 1 }
    ];
    var LST = ['Research Queue', 'Business Verification', 'Data Collection', 'Validation', 'Clean Prospect List'];
    var LDESC = [
      'Businesses to research are queued. Nothing is verified yet.',
      'Confirm each business exists and has a working website and location.',
      'Collect the relevant fields: industry, contact role, and notes, and record where each came from.',
      'Check the collected details against the target criteria, and flag duplicates and records that do not qualify.',
      'Only verified, qualified, de-duplicated records remain, with standardized fields. Filter and search the list.'
    ];
    M.leads = {
      init: function () { return { stage: 0, ind: 'All', q: '' }; },
      act: function (s, a, d) { if (a === 'stage') s.stage = +d.i; },
      input: function (s, k, v) { s[k] = v; },
      render: function (s) {
        var g = s.stage, T = function (t) { return '<th scope="col">' + t + '</th>'; };
        var head = '<p class="vphases" style="grid-template-columns:3fr 2fr"><span>Lead Research</span><span>List Building</span></p>' + stages(LST, g) + '<p class="vdesc" aria-live="polite"><strong>' + esc(LST[g]) + '.</strong> ' + esc(LDESC[g]) + '</p>';
        var crit = '<p class="vnote">Target criteria (fictional): U.S.-based businesses in logistics, insurance, home services, or software.</p>';
        var meets = function (r) { return !r.dup && r.ok && r.ind !== 'Healthcare'; };
        if (g === 4) {
          var inds = ['All'];
          LR.forEach(function (r) { if (meets(r) && inds.indexOf(r.ind) < 0) inds.push(r.ind); });
          var list = LR.filter(function (r) { return meets(r) && (s.ind === 'All' || r.ind === s.ind) && (!s.q || (r.co + ' ' + r.loc + ' ' + r.role).toLowerCase().indexOf(s.q.toLowerCase()) >= 0); });
          var rows4 = list.map(function (r) { return '<tr><td>' + esc(r.co) + '</td><td>' + esc(r.ind) + '</td><td>' + esc(r.web) + '</td><td>' + esc(r.loc) + '</td><td>' + esc(r.role) + '</td><td>' + pill('Ready', 'ok') + '</td></tr>'; }).join('') || '<tr><td colspan="6">No prospects match this filter.</td></tr>';
          var ctrl = '<div class="vctrl"><label class="vctrl__label" for="viz-q">Search</label><input class="vfield" id="viz-q" type="text" inputmode="search" autocomplete="off" data-in="q" value="' + esc(s.q) + '" placeholder="Company, city, or role"><label class="vctrl__label" for="viz-ind">Industry</label><select class="vfield" id="viz-ind" data-in="ind">' + inds.map(function (i) { return '<option' + (i === s.ind ? ' selected' : '') + '>' + esc(i) + '</option>'; }).join('') + '</select><span class="vcount">' + list.length + ' prospect' + (list.length === 1 ? '' : 's') + ' shown (fictional)</span></div>';
          return head + ctrl + table(['Company', 'Industry', 'Website', 'Location', 'Contact role', 'Status'].map(T), rows4, 'Clean prospect list (fictional)') + crit;
        }
        var ver = function (r) { return r.ok ? pill('Verified', 'ok') : pill('Not found', 'warn'); };
        var qual = function (r) { return r.dup ? pill('Duplicate', 'warn') : meets(r) ? pill('Meets criteria', 'ok') : pill('Does not qualify', 'warn'); };
        var set = [
          { c: ['Company', 'Research status'], r: function (r) { return [esc(r.co), pill('Queued')]; } },
          { c: ['Company', 'Website', 'Location', 'Verification'], r: function (r) { return [esc(r.co), esc(r.web), esc(r.loc), ver(r)]; } },
          { c: ['Company', 'Industry', 'Contact role', 'Location', 'Notes'], r: function (r) { return [esc(r.co), esc(r.ind), esc(r.role), esc(r.loc), esc(r.note)]; } },
          { c: ['Company', 'Industry', 'Verification', 'Qualification', 'Research status'], r: function (r) { return [esc(r.co), esc(r.ind), ver(r), qual(r), pill('Validated')]; } }
        ][g];
        var body = LR.map(function (r) { var flag = g === 3 && !meets(r); return '<tr' + (flag ? ' class="is-flag"' : '') + '>' + set.r(r).map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; }).join('');
        return head + table(set.c.map(T), body, 'Prospect research table (fictional)') + crit;
      }
    };

    /* 3. School inventory */
    var SI = [
      ['INV-1001', 'Desktop Computer', 'Computers', 'IT', 'Main Building', 18, 'units', 'Computer Lab 1'],
      ['INV-1008', 'LED Monitor', 'Monitors', 'IT', 'Main Building', 18, 'units', 'Computer Lab 1'],
      ['INV-1014', 'Laser Printer', 'Printers', 'Administration', 'Administration Building', 4, 'units', 'Records Office'],
      ['INV-1020', 'Document Scanner', 'Office Equipment', 'Registrar', 'Administration Building', 2, 'units', 'Registrar Counter'],
      ['INV-1026', 'Photocopier', 'Office Equipment', 'Administration', 'Administration Building', 1, 'unit', 'Admin Office'],
      ['INV-1032', 'Student Desk', 'Classroom Equipment', 'Science', 'Science Building', 40, 'units', 'Room 201'],
      ['INV-1038', 'Classroom Chair', 'Classroom Equipment', 'Science', 'Science Building', 40, 'units', 'Room 201'],
      ['INV-1042', 'Epson Projector', 'Projectors', 'Science', 'Science Building', 1, 'unit', 'Room 204'],
      ['INV-1048', 'Microscope Set', 'Laboratory Equipment', 'Science', 'Science Building', 12, 'sets', 'Lab 1'],
      ['INV-1054', 'Lab Cabinet', 'Cabinets', 'Science', 'Science Building', 6, 'units', 'Lab Storage'],
      ['INV-1060', 'Library Desktop', 'Computers', 'Library', 'Library', 8, 'units', 'OPAC Area'],
      ['INV-1066', 'Bookshelf Cabinet', 'Cabinets', 'Library', 'Library', 14, 'units', 'Stacks A'],
      ['INV-1072', 'Reading Chair', 'Classroom Equipment', 'Library', 'Library', 20, 'units', 'Reading Room'],
      ['INV-1078', 'Filing Cabinet', 'Cabinets', 'Registrar', 'Annex', 5, 'units', 'File Room'],
      ['INV-1084', 'Office Printer', 'Printers', 'Registrar', 'Annex', 2, 'units', 'Window 2'],
      ['INV-1090', 'Conference Table', 'Office Equipment', 'Administration', 'Main Building', 1, 'unit', 'Board Room'],
      ['INV-1096', 'Maintenance Toolkit', 'Office Equipment', 'Maintenance', 'Annex', 3, 'kits', 'Shop'],
      ['INV-1102', 'Extension Ladder', 'Office Equipment', 'Maintenance', 'Annex', 2, 'units', 'Shop'],
      ['INV-1108', 'Classroom Projector', 'Projectors', 'IT', 'Main Building', 4, 'units', 'AV Closet'],
      ['INV-1114', 'Teacher Desk', 'Classroom Equipment', 'Administration', 'Main Building', 6, 'units', 'Faculty Room'],
      ['INV-1120', 'Lab Stool', 'Laboratory Equipment', 'Science', 'Science Building', 16, 'units', 'Lab 2'],
      ['INV-1126', 'Network Switch Cabinet', 'Cabinets', 'IT', 'Main Building', 2, 'units', 'Server Closet']
    ].map(function (r) { return { id: r[0], name: r[1], cat: r[2], dept: r[3], bldg: r[4], qty: r[5], unit: r[6], area: r[7] }; });
    function hit(r, q) {
      q = (q || '').toLowerCase();
      return !q || (r.id + ' ' + r.name + ' ' + r.dept + ' ' + r.bldg + ' ' + r.area).toLowerCase().indexOf(q) >= 0;
    }
    M.school = {
      init: function () { return { q: '', dept: 'All', bldg: 'All', pivot: 'dept', sel: 'INV-1042' }; },
      act: function (s, a, d) {
        if (a === 'dept') s.dept = d.v;
        else if (a === 'bldg') s.bldg = d.v;
        else if (a === 'pivot') s.pivot = d.v;
        else if (a === 'select') s.sel = d.id;
      },
      input: function (s, k, v) { s[k] = v; },
      render: function (s) {
        var T = function (t) { return '<th scope="col">' + t + '</th>'; };
        var depts = ['All', 'IT', 'Administration', 'Science', 'Library', 'Registrar', 'Maintenance'];
        var bldgs = ['All', 'Main Building', 'Annex', 'Science Building', 'Administration Building', 'Library'];
        var rows = SI.filter(function (r) { return (s.dept === 'All' || r.dept === s.dept) && (s.bldg === 'All' || r.bldg === s.bldg) && hit(r, s.q); });
        var found = SI.filter(function (r) { return hit(r, s.q); });
        var look = SI.filter(function (r) { return r.id === s.sel; })[0] || found[0] || SI[0];
        if (s.q && found.length === 1) look = found[0];
        var body = rows.map(function (r) {
          return '<tr tabindex="0" data-act="select" data-id="' + r.id + '"' + (r.id === look.id ? ' class="is-sel"' : '') + '><td>' + r.id + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.cat) + '</td><td>' + esc(r.dept) + '</td><td>' + esc(r.bldg) + '</td><td>' + r.qty + '</td><td>' + esc(r.unit) + '</td><td>' + esc(r.area) + '</td></tr>';
        }).join('') || '<tr><td colspan="8">No items match these filters.</td></tr>';
        var key = s.pivot === 'dept' ? 'dept' : s.pivot === 'bldg' ? 'bldg' : 'cat';
        var labels = { dept: 'Department', bldg: 'Building', cat: 'Category' };
        var agg = {}, mx = 1;
        SI.forEach(function (r) { agg[r[key]] = (agg[r[key]] || 0) + 1; if (agg[r[key]] > mx) mx = agg[r[key]]; });
        var pkeys = Object.keys(agg).sort();
        var pbody = pkeys.map(function (k) { return '<tr><td>' + esc(k) + '</td><td style="text-align:right">' + agg[k] + '</td></tr>'; }).join('');
        var bars = '<div class="bars">' + pkeys.map(function (k) { return '<div class="bar"><span>' + esc(k) + '</span><i style="width:' + Math.round(agg[k] / mx * 100) + '%"></i><span>' + agg[k] + '</span></div>'; }).join('') + '</div>';
        return '<p class="viz__badges"><span class="pill">Sample Data</span><span class="pill">Fictionalized Records</span><span class="pill pill--ok">Excel workflow demo</span></p>' +
          '<div class="kpis"><div class="kpi"><strong>' + SI.length + '</strong><span>Demo records</span></div><div class="kpi"><strong>' + rows.length + '</strong><span>Showing now</span></div><div class="kpi"><strong>' + (s.dept === 'All' ? 'All' : s.dept) + '</strong><span>Department filter</span></div><div class="kpi"><strong>' + (s.bldg === 'All' ? 'All' : s.bldg) + '</strong><span>Building filter</span></div></div>' +
          '<p class="vdesc">I used Excel tools to organize, filter, locate, and summarize inventory records, making it easier to identify where specific items belonged and review inventory by department or building.</p>' +
          '<div class="vctrl">' + group('Department', depts, s.dept, 'dept') + '</div>' +
          '<div class="vctrl">' + group('Building', bldgs, s.bldg, 'bldg') + '</div>' +
          '<div class="vctrl"><label class="vctrl__label" for="viz-q">Search Item ID / Item Name</label><input class="vfield" id="viz-q" type="text" inputmode="search" autocomplete="off" data-in="q" value="' + esc(s.q) + '" placeholder="Projector or INV-1042"></div>' +
          '<div class="vpanel"><h5>Inventory register</h5>' + table(['Item ID', 'Item Name', 'Category', 'Department', 'Building', 'Quantity', 'Unit', 'Assigned Area'].map(T), body, 'Fictional school inventory') + '</div>' +
          '<div class="vgrid vgrid--2" style="margin-top:.8rem"><div class="vpanel is-focus"><h5>Item search / lookup result</h5>' +
          row('Item', esc(look.name)) + row('Item ID', look.id) + row('Department', esc(look.dept)) + row('Building', esc(look.bldg)) + row('Assigned Area', esc(look.area)) + row('Quantity', look.qty + ' ' + look.unit) +
          '<p class="vnote">Practical use: find an item, then retrieve its associated department and location. Try \u201cProjector\u201d or \u201cINV-1042\u201d.</p></div>' +
          '<div class="vpanel"><h5>Excel Lookup</h5><p class="vnote">The website is not running Excel. This shows how a lookup retrieved related fields from an item ID.</p>' +
          '<div class="lookup"><span>' + esc(look.id) + '</span><i>\u2192</i><span>' + esc(look.name) + '</span><i>\u2192</i><span>' + esc(look.dept) + '</span><i>\u2192</i><span>' + esc(look.bldg) + '</span><i>\u2192</i><span>' + esc(look.area) + '</span></div>' +
          row('Technique', 'Excel Lookup') + row('Business use', 'Item ID \u2192 name, department, building, assigned area') + '</div></div>' +
          '<div class="vpanel" style="margin-top:.8rem"><h5>Pivot Table-style report (demo data)</h5>' +
          group('Summarize by', [['dept', 'Department'], ['bldg', 'Building'], ['cat', 'Category']], s.pivot, 'pivot') +
          '<p class="vcount">Counts are from this fictional dataset, not real campus totals.</p>' +
          '<div class="vgrid vgrid--2"><div>' + table(['<th scope="col">' + labels[s.pivot] + '</th>', '<th scope="col" style="text-align:right">Item Count</th>'], pbody, 'Demo pivot') + '</div><div class="vpanel">' + bars + '</div></div></div>';
      }
    };

    /* 4. Retail inventory tally + receiving */
    var RP = [
      ['32" QLED TV', 'TCL', '32S5K', 'Television', 6, 6],
      ['43" 4K TV', 'TCL', '43P745', 'Television', 4, 4],
      ['50" 4K TV', 'TCL', '50P635', 'Television', 5, 4],
      ['55" 4K TV', 'TCL', '55P745', 'Television', 5, 5],
      ['65" 4K TV', 'TCL', '65P745', 'Television', 3, 3],
      ['65" QLED TV', 'TCL', '65C635', 'Television', 2, 2],
      ['65" QLED TV', 'TCL', '65C745', 'Television', 2, 1],
      ['43" Crystal UHD TV', 'Samsung', 'UA43DU7000', 'Television', 7, 7],
      ['55" Crystal UHD TV', 'Samsung', 'UA55DU7000', 'Television', 4, 4],
      ['50" 4K TV', 'Hisense', '50A6N', 'Television', 6, 6],
      ['55" UHD TV', 'Devant', '55UHD206', 'Television', 8, 7],
      ['55" 4K TV', 'Sharp', '4T-C55HJ6000X', 'Television', 3, 3],
      ['32" Google TV', 'Sharp', '2T-C32GH3000X', 'Television', 5, 5],
      ['43" Google TV', 'Sharp', '2T-C43GH3000X', 'Television', 4, 4],
      ['10 cu. ft. Bottom-Mount Ref', 'Fujidenzo', 'IBT-10MD', 'Refrigerator', 3, 3],
      ['3.0 cu. ft. Bar Fridge', 'Fujidenzo', 'IRB-30MKS', 'Refrigerator', 9, 9],
      ['3.5 cu. ft. Two-Door Ref', 'Fujidenzo', 'IRD-35G', 'Refrigerator', 7, 6],
      ['7.0 cu. ft. Chest Freezer', 'Fujidenzo', 'IFC-70 GDF', 'Freezer', 4, 4],
      ['5.0 cu. ft. Chest Freezer', 'Fujidenzo', 'IFC-50 GDF', 'Freezer', 5, 5],
      ['9.0 cu. ft. Chest Freezer', 'Fujidenzo', 'IFC-90 GDF', 'Freezer', 2, 2],
      ['11.0 cu. ft. Chest Freezer', 'Fujidenzo', 'IFC-110 GDF', 'Freezer', 2, 3],
      ['14.0 cu. ft. Chest Freezer', 'Fujidenzo', 'IFC-140 GDF', 'Freezer', 1, 1],
      ['1.7 cu. ft. Chest Freezer', 'Fujidenzo', 'IFC-17 GDF', 'Freezer', 6, 6],
      ['2.0 cu. ft. Chest Freezer', 'Fujidenzo', 'IFC-20 GDF', 'Freezer', 4, 4],
      ['2.6 cu. ft. Chest Freezer', 'Fujidenzo', 'IFC-26 GDF', 'Freezer', 3, 3],
      ['1.0 HP Window Inverter AC', 'Fujidenzo', 'IWAR-107T', 'Air Conditioner', 8, 8],
      ['1.5 HP Window Inverter AC', 'Fujidenzo', 'IWAR-157T', 'Air Conditioner', 6, 5],
      ['2.0 HP Window Inverter AC', 'Fujidenzo', 'IWAR-200GC', 'Air Conditioner', 4, 4],
      ['1.0 HP Split Inverter AC (indoor)', 'Fujidenzo', 'HIS-103AG', 'Air Conditioner', 5, 5],
      ['1.5 HP Split Inverter AC (indoor)', 'Fujidenzo', 'HIS-153AG', 'Air Conditioner', 3, 3],
      ['Split AC indoor unit', 'Sharp', 'AH-XP10YHF', 'Air Conditioner', 2, 2],
      ['Split AC outdoor unit', 'Sharp', 'AU-X10YHF', 'Air Conditioner', 2, 1],
      ['9.2 kg Twin Tub Washer', 'Fujidenzo', 'JWT-902', 'Washing Machine', 7, 7],
      ['12.2 kg Twin Tub Washer', 'Fujidenzo', 'JWT-1202SS', 'Washing Machine', 4, 4],
      ['14 kg Twin Tub Washer', 'Fujidenzo', 'JWT-1400', 'Washing Machine', 3, 2],
      ['10.5 kg Inverter FA Washer', 'Fujidenzo', 'IJWA 1050 VT', 'Washing Machine', 2, 2],
      ['8.8 kg Inverter FA Washer', 'Fujidenzo', 'IJWA8800 VT', 'Washing Machine', 3, 3],
      ['8.5 kg FA Washer', 'Fujidenzo', 'JWA 8500 VT', 'Washing Machine', 5, 5],
      ['28 L Inverter Microwave', 'Fujidenzo', 'IME-28 BL', 'Microwave Oven', 6, 6],
      ['20 L Microwave', 'Fujidenzo', 'IMM-22 BL', 'Microwave Oven', 8, 8],
      ['20 L Digital Microwave', 'Fujidenzo', 'ME-20 SL', 'Microwave Oven', 5, 4],
      ['20 L Microwave', 'Fujidenzo', 'MM 22 BL', 'Microwave Oven', 7, 7],
      ['28 L Mechanical Microwave', 'Fujidenzo', 'MM 30 BL', 'Microwave Oven', 4, 4],
      ['25 L Solo Microwave', 'Panasonic', 'NN-ST34HM', 'Microwave Oven', 3, 3],
      ['43" 4K TV', 'Hisense', '43A6N', 'Television', 5, 5],
      ['65" 4K TV', 'Hisense', '65A6N', 'Television', 2, 2],
      ['65" UHD TV', 'Devant', '65UHD206', 'Television', 3, 3],
      ['43" UHD TV', 'Devant', '43UHD206', 'Television', 6, 6],
      ['32" Smart TV', 'Devant', '32STV105', 'Television', 9, 9],
      ['43" Smart TV', 'Devant', '43STV105', 'Television', 4, 4],
      ['160W Karaoke system', 'Sharp', 'CS-1610P-BR', 'Audio', 3, 3],
      ['80W Karaoke system', 'Sharp', 'CS-0810P-BR', 'Audio', 4, 4],
      ['120W Karaoke system', 'Sharp', 'CS-1210P-BR', 'Audio', 2, 2],
      ['60W Karaoke system', 'Sharp', 'CS-0610P-BR', 'Audio', 5, 6]
    ].map(function (r, i) { return { id: 'SKU-' + (2001 + i), name: r[0], brand: r[1], model: r[2], cat: r[3], sys: r[4], phys: r[5] }; });
    var RST = ['Printed System List', 'Physical Store Count', 'Manual Tally', 'Compare', 'Reconcile Variance'];
    var RDESC = [
      'Start from the system-generated item list \u2014 the same list that would be printed for a store count.',
      'Walk the floor and enter the physical count for each item. Quantities here are fictional demo values.',
      'Difference = Physical Count \u2212 System Quantity. Zero is a match. Any other value needs follow-up.',
      'Compare every line. MATCHED vs REQUIRES RECONCILIATION is the point of the tally \u2014 not generic stock status.',
      'Variance lines are reconciled so physical stock and system records stay aligned.'
    ];
    var RCV = [
      { brand: 'TCL', model: '55P745', cat: 'Television', kind: 'TV 55"', prev: 5, rec: 2 },
      { brand: 'TCL', model: '32S5K', cat: 'Television', kind: 'TV 32"', prev: 6, rec: 1 },
      { brand: 'Samsung', model: 'UA55DU7000', cat: 'Television', kind: 'TV 55"', prev: 4, rec: 2 },
      { brand: 'Hisense', model: '50A6N', cat: 'Television', kind: 'TV 50"', prev: 6, rec: 3 },
      { brand: 'Devant', model: '55UHD206', cat: 'Television', kind: 'TV 55"', prev: 8, rec: 2 },
      { brand: 'Fujidenzo', model: 'IWAR-157T', cat: 'Air Conditioner', kind: 'Window Type \u00B7 Inverter \u00B7 1.5 HP', prev: 6, rec: 1 },
      { brand: 'Fujidenzo', model: 'HIS-153AG', cat: 'Air Conditioner', kind: 'Split Type \u00B7 Inverter indoor unit', prev: 3, rec: 1, note: 'Split-type systems involve an indoor unit and an outdoor unit.' },
      { brand: 'Sharp', model: 'AH-XP10YHF / AU-X10YHF', cat: 'Air Conditioner', kind: 'Split Type \u00B7 Inverter \u00B7 Indoor + Outdoor', prev: 2, rec: 2, note: 'Indoor AH-XP10YHF and outdoor AU-X10YHF counted as one system (two pieces in this fictional delivery).' }
    ];
    var RST2 = ['Delivery Received', 'Scan Barcode', 'Verify Item / Model', 'Enter or Confirm Item in System', 'Inventory Quantity Updated', 'Item Added to Branch Inventory'];
    M.retail = {
      init: function () { return { stage: 0, q: '', cat: 'All', data: RP.map(function (r) { return Object.assign({}, r); }), rcv: 0, rstep: 0, scanning: 0 }; },
      act: function (s, a, d) {
        if (a === 'stage') s.stage = +d.i;
        else if (a === 'cat') s.cat = d.v;
        else if (a === 'rcv') { s.rcv = +d.i; s.rstep = 0; s.scanning = 0; }
        else if (a === 'rstep') s.rstep = +d.i;
        else if (a === 'scan') { s.scanning = 1; s.rstep = 1; }
      },
      input: function (s, k, v, ds) {
        if (k === 'q') s.q = v;
        else if (k === 'cat') s.cat = v;
        else if (k === 'phys' && ds && ds.id) {
          var row = s.data.filter(function (r) { return r.id === ds.id; })[0];
          if (row) { row.phys = Math.max(0, +v || 0); s.stage = 2; }
        }
      },
      render: function (s) {
        var T = function (t) { return '<th scope="col">' + t + '</th>'; };
        var cats = ['All']; s.data.forEach(function (r) { if (cats.indexOf(r.cat) < 0) cats.push(r.cat); });
        var rows = s.data.filter(function (r) { return (s.cat === 'All' || r.cat === s.cat) && (!s.q || (r.name + ' ' + r.brand + ' ' + r.model + ' ' + r.id).toLowerCase().indexOf(s.q.toLowerCase()) >= 0); });
        var mis = 0, body = '', sheet = '';
        rows.forEach(function (r) {
          var diff = r.phys - r.sys, bad = diff !== 0; if (bad) mis++;
          var st = bad ? pill('REQUIRES RECONCILIATION', 'warn') : pill('MATCHED', 'ok');
          body += '<tr' + (bad ? ' class="is-flag"' : '') + '><td>' + esc(r.name) + '</td><td>' + esc(r.brand) + '</td><td>' + esc(r.model) + '</td><td>' + r.sys + '</td><td><input class="vfield vqty" id="phys-' + r.id + '" type="number" min="0" data-in="phys" data-id="' + r.id + '" value="' + r.phys + '" aria-label="Physical count for ' + esc(r.model) + '"></td><td>' + (diff > 0 ? '+' : '') + diff + '</td><td>' + st + '</td></tr>';
        });
        s.data.slice(0, 8).forEach(function (r) {
          sheet += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.brand) + '</td><td>' + esc(r.model) + '</td><td>' + r.sys + '</td><td>' + r.phys + '</td><td>' + (r.phys - r.sys) + '</td></tr>';
        });
        var rec = RCV[s.rcv], nxt = rec.prev + rec.rec;
        var rpanel = stages(RST2, s.rstep) +
          '<div class="vctrl">' + RCV.map(function (r, i) { return '<button type="button" class="vbtn' + (i === s.rcv ? ' is-on' : '') + '" data-act="rcv" data-i="' + i + '">' + esc(r.brand + ' ' + r.model) + '</button>'; }).join('') + '</div>' +
          (s.rstep === 1 && s.scanning ? '<div class="scan" aria-live="polite">Scanning barcode\u2026</div>' : '<button type="button" class="vbtn" data-act="scan">Scan Barcode</button>') +
          (s.rstep >= 1 ? '<div class="vpanel" style="margin-top:.7rem"><h5>Barcode recognized (demo)</h5>' + row('Brand', esc(rec.brand)) + row('Model', esc(rec.model)) + row('Category', esc(rec.cat)) + row('Type', esc(rec.kind)) + row('Quantity Received', String(rec.rec)) + (rec.note ? '<p class="vnote">' + esc(rec.note) + '</p>' : '') + '</div>' : '') +
          (s.rstep >= 4 ? '<div class="vpanel is-focus" style="margin-top:.7rem"><h5>Inventory updated</h5>' + row('Previous Quantity', String(rec.prev)) + row('Received', '+' + rec.rec) + row('New System Quantity', String(nxt)) + '<p class="vnote">All quantities are fictional demonstration data.</p></div>' : '') +
          '<div class="vctrl" style="margin-top:.7rem"><button type="button" class="vbtn" data-act="rstep" data-i="' + Math.min(s.rstep + 1, 5) + '">Next receiving step</button></div>';
        return '<p class="viz__badges"><span class="pill">Portfolio Demonstration</span><span class="pill">Sample Data</span><span class="pill">Catalog models \u00B7 fictional quantities</span></p>' +
          '<div class="kpis"><div class="kpi"><strong>' + s.data.length + '</strong><span>Demo SKUs</span></div><div class="kpi"><strong>' + (s.data.length - s.data.filter(function (r) { return r.phys !== r.sys; }).length) + '</strong><span>Matched</span></div><div class="kpi"><strong>' + s.data.filter(function (r) { return r.phys !== r.sys; }).length + '</strong><span>Requires reconciliation</span></div><div class="kpi"><strong>' + rows.length + '</strong><span>Rows shown</span></div></div>' +
          '<div class="sheet"><h5>SYSTEM-GENERATED INVENTORY LIST</h5><p class="vnote">Printed system list excerpt (fictional counts). This is the starting document for a physical tally \u2014 not a live catalog screenshot.</p>' +
          '<p class="sheet__flow"><span>Printed System List</span><i>\u2192</i><span>Physical Store Count</span><i>\u2192</i><span>Manual Tally</span><i>\u2192</i><span>Compare</span><i>\u2192</i><span>Reconcile Variance</span></p>' +
          table(['Item', 'Brand', 'Model', 'System Qty', 'Physical Count', 'Tally'].map(T), sheet, 'Printed system list excerpt') + '</div>' +
          stages(RST, s.stage) + '<p class="vdesc" aria-live="polite"><strong>' + esc(RST[s.stage]) + '.</strong> ' + esc(RDESC[s.stage]) + '</p>' +
          '<div class="vctrl"><label class="vctrl__label" for="viz-q">Search</label><input class="vfield" id="viz-q" type="text" inputmode="search" autocomplete="off" data-in="q" value="' + esc(s.q) + '" placeholder="Brand, model, or item"><label class="vctrl__label" for="viz-cat">Category</label><select class="vfield" id="viz-cat" data-in="cat">' + cats.map(function (c) { return '<option' + (c === s.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
          '<p class="vcount">' + mis + ' line' + (mis === 1 ? '' : 's') + ' in this view require reconciliation. Change a Physical Count to see Difference = Physical Count \u2212 System Quantity.</p>' +
          table(['Item', 'Brand', 'Model Number', 'System Quantity', 'Physical Count', 'Tally Difference', 'Status'].map(T), body || '<tr><td colspan="7">No items match.</td></tr>', 'Physical inventory tally (fictional)') +
          '<div class="vpanel" style="margin-top:1rem"><h5>Air conditioner / TV receiving</h5><p class="vnote">I also received direct deliveries from brands such as Sharp, TCL, Samsung, Hisense, and Devant \u2014 TVs in 32", 43", 50", 55", and 65", and air conditioners (inverter window and split type). Skill shown: Physical Stock \u2194 System Records.</p>' + rpanel + '</div>';
      }
    };

    /* 5. Data accuracy: source fields map to the same register fields */
    var AST = ['Collect', 'Enter', 'Validate', 'Organize', 'Maintain'];
    var ADESC = [
      'Incoming source rows as they arrive: mixed dates, extra spaces, a duplicate ID, a blank name, and a quantity in the wrong format.',
      'Each source column is mapped to the matching system field. Nothing is dropped. Values that do not belong in a field are flagged, not silently moved.',
      'Validation checks required fields, numeric quantity, date format, and duplicate Record IDs.',
      'Cleaned records are standardized. Unresolved rows stay flagged for review instead of being guessed.',
      'Select a row and update it. Saving writes back to the same record \u2014 the table and the form stay in sync.'
    ];
    var AFIELDS = [
      ['srcId', 'id', 'Record ID'],
      ['srcName', 'name', 'Record Name'],
      ['srcCat', 'cat', 'Category'],
      ['srcQty', 'qty', 'Quantity'],
      ['srcDate', 'date', 'Date Recorded'],
      ['srcDept', 'dept', 'Department']
    ];
    function aSeed() {
      return [
        { key: 'a1', id: 'REC-101', name: 'Desktop Computer', cat: 'IT Equipment', qty: '12', date: '2026-03-04', dept: 'IT', srcId: 'rec-101 ', srcName: 'desktop computer', srcCat: 'it equipment', srcQty: '12', srcDate: '03/04/26', srcDept: 'IT' },
        { key: 'a2', id: 'REC-101', name: 'Desktop Computer', cat: 'IT Equipment', qty: '12', date: '2026-03-04', dept: 'IT', srcId: 'REC-101', srcName: 'Desktop Computer', srcCat: 'IT Equipment', srcQty: '12', srcDate: '2026-03-04', srcDept: 'IT', dup: 1 },
        { key: 'a3', id: 'REC-118', name: 'Epson Projector', cat: 'Classroom Equipment', qty: '3', date: '2026-03-04', dept: 'Science', srcId: 'REC-118', srcName: 'epson proj.', srcCat: 'classrm eqp', srcQty: 'three', srcDate: '4 Mar 2026', srcDept: 'Science' },
        { key: 'a4', id: 'REC-124', name: '', cat: 'Office Equipment', qty: '7', date: '2026-03-05', dept: 'Registrar', srcId: 'REC-124', srcName: '', srcCat: 'Office Equipment', srcQty: '7', srcDate: '2026-03-05', srcDept: 'Registrar' },
        { key: 'a5', id: 'REC-130', name: 'Filing Cabinet', cat: 'Office Equipment', qty: '5', date: '2026-03-06', dept: 'Administration', srcId: 'REC-130', srcName: 'Filing Cabinet', srcCat: 'Desk equipment', srcQty: '5', srcDate: '03-06-2026', srcDept: 'Admin' },
        { key: 'a6', id: 'REC-142', name: 'Lab Stool', cat: 'Laboratory Equipment', qty: '-2', date: '2026-03-06', dept: 'Science', srcId: 'REC-142', srcName: 'lab stool', srcCat: 'lab equipment', srcQty: '-2', srcDate: '2026/03/06', srcDept: 'Science' }
      ];
    }
    function aIssues(r) {
      var o = [];
      if (!String(r.id).trim()) o.push('Missing Record ID');
      if (!String(r.name).trim()) o.push('Missing Record Name');
      if (r.qty === '' || isNaN(+r.qty) || +r.qty < 0 || String(r.qty).match(/[^0-9.\-]/)) o.push('Invalid Quantity');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) o.push('Date not YYYY-MM-DD');
      if (!String(r.cat).trim()) o.push('Missing Category');
      if (!String(r.dept).trim()) o.push('Missing Department');
      return o;
    }
    M.accuracy = {
      init: function () { return { stage: 0, sel: 'a3', rows: aSeed() }; },
      act: function (s, a, d) {
        if (a === 'stage') s.stage = +d.i;
        else if (a === 'select') s.sel = d.id;
        else if (a === 'save') s.stage = 4;
      },
      input: function (s, k, v) {
        var cur = s.rows.filter(function (r) { return r.key === s.sel; })[0];
        if (!cur || AFIELDS.every(function (f) { return f[1] !== k; })) return;
        cur[k] = v;
        s.stage = 4;
      },
      render: function (s) {
        var g = s.stage, T = function (t) { return '<th scope="col">' + t + '</th>'; };
        var live = s.rows.filter(function (r) { return g < 3 || !r.dup; });
        var ids = {};
        live.forEach(function (r) { ids[r.id] = (ids[r.id] || 0) + 1; });
        var cur = live.filter(function (r) { return r.key === s.sel; })[0] || live[0];
        var map = AFIELDS.map(function (f) {
          return row(f[2], esc((g === 0 ? cur[f[0]] : cur[f[1]]) || '(blank)') + ' ' + pill(f[0].replace('src', 'source \u2192 ') + f[1], g === 0 ? '' : 'ok'));
        }).join('');
        var cols = ['Record ID', 'Record Name', 'Category', 'Quantity', 'Date Recorded', 'Department'].concat(g >= 2 ? ['Check'] : []).map(T);
        var body = live.map(function (r) {
          var iss = aIssues(r).concat(r.dup || ids[r.id] > 1 ? ['Duplicate Record ID'] : []);
          var vals = g === 0 ? [r.srcId, r.srcName, r.srcCat, r.srcQty, r.srcDate, r.srcDept] : [r.id, r.name, r.cat, r.qty, r.date, r.dept];
          var cells = vals.map(function (v, i) {
            var bad = g === 0 ? (String(v).trim() !== String([r.id, r.name, r.cat, r.qty, r.date, r.dept][i]).trim() || !String(v).trim()) : (g >= 2 && ((i === 1 && !r.name) || (i === 3 && (+r.qty < 0 || isNaN(+r.qty))) || (i === 4 && !/^\d{4}-\d{2}-\d{2}$/.test(r.date))));
            return '<td' + (bad ? ' class="bad"' : (g >= 3 && !bad ? ' class="fixed"' : '')) + '>' + (v === '' ? '(blank)' : esc(v)) + '</td>';
          }).join('');
          var extra = g >= 2 ? '<td>' + (iss.length ? pill(iss[0], 'warn') : pill('Valid', 'ok')) + '</td>' : '';
          return '<tr tabindex="0" data-act="select" data-id="' + r.key + '"' + (r.key === cur.key ? ' class="is-sel' + (r.dup ? ' is-dup' : '') + '"' : (r.dup ? ' class="is-dup"' : '')) + '>' + cells + extra + '</tr>';
        }).join('');
        var flagged = live.filter(function (r) { return aIssues(r).length || r.dup || ids[r.id] > 1; }).length;
        var form = '<div class="vpanel is-focus"><h5>Maintain selected record</h5><p class="vnote">Saving writes to the same fields shown in the table. No field is discarded.</p><div class="vform">' +
          AFIELDS.map(function (f) {
            return '<label for="af-' + f[1] + '">' + f[2] + '<input class="vfield" id="af-' + f[1] + '" data-in="' + f[1] + '" value="' + esc(cur[f[1]]) + '"></label>';
          }).join('') +
          '<button type="button" class="vbtn is-on" data-act="save">Save to register</button></div>' +
          row('Validation', aIssues(cur).length ? pill(aIssues(cur).join(' \u00B7 '), 'warn') : pill('Fields mapped and complete', 'ok')) + '</div>';
        return '<p class="viz__badges"><span class="pill">Sample Data</span><span class="pill">Fictionalized Records</span><span class="pill pill--ok">Source field \u2192 system field</span></p>' +
          '<div class="kpis"><div class="kpi"><strong>' + live.length + '</strong><span>Rows in view</span></div><div class="kpi"><strong>' + AFIELDS.length + '</strong><span>Mapped fields</span></div><div class="kpi"><strong>' + flagged + '</strong><span>Need review</span></div><div class="kpi"><strong>' + live.filter(function (r) { return !aIssues(r).length && !r.dup && ids[r.id] === 1; }).length + '</strong><span>Valid</span></div></div>' +
          stages(AST, g) + '<p class="vdesc" aria-live="polite"><strong>' + esc(AST[g]) + '.</strong> ' + esc(ADESC[g]) + '</p>' +
          '<div class="vgrid vgrid--2"><div class="vpanel"><h5>Field map</h5>' + AFIELDS.map(function (f) { return row(f[0].replace('src', 'Source: ').replace('Id', 'Record ID').replace('Name', 'Record Name').replace('Cat', 'Category').replace('Qty', 'Quantity').replace('Date', 'Date').replace('Dept', 'Department'), 'System: ' + f[2]); }).join('') + '<p class="vnote">The same six fields are collected, entered, validated, and maintained. Quantity never overwrites Date. Name never overwrites ID.</p></div>' +
          (g === 4 ? form : '<div class="vpanel"><h5>Selected record</h5>' + map + '</div>') + '</div>' +
          '<div class="vpanel" style="margin-top:.8rem"><h5>' + (g === 0 ? 'Incoming source list' : 'Operational register') + '</h5>' +
          table(cols, body, 'Record management demo') + '</div>';
      }
    };

    function mount(el, key) {
      var m = M[key], st = m.init(), body = el.querySelector('.viz__body');
      function render() {
        var ae = document.activeElement, id = (ae && ae.id && el.contains(ae)) ? ae.id : null, pos = ae && ae.selectionStart, selId = (ae && ae.dataset && ae.dataset.id && el.contains(ae)) ? ae.dataset.id : null;
        body.innerHTML = m.render(st);
        if (id) { var n = el.querySelector('#' + id); if (n) { n.focus(); if (pos != null && n.setSelectionRange) { try { n.setSelectionRange(pos, pos); } catch (e) {} } } }
        else if (selId) { var r = el.querySelector('[data-id="' + selId + '"]'); if (r) r.focus(); }
      }
      el.addEventListener('click', function (e) {
        if (e.target.closest('input, select, textarea')) return;
        var t = e.target.closest('[data-act]'); if (!t || !el.contains(t)) return;
        m.act(st, t.dataset.act, t.dataset); render();
      });
      el.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-act]')) { e.preventDefault(); e.target.click(); } });
      function onField(e) { var t = e.target.closest('[data-in]'); if (!t || !m.input) return; m.input(st, t.dataset.in, t.value, t.dataset); render(); }
      el.addEventListener('input', onField);
      el.addEventListener('change', onField);
      render();
    }
    return { mount: mount };
  })();

  /* ---- Case studies: cards and modal ---- */
  (function cases() {
    var d = $('#case-modal'), title = $('#case-title'), cat = $('#case-cat'), body = $('#case-body');
    Dialogs.wire(d);
    var TAG = { exp: '<span class="tagk tagk--exp">Actual experience</span>', cap: '<span class="tagk tagk--cap">Capability I\u2019m developing</span>', demo: '<span class="tagk tagk--demo">Visual demonstration</span>' };
    function block(h, inner, kind) { return '<section class="mblock"><h4>' + h + (kind ? TAG[kind] : '') + '</h4>' + inner + '</section>'; }
    function chips(a) { return '<ul class="chips">' + a.map(function (x) { return '<li class="chip">' + x + '</li>'; }).join('') + '</ul>'; }
    function open(id, trigger) {
      var c = CASES[id]; if (!c) return;
      var card = $('[data-case="' + id + '"]');
      title.textContent = $('h3', card).textContent; cat.textContent = c.cat;
      body.innerHTML =
        (c.defs ? '<div class="defs">' + c.defs.map(function (x) { return '<div><strong>' + x[0] + '</strong><p>' + x[1] + '</p></div>'; }).join('') + '</div>' : '') +
        block('Challenge', '<p>' + c.challenge + '</p>', c.kind) +
        block('Process', '<ol class="psteps">' + c.process.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ol>', c.kind) +
        block('Tools / Systems', chips(c.tools), c.kind) +
        (c.signal ? block('Hiring signal', '<p>' + c.signal + '</p>', c.kind) : '') +
        block('Visual workflow', '<div class="viz" data-viz="' + c.viz + '"><p class="viz__label"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg>' + c.label + '</p><div class="viz__body"></div></div>', 'demo') +
        block('Outcome / Value', '<p>' + c.outcome + '</p>', c.kind) +
        (c.note ? '<p class="mnote"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg><span>' + c.note + '</span></p>' : '');
      VIZ.mount($('.viz', body), c.viz);
      $('.modal__panel', d).scrollTop = 0;
      Dialogs.open(d, trigger);
      if (window.__track) window.__track('case_study_view', { label: id });
    }
    $$('[data-case]').forEach(function (card) {
      var btn = $('[data-open]', card);
      btn.addEventListener('click', function (e) { e.stopPropagation(); open(card.dataset.case, btn); });
      card.addEventListener('click', function () { open(card.dataset.case, btn); });
    });
  })();

  /* ---- Resume modal ---- */
  (function resume() {
    var d = $('#resume-modal'), dl = $('#resume-dl'), status = $('#dl-status');
    var busy = false;
    Dialogs.wire(d);
    function open(trigger) { $('.rbody', d).scrollTop = 0; Dialogs.open(d, trigger); }
    $$('[data-resume]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); open(b); }); });

    function pdfBlob() {
      var b64 = $('#resume-pdf').textContent.replace(/\s+/g, '');
      var bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: 'application/pdf' });
    }
    function browserDownload(href, revoke) {
      var a = document.createElement('a');
      a.href = href; a.download = RESUME_NAME; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      if (revoke) setTimeout(function () { URL.revokeObjectURL(href); }, 5000);
    }
    /* Inside the claude.ai viewer, downloads go through the platform's save prompt.
       Anywhere else (a saved copy, your own host), it is a normal browser download. */
    dl.addEventListener('click', function () {
      if (busy) return; busy = true;
      var label = $('span', dl), original = label.textContent;
      function finish(msg) { status.textContent = msg; label.textContent = original; busy = false; }
      label.textContent = 'Preparing\u2026';
      if (window.__track) window.__track('resume_download', {});
      if (RESUME_URL) { browserDownload(RESUME_URL, false); finish('Download started.'); return; }
      var blob = pdfBlob();
      var viewer = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads') : Promise.resolve(null);
      viewer.then(function (downloads) {
        if (downloads) {
          return downloads.save({ filename: RESUME_NAME, data: blob }).then(function () { finish('Resume saved.'); },
            function (err) { if (err && err.code === 'declined') { finish(''); return; } browserDownload(URL.createObjectURL(blob), true); finish('Download started.'); });
        }
        browserDownload(URL.createObjectURL(blob), true); finish('Download started.');
      }).catch(function () { browserDownload(URL.createObjectURL(blob), true); finish('Download started.'); });
    });
  })();

  /* ---- Analytics-ready event tracking ----
     No third-party script is loaded by default. If the page owner wires up
     Google Analytics / GTM later, this pushes a standard event to dataLayer;
     until then it's a harmless no-op so nothing here calls out to a network. */
  function track(name, detail) {
    try {
      if (window.dataLayer && typeof window.dataLayer.push === 'function') {
        window.dataLayer.push(Object.assign({ event: name }, detail || {}));
      }
    } catch (e) { /* analytics should never break the page */ }
  }
  window.__track = track;

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (!el) return;
    track(el.getAttribute('data-track'), { label: el.getAttribute('data-track-label') || '' });
  });

  /* ---- Contact / inquiry form ----
     Client-side validation + a hidden honeypot field for basic spam filtering.
     No API keys or secrets live here. To actually receive submissions, point
     FORM_ENDPOINT at a form backend (e.g. Formspree, Getform, your own API) --
     until it's set, the form validates and shows a clear message explaining
     that sending isn't wired up yet, instead of silently failing. */
  (function contactForm() {
    var form = $('#inquiry-form');
    if (!form) return;
    var FORM_ENDPOINT = ''; // e.g. 'https://formspree.io/f/your-id'
    var status = $('#form-status');
    var submitBtn = $('#inquiry-submit');

    var fields = [
      { id: 'f-name', err: 'err-name', validate: function (v) { return v.trim().length > 0; }, msg: 'Please enter your name.' },
      { id: 'f-email', err: 'err-email', validate: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }, msg: 'Please enter a valid email address.' },
      { id: 'f-message', err: 'err-message', validate: function (v) { return v.trim().length > 0; }, msg: 'Please add a few details about the project.' }
    ];

    function validateField(f) {
      var input = document.getElementById(f.id);
      var errEl = document.getElementById(f.err);
      var ok = f.validate(input.value);
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (errEl) errEl.textContent = ok ? '' : f.msg;
      return ok;
    }

    fields.forEach(function (f) {
      var input = document.getElementById(f.id);
      input.addEventListener('blur', function () { validateField(f); });
      input.addEventListener('input', function () { if (input.getAttribute('aria-invalid') === 'true') validateField(f); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn.disabled) return;

      // Honeypot: real visitors never fill this hidden field.
      var honeypot = document.getElementById('f-company');
      if (honeypot && honeypot.value.trim() !== '') { return; }

      var allValid = fields.map(validateField).every(Boolean);
      if (!allValid) {
        status.dataset.state = 'error';
        status.textContent = 'Please fix the highlighted fields and try again.';
        return;
      }

      var data = {
        name: $('#f-name').value.trim(),
        email: $('#f-email').value.trim(),
        inquiry_type: $('#f-type').value,
        message: $('#f-message').value.trim()
      };

      submitBtn.disabled = true;
      var label = $('span', submitBtn);
      var originalLabel = label ? label.textContent : '';
      if (label) label.textContent = 'Sending\u2026';

      function done(state, msg) {
        status.dataset.state = state;
        status.textContent = msg;
        submitBtn.disabled = false;
        if (label) label.textContent = originalLabel;
      }

      if (!FORM_ENDPOINT) {
        // No backend configured yet -- don't pretend it sent. Fall back to a
        // pre-filled email so the inquiry still reaches me, and say so plainly.
        var subject = encodeURIComponent('Work inquiry: ' + (data.inquiry_type || 'General'));
        var body = encodeURIComponent(data.message + '\n\n— ' + data.name + ' (' + data.email + ')');
        setTimeout(function () {
          done('success', 'This form isn\u2019t connected to a backend yet, so I\u2019ve opened an email instead \u2014 just hit send.');
          track('contact_submit', { method: 'mailto_fallback' });
          window.location.href = 'mailto:angelo.bosito.ops@gmail.com?subject=' + subject + '&body=' + body;
          form.reset();
        }, 300);
        return;
      }

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        done('success', 'Thanks \u2014 your inquiry is in. I\u2019ll reply within one to two business days.');
        track('contact_submit', { method: 'endpoint' });
        form.reset();
      }).catch(function () {
        done('error', 'Something went wrong sending that. Please try again, or email me directly.');
      });
    });
  })();
})();
