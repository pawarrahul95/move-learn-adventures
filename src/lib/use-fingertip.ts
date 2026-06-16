// Unified fingertip source. Returns the latest index-fingertip position in
// normalized 0..1 coordinates (camera space, mirrored on the consumer).
//
// Exposes BOTH a React state (`tip`, throttled) and a live ref (`tipRef`,
// updated every frame) so game loops can read sub-frame positions without
// triggering React re-renders. Internally applies a One-Euro-style low-pass
// filter for smoothness and runs detection in its own RAF loop decoupled
// from React.
import { useEffect, useRef, useState } from "react";
import { getHandLandmarker } from "@/lib/mediapipe";
import { tvSubscribe } from "@/routes/tv";

export interface Fingertip {
  x: number; // 0..1 (right-edge = 1; consumer mirrors as needed)
  y: number; // 0..1
  present: boolean;
  ts: number;
}

interface Opts {
  mode: "local" | "remote";
  /** Required when mode === "local". */
  video?: HTMLVideoElement | null;
  /** Required when mode === "local". Gates the detection loop. */
  ready?: boolean;
}

// One-Euro filter: low jitter when slow, low lag when fast.
class OneEuro {
  private xPrev = 0;
  private dxPrev = 0;
  private tPrev = 0;
  private inited = false;
  constructor(private minCutoff = 1.2, private beta = 0.02, private dCutoff = 1.0) {}
  reset() { this.inited = false; }
  filter(x: number, tSec: number) {
    if (!this.inited) {
      this.inited = true;
      this.xPrev = x; this.dxPrev = 0; this.tPrev = tSec;
      return x;
    }
    const dt = Math.max(1e-3, tSec - this.tPrev);
    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat; this.dxPrev = dxHat; this.tPrev = tSec;
    return xHat;
  }
  private alpha(cutoff: number, dt: number) {
    const r = 2 * Math.PI * cutoff * dt;
    return r / (r + 1);
  }
}

export function useFingertip({ mode, video, ready }: Opts) {
  const tipRef = useRef<Fingertip>({ x: 0, y: 0, present: false, ts: 0 });
  const [tip, setTip] = useState<Fingertip>(tipRef.current);
  const [modelReady, setModelReady] = useState(mode === "remote");
  const fxRef = useRef(new OneEuro(1.4, 0.03));
  const fyRef = useRef(new OneEuro(1.4, 0.03));
  const lastEmitRef = useRef(0);

  // Throttled commit to React state (~30fps) — UI doesn't need 60.
  const commit = (next: Fingertip) => {
    tipRef.current = next;
    const now = next.ts;
    if (now - lastEmitRef.current >= 33) {
      lastEmitRef.current = now;
      setTip(next);
    }
  };

  // Remote: subscribe to the TV pair bus.
  useEffect(() => {
    if (mode !== "remote") return;
    setModelReady(true);
    fxRef.current.reset(); fyRef.current.reset();
    return tvSubscribe((m) => {
      if (m.t !== "hand") return;
      if (!m.present) {
        commit({ x: tipRef.current.x, y: tipRef.current.y, present: false, ts: m.ts });
        fxRef.current.reset(); fyRef.current.reset();
        return;
      }
      const tSec = m.ts / 1000;
      const x = fxRef.current.filter(m.x, tSec);
      const y = fyRef.current.filter(m.y, tSec);
      commit({ x, y, present: true, ts: m.ts });
    });
  }, [mode]);

  // Local: run hand tracking against the page's own video element.
  useEffect(() => {
    if (mode !== "local" || !ready || !video) return;
    let running = true;
    let raf = 0;
    fxRef.current.reset(); fyRef.current.reset();

    (async () => {
      const landmarker = await getHandLandmarker();
      setModelReady(true);
      let lastDetectTs = -1;
      const tick = () => {
        if (!running) return;
        if (video.readyState >= 2) {
          const ts = performance.now();
          // Avoid feeding the same frame twice (MediaPipe throws otherwise).
          if (ts !== lastDetectTs) {
            lastDetectTs = ts;
            try {
              const res = landmarker.detectForVideo(video, ts);
              const t = res.landmarks?.[0]?.[8];
              if (t) {
                const tSec = ts / 1000;
                const x = fxRef.current.filter(t.x, tSec);
                const y = fyRef.current.filter(t.y, tSec);
                commit({ x, y, present: true, ts });
              } else {
                if (tipRef.current.present) {
                  fxRef.current.reset(); fyRef.current.reset();
                  commit({ x: tipRef.current.x, y: tipRef.current.y, present: false, ts });
                }
              }
            } catch { /* skip frame */ }
          }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => { running = false; cancelAnimationFrame(raf); };
  }, [mode, ready, video]);

  return { tip, tipRef, modelReady };
}
