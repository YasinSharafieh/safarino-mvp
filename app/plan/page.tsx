'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTravel } from '../context/TravelContext';

const StepIndicator = ({ step }: { step: number }) => (
  <div className="w-full max-w-2xl mx-auto mb-8 px-4 print:hidden">
    <div className="flex justify-between mb-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${s <= step ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
          {s}
        </div>
      ))}
    </div>
    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
    </div>
  </div>
);

interface ItineraryItem {
  day: number;
  time: string;
  activity: string;
  cost: string;
}

interface PlanResponse {
  title: string;
  summary: string;
  itinerary: ItineraryItem[];
  aiTips: string[];
}

export default function Plan() {
  const { travelData } = useTravel();
  const [loading, setLoading] = useState<boolean>(true);
  const [plan, setPlan] = useState<PlanResponse | null>(null);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(travelData)
        });
        const data = await res.json();
        setPlan(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchPlan();
  }, [travelData]);

  const totalCost = (travelData?.transportCost || 0) + (travelData?.accommodationCost || 0);

  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-10 print:bg-white print:text-black" dir="rtl">
      <StepIndicator step={5} />

      <div className="max-w-3xl mx-auto">
        {loading ? (
          <div className="bg-gray-900/60 p-12 rounded-3xl border border-gray-800 text-center backdrop-blur-md">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-blue-400 mb-2">هوش مصنوعی سفرینو در حال پردازش است...</h3>
            <p className="text-sm text-gray-400">تنظیم بهترین برنامه ساعتی، بودجه‌بندی و توصیه‌های محلی اختصاصی برای شما</p>
          </div>
        ) : (
          <div className="bg-gray-900/60 p-8 rounded-3xl border border-gray-800 shadow-2xl backdrop-blur-md print:border-none print:bg-transparent print:p-0">
            {/* سربرگ برنامه */}
            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6 print:border-gray-300">
              <div>
                <span className="text-xs text-blue-400 font-bold bg-blue-900/30 px-3 py-1 rounded-full border border-blue-500/30 mb-2 inline-block print:hidden">
                  ✨ خروجی اختصاصی هوش مصنوعی
                </span>
                <h1 className="text-3xl font-extrabold text-white print:text-black">{plan?.title || `برنامه سفر ${travelData?.destination}`}</h1>
                <p className="text-xs text-gray-400 mt-1 print:text-gray-600">{plan?.summary}</p>
              </div>
              <button 
                onClick={() => window.print()} 
                className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 print:hidden transition-all"
              >
                🖨️ چاپ / دانلود PDF
              </button>
            </div>

            {/* خلاصه هزینه‌های سفر */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 print:hidden">
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700/60 text-center">
                <span className="text-xs text-gray-400 block mb-1">مسیر رفت و برگشت</span>
                <span className="text-sm font-bold text-blue-300">{(travelData?.transportCost || 0).toLocaleString()} تومان</span>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700/60 text-center">
                <span className="text-xs text-gray-400 block mb-1">اقامت ({travelData?.days} شب)</span>
                <span className="text-sm font-bold text-indigo-300">{(travelData?.accommodationCost || 0).toLocaleString()} تومان</span>
              </div>
              <div className="bg-blue-950/40 p-4 rounded-2xl border border-blue-500/30 text-center">
                <span className="text-xs text-blue-300 block mb-1">جمع هزینه‌های اصلی</span>
                <span className="text-sm font-bold text-emerald-400">{totalCost.toLocaleString()} تومان</span>
              </div>
            </div>

            {/* جدول برنامه‌ریزی ساعتی */}
            <div className="space-y-4 mb-8">
              <h3 className="font-bold text-lg text-gray-200 mb-4 print:text-black">🗓️ کنداکتور ساعتی سفر:</h3>
              {plan?.itinerary?.map((item, idx) => (
                <div key={idx} className="bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 flex justify-between items-center print:border-gray-300 print:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-xl text-xs font-mono font-bold print:text-black print:border-gray-400">
                      {item.time}
                    </span>
                    <span className="font-medium text-sm text-gray-200 print:text-black">{item.activity}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium print:text-gray-600">{item.cost}</span>
                </div>
              ))}
            </div>

            {/* توصیه‌های هوشمند سفرینو */}
            {plan?.aiTips && plan.aiTips.length > 0 && (
              <div className="bg-blue-950/30 border border-blue-500/30 p-5 rounded-2xl mb-8 print:border-gray-300 print:bg-gray-50">
                <h4 className="font-bold text-blue-300 text-sm mb-3 flex items-center gap-2 print:text-black">
                  💡 توصیه‌های اختصاصی سفرینو:
                </h4>
                <ul className="space-y-2 text-xs text-gray-300 leading-relaxed print:text-gray-800">
                  {plan.aiTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* دکمه بازگشت */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-800 print:hidden">
              <Link href="/">
                <button className="text-gray-400 hover:text-white text-xs font-semibold transition-colors">
                  ← شروع مجدد طراحی سفر
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
