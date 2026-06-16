// Yoga Alphabet — show body poses to form letters. We display the pose
// reference and use the motion tracker to confirm the child held still
// (in pose) for 3 seconds.
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

export const Route = createFileRoute("/games/yoga")({
  head: () => ({
    meta: [
      { title: "Yoga Alphabet — PlayLearn" },
      { name: "description", content: "Form letters with your body. Hold the pose to win." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) throw redirect({ to: "/" });
  },
  component: YogaGame,
});

const POSES = [
  { letter: "T", emoji: "🧍‍♀️", hint: "Stand tall, arms straight out to the sides" },
  { letter: "Y", emoji: "🙌", hint: "Stand tall, arms up in a V" },
  { letter: "I", emoji: "🧘", hint: "Stand straight, arms down at your sides" },
  { letter: "X", emoji: "✖️", hint: "Spread arms and legs wide" },
  { letter: "O", emoji: "🤸", hint: "Make a circle with your arms over your head" },
  { letter: "L", emoji: "🦵", hint: "Sit on the floor, legs straight forward" },
];

function YogaGame() {
  const { active } = useProfiles();
  const { videoRef, ready, error } = useCamera(true, "user");
  const motion = useMotion(videoRef, ready);
  const [idx, setIdx] = useState(0);
  const [held, setHeld] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const heldStartRef = useRef<number | null>(null);
  const cur = POSES[idx];

  useEffect(() => { speak(`Make the letter ${cur.letter} with your body!`, { pitch: 1.3 }); /* eslint-disable-next-line */ }, [idx]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      if (motion.intensity < 0.05) {
        if (heldStartRef.current === null) heldStartRef.current = performance.now();
        const elapsed = performance.now() - heldStartRef.current;
        const HOLD = 3000;
        setHeld(Math.min(1, elapsed / HOLD));
        if (elapsed >= HOLD && !celebrate) {
          if (active) { addStars(active.id, 3); setProgress(active.id, "yoga", (idx + 1) / POSES.length); }
          sfx.success();
          setCelebrate(true);
        }
      } else {
        heldStartRef.current = null;
        setHeld(0);
      }
    }, 100);
    return () => clearInterval(id);
  }, [ready, motion.intensity, celebrate, active, idx]);

  const next = () => {
    setCelebrate(false);
    setIdx((i) => (i + 1) % POSES.length);
    heldStartRef.current = null;
    setHeld(0);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-sky">
      <GameTopBar profile={active} title="Yoga Alphabet" />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 sm:px-6">
        <div className="mb-3 flex items-center justify-center">
          <CosmoBubble message={`Make a ${cur.letter}!`} emoji={cur.emoji} size="md" />
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon">
          <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-display text-[20rem] font-extrabold leading-none text-white/20">{cur.letter}</div>
          </div>
          {error && <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-white"><div><p className="text-display text-2xl font-bold">Camera needed</p><p className="mt-2">{error}</p></div></div>}
          {!error && !ready && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><CenterMessage title="Loading camera…" /></div>}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 shadow">
            <span className="text-sm font-bold text-muted-foreground">Hold still…</span>
            <div className="ml-auto flex h-3 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-grass transition-all" style={{ width: `${held * 100}%` }} />
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-base font-bold text-sky-foreground">{cur.hint}</p>

        <div className="my-4 flex justify-center gap-3">
          <KidButton variant="berry" size="md" onClick={next}>⏭️ Next Pose</KidButton>
        </div>
      </div>

      <Celebration
        open={celebrate}
        starsEarned={3}
        totalStars={3}
        message={`PERFECT ${cur.letter} POSE!`}
        onPlayAgain={() => { setCelebrate(false); heldStartRef.current = null; setHeld(0); }}
        onContinue={next}
      />
    </main>
  );
}
