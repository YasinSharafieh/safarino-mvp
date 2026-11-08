'use client';
import { useState } from 'react';
import Link from 'next/link';

const StepIndicator = ({ step }) => (
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

export default function Quiz() {
  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={2} />
      <div className="max-w-xl mx-auto bg-gray-900/60 p-8 rounded-3xl border border-gray-800 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">مقصد و بودجه</h2>
        <div className="space-y-6">
          <input type="text" placeholder="مبدا (مثلا تهران)" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3" />
          <input type="text" placeholder="مقصد (مثلا شیراز)" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3" />
          <Link href="/transport">
            <button className="w-full bg-blue-600 py-4 rounded-xl font-bold mt-4">بعدی: هزینه حمل و نقل</button>
          </Link>
        </div>
      </div>
    </div>
  );
}