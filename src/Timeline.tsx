import { useEffect, useState } from 'react';
import { useStore } from './store';
import { PHASES, PHASE_COLORS, type Phase } from './types';

const PX_PER_FRAME = 28;

export default function Timeline() {
  const loaded = useStore((s) => s.loaded);
  const currentFrame = useStore((s) => s.currentFrame);
  const selectedFrame = useStore((s) => s.selectedFrame);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const selectFrame = useStore((s) => s.selectFrame);
  const updateFrame = useStore((s) => s.updateFrame);

  const [drag, setDrag] = useState<{ index: number; startX: number; startDur: number } | null>(null);

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

  if (!loaded) return null;
  const a = loaded.anim;

  const offsets: number[] = [];
  let acc = 0;
  for (const f of a.frames) { offsets.push(acc); acc += f.duration; }
  const totalFrames = acc;
  const trackWidth = totalFrames * PX_PER_FRAME;

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
        <div style={{ minWidth: trackWidth + 100 }}>
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
