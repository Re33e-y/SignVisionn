export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1
  color: string;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private readonly maxParticles = 200;

  emit(x: number, y: number, count = 10, color = '#39FF14') {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > this.maxParticles) {
        this.particles.shift();
      }
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color
      });
    }
  }

  update(dt: number) {
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025 * dt; // decay
    });
    this.particles = this.particles.filter(p => p.life > 0);
  }

  draw(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D) {
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}
