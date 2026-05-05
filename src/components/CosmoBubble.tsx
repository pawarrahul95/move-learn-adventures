// Cosmo mascot with a comic-style speech bubble — used for in-game prompts
// like "BRING ME A TRIANGLE!" or "FIND SOMETHING RED!".
import cosmo from "@/assets/cosmo.png";

interface Props {
  message: string;
  size?: "sm" | "md" | "lg";
  accent?: string; // optional CSS color for the bubble border / chip
  emoji?: string;
}

const SIZES = {
  sm: { img: "h-16 w-16", text: "text-base sm:text-lg", pad: "px-4 py-2" },
  md: { img: "h-20 w-20 sm:h-24 sm:w-24", text: "text-lg sm:text-2xl", pad: "px-5 py-3" },
  lg: { img: "h-28 w-28 sm:h-36 sm:w-36", text: "text-2xl sm:text-4xl", pad: "px-6 py-4" },
};

export function CosmoBubble({ message, size = "md", accent, emoji }: Props) {
  const s = SIZES[size];
  return (
    <div className="flex items-center gap-3">
      <img
        src={cosmo}
        alt="Cosmo the robot"
        width={144}
        height={144}
        loading="lazy"
        className={`${s.img} drop-shadow-md animate-bounce-soft`}
      />
      <div
        className={`relative rounded-3xl border-4 bg-white text-foreground shadow-cartoon ${s.pad}`}
        style={{ borderColor: accent ?? "var(--primary)" }}
      >
        {/* Speech tail */}
        <span
          aria-hidden
          className="absolute -left-3 top-1/2 h-5 w-5 -translate-y-1/2 rotate-45 border-b-4 border-l-4 bg-white"
          style={{ borderColor: accent ?? "var(--primary)" }}
        />
        <span className={`text-display font-extrabold uppercase tracking-wide ${s.text}`}>
          {emoji ? <span className="mr-2">{emoji}</span> : null}
          {message}
        </span>
      </div>
    </div>
  );
}
