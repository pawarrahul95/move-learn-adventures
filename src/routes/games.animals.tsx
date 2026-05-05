// Animal Action Alphabet — "F is for Frog → Do 5 jumps". Uses motion-intensity
// tracker to count jumps automatically.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/lib/use-camera";
import { useMotion } from "@/lib/use-motion";
import { useProfiles } from "@/lib/use-profiles";
import { addStars, getActiveProfileId, setProgress } from "@/lib/profiles";
import { GameTopBar } from "@/components/GameTopBar";
import { CenterMessage } from "@/components/CenterMessage";
import { KidButton } from "@/components/KidButton";
import { Celebration } from "@/components/Celebration";
import { CosmoBubble } from "@/components/CosmoBubble";
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/games/animals")({
  head: () => ({
    meta: [
      { title: "Animal Moves — PlayLearn" },
      { name: "description", content: "Letters become animals. Move like the animal to win stars." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: AnimalsGame,
});

const ANIMALS = [
  { letter: "F", animal: "Frog", emoji: "🐸", action: "5 frog jumps", goal: 5 },
  { letter: "K", animal: "Kangaroo", emoji: "🦘", action: "6 big jumps", goal: 6 },
  { letter: "B", animal: "Bunny", emoji: "🐰", action: "4 bunny hops", goal: 4 },
  { letter: "T", animal: "Tiger", emoji: "🐯", action: "Run in place 8 times", goal: 8 },
  { letter: "M", animal: "Monkey", emoji: "🐵", action: "5 jumping jacks", goal: 5 },
  { letter: "L", animal: "Lion", emoji: "🦁", action: "5 big stomps", goal: 5 },
];

function AnimalsGame() {
  const { active } = useProfiles();
  const { videoRef, ready, error } = useCamera(true, "user");
  const [idx, setIdx] = useState(0);
  const [start, setStart] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const motion = useMotion(videoRef, ready, { jumpThreshold: 0.1 });
  const cur = ANIMALS[idx];
  const counted = Math.max(0, motion.jumps - start);

  useEffect(() => { speak(`${cur.letter} is for ${cur.animal}! Do ${cur.action}.`, { pitch: 1.3 }); /* eslint-disable-next-line */ }, [idx]);

  useEffect(() => {
    if (counted >= cur.goal && !celebrate) {
      sfx.success();
      if (active) { addStars(active.id, 1); setProgress(active.id, "animals", (idx + 1) / ANIMALS.length); }
      setCelebrate(true);
    }
  }, [counted, cur.goal, celebrate, active, idx]);

  const next = () => {
    setCelebrate(false);
    setIdx((i) => (i + 1) % ANIMALS.length);
    setStart(motion.jumps);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Animal Moves" />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <CosmoBubble message={`${cur.letter} is for ${cur.animal}!`} emoji={cur.emoji} size="md" />
          <div className="rounded-full bg-sunny px-4 py-2 text-display text-xl font-extrabold text-sunny-foreground shadow-cartoon">
            {counted} / {cur.goal}
          </div>
        </div>
        <p className="mb-2 text-center text-display text-2xl font-extrabold text-primary">{cur.action}</p>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon">
          <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[18rem] opacity-20">
            {cur.emoji}
          </div>
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold uppercase text-primary shadow-pop">
            🤖 Counting moves
          </div>
          {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-white"><div><p className="text-display text-2xl font-bold">Camera needed</p><p className="mt-2">{error}</p></div></div>}
          {!error && !ready && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><CenterMessage title="Loading camera…" /></div>}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 shadow">
            <span className="text-sm font-bold text-muted-foreground">Move:</span>
            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-grass transition-all" style={{ width: `${Math.min(100, motion.intensity * 400)}%` }} />
            </div>
          </div>
        </div>

        <div className="my-4 flex justify-center gap-3">
          <KidButton variant="white" size="md" onClick={() => setStart(motion.jumps)}>🔄 Reset Count</KidButton>
          <KidButton variant="berry" size="md" onClick={next}>⏭️ Next Animal</KidButton>
        </div>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={1}
        totalStars={4}
        message={`${cur.letter} for ${cur.animal.toUpperCase()}! AMAZING!`}
        onPlayAgain={() => { setCelebrate(false); setStart(motion.jumps); }}
        onContinue={next}
      />
    </main>
  );
}
