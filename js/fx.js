// Full-screen particle layer: foil flakes, confetti and falling cash.

const NEON = ['#ff3d9a', '#32f0d8', '#ffd479', '#b48cff', '#ff9a4a', '#fff3fa'];
const FOIL = ['#f3c9ff', '#a8f0ff', '#ffd6b0', '#cdbdff', '#ffffff'];
const BILL_W = 46;
const BILL_H = 20;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (min, max) => min + Math.random() * (max - min);

export class Fx {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.amount = reducedMotion ? 0.25 : 1;
    this.particles = [];
    this.queue = [];
    this.bills = [drawBill(false), drawBill(true)];
    this.raf = 0;
    this.lastTime = 0;
    this.frame = this.frame.bind(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  // Foil chips thrown off the finger while scratching.
  flakes(x, y, dx, dy) {
    const count = Math.round(Math.min(6, 1 + Math.hypot(dx, dy) / 10) * this.amount);
    for (let i = 0; i < count; i++) {
      this.add({
        kind: 'flake', x, y,
        vx: dx * rand(2, 8) + rand(-90, 90), vy: dy * rand(2, 8) + rand(-140, 40),
        gravity: 1100, drag: 1.5, size: rand(1.6, 3.6), color: pick(FOIL), ttl: rand(0.45, 0.9), spin: rand(-12, 12),
      });
    }
  }

  // The leftover foil breaking apart when the card reveals itself.
  shatter(rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 90 * this.amount; i++) {
      const x = rect.left + Math.random() * rect.width;
      const y = rect.top + Math.random() * rect.height;
      const angle = Math.atan2(y - cy, x - cx);
      const speed = rand(80, 420);
      this.add({
        kind: 'flake', x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 180,
        gravity: 1000, drag: 1.2, size: rand(2, 5), color: pick(FOIL), ttl: rand(0.7, 1.3), spin: rand(-14, 14),
      });
    }
  }

  burst(x, y, count = 120) {
    for (let i = 0; i < count * this.amount; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(250, 850);
      this.add({
        kind: 'confetti', x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 320,
        gravity: 650, drag: 2.2, size: rand(7, 12), color: pick(NEON), ttl: rand(2.2, 3.4),
        spin: rand(-8, 8), flipSpeed: rand(6, 14),
      });
    }
  }

  // Bills and confetti drifting down from the top, spread over `duration` ms.
  rain(count, duration) {
    const now = performance.now();
    for (let i = 0; i < count * this.amount; i++) this.queue.push(now + Math.random() * duration);
    this.queue.sort((a, b) => a - b);
    this.start();
  }

  clear() {
    this.particles.length = 0;
    this.queue.length = 0;
  }

  spawnDrop() {
    const bill = Math.random() < 0.7;
    this.add({
      kind: bill ? 'bill' : 'confetti',
      x: rand(-20, this.width + 20), y: -30,
      vx: rand(-30, 30), vy: rand(40, 140),
      gravity: bill ? 160 : 260, drag: bill ? 0.9 : 1.4,
      size: bill ? rand(0.8, 1.2) : rand(6, 10), color: pick(NEON), ttl: 9,
      spin: rand(-2, 2), flipSpeed: rand(2.5, 5.5), sway: rand(20, 60), swayRate: rand(1.2, 2.6),
    });
  }

  add(p) {
    p.life = 0;
    p.rot = rand(0, Math.PI * 2);
    p.flip = rand(0, Math.PI * 2);
    this.particles.push(p);
    this.start();
  }

  start() {
    if (this.raf) return;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    while (this.queue.length && this.queue[0] <= now) {
      this.queue.shift();
      this.spawnDrop();
    }
    this.update(dt);
    this.draw();
    this.raf = this.particles.length || this.queue.length ? requestAnimationFrame(this.frame) : 0;
  }

  update(dt) {
    const bottom = this.height + 60;
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.gravity * dt;
      p.x += p.vx * dt + (p.sway ? Math.cos(p.life * p.swayRate * Math.PI) * p.sway * dt : 0);
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.flip += (p.flipSpeed || 0) * dt;
      return p.life < p.ttl && p.y < bottom;
    });
  }

  draw() {
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.ttl - p.life) / 0.35);
      const cos = Math.cos(p.rot);
      const sin = Math.sin(p.rot);
      ctx.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, p.x * dpr, p.y * dpr);
      if (p.kind === 'bill') {
        // Scaling one axis by cos(flip) fakes the bill tumbling in 3D.
        const flip = Math.cos(p.flip);
        ctx.scale(p.size, p.size * flip);
        ctx.drawImage(this.bills[flip < 0 ? 1 : 0], -BILL_W / 2, -BILL_H / 2, BILL_W, BILL_H);
      } else if (p.kind === 'confetti') {
        ctx.scale(1, Math.cos(p.flip));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size * 0.22, p.size, p.size * 0.44);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawBill(back) {
  const scale = 3;
  const c = document.createElement('canvas');
  c.width = BILL_W * scale;
  c.height = BILL_H * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);

  const paper = g.createLinearGradient(0, 0, BILL_W, BILL_H);
  paper.addColorStop(0, back ? '#8db27a' : '#c3e0aa');
  paper.addColorStop(1, back ? '#5f8a52' : '#86b46f');
  g.fillStyle = paper;
  g.beginPath();
  g.roundRect(0, 0, BILL_W, BILL_H, 2);
  g.fill();

  g.strokeStyle = 'rgba(40, 80, 35, .7)';
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(2.5, 2.5, BILL_W - 5, BILL_H - 5, 1.5);
  g.stroke();

  g.fillStyle = back ? 'rgba(220, 240, 200, .35)' : 'rgba(235, 250, 220, .8)';
  g.beginPath();
  g.ellipse(BILL_W / 2, BILL_H / 2, 6.5, 6.5, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = 'rgba(45, 85, 40, .85)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 7px Manrope, sans-serif';
  g.fillText(back ? '100' : '$', BILL_W / 2, BILL_H / 2 + 0.5);
  g.font = '700 4.5px Manrope, sans-serif';
  g.fillText('100', 8, 6.5);
  g.fillText('100', BILL_W - 8, BILL_H - 6);
  return c;
}
