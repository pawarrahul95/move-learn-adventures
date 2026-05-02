// Reusable webcam hook. Returns ref to attach to a <video> element.
import { useEffect, useRef, useState } from "react";

export function useCamera(active: boolean, facingMode: "user" | "environment" = "user") {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!active) return;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not supported on this device.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.playsInline = true;
          v.muted = true;
          await v.play().catch(() => undefined);
          setReady(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not access camera.";
        setError(msg);
      }
    }

    start();
    return () => {
      cancelled = true;
      setReady(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active, facingMode]);

  return { videoRef, ready, error };
}
