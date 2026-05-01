import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { makeFxState, usePlayback } from './playback';

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

function rectFromDrag(d: DragState, spriteX: number, spriteY: number) {
  const x = Math.round(Math.min(d.startX, d.curX) - spriteX);
  const y = Math.round(Math.min(d.startY, d.curY) - spriteY);
  const w = Math.round(Math.abs(d.curX - d.startX));
  const h = Math.round(Math.abs(d.curY - d.startY));
  return { x, y, w, h };
}

export default function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef(makeFxState());
  const dragRef = useRef<DragState>({ active: false, startX: 0, startY: 0, curX: 0, curY: 0 });
  usePlayback(fxRef);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    const draw = () => {
      const s = useStore.getState();
      const fx = fxRef.current;
      const drag = dragRef.current;
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
      const spriteX = cx - img.width * a.anchor.x;
      const spriteY = cy - img.height * a.anchor.y;

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

      // Committed hitbox
      if (s.showHitbox && frame.hitbox) {
        const hx = spriteX + frame.hitbox.x;
        const hy = spriteY + frame.hitbox.y;
        ctx.save();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(248,113,113,0.18)';
        ctx.fillRect(hx, hy, frame.hitbox.w, frame.hitbox.h);
        ctx.strokeRect(hx, hy, frame.hitbox.w, frame.hitbox.h);
        // corner handles
        const cs = 5;
        ctx.fillStyle = '#f87171';
        for (const [hcx, hcy] of [
          [hx, hy], [hx + frame.hitbox.w, hy],
          [hx, hy + frame.hitbox.h], [hx + frame.hitbox.w, hy + frame.hitbox.h],
        ] as [number, number][]) {
          ctx.fillRect(hcx - cs / 2, hcy - cs / 2, cs, cs);
        }
        // label
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.fillText(
          `${frame.hitbox.x}, ${frame.hitbox.y}  ${frame.hitbox.w}×${frame.hitbox.h}`,
          hx + 3, hy - 4
        );
        ctx.restore();
      }

      // In-progress drag preview
      if (s.showHitbox && drag.active) {
        const r = rectFromDrag(drag, spriteX, spriteY);
        const hx = spriteX + r.x;
        const hy = spriteY + r.y;
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.fillStyle = 'rgba(251,191,36,0.15)';
        ctx.fillRect(hx, hy, r.w, r.h);
        ctx.strokeRect(hx, hy, r.w, r.h);
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.setLineDash([]);
        ctx.fillText(`${r.x}, ${r.y}  ${r.w}×${r.h}`, hx + 3, hy - 4);
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

  // Resize canvas
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

  // Hitbox mouse handlers
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = useStore.getState();
    if (!s.showHitbox || !s.loaded) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragRef.current = { active: true, startX: x, startY: y, curX: x, curY: y };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    dragRef.current.curX = e.clientX - rect.left;
    dragRef.current.curY = e.clientY - rect.top;
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;

    const s = useStore.getState();
    if (!s.loaded) return;
    const a = s.loaded.anim;
    const img = s.loaded.images[a.frames[s.currentFrame].src];
    if (!img) return;

    const canvas = canvasRef.current!;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H * 0.85;
    const spriteX = cx - img.width * a.anchor.x;
    const spriteY = cy - img.height * a.anchor.y;

    const r = rectFromDrag(drag, spriteX, spriteY);
    if (r.w < 4 || r.h < 4) return; // ignore accidental clicks
    useStore.getState().updateFrame(s.currentFrame, { hitbox: r });
  };

  const showHitbox = useStore((s) => s.showHitbox);

  return (
    <div className="checkerboard flex-1 relative min-h-0">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ cursor: showHitbox ? 'crosshair' : 'default' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />
      {showHitbox && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-amber-300 text-xs px-2.5 py-1 rounded-full pointer-events-none">
          Drag to draw hitbox on this frame
        </div>
      )}
    </div>
  );
}
