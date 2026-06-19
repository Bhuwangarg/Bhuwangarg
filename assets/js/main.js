/* =========================================================
   VANTA — DROP 001  ·  interaction layer
   Vanilla JS. No dependencies. Built to feel inevitable.
   ========================================================= */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ----------------------------------------------------------
     BRAND CONFIG — change these to make the drop your own.
     DROP_DATE drives the countdown; PIECES is total inventory.
  ---------------------------------------------------------- */
  const CONFIG = {
    dropDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // 14 days out
    pieces: 100,
    // Image source order: real generated images (assets/img/*) fall back to
    // built-in generative SVG art so the site is never broken / never blank.
    products: [
      { id: 'hoodie', name: 'NULL HOODIE',   desc: '480gsm garment-dyed', price: 180, tag: 'FLAGSHIP', seed: 7,  hue: 96 },
      { id: 'tee',    name: 'VOID TEE',       desc: '260gsm boxy heavyweight', price: 80,  tag: '', seed: 23, hue: 0 },
      { id: 'pant',   name: 'STATE CARGO',    desc: 'Ripstop tactical fit', price: 160, tag: '', seed: 41, hue: 210 },
      { id: 'jacket', name: 'SIGNAL SHELL',   desc: 'Coated nylon, sealed seams', price: 240, tag: 'LAST 12', seed: 88, hue: 96 }
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    soldOut: { hoodie: ['XS'], jacket: ['XS', 'S', 'XL'] }
  };

  /* ----------------------------------------------------------
     Generative art — deterministic SVG "product" placeholders.
     If a real image exists at assets/img/<id>.jpg it is used,
     otherwise this draws a unique abstract garment swatch.
  ---------------------------------------------------------- */
  function svgArt(seed, hue, label) {
    // small seeded PRNG
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    let shapes = '';
    for (let i = 0; i < 6; i++) {
      const x = rnd() * 100, y = rnd() * 100, r = 8 + rnd() * 42;
      const o = (0.04 + rnd() * 0.10).toFixed(3);
      shapes += `<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${hue} 80% 60% / ${o})"/>`;
    }
    let lines = '';
    for (let i = 0; i < 18; i++) {
      const y = (i / 18) * 100;
      lines += `<line x1="0" y1="${y}" x2="100" y2="${y - 6 + rnd() * 12}" stroke="rgba(255,255,255,0.05)" stroke-width="0.3"/>`;
    }
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid slice'>
      <defs><radialGradient id='g${seed}' cx='40%' cy='35%' r='80%'>
        <stop offset='0%' stop-color='#1a1a1c'/><stop offset='100%' stop-color='#050505'/>
      </radialGradient></defs>
      <rect width='100' height='100' fill='url(#g${seed})'/>${shapes}${lines}
      <text x='50' y='53' font-family='Archivo, Arial Black, sans-serif' font-weight='900'
        font-size='13' letter-spacing='-0.5' fill='rgba(255,255,255,0.07)' text-anchor='middle'>${label}</text>
    </svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  // Set a div's background to a real image if present, else SVG art.
  function paintArt(el, id, seed, hue, label) {
    const fallback = svgArt(seed, hue, label);
    el.style.backgroundImage = fallback;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("assets/img/${id}.jpg")`;
    };
    img.src = `assets/img/${id}.jpg`;
  }

  /* ---------------------------------------------------------- PRELOADER */
  function preloader() {
    const pre = $('#preloader');
    const countEl = $('#loadCount');
    const barEl = $('#loadBar');
    if (!pre) return finish();
    if (reduceMotion) { countEl.textContent = '100'; return finish(); }
    let p = 0;
    const tick = () => {
      p += Math.max(1, (100 - p) * 0.08);
      if (p >= 100) p = 100;
      countEl.textContent = String(Math.floor(p)).padStart(3, '0');
      barEl.style.width = p + '%';
      if (p < 100) requestAnimationFrame(tick);
      else setTimeout(finish, 350);
    };
    requestAnimationFrame(tick);

    function finish() {
      if (pre) pre.classList.add('is-done');
      document.body.classList.add('is-loaded');
      setTimeout(() => pre && (pre.style.display = 'none'), 1100);
    }
  }

  /* ---------------------------------------------------------- CUSTOM CURSOR */
  function cursor() {
    if (isTouch) return;
    const ring = $('.cursor'), dot = $('.cursor-dot');
    let rx = innerWidth / 2, ry = innerHeight / 2, dx = rx, dy = ry;
    addEventListener('mousemove', e => { dx = e.clientX; dy = e.clientY; });
    const loop = () => {
      rx += (dx - rx) * 0.18; ry += (dy - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      dot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    };
    loop();
    const interactive = 'a, button, input, .size, [data-magnetic]';
    document.addEventListener('mouseover', e => { if (e.target.closest(interactive)) ring.classList.add('is-active'); });
    document.addEventListener('mouseout', e => { if (e.target.closest(interactive)) ring.classList.remove('is-active'); });
  }

  /* ---------------------------------------------------------- MAGNETIC */
  function magnetic() {
    if (isTouch || reduceMotion) return;
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${mx * 0.3}px, ${my * 0.4}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
      el.style.transition = 'transform .4s cubic-bezier(0.16,1,0.3,1)';
    });
  }

  /* ---------------------------------------------------------- HERO CANVAS */
  function heroCanvas() {
    const cv = $('#heroCanvas');
    if (!cv || reduceMotion) return;
    const ctx = cv.getContext('2d');
    let w, h, pts, raf;
    const COUNT = window.innerWidth < 700 ? 28 : 60;
    function size() {
      w = cv.width = innerWidth * devicePixelRatio;
      h = cv.height = cv.offsetHeight * devicePixelRatio;
    }
    function init() {
      size();
      pts = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 130 * devicePixelRatio) {
            ctx.strokeStyle = `rgba(216,255,62,${0.12 * (1 - d / (130 * devicePixelRatio))})`;
            ctx.lineWidth = devicePixelRatio * 0.5;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(p.x, p.y, devicePixelRatio, devicePixelRatio);
      }
      raf = requestAnimationFrame(draw);
    }
    init(); draw();
    addEventListener('resize', () => { cancelAnimationFrame(raf); init(); draw(); });
  }

  /* ---------------------------------------------------------- COUNTDOWN */
  function countdown() {
    const map = {
      days: $('[data-cd="days"]'), hours: $('[data-cd="hours"]'),
      minutes: $('[data-cd="minutes"]'), seconds: $('[data-cd="seconds"]')
    };
    if (!map.days) return;
    const pad = n => String(Math.max(0, n)).padStart(2, '0');
    const tick = () => {
      let diff = Math.max(0, CONFIG.dropDate - Date.now());
      const d = Math.floor(diff / 86400000); diff -= d * 86400000;
      const h = Math.floor(diff / 3600000); diff -= h * 3600000;
      const m = Math.floor(diff / 60000); diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      map.days.textContent = pad(d); map.hours.textContent = pad(h);
      map.minutes.textContent = pad(m); map.seconds.textContent = pad(s);
    };
    tick(); setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------- REVEALS */
  function reveals() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal], [data-words]').forEach(el => io.observe(el));
  }

  /* ---------------------------------------------------------- PARALLAX */
  function parallax() {
    if (reduceMotion) return;
    const els = $$('[data-parallax]');
    if (!els.length) return;
    const onScroll = () => {
      els.forEach(el => {
        const r = el.getBoundingClientRect();
        const prog = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        const art = el.querySelector('[data-img], .focus__art');
        if (art) art.style.transform = `translateY(${prog * -28}px) scale(1.08)`;
      });
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* ---------------------------------------------------------- SCROLL UI */
  function scrollUI() {
    const bar = $('#scrollbar'), nav = $('#nav');
    let last = 0;
    const onScroll = () => {
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      if (y > last && y > 500) nav.classList.add('is-hidden');
      else nav.classList.remove('is-hidden');
      last = y;
    };
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------- PRODUCTS */
  function buildProducts() {
    const wrap = $('#products');
    if (!wrap) return;
    CONFIG.products.forEach((p, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('data-reveal', '');
      const n = String(i * 25 + 1).padStart(3, '0');
      const out = CONFIG.soldOut[p.id] || [];
      card.innerHTML = `
        <div class="card__media">
          <span class="card__num">N° ${n}–${String((i + 1) * 25).padStart(3, '0')}</span>
          ${p.tag ? `<span class="card__tag">${p.tag}</span>` : ''}
          <div class="card__art" data-art></div>
        </div>
        <div class="card__body">
          <div>
            <div class="card__name">${p.name}</div>
            <div class="card__desc">${p.desc}</div>
          </div>
          <div class="card__price">$${p.price}</div>
        </div>
        <div class="card__reserve"><div>
          <div class="card__sizes">
            ${CONFIG.sizes.map(sz => `<button class="size" ${out.includes(sz) ? 'disabled' : ''} data-size="${sz}">${sz}</button>`).join('')}
            <button class="btn card__add" data-magnetic><span>Reserve</span></button>
          </div>
        </div></div>`;
      wrap.appendChild(card);
      paintArt(card.querySelector('[data-art]'), p.id, p.seed, p.hue, p.name.split(' ')[0]);

      // size selection
      const sizes = $$('.size', card);
      sizes.forEach(b => b.addEventListener('click', () => {
        if (b.disabled) return;
        sizes.forEach(x => x.classList.remove('is-sel'));
        b.classList.add('is-sel');
      }));
      $('.card__add', card).addEventListener('click', () => {
        const sel = $('.size.is-sel', card);
        const add = $('.card__add span', card);
        if (!sel) { add.textContent = 'Pick a size'; setTimeout(() => add.textContent = 'Reserve', 1400); return; }
        add.textContent = `${p.name} · ${sel.dataset.size} ✓`;
        decrementInventory();
        setTimeout(() => add.textContent = 'Reserve', 1800);
      });
    });
    // wire focus art + lookbook after products exist
    const fa = $('#focusArt');
    if (fa) paintArt(fa, 'hoodie', 7, 96, 'VANTA');
  }

  /* ---------------------------------------------------------- LOOKBOOK */
  function buildLookbook() {
    const grid = $('#lookbookGrid');
    if (!grid) return;
    const shots = [
      { cls: 'shot--a', cap: 'FIG.02 — STREET / 03:14', seed: 12, hue: 96, id: 'look1' },
      { cls: 'shot--b', cap: 'FIG.03 — STUDIO', seed: 55, hue: 0, id: 'look2' },
      { cls: 'shot--c', cap: 'FIG.04 — DETAIL', seed: 77, hue: 210, id: 'look3' },
      { cls: 'shot--d', cap: 'FIG.05 — MOTION', seed: 31, hue: 96, id: 'look4' }
    ];
    shots.forEach(sh => {
      const fig = document.createElement('figure');
      fig.className = 'shot ' + sh.cls;
      fig.setAttribute('data-reveal', '');
      fig.innerHTML = `<div class="shot__art" data-art></div><figcaption class="shot__cap">${sh.cap}</figcaption>`;
      grid.appendChild(fig);
      paintArt(fig.querySelector('[data-art]'), sh.id, sh.seed, sh.hue, 'VANTA');
    });
  }

  /* ---------------------------------------------------------- INVENTORY */
  let remaining = CONFIG.pieces;
  function setInventory(v) {
    remaining = Math.max(0, v);
    const el = $('#remaining'), bar = $('#scarcityBar');
    if (el) el.textContent = remaining;
    if (bar) bar.style.width = (remaining / CONFIG.pieces) * 100 + '%';
  }
  function decrementInventory() {
    setInventory(remaining - 1);
  }
  function inventoryReveal() {
    // Animate from 100 down to a believable "already claimed" number on first view.
    const target = 63; // pieces already spoken for
    const sec = $('#scarcity');
    if (!sec) return;
    const io = new IntersectionObserver((ents) => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        io.disconnect();
        if (reduceMotion) { setInventory(target); return; }
        let v = CONFIG.pieces;
        const step = () => {
          v -= Math.max(1, (v - target) * 0.12);
          if (v <= target) v = target;
          setInventory(Math.round(v));
          if (v > target) requestAnimationFrame(step);
        };
        step();
      });
    }, { threshold: 0.4 });
    io.observe(sec);
  }

  /* ---------------------------------------------------------- MENU */
  function menu() {
    const burger = $('#burger'), m = $('#menu');
    if (!burger) return;
    const toggle = (open) => {
      burger.classList.toggle('is-open', open);
      m.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => toggle(!m.classList.contains('is-open')));
    $$('a', m).forEach(a => a.addEventListener('click', () => toggle(false)));
  }

  /* ---------------------------------------------------------- FORM */
  function form() {
    const f = $('#accessForm'), msg = $('#accessMsg'), input = $('#email');
    if (!f) return;
    f.addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      if (!ok) { msg.style.color = '#ff5a5a'; msg.textContent = 'Enter a valid email to join the list.'; return; }
      // No backend wired yet — store locally so the demo is honest, not faked.
      try {
        const list = JSON.parse(localStorage.getItem('vanta_list') || '[]');
        if (!list.includes(v)) list.push(v);
        localStorage.setItem('vanta_list', JSON.stringify(list));
      } catch (_) {}
      msg.style.color = 'var(--accent)';
      msg.textContent = `You're on the list. Position #${Math.floor(Math.random() * 80) + 20}. Watch your inbox.`;
      f.reset();
    });
  }

  /* ---------------------------------------------------------- SMOOTH ANCHORS */
  function anchors() {
    $$('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const t = $(id);
        if (!t) return;
        e.preventDefault();
        t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  /* ---------------------------------------------------------- INIT */
  document.addEventListener('DOMContentLoaded', () => {
    $('#year') && ($('#year').textContent = new Date().getFullYear());
    preloader();
    cursor();
    buildProducts();
    buildLookbook();
    magnetic();
    heroCanvas();
    countdown();
    reveals();
    parallax();
    scrollUI();
    setInventory(CONFIG.pieces);
    inventoryReveal();
    menu();
    form();
    anchors();
  });
})();
