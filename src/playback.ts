import { useEffect, useRef } from 'react';
import { useStore } from './store';

// Time-based playback loop. Advances currentFrame using a delta accumulator,
// honors per-frame duration (in source-fps frames -> ms), speed multiplier,
// hitstop freeze on frames with `event` set, and `loop`.
//
// Returns refs the renderer can read for shake/flash overlay state.

export interface FxState {
  shakeRemainingMs: number;
  shakeTotalMs: number;
  shakeMagnitude: number;
  flashRemainingMs: number;
  flashTotalMs: number;
  // per-frame: hitstop freezes the clock — accounted for by holding currentFrame
  hitstopRemainingMs: number;
}

export function makeFxState(): FxState {
  return {
    shakeRemainingMs: 0,
    shakeTotalMs: 0,
    shakeMagnitude: 0,
    flashRemainingMs: 0,
    flashTotalMs: 0,
    hitstopRemainingMs: 0,
  };
}

export function usePlayback(fxRef: React.MutableRefObject<FxState>) {
  const lastTimeRef = useRef<number | null>(null);
  const firedEventForFrameRef = useRef<number>(-1);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const last = lastTimeRef.current;
      lastTimeRef.current = t;
      const dtMs = last == null ? 0 : Math.min(100, t - last); // clamp tab-switch jumps

      const s = useStore.getState();
      const fx = fxRef.current;
      const a = s.loaded?.anim;

      // FX timers always tick (so flash/shake show even when paused)
      if (fx.shakeRemainingMs > 0) fx.shakeRemainingMs = Math.max(0, fx.shakeRemainingMs - dtMs);
      if (fx.flashRemainingMs > 0) fx.flashRemainingMs = Math.max(0, fx.flashRemainingMs - dtMs);

      if (a && s.playing) {
        // hitstop freezes playback clock
        if (fx.hitstopRemainingMs > 0) {
          fx.hitstopRemainingMs = Math.max(0, fx.hitstopRemainingMs - dtMs * s.speed);
        } else {
          const frame = a.frames[s.currentFrame];
          const frameMs = (frame.duration / a.fps) * 1000;
          let elapsed = s.frameElapsedMs + dtMs * s.speed;
          let idx = s.currentFrame;

          // fire event when we BEGIN drawing this frame (i.e. once per visit)
          if (firedEventForFrameRef.current !== idx) {
            firedEventForFrameRef.current = idx;
            fireFrameEvent(idx);
          }

          while (elapsed >= frameMs) {
            elapsed -= frameMs;
            idx += 1;
            if (idx >= a.frames.length) {
              if (a.loop) {
                idx = 0;
              } else {
                idx = a.frames.length - 1;
                elapsed = 0;
                useStore.setState({ playing: false });
                break;
              }
            }
            firedEventForFrameRef.current = idx;
            fireFrameEvent(idx);
            const f2 = a.frames[idx];
            const f2Ms = (f2.duration / a.fps) * 1000;
            // if hitstop fired, stop advancing this tick
            if (fx.hitstopRemainingMs > 0) break;
            if (elapsed < f2Ms) break;
          }
          useStore.setState({ currentFrame: idx, frameElapsedMs: elapsed });
        }
      } else {
        // when paused, reset event-firing memory so re-play retriggers correctly
        firedEventForFrameRef.current = s.currentFrame;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);

    function fireFrameEvent(idx: number) {
      const s2 = useStore.getState();
      const a2 = s2.loaded?.anim;
      if (!a2) return;
      const fr = a2.frames[idx];
      if (!fr.event) return;
      const ev = a2.events[fr.event];
      if (!ev) return;
      const fx = fxRef.current;
      const frameMs = 1000 / a2.fps;
      if (ev.hitstop) fx.hitstopRemainingMs = ev.hitstop * frameMs;
      if (ev.shake) {
        fx.shakeTotalMs = ev.shake * frameMs;
        fx.shakeRemainingMs = fx.shakeTotalMs;
        fx.shakeMagnitude = ev.shake; // px
      }
      if (ev.flash) {
        fx.flashTotalMs = 2 * frameMs;
        fx.flashRemainingMs = fx.flashTotalMs;
      }
    }
  }, [fxRef]);
}
