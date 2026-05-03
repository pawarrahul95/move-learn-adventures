// Alphabet Air-Tracing.
// Child shows their hand to the camera; index fingertip becomes a paint brush.
// We measure how much of the target letter's stroke they covered.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useCamera } from "@/lib/use-camera";
import { useFingertip } from "@/lib/use-fingertip";
import { tvStatus } from "@/routes/tv";
import { useProfiles } from "@/lib/use-profiles";
import { addLetter, addStars, getActiveProfileId } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { CenterMessage } from "@/components/CenterMessage";
import { KidButton } from "@/components/KidButton";
import { Celebration } from "@/components/Celebration";
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/games/alphabet")({
  head: () => ({
    meta: [
      { title: "Air Letters — PlayLearn" },
      { name: "description", content: "Trace letters in the air with your finger." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: AlphabetGame,
});

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Simple stroke definitions per letter as polylines (normalized 0..1 inside 1x1 box).
// Each letter has 1+ strokes; we just need points to sample target paint pixels.
const LETTER_STROKES: Record<string, number[][][]> = {
  A: [[[0.1, 1], [0.5, 0]], [[0.5, 0], [0.9, 1]], [[0.25, 0.6], [0.75, 0.6]]],
  B: [[[0.2, 0], [0.2, 1]], [[0.2, 0], [0.65, 0], [0.8, 0.15], [0.65, 0.45], [0.2, 0.5]], [[0.2, 0.5], [0.7, 0.55], [0.85, 0.75], [0.7, 1], [0.2, 1]]],
  C: [[[0.85, 0.15], [0.5, 0], [0.2, 0.2], [0.15, 0.5], [0.2, 0.8], [0.5, 1], [0.85, 0.85]]],
  D: [[[0.2, 0], [0.2, 1]], [[0.2, 0], [0.6, 0], [0.85, 0.3], [0.85, 0.7], [0.6, 1], [0.2, 1]]],
  E: [[[0.8, 0], [0.2, 0], [0.2, 1], [0.8, 1]], [[0.2, 0.5], [0.7, 0.5]]],
  F: [[[0.8, 0], [0.2, 0], [0.2, 1]], [[0.2, 0.5], [0.7, 0.5]]],
  G: [[[0.85, 0.15], [0.5, 0], [0.2, 0.2], [0.15, 0.5], [0.2, 0.8], [0.5, 1], [0.85, 0.85], [0.85, 0.55], [0.55, 0.55]]],
  H: [[[0.2, 0], [0.2, 1]], [[0.8, 0], [0.8, 1]], [[0.2, 0.5], [0.8, 0.5]]],
  I: [[[0.2, 0], [0.8, 0]], [[0.5, 0], [0.5, 1]], [[0.2, 1], [0.8, 1]]],
  J: [[[0.3, 0], [0.8, 0]], [[0.65, 0], [0.65, 0.8], [0.5, 1], [0.25, 0.95], [0.15, 0.75]]],
  K: [[[0.2, 0], [0.2, 1]], [[0.8, 0], [0.2, 0.5], [0.8, 1]]],
  L: [[[0.2, 0], [0.2, 1], [0.85, 1]]],
  M: [[[0.1, 1], [0.15, 0], [0.5, 0.7], [0.85, 0], [0.9, 1]]],
  N: [[[0.15, 1], [0.2, 0], [0.8, 1], [0.85, 0]]],
  O: [[[0.5, 0], [0.85, 0.2], [0.9, 0.5], [0.85, 0.8], [0.5, 1], [0.15, 0.8], [0.1, 0.5], [0.15, 0.2], [0.5, 0]]],
  P: [[[0.2, 1], [0.2, 0], [0.7, 0], [0.85, 0.15], [0.85, 0.4], [0.7, 0.55], [0.2, 0.55]]],
  Q: [[[0.5, 0], [0.85, 0.2], [0.9, 0.5], [0.85, 0.8], [0.5, 1], [0.15, 0.8], [0.1, 0.5], [0.15, 0.2], [0.5, 0]], [[0.6, 0.7], [0.95, 1.05]]],
  R: [[[0.2, 1], [0.2, 0], [0.7, 0], [0.85, 0.15], [0.85, 0.4], [0.7, 0.55], [0.2, 0.55]], [[0.45, 0.55], [0.85, 1]]],
  S: [[[0.85, 0.15], [0.5, 0], [0.2, 0.15], [0.2, 0.35], [0.5, 0.5], [0.8, 0.65], [0.8, 0.85], [0.5, 1], [0.15, 0.85]]],
  T: [[[0.1, 0], [0.9, 0]], [[0.5, 0], [0.5, 1]]],
  U: [[[0.15, 0], [0.15, 0.7], [0.4, 1], [0.6, 1], [0.85, 0.7], [0.85, 0]]],
  V: [[[0.1, 0], [0.5, 1], [0.9, 0]]],
  W: [[[0.05, 0], [0.25, 1], [0.5, 0.4], [0.75, 1], [0.95, 0]]],
  X: [[[0.15, 0], [0.85, 1]], [[0.85, 0], [0.15, 1]]],
  Y: [[[0.15, 0], [0.5, 0.55]], [[0.85, 0], [0.5, 0.55]], [[0.5, 0.55], [0.5, 1]]],
  Z: [[[0.15, 0], [0.85, 0]], [[0.85, 0], [0.15, 1]], [[0.15, 1], [0.85, 1]]],
};

// Densify polylines to many target points so we can mark coverage.
function letterTargetPoints(letter: string, w: number, h: number): { x: number; y: number; hit: boolean }[] {
  const strokes = LETTER_STROKES[letter];
  if (!strokes) return [];
  const out: { x: number; y: number; hit: boolean }[] = [];
  const step = 14; // pixels between samples
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.length - 1; i++) {
      const [x1, y1] = stroke[i];
      const [x2, y2] = stroke[i + 1];
      const ax = x1 * w, ay = y1 * h, bx = x2 * w, by = y2 * h;
      const dist = Math.hypot(bx - ax, by - ay);
      const n = Math.max(2, Math.ceil(dist / step));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, hit: false });
      }
    }
  }
  return out;
}

