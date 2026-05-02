// Celebration overlay: confetti, music, voice praise, and dance detection (optional).
import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import mascot from "@/assets/mascot.png";
import { sfx, speak } from "@/lib/audio";

const PRAISES = [
  "Awesome job!",
  "You did it!",
  "Wow! Amazing!",
  "Super star!",
  "Let's dance!",
  "High five!",
];

interface Props {
  open: boolean;
  starsEarned?: number;
  onContinue: () => void;
  message?: string;
}

export function Celebration({ open, starsEarned = 1, onContinue, message }: Props) {
  const [praise, setPraise] = useState("");
  const blastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const p = message ?? PRAISES[Math.floor(Math.random() * PRAISES.length)];
    setPraise(p);
    sfx.celebration();
    speak(p, { pitch: 1.4, rate: 0.95 });

    // Confetti bursts
    const fire = () => {
      confetti({
        particleCount: 80,
        spread: 90,
        startVelocity: 45,
        origin: { x: Math.random(), y: Math.random() * 0.4 + 0.1 },
        colors: ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C56CF0"],
        scalar: 1.1,
      });
    };
    fire();
    blastRef.current = window.setInterval(fire, 700) as unknown as number;

    const auto = window.setTimeout(() => {
      onContinue();
    }, 4500);

    return () => {
      if (blastRef.current) clearInterval(blastRef.current);
      clearTimeout(auto);
    };
  }, [open, message, onContinue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-celebration animate-rainbow bg-gradient-rainbow">
      <div className="absolute inset-0 bg-gradient-celebration opacity-90" />
      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <img
          src={mascot}
          alt="Celebrating mascot"
          width={220}
          height={220}
          className="h-44 w-44 animate-bounce-soft drop-shadow-2xl sm:h-56 sm:w-56"
        />
        <h1 className="text-display text-5xl font-bold text-white drop-shadow-lg sm:text-7xl animate-pop">
          {praise}
        </h1>
        <div className="flex gap-2 animate-pop">
          {Array.from({ length: starsEarned }).map((_, i) => (
            <span
              key={i}
              className="text-5xl drop-shadow-lg animate-wiggle"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              ⭐
            </span>
          ))}
        </div>
        <button
          onClick={onContinue}
          className="mt-4 rounded-full bg-white px-10 py-5 text-2xl font-bold text-primary shadow-cartoon transition-transform hover:scale-105 active:scale-95"
        >
          Keep Playing →
        </button>
      </div>
    </div>
  );
}
