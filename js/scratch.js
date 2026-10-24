// Holographic scratch-off foil drawn on a canvas over the prize.
// The foil is redrawn every frame so a light sheen can move across it;
// scratched areas live in a separate mask that is cut out of each frame.

const GRID_COLS = 48;
const FADE_MS = 700;

export class ScratchCard {
  constructor(canvas, { threshold = 0.6, onFirstScratch, onScratch, onScratchEnd, onReveal } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.mask = document.createElement('canvas');
    this.maskCtx = this.mask.getContext('2d');
    this.threshold = threshold;
    this.on = { onFirstScratch, onScratch, onScratchEnd, onReveal };

    this.enabled = false;
    this.done = false;
    this.scratched = false;
    this.pointerId = null;
    this.last = null;
    this.fadeStart = 0;
    this.sheenShift = 0;
    this.raf = 0;
    this.frame = this.frame.bind(this);

    this.bindPointer();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  init() {
    this.resize();
    this.start();
  }

  enable() {
    this.enabled = true;
  }

  reset() {
    this.maskCtx.clearRect(0, 0, this.mask.width, this.mask.height);
    this.grid?.fill(0);
    this.cleared = 0;
    this.enabled = false;
    this.done = false;
    this.scratched = false;
    this.pointerId = null;
    this.canvas.style.visibility = '';
    this.start();
  }

  // Dissolves whatever foil is left. Called automatically past the threshold.
  reveal() {
    if (this.done) return;
    this.done = true;
    this.enabled = false;
    if (this.pointerId !== null) {
      this.pointerId = null;
      this.on.onScratchEnd?.();
    }
    this.fadeStart = performance.now();
    this.start();
    this.on.onReveal?.();
  }

  resize() {
    // Layout size, not the bounding box, so the floating tilt does not resize the canvas.
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (w === this.canvas.width && h === this.canvas.height) return;

    // Keep what was already scratched when the card changes size.
    const previous = this.mask.width ? copyCanvas(this.mask) : null;
    for (const c of [this.canvas, this.base, this.mask]) {
      c.width = w;
      c.height = h;
    }
    if (previous) this.maskCtx.drawImage(previous, 0, 0, w, h);

    this.brush = Math.max(14, width * 0.055) * dpr;
    if (!this.grid) {
      this.cols = GRID_COLS;
      this.rows = Math.round((GRID_COLS * h) / w);
      this.grid = new Uint8Array(this.cols * this.rows);
      this.cleared = 0;
    }
    drawFoil(this.base, dpr);
    if (!this.raf) this.render(performance.now(), this.fade(performance.now()));
  }

  start() {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  frame(now) {
    this.raf = 0;
    const alpha = this.fade(now);
    this.render(now, alpha);
    if (alpha > 0) this.start();
    else this.canvas.style.visibility = 'hidden';
  }

  fade(now) {
    if (!this.done) return 1;
    const t = Math.min(1, Math.max(0, (now - this.fadeStart) / FADE_MS));
    return 1 - t * t * (3 - 2 * t);
  }

  render(now, alpha) {
    const { ctx } = this;
    const { width: w, height: h } = this.canvas;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.base, 0, 0);

    // Two light bands sweep across the foil; scratching nudges them toward the finger.
    const p = ((now / 3400) % 1) * 1.8 - 0.4 + this.sheenShift;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = band(ctx, w, h, p, 0.1, [255, 255, 255, 0.42]);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = band(ctx, w, h, p - 0.32, 0.14, [110, 255, 240, 0.22]);
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.mask, 0, 0);
  }

