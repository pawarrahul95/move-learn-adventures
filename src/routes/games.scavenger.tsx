// Scavenger Hunt — combines color + shape tasks. Picks a random task like
// "Bring me a RED CIRCLE" and uses the existing vision pipeline to confirm.
import { createFileRoute, redirect } from "@tanstack/react-router";
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
  type ColorName, type ShapeName,
} from "@/lib/vision";

export const Route = createFileRoute("/games/scavenger")({
  head: () => ({
    meta: [
      { title: "Scavenger Hunt — PlayLearn" },
      { name: "description", content: "Find an object that matches the color and shape Cosmo asks for." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: ScavengerGame,
});

const COLORS: ColorName[] = ["red", "blue", "yellow", "green", "orange", "purple"];
const SHAPES: ShapeName[] = ["circle", "square", "triangle", "rectangle"];
const TASK_TYPES = ["color", "shape", "both"] as const;
type Task = { color?: ColorName; shape?: ShapeName };

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function ScavengerGame() {
  const { active } = useProfiles();
  const { videoRef, ready, error } = useCamera(true, "environment");
  const procRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [task, setTask] = useState<Task>({ color: "red", shape: "circle" });
  const [score, setScore] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const matchedAtRef = useRef<number | null>(null);
  const recentRef = useRef<{ c: ColorName | null; s: ShapeName | null }[]>([]);

  const taskLabel = (t: Task) => `${t.color ? t.color.toUpperCase() + " " : ""}${t.shape ? t.shape.toUpperCase() : "OBJECT"}`;

  const newTask = () => {
    const type = pick(TASK_TYPES);
    const next: Task = {};
    if (type === "color" || type === "both") next.color = pick(COLORS);
    if (type === "shape" || type === "both") next.shape = pick(SHAPES);
    setTask(next);
    matchedAtRef.current = null;
    setHoldProgress(0);
    setCelebrate(false);
    recentRef.current = [];
    speak(`Find me a ${taskLabel(next).toLowerCase()}!`, { pitch: 1.3 });
  };

  useEffect(() => { newTask(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!ready) return;
    let raf = 0, last = 0, running = true;
    const W = 192, H = 144;
    const tick = (t: number) => {
      if (!running) return;
      if (t - last < 33) { raf = requestAnimationFrame(tick); return; }
      last = t;
      const v = videoRef.current, c = procRef.current, ov = overlayRef.current;
      if (v && c && ov && v.videoWidth > 0) {
        c.width = W; c.height = H;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) { raf = requestAnimationFrame(tick); return; }
        ctx.drawImage(v, 0, 0, W, H);
        const img = ctx.getImageData(0, 0, W, H);
        const seg = segmentObjectGray(img.data, W, H);
        let color: ColorName | null = null;
        let shape: ShapeName | null = null;
        let pts: { x: number; y: number }[] = [];
        if (seg.bbox) {
          color = dominantColor(img.data, seg.mask, W, H);
          pts = traceContour(seg.mask, W, H, seg.bbox);
          if (pts.length) shape = classifyShape(pts, seg.bbox).shape;
        }
        recentRef.current.push({ c: color, s: shape });
        if (recentRef.current.length > 5) recentRef.current.shift();
        const cnt = (k: "c" | "s") => {
          const m: Record<string, number> = {};
          for (const r of recentRef.current) { const v = r[k]; if (v) m[v] = (m[v] || 0) + 1; }
          let best: string | null = null, n = 0;
          for (const key of Object.keys(m)) if (m[key] > n) { n = m[key]; best = key; }
          return n >= 3 ? best : null;
        };
        const stableC = cnt("c") as ColorName | null;
        const stableS = cnt("s") as ShapeName | null;

        ov.width = v.clientWidth; ov.height = v.clientHeight;
        const octx = ov.getContext("2d");
        if (octx) {
          octx.clearRect(0, 0, ov.width, ov.height);
          if (seg.bbox) {
            const sx = ov.width / W, sy = ov.height / H;
            const accent = stableC ? COLOR_META[stableC].swatch : "#ffffff";
            octx.lineWidth = 4; octx.strokeStyle = accent;
            octx.shadowColor = "rgba(0,0,0,0.6)"; octx.shadowBlur = 6;
            octx.strokeRect(seg.bbox.x * sx, seg.bbox.y * sy, seg.bbox.w * sx, seg.bbox.h * sy);
            octx.shadowBlur = 0;
            const label = `${stableC ? stableC.toUpperCase() + " " : ""}${stableS ? stableS.toUpperCase() : ""}`.trim();
            if (label) {
              octx.fillStyle = accent;
              octx.font = "bold 18px system-ui, sans-serif";
              const w = Math.max(120, octx.measureText(label).width + 16);
              octx.fillRect(seg.bbox.x * sx, Math.max(0, seg.bbox.y * sy - 28), w, 26);
              octx.fillStyle = "#ffffff";
              octx.fillText(label, seg.bbox.x * sx + 8, Math.max(18, seg.bbox.y * sy - 9));
            }
          }
        }

        const okColor = !task.color || task.color === stableC;
        const okShape = !task.shape || task.shape === stableS;
        if (okColor && okShape && (task.color || task.shape)) {
          if (matchedAtRef.current === null) matchedAtRef.current = performance.now();
          const elapsed = performance.now() - matchedAtRef.current;
          const HOLD = 1100;
          setHoldProgress(Math.min(1, elapsed / HOLD));
          if (elapsed >= HOLD && !celebrate) {
            if (active) { addStars(active.id, 1); setProgress(active.id, "scavenger", Math.min(1, (active.progress.scavenger ?? 0) + 0.1)); }
            sfx.success();
            setScore((s) => s + 1);
            setCelebrate(true);
          }
        } else {
          matchedAtRef.current = null;
          setHoldProgress(0);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [ready, task, active, celebrate, videoRef]);

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Scavenger Hunt" />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <CosmoBubble message={`Find a ${taskLabel(task)}!`} emoji="🔍" size="md" />
          <div className="rounded-full bg-white px-4 py-2 text-display font-extrabold text-primary shadow-cartoon">⭐ {score}</div>
        </div>

        <div className="tv-stage-wrap relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon">
          <video ref={videoRef} className="tv-cam-video absolute inset-0 h-full w-full object-cover" playsInline muted />
          <canvas ref={procRef} className="hidden" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-white"><div><p className="text-display text-2xl font-bold">Camera needed</p><p className="mt-2">{error}</p></div></div>}
          {!error && !ready && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><CenterMessage title="Loading camera…" /></div>}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 shadow">
            <span className="text-sm font-bold text-muted-foreground">Hold steady…</span>
            <div className="ml-auto flex h-3 w-32 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-grass transition-all" style={{ width: `${holdProgress * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="my-4 flex justify-center">
          <KidButton variant="white" size="md" onClick={newTask}>🎲 Skip Task</KidButton>
        </div>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        totalStars={4}
        message="TA-DA! YOU FOUND IT!"
        onPlayAgain={() => { setCelebrate(false); matchedAtRef.current = null; setHoldProgress(0); }}
        onContinue={newTask}
      />
    </main>
  );
}
