// TV display: "Activity Hub" — shows all child profiles, the available games
// as colorful tiles, and a side panel with the QR pairing code (before
// pairing) or live status (after). Designed to be mirrored to a TV/laptop
// while the phone runs the camera at /cam.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tv, Wifi, WifiOff, Star } from "lucide-react";
import { startHost, type PairMessage, type PairStatus } from "@/lib/pairing";
import { QrCode } from "@/components/QrCode";
import { KidButton } from "@/components/KidButton";
import { useProfiles } from "@/lib/use-profiles";
import { AVATARS, setActiveProfileId } from "@/lib/profiles";
import cosmo from "@/assets/cosmo.png";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Activity Hub — PlayLearn TV" },
      { name: "description", content: "Cast PlayLearn to your TV. Pair your phone camera and pick a game." },
    ],
  }),
  component: TvPage,
});

// Shared bus so games on the same TV tab can subscribe to phone data.
type Listener = (m: PairMessage) => void;
const tvBus: { listeners: Set<Listener>; status: PairStatus } = {
  listeners: new Set(),
  status: { kind: "connecting" },
};
export function tvSubscribe(cb: Listener) {
  tvBus.listeners.add(cb);
  return () => { tvBus.listeners.delete(cb); };
}
export function tvStatus() { return tvBus.status; }

const TILES = [
  { id: "lessons",   title: "Lessons",            emoji: "📖", to: "/lessons"         as const, bg: "from-[oklch(0.85_0.1_300)] to-[oklch(0.7_0.18_320)]" },
  { id: "alphabet",  title: "Alphabet Adventure", emoji: "🔤", to: "/games/alphabet"  as const, bg: "from-[oklch(0.88_0.18_60)] to-[oklch(0.78_0.18_30)]" },
  { id: "colors",    title: "Color Catcher",      emoji: "🎨", to: "/games/colors"    as const, bg: "from-[oklch(0.78_0.15_230)] to-[oklch(0.7_0.18_270)]" },
  { id: "shapes",    title: "Shape Finder",       emoji: "🔺", to: "/games/shapes"    as const, bg: "from-[oklch(0.82_0.18_145)] to-[oklch(0.7_0.18_170)]" },
  { id: "scavenger", title: "Scavenger Hunt",     emoji: "🔍", to: "/games/scavenger" as const, bg: "from-[oklch(0.78_0.2_320)] to-[oklch(0.65_0.22_350)]" },
  { id: "animals",   title: "Animal Moves",       emoji: "🐸", to: "/games/animals"   as const, bg: "from-[oklch(0.85_0.18_120)] to-[oklch(0.72_0.2_90)]" },
  { id: "freeze",    title: "Musical Freeze",     emoji: "🎵", to: "/games/freeze"    as const, bg: "from-[oklch(0.8_0.15_200)] to-[oklch(0.65_0.2_240)]" },
  { id: "simon",     title: "Simon Says",         emoji: "👃", to: "/games/simon"     as const, bg: "from-[oklch(0.85_0.16_60)] to-[oklch(0.72_0.2_25)]" },
  { id: "yoga",      title: "Yoga Alphabet",      emoji: "🧘", to: "/games/yoga"      as const, bg: "from-[oklch(0.82_0.12_180)] to-[oklch(0.68_0.18_200)]" },
  { id: "routine",   title: "Routine Builder",    emoji: "🪥", to: "/games/routine"   as const, bg: "from-[oklch(0.85_0.1_300)] to-[oklch(0.7_0.18_320)]" },
];

