export type Phase = 'anticipation' | 'startup' | 'active' | 'impact' | 'recovery';

export const PHASES: Phase[] = ['anticipation', 'startup', 'active', 'impact', 'recovery'];

export const PHASE_COLORS: Record<Phase, string> = {
  anticipation: '#a78bfa',
  startup: '#60a5fa',
  active: '#f87171',
  impact: '#fbbf24',
  recovery: '#4ade80',
};

export interface FrameDef {
  src: string;
  duration: number; // in frames at the declared fps
  phase: Phase;
  event?: string;
  hitbox?: { x: number; y: number; w: number; h: number };
}

export interface EventDef {
  hitstop?: number; // frames
  shake?: number;   // frames (also magnitude in px-ish)
  flash?: boolean;
}

export interface Anim {
  name: string;
  fps: number;
  loop: boolean;
  anchor: { x: number; y: number };
  frames: FrameDef[];
  events: Record<string, EventDef>;
}

export interface LoadedFolder {
  name: string;
  anim: Anim;
  images: Record<string, HTMLImageElement>; // by FrameDef.src
  // FSA handle if available — for save-back
  dirHandle?: FileSystemDirectoryHandle;
  jsonHandle?: FileSystemFileHandle;
  // true when anim was bootstrapped from PNGs — no anim.json existed yet
  generated?: boolean;
}
