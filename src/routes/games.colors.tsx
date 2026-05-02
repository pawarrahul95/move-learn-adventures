// Color Hunt — child shows an object of the prompted color in front of the camera.
// We sample a center patch and convert RGB→HSV to classify dominant color.
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

type ColorName = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";
const COLORS: { name: ColorName; emoji: string; swatch: string }[] = [
  { name: "red", emoji: "🍎", swatch: "#ef4444" },
  { name: "orange", emoji: "🍊", swatch: "#f97316" },
  { name: "yellow", emoji: "🍌", swatch: "#facc15" },
  { name: "green", emoji: "🥦", swatch: "#22c55e" },
  { name: "blue", emoji: "🫐", swatch: "#3b82f6" },
  { name: "purple", emoji: "🍇", swatch: "#a855f7" },
  { name: "pink", emoji: "🌸", swatch: "#ec4899" },
];

function rgb2hsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function classify(h: number, s: number, v: number): ColorName | null {
  if (v < 0.2) return null; // too dark
  if (s < 0.25) return null; // too gray
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 65) return "yellow";
  if (h < 170) return "green";
  if (h < 250) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

function ColorGame() {
  const { active } = useProfiles();
  const { videoRef, ready, error } = useCamera(true, "environment");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [target, setTarget] = useState<ColorName>("red");
  const [detected, setDetected] = useState<ColorName | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const matchedAtRef = useRef<number | null>(null);

  // Pick a new target
  const pickTarget = (avoid?: ColorName) => {
    const pool = COLORS.filter((c) => c.name !== avoid);
    const next = pool[Math.floor(Math.random() * pool.length)].name;
    setTarget(next);
    matchedAtRef.current = null;
    setHoldProgress(0);
    setCelebrate(false);
    speak(`Find me something ${next}!`, { pitch: 1.3 });
  };

  useEffect(() => {
    speak(`Find me something ${target}!`, { pitch: 1.3 });
    // run once on mount; subsequent prompts handled in pickTarget
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sampling loop
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let running = true;

    const tick = () => {
      if (!running) return;
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.videoWidth > 0) {
        const cw = 64, ch = 48;
        c.width = cw;
        c.height = ch;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          // Sample center 50% region
          const sx = v.videoWidth * 0.25, sy = v.videoHeight * 0.25;
          const sw = v.videoWidth * 0.5, sh = v.videoHeight * 0.5;
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, cw, ch);
          const data = ctx.getImageData(0, 0, cw, ch).data;
          const counts: Record<string, number> = {};
          let rSum = 0, gSum = 0, bSum = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            rSum += r; gSum += g; bSum += b; n++;
            const { h, s, v: val } = rgb2hsv(r, g, b);
            const cls = classify(h, s, val);
            if (cls) counts[cls] = (counts[cls] || 0) + 1;
          }
          let best: ColorName | null = null;
          let bestCount = 0;
          for (const k of Object.keys(counts) as ColorName[]) {
            if (counts[k] > bestCount) {
              bestCount = counts[k];
              best = k;
            }
          }
          // Need at least 25% of patch to agree
          if (bestCount < n * 0.25) best = null;
          setDetected(best);

          // Hold to confirm
          if (best === target) {
            if (matchedAtRef.current === null) matchedAtRef.current = performance.now();
            const elapsed = performance.now() - matchedAtRef.current;
            const HOLD_MS = 1200;
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
          // Suppress lint warnings for unused sums
          void rSum; void gSum; void bSum;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [ready, target, active, celebrate, videoRef]);

  const targetData = COLORS.find((c) => c.name === target)!;
  const detectedData = detected ? COLORS.find((c) => c.name === detected) : null;

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

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Center crosshair box */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1/2 w-1/2 rounded-3xl border-4 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>

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
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ background: detectedData.swatch }}
                />
                {detected}
              </span>
            ) : (
              <span className="text-sm font-bold text-muted-foreground">looking…</span>
            )}
            <div className="ml-auto flex h-3 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-grass transition-all"
                style={{ width: `${holdProgress * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="my-4 flex items-center justify-center gap-3">
          <KidButton variant="white" size="md" onClick={() => pickTarget(target)}>
            🎲 New Color
          </KidButton>
        </div>

        <p className="pb-6 text-center text-base font-bold text-sky-foreground">
          Hold the {target} object inside the box and keep still!
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
