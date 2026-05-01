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

  // view (zoom/pan)
  viewScale: number;
  viewPanX: number;
  viewPanY: number;
  setView: (v: { scale?: number; panX?: number; panY?: number }) => void;
  resetView: () => void;
  zoomAt: (factor: number, screenX: number, screenY: number) => void;

  setFrameElapsedMs: (ms: number) => void;

  // mutators
  updateAnim: (patch: Partial<Anim>) => void;
  updateFrame: (i: number, patch: Partial<FrameDef>) => void;
  updateEvent: (name: string, patch: Partial<EventDef>) => void;

  // staging / image management
  addImages: (newImages: Record<string, HTMLImageElement>) => void;
  addStagedFrame: (src: string) => void;
  removeFrame: (i: number) => void;
  reorderFrame: (from: number, to: number) => void;
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

  viewScale: 1,
  viewPanX: 0,
  viewPanY: 0,

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

  setView: (v) =>
    set((s) => ({
      viewScale: v.scale ?? s.viewScale,
      viewPanX: v.panX ?? s.viewPanX,
      viewPanY: v.panY ?? s.viewPanY,
    })),
  resetView: () => set({ viewScale: 1, viewPanX: 0, viewPanY: 0 }),
  zoomAt: (factor, sx, sy) =>
    set((s) => {
      const newScale = Math.max(0.1, Math.min(8, s.viewScale * factor));
      // keep the world point under (sx, sy) fixed: world = (screen - pan) / scale
      // newPan = screen - world * newScale
      const worldX = (sx - s.viewPanX) / s.viewScale;
      const worldY = (sy - s.viewPanY) / s.viewScale;
      return {
        viewScale: newScale,
        viewPanX: sx - worldX * newScale,
        viewPanY: sy - worldY * newScale,
      };
    }),

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

  addImages: (newImages) =>
    set((s) => {
      if (!s.loaded) return {};
      const images = { ...s.loaded.images, ...newImages };
      return { loaded: { ...s.loaded, images } };
    }),

  addStagedFrame: (src) =>
    set((s) => {
      if (!s.loaded) return {};
      const frames = [...s.loaded.anim.frames, { src, duration: 1, phase: 'anticipation' as const }];
      return { loaded: { ...s.loaded, anim: { ...s.loaded.anim, frames } } };
    }),

  removeFrame: (i) =>
    set((s) => {
      if (!s.loaded) return {};
      const frames = s.loaded.anim.frames.filter((_, idx) => idx !== i);
      if (frames.length === 0) return {}; // don't allow removing last frame
      const cur = Math.min(s.currentFrame, frames.length - 1);
      const sel = Math.min(s.selectedFrame, frames.length - 1);
      return {
        loaded: { ...s.loaded, anim: { ...s.loaded.anim, frames } },
        currentFrame: cur,
        selectedFrame: sel,
        frameElapsedMs: 0,
      };
    }),

  reorderFrame: (from, to) =>
    set((s) => {
      if (!s.loaded) return {};
      const frames = s.loaded.anim.frames.slice();
      if (from < 0 || from >= frames.length) return {};
      const clampedTo = Math.max(0, Math.min(frames.length - 1, to));
      if (from === clampedTo) return {};
      const [moved] = frames.splice(from, 1);
      frames.splice(clampedTo, 0, moved);
      // Track the moved frame's new index for current/selected
      const remap = (idx: number) => {
        if (idx === from) return clampedTo;
        if (from < idx && clampedTo >= idx) return idx - 1;
        if (from > idx && clampedTo <= idx) return idx + 1;
        return idx;
      };
      return {
        loaded: { ...s.loaded, anim: { ...s.loaded.anim, frames } },
        currentFrame: remap(s.currentFrame),
        selectedFrame: remap(s.selectedFrame),
        frameElapsedMs: 0,
      };
    }),
}));

export const phaseOf = (p: Phase) => p;
