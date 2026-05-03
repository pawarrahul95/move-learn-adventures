// TV ↔ Phone pairing over WebRTC using the PeerJS public broker.
// Why PeerJS: zero backend, instant connection, free public signaling server.
// We send tiny JSON payloads (landmarks, events) — never video — so it is
// fast even on weak Wi-Fi and works fine over cellular too.
//
// Wire format on the data channel:
//   { t: "hand",   x: 0..1, y: 0..1, present: boolean, ts: number }
//   { t: "ping" } / { t: "pong" }
//   { t: "hello",  ua: string }
//   { t: "bye" }
import Peer, { type DataConnection } from "peerjs";

export type PairMessage =
  | { t: "hand"; x: number; y: number; present: boolean; ts: number }
  | { t: "hello"; ua: string }
  | { t: "ping" }
  | { t: "pong" }
  | { t: "bye" };

// Short, kid-friendly room codes. Avoid ambiguous characters (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

// Namespace the broker IDs so we don't collide with other PeerJS apps.
const NS = "playlearn-tv-";
export const idFromCode = (code: string) => NS + code.toUpperCase();
export const codeFromId = (id: string) => id.replace(NS, "").toUpperCase();

export interface HostHandle {
  code: string;
  destroy: () => void;
  onConnect: (cb: (conn: DataConnection) => void) => void;
  onMessage: (cb: (msg: PairMessage) => void) => void;
  onStatus: (cb: (s: PairStatus) => void) => void;
}

export interface ClientHandle {
  destroy: () => void;
  send: (m: PairMessage) => void;
  onStatus: (cb: (s: PairStatus) => void) => void;
}

export type PairStatus =
  | { kind: "connecting" }
  | { kind: "waiting" } // host registered, waiting for phone
  | { kind: "paired" }
  | { kind: "disconnected" }
  | { kind: "error"; message: string };

/** Start a TV-side host. Returns a fresh room code. */
export function startHost(): HostHandle {
  const code = randomCode();
  const peer = new Peer(idFromCode(code), { debug: 1 });

  const connectCbs = new Set<(c: DataConnection) => void>();
  const messageCbs = new Set<(m: PairMessage) => void>();
  const statusCbs = new Set<(s: PairStatus) => void>();
  const emit = (s: PairStatus) => statusCbs.forEach((cb) => cb(s));
  emit({ kind: "connecting" });

  let conn: DataConnection | null = null;

  peer.on("open", () => emit({ kind: "waiting" }));
  peer.on("error", (err) => emit({ kind: "error", message: err.message || "Pair error" }));
  peer.on("connection", (c) => {
    conn = c;
    c.on("open", () => {
      emit({ kind: "paired" });
      connectCbs.forEach((cb) => cb(c));
      try { c.send({ t: "hello", ua: navigator.userAgent } satisfies PairMessage); } catch { /* noop */ }
    });
    c.on("data", (d) => {
      try {
        const m = d as PairMessage;
        messageCbs.forEach((cb) => cb(m));
      } catch { /* ignore malformed */ }
    });
    c.on("close", () => emit({ kind: "disconnected" }));
    c.on("error", (e) => emit({ kind: "error", message: e.message || "Connection error" }));
  });

  return {
    code,
    destroy: () => {
      try { conn?.close(); } catch { /* noop */ }
      try { peer.destroy(); } catch { /* noop */ }
    },
    onConnect: (cb) => void connectCbs.add(cb),
    onMessage: (cb) => void messageCbs.add(cb),
    onStatus: (cb) => void statusCbs.add(cb),
  };
}

/** Connect as the phone-side client to a TV's room code. */
export function startClient(code: string): ClientHandle {
  const peer = new Peer({ debug: 1 });
  const statusCbs = new Set<(s: PairStatus) => void>();
  const emit = (s: PairStatus) => statusCbs.forEach((cb) => cb(s));
  emit({ kind: "connecting" });

  let conn: DataConnection | null = null;
  // Throttle outgoing messages to 30 Hz to keep latency low and bandwidth tiny.
  const queue: PairMessage[] = [];
  let lastFlush = 0;

  peer.on("open", () => {
    conn = peer.connect(idFromCode(code), { reliable: false }); // unreliable = lower latency
    conn.on("open", () => {
      emit({ kind: "paired" });
      try { conn?.send({ t: "hello", ua: navigator.userAgent } satisfies PairMessage); } catch { /* noop */ }
    });
    conn.on("close", () => emit({ kind: "disconnected" }));
    conn.on("error", (e) => emit({ kind: "error", message: e.message || "Connection error" }));
  });
  peer.on("error", (err) => emit({ kind: "error", message: err.message || "Pair error" }));

  return {
    destroy: () => {
      try { conn?.close(); } catch { /* noop */ }
      try { peer.destroy(); } catch { /* noop */ }
    },
    send: (m) => {
      const now = performance.now();
      // Always send non-hand messages immediately; coalesce hand frames.
      if (m.t === "hand") {
        queue[0] = m; // keep only the latest sample
        if (now - lastFlush >= 33 && conn?.open) {
          lastFlush = now;
          try { conn.send(queue[0]); } catch { /* noop */ }
          queue.length = 0;
        }
      } else if (conn?.open) {
        try { conn.send(m); } catch { /* noop */ }
      }
    },
    onStatus: (cb) => void statusCbs.add(cb),
  };
}
