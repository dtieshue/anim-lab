import { useEffect } from 'react';
import { useStore } from './store';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;

      const s = useStore.getState();
      const a = s.loaded?.anim;
      if (!a) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          s.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          s.stepFrame(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          s.stepFrame(1);
          break;
        case ',': {
          // prev event
          for (let i = s.currentFrame - 1; i >= 0; i--) {
            if (a.frames[i].event) { s.setCurrentFrame(i); s.selectFrame(i); break; }
          }
          break;
        }
        case '.': {
          for (let i = s.currentFrame + 1; i < a.frames.length; i++) {
            if (a.frames[i].event) { s.setCurrentFrame(i); s.selectFrame(i); break; }
          }
          break;
        }
        case 's': case 'S':
          s.setShowSilhouette(!s.showSilhouette);
          break;
        case 'o': case 'O':
          s.setShowOnion(!s.showOnion);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
