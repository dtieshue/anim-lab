import { create } from 'zustand';
import type { Anim, EventDef, FrameDef, LoadedFolder, Phase } from './types';

interface State {
  loaded: LoadedFolder | null;
  playing: boolean;
  currentFrame: number;        // index into anim.frames
  frameElapsedMs: number;      // ms spent so far on the current frame
  speed: number;               // playback multiplier
  selectedFrame: number;
  showOnion: boolean;
  showAnchor: boolean;
  showSilhouette: boolean;
  showHitbox: boolean;

  setLoaded: (l: LoadedFolder | null) => void;
  setPlaying: (p: boolean) => void;
  togglePlay: () => void;
  setCurrentFrame: (i: number) => void;
  resetPlayback: () => void;
  stepFrame: (delta: number) => void;
  setSpeed: (s: number) => void;
  selectFrame: (i: number) => void;

  setShowOnion: (b: boolean) => void;
  setShowAnchor: (b: boolean) => void;
  setShowSilhouette: (b: boolean) => void;
  setShowHitbox: (b: boolean) => void;

  setFrameElapsedMs: (ms: number) => void;

  // mutators
  updateAnim: (patch: Partial<Anim>) => void;
  updateFrame: (i: number, patch: Partial<FrameDef>) => void;
  updateEvent: (name: string, patch: Partial<EventDef>) => void;
}

export const useStore = create<State>((set, get) => ({
  loaded: null,
  playing: false,
  currentFrame: 0,
  frameElapsedMs: 0,
  speed: 1,
  selectedFrame: 0,
  showOnion: false,
  showAnchor: true,
  showSilhouette: false,
  showHitbox: false,

  setLoaded: (l) => set({ loaded: l, currentFrame: 0, frameElapsedMs: 0, selectedFrame: 0, playing: false }),
  setPlaying: (p) => set({ playing: p }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setCurrentFrame: (i) => {
    const a = get().loaded?.anim;
    if (!a) return;
    const idx = ((i % a.frames.length) + a.frames.length) % a.frames.length;
    set({ currentFrame: idx, frameElapsedMs: 0 });
  },
  resetPlayback: () => set({ currentFrame: 0, frameElapsedMs: 0, playing: false }),
  stepFrame: (delta) => {
    const a = get().loaded?.anim;
    if (!a) return;
    const next = ((get().currentFrame + delta) % a.frames.length + a.frames.length) % a.frames.length;
    set({ currentFrame: next, frameElapsedMs: 0, selectedFrame: next });
  },
  setSpeed: (s) => set({ speed: s }),
  selectFrame: (i) => set({ selectedFrame: i }),

  setShowOnion: (b) => set({ showOnion: b }),
  setShowAnchor: (b) => set({ showAnchor: b }),
  setShowSilhouette: (b) => set({ showSilhouette: b }),
  setShowHitbox: (b) => set({ showHitbox: b }),

  setFrameElapsedMs: (ms) => set({ frameElapsedMs: ms }),

  updateAnim: (patch) =>
    set((s) => {
      if (!s.loaded) return {};
      return { loaded: { ...s.loaded, anim: { ...s.loaded.anim, ...patch } } };
    }),
  updateFrame: (i, patch) =>
    set((s) => {
      if (!s.loaded) return {};
      const frames = s.loaded.anim.frames.slice();
      frames[i] = { ...frames[i], ...patch } as FrameDef;
      return { loaded: { ...s.loaded, anim: { ...s.loaded.anim, frames } } };
    }),
  updateEvent: (name, patch) =>
    set((s) => {
      if (!s.loaded) return {};
      const events = { ...s.loaded.anim.events, [name]: { ...s.loaded.anim.events[name], ...patch } };
      return { loaded: { ...s.loaded, anim: { ...s.loaded.anim, events } } };
    }),
}));

export const phaseOf = (p: Phase) => p;
