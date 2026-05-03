// Toggle button for TV/Cast mode. Shown in the GameTopBar.
// Tapping it enters fullscreen + shrinks the camera to a corner.
import { Tv, Smartphone } from "lucide-react";
import { useTvMode } from "@/lib/use-tv-mode";

export function TvModeButton() {
  const { tv, toggle } = useTvMode();
  return (
    <button
      onClick={toggle}
      aria-pressed={tv}
      aria-label={tv ? "Exit TV mode" : "Cast to TV"}
      title={tv ? "Exit TV mode" : "Cast to TV"}
      className={
        "flex h-12 items-center gap-2 rounded-full px-3 font-bold shadow-cartoon transition-transform active:translate-y-1 " +
        (tv ? "bg-berry text-berry-foreground" : "bg-white text-primary")
      }
    >
      {tv ? <Smartphone className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
      <span className="hidden text-sm sm:inline">{tv ? "Exit TV" : "TV"}</span>
    </button>
  );
}
