// Renders a URL as a QR canvas. Used on the TV pairing screen.
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 256 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    QRCode.toCanvas(c, value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1e1b4b", light: "#ffffff" },
    }).catch(() => undefined);
  }, [value, size]);
  return <canvas ref={ref} aria-label="QR code" className="rounded-2xl bg-white p-2 shadow-pop" />;
}
