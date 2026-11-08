import { Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "کوییز", href: "/quiz" },
  { id: 2, label: "حمل‌ونقل", href: "/transport" },
  { id: 3, label: "اقامتگاه", href: "/accommodation" },
  { id: 4, label: "برنامه نهایی", href: "/plan" },
];

export default function StepIndicator({ step }: { step: number }) {
  const activeStep = Math.min(Math.max(Math.round(step), 1), STEPS.length);

  return (
    <nav
      aria-label="مراحل برنامه‌ریزی سفر"
      className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-gray-900/60 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-3"
    >
      <ol className="grid grid-cols-4 gap-1 sm:gap-2">
        {STEPS.map((item) => {
          const active = item.id === activeStep;
          const complete = item.id < activeStep;
          return (
            <li key={item.id}>
              <a
                href={item.href}
                aria-current={active ? "step" : undefined}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition sm:flex-row sm:px-3 ${
                  active
                    ? "border-violet-400/40 bg-violet-400/15 text-violet-100 shadow-lg shadow-violet-500/10"
                    : complete
                      ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300 hover:bg-emerald-400/10"
                      : "border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${
                    active
                      ? "bg-violet-400 text-slate-950"
                      : complete
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-white/5 text-gray-500"
                  }`}
                >
                  {complete ? <Check className="h-3.5 w-3.5" /> : item.id}
                </span>
                <span className="truncate text-[10px] font-bold sm:text-xs">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
