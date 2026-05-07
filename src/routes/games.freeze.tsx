// Musical Freeze — dance while the music plays. When music stops, FREEZE!
// If the player stays still long enough, they earn a star.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/lib/use-camera";
import { useMotion } from "@/lib/use-motion";
import { useProfiles } from "@/lib/use-profiles";
import { addStars, getActiveProfileId, setProgress } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { CenterMessage } from "@/components/CenterMessage";
import { Celebration } from "@/components/Celebration";
import { CosmoBubble } from "@/components/CosmoBubble";
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/games/freeze")({
  head: () => ({
    meta: [
      { title: "Musical Freeze — PlayLearn" },
      { name: "description", content: "Dance, then freeze when the music stops." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: FreezeGame,
});

type Phase = "ready" | "dance" | "freeze" | "puzzle" | "won" | "lost";

type Puzzle = { question: string; options: { e: string; label: string }[]; answer: number };
const PUZZLES: Puzzle[] = [
  { question: "Which one is RED?",     options: [{ e: "🍎", label: "Apple" }, { e: "🥦", label: "Broccoli" }, { e: "🫐", label: "Blueberry" }], answer: 0 },
  { question: "Which one is a CIRCLE?", options: [{ e: "🔺", label: "Triangle" }, { e: "⬛", label: "Square" }, { e: "🔵", label: "Circle" }], answer: 2 },
  { question: "Which animal hops?",    options: [{ e: "🐢", label: "Turtle" }, { e: "🐰", label: "Bunny" }, { e: "🐟", label: "Fish" }], answer: 1 },
  { question: "What comes after 2?",   options: [{ e: "1️⃣", label: "1" }, { e: "3️⃣", label: "3" }, { e: "5️⃣", label: "5" }], answer: 1 },
  { question: "Which one is YELLOW?",  options: [{ e: "🌻", label: "Sunflower" }, { e: "🍇", label: "Grapes" }, { e: "🍆", label: "Eggplant" }], answer: 0 },
];
function pickPuzzle(): Puzzle { return PUZZLES[Math.floor(Math.random() * PUZZLES.length)]; }


function playMelody() {
  // Reuse audio context from sfx by triggering a sequence of tones via a small loop
  if (typeof window === "undefined") return () => undefined;
  const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
  let timer = 0;
  const stops: (() => void)[] = [];
  const start = () => {
    notes.forEach((f, i) => {
      const t = ac.currentTime + i * 0.25;
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + 0.25);
      stops.push(() => { try { o.stop(); } catch { /* */ } });
    });
    timer = window.setTimeout(start, notes.length * 250);
  };
  start();
  return () => {
    clearTimeout(timer);
    stops.forEach((s) => s());
    ac.close().catch(() => undefined);
  };
}

function FreezeGame() {
  const { active } = useProfiles();
  const { videoRef, ready, error } = useCamera(true, "user");
  const motion = useMotion(videoRef, ready);
  const [phase, setPhase] = useState<Phase>("ready");
  const [celebrate, setCelebrate] = useState(false);
  const [round, setRound] = useState(1);
  const stopMusicRef = useRef<(() => void) | null>(null);
  const freezeStartRef = useRef<number>(0);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState<"" | "good" | "bad">("");

  useEffect(() => () => { stopMusicRef.current?.(); }, []);

  const startRound = () => {
    setCelebrate(false);
    setPuzzle(null);
    setPuzzleFeedback("");
    setPhase("dance");
    speak("Dance! Dance! Dance!", { pitch: 1.4 });
    stopMusicRef.current = playMelody();
    const danceFor = 3000 + Math.random() * 3000;
    window.setTimeout(() => {
      stopMusicRef.current?.();
      stopMusicRef.current = null;
      speak("Freeze!", { pitch: 1.6 });
      sfx.pop();
      freezeStartRef.current = performance.now();
      setPhase("freeze");
    }, danceFor);
  };

  useEffect(() => {
    if (phase !== "freeze") return;
    const id = window.setInterval(() => {
      const elapsed = performance.now() - freezeStartRef.current;
      if (motion.intensity > 0.08) {
        setPhase("lost");
        sfx.fail();
      } else if (elapsed > 2500) {
        if (active) { addStars(active.id, 1); setProgress(active.id, "freeze", Math.min(1, (active.progress.freeze ?? 0) + 0.15)); }
        sfx.success();
        setPhase("won");
        setCelebrate(true);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, motion.intensity, active]);

  const next = () => { setRound((r) => r + 1); startRound(); };

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Musical Freeze" />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div className="mb-3 flex items-center justify-center">
          <CosmoBubble
            message={
              phase === "dance" ? "DANCE!" :
              phase === "freeze" ? "FREEZE!" :
              phase === "lost" ? "Oops! Try again." :
              "Tap Start to dance!"
            }
            emoji={phase === "freeze" ? "🧊" : "🎵"}
            size="md"
          />
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon">
          <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" playsInline muted />
          {phase === "dance" && <div className="pointer-events-none absolute inset-0 animate-rainbow bg-gradient-rainbow opacity-30" />}
          {phase === "freeze" && <div className="pointer-events-none absolute inset-0 bg-sky/40" />}
          <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold uppercase text-primary shadow-pop">
            Round {round}
          </div>
          {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-white"><div><p className="text-display text-2xl font-bold">Camera needed</p><p className="mt-2">{error}</p></div></div>}
          {!error && !ready && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><CenterMessage title="Loading camera…" /></div>}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 shadow">
            <span className="text-sm font-bold text-muted-foreground">{phase === "freeze" ? "Stay still!" : "Move it!"}</span>
            <div className="ml-auto flex h-3 w-32 overflow-hidden rounded-full bg-muted">
              <div className={`h-full transition-all ${motion.intensity > 0.08 ? "bg-destructive" : "bg-grass"}`}
                style={{ width: `${Math.min(100, motion.intensity * 400)}%` }} />
            </div>
          </div>
        </div>

        <div className="my-4 flex justify-center gap-3">
          {phase === "ready" && <button onClick={startRound} className="rounded-full bg-primary px-8 py-4 text-display text-2xl font-extrabold text-primary-foreground shadow-cartoon">▶ Start</button>}
          {phase === "lost" && <button onClick={startRound} className="rounded-full bg-berry px-8 py-4 text-display text-2xl font-extrabold text-berry-foreground shadow-cartoon">🔁 Try Again</button>}
        </div>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        totalStars={4}
        message="PERFECT FREEZE!"
        onPlayAgain={startRound}
        onContinue={next}
      />
    </main>
  );
}
