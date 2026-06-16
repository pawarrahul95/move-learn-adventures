// Fruit Slicer — hand-tracked.
// Camera opens, MediaPipe HandLandmarker tracks the index fingertip, and the
// child slices falling fruits by swiping their finger through them. Bombs
// end the round. Difficulty controls spawn rate and fall speed.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCamera } from "@/lib/use-camera";
import { useFingertip } from "@/lib/use-fingertip";
import { useProfiles } from "@/lib/use-profiles";
import { addStars, getActiveProfileId, setProgress } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { CenterMessage } from "@/components/CenterMessage";
import { KidButton } from "@/components/KidButton";
import { Celebration } from "@/components/Celebration";
import { CosmoBubble } from "@/components/CosmoBubble";
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/games/fruit")({
  head: () => ({
    meta: [
      { title: "Fruit Slicer — PlayLearn" },
      { name: "description", content: "Slice falling fruits with your hand using the camera!" },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: FruitGame,
});

type Difficulty = "easy" | "normal" | "hard";

const DIFFICULTY = {
  easy:   { spawnMs: 1400, speed: 0.18, bombChance: 0.05, label: "Easy" },
  normal: { spawnMs: 1000, speed: 0.28, bombChance: 0.12, label: "Normal" },
  hard:   { spawnMs: 650,  speed: 0.42, bombChance: 0.22, label: "Hard" },
} as const;

const FRUITS = ["🍎", "🍊", "🍋", "🍉", "🍓", "🍌", "🍇", "🥝", "🍑", "🥭"];
const BOMB = "💣";
const ROUND_SECONDS = 45;

interface Item {
  id: number;
  emoji: string;
  isBomb: boolean;
  x: number;        // 0..1 normalized horizontal position
  y: number;        // 0..1 normalized vertical position (0 top)
  vy: number;       // units per second (normalized)
  vx: number;
  rot: number;
  vrot: number;
  sliced: boolean;
  spawned: number;
}

function FruitGame() {
  const { active } = useProfiles();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [phase, setPhase] = useState<"setup" | "playing" | "ended">("setup");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [celebrate, setCelebrate] = useState(false);

  const cameraActive = phase === "playing";
  const { videoRef, ready, error } = useCamera(cameraActive, "user");
  const { tipRef, modelReady } = useFingertip({ mode: "local", video: videoRef.current, ready });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const trailRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const lastTipRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const idRef = useRef(1);

  const cfg = useMemo(() => (difficulty ? DIFFICULTY[difficulty] : DIFFICULTY.normal), [difficulty]);

  // Spawner + countdown
  useEffect(() => {
    if (phase !== "playing") return;
    const spawn = window.setInterval(() => {
      const isBomb = Math.random() < cfg.bombChance;
      itemsRef.current.push({
        id: idRef.current++,
        emoji: isBomb ? BOMB : FRUITS[Math.floor(Math.random() * FRUITS.length)],
        isBomb,
        x: 0.1 + Math.random() * 0.8,
        y: -0.1,
        vy: cfg.speed * (0.9 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * 0.05,
        rot: 0,
        vrot: (Math.random() - 0.5) * 2,
        sliced: false,
        spawned: performance.now(),
      });
    }, cfg.spawnMs);
    const tick = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) { window.clearInterval(tick); endRound(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { window.clearInterval(spawn); window.clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cfg.spawnMs, cfg.speed, cfg.bombChance]);

  // Main RAF loop: physics + slice detection + draw
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0; let running = true; let prev = performance.now();
    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      const cvs = canvasRef.current; const ctr = containerRef.current;
      if (!cvs || !ctr) { raf = requestAnimationFrame(loop); return; }
      const w = ctr.clientWidth, h = ctr.clientHeight;
      if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }
      const ctx = cvs.getContext("2d"); if (!ctx) { raf = requestAnimationFrame(loop); return; }

      // Mirror fingertip horizontally (camera is mirrored on screen)
      const fx = tip.present ? (1 - tip.x) : -1;
      const fy = tip.present ? tip.y : -1;
      const tNow = now;
      if (tip.present) {
        trailRef.current.push({ x: fx, y: fy, t: tNow });
        if (trailRef.current.length > 18) trailRef.current.shift();
      }
      // Compute fingertip speed
      let speed = 0;
      if (tip.present && lastTipRef.current) {
        const dx = fx - lastTipRef.current.x; const dy = fy - lastTipRef.current.y;
        const ddt = Math.max(0.001, (tNow - lastTipRef.current.t) / 1000);
        speed = Math.hypot(dx, dy) / ddt;
      }
      if (tip.present) lastTipRef.current = { x: fx, y: fy, t: tNow };

      // Update items
      for (const it of itemsRef.current) {
        if (it.sliced) continue;
        it.y += it.vy * dt;
        it.x += it.vx * dt;
        it.rot += it.vrot * dt;
        // Slice detection: fingertip within radius AND moving fast
        if (tip.present && speed > 0.6) {
          const dx = fx - it.x, dy = fy - it.y;
          if (Math.hypot(dx, dy) < 0.09) {
            it.sliced = true;
            if (it.isBomb) {
              sfx.fail();
              livesRef.current = Math.max(0, livesRef.current - 1);
              setLives(livesRef.current);
              if (livesRef.current <= 0) endRound();
            } else {
              sfx.star();
              scoreRef.current += 1;
              setScore(scoreRef.current);
            }
          }
        }
      }
      // Remove off-screen / sliced after delay
      itemsRef.current = itemsRef.current.filter((it) => {
        if (it.sliced) return now - it.spawned < 60000 && (now - it.spawned) % 1 < 800; // keep briefly handled below
        if (it.y > 1.15) {
          if (!it.isBomb) {
            // missed a fruit — lose a life only on Hard? Keep gentle: no life loss for misses
          }
          return false;
        }
        return true;
      });
      // Actually drop sliced after 250ms with fade
      itemsRef.current = itemsRef.current.filter((it) => !(it.sliced && now - it.spawned > 60000));

      // Draw
      ctx.clearRect(0, 0, w, h);
      // Trail
      if (trailRef.current.length > 1) {
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.shadowColor = "rgba(255,180,0,0.9)"; ctx.shadowBlur = 16;
        ctx.lineWidth = 8;
        ctx.beginPath();
        const pts = trailRef.current.filter((p) => tNow - p.t < 220);
        trailRef.current = pts;
        pts.forEach((p, i) => {
          const X = p.x * w, Y = p.y * h;
          if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // Items
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const size = Math.min(w, h) * 0.13;
      ctx.font = `${size}px system-ui, "Apple Color Emoji", sans-serif`;
      for (const it of itemsRef.current) {
        const X = it.x * w, Y = it.y * h;
        ctx.save();
        ctx.translate(X, Y);
        ctx.rotate(it.rot);
        if (it.sliced) { ctx.globalAlpha = 0.4; ctx.scale(1.3, 1.3); }
        ctx.fillText(it.emoji, 0, 0);
        ctx.restore();
      }
      // Fingertip dot
      if (tip.present) {
        ctx.beginPath(); ctx.arc(fx * w, fy * h, 12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = "oklch(0.6 0.22 25)"; ctx.stroke();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tip.x, tip.y, tip.present]);

  function startRound(d: Difficulty) {
    setDifficulty(d);
    scoreRef.current = 0; livesRef.current = 3;
    setScore(0); setLives(3); setTimeLeft(ROUND_SECONDS);
    itemsRef.current = []; trailRef.current = []; lastTipRef.current = null;
    setPhase("playing");
    speak("Slice the fruits! Avoid the bombs!", { pitch: 1.3 });
  }

  function endRound() {
    setPhase("ended");
    const s = scoreRef.current;
    if (active && s > 0) {
      const stars = s >= 25 ? 3 : s >= 12 ? 2 : 1;
      addStars(active.id, stars);
      setProgress(active.id, "fruit", Math.min(1, s / 30));
      setCelebrate(true);
    }
  }

  // -------- UI --------
  if (phase === "setup") {
    return (
      <main className="flex min-h-dvh flex-col bg-gradient-sky">
        <GameTopBar profile={active} title="Fruit Slicer" />
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 sm:px-6">
          <CosmoBubble message="Slice fruits with your hand! Avoid the bombs 💣" emoji="🍉" size="lg" />
          <h2 className="text-display text-3xl font-extrabold">Pick a difficulty</h2>
          <div className="grid w-full gap-4 sm:grid-cols-3">
            {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => startRound(d)}
                className={`flex flex-col items-center gap-2 rounded-3xl bg-white p-6 shadow-cartoon transition-transform hover:-translate-y-1 active:translate-y-0 ${d === "easy" ? "ring-4 ring-grass" : d === "normal" ? "ring-4 ring-sunny" : "ring-4 ring-destructive"}`}
              >
                <span className="text-6xl">{d === "easy" ? "🌱" : d === "normal" ? "⚡" : "🔥"}</span>
                <span className="text-display text-2xl font-extrabold">{DIFFICULTY[d].label}</span>
                <span className="text-sm font-bold text-muted-foreground">
                  {d === "easy" ? "Slow & few bombs" : d === "normal" ? "Balanced fun" : "Fast & risky!"}
                </span>
              </button>
            ))}
          </div>
          <p className="text-center text-sm font-bold text-muted-foreground">📷 Camera will open. Show your hand and swipe to slice!</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-black text-white">
      <GameTopBar profile={active} title={`Fruit Slicer · ${cfg.label}`} />
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2">
        <div className="rounded-2xl bg-white/15 px-4 py-2 text-display text-xl font-extrabold">⭐ {score}</div>
        <div className="rounded-2xl bg-white/15 px-4 py-2 text-display text-xl font-extrabold">{"❤️".repeat(lives) || "💔"}</div>
        <div className="rounded-2xl bg-white/15 px-4 py-2 text-display text-xl font-extrabold">⏱️ {timeLeft}s</div>
      </div>

      <div ref={containerRef} className="relative mx-auto aspect-[3/4] w-full max-w-md flex-1 overflow-hidden rounded-3xl bg-black sm:aspect-video sm:max-w-3xl">
        <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-60" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center"><div><p className="text-display text-2xl font-bold">Camera needed</p><p className="mt-2 text-sm opacity-80">{error}</p></div></div>}
        {!error && (!ready || !modelReady) && phase === "playing" && (
          <div className="absolute inset-0 flex items-center justify-center"><CenterMessage title="Getting hand tracking ready…" /></div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl justify-center gap-3 p-4">
        <KidButton variant="white" size="md" onClick={() => { setPhase("setup"); setDifficulty(null); }}>⏹️ Stop</KidButton>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={score >= 25 ? 3 : score >= 12 ? 2 : 1}
        totalStars={3}
        message={`SLICED ${score} FRUITS!`}
        onPlayAgain={() => { setCelebrate(false); if (difficulty) startRound(difficulty); }}
        onContinue={() => { setCelebrate(false); setPhase("setup"); setDifficulty(null); }}
      />
    </main>
  );
}
