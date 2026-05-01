import { useEffect, useState } from 'react';
import Stage from './Stage';
import Timeline from './Timeline';
import Inspector from './Inspector';
import TransportBar from './TransportBar';
import FilmStrip from './FilmStrip';
import { useStore } from './store';
import { ensurePermission, lastFolderName, loadFromDirHandle, loadFromDrop, pickFolder, readStashedHandle } from './loader';
import { useKeyboardShortcuts } from './keyboard';

export default function App() {
  const loaded = useStore((s) => s.loaded);
  const setLoaded = useStore((s) => s.setLoaded);
  const [error, setError] = useState<string>('');
  const [dragHover, setDragHover] = useState(false);
  const [lastName, setLastName] = useState<string | null>(null);
  const [showFilmStrip, setShowFilmStrip] = useState(false);

  useKeyboardShortcuts();

  useEffect(() => { setLastName(lastFolderName()); }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragHover(false);
    setError('');
    try {
      const folder = await loadFromDrop(e.dataTransfer);
      setLoaded(folder);
    } catch (err: any) {
      setError(err.message ?? String(err));
    }
  };

  const handlePick = async () => {
    setError('');
    try { setLoaded(await pickFolder()); }
    catch (err: any) { if (err?.name !== 'AbortError') setError(err.message ?? String(err)); }
  };

  const handleReopen = async () => {
    setError('');
    try {
      const handle = await readStashedHandle();
      if (!handle) { setError('No previous folder found'); return; }
      const ok = await ensurePermission(handle, 'read');
      if (!ok) { setError('Permission denied'); return; }
      setLoaded(await loadFromDirHandle(handle));
    } catch (err: any) { setError(err.message ?? String(err)); }
  };

  return (
    <div
      className="h-full w-full flex flex-col relative"
      onDragOver={(e) => { e.preventDefault(); setDragHover(true); }}
      onDragLeave={() => setDragHover(false)}
      onDrop={handleDrop}
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-400 to-fuchsia-500 grid place-items-center text-[10px] font-black text-white">A</div>
          <div className="font-semibold tracking-tight">anim-lab</div>
        </div>
        {loaded && (
          <div className="flex items-center gap-2 text-sm text-neutral-500 min-w-0">
            <span>·</span>
            <span className="text-neutral-300 truncate">{loaded.anim.name}</span>
            <span className="text-neutral-700">/</span>
            <span className="text-neutral-500 truncate text-xs">{loaded.name}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs">
          {loaded && (
            <button
              onClick={() => setShowFilmStrip(true)}
              className="px-2.5 h-7 rounded-md bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="4" height="12" rx="1"/><rect x="8" y="6" width="4" height="12" rx="1"/><rect x="14" y="6" width="4" height="12" rx="1"/><rect x="20" y="6" width="2" height="12" rx="1"/></svg>
              Film Strip
            </button>
          )}
          {lastName && (
            <button onClick={handleReopen} className="px-2.5 h-7 rounded-md bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-700 text-neutral-300 hover:text-white transition">
              Reopen <span className="text-neutral-500">"{lastName}"</span>
            </button>
          )}
          <button onClick={handlePick} className="px-2.5 h-7 rounded-md bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-700 text-neutral-200 hover:text-white transition">
            Open folder…
          </button>
        </div>
      </header>

      {error && <div className="bg-red-950/60 border-b border-red-900 px-4 py-1.5 text-sm text-red-200">{error}</div>}

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Stage />
          <TransportBar />
          <Timeline />
        </div>
        <Inspector />
      </div>

      {showFilmStrip && <FilmStrip onClose={() => setShowFilmStrip(false)} />}

      {!loaded && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-colors pointer-events-none ${
            dragHover ? 'bg-violet-500/10' : ''
          }`}
        >
          <div
            className={`pointer-events-auto rounded-2xl border border-dashed px-10 py-8 text-center transition-colors ${
              dragHover ? 'border-violet-400 bg-neutral-950/90' : 'border-neutral-700 bg-neutral-950/85'
            }`}
          >
            <div className="text-2xl font-medium mb-1.5">Drop a folder here</div>
            <div className="text-sm text-neutral-400 mb-5">
              PNGs only, or PNGs + <code className="text-neutral-200">anim.json</code>
            </div>
            <button onClick={handlePick} className="px-3.5 h-8 rounded-md bg-violet-500 hover:bg-violet-400 text-sm font-medium text-white transition-colors">
              Or pick a folder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
