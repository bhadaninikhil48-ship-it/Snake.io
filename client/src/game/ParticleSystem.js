/**
 * ParticleSystem - High-performance cyber neon particle effects
 */

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  reset() {
    this.particles = [];
  }

  /**
   * Spawn a burst of neon sparks when food is consumed
   */
  emitFoodSparks(pixelX, pixelY, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 1.5 + Math.random() * 4.5;
      this.particles.push({
        x: pixelX,
        y: pixelY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: color,
        alpha: 1.0,
        decay: 0.025 + Math.random() * 0.035,
      });
    }
  }

  /**
   * Spawn dramatic death explosion particles when snake crashes
   */
  emitDeathExplosion(segments, cellSize) {
    // Spawn particles from head and along snake body
    segments.slice(0, 15).forEach((seg, idx) => {
      const px = seg.x * cellSize + cellSize / 2;
      const py = seg.y * cellSize + cellSize / 2;
      const count = idx === 0 ? 30 : 6;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 6;
        this.particles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 4,
          color: idx === 0 ? '#ff2e63' : '#00f3ff',
          alpha: 1.0,
          decay: 0.015 + Math.random() * 0.02,
        });
      }
    });
  }

  /**
   * Update particle positions and fade
   */
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94; // Air friction
      p.vy *= 0.94;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Render particles onto canvas
   */
  draw(ctx) {
    if (this.particles.length === 0) return;

    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
