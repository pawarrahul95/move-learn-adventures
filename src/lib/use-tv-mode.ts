// Global TV Mode toggle. When on:
//   - The game stage takes the whole screen (good for mirrored TV display).
//   - The mobile camera video shrinks to a corner picture-in-picture.
//   - UI elements (letters, prompts) scale up so they're readable across a room.
//
// We persist the choice in localStorage and broadcast via a tiny pub/sub so
// every component (top bar, stages) re-renders together without a global store.
import { useEffect, useState, useCallback } from "react";

const KEY = "playlearn:tvMode";
const listeners = new Set<(v: boolean) => void>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

function write(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v ? "1" : "0");
  listeners.forEach((l) => l(v));
}

export function useTvMode() {
  const [tv, setTv] = useState<boolean>(() => read());

  useEffect(() => {
    const l = (v: boolean) => setTv(v);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  // Reflect state on <html> so we can target `.tv-mode` from anywhere.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("tv-mode", tv);
  }, [tv]);

  const toggle = useCallback(async () => {
    const next = !read();
    write(next);
    // Best-effort fullscreen so screen mirroring fills the TV nicely.
    try {
      if (next && document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      /* fullscreen denied — TV layout still works */
    }
  }, []);

  return { tv, toggle };
}
