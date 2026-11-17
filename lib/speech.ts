/**
 * «بخوانش فارسی» — the companion's voice, free of charge.
 *
 * Reading a Persian sentence aloud needs no model and costs no money: the
 * browser already has a speech engine. This file finds a Persian voice honestly,
 * speaks sentence by sentence (so a long paragraph can be stopped mid-way),
 * and reports plainly when a device has no Persian voice — it never pretends to
 * have spoken.
 *
 * Nothing is synthesised on a server, so no traveller's question is ever stored
 * or sent anywhere to be read out.
 */

export type SpeechSupport = {
  supported: boolean;
  /** A Persian voice really exists on this device. */
  persian: boolean;
  voiceName: string | null;
};

/** Voices load asynchronously in most browsers; this waits for them once. */
export async function loadVoices(timeoutMs = 1_200): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return existing;
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, timeoutMs);
  });
}

export async function speechSupport(): Promise<SpeechSupport> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return { supported: false, persian: false, voiceName: null };
  }
  const voices = await loadVoices();
  const persian = voices.find((voice) => /^fa(-|_)?/i.test(voice.lang) || /persian|farsi|فارسی/i.test(voice.name)) || null;
  return { supported: true, persian: Boolean(persian), voiceName: persian?.name || null };
}

/** Splits a paragraph into speakable sentences (Persian punctuation included). */
export function sentences(text: string): string[] {
  return (text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!؟…])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, 12);
}

export type SpeakHandle = { stop: () => void };

/**
 * Speaks the text. Returns a handle so the caller can stop it (a second press,
 * or leaving the page). `onEnd` fires once, after the last sentence.
 */
export async function speakPersian(
  text: string,
  options: { rate?: number; onEnd?: () => void; onStart?: () => void } = {},
): Promise<SpeakHandle | null> {
  const support = await speechSupport();
  if (!support.supported || !support.persian) return null;
  const voices = await loadVoices();
  const voice = voices.find((item) => /^fa(-|_)?/i.test(item.lang) || /persian|farsi|فارسی/i.test(item.name)) || null;
  const engine = window.speechSynthesis;
  engine.cancel();
  const parts = sentences(text);
  if (!parts.length) return null;
  options.onStart?.();
  parts.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    utterance.lang = "fa-IR";
    utterance.rate = options.rate ?? 0.98;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    if (index === parts.length - 1) utterance.onend = () => options.onEnd?.();
    engine.speak(utterance);
  });
  return { stop: () => engine.cancel() };
}

/** Stops any speech this page started. */
export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
