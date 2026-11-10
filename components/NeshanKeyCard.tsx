"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, LoaderCircle, Navigation, Trash2 } from "lucide-react";
import { clearNeshanKey, maskNeshanKey, readNeshanKey, saveNeshanKey } from "@/lib/neshan-key";

type Props = {
  /** Called after the key is saved or removed so the page can refresh its distances. */
  onChanged?: (key: string) => void;
  compact?: boolean;
};

/**
 * "Connect Neshan" card.
 *
 * The key stays in this browser: it is never baked into the site, never put in
 * a link and never shown in full. When it is present the server asks Neshan's
 * distance matrix for the driving distance and travel time; otherwise the app
 * says plainly that OpenStreetMap is doing the routing.
 */
export default function NeshanKeyCard({ onChanged, compact = false }: Props) {
  const [stored, setStored] = useState("");
  const [draft, setDraft] = useState("");
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "warning">("info");

  useEffect(() => {
    setStored(readNeshanKey());
  }, []);

  async function verify(key: string) {
    setTesting(true);
    setTone("info");
    setMessage("در حال بررسی کلید با نشان…");
    try {
      const response = await fetch("/api/route/neshan-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ neshanApiKey: key }),
      });
      const payload = await response.json();
      if (payload?.connected) {
        setTone("success");
        setMessage(payload.message || "کلید نشان درست است.");
      } else {
        setTone("warning");
        setMessage(payload?.message || payload?.error || "کلید نشان پذیرفته نشد.");
      }
    } catch {
      setTone("warning");
      setMessage("بررسی کلید انجام نشد؛ اتصال شبکه را کنترل کنید.");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    const value = draft.trim();
    if (!value) return;
    if (!saveNeshanKey(value)) {
      setTone("warning");
      setMessage("ذخیرهٔ کلید در این مرورگر ممکن نشد.");
      return;
    }
    setStored(value);
    setDraft("");
    onChanged?.(value);
    await verify(value);
  }

  function handleRemove() {
    clearNeshanKey();
    setStored("");
    setTone("info");
    setMessage("کلید نشان از این مرورگر پاک شد؛ فاصله‌ها با OpenStreetMap محاسبه می‌شوند.");
    onChanged?.("");
  }

  return (
    <div className={compact ? "rounded-2xl border border-white/10 bg-white/[0.03] p-4" : "glass p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-white">
          <Navigation className="h-4 w-4 text-cyan-300" />
          اتصال به نقشهٔ نشان
        </h3>
        <span className={`text-[10px] font-bold ${stored ? "text-emerald-300" : "text-slate-500"}`}>
          {stored ? `کلید ثبت‌شده: ${maskNeshanKey(stored)}` : "بدون کلید نشان"}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-6 text-slate-400">
        با کلید نشان، فاصله و زمان رانندگی از اقامتگاه انتخابی تا هر جاذبه از نقشهٔ نشان (با ترافیک) خوانده می‌شود. کلید فقط در همین مرورگر نگه داشته می‌شود و در سایت ذخیره نمی‌شود.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={stored ? "برای تغییر، کلید تازه را بچسبانید" : "کلید وب‌سرویس نشان (service key) را بچسبانید"}
          aria-label="کلید نشان"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-night-800/90 px-3 text-[11px] font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
          dir="ltr"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={testing || !draft.trim()}
          className="btn-primary !px-4 !py-2.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          ذخیره و بررسی
        </button>
        {stored && (
          <button type="button" onClick={handleRemove} className="btn-ghost !px-4 !py-2.5 text-[11px]">
            <Trash2 className="h-4 w-4" />
            پاک‌کردن
          </button>
        )}
      </div>

      {message && (
        <p role="status" className={`mt-2 flex items-start gap-1.5 text-[11px] leading-6 ${tone === "success" ? "text-emerald-300" : tone === "warning" ? "text-amber-300" : "text-slate-400"}`}>
          {tone === "success" && <Check className="mt-1 h-3.5 w-3.5 shrink-0" />}
          {message}
        </p>
      )}

      <p className="mt-2 text-[10px] leading-6 text-slate-600">
        کلید رایگان از <span dir="ltr" className="text-slate-400">platform.neshan.org</span> گرفته می‌شود (ثبت‌نام با شمارهٔ موبایل، بعد ساخت Web-service key). سفرینو بدون کلید هم کار می‌کند و در آن حالت فاصله‌ها را OpenStreetMap حساب می‌کند.
      </p>
    </div>
  );
}
