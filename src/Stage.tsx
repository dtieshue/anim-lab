import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { makeFxState, usePlayback } from './playback';

interface HitboxDrag {
  kind: 'hitbox';
  active: boolean;
  startX: number; // world coords
  startY: number;
  curX: number;
  curY: number;
}
interface AnchorDrag { kind: 'anchor'; active: boolean }
interface PanDrag { kind: 'pan'; active: boolean; lastX: number; lastY: number }
type DragState = HitboxDrag | AnchorDrag | PanDrag | { kind: 'none' };

function rectFromDrag(d: HitboxDrag, spriteX: number, spriteY: number) {
  const x = Math.round(Math.min(d.startX, d.curX) - spriteX);
  const y = Math.round(Math.min(d.startY, d.curY) - spriteY);
  const w = Math.round(Math.abs(d.curX - d.startX));
  const h = Math.round(Math.abs(d.curY - d.startY));
  return { x, y, w, h };
}

const ANCHOR_HIT_RADIUS_WORLD = 14;

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

      // Apply view transform (pan + zoom)
      ctx.translate(s.viewPanX, s.viewPanY);
      ctx.scale(s.viewScale, s.viewScale);

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
      const cy = H / 2 + shakeY;
      const spriteX = cx - img.width * a.anchor.x;
      const spriteY = cy - img.height * a.anchor.y;
      const invScale = 1 / s.viewScale;

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

      const drawText = (text: string, wx: number, wy: number, color: string) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.scale(invScale, invScale);
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(text, 0, 0);
        ctx.restore();
      };

      // (dashed frame outline + anchor crosshair are drawn in screen space below)

      // Committed hitbox
      if (s.showHitbox && frame.hitbox) {
        const hx = spriteX + frame.hitbox.x;
        const hy = spriteY + frame.hitbox.y;
        ctx.save();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1.5 * invScale;
        ctx.fillStyle = 'rgba(248,113,113,0.18)';
        ctx.fillRect(hx, hy, frame.hitbox.w, frame.hitbox.h);
        ctx.strokeRect(hx, hy, frame.hitbox.w, frame.hitbox.h);
        const cs = 5 * invScale;
        ctx.fillStyle = '#f87171';
        for (const [hcx, hcy] of [
          [hx, hy], [hx + frame.hitbox.w, hy],
          [hx, hy + frame.hitbox.h], [hx + frame.hitbox.w, hy + frame.hitbox.h],
        ] as [number, number][]) {
          ctx.fillRect(hcx - cs / 2, hcy - cs / 2, cs, cs);
        }
        ctx.restore();
        drawText(`${frame.hitbox.x}, ${frame.hitbox.y}  ${frame.hitbox.w}×${frame.hitbox.h}`, hx + 3, hy - 4, '#f87171');
      }

      // Hitbox drag preview
      if (s.showHitbox && drag.kind === 'hitbox' && drag.active) {
        const r = rectFromDrag(drag, spriteX, spriteY);
        const hx = spriteX + r.x;
        const hy = spriteY + r.y;
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5 * invScale;
        ctx.setLineDash([4 * invScale, 3 * invScale]);
        ctx.fillStyle = 'rgba(251,191,36,0.15)';
        ctx.fillRect(hx, hy, r.w, r.h);
        ctx.strokeRect(hx, hy, r.w, r.h);
        ctx.restore();
        drawText(`${r.x}, ${r.y}  ${r.w}×${r.h}`, hx + 3, hy - 4, '#fbbf24');
      }

      // Reset transform for screen-space overlays — anchor + frame outline are pinned to viewport center.
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const screenCx = W / 2;
      const screenCy = H / 2;
      const fW = img.width * s.viewScale;
      const fH = img.height * s.viewScale;
      const fX = screenCx - fW / 2;
      const fY = screenCy - fH / 2;

      // Dashed frame outline — always centered in viewport, sized to current PNG at current zoom.
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(fX, fY, fW, fH);
      ctx.setLineDash([]);
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`${img.width}×${img.height}`, fX + 3, fY - 4);
      ctx.restore();

      // Anchor crosshair — always at viewport center.
      if (s.showAnchor) {
        const dragging = drag.kind === 'anchor' && drag.active;
        ctx.save();
        ctx.strokeStyle = dragging ? '#c4b5fd' : '#a78bfa';
        ctx.lineWidth = dragging ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(screenCx - 12, screenCy); ctx.lineTo(screenCx + 12, screenCy);
        ctx.moveTo(screenCx, screenCy - 12); ctx.lineTo(screenCx, screenCy + 12);
        ctx.stroke();
        ctx.fillStyle = dragging ? '#c4b5fd' : 'rgba(167,139,250,0.9)';
        ctx.beginPath(); ctx.arc(screenCx, screenCy, dragging ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
        if (!dragging) {
          ctx.strokeStyle = 'rgba(167,139,250,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(screenCx, screenCy, 14, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = dragging ? '#c4b5fd' : 'rgba(167,139,250,0.8)';
        ctx.fillText(`${a.anchor.x.toFixed(2)}, ${a.anchor.y.toFixed(2)}`, screenCx + 15, screenCy - 4);
        ctx.restore();
      }

      if (fx.flashRemainingMs > 0 && fx.flashTotalMs > 0) {
        const k = fx.flashRemainingMs / fx.flashTotalMs;
        const alpha = k > 0.5 ? 1.0 : 0.5;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(0, 0, W, H);
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

  // Wheel zoom — needs non-passive listener to preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // Trackpad pinch-to-zoom and Ctrl/Cmd+wheel both arrive with ctrlKey/metaKey set.
      // Plain two-finger swipe arrives without modifiers → pan.
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01);
        useStore.getState().zoomAt(factor, sx, sy);
      } else {
        const s = useStore.getState();
        useStore.getState().setView({
          panX: s.viewPanX - e.deltaX,
          panY: s.viewPanY - e.deltaY,
        });
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const showAnchor = useStore((s) => s.showAnchor);
  const showHitbox = useStore((s) => s.showHitbox);
  const viewScale = useStore((s) => s.viewScale);
  const setView = useStore((s) => s.setView);
  const resetView = useStore((s) => s.resetView);
  const zoomAt = useStore((s) => s.zoomAt);

  const screenToWorld = (sx: number, sy: number) => {
    const s = useStore.getState();
    return { x: (sx - s.viewPanX) / s.viewScale, y: (sy - s.viewPanY) / s.viewScale };
  };

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = useStore.getState();
    if (!s.loaded) return;
    const screen = getCanvasPos(e);
    const world = screenToWorld(screen.x, screen.y);

    // Pan: middle-mouse, or Alt + click
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      dragRef.current = { kind: 'pan', active: true, lastX: screen.x, lastY: screen.y };
      return;
    }
    if (e.button !== 0) return;

    // Anchor grab — crosshair is at SCREEN center, so test in screen space.
    if (s.showAnchor) {
      const canvas = canvasRef.current!;
      const sxC = canvas.width / 2;
      const syC = canvas.height / 2;
      const dx = screen.x - sxC, dy = screen.y - syC;
      if (Math.sqrt(dx * dx + dy * dy) <= 14) {
        dragRef.current = { kind: 'anchor', active: true };
        return;
      }
    }

    if (s.showHitbox) {
      dragRef.current = { kind: 'hitbox', active: true, startX: world.x, startY: world.y, curX: world.x, curY: world.y };
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.kind === 'none' || !drag.active) return;
    const s = useStore.getState();
    if (!s.loaded) return;
    const screen = getCanvasPos(e);

    if (drag.kind === 'pan') {
      const dx = screen.x - drag.lastX;
      const dy = screen.y - drag.lastY;
      drag.lastX = screen.x;
      drag.lastY = screen.y;
      setView({ panX: s.viewPanX + dx, panY: s.viewPanY + dy });
      return;
    }

    const world = screenToWorld(screen.x, screen.y);

    if (drag.kind === 'anchor') {
      // Anchor + dashed frame are fixed at screen center. Map screen pos to
      // normalized anchor within the screen-centered dashed rectangle.
      const canvas = canvasRef.current!;
      const W = canvas.width, H = canvas.height;
      const a = s.loaded.anim;
      const img = s.loaded.images[a.frames[s.currentFrame].src];
      if (!img) return;
      const fW = img.width * s.viewScale;
      const fH = img.height * s.viewScale;
      const fX = W / 2 - fW / 2;
      const fY = H / 2 - fH / 2;
      const newAx = Math.max(0, Math.min(1, (screen.x - fX) / fW));
      const newAy = Math.max(0, Math.min(1, (screen.y - fY) / fH));
      s.updateAnim({ anchor: { x: Math.round(newAx * 100) / 100, y: Math.round(newAy * 100) / 100 } });
      return;
    }

    if (drag.kind === 'hitbox') {
      drag.curX = world.x;
      drag.curY = world.y;
    }
  };

  const onMouseUp = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.kind === 'none' || !drag.active) return;

    if (drag.kind === 'pan' || drag.kind === 'anchor') {
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
      const spriteY = H / 2 - img.height * a.anchor.y;
      const r = rectFromDrag(drag, spriteX, spriteY);
      if (r.w < 4 || r.h < 4) { dragRef.current = { kind: 'none' }; return; }
      s.updateFrame(s.currentFrame, { hitbox: r });
      dragRef.current = { kind: 'none' };
    }
  };

  const cursor = (() => {
    if (showHitbox && !showAnchor) return 'crosshair';
    return 'default';
  })();

  const zoomCenter = () => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    return { x: c.width / 2, y: c.height / 2 };
  };

  return (
    <div className="checkerboard flex-1 relative min-h-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 bg-neutral-900/85 backdrop-blur ring-1 ring-neutral-800 rounded-lg p-1 text-xs">
        <button
          title="Zoom in (+)"
          onClick={() => { const c = zoomCenter(); zoomAt(1.25, c.x, c.y); }}
          className="w-7 h-7 grid place-items-center rounded text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button
          title="Zoom out (-)"
          onClick={() => { const c = zoomCenter(); zoomAt(0.8, c.x, c.y); }}
          className="w-7 h-7 grid place-items-center rounded text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14" /></svg>
        </button>
        <div className="w-7 text-center text-[10px] text-neutral-400 tabular-nums py-0.5 select-none">
          {Math.round(viewScale * 100)}%
        </div>
        <button
          title="Reset view (0)"
          onClick={resetView}
          className="w-7 h-7 grid place-items-center rounded text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        </button>
      </div>

      {/* Status hints */}
      <div className="absolute bottom-2 left-3 text-[10px] text-neutral-500 pointer-events-none select-none">
        two-finger swipe = pan · ⌘/ctrl + swipe = zoom · alt-drag or middle-click = pan
      </div>

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
