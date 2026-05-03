// Unified fingertip source. Returns the latest index-fingertip position in
// normalized 0..1 coordinates (camera space, mirrored on the consumer).
//
// In "local" mode it runs MediaPipe HandLandmarker on the page's own webcam.
// In "remote" mode it subscribes to the TV pair bus — the phone runs the
// model and only streams ~24 bytes/frame here, eliminating both webcam
// startup time on the TV and any round-trip render cost.
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

export function useFingertip({ mode, video, ready }: Opts) {
  const [tip, setTip] = useState<Fingertip>({ x: 0, y: 0, present: false, ts: 0 });
  const [modelReady, setModelReady] = useState(mode === "remote");
  const tipRef = useRef(tip);
  tipRef.current = tip;

  // Remote: subscribe to the TV bus.
  useEffect(() => {
    if (mode !== "remote") return;
    setModelReady(true);
    return tvSubscribe((m) => {
      if (m.t !== "hand") return;
      setTip({ x: m.x, y: m.y, present: m.present, ts: m.ts });
    });
  }, [mode]);

  // Local: run hand tracking against the page's own video element.
  useEffect(() => {
    if (mode !== "local" || !ready || !video) return;
    let running = true;
    let raf = 0;

    (async () => {
      const landmarker = await getHandLandmarker();
      setModelReady(true);
      const tick = () => {
        if (!running) return;
        if (video.readyState >= 2) {
          try {
            const res = landmarker.detectForVideo(video, performance.now());
            const t = res.landmarks?.[0]?.[8];
            if (t) setTip({ x: t.x, y: t.y, present: true, ts: performance.now() });
            else setTip((p) => (p.present ? { ...p, present: false } : p));
          } catch { /* skip frame */ }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => { running = false; cancelAnimationFrame(raf); };
  }, [mode, ready, video]);

  return { tip, modelReady };
}
