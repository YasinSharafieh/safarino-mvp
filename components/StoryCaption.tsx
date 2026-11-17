"use client";

/**
 * «کپشن استوری» — the words to paste under the story cards.
 *
 * Three lengths of the same true facts, each with the trip's own hashtags. The
 * traveller can copy one, share it through the phone's own share sheet, or ask the
 * writing model for a warmer version — and if the model's sentence contains a
 * number the trip does not have, the local caption is kept and the card says so.
 */

import { useMemo, useState } from "react";
import { Check, Copy, LoaderCircle, PenLine, Share2, Sparkles, Type } from "lucide-react";
import {
  captionHashtags,
  captionVariants,
  fullCaption,
  type CaptionInput,
  type CaptionVariant,
} from "@/lib/story-caption";

export default function StoryCaption({ input, className = "" }: { input: CaptionInput; className?: string }) {
  const variants = useMemo(() => captionVariants(input), [input]);
  const hashtags = useMemo(() => captionHashtags(input), [input]);
  const [active, setActive] = useState<CaptionVariant["id"]>("story");
  const [copied, setCopied] = useState<string>("");
  const [aiText, setAiText] = useState<{ text: string; source: "local" | "ai" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const current = aiText && active === "story" ? { ...variants[1], text: aiText.text } : variants.find((variant) => variant.id === active) || variants[1];
  const full = fullCaption(current, hashtags);

  const copy = async (which: CaptionVariant["id"]) => {
    const variant = which === "story" && aiText ? { ...variants[1], text: aiText.text } : variants.find((item) => item.id === which) || variants[1];
    const text = fullCaption(variant, hashtags);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setNote("کپی شد؛ حالا در اینستاگرام بچسبان.");
      window.setTimeout(() => setCopied(""), 2200);
    } catch {
      setNote("مرورگر اجازهٔ کپی نداد؛ متن را از کادر پایین دستی انتخاب کن.");
    }
  };

  const share = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await copy("story");
      return;
    }
    try {
      await navigator.share({ title: `سفر ${input.destination}`, text: full });
      setNote("پنجرهٔ اشتراک باز شد.");
    } catch {
      /* the traveller closed it — not an error worth a message */
    }
  };

  const polish = async () => {
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/trip/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const payload = (await response.json()) as { success?: boolean; caption?: string; source?: "local" | "ai" };
      if (payload?.success && typeof payload.caption === "string") {
        const source = payload.source === "ai" ? "ai" : "local";
        setAiText({ text: payload.caption, source });
        setActive("story");
        setNote(
          source === "ai"
            ? "نسخهٔ نوشتهٔ هوش مصنوعی آمد و بازبینی شد: هیچ عددی خارج از داده‌های سفر در آن نیست."
            : "هوش مصنوعی امروز در دسترس نبود؛ متن محلی که از خود برنامه ساخته شده استفاده شد.",
        );
      } else {
        setNote("نوشتن نسخهٔ تازه انجام نشد؛ متن محلی همان بالاست.");
      }
    } catch {
      setNote("ارتباط برقرار نشد؛ متن محلی همان بالاست.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 ${className}`} aria-label="کپشن استوری">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-black text-white">
          <Type className="h-3.5 w-3.5 text-fuchsia-200" />
          کپشن استوری
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={polish}
            disabled={busy}
            className="flex items-center gap-1 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-2 py-1 text-[9px] font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
            نسخهٔ گرم‌تر با هوش مصنوعی
          </button>
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black text-slate-200 transition hover:bg-white/10"
          >
            <Share2 className="h-2.5 w-2.5" />
            اشتراک
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => setActive(variant.id)}
            className={`rounded-full border px-2 py-1 text-[9px] font-black transition ${
              active === variant.id
                ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
            }`}
          >
            {variant.id === "story" && aiText?.source === "ai" ? "استوری (نوشتهٔ AI)" : variant.label}
          </button>
        ))}
      </div>

      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-2.5 text-[9.5px] leading-6 text-slate-100" dir="rtl">
        {full}
      </pre>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => copy(active)}
          className="flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black text-emerald-100 transition hover:bg-emerald-400/20"
        >
          {copied === active ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
          {copied === active ? "کپی شد" : "کپی کپشن"}
        </button>
        <span className="flex items-center gap-1 text-[9px] text-slate-400">
          <PenLine className="h-2.5 w-2.5" />
          {hashtags.length} هشتگ از خود سفر
        </span>
        {aiText ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] text-slate-400">
            {aiText.source === "ai" ? "بازبینی‌شده توسط بازبین عددی" : "نوشتهٔ محلی"}
          </span>
        ) : null}
      </div>

      {note ? <p className="mt-1.5 text-[9px] leading-5 text-slate-300">{note}</p> : null}
    </section>
  );
}
