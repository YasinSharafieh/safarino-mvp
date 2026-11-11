"use client";

import { useMemo, useState } from "react";
import { Check, Download, Image as ImageIcon, Link2, LoaderCircle, MessageCircle, Send, Share2 } from "lucide-react";
import { shareCardBlob } from "@/lib/share-card";
import { compactTrip, telegramShareUrl, whatsappShareUrl } from "@/lib/share";

type Props = {
  /** The whole plan as it is on the screen right now; it is validated here. */
  trip: unknown;
};

/**
 * Sending the plan to someone.
 * A short link that opens the same plan, a picture card for WhatsApp, and a
 * plain text message — all built from what is on the screen, nothing invented.
 */
export default function ShareTrip({ trip }: Props) {
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardNote, setCardNote] = useState("");

  const payload = useMemo(() => compactTrip(trip), [trip]);

  const makeLink = async () => {
    if (!payload) {
      setNote("برنامه‌ای برای اشتراک‌گذاری نیست.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trip),
      });
      const data = await response.json();
      if (data?.success && typeof data.url === "string") {
        setLink(data.url);
        setNote(typeof data.note === "string" ? data.note : "");
      } else {
        setNote(typeof data?.error === "string" ? data.error : "ساخت لینک انجام نشد؛ دوباره تلاش کنید.");
      }
    } catch {
      setNote("ارتباط برقرار نشد؛ لینک ساخته نشد.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const makeCard = async () => {
    if (!payload) {
      setCardNote("برنامه‌ای برای ساختن تصویر نیست.");
      return;
    }
    setCardBusy(true);
    setCardNote("");
    try {
      const blob = await shareCardBlob(payload);
      if (!blob) {
        setCardNote("ساخت تصویر در این مرورگر ممکن نشد.");
        return;
      }
      const file = new File([blob], `safarino-${payload.city || "trip"}.png`, { type: "image/png" });
      const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (canShare) {
        try {
          await navigator.share({ files: [file], title: `برنامهٔ سفر ${payload.city}`, text: "برنامهٔ سفر من در سفرینو" });
          setCardNote("کارت تصویری آماده شد.");
          return;
        } catch {
          /* the traveller cancelled sharing: keep the download below */
        }
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setCardNote("کارت تصویری ذخیره شد؛ می‌توانید آن را در واتساپ بفرستید.");
    } catch {
      setCardNote("ساخت تصویر انجام نشد؛ لینک را بفرستید.");
    } finally {
      setCardBusy(false);
    }
  };

  const shareable = payload !== null;

  return (
    <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-black text-cyan-100">
          <Share2 className="h-4 w-4" />
          فرستادن این برنامه
        </p>
        <span className="text-[9.5px] text-slate-400">لینک یا کارت تصویری؛ همان چیزی که روی صفحه می‌بینید</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void makeLink()}
          disabled={busy || !shareable}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/15 px-3 py-2 text-[10.5px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          ساخت لینک اشتراک
        </button>
        <button
          type="button"
          onClick={() => void makeCard()}
          disabled={cardBusy || !shareable}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[10.5px] font-bold text-slate-100 transition hover:bg-white/10 disabled:opacity-50"
        >
          {cardBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          کارت تصویری برای واتساپ
        </button>
        {link && payload ? (
          <>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[10.5px] font-bold text-slate-100 transition hover:bg-white/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Link2 className="h-3.5 w-3.5" />}
              {copied ? "کپی شد" : "کپی لینک"}
            </button>
            <a
              href={whatsappShareUrl(link, payload)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10.5px] font-extrabold text-emerald-100 transition hover:bg-emerald-400/20"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              واتساپ
            </a>
            <a
              href={telegramShareUrl(link, payload)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-[10.5px] font-extrabold text-sky-100 transition hover:bg-sky-400/20"
            >
              <Send className="h-3.5 w-3.5" />
              تلگرام
            </a>
          </>
        ) : null}
      </div>

      {link ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-2">
          <Download className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
          <input
            readOnly
            value={link}
            aria-label="نشانی برنامهٔ به‌اشتراک‌گذاشته‌شده"
            onFocus={(event) => event.currentTarget.select()}
            dir="ltr"
            className="w-full min-w-0 bg-transparent text-[10px] text-cyan-100 outline-none"
          />
        </div>
      ) : null}

      {note ? <p className="mt-2 text-[9.5px] leading-5 text-slate-300">{note}</p> : null}
      {cardNote ? <p className="mt-1 text-[9.5px] leading-5 text-slate-300">{cardNote}</p> : null}
      <p className="mt-2 text-[9px] leading-5 text-slate-500">
        لینک، یک تصویر ثابت از همین برنامه است؛ هر کسی بازش کند همین روزها و همین عددها را می‌بیند و لازم نیست جایی ثبت‌نام کند. اطلاعات شخصی و کلیدهای سرویس‌ها در لینک نیست.
      </p>
    </div>
  );
}
