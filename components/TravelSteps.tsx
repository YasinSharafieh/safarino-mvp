import { Check } from "lucide-react";

const STEPS = [
  { id: 1, number: "۱", label: "کوییز", href: "/quiz" },
  { id: 2, number: "۲", label: "حمل‌ونقل", href: "/transport" },
  { id: 3, number: "۳", label: "اقامتگاه", href: "/accommodation" },
  { id: 4, number: "۴", label: "برنامه نهایی", href: "/plan" },
] as const;

type StepNumber = (typeof STEPS)[number]["id"];

export default function TravelSteps({ current }: { current: StepNumber }) {
  return (
    <nav aria-label="مراحل برنامه‌ریزی سفر" className="mx-auto mb-2 mt-8 w-full max-w-5xl print:hidden">
      <ol className="glass grid grid-cols-4 gap-1 p-2 sm:gap-2 sm:p-3">
        {STEPS.map((step) => {
          const isActive = step.id === current;
          const isComplete = step.id < current;
          return (
            <li key={step.id} className="min-w-0">
              <a
                href={step.href}
                aria-current={isActive ? "step" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-3 text-center transition sm:flex-row sm:gap-2.5 sm:px-3 ${
                  isActive
                    ? "border-blue-300/40 bg-blue-300/10 text-blue-200 shadow-glow"
                    : isComplete
                      ? "border-emerald-400/15 bg-emerald-400/5 text-emerald-300 hover:bg-emerald-400/10"
                      : "border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-black ${
                    isActive
                      ? "border-blue-300 bg-blue-300 text-slate-950"
                      : isComplete
                        ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                        : "border-white/15 bg-white/5 text-slate-500"
                  }`}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : step.number}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold sm:text-xs">{step.label}</span>
                  <span className="mt-0.5 hidden text-[9px] opacity-70 sm:block">
                    {isActive ? "مرحله فعال" : isComplete ? "انجام شده" : `گام ${step.number}`}
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
