// Simon Says — camera + pose tracked.
// Cosmo's voice tells the child to touch a body part. We open the camera and
// run MediaPipe PoseLandmarker. The child must actually bring a hand (wrist)
// close to the target landmark to score. Two-handed targets ("hands" = clap)
// and feet are handled specially.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCamera } from "@/lib/use-camera";
import { getPoseLandmarker } from "@/lib/mediapipe";
import { useProfiles } from "@/lib/use-profiles";
import { addStars, getActiveProfileId, setProgress } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { CenterMessage } from "@/components/CenterMessage";
import { KidButton } from "@/components/KidButton";
import { Celebration } from "@/components/Celebration";
import { CosmoBubble } from "@/components/CosmoBubble";
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/games/simon")({
  head: () => ({
    meta: [
      { title: "Simon Says — PlayLearn" },
      { name: "description", content: "Cosmo says — touch the body part! Camera tracks your moves." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: SimonGame,
});

// MediaPipe Pose landmark indices we use:
// 0 nose · 2/5 eyes · 7/8 ears · 9/10 mouth · 11/12 shoulders ·
// 15/16 wrists · 23/24 hips · 25/26 knees · 27/28 ankles
type Lm = { x: number; y: number; visibility?: number };
type CheckResult = { ok: boolean; targetXY: { x: number; y: number } | null };

interface BodyPart {
  id: string;
  label: string;
  emoji: string;
  check: (lms: Lm[]) => CheckResult;
}

function avg(a: Lm, b: Lm) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function dist(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y); }
function wristNear(lms: Lm[], target: { x: number; y: number }, th = 0.09): CheckResult {
  const w1 = lms[15], w2 = lms[16];
  const ok = (w1 && dist(w1, target) < th) || (w2 && dist(w2, target) < th);
  return { ok: !!ok, targetXY: target };
}

const PARTS: BodyPart[] = [
  { id: "nose", label: "Nose", emoji: "👃", check: (l) => wristNear(l, l[0]) },
  { id: "head", label: "Head", emoji: "🧠", check: (l) => wristNear(l, { x: l[0].x, y: l[0].y - 0.08 }) },
  { id: "eyes", label: "Eyes", emoji: "👀", check: (l) => wristNear(l, avg(l[2], l[5])) },
  { id: "ears", label: "Ears", emoji: "👂", check: (l) => wristNear(l, avg(l[7], l[8]), 0.1) },
  { id: "mouth", label: "Mouth", emoji: "👄", check: (l) => wristNear(l, avg(l[9], l[10])) },
  { id: "shoulders", label: "Shoulders", emoji: "💪", check: (l) => wristNear(l, avg(l[11], l[12]), 0.12) },
  { id: "tummy", label: "Tummy", emoji: "🫃", check: (l) => wristNear(l, avg(l[23], l[24]), 0.12) },
  { id: "knees", label: "Knees", emoji: "🦵", check: (l) => wristNear(l, avg(l[25], l[26]), 0.12) },
  {
    id: "hands", label: "Hands together", emoji: "✋",
    check: (l) => ({ ok: l[15] && l[16] ? dist(l[15], l[16]) < 0.08 : false, targetXY: l[15] && l[16] ? avg(l[15], l[16]) : null }),
  },
  {
    id: "feet", label: "Toes", emoji: "🦶",
    // touch your toes: a wrist near either ankle
    check: (l) => {
      const w1 = l[15], w2 = l[16], a1 = l[27], a2 = l[28];
      const candidates: { x: number; y: number }[] = [];
      if (w1 && a1) candidates.push({ d: dist(w1, a1), p: a1 } as never);
      if (w1 && a2) candidates.push({ d: dist(w1, a2), p: a2 } as never);
      if (w2 && a1) candidates.push({ d: dist(w2, a1), p: a1 } as never);
      if (w2 && a2) candidates.push({ d: dist(w2, a2), p: a2 } as never);
      const best = (candidates as unknown as { d: number; p: Lm }[]).sort((x, y) => x.d - y.d)[0];
      return { ok: !!best && best.d < 0.12, targetXY: best ? best.p : null };
    },
  },
];

const HOLD_FRAMES = 6; // consecutive frames the touch must be held to count

function SimonGame() {
  const { active } = useProfiles();
  const [target, setTarget] = useState(PARTS[0]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"" | "good" | "bad">("");
  const [celebrate, setCelebrate] = useState(false);
  const [poseReady, setPoseReady] = useState(false);

  const { videoRef, ready, error } = useCamera(true, "user");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const targetRef = useRef(target);
  const holdRef = useRef(0);
  const cooldownRef = useRef(0); // frames after a correct hit
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  targetRef.current = target;

  const speakTarget = (p: BodyPart) => {
    const phrase = p.id === "hands"
      ? "Simon says, put your hands together!"
      : p.id === "feet"
        ? "Simon says, touch your toes!"
        : `Simon says, touch your ${p.label.toLowerCase()}!`;
    speak(phrase, { pitch: 1.35 });
  };

  useEffect(() => { speakTarget(target); /* eslint-disable-next-line */ }, [target.id]);

  const next = () => {
    let p = targetRef.current;
    while (p.id === targetRef.current.id) p = PARTS[Math.floor(Math.random() * PARTS.length)];
    holdRef.current = 0; cooldownRef.current = 30;
    setTarget(p);
    setFeedback("");
  };

  // Pose loop
  useEffect(() => {
    if (!ready) return;
    let raf = 0, running = true; let lastBad = 0;
    (async () => {
      const lm = await getPoseLandmarker();
      setPoseReady(true);
      const loop = () => {
        if (!running) return;
        const v = videoRef.current; const ctr = containerRef.current; const cvs = canvasRef.current;
        if (v && v.readyState >= 2 && ctr && cvs) {
          const w = ctr.clientWidth, h = ctr.clientHeight;
          if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }
          const ctx = cvs.getContext("2d");
          try {
            const res = lm.detectForVideo(v, performance.now());
            const lms = (res.landmarks?.[0] ?? []) as Lm[];
            ctx?.clearRect(0, 0, w, h);
            if (ctx && lms.length) {
              // Draw key skeleton dots (mirrored)
              ctx.fillStyle = "rgba(255,255,255,0.9)";
              for (const idx of [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28]) {
                const p = lms[idx]; if (!p) continue;
                ctx.beginPath();
                ctx.arc((1 - p.x) * w, p.y * h, 6, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            if (lms.length && cooldownRef.current <= 0) {
              const r = targetRef.current.check(lms);
              // Draw target marker (mirrored)
              if (ctx && r.targetXY) {
                ctx.beginPath();
                ctx.arc((1 - r.targetXY.x) * w, r.targetXY.y * h, 22, 0, Math.PI * 2);
                ctx.strokeStyle = r.ok ? "oklch(0.78 0.18 145)" : "oklch(0.85 0.18 60)";
                ctx.lineWidth = 5; ctx.stroke();
              }
              if (r.ok) {
                holdRef.current += 1;
                if (holdRef.current >= HOLD_FRAMES) {
                  // Correct!
                  sfx.star();
                  scoreRef.current += 1; streakRef.current += 1;
                  setScore(scoreRef.current); setStreak(streakRef.current);
                  setFeedback("good");
                  cooldownRef.current = 45; holdRef.current = 0;
                  if (streakRef.current >= 5) {
                    if (active) { addStars(active.id, 1); setProgress(active.id, "simon", Math.min(1, (active.progress.simon ?? 0) + 0.1)); }
                    streakRef.current = 0; setStreak(0);
                    setCelebrate(true);
                  } else {
                    window.setTimeout(() => next(), 700);
                  }
                }
              } else {
                holdRef.current = Math.max(0, holdRef.current - 1);
                // Gentle re-prompt every ~6s if no progress
                const now = performance.now();
                if (now - lastBad > 6000) { speakTarget(targetRef.current); lastBad = now; }
              }
            } else if (cooldownRef.current > 0) {
              cooldownRef.current -= 1;
            }
          } catch { /* skip frame */ }
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [ready, videoRef, active]);

  // Auto reset 'good' flash
  useEffect(() => { if (feedback === "good") { const t = setTimeout(() => setFeedback(""), 600); return () => clearTimeout(t); } }, [feedback]);

  const promptText = useMemo(() => target.id === "hands" ? "Put your hands together!" : target.id === "feet" ? "Touch your toes!" : `Touch your ${target.label}!`, [target]);

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Simon Says" />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 sm:px-6">
        <div className="mb-3 flex w-full items-center justify-between gap-3">
          <CosmoBubble message={promptText} emoji={target.emoji} size="md" />
          <div className="flex flex-col items-center rounded-2xl bg-white px-4 py-2 shadow-cartoon">
            <div className="text-xs font-bold text-muted-foreground">SCORE</div>
            <div className="text-display text-2xl font-extrabold text-primary">{score}</div>
            <div className="text-xs font-bold text-grass">streak {streak}/5</div>
          </div>
        </div>

        <div ref={containerRef} className={`relative aspect-[4/3] w-full max-w-3xl overflow-hidden rounded-3xl bg-black shadow-cartoon ${feedback === "good" ? "ring-8 ring-grass" : feedback === "bad" ? "ring-8 ring-destructive/60" : ""}`}>
          <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-white"><div><p className="text-display text-2xl font-bold">Camera needed</p><p className="mt-2 text-sm opacity-80">{error}</p></div></div>}
          {!error && (!ready || !poseReady) && <div className="absolute inset-0 flex items-center justify-center"><CenterMessage title="Getting body tracking ready…" /></div>}
          <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/90 px-5 py-2 text-display text-xl font-extrabold text-primary shadow-cartoon">
            {target.emoji} {promptText}
          </div>
        </div>

        {feedback === "good" && <p className="mt-3 text-center text-display text-2xl font-extrabold text-grass">GREAT JOB! ⭐</p>}

        <div className="mt-4 flex gap-3">
          <KidButton variant="white" size="md" onClick={() => speakTarget(target)}>🔊 Hear again</KidButton>
          <KidButton variant="sky" size="md" onClick={next}>⏭️ Skip</KidButton>
        </div>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        totalStars={4}
        message="GREAT LISTENING!"
        onPlayAgain={() => { setCelebrate(false); }}
        onContinue={() => { setCelebrate(false); next(); }}
      />
    </main>
  );
}
