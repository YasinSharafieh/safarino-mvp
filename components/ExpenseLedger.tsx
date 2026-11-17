"use client";

/**
 * «خرج‌های واقعی» — the traveller's own book, on the trip page.
 *
 * Two ways in: type an amount, or photograph the receipt and let the vision model
 * read it (the amount is still confirmed by the traveller before it is written).
 * The totals update instantly, are compared with the same total budget the rest
 * of the site uses, and can be read aloud.
 *
 * The book never leaves the device: it is kept per trip in this browser.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, LoaderCircle, Plus, Trash2, Wallet } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import {
  EXPENSE_LABELS,
  LEDGER_EVENT,
  addExpense,
  ledgerSentence,
  ledgerTotals,
  readLedger,
  removeExpense,
  type Expense,
  type ExpenseCategory,
} from "@/lib/trip-ledger";
import { tripSignature } from "@/lib/checklist";
import SpeakButton from "@/components/SpeakButton";

const fa = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${fa.format(Math.round(value))} تومان`;

const CATEGORIES = Object.keys(EXPENSE_LABELS) as ExpenseCategory[];

type Read = {
  fields: { title: string | null; vendor: string | null; toman: number | null; category: ExpenseCategory | null; date: string | null };
  unread: string[];
  note: string;
};

export default function ExpenseLedger({ className = "" }: { className?: string }) {
  const { travelData, isHydrated } = useTravel();
  const trip = useMemo(
    () =>
      tripSignature({
        origin: travelData.origin,
        destination: travelData.destination,
        departureDate: travelData.departureDate,
        days: travelData.days,
      }),
    [travelData.days, travelData.departureDate, travelData.destination, travelData.origin],
  );

  const [entries, setEntries] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isHydrated) return;
    setEntries(readLedger(trip));
    const sync = () => setEntries(readLedger(trip));
    window.addEventListener(LEDGER_EVENT, sync);
    return () => window.removeEventListener(LEDGER_EVENT, sync);
  }, [isHydrated, trip]);

  const budgetToman = Math.max(0, Math.round((Number(travelData.budget) || 0) * 1_000_000));
  const totals = useMemo(() => ledgerTotals(entries, budgetToman), [budgetToman, entries]);
  const sentence = useMemo(() => ledgerSentence(totals, budgetToman), [budgetToman, totals]);

  const readReceipt = useCallback(async (file: File) => {
    setError("");
    setRead(null);
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const shrunk = await new Promise<string>((resolve) => {
        const image = new window.Image();
        image.onload = () => {
          const maxSide = 1400;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) return resolve(dataUrl);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          } catch {
            resolve(dataUrl);
          }
        };
        image.onerror = () => resolve(dataUrl);
        image.src = dataUrl;
      });
      const response = await fetch("/api/companion/read-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({ image: shrunk }),
      });
      const payload = (await response.json()) as { success?: boolean; fields?: Read["fields"]; unread?: string[]; note?: string; error?: string };
      if (payload.success && payload.fields) {
        setRead({ fields: payload.fields, unread: payload.unread || [], note: payload.note || "" });
        if (payload.fields.toman) setAmount(String(payload.fields.toman));
        if (payload.fields.title || payload.fields.vendor) setTitle(payload.fields.title || payload.fields.vendor || "");
        if (payload.fields.category) setCategory(payload.fields.category);
      } else {
        setError(payload.error || "این رسید خوانده نشد.");
      }
    } catch {
      setError("رسید خوانده نشد؛ یک بار دیگر امتحان کن.");
    } finally {
      setBusy(false);
    }
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount.replace(/[^\d]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      setError("مبلغ را با رقم بنویس.");
      return;
    }
    addExpense(trip, { title, toman: value, category, source: read ? "receipt" : "manual", vendor: read?.fields.vendor || null });
    setEntries(readLedger(trip));
    setTitle("");
    setAmount("");
    setRead(null);
    setError("");
  }

  if (!isHydrated || !travelData.destination) return null;

  return (
    <section className={`glass overflow-hidden p-4 sm:p-5 ${className}`} aria-label="خرج‌های واقعی سفر">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="chip border-emerald-400/25 bg-emerald-400/10 !text-emerald-200">در سفر</span>
          <h2 className="mt-2 flex items-center gap-1.5 text-base font-black text-white sm:text-lg">
            <Wallet className="h-4 w-4 text-emerald-300" />
            خرج‌های واقعی این سفر
          </h2>
          <p className="mt-1 text-[11px] leading-6 text-slate-400">{sentence}</p>
        </div>
        <SpeakButton text={`${sentence} ${totals.byCategory.map((row) => `${row.label}: ${money(row.toman)}`).join(". ")}`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
          <span className="block text-[9px] text-slate-400">بودجهٔ کل</span>
          <b className="block text-[12px] font-black text-white">{money(budgetToman)}</b>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
          <span className="block text-[9px] text-slate-400">خرج شده</span>
          <b className="block text-[12px] font-black text-amber-200">{money(totals.totalToman)}</b>
        </div>
        <div className={`rounded-xl border p-2 ${totals.overBudget ? "border-rose-400/30 bg-rose-400/[0.08]" : "border-emerald-400/25 bg-emerald-400/[0.06]"}`}>
          <span className="block text-[9px] text-slate-400">مانده</span>
          <b className={`block text-[12px] font-black ${totals.overBudget ? "text-rose-100" : "text-emerald-100"}`}>{money(totals.remainingToman)}</b>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
          <span className="block text-[9px] text-slate-400">تعداد</span>
          <b className="block text-[12px] font-black text-white">{fa.format(totals.entries.length)} مورد</b>
        </div>
      </div>

      {totals.byCategory.length ? (
        <div className="mt-2 space-y-1">
          {totals.byCategory.map((row) => (
            <div key={row.category} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[9px] text-slate-400">{row.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.min(100, row.share)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-left text-[9px] text-slate-300">{fa.format(row.share)}٪</span>
              <span className="w-24 shrink-0 text-left text-[9px] text-slate-400">{money(row.toman)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Add: type it, or photograph the receipt. */}
      <form onSubmit={submit} className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-2.5">
        <div className="grid gap-1.5 sm:grid-cols-[1fr_120px_130px_auto]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="برای چه بود؟ (اختیاری)"
            aria-label="شرح خرج"
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-[10.5px] text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
          />
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="numeric"
            placeholder="مبلغ (تومان)"
            aria-label="مبلغ به تومان"
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-[10.5px] text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
            aria-label="دستهٔ خرج"
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-[10.5px] text-white outline-none focus:border-emerald-400/50"
          >
            {CATEGORIES.map((key) => (
              <option key={key} value={key} className="bg-slate-900">
                {EXPENSE_LABELS[key]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-black text-slate-950 transition hover:bg-emerald-400"
          >
            <Plus className="h-3 w-3" />
            ثبت
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-emerald-300/35 bg-slate-950/40 px-2 py-1 text-[9.5px] font-bold text-emerald-100 transition hover:bg-emerald-400/10">
            {busy ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            {busy ? "دارم می‌خوانم…" : "عکس رسید"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void readReceipt(file);
              }}
            />
          </label>
          {read ? (
            <span className="text-[8.5px] text-slate-400">
              {read.fields.vendor ? `${read.fields.vendor} · ` : ""}
              {read.fields.toman ? money(read.fields.toman) : "مبلغ خوانده نشد"}
              {read.unread.length ? ` · خوانده نشد: ${read.unread.join("، ")}` : ""} — با زدن «ثبت» وارد کتاب می‌شود.
            </span>
          ) : null}
          {error ? <span className="text-[9px] text-rose-200">{error}</span> : null}
        </div>
      </form>

      <AnimatePresence initial={false}>
        {totals.entries.length ? (
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 space-y-1">
            {[...totals.entries].reverse().slice(0, 12).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5">
                <span className="min-w-0">
                  <b className="block truncate text-[10px] font-bold text-slate-200">{entry.title}</b>
                  <span className="block text-[8px] text-slate-500">
                    {EXPENSE_LABELS[entry.category]}
                    {entry.source === "receipt" ? " · از رسید" : ""}
                    {entry.vendor ? ` · ${entry.vendor}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <b className="text-[10px] font-black text-white">{money(entry.toman)}</b>
                  <button
                    type="button"
                    onClick={() => {
                      removeExpense(trip, entry.id);
                      setEntries(readLedger(trip));
                    }}
                    aria-label={`حذف ${entry.title}`}
                    className="grid h-5 w-5 place-items-center rounded-md text-slate-500 transition hover:bg-rose-400/15 hover:text-rose-200"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </li>
            ))}
            {totals.entries.length > 12 ? (
              <li className="text-center text-[8.5px] text-slate-500">{fa.format(totals.entries.length - 12)} مورد قدیمی‌تر هم در کتاب هست.</li>
            ) : null}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      <p className="mt-2 flex items-center gap-1 text-[8px] text-slate-500">
        <Check className="h-2.5 w-2.5" />
        کتاب خرج‌ها فقط در همین مرورگر و مخصوص همین سفر نگه داشته می‌شود؛ هیچ‌جا فرستاده نمی‌شود.
      </p>
    </section>
  );
}
