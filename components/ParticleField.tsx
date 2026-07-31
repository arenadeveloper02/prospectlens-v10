"use client"

import { useEffect, useRef } from 'react';

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
    }

    let particles: Particle[] = [];
    let raf = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.min(70, Math.floor((canvas.width * canvas.height) / 26000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    const step = () => {
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;
      const context = currentCanvas.getContext('2d');
      if (!context) return;

      context.clearRect(0, 0, currentCanvas.width, currentCanvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > currentCanvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > currentCanvas.height) p.vy *= -1;
        context.beginPath();
        context.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        context.fillStyle = 'rgba(122, 168, 255, 0.35)';
        context.fill();
      }

      for (let a = 0; a < particles.length; a++) {
        for (let b = a + 1; b < particles.length; b++) {
          const pa = particles[a];
          const pb = particles[b];
          if (!pa || !pb) continue;
          const dx = pa.x - pb.x;
          const dy = pa.y - pb.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            context.beginPath();
            context.moveTo(pa.x, pa.y);
            context.lineTo(pb.x, pb.y);
            context.strokeStyle = `rgba(96, 140, 235, ${0.1 * (1 - dist / 130)})`;
            context.lineWidth = 1;
            context.stroke();
          }
        }
      }

      raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" aria-hidden="true" />;
}
