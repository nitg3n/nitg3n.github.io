(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.Glyph;
  const ST = G.STYLE;

  $('#year').textContent = new Date().getFullYear();

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
      decode(e.target);
    }
  }, { threshold: .2 });
  $$('[data-decode]').forEach(el => io.observe(el));

  // ---------- glyph field ----------
  let field = null;

  function initField() {
    field = G.create($('#field'), { ambient: .03 });
    if (!field) { document.documentElement.classList.add('no-gl'); return; }
    const name = field.add($('#name'), { kind: 'text', style: ST.name, noise: 1, floor: .045 });
    name.to(0, 2800, 250);

    $$('[data-quiet]').forEach(el => field.add(el, { kind: 'quiet' }));

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
      if (e.target.closest('a, button')) return;
      field.ripple(e.clientX, e.clientY);
    });
  }

  // ---------- start ----------
  const ready = document.fonts ? Promise.race([
    Promise.all([
      document.fonts.load('800 100px "Geist"'),
      document.fonts.load('500 20px "Geist Mono"'),
    ]),
    new Promise(r => setTimeout(r, 2500)),
  ]) : Promise.resolve();
  ready.then(initField);
})();
