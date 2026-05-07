// Landing / profile picker. Replaces the placeholder.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { useProfiles } from "@/lib/use-profiles";
import {
  AVATARS,
  createProfile,
  deleteProfile,
  setActiveProfileId,
  type Avatar,
} from "@/lib/profiles";
import { KidButton } from "@/components/KidButton";
import mascot from "@/assets/mascot.png";
import { sfx, speak } from "@/lib/audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlayLearn — Move, Learn, Play!" },
      {
        name: "description",
        content:
          "Pick your friend! A motion-powered learning playground for kids 3-7. Trace letters, hunt colors, find shapes — all by moving.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { profiles } = useProfiles();
  const [creating, setCreating] = useState(profiles.length === 0);
  const navigate = useNavigate();

  const choose = (id: string) => {
    setActiveProfileId(id);
    sfx.pop();
    navigate({ to: "/play" });
  };

  return (
    <main className="min-h-dvh bg-gradient-sky">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center px-4 py-6 sm:py-10">
        <div className="relative flex flex-col items-center gap-2 text-center">
          <span className="absolute -left-4 top-2 rotate-[-12deg] rounded-2xl bg-secondary px-3 py-1 text-sm font-extrabold text-secondary-foreground shadow-cartoon sm:text-base">Hi!</span>
          <span className="absolute -right-2 top-10 rotate-[8deg] rounded-2xl bg-sunny px-3 py-1 text-sm font-extrabold text-sunny-foreground shadow-cartoon sm:text-base">Hello</span>
          <img
            src={mascot}
            alt="PlayLearn mascot fox waving"
            width={200}
            height={200}
            className="h-32 w-32 animate-float drop-shadow-xl sm:h-40 sm:w-40"
          />
          <h1 className="text-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Let&apos;s Start Your{" "}
            <span className="bg-gradient-rainbow animate-rainbow bg-clip-text text-transparent">Learning</span>{" "}
            Adventure
          </h1>
          <p className="text-lg font-bold text-sky-foreground sm:text-xl">
            Move • Learn • Play
          </p>
        </div>

        <section className="mt-8 w-full sm:mt-12">
          <h2 className="text-display mb-4 text-center text-2xl font-bold sm:text-3xl">
            {profiles.length ? "Who's playing today?" : "Create your first player!"}
          </h2>

          {profiles.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {profiles.map((p) => {
                const av = AVATARS.find((a) => a.id === p.avatar);
                return (
                  <div
                    key={p.id}
                    className="group relative flex flex-col items-center rounded-3xl bg-white p-4 shadow-cartoon transition-transform hover:-translate-y-1"
                  >
                    <button
                      onClick={() => choose(p.id)}
                      className="flex w-full flex-col items-center gap-2"
                      aria-label={`Play as ${p.name}`}
                    >
                      <span
                        className={`flex h-20 w-20 items-center justify-center rounded-full text-5xl shadow-pop ${av?.bg ?? ""}`}
                      >
                        {av?.emoji}
                      </span>
                      <span className="text-display text-xl font-bold">{p.name}</span>
                      <span className="flex items-center gap-1 text-sm font-bold text-[oklch(0.55_0.18_60)]">
                        <Star className="h-4 w-4 fill-current" /> {p.stars}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${p.name}'s profile?`)) deleteProfile(p.id);
                      }}
                      className="absolute right-2 top-2 rounded-full bg-muted p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              <button
                onClick={() => setCreating(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-3xl border-4 border-dashed border-white/70 bg-white/40 p-4 text-primary transition-transform hover:-translate-y-1 hover:bg-white/70"
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-primary shadow-pop">
                  <Plus className="h-10 w-10" />
                </span>
                <span className="text-display text-xl font-bold">Add Player</span>
              </button>
            </div>
          )}
        </section>

        {creating && (
          <CreateProfileDialog
            onClose={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              navigate({ to: "/play" });
              void id;
            }}
          />
        )}
      </div>
    </main>
  );
}

function CreateProfileDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState(5);
  const [avatar, setAvatar] = useState<Avatar>("fox");

  const submit = () => {
    if (!name.trim()) return;
    const p = createProfile({ name, age, avatar });
    sfx.star();
    speak(`Hi ${p.name}! Let's play!`);
    onCreated(p.id);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-cartoon animate-pop">
        <h3 className="text-display mb-4 text-center text-2xl font-bold">New Player</h3>

        <label className="mb-4 block">
          <span className="text-sm font-bold text-muted-foreground">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Your name"
            className="mt-1 w-full rounded-2xl border-2 border-input bg-input px-4 py-3 text-xl font-bold focus:border-primary focus:outline-none"
            autoFocus
          />
        </label>

        <div className="mb-4">
          <span className="text-sm font-bold text-muted-foreground">Age</span>
          <div className="mt-1 flex gap-2">
            {[3, 4, 5, 6, 7].map((a) => (
              <button
                key={a}
                onClick={() => setAge(a)}
                className={`flex h-12 flex-1 items-center justify-center rounded-2xl text-xl font-bold transition-all ${
                  age === a
                    ? "bg-primary text-primary-foreground shadow-pop scale-105"
                    : "bg-muted text-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <span className="text-sm font-bold text-muted-foreground">Pick a friend</span>
          <div className="mt-1 grid grid-cols-6 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAvatar(a.id)}
                className={`flex aspect-square items-center justify-center rounded-2xl text-3xl transition-all ${a.bg} ${
                  avatar === a.id ? "ring-4 ring-primary scale-110" : "opacity-80"
                }`}
                aria-label={a.id}
              >
                {a.emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <KidButton variant="white" size="md" onClick={onClose} className="flex-1">
            Cancel
          </KidButton>
          <KidButton size="md" onClick={submit} disabled={!name.trim()} className="flex-1">
            Let's Go!
          </KidButton>
        </div>
      </div>
    </div>
  );
}
