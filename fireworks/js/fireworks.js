import { CONFIG } from 'winter/config';
import { random } from 'winter/landscape';
import { SparkRenderer } from 'winter/renderer';

const TAU = Math.PI * 2;
const TYPES = ['peony', 'chrysanthemum', 'willow', 'ring', 'saturn', 'double', 'palm', 'crossette'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export class Fireworks {
  constructor(canvas, landscape, onSound) {
    this.renderer = new SparkRenderer(canvas, CONFIG.maximumParticles);
    this.canvas = canvas; this.landscape = landscape; this.onSound = onSound;
    this.rng = random(866); this.rockets = []; this.sparks = []; this.halos = [];
    this.scheduled = []; this.secondary = []; this.count = 0; this.burstCount = 0;
    this.time = 0; this.charge = null; this.reduced = false; this.lastPower = 0;
    this.light = { x: 0, intensity: 0, color: CONFIG.fireworkPalette[0] };
    this.showStarted = null; this.showDuration = 60; this.cycle = 0;
    this.stage = 'idle'; this.lastBurst = null; this.lastLaunch = null; this.lastManual = -10;
    this.typesSeen = new Set(); this.colorsSeen = new Set();
  }
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr; this.renderer.resize(w, h, dpr);
    this.rockets.length = this.sparks.length = this.halos.length = this.secondary.length = 0;
    this.charge = null;
    if (this.showStarted !== null) { this.showStarted = this.time; this.scheduleCycle(); }
  }
  safeTarget(x, y) { return { x: clamp(x, 1, this.w - 1), y: clamp(y, 1, this.h - 1) }; }
  manual(x, y, power = 1) {
    if (this.time - this.lastManual < .10) return false;
    this.lastManual = this.time;
    return this.launch(x, y, power, { type: TYPES[(this.count + this.cycle) % TYPES.length] });
  }
  launch(x, y, power = 1, options = {}) {
    if (this.rockets.length >= 26) return false;
    const target = this.safeTarget(x, y); ++this.count; this.lastPower = power;
    const shell = { ...target, power, color: options.color ?? this.count % CONFIG.fireworkPalette.length,
      type: options.type ?? TYPES[this.count % TYPES.length], silent: options.silent };
    this.typesSeen.add(shell.type); this.colorsSeen.add(shell.color);
    this.lastLaunch = { ...target, type: shell.type, power, at: this.time };
    if (this.reduced) { this.staticBurst(shell); return true; }
    const sx = options.sx ?? clamp(target.x + (this.rng() - .5) * this.w * .3, this.w * .04, this.w * .96);
    const sy = this.h + 12;
    this.rockets.push({ ...shell, tx: target.x, ty: target.y, x: sx, y: sy, sx, sy, age: 0,
      duration: .58 + Math.abs(sy - target.y) / this.h * .68 + this.rng() * .18,
      bend: (this.rng() - .5) * Math.min(this.w * .08, 50), trail: [], trailClock: 0 });
    this.onSound?.('launch', power, shell.silent, target.x / this.w); return true;
  }
  show(silent = false) {
    if (this.showStarted !== null) return false;
    if (this.reduced) { this.launch(this.w * .55, this.h * .38, 1.5, { silent }); return true; }
    this.showStarted = this.time; this.cycle = 1; this.showSilent = silent;
    this.stage = 'kindling'; this.scheduleCycle(); return true;
  }
  scheduleCycle() {
    this.scheduled.length = 0;
    const base = this.showStarted, cycle = this.cycle, palette = CONFIG.fireworkPalette.length;
    const volley = (at, n, power, spread, theme) => {
      for (let i = 0; i < n; i++) {
        const row = n === 1 ? .5 + (this.rng() - .5) * .5 : .07 + i / (n - 1) * .86;
        const x = clamp(.5 + (row - .5) * spread + (this.rng() - .5) * .05, .06, .94);
        this.scheduled.push({ at: base + at + i * .10, x: x * this.w, y: (.17 + this.rng() * .28) * this.h,
          power: power * (.78 + this.rng() * .36), color: (theme + i + cycle * 2) % palette,
          type: TYPES[(theme + i + cycle) % TYPES.length], silent: this.showSilent,
          sx: this.w * (.10 + i / Math.max(1, n - 1) * .80) });
      }
    };
    [0, 3.8, 7.8].forEach((t, i) => volley(t, 1, .58 + i * .08, .6, i));
    [12, 15.4, 18.8, 22.2].forEach((t, i) => volley(t, 2, .84, .9, i + 1));
    [26, 28.5, 31, 33.5, 36].forEach((t, i) => volley(t, 4, 1.04, 1, i + 2));
    [39, 41.1, 43.2, 45.3, 47.4, 49.5].forEach((t, i) => volley(t, 7, 1.24, 1, i));
    volley(51, 10, 1.5, 1, cycle); volley(55.8, 1, .63, .9, 0);
    this.scheduled.sort((a, b) => a.at - b.at);
  }
  stopShow() { this.scheduled.length = 0; this.showStarted = null; this.stage = 'idle'; }
  get showElapsed() { return this.showStarted === null ? 0 : this.time - this.showStarted; }
  get intensity() {
    if (this.showStarted === null) return 0;
    const t = this.showElapsed;
    return t < 39 ? .08 + .92 * smooth(t / 39) : t < 52 ? 1 : 1 - smooth((t - 52) / 8);
  }
  burst(shell) {
    const { x, y, power, color, type, silent } = shell, rng = this.rng;
    ++this.burstCount; this.lastBurst = { x, y, power, type, color, at: this.time };
    const scale = Math.min(this.w, this.h) / 760;
    const limit = this.renderer.mode === 'webgl' ? CONFIG.maximumParticles : 2600;
    const count = type === 'ring' ? 145 : type === 'palm' ? 210 : type === 'chrysanthemum' ? 300 : 230;
    const amount = Math.min(Math.round(count * Math.sqrt(power)), Math.max(0, limit - this.sparks.length));
    const rotation = rng() * TAU, tilt = .45 + rng() * .25;
    for (let i = 0; i < amount; i++) {
      const ring = type === 'ring' || (type === 'saturn' && i % 3 !== 0);
      const palm = type === 'palm', willow = type === 'willow';
      let angle = ring ? i / amount * TAU : i * 2.3999632297 + rng() * .06;
      if (palm) angle = Math.round(angle / TAU * 9) / 9 * TAU + (rng() - .5) * .07;
      const depth = 1 - 2 * (i + .5) / amount;
      const radius = ring ? 1 : Math.sqrt(Math.max(0, 1 - depth * depth));
      const layer = type === 'chrysanthemum' ? .92 + rng() * .08 : .72 + rng() * .28;
      const speed = (willow ? 195 : ring ? 225 : palm ? 250 : 245) * scale * power * layer;
      let vx = Math.cos(angle) * radius * speed, vy = Math.sin(angle) * radius * speed;
      if (ring) {
        const ry = vy * (type === 'saturn' ? .30 : .66);
        vx = vx * Math.cos(rotation) - ry * Math.sin(rotation);
        vy = Math.cos(angle) * radius * speed * Math.sin(rotation) + ry * Math.cos(rotation);
      }
      let particleColor = color;
      if (type === 'saturn' && !ring) particleColor = (color + 3) % CONFIG.fireworkPalette.length;
      if (type === 'double' && i % 5 === 0) particleColor = 1;
      const historySize = willow ? 26 : type === 'chrysanthemum' || palm ? 19 : 12;
      this.sparks.push({ x, y, vx, vy, age: 0, life: (willow ? 3.8 : palm ? 3.0 : 2.35) + rng() * .7,
        color: particleColor, afterColor: willow ? 0 : (particleColor + 2) % CONFIG.fireworkPalette.length,
        phase: rng() * TAU, willow, twinkle: type === 'chrysanthemum' || i % 6 === 0,
        gravity: (willow ? 29 : palm ? 38 : ring ? 12 : 30) * scale,
        drag: willow ? .42 : ring ? .68 : .62, size: (.85 + rng() * .7) * Math.max(.75, scale),
        history: new Float32Array(historySize * 2), historySize, index: 0, samples: 0,
        clock: 0, reflect: i % 4 === 0 });
    }
    if (!shell.child && type === 'double') this.secondary.push({ ...shell, at: this.time + .48, type: 'peony', color: (color + 3) % CONFIG.fireworkPalette.length, power: power * .62, child: true });
    if (!shell.child && type === 'crossette') {
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + tilt;
        this.secondary.push({ ...shell, at: this.time + .68, x: x + Math.cos(a) * scale * power * 114, y: y + Math.sin(a) * scale * power * 114, power: power * .3, color: (color + i + 1) % CONFIG.fireworkPalette.length, type: 'peony', child: true });
      }
    }
    this.halos.push({ x, y, power, color, age: 0, life: .7 });
    this.light = { x, intensity: Math.min(1, .55 * power), color: CONFIG.fireworkPalette[color] };
    this.onSound?.(shell.child ? 'crackle' : 'burst', power, silent, x / this.w);
  }
  staticBurst(shell) {
    this.sparks.length = this.rockets.length = this.halos.length = 0;
    this.burst({ ...shell, child: true }); this.update(.6, this.time);
    for (const p of this.sparks) p.vx = p.vy = 0;
    this.draw(); this.sparks.length = 0;
  }
  setCharge(x, y, amount) { this.charge = { x, y, amount }; }
  update(dt, time) {
    this.time = time;
    if (this.showStarted !== null) {
      if (time - this.showStarted >= this.showDuration) { this.showStarted += this.showDuration; ++this.cycle; this.scheduleCycle(); }
      const t = this.showElapsed;
      this.stage = t < 12 ? 'kindling' : t < 26 ? 'gathering' : t < 39 ? 'blooming' : t < 53 ? 'finale' : 'afterglow';
    }
    while (this.scheduled.length && time >= this.scheduled[0].at) { const shot = this.scheduled.shift(); this.launch(shot.x, shot.y, shot.power, shot); }
    for (let i = this.secondary.length - 1; i >= 0; i--) if (time >= this.secondary[i].at) { const shot = this.secondary.splice(i, 1)[0]; this.burst(shot); }
    this.light.intensity *= Math.exp(-dt * 2.5);
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]; r.age += dt;
      const t = Math.min(1, r.age / r.duration), e = 1 - (1 - t) ** 1.75;
      r.x = r.sx + (r.tx - r.sx) * e + Math.sin(t * Math.PI) * r.bend; r.y = r.sy + (r.ty - r.sy) * e;
      r.trailClock += dt;
      if (r.trailClock >= .018) { r.trailClock %= .018; r.trail.unshift({ x: r.x, y: r.y }); if (r.trail.length > 38) r.trail.pop(); }
      if (t === 1) { this.burst(r); this.rockets.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i]; p.age += dt;
      if (p.age > p.life) { this.sparks[i] = this.sparks[this.sparks.length - 1]; this.sparks.pop(); continue; }
      p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.clock += dt;
      if (p.clock >= .026) { p.clock %= .026; p.history[p.index * 2] = p.x; p.history[p.index * 2 + 1] = p.y; p.index = (p.index + 1) % p.historySize; p.samples = Math.min(p.samples + 1, p.historySize); }
    }
    for (let i = this.halos.length - 1; i >= 0; i--) { this.halos[i].age += dt; if (this.halos[i].age > this.halos[i].life) this.halos.splice(i, 1); }
  }
  draw() {
    const r = this.renderer, palette = CONFIG.fireworkPalette, w = this.w, h = this.h; r.begin();
    for (const rocket of this.rockets) {
      for (let j = 1; j < rocket.trail.length; j++) r.line(rocket.trail[j - 1].x, rocket.trail[j - 1].y, rocket.trail[j].x, rocket.trail[j].y, palette[0], (1 - j / rocket.trail.length) * .8);
      r.point(rocket.x, rocket.y, 11, palette[0], 1);
    }
    for (const p of this.sparks) {
      const t = p.age / p.life, fade = Math.min(1, p.age * 20) * Math.pow(1 - t, p.willow ? .65 : 1.0);
      const flicker = p.twinkle && t > .43 ? .38 + .62 * Math.max(0, Math.sin(p.age * 29 + p.phase)) : 1;
      const alpha = fade * flicker, color = palette[t > .72 ? p.afterColor : p.color]; if (alpha < .012) continue;
      let x = p.x, y = p.y;
      for (let j = 0; j < p.samples; j++) {
        const ix = (p.index - 1 - j + p.historySize) % p.historySize, nx = p.history[ix * 2], ny = p.history[ix * 2 + 1], a = alpha * (1 - j / p.samples) * .76;
        r.line(x, y, nx, ny, color, a, a * .83); x = nx; y = ny;
      }
      r.point(p.x, p.y, (p.twinkle ? 7.5 : 6) * p.size, color, alpha);
      if (p.reflect) {
        const yy = this.landscape.shoreY + (h * .55 - p.y) * .28 + (Math.sin(p.phase) * .04 + .03) * h, xx = p.x + Math.sin(yy * .19 + this.time * 1.2) * 3;
        if (this.landscape.isWater(xx, yy)) r.line(xx - 3 - p.size * 3, yy, xx + 3 + p.size * 3, yy, color, alpha * .27);
      }
    }
    for (const p of this.halos) r.point(p.x, p.y, Math.min(w, h) * (.06 + p.age * .13) * p.power, palette[p.color], (1 - p.age / p.life) ** 2 * .6);
    if (this.charge) {
      const { x, y, amount } = this.charge; r.point(x, y, 20 + amount * 45, palette[0], .5);
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + this.time * 1.4, rr = 12 + 17 * (1 - amount); r.point(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 4, palette[0], .6); }
    }
    r.finish();
  }
  snapshot() {
    return { launched: this.count, bursts: this.burstCount, rockets: this.rockets.length,
      particles: this.sparks.length, scheduled: this.scheduled.length, secondary: this.secondary.length,
      charged: !!this.charge, lastPower: this.lastPower, lastLaunch: this.lastLaunch, lastBurst: this.lastBurst,
      stage: this.stage, cycle: this.cycle, intensity: this.intensity, showElapsed: this.showElapsed,
      showDuration: this.showDuration, typesSeen: [...this.typesSeen], colorsSeen: [...this.colorsSeen], renderer: this.renderer.mode };
  }
}
