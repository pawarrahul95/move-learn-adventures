// Phone-side camera page. Runs MediaPipe locally on the phone and streams
// just the index-fingertip landmark to the TV over WebRTC. No video bytes
// cross the network — only ~24 bytes per frame — which keeps it lag-free.
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Wifi, WifiOff, Camera } from "lucide-react";
import { useCamera } from "@/lib/use-camera";
import { getHandLandmarker } from "@/lib/mediapipe";
import { startClient, type PairStatus } from "@/lib/pairing";
import { CenterMessage } from "@/components/CenterMessage";

const searchSchema = z.object({ code: z.string().min(1).optional() });

export const Route = createFileRoute("/cam")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Phone Camera — PlayLearn" },
      { name: "description", content: "Use this phone as the camera for PlayLearn TV." },
    ],
  }),
  component: CamPage,
});

function CamPage() {
  const { code: codeParam } = useSearch({ from: "/cam" });
  const [code, setCode] = useState(codeParam ?? "");
  const [started, setStarted] = useState(Boolean(codeParam));
  const [status, setStatus] = useState<PairStatus>({ kind: "connecting" });
  const [fps, setFps] = useState(0);

  const { videoRef, ready, error } = useCamera(started, "user");
  const clientRef = useRef<ReturnType<typeof startClient> | null>(null);

  // Connect once the user has confirmed a code.
  useEffect(() => {
    if (!started || !code) return;
    const c = startClient(code);
    clientRef.current = c;
    c.onStatus(setStatus);
    return () => c.destroy();
  }, [started, code]);

  // Run hand tracking on the phone and stream only the fingertip.
  useEffect(() => {
    if (!ready || !started) return;
    let raf = 0;
    let running = true;
    let frames = 0;
    let lastFpsTick = performance.now();

    (async () => {
      const landmarker = await getHandLandmarker();
      const tick = () => {
        if (!running) return;
        const v = videoRef.current;
        const c = clientRef.current;
        if (v && v.readyState >= 2 && c) {
          try {
            const res = landmarker.detectForVideo(v, performance.now());
            const tip = res.landmarks?.[0]?.[8];
            if (tip) {
              c.send({ t: "hand", x: tip.x, y: tip.y, present: true, ts: performance.now() });
            } else {
              c.send({ t: "hand", x: 0, y: 0, present: false, ts: performance.now() });
            }
          } catch { /* skip frame */ }
        }
        frames++;
        const now = performance.now();
        if (now - lastFpsTick > 1000) {
          setFps(Math.round((frames * 1000) / (now - lastFpsTick)));
          frames = 0;
          lastFpsTick = now;
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => { running = false; cancelAnimationFrame(raf); };
  }, [ready, started, videoRef]);

  if (!started) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-sky p-6">
        <div className="w-full max-w-sm rounded-4xl bg-white p-6 shadow-cartoon">
          <h1 className="text-display text-3xl font-bold">Pair with your TV</h1>
          <p className="mt-2 text-base text-muted-foreground">Type the room code shown on the TV.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="mt-4 w-full rounded-2xl border-2 border-input bg-input px-4 py-3 text-center text-display text-3xl font-bold tracking-widest uppercase focus:outline-none focus:border-primary"
            autoFocus
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={8}
          />
          <button
            onClick={() => code && setStarted(true)}
            disabled={!code}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-display text-2xl font-bold text-primary-foreground shadow-cartoon active:translate-y-1 disabled:opacity-50"
          >
            <Camera className="h-6 w-6" /> Start camera
          </button>
        </div>
      </main>
    );
  }

  const paired = status.kind === "paired";

  return (
    <main className="flex min-h-dvh flex-col bg-black text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-bold">
          <Camera className="h-4 w-4" /> Phone Camera
        </div>
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${paired ? "bg-grass text-grass-foreground" : "bg-white/15"}`}>
          {paired ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {status.kind === "connecting" && "Connecting…"}
          {status.kind === "waiting" && "Waiting…"}
          {status.kind === "paired" && `Live · ${fps} fps`}
          {status.kind === "disconnected" && "Disconnected"}
          {status.kind === "error" && status.message}
        </div>
      </header>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-md flex-1 overflow-hidden rounded-3xl bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
          playsInline
          muted
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            <div>
              <p className="text-display text-2xl font-bold">Camera needed</p>
              <p className="mt-2 text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}
        {!error && !ready && (
          <div className="absolute inset-0 flex items-center justify-center"><CenterMessage title="Loading camera…" /></div>
        )}
      </div>

      <p className="px-6 py-4 text-center text-sm opacity-80">
        Keep this screen open. Watch the action on your TV!
      </p>
    </main>
  );
}
