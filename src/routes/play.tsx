// Game menu shown after a profile is selected.
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useProfiles } from "@/lib/use-profiles";
import { AVATARS, getActiveProfileId, setActiveProfileId } from "@/lib/profiles";
import { KidButton } from "@/components/KidButton";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Pick a Game — PlayLearn" },
      { name: "description", content: "Choose a game: Alphabet Air-Tracing, Color Hunt, or Shape Detective." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getActiveProfileId()) {
      throw redirect({ to: "/" });
    }
  },
  component: PlayPage,
});

const GAMES = [
  {
    id: "alphabet",
    title: "Air Letters",
    emoji: "✍️",
    sub: "Trace letters with your hand",
    to: "/games/alphabet" as const,
    bg: "bg-sunny text-sunny-foreground",
  },
  {
    id: "colors",
    title: "Color Hunt",
    emoji: "🎨",
    sub: "Find things with the right color",
    to: "/games/colors" as const,
    bg: "bg-sky text-sky-foreground",
  },
  {
    id: "shapes",
    title: "Shape Detective",
    emoji: "🔺",
    sub: "Show me a shape!",
    to: "/games/shapes" as const,
    bg: "bg-grass text-grass-foreground",
  },
];

function PlayPage() {
  const { active } = useProfiles();
  const av = active ? AVATARS.find((a) => a.id === active.avatar) : null;

  return (
    <main className="min-h-dvh bg-gradient-sky">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-cartoon">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${av?.bg ?? ""}`}>
            {av?.emoji}
          </span>
          <div>
            <div className="text-display text-lg font-bold leading-tight">{active?.name}</div>
            <div className="flex items-center gap-1 text-sm font-bold text-[oklch(0.55_0.18_60)]">
              <Star className="h-4 w-4 fill-current" /> {active?.stars} stars
            </div>
          </div>
        </div>
        <Link to="/" onClick={() => setActiveProfileId(null)}>
          <KidButton variant="white" size="md">Switch Player</KidButton>
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-12 pt-4 sm:px-6">
        <h1 className="text-display mb-6 text-center text-4xl font-bold sm:text-5xl">
          Pick a game!
        </h1>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => {
            const progress = active?.progress[g.id as keyof typeof active.progress] ?? 0;
            return (
              <Link
                key={g.id}
                to={g.to}
                className={`group relative overflow-hidden rounded-4xl p-6 shadow-cartoon transition-transform hover:-translate-y-2 active:translate-y-0 ${g.bg}`}
              >
                <div className="mb-3 text-7xl drop-shadow-md transition-transform group-hover:scale-110">
                  {g.emoji}
                </div>
                <h2 className="text-display text-2xl font-bold">{g.title}</h2>
                <p className="mt-1 text-base font-bold opacity-80">{g.sub}</p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/50">
                  <div
                    className="h-full bg-white transition-all"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
