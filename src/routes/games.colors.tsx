// Color Hunt — detect ONLY the foreground object (largest blob) and read its
// dominant color. Bounding box is drawn around the detected object.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/lib/use-camera";
import { useProfiles } from "@/lib/use-profiles";
import { addStars, getActiveProfileId, setProgress } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { CenterMessage } from "@/components/CenterMessage";
import { KidButton } from "@/components/KidButton";
import { Celebration } from "@/components/Celebration";
import { sfx, speak } from "@/lib/audio";
import { COLOR_META, segmentObject, type ColorName } from "@/lib/vision";

export const Route = createFileRoute("/games/colors")({
  head: () => ({
    meta: [
      { title: "Color Hunt — PlayLearn" },
      { name: "description", content: "Find objects with the right color and show them to the camera." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: ColorGame,
});

const TARGETS: ColorName[] = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "white", "black", "brown"];

function ColorGame() {
  const { active } = useProfiles();
  const { videoRef, ready, error } = useCamera(true, "environment");
  const procRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [target, setTarget] = useState<ColorName>("red");
  const [detected, setDetected] = useState<ColorName | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const matchedAtRef = useRef<number | null>(null);
  const recentRef = useRef<(ColorName | null)[]>([]);

  const pickTarget = (avoid?: ColorName) => {
    const pool = TARGETS.filter((c) => c !== avoid);
    const next = pool[Math.floor(Math.random() * pool.length)];
    setTarget(next);
    matchedAtRef.current = null;
    setHoldProgress(0);
    setCelebrate(false);
    recentRef.current = [];
    speak(`Find me something ${next}!`, { pitch: 1.3 });
  };

  useEffect(() => {
    speak(`Find me something ${target}!`, { pitch: 1.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    let raf = 0, running = true;
    let last = 0;
    const W = 192, H = 144; // ~27k pixels — fast

    const tick = (t: number) => {
      if (!running) return;
      // throttle to ~30fps
      if (t - last < 33) { raf = requestAnimationFrame(tick); return; }
      last = t;
      const v = videoRef.current, c = procRef.current, ov = overlayRef.current;
      if (v && c && ov && v.videoWidth > 0) {
        c.width = W; c.height = H;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, W, H);
          const img = ctx.getImageData(0, 0, W, H);
          const seg = segmentObject(img.data, W, H);

          // Smooth: confirm across last 3 frames
          recentRef.current.push(seg.color);
          if (recentRef.current.length > 3) recentRef.current.shift();
          const counts: Record<string, number> = {};
          for (const r of recentRef.current) if (r) counts[r] = (counts[r] || 0) + 1;
          let stable: ColorName | null = null, sc = 0;
          for (const k of Object.keys(counts) as ColorName[]) if (counts[k] > sc) { sc = counts[k]; stable = k; }
          if (sc < 2) stable = null;
          setDetected(stable);

          // overlay (in display space)
          ov.width = v.clientWidth; ov.height = v.clientHeight;
          const octx = ov.getContext("2d");
          if (octx) {
            octx.clearRect(0, 0, ov.width, ov.height);
            if (seg.bbox) {
              const sx = ov.width / W, sy = ov.height / H;
              const x = seg.bbox.x * sx, y = seg.bbox.y * sy;
              const bw = seg.bbox.w * sx, bh = seg.bbox.h * sy;
              octx.lineWidth = 4;
              octx.strokeStyle = stable ? COLOR_META[stable].swatch : "#ffffff";
              octx.shadowColor = "rgba(0,0,0,0.6)";
              octx.shadowBlur = 6;
              octx.strokeRect(x, y, bw, bh);
              if (stable) {
                octx.shadowBlur = 0;
                octx.fillStyle = COLOR_META[stable].swatch;
                octx.fillRect(x, Math.max(0, y - 28), Math.max(110, bw), 26);
                octx.fillStyle = "#ffffff";
                octx.font = "bold 18px system-ui, sans-serif";
                octx.fillText(stable.toUpperCase(), x + 8, Math.max(18, y - 9));
              }
            }
          }

          if (stable === target) {
            if (matchedAtRef.current === null) matchedAtRef.current = performance.now();
            const elapsed = performance.now() - matchedAtRef.current;
            const HOLD_MS = 1000;
            setHoldProgress(Math.min(1, elapsed / HOLD_MS));
            if (elapsed >= HOLD_MS && !celebrate) {
              if (active) {
                addStars(active.id, 1);
                setProgress(active.id, "colors", Math.min(1, (active.progress.colors ?? 0) + 0.1));
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

  const targetData = COLOR_META[target];
  const detectedData = detected ? COLOR_META[detected] : null;

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Color Hunt" />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div className="mb-3 flex items-center justify-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-cartoon">
          <span className="text-4xl">{targetData.emoji}</span>
          <span className="text-display text-2xl font-bold sm:text-3xl">
            Find something <span className="capitalize" style={{ color: targetData.swatch }}>{target}</span>!
          </span>
          <span
            className="h-8 w-8 rounded-full border-2 border-white shadow-pop"
            style={{ background: targetData.swatch }}
          />
        </div>

        <div className="tv-stage-wrap relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon">
          <video
            ref={videoRef}
            className="tv-cam-video absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />
          <canvas ref={procRef} className="hidden" />
          <canvas
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />

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
            {detectedData ? (
              <span className="flex items-center gap-2 text-sm font-bold capitalize">
                <span className="h-5 w-5 rounded-full border" style={{ background: detectedData.swatch }} />
                {detected}
              </span>
            ) : (
              <span className="text-sm font-bold text-muted-foreground">looking…</span>
            )}
            <div className="ml-auto flex h-3 w-32 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-grass transition-all" style={{ width: `${holdProgress * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="my-4 flex items-center justify-center gap-3">
          <KidButton variant="white" size="md" onClick={() => pickTarget(target)}>
            🎲 New Color
          </KidButton>
        </div>

        <p className="pb-6 text-center text-base font-bold text-sky-foreground">
          Hold one {target} object up against a plain background.
        </p>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        message={`${target.toUpperCase()}! Great find!`}
        onContinue={() => pickTarget(target)}
      />
    </main>
  );
}
