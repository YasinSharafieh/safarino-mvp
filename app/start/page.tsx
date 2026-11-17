import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass, MapPin, Sparkles, Wand2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import VoiceTripButton from "@/components/VoiceTripButton";
import ResumeTripPrompt from "@/components/ResumeTripPrompt";
import OneClickTrip from "@/components/OneClickTrip";

export const metadata: Metadata = {
  title: "شروع برنامه‌ریزی سفر",
  description: "دو راه برای شروع: مسیرت را می‌دانی یا می‌خواهی بر اساس سلیقه‌ات مقصد پیشنهاد بگیری. هر دو مسیر به برنامهٔ روزبه‌روز و اقامتگاه واقعی می‌رسد.",
  alternates: { canonical: "/start" },
};

/**
 * The first screen after «شروع برنامه‌ریزی».
 * We do not ask a question before knowing which of the two travellers we have:
 * the one who already knows where they are going, and the one who does not.
 */
export default function StartPage() {
  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#2c1256_0%,#120a26_60%)]" />
        <div className="absolute inset-0 grid-lines opacity-60" />
        <div className="aurora">
          <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-teal-500/25" />
          <span className="left-[2%] top-[32rem] h-80 w-80 animate-float bg-sky-500/20 [animation-delay:1.5s]" />
        </div>
      </div>

      <SiteHeader />

      <div className="mx-auto mt-6 max-w-4xl">
        <ResumeTripPrompt />
      </div>

      <section className="mx-auto mt-10 max-w-4xl text-center">
        <h1 className="text-2xl font-black leading-tight text-white sm:text-4xl">سفرت را از کجا شروع کنیم؟</h1>
        <p className="mx-auto mt-3 max-w-xl text-[12px] leading-7 text-slate-400">
          اگر می‌دانی کجا می‌روی، مسیر را بگو تا وسیلهٔ سفر و اقامتگاه را با هم بچینیم. اگر هنوز مطمئن نیستی،
          چند سؤال کوتاه می‌پرسیم و بر اساس سلیقه‌ات شهر پیشنهاد می‌دهیم.
        </p>
      </section>

      {/*
        One door, two ways to say the same thing. Before this, the page had two
        large blocks that both meant «tell me the trip in one sentence» — one typed,
        one spoken — and a traveller had to guess which one to use. Now it is a
        single step: write the sentence, or press the microphone and speak it. Both
        go through the same reader and both show what was understood before
        anything is written into the trip.
      */}
      <section className="mx-auto mt-8 max-w-4xl" aria-labelledby="one-sentence">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="one-sentence" className="flex items-center gap-1.5 text-sm font-black text-white">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            سریع‌ترین راه: کل سفر را با یک جمله بگو
          </h2>
          <span className="text-[10px] text-slate-500">بنویس یا میکروفون را بزن — هر دو یک کار می‌کنند</span>
        </div>
        <OneClickTrip />
        <div className="mt-2">
          <VoiceTripButton variant="compact" />
        </div>
      </section>

      <div className="mx-auto mt-6 flex max-w-4xl items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] font-bold text-slate-500">یا از یکی از این دو مسیر شروع کن</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <section className="mx-auto mt-3 grid max-w-4xl gap-3 sm:grid-cols-2">
        <Link
          href="/start/cities"
          className="glass group relative overflow-hidden p-5 transition hover:border-cyan-400/40 hover:brightness-110"
        >
          <span className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl transition group-hover:bg-cyan-400/20" />
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow">
            <MapPin className="h-5 w-5" />
          </span>
          <b className="mt-4 block text-base font-black text-white">مبدأ و مقصدم مشخص است</b>
          <p className="mt-2 text-[11px] leading-6 text-slate-400">
            مبدأ، مقصد، تاریخ و تعداد نفرات را انتخاب کن. بعد وسیلهٔ سفر، اقامتگاه، بودجه و برنامهٔ روزبه‌روز.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-cyan-200">
            انتخاب مبدأ و مقصد
            <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" />
          </span>
        </Link>

        <Link
          href="/quiz"
          className="glass group relative overflow-hidden p-5 transition hover:border-cyan-400/40 hover:brightness-110"
        >
          <span className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-teal-400/10 blur-2xl transition group-hover:bg-teal-400/20" />
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-sky-600 text-slate-950 shadow-glow">
            <Wand2 className="h-5 w-5" />
          </span>
          <b className="mt-4 block text-base font-black text-white">هنوز نمی‌دانم کجا بروم</b>
          <p className="mt-2 text-[11px] leading-6 text-slate-400">
            چند سؤال کوتاه (هر بار متفاوت) دربارهٔ حال‌وهوای سفرت، و بعد چند شهر پیشنهادی که با سلیقه‌ات جور است.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-teal-200">
            پیشنهاد مقصد بر اساس سلیقه
            <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" />
          </span>
        </Link>
      </section>

      <section className="mx-auto mt-8 max-w-4xl">
        <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="flex items-center gap-1.5 text-[10.5px] leading-6 text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            هر دو مسیر به یک جا می‌رسد: برنامهٔ روزبه‌روز با فاصلهٔ واقعی، اقامتگاه واقعی، هزینه‌ها و نسخهٔ PDF.
          </p>
          <Link href="/discover" className="text-[10.5px] font-bold text-cyan-200 hover:text-cyan-100">
            فقط می‌خواهم مقصدها را ببینم →
          </Link>
        </div>
      </section>
    </main>
  );
}
