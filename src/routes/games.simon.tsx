// Simon Says — body parts edition. Cosmo says "Touch your nose!" The child
// confirms by tapping the body-part button on screen. (Voice recognition
// would need a server; we use a kid-friendly tap fallback that still teaches
// listening + body-part vocabulary.)
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useProfiles } from "@/lib/use-profiles";
import { addStars, getActiveProfileId, setProgress } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { KidButton } from "@/components/KidButton";
import { Celebration } from "@/components/Celebration";
import { CosmoBubble } from "@/components/CosmoBubble";
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/games/simon")({
  head: () => ({
    meta: [
      { title: "Simon Says — PlayLearn" },
      { name: "description", content: "Listen to Cosmo and tap the body part he asks for." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: SimonGame,
});

const PARTS = [
  { id: "nose", label: "Nose", emoji: "👃" },
  { id: "eyes", label: "Eyes", emoji: "👀" },
  { id: "mouth", label: "Mouth", emoji: "👄" },
  { id: "ears", label: "Ears", emoji: "👂" },
  { id: "hands", label: "Hands", emoji: "✋" },
  { id: "feet", label: "Feet", emoji: "🦶" },
  { id: "head", label: "Head", emoji: "🧠" },
  { id: "tummy", label: "Tummy", emoji: "🫃" },
];

function SimonGame() {
  const { active } = useProfiles();
  const [target, setTarget] = useState(PARTS[0]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"" | "good" | "bad">("");
  const [celebrate, setCelebrate] = useState(false);

  const choices = useMemo(() => {
    const others = PARTS.filter((p) => p.id !== target.id).sort(() => Math.random() - 0.5).slice(0, 3);
    return [...others, target].sort(() => Math.random() - 0.5);
  }, [target]);

  const speakTarget = (p: typeof target) => speak(`Simon says, touch your ${p.label.toLowerCase()}!`, { pitch: 1.35 });
  useEffect(() => { speakTarget(target); /* eslint-disable-next-line */ }, [target.id]);

  const next = () => {
    let p = target;
    while (p.id === target.id) p = PARTS[Math.floor(Math.random() * PARTS.length)];
    setTarget(p);
    setFeedback("");
  };

  const pick = (id: string) => {
    if (id === target.id) {
      sfx.star();
      setFeedback("good");
      setScore((s) => s + 1);
      setStreak((s) => {
        const ns = s + 1;
        if (ns >= 5) {
          if (active) { addStars(active.id, 1); setProgress(active.id, "simon", Math.min(1, (active.progress.simon ?? 0) + 0.1)); }
          setCelebrate(true);
          return 0;
        }
        return ns;
      });
      window.setTimeout(next, 700);
    } else {
      sfx.fail();
      setFeedback("bad");
      setStreak(0);
      window.setTimeout(() => speakTarget(target), 400);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Simon Says" />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 sm:px-6">
        <div className="mb-4 flex w-full items-center justify-between gap-3">
          <CosmoBubble message={`Touch your ${target.label}!`} emoji={target.emoji} size="md" />
          <div className="flex flex-col items-center rounded-2xl bg-white px-4 py-2 shadow-cartoon">
            <div className="text-xs font-bold text-muted-foreground">SCORE</div>
            <div className="text-display text-2xl font-extrabold text-primary">{score}</div>
            <div className="text-xs font-bold text-grass">streak {streak}/5</div>
          </div>
        </div>

        <button onClick={() => speakTarget(target)} className="mb-4 rounded-full bg-white px-5 py-2 text-sm font-bold text-primary shadow-cartoon">🔊 Hear again</button>

        <div className={`grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4 ${feedback === "good" ? "animate-pop" : ""}`}>
          {choices.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl bg-white p-4 text-display text-xl font-extrabold shadow-cartoon transition-transform active:translate-y-1 ${feedback === "bad" ? "ring-4 ring-destructive/50" : ""}`}
            >
              <span className="text-6xl">{p.emoji}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {feedback === "bad" && <p className="mt-4 text-center text-display text-xl font-extrabold text-destructive">Try again — listen carefully!</p>}

        <div className="mt-6 flex gap-3">
          <KidButton variant="white" size="md" onClick={next}>⏭️ Skip</KidButton>
        </div>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        totalStars={4}
        message="GREAT LISTENING!"
        onPlayAgain={() => { setCelebrate(false); setStreak(0); }}
        onContinue={() => { setCelebrate(false); next(); }}
      />
    </main>
  );
}
