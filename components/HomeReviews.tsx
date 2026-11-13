"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, LoaderCircle, MessageSquarePlus, Send, Star } from "lucide-react";
import CityCombobox from "@/components/CityCombobox";
import { iranianTravelCities } from "@/lib/start-flow";
import type { Review } from "@/lib/reviews";

type State = {
  reviews: Review[];
  total: number;
  average: number | null;
  storageUnavailable: boolean;
};

const faDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
};

/**
 * «نظرات مسافران» — only what real visitors wrote.
 *
 * No seed testimonials exist anywhere in the code, so a fresh installation
 * shows an honest empty state and the form. Nothing personal (email, phone)
 * is collected or published.
 */
export default function HomeReviews() {
  const cities = useMemo(() => iranianTravelCities(), []);
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/reviews", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: State & { success?: boolean }) => setState({
        reviews: Array.isArray(payload.reviews) ? payload.reviews : [],
        total: Number(payload.total) || 0,
        average: typeof payload.average === "number" ? payload.average : null,
        storageUnavailable: Boolean(payload.storageUnavailable),
      }))
      .catch(() => setState({ reviews: [], total: 0, average: null, storageUnavailable: true }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async () => {
    setError("");
    setDone("");
    if (!city) {
      setError("شهر سفر را انتخاب کنید.");
      return;
    }
    if (!rating) {
      setError("به سفر خود امتیاز بدهید.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city, rating, text }),
      });
      const payload = await response.json();
      if (!payload.success) {
        setError(payload.error || "ثبت نظر ممکن نشد.");
        return;
      }
      setDone("ممنون! نظر شما ثبت شد و همین حالا در همین صفحه دیده می‌شود.");
      setText("");
      setName("");
      setRating(0);
      setOpen(false);
      load();
    } catch {
      setError("ثبت نظر ممکن نشد. اتصال اینترنت را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  };

  const reviews = state?.reviews || [];

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <span className="chip">نظرات مسافران</span>
        <h2 className="section-title mt-3">هر چه اینجا می‌خوانید، نوشتهٔ یک مسافر واقعی است</h2>
        <p className="mt-3 text-xs leading-6 text-slate-400">
          سفرینو هیچ نظر ساختگی‌ای منتشر نمی‌کند. اگر سفر کرده‌اید، تجربه‌تان را بنویسید تا مسافر بعدی تصمیم بهتری بگیرد.
        </p>
        {state && state.total > 0 && state.average ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-bold text-amber-200">
            <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
            {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(state.average)} از ۵
            · {new Intl.NumberFormat("fa-IR").format(state.total)} نظر ثبت‌شده
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="glass h-40 animate-pulse" />
          ))}
        </div>
      ) : null}

      {!loading && !reviews.length ? (
        <div className="glass mx-auto mt-8 max-w-xl p-5 text-center">
          <MessageSquarePlus className="mx-auto h-8 w-8 text-cyan-300" />
          <b className="mt-3 block text-sm text-white">هنوز هیچ نظری ثبت نشده است</b>
          <p className="mt-2 text-[11px] leading-6 text-slate-400">
            {state?.storageUnavailable
              ? "الان نمی‌توانیم نظرها را بخوانیم. چند دقیقهٔ دیگر دوباره سر بزنید."
              : "به‌جای نظرهای ساختگی، جایش خالی است تا اولین تجربهٔ واقعی اینجا نوشته شود."}
          </p>
        </div>
      ) : null}

      {reviews.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <motion.blockquote
              key={review.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(index, 5) * 0.06 }}
              className="glass glass-hover flex flex-col p-5"
            >
              <div className="flex gap-0.5 text-amber-300" aria-label={`${review.rating} از ۵`}>
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star key={star} className={star < review.rating ? "h-3.5 w-3.5 fill-amber-300" : "h-3.5 w-3.5 text-slate-600"} />
                ))}
              </div>
              <p className="mt-3 flex-1 text-[12px] leading-7 text-slate-300">«{review.text}»</p>
              <footer className="mt-4 flex items-center gap-2.5 border-t border-white/5 pt-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-600 text-[11px] font-black text-slate-950">
                  {review.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <b className="block truncate text-[11.5px] text-white">{review.name}</b>
                  <span className="block truncate text-[9.5px] text-slate-500">
                    سفر به {review.city} · {faDate(review.createdAt)}
                  </span>
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      ) : null}

      <div className="mx-auto mt-6 max-w-xl">
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full !py-3 text-xs">
            <MessageSquarePlus className="h-4 w-4" />
            تجربهٔ سفرم را می‌نویسم
          </button>
        ) : (
          <div className="glass p-4 sm:p-5">
            <b className="block text-sm font-extrabold text-white">نظر شما دربارهٔ سفر</b>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">
              نام و متن شما عمومی نمایش داده می‌شود؛ ایمیل یا شماره تلفن نمی‌گیریم.
            </p>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold text-slate-300">نام نمایشی (اختیاری)</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={24}
                  placeholder="مثلاً سارا"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                />
              </label>
              <CityCombobox label="شهر سفر" value={city} cities={cities} placeholder="کجا سفر کردید؟" onChange={(item) => setCity(item.name)} />
            </div>

            <div className="mt-3">
              <span className="mb-1.5 block text-[10px] font-bold text-slate-300">امتیاز</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} از ۵`}
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
                    className="rounded-lg p-1 transition hover:scale-110"
                  >
                    <Star className={value <= rating ? "h-6 w-6 fill-amber-300 text-amber-300" : "h-6 w-6 text-slate-600"} />
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-[10px] font-bold text-slate-300">تجربهٔ شما</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={4}
                maxLength={600}
                placeholder="چه چیزی خوب بود؟ چه چیزی را مسافر بعدی بداند؟"
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
              />
              <span className="mt-1 block text-[9px] text-slate-600">
                {new Intl.NumberFormat("fa-IR").format(text.length)} از ۶۰۰ حرف · لینک و شماره تلفن حذف می‌شوند
              </span>
            </label>

            {error ? (
              <p className="mt-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-2 text-[10px] leading-5 text-rose-100">{error}</p>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost !px-3 !py-2 text-[11px]">
                بستن
              </button>
              <button type="button" onClick={submit} disabled={busy} className="btn-primary !px-4 !py-2.5 text-[11px] disabled:opacity-50">
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                ثبت نظر
              </button>
            </div>
          </div>
        )}

        {done ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-2.5 text-[10.5px] text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {done}
          </p>
        ) : null}
      </div>
    </div>
  );
}
