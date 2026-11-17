import { Check } from "lucide-react";
import { JOURNEY_STEPS } from "@/lib/site-facts";

/**
 * «نقشهٔ راه سفر» — the same five steps on every page.
 *
 * It used to have four steps and call the fourth one «برنامه نهایی», while the
 * schedule lived on `/plan` and the real trip book lived on `/itinerary`; a
 * traveller could not tell which one was «the plan». The steps now come from
 * `JOURNEY_STEPS` in `lib/site-facts`, are named by what the traveller receives,
 * and every phase points at its own step:
 *
 *   ۱ مقصد و تاریخ → ۲ بلیت → ۳ اقامتگاه → ۴ برنامهٔ روزها → ۵ دفترچهٔ سفر
 *
 * A step is ticked only when the traveller really did it — `done` is passed in by
 * the page from the shared trip (a chosen ticket, a chosen stay), not guessed
 * from the step number.
 */
export type StepNumber = 1 | 2 | 3 | 4 | 5;

export default function TravelSteps({
  current,
  /** Which steps the traveller has really completed, from the shared trip. */
  done = [],
}: {
  current: StepNumber;
  done?: StepNumber[];
}) {
  return (
    <nav aria-label="مراحل برنامه‌ریزی سفر" className="mx-auto mb-2 mt-8 w-full max-w-5xl print:hidden">
      <ol className="glass grid grid-cols-5 gap-1 p-2 sm:gap-2 sm:p-3">
        {JOURNEY_STEPS.map((step, index) => {
          const id = (index + 1) as StepNumber;
          const isActive = id === current;
          const isComplete = done.includes(id) || id < current;
          return (
            <li key={step.href} className="min-w-0">
              <a
                href={step.href}
                aria-current={isActive ? "step" : undefined}
                title={step.promise}
                className={`flex h-full flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-3 text-center transition sm:flex-row sm:gap-2.5 sm:px-2 ${
                  isActive
                    ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200 shadow-glow"
                    : isComplete
                      ? "border-emerald-400/15 bg-emerald-400/5 text-emerald-300 hover:bg-emerald-400/10"
                      : "border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-black ${
                    isActive
                      ? "border-cyan-300 bg-cyan-300 text-slate-950"
                      : isComplete
                        ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                        : "border-white/15 bg-white/5 text-slate-500"
                  }`}
                >
                  {isComplete && !isActive ? <Check className="h-3.5 w-3.5" /> : step.number}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[9.5px] font-bold sm:text-[11px]">{step.label}</span>
                  <span className="mt-0.5 hidden truncate text-[9px] opacity-70 lg:block">
                    {isActive ? "همین‌جا هستی" : isComplete ? "انجام شد" : step.promise}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
