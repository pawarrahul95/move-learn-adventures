// Lightweight motion-intensity tracker using inter-frame difference on the
// camera feed. Powers jump counting, dance detection and "freeze" games.
//
// Pipeline (all on a 96x72 working canvas, ~7k pixels — cheap):
//   grayscale → diff vs previous frame → mean absolute diff = "intensity"
//   verticalCentroid = where in the frame the motion is happening (0..1, top..bottom)
//   A "jump" is registered when intensity spikes above threshold AND the
//   motion centroid moves up then down within ~600ms.
import { useEffect, useRef, useState } from "react";

export interface MotionSample {
  intensity: number;       // 0..1 average frame difference
  centroidY: number;       // 0..1 where the motion is (top=0, bottom=1)
  jumps: number;           // cumulative jump count since mount
  moving: boolean;         // currently moving (intensity > moveThreshold)
}

export function useMotion(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  opts: { moveThreshold?: number; jumpThreshold?: number } = {},
) {
  const moveTh = opts.moveThreshold ?? 0.06;
  const jumpTh = opts.jumpThreshold ?? 0.12;

  const [sample, setSample] = useState<MotionSample>({
    intensity: 0, centroidY: 0.5, jumps: 0, moving: false,
  });
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  useEffect(() => {
    if (!active) return;
    const W = 96, H = 72;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let prev: Uint8ClampedArray | null = null;
    let raf = 0, last = 0, running = true;
    let jumps = 0;
    // Jump state machine: idle -> rising (centroid moved up) -> falling -> count
    let phase: "idle" | "rising" | "peak" = "idle";
    let phaseAt = 0;
    let baseY = 0.5;

    const tick = (t: number) => {
      if (!running) return;
      if (t - last < 50) { raf = requestAnimationFrame(tick); return; }
      last = t;
      const v = videoRef.current;
      if (v && v.videoWidth > 0) {
        ctx.drawImage(v, 0, 0, W, H);
        const cur = ctx.getImageData(0, 0, W, H).data;
        let total = 0, weightedY = 0, weight = 0;
        if (prev) {
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const i = (y * W + x) * 4;
              const g1 = (cur[i] + cur[i + 1] + cur[i + 2]) / 3;
              const g2 = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
              const d = Math.abs(g1 - g2);
              if (d > 18) {
                total += d;
                weight += d;
                weightedY += d * y;
              }
            }
          }
        }
        const intensity = Math.min(1, total / (W * H * 80));
        const centroidY = weight > 0 ? weightedY / weight / H : 0.5;
        const moving = intensity > moveTh;

        // Jump detection
        if (phase === "idle" && intensity > jumpTh && centroidY < baseY - 0.06) {
          phase = "rising"; phaseAt = t;
        } else if (phase === "rising" && centroidY < 0.45) {
          phase = "peak"; phaseAt = t;
        } else if (phase === "peak" && centroidY > baseY - 0.02) {
          jumps += 1;
          phase = "idle";
        } else if (phase !== "idle" && t - phaseAt > 900) {
          phase = "idle";
        }
        // Slowly track resting baseline when still
        if (intensity < 0.03) baseY = baseY * 0.95 + centroidY * 0.05;

        prev = cur;
        setSample({ intensity, centroidY, jumps, moving });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [active, videoRef, moveTh, jumpTh]);

  return sample;
}
