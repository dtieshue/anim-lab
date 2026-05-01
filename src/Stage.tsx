import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { makeFxState, usePlayback } from './playback';

export default function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef(makeFxState());
  usePlayback(fxRef);

  // Render loop: pulls all draw state from the store on each frame so we don't
  // need to subscribe to individual fields here.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    const draw = () => {
      const s = useStore.getState();
      const fx = fxRef.current;
      const a = s.loaded?.anim;
      const W = canvas.width;
      const H = canvas.height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (!a || !s.loaded) {
        raf = requestAnimationFrame(draw);
        return;
      }

      let shakeX = 0, shakeY = 0;
      if (fx.shakeRemainingMs > 0 && fx.shakeTotalMs > 0) {
        const k = fx.shakeRemainingMs / fx.shakeTotalMs;
        const m = fx.shakeMagnitude * k;
        shakeX = (Math.random() * 2 - 1) * m;
        shakeY = (Math.random() * 2 - 1) * m;
      }

      const frame = a.frames[s.currentFrame];
      const img = s.loaded.images[frame.src];
      if (!img) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const cx = W / 2 + shakeX;
      const cy = H * 0.85 + shakeY;

      const drawFrame = (idx: number, alpha: number, tint?: string) => {
        const fr = a.frames[idx];
        if (!fr) return;
        const im = s.loaded!.images[fr.src];
        if (!im) return;
        const x = cx - im.width * a.anchor.x;
        const y = cy - im.height * a.anchor.y;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (tint) {
          ctx.drawImage(im, x, y);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = tint;
          ctx.fillRect(x, y, im.width, im.height);
        } else if (s.showSilhouette && idx === s.currentFrame) {
          ctx.drawImage(im, x, y);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y, im.width, im.height);
        } else {
          ctx.drawImage(im, x, y);
        }
        ctx.restore();
      };

      if (s.showOnion) {
        if (s.currentFrame - 2 >= 0) drawFrame(s.currentFrame - 2, 0.20);
        if (s.currentFrame - 1 >= 0) drawFrame(s.currentFrame - 1, 0.35);
      }

      drawFrame(s.currentFrame, 1.0);

      if (s.showOnion && s.currentFrame + 1 < a.frames.length) {
        drawFrame(s.currentFrame + 1, 0.25, 'rgba(80, 220, 255, 0.9)');
      }

      if (s.showHitbox && frame.hitbox) {
        const x = cx - img.width * a.anchor.x + frame.hitbox.x;
        const y = cy - img.height * a.anchor.y + frame.hitbox.y;
        ctx.save();
        ctx.strokeStyle = '#ff4d6d';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255,77,109,0.25)';
        ctx.fillRect(x, y, frame.hitbox.w, frame.hitbox.h);
        ctx.strokeRect(x, y, frame.hitbox.w, frame.hitbox.h);
        ctx.restore();
      }

      if (s.showAnchor) {
        ctx.save();
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
        ctx.stroke();
        ctx.fillStyle = 'rgba(167,139,250,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      if (fx.flashRemainingMs > 0 && fx.flashTotalMs > 0) {
        const k = fx.flashRemainingMs / fx.flashTotalMs;
        const alpha = k > 0.5 ? 1.0 : 0.5;
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Resize canvas to its container in CSS pixels.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const el = canvas.parentElement!;
    const ro = new ResizeObserver(() => {
      canvas.width = el.clientWidth;
      canvas.height = el.clientHeight;
    });
    ro.observe(el);
    canvas.width = el.clientWidth;
    canvas.height = el.clientHeight;
    return () => ro.disconnect();
  }, []);

  return (
    <div className="checkerboard flex-1 relative min-h-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
