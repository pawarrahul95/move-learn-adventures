// TV display: shows a QR code, waits for a phone to pair, then forwards
// landmark messages to whatever game the user picks. Intended to be the
// page that's mirrored to the TV (Chromecast / AirPlay / HDMI).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tv, Wifi, WifiOff } from "lucide-react";
import { startHost, type PairMessage, type PairStatus } from "@/lib/pairing";
import { QrCode } from "@/components/QrCode";
import { KidButton } from "@/components/KidButton";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "TV Mode — PlayLearn" },
      { name: "description", content: "Cast PlayLearn to your TV and use your phone as the camera." },
    ],
  }),
  component: TvPage,
});

// Shared in-memory bus so games on this same TV tab can subscribe to phone data
// without reaching into the route component's state. Lives only on the TV side.
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

function TvPage() {
  const navigate = useNavigate();
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

  return (
    <main className="min-h-dvh bg-gradient-celebration text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3 text-display text-3xl font-bold">
          <Tv className="h-8 w-8" /> PlayLearn TV
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

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-2">
        <div className="rounded-4xl bg-white/10 p-8 backdrop-blur">
          <h1 className="text-display text-5xl font-bold leading-tight">Connect your phone camera</h1>
          <ol className="mt-6 space-y-3 text-xl">
            <li>📱 1. Scan the QR code with your phone.</li>
            <li>🎥 2. Allow camera access on your phone.</li>
            <li>🕺 3. Stand back and play on the TV!</li>
          </ol>
          {!paired && (
            <p className="mt-6 text-base opacity-80">
              Or open this link on your phone:<br />
              <span className="break-all font-mono text-lg">{camUrl}</span>
            </p>
          )}
          {paired && (
            <div className="mt-6 flex flex-wrap gap-3">
              <KidButton variant="sunny" size="lg" onClick={() => navigate({ to: "/games/alphabet" })}>✍️ Air Letters</KidButton>
              <KidButton variant="sky" size="lg" onClick={() => navigate({ to: "/games/colors" })}>🎨 Color Hunt</KidButton>
              <KidButton variant="grass" size="lg" onClick={() => navigate({ to: "/games/shapes" })}>🔺 Shapes</KidButton>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-4 rounded-4xl bg-white/10 p-8 backdrop-blur">
          {camUrl ? <QrCode value={camUrl} size={300} /> : <div className="h-[300px] w-[300px] animate-pulse rounded-2xl bg-white/30" />}
          <div className="rounded-2xl bg-white px-6 py-3 text-center shadow-cartoon">
            <div className="text-sm font-bold text-muted-foreground">Room code</div>
            <div className="text-display text-5xl font-bold tracking-widest text-primary">{code || "…"}</div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-center text-sm opacity-80">
        Tip: use AirPlay, Chromecast, or HDMI to mirror this screen to your TV.
      </footer>
    </main>
  );
}
