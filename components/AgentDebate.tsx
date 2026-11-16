"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Coins, HeartHandshake, MapPinned } from "lucide-react";
import { estimateBudget } from "@/lib/budget-fit";

/**
 * «سه دستیار با هم چانه می‌زنند» — the waiting screen while the plan is built.
 *
 * Every line is generated from the trip's real numbers (money, people, children,
 * days), so this is not a fake console: it is a readable trace of the trade-off
 * the app is actually making. It never invents a place or a price, and it says so
 * underneath.
 */

type Agent = "money" | "comfort" | "places";

export type DebateInput = {
  destination: string;
  budgetMillions: number;
  days: number;
  travellers: number;
  children: number;
  transportToman: number;
  stayToman: number;
  mode?: string;
  placeCount?: number;
};

type Line = { agent: Agent; text: string; at: number };

const AGENT_STYLE: Record<Agent, { label: string; icon: typeof Coins; classes: string }> = {
  money: { label: "دستیار مالی", icon: Coins, classes: "border-amber-400/25 bg-amber-400/[0.07] text-amber-100" },
  comfort: { label: "دستیار رفاه", icon: HeartHandshake, classes: "border-fuchsia-400/25 bg-fuchsia-400/[0.07] text-fuchsia-100" },
  places: { label: "دستیار جاذبه‌ها", icon: MapPinned, classes: "border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-100" },
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const money = (value: number) => `${fa(value)} تومان`;

/** The script, derived only from real inputs. */
export function debateLines(input: DebateInput): Line[] {
  const people = Math.max(1, input.travellers);
  const estimate = estimateBudget({
    totalBudget: Math.max(0, input.budgetMillions * 1_000_000),
    travellers: people,
    days: Math.max(1, input.days),
    tickets: input.transportToman,
    stay: input.stayToman,
  });
  const lines: Line[] = [];

  if (input.budgetMillions > 0) {
    lines.push({
      agent: "money",
      text:
        estimate.remaining >= 0
          ? `بودجه ${money(estimate.totalBudget)} است؛ بعد از بلیت و اقامت، ${money(estimate.remaining)} می‌ماند. جای مانور داریم.`
          : `با این انتخاب‌ها ${money(Math.abs(estimate.remaining))} از بودجه رد شده‌ایم؛ باید یکی از انتخاب‌ها ارزان‌تر شود.`,
      at: 0,
    });
  }
  if (input.children > 0) {
    lines.push({
      agent: "comfort",
      text: `این سفر ${fa(input.children)} کودک دارد؛ روزی دو برنامهٔ اصلی بیشتر نمی‌گذارم و بین‌شان استراحت می‌گذارم.`,
      at: 900,
    });
  } else {
    lines.push({
      agent: "comfort",
      text: `بدون کودک سفر می‌کنید، پس می‌توانیم روزها را پرتر بچینیم و تا آخر روز گردش کنیم.`,
      at: 900,
    });
  }
  lines.push({
    agent: "places",
    text: input.placeCount
      ? `${fa(input.placeCount)} جاذبهٔ تأییدشدهٔ ${input.destination} در فهرست داریم؛ ترتیب را بر اساس فاصله از اقامتگاه می‌چینم.`
      : `برای ${input.destination} جاذبه‌های تأییدشده را می‌خوانم و بر اساس فاصلهٔ واقعی مرتب می‌کنم.`,
    at: 1800,
  });
  lines.push({
    agent: "money",
    text:
      estimate.remaining >= 0
        ? `موافقم؛ با ${fa(input.days)} روز و ${fa(people)} نفر، این ترتیب داخل بودجه می‌ماند.`
        : `قبول؛ ولی اگر اقامت ارزان‌تر شود، همه‌چیز جا می‌شود. در همان صفحه پیشنهادش را می‌دهم.`,
    at: 2700,
  });
  lines.push({ agent: "places", text: "در حال نهایی‌سازی…", at: 3600 });
  return lines;
}

export default function AgentDebate({ input }: { input: DebateInput }) {
  const lines = useMemo(() => debateLines(input), [input]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    const timers = lines.map((line, index) => window.setTimeout(() => setShown(index + 1), line.at + 120));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [lines]);

  return (
    <div className="glass mt-4 overflow-hidden p-4" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <b className="flex items-center gap-1.5 text-[11px] font-black text-white">
          <Bot className="h-3.5 w-3.5 text-violet-300" />
          سه دستیار سفرینو دارند با هم برنامه را می‌چینند
        </b>
        <span className="flex gap-1">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-violet-300"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.2 }}
            />
          ))}
        </span>
      </div>

      <div className="mt-2 space-y-1.5">
        {lines.slice(0, shown).map((line, index) => {
          const style = AGENT_STYLE[line.agent];
          const Icon = style.icon;
          return (
            <motion.div
              key={`${line.agent}-${index}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-start gap-2 rounded-xl border p-2 ${style.classes}`}
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-white/10">
                <Icon className="h-3 w-3" />
              </span>
              <span className="min-w-0">
                <b className="block text-[9px] opacity-80">{style.label}</b>
                <span className="text-[10px] leading-6 text-slate-200">{line.text}</span>
              </span>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-2 text-[8.5px] leading-5 text-slate-500">
        این گفت‌وگو از اعداد واقعی سفر تو ساخته می‌شود (بودجه، نفرات، روزها و جاذبه‌های همان شهر) و خودِ برنامه همین حالا با همین تصمیم ساخته می‌شود.
      </p>
    </div>
  );
}