  bindPointer() {
    const c = this.canvas;

    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.pointerId !== null) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      this.pointerId = e.pointerId;
      this.rect = c.getBoundingClientRect();
      this.last = this.point(e);
      this.stamp(this.last.x, this.last.y);
      if (!this.scratched) {
        this.scratched = true;
        this.on.onFirstScratch?.();
      }
      this.check();
    });

    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.rect = c.getBoundingClientRect();
      const from = this.last;
      const events = e.getCoalescedEvents?.() ?? [];
      for (const ev of events.length ? events : [e]) this.scratchTo(this.point(ev));

      const to = this.last;
      const dx = to.cx - from.cx;
      const dy = to.cy - from.cy;
      const dt = Math.max(1, to.t - from.t);
      this.sheenShift = ((to.cx - this.rect.left) / this.rect.width) * 0.3 - 0.15;
      this.on.onScratch?.({ x: to.cx, y: to.cy, dx, dy, speed: Math.hypot(dx, dy) / dt });
      this.check();
    });

    const end = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.on.onScratchEnd?.();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  point(e) {
    const r = this.rect;
    return {
      x: (e.clientX - r.left) * (this.canvas.width / r.width),
      y: (e.clientY - r.top) * (this.canvas.height / r.height),
      cx: e.clientX,
      cy: e.clientY,
      t: e.timeStamp,
    };
  }

  // Stamps along the segment so fast swipes leave no gaps.
  scratchTo(pt) {
    const { last } = this;
    const dx = pt.x - last.x;
    const dy = pt.y - last.y;
    const steps = Math.ceil(Math.hypot(dx, dy) / (this.brush * 0.3));
    for (let i = 1; i <= steps; i++) this.stamp(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
    this.last = pt;
  }

  stamp(x, y) {
    const m = this.maskCtx;
    const r = this.brush * (0.88 + Math.random() * 0.24);
    m.beginPath();
    m.arc(x, y, r, 0, Math.PI * 2);
    // Small chips along the edge make the stroke look scratched rather than painted.
    if (Math.random() < 0.35) {
      const a = Math.random() * Math.PI * 2;
      const cx = x + Math.cos(a) * r;
      const cy = y + Math.sin(a) * r;
      m.moveTo(cx + r * 0.3, cy);
      m.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    }
    m.fill();
    this.mark(x, y, r);
  }

  // Progress is tracked on a coarse grid instead of reading pixels back.
  mark(x, y, r) {
    const { cols, rows, grid } = this;
    const cw = this.mask.width / cols;
    const ch = this.mask.height / rows;
    const i0 = Math.max(0, Math.floor((x - r) / cw));
    const i1 = Math.min(cols - 1, Math.floor((x + r) / cw));
    const j0 = Math.max(0, Math.floor((y - r) / ch));
    const j1 = Math.min(rows - 1, Math.floor((y + r) / ch));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * cols + i;
        if (grid[k]) continue;
        const dx = (i + 0.5) * cw - x;
        const dy = (j + 0.5) * ch - y;
        if (dx * dx + dy * dy <= r * r) {
          grid[k] = 1;
          this.cleared++;
        }
      }
    }
  }

  check() {
    if (!this.done && this.cleared >= this.grid.length * this.threshold) this.reveal();
  }
}

function copyCanvas(source) {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  c.getContext('2d').drawImage(source, 0, 0);
  return c;
}

function band(ctx, w, h, center, width, [r, g, b, a]) {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  const clear = `rgba(${r}, ${g}, ${b}, 0)`;
  gradient.addColorStop(0, clear);
  if (center > 0 && center < 1) {
    gradient.addColorStop(Math.max(0, center - width), clear);
    gradient.addColorStop(center, `rgba(${r}, ${g}, ${b}, ${a})`);
    gradient.addColorStop(Math.min(1, center + width), clear);
  }
  gradient.addColorStop(1, clear);
  return gradient;
}

