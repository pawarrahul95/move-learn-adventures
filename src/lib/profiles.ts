// Local-storage backed child profile store.
export type Avatar = "fox" | "bunny" | "panda" | "lion" | "frog" | "owl";

export const AVATARS: { id: Avatar; emoji: string; bg: string }[] = [
  { id: "fox", emoji: "🦊", bg: "bg-[oklch(0.85_0.15_50)]" },
  { id: "bunny", emoji: "🐰", bg: "bg-[oklch(0.88_0.08_350)]" },
  { id: "panda", emoji: "🐼", bg: "bg-[oklch(0.92_0.02_240)]" },
  { id: "lion", emoji: "🦁", bg: "bg-[oklch(0.85_0.16_85)]" },
  { id: "frog", emoji: "🐸", bg: "bg-[oklch(0.85_0.15_140)]" },
  { id: "owl", emoji: "🦉", bg: "bg-[oklch(0.82_0.1_60)]" },
];

export type GameId =
  | "alphabet" | "colors" | "shapes"
  | "scavenger" | "animals" | "freeze" | "simon" | "yoga" | "routine"
  | "fruit";

export type Profile = {
  id: string;
  name: string;
  age: number;
  avatar: Avatar;
  stars: number;
  progress: Record<GameId, number>; // 0..1
  lettersLearned: string[];
  createdAt: number;
};

const KEY = "playlearn.profiles.v1";
const ACTIVE_KEY = "playlearn.activeProfile.v1";

function read(): Profile[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Profile[];
  } catch {
    return [];
  }
}
function write(profiles: Profile[]) {
  localStorage.setItem(KEY, JSON.stringify(profiles));
  window.dispatchEvent(new CustomEvent("playlearn:profiles"));
}

export function listProfiles(): Profile[] {
  return read();
}

export function createProfile(input: { name: string; age: number; avatar: Avatar }): Profile {
  const p: Profile = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 20) || "Friend",
    age: Math.max(3, Math.min(7, Math.round(input.age))),
    avatar: input.avatar,
    stars: 0,
    progress: { alphabet: 0, colors: 0, shapes: 0, scavenger: 0, animals: 0, freeze: 0, simon: 0, yoga: 0, routine: 0, fruit: 0 },
    lettersLearned: [],
    createdAt: Date.now(),
  };
  const all = read();
  all.push(p);
  write(all);
  setActiveProfileId(p.id);
  return p;
}

export function deleteProfile(id: string) {
  write(read().filter((p) => p.id !== id));
  if (getActiveProfileId() === id) localStorage.removeItem(ACTIVE_KEY);
}

export function updateProfile(id: string, patch: Partial<Profile>) {
  const all = read().map((p) => (p.id === id ? { ...p, ...patch } : p));
  write(all);
}

export function addStars(id: string, count: number) {
  const all = read();
  const p = all.find((x) => x.id === id);
  if (!p) return;
  p.stars += count;
  write(all);
}

export function setProgress(id: string, game: GameId, value: number) {
  const all = read();
  const p = all.find((x) => x.id === id);
  if (!p) return;
  p.progress[game] = Math.max(p.progress[game] ?? 0, Math.min(1, value));
  write(all);
}

export function addLetter(id: string, letter: string) {
  const all = read();
  const p = all.find((x) => x.id === id);
  if (!p) return;
  if (!p.lettersLearned.includes(letter)) p.lettersLearned.push(letter);
  setProgress(id, "alphabet", p.lettersLearned.length / 26);
  write(all);
}

export function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}
export function setActiveProfileId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new CustomEvent("playlearn:profiles"));
}
export function getActiveProfile(): Profile | null {
  const id = getActiveProfileId();
  if (!id) return null;
  return read().find((p) => p.id === id) ?? null;
}
