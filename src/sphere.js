// The "mind" — a rotating constellation sphere rendered on a 2D canvas using a
// simple perspective projection. Each node is one unit of knowledge the panel
// holds (a knowledge-base entry, a registered project/task, an exchanged
// conversation turn); the sphere visibly grows denser as those accumulate.

function fibonacciSphere(count) {
  const points = [];
  const offset = 2 / count;
  const increment = Math.PI * (3 - Math.sqrt(5)); // golden angle
  for (let i = 0; i < count; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * increment;
    points.push({ x: Math.cos(phi) * r, y, z: Math.sin(phi) * r });
  }
  return points;
}

function angularDist(a, b) {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

export class MindSphere {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.angleY = 0;
    this.angleX = 0.25;
    this.nodes = [];
    this.edges = [];
    this.speaking = false;
    this.energy = 0; // 0..1, spikes on each spoken word boundary and decays each frame
    this._raf = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  // Called while JARVIS is actively speaking (true) or once it stops (false) —
  // speeds up rotation for the duration so the sphere visibly "comes alive"
  // while talking, rather than spinning at the same idle pace always.
  setSpeaking(active) {
    this.speaking = active;
    if (!active) this.energy = 0;
  }

  // Called on each spoken word/sentence boundary to give the sphere a quick,
  // organic pulse roughly timed to speech, on top of the steady speaking boost.
  pulse(amount = 0.5) {
    this.energy = Math.min(1, this.energy + amount);
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.max(200, Math.min(rect.width, 460));
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = size;
  }

  setNodes(specs) {
    // specs: [{ color }] — one entry per knowledge unit.
    const positions = fibonacciSphere(Math.max(specs.length, 8));
    this.nodes = specs.map((s, i) => ({ ...positions[i], color: s.color }));

    // Build a light constellation graph: connect each node to its ~2 nearest
    // neighbors so it reads as constellations, not a solid mesh.
    this.edges = [];
    const maxDegree = 2;
    for (let i = 0; i < this.nodes.length; i++) {
      const dists = [];
      for (let j = 0; j < this.nodes.length; j++) {
        if (i === j) continue;
        dists.push([j, angularDist(this.nodes[i], this.nodes[j])]);
      }
      dists.sort((a, b) => a[1] - b[1]);
      for (let k = 0; k < Math.min(maxDegree, dists.length); k++) {
        const j = dists[k][0];
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!this.edges.some((e) => e.key === key)) {
          this.edges.push({ key, a: i, b: j });
        }
      }
    }
  }

  start() {
    if (this._raf) return;
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const speed = 0.18 + (this.speaking ? 0.3 : 0) + this.energy * 0.5;
      this.angleY += dt * speed;
      this.energy = Math.max(0, this.energy - dt * 1.1);
      this._draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _project(p) {
    const cosY = Math.cos(this.angleY), sinY = Math.sin(this.angleY);
    const cosX = Math.cos(this.angleX), sinX = Math.sin(this.angleX);
    let x = p.x * cosY - p.z * sinY;
    let z = p.x * sinY + p.z * cosY;
    let y = p.y * cosX - z * sinX;
    z = p.y * sinX + z * cosX;
    const dist = 2.6;
    const scale = dist / (dist - z);
    const half = this.size / 2;
    const radius = half * 0.82;
    return {
      x: half + x * radius * scale,
      y: half + y * radius * scale,
      z,
      scale,
    };
  }

  _draw() {
    const ctx = this.ctx;
    const half = this.size / 2;
    ctx.clearRect(0, 0, this.size, this.size);

    const projected = this.nodes.map((n) => ({ ...this._project(n), color: n.color }));

    // faint outer ring (Newton's-rings nod)
    ctx.save();
    ctx.strokeStyle = 'rgba(180,190,220,0.08)';
    for (let r = half * 0.3; r < half * 0.95; r += half * 0.16) {
      ctx.beginPath();
      ctx.arc(half, half, r, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // edges
    ctx.lineWidth = 1;
    for (const e of this.edges) {
      const a = projected[e.a], b = projected[e.b];
      if (!a || !b) continue;
      const depth = (a.z + b.z) / 2;
      const alpha = 0.05 + Math.max(0, (depth + 1) / 2) * 0.16;
      ctx.strokeStyle = `rgba(200,210,240,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes, back-to-front — pulse size/brightness with speaking energy
    const pulse = 1 + this.energy * 0.7;
    projected
      .map((p, i) => ({ ...p, i }))
      .sort((a, b) => a.z - b.z)
      .forEach((p) => {
        const depth = (p.z + 1) / 2; // 0 back, 1 front
        const r = (1.1 + depth * 2.1) * pulse;
        const alpha = Math.min(1, (0.35 + depth * 0.65) * (1 + this.energy * 0.4));
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      });
  }
}
