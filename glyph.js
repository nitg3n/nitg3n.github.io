// Glyph diffusion field.
// A WebGL canvas renders a grid of monospace glyphs. DOM elements register as
// items; each frame their shapes are written into a small "target" texture
// (one texel per cell), and the shader decides per cell whether to show the
// clean glyph or noise, based on the item's noise level, the cursor lens and
// click ripples.

(function () {
  'use strict';

  const RAMP = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];
  const BLOCK = ['░', '▒', '▓', '█'];
  const BOX = ['┌', '┐', '└', '┘', '─', '│'];
  const DIGITS = '0123456789'.split('');
  const NOISE = '░▒▓#@%&$*+=?!/\\|<>{}[]~^:;'.split('');
  const BASE = RAMP.concat(BLOCK, BOX, DIGITS);
  const ALL = BASE.concat(NOISE);
  const BLOCK0 = RAMP.length;
  const NOISE0 = BASE.length;
  const GW = 32, GH = 52;

  const STYLE = { noise: 0, name: 1, future: 2, posted: 3, next: 4, image: 5, plain: 6, quiet: 7 };

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `
precision highp float;
uniform sampler2D uAtlas, uTarget, uColor;
uniform vec2 uGrid, uCell, uMouse;
uniform float uH, uScroll, uFirst, uTime, uGlyphs, uNoise0, uNoiseN, uLens, uReduce, uBlock0;
uniform vec4 uRip[4];

float hash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
vec3 flow(float x){
  x=clamp(x,0.,1.);
  vec3 a=vec3(.36,.22,.98),b=vec3(.96,.24,.62),c=vec3(1.,.5,.2),d=vec3(1.,.93,.82);
  if(x<.36)return mix(a,b,x/.36);
  if(x<.68)return mix(b,c,(x-.36)/.32);
  return mix(c,d,(x-.68)/.32);
}
vec4 tgt(vec2 c){return texture2D(uTarget,(c+.5)/uGrid);}
vec3 rgb;
vec3 styleCol(float st,vec2 cell,float inten){
  if(st<1.5){float f=fbm(cell*vec2(.035,.055)+vec2(uTime*.07,-uTime*.05));return flow(f*1.35-.12+cell.x*.0025);}
  if(st<2.5)return vec3(.36,.35,.55);
  if(st<3.5)return mix(vec3(1.,.5,.27),vec3(1.,.86,.72),hash(cell));
  if(st<4.5)return vec3(1.,.42,.22)*(.75+.25*sin(uTime*3.2));
  if(st<5.5)return rgb*1.25+.06;
  return vec3(.78,.75,.9);
}
void main(){
  vec2 px=vec2(gl_FragCoord.x,uH-gl_FragCoord.y+uScroll);
  vec2 cell=floor(px/uCell),lp=fract(px/uCell);
  vec2 tc=vec2(cell.x,cell.y-uFirst);
  vec4 tg=tgt(tc);
  rgb=texture2D(uColor,(tc+.5)/uGrid).rgb;
  float glyph=floor(tg.r*255.+.5),nz=tg.g,inten=tg.b,st=floor(tg.a*255.+.5);

  vec2 cc=(cell+.5)*uCell;
  float d=clamp(length(cc-uMouse)/uLens,0.,1.);
  float lens=d*d*(3.-2.*d),near=1.-lens;
  nz*=mix(.08,1.,lens);
  for(int i=0;i<4;i++){
    vec4 r=uRip[i];
    if(r.w>0.){
      float age=uTime-r.z,rad=age*uCell.x*70.;
      float ring=exp(-pow((length(cc-r.xy)-rad)/(uCell.x*5.),2.))*exp(-age*1.3);
      nz=max(nz,ring*.95);
    }
  }

  float rate=uReduce>.5?.35:5.+hash(cell)*9.;
  float fr=floor(uTime*rate+hash(cell+7.)*30.);
  float r=hash(cell+fr*.0173);
  float g;vec3 col;float a;
  if(r<nz){
    g=uNoise0+floor(hash(cell*1.31+fr*.71)*uNoiseN);
    col=mix(vec3(.24,.2,.62),vec3(.56,.46,1.),hash(cell+fr));
    a=(.18+.6*hash(cell+fr*.37+2.))*mix(.45,1.,nz);
    if(st>.5&&st<1.5&&glyph>.5){col=mix(col,styleCol(1.,cell,1.),.8);a=.55+.45*hash(cell+fr*.37+2.);}
  }else{
    g=glyph;col=styleCol(st,cell,inten);a=inten;
    if(st>.5&&st<1.5&&glyph>uBlock0+2.5){
      float f=fbm(cell*vec2(.09,.14)+vec2(uTime*.22,uTime*.1));
      g=f>.4?uBlock0+3.:f>.36?uBlock0+2.:f>.33?7.:f>.3?uBlock0+2.:uBlock0+3.;
      a*=.9+.25*f;
    }
  }

  vec3 o=vec3(.027,.027,.04);
  if(g>.5){
    float m=texture2D(uAtlas,vec2((g+clamp(lp.x,.03,.97))/uGlyphs,lp.y)).r;
    o+=col*m*a*(1.+.45*near);
  }
  float glow=0.;
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
    vec2 k=vec2(float(i),float(j));
    vec4 n=tgt(tc+k);
    float s=floor(n.a*255.+.5);
    if(s>.5&&s<6.5&&n.r>0.){float dd=length(lp-.5-k);glow+=n.b*exp(-dd*dd*1.8);}
  }
  o+=styleCol(st<.5?1.:st,cell,1.)*glow*.055*(1.+near);
  o+=(hash(gl_FragCoord.xy+fract(uTime)*97.)-.5)*.022;
  gl_FragColor=vec4(o,1.);
}`;

  function drawGlyph(x, c, ox) {
    const lw = 3.2, mx = ox + GW / 2, my = GH / 2, h = lw / 2;
    switch (c) {
      case ' ': return;
      case '█': x.fillRect(ox, 0, GW, GH); return;
      case '░': case '▒': case '▓': {
        const lvl = '░▒▓'.indexOf(c), s = 4;
        for (let j = 0; j * s < GH; j++) for (let i = 0; i * s < GW; i++) {
          const on = lvl === 0 ? (i % 2 === 0 && j % 2 === 0) : lvl === 1 ? (i + j) % 2 === 0 : !(i % 2 && j % 2);
          if (on) x.fillRect(ox + i * s, j * s, s - 1, s - 1);
        }
        return;
      }
      case '─': x.fillRect(ox, my - h, GW, lw); return;
      case '│': x.fillRect(mx - h, 0, lw, GH); return;
      case '┌': x.fillRect(mx - h, my - h, GW / 2 + h, lw); x.fillRect(mx - h, my - h, lw, GH / 2 + h); return;
      case '┐': x.fillRect(ox, my - h, GW / 2 + h, lw); x.fillRect(mx - h, my - h, lw, GH / 2 + h); return;
      case '└': x.fillRect(mx - h, my - h, GW / 2 + h, lw); x.fillRect(mx - h, 0, lw, GH / 2 + h); return;
      case '┘': x.fillRect(ox, my - h, GW / 2 + h, lw); x.fillRect(mx - h, 0, lw, GH / 2 + h); return;
    }
    x.fillText(c, mx, my + 1);
  }

  function buildAtlas() {
    const cv = document.createElement('canvas');
    cv.width = GW * ALL.length; cv.height = GH;
    const x = cv.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = '#fff';
    x.font = `500 ${Math.round(GH * .62)}px "Geist Mono", ui-monospace, monospace`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    ALL.forEach((c, i) => drawGlyph(x, c, i * GW));
    return cv;
  }

  function shader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function wrapWords(el) {
    if (el.querySelector('.gw')) return;
    const words = el.textContent.split(/(\s+)/);
    el.textContent = '';
    words.forEach(w => {
      if (/^\s+$/.test(w)) el.append(w);
      else if (w) { const s = document.createElement('span'); s.className = 'gw'; s.textContent = w; el.append(s); }
    });
  }

  const fields = [];
  let running = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  class Field {
    constructor(canvas, opts) {
      this.c = canvas;
      this.host = opts.host || null;
      this.ambient = opts.ambient ?? .03;
      this.cellFn = opts.cell || (w => (w < 640 ? 7 : 10));
      this.lens = opts.lens || 150;
      this.items = [];
      this.ripples = [];
      this.mouse = [-1e5, -1e5];
      this.sm = [-1e5, -1e5];
      this.t0 = performance.now();

      const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('no webgl');
      this.gl = gl;
      const pr = gl.createProgram();
      gl.attachShader(pr, shader(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(pr, shader(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.u = {};
      ['uAtlas', 'uTarget', 'uColor', 'uGrid', 'uCell', 'uMouse', 'uH', 'uScroll', 'uFirst', 'uTime', 'uGlyphs', 'uNoise0', 'uNoiseN', 'uLens', 'uReduce', 'uBlock0', 'uRip']
        .forEach(k => (this.u[k] = gl.getUniformLocation(pr, k)));

      const tex = (unit, filter) => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      tex(0, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas());
      tex(1, gl.NEAREST);
      tex(2, gl.NEAREST);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

      gl.uniform1i(this.u.uAtlas, 0);
      gl.uniform1i(this.u.uTarget, 1);
      gl.uniform1i(this.u.uColor, 2);
      gl.uniform1f(this.u.uGlyphs, ALL.length);
      gl.uniform1f(this.u.uNoise0, NOISE0);
      gl.uniform1f(this.u.uNoiseN, NOISE.length);
      gl.uniform1f(this.u.uReduce, reduce ? 1 : 0);
      gl.uniform1f(this.u.uBlock0, BLOCK0);

      this.resize();
      if (this.host) new ResizeObserver(() => this.resize()).observe(this.host);
      else addEventListener('resize', () => this.resize());
    }

    resize() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = this.host ? this.host.clientWidth : innerWidth;
      const h = this.host ? this.host.clientHeight : innerHeight;
      if (!w || !h) return;
      this.dpr = dpr; this.w = w; this.h = h;
      this.c.width = Math.round(w * dpr);
      this.c.height = Math.round(h * dpr);
      this.cw = this.cellFn(w);
      this.ch = this.cw * 1.6;
      this.cols = Math.ceil(w / this.cw) + 1;
      this.rows = Math.ceil(h / this.ch) + 2;
      this.data = new Uint8Array(this.cols * this.rows * 4);
      this.rgb = new Uint8Array(this.cols * this.rows * 4);
      this.gl.viewport(0, 0, this.c.width, this.c.height);
      this.items.forEach(it => (it.dirty = true));
    }

    add(el, o) {
      const it = {
        el, kind: o.kind, style: o.style ?? STYLE.name, seed: o.seed || 0, img: o.img || null,
        n: o.noise ?? 1, floor: o.floor || 0, anim: null, dirty: true, cells: null, onDone: null,
      };
      if (it.kind === 'text') wrapWords(el);
      it.to = (v, dur = 1000, delay = 0, done) => {
        it.anim = { from: it.n, to: v, t0: performance.now() + (reduce ? 0 : delay), dur: reduce ? 1 : dur };
        it.onDone = done || null;
        return it;
      };
      it.remove = () => { this.items = this.items.filter(x => x !== it); };
      this.items.push(it);
      return it;
    }

    pointer(x, y) {
      if (this.host) { const r = this.host.getBoundingClientRect(); x -= r.left; y -= r.top; }
      this.mouse = [x, y];
    }

    ripple(x, y) {
      if (reduce) return;
      if (this.host) { const r = this.host.getBoundingClientRect(); x -= r.left; y -= r.top; }
      this.ripples.push({ x, y: y + this.scrollY(), t: (performance.now() - this.t0) / 1000 });
      if (this.ripples.length > 4) this.ripples.shift();
    }

    scrollY() { return this.host ? 0 : scrollY; }

    origin() {
      if (!this.host) return [0, 0];
      const r = this.host.getBoundingClientRect();
      return [r.left, r.top];
    }

    raster(it) {
      it.dirty = false;
      const r = it.el.getBoundingClientRect();
      const { cw, ch } = this;
      if (it.kind === 'text') {
        const w = Math.max(1, Math.round(r.width / cw)), h = Math.max(1, Math.round(r.height / ch));
        const S = 3, cv = document.createElement('canvas');
        cv.width = w * S; cv.height = h * S;
        const x = cv.getContext('2d', { willReadFrequently: true });
        const cs = getComputedStyle(it.el);
        x.setTransform(S / cw, 0, 0, S / ch, 0, 0);
        x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        x.fillStyle = '#fff';
        x.textBaseline = 'alphabetic';
        const asc = x.measureText('Hg').fontBoundingBoxAscent || parseFloat(cs.fontSize) * .9;
        if (cs.letterSpacing && cs.letterSpacing !== 'normal' && 'letterSpacing' in x) x.letterSpacing = cs.letterSpacing;
        it.el.querySelectorAll('.gw').forEach(s => {
          const sr = s.getBoundingClientRect();
          x.fillText(s.textContent, sr.left - r.left, sr.top - r.top + asc);
        });
        const px = x.getImageData(0, 0, cv.width, cv.height).data;
        const g = new Uint8Array(w * h), v = new Uint8Array(w * h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          let sum = 0;
          for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) sum += px[(((j * S + b) * cv.width) + i * S + a) * 4];
          const cov = sum / (S * S * 255);
          const k = j * w + i;
          if (cov > .06) {
            g[k] = BLOCK0 + (cov > .8 ? 3 : cov > .55 ? 2 : cov > .3 ? 1 : 0);
            v[k] = Math.round((.6 + .4 * cov) * 255);
          }
        }
        it.cells = { w, h, g, v, round: true };
      } else if (it.kind === 'box') {
        const w = Math.max(1, Math.floor(r.width / cw)), h = Math.max(1, Math.floor(r.height / ch));
        const g = new Uint8Array(w * h), v = new Uint8Array(w * h), s = it.seed;
        const f1 = 2 + (s % 5), f2 = 1 + ((s >> 3) % 4), f3 = 2 + ((s >> 5) % 3), ph = (s % 97) / 15;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const X = i / w, Y = j / h;
          let val = .5 + .5 * Math.sin((X * f1 + Y * f2) * Math.PI + ph) * Math.cos((X - Y * f3 * .5) * Math.PI * f3 + ph * .7);
          val = Math.max(0, Math.min(.999, val));
          const k = j * w + i;
          g[k] = 1 + Math.floor(val * 9);
          v[k] = Math.round((.3 + .7 * val) * 255);
        }
        it.cells = { w, h, g, v, round: false };
      } else if (it.kind === 'image') {
        const img = it.img;
        if (!img || !img.complete || !img.naturalWidth) { it.dirty = true; it.cells = null; return; }
        const w = Math.max(1, Math.round(r.width / cw)), h = Math.max(1, Math.round(r.height / ch));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const x = cv.getContext('2d', { willReadFrequently: true });
        const ir = img.naturalWidth / img.naturalHeight, br = (w * cw) / (h * ch);
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
        if (ir > br) { sw = sh * br; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / br; sy = (img.naturalHeight - sh) / 2; }
        x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        const px = x.getImageData(0, 0, w, h).data;
        const g = new Uint8Array(w * h), v = new Uint8Array(w * h), rgb = new Uint8Array(w * h * 3);
        for (let k = 0; k < w * h; k++) { rgb[k * 3] = px[k * 4]; rgb[k * 3 + 1] = px[k * 4 + 1]; rgb[k * 3 + 2] = px[k * 4 + 2]; }
        let lo = 1, hi = 0;
        const L = new Float32Array(w * h);
        for (let k = 0; k < w * h; k++) {
          const l = (px[k * 4] * .2126 + px[k * 4 + 1] * .7152 + px[k * 4 + 2] * .0722) / 255;
          L[k] = l; lo = Math.min(lo, l); hi = Math.max(hi, l);
        }
        for (let k = 0; k < w * h; k++) {
          const l = (L[k] - lo) / Math.max(.01, hi - lo);
          g[k] = l < .04 ? 0 : 1 + Math.min(8, Math.floor(l * 9));
          v[k] = Math.round((.25 + .75 * l) * 255);
        }
        it.cells = { w, h, g, v, rgb, round: true };
      } else {
        it.cells = null;
      }
    }

    frame(now) {
      if (!this.data || !this.w) return;
      const { gl, cols, rows, cw, ch, data } = this;
      for (const it of this.items) {
        const a = it.anim;
        if (!a || now < a.t0) continue;
        const k = Math.min(1, (now - a.t0) / a.dur), e = 1 - Math.pow(1 - k, 3);
        it.n = a.from + (a.to - a.from) * e;
        if (k >= 1) { it.anim = null; const d = it.onDone; it.onDone = null; d && d(); }
      }

      const amb = Math.round(this.ambient * 255);
      for (let i = 0; i < data.length; i += 4) { data[i] = 0; data[i + 1] = amb; data[i + 2] = 0; data[i + 3] = 0; }

      const sy = this.scrollY(), first = Math.floor(sy / ch);
      const [ox, oy] = this.origin();
      for (const it of this.items) {
        const r = it.el.getBoundingClientRect();
        if (!r.width || r.bottom < oy - 40 || r.top > oy + this.h + 40) continue;
        if (it.dirty) this.raster(it);
        const nb = Math.round(Math.min(1, Math.max(it.n, it.floor)) * 255);
        if (it.kind === 'quiet') {
          const x0 = Math.floor((r.left - ox) / cw), x1 = Math.ceil((r.right - ox) / cw);
          const y0 = Math.floor((r.top - oy + sy) / ch) - first, y1 = Math.ceil((r.bottom - oy + sy) / ch) - first;
          for (let j = Math.max(0, y0); j < Math.min(rows, y1); j++)
            for (let i = Math.max(0, x0); i < Math.min(cols, x1); i++) data[(j * cols + i) * 4 + 1] = 0;
          continue;
        }
        const c = it.cells;
        if (!c) continue;
        const fx = c.round ? Math.round : Math.ceil;
        const x0 = fx((r.left - ox) / cw), y0 = fx((r.top - oy + sy) / ch) - first;
        for (let j = 0; j < c.h; j++) {
          const row = y0 + j;
          if (row < 0 || row >= rows) continue;
          for (let i = 0; i < c.w; i++) {
            const col = x0 + i;
            if (col < 0 || col >= cols) continue;
            const k = j * c.w + i, o = (row * cols + col) * 4;
            data[o] = c.g[k];
            data[o + 1] = c.g[k] ? nb : Math.max(amb, nb);
            data[o + 2] = c.v[k];
            data[o + 3] = it.style;
            if (c.rgb) { this.rgb[o] = c.rgb[k * 3]; this.rgb[o + 1] = c.rgb[k * 3 + 1]; this.rgb[o + 2] = c.rgb[k * 3 + 2]; }
          }
        }
      }

      const t = (now - this.t0) / 1000, d = this.dpr;
      this.sm[0] += (this.mouse[0] - this.sm[0]) * .18;
      this.sm[1] += (this.mouse[1] - this.sm[1]) * .18;
      if (Math.abs(this.mouse[0] - this.sm[0]) > 2000) this.sm = this.mouse.slice();

      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.activeTexture(gl.TEXTURE2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.rgb);
      gl.uniform2f(this.u.uGrid, cols, rows);
      gl.uniform2f(this.u.uCell, cw * d, ch * d);
      gl.uniform2f(this.u.uMouse, this.sm[0] * d, (this.sm[1] + sy) * d);
      gl.uniform1f(this.u.uH, this.c.height);
      gl.uniform1f(this.u.uScroll, sy * d);
      gl.uniform1f(this.u.uFirst, first);
      gl.uniform1f(this.u.uTime, t);
      gl.uniform1f(this.u.uLens, this.lens * d);
      const rip = new Float32Array(16);
      this.ripples = this.ripples.filter(p => t - p.t < 3);
      this.ripples.forEach((p, i) => rip.set([p.x * d, p.y * d, p.t, 1], i * 4));
      gl.uniform4fv(this.u.uRip, rip);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  function loop(now) {
    for (const f of fields) f.frame(now);
    requestAnimationFrame(loop);
  }

  window.Glyph = {
    STYLE,
    create(canvas, opts = {}) {
      try {
        const f = new Field(canvas, opts);
        fields.push(f);
        if (!running) { running = true; requestAnimationFrame(loop); }
        return f;
      } catch (e) {
        console.warn('[glyph]', e);
        return null;
      }
    },
  };
})();
