import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { PHASE_COLORS } from './types';

const CELL_MAX = 200; // max display height per frame

function FrameCell({ img, frameIndex, frame, isCurrent, onSelect }: {
  img: HTMLImageElement;
  frameIndex: number;
  frame: { src: string; phase: string; duration: number; event?: string };
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = Math.min(1, CELL_MAX / img.height, CELL_MAX / img.width);
  const W = Math.round(img.width * scale);
  const H = Math.round(img.height * scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Checkerboard
    const sq = 8;
    for (let y = 0; y < H; y += sq) {
      for (let x = 0; x < W; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#1a1a1f' : '#0b0b0e';
        ctx.fillRect(x, y, sq, sq);
      }
    }

    ctx.drawImage(img, 0, 0, W, H);
  }, [img, W, H]);

  const color = PHASE_COLORS[frame.phase as keyof typeof PHASE_COLORS] ?? '#888';

  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-center shrink-0 rounded-lg overflow-hidden transition-all ${
        isCurrent ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-neutral-700 hover:ring-neutral-500'
      }`}
      title={`${frameIndex}: ${frame.src} · ${frame.phase} · ${frame.duration}f`}
    >
      {/* Canvas with 1px image-bounds border */}
      <div className="relative" style={{ width: W, height: H }}>
        <canvas ref={canvasRef} className="block" />
        {/* exact-bounds border */}
        <div className="absolute inset-0 pointer-events-none" style={{
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.35)`,
        }} />
        {frame.event && (
          <div className="absolute top-1 right-1 bg-amber-300 text-amber-950 text-[9px] font-bold px-1 rounded leading-tight">
            ⚑ {frame.event}
          </div>
        )}
        <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded leading-tight tabular-nums">
          {frameIndex}
        </div>
      </div>
      {/* Phase strip + metadata */}
      <div className="w-full px-1.5 py-1 text-left" style={{ background: color + '22', borderTop: `2px solid ${color}` }}>
        <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color }}>{frame.phase}</div>
        <div className="text-[9px] text-neutral-400 tabular-nums">{frame.src} · {frame.duration}f</div>
      </div>
    </button>
  );
}

export default function FilmStrip({ onClose }: { onClose: () => void }) {
  const loaded = useStore((s) => s.loaded);
  const currentFrame = useStore((s) => s.currentFrame);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const selectFrame = useStore((s) => s.selectFrame);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Scroll current frame into view when it changes
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-frame="${currentFrame}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentFrame]);

  if (!loaded) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-neutral-200">Film Strip</span>
          <span className="text-xs text-neutral-500">· {loaded.anim.name} · {loaded.anim.frames.length} frames</span>
          <div className="flex items-center gap-2 ml-2">
            {/* phase legend */}
            {Object.entries(PHASE_COLORS).map(([phase, color]) => (
              <div key={phase} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
                <span className="text-[10px] text-neutral-500">{phase}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 grid place-items-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Close (Esc)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        </button>
      </div>

      {/* Strip */}
      <div
        ref={stripRef}
        className="flex-1 overflow-x-auto overflow-y-auto flex items-center px-6 py-8 gap-3"
      >
        {loaded.anim.frames.map((f, i) => {
          const img = loaded.images[f.src];
          if (!img) return null;
          return (
            <div key={i} data-frame={i}>
              <FrameCell
                img={img}
                frameIndex={i}
                frame={f}
                isCurrent={i === currentFrame}
                onSelect={() => { setCurrentFrame(i); selectFrame(i); }}
              />
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-neutral-800 shrink-0 text-[10px] text-neutral-600">
        White inset border = exact PNG bounds · click a frame to jump to it · Esc to close
      </div>
    </div>
  );
}