function AlphabetGame() {
  const { active } = useProfiles();
  const [letterIdx, setLetterIdx] = useState(0);
  const letter = LETTERS[letterIdx];

  // If a phone is paired via /tv, source landmarks from there and skip the
  // local webcam entirely. Otherwise use the page's own camera.
  const remote = tvStatus().kind === "paired";
  const { videoRef, ready, error } = useCamera(!remote, "user");
  const { tip, modelReady } = useFingertip({
    mode: remote ? "remote" : "local",
    video: videoRef.current,
    ready,
  });

  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const targetRef = useRef<{ x: number; y: number; hit: boolean }[]>([]);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const fingertipRef = useRef<{ x: number; y: number } | null>(null);
  const coverageRef = useRef(0);

  // Coverage updates UI ~5x/sec via rAF tick — avoids React renders per frame.
  const [coverage, setCoverage] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const celebrateRef = useRef(false);

  // Resize canvas to wrapper, recompute target points for current letter.
  const resizeAndReset = useCallback(() => {
    const c = overlayRef.current, wrap = wrapRef.current;
    if (!c || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    // Use device pixel ratio for crisp lines without re-layouting.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    c.style.width = `${rect.width}px`;
    c.style.height = `${rect.height}px`;
    const ctx = c.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Letter is drawn into a centered square padded box.
    const pad = Math.min(rect.width, rect.height) * 0.1;
    const size = Math.min(rect.width, rect.height) - pad * 2;
    const offX = (rect.width - size) / 2;
    const offY = (rect.height - size) / 2;
    targetRef.current = letterTargetPoints(letter, size, size).map((p) => ({
      x: p.x + offX,
      y: p.y + offY,
      hit: false,
    }));
    trailRef.current = [];
    coverageRef.current = 0;
    setCoverage(0);
  }, [letter]);

  useEffect(() => {
    resizeAndReset();
    window.addEventListener("resize", resizeAndReset);
    return () => window.removeEventListener("resize", resizeAndReset);
  }, [resizeAndReset]);

  useEffect(() => {
    speak(`Trace the letter ${letter}`);
    celebrateRef.current = false;
    setCelebrate(false);
  }, [letter]);

  // Stash latest fingertip (normalized) in a ref so the rAF loop has access
  // without re-running the effect every detection.
  const tipRef = useRef(tip);
  tipRef.current = tip;

  // Render loop. Reads fingertip from tipRef, paints, marks hits.
  useEffect(() => {
    let raf = 0;
    let running = true;
    let lastUiSync = 0;

    const tick = () => {
      if (!running) return;
      const c = overlayRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        const rect = wrapRef.current?.getBoundingClientRect();
        if (ctx && rect) {
          ctx.clearRect(0, 0, rect.width, rect.height);

          // Draw target letter dots
          const pts = targetRef.current;
          for (const p of pts) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = p.hit ? "#22c55e" : "rgba(255,255,255,0.85)";
            ctx.strokeStyle = p.hit ? "#15803d" : "#1e293b";
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
          }

          // Project current fingertip onto canvas. Mirror X to match selfie view.
          const t = tipRef.current;
          if (t.present) {
            const x = (1 - t.x) * rect.width;
            const y = t.y * rect.height;
            fingertipRef.current = { x, y };
            trailRef.current.push({ x, y });
            if (trailRef.current.length > 60) trailRef.current.shift();
            const r = 36;
            for (const p of pts) {
              if (!p.hit && (p.x - x) ** 2 + (p.y - y) ** 2 < r * r) p.hit = true;
            }
          } else {
            fingertipRef.current = null;
          }

          // Draw trail
          const trail = trailRef.current;
          if (trail.length > 1) {
            ctx.lineWidth = 14;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "rgba(255, 110, 90, 0.85)";
            ctx.beginPath();
            ctx.moveTo(trail[0].x, trail[0].y);
            for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
          }

          // Fingertip cursor
          if (fingertipRef.current) {
            const { x, y } = fingertipRef.current;
            ctx.beginPath();
            ctx.arc(x, y, 18, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fillStyle = "#ff6b6b";
            ctx.fill();
          }

          // Compute coverage from cached hit count
          let hit = 0;
          for (const p of pts) if (p.hit) hit++;
          const total = pts.length || 1;
          const cov = hit / total;
          coverageRef.current = cov;

          // Throttle UI sync to ~5 Hz to avoid React re-render churn.
          const now = performance.now();
          if (now - lastUiSync > 200) {
            lastUiSync = now;
            setCoverage(cov);
          }

          if (cov >= 0.85 && !celebrateRef.current) {
            celebrateRef.current = true;
            running = false;
            if (active) {
              addLetter(active.id, letter);
              addStars(active.id, 1);
            }
            sfx.success();
            setCelebrate(true);
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
  }, [letter, active]);

  const next = () => {
    setCelebrate(false);
    setLetterIdx((i) => (i + 1) % LETTERS.length);
  };
  const prev = () => setLetterIdx((i) => (i - 1 + LETTERS.length) % LETTERS.length);
  const skip = () => setLetterIdx((i) => (i + 1) % LETTERS.length);
  const reset = () => {
    targetRef.current.forEach((p) => (p.hit = false));
    trailRef.current = [];
    setCoverage(0);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title={`Trace: ${letter}`} />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div
          ref={wrapRef}
          className="tv-stage-wrap relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon"
        >
          <video
            ref={videoRef}
            className="tv-cam-video absolute inset-0 h-full w-full -scale-x-100 object-cover"
            playsInline
            muted
          />
          <span className="tv-cam-badge hidden">📹 You</span>
          <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-white">
              <div>
                <p className="text-display text-2xl font-bold">Camera needed</p>
                <p className="mt-2">{error}</p>
              </div>
            </div>
          )}
          {!error && (!ready || !modelReady) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <CenterMessage title="Getting ready…" sub="Loading the magic camera" />
            </div>
          )}

          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-bold shadow">
            {Math.round(coverage * 100)}% traced
          </div>
        </div>

        <div className="my-4 flex items-center justify-center gap-3">
          <KidButton variant="white" size="md" onClick={prev}>← Prev</KidButton>
          <KidButton variant="sunny" size="md" onClick={reset}>↻ Reset</KidButton>
          <KidButton variant="white" size="md" onClick={skip}>Skip →</KidButton>
        </div>

        <p className="pb-6 text-center text-base font-bold text-sky-foreground">
          Point your finger at the camera and trace the dots!
        </p>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        message={`${letter}! Awesome!`}
        onContinue={next}
      />
    </main>
  );
}
