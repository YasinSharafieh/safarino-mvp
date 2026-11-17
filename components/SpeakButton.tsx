"use client";

/**
 * «بخوان» — one button that reads a Persian sentence out loud.
 *
 * It is deliberately small and honest: it appears only when the device really
 * has a Persian voice, it turns into «توقف» while speaking, and if there is no
 * Persian voice it says so in one line instead of doing nothing.
 * No model is called; this is the browser's own speech engine.
 */

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { speakPersian, speechSupport, stopSpeaking } from "@/lib/speech";

export default function SpeakButton({ text, className = "", label = "بخوان" }: { text: string; className?: string; label?: string }) {
  const [ready, setReady] = useState<"unknown" | "yes" | "no">("unknown");
  const [speaking, setSpeaking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void speechSupport().then((support) => {
      if (mounted.current) setReady(support.persian ? "yes" : "no");
    });
    return () => {
      mounted.current = false;
      stopSpeaking();
    };
  }, []);

  if (ready !== "yes" || !text || text.trim().length < 8) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        if (speaking) {
          stopSpeaking();
          setSpeaking(false);
          return;
        }
        const handle = await speakPersian(text, { onEnd: () => setSpeaking(false) });
        setSpeaking(Boolean(handle));
      }}
      aria-label={speaking ? "توقف خواندن" : label}
      className={`inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold text-slate-300 transition hover:bg-white/[0.1] hover:text-white ${className}`}
    >
      {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      {speaking ? "توقف" : label}
    </button>
  );
}
