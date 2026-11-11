"use client";

import { Coins, Fuel, Info, Moon, Puzzle, Ticket, UtensilsCrossed, Wallet } from "lucide-react";
import { formatToman, formatTomanShort, type BudgetAssumptions, type BudgetPlan } from "@/lib/budget";

const ICONS: Record<string, typeof Coins> = {
  stay: Moon,
  transport: Fuel,
  "city-drive": Coins,
  food: UtensilsCrossed,
  tickets: Ticket,
  extras: Puzzle,
};

const KIND_LABEL: Record<string, string> = {
  real: "قیمت واقعی",
  estimate: "تخمین با فرض شما",
  missing: "انتخاب نشده",
};

const KIND_CLASS: Record<string, string> = {
  real: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  estimate: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
  missing: "border-amber-400/30 bg-amber-400/10 text-amber-200",
};

function NumberField({
  label,
  hint,
  value,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-xl border border-white/10 bg-slate-950/30 p-2">
      <span className="block text-[10px] font-bold text-slate-300">{label}</span>
      <span className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          step={step}
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] font-extrabold text-white outline-none focus:border-cyan-400/50"
        />
        <span className="shrink-0 text-[9px] text-slate-500">تومان</span>
      </span>
      <span className="mt-1 block text-[9px] leading-4 text-slate-500">{hint}</span>
    </label>
  );
}

export default function BudgetBreakdown({
  plan,
  assumptions,
  onAssumptionsChange,
  showAssumptions = true,
}: {
  plan: BudgetPlan;
  assumptions: BudgetAssumptions;
  onAssumptionsChange: (next: BudgetAssumptions) => void;
  showAssumptions?: boolean;
}) {
  const budgetBar = plan.budget && plan.budget > 0 ? Math.min(100, Math.round((plan.total / plan.budget) * 100)) : null;

  return (
    <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-black text-amber-100">
          <Wallet className="h-4 w-4" />
          ریزش هزینه‌های این سفر
        </p>
        <span className="text-[9.5px] text-slate-400">قیمت واقعی و تخمین، جدا و برچسب‌دار</span>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/30 p-2.5">
          <span className="block text-[9.5px] text-slate-500">جمع سفر (تا اینجا)</span>
          <b className="mt-0.5 block text-sm font-black text-white">{formatToman(plan.total)}</b>
          <span className="mt-1 block text-[9px] leading-4 text-slate-500">
            {formatTomanShort(plan.perDay)} در روز · {formatTomanShort(plan.perTraveler)} برای هر نفر
          </span>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/30 p-2.5">
          <span className="block text-[9.5px] text-slate-500">بودجهٔ شما</span>
          <b className="mt-0.5 block text-sm font-black text-white">{plan.budget ? formatToman(plan.budget) : "وارد نشده"}</b>
          {budgetBar !== null ? (
            <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <span
                className={`block h-full rounded-full ${plan.over ? "bg-rose-400" : "bg-emerald-400"}`}
                style={{ width: `${budgetBar}%` }}
              />
            </span>
          ) : null}
        </div>
        <div className={`rounded-xl border p-2.5 ${plan.over ? "border-rose-400/30 bg-rose-400/10" : "border-emerald-400/25 bg-emerald-400/[0.07]"}`}>
          <span className={`block text-[9.5px] ${plan.over ? "text-rose-200/80" : "text-emerald-200/80"}`}>
            {plan.over ? "بیشتر از بودجه" : "باقی‌ماندهٔ بودجه"}
          </span>
          <b className={`mt-0.5 block text-sm font-black ${plan.over ? "text-rose-100" : "text-emerald-100"}`}>
            {plan.remaining === null ? "—" : formatToman(Math.abs(plan.remaining))}
          </b>
          <span className="mt-1 block text-[9px] leading-4 text-slate-400">
            {plan.remaining === null
              ? "بودجهٔ کل را در مرحلهٔ اقامتگاه وارد کنید"
              : plan.over
                ? "با تغییر فرض‌ها یا انتخاب ارزان‌تر، فاصله را کم کنید"
                : "برای خوراک، بلیت و سوغات"}
          </span>
        </div>
      </div>

      <ul className="mt-2 grid gap-1.5">
        {plan.lines.map((line) => {
          const Icon = ICONS[line.id] || Coins;
          const share = plan.shares.find((item) => item.id === line.id);
          return (
            <li key={line.id} className="rounded-xl border border-white/10 bg-slate-950/25 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-cyan-200">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <b className="text-[11px] font-extrabold text-white">{line.label}</b>
                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${KIND_CLASS[line.kind]}`}>
                  {KIND_LABEL[line.kind]}
                </span>
                <span className="ms-auto text-[11px] font-black text-white">
                  {line.amount === null ? "—" : formatToman(line.amount)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                {share ? (
                  <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-cyan-400/70" style={{ width: `${share.percent}%` }} />
                  </span>
                ) : null}
                <p className="min-w-0 flex-1 text-[9px] leading-5 text-slate-400">{line.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {showAssumptions ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/25 p-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black text-slate-200">
            <Info className="h-3.5 w-3.5 text-cyan-300" />
            فرض‌های شما (هر کدام را می‌خواهید تغییر دهید؛ همه‌چیز فوری به‌روز می‌شود)
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              label="هزینهٔ هر کیلومتر در شهر"
              hint="بنزین و استهلاک؛ ۱٬۵۰۰ تومان پیش‌فرض"
              value={assumptions.cityCostPerKm}
              step={100}
              onChange={(value) => onAssumptionsChange({ ...assumptions, cityCostPerKm: value })}
            />
            <NumberField
              label="خوراک هر نفر در روز"
              hint="سه وعدهٔ معمولی در سفر"
              value={assumptions.foodPerPersonPerDay}
              step={50_000}
              onChange={(value) => onAssumptionsChange({ ...assumptions, foodPerPersonPerDay: value })}
            />
            <NumberField
              label="بلیت هر جاذبه برای هر نفر"
              hint="سقف؛ همهٔ جاذبه‌ها بلیت ندارند"
              value={assumptions.ticketPerStop}
              step={20_000}
              onChange={(value) => onAssumptionsChange({ ...assumptions, ticketPerStop: value })}
            />
            <NumberField
              label="سوغات و متفرقه هر نفر در روز"
              hint="خریدهای کوچک و پیش‌بینی‌نشده‌ها"
              value={assumptions.extrasPerPersonPerDay}
              step={50_000}
              onChange={(value) => onAssumptionsChange({ ...assumptions, extrasPerPersonPerDay: value })}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-2 grid gap-1">
        <p className="text-[9.5px] leading-5 text-slate-400">
          {formatToman(plan.realTotal)} این سفر را از واقعیت می‌دانیم (اقامتگاه و حمل‌ونقل انتخاب‌شده) و {formatToman(plan.estimateTotal)} تخمین بر اساس فرض‌های بالاست.
        </p>
        {plan.notes.map((note) => (
          <p key={note} className="text-[9.5px] leading-5 text-slate-500">
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}