function TvPage() {
  const navigate = useNavigate();
  const { profiles } = useProfiles();
  const [code, setCode] = useState<string>("");
  const [status, setStatus] = useState<PairStatus>({ kind: "connecting" });
  const hostRef = useRef<ReturnType<typeof startHost> | null>(null);

  useEffect(() => {
    const h = startHost();
    hostRef.current = h;
    setCode(h.code);
    h.onStatus((s) => { tvBus.status = s; setStatus(s); });
    h.onMessage((m) => { tvBus.listeners.forEach((cb) => cb(m)); });
    return () => h.destroy();
  }, []);

  const camUrl = useMemo(() => {
    if (!code) return "";
    const base = window.location.origin;
    return `${base}/cam?code=${code}`;
  }, [code]);

  const paired = status.kind === "paired";

  const goToGame = (to: (typeof TILES)[number]["to"], profileId?: string) => {
    if (profileId) setActiveProfileId(profileId);
    navigate({ to });
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-gradient-sky">
      {/* Decorative clouds */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/60 to-transparent" />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 pt-5">
        <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-cartoon">
          <Tv className="h-6 w-6 text-primary" />
          <span className="text-display text-xl font-extrabold uppercase tracking-wide text-primary sm:text-2xl">
            Activity Hub: Your Learning Journey
          </span>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-cartoon ${paired ? "bg-grass text-grass-foreground" : "bg-white/90 text-primary"}`}>
          {paired ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {status.kind === "connecting" && "Starting…"}
          {status.kind === "waiting" && "Waiting for phone"}
          {status.kind === "paired" && "Phone connected"}
          {status.kind === "disconnected" && "Disconnected"}
          {status.kind === "error" && status.message}
        </div>
      </header>

      {/* Profile chips */}
      <section className="relative z-10 mx-auto mt-6 flex max-w-7xl flex-wrap items-center gap-4 px-6">
        {profiles.length === 0 ? (
          <div className="rounded-3xl bg-white/90 px-5 py-3 text-base font-bold text-muted-foreground shadow-cartoon">
            No players yet — open this app on the phone to add one.
          </div>
        ) : (
          profiles.map((p) => {
            const av = AVATARS.find((a) => a.id === p.avatar);
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-cartoon">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ring-4 ring-white ${av?.bg ?? ""}`}>
                  {av?.emoji}
                </span>
                <div className="pr-2">
                  <div className="text-display text-base font-extrabold leading-none">{p.name.toUpperCase()}</div>
                  <div className="flex items-center gap-1 text-xs font-bold text-[oklch(0.55_0.18_60)]">
                    <Star className="h-3 w-3 fill-current" /> {p.stars}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Main grid */}
      <section className="relative z-10 mx-auto mt-6 grid max-w-7xl gap-6 px-6 pb-24 lg:grid-cols-[1.4fr_1fr]">
        {/* Game tiles */}
        <div className="grid gap-5 sm:grid-cols-2">
          {TILES.map((t) => (
            <button
              key={t.id}
              onClick={() => goToGame(t.to, profiles[0]?.id)}
              className={`group relative overflow-hidden rounded-4xl bg-gradient-to-br ${t.bg} p-6 text-left text-white shadow-cartoon transition-transform hover:-translate-y-1`}
            >
              <div className="text-7xl drop-shadow-lg transition-transform group-hover:scale-110">{t.emoji}</div>
              <h2 className="text-display mt-3 text-3xl font-extrabold uppercase">{t.title}</h2>
              <p className="mt-1 text-sm font-bold opacity-90">Tap to play on the TV</p>
            </button>
          ))}
          {/* Mascot tile */}
          <div className="relative col-span-full flex items-center gap-5 rounded-4xl bg-white p-5 shadow-cartoon">
            <img src={cosmo} alt="Cosmo" width={120} height={120} className="h-24 w-24 animate-bounce-soft" />
            <div>
              <div className="text-display text-2xl font-extrabold uppercase text-primary">
                Hi, I&apos;m Cosmo!
              </div>
              <div className="text-base font-bold text-muted-foreground">
                Pair your phone to start a movement adventure.
              </div>
            </div>
          </div>
        </div>

        {/* Side panel — QR + pairing */}
        <aside className="flex flex-col items-center gap-4 rounded-4xl bg-white/95 p-6 shadow-cartoon">
          <div className="text-display text-2xl font-extrabold uppercase text-primary">
            {paired ? "Phone Connected!" : "Scan to Pair Phone"}
          </div>
          {camUrl && !paired ? (
            <QrCode value={camUrl} size={260} />
          ) : (
            <div className="flex h-[260px] w-[260px] items-center justify-center rounded-2xl bg-grass/30 text-5xl">
              {paired ? "📱✅" : "…"}
            </div>
          )}
          <div className="rounded-2xl bg-sunny px-6 py-2 text-center text-sunny-foreground">
            <div className="text-xs font-bold uppercase opacity-70">Room code</div>
            <div className="text-display text-3xl font-extrabold tracking-[0.4em]">{code || "…"}</div>
          </div>
          {!paired && (
            <p className="break-all text-center text-xs font-bold text-muted-foreground">
              or open <span className="font-mono">{camUrl}</span>
            </p>
          )}
          {paired && (
            <div className="flex w-full flex-col gap-2">
              <KidButton variant="sunny" size="md" onClick={() => goToGame("/games/alphabet", profiles[0]?.id)}>✍️ Alphabet</KidButton>
              <KidButton variant="sky" size="md" onClick={() => goToGame("/games/colors", profiles[0]?.id)}>🎨 Colors</KidButton>
              <KidButton variant="grass" size="md" onClick={() => goToGame("/games/shapes", profiles[0]?.id)}>🔺 Shapes</KidButton>
            </div>
          )}
        </aside>
      </section>

      <footer className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-grass px-6 py-3 text-sm font-bold text-grass-foreground">
        <span>📺 Active Gameplay: Tap a tile to begin</span>
        <span className="opacity-80">Powered by OpenCV-style vision · MediaPipe</span>
      </footer>
    </main>
  );
}
