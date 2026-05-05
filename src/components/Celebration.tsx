// Celebration overlay: "TA-DA! YOU DID IT!" with confetti, voice praise, mascot,
// star meter and Play Again / Next buttons.
import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import cosmo from "@/assets/cosmo.png";
import { sfx, speak } from "@/lib/audio";
import { KidButton } from "@/components/KidButton";

const PRAISES = ["AWESOME!", "GREAT JOB!", "LET'S DANCE!"];

interface Props {
  open: boolean;
  starsEarned?: number;
  totalStars?: number;
  onContinue: () => void;
  onPlayAgain?: () => void;
  message?: string;
}

export function Celebration({ open, starsEarned = 1, totalStars = 4, onContinue, onPlayAgain, message }: Props) {
  const [praise, setPraise] = useState("");
  const blastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const p = message ?? "TA-DA! YOU DID IT!";
    setPraise(p);
    sfx.celebration();
    speak(p, { pitch: 1.4, rate: 0.95 });

    const fire = () => {
      confetti({
        particleCount: 90,
        spread: 100,
        startVelocity: 50,
        origin: { x: Math.random(), y: Math.random() * 0.4 + 0.1 },
        colors: ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C56CF0", "#FF9F43"],
        scalar: 1.1,
      });
    };
    fire();
    blastRef.current = window.setInterval(fire, 700) as unknown as number;

    return () => {
      if (blastRef.current) clearInterval(blastRef.current);
    };
  }, [open, message]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-celebration">
      <div className="pointer-events-none absolute inset-0 animate-rainbow bg-gradient-rainbow opacity-25" />

      <div className="relative flex w-full max-w-3xl flex-col items-center gap-5 px-6 text-center">
        <h1 className="text-display animate-pop text-5xl font-extrabold uppercase tracking-wide text-white drop-shadow-lg sm:text-7xl">
          {praise}
        </h1>

        <div className="relative flex items-end justify-center gap-3 sm:gap-6">
          {/* Speech bubbles */}
          <SpeechBubble text={PRAISES[0]} className="mb-10 hidden sm:block" />
          <img
            src={cosmo}
            alt="Cosmo celebrating"
            width={260}
            height={260}
            className="h-44 w-44 animate-bounce-soft drop-shadow-2xl sm:h-56 sm:w-56"
          />
          <SpeechBubble text={PRAISES[1]} className="mb-10 hidden sm:block" />
        </div>

        {/* Star meter */}
        <div className="flex items-center gap-2 rounded-full bg-white/95 px-5 py-3 shadow-cartoon">
          {Array.from({ length: totalStars }).map((_, i) => (
            <span
              key={i}
              className={`text-3xl transition-transform sm:text-4xl ${i < starsEarned ? "animate-wiggle" : "opacity-30 grayscale"}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              ⭐
            </span>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {onPlayAgain && (
            <KidButton variant="berry" size="lg" onClick={onPlayAgain}>
              🔁 Play Again
            </KidButton>
          )}
          <KidButton variant="grass" size="lg" onClick={onContinue}>
            ➡️ Next
          </KidButton>
        </div>
      </div>
    </div>
  );
}

function SpeechBubble({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div
      className={`relative rounded-2xl border-4 border-white bg-white px-4 py-2 text-display text-lg font-extrabold uppercase text-foreground shadow-cartoon sm:text-xl ${className}`}
    >
      {text}
      <span
        aria-hidden
        className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-4 border-r-4 border-white bg-white"
      />
    </div>
  );
}
