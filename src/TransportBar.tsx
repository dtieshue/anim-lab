import { useStore } from './store';
import { PHASE_COLORS } from './types';

export default function TransportBar() {
  const loaded = useStore((s) => s.loaded);
  const currentFrame = useStore((s) => s.currentFrame);
  const frameElapsedMs = useStore((s) => s.frameElapsedMs);
  const playing = useStore((s) => s.playing);
  const togglePlay = useStore((s) => s.togglePlay);
  const stepFrame = useStore((s) => s.stepFrame);
  const reset = useStore((s) => s.resetPlayback);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const selectFrame = useStore((s) => s.selectFrame);

  const showOnion = useStore((s) => s.showOnion);
  const showAnchor = useStore((s) => s.showAnchor);
  const showSilhouette = useStore((s) => s.showSilhouette);
  const showHitbox = useStore((s) => s.showHitbox);
  const setShowOnion = useStore((s) => s.setShowOnion);
  const setShowAnchor = useStore((s) => s.setShowAnchor);
  const setShowSilhouette = useStore((s) => s.setShowSilhouette);
  const setShowHitbox = useStore((s) => s.setShowHitbox);

  const elapsedMs = (() => {
    if (!loaded) return 0;
    let t = 0;
    for (let i = 0; i < currentFrame; i++) t += (loaded.anim.frames[i].duration / loaded.anim.fps) * 1000;
    return t + frameElapsedMs;
  })();

  return (
    <div className="border-t border-neutral-800 bg-neutral-925 px-4 py-2.5 flex flex-col gap-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-md bg-neutral-900 ring-1 ring-neutral-800 p-1">
          <IconBtn title="Step back (←)" onClick={() => stepFrame(-1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5L9 12l11 7z" /></svg>
          </IconBtn>
          <button
            onClick={togglePlay}
            className="px-3 h-7 rounded bg-violet-500 hover:bg-violet-400 active:bg-violet-600 text-white font-medium flex items-center gap-1.5 transition-colors"
            title="Play/Pause (Space)"
          >
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z" /></svg>
            )}
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <IconBtn title="Step forward (→)" onClick={() => stepFrame(1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7L4 19z" /></svg>
          </IconBtn>
          <IconBtn title="Reset" onClick={reset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L7 7l5 5V8a4 4 0 110 8 4 4 0 01-4-4H6a6 6 0 106-6z" /></svg>
          </IconBtn>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-neutral-900 ring-1 ring-neutral-800 p-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 px-1.5">Speed</span>
          {[0.1, 0.25, 0.5, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`h-6 px-2 rounded text-xs tabular-nums transition-colors ${
                speed === s
                  ? 'bg-violet-500 text-white'
                  : 'text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-1 text-xs">
          <Toggle label="Onion" value={showOnion} onChange={setShowOnion} />
          <Toggle label="Anchor" value={showAnchor} onChange={setShowAnchor} />
          <Toggle label="Silhouette" value={showSilhouette} onChange={setShowSilhouette} />
          <Toggle label="Hitbox" value={showHitbox} onChange={setShowHitbox} />
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-neutral-400 tabular-nums">
          <div>frame <span className="text-neutral-100 font-medium">{currentFrame}</span>{loaded ? <span className="text-neutral-500"> / {loaded.anim.frames.length - 1}</span> : ''}</div>
          <div className="w-px h-3.5 bg-neutral-800" />
          <div><span className="text-neutral-100 font-medium">{elapsedMs.toFixed(0)}</span><span className="text-neutral-500"> ms</span></div>
        </div>
      </div>

      {/* Scrub bar */}
      {loaded && (
        <div className="flex h-5 w-full rounded overflow-hidden ring-1 ring-neutral-800 bg-neutral-900">
          {loaded.anim.frames.map((f, i) => {
            const total = loaded.anim.frames.reduce((acc, x) => acc + x.duration, 0);
            const widthPct = (f.duration / total) * 100;
            const isCur = i === currentFrame;
            return (
              <button
                key={i}
                onClick={() => { setCurrentFrame(i); selectFrame(i); }}
                title={`${i}: ${f.phase} · ${f.duration}f${f.event ? ` · ${f.event}` : ''}`}
                style={{ width: `${widthPct}%`, background: PHASE_COLORS[f.phase] }}
                className={`relative h-full transition-[box-shadow] ${
                  isCur ? 'shadow-[inset_0_0_0_2px_rgba(255,255,255,0.95)]' : 'hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)]'
                }`}
              >
                {f.event && <span className="absolute top-0 left-0 right-0 h-1 bg-amber-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-7 w-7 grid place-items-center rounded text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`h-7 px-2.5 rounded-md text-xs ring-1 transition-colors ${
        value
          ? 'bg-violet-500/15 ring-violet-500/40 text-violet-200'
          : 'bg-neutral-900 ring-neutral-800 text-neutral-400 hover:text-neutral-200 hover:ring-neutral-700'
      }`}
    >
      {label}
    </button>
  );
}
