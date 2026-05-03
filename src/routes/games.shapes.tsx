// Shape Detective — child shows a real object; we threshold the camera frame,
// trace the largest contour, and approximate corners with Douglas-Peucker.
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
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/games/shapes")({
  head: () => ({
    meta: [
      { title: "Shape Detective — PlayLearn" },
      { name: "description", content: "Bring me a triangle, a square, or a circle!" },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: ShapeGame,
});

type ShapeName = "triangle" | "square" | "circle";
const SHAPES: { name: ShapeName; emoji: string; svg: ReactNode }[] = [
  {
    name: "triangle",
    emoji: "🔺",
    svg: <polygon points="50,10 90,85 10,85" fill="currentColor" />,
  },
  {
    name: "square",
    emoji: "🟦",
    svg: <rect x="15" y="15" width="70" height="70" rx="6" fill="currentColor" />,
  },
  {
    name: "circle",
    emoji: "🟢",
    svg: <circle cx="50" cy="50" r="38" fill="currentColor" />,
  },
];

// --- contour utilities ---------------------------------------------------

// Moore-Neighbor boundary trace on a binary mask.
function traceContour(mask: Uint8Array, w: number, h: number): { x: number; y: number }[] {
  // Find first foreground pixel
  let sx = -1, sy = -1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (mask[y * w + x]) { sx = x; sy = y; break; }
    }
    if (sx >= 0) break;
  }
  if (sx < 0) return [];

  // 8-neighborhood (clockwise starting from left)
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];

  const pts: { x: number; y: number }[] = [];
  let cx = sx, cy = sy;
  let prevDir = 6; // came from below
  const maxSteps = 8000;

  for (let i = 0; i < maxSteps; i++) {
    pts.push({ x: cx, y: cy });
    let found = false;
    const startDir = (prevDir + 6) % 8;
    for (let k = 0; k < 8; k++) {
      const d = (startDir + k) % 8;
      const nx = cx + dx[d], ny = cy + dy[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (mask[ny * w + nx]) {
        cx = nx; cy = ny; prevDir = d; found = true; break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy && pts.length > 4) break;
  }
  return pts;
}

// Perpendicular distance from p to segment a-b.
function perpDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const px = a.x + t * dx, py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

function rdp(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length < 3) return points;
  let maxD = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > epsilon) {
    const left = rdp(points.slice(0, idx + 1), epsilon);
    const right = rdp(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function classifyShape(contour: { x: number; y: number }[]): ShapeName | null {
  if (contour.length < 30) return null;
  // Compute bounding box and area for sanity / circularity
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of contour) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const bw = maxX - minX, bh = maxY - minY;
  if (bw < 30 || bh < 30) return null;

  // Perimeter
  let peri = 0;
  for (let i = 1; i < contour.length; i++) {
    peri += Math.hypot(contour[i].x - contour[i - 1].x, contour[i].y - contour[i - 1].y);
  }
  // Approx polygon
  const epsilon = 0.035 * peri;
  const poly = rdp(contour, epsilon);
  const corners = poly.length - 1; // last == first usually

  // Circularity = 4π·area / peri²
  // Estimate area via shoelace
  let area = 0;
  for (let i = 0; i < contour.length - 1; i++) {
    area += contour[i].x * contour[i + 1].y - contour[i + 1].x * contour[i].y;
  }
  area = Math.abs(area) / 2;
  const circ = (4 * Math.PI * area) / (peri * peri || 1);
  const aspect = bw / bh;

  if (circ > 0.78 && aspect > 0.7 && aspect < 1.4) return "circle";
  if (corners === 3) return "triangle";
  if (corners === 4 && aspect > 0.6 && aspect < 1.7) return "square";
  return null;
}

function ShapeGame() {
  const { active } = useProfiles();
  const { videoRef, ready, error } = useCamera(true, "environment");
  const procRef = useRef<HTMLCanvasElement | null>(null);
  const debugRef = useRef<HTMLCanvasElement | null>(null);

  const [target, setTarget] = useState<ShapeName>("triangle");
  const [detected, setDetected] = useState<ShapeName | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const matchedAtRef = useRef<number | null>(null);

  const pickTarget = (avoid?: ShapeName) => {
    const pool = SHAPES.filter((s) => s.name !== avoid);
    const next = pool[Math.floor(Math.random() * pool.length)].name;
    setTarget(next);
    matchedAtRef.current = null;
    setHoldProgress(0);
    setCelebrate(false);
    speak(`Bring me a ${next}!`, { pitch: 1.3 });
  };

  useEffect(() => {
    speak(`Bring me a ${target}!`, { pitch: 1.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let running = true;

    const tick = () => {
      if (!running) return;
      const v = videoRef.current, c = procRef.current, dbg = debugRef.current;
      if (v && c && dbg && v.videoWidth > 0) {
        const W = 160, H = 120;
        c.width = W; c.height = H;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, W, H);
          const img = ctx.getImageData(0, 0, W, H);
          const data = img.data;

          // Convert to grayscale, compute mean
          const gray = new Float32Array(W * H);
          let mean = 0;
          for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            gray[j] = g;
            mean += g;
          }
          mean /= W * H;

          // Threshold: pick darker-than-mean OR brighter-than-mean (whichever has fewer pixels)
          const darkMask = new Uint8Array(W * H);
          const brightMask = new Uint8Array(W * H);
          let darkCount = 0, brightCount = 0;
          for (let j = 0; j < gray.length; j++) {
            if (gray[j] < mean - 25) { darkMask[j] = 1; darkCount++; }
            else if (gray[j] > mean + 25) { brightMask[j] = 1; brightCount++; }
          }
          // Choose the side that occupies a reasonable middle range (object likely)
          let mask: Uint8Array;
          const total = W * H;
          const darkRatio = darkCount / total;
          const brightRatio = brightCount / total;
          if (darkRatio > 0.05 && darkRatio < 0.6 && darkRatio >= brightRatio) mask = darkMask;
          else if (brightRatio > 0.05 && brightRatio < 0.6) mask = brightMask;
          else { mask = darkMask; }

          // Erode once to remove specks (3x3 box)
          const eroded = new Uint8Array(W * H);
          for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
              const i = y * W + x;
              if (
                mask[i] && mask[i - 1] && mask[i + 1] &&
                mask[i - W] && mask[i + W]
              ) eroded[i] = 1;
            }
          }

          const contour = traceContour(eroded, W, H);
          const cls = contour.length > 0 ? classifyShape(contour) : null;
          setDetected(cls);

          // Debug overlay sized to display
          dbg.width = W; dbg.height = H;
          const dctx = dbg.getContext("2d");
          if (dctx) {
            dctx.clearRect(0, 0, W, H);
            if (contour.length > 1) {
              dctx.strokeStyle = "#22c55e";
              dctx.lineWidth = 2;
              dctx.beginPath();
              dctx.moveTo(contour[0].x, contour[0].y);
              for (let i = 1; i < contour.length; i++) dctx.lineTo(contour[i].x, contour[i].y);
              dctx.closePath();
              dctx.stroke();
            }
          }

          if (cls === target) {
            if (matchedAtRef.current === null) matchedAtRef.current = performance.now();
            const elapsed = performance.now() - matchedAtRef.current;
            const HOLD_MS = 1500;
            setHoldProgress(Math.min(1, elapsed / HOLD_MS));
            if (elapsed >= HOLD_MS && !celebrate) {
              if (active) {
                addStars(active.id, 1);
                setProgress(active.id, "shapes", Math.min(1, (active.progress.shapes ?? 0) + 0.15));
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
    tick();
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [ready, target, active, celebrate, videoRef]);

  const targetData = SHAPES.find((s) => s.name === target)!;

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Shape Detective" />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div className="mb-3 flex items-center justify-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-cartoon">
          <svg viewBox="0 0 100 100" className="h-12 w-12 text-primary">{targetData.svg}</svg>
          <span className="text-display text-2xl font-bold capitalize sm:text-3xl">
            Bring me a {target}!
          </span>
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
            ref={debugRef}
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
            <span className="text-sm font-bold capitalize">{detected ?? "looking…"}</span>
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
