"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, LoaderCircle, Mic, MicOff, RefreshCw, Sparkles, Square, Wand2 } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import type { VoiceTrip } from "@/lib/voice-parse";

/**
 * «با صدات بگو» — the neon microphone.
 *
 * The browser does the listening (Web Speech API, no server, no recording sent
 * anywhere). The transcript goes to `/api/voice/parse`, which reads it with the
 * app's own rules first, and the result is shown back *before* anything is
 * written into the trip. Nothing is saved until the traveller presses «اعمال کن».
 */

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
  length: number;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

const EXAMPLE = "من ۱۰ میلیون تومن پول دارم، هفته دیگه با همسرم می‌خوام برم یزد، ماشینمون هم پژو ۲۰۶ هست.";

export default function VoiceTripButton({
  variant = "hero",
  onApplied,
}: {
  variant?: "hero" | "compact";
  /** Called right after the trip is written to the shared context. */
  onApplied?: (trip: VoiceTrip) => void;
}) {
  const router = useRouter();
  const { travelData, setTravelData, isHydrated } = useTravel();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [parsing, setParsing] = useState(false);
  const [trip, setTrip] = useState<VoiceTrip | null>(null);
  const [note, setNote] = useState("");
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(recognitionConstructor()));
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const parse = useCallback(async (text: string) => {
    if (text.trim().length < 4) return;
    setParsing(true);
    setError("");
    try {
      const response = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ transcript: text }),
      });
      const payload = (await response.json()) as { success?: boolean; trip?: VoiceTrip; source?: "ai" | "local"; note?: string; error?: string };
      if (!payload?.success || !payload.trip) throw new Error(payload?.error || "خواندن جمله ممکن نشد");
      setTrip(payload.trip);
      setNote(payload.note || "");
      setSource(payload.source || "local");
    } catch {
      setError("این جمله خوانده نشد. یک بار دیگر بگو یا خودت تایپ کن.");
    } finally {
      setParsing(false);
    }
  }, []);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setManual(true);
      return;
    }
    setError("");
    setTrip(null);
    setTranscript("");
    setInterim("");
    const recognition = new Constructor();
    recognition.lang = "fa-IR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalText += ` ${text}`;
        else interimText += ` ${text}`;
      }
      if (finalText.trim()) setTranscript((current) => `${current} ${finalText}`.trim());
      setInterim(interimText.trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setError("مرورگر اجازهٔ میکروفون نداد. از تنظیمات مرورگر اجازه بده یا جمله را تایپ کن.");
        setManual(true);
      } else if (event?.error === "no-speech") {
        setError("صدایی شنیده نشد؛ یک بار دیگر نزدیک‌تر به میکروفون بگو.");
      }
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setManual(true);
    }
  }, []);

  // When the browser stops on its own, the sentence that was heard is read.
  useEffect(() => {
    if (listening || !transcript.trim() || trip || parsing) return;
    void parse(transcript);
    // Only when a sentence just finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  const apply = () => {
    if (!trip) return;
    setTravelData((current) => ({
      ...current,
      origin: trip.origin || current.origin,
      destination: trip.destination || current.destination,
      budget: trip.budgetMillions || current.budget,
      days: trip.days || current.days,
      travelers: trip.travelers || current.travelers,
      children: trip.children ?? current.children,
      preferredMode: trip.mode || current.preferredMode,
      departureDate: trip.departureDate || current.departureDate,
      returnDate:
        trip.departureDate && (trip.days || current.days)
          ? new Date(Date.parse(`${trip.departureDate}T00:00:00Z`) + Math.max(1, trip.days || current.days) * 86_400_000).toISOString().slice(0, 10)
          : current.returnDate,
    }));
    onApplied?.(trip);
    // With a callback the caller decides where to go — the trip form, for example.
    if (!onApplied) router.push("/start/cities");
  };

  const hero = variant === "hero";
  const remaining = trip ? trip.missing.filter((field) => field !== "مبدأ") : [];

  return (
    <div className={hero ? "glass relative overflow-hidden p-5 sm:p-6" : "rounded-2xl border border-white/10 bg-slate-950/30 p-3"}>
      {hero ? (
        <span className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
      ) : null}

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <b className={`flex items-center gap-1.5 font-black text-white ${hero ? "text-base" : "text-[11px]"}`}>
            <Sparkles className="h-4 w-4 text-violet-300" />
            {hero ? "فقط بگو چه سفری می‌خواهی" : "یا با صدا بگو"}
          </b>
          <p className="mt-1 text-[10.5px] leading-6 text-slate-400">
            {hero
              ? "میکروفون را بزن و مثل حرف زدن با یک دوست توضیح بده. بودجه، مقصد، تعداد نفرات و وسیله را خودمان از جمله‌ات درمی‌آوریم — و قبل از هر کاری نشانت می‌دهیم چه چیزی شنیدیم."
              : "یک جمله بگو؛ فرم را خودمان پر می‌کنیم."}
          </p>
        </div>

        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={parsing || supported === null}
          aria-label={listening ? "پایان ضبط" : "شروع صحبت"}
          className={`relative grid place-items-center rounded-full transition disabled:opacity-60 ${
            hero ? "h-16 w-16" : "h-11 w-11"
          } ${listening ? "bg-rose-500 text-white shadow-[0_0_40px_rgba(244,63,94,0.55)]" : "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-slate-950 shadow-[0_0_30px_rgba(168,85,247,0.45)] hover:scale-105"}`}
        >
          {listening ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" />
          ) : (
            <span className="absolute inset-0 animate-pulse rounded-full bg-violet-400/20" />
          )}
          {parsing ? <LoaderCircle className={`${hero ? "h-6 w-6" : "h-5 w-5"} animate-spin`} /> : listening ? <Square className={hero ? "h-6 w-6" : "h-4 w-4"} /> : <Mic className={hero ? "h-7 w-7" : "h-5 w-5"} />}
        </button>
      </div>

      {listening ? (
        <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-rose-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          در حال شنیدن… {interim ? `«${interim}»` : "حرف بزن"}
        </p>
      ) : null}

      {supported === false ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-2.5 text-[10px] leading-6 text-amber-100">
          <MicOff className="mt-0.5 h-3 w-3 shrink-0" />
          این مرورگر میکروفون را پشتیبانی نمی‌کند (بیشتر مرورگرهای موبایل و سافاری). جمله‌ات را تایپ کن؛ همان موتور، همان کار را می‌کند.
        </p>
      ) : null}

      {(manual || supported === false || (error && !transcript)) && !trip ? (
        <form
          className="mt-3 flex flex-wrap gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void parse(transcript);
          }}
        >
          <input
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder={EXAMPLE}
            aria-label="جملهٔ سفر"
            className="min-w-[180px] flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[10.5px] text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
          />
          <button type="submit" disabled={parsing || transcript.trim().length < 4} className="btn-primary !px-3 !py-2 text-[10.5px] disabled:opacity-50">
            {parsing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            بخوان
          </button>
        </form>
      ) : null}

      {transcript && !trip && !parsing ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[10px] leading-6 text-slate-300">
          شنیدم: «{transcript}»
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-rose-200">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      ) : null}

      {trip ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.06] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-[10.5px] font-black text-cyan-100">
              {source === "ai" ? "از جمله‌ات این‌ها را خواندیم" : "از جمله‌ات این‌ها را خواندیم"}
            </b>
            <span className="text-[9px] text-cyan-200/70">{Math.round(trip.confidence * 100)}٪ فرم پر شد</span>
          </div>

          {trip.read.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trip.read.map((entry) => (
                <span key={entry.field} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[9.5px] text-white">
                  <Check className="h-2.5 w-2.5 text-emerald-300" />
                  <span className="text-slate-400">{entry.label}:</span>
                  {entry.value}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-slate-400">هیچ فیلدی از این جمله خوانده نشد.</p>
          )}

          {remaining.length ? (
            <p className="mt-2 text-[10px] text-amber-100/90">
              این‌ها را در جمله نگفتی و حدس هم نمی‌زنیم: {remaining.join("، ")} — در صفحهٔ بعد کاملشان کن.
            </p>
          ) : null}
          {note ? <p className="mt-1 text-[9px] leading-5 text-slate-500">{note}</p> : null}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button type="button" onClick={apply} disabled={!isHydrated} className="btn-primary !px-3 !py-2 text-[10.5px]">
              <Check className="h-3.5 w-3.5" />
              اعمال کن و برو
            </button>
            <button
              type="button"
              onClick={() => {
                setTrip(null);
                setTranscript("");
                setManual(true);
              }}
              className="btn-ghost !px-3 !py-2 text-[10.5px]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              دوباره بگو
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-500">
            چیزی ذخیره نمی‌شود تا خودت «اعمال کن» را نزنی.
            <ArrowLeft className="h-2.5 w-2.5" />
          </p>
        </motion.div>
      ) : null}

      {hero && !trip && !listening ? (
        <p className="mt-3 text-[9.5px] leading-5 text-slate-500">
          نمونه: «{EXAMPLE}»
        </p>
      ) : null}
    </div>
  );
}