function drawFoil(canvas, dpr) {
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const unit = h / 100;

  // Iridescent base
  const holo = g.createLinearGradient(0, h, w, 0);
  [[0, '#b9a6ff'], [0.16, '#ffb6e8'], [0.32, '#fff0fb'], [0.48, '#9feaff'], [0.64, '#d9c6ff'], [0.8, '#ffcfae'], [1, '#c4a3ff']]
    .forEach(([offset, color]) => holo.addColorStop(offset, color));
  g.fillStyle = holo;
  g.fillRect(0, 0, w, h);

  // Chrome shading, brushed lines and grain
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(255, 255, 255, .35)');
  shade.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(1, 'rgba(60, 20, 110, .25)');
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2 * dpr) {
    g.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.12})`;
    g.fillRect(0, y, w, dpr);
  }
  g.fillStyle = g.createPattern(noiseTile(), 'repeat');
  g.fillRect(0, 0, w, h);

  // Embossed sparkle pattern
  const step = 26 * dpr;
  for (let row = 0, y = step / 2; y < h; row++, y += step) {
    for (let x = row % 2 ? step : step / 2; x < w; x += step) {
      sparkle(g, x + dpr * 0.6, y + dpr * 0.6, 2.4 * dpr, 'rgba(80, 30, 130, .16)');
      sparkle(g, x, y, 2.4 * dpr, 'rgba(255, 255, 255, .45)');
    }
  }

  // Frame
  g.lineWidth = 1.5 * dpr;
  g.strokeStyle = 'rgba(255, 255, 255, .75)';
  g.beginPath();
  g.roundRect(10 * dpr, 10 * dpr, w - 20 * dpr, h - 20 * dpr, 10 * dpr);
  g.stroke();
  g.setLineDash([2 * dpr, 6 * dpr]);
  g.strokeStyle = 'rgba(90, 30, 140, .35)';
  g.beginPath();
  g.roundRect(16 * dpr, 16 * dpr, w - 32 * dpr, h - 32 * dpr, 7 * dpr);
  g.stroke();
  g.setLineDash([]);

  // Lettering
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const titleSize = 26 * unit;
  g.font = `italic 800 ${titleSize}px "Advent Pro", sans-serif`;
  const ink = g.createLinearGradient(0, h * 0.5 - titleSize * 0.8, 0, h * 0.5);
  ink.addColorStop(0, '#7b3fe4');
  ink.addColorStop(1, '#e0409a');
  emboss(g, 'ΞΥΣΕ', w / 2, h * 0.5, dpr, ink);

  setSpacing(g, 0.45 * unit);
  g.font = `800 ${5.6 * unit}px Manrope, sans-serif`;
  emboss(g, 'ΓΙΑ ΝΑ ΔΕΙΣ ΤΟ ΔΩΡΟ ΣΟΥ', w / 2, h * 0.66, dpr, 'rgba(70, 25, 120, .8)');

  setSpacing(g, 0.35 * unit);
  g.font = `800 ${3.8 * unit}px Manrope, sans-serif`;
  g.textAlign = 'left';
  emboss(g, 'ΔΩΡΟΚΑΡΤΑ', 26 * dpr, 13 * unit + 10 * dpr, dpr, 'rgba(70, 25, 120, .6)');
  g.textAlign = 'right';
  emboss(g, 'Nº 001', w - 26 * dpr, h - 10 * unit, dpr, 'rgba(70, 25, 120, .6)');
  setSpacing(g, 0);
}

function emboss(g, text, x, y, dpr, fill) {
  g.fillStyle = 'rgba(70, 20, 110, .45)';
  g.fillText(text, x + dpr, y + 1.5 * dpr);
  g.fillStyle = 'rgba(255, 255, 255, .9)';
  g.fillText(text, x - dpr, y - dpr);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

function setSpacing(g, px) {
  if ('letterSpacing' in g) g.letterSpacing = `${px}px`;
}

function sparkle(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - r * 2);
  g.quadraticCurveTo(x, y, x + r * 2, y);
  g.quadraticCurveTo(x, y, x, y + r * 2);
  g.quadraticCurveTo(x, y, x - r * 2, y);
  g.quadraticCurveTo(x, y, x, y - r * 2);
  g.fill();
}

function noiseTile() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 28;
  }
  g.putImageData(img, 0, 0);
  return c;
}
