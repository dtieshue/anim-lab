import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store';
import { loadAdditionalImages } from './loader';
import { PHASES, PHASE_COLORS, type Phase } from './types';

const PX_PER_FRAME = 28;

export default function Timeline() {
  const loaded = useStore((s) => s.loaded);
  const currentFrame = useStore((s) => s.currentFrame);
  const selectedFrame = useStore((s) => s.selectedFrame);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const selectFrame = useStore((s) => s.selectFrame);
  const updateFrame = useStore((s) => s.updateFrame);
  const addImages = useStore((s) => s.addImages);
  const addStagedFrame = useStore((s) => s.addStagedFrame);

  const [drag, setDrag] = useState<{ index: number; startX: number; startDur: number } | null>(null);
  const [stagingOpen, setStagingOpen] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - drag.startX;
      const newDur = Math.max(1, Math.round(drag.startDur + dx / PX_PER_FRAME));
      updateFrame(drag.index, { duration: newDur });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, updateFrame]);

  const stagedSrcs = useMemo(() => {
    if (!loaded) return [];
    const used = new Set(loaded.anim.frames.map((f) => f.src));
    return Object.keys(loaded.images)
      .filter((src) => !used.has(src))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [loaded]);

  if (!loaded) return null;
  const a = loaded.anim;

  const offsets: number[] = [];
  let acc = 0;
  for (const f of a.frames) { offsets.push(acc); acc += f.duration; }
  const totalFrames = acc;
  const trackWidth = totalFrames * PX_PER_FRAME;

  const handleAddFiles = () => {
    setAdding(true);
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.png';
    input.onchange = async () => {
      try {
        const newImgs = await loadAdditionalImages(Array.from(input.files ?? []));
        if (Object.keys(newImgs).length > 0) addImages(newImgs);
      } finally {
        setAdding(false);
      }
    };
    input.oncancel = () => setAdding(false);
    input.click();
  };

  return (
    <div className="border-t border-neutral-800 bg-neutral-950">
      <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Timeline</span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400 tabular-nums">{totalFrames} frames @ {a.fps}fps</span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400 tabular-nums">{((totalFrames / a.fps) * 1000).toFixed(0)}ms</span>
        </div>
        <div className="text-neutral-500">drag a block's right edge to resize · click to select</div>
      </div>

      <div className="px-4 pb-3 overflow-x-auto">
        <div style={{ minWidth: trackWidth + 200 }}>
          {/* STAGING (collapsible) */}
          <StagingRow
            open={stagingOpen}
            onToggle={() => setStagingOpen((v) => !v)}
            onAdd={handleAddFiles}
            adding={adding}
            staged={stagedSrcs}
            images={loaded.images}
            onUseStaged={(src) => addStagedFrame(src)}
          />

          {/* event flag row */}
          <div className="relative h-5 mb-1 ml-24" style={{ width: trackWidth }}>
            {a.frames.map((f, i) => f.event ? (
              <div
                key={i}
                className="absolute top-0 bottom-0 flex items-center"
                style={{ left: offsets[i] * PX_PER_FRAME, width: f.duration * PX_PER_FRAME }}
              >
                <div className="text-[10px] bg-amber-300 text-amber-950 px-1.5 rounded leading-tight font-medium shadow-sm">
                  ⚑ {f.event}
                </div>
              </div>
            ) : null)}
          </div>

          {PHASES.map((phase) => (
            <PhaseTrack
              key={phase}
              phase={phase}
              frames={a.frames}
              offsets={offsets}
              totalFrames={totalFrames}
              currentFrame={currentFrame}
              selectedFrame={selectedFrame}
              onSelect={(i) => { setCurrentFrame(i); selectFrame(i); }}
              onResizeStart={(i, e) => setDrag({ index: i, startX: e.clientX, startDur: a.frames[i].duration })}
            />
          ))}

          {/* playhead overlay */}
          <div className="relative h-2 mt-1 ml-24" style={{ width: trackWidth }}>
            <div
              className="absolute -top-[160px] bottom-0 w-px bg-white/70 pointer-events-none"
              style={{ left: offsets[currentFrame] * PX_PER_FRAME + (a.frames[currentFrame].duration * PX_PER_FRAME) / 2 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StagingRow({
  open, onToggle, onAdd, adding, staged, images, onUseStaged,
}: {
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  adding: boolean;
  staged: string[];
  images: Record<string, HTMLImageElement>;
  onUseStaged: (src: string) => void;
}) {
  return (
    <div className="mb-2 rounded-md ring-1 ring-neutral-800 bg-neutral-900/40">
      <div className="flex items-center justify-between px-2 py-1">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-300 hover:text-white"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
          Staging
          <span className="text-neutral-500 normal-case tracking-normal text-[10px] ml-1">
            {staged.length === 0 ? 'no unused frames' : `${staged.length} unused`}
          </span>
        </button>
        <button
          onClick={onAdd}
          disabled={adding}
          className="text-[10px] px-2 h-6 rounded bg-violet-500/15 ring-1 ring-violet-500/40 text-violet-200 hover:bg-violet-500/25 transition-colors disabled:opacity-50"
        >
          {adding ? 'Adding…' : '+ Add images'}
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2 pt-0.5">
          {staged.length === 0 ? (
            <div className="text-[11px] text-neutral-500 italic px-1 py-2">
              No unused images. Add more PNGs to stage them here, then click to insert as a frame.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {staged.map((src) => (
                <StagedThumb key={src} src={src} img={images[src]} onClick={() => onUseStaged(src)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StagedThumb({ src, img, onClick }: { src: string; img?: HTMLImageElement; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const SIZE = 44;

  useEffect(() => {
    if (!img) return;
    const c = ref.current;
    if (!c) return;
    c.width = SIZE; c.height = SIZE;
    const ctx = c.getContext('2d')!;
    // checker
    for (let y = 0; y < SIZE; y += 6) {
      for (let x = 0; x < SIZE; x += 6) {
        ctx.fillStyle = ((x / 6 + y / 6) % 2 === 0) ? '#1a1a1f' : '#0b0b0e';
        ctx.fillRect(x, y, 6, 6);
      }
    }
    const s = Math.min(SIZE / img.width, SIZE / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  }, [img]);

  return (
    <button
      onClick={onClick}
      title={`Click to add ${src} as new frame`}
      className="relative group rounded ring-1 ring-neutral-700 hover:ring-violet-400 overflow-hidden"
      style={{ width: SIZE, height: SIZE + 14 }}
    >
      <canvas ref={ref} className="block" />
      <div className="text-[8px] text-neutral-400 truncate px-0.5 leading-3.5 bg-neutral-900">{src}</div>
      <div className="absolute inset-0 bg-violet-500/0 group-hover:bg-violet-500/15 transition-colors pointer-events-none" />
      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-black/60 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </div>
    </button>
  );
}

function PhaseTrack({
  phase, frames, offsets, totalFrames, currentFrame, selectedFrame, onSelect, onResizeStart,
}: {
  phase: Phase;
  frames: { phase: Phase; duration: number; event?: string; src: string }[];
  offsets: number[];
  totalFrames: number;
  currentFrame: number;
  selectedFrame: number;
  onSelect: (i: number) => void;
  onResizeStart: (i: number, e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-22 shrink-0 flex items-center gap-1.5" style={{ width: 88 }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: PHASE_COLORS[phase] }} />
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">{phase}</span>
      </div>
      <div
        className="relative h-7 bg-neutral-900 rounded ring-1 ring-neutral-800/80"
        style={{ width: totalFrames * PX_PER_FRAME }}
      >
        {frames.map((f, i) => f.phase !== phase ? null : (
          <div
            key={i}
            onClick={() => onSelect(i)}
            title={`${i}: ${f.duration}f${f.event ? ` · ${f.event}` : ''}`}
            className={`absolute top-0.5 bottom-0.5 rounded cursor-pointer transition-shadow ${
              i === currentFrame ? 'shadow-[inset_0_0_0_2px_rgba(255,255,255,0.95)]'
              : i === selectedFrame ? 'shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.55)]'
              : 'hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)]'
            }`}
            style={{
              left: offsets[i] * PX_PER_FRAME,
              width: f.duration * PX_PER_FRAME,
              background: PHASE_COLORS[phase],
            }}
          >
            <div className="px-1.5 text-[10px] font-medium text-black/75 leading-6 truncate select-none">{i}</div>
            <div
              className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/40"
              onMouseDown={(e) => { e.stopPropagation(); onResizeStart(i, e); }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
