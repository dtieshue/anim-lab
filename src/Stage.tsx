import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { makeFxState, usePlayback } from './playback';

interface HitboxDrag {
  kind: 'hitbox';
  active: boolean;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

interface AnchorDrag {
  kind: 'anchor';
  active: boolean;
}

type DragState = HitboxDrag | AnchorDrag | { kind: 'none' };

function rectFromDrag(d: HitboxDrag, spriteX: number, spriteY: number) {
  const x = Math.round(Math.min(d.startX, d.curX) - spriteX);
  const y = Math.round(Math.min(d.startY, d.curY) - spriteY);
  const w = Math.round(Math.abs(d.curX - d.startX));
  const h = Math.round(Math.abs(d.curY - d.startY));
  return { x, y, w, h };
}

const ANCHOR_HIT_RADIUS = 14; // px — grab zone around crosshair

export default function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef(makeFxState());
  const dragRef = useRef<DragState>({ kind: 'none' });
  usePlayback(fxRef);

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

      if (!a || !s.loaded) { raf = requestAnimationFrame(draw); return; }

      let shakeX = 0, shakeY = 0;
      if (fx.shakeRemainingMs > 0 && fx.shakeTotalMs > 0) {
        const k = fx.shakeRemainingMs / fx.shakeTotalMs;
        const m = fx.shakeMagnitude * k;
        shakeX = (Math.random() * 2 - 1) * m;
        shakeY = (Math.random() * 2 - 1) * m;
      }

      const frame = a.frames[s.currentFrame];
      const img = s.loaded.images[frame.src];
      if (!img) { raf = requestAnimationFrame(draw); return; }

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
        const cs = 5;
        ctx.fillStyle = '#f87171';
        for (const [hcx, hcy] of [
          [hx, hy], [hx + frame.hitbox.w, hy],
          [hx, hy + frame.hitbox.h], [hx + frame.hitbox.w, hy + frame.hitbox.h],
        ] as [number, number][]) {
          ctx.fillRect(hcx - cs / 2, hcy - cs / 2, cs, cs);
        }
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.fillText(`${frame.hitbox.x}, ${frame.hitbox.y}  ${frame.hitbox.w}×${frame.hitbox.h}`, hx + 3, hy - 4);
        ctx.restore();
      }

      // Hitbox drag preview
      if (s.showHitbox && drag.kind === 'hitbox' && drag.active) {
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

      // Anchor crosshair
      if (s.showAnchor) {
        const dragging = drag.kind === 'anchor' && drag.active;
        ctx.save();
        ctx.strokeStyle = dragging ? '#c4b5fd' : '#a78bfa';
        ctx.lineWidth = dragging ? 1.5 : 1;
        // crosshair lines
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy);
        ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12);
        ctx.stroke();
        // center dot
        ctx.fillStyle = dragging ? '#c4b5fd' : 'rgba(167,139,250,0.9)';
        ctx.beginPath(); ctx.arc(cx, cy, dragging ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
        // grab ring hint when showAnchor is on
        if (!dragging) {
          ctx.strokeStyle = 'rgba(167,139,250,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(cx, cy, ANCHOR_HIT_RADIUS, 0, Math.PI * 2); ctx.stroke();
        }
        // normalized value label
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = dragging ? '#c4b5fd' : 'rgba(167,139,250,0.8)';
        ctx.fillText(
          `${a.anchor.x.toFixed(2)}, ${a.anchor.y.toFixed(2)}`,
          cx + 15, cy - 4
        );
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

  const showAnchor = useStore((s) => s.showAnchor);
  const showHitbox = useStore((s) => s.showHitbox);

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getAnchorPos = () => {
    const canvas = canvasRef.current!;
    return { cx: canvas.width / 2, cy: canvas.height * 0.85 };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = useStore.getState();
    if (!s.loaded) return;
    const { x, y } = getCanvasPos(e);
    const { cx, cy } = getAnchorPos();

    // Anchor grab takes priority when showAnchor is on
    if (s.showAnchor) {
      const dx = x - cx, dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= ANCHOR_HIT_RADIUS) {
        dragRef.current = { kind: 'anchor', active: true };
        return;
      }
    }

    if (s.showHitbox) {
      dragRef.current = { kind: 'hitbox', active: true, startX: x, startY: y, curX: x, curY: y };
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.kind === 'none' || !drag.active) return;
    const s = useStore.getState();
    if (!s.loaded) return;

    if (drag.kind === 'anchor') {
      const { x, y } = getCanvasPos(e);
      const canvas = canvasRef.current!;
      const W = canvas.width;
      const H = canvas.height;
      const a = s.loaded.anim;
      const img = s.loaded.images[a.frames[s.currentFrame].src];
      if (!img) return;
      // The anchor point on screen is always at (W/2, H*0.85).
      // anchor.x = (W/2 - spriteX) / img.width  where spriteX = W/2 - img.width*anchor.x
      // Rearranged: new anchor.x = (x - (W/2 - img.width*a.anchor.x)) / img.width ...
      // Simpler: delta in px maps to delta in anchor units
      // spriteTopLeft.x = W/2 - img.width*anchor.x, so anchor.x = (W/2 - spriteTopLeft.x)/img.width
      // When we drag, the sprite stays put — we're moving the anchor POINT within the sprite.
      // New anchor point in canvas coords = (x, y).
      // anchor.x = (x - spriteX) / img.width, anchor.y = (y - spriteY) / img.height
      const spriteX = W / 2 - img.width * a.anchor.x;
      const spriteY = H * 0.85 - img.height * a.anchor.y;
      const newAx = Math.max(0, Math.min(1, (x - spriteX) / img.width));
      const newAy = Math.max(0, Math.min(1, (y - spriteY) / img.height));
      s.updateAnim({ anchor: { x: Math.round(newAx * 100) / 100, y: Math.round(newAy * 100) / 100 } });
      return;
    }

    if (drag.kind === 'hitbox') {
      const { x, y } = getCanvasPos(e);
      drag.curX = x;
      drag.curY = y;
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.kind === 'none' || !drag.active) return;

    if (drag.kind === 'anchor') {
      dragRef.current = { kind: 'none' };
      return;
    }

    if (drag.kind === 'hitbox') {
      drag.active = false;
      const s = useStore.getState();
      if (!s.loaded) return;
      const a = s.loaded.anim;
      const img = s.loaded.images[a.frames[s.currentFrame].src];
      if (!img) return;
      const canvas = canvasRef.current!;
      const W = canvas.width, H = canvas.height;
      const spriteX = W / 2 - img.width * a.anchor.x;
      const spriteY = H * 0.85 - img.height * a.anchor.y;
      const r = rectFromDrag(drag, spriteX, spriteY);
      if (r.w < 4 || r.h < 4) { dragRef.current = { kind: 'none' }; return; }
      s.updateFrame(s.currentFrame, { hitbox: r });
      dragRef.current = { kind: 'none' };
    }
  };

  const cursor = (() => {
    if (showAnchor) return 'default'; // crosshair shown near anchor, but default elsewhere
    if (showHitbox) return 'crosshair';
    return 'default';
  })();

  return (
    <div className="checkerboard flex-1 relative min-h-0">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />
      {showHitbox && !showAnchor && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-amber-300 text-xs px-2.5 py-1 rounded-full pointer-events-none">
          Drag to draw hitbox · enable Anchor to reposition pivot
        </div>
      )}
      {showAnchor && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-violet-300 text-xs px-2.5 py-1 rounded-full pointer-events-none">
          Drag anchor crosshair to reposition pivot
        </div>
      )}
    </div>
  );
}
