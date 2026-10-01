'use client';

import { useEffect, useRef } from 'react';
import { onBurst, pointer, prefersReducedMotion } from '@/lib/fx';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 0 = cyan, 1 = violet: picks the node's colour. */
  hue: number;
  /** Parallax depth: deeper nodes scroll slower. */
  z: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  hue: number;
  size: number;
}

const LINK_DISTANCE = 130;
const CURSOR_RADIUS = 180;
const MAX_SPARKS = 260;
const DARK_COLORS = ['57, 230, 255', '139, 92, 246', '255, 61, 203'];
const LIGHT_COLORS = ['22, 21, 15', '255, 90, 31', '63, 104, 224'];

/**
 * Full-screen network of drifting nodes behind the UI. Nodes link to their neighbours and to
 * the cursor, get pushed away from it, and the click/trail sparks share the same canvas. Node
 * count scales with the viewport and the loop pauses while the tab is hidden.
 */
export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = prefersReducedMotion();

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    const sparks: Spark[] = [];
    let frame = 0;
    let lastTrail = { x: pointer.x, y: pointer.y };

    const seed = () => {
      const count = Math.round(Math.min(110, Math.max(36, (width * height) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 0.6 + Math.random() * 1.5,
        hue: Math.random() < 0.72 ? 0 : 1,
        z: 0.25 + Math.random() * 0.75,
      }));
    };

    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const spawn = (x: number, y: number, count: number, speed: number) => {
      for (let i = 0; i < count && sparks.length < MAX_SPARKS; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const v = (0.4 + Math.random()) * speed;
        const max = 32 + Math.random() * 30;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v,
          life: max,
          max,
          hue: Math.floor(Math.random() * 3),
          size: 0.8 + Math.random() * 1.8,
        });
      }
    };

    const draw = () => {
      const dark = document.documentElement.dataset.theme !== 'light';
      const colors = dark ? DARK_COLORS : LIGHT_COLORS;
      const alphaScale = dark ? 1 : 0.45;
      const scrollY = window.scrollY;
      ctx.clearRect(0, 0, width, height);

      const cx = pointer.inside ? pointer.x : -9999;
      const cy = pointer.inside ? pointer.y : -9999;

      // Positions on screen, with depth-scaled scroll parallax wrapped into the viewport.
      const sx = new Float32Array(nodes.length);
      const sy = new Float32Array(nodes.length);
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (!reduce) {
          n.x += n.vx;
          n.y += n.vy;
          const ddx = n.x - cx;
          const ddy = n.y - ((cy + scrollY * n.z * 0.12) % height);
          const dist = Math.hypot(ddx, ddy);
          if (dist < CURSOR_RADIUS && dist > 0.01) {
            const push = (1 - dist / CURSOR_RADIUS) * 0.9;
            n.x += (ddx / dist) * push;
            n.y += (ddy / dist) * push;
          }
          if (n.x < -20) n.x = width + 20;
          if (n.x > width + 20) n.x = -20;
          if (n.y < -20) n.y = height + 20;
          if (n.y > height + 20) n.y = -20;
        }
        sx[i] = n.x;
        sy[i] = (((n.y - scrollY * n.z * 0.12) % height) + height) % height;
      }

      ctx.lineWidth = 0.7;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const ddx = sx[i] - sx[j];
          if (ddx > LINK_DISTANCE || ddx < -LINK_DISTANCE) continue;
          const ddy = sy[i] - sy[j];
          const dist = Math.hypot(ddx, ddy);
          if (dist > LINK_DISTANCE) continue;
          ctx.strokeStyle = `rgba(${colors[nodes[i].hue]}, ${((1 - dist / LINK_DISTANCE) * 0.16 * alphaScale).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(sx[i], sy[i]);
          ctx.lineTo(sx[j], sy[j]);
          ctx.stroke();
        }
      }

      // Nodes near the cursor wire themselves to it.
      if (pointer.inside) {
        ctx.lineWidth = 0.9;
        for (let i = 0; i < nodes.length; i += 1) {
          const dist = Math.hypot(sx[i] - cx, sy[i] - cy);
          if (dist > CURSOR_RADIUS) continue;
          ctx.strokeStyle = `rgba(${colors[0]}, ${((1 - dist / CURSOR_RADIUS) * 0.42 * alphaScale).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(sx[i], sy[i]);
          ctx.stroke();
        }
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const near = pointer.inside && Math.hypot(sx[i] - cx, sy[i] - cy) < CURSOR_RADIUS;
        ctx.fillStyle = `rgba(${colors[nodes[i].hue]}, ${((near ? 0.95 : 0.55) * alphaScale).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx[i], sy[i], nodes[i].r * (near ? 1.6 : 1), 0, Math.PI * 2);
        ctx.fill();
      }

      // Cursor trail: emit a spark every few pixels of travel.
      if (pointer.inside && !reduce) {
        const travelled = Math.hypot(pointer.x - lastTrail.x, pointer.y - lastTrail.y);
        if (travelled > 14) {
          spawn(pointer.x, pointer.y, 1, 0.35);
          lastTrail = { x: pointer.x, y: pointer.y };
        }
      }

      if (sparks.length > 0) {
        ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
          const s = sparks[i];
          s.x += s.vx;
          s.y += s.vy;
          s.vx *= 0.93;
          s.vy *= 0.93;
          s.vy += 0.015;
          s.life -= 1;
          if (s.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          const k = s.life / s.max;
          ctx.fillStyle = `rgba(${colors[s.hue]}, ${(k * 0.9 * alphaScale).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * (0.4 + k), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    };

    const loop = () => {
      draw();
      frame = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (!frame) frame = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    const offBurst = onBurst(({ x, y, power }) => {
      if (!reduce) spawn(x, y, Math.round(10 * power), 2.2 + power);
    });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    if (reduce) draw();
    else start();

    return () => {
      stop();
      offBurst();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="fx-particles" aria-hidden="true" />;
}
