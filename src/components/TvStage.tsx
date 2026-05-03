// Wraps the camera + canvas overlays so they flip between two layouts:
//   - Normal: camera fills the stage; overlays drawn on top.
//   - TV mode: camera shrinks to a corner thumbnail (PiP). The stage shows
//     a big colored backdrop that gameplay UI is rendered on top of.
//
// Children are the camera <video>, any overlay <canvas>es, and the on-stage
// game UI. Everything keeps working — only the camera box is repositioned.
import type { ReactNode } from "react";
import { useTvMode } from "@/lib/use-tv-mode";
import { cn } from "@/lib/utils";

interface Props {
  /** The <video> + tracking <canvas> elements. Repositioned in TV mode. */
  camera: ReactNode;
  /** Big game UI (letters, prompts, animations) shown on the TV. */
  stage: ReactNode;
  /** Optional status / error overlay rendered above everything. */
  overlay?: ReactNode;
  className?: string;
}

export function TvStage({ camera, stage, overlay, className }: Props) {
  const { tv } = useTvMode();

  if (tv) {
    return (
      <div
        className={cn(
          "relative aspect-video w-full overflow-hidden rounded-4xl bg-gradient-celebration shadow-cartoon",
          className,
        )}
      >
        {/* Big stage on the TV */}
        <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-10">
          {stage}
        </div>

        {/* Camera picture-in-picture */}
        <div className="pointer-events-none absolute right-3 top-3 z-10 h-[22%] w-[28%] overflow-hidden rounded-2xl border-4 border-white bg-black shadow-pop sm:right-5 sm:top-5">
          <div className="relative h-full w-full">{camera}</div>
          <div className="absolute bottom-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-primary">
            📹 You
          </div>
        </div>

        {overlay}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-4xl bg-black shadow-cartoon",
        className,
      )}
    >
      <div className="absolute inset-0">{camera}</div>
      <div className="absolute inset-0">{stage}</div>
      {overlay}
    </div>
  );
}
