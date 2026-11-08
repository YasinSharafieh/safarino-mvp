'use client';
import { useState } from 'react';
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

export default function Transport() {
  const [car, setCar] = useState('206');
  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={3} />
      <div className="max-w-xl mx-auto bg-gray-900/60 p-8 rounded-3xl border border-gray-800">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">محاسبه هزینه مسیر</h2>
        <select value={car} onChange={(e) => setCar(e.target.value)} className="w-full bg-gray-800 p-4 rounded-xl mb-6">
          <option value="pride">پراید</option>
          <option value="206">پژو ۲۰۶</option>
          <option value="dena">دنا پلاس</option>
        </select>
        <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 text-center mb-6">
           <p className="text-sm text-gray-400">هزینه حدودی سوخت و استهلاک:</p>
           <p className="text-2xl font-bold text-blue-400">۱,۸۰۰,۰۰۰ تومان</p>
        </div>
        <Link href="/accommodation">
          <button className="w-full bg-blue-600 py-4 rounded-xl font-bold">بعدی: انتخاب اقامتگاه</button>
        </Link>
      </div>
    </div>
  );
}