// Flashcard-style Lessons: Letters (A-Z), Numbers (1-10), Colors.
// Inspired by the PRD reference deck — large card, audio button, prev/next.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Volume2 } from "lucide-react";
import { speak, sfx } from "@/lib/audio";
import { KidButton } from "@/components/KidButton";

export const Route = createFileRoute("/lessons")({
  head: () => ({
    meta: [
      { title: "Lessons — PlayLearn" },
      { name: "description", content: "Letter, Number and Color flashcards with audio for ages 3–7." },
    ],
  }),
  component: LessonsPage,
});

type Deck = "letters" | "numbers" | "colors";

type Card = { key: string; title: string; sub: string; emoji: string; bg: string; speak: string };

const LETTERS: Card[] = [
  ["A", "Apple", "🍎"], ["B", "Ball", "⚽"], ["C", "Cat", "🐱"], ["D", "Dog", "🐶"],
  ["E", "Elephant", "🐘"], ["F", "Frog", "🐸"], ["G", "Grapes", "🍇"], ["H", "Hat", "🎩"],
  ["I", "Ice cream", "🍦"], ["J", "Juice", "🧃"], ["K", "Kite", "🪁"], ["L", "Lion", "🦁"],
  ["M", "Moon", "🌙"], ["N", "Nest", "🪺"], ["O", "Orange", "🍊"], ["P", "Penguin", "🐧"],
  ["Q", "Queen", "👑"], ["R", "Rainbow", "🌈"], ["S", "Sun", "☀️"], ["T", "Tiger", "🐯"],
  ["U", "Umbrella", "☂️"], ["V", "Violin", "🎻"], ["W", "Whale", "🐳"], ["X", "Xylophone", "🎼"],
  ["Y", "Yo-yo", "🪀"], ["Z", "Zebra", "🦓"],
].map(([k, w, e]) => ({
  key: k!, title: k!, sub: `${k} is for ${w}`, emoji: e!,
  bg: "bg-[oklch(0.92_0.06_30)]", speak: `${k}. ${k} is for ${w}.`,
}));

const NUMBER_WORDS = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];
const NUMBER_ITEMS = ["🍭","🍿","🍪","🍩","🧁","🍓","🍇","🍒","🍑","🍎","🍌"];
const NUMBERS: Card[] = NUMBER_WORDS.map((w, i) => ({
  key: String(i),
  title: String(i),
  sub: `${w} ${i === 1 ? "Lollipop" : NUMBER_WORDS[i] + "s"}`,
  emoji: NUMBER_ITEMS[i]!.repeat(Math.max(1, Math.min(i || 1, 5))),
  bg: "bg-[oklch(0.9_0.08_160)]",
  speak: `${w}. ${w} ${i === 1 ? "lollipop" : "items"}.`,
}));

const COLORS: Card[] = [
  ["Red", "🍎🌹🍓", "bg-[oklch(0.78_0.18_25)]"],
  ["Blue", "🫐🦋💎🌍", "bg-[oklch(0.7_0.18_240)]"],
  ["Yellow", "🌻🍋⭐", "bg-[oklch(0.9_0.16_95)]"],
  ["Green", "🥦🐢🍀", "bg-[oklch(0.8_0.18_145)]"],
  ["Purple", "🍆🍇🪻🐙", "bg-[oklch(0.7_0.18_310)]"],
  ["Orange", "🥕🍊🦊", "bg-[oklch(0.82_0.18_55)]"],
  ["Pink", "🌸🦩🍥", "bg-[oklch(0.85_0.12_350)]"],
  ["Black", "🐈‍⬛🎩🪨", "bg-[oklch(0.3_0.02_280)]"],
].map(([n, e, bg]) => ({
  key: n!, title: `${n} Color`, sub: "Tap the speaker to hear it",
  emoji: e!, bg: bg!, speak: `${n}. ${n} color.`,
}));

const DECKS: Record<Deck, { label: string; emoji: string; cards: Card[] }> = {
  letters: { label: "Letters A–Z", emoji: "🔤", cards: LETTERS },
  numbers: { label: "Numbers 0–10", emoji: "🔢", cards: NUMBERS },
  colors: { label: "Colors", emoji: "🎨", cards: COLORS },
};

function LessonsPage() {
  const [deck, setDeck] = useState<Deck>("letters");
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const cards = DECKS[deck].cards;
  const card = cards[idx]!;
  const total = cards.length;
  const pct = useMemo(() => Math.round(((idx + 1) / total) * 100), [idx, total]);

  useEffect(() => { setIdx(0); }, [deck]);
  useEffect(() => { speak(card.speak); }, [card]);

  const next = () => { sfx.pop(); setIdx((i) => Math.min(total - 1, i + 1)); };
  const prev = () => { sfx.pop(); setIdx((i) => Math.max(0, i - 1)); };

  return (
    <main className="min-h-dvh bg-gradient-sky">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <button onClick={() => navigate({ to: "/play" })} className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-cartoon" aria-label="Back">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-display text-xl font-extrabold sm:text-2xl">Lessons</div>
        <div className="w-12" />
      </header>

      <section className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2 px-4 sm:px-6">
        {(Object.keys(DECKS) as Deck[]).map((k) => (
          <button
            key={k}
            onClick={() => { setDeck(k); sfx.pop(); }}
            className={`rounded-full px-4 py-2 text-sm font-bold shadow-cartoon transition-transform hover:-translate-y-0.5 ${
              deck === k ? "bg-primary text-primary-foreground scale-105" : "bg-white text-foreground"
            }`}
          >
            {DECKS[k].emoji} {DECKS[k].label}
          </button>
        ))}
      </section>

      <section className="mx-auto mt-6 max-w-2xl px-4 pb-12 sm:px-6">
        <div className="mx-auto h-2 w-full overflow-hidden rounded-full bg-white/60">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-center text-sm font-bold text-muted-foreground">
          {idx + 1} / {total}
        </div>

        <div className={`mt-4 flex flex-col items-center gap-4 rounded-4xl ${card.bg} p-6 shadow-cartoon`}>
          <div className="rounded-3xl bg-white px-8 py-6 shadow-pop">
            <div className="text-display text-7xl font-extrabold sm:text-8xl">{card.title}</div>
          </div>

          <button
            onClick={() => speak(card.speak)}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-base font-bold text-primary shadow-cartoon"
          >
            <Volume2 className="h-5 w-5" /> {card.sub}
          </button>

          <div className="flex min-h-[140px] items-center justify-center text-6xl sm:text-7xl">
            <span aria-hidden>{card.emoji}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <KidButton variant="sky" size="md" onClick={prev} disabled={idx === 0}>
            <ArrowLeft className="mr-1 h-5 w-5" /> Previous
          </KidButton>
          {idx === total - 1 ? (
            <Link to="/play"><KidButton variant="grass" size="md">Done!</KidButton></Link>
          ) : (
            <KidButton variant="grass" size="md" onClick={next}>
              Next <ArrowRight className="ml-1 h-5 w-5" />
            </KidButton>
          )}
        </div>
      </section>
    </main>
  );
}
