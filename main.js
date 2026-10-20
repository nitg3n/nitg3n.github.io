(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');
  const G = window.Glyph;
  const ST = G.STYLE;

  const IDEAS = window.IDEAS || { list: [] };
  const ideas = (IDEAS.list || []).slice(0, 30);
  const posted = ideas.length;
  const handle = IDEAS.handle || 'thisisjaeha';

  $('#year').textContent = new Date().getFullYear();

  // ---------- status line ----------
  function dayDate(i) {
    if (!IDEAS.start) return null;
    const d = new Date(IDEAS.start + 'T00:00:00');
    d.setDate(d.getDate() + i);
    return d;
  }
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  (function status() {
    const el = $('#status');
    const follow = `<a href="https://x.com/${handle}" target="_blank" rel="noopener">follow @${handle} ↗</a>`;
    let state;
    if (posted >= 30) state = 'complete';
    else if (posted > 0) state = `<span class="live">● live</span>`;
    else if (IDEAS.start) {
      const days = Math.ceil((dayDate(0) - new Date()) / 864e5);
      state = days > 0 ? `starts ${fmt(dayDate(0))} · in ${days} day${days === 1 ? '' : 's'}` : 'starting today';
    } else state = 'starting soon';
    el.innerHTML = `day <b>${pad(posted)}</b> / 30 · ${state} · ${follow}`;
  })();

  // ---------- days grid ----------
  const grid = $('#days');
  const days = [];
  for (let i = 0; i < 30; i++) {
    const state = i < posted ? 'posted' : i === posted ? 'next' : 'future';
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day';
    b.dataset.state = state;
    b.dataset.i = i;
    const d = dayDate(i);
    const title = state === 'posted' ? ideas[i].title : state === 'next' ? 'next' : d ? fmt(d) : '—';
    b.innerHTML = `<span class="thumb"></span><span class="meta"><span class="n">${pad(i + 1)}</span><span class="tt"></span></span>`;
    $('.tt', b).textContent = title;
    if (state === 'posted') b.setAttribute('aria-label', `Day ${i + 1}: ${ideas[i].title}`);
    else {
      b.setAttribute('aria-disabled', 'true');
      b.setAttribute('aria-label', `Day ${i + 1}: not yet`);
    }
    li.append(b);
    grid.append(li);
    days.push({ b, state, i });
  }

  // ---------- text decode ----------
  const NOISE = '░▒▓#@%&$*+=?!/<>{}[]~^:;'.split('');
  function decode(el) {
    if (reduce) return;
    const nodes = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) nodes.push({ n: w.currentNode, s: w.currentNode.nodeValue });
    const total = nodes.reduce((a, x) => a + x.s.length, 0);
    const dur = 500 + total * 14;
    const t0 = performance.now();
    (function tick(now) {
      const k = (now - t0) / dur;
      let off = 0;
      for (const x of nodes) {
        let out = '';
        for (let i = 0; i < x.s.length; i++) {
          const c = x.s[i];
          const at = (off + i) / total;
          out += c === ' ' || k > at + .25 ? c : k > at - .1 ? NOISE[(Math.random() * NOISE.length) | 0] : ' ';
        }
        x.n.nodeValue = out;
        off += x.s.length;
      }
      if (k < 1.3) requestAnimationFrame(tick);
      else nodes.forEach(x => (x.n.nodeValue = x.s));
    })(t0);
  }

  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      if (e.target.hasAttribute('data-decode')) decode(e.target);
      else e.target.classList.add('in');
    }
  }, { threshold: .2 });
  $$('[data-decode], .reveal').forEach(el => io.observe(el));

  // ---------- glyph field ----------
  let field = null;

  const dayItems = [];
  function initField() {
    field = G.create($('#field'), { ambient: .03 });
    if (!field) { document.documentElement.classList.add('no-gl'); return; }
    const name = field.add($('#name'), { kind: 'text', style: ST.name, noise: 1, floor: .045 });
    name.to(0, 2800, 250);

    $$('[data-quiet]').forEach(el => field.add(el, { kind: 'quiet' }));

    days.forEach(({ b, state, i }) => {
      const style = state === 'posted' ? ST.posted : state === 'next' ? ST.next : ST.future;
      const it = field.add($('.thumb', b), { kind: 'box', style, seed: i * 7919 + 131, noise: 1 });
      if (state === 'next') it.floor = .45;
      dayItems[i] = it;
    });

    const gio = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      gio.disconnect();
      days.forEach(({ state, i }) => {
        if (state === 'posted') dayItems[i].to(0, 1500, 120 + i * 70);
        else if (state === 'next') dayItems[i].to(.45, 1200, 120 + i * 70);
      });
    }, { threshold: .25 });
    gio.observe(grid);

    // t counter follows the name's noise level
    const tval = $('#tval');
    let last = -1;
    (function tick() {
      const v = Math.round(Math.max(0, name.n) * 1000);
      if (v !== last) { tval.textContent = String(v).padStart(4, '0'); last = v; }
      if (name.anim || v > 0) requestAnimationFrame(tick);
    })();

    addEventListener('pointermove', e => field.pointer(e.clientX, e.clientY), { passive: true });
    document.addEventListener('pointerleave', () => field.pointer(-1e5, -1e5));
    addEventListener('pointerdown', e => {
      if (e.target.closest('a, button, .idea')) return;
      field.ripple(e.clientX, e.clientY);
    });
  }

  // ---------- day interactions ----------
  grid.addEventListener('pointerover', e => {
    const b = e.target.closest('.day');
    if (!b || b.contains(e.relatedTarget) || !field) return;
    const it = dayItems[b.dataset.i];
    if (b.dataset.state === 'posted') it.to(.55, 160);
    else if (b.dataset.state === 'future') it.to(.55, 260);
  });
  grid.addEventListener('pointerout', e => {
    const b = e.target.closest('.day');
    if (!b || b.contains(e.relatedTarget) || !field) return;
    const it = dayItems[b.dataset.i];
    if (b.dataset.state === 'posted') it.to(0, 700);
    else if (b.dataset.state === 'future') it.to(1, 600);
  });
  grid.addEventListener('click', e => {
    const b = e.target.closest('.day');
    if (!b) return;
    if (b.dataset.state === 'posted') { openIdea(+b.dataset.i); return; }
    b.classList.remove('nope');
    void b.offsetWidth;
    b.classList.add('nope');
    if (field) {
      const r = b.getBoundingClientRect();
      field.ripple(r.left + r.width / 2, r.top + r.height / 2);
    }
  });

  // ---------- idea detail ----------
  const modal = $('#idea');
  const frame = $('.idea-frame', modal);
  const img = $('img', frame);
  let mField = null, mItem = null, lastFocus = null;

  function openIdea(i, fromHash) {
    const idea = ideas[i];
    if (!idea) return;
    lastFocus = document.activeElement;
    const d = dayDate(i);
    $('#idea-meta').textContent = `day ${pad(i + 1)} / 30${d ? ' · ' + fmt(d) : ''}`;
    $('#idea-title').textContent = idea.title;
    const body = $('#idea-body');
    body.textContent = '';
    String(idea.summary || '').split(/\n{2,}/).filter(Boolean).forEach(p => {
      const el = document.createElement('p');
      el.textContent = p;
      body.append(el);
    });
    const x = $('#idea-x');
    x.hidden = !idea.x;
    if (idea.x) x.href = idea.x;

    modal.hidden = false;
    document.body.classList.add('locked');
    $('.idea-close', modal).focus();
    if (!fromHash) history.replaceState(null, '', '#day-' + pad(i + 1));

    img.classList.remove('on');
    img.alt = idea.title;
    if (!mField) mField = G.create($('canvas', frame), { host: frame, ambient: .05, cell: w => (w < 500 ? 6 : 8), lens: 110 });
    if (!mField) { if (idea.image) { img.src = idea.image; img.classList.add('on'); } return; }
    mField.resize();
    if (mItem) mItem.remove();
    if (idea.image) {
      mItem = mField.add(img, { kind: 'image', style: ST.image, img, noise: 1 });
      const go = () => { mItem.dirty = true; mItem.to(0, 1900, 150, () => img.classList.add('on')); };
      img.onload = go;
      img.src = idea.image;
      if (img.complete && img.naturalWidth) go();
    } else {
      img.removeAttribute('src');
      mItem = mField.add(frame, { kind: 'box', style: ST.posted, seed: i * 7919 + 131, noise: 1 });
      mItem.to(0, 1600, 100);
    }
  }

  function closeIdea() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('locked');
    history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeIdea(); });
  frame.addEventListener('pointermove', e => mField && mField.pointer(e.clientX, e.clientY));
  frame.addEventListener('pointerleave', () => mField && mField.pointer(-1e5, -1e5));
  frame.addEventListener('pointerdown', e => mField && mField.ripple(e.clientX, e.clientY));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeIdea(); });

  function fromHash() {
    const m = location.hash.match(/^#day-(\d{1,2})$/);
    if (m) openIdea(+m[1] - 1, true);
    else closeIdea();
  }
  addEventListener('hashchange', fromHash);

  // ---------- start ----------
  const ready = document.fonts ? Promise.race([
    Promise.all([
      document.fonts.load('800 100px "Geist"'),
      document.fonts.load('500 20px "Geist Mono"'),
    ]),
    new Promise(r => setTimeout(r, 2500)),
  ]) : Promise.resolve();
  ready.then(() => {
    initField();
    fromHash();
  });
})();
