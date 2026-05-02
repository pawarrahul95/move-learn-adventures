// Tiny voice + sound helpers using Web Speech API and WebAudio for SFX.
let voicesCache: SpeechSynthesisVoice[] | null = null;

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (!voicesCache || voicesCache.length === 0) {
    voicesCache = window.speechSynthesis.getVoices();
  }
  if (!voicesCache.length) return;
  // Prefer English female-sounding voices
  return (
    voicesCache.find((v) => /en/i.test(v.lang) && /female|samantha|karen|tessa|google us/i.test(v.name)) ||
    voicesCache.find((v) => /en/i.test(v.lang)) ||
    voicesCache[0]
  );
}

export function speak(text: string, opts: { rate?: number; pitch?: number } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 0.95;
    u.pitch = opts.pitch ?? 1.25;
    const v = pickVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* */ }
}

// Warm up voices list (some browsers populate it asynchronously)
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    voicesCache = window.speechSynthesis.getVoices();
  };
}

let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.2, startOffset = 0) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + startOffset);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + startOffset + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + startOffset + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + startOffset);
  osc.stop(ac.currentTime + startOffset + duration);
}

export const sfx = {
  success() {
    tone(523.25, 0.15, "triangle", 0.25, 0);
    tone(659.25, 0.15, "triangle", 0.25, 0.12);
    tone(783.99, 0.25, "triangle", 0.25, 0.24);
  },
  fail() {
    tone(330, 0.15, "sawtooth", 0.15, 0);
    tone(220, 0.25, "sawtooth", 0.15, 0.12);
  },
  pop() {
    tone(880, 0.08, "sine", 0.2, 0);
  },
  star() {
    tone(987.77, 0.1, "triangle", 0.2, 0);
    tone(1318.51, 0.18, "triangle", 0.2, 0.08);
  },
  celebration() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
    notes.forEach((n, i) => tone(n, 0.18, "triangle", 0.22, i * 0.12));
  },
};
