// Shape Detective — segment foreground object, trace its contour, classify
// from triangle … hexagon plus circle/oval. Bounding box + label only inside
// the object region.
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/lib/use-camera";
import { useProfiles } from "@/lib/use-profiles";
import { addStars, getActiveProfileId, setProgress } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { CenterMessage } from "@/components/CenterMessage";
import { KidButton } from "@/components/KidButton";
import { Celebration } from "@/components/Celebration";
import { CosmoBubble } from "@/components/CosmoBubble";
import { sfx, speak } from "@/lib/audio";
import {
  classifyShape, COLOR_META, dominantColor, segmentObjectGray, traceContour,
  type ShapeName,
} from "@/lib/vision";

export const Route = createFileRoute("/games/shapes")({
  head: () => ({
    meta: [
      { title: "Shape Detective — PlayLearn" },
      { name: "description", content: "Bring me a triangle, square, circle, pentagon, hexagon and more!" },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: ShapeGame,
});

const SHAPES: { name: ShapeName; emoji: string; svg: ReactNode }[] = [
  { name: "triangle",  emoji: "🔺", svg: <polygon points="50,10 90,85 10,85" fill="currentColor" /> },
  { name: "square",    emoji: "🟦", svg: <rect x="15" y="15" width="70" height="70" rx="6" fill="currentColor" /> },
  { name: "rectangle", emoji: "▬",  svg: <rect x="8" y="28" width="84" height="44" rx="4" fill="currentColor" /> },
  { name: "circle",    emoji: "🟢", svg: <circle cx="50" cy="50" r="38" fill="currentColor" /> },
  { name: "oval",      emoji: "⬭",  svg: <ellipse cx="50" cy="50" rx="40" ry="26" fill="currentColor" /> },
  { name: "pentagon",  emoji: "⬟",  svg: <polygon points="50,8 92,38 76,86 24,86 8,38" fill="currentColor" /> },
  { name: "hexagon",   emoji: "⬢",  svg: <polygon points="50,8 88,30 88,70 50,92 12,70 12,30" fill="currentColor" /> },
];

function ShapeGame() {
  const { active } = useProfiles();
  const { videoRef, ready, error } = useCamera(true, "environment");
  const procRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [target, setTarget] = useState<ShapeName>("triangle");
  const [detected, setDetected] = useState<ShapeName | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const matchedAtRef = useRef<number | null>(null);
  const recentRef = useRef<(ShapeName | null)[]>([]);

  const pickTarget = (avoid?: ShapeName) => {
    const pool = SHAPES.filter((s) => s.name !== avoid);
    const next = pool[Math.floor(Math.random() * pool.length)].name;
    setTarget(next);
    matchedAtRef.current = null;
    setHoldProgress(0);
    setCelebrate(false);
    recentRef.current = [];
    speak(`Bring me a ${next}!`, { pitch: 1.3 });
  };

  useEffect(() => {
    speak(`Bring me a ${target}!`, { pitch: 1.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    let raf = 0, running = true;
    let last = 0;
    const W = 192, H = 144;

    const tick = (t: number) => {
      if (!running) return;
      if (t - last < 33) { raf = requestAnimationFrame(tick); return; }
      last = t;
      const v = videoRef.current, c = procRef.current, ov = overlayRef.current;
      if (v && c && ov && v.videoWidth > 0) {
        c.width = W; c.height = H;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, W, H);
          const img = ctx.getImageData(0, 0, W, H);
          const seg = segmentObjectGray(img.data, W, H);

          let shape: ShapeName | null = null;
          let vertices = 0, circularity = 0;
          let contourPts: { x: number; y: number }[] = [];
          let segColor: ReturnType<typeof dominantColor> = null;
          if (seg.bbox) {
            contourPts = traceContour(seg.mask, W, H, seg.bbox);
            if (contourPts.length > 0) {
              const cls = classifyShape(contourPts, seg.bbox);
              shape = cls.shape;
              vertices = cls.vertices;
              circularity = cls.circularity;
            }
            segColor = dominantColor(img.data, seg.mask, W, H);
          }

          recentRef.current.push(shape);
          if (recentRef.current.length > 5) recentRef.current.shift();
          const counts: Record<string, number> = {};
          for (const r of recentRef.current) if (r) counts[r] = (counts[r] || 0) + 1;
          let stable: ShapeName | null = null, sc = 0;
          for (const k of Object.keys(counts) as ShapeName[]) if (counts[k] > sc) { sc = counts[k]; stable = k; }
          if (sc < 3) stable = null;
          setDetected(stable);

          // Overlay
          ov.width = v.clientWidth; ov.height = v.clientHeight;
          const octx = ov.getContext("2d");
          if (octx) {
            octx.clearRect(0, 0, ov.width, ov.height);
            if (seg.bbox) {
              const sx = ov.width / W, sy = ov.height / H;
              const x = seg.bbox.x * sx, y = seg.bbox.y * sy;
              const bw = seg.bbox.w * sx, bh = seg.bbox.h * sy;
              const accent = segColor ? COLOR_META[segColor].swatch : "#22c55e";
              if (contourPts.length > 1) {
                octx.lineWidth = 2;
                octx.strokeStyle = accent;
                octx.beginPath();
                octx.moveTo(contourPts[0].x * sx, contourPts[0].y * sy);
                for (let i = 1; i < contourPts.length; i++) {
                  octx.lineTo(contourPts[i].x * sx, contourPts[i].y * sy);
                }
                octx.stroke();
              }
              octx.lineWidth = 4;
              octx.strokeStyle = accent;
              octx.shadowColor = "rgba(0,0,0,0.6)";
              octx.shadowBlur = 6;
              octx.strokeRect(x, y, bw, bh);
              octx.shadowBlur = 0;
              if (stable) {
                octx.fillStyle = accent;
                const labelText = `${segColor ? segColor.toUpperCase() + " " : ""}${stable.toUpperCase()}`;
                octx.font = "bold 18px system-ui, sans-serif";
                const tw = Math.max(140, octx.measureText(labelText).width + 16);
                octx.fillRect(x, Math.max(0, y - 28), tw, 26);
                octx.fillStyle = "#ffffff";
                octx.fillText(labelText, x + 8, Math.max(18, y - 9));
              }
              // Debug chip — vertices + circularity
              octx.fillStyle = "rgba(0,0,0,0.55)";
              octx.fillRect(x, y + bh + 4, 150, 22);
              octx.fillStyle = "#ffffff";
              octx.font = "bold 12px system-ui, sans-serif";
              octx.fillText(`v:${vertices}  c:${circularity.toFixed(2)}`, x + 6, y + bh + 19);
            }
          }

          if (stable === target) {
            if (matchedAtRef.current === null) matchedAtRef.current = performance.now();
            const elapsed = performance.now() - matchedAtRef.current;
            const HOLD_MS = 1200;
            setHoldProgress(Math.min(1, elapsed / HOLD_MS));
            if (elapsed >= HOLD_MS && !celebrate) {
              if (active) {
                addStars(active.id, 1);
                setProgress(active.id, "shapes", Math.min(1, (active.progress.shapes ?? 0) + 0.12));
              }
              sfx.success();
              setCelebrate(true);
            }
          } else {
            matchedAtRef.current = null;
            setHoldProgress(0);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [ready, target, active, celebrate, videoRef]);

  const targetData = SHAPES.find((s) => s.name === target)!;

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Shape Detective" />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div className="mb-3 flex items-center justify-center">
          <CosmoBubble message={`Bring me a ${target}!`} emoji={targetData.emoji} size="md" />
        </div>

        <div className="tv-stage-wrap relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon">
          <video
            ref={videoRef}
            className="tv-cam-video absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />
          <canvas ref={procRef} className="hidden" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-white">
              <div>
                <p className="text-display text-2xl font-bold">Camera needed</p>
                <p className="mt-2">{error}</p>
              </div>
            </div>
          )}
          {!error && !ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <CenterMessage title="Loading camera…" />
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 shadow">
            <span className="text-sm font-bold text-muted-foreground">I see:</span>
            <span className="text-sm font-bold capitalize">{detected ?? "looking…"}</span>
            <div className="ml-auto flex h-3 w-32 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-grass transition-all" style={{ width: `${holdProgress * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="my-4 flex items-center justify-center gap-3">
          <KidButton variant="white" size="md" onClick={() => pickTarget(target)}>
            🎲 New Shape
          </KidButton>
        </div>

        <p className="pb-6 text-center text-base font-bold text-sky-foreground">
          Hold the {target}-shaped object steady against a plain background.
        </p>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        message={`A ${target}! Great eyes!`}
        onContinue={() => pickTarget(target)}
      />
    </main>
  );
}
