'use client';
import Link from 'next/link';

const StepIndicator = ({ step }: { step: number }) => (
  <div className="w-full max-w-2xl mx-auto mb-8 px-4">
    <div className="flex justify-between mb-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${s <= step ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'}`}>
          {s}
        </div>
      ))}
    </div>
    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
      <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
    </div>
  </div>
);

export default function Accommodation() {
  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={4} />
      <div className="max-w-xl mx-auto bg-gray-900/60 p-8 rounded-3xl border border-gray-800">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">انتخاب اقامتگاه</h2>
        <div className="space-y-4 mb-6">
           <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 flex justify-between">
              <span>هتل ۵ ستاره</span>
              <span className="text-blue-400">۳,۰۰۰,۰۰۰ ت / شب</span>
           </div>
           <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 flex justify-between">
              <span>بوم‌گردی سنتی</span>
              <span className="text-blue-400">۹۰۰,۰۰۰ ت / شب</span>
           </div>
        </div>
        <Link href="/plan">
          <button className="w-full bg-blue-600 py-4 rounded-xl font-bold">تولید برنامه نهایی</button>
        </Link>
      </div>
    </div>
  );
}