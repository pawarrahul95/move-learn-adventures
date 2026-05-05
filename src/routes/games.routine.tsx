// Routine Builder — drag/tap steps in the right order to learn habits like
// "Brushing teeth" or "Washing hands". Sequencing reinforces routine learning.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useProfiles } from "@/lib/use-profiles";
import { addStars, getActiveProfileId, setProgress } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { KidButton } from "@/components/KidButton";
import { Celebration } from "@/components/Celebration";
import { CosmoBubble } from "@/components/CosmoBubble";
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/games/routine")({
  head: () => ({
    meta: [
      { title: "Routine Builder — PlayLearn" },
      { name: "description", content: "Put the daily routine steps in the right order." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: RoutineGame,
});

type Routine = { id: string; title: string; emoji: string; steps: { e: string; t: string }[] };

const ROUTINES: Routine[] = [
  { id: "brush", title: "Brushing teeth", emoji: "🪥", steps: [
    { e: "🪥", t: "Pick up brush" },
    { e: "🦷", t: "Add toothpaste" },
    { e: "😁", t: "Brush teeth" },
    { e: "💧", t: "Rinse mouth" },
  ]},
  { id: "wash", title: "Washing hands", emoji: "🧼", steps: [
    { e: "🚰", t: "Turn on water" },
    { e: "🧼", t: "Use soap" },
    { e: "🤲", t: "Scrub hands" },
    { e: "🧻", t: "Dry hands" },
  ]},
  { id: "bed", title: "Going to bed", emoji: "🛏️", steps: [
    { e: "👕", t: "Put on PJs" },
    { e: "🪥", t: "Brush teeth" },
    { e: "📖", t: "Read a story" },
    { e: "😴", t: "Go to sleep" },
  ]},
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function RoutineGame() {
  const { active } = useProfiles();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const cur = ROUTINES[idx];
  const order = useMemo(() => shuffle(cur.steps.map((_, i) => i)), [cur.id]);

  useEffect(() => { speak(`Let's do ${cur.title}! Pick the first step.`, { pitch: 1.3 }); /* eslint-disable-next-line */ }, [idx]);

  const tap = (i: number) => {
    if (picked.includes(i)) return;
    const expected = picked.length;
    if (i === expected) {
      sfx.star();
      const next = [...picked, i];
      setPicked(next);
      if (next.length === cur.steps.length) {
        if (active) { addStars(active.id, 1); setProgress(active.id, "routine", (idx + 1) / ROUTINES.length); }
        sfx.success();
        setCelebrate(true);
      } else {
        speak(cur.steps[expected + 1]?.t ?? "", { pitch: 1.3 });
      }
    } else {
      sfx.fail();
      speak("Not yet — try the first one!", { pitch: 1.3 });
    }
  };

  const next = () => {
    setCelebrate(false);
    setIdx((i) => (i + 1) % ROUTINES.length);
    setPicked([]);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Routine Builder" />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div className="mb-4 flex items-center justify-center">
          <CosmoBubble message={cur.title.toUpperCase()} emoji={cur.emoji} size="md" />
        </div>

        {/* Order strip */}
        <div className="mb-4 grid grid-cols-4 gap-2 rounded-3xl bg-white p-3 shadow-cartoon">
          {cur.steps.map((s, i) => {
            const filledIdx = picked[i];
            const filled = filledIdx !== undefined ? cur.steps[filledIdx] : null;
            return (
              <div key={i} className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-4 border-dashed text-3xl ${filled ? "border-grass bg-grass/15" : "border-muted"}`}>
                {filled ? <><span>{filled.e}</span><span className="mt-1 text-xs font-bold">{filled.t}</span></> : <span className="text-muted-foreground">{i + 1}</span>}
              </div>
            );
          })}
        </div>

        {/* Choices */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {order.map((i) => {
            const used = picked.includes(i);
            return (
              <button
                key={i}
                disabled={used}
                onClick={() => tap(i)}
                className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl bg-white p-3 text-center text-display font-extrabold shadow-cartoon transition-transform active:translate-y-1 ${used ? "opacity-30" : "hover:-translate-y-1"}`}
              >
                <span className="text-5xl">{cur.steps[i].e}</span>
                <span className="text-sm">{cur.steps[i].t}</span>
              </button>
            );
          })}
        </div>

        <div className="my-4 flex justify-center gap-3">
          <KidButton variant="white" size="md" onClick={() => setPicked([])}>🔄 Reset</KidButton>
          <KidButton variant="berry" size="md" onClick={next}>⏭️ Next Routine</KidButton>
        </div>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        totalStars={4}
        message="GREAT ROUTINE!"
        onPlayAgain={() => { setCelebrate(false); setPicked([]); }}
        onContinue={next}
      />
    </main>
  );
}
