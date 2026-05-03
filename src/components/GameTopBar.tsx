// Top bar shown inside games: back button, profile chip, star count.
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Star } from "lucide-react";
import { AVATARS, type Profile } from "@/lib/profiles";
import { TvModeButton } from "@/components/TvModeButton";

export function GameTopBar({ profile, title }: { profile: Profile | null; title: string }) {
  const avatar = profile ? AVATARS.find((a) => a.id === profile.avatar) : null;
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Link
        to="/play"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-cartoon transition-transform active:translate-y-1"
        aria-label="Back to home"
      >
        <ArrowLeft className="h-6 w-6" />
      </Link>
      <h1 className="text-display truncate text-2xl font-bold text-foreground sm:text-3xl">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        <TvModeButton />
        {profile ? (
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-cartoon">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xl ${avatar?.bg ?? ""}`}>
              {avatar?.emoji}
            </span>
            <span className="hidden text-sm font-bold sm:inline">{profile.name}</span>
            <span className="flex items-center gap-1 text-sm font-bold text-[oklch(0.55_0.18_60)]">
              <Star className="h-4 w-4 fill-current" />
              {profile.stars}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
